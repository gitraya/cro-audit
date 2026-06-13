# CRO Audit & Homepage Replication

A web application that performs Conversion Rate Optimization audits on any homepage and generates an improved, brand-matched version of the page — grounded in established CRO and persuasion literature.

## Live Demo

- **Application URL:** https://monolitlabs.ai.raya.bio
- **Test accounts:**
  - Create one via the in-app signup form (Supabase email auth)

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
| External API | Google PageSpeed Insights                           |
| Deployment   | Vercel                                              |

**Why this stack:** Next.js keeps the UI and server actions in one app. Supabase handles auth and Postgres persistence without adding a separate backend.

---

## Architecture

The audit runs as a pipeline of discrete stages:

```
URL
  → Scrape + PageSpeed Insights (parallel)
  → Brand Extraction (+ deterministic layout hints)
  → RAG Retrieval (balanced, per source book)
  → CRO Audit (Gemini, grounded in retrieved principles)
  → Validation (drop ungrounded findings)
  → Homepage Replication (Gemini)
  → Persist
```

The submit endpoint inserts the audit row and returns `{ auditId }` immediately; the pipeline then keeps running after the response via Next.js `after()` (Vercel `waitUntil`). Each step writes a `stage` column as it completes, and the audit detail page re-fetches its own server data every 2s, so findings, the generated homepage, brand tokens, layout hints, and PageSpeed signals appear progressively. The scraper returns transient in-memory page data; PageSpeed Insights runs in parallel with scraping because it is slow and independent.

> **Note (CRO pipeline):** Homepage replication is best-effort — if generation fails the audit still completes with its validated findings rather than discarding them. Any stage that throws marks the audit `failed` with a reason, and the background task never hangs the request.

### Data model

The Supabase migrations (applied in order from `supabase/migrations/`) create:

- `profiles`: app-owned user profile rows linked to `auth.users`
- `audits`: user-owned audit records with `status`, `stage`, `brand_tokens`, `pagespeed_data`, `layout_hints`, `findings`, `generated_html`, and `applied_changes`
- `book_principles`: seeded CRO/UX principles with pgvector embeddings for balanced retrieval
- `brand_voice_caches`: durable per-URL voice-token cache
- `pagespeed_caches`: durable per-URL PageSpeed signal cache
- `match_principles_by_book`: SQL function that returns the nearest principles within a single source book, enabling balanced per-book retrieval

Row-level security is enabled so users can only read and mutate their own profile and audit rows. Authenticated users can read `book_principles` and use the voice cache.

---

## Knowledge Grounding (How Findings Stay Multi-Source)

CRO/UX principles are seeded into `book_principles` (`npm run seed:principles`) and embedded with Gemini `gemini-embedding-001` (768-dim, normalized). At audit time the page signals (title, description, headings, a body excerpt, and a compact PageSpeed summary) are embedded once, then retrieval calls `match_principles_by_book` **once per distinct source book** and keeps the top-N (3) per book.

> **Note (balanced retrieval):** Fanning out per book and taking top-N each prevents the findings from collapsing toward a single dominant source — the result is ranked by similarity across all books but guarantees breadth. See `lib/cro-audit/retrieval.ts`.

The audit LLM (`lib/cro-audit/generation.ts`) runs at temperature 0 with a JSON schema and must cite a `principle` name and `source_book` **verbatim** from the provided set, producing 5–7 findings. A validation pass (`lib/cro-audit/validation.ts`) then drops any finding whose principle is not in the retrieved set and repairs the `source_book` when the principle matches but the book label drifted — so every persisted finding stays traceable and the source coverage stays multi-source.

---

## Deterministic Brand Extraction

Brand tokens must be identical on repeat runs of the same URL. Colors and fonts are extracted deterministically from CSS with no LLM. Voice can use Gemini at temperature 0, then the normalized result is cached by URL in Postgres.

Running the same URL twice produces identical voice tokens because `extractVoice` checks `brand_voice_caches` before calling the provider.

