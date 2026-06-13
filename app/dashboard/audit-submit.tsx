"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
type Phase = "idle" | "submitting" | "failed";

export function AuditSubmit() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      router.push(`/audits/${data.auditId}`);
    } catch {
      setErrorMessage("Could not reach the server. Please try again.");
      setPhase("failed");
    }
  };

  const reset = () => {
    setPhase("idle");
    setErrorMessage(null);
  };

  if (phase === "failed") {
    return (
      <StatusCard
        tone="error"
        title="Audit failed"
        message={
          errorMessage ?? "Something went wrong while running the audit."
        }
      >
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="min-h-11 bg-neutral-950 px-5 text-sm font-medium text-white"
          >
            Try again
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
          className={`min-h-11 bg-neutral-950 px-5 text-sm font-medium text-white disabled:opacity-60 ${submitting ? "" : "cursor-pointer"}`}
        >
          {submitting ? "Starting…" : "Run audit"}
        </button>
      </div>
      <p className="mt-3 text-sm text-neutral-500">
        We scrape the homepage, ground findings in CRO principles, and generate
        a brand-matched revision.
      </p>
    </form>
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
