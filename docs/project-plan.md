# Monolitlabs Engineering Test — Project Plan

### CRO Audit & Homepage Replication App

### Candidate: Raya | Window: 4 days | Budget: ~15 hours

---

## 🎯 The Core Strategy (Read This Every Day)

**Where credit actually lives:** Auth, CRUD, and UI are your strong areas but earn the _least_ evaluation credit — they're table stakes. The **grounding/RAG**, **determinism**, and **external-API-informing-findings** are where you were nervous, but they earn the _most_ credit. So spend proportionally MORE time on the AI-judgment parts than the parts you find easy.

**The 3 things that win this:**

1. **Multi-source grounding that doesn't collapse to one book** — the heart of the eval
2. **Deterministic brand extraction** — proves you know when NOT to use an LLM
3. **An external API whose output genuinely informs findings** — not decoration

**Finish the spine completely, even if some leaves are unfinished.** Partial submissions with strong choices are evaluated fairly. A complete-but-simple pipeline beats a half-built ambitious one.

**Commit from line one.** A single end-of-project commit is an explicit negative signal. Commit at every meaningful step.

---

## 🏗️ Tech Stack (Locked — Don't Reconsider Mid-Build)

| Layer        | Choice                                    | Why                                                                 |
| ------------ | ----------------------------------------- | ------------------------------------------------------------------- |
| Framework    | **Next.js (App Router)**                  | Full-stack in one repo, your daily driver, deploys instantly        |
| Database     | **PostgreSQL + pgvector**                 | Your strength + RAG capability in one. Use **Supabase** or **Neon** |
| Auth         | **Supabase Auth** or **NextAuth/Auth.js** | Do NOT build from scratch — zero eval credit                        |
| LLM          | **Claude (Anthropic)**                    | You have access; strong reasoning + generation                      |
| Scraping     | **Cheerio** (HTML parsing in Node)        | Fast, reliable for static HTML                                      |
| External API | **Google PageSpeed Insights**             | Free, gives perf + a11y data that maps to CRO findings              |
| Deploy       | **Vercel**                                | Native Next.js home, auto-deploys from GitHub                       |

> **One-stack tip:** If you use Supabase for both DB _and_ auth, you cut setup time significantly and get pgvector support out of the box.

---

## 🔧 Architecture — The Pipeline

The audit is a **pipeline of slow operations**. Structure the code around these stages — it keeps things clean and maps directly to the eval criteria.

```
URL input
   │
   ▼
[1] SCRAPE          → HTML, meta, headings, body, CSS/styles
   │
   ▼
[2] BRAND EXTRACT   → colors + font (DETERMINISTIC, from CSS)
   │                  voice descriptors (temp=0 LLM, cached per URL)
   ▼
[3] EXTERNAL API    → PageSpeed Insights: perf, a11y, specific issues
   │
   ▼
[4] GROUNDED AUDIT  → retrieve principles from BOTH books (pgvector)
   │                  → LLM produces 5-7 findings, each tagged to a
   │                    specific principle + source
   ▼
[5] REPLICATE       → LLM generates new homepage HTML using brand
   │                  tokens + applying CRO solutions
   ▼
[6] PERSIST         → save to user account, show in history
```

### Data model (rough)

```
users (handled by auth provider)

audits
  id, user_id, url, created_at, status
  brand_tokens (jsonb)        -- colors[], font, voice{}
  pagespeed_data (jsonb)      -- raw + extracted metrics
  findings (jsonb)            -- [{observation, solution, principle, source}]
  generated_html (text)       -- the replicated homepage

book_principles              -- seeded once, for RAG
  id, book_title, principle_name, content, embedding (vector)
```

---

## ⭐ The Highest-Stakes Piece: Multi-Source Grounding

The eval literally checks _"whether findings genuinely reflect multiple sources or collapse toward one."_ Engineer against this explicitly.

**Setup (one-time seed script):**