> **Note (layout hints vs brand identity):** `extractLayoutHints` (`lib/brand/extraction.ts`) reuses the same CSS color parser plus the scraped hero DOM to derive deterministic layout signals — dominant background/text color, `is_dark_theme` (WCAG relative luminance), and `hero_alignment` (inline `text-align` → utility classes such as `text-center` on the `h1`'s ancestor chain → CSS-selector fallback). These are **layout** signals, not brand identity, so they are kept out of `brand_tokens` and fed to homepage generation as a separate `layout_hints` input.

---

## External API Integration

**API used:** Google PageSpeed Insights.

Each audit requests mobile `performance` and `accessibility` categories with `PAGESPEED_API_KEY`. The app extracts a compact `PageSpeedSignals` object rather than storing the raw Lighthouse blob: 0-100 category scores, LCP/CLS/TBT values with ratings, and up to six deterministic CRO-relevant weak audits. Signals are cached in Postgres by normalized URL. If PageSpeed is unavailable, the audit still proceeds with `pagespeed_data: null`.

---

## Homepage Replication

`lib/cro-audit/replication.ts` calls Gemini `gemini-2.5-flash` at temperature 0.4 (creative output — intentionally non-deterministic, unlike brand extraction) under a JSON response schema. It receives the `brand_tokens` (hard constraints: colors injected as CSS custom properties, the primary font with fallbacks, and the brand voice), the `layout_hints` (so it matches light/dark orientation and hero alignment), the original page structure, and the **validated** findings. It returns one self-contained HTML document (inline `<style>` only, no external CSS/JS/CDN) plus an `applied_changes` list, where each change is mapped back to the `finding_principle` and `source_book` that drove it.

> **Note (safety + honesty):** The generated HTML is rendered in a sandboxed iframe (`srcDoc` + `sandbox=""`) so LLM markup is isolated from the app DOM. The prompt also forbids fabricated specifics (no fake stats, no invented named customers) — only clearly illustrative placeholders grounded in the original content.

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
#   SUPABASE_SERVICE_ROLE_KEY   # used by the background pipeline (RAG + writes)
#   GEMINI_API_KEY
#   PAGESPEED_API_KEY
#   SUPABASE_DB_URL             # only needed for db:migrate and seed:principles

# 4. Database setup
# Applies every migration in supabase/migrations/ in order (via psql).
npm run db:migrate

# 5. Seed CRO principles (required for grounded findings)
# Embeds book_principles with Gemini and writes pgvector rows.
npm run seed:principles

# 6. Run
npm run dev
```

Current project commands:

```bash
npm run dev
npm run build
npm run lint
npm test
npm run db:migrate
npm run seed:principles
```

> All API keys are read from environment variables. No keys are committed to the repository.

---

## AI Tools in My Workflow

AI assistance was used for implementation support, debugging extraction edge cases, and test iteration.

---

## Key Decisions & Tradeoffs

- Colors, fonts, and layout hints are parsed deterministically instead of inferred by an LLM.
- Raw scraped content stays transient; only structured outputs (`brand_tokens`, `pagespeed_data`, `layout_hints`, `findings`, `generated_html`, `applied_changes`) are persisted.
- Voice uses an LLM only behind a durable URL cache.
- PageSpeed runs concurrently with scraping and is cached per URL to avoid repeated slow external calls.
- Findings are grounded: retrieval fans out per source book (top-N each) for multi-source breadth, and a validation pass drops any finding whose principle is not in the retrieved set.
- Audit generation is deterministic (temperature 0); homepage replication is intentionally creative (temperature 0.4).
- The pipeline runs after the HTTP response (Next.js `after()`), writing a `stage` column the UI polls; a replication failure never discards validated findings.
- LLM-generated homepage HTML is rendered in a sandboxed iframe, never injected into the app DOM.

---

## What's Unfinished / Next Steps

- Better handling for heavily JavaScript-rendered sites (scraping reads static HTML + CSS only)
- Streaming partial findings before the audit fully completes (stages are persisted as they finish, but individual findings are not streamed)
- Automated evaluation of finding quality and grounding coverage

---

## Not Implemented (Per Spec — Explicitly Not Required)

- Mobile responsiveness on the generated homepage
- Pixel-perfect visual matching
- Complex user management (admin panels, password reset, email verification)
- Production-grade scale
