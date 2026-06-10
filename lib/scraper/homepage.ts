import * as cheerio from "cheerio";

export type ScrapedHomepage = {
  requestedUrl: string;
  finalUrl: string;
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
    cssText: string;
  };
};

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_TEXT_LENGTH = 12_000;
const MAX_CSS_LENGTH = 30_000;
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
    return parseHomepage(html, requestedUrl, response.url || requestedUrl);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseHomepage(
  html: string,
  requestedUrl: string,
  finalUrl = requestedUrl,
): ScrapedHomepage {
  const $ = cheerio.load(html);
  const baseUrl = new URL(finalUrl);

  $("script, noscript, svg").remove();

  const title = cleanText($("title").first().text()) || null;
  const description =
    getMetaContent($, "description") ?? getMetaProperty($, "og:description");
  const canonicalUrl = resolveUrl(
    $("link[rel='canonical']").first().attr("href"),
    baseUrl,
  );
  const stylesheetHrefs = $("link[rel='stylesheet']")
    .map((_, element) => resolveUrl($(element).attr("href"), baseUrl))
    .get()
    .filter((href): href is string => Boolean(href))
    .slice(0, MAX_ITEMS);
  const cssText = $("style")
    .map((_, element) => $(element).text())
    .get()
    .map((text) => text.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_CSS_LENGTH);

  return {
    requestedUrl,
    finalUrl,
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
      cssText,
    },
  };
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