- Pick 2+ books (e.g. _Don't Make Me Think_ — Krug, _Influence_ — Cialdini, _Building a StoryBrand_ — Miller)
- Break each into discrete **principle chunks** — one principle + its explanation per chunk
- Embed each chunk, store in `book_principles` with `book_title` tagged

**At audit time — the technique that wins:**

- **Don't** retrieve top-N overall (they might all come from one book)
- **Do** retrieve a _balanced_ set — top principles from _each book separately_, then combine
- Pass the retrieved principles to the LLM as grounding
- **Instruct the model to tag each finding** with the specific principle name AND source book
- This makes multi-source usage visible and traceable — exactly what they grade

**README sentence to include:**

> "Findings are grounded via balanced retrieval — top principles are retrieved from each book independently rather than globally, preventing collapse toward a single source. Each finding is traceable to a named principle and its source book."

---

## ⭐ The Determinism Trap: Brand Extraction

The eval checks _"running the same URL twice produces the same brand tokens."_ Most candidates fail by routing this through an LLM.

**Do this:**

- **Colors** → parse from CSS directly (CSS variables, computed styles, most frequent non-neutral colors). Inherently deterministic.
- **Font** → parse `font-family` from CSS. Deterministic.
- **Voice descriptors** → if you use an LLM here, pin `temperature: 0` AND cache the result keyed by URL, so repeat runs return identical tokens.

**README sentence to include:**

> "Brand colors and typography are extracted deterministically via CSS parsing. Voice descriptors use a temperature-0 LLM call cached per URL, guaranteeing identical tokens on repeat runs."

That one sentence shows you understand the requirement at a level most won't.

---

## 📅 Day-by-Day Plan (~15 hours)

### Day 1 — Foundation & Spine (~4 hrs)

**Goal: a deployed, authenticated skeleton you can build on.**

- [ ] **FIRST ACTION:** Create the GitHub repo, initial commit (empty Next.js app)
- [ ] Scaffold Next.js App Router project
- [ ] Set up Supabase/Neon — Postgres + enable pgvector extension
- [ ] Wire up auth: signup, login, logout, redirect logged-out users
- [ ] Create the `audits` table + data model
- [ ] Deploy to Vercel — get the live URL working _today_ (deploy early, not at the end)
- [ ] Commit at each step

> ✅ End of Day 1: You can sign up, log in, see an empty dashboard, and it's live on Vercel.

---

### Day 2 — Scraping, Brand, External API (~4 hrs)

**Goal: the deterministic + data-gathering stages working.**

- [ ] Build the scraper (Cheerio) — fetch URL, extract HTML/meta/headings/body/CSS
- [ ] Build **deterministic brand extraction** — colors + font from CSS
- [ ] Add voice descriptors (temp=0, cached per URL)
- [ ] **Test determinism**: run the same URL twice, confirm identical brand tokens
- [ ] Integrate **PageSpeed Insights** API — pull perf + a11y data
- [ ] Store scraped data + brand tokens + pagespeed data on the audit record
- [ ] Commit at each step

> ✅ End of Day 2: Enter a URL → system scrapes it, extracts brand tokens deterministically, pulls PageSpeed data, saves it all.

---

### Day 3 — The AI Core (~4-5 hrs) ⭐ MOST IMPORTANT DAY

**Goal: grounded audit + homepage generation. Spend your best energy here.**

- [ ] Write the **book-principles seed script** — chunk 2+ books, embed, store in pgvector
- [ ] Build **balanced retrieval** — top principles from each book separately
- [ ] Build the **audit LLM call** — feed principles + page content + PageSpeed data
  - [ ] 5-7 findings, each with observation + solution + **principle + source tag**
  - [ ] Make sure PageSpeed data actually informs some findings
- [ ] Build the **homepage replication LLM call** — brand tokens + content + solutions → new HTML
- [ ] Render the generated homepage as a viewable page
- [ ] Display findings in a clean, readable dashboard format
- [ ] Commit at each step

> ✅ End of Day 3: Full pipeline works end-to-end. This is the core deliverable.

---

### Day 4 — History, Polish, Submission (~2-3 hrs)

**Goal: tie it together, write the README, submit.**

- [ ] Build the **history view** — list all past audits (URL, date, status)
- [ ] Click any audit → full results (findings + generated homepage)
- [ ] **Verify persistence across sessions** — log out, log back in, data's still there
- [ ] Create **2 test accounts** with pre-loaded audits
- [ ] Write the **README** (see checklist below)
- [ ] Final deploy check — live URL works, test accounts work
- [ ] Share private repo access with the email they provide
- [ ] Reply to the test invitation email
- [ ] Buffer time for the inevitable thing that breaks

> ✅ End of Day 4: Submitted, with a README that explains your choices.

---

## 📝 README Checklist (Earns Real Credit)

The README is where you make your thinking _visible_ — the eval rewards architectural reasoning. Include:

- [ ] Quick setup / run instructions
- [ ] **The determinism explanation** (brand extraction sentence above)
- [ ] **The multi-source grounding explanation** (balanced retrieval sentence above)
- [ ] Which books you used and why
- [ ] Which external API and how its output informs findings
- [ ] Your key architectural decisions and tradeoffs
- [ ] What's unfinished, if anything, and what you'd do next
- [ ] The 2 test account credentials
- [ ] A note on thoughtful AI-tool use (they evaluate this — mention using Claude Code/Cursor in your workflow if you did)

---

## 🎤 Don't Forget: The 30-Minute Live Interview

A live interview follows submission. They'll ask _why_ you made your choices. Be ready to explain:

- Why you extracted brand tokens deterministically instead of via LLM
- How you prevented findings from collapsing toward one book
- Why you chose PageSpeed Insights and how it informs findings
- How you'd scale this / what you'd change with more time
- Tradeoffs you made under the time budget

> Since you'll have _built_ this, these answers come naturally — which is exactly why doing the project well doubles as interview prep.

---

## ⚠️ Time-Saving Discipline (Protect Your 15 Hours)

- **Deploy on Day 1**, not Day 4 — deployment surprises are the #1 time sink
- **Don't build custom auth** — use the provider, move on
- **Don't chase pixel-perfect** homepage matches — explicitly not required
- **Don't do mobile responsiveness** on the generated page — explicitly not required
- **Don't over-engineer** user management — no admin panels, password reset, email verification
- **Skip novel layouts** — not required
- When stuck >20 min, simplify or note it in the README and move on

---

## 🧭 One Mindset Note

This project is, almost exactly, a real version of the AI-engineering gap you were worried about — and that's good news. By the time you finish it, you won't be _saying_ you can move into AI fast. You'll have _proof_. Every stage you complete is a concrete story for the live interview. Build the spine, nail the three high-stakes pieces, commit often, and explain your reasoning clearly.

You've got the engineering foundation for all of this. Go build it. 💪
