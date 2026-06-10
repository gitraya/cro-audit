import * as cheerio from "cheerio";

export type ScrapedHomepage = {
  requestedUrl: string;
  finalUrl: string;
  html: string;
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  bodyText: string;
  links: Array<{
    text: string;
    href: string;
  }>;
  images: Array<{
    alt: string | null;
    src: string;
  }>;
  styles: {
    inlineStyleCount: number;
    stylesheetHrefs: string[];
    externalStylesheetCount: number;
    cssText: string;
  };
};

type StylesheetSource = {
  href: string;
  cssText: string;
};

type ParseHomepageOptions = {
  externalStylesheets?: StylesheetSource[];
};

const REQUEST_TIMEOUT_MS = 15_000;
const STYLESHEET_TIMEOUT_MS = 8_000;
const MAX_TEXT_LENGTH = 12_000;
const MAX_CSS_LENGTH = 120_000;
const MAX_STYLESHEET_CSS_LENGTH = 60_000;
const MAX_EXTERNAL_STYLESHEETS = 10;
const MAX_CSS_IMPORT_DEPTH = 1;
const MAX_ITEMS = 40;

export async function scrapeHomepage(rawUrl: string): Promise<ScrapedHomepage> {
  const requestedUrl = normalizeUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(requestedUrl, {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (compatible; MonolitlabsAuditBot/1.0; +https://monolitlabs.ai.raya.bio)",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error(`Expected HTML response, received ${contentType}`);
    }

    const html = await response.text();
    const finalUrl = response.url || requestedUrl;
    const shallowScrape = parseHomepage(html, requestedUrl, finalUrl);
    const externalStylesheets = await fetchExternalStylesheets(
      shallowScrape.styles.stylesheetHrefs,
    );

    return parseHomepage(html, requestedUrl, finalUrl, {
      externalStylesheets,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function parseHomepage(
  html: string,
  requestedUrl: string,
  finalUrl = requestedUrl,
  options: ParseHomepageOptions = {},
): ScrapedHomepage {
  const $ = cheerio.load(html);
  const baseUrl = new URL(finalUrl);
  const externalStylesheets = options.externalStylesheets ?? [];

  $("script, noscript, svg").remove();

  const inlineStyleTags = $("style")
    .map((_, element) => $(element).text())
    .get()
    .map((text) => text.trim())
    .filter(Boolean);
  const inlineStyleAttributes = $("[style]")
    .map((_, element) => $(element).attr("style")?.trim())
    .get()
    .filter(Boolean)
    .map((style) => `* { ${style} }`);
  const externalCssBlocks = externalStylesheets.map(
    (source) => `/* source: ${source.href} */\n${source.cssText.trim()}`,
  );
  const cssText = [inlineStyleTags, inlineStyleAttributes, externalCssBlocks]
    .flat()
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_CSS_LENGTH);
  const title = cleanText($("title").first().text()) || null;
  const description =
    getMetaContent($, "description") ?? getMetaProperty($, "og:description");
  const canonicalUrl = resolveUrl(
    $("link[rel='canonical']").first().attr("href"),
    baseUrl,
  );
  const stylesheetHrefs = $("link[href]")
    .filter((_, element) =>
      isStylesheetLink($(element).attr("rel"), $(element).attr("as")),
    )
    .map((_, element) => resolveUrl($(element).attr("href"), baseUrl))
    .get()
    .filter((href): href is string => Boolean(href))
    .filter((href, index, hrefs) => hrefs.indexOf(href) === index)
    .slice(0, MAX_ITEMS);

  return {
    requestedUrl,
    finalUrl,
    html,
    title,
    description,
    canonicalUrl,
    headings: {
      h1: collectText($, "h1"),
      h2: collectText($, "h2"),
      h3: collectText($, "h3"),
    },
    bodyText: cleanText($("body").text()).slice(0, MAX_TEXT_LENGTH),
    links: $("a[href]")
      .map((_, element) => {
        const text = cleanText($(element).text());
        const href = resolveUrl($(element).attr("href"), baseUrl);

        return href ? { text, href } : null;
      })
      .get()
      .filter((link): link is { text: string; href: string } => Boolean(link))
      .slice(0, MAX_ITEMS),
    images: $("img[src]")
      .map((_, element) => {
        const src = resolveUrl($(element).attr("src"), baseUrl);
        const alt = cleanText($(element).attr("alt") ?? "") || null;

        return src ? { alt, src } : null;
      })
      .get()
      .filter((image): image is { alt: string | null; src: string } =>
        Boolean(image),
      )
      .slice(0, MAX_ITEMS),
    styles: {
      inlineStyleCount: $("[style]").length,
      stylesheetHrefs,
      externalStylesheetCount: externalStylesheets.length,
      cssText,
    },
  };
}

async function fetchExternalStylesheets(initialHrefs: string[]) {
  const sources: StylesheetSource[] = [];
  const seen = new Set<string>();
  let queue = initialHrefs.slice(0, MAX_EXTERNAL_STYLESHEETS);

  for (
    let depth = 0;
    depth <= MAX_CSS_IMPORT_DEPTH &&
    queue.length > 0 &&
    sources.length < MAX_EXTERNAL_STYLESHEETS;
    depth += 1
  ) {
    const batch = queue
      .filter((href) => {
        if (seen.has(href)) {
          return false;
        }

        seen.add(href);
        return true;
      })
      .slice(0, MAX_EXTERNAL_STYLESHEETS - sources.length);
    const fetchedStylesheets = await Promise.all(batch.map(fetchStylesheet));
    const importHrefs: string[] = [];

    for (const source of fetchedStylesheets) {
      if (!source) {
        continue;
      }

      sources.push(source);

      if (depth < MAX_CSS_IMPORT_DEPTH) {
        importHrefs.push(...extractCssImportHrefs(source.cssText, source.href));
      }
    }

    queue = importHrefs.filter((href) => !seen.has(href));
  }

  return sources;
}

async function fetchStylesheet(href: string): Promise<StylesheetSource | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STYLESHEET_TIMEOUT_MS);

  try {
    const response = await fetch(href, {
      headers: {
        accept: "text/css,*/*;q=0.5",
        "user-agent":
          "Mozilla/5.0 (compatible; MonolitlabsAuditBot/1.0; +https://monolitlabs.ai.raya.bio)",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const cssText = (await response.text())
      .trim()
      .slice(0, MAX_STYLESHEET_CSS_LENGTH);

    return cssText ? { href, cssText } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractCssImportHrefs(cssText: string, stylesheetHref: string) {
  const imports: string[] = [];
  const importRegex =
    /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?[^;]*;/gi;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(cssText)) && imports.length < MAX_ITEMS) {
    const href = resolveUrl(match[1], new URL(stylesheetHref));

    if (href) {
      imports.push(href);
    }
  }

  return imports;
}

function isStylesheetLink(rel: string | undefined, asValueRaw: string | undefined) {
  const relTokens = (rel ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const asValue = (asValueRaw ?? "").toLowerCase();

  return relTokens.includes("stylesheet") || asValue === "style";
}

function normalizeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL must use http or https");
  }

  return url.toString();
}

function collectText($: cheerio.CheerioAPI, selector: string) {
  return $(selector)
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

function getMetaContent($: cheerio.CheerioAPI, name: string) {
  return cleanText($(`meta[name='${name}']`).first().attr("content") ?? "") || null;
}

function getMetaProperty($: cheerio.CheerioAPI, property: string) {
  return (
    cleanText($(`meta[property='${property}']`).first().attr("content") ?? "") ||
    null
  );
}

function resolveUrl(value: string | undefined, baseUrl: URL) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
