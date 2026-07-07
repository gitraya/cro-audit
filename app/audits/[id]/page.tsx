import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Monitor,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
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
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100/80",
  failed: "bg-red-50 text-red-700 border-red-100",
  queued: "bg-amber-50 text-amber-700 border-amber-100",
  running: "bg-amber-50 text-amber-700 border-amber-100",
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
    <main className="min-h-screen bg-[#fafafa] text-zinc-950 font-sans pb-24">
      {/* Upper header color bar */}
      <div className="w-full h-1.5 bg-emerald-500" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        {/* Header Back Button & Meta */}
        <div className="border-b border-zinc-200/80 pb-8 mb-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-xs font-mono text-zinc-500 hover:text-zinc-900 mb-6 transition duration-150 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1 text-zinc-400 group-hover:text-zinc-900 transition duration-150" />
            Back to dashboard
          </Link>

          <div className="flex items-center space-x-2.5 mb-2">
            <StatusBadge status={audit.status} stage={audit.stage} />
            <span className="text-xs font-mono text-zinc-400">
              Audit #{String(audit.id).slice(0, 8)}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-900 break-all">
            {audit.url}
          </h1>
          <p className="text-xs text-zinc-400 mt-2 font-mono">
            Created {new Date(audit.created_at).toLocaleString()}
          </p>
        </div>

        <AuditProgress
          id={audit.id}
          url={audit.url}
          status={audit.status}
          stage={audit.stage}
        />

        {isFailed ? (
          <div className="bg-red-50 border border-red-100 rounded-lg p-5 mb-12 flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-red-800">
                This audit failed
              </h2>
              <p
                className="mt-1 text-sm leading-6 text-red-700"
                style={{ wordBreak: "break-word" }}
              >
                {audit.error_message ??
                  "Something went wrong while running the audit."}
              </p>
            </div>
          </div>
        ) : null}

        {/* GENERATED HOMEPAGE — full width */}
        <div className="mb-12">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-6 pb-2 border-b border-zinc-100">
            Generated homepage
          </h2>

          {audit.generated_html ? (
            <div className="border border-zinc-200 rounded-lg overflow-hidden shadow-md bg-white">
              {/* Browser bar */}
              <div className="bg-zinc-100 border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-1.5 shrink-0">
                  <span className="w-3 h-3 rounded-full bg-red-400 block" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400 block" />
                  <span className="w-3 h-3 rounded-full bg-green-400 block" />
                </div>
                <div className="bg-white border border-zinc-200/80 rounded px-3 py-1 text-center font-mono text-xs text-zinc-400 flex items-center justify-center space-x-1 w-2/3 md:w-1/2">
                  <span className="text-zinc-300">https://</span>
                  <span className="text-zinc-700 truncate">
                    {audit.url.replace(/https?:\/\//, "")}
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <Monitor className="w-4 h-4 text-zinc-400" />
                </div>
              </div>
              <iframe
                title={`Generated homepage for ${audit.url}`}
                sandbox=""
                srcDoc={audit.generated_html}
                className="h-[calc(100vh-120px)] w-full bg-white block"
              />
            </div>
          ) : (
            <div className="border border-dashed border-zinc-300 bg-white rounded-lg px-5 py-10 text-center">
              <p className="text-sm text-zinc-500 font-mono">
                {isPending
                  ? "The brand-matched homepage will appear here when generation finishes."
                  : "No homepage was generated for this audit."}
              </p>
            </div>
          )}
        </div>

        {/* Audit Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* LEFT: Findings, Generated homepage, Applied changes */}
          <div className="lg:col-span-7 space-y-12">
            {/* FINDINGS */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-6 pb-2 border-b border-zinc-100 flex items-baseline justify-between">
                Findings
                {findings.length ? (
                  <span className="text-xs font-mono font-normal text-zinc-400">
                    {findings.length}{" "}
                    {findings.length === 1 ? "issue" : "issues"}
                  </span>
                ) : null}
              </h2>

              {findings.length ? (
                <div className="space-y-6">
                  {findings.map((finding, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-zinc-200 rounded-lg p-6 shadow-xs"
                    >
                      <div className="flex items-start space-x-3">
                        <span className="w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-mono text-xs font-bold text-zinc-500 shrink-0 select-none">
                          {idx + 1}
                        </span>
                        <div className="space-y-3 min-w-0">
                          <p className="text-[14px] font-normal text-zinc-800 leading-relaxed">
                            {finding.observation}
                          </p>
                          <div className="bg-zinc-50/70 border-l-2 border-emerald-500 p-3 rounded-r text-xs text-zinc-600 leading-relaxed">
                            <strong className="text-zinc-900 block mb-1">
                              Recommended Fix:
                            </strong>
                            {finding.solution}
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {[finding.principle, finding.source_book]
                              .filter(Boolean)
                              .map((tag, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="inline-flex items-center rounded-sm bg-zinc-50 px-2 py-0.5 text-[10px] font-mono text-zinc-500 border border-zinc-200"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-zinc-300 bg-white rounded-lg px-5 py-10 text-center">
                  <p className="text-sm text-zinc-500 font-mono">
                    {findingsEmptyMessage}
                  </p>
                </div>
              )}
            </div>

            {/* APPLIED CHANGES */}
            {appliedChanges.length ? (
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-6 pb-2 border-b border-zinc-100">
                  Applied changes
                </h2>
                <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-xs space-y-4">
                  {appliedChanges.map((change, cIdx) => (
                    <div
                      key={cIdx}
                      className="flex items-start space-x-3 border-b border-zinc-100 last:border-b-0 pb-4 last:pb-0"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-700 leading-relaxed">
                          {change.change}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {[change.finding_principle, change.source_book]
                            .filter(Boolean)
                            .map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="inline-flex items-center rounded-sm bg-zinc-50 px-1.5 py-0.5 text-[9px] font-mono text-zinc-500 border border-zinc-100"
                              >
                                {tag}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* RIGHT: Brand tokens, PageSpeed, Layout hints */}
          <div className="lg:col-span-5 space-y-8">
            <BrandTokensPanel tokens={audit.brand_tokens as BrandTokens | null} />
            <PageSpeedPanel
              signals={audit.pagespeed_data as PageSpeedSignals | null}
            />
            <LayoutHintsPanel hints={audit.layout_hints as LayoutHints | null} />
          </div>
        </div>
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
    STATUS_STYLES[status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  const label = STATUS_LABELS[status] ?? status;
  const showStage = status !== "completed" && status !== "failed" && stage;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border ${styles}`}
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

const SECTION_HEADING =
  "text-sm font-bold uppercase tracking-wider text-zinc-900 mb-5 border-b border-zinc-100 pb-2";
const SUB_HEADING =
  "text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2";

const RATING_STYLES: Record<string, string> = {
  good: "text-emerald-700 bg-emerald-50 border-emerald-100",
  "needs-improvement": "text-amber-700 bg-amber-50 border-amber-100",
  poor: "text-red-700 bg-red-50 border-red-100",
};

function PanelShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-xs">
      <h2 className={SECTION_HEADING}>{title}</h2>
      {children}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500 font-mono">{children}</p>;
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

  return (
    <PanelShell title="Brand tokens">
      {/* Colors */}
      <div className="mb-6">
        <h4 className={`${SUB_HEADING} mb-3`}>Colors</h4>
        {colors?.length ? (
          <div className="grid grid-cols-1 gap-2.5">
            {colors.map((color) => (
              <div
                key={color}
                className="flex items-center space-x-3 bg-zinc-50 border border-zinc-200/50 p-2.5 rounded"
              >
                <span
                  className="w-5 h-5 rounded-full border border-zinc-300 block shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[11px] text-zinc-500 font-mono">
                  {color}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyNote>No brand colors detected.</EmptyNote>
        )}
      </div>

      {/* Typography */}
      <div className="mb-6">
        <h4 className={SUB_HEADING}>Typography</h4>
        {font?.primary ? (
          <div className="bg-zinc-50 border border-zinc-200/50 p-3 rounded">
            <span className="text-[14px] font-bold text-zinc-900 block font-mono">
              {font.primary}
            </span>
            {font.fallbacks?.length ? (
              <span className="text-[10px] text-zinc-400 block mt-1 leading-relaxed">
                Fallbacks: {font.fallbacks.join(", ")}
              </span>
            ) : null}
          </div>
        ) : (
          <EmptyNote>No primary font detected.</EmptyNote>
        )}
      </div>

      {/* Voice */}
      <div>
        <h4 className={SUB_HEADING}>Brand Voice</h4>
        {voice?.tone || voice?.formality || voice?.phrases?.length ? (
          <div className="space-y-2 text-xs text-zinc-600 leading-relaxed font-mono bg-zinc-50 border border-zinc-200/50 p-3 rounded">
            {voice?.tone ? (
              <p className="font-semibold text-zinc-800 capitalize">
                {voice.tone}
              </p>
            ) : null}
            {voice?.formality ? (
              <p className="capitalize">{voice.formality}</p>
            ) : null}
            {voice?.phrases?.length ? (
              <div className="pt-2 border-t border-zinc-200/50 mt-2">
                <span className="text-[9px] text-zinc-400 font-bold block uppercase mb-1">
                  Key phrases:
                </span>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-500">
                  {voice.phrases.map((phrase, idx) => (
                    <li key={idx} className="truncate">
                      {phrase}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyNote>No voice signals detected.</EmptyNote>
        )}
      </div>
    </PanelShell>
  );
}

function ScoreMeter({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const palette =
    score == null
      ? { text: "text-zinc-400", bg: "bg-zinc-50", border: "border-zinc-200", stroke: "#a1a1aa" }
      : score >= 90
        ? { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", stroke: "#10b981" }
        : score >= 50
          ? { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", stroke: "#f59e0b" }
          : { text: "text-red-600", bg: "bg-red-50", border: "border-red-100", stroke: "#ef4444" };

  const circumference = 2 * Math.PI * 28;
  const offset = circumference * (1 - (score ?? 0) / 100);

  return (
    <div
      className={`p-4 border rounded-lg flex flex-col items-center justify-center text-center ${palette.bg} ${palette.border}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3">
        {label}
      </span>
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            className="text-zinc-200"
            strokeWidth="5"
            fill="none"
            stroke="currentColor"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            strokeWidth="5"
            fill="none"
            stroke={palette.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span
          className={`absolute text-base font-extrabold font-mono ${palette.text}`}
        >
          {score ?? "—"}
        </span>
      </div>
    </div>
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
      <div className="grid grid-cols-2 gap-4 mb-6">
        <ScoreMeter label="Performance" score={scores.performance} />
        <ScoreMeter label="Accessibility" score={scores.accessibility} />
      </div>

      {/* Core Web Vitals */}
      <div className="mb-6">
        <h4 className={SUB_HEADING}>Core Web Vitals</h4>
        <div className="border border-zinc-200 rounded-md overflow-hidden text-xs">
          <div className="grid grid-cols-3 bg-zinc-50 border-b border-zinc-200 font-bold p-2 text-zinc-500 text-[10px] uppercase">
            <div>Metric</div>
            <div className="text-right">Value</div>
            <div className="text-right">Rating</div>
          </div>
          <div className="divide-y divide-zinc-100">
            {vitals.map((vital) => (
              <div key={vital.label} className="grid grid-cols-3 p-2.5">
                <div className="font-semibold text-zinc-800">{vital.label}</div>
                <div className="text-right font-mono text-zinc-900">
                  {vital.signal.displayValue ?? "—"}
                </div>
                <div className="text-right">
                  {vital.signal.rating ? (
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold font-mono capitalize border ${
                        RATING_STYLES[vital.signal.rating] ??
                        "text-zinc-600 bg-zinc-50 border-zinc-200"
                      }`}
                    >
                      {vital.signal.rating.replace(/-/g, " ")}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Issues */}
      {topIssues.length ? (
        <div>
          <h4 className={SUB_HEADING}>Top Issues</h4>
          <ul className="space-y-2">
            {topIssues.map((issue) => (
              <li
                key={issue.id}
                className="flex items-start text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 p-2.5 rounded"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5 mr-2" />
                <span>{issue.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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

  return (
    <PanelShell title="Layout hints">
      <div className="space-y-3.5 text-xs text-zinc-700">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-500">Theme Preference</span>
          <span className="font-mono text-zinc-800 font-bold">
            {hints.is_dark_theme ? "Dark" : "Light"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-500">
            Background Preference
          </span>
          <div className="flex items-center space-x-1.5 font-mono text-zinc-800 font-bold">
            {hints.background_color ? (
              <>
                <span
                  className="w-3.5 h-3.5 border border-zinc-200 block"
                  style={{ backgroundColor: hints.background_color }}
                />
                <span>{hints.background_color}</span>
              </>
            ) : (
              <span className="text-zinc-400">—</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-500">Text Preference</span>
          <div className="flex items-center space-x-1.5 font-mono text-zinc-800 font-bold">
            {hints.text_color ? (
              <>
                <span
                  className="w-3.5 h-3.5 border border-zinc-200 block"
                  style={{ backgroundColor: hints.text_color }}
                />
                <span>{hints.text_color}</span>
              </>
            ) : (
              <span className="text-zinc-400">—</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-500">
            Hero Layout Alignment
          </span>
          <span className="font-mono text-zinc-800 font-bold capitalize">
            {hints.hero_alignment}
          </span>
        </div>
      </div>
    </PanelShell>
  );
}
