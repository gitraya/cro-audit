import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuditProgress } from "./audit-progress";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BrandTokens, LayoutHints } from "@/lib/brand/extraction";
import type { PageSpeedSignals } from "@/lib/pagespeed/client";

type AuditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type AuditFinding = {
  observation: string;
  solution: string;
  principle: string;
  source_book: string;
};

type AppliedChange = {
  change: string;
  finding_principle: string;
  source_book: string;
};

const STATUS_STYLES: Record<string, string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  queued: "border-amber-200 bg-amber-50 text-amber-800",
  running: "border-amber-200 bg-amber-50 text-amber-800",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Complete",
  failed: "Failed",
  queued: "In progress",
  running: "In progress",
};

export default async function AuditPage({ params }: AuditPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: audit, error } = await supabase
    .from("audits")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !audit) {
    notFound();
  }

  const findings = (audit.findings ?? []) as AuditFinding[];
  const appliedChanges = (audit.applied_changes ?? []) as AppliedChange[];
  const isPending = audit.status === "queued" || audit.status === "running";
  const isFailed = audit.status === "failed";
  const findingsEmptyMessage = isPending
    ? "Findings will appear here as the audit runs."
    : isFailed
      ? "No findings were recorded because the audit failed."
      : "No findings were recorded for this audit.";

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12 text-neutral-950">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          ← Back to dashboard
        </Link>

        <header className="mt-6">
          <StatusBadge status={audit.status} stage={audit.stage} />
          <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight">
            {audit.url}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Created {new Date(audit.created_at).toLocaleString()}
          </p>
        </header>

        <AuditProgress
          url={audit.url}
          status={audit.status}
          stage={audit.stage}
        />

        {isFailed ? (
          <div className="mt-8 border border-red-200 bg-red-50 p-5">
            <h2 className="text-base font-semibold text-red-800">
              This audit failed
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-red-700"
              style={{ wordBreak: "break-word" }}
            >
              {audit.error_message ??
                "Something went wrong while running the audit."}
            </p>
          </div>
        ) : null}

        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Findings</h2>
            {findings.length ? (
              <span className="text-sm text-neutral-500">
                {findings.length} {findings.length === 1 ? "issue" : "issues"}
              </span>
            ) : null}
          </div>

          {findings.length ? (
            <ul className="mt-4 space-y-4">
              {findings.map((finding, index) => (
                <li
                  key={index}
                  className="border border-neutral-200 bg-white p-5"
                >
                  <p className="font-medium leading-6 text-neutral-950">
                    {finding.observation}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">
                    <span className="font-medium text-emerald-700">Fix · </span>
                    {finding.solution}
                  </p>
                  <div className="mt-4">
                    <span className="inline-flex items-center gap-1.5 border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-600">
                      <span className="font-medium text-neutral-900">
                        {finding.principle}
                      </span>
                      <span className="text-neutral-400">·</span>
                      <span>{finding.source_book}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
              <p className="text-sm text-neutral-500">{findingsEmptyMessage}</p>
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold">Generated homepage</h2>
          {audit.generated_html ? (
            <iframe
              title={`Generated homepage for ${audit.url}`}
              sandbox=""
              srcDoc={audit.generated_html}
              className="mt-4 h-[640px] w-full border border-neutral-200 bg-white"
            />
          ) : (
            <div className="mt-4 border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
              <p className="text-sm text-neutral-500">
                {isPending
                  ? "The brand-matched homepage will appear here when generation finishes."
                  : "No homepage was generated for this audit."}
              </p>
            </div>
          )}

          {appliedChanges.length ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-neutral-900">
                Applied changes
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                What changed on the generated page, and the principle behind
                each.
              </p>
              <ul className="mt-4 space-y-3">
                {appliedChanges.map((applied, index) => (
                  <li
                    key={index}
                    className="border border-neutral-200 bg-white p-4"
                  >
                    <p className="text-sm leading-6 text-neutral-800">
                      {applied.change}
                    </p>
                    <div className="mt-3">
                      <span className="inline-flex items-center gap-1.5 border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-600">
                        <span className="font-medium text-neutral-900">
                          {applied.finding_principle}
                        </span>
                        <span className="text-neutral-400">·</span>
                        <span>{applied.source_book}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="mt-12 grid items-start gap-6 lg:grid-cols-2">
          <BrandTokensPanel tokens={audit.brand_tokens as BrandTokens | null} />
          <PageSpeedPanel
            signals={audit.pagespeed_data as PageSpeedSignals | null}
          />
          <LayoutHintsPanel hints={audit.layout_hints as LayoutHints | null} />
        </section>
      </div>
    </main>
  );
}

function StatusBadge({
  status,
  stage,
}: {
  status: string;
  stage: string | null;
}) {
  const styles =
    STATUS_STYLES[status] ??
    "border-neutral-200 bg-neutral-100 text-neutral-600";
  const label = STATUS_LABELS[status] ?? status;
  const showStage = status !== "completed" && status !== "failed" && stage;

  return (
    <span
      className={`inline-flex items-center gap-2 border px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {label}
      {showStage ? (
        <span className="font-normal opacity-80">
          · {stage!.replace(/_/g, " ")}
        </span>
      ) : null}
    </span>
  );
}

const PANEL_LABEL =
  "text-xs font-medium uppercase tracking-wide text-neutral-500";

const RATING_STYLES: Record<string, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "needs-improvement": "border-amber-200 bg-amber-50 text-amber-800",
  poor: "border-red-200 bg-red-50 text-red-700",
};

function PanelShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 border border-neutral-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {children}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-neutral-500">{children}</p>;
}

function BrandTokensPanel({ tokens }: { tokens: BrandTokens | null }) {
  if (!tokens) {
    return (
      <PanelShell title="Brand tokens">
        <EmptyNote>Not extracted yet.</EmptyNote>
      </PanelShell>
    );
  }

  const { colors, font, voice } = tokens;
  const fontStack = [font?.primary, ...(font?.fallbacks ?? [])]
    .filter(Boolean)
    .join(", ");

  return (
    <PanelShell title="Brand tokens">
      <div className="mt-4 space-y-5">
        <div>
          <p className={PANEL_LABEL}>Colors</p>
          {colors?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {colors.map((color) => (
                <span
                  key={color}
                  className="inline-flex items-center gap-2 border border-neutral-200 py-1 pl-1 pr-2"
                >
                  <span
                    className="h-6 w-6 border border-neutral-300"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-mono text-xs text-neutral-700">
                    {color}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <EmptyNote>No brand colors detected.</EmptyNote>
          )}
        </div>

        <div>
          <p className={PANEL_LABEL}>Typography</p>
          {font?.primary ? (
            <>
              <p
                className="mt-1 text-xl text-neutral-900"
                style={{ fontFamily: fontStack }}
              >
                {font.primary}
              </p>
              {font.fallbacks?.length ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Fallbacks: {font.fallbacks.join(", ")}
                </p>
              ) : null}
            </>
          ) : (
            <EmptyNote>No primary font detected.</EmptyNote>
          )}
        </div>

        <div>
          <p className={PANEL_LABEL}>Voice</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {voice?.tone ? (
              <span className="border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700">
                Tone:{" "}
                <span className="font-medium text-neutral-900">
                  {voice.tone}
                </span>
              </span>
            ) : null}
            {voice?.formality ? (
              <span className="border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700">
                Formality:{" "}
                <span className="font-medium text-neutral-900 capitalize">
                  {voice.formality}
                </span>
              </span>
            ) : null}
          </div>
          {voice?.phrases?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {voice.phrases.map((phrase, index) => (
                <span
                  key={index}
                  className="border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600"
                >
                  “{phrase}”
                </span>
              ))}
            </div>
          ) : null}
          {!voice?.tone && !voice?.formality && !voice?.phrases?.length ? (
            <EmptyNote>No voice signals detected.</EmptyNote>
          ) : null}
        </div>
      </div>
    </PanelShell>
  );
}

function LayoutHintsPanel({ hints }: { hints: LayoutHints | null }) {
  if (!hints) {
    return (
      <PanelShell title="Layout hints">
        <EmptyNote>Not extracted yet.</EmptyNote>
      </PanelShell>
    );
  }

  const swatch = (label: string, color: string | null) => (
    <div>
      <p className={PANEL_LABEL}>{label}</p>
      {color ? (
        <span className="mt-2 inline-flex items-center gap-2 border border-neutral-200 py-1 pl-1 pr-2">
          <span
            className="h-6 w-6 border border-neutral-300"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono text-xs text-neutral-700">{color}</span>
        </span>
      ) : (
        <p className="mt-1 text-sm text-neutral-500">Not detected.</p>
      )}
    </div>
  );

  return (
    <PanelShell title="Layout hints">
      <div className="mt-4 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {swatch("Background", hints.background_color)}
          {swatch("Text", hints.text_color)}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700">
            Theme:{" "}
            <span className="font-medium text-neutral-900">
              {hints.is_dark_theme ? "Dark" : "Light"}
            </span>
          </span>
          <span className="border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700">
            Hero alignment:{" "}
            <span className="font-medium text-neutral-900 capitalize">
              {hints.hero_alignment}
            </span>
          </span>
        </div>
      </div>
    </PanelShell>
  );
}

function PageSpeedPanel({ signals }: { signals: PageSpeedSignals | null }) {
  if (!signals) {
    return (
      <PanelShell title="PageSpeed data">
        <EmptyNote>Not available for this audit.</EmptyNote>
      </PanelShell>
    );
  }

  const { scores, coreWebVitals, topIssues } = signals;
  const vitals: Array<{
    label: string;
    signal: PageSpeedSignals["coreWebVitals"]["lcp"];
  }> = [
    { label: "LCP", signal: coreWebVitals.lcp },
    { label: "CLS", signal: coreWebVitals.cls },
    { label: "TBT", signal: coreWebVitals.tbt },
  ];

  return (
    <PanelShell title="PageSpeed data">
      <div className="mt-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <ScoreStat label="Performance" score={scores.performance} />
          <ScoreStat label="Accessibility" score={scores.accessibility} />
        </div>

        <div>
          <p className={PANEL_LABEL}>Core Web Vitals</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {vitals.map((vital) => (
              <div
                key={vital.label}
                className="border border-neutral-200 p-3 text-center"
              >
                <p className="text-xs font-medium text-neutral-500">
                  {vital.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {vital.signal.displayValue ?? "—"}
                </p>
                {vital.signal.rating ? (
                  <span
                    className={`mt-2 inline-block border px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                      RATING_STYLES[vital.signal.rating] ??
                      "border-neutral-200 bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    {vital.signal.rating.replace(/-/g, " ")}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {topIssues.length ? (
          <div>
            <p className={PANEL_LABEL}>Top issues</p>
            <ul className="mt-2 space-y-2">
              {topIssues.map((issue) => (
                <li
                  key={issue.id}
                  className="border border-neutral-200 px-3 py-2 text-sm text-neutral-700"
                >
                  {issue.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </PanelShell>
  );
}

function ScoreStat({ label, score }: { label: string; score: number | null }) {
  const color =
    score == null
      ? "text-neutral-400"
      : score >= 90
        ? "text-emerald-600"
        : score >= 50
          ? "text-amber-600"
          : "text-red-600";
  const barColor =
    score == null
      ? "bg-neutral-200"
      : score >= 90
        ? "bg-emerald-500"
        : score >= 50
          ? "bg-amber-500"
          : "bg-red-500";

  return (
    <div className="border border-neutral-200 p-3">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
        {score ?? "—"}
        {score != null ? (
          <span className="ml-0.5 text-sm font-normal text-neutral-400">
            /100
          </span>
        ) : null}
      </p>
      <div className="mt-2 h-1 w-full bg-neutral-100">
        <div
          className={`h-1 ${barColor}`}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
    </div>
  );
}
