# CRO Audit & Homepage Replication

A web application that performs Conversion Rate Optimization audits on any homepage and generates an improved, brand-matched version of the page — grounded in established CRO and persuasion literature.

## Live Demo

- **Application URL:** https://monolitlabs.ai.raya.bio
- **Test accounts:**
  - Not included in this repo

Audit history is stored per authenticated Supabase user.

---

## What It Does

1. User signs up / logs in (logged-out users are redirected to login)
2. From the dashboard, the user enters any website URL
3. The system scrapes the homepage, extracts its brand identity, and runs an external performance/accessibility audit
4. An LLM produces a CRO audit of 5–7 specific findings, each grounded in a named principle from a recognized source and traceable to that source
5. The system generates a replicated homepage that applies the CRO solutions while preserving the original site's brand identity
6. Everything is saved to the user's account and viewable from a history view across sessions

---

## Tech Stack

| Layer        | Choice                                              |
| ------------ | --------------------------------------------------- |
| Framework    | Next.js App Router with TypeScript and Tailwind CSS |
| Database     | Supabase PostgreSQL with pgvector                   |
| Auth         | Supabase Auth                                       |
| LLM provider | Google Gemini via `@google/generative-ai`           |
| Scraping     | Cheerio                                             |
| External API | Not implemented yet                                 |
| Deployment   | Vercel                                              |

**Why this stack:** Next.js keeps the UI and server actions in one app. Supabase handles auth and Postgres persistence without adding a separate backend.

---

## Architecture

The audit runs as a pipeline of discrete stages:

```
URL → Scrape → Brand Extraction → Persist
```

The scraper returns transient in-memory page data. Brand extraction reads that data and returns `brand_tokens`. Only the audit row and brand tokens are persisted.

### Data model

The initial Supabase migration creates:

- `profiles`: app-owned user profile rows linked to `auth.users`
- `audits`: user-owned audit records with `status`, `brand_tokens`, `pagespeed_data`, `findings`, and `generated_html`
- `book_principles`: seeded CRO/UX principles with pgvector embeddings for balanced retrieval
- `brand_voice_caches`: durable per-URL voice-token cache

Row-level security is enabled so users can only read and mutate their own profile and audit rows. Authenticated users can read `book_principles` and use the voice cache.

---

## Knowledge Grounding (How Findings Stay Multi-Source)

Not implemented yet. The schema includes `book_principles`, but retrieval and grounded finding generation are still pending.

---

## Deterministic Brand Extraction

Brand tokens must be identical on repeat runs of the same URL. Colors and fonts are extracted deterministically from CSS with no LLM. Voice can use Gemini at temperature 0, then the normalized result is cached by URL in Postgres.

Running the same URL twice produces identical voice tokens because `extractVoice` checks `brand_voice_caches` before calling the provider.

---

## External API Integration

**API used:** Not implemented yet.

This is still planned.

---

## Homepage Replication

Not implemented yet.

---

## Persistence & History

Audits are inserted into Supabase with the authenticated user's id. The dashboard reads the user's audit history from Postgres, so history persists across sessions.

---

## Setup (Local Development)

```bash
# 1. Clone
git clone <repo-url>
cd monolitlabs.ai

# 2. Install
npm install

# 3. Environment variables
cp .env.example .env.local
# Fill in:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#   GEMINI_API_KEY
#   SUPABASE_DB_URL

# 4. Database setup
# Run supabase/migrations/001_initial_schema.sql in Supabase SQL Editor
# or apply it locally with psql.
npm run db:migrate

# 5. Run
npm run dev
```

Current project commands:

```bash
npm run dev
npm run build
npm run lint
npm test
npm run db:migrate
```

> All API keys are read from environment variables. No keys are committed to the repository.

---

## AI Tools in My Workflow

AI assistance was used for implementation support, debugging extraction edge cases, and test iteration.

---

## Key Decisions & Tradeoffs

- Colors and fonts are parsed deterministically instead of inferred by an LLM.
- Raw scraped content stays transient; only `brand_tokens` are persisted.
- Voice uses an LLM only behind a durable URL cache.

---

## What's Unfinished / Next Steps

- PageSpeed integration
- RAG retrieval and grounded CRO findings
- Homepage generation
- Better handling for heavily JavaScript-rendered sites

---

## Not Implemented (Per Spec — Explicitly Not Required)

- Mobile responsiveness on the generated homepage
- Pixel-perfect visual matching
- Complex user management (admin panels, password reset, email verification)
- Production-grade scale
