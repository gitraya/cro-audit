# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all tests (Node test runner, no Jest)
npm run db:migrate   # Apply all migrations from supabase/migrations/ via psql
npm run seed:principles  # Embed and seed book_principles table via Gemini
```

Run a single test file:
```bash
node --test --experimental-strip-types tests/brand-extraction.test.ts
```

## Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
GEMINI_API_KEY
PAGESPEED_API_KEY
SUPABASE_DB_URL          # only needed for db:migrate and seed:principles
```

## Architecture

This is a **Next.js App Router** app that runs a CRO audit pipeline against any URL. The pipeline stages:

```
URL → [Scrape + PageSpeed in parallel] → Brand Extraction → RAG Retrieval → Gemini Audit → Persist
```

### Key modules under `lib/`

| Path | Purpose |
|------|---------|
| `lib/scraper/homepage.ts` | Cheerio-based HTML scraper |
| `lib/brand/extraction.ts` | Deterministic CSS color/font extraction + cached voice |
| `lib/brand/voice-cache.ts` | Reads/writes `brand_voice_caches` to avoid repeat LLM calls |
| `lib/brand/voice/gemini-provider.ts` | Gemini at temperature 0 for voice descriptors |
| `lib/pagespeed/client.ts` | Google PageSpeed Insights API + `pagespeed_caches` |
| `lib/cro-audit/retrieval.ts` | Balanced pgvector retrieval — top-N per book to prevent single-source collapse |
| `lib/cro-audit/generation.ts` | Gemini audit generation (`gemini-2.5-flash`, temp=0, JSON schema) |
| `lib/cro-audit/validation.ts` | Runtime validation of audit findings shape |
| `lib/api/audits.ts` | Supabase read/write helpers for the `audits` table |
| `lib/supabase/types.ts` | Hand-maintained Supabase type definitions |
| `lib/url/cache-key.ts` | URL normalization for deterministic cache keys |

### App routes

- `/` — root redirect
- `/login` — Supabase Auth login/signup
- `/dashboard` — audit submission form + history list (server component + server action)
- `/audits/[id]` — individual audit result view
- `app/api/audits/route.ts` — REST endpoint for audit CRUD
- `app/api/user/route.ts` — current user info

### Database (Supabase + pgvector)

Migrations in `supabase/migrations/` are applied in order. Key tables:

- `profiles` — RLS-protected user rows linked to `auth.users`
- `audits` — per-user audit records; `findings` is `jsonb` matching `AuditFinding[]`
- `book_principles` — seeded CRO/UX principle chunks with `vector(768)` embeddings
- `brand_voice_caches` — keyed by normalized URL
- `pagespeed_caches` — keyed by normalized URL

The `match_principles_by_book` SQL function enables balanced retrieval: call it once per book to prevent all findings collapsing toward a single source.

### LLM usage

- **Gemini** (`@google/generative-ai`) is the only LLM provider.
- Audit generation uses `gemini-2.5-flash` with `temperature: 0` and a JSON response schema.
- Voice extraction uses `temperature: 0` and caches results by URL — running the same URL twice must return identical tokens.
- Brand colors and fonts are extracted deterministically from CSS without any LLM.

### Testing

Tests use Node's built-in test runner (`node:test`) with `--experimental-strip-types` — no Jest, no Vitest. Test files live in `tests/`.
