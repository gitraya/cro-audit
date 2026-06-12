import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBalancedPrinciplesQueryText,
  retrieveBalancedPrinciples,
} from "../lib/cro-audit/retrieval.ts";
import { generateAudit } from "../lib/cro-audit/generation.ts";
import { validateAudit } from "../lib/cro-audit/validation.ts";
import { generateReplicatedHomepage } from "../lib/cro-audit/replication.ts";

test("buildBalancedPrinciplesQueryText includes the expected page sections", () => {
  const queryText = buildBalancedPrinciplesQueryText({
    title: "Pricing",
    description: "Reduce friction",
    headings: {
      h1: ["Checkout"],
      h2: ["Fast", "Simple"],
    },
    bodyText: "a".repeat(4_100),
    pageSpeedSummary: "LCP is slow",
  });

  assert.match(queryText, /Title: Pricing/);
  assert.match(queryText, /Description: Reduce friction/);
  assert.match(queryText, /H1: Checkout/);
  assert.match(queryText, /H2: Fast \| Simple/);
  assert.match(queryText, /PageSpeed summary: LCP is slow/);
  assert.match(queryText, /Body excerpt: a{4000}/);
});

test("retrieveBalancedPrinciples fans out per book and sorts deterministically", async () => {
  const calls: Array<{ bookTitle: string; queryEmbedding: string }> = [];
  type RetrievedPrinciple = Awaited<
    ReturnType<typeof retrieveBalancedPrinciples>
  >[number];
  const principles = await retrieveBalancedPrinciples(
    {
      title: "Landing page",
      description: "Improve conversion",
      headings: {
        h1: ["Make it easier"],
        h2: ["Remove friction"],
      },
      bodyText: "copy",
      pageSpeedSummary: "Performance issues on mobile",
    },
    {
      embedder: async (text) => {
        assert.match(text, /Title: Landing page/);
        assert.match(text, /PageSpeed summary: Performance issues on mobile/);
        return [1, 0, 0];
      },
      supabase: {
        from() {
          return {
            async select() {
              return {
                data: [
                  { book_title: "Book C" },
                  { book_title: "Book A" },
                  { book_title: "Book B" },
                  { book_title: "Book A" },
                ],
                error: null,
              };
            },
          };
        },
        async rpc(_fn, args) {
          calls.push({
            bookTitle: args.target_book,
            queryEmbedding: args.query_embedding,
          });

          const rowsByBook: Record<string, RetrievedPrinciple[]> = {
            "Book A": [
              {
                id: "a-1",
                book_title: "Book A",
                book_author: "Author A",
                principle: "Clarity wins",
                explanation: "Explain the value",
                cro_application: "Use a concise headline",
                distance: 0.3,
                similarity: 0.7,
              },
              {
                id: "a-2",
                book_title: "Book A",
                book_author: "Author A",
                principle: "Reduce steps",
                explanation: "Shorten the flow",
                cro_application: "Cut one field",
                distance: 0.1,
                similarity: 0.9,
              },
            ],
            "Book B": [
              {
                id: "b-1",
                book_title: "Book B",
                book_author: "Author B",
                principle: "Social proof",
                explanation: "Show evidence",
                cro_application: "Add testimonials",
                distance: 0.2,
                similarity: 0.8,
              },
            ],
            "Book C": [
              {
                id: "c-1",
                book_title: "Book C",
                book_author: "Author C",
                principle: "Urgency",
                explanation: "Give a reason now",
                cro_application: "Add a deadline",
                distance: 0.1,
                similarity: 0.9,
              },
            ],
          };

          return {
            data: rowsByBook[args.target_book] ?? [],
            error: null,
          };
        },
      },
    },
  );

  assert.deepEqual(
    calls.map((call) => call.bookTitle),
    ["Book A", "Book B", "Book C"],
  );
  assert.equal(calls.every((call) => call.queryEmbedding === "[1,0,0]"), true);
  assert.deepEqual(
    principles.map((principle) => [principle.book_title, principle.principle]),
    [
      ["Book A", "Reduce steps"],
      ["Book C", "Urgency"],
      ["Book B", "Social proof"],
      ["Book A", "Clarity wins"],
    ],
  );
});

