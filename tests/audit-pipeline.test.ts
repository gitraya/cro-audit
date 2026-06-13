import assert from "node:assert/strict";
import test from "node:test";
import { runAuditPipeline } from "../lib/cro-audit/pipeline.ts";
import type { AuditMutationClient } from "../lib/api/audit-repository.ts";
import type { VoiceProvider } from "../lib/brand/extraction.ts";
import type { PageSpeedSignals } from "../lib/pagespeed/client.ts";
import type { ScrapedHomepage } from "../lib/scraper/homepage.ts";

const voiceProvider: VoiceProvider = async () => ({
  tone: "confident",
  formality: "neutral",
  phrases: ["Ship faster"],
});

test("runAuditPipeline advances every stage and completes with artifacts", async () => {
  const client = createMutationClient();
  const replicationInputs: unknown[] = [];

  await runAuditPipeline("audit-1", "https://example.com", {
    supabase: client,
    scraper: async () => createScrapedHomepage(),
    voiceProvider,
    pageSpeedCollector: async () => pageSpeedSignals,
    principleRetriever: async () => [
      {
        id: "p-1",
        book_title: "Influence",
        book_author: "Cialdini",
        principle: "Social proof",
        explanation: "People follow others.",
        cro_application: "Show testimonials.",
        distance: 0.2,
        similarity: 0.8,
      },
    ],
    auditGenerator: async () => ({ findings: mockFindings }),
    homepageReplicator: async (input) => {
      replicationInputs.push(input);
      return { html: mockHtml, applied_changes: mockAppliedChanges };
    },
  });

  // Stages are reported in order; the insert already set 'scraping'.
  assert.deepEqual(client.stages, [
    "analyzing_performance",
    "extracting_brand",
    "auditing",
    "generating",
  ]);

  // Terminal update marks the audit complete with the produced artifacts.
  const terminal = client.updates.at(-1)!;
  assert.equal(terminal.id, "audit-1");
  assert.equal(terminal.values.status, "completed");
  assert.equal(terminal.values.stage, "done");
  assert.equal(terminal.values.error_message, null);
  assert.equal(terminal.values.generated_html, mockHtml);
  assert.deepEqual(terminal.values.applied_changes, mockAppliedChanges);
  assert.equal(terminal.values.url, "https://example.com/");

  const findingsUpdate = client.updates.find(
    (entry) => entry.values.stage === "generating",
  );
  assert.ok(findingsUpdate);
  assert.deepEqual(findingsUpdate.values.findings, mockFindings);

  // The replicator receives the validated findings and brand-derived tokens.
  assert.equal(replicationInputs.length, 1);
});

test("runAuditPipeline starts PageSpeed collection before scrape resolves", async () => {
  const client = createMutationClient();
  let pageSpeedStarted = false;
  let scrapeSawPageSpeedStarted = false;

  await runAuditPipeline("audit-1", "https://example.com", {
    supabase: client,
    scraper: async () => {
      scrapeSawPageSpeedStarted = pageSpeedStarted;
      return createScrapedHomepage();
    },
    voiceProvider,
    pageSpeedCollector: async () => {
      pageSpeedStarted = true;
      return pageSpeedSignals;
    },
    principleRetriever: async () => [],
    auditGenerator: async () => ({ findings: [] }),
    homepageReplicator: async () => ({
      html: "<!doctype html><html></html>",
      applied_changes: [],
    }),
  });

  assert.equal(scrapeSawPageSpeedStarted, true);
  assert.equal(client.updates.at(-1)!.values.status, "completed");
});

test("runAuditPipeline still completes when replication fails", async () => {
  const client = createMutationClient();

  await runAuditPipeline("audit-1", "https://example.com", {
    supabase: client,
    scraper: async () => createScrapedHomepage(),
    voiceProvider,
    pageSpeedCollector: async () => pageSpeedSignals,
    principleRetriever: async () => [
      {
        id: "p-1",
        book_title: "Influence",
        book_author: "Cialdini",
        principle: "Social proof",
        explanation: "People follow others.",
        cro_application: "Show testimonials.",
        distance: 0.2,
        similarity: 0.8,
      },
    ],
    auditGenerator: async () => ({ findings: mockFindings }),
    homepageReplicator: async () => {
      throw new Error("replication boom");
    },
  });

  const terminal = client.updates.at(-1)!;
  assert.equal(terminal.values.status, "completed");
  assert.equal(terminal.values.generated_html, null);
  assert.equal(terminal.values.applied_changes, null);

  const findingsUpdate = client.updates.find(
    (entry) => entry.values.stage === "generating",
  );
  assert.ok(findingsUpdate);
  assert.deepEqual(findingsUpdate.values.findings, mockFindings);
});

test("runAuditPipeline marks the audit failed when a stage throws", async () => {
  const client = createMutationClient();

  await runAuditPipeline("audit-1", "https://example.com", {
    supabase: client,
    scraper: async () => {
      throw new Error("Failed to fetch page: 404");
    },
    voiceProvider,
    pageSpeedCollector: async () => pageSpeedSignals,
    principleRetriever: async () => [],
    auditGenerator: async () => ({ findings: [] }),
    homepageReplicator: async () => ({
      html: "<!doctype html><html></html>",
      applied_changes: [],
    }),
  });

  // Never reached a stage update; failed terminally with the reason recorded.
  assert.deepEqual(client.stages, []);
  const terminal = client.updates.at(-1)!;
  assert.equal(terminal.values.status, "failed");
  assert.equal(terminal.values.error_message, "Failed to fetch page: 404");
});

function createMutationClient(options: { error?: { message: string } } = {}) {
  const updates: Array<{ values: Record<string, unknown>; id: string }> = [];
  const stages: string[] = [];

  const client = {
    updates,
    stages,
    from(table: "audits") {
      assert.equal(table, "audits");

      return {
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, id: string) {
              assert.equal(column, "id");
              updates.push({ values, id });

              // A plain stage update has exactly the one `stage` key.
              if (
                typeof values.stage === "string" &&
                values.status === undefined
              ) {
                stages.push(values.stage);
              }

              return Promise.resolve({ error: options.error ?? null });
            },
          };
        },
      };
    },
  };

  return client as typeof client & AuditMutationClient;
}

const mockFindings = [
  {
    observation: "The hero lacks social proof.",
    solution: "Add testimonials near the CTA.",
    principle: "Social proof",
    source_book: "Influence",
  },
];

const mockAppliedChanges = [
  {
    change: "Added a testimonial block beside the primary CTA.",
    finding_principle: "Social proof",
    source_book: "Influence",
  },
];

const mockHtml =
  "<!doctype html><html><head><style>:root{--brand-primary:#0f766e}</style></head><body><h1>Example</h1></body></html>";

function createScrapedHomepage(
  overrides: Partial<ScrapedHomepage> = {},
): ScrapedHomepage {
  return {
    requestedUrl: "https://example.com/",
    finalUrl: "https://example.com/",
    html: "<!doctype html><html><head><title>Example</title></head><body>Example body</body></html>",
    title: "Example",
    description: "Example description",
    canonicalUrl: "https://example.com/",
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
    hero: { classNames: [], inlineTextAlign: null },
    ...overrides,
  };
}

const pageSpeedSignals: PageSpeedSignals = {
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
