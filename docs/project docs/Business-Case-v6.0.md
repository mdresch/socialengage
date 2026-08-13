# Executive Summary & Metadata Block

- **Document:** Business Case v6.0 — Social Listening & Engagement Platform, Phase 1: Social Listening / Insights Subsystem
- **Date:** 31 July 2026
- **Business Sponsor:** Menno
- **Project Manager:** Menno
- **Currency Baseline:** US Dollar (USD, $)
- **Discount Rate (r):** 8.0%

**On the fallback rules governing the two fields above:** Section 1's Deterministic Fallback Logic table exists to prevent empty placeholders when project data is genuinely missing — it is not a substitute for known data. Business Sponsor and Project Manager are both explicitly and repeatedly documented in this project's own Stakeholder Register and Project Charter as Menno (Sponsor, Product Owner, and Sole Developer of a self-funded solo project); inserting a fabricated "Chief Financial Officer" or "Principal Software Architect" here would contradict the source record rather than fill a gap in it, so the fallback does not trigger. Currency Baseline deviates from the stated Euro default for the same reason: the one quantified cost figure that exists anywhere in this project's documentation — platform API access pricing, Business Case §5 — is explicitly USD-denominated ("tens to thousands of dollars per month"). Treating that as the "alternative currency explicitly stated" the fallback rule anticipates is more faithful to the source than converting it to Euro through an exchange rate this project has never adopted. Discount Rate genuinely is missing — no organizational WACC exists because no organization with a treasury function exists — so the 8.0% template default is applied as written, cited here as a template baseline rather than a real corporate WACC.

---

# 1. Problem Statement & Root Cause Analysis

