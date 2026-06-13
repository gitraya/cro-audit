import type { Json } from "../supabase/types.ts";
import { normalizedCacheKey } from "../url/cache-key.ts";

export type CoreWebVitalSignal = {
  value: number | null;
  displayValue: string | null;
  rating: "good" | "needs-improvement" | "poor" | null;
};

export type PageSpeedSignals = {
  scores: {
    performance: number | null;
    accessibility: number | null;
  };
  coreWebVitals: {
    lcp: CoreWebVitalSignal;
    cls: CoreWebVitalSignal;
    tbt: CoreWebVitalSignal;
  };
  topIssues: Array<{
    id: string;
    title: string;
    description: string;
  }>;
};

type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

type PageSpeedCache = {
  read: (urlKey: string) => Promise<PageSpeedSignals | null>;
  write: (urlKey: string, signals: PageSpeedSignals) => Promise<void>;
};

type LighthouseAudit = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  score?: unknown;
  displayValue?: unknown;
  numericValue?: unknown;
};

type LighthouseCategory = {
  score?: unknown;
  auditRefs?: Array<{
    id?: unknown;
    weight?: unknown;
  }>;
};

type PageSpeedResponse = {
  lighthouseResult?: {
    categories?: {
      performance?: LighthouseCategory;
      accessibility?: LighthouseCategory;
    };
    audits?: Record<string, LighthouseAudit>;
  };
};

type PageSpeedCacheRow = {
  signals: Json;
};

const PAGESPEED_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PAGESPEED_TIMEOUT_MS = 45_000;
const TOP_ISSUE_LIMIT = 6;

const metricAuditIds = {
  lcp: "largest-contentful-paint",
  cls: "cumulative-layout-shift",
  tbt: "total-blocking-time",
} as const;

const croRelevantAuditIds = new Set([
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "render-blocking-resources",
  "uses-optimized-images",
  "uses-responsive-images",
  "unminified-css",
  "color-contrast",
  "tap-targets",
  "image-alt",
  "viewport",
  "font-size",
  "interactive",
]);

export async function getCachedPageSpeedSignals(
  rawUrl: string,
  options: {
    cache?: PageSpeedCache;
    fetcher?: FetchLike;
  } = {},
): Promise<PageSpeedSignals | null> {
  const urlKey = normalizedCacheKey(rawUrl);
  const cache = options.cache ?? createPostgresPageSpeedCache();

  try {
    const cachedSignals = await cache.read(urlKey);

    if (cachedSignals) {
      return cachedSignals;
    }

    const signals = await fetchPageSpeedSignals(rawUrl, options.fetcher);
    await cache.write(urlKey, signals);

    return signals;
  } catch (error) {
    console.warn("PageSpeed Insights unavailable", error);
    return null;
  }
}

