# Pending Documentation Steward Reviews

**Queued by:** `scripts/git-hooks/post-commit`, one entry per commit, automatically, non-blocking. **Reviewed by:** the Documentation Steward (`.claude/agents/documentation-steward.md`) whenever a Claude Code session is actively working in this repo and checks this file — not a live daemon, not guaranteed same-day. Append-only, same discipline as `docs/implementation-log.md`: a reviewed entry gets struck through with a dated resolution note (what drift was found, if any, and which files were corrected), never deleted.

**What "reviewed" means here:** the Documentation Steward may edit stale docs directly (`Edit`/`Write` tools, added 2026-08-06 specifically so it can propose real corrections, not just describe them) — but it never commits its own changes. A human commit (Menno's own, or Claude Code committing only when explicitly asked to) is the approval gate, the same "propose in the working tree, human commit confirms" pattern this project already uses for every other AI-role output. An entry here is only marked resolved once its proposed corrections have actually been committed, not merely drafted.

---
## ~~2026-08-06 — aa4bf87 — Extend Documentation Steward to PM docs, add a Learning & Development Writer, wire two more Foundry Prompt Agents~~

- **Full commit:** `aa4bf872a2acb36d6e15519d0f86ea1acace5f10`
- **Files touched:** .claude/agents/documentation-steward.md, .claude/agents/learning-development-writer.md, docs/ai-roles/.env.example, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs, docs/manuals/system-admin-manual.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, scripts/git-hooks/post-commit, scripts/setup-git-hooks.js — confirmed via `git diff-tree --no-commit-id --name-only -r aa4bf87`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06, real drift found and corrected in the working tree (not yet committed):**
  1. `docs/ai-roles/README.md` — this commit wired two real, portal-authored Foundry Prompt Agents (`engineering-pragmatism-reviewer`, `LegalComplianceReviewer`) into `invoke-azure-foundry-agent.mjs`'s `--role` selector and `.env.example`, but never touched this file: it still said Legal & Compliance "has a provisioned Foundry model deployment but no Prompt Agent object of its own yet — not wired into this script speculatively ahead of that" (now false), and Engineering Pragmatism's own table row didn't mention any Foundry backend at all. Corrected: table rows for both roles updated, a dated "Documentation Steward correction, 2026-08-06" paragraph added next to the now-stale sentence (left in place, not deleted, per that file's own convention), and the "internal roster" sentence updated to list the new `learning-development-writer.md` subagent (added by this same commit but never added to that enumeration) and its Stakeholder Register S-number.
  2. `docs/project docs/Stakeholder-Register.md` — this commit (a) extended Documentation Steward's (S-13) own scope to the PM docs and gave it `Edit`/`Write` tools, and (b) created a brand-new `learning-development-writer` subagent with real `Edit`/`Write` access to `docs/manuals/` — neither change was reflected in this register at all: S-13's row/narrative still read as if scoped only to the original five engineering-side artifacts, and the new role had no S-number, no table row, and no narrative paragraph anywhere. Corrected: S-13's row and Section 3.4 narrative both updated with a dated addendum; a new **S-25** row and matching Section 3.4 narrative paragraph added for the Learning & Development Writer, classified Governed on the same basis as S-13/S-24 (mirrors this register's own established precedent for registering a newly-chartered internal role immediately, e.g. how S-22–S-24 were added 2026-08-05) — Section 4's "Governed" category enumeration updated to include it. Left open, flagged rather than decided: whether S-25 also belongs in the specific "five roles chartered under the 'pull hard on one domain' principle" list in Section 4 — that's a classification call for Menno, not resolved here.
  3. **Real drift found but explicitly outside this role's own chartered file scope, reported rather than fixed:** `docs/manuals/tenant-admin-manual.md` (added by this same commit) claims "Stories 6.3-6.5... are Ready but not yet built" and lists connect flow, watchlist management, and connector status as having no screen in `social-listening-admin` yet. Per `docs/user-stories/epic-6-admin-ui.md` and `docs/user-stories/README.md`'s own 2026-08-05 dated note, Stories 6.2, 6.3, 6.4, and 6.5 were already **built** (commits `443819e`/`67430b7`/`57926be`/`99caf05`) *before* this manual was even written — the manual's own "What's not built yet" section is factually wrong the moment it was committed. This is squarely `docs/manuals/*.md` territory, the Learning & Development Writer's (S-25) own exclusive charge per its charter, not one of the files this role's own "What to check" list names — not edited here; flagged for the Learning & Development Writer's own queue/next pass, or for Menno directly.
  4. Everything else checked clean: `docs/implementation-log.md` (not touched by this commit; append-only history confirmed unaffected), `docs/adr/README.md`, `docs/user-stories/README.md`/epic files, `docs/implementation-plan.md`'s traceability table, and component `SKILL.md` files all have no reference to anything this commit changed — no drift found against any of them.

