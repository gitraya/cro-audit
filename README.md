# CRO Audit & Homepage Replication

A web application that performs Conversion Rate Optimization audits on any homepage and generates an improved, brand-matched version of the page — grounded in established CRO and persuasion literature.

> **Note to reviewer:** Fill in every `[FILL IN]` marker with your real choices as you build. Delete this note and any sections that don't apply before submitting. A README that accurately reflects what you built is what earns credit — don't describe anything you didn't implement.

---

## Live Demo

- **Application URL:** [FILL IN — your Vercel URL]
- **Test accounts:**
  - `[FILL IN email 1]` / `[FILL IN password 1]`
  - `[FILL IN email 2]` / `[FILL IN password 2]`

Both accounts come pre-loaded with example audits in their history.

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
| Database     | [FILL IN — e.g. PostgreSQL + pgvector via Supabase] |
| Auth         | [FILL IN — e.g. Supabase Auth]                      |
| LLM provider | [FILL IN — e.g. Claude / Anthropic]                 |
| Scraping     | [FILL IN — e.g. Cheerio]                            |
| External API | [FILL IN — e.g. Google PageSpeed Insights]          |
| Deployment   | [FILL IN — e.g. Vercel]                             |

**Why this stack:** [FILL IN — 2-3 sentences on your reasoning. Mention playing to existing strengths, single-repo simplicity, managed DB with vector support, etc.]

---

## Architecture

The audit runs as a pipeline of discrete stages:

```
URL → Scrape → Brand Extraction → External API → Grounded Audit → Homepage Replication → Persist
```

[FILL IN — brief description of how the stages connect, where async/queuing happens if any, and how data flows through to storage.]

### Data model

[FILL IN — describe your `audits` table and `book_principles` table, or paste a short schema.]

---

## Knowledge Grounding (How Findings Stay Multi-Source)

**Books used:**

- [FILL IN — Book 1, e.g. *Don't Make Me Think* by Steve Krug]
- [FILL IN — Book 2, e.g. *Influence* by Robert Cialdini]
- [FILL IN — any additional sources]

**How grounding works:**
[FILL IN — describe your real approach. If you followed the plan:]

> Each book's principles are chunked into discrete units (one principle + explanation per chunk), embedded, and stored in a vector database. At audit time, principles are retrieved using **balanced retrieval** — the top principles are pulled from _each book independently_ rather than globally, which prevents findings from collapsing toward a single dominant source. Each finding the LLM produces is tagged with the specific principle name and its source book, making multi-source usage explicit and traceable.

**Why this prevents single-source collapse:** [FILL IN — explain in your own words. This is one of the most-graded aspects, so make the reasoning clear.]

---

## Deterministic Brand Extraction

Brand tokens must be identical on repeat runs of the same URL. This is achieved by:

[FILL IN — describe your real approach. If you followed the plan:]

> - **Colors and typography** are extracted deterministically by parsing the page's CSS directly (CSS variables, computed styles, frequency analysis of non-neutral colors, and `font-family` declarations) — no LLM involved.
> - **Voice descriptors** [FILL IN — if you used an LLM: use a temperature-0 call cached per URL, guaranteeing identical output on repeat runs. If you parsed deterministically, say so.]

Running the same URL twice produces identical brand tokens because [FILL IN — your reasoning].

---

## External API Integration

**API used:** [FILL IN — e.g. Google PageSpeed Insights]

**How its output informs the audit:** [FILL IN — be specific. e.g. "Performance metrics like Largest Contentful Paint and accessibility scores are passed into the audit prompt and surface as concrete findings, such as slow-load issues tied to bounce-rate principles." The eval checks that the API *meaningfully* informs findings, not that it's just called.]

---

## Homepage Replication

The generated homepage:
[FILL IN — describe how it uses the extracted brand tokens, how the CRO solutions are visibly applied (improved headlines, clearer CTAs, restructured hierarchy, trust signals), and how it's rendered/viewable.]

---

## Persistence & History

[FILL IN — describe how audits are saved per user, how the history list works, and confirm persistence holds across sessions.]

---

## Setup (Local Development)

```bash
# 1. Clone
git clone [FILL IN repo URL]
cd [FILL IN]

# 2. Install
npm install

# 3. Environment variables
cp .env.example .env
# Fill in:
#   [FILL IN — e.g. ANTHROPIC_API_KEY, DATABASE_URL, PAGESPEED_API_KEY, auth secrets]

# 4. Database setup
[FILL IN — migrations, enabling pgvector, seeding book principles]

# 5. Run
npm run dev
```

Current project commands:

```bash
npm run dev
npm run build
npm run lint
npm test
```

> All API keys are read from environment variables. No keys are committed to the repository.

---

## AI Tools in My Workflow

[FILL IN — the eval explicitly evaluates "thoughtful use of AI tools." Briefly describe how you used Claude Code / Cursor / etc. — e.g. for scaffolding, debugging the retrieval logic, iterating on prompts. Be honest and specific; this is a real evaluation criterion.]

---

## Key Decisions & Tradeoffs

[FILL IN — a short list of the meaningful choices you made and why. Examples:]

- [Why deterministic parsing over LLM for brand tokens]
- [Why balanced retrieval over global top-N]
- [Why this external API over alternatives]
- [What you simplified given the time budget]

---

## What's Unfinished / Next Steps

[FILL IN — honesty here is rewarded. List anything incomplete and what you'd do with more time. If everything's done, say what you'd improve for production: caching, queueing scrapes, handling JS-heavy sites, etc.]

---

## Not Implemented (Per Spec — Explicitly Not Required)

- Mobile responsiveness on the generated homepage
- Pixel-perfect visual matching
- Complex user management (admin panels, password reset, email verification)
- Production-grade scale
