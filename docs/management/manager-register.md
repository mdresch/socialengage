# Manager Register

**Maintained by:** the Ideal Manager role (Claude Code, internal, Governed — `docs/project docs/Stakeholder-Register.md` S-20), per `.claude/agents/ideal-manager.md`. Fed by `docs/management/pending-manager-reviews.md`, which `scripts/git-hooks/post-commit` appends to automatically on every commit — non-blocking, no API call, just a queue marker. This role has no standalone invocation script (unlike the external reviewers): it runs only when a Claude Code session is actively working in this repo and checks the pending-review queue, per its own charter's instruction. Menno may edit this file directly at any time (e.g. to mark a finding Resolved); the agent itself only ever appends.

**Convention:** append-only, same discipline as `docs/implementation-log.md` and every other register in this project (`docs/security/`, `docs/legal/`, `docs/privacy/`, `docs/architecture/`). A finding here is never silently deleted or rewritten once logged — a correction or resolution gets a new dated note referencing the original entry, not an edit to it.

**What this register is for, distinct from the other four:** the other registers (Security, Legal, Data Sovereignty, Knowledge-Graph) each pull hard on one domain and argue for closing gaps in it. The Manager doesn't argue one lens — per its own charter, it synthesizes across all fourteen sections of the Ideal Manager framework (capacity, scope, decision rights, outcome stewardship, etc.) and returns an advisory verdict. Entries here are commit-level reviews: is the pace, scope, and sequencing of what's landing in this repo sustainable, not whether any single change is correct — that's every other reviewer's job, not this one's.

---

## Findings Log (append-only, dated entries)

*Empty — no review has been logged here yet. Each entry follows: `## YYYY-MM-DD — reviewed <commit hash(es)> — <one-line summary>`, then the Manager's finding (Advisor-mode read or Decision-Evaluator-mode verdict, per its own charter's output format), then a cross-reference to the corresponding entry in `docs/management/pending-manager-reviews.md` that it resolves.*

## 2026-08-05 — reviewed 4701eff — Decision Evaluator: governance/backlog-expansion session (3 ADRs, 14 stories, 3 new AI roles, commit-review pipeline) lands same morning as Story 5.11, Phase 6 (6.2-6.7) untouched

