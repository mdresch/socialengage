# Lessons Learned Register
### Social Listening & Engagement Platform — Phase 1: Social Listening / Insights Subsystem

**Author:** Menno
**Date:** 5 August 2026 (updated 13 August 2026)
**Status:** v1.1 — second entry
**Version:** 1.1
**Framework referenced:** *PMBOK® Guide* (6th Edition), Process 4.4 "Manage Project Knowledge" (Project Integration Management knowledge area, Executing process group) — the process that originates the Lessons Learned Register as a project artifact, updated as an output across subsequent processes through project/phase closure. Verified directly (not assumed) before citing, per this project's own established precedent for framework citations (`Stakeholder-Register.md`'s corrected BABOK Task 3.2 citation).

---

## What this register is for, distinct from the Development Approach plan

This register holds the **narrative** — what happened, what pattern it revealed, what was learned — for a project event worth recording as a lesson. It does not hold governing rules or process mechanics; those live in `docs/project docs/Project Management Plans/Development-Approach-and-Life-Cycle-Plan.md`, per Menno's own explicit instruction that metrics/process rules and the lessons-learned narrative are two related but separate things and must not be conflated into one document. Where an entry here results in a durable rule, this register cross-references that rule's authoritative text rather than restating it.

**Convention:** append-only, the same discipline this project already applies to `docs/implementation-log.md`, `docs/management/manager-register.md`, `docs/adr/README.md`, and `Stakeholder-Register.md`. An entry here is never silently deleted or rewritten once logged — a correction gets a new, dated entry referencing the original, not an edit to it.

---

## Lessons Log (append-only, dated entries)

### 2026-08-05 — Backlog/scope growth outpacing build capacity, no stated ceiling until now

**What happened.** In one commit (`4701eff`, spanning 06:14–10:11 on 2026-08-05, immediately following Story 5.11's build-and-log the same morning), Menno — wearing the Product Owner / AI Business & Requirements Analyst hats — expanded the project's backlog substantially in a single sitting: 14 new user stories (epic-table totals rising from 42 to 56, a 33% increase), 3 new Proposed ADRs (ADR-0038 AI enrichment provider, ADR-0039 tenant offboarding lifecycle, ADR-0040 signup rate limiting), 3 new AI reviewer roles added to the stakeholder roster, a new commit-review pipeline, and unrelated Vercel infrastructure setup. All of it was planning/governance work — no `src/` code shipped in that commit. This landed while Phase 6 (Admin UI), this project's own stated current phase, still had Stories 6.2–6.7 drafted, Ready, and blocked on nothing but developer time (`CLAUDE.md`'s own Status line at the time).

This is summarized directly from the Ideal Manager's own Decision-Evaluator-mode review of that commit, not re-derived here — see `docs/management/manager-register.md`'s 2026-08-05 entry (`reviewed 4701eff`) for the full fourteen-section check. That review's verdict was **"proceed with adjustment,"** with three sections found at risk:

- **Scope & Expectations — at risk.** "The backlog grew 33% in one session with no stated WIP limit or backlog ceiling anywhere in the commit or surrounding docs." The Manager register itself notes this is legitimate Product Owner discretion, not a violation — but the gap was real, and it was the same gap `Business-Case-v6.0.md` §5 had already named in its financial form ("no formal budget ceiling has been set at this stage"), still open at the time.
- **Outcome Stewardship — at risk.** No explicit trade-off statement in the commit acknowledged that a governance/planning session was chosen over continuing Phase 6 build work — notable because this project's own documents are otherwise unusually good at stating trade-offs explicitly.
- **Protection & Boundaries — at risk, grounded in real data.** `git log` timestamps show commits at 00:51/01:03/01:10/01:13/02:32 on 2026-08-04, again at 21:57/21:59 the same evening, then 05:21/05:24/06:13/06:14/10:11 on 2026-08-05 — a late-night and early-morning work pattern across back-to-back days. Not a violation in itself on a solo, self-paced, self-funded project, but worth naming as a pattern now rather than waiting for it to produce a stall in the opposite direction (the 30-day-gap trigger already defined in `Project Management Plans/Uncertainty-Management-Plan.md` Appendix D's Assumption A-01).

**The pattern identified.** Backlog and scope growth outpacing actual build capacity, with no stated ceiling anywhere in this project's governance documents until this point — connecting directly to two gaps this project's own documents had already flagged as open, not newly discovered by this lesson:

- `Business-Case-v6.0.md` §5's own already-stated line: "no formal budget ceiling has been set at this stage" — a dollar-figure gap, still unresolved, that this lesson's resulting rule does not itself close.
- `Project-Charter.md` §6's Assumption A-01 — "Menno has sufficient available time outside other commitments (ADPA, RPAS-Governance work) to sustain solo development" — never numerically quantified, tracked in `Project Management Plans/Uncertainty-Management-Plan.md` Appendix D with a proxy trigger (a gap exceeding 30 days between consecutive Implementation Log entries) rather than an invented hours figure. The late-night/early-morning commit-timestamp pattern this same session surfaced is the first real signal in the *opposite* direction from that trigger — capacity being drawn down faster than sustainably, not stalling — and is worth tracking for the same underlying reason A-01's proxy trigger exists.

The combination — no stated WIP limit, plus a real (not estimated) after-hours work-timestamp pattern, landing in a session that grew the backlog 33% while the project's own stated current phase (Phase 6) sat untouched — is the concrete, evidence-backed version of the general risk `docs/project docs/Ideation-Document-v7.2.md` §7.2's R-02 already names in the abstract (scope creep vs. solo bandwidth), observed here within a single subsystem's own backlog rather than across subsystems.

**The resulting decision.** Menno set an explicit WIP limit on open governance work in response — a cap of 3 Proposed ADRs open for review at any one time (unstructured brainstorming exempt), with the story-count ceiling derived from whatever that batch of at most 3 open ADRs actually sources, not an independently fixed number. This directly answers the Manager review's own stated recommendation ("state an explicit backlog ceiling or WIP limit before drafting further stories/ADRs"). **The rule's authoritative text lives in `docs/project docs/Project Management Plans/Development-Approach-and-Life-Cycle-Plan.md` §3 (Decision Framework: Architecture Decision Records), dated addition of 2026-08-05 — not restated here.** This entry records the narrative and the pattern that produced it; that document records the governing rule itself.

**What this entry does not claim.** It does not claim the Manager review's other two "at risk" findings (Outcome Stewardship's implicit trade-off, and the Manager's own recommendation to prioritize Phase 6's already-Ready Stories 6.2–6.7 as next build priority) are resolved by this WIP-limit rule — they are not; the WIP limit addresses the Scope & Expectations finding specifically. Nor does it claim `Business-Case-v6.0.md` §5's dollar-budget-ceiling gap is closed — it remains open, unaffected by this decision.

**Resolves:** the Scope & Expectations finding in `docs/management/manager-register.md`'s 2026-08-05 entry (`reviewed 4701eff`), to the extent a stated WIP limit closes it.

---

### 2026-08-13 — Contract-passing components with no real call site: a blind spot invisible to every existing enforcement layer

**What happened.** During a methodology retrospective (Menno asked to review `implement-story`/`heal-contract-failure` for gaps, unprompted by any failure), a live re-verification of an unrelated question — "how far are we from M7?" — led to grepping `social-listening-core/src/ingestion` for `publishEvent()`'s real call sites, and finding none. `publishEvent()` (`src/events/serviceBusPublisher.ts`) had a fully passing contract (`ingestion-events`), but nothing in the real production ingestion path — no live scheduler tick, no real `ingestX()` function — ever actually called it. The component behaved correctly whenever exercised directly; it was simply never exercised by the running system.

None of this project's existing enforcement layers would have caught it: `enforce-contract-first.cjs` only checks that a contract *exists* before a `src/` write, not that it's wired to a real caller; the full accumulated contract suite passing proves every contract's own assertions hold, not that every contract's subject is reachable; Documentation Steward's traceability sweep checks `SKILL.md` claims against ADRs/Stories/the Implementation Log, not against a real call-site grep. It surfaced only from a hand-run grep, prompted by an unrelated business question — not from any process step this project had already built for the purpose.

