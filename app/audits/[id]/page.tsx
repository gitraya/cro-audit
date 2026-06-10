import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuditPageProps = {
  params: Promise<{
    id: string;
  }>;
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

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8 text-neutral-950">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="text-sm font-medium text-emerald-700">
          Back to dashboard
        </Link>

        <header className="mt-6 border-b border-neutral-200 pb-5">
          <p className="text-sm text-neutral-500">{audit.status}</p>
          <h1 className="mt-2 break-words text-3xl font-semibold">{audit.url}</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Created {new Date(audit.created_at).toLocaleString()}
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Brand tokens</h2>
            <pre className="mt-4 overflow-auto bg-neutral-950 p-4 text-xs leading-6 text-white">
              {JSON.stringify(audit.brand_tokens ?? {}, null, 2)}
            </pre>
          </section>

          <section className="border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">PageSpeed data</h2>
            <pre className="mt-4 overflow-auto bg-neutral-950 p-4 text-xs leading-6 text-white">
              {JSON.stringify(audit.pagespeed_data ?? {}, null, 2)}
            </pre>
          </section>
        </div>

        <section className="mt-6 border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Findings</h2>
          <pre className="mt-4 overflow-auto bg-neutral-950 p-4 text-xs leading-6 text-white">
            {JSON.stringify(audit.findings ?? [], null, 2)}
          </pre>
        </section>

        <section className="mt-6 border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Generated homepage</h2>
          {audit.generated_html ? (
            <iframe
              title={`Generated homepage for ${audit.url}`}
              sandbox=""
              srcDoc={audit.generated_html}
              className="mt-4 h-[640px] w-full border border-neutral-200"
            />
          ) : (
            <p className="mt-4 text-sm text-neutral-500">
              Homepage generation has not run for this audit yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
