import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafafa] text-zinc-950 font-sans">
      {/* Upper header border */}
      <div className="w-full h-1.5 bg-emerald-500" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-20">
        {/* Navigation Header */}
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between border-b border-zinc-200/80 pb-6 mb-16 md:mb-24">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-600 uppercase mb-1">
              CRO Audit
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">
              CRO Audit &amp; Homepage Replication
            </h1>
          </div>
          <div className="mt-4 md:mt-0 text-xs font-mono text-zinc-500 tracking-tight">
            Next.js, TypeScript, Tailwind CSS
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column - Big Slogan & Intro */}
          <div className="lg:col-span-7 flex flex-col space-y-8 md:space-y-10">
            <h2 className="text-4xl md:text-[54px] lg:text-[60px] font-extrabold tracking-tight leading-[1.08] text-zinc-900">
              Analyze a homepage, ground the CRO recommendations, and generate a
              brand-matched revision.
            </h2>

            <p className="text-[17px] md:text-[19px] text-zinc-600 leading-relaxed max-w-2xl font-normal">
              This scaffold is ready for the planned pipeline: scraping,
              deterministic brand extraction, PageSpeed data, grounded audit
              generation, homepage replication, and persistence.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center bg-zinc-950 hover:bg-zinc-900 text-white font-medium text-sm px-6 py-3.5 rounded shadow-sm hover:shadow transition duration-150 group"
              >
                Open dashboard
                <ArrowRight className="w-4 h-4 ml-2 text-zinc-400 group-hover:text-white transition duration-150" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center bg-white hover:bg-zinc-50 text-zinc-900 font-medium text-sm px-6 py-3.5 rounded border border-zinc-200 shadow-xs transition duration-150"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Right Column - Implementation Tracks Card */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-zinc-200 rounded-lg p-6 md:p-8 shadow-xs">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 mb-6 flex items-center">
                <Activity className="w-4 h-4 mr-2 text-emerald-600" />
                Implementation Tracks
              </h3>

              <ol className="space-y-6 text-[14px] text-zinc-600 leading-relaxed">
                <li className="flex items-start">
                  <span className="font-mono text-xs text-zinc-400 font-semibold mr-3 mt-0.5 select-none w-5">
                    1.
                  </span>
                  <div>
                    <strong className="text-zinc-900 font-medium">
                      Session Protection:
                    </strong>{" "}
                    Supabase Auth protects the dashboard and audit detail routes.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-mono text-xs text-zinc-400 font-semibold mr-3 mt-0.5 select-none w-5">
                    2.
                  </span>
                  <div>
                    <strong className="text-zinc-900 font-medium">
                      Data Modeling:
                    </strong>{" "}
                    User profiles, audit history, and RAG principles are modeled
                    in Postgres with RLS.
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-mono text-xs text-zinc-400 font-semibold mr-3 mt-0.5 select-none w-5">
                    3.
                  </span>
                  <div>
                    <strong className="text-zinc-900 font-medium">
                      API Endpoints:
                    </strong>{" "}
                    <code className="bg-zinc-100 text-zinc-800 px-1 py-0.5 rounded text-xs font-mono">
                      /api/user
                    </code>{" "}
                    and{" "}
                    <code className="bg-zinc-100 text-zinc-800 px-1 py-0.5 rounded text-xs font-mono">
                      /api/audits
                    </code>{" "}
                    expose authenticated data for the app workflow.
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Subtle Footer */}
        <div className="mt-24 md:mt-36 pt-8 border-t border-zinc-200/50 text-center text-[12px] font-mono text-zinc-400">
          CRO Audit &amp; Brand Replication • Stripe-Inspired Design Flow
        </div>
      </div>
    </main>
  );
}
