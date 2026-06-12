import { jsonResponse } from "./responses.ts";
import {
  extractBrandTokens,
  type BrandTokens,
  type VoiceProvider,
} from "../brand/extraction.ts";
import {
  getCachedPageSpeedSignals,
  type PageSpeedSignals,
} from "../pagespeed/client.ts";
import { scrapeHomepage, type ScrapedHomepage } from "../scraper/homepage.ts";
import {
  retrieveBalancedPrinciples,
  type BalancedPrinciple,
  type BalancedPrinciplesInput,
} from "../cro-audit/retrieval.ts";
import { generateAudit, type GeneratedAudit } from "../cro-audit/generation.ts";
import { validateAudit } from "../cro-audit/validation.ts";
import type { AuditStatus, Json } from "../supabase/types.ts";

type EndpointUser = {
  id: string;
  email?: string;
} | null;

type QueryResult<T> = PromiseLike<{
  data: T;
  error: { message: string } | null;
}>;

type EndpointSupabaseClient = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: EndpointUser;
      };
    }>;
  };
  from: (table: "audits") => {
    select: (columns: string) => {
      order?: (
        column: string,
        options: { ascending: boolean },
      ) => QueryResult<unknown[] | null>;
      single?: () => QueryResult<unknown>;
    };
    insert: (values: {
      user_id: string;
      url: string;
      status: "queued";
      brand_tokens: BrandTokens;
      pagespeed_data: PageSpeedSignals | null;
    }) => {
      select: (columns: string) => {
        single: () => QueryResult<unknown>;
      };
    };
    update: (values: {
      status: AuditStatus;
      findings?: Json | null;
      error_message?: string | null;
    }) => {
      eq: (column: string, value: string) => QueryResult<unknown>;
    };
  };
};

export async function getAuditsEndpoint(supabase: EndpointSupabaseClient) {
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const query = supabase.from("audits").select("*");
  const { data, error } = await query.order!("created_at", {
    ascending: false,
  });

  if (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }

  return jsonResponse({ audits: data });
}

export async function createAuditEndpoint(
  request: Request,
  supabase: EndpointSupabaseClient,
  scraper: (url: string) => Promise<ScrapedHomepage> = scrapeHomepage,
  voiceProvider?: VoiceProvider,
  pageSpeedCollector: (
    url: string,
  ) => Promise<PageSpeedSignals | null> = getCachedPageSpeedSignals,
  principleRetriever: (
    inputs: BalancedPrinciplesInput,
  ) => Promise<BalancedPrinciple[]> = retrieveBalancedPrinciples,
  auditGenerator: (
    inputs: BalancedPrinciplesInput,
    principles: BalancedPrinciple[],
  ) => Promise<GeneratedAudit> = generateAudit,
) {
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!url) {
    return jsonResponse({ error: "URL is required" }, { status: 400 });
  }

  let scrapedPage: ScrapedHomepage;
  let brandTokens: BrandTokens;
  let pageSpeedData: PageSpeedSignals | null;

  try {
    const pageSpeedPromise = pageSpeedCollector(url);
    const scrapePromise = scraper(url);
    [scrapedPage, pageSpeedData] = await Promise.all([
      scrapePromise,
      pageSpeedPromise,
    ]);
    brandTokens = await extractBrandTokens(scrapedPage, voiceProvider);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    return jsonResponse({ error: message }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("audits")
    .insert({
      user_id: user.id,
      url: scrapedPage.requestedUrl,
      status: "queued",
      brand_tokens: brandTokens,
      pagespeed_data: pageSpeedData,
    })
    .select("*")
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }

  const insertedAudit = data as { id: string } & Record<string, unknown>;
  const inputs: BalancedPrinciplesInput = {
    title: scrapedPage.title,
    description: scrapedPage.description,
    headings: { h1: scrapedPage.headings.h1, h2: scrapedPage.headings.h2 },
    bodyText: scrapedPage.bodyText,
    pageSpeedSummary: pageSpeedData
      ? buildPageSpeedSummary(pageSpeedData)
      : null,
  };

  let updateValues: {
    status: AuditStatus;
    findings: Json | null;
    error_message: string | null;
  };

  try {
    const principles = await principleRetriever(inputs);
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

    updateValues = {
      status: "completed",
      findings: validFindings as unknown as Json,
      error_message: null,
    };
  } catch (auditError) {
    updateValues = {
      status: "failed",
      findings: null,
      error_message:
        auditError instanceof Error ? auditError.message : "CRO audit failed",
    };
  }

  const { error: updateError } = await supabase
    .from("audits")
    .update(updateValues)
    .eq("id", insertedAudit.id);

  if (updateError) {
    return jsonResponse(
      { error: (updateError as { message: string }).message },
      { status: 500 },
    );
  }

  return jsonResponse(
    { audit: { ...insertedAudit, ...updateValues } },
    { status: 201 },
  );
}

function buildPageSpeedSummary(signals: PageSpeedSignals): string {
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

async function getAuthenticatedUser(supabase: EndpointSupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
