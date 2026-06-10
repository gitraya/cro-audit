## **Engineering Test Project - Monolitlabs**

**Time expectation:** 4-6 hours **Submission window:** 4 days from receipt **IP:** Work product becomes Monolitlabs property regardless of hiring outcome

### **What You're Building**

A web application with authenticated user accounts where:

- A user signs up with email and password and logs into a dashboard
- From the dashboard, they enter any website URL
- The system performs a Conversion Rate Optimization (CRO) audit of the homepage - identifying specific problems with their proposed solutions
- The system then generates a replicated version of the same homepage with the CRO solutions applied, matching the original site's brand identity (colors, typography, visual style, tone)
- The audit and generated homepage are saved to the user's account and accessible from a history view

The user should be able to log in, see all their past audits listed, and click into any of them to view the audit findings and the regenerated homepage.

### **Functional Requirements**

#### **Authentication**

- Email and password signup and login
- Logged-out users are redirected to login
- Logged-in users see their dashboard
- Logout functionality

#### **Audit Engine**

- Input: a target website URL
- Scrape the homepage (HTML, meta tags, headings, body content, basic visual elements)
- Use an LLM to produce a CRO audit containing:
  - 5-7 specific problems identified on the page
  - For each problem: a clear observation and a proposed solution
- Output displayed in a clean, readable format inside the dashboard

#### **Knowledge Grounding Requirement**

- The audit and homepage generation logic must be grounded in the principles of at least **two recognized books on Conversion Rate Optimization, UX, or persuasive design** (e.g., _Don't Make Me Think_ by Steve Krug, _Influence_ by Robert Cialdini, _Hooked_ by Nir Eyal, _Building a StoryBrand_ by Donald Miller, or equivalent works of your choice).
- The system must reference and apply the principles from these books when producing findings and solutions. Each finding should be traceable to a specific principle from the grounding material.
- How you load, structure, and pass this material to the LLM is your decision. We are evaluating your approach.

#### **External API Requirement**

- The system must integrate at least one external API beyond the LLM provider as part of the audit pipeline (e.g., PageSpeed Insights, Lighthouse, WebPageTest, accessibility scanning APIs, or any other relevant service).
- The output of this API must meaningfully inform the audit findings.

#### **Brand Extraction**

- From the scraped page, extract the site's brand identity:
  - Primary 3 brand colors (hex values)
  - Primary font family
  - Brand voice descriptors (tone, formality, characteristic phrases) as structured data
- Brand extraction should be deterministic - running the same URL twice should produce the same brand tokens

#### **Homepage Replication With Solutions Applied**

- Generate a single new homepage that:
  - Uses the extracted brand tokens (colors, font, voice)
  - Has the CRO solutions applied (improved headlines, clearer CTAs, restructured hierarchy, better trust signals - whatever the audit recommended)
  - Maintains the spirit and feel of the original site
- Render this as a viewable web page accessible from the dashboard

#### **History & Persistence**

- Each audit is saved to the logged-in user's account
- The dashboard shows a list of all past audits for that user (URL, date, status)
- Clicking any past audit opens the full results: the audit findings and the generated homepage

### **Technical Stack**

Your choice. Frontend, backend, database, authentication approach, LLM provider, deployment platform.

### **API Keys**

Use your own API keys during development. Read all keys from environment variables. Do not commit any keys to the repository.

### **Repository Requirements**

Create a new GitHub repository from the very first line of code. Commit regularly throughout development. A single end-of-project commit is a negative signal.

### **Scope**

Go as far as you reasonably can. Partial submissions with strong choices are evaluated fairly. If something is unfinished, leave a brief note in the README explaining what remains.

### **Deliverables**

- Live URL of the deployed application, with two test accounts pre-created (credentials shared in your submission)
- GitHub repository link with full commit history, private access shared with the email we provide

### **Not Required**

- Novel page layouts
- Pixel-perfect visual match
- Mobile responsiveness on the generated homepage
- Production-grade scale
- Complex user management (admin panels, password reset, email verification)

### **Evaluation**

- Architectural decisions
- Code organization and clarity
- Commit history
- Specificity and usefulness of audit findings
- How the grounding books are integrated, retrieved, and applied across findings
- Whether findings genuinely reflect multiple sources or collapse toward one
- Deterministic brand extraction
- External API integration quality
- Whether the generated homepage feels like the source site
- Whether CRO solutions are visibly applied in the generated homepage
- Persistence working correctly across sessions
- Thoughtful use of AI tools

A 30-minute live interview follows submission.

### **Questions**

Reply to the test invitation email. Response within 24 hours.
