export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-neutral-200 pb-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-emerald-700">
              Monolitlabs
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              CRO Audit & Homepage Replication
            </h1>
          </div>
          <span className="hidden text-sm text-neutral-500 sm:block">
            Next.js, TypeScript, Tailwind CSS
          </span>
        </header>

        <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="max-w-2xl text-5xl font-semibold leading-tight text-neutral-950">
              Analyze a homepage, ground the CRO recommendations, and generate
              a brand-matched revision.
            </p>
            <p className="mt-6 max-w-xl text-lg leading-8 text-neutral-600">
              This scaffold is ready for the planned pipeline: scraping,
              deterministic brand extraction, PageSpeed data, grounded audit
              generation, homepage replication, and persistence.
            </p>
          </div>

          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-900">
              Implementation Tracks
            </h2>
            <ol className="mt-5 space-y-4 text-sm leading-6 text-neutral-600">
              <li>
                <span className="font-medium text-neutral-950">1.</span>{" "}
                Build authentication and audit history around a persisted data
                model.
              </li>
              <li>
                <span className="font-medium text-neutral-950">2.</span>{" "}
                Keep scraper, brand extraction, PageSpeed parsing, retrieval,
                and LLM helpers independently testable.
              </li>
              <li>
                <span className="font-medium text-neutral-950">3.</span>{" "}
                Render generated homepages with extracted brand tokens and
                traceable CRO findings.
              </li>
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}
