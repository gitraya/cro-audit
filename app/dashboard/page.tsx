import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";
import { createAudit } from "./actions";

type DashboardPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="min-h-screen bg-neutral-50 px-6 py-10 text-neutral-950">
        <div className="mx-auto max-w-3xl border border-amber-200 bg-amber-50 p-6">
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

  const params = await searchParams;
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

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8 text-neutral-950">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              {profile?.email ?? user.email}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Audit dashboard</h1>
          </div>
          <form action={signOut}>
            <button className="border border-neutral-300 bg-white px-4 py-2 text-sm font-medium">
              Log out
            </button>
          </form>
        </header>

        {params.error ? (
          <p className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        <section className="mt-8 border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Start a homepage audit</h2>
          <form
            action={createAudit}
            className="mt-5 flex flex-col gap-3 sm:flex-row"
          >
            <input
              required
              name="url"
              type="url"
              placeholder="https://example.com"
              className="min-h-11 flex-1 border border-neutral-300 px-3 py-2"
            />
            <button className="min-h-11 bg-neutral-950 px-5 text-sm font-medium text-white">
              Create audit
            </button>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">History</h2>
          {auditsError ? (
            <p className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {auditsError.message}
            </p>
          ) : null}

          <div className="mt-4 divide-y divide-neutral-200 border border-neutral-200 bg-white">
            {audits?.length ? (
              audits.map((audit) => (
                <Link
                  key={audit.id}
                  href={`/audits/${audit.id}`}
                  className="grid gap-2 p-4 hover:bg-neutral-50 sm:grid-cols-[1fr_auto_auto]"
                >
                  <span className="font-medium">{audit.url}</span>
                  <span className="text-sm text-neutral-500">
                    {audit.status}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {new Date(audit.created_at).toLocaleString()}
                  </span>
                </Link>
              ))
            ) : (
              <p className="p-4 text-sm text-neutral-500">
                No audits yet. Create the first one above.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
