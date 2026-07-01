"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES } from "@/lib/cro-audit/stages";

type AuditStatus = "queued" | "running" | "completed" | "failed";
type Stage = (typeof STAGES)[number]["key"] | "done";

const POLL_MS = 2_000;
const TIMEOUT_MS = 3 * 60 * 1_000;

type AuditProgressProps = {
  url: string;
  status: AuditStatus;
  stage: Stage | null;
};

export function AuditProgress({ url, status, stage }: AuditProgressProps) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const isPending = status === "queued" || status === "running";

  useEffect(() => {
    if (!isPending) return;

    // Re-run the server component, which re-reads the full audit detail and
    // renders the latest data directly as each stage writes it.
    const interval = setInterval(() => {
      router.refresh();
    }, POLL_MS);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setTimedOut(true);
    }, TIMEOUT_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isPending, router]);

  if (!isPending) {
    return null;
  }

  const activeIndex =
    stage === "done"
      ? STAGES.length
      : STAGES.findIndex((entry) => entry.key === stage);

  return (
    <section className="mb-12 bg-white border border-zinc-200 rounded-lg p-6 shadow-xs">
      <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 flex items-center">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
        Audit in progress
      </h2>
      <p className="mt-3 text-sm leading-6 text-zinc-600">
        {stage
          ? `Currently ${stage.replace(/_/g, " ")}. `
          : "The audit has started. "}
        Findings and generated output will appear here as soon as each step
        completes.
      </p>

      {timedOut ? (
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          This is taking longer than expected. It may still finish in the
          background —{" "}
          <button
            type="button"
            onClick={() => {
              setTimedOut(false);
              router.refresh();
            }}
            className="font-medium text-emerald-700 underline underline-offset-2 cursor-pointer"
          >
            check again
          </button>
          .
        </p>
      ) : null}

      <div className="mt-4">
        <p className="text-xs font-mono text-zinc-500">
          Auditing <span className="text-zinc-800 font-medium">{url}</span>
        </p>

        <ol className="mt-5">
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
                        state === "done" ? "bg-emerald-600" : "bg-zinc-200"
                      }`}
                    />
                  ) : null}
                </div>
                <div className={isLast ? "pb-0" : "pb-7"}>
                  <p
                    className={`text-sm font-medium ${
                      state === "pending" ? "text-zinc-400" : "text-zinc-900"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
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
    </section>
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
    <span className="h-6 w-6 rounded-full border-2 border-zinc-200 bg-white" />
  );
}
