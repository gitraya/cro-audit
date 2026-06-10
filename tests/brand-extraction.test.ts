import assert from "node:assert/strict";
import test from "node:test";
import {
  extractBrandTokens,
  extractColors,
  extractFont,
} from "../lib/brand/extraction.ts";
import type { ScrapedHomepage } from "../lib/scraper/homepage.ts";

test("extractColors deterministically returns up to three ranked real hex colors", () => {
  const cssText = `
    :root {
      --brand-primary: #0f766e;
      --brand-secondary: rgb(124, 58, 237);
      --brand-accent: #f97316;
      --gray-100: #f5f5f5;
    }
    .button { background: var(--brand-primary); color: #ffffff; }
  `;

  assert.deepEqual(extractColors(cssText), [
    "#0f766e",
    "#7c3aed",
    "#f97316",
  ]);
  assert.deepEqual(extractColors(cssText), extractColors(cssText));
});

test("extractColors does not pad missing or neutral-only colors", () => {
  assert.deepEqual(
    extractColors(`
      :root {
        --brand-primary: #0f766e;
        --surface: #f5f5f5;
      }
    `),
    ["#0f766e"],
  );
  assert.deepEqual(
    extractColors(`
      :root {
        --surface: #f5f5f5;
        --text: #111111;
      }
    `),
    [],
  );
  assert.deepEqual(extractColors(""), []);
});

test("extractColors supports hsl and hsla without padding fallbacks", () => {
  assert.deepEqual(
    extractColors(`
      :root {
        --brand-primary: hsl(174 77% 26%);
        --brand-secondary: hsla(262, 83%, 58%, 1);
        --brand-accent: hsl(24 95% 53%);
        --transparent: hsla(24, 95%, 53%, 0.1);
      }
    `),
    ["#0f756b", "#7c3bed", "#f97015"],
  );
  assert.deepEqual(
    extractColors(`
      :root {
        --surface: hsl(0 0% 96%);
        --text: hsl(0, 0%, 7%);
      }
    `),
    [],
  );
});

test("extractColors prioritizes explicit primary color declarations", () => {
  assert.deepEqual(
    extractColors(`
      :root {
        --brand-accent: #f97316;
        --brand-secondary: #7c3aed;
        --brand-primary: #0f766e;
      }
      .hero { background: #f97316; }
      .button { background: #0f766e; }
    `),
    ["#0f766e", "#f97316", "#7c3aed"],
  );
});

test("extractColors lets repeated painted usage beat one named variable", () => {
  const repeatedUsage = Array.from(
    { length: 30 },
    (_, index) => `.btn-${index}, .hero-${index} { background: #0f766e; }`,
  ).join("\n");

  assert.deepEqual(
    extractColors(`
      :root {
        --primary-subtle: #7c3aed;
      }
      ${repeatedUsage}
    `),
    ["#0f766e", "#7c3aed"],
  );
});

test("extractFont deterministically returns primary and fallback brand fonts", () => {
  const cssText = `
    :root { --font-sans: "Space Grotesk", Inter, Arial, sans-serif; }
    body { font-family: "Space Grotesk", Inter, sans-serif; }
  `;

  assert.deepEqual(extractFont(cssText), {
    primary: "Space Grotesk",
    fallbacks: ["Inter"],
  });
  assert.deepEqual(extractFont(cssText), extractFont(cssText));
});

test("extractFont returns null primary when no real font is found", () => {
  assert.deepEqual(extractFont("body { font-family: Arial, sans-serif; }"), {
    primary: null,
    fallbacks: [],
  });
});

test("extractFont ignores font size and weight variables", () => {
  const cssText = `
    :root {
      --font-size-xl: 2.125rem;
      --font-size-2xl: 2.5rem;
      --font-weight-light: 300;
      --font-sans: sohne-var, "Helvetica Neue", Arial, sans-serif;
    }
    body { font-family: sohne-var, "Helvetica Neue", sans-serif; }
  `;

  assert.deepEqual(extractFont(cssText), {
    primary: "sohne-var",
    fallbacks: ["Helvetica Neue"],
  });
});

test("extractFont ignores unresolved var function fragments", () => {
  const cssText = `
    :root {
      --framer-link-font-family: "Google Sans Flex";
      --framer-link-font-family-placeholder: "Google Sans Flex Placeholder";
      --framer-font-family: "Space Grotesk";
      --framer-font-family-placeholder: "Space Grotesk Placeholder";
    }
    a {
      font-family:
        var(--framer-link-font-family, var(--fallback-font, "Google Sans Flex")),
        var(--framer-font-family, "Space Grotesk"),
        "Google Sans Flex Placeholder",
        "Space Grotesk Placeholder",
        sans-serif;
    }
  `;

  assert.deepEqual(extractFont(cssText), {
    primary: "Google Sans Flex",
    fallbacks: ["Space Grotesk"],
  });
});

test("extractBrandTokens preserves empty provider tone", async () => {
  const tokens = await extractBrandTokens(
    {
      ...createScrapedHomepage(),
      finalUrl: "https://empty-tone.example/",
      requestedUrl: "https://empty-tone.example/",
    },
    async () => ({
      tone: "   ",
      formality: "neutral",
      phrases: [],
    }),
  );

  assert.equal(tokens.voice.tone, "");
});

test("extractBrandTokens persists only brand identity and caches voice by URL", async () => {
  const scraped = createScrapedHomepage();
  let providerCalls = 0;
  const firstTokens = await extractBrandTokens(scraped, async () => {
    providerCalls += 1;

    return {
      tone: "confident",
      formality: "formal",
      phrases: ["Grow faster", "Trusted by operators"],
    };
  });
  const secondTokens = await extractBrandTokens(scraped, async () => {
    providerCalls += 1;

    return {
      tone: "different",
      formality: "casual",
      phrases: ["Should not be used"],
    };
  });

  assert.equal(providerCalls, 1);
  assert.deepEqual(firstTokens, secondTokens);
  assert.deepEqual(Object.keys(firstTokens), [
    "colors",
    "font",
    "voice",
    "extraction_method",
  ]);
  assert.deepEqual(firstTokens.colors, ["#0f766e", "#7c3aed", "#f97316"]);
  assert.deepEqual(firstTokens.font, {
    primary: "Space Grotesk",
    fallbacks: ["Inter"],
  });
  assert.doesNotMatch(JSON.stringify(firstTokens), /html/);
  assert.doesNotMatch(JSON.stringify(firstTokens), /bodyText/);
});

function createScrapedHomepage(): ScrapedHomepage {
  return {
    requestedUrl: "https://example.com/",
    finalUrl: "https://example.com/",
    html: `
      <!doctype html>
      <html>
        <head><title>Example</title></head>
        <body><h1>Grow faster</h1></body>
      </html>
    `,
    title: "Example",
    description: "A conversion-focused homepage",
    canonicalUrl: "https://example.com/",
    headings: {
      h1: ["Grow faster"],
      h2: ["Trusted by operators"],
      h3: [],
    },
    bodyText: "Grow faster with a trusted platform for operators.",
    links: [],
    images: [],
    styles: {
      inlineStyleCount: 0,
      stylesheetHrefs: [],
      externalStylesheetCount: 1,
      cssText: `
        :root {
          --brand-primary: #0f766e;
          --brand-secondary: #7c3aed;
          --brand-accent: #f97316;
          --font-sans: "Space Grotesk", Inter, sans-serif;
        }
        body { font-family: "Space Grotesk", Inter, sans-serif; }
      `,
    },
  };
}
