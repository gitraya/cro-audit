import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuditEndpoint,
  getAuditsEndpoint,
} from "../lib/api/audits.ts";
import type { BrandTokens } from "../lib/brand/extraction.ts";
import type { PageSpeedSignals } from "../lib/pagespeed/client.ts";
import type { ScrapedHomepage } from "../lib/scraper/homepage.ts";
import { getUserEndpoint } from "../lib/api/user.ts";

const authenticatedUser = {
  id: "user-123",
  email: "raya@example.com",
};

test("GET /api/user returns 401 without an authenticated user", async () => {
  const response = await getUserEndpoint(createUserClient({ user: null }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("GET /api/user returns the authenticated user profile", async () => {
  const profile = {
    id: authenticatedUser.id,
    email: authenticatedUser.email,
    full_name: "Raya",
  };
  const response = await getUserEndpoint(
    createUserClient({ user: authenticatedUser, profileData: profile }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    user: authenticatedUser,
    profile,
  });
});

test("GET /api/user returns 500 when profile lookup fails", async () => {
  const response = await getUserEndpoint(
    createUserClient({
      user: authenticatedUser,
      profileError: { message: "profile lookup failed" },
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "profile lookup failed" });
});

test("GET /api/audits returns 401 without an authenticated user", async () => {
  const response = await getAuditsEndpoint(createAuditsClient({ user: null }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("GET /api/audits returns audit history ordered by newest first", async () => {
  const audits = [
    {
      id: "audit-2",
      user_id: authenticatedUser.id,
      url: "https://new.example",
      status: "queued",
      created_at: "2026-06-10T00:00:00.000Z",
    },
  ];
  const client = createAuditsClient({
    user: authenticatedUser,
    auditsData: audits,
  });
  const response = await getAuditsEndpoint(client);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { audits });
  assert.deepEqual(client.calls.order, {
    column: "created_at",
    options: { ascending: false },
  });
});

test("GET /api/audits returns 500 when audit history lookup fails", async () => {
  const response = await getAuditsEndpoint(
    createAuditsClient({
      user: authenticatedUser,
      auditsError: { message: "audit query failed" },
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "audit query failed" });
});

test("POST /api/audits returns 401 without an authenticated user", async () => {
  const response = await createAuditEndpoint(
    createJsonRequest({ url: "https://example.com" }),
    createAuditsClient({ user: null }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("POST /api/audits returns 400 when URL is missing", async () => {
  const response = await createAuditEndpoint(
    createJsonRequest({ url: "   " }),
    createAuditsClient({ user: authenticatedUser }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "URL is required" });
});

test("POST /api/audits creates a queued audit with the authenticated user id", async () => {
  const scrape = createScrapedHomepage({
    requestedUrl: "https://example.com/",
  });
  const audit = {
    id: "audit-1",
    user_id: authenticatedUser.id,
    url: scrape.requestedUrl,
    status: "queued",
  };
  const client = createAuditsClient({
    user: authenticatedUser,
    insertedAuditData: audit,
  });
  const response = await createAuditEndpoint(
    createJsonRequest({ url: "  https://example.com  " }),
    client,
    async () => scrape,
    undefined,
    async () => expectedPageSpeedSignals,
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { audit });
  assert.deepEqual(client.calls.insert, {
    user_id: authenticatedUser.id,
    url: scrape.requestedUrl,
    status: "queued",
    brand_tokens: expectedBrandTokens,
    pagespeed_data: expectedPageSpeedSignals,
  });
  assert.doesNotMatch(JSON.stringify(client.calls.insert?.brand_tokens), /scrape/);
  assert.doesNotMatch(JSON.stringify(client.calls.insert?.brand_tokens), /bodyText/);
  assert.doesNotMatch(JSON.stringify(client.calls.insert?.brand_tokens), /html/);
});

test("POST /api/audits starts PageSpeed collection before scrape completes", async () => {
  let pageSpeedStarted = false;
  let scrapeSawPageSpeedStarted = false;
  const client = createAuditsClient({
    user: authenticatedUser,
    insertedAuditData: {
      id: "audit-1",
      user_id: authenticatedUser.id,
      url: "https://api.example.com/",
      status: "queued",
    },
  });

  const response = await createAuditEndpoint(
    createJsonRequest({ url: "https://example.com" }),
    client,
    async () => {
      scrapeSawPageSpeedStarted = pageSpeedStarted;
      return createScrapedHomepage();
    },
    undefined,
    async () => {
      pageSpeedStarted = true;
      return expectedPageSpeedSignals;
    },
  );

  assert.equal(response.status, 201);
  assert.equal(scrapeSawPageSpeedStarted, true);
});

test("POST /api/audits returns 422 when scraping fails", async () => {
  const response = await createAuditEndpoint(
    createJsonRequest({ url: "https://example.com" }),
    createAuditsClient({ user: authenticatedUser }),
    async () => {
      throw new Error("Failed to fetch page: 404");
    },
    undefined,
    async () => null,
  );

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "Failed to fetch page: 404" });
});

test("POST /api/audits returns 500 when audit insert fails", async () => {
  const response = await createAuditEndpoint(
    createJsonRequest({ url: "https://example.com" }),
    createAuditsClient({
      user: authenticatedUser,
      insertError: { message: "insert failed" },
    }),
    async () => createScrapedHomepage(),
    undefined,
    async () => expectedPageSpeedSignals,
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "insert failed" });
});

function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/audits", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
}

function createUserClient(options: {
  user: typeof authenticatedUser | null;
  profileData?: unknown;
  profileError?: { message: string } | null;
}) {
  return {
    auth: {
      async getUser() {
        return { data: { user: options.user } };
      },
    },
    from(table: string) {
      assert.equal(table, "profiles");

      return {
        select(columns: string) {
          assert.equal(columns, "*");

          return {
            eq(column: string, value: string) {
              assert.equal(column, "id");
              assert.equal(value, options.user?.id);

              return {
                async single() {
                  return {
                    data: options.profileData ?? null,
                    error: options.profileError ?? null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function createAuditsClient(options: {
  user: typeof authenticatedUser | null;
  auditsData?: unknown[];
  auditsError?: { message: string } | null;
  insertedAuditData?: unknown;
  insertError?: { message: string } | null;
}) {
  const calls: {
    order?: {
      column: string;
      options: { ascending: boolean };
    };
    insert?: {
      user_id: string;
      url: string;
      status: "queued";
      brand_tokens: BrandTokens;
      pagespeed_data: PageSpeedSignals | null;
    };
  } = {};

  return {
    calls,
    auth: {
      async getUser() {
        return { data: { user: options.user } };
      },
    },
    from(table: string) {
      assert.equal(table, "audits");

      return {
        select(columns: string) {
          assert.equal(columns, "*");

          return {
            async order(column: string, orderOptions: { ascending: boolean }) {
              calls.order = { column, options: orderOptions };

              return {
                data: options.auditsData ?? [],
                error: options.auditsError ?? null,
              };
            },
          };
        },
        insert(values: {
          user_id: string;
          url: string;
          status: "queued";
          brand_tokens: BrandTokens;
          pagespeed_data: PageSpeedSignals | null;
        }) {
          calls.insert = values;

          return {
            select(columns: string) {
              assert.equal(columns, "*");

              return {
                async single() {
                  return {
                    data: options.insertedAuditData ?? null,
                    error: options.insertError ?? null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function createScrapedHomepage(
  overrides: Partial<ScrapedHomepage> = {},
): ScrapedHomepage {
  return {
    requestedUrl: "https://api.example.com/",
    finalUrl: "https://api.example.com/",
    html: "<!doctype html><html><head><title>Example</title></head><body>Example body</body></html>",
    title: "Example",
    description: "Example description",
    canonicalUrl: "https://api.example.com/",
    headings: {
      h1: ["Example"],
      h2: [],
      h3: [],
    },
    bodyText: "Example body",
    links: [],
    images: [],
    styles: {
      inlineStyleCount: 0,
      stylesheetHrefs: [],
      externalStylesheetCount: 0,
      cssText: `
        :root {
          --brand-primary: #0f766e;
          --brand-secondary: #7c3aed;
          --brand-accent: #f97316;
          --font-sans: "Space Grotesk", Inter, sans-serif;
        }
      `,
    },
    ...overrides,
  };
}

const expectedBrandTokens: BrandTokens = {
  colors: ["#0f766e", "#7c3aed", "#f97316"],
  font: {
    primary: "Space Grotesk",
    fallbacks: ["Inter"],
  },
  voice: {
    tone: "",
    formality: "neutral",
    phrases: ["Example", "Example description"],
  },
  extraction_method: {
    colors:
      "Deterministic CSS parser ranks real CSS and theme metadata colors, filters transparent and neutral values, and returns up to 3 found hex values with no invented fallbacks.",
    font:
      "Deterministic CSS parser ranks real font-family declarations from CSS variables, document root, and body-level rules; generic and icon fonts are excluded and no font is invented.",
    voice:
      "URL-cached deterministic voice extraction from title, meta description, headings, and body copy; no LLM provider configured and no defaults are invented.",
  },
};

const expectedPageSpeedSignals: PageSpeedSignals = {
  scores: {
    performance: 82,
    accessibility: 91,
  },
  coreWebVitals: {
    lcp: {
      value: 2800,
      displayValue: "2.8 s",
      rating: "needs-improvement",
    },
    cls: {
      value: 0.03,
      displayValue: "0.03",
      rating: "good",
    },
    tbt: {
      value: 180,
      displayValue: "180 ms",
      rating: "needs-improvement",
    },
  },
  topIssues: [
    {
      id: "largest-contentful-paint",
      title: "Largest Contentful Paint",
      description: "Largest Contentful Paint marks the time.",
    },
  ],
};
