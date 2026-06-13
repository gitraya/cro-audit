import Link from "next/link";
import { redirect } from "next/navigation";
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
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  queued: "border-neutral-200 bg-neutral-100 text-neutral-600",
  running: "border-amber-200 bg-amber-50 text-amber-800",
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
      <main className="min-h-screen bg-neutral-50 px-6 py-16 text-neutral-950">
        <div className="mx-auto max-w-6xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-2xl font-semibold">Supabase is not configured</h1>
          <p className="mt-3 text-sm leading-6 text-amber-900">
            Copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_SUPABASE_URL`
            and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then run the SQL
            migration in `supabase/migrations`.
          </p>
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
    <main className="min-h-screen bg-neutral-50 px-6 py-12 text-neutral-950">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
              {profile?.email ?? user.email}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Audit dashboard
            </h1>
          </div>
          <form action={signOut}>
            <button className="border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50">
              Log out
            </button>
          </form>
        </header>

        <section className="mt-10 border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Start a homepage audit</h2>
          <AuditSubmit />
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold">History</h2>

          {auditsError ? (
            <p className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {auditsError.message}
            </p>
          ) : null}

          {history.length ? (
            <ul className="mt-4 divide-y divide-neutral-200 border border-neutral-200 bg-white">
              {history.map((audit) => (
                <li key={audit.id}>
                  <Link
                    href={`/audits/${audit.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{audit.url}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {new Date(audit.created_at).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={audit.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : !auditsError ? (
            <div className="mt-4 border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
              <p className="text-sm font-medium text-neutral-700">
                No audits yet
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Run your first homepage audit using the form above.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    STATUS_STYLES[status] ??
    "border-neutral-200 bg-neutral-100 text-neutral-600";
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`shrink-0 border px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}
