import {
  failAudit,
  updateAuditStage,
  type AuditMutationClient,
} from "../api/audit-repository.ts";
import { createServiceSupabaseClient } from "../supabase/admin.ts";
import { extractBrandTokens, type VoiceProvider } from "../brand/extraction.ts";
import { createGeminiVoiceProvider } from "../brand/voice/gemini-provider.ts";
import {
  getCachedPageSpeedSignals,
  type PageSpeedSignals,
} from "../pagespeed/client.ts";
import { scrapeHomepage, type ScrapedHomepage } from "../scraper/homepage.ts";
import {
  retrieveBalancedPrinciples,
  type BalancedPrinciple,
  type BalancedPrinciplesInput,
} from "./retrieval.ts";
import { generateAudit, type GeneratedAudit } from "./generation.ts";
import { validateAudit } from "./validation.ts";
import {
  generateReplicatedHomepage,
  type ReplicatedHomepage,
  type ReplicationInput,
} from "./replication.ts";
import type { Json } from "../supabase/types.ts";

export type AuditPipelineDeps = {
  supabase?: AuditMutationClient;
  scraper?: (url: string) => Promise<ScrapedHomepage>;
  voiceProvider?: VoiceProvider;
  pageSpeedCollector?: (url: string) => Promise<PageSpeedSignals | null>;
  principleRetriever?: (
    inputs: BalancedPrinciplesInput,
  ) => Promise<BalancedPrinciple[]>;
  auditGenerator?: (
    inputs: BalancedPrinciplesInput,
    principles: BalancedPrinciple[],
  ) => Promise<GeneratedAudit>;
  homepageReplicator?: (
    inputs: ReplicationInput,
  ) => Promise<ReplicatedHomepage>;
};

/**
 * Runs the full CRO pipeline for an already-inserted audit row (status queued,
 * stage 'scraping'). Designed to run AFTER the HTTP response is sent. It updates
 * `stage` as each step completes and always reaches a terminal state:
 * updateAuditStage with status: completed on success, failAudit on any thrown stage. It never rethrows,
 * so the background task cannot hang the request.
 */
export async function runAuditPipeline(
  auditId: string,
  submittedUrl: string,
  deps: AuditPipelineDeps = {},
): Promise<void> {
  const supabase =
    deps.supabase ??
    (createServiceSupabaseClient() as unknown as AuditMutationClient);
  const scraper = deps.scraper ?? scrapeHomepage;
  const pageSpeedCollector =
    deps.pageSpeedCollector ?? getCachedPageSpeedSignals;
  const principleRetriever =
    deps.principleRetriever ?? retrieveBalancedPrinciples;
  const auditGenerator = deps.auditGenerator ?? generateAudit;
  const homepageReplicator =
    deps.homepageReplicator ?? generateReplicatedHomepage;

  try {
    // Stage 'scraping' is set at insert time. Start both network calls together.
    const pageSpeedPromise = pageSpeedCollector(submittedUrl);
    const scrapePromise = scraper(submittedUrl);
    const scrapedPage = await scrapePromise;

    await updateAuditStage(
      auditId,
      { stage: "analyzing_performance" },
      supabase,
    );
    const pageSpeedData = await pageSpeedPromise;

    await updateAuditStage(
      auditId,
      {
        stage: "extracting_brand",
        pagespeed_data: (pageSpeedData ?? null) as unknown as Json,
      },
      supabase,
    );
    const voiceProvider = deps.voiceProvider ?? createGeminiVoiceProvider();
    const brandTokens = await extractBrandTokens(scrapedPage, voiceProvider);

    await updateAuditStage(
      auditId,
      { stage: "auditing", brand_tokens: brandTokens as unknown as Json },
      supabase,
    );
    const inputs: BalancedPrinciplesInput = {
      title: scrapedPage.title,
      description: scrapedPage.description,
      headings: { h1: scrapedPage.headings.h1, h2: scrapedPage.headings.h2 },
      bodyText: scrapedPage.bodyText,
      pageSpeedSummary: pageSpeedData
        ? buildPageSpeedSummary(pageSpeedData)
        : null,
    };
    const principles = await principleRetriever(inputs);
    console.log("Found book principles: ", principles);

    const generated = await auditGenerator(inputs, principles);
    const {
      validFindings,
      rejectedFindings,
      sourceCoverage,
      collapsedToSingleSource,
    } = validateAudit(generated, principles);

    console.log("Additional Info from audit process: ", {
      rejectedFindings,
      sourceCoverage,
      collapsedToSingleSource,
    });

    await updateAuditStage(
      auditId,
      { stage: "generating", findings: validFindings as unknown as Json },
      supabase,
    );

    // Replication is best-effort: a failure here must not discard valid findings.
    let generatedHtml: string | null = null;
    let appliedChanges: Json | null = null;

    try {
      const replicated = await homepageReplicator({
        brandTokens: {
          colors: brandTokens.colors,
          font: brandTokens.font,
          voice: brandTokens.voice,
        },
        page: {
          url: scrapedPage.requestedUrl,
          title: scrapedPage.title,
          description: scrapedPage.description,
          headings: {
            h1: scrapedPage.headings.h1,
            h2: scrapedPage.headings.h2,
          },
          bodyText: scrapedPage.bodyText,
        },
        findings: validFindings,
      });
      generatedHtml = replicated.html;
      appliedChanges = replicated.applied_changes as unknown as Json;
    } catch (replicationError) {
      console.error("Homepage replication failed: ", replicationError);
    }

    await updateAuditStage(
      auditId,
      {
        status: "completed",
        stage: "done",
        error_message: null,
        url: scrapedPage.requestedUrl,
        generated_html: generatedHtml,
        applied_changes: appliedChanges,
      },
      supabase,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "CRO audit failed";

    try {
      await failAudit(auditId, reason, supabase);
    } catch (failError) {
      console.error("Failed to record audit failure: ", failError);
    }
  }
}

export function buildPageSpeedSummary(signals: PageSpeedSignals): string {
  const parts: string[] = [];
  const { scores, coreWebVitals, topIssues } = signals;

  if (scores.performance !== null)
    parts.push(`Performance: ${scores.performance}/100`);
  if (scores.accessibility !== null)
    parts.push(`Accessibility: ${scores.accessibility}/100`);

  const { lcp, cls, tbt } = coreWebVitals;
  if (lcp.displayValue) parts.push(`LCP: ${lcp.displayValue} (${lcp.rating})`);
  if (cls.displayValue) parts.push(`CLS: ${cls.displayValue} (${cls.rating})`);
  if (tbt.displayValue) parts.push(`TBT: ${tbt.displayValue} (${tbt.rating})`);

  if (topIssues.length > 0) {
    parts.push(
      `Top issues: ${topIssues.map((issue) => issue.title).join(", ")}`,
    );
  }

  return parts.join("; ");
}
