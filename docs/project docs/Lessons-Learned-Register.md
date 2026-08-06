# Lessons Learned Register
### Social Listening & Engagement Platform — Phase 1: Social Listening / Insights Subsystem

**Author:** Menno
**Date:** 5 August 2026
**Status:** v1.0 — first entry
**Version:** 1.0
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

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-05 | Menno Drescher (AI Business & Requirements Analyst persona, drafting) | Initial version; first entry — backlog/scope growth pattern and the resulting WIP-limit decision |

---

*This document is maintained as part of the SocialEngage project's Project Management artifacts, alongside `Stakeholder-Register.md`. For questions or updates, contact Menno Drescher.*