## ~~2026-08-06 — 55a02ab — Queue commit aa4bf87 for Manager, Documentation Steward, and Learning & Development review~~

- **Full commit:** `55a02aba43dec394c8f01c945cf48caa9e3996bb`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md — confirmed via `git diff-tree --no-commit-id --name-only -r 55a02ab`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** Purely mechanical: appends the aa4bf87 queue entry to all three review-queue files. Nothing here makes any factual claim about shipped/decided project state for this role to audit.

## ~~2026-08-06 — 2106034 — Record two parked AI-role ideas: Infrastructure/Go-Live Readiness, Cost/FinOps~~

- **Full commit:** `2106034da535a6b7dd3bee6d98b0c7116ea288ac`
- **Files touched:** docs/ai-roles/README.md — confirmed via `git diff-tree --no-commit-id --name-only -r 2106034`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** Adds a self-contained "Parked ideas" section naming two not-yet-built, not-yet-chartered roles (Infrastructure/Go-Live Readiness Reviewer, Cost/FinOps Reviewer), explicitly not registered anywhere else per its own text — correctly so, since neither is chartered or invocable yet (this register's own S-21 precedent: a role gets an S-number only once it's real and invocable, not while merely "parked"). No cross-reference elsewhere in the project claims otherwise.

## ~~2026-08-06 — a251050 — Implement Story 5.16: Same-Domain Invite Assist backend surface~~

- **Full commit:** `a2510508f543c8c10c12cfc3631675f88839964c`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/same-domain-invite-assist/SKILL.md, social-listening-core/contracts/epic-5/story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts, social-listening-core/src/http/versions/v1/domainSignupAttemptsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/tenants/domainSignupAttempts.ts, social-listening-core/src/tenants/selfServiceSignup.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** `docs/open-decisions.md`'s §1 entry is correctly struck through and resolved (backend half only, Story 6.10 named as the remaining UI piece); `docs/implementation-plan.md` and `docs/user-stories/README.md`/`epic-5-...md` all carry matching dated notes; the new `same-domain-invite-assist/SKILL.md` accurately cites ADR-0037 §8b/§8c and Story 5.15/5.16 and matches the contract's own assertions (tenant_admin-only, RLS-scoped, distinct-email escalation at exactly 3, single-fire, reused `tenant_signup_role` grants).

## ~~2026-08-06 — 29914e2 — Log Story 5.16 in the Implementation Log~~

- **Full commit:** `29914e2aa914c407cdbd126261ed5dea01b13bed`
- **Files touched:** docs/implementation-log.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** Log entry's own file list matches `git diff-tree --no-commit-id --name-only -r a251050` exactly; appended only, no prior entry edited.

## ~~2026-08-06 — 63b5ce1 — Process Ideal Manager, Documentation Steward, and L&D Writer review queues~~

- **Full commit:** `63b5ce1a1c3b5d74d2fd9e6ff8dca4cee635285a`
- **Files touched:** docs/ai-roles/README.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/project docs/Stakeholder-Register.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** This is the commit that actually landed the corrections this role's own prior (aa4bf87) pass had proposed but not yet had committed — verified the landed `docs/ai-roles/README.md` and `Stakeholder-Register.md` text against real state (S-25 charter file exists, `--role pragmatism`/`--role legal-compliance` really wired in `invoke-azure-foundry-agent.mjs`) and it matches exactly what was proposed.

## ~~2026-08-06 — 1f8960e — Heal Story 6.2: ResolvedIdentity is a discriminated union, not a flat {role}~~

- **Full commit:** `1f8960ef3058e28a20ddc678c6b202ec71441cd3`
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/jest.config.js, social-listening-admin/src/app/api/auth/callback/route.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/app/tenant/page.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/role-routing.ts, social-listening-admin/src/lib/session.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** `role-routing-shell/SKILL.md`'s rewritten Load-bearing constraints accurately describe the real fix (discriminated union, `isResolvedIdentity()`, `isShellAllowed()`, both route trees now redirect server-side) and honestly name the pre-existing gap (zero server-side gating before this pass) rather than minimizing it.

