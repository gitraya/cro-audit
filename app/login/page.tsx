import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { signIn, signUp } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10 text-neutral-950">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-sm font-medium uppercase tracking-normal text-emerald-700"
        >
          Monolitlabs
        </Link>
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <section>
            <h1 className="text-4xl font-semibold">Sign in</h1>
            <p className="mt-4 max-w-md text-neutral-600">
              Access your audit dashboard and review saved homepage replication
              runs.
            </p>

            {!hasSupabaseEnv() ? (
              <p className="mt-6 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Supabase environment variables are not configured. Copy
                `.env.example` to `.env.local` and add your project URL and anon
                key.
              </p>
            ) : null}

            {params.error ? (
              <p className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {params.error}
              </p>
            ) : null}
          </section>

          <section className="grid gap-6">
            <form
              action={signIn}
              className="border border-neutral-200 bg-white p-6"
            >
              <input
                type="hidden"
                name="next"
                value={params.next ?? "/dashboard"}
              />
              <h2 className="text-lg font-semibold">Existing user</h2>
              <label className="mt-5 block text-sm font-medium">
                Email
                <input
                  required
                  name="email"
                  type="email"
                  className="mt-2 w-full border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Password
                <input
                  required
                  name="password"
                  type="password"
                  className="mt-2 w-full border border-neutral-300 px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="mt-6 w-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white cursor-pointer"
              >
                Sign in
              </button>
            </form>

            <form
              action={signUp}
              className="border border-neutral-200 bg-white p-6"
            >
              <h2 className="text-lg font-semibold">Create account</h2>
              <label className="mt-5 block text-sm font-medium">
                Full name
                <input
                  name="fullName"
                  className="mt-2 w-full border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Email
                <input
                  required
                  name="email"
                  type="email"
                  className="mt-2 w-full border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Password
                <input
                  required
                  minLength={8}
                  name="password"
                  type="password"
                  className="mt-2 w-full border border-neutral-300 px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="mt-6 w-full border border-neutral-950 px-4 py-2.5 text-sm font-medium cursor-pointer"
              >
                Sign up
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
