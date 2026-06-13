"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  { key: "scraping", label: "Scraping the page" },
  { key: "analyzing_performance", label: "Analyzing performance" },
  { key: "extracting_brand", label: "Extracting brand" },
  { key: "auditing", label: "Running CRO audit" },
  { key: "generating", label: "Generating homepage" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];
type Stage = StageKey | "done";
type Status = "queued" | "running" | "completed" | "failed";
type Phase = "idle" | "submitting" | "running" | "failed" | "timeout";

const POLL_MS = 2_000;
const TIMEOUT_MS = 3 * 60 * 1_000;

export function AuditSubmit() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState("");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("scraping");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll the lightweight status route while the pipeline runs. Stops on
  // complete (navigate), failed, timeout, or unmount.
  useEffect(() => {
    if (phase !== "running" || !auditId) return;

    let active = true;

    const stop = () => {
      active = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };

    const poll = async () => {
      try {
        const response = await fetch(`/api/audits/${auditId}/status`, {
          cache: "no-store",
        });
        if (!active || !response.ok) return;

        const data = (await response.json()) as {
          status: Status;
          stage: Stage | null;
        };
        if (!active) return;

        if (data.stage) setStage(data.stage);

        if (data.status === "completed") {
          stop();
          router.push(`/audits/${auditId}`);
          router.refresh();
        } else if (data.status === "failed") {
          stop();
          setErrorMessage("The audit could not be completed.");
          setPhase("failed");
        }
      } catch {
        // Transient network error — keep polling until the safety timeout.
      }
    };

    const interval = setInterval(poll, POLL_MS);
    const timeout = setTimeout(() => {
      stop();
      setPhase("timeout");
    }, TIMEOUT_MS);

    void poll();

    return stop;
  }, [phase, auditId, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setErrorMessage(null);
    setPhase("submitting");

    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await response.json()) as {
        auditId?: string;
        error?: string;
      };

      if (!response.ok || !data.auditId) {
        setErrorMessage(data.error ?? "Could not start the audit.");
        setPhase("failed");
        return;
      }

      setAuditId(data.auditId);
      setStage("scraping");
      setPhase("running");
    } catch {
      setErrorMessage("Could not reach the server. Please try again.");
      setPhase("failed");
    }
  };

  const reset = () => {
    setPhase("idle");
    setAuditId(null);
    setStage("scraping");
    setErrorMessage(null);
  };

  if (phase === "running") {
    return <ProgressView url={url} stage={stage} />;
  }

  if (phase === "failed") {
    return (
      <StatusCard
        tone="error"
        title="Audit failed"
        message={errorMessage ?? "Something went wrong while running the audit."}
      >
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="min-h-11 bg-neutral-950 px-5 text-sm font-medium text-white"
          >
            Try again
          </button>
          {auditId ? (
            <a
              href={`/audits/${auditId}`}
              className="min-h-11 border border-neutral-300 bg-white px-5 py-3 text-sm font-medium"
            >
              View details
            </a>
          ) : null}
        </div>
      </StatusCard>
    );
  }

  if (phase === "timeout") {
    return (
      <StatusCard
        tone="warning"
        title="Still working…"
        message="This audit is taking longer than expected. It may still finish in the background — check its details, or start a new one."
      >
        <div className="mt-5 flex flex-wrap gap-3">
          {auditId ? (
            <a
              href={`/audits/${auditId}`}
              className="min-h-11 bg-neutral-950 px-5 py-3 text-sm font-medium text-white"
            >
              View details
            </a>
          ) : null}
          <button
            onClick={reset}
            className="min-h-11 border border-neutral-300 bg-white px-5 text-sm font-medium"
          >
            Start a new audit
          </button>
        </div>
      </StatusCard>
    );
  }

  const submitting = phase === "submitting";

  return (
    <form onSubmit={handleSubmit} className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          required
          type="url"
          name="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={submitting}
          placeholder="https://example.com"
          className="min-h-11 flex-1 border border-neutral-300 px-3 py-2 disabled:bg-neutral-100"
        />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 bg-neutral-950 px-5 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? "Starting…" : "Run audit"}
        </button>
      </div>
      <p className="mt-3 text-sm text-neutral-500">
        We scrape the homepage, ground findings in CRO principles, and generate a
        brand-matched revision.
      </p>
    </form>
  );
}

function ProgressView({ url, stage }: { url: string; stage: Stage }) {
  const activeIndex =
    stage === "done"
      ? STAGES.length
      : STAGES.findIndex((item) => item.key === stage);

  return (
    <div className="mt-5">
      <p className="text-sm text-neutral-500">
        Auditing <span className="font-medium text-neutral-900">{url}</span>
      </p>

      <ol className="mt-6">
        {STAGES.map((item, index) => {
          const state =
            index < activeIndex
              ? "done"
              : index === activeIndex
                ? "active"
                : "pending";
          const isLast = index === STAGES.length - 1;

          return (
            <li key={item.key} className="flex gap-4">
              <div className="flex flex-col items-center">
                <StepIndicator state={state} />
                {!isLast ? (
                  <span
                    className={`w-px flex-1 ${
                      state === "done" ? "bg-emerald-600" : "bg-neutral-200"
                    }`}
                  />
                ) : null}
              </div>
              <div className={isLast ? "pb-0" : "pb-7"}>
                <p
                  className={`text-sm font-medium ${
                    state === "pending" ? "text-neutral-400" : "text-neutral-900"
                  }`}
                >
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {state === "active"
                    ? "In progress…"
                    : state === "done"
                      ? "Done"
                      : "Waiting"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepIndicator({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  if (state === "active") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-600">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </span>
    );
  }

  return (
    <span className="h-6 w-6 rounded-full border-2 border-neutral-200 bg-white" />
  );
}

function StatusCard({
  tone,
  title,
  message,
  children,
}: {
  tone: "error" | "warning";
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  const toneClasses =
    tone === "error"
      ? "border-red-200 bg-red-50"
      : "border-amber-200 bg-amber-50";
  const titleColor = tone === "error" ? "text-red-800" : "text-amber-900";
  const bodyColor = tone === "error" ? "text-red-700" : "text-amber-900";

  return (
    <div className={`mt-5 border ${toneClasses} p-5`}>
      <h3 className={`text-base font-semibold ${titleColor}`}>{title}</h3>
      <p className={`mt-2 text-sm leading-6 ${bodyColor}`}>{message}</p>
      {children}
    </div>
  );
}