## ~~2026-08-06 — fb2eabc — Log the Story 6.2 healing pass in the Implementation Log~~

- **Full commit:** `fb2eabc2c3c69cd88fa489cc4189c3839ee865a8`
- **Files touched:** docs/implementation-log.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** File list matches `git diff-tree`; appended only.

## ~~2026-08-06 — 35f056a — Learning & Development Writer: one-time whole-project manual catch-up~~

- **Full commit:** `35f056a61ca013a7c81955c2198790cd37bb30c3`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/manuals/system-admin-manual.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** Not this role's own file scope (manuals belong to the Learning & Development Writer, S-25), but spot-checked for accuracy anyway: `tenant-admin-manual.md`'s new Story 6.8/6.9 backend references (Story 1.9, Story 1.8) are verified correct against `docs/user-stories/epic-6-admin-ui.md`'s own Source lines; `system-admin-manual.md`'s correction correctly cites `social-listening-admin@1f8960e` for the getRoleShell() fix.

## ~~2026-08-06 — 2061e72 — Add a standing author-rights check to the requirements-analyst charter~~

- **Full commit:** `2061e723e124f3a3b0769c21fb6bb5f7d7aab6f0`
- **Files touched:** .claude/agents/ba-requirements-analyst.md, docs/future-subsystems.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** `future-subsystems.md`'s new Author-authorship entry correctly cites ADR-0004, ADR-0027, and ADR-0039's own legal-competence boundary language; the charter addition is scoped as a standing check, not a one-off, with an explicit "don't force a home that doesn't exist yet" guard.

## ~~2026-08-06 — 4f7d9b9 — Write up real connector research: Reddit, X, YouTube, Meta, Wikipedia~~

- **Full commit:** `4f7d9b9e1848c8a9063f6c8ca5ca0edfb80e30b2`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** Pure research/groundwork, explicitly framed throughout as "not yet a decision" — no claim of shipped/decided state to go stale.

## ~~2026-08-06 — 82ca1e2 — Accept ADR-0041: Platform Admin is a distinct identity kind~~

- **Full commit:** `82ca1e219840370ce62e3a586348130502a8e9e9`
- **Files touched:** docs/adr/0030-admin-tier-design-platform-admin-rls-exception.md, docs/adr/0032-users-table-shape-and-rls.md, docs/adr/0035-admin-ui-shape-one-app-role-gated.md, docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, docs/adr/0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md, docs/adr/README.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean on its own terms; surfaced pre-existing PM-doc drift elsewhere, corrected (see the 1187116 entry below for the fixes).** `docs/adr/README.md`'s table/footnote and all four ADRs' own "Note on relation to ADR-0041" additions are accurate and correctly use the append-only Decision-preserving convention. Reviewing this ADR's real, shipped consequences (Platform Admin/Tenant-Admin now have real code, tables, and an authentication path) is what surfaced the Stakeholder-Register.md staleness fixed under the 1187116 entry below, and the `Uncertainty-Management-Plan.md`/`Go-Live-Readiness-Definition.md`/`Development-Approach-and-Life-Cycle-Plan.md` drift noted there too.

## ~~2026-08-06 — 6e4321f — Knowledge-graph review: Wikipedia connector authorship modeling~~

- **Full commit:** `6e4321fd5b08aa078bc1bb8aa0af21842c4e7830`
- **Files touched:** docs/architecture/knowledge-graph-register.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** Finding is internally consistent (relational storage still sufficient; the real defect named is a cardinality-collapse anti-pattern, not a graph-shaped gap) and correctly distinguishes itself from `future-subsystems.md`'s separate Author-merge/dedupe gap rather than conflating the two.

## ~~2026-08-06 — c0179f4 — Migrate Data Privacy/Sovereignty reviewers off Ollama to Foundry~~