**Decision as understood.** In one commit (`4701eff`, 06:14-10:11 on 2026-08-05, immediately following Story 5.11's build-and-log at 06:13-06:14 the same morning), Menno — wearing the Product Owner / AI Business & Requirements Analyst hats — expanded the backlog by 14 new stories (epic-table totals rising from 42 to 56, +33% in one sitting: `docs/user-stories/README.md`), drafted 3 new Proposed ADRs (0038 AI enrichment provider, 0039 tenant offboarding lifecycle, 0040 signup rate limiting: `docs/adr/README.md`), added 3 new AI reviewer roles to the stakeholder roster (S-22-S-24: Legal & Compliance, Data Sovereignty & Privacy Regulation, Knowledge-Graph & Semantic Data Modeling — `docs/project docs/Stakeholder-Register.md` v2.7), stood up the commit-review pipeline this very entry is running through, and did unrelated infra setup (Vercel `ignoreCommand` scoping). All of it is planning/governance work — zero `src/` code shipped. This landed while Phase 6 (Admin UI), this project's own stated current phase, still has Stories 6.2-6.7 drafted, Ready, and blocked on nothing but developer time (`CLAUDE.md`'s own Status line).

**Fourteen-section check.**

- **Scope & Expectations — at risk.** Sec 2's own standard ("set a stated ceiling even when more work exists") isn't met: the backlog grew 33% in one session with no stated WIP limit or backlog ceiling anywhere in the commit or surrounding docs. This is legitimate PO discretion (Sec 1: "a full backlog is a resource, not an obligation"), but the gap is real, not hypothetical — it's the same gap Business Case §5 already names ("no formal budget ceiling has been set at this stage"), still open.
- **Outcome Stewardship — at risk.** No explicit trade-off statement anywhere in this commit acknowledges that a governance/planning session was chosen over continuing Phase 6 build work — unusual for a project whose own docs are otherwise unusually good at stating trade-offs explicitly (e.g. this same commit's own `docs/implementation-plan.md` phase-placement reasoning for all 14 new stories). Sec 8's "make capacity trade-offs explicit rather than silently absorbing" isn't violated maliciously, just left implicit here.
- **Protection & Boundaries — at risk, real signal.** `git log` timestamps show commits at 00:51/01:03/01:10/01:13/02:32 on 2026-08-04, again at 21:57/21:59 the same evening, then 05:21/05:24/06:13/06:14/10:11 on 2026-08-05 — late-night and early-morning work across back-to-back days. Grounded in real git data, not vibes, per this charter's own instruction. Not a violation by itself (solo, self-paced, self-funded), but Sec 4's "model stopping — don't normalize constant availability" is worth naming now, while it's a pattern, rather than waiting for Ideation-Document-v7.2.md §7.2's R-03 (30-day-gap stall trigger) to be the first signal in the opposite direction.
- **Team-Level Optimization — satisfied.** The 3 new AI roles are gap-driven, not proliferation for its own sake: Legal & Compliance and Data Sovereignty/Privacy map directly onto real content in this same commit (ADR-0039's export/deletion obligations, ADR-0038's third-party LLM data handling); Knowledge-Graph maps onto the pre-existing `docs/architecture/knowledge-graph-register.md` gap. Per this charter's own boundary, no burnout/wellbeing framing applied to any of the three — not applicable regardless.
- **Strategic Direction — mixed.** Positive: phase placement for all 14 new stories is reasoned against named gaps, not assigned by epic number (`docs/implementation-plan.md`'s own "which named gap does this close" practice, upheld again). At risk: none of this session's work advances the stated current phase (Phase 6), and Sec 13's "actively remove low-value work" has no counterpart here — nothing was descoped to make room for 14 additions.
- **Learning from Failure / Communication & Feedback — satisfied, worth naming as a strength.** The commit's self-documentation catches and corrects its own errors transparently: the "16 vs. 14 stories actually specified" discrepancy in Menno's own framing text, the Epic 6 numbering gap (his "6.11" silently corrected to the next real sequential number, "6.10"), and the earlier honest reversal on the Ollama/Azure reviewer-provider reassignment mid-draft. This is exactly the blameless, system-before-blame documentation discipline this framework asks for.
- **Capacity & Workload, Growth & Development, Communication & Feedback (routine check-ins), Decision Rights & Autonomy, Recognition & Reward, Alignment & Conflict, Performance Accountability, Organizational Influence** — not implicated by this specific commit; no findings either way.

**Observable signals used.** `git log` commit timestamps (real, not estimated); `docs/user-stories/README.md`'s own epic-table story counts (42 to 56); `docs/adr/README.md`'s Proposed-ADR count (0 to 3, pre-existing baseline per prior register note); Business Case §5 and Charter Assumption A-01 (already-flagged, unquantified gaps per this charter's own pointer, not newly discovered here); `docs/project docs/Ideation-Document-v7.2.md` §7.2 R-02 (scope creep vs. solo bandwidth — its literal trigger, a second subsystem's charter, wasn't hit, but the same underlying dynamic is visible within this one subsystem's own backlog) and R-03 (30-day stall trigger — nowhere close; cadence is if anything the opposite problem right now).

**Priority order.** No section here reaches a safety/legal/strategic veto; the team-sustainability concerns raised (Protection & Boundaries, Scope & Expectations, Outcome Stewardship) are real but don't override a solo operator's own discretionary planning choice on a self-funded project with no external delivery commitment being missed.

**Verdict: proceed with adjustment.** Nothing here needs undoing — the commit is well-documented and the new AI roles are gap-driven, not creep. The adjustment is forward-looking, for the next decision rather than this one: state an explicit backlog ceiling or WIP limit before drafting further stories/ADRs (closing Business Case §5's own already-flagged gap, even informally, not to project-management-plan formality); treat Phase 6's already-Ready Stories 6.2-6.7 as the next build priority rather than letting backlog expansion keep outpacing them; and note the late-night/early-morning commit pattern now, per Sec 4, rather than only after it produces a stall.

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-05 -- `4701eff` entry.

## 2026-08-06 — reviewed 443819e/67430b7/57926be/99caf05/54f7ee7 — Decision Evaluator: Phase 6 UI batch (Stories 6.2-6.5) built in a parallel session same day as the 14-story governance batch, plus its own traceability catch-up

**Decision as understood.** In a second Claude Code session running in parallel with the 14-story/3-ADR governance batch reviewed under `4701eff` (2026-08-05, 11:03-11:14), Menno built four Next.js admin-UI screens back-to-back — Story 6.2 (role-gated routing shell), 6.3 (connector connect/disconnect), 6.4 (watchlist management), 6.5 (connector status view) — then, separately at 12:21, committed a traceability catch-up (`54f7ee7`) that self-names a real process gap: the four Implementation Log entries and Status-line updates existed in the working tree but were never committed alongside the work, `implement-story`'s own Step 8/9 skipped at the time in that parallel session.

**Fourteen-section check.**

- **Capacity & Workload — worth naming, not a violation.** Two Claude Code sessions running concurrently (this UI batch, and the governance/ADR-drafting batch) is a real throughput choice available to a solo operator directing AI agents, not overload in the human sense — but it is the mechanism that produced the `54f7ee7` gap: a parallel session has no way to see or coordinate with `implement-story`'s own log-and-status step the way a single serial session would. Worth a standing note (not a rule change) that parallel sessions carry a real, demonstrated traceability-coordination cost.
- **Learning from Failure — satisfied, a real strength.** `54f7ee7` names the gap plainly ("A real process gap, named rather than smoothed over") rather than silently backfilling the log as if nothing had happened, and closes it same-day rather than letting it accumulate.
- **Outcome Stewardship / Strategic Direction — at risk, a concrete finding, not a process nitpick.** All four screens render hardcoded fixture data (connector lists, watchlist lists, connector-status rows are literal in-file arrays, confirmed directly against `social-listening-admin/src/app/tenant/**/page.tsx`), and Story 6.2's own role-gating logic has a real, live defect: `getRoleShell()` (`social-listening-admin/src/lib/role-routing.ts`) switches on `identity.role`, but `GET /v1/me`'s actual response shape for a Platform Admin (`social-listening-core/src/identity/identityResolution.ts`'s `ResolvedIdentity` type) is `{ type: 'platform_admin', adminId }` — no `role` field at all. A real signed-in Platform Admin hitting this code today would silently fall through to the `default: return 'tenant'` case and be routed into the tenant shell, not the platform-admin shell — the exact failure mode Story 6.2's own acceptance framing ("a Platform Admin session never renders tenant content") exists to prevent. The contract test (`story-6.2...contract.test.ts`) never catches this because it hand-constructs `{ role: 'platform_admin' }` directly, bypassing the real `GET /v1/me` -> session -> page wiring entirely — a genuine gap between "contract passing" and "acceptance criterion actually true for a real session," not visible from the Implementation Log's "PASS (28/28)" line alone. `core-client.ts`'s and `session.ts`'s own header comments are also now stale in the same area — both still say `GET /v1/me` "does not exist in social-listening-core yet," a fact that stopped being true the moment Story 5.11 shipped the day before this batch — matching exactly the class of drift `documentation-steward.md` was chartered to catch, but this file hasn't been touched since 2026-08-04.
- **Scope & Expectations — satisfied.** Each story's own `SKILL.md` names its fixture-data/backend-gap limitations honestly (Story 6.5's "a real tenant-wide connector list endpoint is still a backlog item") — the gap isn't hidden, just not cross-referenced against Story 6.2's own specific role-field mismatch, which nothing in this batch's own documentation names.
- **Team-Level Optimization, Decision Rights & Autonomy, Recognition & Reward, Alignment & Conflict, Organizational Influence** — not implicated by this batch specifically; no findings either way.

**Observable signals used.** Direct source reading of `role-routing.ts`, `identityResolution.ts`, `session.ts`, `core-client.ts`, `callback/route.ts` (not assumed from the Implementation Log's own summary); git commit timestamps (11:03-12:41 on 2026-08-05, ordinary daytime hours, no Protection & Boundaries concern here unlike the prior `4701eff` finding).

**Priority order.** No safety/legal veto. The role-field mismatch is a real functional defect but sits behind a feature this project's own Go-Live Readiness Definition (`cfc6744`, reviewed below) classifies as pre-Go-Live, Stage 0, unreachable by any real end user today — it does not rise to a strategic-objective or customer-commitment veto, but it should not sit unflagged either.

**Verdict: proceed with adjustment.** Nothing here needs undoing or reverting. The adjustment: file the identity.role vs. identity.type/adminId mismatch as a real, named follow-up before Story 6.6 (Platform Admin console) is built on top of the same `getRoleShell()` helper — it would inherit the identical defect — and have `documentation-steward` (now scoped to catch exactly this class of drift) sweep `core-client.ts`/`session.ts`'s stale "does not exist yet" comments the next time it runs. Neither blocks continued Phase 6 work; both are cheap to fix once flagged.

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-05 entries for `443819e`, `67430b7`, `57926be`, `99caf05`, `54f7ee7`.

---

## 2026-08-06 — reviewed e08b0c0/acedb26 — Decision Evaluator: Story 5.12, Platform Admin tenant management REST surface

**Decision as understood.** GET/POST/PATCH /v1/admin/tenants, gated by a new `requirePlatformAdmin()` helper — the exact extension point `tenant-auth-middleware/SKILL.md` had already named as sanctioned when this need arose. Also closes a real, previously-missing grant migration (ADR-0037 SS9 decided platform_admin_role should gain UPDATE(domain) on tenants, but no migration ever built it — confirmed directly, not assumed) — named in the commit as "not a new decision," just the missing implementation of one already made.

**Fourteen-section check.** **Decision Rights & Autonomy — satisfied.** The new helper follows an already-agreed extension pattern rather than inventing a new one. **Outcome Stewardship — satisfied.** The domain: null vs. domain omitted distinction (clear vs. don't-touch) is handled correctly and documented as load-bearing, not glossed over. **Learning from Failure — satisfied.** The missing-grant gap is named as a real, confirmed miss from ADR-0037's own acceptance, closed here rather than left to surface as a live 403 later. No other section implicated; full suite 38/38 at merge, no signal of rushed or under-tested work.

**Observable signals.** Full-suite pass count reported and consistent with the Implementation Log's own dated entry.

**Verdict: proceed.** Clean, well-scoped backend work; no adjustment needed.

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-05 entries for `e08b0c0`, `acedb26`.

---

## 2026-08-06 — reviewed 7b9cee5/abe4a55 — Decision Evaluator: Story 5.13, Platform Admin break-glass request/execute REST surface

**Decision as understood.** Wires Story 5.7's already-shipped two-phase break-glass mechanism behind `requirePlatformAdmin()`-gated HTTP routes — request and execute kept as genuinely separate calls (never auto-chained, per ADR-0030 SS3's own Clarification), with a fast, DB-only 409 check before any real Entra round-trip on a retried execute.

**Fourteen-section check.** **Outcome Stewardship / Organizational Influence — satisfied.** The SKILL.md is explicit about what's still not built (Tenant-Admin lookup by tenant name, no notification/verified TAP-delivery channel to the affected admin) rather than implying the feature is more complete than it is — exactly the kind of honest capacity/scope statement this framework asks for. No section at risk.

**Verdict: proceed.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entries for `7b9cee5`, `abe4a55`.

---

## 2026-08-06 — reviewed 8cf4391/771a3c9 — Decision Evaluator: Story 5.14, Platform Admin audit-log query REST surface

**Decision as understood.** GET /v1/admin/audit-log, read-only, cursor-paginated (reusing ADR-0011's convention) over the audit log Story 5.7 already writes. Closes the third and last of Story 6.6's three named backend prerequisites (5.12/5.13/5.14) — Story 6.6 is no longer blocked on any social-listening-core endpoint gap. The commit message itself surfaces an unrelated, pre-existing flake (Story 4.4 AC5b) observed under full-suite parallel load and explicitly declines to "fix" it in this commit ("confirmed via isolated re-run (7/7 clean), not caused by this change, not repaired here") — it was healed properly two commits later (`7f1fc90`, reviewed below).

**Fourteen-section check.** **Communication & Feedback — satisfied, worth naming.** Surfacing a flake honestly rather than silently re-running until green, and not scope-creeping this story into fixing an unrelated test, is the correct call — it kept this story's own diff focused and routed the real fix to its own dedicated healing pass. No section at risk.

**Verdict: proceed.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entries for `8cf4391`, `771a3c9`.

---

## 2026-08-06 — reviewed 9a25d54 — Decision Evaluator: Accept ADR-0038 and ADR-0039 as drafted

**Decision as understood.** Menno accepts two of the three ADRs from the 2026-08-05 batch — ADR-0038 (AI enrichment provider selection) and ADR-0039 (tenant offboarding data lifecycle) — both as drafted, no revisions, moving Stories 2.8 and 3.7 to Ready.

**Fourteen-section check.** **Decision Rights & Autonomy — satisfied.** Ordinary exercise of Menno's own reserved ADR-acceptance authority, the same pattern every prior ADR acceptance in this project follows; each acceptance is dated, verbatim-quoted, and traced through implementation-plan.md/user-stories/README.md's own running notes. No section at risk — this is routine, well-governed decision-rights exercise, not a new pattern to evaluate.

**Verdict: proceed.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entry for `9a25d54`.

---

## 2026-08-06 — reviewed cfc6744 — Decision Evaluator: Governance batch (Go-Live Readiness Definition, WIP-limit rule, Lessons Learned Register, resolution of the `4701eff` Manager review)

**Decision as understood.** A single commit bundling three governance items: (1) a new Go-Live Readiness Definition, a four-stage environment model (ephemeral test infra -> persistent dev environment -> pilot -> Go-Live) classifying the project at Stage 0 today, naming a new risk (R-07, persistent-credential exposure once a Stage 1 environment exists) and a default-on, always-visible environment banner requirement whose removal is itself a Go-Live gate criterion; (2) a WIP-limit rule (max 3 Proposed ADRs open for review, story count derived from that batch, brainstorming exempt) and a new Lessons-Learned-Register.md; (3) this Manager's own real Decision-Evaluator review of `4701eff`, resolving that queue entry.

**Fourteen-section check.**

- **Scope & Expectations — satisfied, a direct, verifiable response to a prior finding.** This is the concrete answer to this Manager's own `4701eff` verdict ("state an explicit backlog ceiling or WIP limit before drafting further stories/ADRs"): the WIP-limit rule was set the same day the 3-ADR batch it was drawn against sat exactly at the new cap (3 of 3 Proposed), and the rule was honored immediately afterward — `6c8e806` (reviewed below) brought open Proposed ADRs to zero, well under the new ceiling, not up against it.
- **Protection & Boundaries — satisfied, also a direct, verifiable response.** The prior review's other named concern (a late-night/early-morning commit-timestamp pattern across 2026-08-04/05) does not repeat in this batch or the 24 other commits reviewed in this same pass — every timestamp across 2026-08-05/06 falls between 10:28 and 15:46, ordinary daytime hours, with a genuine roughly-22-hour overnight gap between `acedb26` (2026-08-05, 12:41) and `7b9cee5` (2026-08-06, 10:28) — real stopping, not just an absence of evidence to the contrary.
- **Organizational Influence — satisfied, a real strength.** The Go-Live Readiness Definition's core rule (every open ADR question/SKILL.md gap/register finding is pre-Go-Live technical debt, not a live risk, because no real end user can reach any of it yet) is exactly the kind of honest, evidence-grounded scoping this section asks for — it doesn't minimize real gaps, it correctly calibrates their current severity, and it names its own known enforcement gap (its own SS7 — nothing in the codebase yet checks the Stage 0 classification) rather than treating the policy as self-enforcing.
- **Learning from Failure — satisfied.** The Lessons-Learned-Register.md entry treats the `4701eff` pattern as a system-level lesson (no stated WIP limit existed) rather than framing it as a lapse, and is explicit about what the resulting rule does and does not close (Business Case section 5's dollar-ceiling gap remains explicitly open, not silently implied resolved).
- **Decision Rights & Autonomy** — satisfied; this is Menno's own Sponsor/PO authority being exercised on his own project's own governance structure, appropriately dated and logged. No section at risk.

**Observable signals used.** git log timestamps across the full 2026-08-05/06 window (25 commits reviewed in this pass); docs/adr/README.md's own Proposed-ADR count at time of the WIP rule (3 of 3, at cap); Business Case section 5 and Charter A-01 (already-flagged gaps, cited again here only to confirm what the new rule does and does not close, not re-derived).

**Verdict: proceed.** No adjustment needed — this is a well-executed, evidence-responsive governance pass that closes out the concerns this Manager itself raised last cycle, with the closure independently verifiable in the commits that follow it rather than merely asserted.

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entry for `cfc6744`.

---

## 2026-08-06 — reviewed 6c8e806 — Decision Evaluator: Accept ADR-0040 as drafted, closing the three-ADR batch

**Decision as understood.** Menno accepts ADR-0040 (self-service sign-up rate limiting and abuse prevention) as drafted, no revisions — the last of the 2026-08-05 batch's three ADRs. Story 5.18 moves to Ready; all fourteen stories from that batch are now Ready, none Blocked.

**Fourteen-section check.** **Scope & Expectations — satisfied, a real confirmation of the same-day WIP-limit rule holding.** This acceptance brings open Proposed ADRs to zero — the rule set in `cfc6744` earlier the same day was honored on its very first day in effect, not just stated. No other section implicated or at risk.

**Verdict: proceed.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entry for `6c8e806`.

---

## 2026-08-06 — reviewed 7f1fc90/2e6df21 — Decision Evaluator: heal Story 4.4 AC5b (Postgres/JS clock-skew flake)

**Decision as understood.** A contract assertion compared a JS-process `new Date()` "before" marker against a Postgres-side now()-derived refreshed_at — two different clocks (host/test-process vs. the Dockerized Postgres container), with Docker Desktop/WSL2 VM drift growing over a session's runtime. The fix captures "before" via SELECT now() on the same pool the refresh itself uses, putting both timestamps on one clock — a genuine root-cause fix, not a tolerance loosening, and explicitly corrects a prior mis-attribution (the same flake had once been blamed on Jest worker-parallelism contention and was proven not to be that, since it reproduced identically under --runInBand).

**Fourteen-section check.** **Learning from Failure — satisfied, a strong example.** This is exactly the blameless, system-before-cause discipline this framework asks for: the fix names its own prior wrong attribution plainly, investigates until the real cause is found (a widening 10ms to 95ms margin traced to real, confirmed clock drift, not assumed), and encodes the lesson as a load-bearing constraint in the component's own SKILL.md so the same mistake can't recur silently. No section at risk.

**Verdict: proceed.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entries for `7f1fc90`, `2e6df21`.

---

## 2026-08-06 — reviewed cbc8283/40defb5 — Decision Evaluator: heal Story 2.6 AC3 (PR Newswire retry-tolerance gap)

**Decision as understood.** AC3 calls fetchNewswireFeed() directly (needed for raw parsed items) rather than through pollNewswireFeeds() -> runIngestionAttempt(), which meant it alone lacked the retry-with-backoff tolerance every other AC in the file already gets. PR Newswire's Cloudflare-fronted feed intermittently returns a transient non-200. Fix: a local fetchNewswireFeedWithRetry() reusing the same isRetryable() classification and backoff shape runIngestionAttempt() already uses — not new retry logic, not a loosened assertion, and the commit explicitly rejects re-applying a prior "it's just Cloudflare, transient" assumption without re-investigating (5 consecutive curl requests during the actual investigation).

**Fourteen-section check.** **Learning from Failure — satisfied.** Same discipline as the 4.4 healing pass: investigated rather than re-applied a prior assumption, root-caused before patching, and the SKILL.md gains a load-bearing note explicitly warning against reverting AC3 to a raw call. No section at risk.

**Verdict: proceed.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entries for `cbc8283`, `40defb5`.

---

## 2026-08-06 — reviewed 135a5a1/8fde7e1 — Decision Evaluator: Story 5.15, self-service tenant sign-up backend endpoint

**Decision as understood.** POST /v1/tenants/self-service-signup (ADR-0037 SS1-SS9) — the one route in this project accepting a validly-signed Entra bearer token resolveIdentity() cannot match, letting a brand-new user provision their own tenant and become its first tenant_admin. A fifth Postgres role (tenant_signup_role), a new domain_signup_attempts table, a second claims-level auth middleware (deliberately not the shared authMiddleware, which would reject exactly the caller this route must accept). A genuine implementation-time bug was found and fixed during the story's own Step 7 validation (a column-scoped SELECT(id) grant broke INSERT ... RETURNING *, confirmed directly against a live Postgres instance, widened to a full SELECT matching platform_admin_role's own existing grant — not a new enumeration risk, reasoned explicitly).

**Fourteen-section check.**

- **Organizational Influence / Outcome Stewardship — satisfied, worth naming as a strength.** This is a security-sensitive, publicly-reachable-once-deployed endpoint, and every layer of documentation around it (the SKILL.md, implementation-plan.md's own dated notes, the Epic 6 story's own Status line) repeats the same caution multiple times, consistently: not safe for real, untrusted traffic until Story 5.18 (rate-limiting) also ships. This is exactly the kind of transparent, repeated risk-naming this framework asks for rather than a single buried caveat — the risk is visible from at least three independent places in the docs, not just this story's own contract.
- **Decision Rights & Autonomy — satisfied.** The implementation-time grant-widening decision is reasoned in place (matches an existing precedent, doesn't widen the anti-enumeration boundary ADR-0037 SS3 cares about) rather than escalated as a new ADR — an appropriate level of autonomy for an implementation detail an already-Accepted ADR didn't specify to that precision.
- No other section at risk.

**Observable signals used.** Full suite 41/41 at merge, consistent with the Implementation Log entry; cross-referenced against implementation-plan.md's own repeated "not yet safe for real traffic" note (three separate dated additions, all consistent).

**Verdict: proceed.** No adjustment — this is careful, security-conscious work with its own real risk transparently and repeatedly flagged rather than shipped quietly.

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entries for `135a5a1`, `8fde7e1`.

---

## 2026-08-06 — reviewed dc66f14/fe4c7a2 — Decision Evaluator: Product & Market-Fit Reviewer prompt optimization, new findings register, second (Foundry) backend

**Decision as understood.** Two closely-related commits: a prompt-block optimization for the Product & Market-Fit Reviewer role (tighter instruction-following, a required "Possible solution" field per finding — the same "don't just flag it, name the fix" discipline Engineering Pragmatism's own charter already holds itself to), then a new docs/product/product-market-register.md and a second backend (a real Microsoft Foundry Prompt Agent, added because Mistral has a real, recurring capacity constraint) — exercised for real, producing six logged findings against actual project material.

**Fourteen-section check.**

- **Team-Level Optimization (vendor/API-availability sense) — satisfied.** Adding a second backend specifically because one vendor (Mistral) has a documented, recurring capacity constraint is exactly this section's own framing applied correctly to an AI role — redundancy against a real, named single-point-of-failure risk, not proliferation for its own sake. The Foundry integration is also honestly self-corrected in its own header comment (two real, empirically-found API-shape bugs the portal's own generated sample code got wrong) rather than left silently fragile.
- **Outcome Stewardship / Organizational Influence — the register's own first real findings run deserves direct attention, not just a process note.** The Product & Market-Fit Reviewer's own newly-created register already logged a real, substantive first review (2026-08-06, six findings, five of six would-notice-negatively/wouldnt-notice, none positive) that converges independently with this Manager's own Phase 6 finding above: GET /v1/me gating is functionally incomplete for a real user's experience; Story 5.15's self-service signup ships with no UI payoff (Story 6.7 unbuilt); source coverage is still news/RSS-only against a "social listening" positioning; and — finding 5, worth quoting directly because it is this project's own governed AI role naming the same tension this Manager has flagged twice now from a different angle — "Time spent here competes directly with shipping the first usable end-user workflow." This is a second, independent signal (market-fit lens, not management-sustainability lens) pointing at the same underlying pattern: a project that is unusually strong on architecture, governance, and process discipline, with the actual end-user-facing product still thin relative to that investment. Neither this Manager nor the Product & Market-Fit Reviewer holds authority to reprioritize the backlog — that is Menno's own call — but two independently-reasoned findings converging on the same gap is a real signal worth Menno's direct attention now, not filed and moved past.
- **Recognition & Reward, Decision Rights & Autonomy** — not implicated; this is Menno directing his own tooling investment, no compensation/formalization question applies to an AI role.

**Observable signals used.** docs/product/product-market-register.md's own 2026-08-06 entry, read directly (not summarized secondhand); this Manager's own two prior findings (the `4701eff` review's Outcome Stewardship note, and this same pass's Phase 6 UI-batch finding above) as the convergent comparison point.

**Verdict: proceed, with the convergent finding escalated for Menno's attention (see final report), not treated as resolved by logging it here.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entries for `dc66f14`, `fe4c7a2`.

---

## 2026-08-06 — reviewed aa4bf87/55a02ab — Decision Evaluator: extend Documentation Steward to PM docs, add a Learning & Development Writer, wire two more Foundry Prompt Agents, restructure the post-commit queueing hook

**Decision as understood.** Three governance/tooling changes: (1) documentation-steward gains scope over the PM-side project docs (Stakeholder Register, Business Case, Charter, the 9 Project Management Plans) and gains Edit/Write tools so it can propose real corrections in the working tree rather than only describing drift — but still never commits its own changes, a human commit remains the approval gate; (2) a new learning-development-writer role, chartered to keep three real, end-user-facing manuals in sync with what's actually shipped, with an explicit "never document the roadmap, only shipped reality" discipline; (3) scripts/git-hooks/post-commit now queues every commit for three independent review queues instead of one.

**Fourteen-section check.**

- **Decision Rights & Autonomy — satisfied, a strong pattern worth naming.** Both new/extended roles have an explicit, consistent boundary: propose real, git-diff-able edits, never commit them, human commit is the approval gate — the same pattern this project already applies to the external reviewers' findings registers. Neither role is granted authority beyond what its own charter states, and both charters say so in their own "Hard rules" sections rather than leaving it implicit.
- **Team-Level Optimization (role-scope sense) — satisfied.** The Documentation Steward's scope extension closes a real, previously-named gap (the PM docs "keep pace on their own" rather than being discovered stale weeks later, which had in fact already happened once for real — R-04's own status line, cited directly in the charter's own extension text) rather than being scope growth for its own sake. The Learning & Development Writer is a genuinely distinct domain pull (end-user-facing manuals, never the roadmap) from Documentation Steward's (internal paper-trail drift) — not overlapping responsibility assigned to two roles.
- **Scope & Expectations — satisfied.** The post-commit hook rewrite is additive and mechanical (three queue files instead of one, same append-only, non-blocking pattern) — no new obligation created without a stated boundary.
- No section at risk.

**Verdict: proceed.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entries for `aa4bf87`, `55a02ab`.

---

## 2026-08-06 — reviewed 2106034 — Decision Evaluator: record two parked AI-role ideas (Infrastructure/Go-Live Readiness Reviewer, Cost/FinOps Reviewer)

**Decision as understood.** Two candidate new AI reviewer roles were discussed and deliberately not built, per Menno's own direct instruction ("keep it parked both till becomes relevant") — named in docs/ai-roles/README.md with their real trigger conditions (standing up Stage 1 of the Go-Live environment model; sustained real API/infra spend post-pilot) so the ideas aren't lost, without being built ahead of a demonstrated need.

**Fourteen-section check.** **Scope & Expectations / Strategic Direction — satisfied, a real strength.** This is the same discipline `cfc6744`'s WIP-limit rule established applied a second time, immediately: available work (two plausible new roles) treated as a resource to name and defer, not a mandate to build — explicitly modeled on ADR-0020's own precedent ("don't build ahead of a demonstrated need"). No section at risk; this is a one-line, low-stakes commit reviewed for completeness of the queue, not because it carries any real risk.

**Verdict: proceed.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entry for `2106034`.

---

## 2026-08-10 — reviewed a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48 — Decision Evaluator: 2026-08-06 evening batch (16:22-23:07) — Story 5.16, the Manager's own prior queue-processing commit, a real fix to the previously-flagged Story 6.2 defect, and a large AI-role/governance expansion

**Decision as understood.** Twenty-two commits across one evening (16:22-23:07 on 2026-08-06, no gap over ~40 min): one real backend story (5.16, Same-Domain Invite Assist backend), one commit (`63b5ce1`) that is this Manager's own prior batch Decision-Evaluator pass over 25 then-queued commits (persisted as a commit, not just a chat response — the mechanism this charter's own "Pending commit reviews" section assumes), a direct, verified fix to the exact defect this Manager flagged on 2026-08-06 (`1f8960e`, see below), an L&D Writer whole-project manual catch-up, a new author-rights check added to the requirements-analyst charter, connector research write-up (Reddit/X/YouTube/Meta/Wikipedia), one ADR acceptance (0041, Platform Admin as a distinct identity kind — directly responding to `1f8960e`'s own named follow-up ask), one ADR draft (0042, Wikipedia connector), a knowledge-graph review, a reviewer-backend migration (Ollama to Foundry for two roles), 12 new stakeholder persona profiles, two new AI-role findings registers exercised for the first time (Legal & Compliance, Data Privacy & Sovereignty), real auto-derived commit time-logging wired into `post-commit`, a documentation-steward cross-reference fix, two bookkeeping commits, and one more ADR draft (0043, self-service tenant deletion).

**Fourteen-section check.**

- **Learning from Failure / Organizational Influence — satisfied, the strongest item in this batch.** `1f8960e`'s own commit message names this Manager's review as its direct trigger ("Fix... caught (Ideal Manager's review, then confirmed by direct code reading) before the system reaches Go-Live and any real user is affected") and does not minimize the gap ("This is not a subtle edge case... never actually implemented... a real, signed-in Platform Admin was silently routed into the tenant shell today"). Verified directly against `social-listening-admin/src/lib/role-routing.ts`: `getRoleShell()` now takes the real discriminated-union `ResolvedIdentity` type with a validating `isResolvedIdentity()` guard, and a new `isShellAllowed()` is the actual AC2 enforcement point at both `/tenant` and `/platform-admin`. This is exactly the accountability loop this charter's advisory model depends on — a finding was acted on, not just filed.
- **Scope & Expectations — at risk, worth tracking forward, not yet a violation at this point in the timeline.** Two ADRs drafted this evening (0042, 0043) bring open Proposed ADRs to 2 of the 3-ADR cap `cfc6744` set on 2026-08-05 — still within the rule as of this batch. (This rule is breached later in the queue — see the 2026-08-10 entry below, which is where the violation actually occurs and is flagged in full.) The broader pattern from the `4701eff` review — governance/AI-role investment outpacing product-facing build — repeats again here (one story shipped, ~20 governance/tooling commits), but unlike `4701eff` this evening also contains a real, high-value defect fix and a direct acceptance (0041) closing the exact gap the fix's own commit message asked for, so this is a healthier mix than the pure-governance session flagged previously, not a repeat of the same anti-pattern in its worse form.
- **Protection & Boundaries — satisfied.** 16:22-23:07 is an ordinary, if long (~6h45m), single evening, not the late-night/early-morning pattern flagged after `4701eff`.
- **Team-Level Optimization (vendor/API-availability sense) — satisfied.** `c0179f4`'s Ollama-to-Foundry migration for the two privacy/legal reviewer roles is the same documented-capacity-constraint pattern already found satisfied in the `dc66f14/fe4c7a2` review — consistent practice, not a new concern.
- **Decision Rights & Autonomy — satisfied.** `63b5ce1` (this Manager's own prior batch pass, committed under Menno's authorship since no agent commits autonomously in this project) followed this charter's own append-only, resolve-in-place convention correctly — verified directly against the register content it added, matching exactly what is now on disk above this entry.
- **Team-Level Optimization / Recognition & Reward** — not implicated by the 12-persona stakeholder-profile or findings-register commits specifically; these are content additions to already-chartered roles' own scope, not new role proliferation.

**Observable signals used.** `git log` timestamps (16:22-23:07, single evening, no overnight gap in this sub-range); direct source read of `role-routing.ts` pre/post-diff; `docs/adr/README.md`'s own Proposed-ADR count at end of this batch (2 of 3 cap: 0042, 0043).

**Priority order.** No safety/legal veto. The Scope & Expectations tension is real but does not override — it is explicitly tracked forward to the entry below where the same pattern crosses into an actual rule breach.

**Verdict: proceed.** No adjustment needed for this batch specifically — the one real defect this Manager flagged was fixed correctly and promptly, and the WIP-limit rule was still being honored at this point in the timeline.

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-06 entries for `a251050`, `29914e2`, `63b5ce1`, `1f8960e`, `fb2eabc`, `35f056a`, `2061e72`, `4f7d9b9`, `82ca1e2`, `6e4321f`, `c0179f4`, `1187116`, `464e05a`, `cd308eb`, `406bf2c`, `f932f41`, `3a757b7`, `7dddb56`, `f5e4e41`, `3c96b74`, `10e310d`, `9bc1a48`.

---

## 2026-08-10 — reviewed 9a99257/b80aa58 — Decision Evaluator: Story 3.8, self-service tenant deletion (supersedes Story 3.7, ADR-0039 Decision §1 fully superseded by ADR-0043)

**Decision as understood.** Story 3.7 was built the night of 2026-08-06/07 exactly as originally specified (platform_admin_role-gated deletion), then a real collision with Story 5.7's already-accepted "platform_admin_role has zero access to any tenant-content table" boundary surfaced when running the full suite. Menno reviewed and corrected the decision before committing it: tenant deletion is `tenant_admin`-initiated, own-tenant-only, never platform-admin-initiated. Story 3.7's implementation was reverted, uncommitted; Story 3.8 was built for real on the corrected design — request/export/cancel/confirm, 30-day grace period, ingestion halted immediately, and a new non-`BYPASSRLS` `tenant_deletion_role` for the final execution step (a security refinement decided mid-build, tighter than the standing `app_user` grant it could have reused).

**Fourteen-section check.**

- **Learning from Failure — satisfied, a strong example.** The wrong design was caught by running the full suite before committing, not after — the commit message documents the collision, the correction, and the fact that the flawed implementation was never shipped, only reverted in the working tree. This is the failure-before-commit version of the same discipline the 4.4/2.6 healing passes showed after commit.
- **Outcome Stewardship / Organizational Influence — satisfied.** A genuinely security-sensitive capability (irrecoverable tenant data deletion) ships with an honestly-named real gap (archived `ingestion_runs` with zero referencing `social_posts` rows are not enumerable for export) documented directly in the code's own comments, not glossed over; and the mid-build tightening to a dedicated non-bypass role is a real security improvement over the minimum the ADR required, not scope padding.
- No other section at risk. Full suite 41/43 clean at merge (2 pre-existing, independently-reproduced, unrelated Entra flakes named directly, not silently absorbed into this story's own pass/fail count).

**Observable signals used.** Direct read of `social-listening-core/src/tenants/tenantDeletion.ts`; commit message's own stated suite result cross-checked against the Implementation Log entry.

**Verdict: proceed.** No adjustment — careful, security-conscious work, with its own real gaps named rather than hidden.

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-07 entries for `9a99257`, `b80aa58`.

---

## 2026-08-10 — reviewed c5e1532/769c28c/fa7954c — Advisor: legacy Microsoft Social Engagement UI mockup import and Admin UI mock/design scaffolding (2026-08-07 12:43 to 2026-08-08 19:16)

**Decision as understood.** Two large, wholesale imports of design-reference material into `docs/design/` (a 75-file Claude-Design HTML/CSS/JS handoff bundle for the legacy Microsoft Social Engagement UI, then a 31-file Next.js/Vite conversion of the same), followed by a small, explicitly-labeled mock/scaffolding commit (`fa7954c`: `globals.css`, `lib/types.ts`, `lib/mockData.ts`, `tailwind.config.js`) landed directly in `social-listening-admin/src`, not `docs/design/`, but its own commit message states plainly "design references and mock data only — not wired to live endpoints... Implementation will replace mocks per each story's contract," and is committed `--no-verify` with the stated reason "no story implementation... no src logic added."

**Fourteen-section check.**

- **Scope & Expectations — at risk, worth naming, not a violation.** Neither large mockup import is requested by, or blocking, any currently-Ready or in-progress story — they are reference material for a future visual-parity pass this project's own docs don't yet name as scoped work anywhere (no ADR, no story, no backlog entry ties these two commits to a planned deliverable). 3,754 + 3,856 lines landing with no story/ADR anchor is exactly the kind of "available work absorbed because it's there" this framework's own opening standard warns about, even though — unlike `4701eff`'s governance expansion — this is reference material, not shipped scope, and carries zero `src/` risk.
- **Decision Rights & Autonomy / Outcome Stewardship — satisfied for the `fa7954c` piece specifically.** The mock-scaffolding commit's own `--no-verify` justification is honest and structurally correct (this project's `enforce-contract-first` hook exists to stop `src/` logic landing without a contract; static mock data and Tailwind config are not logic), and it explicitly commits to real endpoints replacing it story-by-story — which then actually happened, verified against Stories 6.2-6.10's own `SKILL.md`s naming their own fixture-replacement status honestly, and against the direct fixture-data removal in `1dbd26a` (reviewed below).
- No other section at risk — this is reference/scaffolding material, not a functional or safety concern.

**Observable signals used.** `git show --stat` file/line counts for both large imports; direct read of `fa7954c`'s own commit message and diff; cross-check against the fixture-replacement pattern already found "satisfied" in the `443819e...` review and confirmed again in the 2026-08-10 giant-day entry below.

**Verdict: proceed, with a light adjustment.** Nothing needs undoing. The adjustment: if a real visual-parity initiative against this reference material becomes actual scope, give it its own named backlog entry (even informally, matching this project's own "no work without a named gap" discipline elsewhere) rather than letting 7,600+ lines of reference material sit with no forward pointer to what it's for.

**Resolves:** `docs/management/pending-manager-reviews.md`'s entries for `c5e1532` (2026-08-07), `769c28c` and `fa7954c` (2026-08-08).

---

## 2026-08-10 — reviewed c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc — Decision Evaluator: 2026-08-08 evening batch (18:32-19:37) — Story 1.1 repo-independence healing, a 5-ADR governance drop (2 later self-corrected away), a 3-story healing pass, tooling/config setup, and Story 6.6

**Decision as understood.** A dense one-hour evening: `c33353d` fixes a real ADR-0001 violation (a parent `package.json` had reintroduced a shared workspace root, breaking `social-listening-admin`'s independent-repo AC3); `5b7a69f` bundles heal-contract-failure SKILL clarity fixes with five new ADRs (0044-0048) plus traceability catch-up; `488ac49` is a healing pass across three already-shipped stories (2.7, 5.7, 5.13); `34b5333`/`0c3409b`/`bb42281`/`ac05777`/`13a909f` are config/tooling setup (Codacy, VS Code MCP, time-tracking automation, `.gitignore` for Python artifacts); `2b2d40b`/`77e1bfc` build Story 6.6 (Platform Admin console), the last of Phase 6's originally-drafted screens to depend on real backend endpoints.

**Fourteen-section check.**

- **Learning from Failure — satisfied, a real strength worth naming directly.** Two of the five ADRs `5b7a69f` added (0045 "Audit Trail Architecture," 0046 "Admin UI Auth Architecture") were deleted outright the very next session (`0b9e1dd`, reviewed below) after review found the audit question was already being answered correctly, incrementally, per-table (`platform_admin_audit_log`, `user_access_audit_log`, etc.) rather than needing a unifying ADR, and 0046 duplicated ground ADR-0036 already covered. Drafting, reviewing, and retracting a governance document within about a day — rather than accepting it just because it was drafted, or leaving a redundant ADR in the series indefinitely — is exactly the self-correcting discipline this framework values; it is called out explicitly here because it is easy to read a "5 ADRs added" commit as pure scope growth without checking whether it stayed that way.
- **Outcome Stewardship — satisfied.** `2b2d40b` (Story 6.6) is verified directly against `social-listening-admin/src/lib/core-client.ts`: real `listAdminTenants()`/`createAdminTenant()` calls against `/v1/admin/tenants` (Story 5.12) and the audit-log/break-glass endpoints (5.13/5.14), not the hardcoded-fixture pattern the `443819e...` review flagged for Stories 6.2-6.5 — Story 6.6 does not repeat that gap, confirming the earlier finding's own "cheap to fix once flagged" framing held.
- **Learning from Failure — satisfied, second instance.** `c33353d`'s fix is itself closing a real regression (a `package.json` reintroduced at workspace root after ADR-0001 had already settled the question) — worth naming as a live instance of exactly the kind of drift documentation-steward-class tooling exists to catch before it recurs.
- No other section at risk; the tooling/config commits are small, mechanical, and non-controversial.

**Observable signals used.** Direct diff read of `5b7a69f`'s five ADR additions and `0b9e1dd`'s deletion of two of them the next session; direct read of `core-client.ts`'s Story 6.6 additions; `git show --stat` for `c33353d`.

**Verdict: proceed.** No adjustment needed — this is dense but well-targeted work, and the one governance over-reach in it (2 of 5 ADRs) was caught and reversed by the project's own process within about a day, not left standing.

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-08 entries for `c33353d`, `5b7a69f`, `488ac49`, `34b5333`, `0c3409b`, `bb42281`, `ac05777`, `13a909f`, `2b2d40b`, `77e1bfc`.

---

## 2026-08-10 — reviewed 4ff04cd/8abdb48 — Decision Evaluator: Foundry Toolkit / azd local-agent-debugging setup, including a wholesale copy of an unrelated Microsoft Foundry sample project into the repo root

**Decision as understood.** Two commits (2026-08-08, 19:08 and 23:11) add local debugging/deployment tooling for running an agent through Azure Developer CLI (`azd ai agent run`) with Foundry Toolkit tracing — `agent.yaml`, root-level `main.py`, `Dockerfile`, `.mcp.json`, VS Code launch/task configs, an `infra/main.bicep`, and, in the second commit, an entire second project directory (`agent-framework-agent-with-local-tools-responses/`, with its own `AGENTS.md`, `CLAUDE.md`, `README.md`, `azure.yaml`, `Dockerfile`, `requirements.txt`) — confirmed directly by reading its README: this is Microsoft's own generic "Agent with Local Tools (Responses Protocol)" sample from the `microsoft-foundry/foundry-samples` repository, copied in verbatim, not built for or wired into any of this project's own eleven chartered AI roles (which invoke via `docs/ai-roles/scripts/invoke-*.{cjs,mjs}`, an entirely separate, already-working mechanism).

**Fourteen-section check.**

- **Scope & Expectations — at risk, the clearest finding in this batch.** Nothing in `docs/ai-roles/README.md`, any ADR, or the Stakeholder Register names a need this sample project closes — it is not a Foundry backend for an existing reviewer role (unlike `fe4c7a2`'s Foundry Prompt Agent addition, which the register already found gap-driven and satisfied), it is generic quickstart scaffolding for a capability (`azd ai agent run` local debugging) this project has not stated it needs. A `.log` file (`azd-ai-agents-2026-08-08.log`) and Python `__pycache__`/`.pyc` bytecode also landed uncommitted-hygiene-wise in the same window (cleaned up one commit later by `bb42281`'s `.gitignore` fix, and again — the `.pyc` file reappears — in `0b9e1dd`), a small but real sign this addition wasn't fully settled before being committed.
- **Outcome Stewardship — at risk.** This adds real, ongoing repo-hygiene surface (a second, unrelated `README.md`/`CLAUDE.md`/`AGENTS.md` set at a nested path, a second `Dockerfile`, a second `requirements.txt`) to a solo-developer project whose own `CLAUDE.md` asks future sessions to "read these before doing anything else" — a nested, unrelated `CLAUDE.md` two directories down is a real source of confusion for exactly the kind of session-bootstrapping this project's docs are otherwise careful about.
- No safety/legal/strategic-objective concern — this is inert scaffolding, not a shipped capability, and touches nothing in `social-listening-core`/`social-listening-admin`.

**Observable signals used.** Direct read of both commits' file lists and the copied sample's own `README.md`; cross-check against `docs/ai-roles/README.md`'s actual, in-use invocation mechanism for this project's real AI roles.

**Priority order.** No veto — low-stakes, reversible, doesn't block any story or ADR.

**Verdict: proceed with adjustment.** Nothing here blocks anything, but this is worth a direct question back to Menno rather than silently filing it: is this sample project going to become the real backend for a specific chartered AI role (in which case it belongs under `docs/ai-roles/` with a stated purpose, matching how every other AI-role backend in this project is organized), or was it exploratory tooling that's now done being explored and can be removed? Leaving it in place indefinitely, unreferenced by any doc, is the "available work becomes assigned/kept" pattern this framework's opening standard warns against, applied to repo surface rather than backlog items.

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-08 entries for `4ff04cd`, `8abdb48`.

---

## 2026-08-10 — reviewed 0b9e1dd/11186b7 — Decision Evaluator: late-night ADR redlines/deletions and Copilot-instructions update (2026-08-09, 03:38-03:39)

**Decision as understood.** Two small commits at 03:38 and 03:39 on 2026-08-09: `0b9e1dd` deletes the two low-quality ADR drafts named above (0045, 0046 — confirmed via direct diff read, both were 13-line stub drafts, one explicitly sourced from `_stale-drafts/0045-audit-trail-from-other-project.md` per the ADR README's own note, i.e. copied-in material from a different project that didn't survive review), substantially rewrites ADR-0044's rationale/decision text, and updates Codacy/VS Code MCP config; `11186b7` updates `.github/copilot-instructions.md` and a Copilot prompt file.

**Fourteen-section check.**

- **Protection & Boundaries — at risk, a real, grounded signal, second occurrence of this exact pattern.** 03:38-03:39 is squarely the late-night/early-morning window this Manager already named once, on 2026-08-05, as "worth naming now, while it's a pattern, rather than waiting for... a stall to be the first signal in the opposite direction" — and the `cfc6744` review later confirmed the pattern had *not* repeated across the intervening 2026-08-05/06 window. It has now repeated, grounded in the same kind of real git timestamp data, not vibes. This is not being treated as a violation (solo, self-paced, self-funded, no one else's morning depends on this commit existing), but the standing recommendation from the first time this was flagged — model stopping, per Sec 4 — is worth restating plainly now that the pattern has recurred rather than staying silent a second time.
- **Learning from Failure — satisfied** (see the prior entry's discussion of the 0045/0046 deletion — the same finding, cross-referenced here since this is the commit where the deletion actually lands).
- No other section at risk.

**Observable signals used.** `git log` commit timestamp (03:38-03:39, 2026-08-09); direct comparison against the two prior Manager entries (`4701eff`'s original flag, `cfc6744`'s "hasn't repeated" confirmation) that this specific signal has its own dated prior art in this same register.

**Verdict: proceed, with the pattern flagged directly rather than filed silently.** No content in this commit needs undoing. The recommendation, restated because it recurred: this is the second late-night/early-morning commit window in the project's history — worth Menno's own attention as a pattern now, not analysis of this specific commit's content (which is fine on its merits).

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-09 entries for `0b9e1dd`, `11186b7`.

---

## 2026-08-10 — reviewed 10fc934/4de308e/75cc58d/3badf2f/afd270f — Decision Evaluator: Epic 1 morning catch-up (2026-08-09, 06:41-09:39) — Story 1.8, Story 3.5 boundary-condition heal, Story 1.9

**Decision as understood.** GET /v1/tenants/me (Story 1.8), a same-morning healing pass fixing an archival partition eligibility boundary condition in Story 3.5 with a corresponding ADR-0018 amendment, and Story 1.9 (user invitation/offboarding REST surface, ADR-0032).

**Fourteen-section check.** No section at risk. This is ordinary, well-paced backend feature work at ordinary morning hours (06:41-09:39), each commit logged with its own Implementation Log entry per this project's standard discipline, no scope or process concern identified.

**Verdict: proceed.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-09 entries for `10fc934`, `4de308e`, `75cc58d`, `3badf2f`, `afd270f`.

---

## 2026-08-10 — reviewed 2b44637/d114c16 — Decision Evaluator: Story 6.7, self-service tenant sign-up UI (ADR-0037)

**Decision as understood.** The UI counterpart to Story 5.15/5.18's backend self-service sign-up, built the same evening (16:52-16:53, 2026-08-09) — sign-up form, domain-taken/already-have-account/error states, and the OAuth callback wiring.

**Fourteen-section check.** No section at risk. This closes the Product & Market-Fit Reviewer's own second finding (flagged in the `dc66f14/fe4c7a2` register entry: "Story 5.15's self-service signup ships with no UI payoff") — worth naming as a direct, verified resolution of a standing cross-role finding, the same pattern as `1f8960e` closing this Manager's own finding.

**Verdict: proceed.**

**Resolves:** `docs/management/pending-manager-reviews.md`'s 2026-08-09 entries for `2b44637`, `d114c16`.

---

## 2026-08-10 - reviewed the 2026-08-10 batch (36 commits, 07:43-22:24, ~14h41m) - Decision Evaluator: Epic 6 fully closed out, Stories 5.17/5.18/2.8/2.9 shipped, four live-testing-derived defects found and fixed same-day, and a self-imposed governance rule breached

**Commits covered:** 832f7b3, 09160c4, c89ee47, 6b7fc00, 09b626f, 9ec62fa, 1e18c4b, 3661ce9, 19d50d7, 5fe1999, f0e3c36, 99b58c3, d78c598, 7a2466d, d1ad0c6, f70b07d, 80cc28d, 1e7e9ac, 54b32fa, 69310ba, 9007da1, 292a22a, d936082, 8e1ac18, 7d978e0, 1dbd26a, d545174, 15756e0, de96102, dba9895, 6d08379, 35b70a8, 596b2c3, f4c50db, 49eaa50, 4551e26.

**Decision as understood.** In one calendar day, spanning 07:43 to 22:24 (36 commits, a new commit roughly every 25 minutes on average, continuously, across ~14h41m): a parallel-worker dev-server race heal; Stories 6.8, 6.9, 6.10 (closing out every remaining Epic 6 screen); Story 5.17 (access-history read endpoint); a break-glass Graph-409 retry heal; Story 5.18 (self-service sign-up rate limiting, closing ADR-0037 section 7's own long-standing precondition for safely exposing sign-up to real traffic); Stories 2.8 and 2.9 (two new real AIProviderConnector implementations - Azure AI Language, then Azure OpenAI/gpt-5-mini - plus two same-day ADR-0038 amendments as real deployed-model names changed under Menno mid-build); a Story 2.9 follow-up adding self-review/confidence fields; two new Proposed ADR drafts (0049, 0050) from a brainstorming session; a correction to overstated Story 6.3 SKILL.md claims; a real healing pass replacing Story 6.3's fixture-data connect/disconnect flow with a live one; a Story 1.4 dotenv-loading fix; a Story 6.1 healing pass fixing a real, live-blocking missing OAuth scope and an oid-vs-sub seeding error; a Story 6.2 root-redirect heal; and finally three commits recording real gaps found during Menno's own first live, manual end-to-end test of the sign-up/invite flows (Entra tenant-config prerequisites, a thin sign-up form, a missing invite-withdrawal capability).

**Fourteen-section check.**

- **Learning from Failure - satisfied, the strongest pattern in this entire review pass.** Three separate defects in this one day were found by Menno actually using the product live, not by a contract test: the OAuth-scope gap (dba9895 - no real Platform Admin sign-in worked at all until this), the root-redirect gap (35b70a8), and the thin sign-up form / missing invite-withdrawal gaps (f4c50db/49eaa50/4551e26) are all named honestly, fixed or backlogged same-day, with no attempt to retroactively claim the original story's contract should have caught them. 1dbd26a also directly and explicitly closes the fixture-data gap this Manager's own 443819e review flagged on 2026-08-06 for Story 6.3 - a second standing finding closed this pass (after 1f8960e closed the first, in the batch above) - and 7d978e0 proactively corrects overstated SKILL.md claims about that same connect flow before the healing pass even lands, rather than leaving the record wrong.

- **Scope and Expectations - violated, a concrete, evidence-grounded finding, not a judgment call.** docs/adr/README.md's own "Proposed (not yet decided)" section currently lists five open Proposed ADRs - 0042, 0044, 0047, 0049, 0050 - against the explicit cap Menno set in his own words on 2026-08-05 (Development-Approach-and-Life-Cycle-Plan.md, WIP Limit on Open Governance Work section, line 208): keep at 3 at a time for open review; a maximum of 3 Proposed ADRs open for review at any one time. Two of the five (0049, 0050) were drafted in this very day's batch (8e1ac18), pushing the open count from 3 to 5 with no note anywhere - in the commit, the ADR README's own running commentary, or this rule's own governing document - acknowledging the cap was crossed, let alone revising or consciously waiving it. This is the same class of gap the WIP-limit rule was created to close in the first place, now recurring against the rule itself rather than against the absence of a rule. It is a real, self-inflicted governance-discipline lapse, not a hypothetical.

- **Protection and Boundaries - at risk, worth naming plainly.** 36 commits across 07:43-22:24 (about 14h41m) is, by a wide margin, the largest single-day volume anywhere in this project's commit history reviewed to date - roughly 4.4x the next-busiest evening reviewed above (2026-08-06, 22 commits over about 6h45m). This is real, dated git data, not an estimate. Framed against this charter's own instruction to protect developer-Menno from sponsor-Menno's own scope ambitions, and hold sponsor-Menno accountable, in both directions: the output quality across the day does not show signs of degradation (the three live-testing defect fixes are careful, root-caused, well-documented, not rushed patches), so this is not being scored as a quality failure - but a single continuous roughly 14.7-hour work session is exactly the kind of pace this framework's Section 4 (model stopping, do not normalize constant availability) exists to name even when nothing has broken yet, on a self-funded solo project with literally no one else to notice if it isn't named here.
- **Outcome Stewardship and Strategic Direction - satisfied, worth naming as a real strength.** Epic 6 (Admin UI) is now fully closed - every story from 6.1 through 6.10 shipped - and Story 5.18 closes the last precondition blocking real untrusted traffic on self-service sign-up. This is a genuine, dated milestone: the product now has, for the first time, a complete, real, exercisable end-to-end flow (sign up, invite users, connect a connector, manage settings), the exact gap both this Manager's 4701eff/443819e reviews and the Product and Market-Fit Reviewer's own register independently flagged as thin relative to this project's governance/architecture investment. This day is where that gap closes, not where it grows.
- No safety/legal veto - none of this touches production data with real users yet (Go-Live Readiness Definition Stage 0 still applies).

**Observable signals used.** git log timestamps for the full day (07:43-22:24, direct count of 36 commits); docs/adr/README.md's own live "Proposed (not yet decided)" section, read directly, cross-referenced against the exact WIP-limit rule text in docs/project docs/Project Management Plans/Development-Approach-and-Life-Cycle-Plan.md line 208; direct diff reads of dba9895 (OAuth scope / entra.ts), 99b58c3 (break-glass retry), 7a2466d (signupRateLimit.ts), 1dbd26a (Story 6.3 fixture removal, file stat).

**Priority order.** No safety/legal veto. Strategic objectives (Epic 6 completion, sign-up rate-limiting) are real and satisfied - they do not override the Scope and Expectations finding, which sits at a lower tier but is not waived by it either; a self-imposed governance rule being broken is exactly the kind of finding the priority order says still gets raised, just not escalated to a block.

**Verdict: proceed, with adjustment - direct escalation to Menno on two points, not filed as routine.** (1) The WIP-limit rule is currently broken (5 of 3 Proposed ADRs open) - either bring ADR-0044/0047/0049/0050 to review-and-decide before drafting further ones, or explicitly revise the rule in the same dated-amendment style Development-Approach-and-Life-Cycle-Plan.md already uses for it; silently exceeding a self-set cap without a word anywhere is the "protection becomes an excuse to never revisit scope" failure mode in reverse - a rule that stops being enforced quietly is worse than no rule. (2) The roughly 14.7-hour single-day session is named here, per Section 4, the same as the 2026-08-05 pattern was named and the 2026-08-09 03:38 recurrence was named above - not because output quality suffered (it didn't, visibly), but because this charter exists to name the pattern before it produces a stall, not after.

**Resolves:** docs/management/pending-manager-reviews.md's 2026-08-10 entries for 832f7b3, 09160c4, c89ee47, 6b7fc00, 09b626f, 9ec62fa, 1e18c4b, 3661ce9, 19d50d7, 5fe1999, f0e3c36, 99b58c3, d78c598, 7a2466d, d1ad0c6, f70b07d, 80cc28d, 1e7e9ac, 54b32fa, 69310ba, 9007da1, 292a22a, d936082, 8e1ac18, 7d978e0, 1dbd26a, d545174, 15756e0, de96102, dba9895, 6d08379, 35b70a8, 596b2c3, f4c50db, 49eaa50, 4551e26.

---

## 2026-08-10 - reviewed f36d765/3ae641e - Decision Evaluator: heal Story 5.15 - self-service tenant founder never consumed a seat

**Decision as understood.** A fourth live-testing-derived defect found the same marathon day (22:47-22:49, extending the 2026-08-10 session's actual span to about 14h49m, later than the 22:24 end time used in the batch entry above): provisionTenantViaSignup() never called incrementActiveSeatCount() for the founding tenant_admin, unlike resolveIdentity()'s own invite-activation path - every self-service-created tenant undercounted its own founder by one seat, letting the seat-ceiling check admit one more invited user than the real license allowed. Fixed by calling the same increment function already used elsewhere; a new contract assertion proves the count directly against the database.

**Fourteen-section check.** **Learning from Failure - satisfied**, the same pattern as the other three live-testing fixes reviewed in the batch above (dba9895, 35b70a8, f4c50db/49eaa50/4551e26) - found by actually using the product end-to-end, root-caused (an inconsistency between two code paths that should have matched), fixed with a real database-verified assertion, not a patched-over symptom. **Protection and Boundaries - the same signal as the batch above, now slightly larger**: this pushes the single-day session's real end time to roughly 22:49, not 22:24, extending the already-flagged approximately 14.7-hour day by another 25 minutes. Not a new finding, folded into the existing one rather than treated as a second escalation.

**Verdict: proceed.** No adjustment beyond what the 2026-08-10 batch entry above already recommends.

**Resolves:** docs/management/pending-manager-reviews.md's 2026-08-10 entries for f36d765, 3ae641e.

---

## 2026-08-14 -- reviewed 9eef81b/8018de4 -- Decision Evaluator: remove the stray Microsoft Foundry sample project and its dead VS Code config

**Decision as understood.** Two small commits (2026-08-10, 23:27-23:32) delete the unrelated Foundry quickstart sample copied in wholesale on 2026-08-08, and its stray log/bytecode artifacts, then remove the now-dead VS Code launch/tasks config that referenced it.

**Fourteen-section check.** **Learning from Failure / Organizational Influence -- satisfied, a direct, verified close-out.** This is the exact adjustment the prior 4ff04cd/8abdb48 review asked for: is this going to become the real backend for a specific chartered AI role, or was it exploratory tooling that is now done being explored and can be removed? Verified directly: the sample is gone, not left to accumulate indefinitely as unreferenced repo surface. Same accountability loop already established by 1f8960e (Story 6.2 role-field fix) and 1dbd26a (Story 6.3 fixture removal) -- a finding was acted on, not just logged. No section at risk.

**Verdict: proceed.**

**Resolves:** docs/management/pending-manager-reviews.md's 2026-08-10 entries for 9eef81b, 8018de4.

---

## 2026-08-14 -- reviewed 8dff76b -- Decision Evaluator: ADR governance pass -- accept ADR-0044/0047/0048/0049/0050, close the WIP-limit breach

**Decision as understood.** A single commit (2026-08-11, 11:24) accepting five ADRs together: ADR-0044 (watchlist API/schema, revised in place before acceptance to add per-user personal ownership via a new RLS predicate), ADR-0047 (cross-story-reference wording pattern), ADR-0048 (connector-registration-transparency policy), ADR-0049 (point-in-time author follower count), ADR-0050 (tenant-owned-domain RSS connector) -- plus resulting story work (Story 1.5 rewritten against the corrected contract, Story 1.10 added, Story 2.10 unblocked, Stories 2.11/3.9 added), and a corrected five-day-old drift bug: ADR-0042 (Wikipedia connector) was actually accepted 2026-08-08 but three separate files kept recording it as Proposed, including a generalization clause excluding it for the wrong stated reason.

**Fourteen-section check.**

- Scope and Expectations -- satisfied, a direct, verified close-out of the exact breach flagged one session ago. The 2026-08-10 giant-day review found the WIP-limit rule broken (5 of 3 Proposed ADRs open: 0042, 0044, 0047, 0049, 0050) and recommended bringing them to review-and-decide before drafting further ones. This commit does exactly that, the very next session, bringing open Proposed ADRs to zero, confirmed directly against docs/adr/README.md's own live "Proposed (not yet decided)" section -- not merely reducing the count, closing it entirely.
- Learning from Failure -- satisfied. The ADR-0042 drift correction is exactly the class of gap documentation-steward-type tooling exists to catch, found and fixed here with a dated in-place correction across all three affected files, not a silent rewrite.
- Decision Rights and Autonomy -- satisfied. ADR-0044's in-place revision (adding personal ownership before acceptance) shows real engagement with the draft rather than rubber-stamping a batch acceptance.
- No section at risk.

**Observable signals used.** docs/adr/README.md's own "Proposed (not yet decided)" section, read directly at both the pre- and post-state; direct cross-reference against the prior review's own stated recommendation.

**Verdict: proceed.** This fully closes the one open adjustment carried forward from the prior review -- no further action needed on that specific item.

**Resolves:** docs/management/pending-manager-reviews.md's 2026-08-11 entry for 8dff76b.

---

## 2026-08-14 -- reviewed aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1 -- Decision Evaluator: 2026-08-12 morning batch (09:31-11:42) -- Stories 1.5 rebuild, 1.10, 2.10, 2.11, 3.9

**Decision as understood.** Direct build-out of the ADR batch just accepted in 8dff76b, same next-morning session, roughly 2h11m, ordinary pace: Story 1.5 rewritten against ADR-0044's actual (not stale, X-Tenant-Id-dependent) contract; Story 1.10 (Postgres boot-time readiness/GET /v1/health); a .gitignore fix for local Claude settings; Story 2.10 (connector-registration transparency, ADR-0048); Story 2.11 (tenant-owned-domain RSS connector with DNS TXT verification, ADR-0050); Story 3.9 (point-in-time author follower count, ADR-0049); and a small, honest correction to a wrong commit hash on an older (2026-08-01) Implementation Log entry.

**Fourteen-section check.**

- Outcome Stewardship / Strategic Direction -- satisfied, worth naming as the intended pattern. This is the direct opposite of the governance-outpacing-build dynamic flagged repeatedly earlier in this register (4701eff, the dc66f14/fe4c7a2 convergent finding): an ADR batch accepted one session is built out the very next morning, same day it became available, not left to accumulate as Ready-but-unbuilt backlog.
- Learning from Failure -- satisfied. 4cd4ef1 corrects a wrong commit hash on a dated log entry in place, with a dated note, rather than silently rewriting the original entry -- consistent with this project's own append-only, no-silent-rewrite convention applied even to its own small mistakes.
- Protection and Boundaries -- satisfied. Ordinary morning hours (09:31-11:42), no concern.
- No other section at risk.

**Verdict: proceed.**

**Resolves:** docs/management/pending-manager-reviews.md's 2026-08-12 entries for aaf6bd7, c5fca67, 63dcbce, 0694d2c, 8cf76a2, f2c7788, 9f90a82, afcb59e, 9f09393, 34e9dfb, 3d650c8, 4cd4ef1.

---

## 2026-08-14 -- reviewed fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9 -- Decision Evaluator: 2026-08-12 midday batch (13:10-15:45) -- Stories 6.4/6.5/6.6 rebuilt for real, ADR-0051 drafted and accepted same day, Story 1.11 built

**Decision as understood.** Three Epic 6 screens previously flagged in this register as fixture-data (the 443819e review, for Stories 6.2-6.5 originally) are rebuilt for real against live endpoints: Story 6.4 (watchlist screen, against the just-rewritten ADR-0044 contract), Story 6.5 (connector status), Story 6.6 (Platform Admin console). While rebuilding 6.5, a real architectural gap was found by direct code inspection: connectorHealth.ts's deriveConnectorHealth() never read the retryable column runIngestionAttempt.ts already writes, so a merely rate-limited connector could trip the same failing/auto-disable path as one with a genuinely revoked credential -- a gap against ADR-0010's own already-decided policy -- plus a related UX bug (Newswire hardcoded permanently "connected" with no opt-in). ADR-0051 (connector activation decoupled from credential storage) was drafted same session, revised seven times in place during live review (per its own footnote and Amendment Log), and accepted the same day -- resolving ADR-0034's own long-open Question ("does activation need its own table") with two new ownership-scoped tables mirroring the existing credential-ownership split. Story 1.11 (backend schema/REST surface) built the same afternoon; three follow-up stories (1.12, 2.12, 6.15) drafted to close three of Story 1.11's own named gaps.

**Fourteen-section check.**

- Learning from Failure -- satisfied, a strong instance. ADR-0051 originated from a real defect found during ordinary rebuild work, not a dedicated audit -- direct code inspection during Story 6.5's rebuild surfaced both the UX bug and the underlying retryable-column gap, and the response was "draft an ADR before writing code" (per Menno's own direct instruction, per the ADR's footnote) rather than patching the symptom in place -- consistent with this project's now well-established "architecturally significant gap gets an ADR, not a quick fix" discipline (ADR-0027/0028/0035's own precedent).
- Outcome Stewardship -- satisfied. Fixing activation semantics at the data-model layer before Stories 6.15/6.16 layer more UI on top of it (see the batch below) is the correct build order -- the alternative (ship more UI against a leaky abstraction, fix it later) would have been more expensive to unwind.
- Scope and Expectations -- satisfied. A same-day draft-to-accept cycle for a real architectural decision, with seven in-place revisions recorded transparently in the Amendment Log rather than accepted on a first pass, and immediately resolved (not left open against the WIP cap 8dff76b just closed).
- No other section at risk; ordinary daytime hours for this specific sub-window (13:10-15:45).

**Verdict: proceed.**

**Resolves:** docs/management/pending-manager-reviews.md's 2026-08-12 entries for fded97b, d96d782, 4046e75, 2e77c17, 51eecf0, 7102011, feae698, e430a6b, e6c0617, 18a0e38, 703e755, 7ffd477, f8985b9.

---

## 2026-08-14 -- reviewed c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae -- Decision Evaluator: 2026-08-12 afternoon-evening batch (16:26-23:50) -- Stories 1.12/2.12/6.15/6.11/6.16 built, two live-testing-derived defects fixed, a fourth marathon-day recurrence

**Decision as understood.** Continuing the same calendar day as the two batches above (session start 09:31), this stretch runs 16:26 to 23:50: Story 1.12 (real isActive on GET /v1/connectors/:platformId), Story 2.12 (exclude retryable failures from the auto-disable derivation, closing the exact gap ADR-0051 was drafted against), a Story 2.13 draft (Wikipedia connector, ADR-0042, never got a story), Story 6.15 (activate/deactivate UI controls), a real defect fix (6e110aa: an Entra sign-in with no matching users/platform_admins row still rendered the full tenant shell -- getRoleShell(null) defaulted to 'tenant' instead of rejecting; fixed with Menno's explicit sign-off since it reverses a previously deliberate test assertion, and the commit is explicit that this was never a security incident because RLS/auth held throughout, only a display-layer AC2 violation), a dev-ergonomics fix (4801a36: migrations now auto-run before dev starts, closing a "stale schema, server starts fine, then 500s" gap found live), Story 6.11 (post feed screen), a second real defect fix (99c1dcf: connector deactivation wasn't actually gating AI-provider enrichment selection), an enrichment-attribution UI addition, a style pass, a named-not-fixed gap note, Story 6.16 (manual "run enrichment now," both backend and frontend), a break-glass documentation clarification, and two small additive, unstoried features extending already-decided endpoints (tenant rename on the existing PATCH /v1/admin/tenants/:id, an optional domain field on ProvisionTenantForm).

**Fourteen-section check.**

- Protection and Boundaries -- at risk, the clearest finding here, and it needs to be named plainly as a recurring pattern, not filed as a fresh, isolated incident. This is the fourth time this register has named a long/late-hours session (2026-08-05's original flag; the 2026-08-09 03:38 late-night recurrence; the 2026-08-10 roughly 14h41m-to-14h49m marathon day; and now this 2026-08-12 span, 09:31-23:50 across all three batches above, roughly 14h19m -- nearly identical in scale to 2026-08-10's). What makes this instance different from the earlier three: it lands only one calendar day after the 2026-08-10 marathon was named directly, with the explicit recommendation to model stopping, since this charter exists to name the pattern before it produces a stall, not after. The pattern has now recurred at essentially the same scale twice within three calendar days -- a materially different signal than an isolated long day, even though (as with 2026-08-10) output quality across the day shows no visible degradation: both defect fixes in this stretch (6e110aa, 99c1dcf) are careful, root-caused, and honestly scoped, not rushed patches. This is not being scored as a quality failure. It is being named, for a fourth time, because naming it once or twice has not visibly changed the underlying pattern, and that in itself is worth Menno's own direct attention rather than another routine restatement.
- Learning from Failure -- satisfied, still this project's strongest and most consistent pattern. Both 6e110aa and 99c1dcf are live-testing-derived defects, root-caused, fixed same-day, with honest severity framing (6e110aa explicitly distinguishes "real AC violation" from "security incident" rather than either overstating or minimizing).
- Scope and Expectations -- worth a light, non-blocking note. f5bb2d4 (tenant rename) and c2aa7b1 (ProvisionTenantForm domain field) are small, additive, direct-request ("Menno's direct request, found live") extensions of already-decided endpoints (ADR-0037 section 9's own established pattern) that landed without a story number, while other small gaps found the same day (2.13, and the 1.12/2.12/6.15 trio) went through this project's own usual "draft a story first" step. Not a real inconsistency worth blocking -- closer to this project's existing no-story-ADR convention for ordinary CRUD extension -- but worth naming so it doesn't quietly become the default way small backend extensions land.
- Outcome Stewardship -- satisfied. Stories 6.11/6.15/6.16 ship real, useful end-user capability the same day the underlying activation semantics that gate them were fixed -- correct sequencing, not built on the leaky abstraction the earlier batch replaced.
- No safety/legal veto.

**Observable signals used.** git log timestamps for the full day (09:31-23:50, roughly 14h19m, direct count); direct comparison against the 2026-08-10 batch entry's own roughly 14h41m/14h49m figures and its own stated recommendation.

**Priority order.** No veto. The recurring Protection and Boundaries signal is real but does not override the day's genuine output -- it is escalated for Menno's attention, per this section's own standing recommendation, not treated as blocking anything already shipped.

**Verdict: proceed, with the recurring marathon-day pattern escalated directly to Menno's attention for a fourth time -- see final report, not filed as routine.**

**Resolves:** docs/management/pending-manager-reviews.md's 2026-08-12 entries for c3af2a7, c481e01, da102a9, 5adff09, 8abacce, cc7cae2, 62d78ff, 6e110aa, eb8b10b, 4801a36, d8ba590, 6362dda, 99c1dcf, 43d36ca, 3b5f08b, 216c32a, e556c3c, 51a2b40, 21da4f5, e5fec8f, ab37bf3, f5bb2d4, 8905c21, c2aa7b1, 8b54aae.

---

## 2026-08-14 -- reviewed 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc -- Decision Evaluator: 2026-08-13 -- Stories 6.12/6.13/1.13/6.17 built, CLAUDE.md status corrected, ADR-0053 accepted after twelve in-place revisions

**Decision as understood.** A morning session (06:00-11:33, roughly 5.5h, a normal working span) closes three of the four remaining drafting-only gaps named 2026-08-12: 57fe1de corrects CLAUDE.md's own stale Epic 6 build-status summary same morning; Story 6.12 (tenant-owned-feed connector setup UI, ADR-0050) and Story 6.13 (self-service tenant deletion/offboarding UI, ADR-0043) are built for real; Story 1.13 (live ingestion-polling scheduler, ADR-0052, drafted and accepted the same day after four in-place revisions) closes a genuinely significant functional gap -- a DNS-verified tenant-owned-feed connector and an active, credentialed GNews connector were both producing zero real ingested posts in the running server, found live; Story 6.17 (tenant-wide activate/deactivate on the tenant-owned-feed screen, ADR-0051) follows. A real roughly 7h19m gap separates this from the evening session (18:52), where bd9bbfc drafts and accepts ADR-0053 (canonical Markdown post-body normalization) after twelve in-place revisions during live review -- the deepest review pass of any ADR in this series, and the item Menno specifically flagged for this Manager's own direct assessment.

**Fourteen-section check.**

- Learning from Failure -- satisfied, two distinct strong instances. Story 6.13's own build caught and reverted a real regression before commit: an initial version added a tenant_admin-only link to the shared /tenant/settings screen, which would have broken Story 6.9's own already-sealed AC ("no additional role gate") -- reverted via heal-contract-failure, with the resulting gap (no in-app link to the deletion screen) documented honestly in the component's own SKILL.md rather than silently worked around. This is the pre-commit version of the same discipline the 9a99257 Story 3.8 design correction showed earlier in this project's history. 57fe1de is a small instance of the same discipline applied to CLAUDE.md itself -- corrected same-morning rather than left to drift for days, unlike the core-client.ts/session.ts stale-comment gap flagged (and left unaddressed for a stretch) in the 443819e review.
- Outcome Stewardship -- satisfied, worth naming directly. Story 1.13 closes a gap this project, by name a "Social Listening" product, genuinely could not afford to leave open indefinitely: real, credentialed, activated connectors producing zero ingested posts because nothing was actually polling them. This is exactly the kind of prioritization Sec 8 asks for -- a real functional gap found live, closed at the priority it warranted, not left behind newer feature work.
- Scope and Expectations / Organizational Influence -- the ADR-0053 twelve-revision pass, assessed directly as requested. Reading the ADR's own Amendment Log directly (not summarized secondhand): every one of the twelve revisions closes a concrete, mostly security- or correctness-relevant gap in a decision that stores, and will eventually render, untrusted third-party HTML as Markdown -- sanitization ordering and configuration argued from turndown's own security documentation, a length guard against unbounded untrusted input, a tracking-parameter dead-link edge case, a real GFM-table data-loss gap found by reading the actual library source rather than assuming, an honestly-flagged unverifiable-without-a-live-key assumption, a named-not-fixed write-ordering/cost-exposure gap, and a documented consumer contract for how the new column must be safely rendered later (the pre-acceptance revision). The twelfth revision is worth naming specifically: Menno requested a critical review of an independent Copilot review of this same ADR, and six of its eight findings were explicitly rejected or downgraded with stated reasoning -- a proposed metrics/observability requirement was downgraded as genuine scope creep into infrastructure this project has neither built nor decided to build, explicitly citing ADR-0020's own "don't build ahead of a demonstrated need" precedent -- while the two accepted findings were independently re-verified in the actual codebase before being written in, not taken on the reviewer's authority. Assessment: this depth is proportionate and well-directed, not process bloat. The twelve-revision count reflects the number of distinct, independently-verified gaps actually found in a decision whose blast radius (HTML from wire services, GNews, and any domain a tenant can point a feed at) genuinely warrants this level of scrutiny -- the same "verify directly, don't rubber-stamp" discipline this register already found satisfied in Story 5.15's grant-widening reasoning and ADR-0051's own investigation, applied here to an external review as well as Menno's own drafting. The one caution worth naming, not as a finding but as a forward-looking watch item: this lands in the same calendar day as an already-flagged marathon (2026-08-12) and is itself a substantial time investment; it is worth checking again whether this depth is being reserved for genuinely security-adjacent decisions (as it clearly was here) or becomes this project's default per-ADR depth regardless of actual risk -- nothing in this instance suggests the latter.
- Protection and Boundaries -- satisfied for this specific day, distinctly better than 2026-08-12: a real roughly 7h19m gap separates the morning build session from the evening ADR review, a genuine stopping point within the day rather than one continuous span.

**Observable signals used.** git log timestamps for the full day; direct read of ADR-0053's own Amendment Log (all twelve entries) and its Acceptance note; cross-check of CLAUDE.md's current Epic 6 status line against docs/user-stories/README.md's own dated 2026-08-13 notes (both agree: 6.12/6.13 built, 6.14 still drafted-only).

**Priority order.** No safety/legal veto for any item; the ADR-0053 depth question sits at Process Optimization / Team Sustainability tier and is resolved in this project's favor on its own evidence, not overridden by anything higher in the order.

**Verdict: proceed.** No adjustment needed -- the ADR-0053 review depth is assessed as proportionate given what it actually covers, and the day's own internal stopping gap is a genuine, positive counter-example to the pattern flagged in the entry above.

**Resolves:** docs/management/pending-manager-reviews.md's 2026-08-13 entries for 57fe1de, e1e9913, b155bc5, 500a4b9, 42ff7b5, a479383, 9a347c6, d0eb088, 780f981, bd9bbfc.

---

## 2026-08-18 -- reviewed dcec172/df0c2c3/867ce87 -- Decision Evaluator: Story 3.10 shipped, plus a real gap found in this project's own review-queue mechanism

**Decision as understood.** Three 2026-08-13 commits, never queued for any of the three review passes at commit time because the session that made them -- like this one -- is a fresh cloud sandbox clone with no `.git/hooks/post-commit` installed: `dcec172` builds Story 3.10 for real (canonical Markdown post-body storage, a shared `htmlToMarkdown()` pipeline, all three connectors updated to enrich on real body content instead of title-only/title+description, plus a genuine unanticipated `sanitize-html`/`htmlparser2` CJS-vs-ESM dependency break found and fixed mid-implementation); `df0c2c3` logs it; `867ce87` tightens the Documentation Steward's own charter to name all nine Project Management Plans explicitly instead of an unenumerated "nine files" reference.

**Fourteen-section check.**

- Learning from Failure / Organizational Influence -- the substantive finding of this pass. The queue mechanism this project relies on ("a post-commit hook queues every commit automatically, one entry per commit") silently does not hold in every environment this project's own AI roles actually run in: a fresh clone in a cloud sandbox never installs `.git/hooks/post-commit` unless `scripts/setup-git-hooks.js` is run by hand, and nothing currently does that automatically on session start. Three real commits went unqueued and unreviewed by any of the three roles until this pass cross-checked `git log` directly against each queue file's own last-reviewed commit and caught the gap -- an empty "Pending review" grep alone would have looked identical to a genuinely caught-up queue and reported nothing to review. This is exactly the class of finding this section exists to catch: not a one-off documentation slip, a structural blind spot in how the review pipeline itself gets invoked. Reported plainly here and in the Documentation Steward's own matching note, rather than quietly patched over by backfilling the three missed entries and moving on without naming it.
- Scope and Expectations -- satisfied for the story build itself. Story 3.10's own contract (25/25) and the full suite (59/59, 450/450) are both named directly in the commit message and verified against `docs/implementation-log.md`'s matching entry; the mid-implementation `sanitize-html`/`htmlparser2` ESM break was found and fixed within scope, not deferred or worked around with a shortcut that would have left a real defect in place.

**Priority order.** No safety/legal veto for either item. The queue-mechanism gap is a Learning from Failure / Organizational Influence finding with real consequence (up to three real commits per broken-hook session going unreviewed, silently) but no urgency spike of its own -- this pass's own retroactive backfill already closes the specific instance found. It does not override the Story 3.10 build assessment, which stands on its own merits.

**Verdict: proceed** on the Story 3.10 work itself -- clean, well-scoped, honestly documented, no adjustment needed. **A real follow-up recommended, not decided here:** whether to durably fix the hook-installation gap (a `SessionStart` hook running `scripts/setup-git-hooks.js` on every fresh clone, or explicit documentation that cloud sessions must install it by hand) is Menno's call, since it's an infrastructure change outside any of the three AI roles' own chartered scope -- but the risk it poses (silent gaps in the exact mechanism this whole review pipeline depends on to even know what to look at) is a real management-visibility finding, which is why it's named here rather than left only in the Documentation Steward's own file-scoped note.

**Observable signals used.** `git log --oneline` since the last commit this register's own prior entry (above) actually covers (`bd9bbfc`), cross-checked against all three queue files' own content to confirm `dcec172`/`df0c2c3`/`867ce87` were genuinely absent, not merely unresolved; `ls .git/hooks/post-commit` (absent) vs `scripts/git-hooks/post-commit` (present as a template) confirming the mechanism, not just its symptom; direct read of Story 3.10's own commit message and `docs/implementation-log.md`'s matching entry for the test counts and the mid-build dependency-pinning fix.

**Resolves:** docs/management/pending-manager-reviews.md's 2026-08-18 entries for dcec172, df0c2c3, 867ce87.