test("generateAudit retries once on invalid JSON and then parses findings", async () => {
  let attempts = 0;
  const audit = await generateAudit(
    {
      title: "Landing page",
      description: "Improve conversion",
      headings: { h1: ["Convert"], h2: [] },
      bodyText: "body",
      pageSpeedSummary: null,
    },
    [
      {
        id: "1",
        book_title: "Influence",
        book_author: "Robert Cialdini",
        principle: "Social proof",
        explanation: "People trust proof",
        cro_application: "Add testimonials",
        distance: 0.2,
        similarity: 0.8,
      },
    ],
    {
      model: {
        async generateContent() {
          attempts += 1;

          return {
            response: {
              text: () =>
                attempts === 1
                  ? "{not-json"
                  : JSON.stringify({
                      findings: [
                        {
                          observation: "The page lacks testimonials near the CTA.",
                          solution: "Add proof adjacent to the conversion action.",
                          principle: "Social proof",
                          source_book: "Influence",
                        },
                      ],
                    }),
            },
          };
        },
      },
    },
  );

  assert.equal(attempts, 2);
  assert.deepEqual(audit, {
    findings: [
      {
        observation: "The page lacks testimonials near the CTA.",
        solution: "Add proof adjacent to the conversion action.",
        principle: "Social proof",
        source_book: "Influence",
      },
    ],
  });
});

test("validateAudit repairs source books and rejects hallucinated findings", () => {
  const result = validateAudit(
    {
      findings: [
        {
          observation: "The hero needs more proof.",
          solution: "Add testimonials near the CTA.",
          principle: "Social proof",
          source_book: "influence",
        },
        {
          observation: "The checkout copy is vague.",
          solution: "Make the next step explicit.",
          principle: "Clarity wins",
          source_book: "Wrong Book",
        },
        {
          observation: "A generic suggestion.",
          solution: "Do something better.",
          principle: "Invented principle",
          source_book: "Invented Book",
        },
      ],
    },
    [
      { book_title: "Influence", principle: "Social proof" },
      { book_title: "Made to Stick", principle: "Clarity wins" },
    ],
  );

  assert.deepEqual(result.validFindings, [
    {
      observation: "The hero needs more proof.",
      solution: "Add testimonials near the CTA.",
      principle: "Social proof",
      source_book: "influence",
    },
    {
      observation: "The checkout copy is vague.",
      solution: "Make the next step explicit.",
      principle: "Clarity wins",
      source_book: "Made to Stick",
    },
  ]);
  assert.equal(result.rejectedFindings.length, 1);
  assert.equal(result.sourceCoverage["influence"], 1);
  assert.equal(result.sourceCoverage["Made to Stick"], 1);
  assert.equal(result.collapsedToSingleSource, false);
});

test("generateReplicatedHomepage retries once on invalid JSON and returns html plus applied changes", async () => {
  let attempts = 0;
  let lastPrompt = "";

  const replicated = await generateReplicatedHomepage(
    {
      brandTokens: {
        colors: ["#0f766e", "#7c3aed"],
        font: { primary: "Space Grotesk", fallbacks: ["Inter"] },
        voice: {
          tone: "confident",
          formality: "neutral",
          phrases: ["Ship faster"],
        },
      },
      page: {
        url: "https://example.com/",
        title: "Ship faster",
        description: "A platform for teams",
        headings: { h1: ["Ship faster"], h2: ["Why teams choose us"] },
        bodyText: "Ship faster with the tools your team already loves.",
      },
      findings: [
        {
          observation: "The hero lacks social proof near the CTA.",
          solution: "Add a testimonial block adjacent to the primary CTA.",
          principle: "Social proof",
          source_book: "Influence",
        },
      ],
    },
    {
      model: {
        async generateContent(prompt: string) {
          attempts += 1;
          lastPrompt = prompt;

          return {
            response: {
              text: () =>
                attempts === 1
                  ? "{not-json"
                  : JSON.stringify({
                      html: "<!doctype html><html><head><style>:root{--brand-primary:#0f766e}</style></head><body><h1>Ship faster</h1><blockquote>Illustrative testimonial</blockquote></body></html>",
                      applied_changes: [
                        {
                          change:
                            "Added a testimonial block beside the primary CTA.",
                          finding_principle: "Social proof",
                          source_book: "Influence",
                        },
                      ],
                    }),
            },
          };
        },
      },
    },
  );

  assert.equal(attempts, 2);
  assert.match(lastPrompt, /Space Grotesk/);
  assert.match(lastPrompt, /Social proof/);
  assert.match(replicated.html, /^<!doctype html>/);
  assert.deepEqual(replicated.applied_changes, [
    {
      change: "Added a testimonial block beside the primary CTA.",
      finding_principle: "Social proof",
      source_book: "Influence",
    },
  ]);
});

test("generateReplicatedHomepage rejects a response missing html", async () => {
  await assert.rejects(
    generateReplicatedHomepage(
      {
        brandTokens: {
          colors: ["#0f766e"],
          font: { primary: null, fallbacks: [] },
          voice: { tone: "", formality: "neutral", phrases: [] },
        },
        page: {
          url: "https://example.com/",
          title: null,
          description: null,
          headings: { h1: [], h2: [] },
          bodyText: "copy",
        },
        findings: [],
      },
      {
        model: {
          async generateContent() {
            return {
              response: {
                text: () => JSON.stringify({ applied_changes: [] }),
              },
            };
          },
        },
      },
    ),
    /did not include html/,
  );
});