- **Full commit:** `c0179f41db5b7ca9fdd83812897f7c66de28d9d9`
- **Files touched:** docs/ai-roles/.env.example, docs/ai-roles/README.md, docs/ai-roles/data-privacy-sovereignty-reviewer.md, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06, real drift found and corrected in the working tree (not yet committed):** `docs/ai-roles/README.md` itself was updated correctly by this commit, but the PM-side docs this role now also covers were not.
  1. `docs/project docs/Stakeholder-Register.md` — S-16 and S-23's table rows and their Section 3.4 narrative paragraphs still described both reviewers as pure Ollama/self-hosted. Corrected: both rows get a struck-through-and-corrected mechanism note (migrating to Foundry, agent/role names cited), and both narrative paragraphs get a dated "Documentation Steward correction" note pointing to the real reason (Ollama's own `fetch failed` under load) — original prose left in place, per this register's own convention.
  2. `docs/project docs/Project Management Plans/Stakeholder-Management-Plan.md` §5.4 Level 3 table — still listed "Ollama — Data Privacy" with no mention of the migration, and was already missing S-22/S-23/S-24/S-25 entirely (pre-existing gap, not caused by this commit). Corrected the Ollama mention; flagged (not added) the missing rows, since which engagement tier each belongs in is a classification call outside this role's charter.
  3. `docs/project docs/Project Management Plans/Planning-Management-Plan.md` §5.3.2 — same stale Ollama-only framing, plus "Azure AI Foundry | Model hosting (future) | Not yet used" (false — three roles now use it) and "Documentation Steward | Not yet exercised" (false — this table itself). All three corrected in place; missing S-22–S-25 rows flagged, not added, same reasoning as above.
  4. `docs/project docs/Project Management Plans/Cost-Management-Plan.md` — C-13's Ollama row didn't reflect the migration. Corrected.
  5. Everything else checked clean: `docs/adr/README.md`, `docs/user-stories/README.md`, `docs/implementation-plan.md`, and every `SKILL.md` have no reference to this commit's subject matter.

## ~~2026-08-06 — 1187116 — Add stakeholder profiles for 12 personas across current and future scope~~

- **Full commit:** `11871169a72450e7275635ca2e4e9394ff4f676d`
- **Files touched:** docs/project docs/Stakeholder Management/Author-of-a-Post-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Data-Subject-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Legal-Advisor-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Platform-Admin-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Social-Selling-Strategist-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Sole-Operator-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Admin-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Brand-Reputation-Manager-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Business-Analyst-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Reader-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Social-Care-Agent-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-User-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Topic-Center-Analyst-Stakeholder-Profile.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06, real (pre-existing, not introduced by this commit) drift found and corrected in the working tree (not yet committed):**
  1. **`docs/project docs/Stakeholder-Register.md` Section 1 (Platform Admin, Tenant-Admin, Tenant User paragraphs) and S-08's table row were significantly stale**, in exactly the class this role's own charter names as its worked example: "Platform Admin (brainstormed 2026-07-30, not yet built)... No code, table, or authentication path implements this persona yet" and the identical framing for Tenant-Admin, plus S-08's "no code, table, or authenticated identity exists yet." All false as of this pass — real tables (ADR-0031/0032), real Postgres roles (ADR-0030), real identity resolution and route-gating (Stories 5.9–5.11, 6.1, 6.2), and ADR-0041 (Accepted 2026-08-06, formalizing Platform Admin as a distinct identity kind) all exist and ship. This commit's own new `Platform-Admin-Stakeholder-Profile.md` repeats the identical stale claim ("Status: Not yet instantiated in production code") verbatim, which is what surfaced the register's own matching staleness during this review. Corrected: dated correction notes added after each of the three Section 1 paragraphs and inline in the S-08 table row, preserving what remains genuinely true (no *live*, non-test individual occupies either role yet — Stage 0 Go-Live gate; Tenant Reader/Tenant Business Analyst remain deliberately undifferentiated from `tenant_user`, ADR-0032 §4). Status line bumped v2.8 → v2.9 with a ninth addendum summary.
  2. **The thirteen new `Stakeholder Management/*-Profile.md` files themselves carry the same class of staleness** (at minimum, `Platform-Admin-Stakeholder-Profile.md`'s "Status: Not yet instantiated in production code" and its repeated "tenant information is unavailable to the Platform-Admin" framing, which overstates ADR-0030 §2's actual boundary — Platform Admin *can* read/write `tenants`-table fields like name/domain/seat-count via Story 5.12, just never tenant-*content* tables) — **not fixed here.** This subfolder is not one of the four/nine files this role's own charter names (`Stakeholder-Register.md`, `Business-Case-v6.0.md`, `Project-Charter.md`, the nine Project Management Plans), so corrections here would exceed this role's own chartered file scope — flagged for Menno or a scope-extension decision, not fixed unilaterally.
  3. **This commit's own message names a real, self-acknowledged gap** — "Not yet cross-referenced from Stakeholder-Register.md — a real follow-up, not done here." Confirmed still true; not resolved here either, since which of the two new external stakeholders (Author-of-a-Post, Data-Subject already partly covered in §3.3) get formal Section 1/2 entries, and how the ten already-registered personas' profiles should be cross-linked, is a content/classification decision for Menno or a future BA pass, not a factual staleness fix.
  4. **Additional PM-doc drift found during this same full-scope pass, pre-existing and not caused by any single queued commit — corrected:**
     - `docs/project docs/Project Management Plans/Uncertainty-Management-Plan.md` Appendix D — R-04's status ("Open — ADR-0029–0033 accepted, implementation in progress (Phase 4.5)") and R-05's status ("Open — ADR-0030–0032 accepted") both understated real, shipped completion (Phase 4.5 fully shipped per `docs/implementation-log.md`; this is the exact R-04 staleness this role's own charter names as a real, previously-hit example). Corrected both rows and their Risk Response Summary bullets to "Resolved," Probability/Impact ratings left untouched.
     - `docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` §7 — claimed "no code path capable of onboarding a real user exists yet (Stories 5.15/5.16/6.7 are Ready but unbuilt)"; Stories 5.15 and 5.16 are actually built. Corrected with a dated note that sharpens rather than closes the real gap (a real, working, unrate-limited signup endpoint already exists; Story 5.18/rate-limiting is the actual remaining precondition).
     - `docs/project docs/Project Management Plans/Development-Approach-and-Life-Cycle-Plan.md` — its own phase table had silently diverged from `docs/implementation-plan.md`: Phase 4.5 (a real, fully-built phase per `docs/implementation-plan.md`, inserted 2026-08-03) was missing entirely. Row added, matching `docs/implementation-plan.md`'s own Goal/Deliverable/story list.
  5. Everything else checked clean: `docs/adr/README.md`, `docs/user-stories/README.md`, `docs/implementation-plan.md`'s traceability table, `docs/implementation-log.md` (append-only, unaffected), and every component `SKILL.md` have no reference to anything this commit changed.

## ~~2026-08-06 — 464e05a — Add a findings register for the Data Privacy & Sovereignty Reviewer~~

- **Full commit:** `464e05a91401c4d263b14a2c35a14fda75758d3f`
- **Files touched:** docs/ai-roles/README.md, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs, docs/privacy/data-privacy-sovereignty-register.md — confirmed via `git diff-tree --no-commit-id --name-only -r 464e05a`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no drift.** `docs/ai-roles/README.md`'s own Data Privacy & Sovereignty row and `invoke-azure-foundry-agent.mjs`'s `ROLES.data-privacy` entry are both correctly wired to the new `docs/privacy/data-privacy-sovereignty-register.md` (verified the path resolves and the file exists), matching every other role's already-established register-column convention (S-22/S-23's own rows). Nothing in `docs/adr/README.md`, `docs/user-stories/README.md`, `docs/implementation-plan.md`, any `SKILL.md`, or `docs/project docs/Stakeholder-Register.md`'s S-16 row/narrative claims otherwise or needs a matching update — no other role's S-number row names its own findings-register path either, so this isn't an inconsistency.

