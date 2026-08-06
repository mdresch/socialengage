# Product & Market-Fit Register

**Maintained by:** the Product & Market-Fit Reviewer role (Mistral — `docs/project docs/Stakeholder-Register.md` S-14), invoked via `docs/ai-roles/scripts/invoke-mistral-agent.cjs <file> --role product-market --register`. External, episodic, human-mediated — Menno runs the invocation and reviews/commits whatever gets appended here, the same as every other AI-role output in this project. This file is never edited by the reviewer's own hand outside that script; Menno may edit it directly at any time (e.g. to mark a finding Resolved, Accepted-as-a-trade-off, or otherwise dispositioned).

**Convention:** append-only, same discipline as `docs/implementation-log.md` and this project's other findings registers (`docs/security/security-register.md`, `docs/legal/legal-compliance-register.md`, `docs/privacy/data-sovereignty-register.md`, `docs/architecture/knowledge-graph-register.md`). A finding here is never silently deleted or rewritten once logged — a correction, disposition, or resolution gets a new dated note referencing the original entry, not an edit to it. This is what lets the register mean something over time.

**What belongs here, and what doesn't:** a finding that a decision, feature, or scope boundary is unlikely to be noticed, valued, or competitive with what an enterprise aggregator (Brandwatch, Meltwater) or a narrow SaaS tool already offers — per the charter's own `would-notice-neutral` / `would-notice-negatively` / `wouldnt-notice` / `insufficient-info` judgments, each carrying a `Possible solution` (added to the charter 2026-08-06). This register does not decide product direction on its own — a finding here is a triaged input for Menno's own call, the same relationship the Security Register has to an actual ADR or code change: named honestly, then acted on (or explicitly declined, with a reason) by the project owner, never auto-applied.

---

## Findings Log (append-only, dated entries)

*Empty — no review has been logged here yet. Each entry follows: `## YYYY-MM-DD — reviewed <material>`, then the reviewer's numbered findings in the charter's own Output Format (`Decision/Feature`, `Judgment`, `Reasoning`, `Competitor baseline`, `User-first risk`, `Possible solution`), then (added later, separately, by Menno or a follow-up review) a Disposition note when a finding is acted on, deferred with a stated reason, or accepted as a trade-off.*

## 2026-08-06 — reviewed stdin (e.g. git diff)

1. **Decision/Feature:** Admin UI (Stories 6.2–6.7) is effectively blocked on a missing `GET /v1/me` identity endpoint in `social-listening-core`  
   **Judgment:** would-notice-negatively  
   **Reasoning:** A real tenant experiences this as “I can log in, but I can’t do anything.” That’s an immediate time-to-first-value failure: auth exists, but the UI can’t reliably determine who the user is, what tenant they belong to, or what they’re allowed to do.  
   **Competitor baseline:** Brandwatch/Meltwater deliver a working “logged-in landing” (identity + permissions + default workspace) on day one; even narrow tools ship a minimal “account + workspace” identity endpoint to unblock UI gating.  
   **User-first risk:** The project has invested heavily in auth correctness and architecture, but without the basic “who am I?” contract the UI roadmap stalls and onboarding becomes a dead-end.  
   **Possible solution:** Implement `GET /v1/me` returning `{ user_id, email, tenant_id, tenant_name, roles/scopes }` plus a “current tenant” concept if multi-tenant-per-user is planned; then wire Story 6.2 role-gating to that response and make the post-login screen a functional tenant dashboard.

2. **Decision/Feature:** Self-service tenant sign-up backend shipped (Story 5.15), while Admin UI sign-up flow (Story 6.7) is not yet built  
   **Judgment:** would-notice-negatively  
   **Reasoning:** Self-serve signup only matters if it yields a usable workspace immediately; otherwise it’s “form submitted” with no product moment. Without a UI path that lands the new tenant into a working watchlist + ingestion experience, this is invisible value to actual prospects.  
   **Competitor baseline:** Competitors (and even lightweight SaaS) focus on “signup → connect sources / define query → first results” in one sitting; backend-only signup doesn’t differentiate.  
   **User-first risk:** Engineering completion signals “we shipped signup,” but user value is still blocked because there’s no guided workflow and no instant data payoff.  
   **Possible solution:** Build a single “Signup → Create first watchlist” wizard screen that (a) creates tenant, (b) creates a default watchlist with 1–3 keywords, (c) immediately runs one ingestion attempt and shows the first 10 posts.

3. **Decision/Feature:** Source coverage is still “RSS/News only” (GNews API + PR Newswire RSS); Reddit not started  
   **Judgment:** would-notice-negatively  
   **Reasoning:** Most buyers evaluating “social listening” expect social networks, not just news/press releases; news-only reads like a media-monitoring tool, and one that’s missing competitor-grade breadth. Users will notice the absence the moment they try to monitor brand chatter or community sentiment.  
   **Competitor baseline:** Brandwatch/Meltwater (and narrower tools) typically cover major social sources and/or provide broad content coverage plus prebuilt queries and dashboards; news-only is table-stakes for “monitoring,” not “social listening.”  
   **User-first risk:** The connector framework can become a self-referential milestone while the product still can’t answer the primary buyer question: “What are people saying on platforms that matter to me?”  
   **Possible solution:** Pick one “high-intent” social source and ship an end-to-end watchlist → ingestion → results flow for it (e.g., Reddit search + comments, or YouTube comments, or LinkedIn company mentions—choose one) with clear source labeling and basic dedupe.

4. **Decision/Feature:** Positioning implied by docs: “Phases 0–4.5 fully built and shipped,” yet “no user-facing feature beyond minimal Admin UI concept / scaffold”  
   **Judgment:** would-notice-negatively  
   **Reasoning:** Prospects don’t buy “shipped contracts passing”; they buy a workflow. If the product’s “shipped” status is primarily backend infrastructure, users will experience it as vapor until there’s a usable UI that produces insights without developer involvement.  
   **Competitor baseline:** Competitors lead with dashboards, alerts, saved searches, exports, and stakeholder-friendly reporting—visible outcomes, not internal completeness.  
   **User-first risk:** “Architecture-first done” can create a false sense of product readiness while core buyer evaluation (“can I answer questions quickly and share outputs?”) is unmet.  
   **Possible solution:** Define one demoable “thin slice” outcome (e.g., “daily alert email + dashboard of mentions for Watchlist X with sentiment + top sources”) and make every next story serve that outcome until it’s polished.

5. **Decision/Feature:** Adding Microsoft Foundry Prompt Agent as a second backend for the Product & Market-Fit Reviewer + wiring `--register` automation for review logs  
   **Judgment:** wouldnt-notice  
   **Reasoning:** Tenants never experience this; it’s internal governance/tooling. It may improve your iteration quality, but it does not create user-visible differentiation or reduce onboarding friction by itself.  
   **Competitor baseline:** none identified (this is internal process/tooling, not a market feature).  
   **User-first risk:** Time spent here competes directly with shipping the first usable end-user workflow (watchlist → results → alert/report).  
   **Possible solution:** none needed

6. **Decision/Feature:** Documentation emphasis on mandatory AI-assisted workflow (implement-story/heal-contract-failure), enforcement hooks, and expanded ADR/story counts  
   **Judgment:** wouldnt-notice  
   **Reasoning:** Users don’t care how code is produced; they care about speed to first value, coverage, usability, and reliability. This only matters insofar as it accelerates shipping the obvious “listening” workflows.  
   **Competitor baseline:** none identified (internal development methodology).  
   **User-first risk:** Process can become a substitute for user validation and shipping a compelling MVP experience.  
   **Possible solution:** none needed

---