**The pattern identified.** Contract-first TDD, as practiced here, verifies a component's behavior in isolation — it has no structural check that a contract-verified component is actually reachable from the real production call graph. A component can go from "built, contract-passing, `SKILL.md`-documented" to "silently orphaned" with every mechanical gate this project has still showing green. This is the same shape of gap as the entry above: a real, structural hole in the project's own process, invisible until direct inspection surfaced it — not a code defect in any one story, and not something any amount of care within a single story's own scope could have caught.

**The resulting decision.** A new "relationship assertion" convention: a story that gives a component a real call relationship with another component must back that relationship with a contract exercising it at the real production call site, not only the isolated function — and each component's `SKILL.md` "Relations to other components" section is the declared surface Documentation Steward now checks this against, going forward. **The rule's authoritative text lives in `docs/implementation-methodology.md`'s "Relationship assertions" note (Step 3) and its 2026-08-13 Amendment Log entry, `docs/templates/component-skill-template.md`'s new "Relations to other components" section, and `.claude/agents/documentation-steward.md`'s corresponding 2026-08-13 checklist addition — not restated here.** Two smaller, related process gaps found in the same retrospective were closed the same day: resuming a story a prior session left uncommitted (a real, recurring case given this project's own weekly usage-quota limits) is now explicitly folded into `heal-contract-failure`'s existing entry conditions rather than left an unstated assumption; and a story's build status now has its own dedicated, fixed-shape `**Built:**` field (`docs/user-stories/README.md`'s "Built convention"), separate from `Status` (ADR-readiness), closing a smaller drift already observed in Stories 5.18 and 6.7. A new cross-cutting index, `docs/environment-gotchas.md`, also consolidates recurring environment/tooling surprises that had previously lived scattered across individual `SKILL.md` files, discoverable only by touching that component again.

**What this entry does not claim.** It does not claim the `publishEvent()` gap itself is fixed — the live ingestion path still does not call it as of this entry; that remains a real, open code gap, not a documentation one, for a future story or healing pass. It does not claim the new relationship-assertion convention is retroactive — by explicit decision it is forward-only, so the ~30 existing `SKILL.md` files' relationship claims (including the one describing `publishEvent()`) are not swept for other instances of the same pattern. Another one may exist today, undiscovered.

**Resolves:** none — this entry originates the finding rather than resolving one already flagged elsewhere in this project's governance documents.

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-05 | Menno Drescher (AI Business & Requirements Analyst persona, drafting) | Initial version; first entry — backlog/scope growth pattern and the resulting WIP-limit decision |
| 1.1 | 2026-08-13 | Menno Drescher (session retrospective) | Second entry — the `publishEvent()` contract-passing/no-real-call-site blind spot and the resulting methodology amendments (relationship-assertion convention, `heal-contract-failure` resume fold-in, `**Built:**` field, `docs/environment-gotchas.md`) |

---

*This document is maintained as part of the SocialEngage project's Project Management artifacts, alongside `Stakeholder-Register.md`. For questions or updates, contact Menno Drescher.*

---

## Reusable Architectural & System Patterns (ADR-0122 / FDD-0122)

### 1. Same-Origin Route Proxy Pattern
- **Architecture Pattern Name**: Same-Origin Next.js Route Proxy Pattern
- **Applicable Domains**: `social-listening-admin` -> `social-listening-core` HTTP communication (`src/app/api/.../route.ts`).
- **Governing Decision**: `ADR-0036` (Amended per `ADR-0122`).
- **Anti-Patterns Prevented**:
  - Exposing Entra CIAM bearer tokens or session encryption secrets to browser JavaScript / `localStorage` (XSS vulnerability).
  - Ad-hoc CORS configuration on backend microservices.
- **Mechanism & Trade-offs**: Client components fetch `/api/...` on the same origin; the server-side route handler reads `{ sid }` from encrypted session cookies, injects `Authorization: Bearer <token>`, and calls `core-client.ts`. Incurs double-hop proxy latency in exchange for strict zero-token client exposure.
- **Evidence / Verified Commits**: `c643553` (Story 6.1), `443819e` (Story 6.2).

### 2. $O(1)$ Memory-Bounded Chunked Streaming Pattern
- **Architecture Pattern Name**: Proxy-Mediated Chunked Cursor Streaming
- **Applicable Domains**: Bulk data exports, Workspace JSON archives (`ADR-0074`), Posts CSV downloads (`ADR-0090`), Compliance Audit Packs (`ADR-0094`).
- **Governing Decision**: `ADR-0074`, `ADR-0090` (Amended per `ADR-0122`).
- **Anti-Patterns Prevented**:
  - Buffer allocation of entire multi-megabyte datasets into Node.js server heap memory ($O(N)$ memory exhaustion / Out-Of-Memory crashes).
  - Holding large unpaginated SQL query result arrays in application memory.
- **Mechanism & Trade-offs**: Postgres cursor queries stream chunks directly through `social-listening-core` into the Next.js `ReadableStream` pipe to the browser. Automatically propagates backpressure. Constrained by serverless timeout limits; multi-gigabyte exports delegate to asynchronous blob jobs (ADR-0111).
- **Evidence / Verified Commits**: `cf1f96c` (Story 6.40 export routes).

### 3. Ephemeral AI Analysis Lifecycle Pattern
- **Architecture Pattern Name**: Ephemeral Frontend AI Context Isolation
- **Applicable Domains**: Polypost Composer Deep Research (`ADR-0076`), Aspect Sentiment Explainability (`ADR-0113`), Topic Clustering Previews (`ADR-0104`).
- **Governing Decision**: `ADR-0076` (Amended per `ADR-0122`).
- **Anti-Patterns Prevented**:
  - Corrupting persistent post draft state (`localStorage`) with stale, hallucinations, or multi-turn LLM reasoning summaries.
  - Zombie background network requests on unmount.
- **Mechanism & Trade-offs**: AI research output lives strictly in ephemeral React component state. Panel close immediately releases memory; in-flight requests abort their `AbortController`.
- **Evidence / Verified Commits**: `64ac1f3` (Story 6.41 Deep Research panel UI).

### 4. Normalized Deterministic Request-Hash Caching & Provider-Agnostic Fallback
- **Architecture Pattern Name**: Canonical Hash Caching with Resilient Multi-Provider Fallback
- **Applicable Domains**: Composer Deep Research Caching (`ADR-0121`), Multi-Search Connectors (`ADR-0120`), AI Prompt Summaries (`ADR-0113`).
- **Governing Decision**: `ADR-0120`, `ADR-0121` (Amended per `ADR-0122`).
- **Anti-Patterns Prevented**:
  - Cache misses caused by semantically identical queries with cosmetic differences (differing case, extraneous whitespace, permuted provider lists).
  - Cross-tenant data leakage or cache poisoning in multi-tenant environments.
  - Complete failure of research pipelines when a single upstream search provider encounters rate limits or downtime.
- **Mechanism & Trade-offs**:
  - Deterministic pre-hash canonicalization: trims and lowercases query strings, collapses multi-spaces, and sorts provider IDs alphabetically prior to computing SHA-256 hash.
  - Multi-tenant RLS isolation: `research_cache` and `research_runs` tables enforce tenant boundaries via Postgres Row-Level Security, preventing cross-tenant cache hits or telemetry leakage.
  - Explicit cache bypass: Supports `?refresh=true` re-trigger capability to force a fresh execution while overwriting outdated cached records.
  - Provider fallback abstraction: `SearchProviderConnector` standardizes external search APIs behind unified capability probing and graceful fallback.
- **Evidence / Verified Commits**: `c903723` (Story 14.3 SearchProviderConnector abstraction), `d2bd779` (Story 14.4 Composer Deep Research caching, re-trigger, caps, and telemetry).
