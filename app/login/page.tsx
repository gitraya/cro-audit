import Link from "next/link";
import { ArrowLeft, Lock, UserPlus, ShieldAlert } from "lucide-react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { signIn, signUp } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

const inputClass =
  "w-full bg-white border border-zinc-200 rounded px-3.5 py-2 text-sm text-zinc-900 focus:outline-hidden focus:border-zinc-400 font-sans";
const labelClass =
  "block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#fafafa] text-zinc-950 font-sans">
      <div className="w-full h-1.5 bg-emerald-500" />

      <div className="max-w-6xl mx-auto px-6 md:px-12 py-12">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center text-xs font-mono text-zinc-500 hover:text-zinc-900 mb-10 transition duration-150 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1 text-zinc-400 group-hover:text-zinc-900 transition duration-150" />
          Back to home
        </Link>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mt-4">
          {/* Left Column - Intro */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-600 uppercase">
              CRO Audit
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-900">
              Sign in
            </h1>
            <p className="text-[15px] text-zinc-600 leading-relaxed max-w-sm">
              Access your audit dashboard and review saved homepage replication
              runs.
            </p>

            {!hasSupabaseEnv() ? (
              <div className="bg-amber-50 border border-amber-100 text-amber-900 text-xs p-4 rounded-md flex items-start space-x-2 max-w-sm mt-4">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Supabase environment variables are not configured. Copy{" "}
                  <code className="font-mono">.env.example</code> to{" "}
                  <code className="font-mono">.env.local</code> and add your
                  project URL and anon key.
                </span>
              </div>
            ) : null}

            {params.error ? (
              <div className="bg-red-50 border border-red-100 text-red-800 text-xs p-4 rounded-md flex items-start space-x-2 max-w-sm mt-4">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{params.error}</span>
              </div>
            ) : null}
          </div>

          {/* Right Column - Forms Stack */}
          <div className="lg:col-span-7 flex flex-col space-y-8">
            {/* Card 1 - Existing User */}
            <div className="bg-white border border-zinc-200/80 rounded-lg p-6 md:p-8 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 mb-6 flex items-center">
                <Lock className="w-4 h-4 mr-2 text-zinc-500" />
                Existing user
              </h2>

              <form action={signIn} className="space-y-4">
                <input
                  type="hidden"
                  name="next"
                  value={params.next ?? "/dashboard"}
                />
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    name="email"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    type="password"
                    name="password"
                    required
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 inline-flex items-center justify-center bg-zinc-950 hover:bg-zinc-900 text-white font-medium text-sm py-2.5 rounded transition duration-150 cursor-pointer"
                >
                  Sign in
                </button>
              </form>
            </div>

            {/* Card 2 - Create Account */}
            <div className="bg-white border border-zinc-200/80 rounded-lg p-6 md:p-8 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 mb-6 flex items-center">
                <UserPlus className="w-4 h-4 mr-2 text-zinc-500" />
                Create account
              </h2>

              <form action={signUp} className="space-y-4">
                <div>
                  <label className={labelClass}>Full name</label>
                  <input
                    type="text"
                    name="fullName"
                    placeholder="Jane Doe"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="jane@example.com"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 inline-flex items-center justify-center bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium text-sm py-2.5 rounded shadow-xs transition duration-150 cursor-pointer"
                >
                  Create account
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
