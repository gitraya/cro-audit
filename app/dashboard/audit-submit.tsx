"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
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

  const submitting = phase === "submitting";
  const failed = phase === "failed";

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <input
            required
            type="url"
            name="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={submitting}
            placeholder="https://example.com"
            className="w-full bg-white border border-zinc-200 rounded px-4 py-3.5 text-sm text-zinc-900 focus:outline-hidden focus:border-zinc-400 font-sans disabled:opacity-75"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !url.trim()}
          className="inline-flex items-center justify-center bg-zinc-950 hover:bg-zinc-900 text-white font-medium text-sm px-6 py-3.5 rounded shadow-sm hover:shadow transition duration-150 cursor-pointer disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-zinc-400" />
              Running...
            </>
          ) : (
            "Run audit"
          )}
        </button>
      </div>

      {submitting ? (
        <div className="mt-4 text-xs font-mono text-zinc-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          <span>
            Analyzing{" "}
            <span className="text-zinc-800 font-medium">{url}</span> with
            Gemini, extracting brand elements, and building replica...
          </span>
        </div>
      ) : null}

      {failed ? (
        <div className="bg-red-50 border border-red-100 text-red-800 text-xs p-4 rounded-md flex items-start justify-between gap-3 mt-4">
          <div className="flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>
              {errorMessage ??
                "Something went wrong while running the audit."}
            </span>
          </div>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 font-medium underline underline-offset-2 cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : null}

      <p className="text-[13px] text-zinc-500 mt-5 leading-relaxed font-normal">
        We scrape the homepage, ground findings in CRO principles, and generate
        a brand-matched revision.
      </p>
    </form>
  );
}
