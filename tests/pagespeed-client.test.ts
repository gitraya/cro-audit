import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPageSpeedSignals,
  fetchPageSpeedSignals,
  getCachedPageSpeedSignals,
  type PageSpeedSignals,
} from "../lib/pagespeed/client.ts";

test("extractPageSpeedSignals returns clean structured scores and vitals", () => {
  const signals = extractPageSpeedSignals(createPageSpeedFixture());

  assert.deepEqual(signals.scores, {
    performance: 82,
    accessibility: 91,
  });
  assert.deepEqual(signals.coreWebVitals, {
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
      value: 600,
      displayValue: "600 ms",
      rating: "poor",
    },
  });
});

test("extractPageSpeedSignals selects deterministic CRO-relevant top issues", () => {
  const signals = extractPageSpeedSignals(createPageSpeedFixture());

  assert.deepEqual(
    signals.topIssues.map((issue) => issue.id),
    [
      "largest-contentful-paint",
      "render-blocking-resources",
      "color-contrast",
      "image-alt",
      "tap-targets",
      "uses-responsive-images",
    ],
  );
  assert.deepEqual(signals.topIssues[0], {
    id: "largest-contentful-paint",
    title: "Largest Contentful Paint",
    description: "Largest Contentful Paint marks the time.",
  });
});

test("fetchPageSpeedSignals sends required API params and reads PAGESPEED_API_KEY", async () => {
  const previousKey = process.env.PAGESPEED_API_KEY;
  process.env.PAGESPEED_API_KEY = "test-key";
  const calls: URL[] = [];

  try {
    const signals = await fetchPageSpeedSignals("example.com", async (input) => {
      const url = input instanceof URL ? input : new URL(input);
      calls.push(url);

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return createPageSpeedFixture();
        },
      };
    });

    assert.equal(signals.scores.performance, 82);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].searchParams.get("url"), "https://example.com/");
    assert.equal(calls[0].searchParams.get("strategy"), "mobile");
    assert.equal(calls[0].searchParams.get("key"), "test-key");
    assert.deepEqual(calls[0].searchParams.getAll("category"), [
      "performance",
      "accessibility",
    ]);
  } finally {
    process.env.PAGESPEED_API_KEY = previousKey;
  }
});

test("fetchPageSpeedSignals throws a clear error when PAGESPEED_API_KEY is missing", async () => {
  const previousKey = process.env.PAGESPEED_API_KEY;
  delete process.env.PAGESPEED_API_KEY;

  try {
    await assert.rejects(
      fetchPageSpeedSignals("https://example.com", async () => {
        throw new Error("fetch should not run");
      }),
      /Missing PAGESPEED_API_KEY/,
    );
  } finally {
    process.env.PAGESPEED_API_KEY = previousKey;
  }
});

test("getCachedPageSpeedSignals returns cached signals without fetching", async () => {
  const calls: string[] = [];
  const signals = await getCachedPageSpeedSignals("https://example.com", {
    cache: {
      async read(urlKey) {
        calls.push(`read:${urlKey}`);
        return expectedSignals;
      },
      async write() {
        calls.push("write");
      },
    },
    async fetcher() {
      throw new Error("fetch should not run");
    },
  });

  assert.deepEqual(signals, expectedSignals);
  assert.deepEqual(calls, ["read:https://example.com/"]);
});

test("getCachedPageSpeedSignals fetches and writes on cache miss", async () => {
  const previousKey = process.env.PAGESPEED_API_KEY;
  process.env.PAGESPEED_API_KEY = "test-key";
  const calls: string[] = [];

  try {
    const signals = await getCachedPageSpeedSignals("https://example.com", {
      cache: {
        async read(urlKey) {
          calls.push(`read:${urlKey}`);
          return null;
        },
        async write(urlKey, value) {
          calls.push(`write:${urlKey}:${value.scores.performance}`);
        },
      },
      async fetcher() {
        calls.push("fetch");

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          async json() {
            return createPageSpeedFixture();
          },
        };
      },
    });

    assert.equal(signals?.scores.performance, 82);
    assert.deepEqual(calls, [
      "read:https://example.com/",
      "fetch",
      "write:https://example.com/:82",
    ]);
  } finally {
    process.env.PAGESPEED_API_KEY = previousKey;
  }
});

test("getCachedPageSpeedSignals logs and returns null when PageSpeed fails", async () => {
  const previousWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    const signals = await getCachedPageSpeedSignals("https://example.com", {
      cache: {
        async read() {
          return null;
        },
        async write() {},
      },
      async fetcher() {
        throw new Error("network unavailable");
      },
    });

    assert.equal(signals, null);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0][0], "PageSpeed Insights unavailable");
  } finally {
    console.warn = previousWarn;
  }
});

const expectedSignals: PageSpeedSignals = {
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
      value: 600,
      displayValue: "600 ms",
      rating: "poor",
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

function createPageSpeedFixture() {
  return {
    lighthouseResult: {
      categories: {
        performance: {
          score: 0.82,
          auditRefs: [
            { id: "uses-responsive-images", weight: 0 },
            { id: "largest-contentful-paint", weight: 25 },
            { id: "cumulative-layout-shift", weight: 5 },
            { id: "total-blocking-time", weight: 30 },
            { id: "render-blocking-resources", weight: 10 },
            { id: "interactive", weight: 0 },
            { id: "unused-javascript", weight: 40 },
          ],
        },
        accessibility: {
          score: 0.91,
          auditRefs: [
            { id: "tap-targets", weight: 7 },
            { id: "image-alt", weight: 7 },
            { id: "color-contrast", weight: 7 },
            { id: "viewport", weight: 0 },
          ],
        },
      },
      audits: {
        "largest-contentful-paint": {
          title: "Largest Contentful Paint",
          description: "Largest Contentful Paint marks the time.",
          score: 0.6,
          displayValue: "2.8 s",
          numericValue: 2800,
        },
        "cumulative-layout-shift": {
          title: "Cumulative Layout Shift",
          description: "Measures layout movement.",
          score: 0.95,
          displayValue: "0.03",
          numericValue: 0.03,
        },
        "total-blocking-time": {
          title: "Total Blocking Time",
          description: "Measures main thread blocking.",
          score: 0.2,
          displayValue: "600 ms",
          numericValue: 600,
        },
        "render-blocking-resources": {
          title: "Eliminate render-blocking resources",
          description: "Resources are blocking first paint.",
          score: 0.3,
        },
        "uses-responsive-images": {
          title: "Properly size images",
          description: "Serve responsive images.",
          score: 0.7,
        },
        interactive: {
          title: "Time to Interactive",
          description: "Time until the page is interactive.",
          score: 1,
        },
        "unused-javascript": {
          title: "Reduce unused JavaScript",
          description: "Not in the CRO allowlist.",
          score: 0.1,
        },
        "tap-targets": {
          title: "Tap targets are not sized appropriately",
          description: "Interactive targets should be easier to tap.",
          score: 0.5,
        },
        "image-alt": {
          title: "Image elements do not have alt attributes",
          description: "Images need useful alt text.",
          score: 0.5,
        },
        "color-contrast": {
          title: "Background and foreground colors lack contrast",
          description: "Low contrast can reduce readability.",
          score: 0.5,
        },
        viewport: {
          title: "Has a viewport meta tag",
          description: "Viewport is configured.",
          score: 1,
        },
      },
    },
  };
}