export async function fetchPageSpeedSignals(
  rawUrl: string,
  fetcher: FetchLike = fetch,
): Promise<PageSpeedSignals> {
  const apiKey = process.env.PAGESPEED_API_KEY;

  if (!apiKey) {
    throw new Error("Missing PAGESPEED_API_KEY environment variable.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGESPEED_TIMEOUT_MS);

  try {
    const response = await fetcher(createPageSpeedUrl(rawUrl, apiKey), {
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `PageSpeed Insights request failed: ${response.status} ${response.statusText}`,
      );
    }

    return extractPageSpeedSignals(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

export function extractPageSpeedSignals(payload: unknown): PageSpeedSignals {
  const response = payload as PageSpeedResponse;
  const lighthouse = response.lighthouseResult;

  if (!lighthouse?.audits) {
    throw new Error(
      "PageSpeed Insights response did not include lighthouseResult.",
    );
  }

  const categories = lighthouse.categories ?? {};
  const audits = lighthouse.audits;

  return {
    scores: {
      performance: normalizeCategoryScore(categories.performance?.score),
      accessibility: normalizeCategoryScore(categories.accessibility?.score),
    },
    coreWebVitals: {
      lcp: extractCoreWebVital(audits[metricAuditIds.lcp]),
      cls: extractCoreWebVital(audits[metricAuditIds.cls]),
      tbt: extractCoreWebVital(audits[metricAuditIds.tbt]),
    },
    topIssues: extractTopIssues(categories, audits),
  };
}

function createPageSpeedUrl(rawUrl: string, apiKey: string) {
  const apiUrl = new URL(PAGESPEED_ENDPOINT);
  apiUrl.searchParams.set("url", normalizePageSpeedTargetUrl(rawUrl));
  apiUrl.searchParams.set("strategy", "mobile");
  apiUrl.searchParams.set("key", apiKey);
  apiUrl.searchParams.append("category", "performance");
  apiUrl.searchParams.append("category", "accessibility");

  return apiUrl;
}

function normalizePageSpeedTargetUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return new URL(trimmed).toString();
  }

  return new URL(`https://${trimmed}`).toString();
}

function extractCoreWebVital(audit: LighthouseAudit | undefined) {
  const score = numberOrNull(audit?.score);

  return {
    value: numberOrNull(audit?.numericValue),
    displayValue: stringOrNull(audit?.displayValue),
    rating: scoreToRating(score),
  };
}

function extractTopIssues(
  categories: NonNullable<PageSpeedResponse["lighthouseResult"]>["categories"],
  audits: Record<string, LighthouseAudit>,
) {
  const auditWeights = new Map<string, number>();

  for (const auditRef of [
    ...(categories?.performance?.auditRefs ?? []),
    ...(categories?.accessibility?.auditRefs ?? []),
  ]) {
    const id = stringOrNull(auditRef.id);

    if (!id) {
      continue;
    }

    auditWeights.set(
      id,
      Math.max(auditWeights.get(id) ?? 0, weightOf(auditRef.weight)),
    );
  }

  return [...auditWeights.entries()]
    .map(([id, weight]) => {
      const audit = audits[id];
      const score = numberOrNull(audit?.score);

      if (
        !audit ||
        score === null ||
        score >= 0.9 ||
        !croRelevantAuditIds.has(id)
      ) {
        return null;
      }

      return {
        id,
        title: stringOrNull(audit.title) ?? id,
        description: stringOrNull(audit.description) ?? "",
        weight,
      };
    })
    .filter(
      (
        issue,
      ): issue is {
        id: string;
        title: string;
        description: string;
        weight: number;
      } => Boolean(issue),
    )
    .sort(
      (first, second) =>
        second.weight - first.weight || first.id.localeCompare(second.id),
    )
    .slice(0, TOP_ISSUE_LIMIT)
    .map(({ id, title, description }) => ({ id, title, description }));
}

function normalizeCategoryScore(value: unknown) {
  const score = numberOrNull(value);

  return score === null ? null : Math.round(score * 100);
}

function scoreToRating(score: number | null): CoreWebVitalSignal["rating"] {
  if (score === null) {
    return null;
  }

  if (score >= 0.9) {
    return "good";
  }

  if (score >= 0.5) {
    return "needs-improvement";
  }

  return "poor";
}

function weightOf(value: unknown) {
  return numberOrNull(value) ?? 0;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function createPostgresPageSpeedCache(): PageSpeedCache {
  return {
    async read(urlKey) {
      const supabase = await createPageSpeedSupabaseClient();
      const { data, error } = await supabase
        .from("pagespeed_caches")
        .select("signals")
        .eq("url_key", urlKey)
        .maybeSingle<PageSpeedCacheRow>();

      if (error) {
        throw error;
      }

      return isPageSpeedSignals(data?.signals) ? data.signals : null;
    },
    async write(urlKey, signals) {
      const supabase = await createPageSpeedSupabaseClient();
      const { error } = await supabase.from("pagespeed_caches").upsert(
        {
          url_key: urlKey,
          signals: signals as unknown as Json,
        },
        {
          onConflict: "url_key",
          ignoreDuplicates: true,
        },
      );

      if (error) {
        throw error;
      }
    },
  };
}

async function createPageSpeedSupabaseClient() {
  const { createServerSupabaseClient } = await import("../supabase/server.ts");

  return createServerSupabaseClient();
}

function isPageSpeedSignals(
  value: Json | undefined,
): value is PageSpeedSignals {
  if (!isJsonRecord(value)) {
    return false;
  }

  return (
    isScores(value.scores) &&
    isCoreWebVitals(value.coreWebVitals) &&
    Array.isArray(value.topIssues) &&
    value.topIssues.every(isTopIssue)
  );
}

function isScores(
  value: Json | undefined,
): value is PageSpeedSignals["scores"] {
  return (
    isJsonRecord(value) &&
    isNullableNumber(value.performance) &&
    isNullableNumber(value.accessibility)
  );
}

function isCoreWebVitals(
  value: Json | undefined,
): value is PageSpeedSignals["coreWebVitals"] {
  return (
    isJsonRecord(value) &&
    isCoreWebVital(value.lcp) &&
    isCoreWebVital(value.cls) &&
    isCoreWebVital(value.tbt)
  );
}

function isCoreWebVital(value: Json | undefined): value is CoreWebVitalSignal {
  return (
    isJsonRecord(value) &&
    isNullableNumber(value.value) &&
    (typeof value.displayValue === "string" || value.displayValue === null) &&
    isRating(value.rating)
  );
}

function isTopIssue(
  value: Json | undefined,
): value is PageSpeedSignals["topIssues"][number] {
  return (
    isJsonRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string"
  );
}

function isJsonRecord(
  value: Json | undefined,
): value is { [key: string]: Json | undefined } {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function isNullableNumber(value: Json | undefined) {
  return typeof value === "number" || value === null;
}

function isRating(value: Json | undefined) {
  return (
    value === "good" ||
    value === "needs-improvement" ||
    value === "poor" ||
    value === null
  );
}
