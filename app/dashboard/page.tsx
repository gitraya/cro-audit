import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";
import { AuditSubmit } from "./audit-submit";

type AuditRow = {
  id: string;
  url: string;
  status: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  failed: "bg-red-50 text-red-700 border-red-100",
  queued: "bg-zinc-50 text-zinc-600 border-zinc-200",
  running: "bg-amber-50 text-amber-700 border-amber-100",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Complete",
  failed: "Failed",
  queued: "In progress",
  running: "In progress",
};

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="min-h-screen bg-[#fafafa] text-zinc-950 font-sans">
        <div className="w-full h-1.5 bg-emerald-500" />
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-16">
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-6">
            <h1 className="text-xl font-bold text-zinc-900">
              Supabase is not configured
            </h1>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              Copy <code className="font-mono">.env.example</code> to{" "}
              <code className="font-mono">.env.local</code>, set{" "}
              <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="font-mono">
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
              </code>
              , then run the SQL migration in{" "}
              <code className="font-mono">supabase/migrations</code>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: audits, error: auditsError }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("audits")
        .select("id,url,status,created_at")
        .order("created_at", { ascending: false }),
    ]);

  const history = (audits ?? []) as AuditRow[];

  return (
    <main className="min-h-screen bg-[#fafafa] text-zinc-950 font-sans">
      <div className="w-full h-1.5 bg-emerald-500" />

      <div className="max-w-6xl mx-auto px-6 md:px-12 py-12">
        {/* Navigation Header */}
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between border-b border-zinc-200/80 pb-6 mb-12">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-600 uppercase mb-1 truncate">
              {(profile?.email ?? user.email ?? "").toUpperCase()}
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900">
              Audit dashboard
            </h1>
          </div>
          <form action={signOut} className="mt-4 md:mt-0">
            <button className="inline-flex items-center justify-center bg-white hover:bg-zinc-50 text-zinc-950 font-medium text-xs px-4 py-2 rounded border border-zinc-200 shadow-xs transition duration-150 cursor-pointer">
              Log out
            </button>
          </form>
        </div>

        {/* Start Audit Card */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 md:p-8 shadow-xs mb-10">
          <h2 className="text-[15px] font-bold uppercase tracking-wider text-zinc-900 mb-5">
            Start a homepage audit
          </h2>
          <AuditSubmit />
        </div>

        {/* History Card */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-400">
              History
            </h2>
          </div>

          {auditsError ? (
            <div className="bg-red-50 border-b border-red-100 text-red-800 text-sm p-4">
              {auditsError.message}
            </div>
          ) : null}

          <div className="divide-y divide-zinc-100">
            {history.length ? (
              history.map((audit) => (
                <Link
                  key={audit.id}
                  href={`/audits/${audit.id}`}
                  className="px-6 md:px-8 py-5 flex items-center justify-between hover:bg-zinc-50/70 transition duration-150 cursor-pointer group"
                >
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center border border-zinc-200/50 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition duration-150 shrink-0">
                      <Globe className="w-[18px] h-[18px] text-zinc-400 group-hover:text-emerald-600 transition duration-150" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[15px] font-bold text-zinc-900 truncate group-hover:text-emerald-700 transition duration-150">
                        {audit.url}
                      </h4>
                      <p className="text-xs text-zinc-400 mt-1 font-mono">
                        {new Date(audit.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 shrink-0 ml-4">
                    <StatusBadge status={audit.status} />
                  </div>
                </Link>
              ))
            ) : !auditsError ? (
              <div className="p-8 text-center text-sm text-zinc-500 font-mono">
                No audits run yet. Submit a URL above to start!
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = STATUS_STYLES[status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-mono font-medium border ${styles}`}
    >
      {label}
    </span>
  );
}