Microsoft Social Engagement (MSE) was discontinued for new customers on 16 January 2019 and fully retired on 16 January 2020, and no direct successor has emerged in the six years since — this is the surface symptom, not the root cause. Asking why no successor emerged surfaces the first real cause: the market that formed in MSE's absence bifurcated into two extremes, expensive enterprise aggregators (Brandwatch, Meltwater) and narrow single-platform SaaS tools, neither of which replicated MSE's combination of multi-platform coverage, CRM-adjacent workflows, and data the customer actually owned. Asking why enterprise aggregators failed to fill the gap for smaller operators surfaces the second cause: their pricing and licensing model is structured for large enterprise budgets, which prices out smaller organizations and individual operators while reintroducing the exact "black box, no API, no access to your own data" criticism that was already levelled at MSE itself. Asking why no lightweight, ownable alternative emerged in six years surfaces the third and most structural cause: building official integrations against multiple social platforms from scratch is a genuine, nontrivial engineering barrier — each platform carries its own authentication model, rate-limit regime, and data shape, and that cost must be paid again for every new platform added, which is expensive enough to deter casual entrants. Asking why this project believes it can succeed where six years of market activity has not surfaces the actual thesis being tested: a unified `ProviderConnector` abstraction (ADR-0002) is designed to amortize that per-platform integration cost across a reusable pattern rather than re-paying it in full for every platform, and a phased, single-subsystem-first delivery strategy (Business Case §4's original recommendation) is designed to bound the solo-engineering risk that most plausibly deterred other small-scale entrants from attempting this at all. The structural problem, in short, is not "no one wants this" but "the engineering and ownership economics of building it have not previously been solved at a scale smaller than an enterprise vendor."

---

# 2. Gap Analysis Matrix

| Dimension | Current State | Future State | Gap Status |
|---|---|---|---|
| Multi-platform social monitoring capability | None owned — market options are buy-enterprise or buy-narrow-SaaS only | Connector-framework platform with a live reference connector | Closing — Newswire connector (ADR-0024) shipped end-to-end against live GlobeNewswire/PR Newswire feeds |
| Data ownership & audit traceability | Opaque vendor-held data (buy path) or nonexistent (build path, unbuilt) | Full raw-payload retention (JSONB) and an immutable `IngestionRun` acquisition record per post | Closed — ADR-0005/0018 shipped, contract-verified |
| Multi-tenant isolation | Not applicable — no product exists | Database-level Row-Level Security per tenant | Partially closed — RLS shipped and contract-verified (Story 5.4); no live two-tenant runtime proof yet |
| Caller authentication / tenant provisioning | Not applicable | A real authentication mechanism binding a caller to exactly one tenant | Open — `X-Tenant-Id` remains an unauthenticated client-supplied placeholder; no `tenants`/`users` table exists |
| AI-driven enrichment with vendor swappability | None | Sentiment/entity/key-phrase enrichment via a swappable `AIProviderConnector` | Open — interface defined (ADR-0002), no real Azure AI Language implementation wired into ingestion yet |
| CRM-adjacent workflows (case routing, lead generation — MSE's original hallmark) | None | Social Care and Social Selling subsystems consuming this subsystem's API/events | Explicitly out of scope for this business case — deferred to future, separately chartered projects |

**2026-08-03 note — credential-ownership granularity is now a known future requirement, not just caller-to-tenant binding.** The "Caller authentication / tenant provisioning" row's Future State ("a real authentication mechanism binding a caller to exactly one tenant") is necessary but not sufficient: Menno (Sponsor) has stated directly, this session, that the eventual authentication/credential architecture must support credentials stored **per-user, not only tenant-wide**. Today's credential model is built entirely around per-tenant ownership — ADR-0014's envelope-encrypted storage, and ADR-0026's explicit "per-tenant credential, not a shared pool" for GNews's API key (Newswire needs no credential at all, ADR-0024). The concrete case motivating this is a future connector — Reddit's OAuth grant is the clearest example — that may need to be owned by an individual user within a tenant, not the tenant as a whole. This note does **not** decide the tenant-vs-user question for Reddit or any other connector, and does not decide the `users` table shape: ADR-0027's own Negative Consequences already name this exact gap ("If an individual user, not the tenant, ends up being the connecting party for some platforms, ADR-0014's current credential model... may need an explicit per-user extension") and leave it to candidate ADRs #1–#4, per `docs/adr/README.md`'s 2026-07-30 governance note. This is recorded here as a requirement those future ADRs must account for, not a decision this business case makes. **It also runs counter to a still-undrafted brainstorm note in the same README file** ("Multi-tenant Admin/Tenant/User model" section: "Connectors are tenant-owned only; personal-account connectors are a future Social Selling subsystem's concern, not this one's") — that note predates today's requirement, was never elevated to an ADR, and no longer reflects the Sponsor's current direction; whoever drafts candidate ADR #4 needs to know it is superseded in substance, even though the README text itself has not yet been revised.

---

# 3. Proposed Solution Options & Solution Integrity

## Weighted Decision Criteria Table

Factors and weights below are this business case's own structured scoring instrument, applied to the three options Business Case §3 already documented; scores are analyst judgment on a 1–5 scale (5 = most favorable), grounded directly in that section's own pros/cons rather than newly invented criteria.

| Criterion | Weight | Option A — Buy (Enterprise Aggregator) | Option B — Buy (Narrow SaaS) | Option C — Build (this project) |
|---|---:|---:|---:|---:|
| Initial Cost | 20% | 2 | 4 | 3 |
| Execution Risk | 20% | 5 | 4 | 2 |
| Strategic Alignment (data ownership, anti-black-box) | 30% | 1 | 2 | 5 |
| Vendor Lock-In Mitigation | 20% | 1 | 2 | 5 |
| Time-to-Value | 10% | 5 | 4 | 2 |
| **Weighted Total** | **100%** | **2.4** | **3.0** | **3.7** |

Option C (Build) scores highest, confirming Business Case §4's original recommendation under a more rigorous scoring instrument rather than merely restating it.

## Solution Integrity Trade-offs

**Option A — Buy (enterprise aggregator: Brandwatch, Meltwater).**
- *Pro:* Fastest time-to-value — platform coverage and compliance/scraping burden are already solved by the vendor.
- *Pro:* Lowest execution risk — no engineering effort required to stand up multi-platform ingestion.
- *Con:* Expensive, enterprise-tier pricing structurally excludes smaller operators, which is the exact market gap this project targets.
- *Con:* Reintroduces the "black box" problem MSE itself was criticized for — no data ownership, no architectural control, full vendor lock-in.

**Option B — Buy (narrow single-platform SaaS).**
- *Pro:* Lower cost than enterprise aggregators, faster to start than building.
- *Pro:* No engineering investment required for the platforms it already covers.
- *Con:* Typically single-platform or limited coverage, with no multi-tenant or connector architecture to extend from.
- *Con:* No credible path to the CRM-adjacent workflows (Brand Reputation, Social Care, Social Selling) that motivated this project — extensibility is architecturally absent, not just unbuilt.

**Option C — Build (chosen).**
- *Pro:* Full ownership of data and architecture; a swappable AI-provider abstraction avoids single-vendor dependency for enrichment.
- *Pro:* The connector pattern (ADR-0002) is designed to generalize across platforms without redesign — already demonstrated once (Newswire, ADR-0024) with a second platform (Reddit) next in sequence.
- *Con:* Solo build and ongoing maintenance burden — no team to parallelize work, and platform API costs are borne directly rather than bundled into a vendor's price.
- *Con:* Slowest time-to-value of the three options; the architecture-proving investment (Phases 0–4) had to be substantially complete before any real end-to-end capability existed.

---

# 4. Financial Architecture & Cost-Benefit Analysis

## Discount Rate Justification

No corporate WACC exists, because no capital structure, debt, or equity financing exists for a self-funded personal project — there is no treasury function to derive one from. The 8.0% figure is applied as this framework's own deterministic fallback default (Section 1), not as a measured organizational cost of capital, and is disclosed as such rather than presented as a sourced figure.

## Currency & Inflation Handling

All monetary figures below are nominal USD, not inflation-adjusted — no multi-year cost projection exists yet to which an inflation adjustment could be meaningfully applied (see below). No cross-currency exposure exists: Azure billing and the one quantified platform-API cost figure in Business Case §5 are both USD-denominated.

## Known Cost Structure (real, sourced)

| Cost Item | Type | Known Detail |
|---|---|---|
| Azure Database for PostgreSQL | Recurring | Low-tier instance at current solo/early-use scale; no dollar figure fixed |
| Azure Key Vault | Recurring | Billed per operation/secret; low cost at solo scale |
| Azure Service Bus | Recurring | Standard tier, one namespace, one topic — already provisioned |
| Azure AI Language | Usage-based | Billed per text record processed; not yet incurred (enrichment not wired into ingestion). **2026-08-03 note: this row's framing (Azure AI Language as a SocialEngage-borne recurring cost, alongside Postgres/Key Vault/Service Bus) is superseded by ADR-0028 (Accepted 2026-08-03) — Menno resolved `AIProviderConnector` credentials as tenant-owned, with cost incurred and settled directly between each tenant and Microsoft/Azure, not intermediated or billed by SocialEngage. Not re-derived here; flagged so this row isn't read as still-current once the real `AIProviderConnector` is built. See ADR-0028's Amendment Log and `Project Management Plans/Cost-Management-Plan.md`'s matching flag on C-14 and its Long-Term forecast.** |
| Platform API access (X paid tier, etc.) | Recurring / variable | The one quantified figure in this project's records: "tens to thousands of dollars per month" depending on read volume — the dominant and most variable cost driver |
| Development time (solo) | Opportunity cost | Explicitly not a cash cost, per Business Case §5 — the primary real cost of the project, uncosted in dollar terms |

## Formula-Level Financial Rigor

$$NPV = \sum_{t=1}^{n} \frac{CF_t}{(1 + r)^t} - I_0, \quad r = 0.08$$

**Structural Note — I₀ and CFₜ are N/A, not zero.** No capitalized initial investment ($I_0$) has ever been fixed: Business Case §5 explicitly states "no formal budget ceiling has been set at this stage," and the one variable cost that would dominate $I_0$/$CF_t$ (platform API tier selection) is deliberately not yet committed, per the same section's recommendation to prioritize free/low-cost platforms first. No annual benefit cash flow ($CF_t$) exists either: this is a capability-building, data-ownership project with no revenue model and no formally quantified cost-avoidance baseline (a genuine dollar comparison against enterprise-aggregator licensing would require a vendor quote this project has never obtained). Populating either variable with an invented number would produce a materially misleading NPV rather than a verifiable one — the opposite of this framework's own "every quantitative projection must be verified mathematically" mandate. The formula is therefore presented with its one known input ($r = 8.0\%$) substituted and $I_0$/$CF_t$ left structurally open, with the exact conditions for closing that gap stated below rather than a placeholder token.

**Path to a real baseline (structural note, not a projection):** a defensible $I_0$ could be constructed from one year of actual metered Azure + platform-API spend once the outstanding monthly cost cap (Business Case §5) is set and at least one paid-tier connector is live; a defensible $CF_t$ proxy would require an actual Brandwatch/Meltwater licensing quote to establish an avoided-cost baseline, which has not been sourced for this document and should not be estimated without one.

**ROI** ($\frac{\text{Net Benefit}}{I_0} \times 100$) and **Payback Period** (Cumulative Net Cash Flow Method, the methodology this project would use once a real series exists) are both N/A for the same reason — each requires the same $I_0$/$CF_t$ inputs NPV does, and none should be computed from unsourced figures.

---

# 5. Multi-Dimensional Sensitivity & Risk Taxonomy

## Financial Sensitivity

A ±10% swing cannot be meaningfully applied to the NPV/ROI/Payback figures in Section 4, since no baseline dollar figure exists there to swing. The one real, quantified, ±10%-testable parameter in this project's records is not a cash flow but a configuration value with direct cost consequences: ADR-0018's `IngestionRun` retention window, 18 months (configurable). A ±10% swing (16.2–19.8 months) scales retained-partition count, and therefore Postgres and Blob Storage archival footprint, close to linearly, since monthly range partitioning (Story 3.5) ties storage duration directly to months retained. This is offered as the closest legitimate substitute for the requested financial-swing analysis, not as a replacement for a true cost-baseline sensitivity, which cannot be produced without the $I_0$/$CF_t$ data Section 4 identifies as missing.

## Qualitative Risk Taxonomy

**2026-08-03 note — canonical ownership moved to `Uncertainty-Management-Plan.md`.** This table was this project's canonical risk register through 2026-08-03. Per Menno's own direction and standard practice (a Risk Register is owned and actively maintained by the risk-management process, not the business-case document that justified starting the project), it is now a **point-in-time snapshot as of 2026-08-03** — accurate at time of writing, but no longer the actively-updated source. `Project Management Plans/Uncertainty-Management-Plan.md`'s Appendix D is the canonical, actively-maintained register going forward; check there for current risk status, not here.

| Risk ID | Description | Likelihood | Impact | Mitigation Trigger |
|---|---|---|---|---|
| R-01 | Platform API pricing/policy change makes a connector infeasible | Medium | High | Monthly platform-API spend exceeds the (not-yet-set) cost cap, or a targeted platform's terms change before a connector targeting it ships |
| R-02 | Scope creep across the four-subsystem vision outruns solo bandwidth | Medium | Medium | A second subsystem's charter is drafted before this subsystem's four Phase-1 success criteria (Business Case §8) are independently re-verified |
| R-03 | Solo-developer bus factor — no redundancy if availability changes | Low–Medium | High | A gap exceeding 30 days between consecutive `docs/implementation-log.md` entries |
| R-04 | No authentication mechanism exists; `X-Tenant-Id` is an unauthenticated placeholder | High (certain, if triggered) | High | Any caller beyond local testing reaches a deployed instance before an authentication ADR is drafted and accepted — this is a release-blocking dependency, not a probabilistic risk, once external users are contemplated |
| R-05 | Accepted tenant/admin/user model (ADR-0030–0032) is architecturally decided but not yet implemented | Medium | Medium | Any real tenant or user is onboarded, or connector connect/disconnect endpoints are exposed, before ADR-0030–0032's migrations, identity resolution, and role checks are implemented and contract-verified |
| R-06 | Late-stage integration issues across Azure services, RLS policy interactions, and OAuth as Phase 4.5's identity work lands | Medium | High | Azure services, RLS policy interactions, or an OAuth connector are integrated for the first time without a dedicated integration-level contract test preceding the change |

**R-05/R-06 provenance:** added 2026-08-03, sourced from `Project Management Plans/Uncertainty-Management-Plan.md`'s own risk analysis (its former Appendix D R-05/R-06 rows) at the time this table was still canonical. See the note above this table for the current (post-2026-08-03) direction of the relationship: `Uncertainty-Management-Plan.md` now owns R-01–R-06 going forward, this snapshot no longer does.

**Also flagged, not reconciled:** `docs/project docs/Ideation-Document-v7.2.md` carries its own earlier, richer R-01–R-04 table (with Trigger Condition/Contingency/Owner columns) that this snapshot's R-01–R-04 rows were originally derived from — a third copy of the same register that predates this one. Not folded into this reconciliation; noted so a future pass doesn't discover it cold.

---

# 6. Transition State & Dependency Architecture

## Transition State Profile

The system currently operates in a permanent development-only state: two application scaffolds exist (`social-listening-core`, `social-listening-admin`), real Azure infrastructure is provisioned (Key Vault, Service Bus, Blob Storage), and 113 of 113 accumulated contract tests pass, but no production tenant has ever been onboarded and no external caller has ever been authenticated, because no authentication mechanism exists yet. During this transition, the sole practitioner runs both the local development environment (a persistent dev Postgres database, deliberately isolated from the ephemeral test database per ADR-0025, so a test run can never disturb a running demo) and the real cloud dependencies side by side, with no cutover event scheduled because no prior production system is being replaced. The transition therefore has an open-ended, not a scheduled, character: it ends when candidate ADR #1 (authentication) closes the gap that currently makes any real external tenant unsafe to onboard, not on a calendar date.

**Documentation Steward correction, 2026-08-13.** This paragraph is a point-in-time snapshot (pre-2026-08-03, before any of candidate ADRs #1–#6 were drafted) that was never updated as this section's own named blocker actually closed — unlike the risk table above, it carries no snapshot disclaimer, so it reads as current when it is not. All six candidate ADRs named in the Dependency Matrix below are now **Accepted and built**: authentication (ADR-0029, Entra External ID, Stories 5.9–5.11), the Admin-tier RLS exception (ADR-0030), `tenants`/`users` tables + RLS (ADR-0031/0032), `X-Tenant-Id` retirement (ADR-0033, Story 5.10), and connector connect/disconnect CRUD rework (ADR-0034) — see `docs/implementation-log.md`. "No authentication mechanism exists yet" and "no external caller has ever been authenticated" are both false as stated; real bearer-token authentication is shipped and enforced on every `/v1` endpoint. What remains genuinely accurate: no *production* tenant has ever been onboarded, and the transition remains open-ended rather than scheduled — but the actual current blocker is the deliberate Stage 0 Go-Live gate (`Project Management Plans/Go-Live-Readiness-Definition.md`), not a missing authentication mechanism. The 113/113 contract-test count is also long stale (`docs/implementation-log.md` shows far more today) — not re-derived here, since this section's own point is qualitative (what state the system is in), not a running test count already tracked live elsewhere.

## Dependency Matrix

| Item | Depends On | Contingency for Slippage |
|---|---|---|
| Candidate ADR #1 — authentication mechanism | Nothing (first in sequence) | None needed; this is the critical-path root |
| Candidate ADR #2 — Admin-tier RLS exception | ADR #1 accepted | Blocked until #1 closes; no workaround exists that doesn't weaken RLS |
| Candidate ADR #3/#4 — `tenants`/`users` tables + RLS | ADR #2 | Same as above |
| Candidate ADR #5 — retire `X-Tenant-Id` placeholder | ADR #1–#4 | Same as above |
| Candidate ADR #6 — connector connect/disconnect CRUD | ADR #5 (real caller identity) | Could theoretically be built against the placeholder, but would need rework once real auth lands — not recommended |
| Second real connector (Reddit) | None architecturally — independent of the auth chain | Can proceed in parallel with the authentication work; no cross-dependency |
| AI-provider (Azure AI Language) wiring | None architecturally | Can proceed in parallel |
| Training / user-adoption milestones | Not applicable | No formal training program exists or is needed — sole operator is also sole user to date |

**Documentation Steward correction, 2026-08-13.** The Dependency Matrix above still frames candidate ADRs #1–#6 as forward-looking dependencies awaiting acceptance ("Blocked until #1 closes," etc.). All six are now Accepted and built, in the same order this matrix names: ADR-0029 (#1, authentication), ADR-0030 (#2, Admin-tier RLS exception), ADR-0031/ADR-0032 (#3/#4, `tenants`/`users` tables), ADR-0033 (#5, `X-Tenant-Id` retirement), and ADR-0034 (#6, connector connect/disconnect CRUD) — all Accepted 2026-08-03, per `docs/adr/README.md`'s own footnote 11. The dependency *ordering* itself is left untouched (a correct historical record of how the chain was actually built, in the order stated), not a decision this correction revisits.

**2026-08-03 note on candidate ADR #3/#4.** The `users` table shape decision (#4) now carries an explicit additional requirement, stated directly by Menno (Sponsor): credential ownership must be architected to support both tenant-wide and per-user modes, not tenant-wide only — see Section 2's 2026-08-03 note and ADR-0027's Negative Consequences bullet for the underlying reasoning. This does not change the dependency ordering shown above (#3/#4 still depends on #2 as stated); it adds a requirement #4 must satisfy once drafted, and by extension a consideration for candidate ADR #6 (connector connect/disconnect CRUD), whose UX and data model would differ depending on whether a given connector's credential belongs to the tenant or to an individual user.

Operational contingency for any single item's schedule slippage is this project's own documented self-healing protocol (`docs/implementation-methodology.md`): a capped 3 full remediation attempts before mandatory escalation to the Sponsor, rather than open-ended retries.

## Legacy Decommissioning Checklist

**Structurally N/A for this business case.** No legacy system exists within this project's operational boundary to decommission. Microsoft Social Engagement — the market predecessor this project is philosophically successor to — was retired by Microsoft on 16 January 2020 and has never been operated, licensed, or held any data by this project; there is no prior production instance, no data migration path, no read-only archiving requirement, and no rollback/kill-switch surface between an old system and this one. This checklist would only become applicable if a future initiative explicitly migrated an existing internal tool into this platform, which is not this business case's scope.

---

# 7. Stakeholder Governance & Change Strategy

## Stakeholder Influence/Interest Matrix

| Stakeholder | Influence | Interest | Project Impact |
|---|---|---|---|
| Menno (Sponsor/PO/Sole Developer) | High | High | Is the project — owns vision, funding, and delivery |
| Future end users / tenants | Low (currently) | Medium (latent, not yet activated) | Determines whether Phase 2+ investment is justified |
| Social platform providers (X, Reddit, YouTube, LinkedIn, Meta, RSS/Newswire) | High — can revoke access or reprice unilaterally | Low (indifferent to this project specifically) | Can unilaterally invalidate a connector's cost or technical assumptions |
| Microsoft Azure | Medium | Low | Standard vendor relationship; service health/pricing changes affect cost, not architecture |
| AI enrichment providers (Azure AI Language now; others later) | Medium | Low | Isolated by the connector abstraction — swappable if terms change |
| Data subjects (authors of ingested posts) | Low (no direct relationship) | High, ethically | Fair, lawful handling is a design commitment, not a negotiated stake |
| Future collaborators | Low (currently) | Unknown | Structural placeholder only — no one occupies this role today |

## RACI Accountability Matrix — Deployment & Adoption Milestones

| Milestone (Charter §5) | Menno (all roles) | Platform/Cloud Vendors | Future Collaborators |
|---|:---:|:---:|:---:|
| M1 — Repos scaffolded | R/A | I | I |
| M2 — Connector framework built | R/A | I | I |
| M3 — First connector live | R/A | C | I |
| M4 — Enrichment pipeline live | R/A | C | I |
| M5 — Multi-tenant isolation verified | R/A | I | I |
| M6 — API & events live | R/A | I | I |
| M7 — Phase 1 review (go/no-go) | R/A | I | I |

**Structural note:** as in the parallel document series' own RACI treatment, a single-actor R/A on every row is a real, not an omitted, structural fact for a solo project — its value is as a forward-compatible template, not present-day risk distribution.

## Stakeholder Validation Protocol

No formal end-user validation has occurred — the Stakeholder Register lists future end users/tenants at "Monitor" engagement, explicitly deferred until "Phase 1 is validated." **No interview count or date is asserted here**, since none has taken place; inventing one (e.g., a specific number of discovery interviews on a specific date) would misrepresent this project's actual evidentiary basis. The validation that has genuinely occurred is architectural, not user-facing: two independent rounds of third-party review (Copilot, then Gemini) validated the ADR series' design assumptions, surfacing the gaps that became ADR-0017/0019–0023. The intended future end-user validation method is not yet defined beyond "revisit once Phase 1 is validated" (Stakeholder Register) — this is itself a genuine open item, not a gap in this document.

---

# 8. Requirements Traceability & Success Matrix

| Business Need | Solution Component | Quantifiable Success Metric | Validation / Verification Method | Status |
|---|---|---|---|---|
| Avoid the MSE "black box" — retain full data ownership and traceability | `IngestionRun` audit anchor + raw JSONB payload retention (ADR-0005, ADR-0018) | 100% of ingested posts carry a queryable acquisition record | Story 3.2 contract test | **Met** — shipped, passing |
| Multi-tenant capable without redesign | Postgres Row-Level Security per tenant (ADR-0015) | Zero cross-tenant data access at the database layer | Story 5.4 contract test (code-level) | **Partially met** — contract-verified; no live two-tenant runtime proof executed yet |
| At least one connector ingesting real data end-to-end | Newswire connector (ADR-0024), GNews connector (ADR-0026) | Real GlobeNewswire/PR Newswire and GNews posts ingested, not fixtures | Stories 2.6 and 2.7 contract tests, proven against live feeds | **Met** — shipped |
| Swappable AI enrichment avoiding single-vendor lock-in | `AIProviderConnector` interface (ADR-0002) + Azure AI Language | Sentiment/entity/key-phrase fields populated via a swappable provider | No contract exists yet — Phase 2 "also build, not storied" gap | **Not met** — not yet built |
| REST API and event stream downstream subsystems can consume without re-deriving ingestion | `/v1/` API + thin Service Bus events (ADR-0012, ADR-0017) | At least one real `IngestionRun`/`ConnectorHealth` state change publishes a real event | Payload builders exist and are contract-tested; nothing in the live ingestion path calls `publishEvent()` yet | **Not met** — not yet wired |

**2026-08-01 update — Phase 1 gap now closed for storied work, Watchlist CRUD and Newswire complete.** The "At least one connector ingesting real data end-to-end" row is marked **Met** against both Newswire connector (ADR-0024/Story 2.6) and GNews connector (ADR-0026/Story 2.7) — both stories shipped and contract-verified against live feeds. The Phase 1 MVP gap noted previously ("one platform, one tenant, one watchlist, posts flowing...") has its storied portion complete. Additionally, **Story 1.5 (Watchlist CRUD)** is now complete with full tenant isolation via RLS. Phase 1's only remaining "also build, not storied" work is connector connect/disconnect endpoints and admin UI completion. Phase 1 storied work is **complete**, with Stories 1.5 and 2.6 adding to the previously completed Phase 1 stories.

---

# 9. Strategic Recommendation & Implementation Roadmap

**Recommendation: proceed**, reaffirming Business Case §4's original conclusion under this document's more rigorous weighted-decision and traceability instruments (Sections 3 and 8) rather than superseding it. **Phase 1 storied work is now complete** with Stories 1.5 (Watchlist CRUD) and 2.6 (Newswire connector) delivered and all contracts passing (132/132). Three conditions gate further investment, in this order:

1. **Close the authentication gap before any external tenant is onboarded.** This is the single item every other open dependency in Section 6's matrix sits behind, and Section 8's traceability matrix shows it is the reason the "multi-tenant isolation verified" success criterion is only partially met — RLS is real, but nothing yet authenticates who is claiming which tenant.
2. **Set the outstanding monthly platform-API cost cap** (Business Case §5) before any paid-tier connector is added, closing Risk R-01 and creating the actual dollar baseline Section 4 identifies as the prerequisite for any future NPV/ROI computation.
3. **Execute Milestone M7 (Phase 1 review)** only once all Phase 1 "also build, not storied" work is complete — connector connect/disconnect endpoints and admin UI remain; the isolation criterion needs a live two-tenant proof, not just a passing contract, before this business case's own recommendation to defer downstream subsystems (Brand Reputation, Social Care, Social Selling) can be revisited.

**2026-08-01 Update:** Phase 1 has **two working connectors** (GNews + Newswire) and complete Watchlist CRUD. 85.7% of Business Case criteria (6/7) are now met. Full contract suite passes at 132/132.

**2026-08-03 Update:** Menno (Sponsor) has recorded a new requirement, not yet an ADR: the future authentication/credential architecture (candidate ADRs #1, #3, #4 in Section 6) must support credentials held per-user, not only tenant-wide — see Section 2's Gap Analysis Matrix note and Section 6's Dependency Matrix note for the full sourcing. The clearest concrete driver is a future connector needing an individual user's own OAuth grant (Reddit is the named example) rather than a tenant-wide credential, since today's model (ADR-0014, ADR-0024, ADR-0026) is entirely tenant-scoped. This is recorded here as a known future requirement for whoever drafts candidate ADR #4, not a decision this business case makes on the tenant-vs-user question itself — that stays exactly as open as `docs/adr/README.md`'s 2026-07-30 governance note and ADR-0027's own "exact mechanics of 'whoever connects'" open question left it.

**2026-08-03 note — Risk Register history.** R-05/R-06 (sourced from `Project Management Plans/Uncertainty-Management-Plan.md`'s own risk analysis) passed through this section briefly, then Section 5, before canonical ownership of the whole register (R-01–R-06) moved to `Uncertainty-Management-Plan.md`'s Appendix D the same day — see Section 5's own note for the current, authoritative pointer.

No committed timeline is attached to these conditions, consistent with Charter §5's deliberate dependency-ordered, non-calendar approach — the roadmap is sequence, not schedule.