## ~~2026-08-06 — cd308eb — Add real, auto-derived commit time-logging to post-commit; fix stale template~~

- **Full commit:** `cd308ebaa482415254a0d3eba62cb6f2ff75ecb1`
- **Files touched:** docs/templates/time-tracking.md, docs/time-tracking.md, scripts/git-hooks/post-commit — confirmed via `git diff-tree --no-commit-id --name-only -r cd308eb`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06, real (pre-existing, not introduced by this commit) PM-doc drift found and corrected in the working tree (not yet committed):** `docs/project docs/Project Management Plans/Project-Work-Management-Plan.md` §5.1.3 step 4 ("Track Time Spent") carried an already-once-corrected (2026-08-06, earlier) note asserting "`docs/time-tracking.md` still reads 'Total Time: 0 minutes'" and that a time-tracking hook was "still entirely undesigned" — both now false: `docs/time-tracking.md`'s log table carries real auto-derived rows and the mechanism this commit built is a real, designed, shipped hook (just a structurally different one — commit-message-derived, no prompt, honest `—`/`auto` gaps — from the interactive prompt this plan's own bullets originally described). Corrected with a new dated note (not an edit to the existing two), walking through each of the five original "Intended to..." bullets against what actually shipped. `docs/project docs/Project Management Plans/Cost-Management-Plan.md` §5.2.5 checked separately — describes a different, still-accurate mechanism (`docs/implementation-log.md`'s own git-timestamp-gap session-duration proxy), not contradicted by this commit. Everything else in this role's own scope (`docs/adr/README.md`, `docs/user-stories/README.md`, `docs/implementation-plan.md`, `SKILL.md` files, `docs/implementation-log.md`) has no reference to this commit's subject matter.

## ~~2026-08-06 — 406bf2c — Fix: auto-derived time-log row landed after the file footer, not in the table~~

- **Full commit:** `406bf2c327a88b188eb204eef11605acebb235f4`
- **Files touched:** docs/time-tracking.md, scripts/git-hooks/post-commit — confirmed via `git diff-tree --no-commit-id --name-only -r 406bf2c`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-06 — clean, no further drift beyond what the cd308eb entry above already covers.** Purely a same-day fix to that commit's own insertion bug (row landed after the file footer, moved into the table); the substantive Project-Work-Management-Plan.md correction above already accounts for both commits' combined effect.

## 2026-08-06 — Documentation Steward full-scope pass: closes a real, explicitly self-acknowledged gap from commit `1187116`'s own message

- **Not a queued entry — a follow-up on the already-resolved `1187116` entry above, per this file's own append-only convention (a correction is a new, dated entry that references the one being corrected, never an edit to the original).**
- **What was found:** `1187116`'s own resolution note above (item 3) confirmed, but explicitly left open, the gap that commit's own commit message named: "Not yet cross-referenced from Stakeholder-Register.md — a real follow-up, not done here." Independently re-derived and confirmed still real on this pass: `docs/project docs/Stakeholder Management/` (13 profile documents) had zero cross-reference from `Stakeholder-Register.md` anywhere.
- **What was corrected:** `docs/project docs/Stakeholder-Register.md` — Status line bumped v2.9 → v2.10 (tenth addendum), and a new dated note plus a 13-row cross-reference table added at the end of Section 1, mapping each `Stakeholder Management/*-Stakeholder-Profile.md` file to the existing Section 1 paragraph / Section 2 S-number it matches. **`Author-of-a-Post-Stakeholder-Profile.md` is named as the one profile with no matching entry anywhere in this register** — flagged as a content/classification decision for Menno or a future BA pass (same class of judgment call the register's own sixth addendum already made once), not decided here. A second, narrower gap in the profile documents themselves (`Platform-Admin-Stakeholder-Profile.md`'s own stale "Status: Not yet instantiated in production code" and an overstated "tenant information is unavailable to the Platform-Admin" framing — verified against ADR-0030 §2, which scopes the boundary to tenant-*content* tables, not the `tenants` table Platform Admin can read/write via Story 5.12) is named but explicitly not fixed, since `Stakeholder Management/` is not one of the four/nine files this role's own charter names.

## 2026-08-06 — f932f41 — Draft ADR-0042: Wikipedia connector (MediaWiki API, article-as-Author)

- **Full commit:** `f932f4115021702a264f3cb1c2852bb1a09d9280`
- **Files touched:** docs/adr/0004-author-normalized-separately-from-post.md, docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md, docs/adr/README.md
- **Status:** Pending review

## 2026-08-06 — 3a757b7 — Legal & Compliance Reviewer: first real review, ADR-0038

- **Full commit:** `3a757b704fb9496a415ec3a8e08c1747c1e4057a`
- **Files touched:** docs/legal/legal-compliance-register.md
- **Status:** Pending review

## 2026-08-06 — 7dddb56 — Data Privacy & Sovereignty Reviewer: first real review

- **Full commit:** `7dddb5660e012aab3c3c2d5f02a331ef60df8d54`
- **Files touched:** docs/privacy/data-privacy-sovereignty-register.md
- **Status:** Pending review

## 2026-08-06 — f5e4e41 — Documentation Steward: close the Stakeholder Management cross-reference gap

- **Full commit:** `f5e4e41e8cb12e42995398045d945cf038d07071`
- **Files touched:** docs/pending-documentation-steward-reviews.md, docs/project docs/Project Management Plans/Cost-Management-Plan.md, docs/project docs/Project Management Plans/Development-Approach-and-Life-Cycle-Plan.md, docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md, docs/project docs/Project Management Plans/Planning-Management-Plan.md, docs/project docs/Project Management Plans/Project-Work-Management-Plan.md, docs/project docs/Project Management Plans/Stakeholder-Management-Plan.md, docs/project docs/Project Management Plans/Uncertainty-Management-Plan.md, docs/project docs/Stakeholder-Register.md
- **Status:** Pending review

## 2026-08-06 — 3c96b74 — Auto-queue bookkeeping and time-log rows for recent commits

- **Full commit:** `3c96b74d1a0e56136cc66a7f5a80306b5aeb90d9`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

