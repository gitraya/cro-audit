# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains planning docs for the Monolitlabs CRO audit and homepage replication app.

- `README.md` gives the project name and short description.
- `docs/engineering-tesst-project.md` contains the original engineering test requirements.
- `docs/project-plan.md` captures the intended architecture, stack, pipeline, and delivery checklist.

When the app is scaffolded, use the planned Next.js App Router structure: `app/` for routes and UI, `components/` for reusable React components, `lib/` for scraper, brand extraction, PageSpeed, RAG, and LLM helpers, `db/` or `supabase/` for migrations and seed scripts, and `tests/` for focused tests.

## Build, Test, and Development Commands

No package manager files exist yet, so there are no runnable build or test commands in the current state. After scaffolding the Next.js app, document and keep these commands working:

- `npm run dev` starts the local development server.
- `npm run build` creates a production build.
- `npm run lint` runs formatting and lint checks.
- `npm test` runs the test suite.

Do not commit `.next/`, `coverage/`, or `node_modules/`.

## Coding Style & Naming Conventions

Prefer TypeScript once implementation begins. Use 2-space indentation for TypeScript, React, JSON, and Markdown. Name React components in `PascalCase`, hooks as `useSomething`, utility files in `kebab-case.ts`, and route directories with lowercase path segments.

Keep pipeline code explicit and separable: scraping, deterministic brand extraction, external API collection, grounded audit generation, homepage generation, and persistence should be independently testable modules.

## Testing Guidelines

There is no test framework configured yet. When adding implementation, include tests for deterministic behavior and pipeline contracts. At minimum, cover repeated brand extraction for the same URL, balanced retrieval across books, PageSpeed parsing, and audit finding schema validation. Use names like `brand-extraction.test.ts` or colocated `*.test.ts` files.

## Commit & Pull Request Guidelines

Current history has only `Initial commit`, so no detailed convention is established. Use short, imperative commit messages such as `Scaffold Next.js app`, `Add deterministic brand extraction`, or `Integrate PageSpeed audit data`. Commit each meaningful step; the project brief explicitly discourages a single end-of-project commit.

Pull requests should include a concise summary, test results, environment variables changed, screenshots for UI changes, and notes on unfinished scope. Link any relevant issue or engineering-test requirement.

## Security & Configuration Tips

Read API keys and database credentials from environment variables only. Never commit `.env`, `.env.local`, Vercel config, Supabase secrets, Anthropic keys, Google API keys, or test account passwords.
