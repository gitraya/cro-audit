import assert from "node:assert/strict";
import test from "node:test";
import { parseHomepage } from "../lib/scraper/homepage.ts";

test("parseHomepage extracts structured homepage data with Cheerio", () => {
  const scraped = parseHomepage(
    `
      <!doctype html>
      <html>
        <head>
          <title>Example Home</title>
          <meta name="description" content="A conversion-focused homepage">
          <link rel="canonical" href="/home">
          <link rel="stylesheet" href="/styles.css">
          <style>
            :root { --brand: #112233; }
            body { font-family: Inter, sans-serif; }
          </style>
        </head>
        <body>
          <h1>Grow faster</h1>
          <h2>Trusted by operators</h2>
          <h3>Proof point</h3>
          <p>Clear copy for the page.</p>
          <a href="/pricing">Pricing</a>
          <img src="/hero.png" alt="Product dashboard">
          <div style="color: #112233">Inline style</div>
          <script>window.bad = true;</script>
        </body>
      </html>
    `,
    "https://example.com",
    "https://example.com/",
  );

  assert.equal(scraped.requestedUrl, "https://example.com");
  assert.equal(scraped.finalUrl, "https://example.com/");
  assert.equal(scraped.title, "Example Home");
  assert.equal(scraped.description, "A conversion-focused homepage");
  assert.equal(scraped.canonicalUrl, "https://example.com/home");
  assert.deepEqual(scraped.headings, {
    h1: ["Grow faster"],
    h2: ["Trusted by operators"],
    h3: ["Proof point"],
  });
  assert.match(scraped.bodyText, /Clear copy for the page/);
  assert.doesNotMatch(scraped.bodyText, /window\.bad/);
  assert.deepEqual(scraped.links, [
    {
      text: "Pricing",
      href: "https://example.com/pricing",
    },
  ]);
  assert.deepEqual(scraped.images, [
    {
      alt: "Product dashboard",
      src: "https://example.com/hero.png",
    },
  ]);
  assert.equal(scraped.styles.inlineStyleCount, 1);
  assert.deepEqual(scraped.styles.stylesheetHrefs, [
    "https://example.com/styles.css",
  ]);
  assert.equal(scraped.styles.externalStylesheetCount, 0);
  assert.match(scraped.styles.cssText, /--brand: #112233/);
  assert.match(scraped.styles.cssText, /color: #112233/);
  assert.doesNotMatch(JSON.stringify(scraped), /brandTokens/);
});

test("parseHomepage folds external stylesheet CSS into transient scrape data", () => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>External Styles</title>
        <link rel="preload" as="style" href="/assets/site.css">
      </head>
      <body>
        <h1>Build better funnels</h1>
      </body>
    </html>
  `;
  const externalStylesheets = [
    {
      href: "https://example.com/assets/site.css",
      cssText: `
        :root {
          --brand-primary: #0f766e;
          --brand-secondary: #7c3aed;
          --brand-accent: #f97316;
        }
        body { font-family: "Space Grotesk", Arial, sans-serif; }
        .button { background: var(--brand-primary); color: #ffffff; }
      `,
    },
  ];

  const scraped = parseHomepage(
    html,
    "https://example.com",
    "https://example.com/",
    { externalStylesheets },
  );

  assert.deepEqual(scraped.styles.stylesheetHrefs, [
    "https://example.com/assets/site.css",
  ]);
  assert.equal(scraped.styles.externalStylesheetCount, 1);
  assert.match(scraped.styles.cssText, /--brand-primary: #0f766e/);
  assert.doesNotMatch(JSON.stringify(scraped), /brandTokens/);
});
