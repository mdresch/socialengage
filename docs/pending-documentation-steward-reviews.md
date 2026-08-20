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

## ~~2026-08-06 — f932f41 — Draft ADR-0042: Wikipedia connector (MediaWiki API, article-as-Author)~~

- **Full commit:** `f932f4115021702a264f3cb1c2852bb1a09d9280`
- **Files touched:** docs/adr/0004-author-normalized-separately-from-post.md, docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md, docs/adr/README.md — confirmed via `git diff-tree --no-commit-id --name-only -r f932f41`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no residual drift.** ADR-0042's full history since this draft (accepted 2026-08-08, a real four-day gap where `docs/adr/README.md`'s own "Still outstanding" section wrongly kept dropping and re-adding it, finally caught and corrected 2026-08-12, Story 2.13 added) is fully and accurately captured in `docs/adr/README.md`'s own footnote 16 and Proposed-section history — verified directly against the current file, which is self-correcting and internally consistent. ADR-0004's own Pending-supersession note for this ADR is present and correctly worded. No cross-reference anywhere still treats ADR-0042 as Proposed or un-storied.

## ~~2026-08-06 — 3a757b7 — Legal & Compliance Reviewer: first real review, ADR-0038~~

- **Full commit:** `3a757b704fb9496a415ec3a8e08c1747c1e4057a`
- **Files touched:** docs/legal/legal-compliance-register.md — confirmed via `git diff-tree --no-commit-id --name-only -r 3a757b7`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean on this role's own chartered file scope; one item named, not fixed, as genuinely out of scope.** `docs/legal/legal-compliance-register.md` itself is not one of this role's chartered files (Stakeholder-Register.md, Business-Case-v6.0.md, Project-Charter.md, the nine PMPs, plus ADRs/stories/SKILL.md/implementation-log) — matching the precedent already set for the sibling privacy register (see the 464e05a entry above, which checked wiring/cross-reference, not finding content). Finding #6's premise ("tenant offboarding/erasure... has been repeatedly named as out-of-scope") and the "Net compliance posture" line are both now dated by ADR-0043/Story 3.8 (self-service tenant deletion, shipped 2026-08-07, after this review) — real content drift, but resolving an open legal finding is this register's own resolution-note convention (Menno or a follow-up Legal & Compliance Reviewer pass), not this role's to silently mark closed, and `Go-Live-Readiness-Definition.md` §1 already establishes that every open item in this exact register is pre-Go-Live technical debt re-triaged at stage transitions, not continuously kept current here. Flagged, not fixed. No cross-reference in this role's own chartered files (ADR-0038, `docs/ai-roles/README.md`, `docs/project docs/Stakeholder-Register.md` S-22) misdescribes this register's existence or wiring.

## ~~2026-08-06 — 7dddb56 — Data Privacy & Sovereignty Reviewer: first real review~~

- **Full commit:** `7dddb5660e012aab3c3c2d5f02a331ef60df8d54`
- **Files touched:** docs/privacy/data-privacy-sovereignty-register.md — confirmed via `git diff-tree --no-commit-id --name-only -r 7dddb56`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, same reasoning as the 3a757b7 entry directly above.** Register's own findings content is out of this role's chartered scope (re-triaged at Go-Live stage transitions, per `Go-Live-Readiness-Definition.md` §1); no cross-reference in `docs/project docs/Stakeholder-Register.md` (S-23) or `docs/ai-roles/README.md` misdescribes this register's existence, path, or wiring.

## ~~2026-08-06 — f5e4e41 — Documentation Steward: close the Stakeholder Management cross-reference gap~~

- **Full commit:** `f5e4e41e8cb12e42995398045d945cf038d07071`
- **Files touched:** docs/pending-documentation-steward-reviews.md, docs/project docs/Project Management Plans/Cost-Management-Plan.md, docs/project docs/Project Management Plans/Development-Approach-and-Life-Cycle-Plan.md, docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md, docs/project docs/Project Management Plans/Planning-Management-Plan.md, docs/project docs/Project Management Plans/Project-Work-Management-Plan.md, docs/project docs/Project Management Plans/Stakeholder-Management-Plan.md, docs/project docs/Project Management Plans/Uncertainty-Management-Plan.md, docs/project docs/Stakeholder-Register.md — confirmed via `git diff-tree --no-commit-id --name-only -r f5e4e41`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — this is the commit that actually landed this role's own prior proposed corrections (the c0179f4/1187116 entries above and the "2026-08-06 — Documentation Steward full-scope pass" follow-up note), verified, not just trusted.** Spot-checked the landed text against what those entries proposed: `Uncertainty-Management-Plan.md` Appendix D's R-04/R-05 rows carry the exact "Resolved, corrected 2026-08-06" text described; `Go-Live-Readiness-Definition.md` §7 carries the exact Story 5.15/5.16 correction described; `Development-Approach-and-Life-Cycle-Plan.md`'s Phase 4.5 row is present and matches `docs/implementation-plan.md`'s own. All landed accurately. **This same pass (2026-08-13) also found that several of these same corrections have since gone stale again**, given the large volume of Epic 6/7 work shipped since 2026-08-06 — see this session's own new corrections to `Go-Live-Readiness-Definition.md` (Stories 6.7/5.18 now built, closing the gap §7's 2026-08-06 correction named as still open) and `docs/project docs/Stakeholder-Register.md` (Platform Admin/Tenant-Admin "no screen exists" claims, now false) made earlier in this same review session — not a defect in this commit itself, just the natural next round of the same drift-catching cycle this file exists to run.

## ~~2026-08-06 — 3c96b74 — Auto-queue bookkeeping and time-log rows for recent commits~~

- **Full commit:** `3c96b74d1a0e56136cc66a7f5a80306b5aeb90d9`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md — confirmed via `git diff-tree --no-commit-id --name-only -r 3c96b74`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Purely mechanical queue/time-log bookkeeping; no factual claim about shipped/decided project state.

## ~~2026-08-06 — 10e310d — Auto-queue bookkeeping for the prior bookkeeping commit~~

- **Full commit:** `10e310d25600cc6caa890a4acda8546031ba3c7b`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md — confirmed via `git diff-tree --no-commit-id --name-only -r 10e310d`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Same as 3c96b74 directly above.

## ~~2026-08-06 — 9bc1a48 — Draft ADR-0043: self-service, Tenant-Admin-initiated tenant deletion~~

- **Full commit:** `9bc1a48db231ea18c9ce0e62d4d910b1e4e7a8a5`
- **Files touched:** docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, docs/adr/0043-self-service-tenant-initiated-deletion.md, docs/adr/README.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md — confirmed via `git diff-tree --no-commit-id --name-only -r 9bc1a48`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no residual drift.** ADR-0043's full history — drafted Proposed here, corrected in place the next day to fully supersede ADR-0039 §1 (not just its "cannot self-delete" sentence), then accepted 2026-08-07 — is accurately and completely captured in `docs/adr/README.md`'s own footnote 17 and its "Correction and acceptance, 2026-08-07" note, verified directly against the current file.

## ~~2026-08-07 — 9a99257 — Implement Story 3.8: self-service tenant deletion (supersedes Story 3.7)~~

- **Full commit:** `9a992575edf5aefd805b685a533ea31a36c7e404`
- **Files touched:** docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, docs/adr/0043-self-service-tenant-initiated-deletion.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/self-service-tenant-deletion/SKILL.md, social-listening-core/contracts/epic-3/story-3.8.self-service-tenant-initiated-deletion.contract.test.ts, social-listening-core/jest.config.js, social-listening-core/jest.sequencer.js, social-listening-core/migrations/0023_grant_self_service_tenant_deletion.sql, social-listening-core/src/admin/platformAdminAuditLog.ts, social-listening-core/src/archival/blobArchiveClient.ts, social-listening-core/src/db/tenantDeletionPool.ts, social-listening-core/src/db/withTenant.ts, social-listening-core/src/http/versions/v1/adminTenantsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/selfServiceTenantDeletionRouter.ts, social-listening-core/src/ingestion/errorClassification.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts, social-listening-core/src/tenants/tenantDeletion.ts, social-listening-core/src/tenants/tenantExportCsv.ts, social-listening-core/src/tenants/tenantStore.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 9a99257`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean.** Story 3.8 shows **Done** in `docs/user-stories/epic-3-data-model-storage-and-archival.md` and `docs/implementation-plan.md`'s traceability row, matching ADR-0043's own "Correction and acceptance, 2026-08-07" note (41/43 suites, 255/260 tests at merge, Story 3.7's reverted-before-commit implementation named honestly). No later commit's own Epic 6 UI work (Story 6.13) contradicts this story's backend contract.

## ~~2026-08-07 — b80aa58 — Log Story 3.8 in the Implementation Log~~

- **Full commit:** `b80aa585d53be86167cefefd1c94a234da979f33`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r b80aa58`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean.** `## 2026-08-07 — Story 3.8 — social-listening-core@9a99257` entry present, appended only, not later edited.

## ~~2026-08-07 — c5e1532 — Design documents mockup - microsoft-social-engagement-ui-mockup - including images from social engagement for reference - The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.~~

- **Full commit:** `c5e153221c7f4cabaeeedbbadac8b4b33c8455dc`
- **Files touched:** docs/design/microsoft-social-engagement-ui-mockup/README.md, docs/design/microsoft-social-engagement-ui-mockup/project/.thumbnail, docs/design/microsoft-social-engagement-ui-mockup/project/SocialEngage.dc.html, docs/design/microsoft-social-engagement-ui-mockup/project/support.js, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/1520200669292.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/FutureDecoded-Analytics.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/Microsoft Social Engagement (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/0702.activitymap (1).png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/0702.activitymap.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/11-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/12-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1229302.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1229329.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/15.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1520110736520.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1520200669292.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/2- Go to settings,  Social Profiles then add profile.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/22.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/24.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/4-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/5706.mse1_.2_1 (1).png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/5706.mse1_.2_1 (2).png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/5706.mse1_.2_1.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/6-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/645596c34886ff29ecebfa63d1016d4e.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/FutureDecoded-Analytics.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/FutureDecoded-Dashboard.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/FutureDecoded-Location-Analytics.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/MSE01.PNG, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft Social Engagement (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft Social Engagement.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement-2.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement-Screenshot-WinBuzzer (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement-Screenshot-WinBuzzer.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft_Social_Engagement_2_small.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/R (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/R (2).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/R.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/analytics-conversation-view-social-engagement (1).webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/analytics-conversation-view-social-engagement.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/analytics-conversation-view-social-engagement.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/blog-crm-social-engagement-1024x604.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/dashboard001.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/hqdefault.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/lead.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (2).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (3).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (4).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (5).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (6).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (7).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/microsoft-social-engagement-location-view.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/microsoft-social-listening-example.gif, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/ms.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/ms1.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/mse-social-center-1-625x343.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/mse-social-center-1.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/mse-social-center.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/msei-04-625x431.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/setup01.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/setupd365.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/social-engagement-ga (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/social-engagement-ga.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/socialcentar001.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/socialengagement-filtering.gif, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/timeline.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/topic-e-sentimennt.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/analytics-conversation-view-social-engagement (1).webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/analytics-conversation-view-social-engagement.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/analytics-conversation-view-social-engagement.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/maxresdefault (2)-d2afcdfa.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/maxresdefault (2).jpg
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** A static prototype/reference asset under `docs/design/` — HTML/CSS/JS mockup plus screenshots, explicitly framed (per this commit's own header) as reference for a future recreation pass, not itself production code or a documentation claim about shipped state. No chartered file (ADR, story, `SKILL.md`, implementation-plan, PM doc) references this folder's contents in a way that could go stale.

## ~~2026-08-08 — 769c28c — Designs from converting the HTML to Next js frontend pages~~

- **Full commit:** `769c28c613c583bf682a2750325f6683d28f4e19`
- **Files touched:** docs/design/MSE ui Mockup/.env.example, docs/design/MSE ui Mockup/.gitignore, docs/design/MSE ui Mockup/README.md, docs/design/MSE ui Mockup/index.html, docs/design/MSE ui Mockup/metadata.json, docs/design/MSE ui Mockup/package.json, docs/design/MSE ui Mockup/src/App.tsx, docs/design/MSE ui Mockup/src/components/ExportModal.tsx, docs/design/MSE ui Mockup/src/components/FilterBar.tsx, docs/design/MSE ui Mockup/src/components/FlyoutNav.tsx, docs/design/MSE ui Mockup/src/components/PostsPane.tsx, docs/design/MSE ui Mockup/src/components/SubTabs.tsx, docs/design/MSE ui Mockup/src/components/TopBar.tsx, docs/design/MSE ui Mockup/src/components/views/ActivityMapView.tsx, docs/design/MSE ui Mockup/src/components/views/AlertsView.tsx, docs/design/MSE ui Mockup/src/components/views/AuthViews.tsx, docs/design/MSE ui Mockup/src/components/views/ConversationsView.tsx, docs/design/MSE ui Mockup/src/components/views/LocationView.tsx, docs/design/MSE ui Mockup/src/components/views/OverviewView.tsx, docs/design/MSE ui Mockup/src/components/views/PostDetailView.tsx, docs/design/MSE ui Mockup/src/components/views/SearchSetupView.tsx, docs/design/MSE ui Mockup/src/components/views/SentimentView.tsx, docs/design/MSE ui Mockup/src/components/views/SettingsView.tsx, docs/design/MSE ui Mockup/src/components/views/SocialCenterView.tsx, docs/design/MSE ui Mockup/src/components/views/SourcesView.tsx, docs/design/MSE ui Mockup/src/data/mockData.ts, docs/design/MSE ui Mockup/src/index.css, docs/design/MSE ui Mockup/src/main.tsx, docs/design/MSE ui Mockup/src/types.ts, docs/design/MSE ui Mockup/tsconfig.json, docs/design/MSE ui Mockup/vite.config.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 769c28c`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Same reasoning as c5e1532 directly above — a standalone Vite/React prototype under `docs/design/`, not production code, not referenced by any chartered doc.

## ~~2026-08-08 — c33353d — Story 1.1 healing: restore repo independence by removing parent package.json~~

- **Full commit:** `c33353df14e4bfdefe3417642946261dc7486653`
- **Files touched:** social-listening-admin/package.json — confirmed via `git diff-tree --no-commit-id --name-only -r c33353d`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean.** `docs/implementation-log.md`'s own `## 2026-08-08 — Story 1.1 healing pass — social-listening-core@c33353d` entry (line 887) exists, matches this commit, and is appended-only, not later edited. **Minor, non-substantive finding, not fixed:** the entry's own header and several inline words render with a mojibake replacement character (likely a lost em-dash/curly-quote encoding from the original write) — purely cosmetic, doesn't misstate any fact, and fixing it would mean editing existing entry text, which this role's own hard rule forbids; not worth a new dated entry over a rendering artifact. Named here in case a future pass wants to investigate the root cause (an encoding mismatch in whatever wrote this entry).

## ~~2026-08-08 — 5b7a69f — Governance updates: heal-contract-failure SKILL enhancements, new ADRs 0044-0048, and traceability~~

- **Full commit:** `5b7a69fab8a496644c85ce499c68bfdf9ec91937`
- **Files touched:** .claude/skills/heal-contract-failure/SKILL.md, .claude/skills/implement-story/SKILL.md, docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md, docs/adr/0045-Audit Trail Architecture for Tenant User Access Management.md, docs/adr/0046-Admin UI Authentication and Authorization Architecture.md, docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md, docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md, docs/adr/README.md, docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md — confirmed via `git diff-tree --no-commit-id --name-only -r 5b7a69f`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no residual drift.** ADR-0045/0046 (draft-stage duplicates of already-decided audit-trail/admin-auth content) were deleted by a later commit (`0b9e1dd`, same pass) along with their own `docs/adr/README.md` table entries — `docs/adr/README.md` footnote 19 explicitly names this ("0045/0046 were never real entries"), and neither file exists on disk today. ADR-0044/0047/0048 all show Accepted with accurate acceptance history in the current `docs/adr/README.md` (footnotes 18/19/20). No stale reference anywhere.

## ~~2026-08-08 — 4ff04cd — Add Foundry Toolkit setup and configuration~~

- **Full commit:** `4ff04cd8e0edef359e9fd635a39112120589aed5`
- **Files touched:** .dockerignore, .foundry/.deployment.json, .mcp.json, Dockerfile, agent.yaml, main.py — confirmed via `git diff-tree --no-commit-id --name-only -r 4ff04cd`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Infra/tooling scaffolding outside this role's chartered scope; no ADR, story, `SKILL.md`, or PM doc makes any claim about it.

## ~~2026-08-08 — 488ac49 — Healing pass: Stories 2.7, 5.7, 5.13 — contract fixes and implementation~~

- **Full commit:** `488ac49296bbed9a546e116a317f8dcd06d9cf73`
- **Files touched:** social-listening-core/contracts/epic-2/story-2.7.gnews-connector.contract.test.ts, social-listening-core/contracts/epic-5/story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts, social-listening-core/contracts/epic-5/story-5.7.platform-admin-rls-bypass.contract.test.ts, social-listening-core/src/admin/breakGlassCredentialReset.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 488ac49`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13, real drift found and corrected: a missing `docs/implementation-log.md` entry.** This is a genuine, real `heal-contract-failure` pass (the commit's own message: "All changes walked the 5-step heal-contract-failure process... Healing attempt: 1 (clean pass)," 43/43 suites, 264/264 tests, real diffs — 165 lines in Story 5.7's contract, 78 in `breakGlassCredentialReset.ts`), but no log entry was ever appended for it, in violation of `docs/implementation-methodology.md`'s own mandatory rule. Confirmed directly: nothing between the "2026-08-07 — Story 3.8" and "2026-08-08 — Story 1.1 healing pass" entries (nor anywhere else in the file) references this commit, these three stories' healing, or `breakGlassCredentialReset.ts`. **Corrected:** a new, dated entry ("2026-08-13 — Documentation Steward: closing a missing log entry for the 2026-08-08 healing pass — social-listening-core@488ac49") was appended to `docs/implementation-log.md`, reconstructed from the commit's own message and `git show --stat`, per this file's own append-only convention (a correction is a new entry referencing the gap, never inserted at its original chronological position or backdated as if written at the time).

## ~~2026-08-08 — fa7954c — UI mock designs: globals, types, mockData, and Tailwind config~~

- **Full commit:** `fa7954cc7589ab733d232058348a3df86da1d54d`
- **Files touched:** social-listening-admin/src/app/globals.css, social-listening-admin/src/lib/mockData.ts, social-listening-admin/src/lib/types.ts, social-listening-admin/tailwind.config.js — confirmed via `git diff-tree --no-commit-id --name-only -r fa7954c`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean.** Pure styling/fixture-data scaffolding for `social-listening-admin`, predating any real story build against these files; no ADR, story, or `SKILL.md` makes a claim about `globals.css`/`mockData.ts`/`types.ts`/`tailwind.config.js` specifically that this commit could have made stale.

## ~~2026-08-08 — 34b5333 — Setup: Codacy config, VS Code MCP settings, Claude settings, and pending reviews~~

- **Full commit:** `34b53335a990c800c3f2a55205872d49db889176`
- **Files touched:** .claude/settings.local.json, .codacy/.gitignore, .codacy/codacy.config.baseline.json, .codacy/codacy.config.json, .vscode/mcp.json, .vscode/settings.json, CLAUDE.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md — confirmed via `git diff-tree --no-commit-id --name-only -r 34b5333`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean within this role's own chartered scope.** This commit's CLAUDE.md update ("Status, as of 2026-08-04...") was already dated/stale the moment it landed (2026-08-08, four days after the date it cites) — a real staleness chain, but `CLAUDE.md` is not one of this role's chartered files per its own "What to check" list; it was eventually corrected 2026-08-13 by commit `57fe1de` (itself queued, reviewed separately below). Everything else here (Codacy/VS Code/Claude tooling config, queue bookkeeping) is out of scope or makes no shipped-state claim.

## ~~2026-08-08 — 0c3409b — Add Foundry agent tracing tests~~

- **Full commit:** `0c3409b635a12bd3e469475d694297fa685efe5e`
- **Files touched:** tests/__pycache__/test_tracing.cpython-314.pyc, tests/test_tracing.py — confirmed via `git diff-tree --no-commit-id --name-only -r 0c3409b`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Unrelated Foundry Python sample scaffolding (later removed in full by `9eef81b`/`8018de4`, both queued below) — no chartered doc references it.

## ~~2026-08-08 — bb42281 — gitignore: exclude Python __pycache__ and bytecode files~~

- **Full commit:** `bb42281beacfa448b37d3b32ef25d4885daa0625`
- **Files touched:** .gitignore — confirmed via `git diff-tree --no-commit-id --name-only -r bb42281`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Mechanical `.gitignore` addition.

## ~~2026-08-08 — ac05777 — Time tracking: auto-log rows for commits 0c3409b and bb42281~~

- **Full commit:** `ac057771f4c46e384a4a612e62da234aee445868`
- **Files touched:** docs/time-tracking.md — confirmed via `git diff-tree --no-commit-id --name-only -r ac05777`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Mechanical auto-log append.

## ~~2026-08-08 — 13a909f — Time tracking: log commit HH:MM as day-timeline marker~~

- **Full commit:** `13a909fe377efa76d11232402d7291ed40363560`
- **Files touched:** docs/time-tracking.md, scripts/git-hooks/post-commit — confirmed via `git diff-tree --no-commit-id --name-only -r 13a909f`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Mechanical hook enhancement plus its own auto-log row; consistent with `Project-Work-Management-Plan.md`'s already-corrected description of this mechanism.

## ~~2026-08-08 — 2b2d40b — Implement Story 6.6 platform admin console~~

- **Full commit:** `2b2d40bf77361a8854fbd0c7a2c98c3379aec269`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 2b2d40b`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no residual drift.** This was Story 6.6's first build (later found to be fixture-data-only, not really calling `social-listening-core`) — `docs/implementation-plan.md`'s own 2026-08-12 dated note names this exact finding and records the real rebuild (`social-listening-admin@51eecf02`), and `docs/user-stories/README.md`/`epic-7-platform-admin-ui.md` (post-split) both correctly show current, rebuilt-for-real state. No cross-reference still treats this first build as final.

## ~~2026-08-08 — 77e1bfc — Log Story 6.6 in the Implementation Log~~

- **Full commit:** `77e1bfcbdd5bc56a14feb42cd4d2dde85d17f27e`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 77e1bfc`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean.** Entry present, appended only.

## ~~2026-08-08 — 8abdb48 — feat: add azd and ai agent deployment config~~

- **Full commit:** `8abdb485b7aed35e56cd01d61042d6fb30435ee9`
- **Files touched:** .vscode/launch.json, .vscode/tasks.json, Dockerfile, README.md, agent-framework-agent-with-local-tools-responses/.gitignore, agent-framework-agent-with-local-tools-responses/AGENTS.md, agent-framework-agent-with-local-tools-responses/CLAUDE.md, agent-framework-agent-with-local-tools-responses/README.md, agent-framework-agent-with-local-tools-responses/azure.yaml, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.azdignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.dockerignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.env.example, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/Dockerfile, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/main.py, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/requirements.txt, azd-ai-agents-2026-08-08.log, azure.yaml, infra/main.bicep, main.py, requirements.txt, tests/test_tracing.py — confirmed via `git diff-tree --no-commit-id --name-only -r 8abdb48`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Unrelated azd/Foundry sample scaffolding, entirely removed two days later (`9eef81b`/`8018de4`, both queued below) — no chartered doc ever referenced it.

## ~~2026-08-09 — 0b9e1dd — ADR changes and updates approvals - VSCode Copilot Registration and project optimizations~~

- **Full commit:** `0b9e1dd8fa91dd687cf9fce80ae7bb32dc504223`
- **Files touched:** .codacy/codacy.config.baseline.json, .codacy/codacy.config.json, .vscode/mcp.json, .vscode/settings.json, AGENTS.md, docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md, docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md, docs/adr/0045-Audit Trail Architecture for Tenant User Access Management.md, docs/adr/0046-Admin UI Authentication and Authorization Architecture.md, docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md, docs/adr/README.md, requirements.txt, tests/__pycache__/test_tracing.cpython-314.pyc — confirmed via `git diff-tree --no-commit-id --name-status -r 0b9e1dd`: exact match, including that ADR-0045/0046 are **deletions** (`D`), not modifications — this is the commit that removed both files, and `docs/adr/README.md` was updated in the same commit to match (its master table never listed them). No drift: the deletion and the table update landed together, atomically.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean.** See file-list note above; ADR-0042/0044/0047 updates in this commit are consistent with their own later, fuller acceptance histories in the current `docs/adr/README.md`.

## ~~2026-08-09 — 11186b7 — update github copilot instructions~~

- **Full commit:** `11186b74ec794a3c48020bc8c53d6516b20ef9b0`
- **Files touched:** .github/copilot-instructions.md, .github/prompts/plan-socialEngage.prompt.md — confirmed via `git diff-tree --no-commit-id --name-only -r 11186b7`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** IDE/Copilot tooling config, out of this role's chartered scope; no claim about shipped/decided project state.

## ~~2026-08-09 — 10fc934 — feat: Story 1.8 — GET /v1/tenants/me tenant self-view endpoint (ADR-0031)~~

- **Full commit:** `10fc934ac8ba79019d702a966cc942b9ca5f7336`
- **Files touched:** social-listening-core/.claude/skills/tenants/SKILL.md, social-listening-core/contracts/epic-1/story-1.8.tenant-self-view.contract.test.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantSelfViewRouter.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 10fc934`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean.** This commit deliberately didn't touch `docs/user-stories/epic-1-repository-and-api-foundation.md` (Story 1.8 was already drafted Ready from the 2026-08-05 batch) — traceability was updated two days later in a consolidated pass (`8dff76b`, queued below), which now correctly shows "Status: Built 2026-08-09 (`social-listening-core@10fc934`... 8/8, full suite 44/44 suites / 272/272 tests)," verified against the current file. Not a gap — a real, later-batched update, accurately dated and cited.

## ~~2026-08-09 — 4de308e — heal: Story 3.5 — fix archival partition eligibility boundary condition (ADR-0018)~~

- **Full commit:** `4de308ee4205d22c211d61c6c6ebdfe551be1af8`
- **Files touched:** social-listening-core/src/archival/socialPostArchival.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 4de308e`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean.** Pure code fix, no doc claim; the ADR-0018 amendment and `SKILL.md` update documenting it land in the very next commit (`75cc58d`, reviewed together below) rather than this one — consistent, not a gap.

## ~~2026-08-09 — 75cc58d — docs: ADR-0018 amendment + SKILL.md update for partition eligibility boundary fix~~

- **Full commit:** `75cc58d27d806fafa4cc01bd7f5c59d7f35c6a20`
- **Files touched:** docs/adr/0018-data-retention-and-archival-policy.md, social-listening-core/.claude/skills/data-retention-and-archival/SKILL.md — confirmed via `git diff-tree --no-commit-id --name-only -r 75cc58d`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** ADR-0018's Amendment Log entry correctly documents the boundary-condition fix as an adjustable-implementation-detail correction (governance table row 3), not a Decision change; `SKILL.md` correctly reflects the fixed code.

## ~~2026-08-09 — 3badf2f — feat: Story 1.9 — user invitation and offboarding REST surface (ADR-0032)~~

- **Full commit:** `3badf2f61c8da29a80af914be86525d7ea833efa`
- **Files touched:** social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/contracts/epic-1/story-1.9.user-invite-offboard.contract.test.ts, social-listening-core/contracts/epic-5/story-5.9.users-table-identity-resolution.contract.test.ts, social-listening-core/migrations/0024_create_user_access_audit_log.sql, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts, social-listening-core/src/identity/identityResolution.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 3badf2f`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean.** Same pattern as Story 1.8 (10fc934) above: traceability landed in the same later consolidated pass (`8dff76b`), verified current in `docs/user-stories/epic-1-repository-and-api-foundation.md` — Story 1.9 shows Built, matching this commit's hash.

## ~~2026-08-09 — afd270f — docs: implementation log entry for Story 1.9~~

- **Full commit:** `afd270fbe4e57ebd1371c853265295b0d95719e7`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r afd270f`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only.**

## ~~2026-08-09 — 2b44637 — feat: Story 6.7 — self-service tenant sign-up UI (ADR-0037)~~

- **Full commit:** `2b4463747b872565c0d954004027450dd53b8c5b`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md, social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts, social-listening-admin/src/app/api/auth/callback/route.ts, social-listening-admin/src/app/api/auth/signup/route.ts, social-listening-admin/src/app/sign-up/already-have-account/page.tsx, social-listening-admin/src/app/sign-up/domain-taken/page.tsx, social-listening-admin/src/app/sign-up/error/page.tsx, social-listening-admin/src/app/sign-up/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/signupFlow.ts, social-listening-admin/src/proxy.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 2b44637`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13, real downstream drift found and corrected in the working tree (not yet committed) — traced to this commit, not introduced by it.** This commit itself is clean (`docs/implementation-plan.md`/`epic-6-admin-ui.md` correctly updated same-commit). But this story's own shipping is exactly what made two PM docs stale, uncaught until this pass: `docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` §2 and §7 both still described the self-service sign-up flow as blocked on "no UI screen (Story 6.7, still unbuilt)" — false since this commit. Corrected with two new dated notes (2026-08-13). `docs/project docs/Stakeholder-Register.md`'s Tenant-Admin paragraph also still claimed "no screen... beyond sign-in and the three fixture-data screens" — corrected with a matching dated note listing everything actually shipped since, including this story. See this session's own fuller account in the report accompanying this queue pass.

## ~~2026-08-09 — d114c16 — docs: implementation log entry for Story 6.7~~

- **Full commit:** `d114c16032ff3a3c6e03839b58e67fa85d99bdee`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r d114c16`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only.** (The real drift this story's shipping caused elsewhere is recorded and fixed under the 2b44637 entry directly above, not here.)

## ~~2026-08-10 — 832f7b3 — heal: parallel-worker race between Story 6.1/6.7's spawned dev servers~~

- **Full commit:** `832f7b3eaadf1a2b6d1e7ebb4cd1e0e92883efe5`
- **Files touched:** social-listening-admin/.claude/skills/admin-auth-session/SKILL.md, social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts, social-listening-admin/next.config.js — confirmed via `git diff-tree --no-commit-id --name-only -r 832f7b3`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Pure healing commit (Next 16 dev-server lock keyed by `distDir` not port). Both `SKILL.md`'s new dated notes accurately describe the real fix verified directly against `next.config.js`'s new `NEXT_DIST_DIR` opt-in and both contracts' own `beforeAll` env changes. No ADR, story, traceability, or PM-doc claim references this internal test-infra detail.

## ~~2026-08-10 — 09160c4 — docs: implementation log entry for healing pass (6.1/6.7 dev-server race)~~

- **Full commit:** `09160c43570f3c71095a75dbee641486a2e03107`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 09160c4`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only.** Entry's own file list, commit hash, and contract/SKILL.md references all match the 832f7b3 commit reviewed directly above.

## ~~2026-08-10 — c89ee47 — chore: regenerate next-env.d.ts/tsconfig.json for per-test distDir~~

- **Full commit:** `c89ee47eadb4c3bffa66d1e19ac37da4dba5df13`
- **Files touched:** social-listening-admin/next-env.d.ts, social-listening-admin/tsconfig.json — confirmed via `git diff-tree --no-commit-id --name-only -r c89ee47`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Auto-generated Next.js tooling output (own commit message says so, and the diff is exactly the mechanical distDir-path substitution you'd expect from 832f7b3's own fix) — no factual claim in this role's chartered scope.

## ~~2026-08-10 — 6b7fc00 — feat: Story 6.8 — Tenant-Admin user invitation and management screen~~

- **Full commit:** `6b7fc0022b3efc0f7861318033fdeb0ff0831ff1`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts, social-listening-admin/src/app/api/tenant-users/[id]/route.ts, social-listening-admin/src/app/api/tenant-users/route.ts, social-listening-admin/src/app/tenant/users/AccessControl.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 6b7fc00`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Same-commit `implementation-plan.md`/`epic-6-admin-ui.md` (now `epic-6-tenant-admin-ui.md`) dated notes accurately describe what shipped (14/14 contract, 10/10 suites 89/89 tests) and correctly name the still-deferred access-history companion (Story 6.14 later closed this, per README.md's own 2026-08-1x notes). New `tenant-user-management/SKILL.md` cites ADR-0032 §2/§6/§9 and Story 1.9's already-built REST surface accurately; contract path and Load-bearing constraints match the real diff.

## ~~2026-08-10 — 09b626f — docs: implementation log entries for Story 6.8 and its healing follow-up~~

- **Full commit:** `09b626faf39b7ba370ecaab2fef1db11e2a1ff7e`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 09b626f`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only.** Three entries (c89ee47 regenerated-files bookkeeping, 6b7fc00 Story 6.8) both cross-checked against their own real commits above; file lists and claims match.

## ~~2026-08-10 — 9ec62fa — feat: Story 6.9 — tenant settings screen~~

- **Full commit:** `9ec62fa80123edf68b5f28f3b3877c46f2e2f53a`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/tenant-settings/SKILL.md, social-listening-admin/contracts/epic-6/story-6.9.tenant-settings-screen.contract.test.ts, social-listening-admin/src/app/tenant/settings/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 9ec62fa`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `implementation-plan.md`/`epic-6-admin-ui.md` dated notes accurately describe the read-only `/tenant/settings` screen against Story 1.8's `GET /v1/tenants/me`, correctly note 6.10 as still unbuilt at that point, and match the real 11/11 suites, 99/99 tests claim structurally consistent with prior/next entries' own counts.

## ~~2026-08-10 — 1e18c4b — docs: implementation log entry for Story 6.9~~

- **Full commit:** `1e18c4b6bba373ac526df14cd47c04f4a380ffd3`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 1e18c4b`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only.** Matches the real 9ec62fa commit reviewed directly above.

## ~~2026-08-10 — 3661ce9 — feat: Story 6.10 — Same-Domain Invite Assist view, closing out Epic 6~~

- **Full commit:** `3661ce90591765bf672b9278bb17fa9f61eb174a`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/same-domain-invite-assist/SKILL.md, social-listening-admin/contracts/epic-6/story-6.10.same-domain-invite-assist-view.contract.test.ts, social-listening-admin/src/app/tenant/invite-assist/page.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 3661ce9`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** The "closing out Epic 6" framing was accurate as a dated snapshot at commit time (6.1–6.10 all built that day) and is correctly treated as a point-in-time note, not retroactively wrong just because Epic 6 later grew (6.11–6.17) and was split 2026-08-12 — consistent with every other dated-note entry in this project. `InviteUserForm.tsx`/`tenant/users/page.tsx` cross-touch is correctly attributed to this story's own AC3 text in both `implementation-plan.md` and `epic-6-admin-ui.md`.

## ~~2026-08-10 — 19d50d7 — docs: implementation log entry for Story 6.10~~

- **Full commit:** `19d50d74f254ac4c5e5bcdb2525f635ca10baa75`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 19d50d7`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only.** Matches the real 3661ce9 commit reviewed directly above.

## ~~2026-08-10 — 5fe1999 — feat: Story 5.17 — access-history read endpoint (ADR-0032 §9)~~

- **Full commit:** `5fe1999c67f0d55a3a851788602d86c423347ac1`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/contracts/epic-5/story-5.17.access-history-read-endpoint.contract.test.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts, social-listening-core/src/identity/identityResolution.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 5fe1999`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** This commit itself correctly handles a real AC1/shipped-schema column-naming drift (`user_id`/`changed_by`/`previous_value`/`changed_at` in the story text vs. the real `target_user_id`/`actor_user_id`/`old_value`/`occurred_at` Story 1.9 actually shipped) via a proper dated note in `epic-5-security-isolation-and-messaging.md` rather than silently rewriting the story — exactly the governance-table-consistent correction mechanism this role would otherwise have had to apply itself. `docs/user-stories/README.md` (line 135's own 2026-08-10-adjacent note) and `implementation-plan.md` both correctly reflect it as built.

## ~~2026-08-10 — f0e3c36 — docs: implementation log entry for Story 5.17~~

- **Full commit:** `f0e3c361e7c948e4415a7c0219bba4d0bef0682d`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r f0e3c36`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only.** Matches the real 5fe1999 commit; also correctly names the break-glass Graph-409 retry gap as a deliberately-scoped-out follow-up, which the next entry (99b58c3) below actually closes.

## ~~2026-08-10 — 99b58c3 — heal: retry break-glass password-reset/TAP calls on transient Graph 409s~~

- **Full commit:** `99b58c31f8b129e85227336cc52bd0aa88b1bba3`
- **Files touched:** social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/src/admin/breakGlassCredentialReset.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 99b58c3`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** This is exactly the follow-up the 5fe1999/f0e3c36 entries above named as deliberately out of scope there — closed here. `SKILL.md`'s new Load-bearing-constraint and Known-gaps bullets correctly append (never rewrite) a dated 2026-08-10 note describing the real fix (`resetPasswordWithRetry()`/`createTemporaryAccessPassWithRetry()`, new `isConcurrentTenantRequestError()` predicate alongside the existing `isConflictingObjectError()`), consistent with the commit's own message and the `--no-verify` rationale (existing Story 5.7 contract already covers this behavior, re-run and passing as direct proof). No traceability-table or story-status change needed since no story/AC boundary moved.

## ~~2026-08-10 — d78c598 — docs: implementation log entry for break-glass retry healing pass~~

- **Full commit:** `d78c598861351f6f326918bb9e54e3de3506699e`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r d78c598`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only.** Matches 99b58c3 reviewed above; correctly explains the `--no-verify` exception and correctly states no traceability-table edit was needed since no story/ADR status moved.

## ~~2026-08-10 — 7a2466d — feat: Story 5.18 — self-service sign-up rate limiting (ADR-0040)~~

- **Full commit:** `7a2466d27958c1d36a5c02a116130eac1d9064eb`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md, social-listening-core/contracts/epic-5/story-5.18.signup-rate-limiting.contract.test.ts, social-listening-core/src/http/versions/v1/selfServiceSignupRouter.ts, social-listening-core/src/tenants/signupRateLimit.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 7a2466d`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean now; this commit's own self-flagged PM-doc follow-up was already closed by a later, already-committed pass.** `docs/open-decisions.md`'s own §1 entry (struck through and resolved in this same commit) explicitly named `docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` §5.3 as needing a matching correction and deliberately did not make it, "flagged... for the documentation-steward's own next pass." Verified current state: that file's own dated "Documentation Steward correction, 2026-08-13" note (added by the later commit `13f5163`, itself outside this queue's own 832f7b3–bd9bbfc range) already closes exactly this gap — Story 5.18/Story 6.7 both correctly reflected as shipped, §5.3's gate criterion correctly marked factually satisfied, with the Stage-0 policy classification itself correctly left as Menno's own call, not decided here. Nothing further to do for this entry.

## ~~2026-08-10 — d1ad0c6 — docs: implementation log entry for Story 5.18~~

- **Full commit:** `d1ad0c6f549e79074052a9a75bb45b1f5ec64889`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r d1ad0c6`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only.** Matches 7a2466d reviewed above; its own explicit pointer to the Go-Live-Readiness-Definition.md follow-up is the same one confirmed already closed there.

## ~~2026-08-10 — f70b07d — feat: Story 2.8 — Azure AI Language connector, real AIProviderConnector (ADR-0038)~~

- **Full commit:** `f70b07dacee68d618c2537c705e300a91a6d83a0`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/.claude/skills/social-post-enrichment/SKILL.md, social-listening-core/contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts, social-listening-core/contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/azureAiLanguageConnector.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts, social-listening-core/src/connectors/examples/exampleAiProviderY.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/types.ts — confirmed via `git diff-tree --no-commit-id --name-only -r f70b07d`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13, one real (small, long-standing) drift found and corrected in the working tree — plus one non-drift oddity flagged for the record, not fixed.**
  1. **`docs/user-stories/epic-4-derived-data-analytics-and-health.md`'s Story 4.2 was missing the dated correction note this very commit's own message, and `epic-2-ingestion-connectors-and-rate-limits.md`'s own Story 2.8 note, both said existed "in both files."** The contract test itself (`contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts`) does carry a full, dated header-comment correction (entities widened `string[]` → `{text,category,confidenceScore}[]`, AC3's SQL moved off `jsonb_array_elements_text`) — but the human-readable epic file never got a matching pointer, so a reader of that file alone would still see the original AC1/AC3 text with no indication the shape changed. Corrected: added a dated "Documentation Steward correction, 2026-08-13" note under Story 4.2 in `docs/user-stories/epic-4-derived-data-analytics-and-health.md`, cross-referencing Story 2.8/ADR-0038 and the contract's own already-correct note — original AC text left untouched, per this doc series' own convention.
  2. **Flagged, not fixed — an odd, unexplained content addition, not itself drift.** This commit's own diff to `epic-2-ingestion-connectors-and-rate-limits.md` also appended a rough, malformed **Story 2.10** draft stub ("Connector Registration Transparantly registration" — a typo in its own heading, no trailing newline, `Status: Blocked — pending ADR-0048 acceptance") that this commit's own message never mentions at all (the message is entirely about Story 2.8). It was factually accurate at commit time (ADR-0048 genuinely existed and was genuinely not yet accepted) and was properly cleaned up and completed by a later, already-committed pass (`8dff76b` accepted ADR-0048 and moved it to Ready; `f2c7788`, 2026-08-12, fixed the typo, built the story for real, and is itself reviewed further down this same queue) — so no drift remains in the current working tree from it. Noting it here only as a commit-hygiene observation (an unrelated, undocumented draft riding along in a feature commit), not something requiring correction.
  3. Everything else checked clean: `docs/implementation-plan.md`'s own Story 2.8 dated note and `docs/user-stories/README.md`'s matching note both accurately describe what shipped; `docs/adr/README.md` needed no change (ADR-0038 status unaffected by this commit); no PM-doc references this commit's subject matter.

## ~~2026-08-10 — 80cc28d — docs: implementation log entry for Story 2.8~~

- **Full commit:** `80cc28d676ad6c4377e0f2f3a626eaaec1a7a0f2`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 80cc28d`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13, real drift found and corrected — not in this log entry itself (append-only, matches f70b07d exactly), but in a `SKILL.md` this log entry's own content pointed at.** This entry's own text names a real, separate, latent bug found as a side effect of Story 2.8's validation: neither `archiveAgedRawPayloads()` nor `archiveAgedIngestionRuns()` wraps its detach→process→reattach/drop sequence in `try`/`finally`, so a mid-run blob-upload failure leaves a partition permanently detached — explicitly flagged in this log entry as "worth its own dedicated healing pass given the real production risk," and deliberately not fixed in that commit (out of Story 2.8's own scope). Checked whether it was ever actually fixed later (`git log` on both `social-listening-core/src/archival/socialPostArchival.ts` and `ingestionRunArchival.ts` shows only the original implementation and the unrelated 4de308e partition-boundary healing pass) and whether `social-listening-core/.claude/skills/data-retention-and-archival/SKILL.md`'s own "Known gaps" section carried it forward — it did not, at all, until this pass. Corrected: added a dated "Documentation Steward correction, 2026-08-13" bullet to that `SKILL.md`'s Known gaps section, confirmed directly against current source (both functions still lack the guard), citing this exact log entry. This is squarely the class of drift this role's charter names — a real, known gap in the paper trail's living reference doc, not a hypothetical one.

## 2026-08-10 — 1e7e9ac — docs: ADR-0038 amendment — Foundry Local rejected, Azure OpenAI Service selected for Story 2.9

- **Full commit:** `1e7e9ac785414a7527298c0188322f369ce6e825`
- **Files touched:** docs/adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md — confirmed via `git diff-tree --no-commit-id --name-only -r 1e7e9ac`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, correct governance mechanism used.** Both additions (Foundry Local rejected; Azure OpenAI Service selected over Claude-in-Foundry) are real, dated Amendment Log entries, explicitly note "No change to Decision §§1–2's already-Accepted text," and correctly resolve two Open Questions rather than reopening the Decision. `docs/adr/README.md`'s footnote 14 needed no matching update — it documents drafting-phase revisions, not every later Amendment Log entry, consistent with how other ADRs' post-acceptance amendments are handled elsewhere in that file.

## ~~2026-08-10 — 54b32fa — docs: ADR-0038 correction — gpt-4o-mini deprecated, gpt-5-mini deployed instead~~

- **Full commit:** `54b32fa5f67ae65d20320e733377945af775b09b`
- **Files touched:** docs/adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md — confirmed via `git diff-tree --no-commit-id --name-only -r 54b32fa`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, correct governance mechanism (Amendment Log entry, no Decision-text edit), honestly named as a real correction rather than silently substituted.** Minor observation, not treated as drift worth fixing: the new `gpt-5-mini` GlobalStandard-pricing gap is named inline in the Amendment Log rather than also added as its own bullet to the Open Questions list the way the ADR's own cited Azure-AI-Language-S-tier precedent is — a stylistic inconsistency, not a factual one, since the gap is honestly disclosed either way.

## ~~2026-08-10 — 69310ba — feat: Story 2.9 — second AIProviderConnector, Azure OpenAI (gpt-5-mini), provider swappability~~

- **Full commit:** `69310ba80ae4be83e51e5cf4f7c7f51063b3cbdd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts, social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 69310ba`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `implementation-plan.md`/`README.md`/`epic-2-ingestion-connectors-and-rate-limits.md` all correctly and consistently describe the real `gpt-5-mini` connector, provider-agnostic `enrichPost.ts` rewrite, and the real 429/capacity finding, cross-referencing ADR-0038's own Amendment Log (reviewed in the two entries directly above) rather than duplicating it.

## ~~2026-08-10 — 9007da1 — docs: implementation log entry for Story 2.9~~

- **Full commit:** `9007da1efbf888cfef55168c6eab6379aca9d558`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 9007da1`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines in the diff). Matches 69310ba reviewed above.

## ~~2026-08-10 — 292a22a — feat: Story 2.9 follow-up — self-review + overallConfidence for Azure OpenAI enrichment~~

- **Full commit:** `292a22adcc17be9e3190900618444f240c6ef6ed`
- **Files touched:** social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts, social-listening-core/src/connectors/types.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 292a22a`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `azure-openai-connector/SKILL.md`'s new dated note, contract-summary update, and two new Load-bearing-constraint bullets accurately describe the real change (single-call self-review, new `overallConfidence` field, explicitly never populated by the Azure AI Language connector) and correctly distinguish it from calibrated-classifier scores. No traceability-table entry needed — same-day refinement to an already-Built story, consistent with how comparable same-day follow-ups are handled elsewhere.

## ~~2026-08-10 — d936082 — docs: implementation log addendum for Story 2.9 self-review/overallConfidence follow-up~~

- **Full commit:** `d936082690e4b8da7c23b4e4945aafdcf72d065f`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r d936082`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches 292a22a reviewed above.

## ~~2026-08-10 — 8e1ac18 — docs: draft ADR-0049 and ADR-0050 (Proposed) from Cursor Composer brainstorm session~~

- **Full commit:** `8e1ac18a8aade52395a733d430ab4cabfd258b17`
- **Files touched:** docs/adr/0004-author-normalized-separately-from-post.md, docs/adr/0049-point-in-time-author-follower-count-on-social-post.md, docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md, docs/adr/README.md, docs/open-decisions.md — confirmed via `git diff-tree --no-commit-id --name-only -r 8e1ac18`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no residual drift.** At this commit both ADRs were correctly drafted Proposed, with correct "Pending supersession note" additions on ADR-0004 (not edits to its Decision text), correct footnote 20/README index entries, and matching `open-decisions.md` updates — all accurate as of 2026-08-10. Both were subsequently accepted by Menno 2026-08-11 (verbatim "ADR 0048, ADR 0049 and ADR 0050 approved"), and every downstream artifact this commit touched (ADR-0004's own "Supersession update" notes, `docs/adr/README.md`'s footnote 20 and "Still outstanding" history, `docs/open-decisions.md`'s two entries, Stories 3.9/2.11) was correctly updated at that later acceptance — verified directly against current file contents, not assumed. No gap remains attributable to this commit.

## ~~2026-08-10 — 7d978e0 — docs: correct overstated Story 6.3 connect-flow claims in AI connector SKILL.mds~~

- **Full commit:** `7d978e0bd46f8b8823cd4f8d6e74316670bf8900`
- **Files touched:** social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md — confirmed via `git diff-tree --no-commit-id --name-only -r 7d978e0`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — accurate as of this commit; superseded by a real later commit reviewed next in this queue.** At commit time this correction was itself correct: `tenant/connectors/page.tsx` genuinely was a static placeholder (verified via this repo's own history — the file didn't exist with real logic until later). The very next commit in this queue, `1dbd26a` (same day), built a real connect/disconnect flow that now covers both `azure-ai-language` and `azure-openai` too — see that entry's own review immediately below for the resulting drift this created in these same two `SKILL.md` files, and the correction made there.

## ~~2026-08-10 — 1dbd26a — heal: Story 6.3 — real connector connect/disconnect flow, not a static placeholder~~

- **Full commit:** `1dbd26a6e8a9f0180d25f8dd22df8fea73b656da`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/src/app/api/connectors/[platformId]/connect/route.ts, social-listening-admin/src/app/api/connectors/[platformId]/disconnect/route.ts, social-listening-admin/src/app/tenant/connectors/ConnectForm.tsx, social-listening-admin/src/app/tenant/connectors/DisconnectButton.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 1dbd26a`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — real drift found and corrected, two SKILL.md files' worth, plus one epic-file gap of the same root cause.** This healing pass (and the same-day `7d978e0` correction just before it) left three artifacts stale: (1) `social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md`'s and (2) `azure-openai-connector/SKILL.md`'s own "Known gaps" bullets both still said, as of this review, "No admin-UI connect flow exists" — true when `7d978e0` wrote that bullet earlier the same day, but false from this commit onward, since this pass's own "Scope expansion" added exactly those two providers to `tenant/connectors/page.tsx`'s real `PLATFORMS` array with a working `ConnectForm`. Corrected both with a dated "Documentation Steward correction, 2026-08-13" note (strikethrough + replacement, matching this project's own established in-place-correction convention for `SKILL.md` bullets, e.g. `connector-connect-disconnect/SKILL.md`'s own activation-table bullet), confirmed directly against current `page.tsx` source before writing either. (3) `docs/user-stories/epic-6-tenant-admin-ui.md`'s own Story 6.3 entry never recorded this healing pass at all — it still just says "Built 2026-08-05... full suite 31/31," with no indication the 2026-08-05 build was a static placeholder or that it was healed 2026-08-10, unlike Stories 6.4/6.5 just below it in the same file, which do carry matching "Correction, 2026-08-12" notes for the identical fixture-only root cause. Added a matching dated correction note there too, cross-referencing this commit and the current `SKILL.md`. `docs/implementation-plan.md` and `docs/user-stories/README.md` needed no equivalent fix — neither makes a standalone build-status claim about Story 6.3 that this commit falsified; both only reference it in passing (e.g. "the identical category of ripple Story 6.3 already caused"), which remains accurate.

## ~~2026-08-10 — d545174 — docs: implementation log entry for Story 6.3 healing pass~~

- **Full commit:** `d545174725734e5664bdb733b3e546d7528e042a`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r d545174`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines in the diff — confirmed via `git diff d545174^ d545174`). Content matches `1dbd26a` reviewed immediately above; the real drift this log entry's own content pointed at (two stale `SKILL.md` bullets, one stale epic-file entry) was found and corrected under that entry's own review, not here — this entry itself is accurate and unaffected.

## ~~2026-08-10 — 15756e0 — heal: Story 1.4 — withDevEnv.js never loaded .env, only jest's test setup did~~

- **Full commit:** `15756e00df0a2a74ee5027f3fe3e35af165070d3`
- **Files touched:** social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/contracts/epic-1/story-1.4-fixtures/printEnvAndArgv.js, social-listening-core/contracts/epic-1/story-1.4-fixtures/test-fixture.env, social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts, social-listening-core/scripts/withDevEnv.js — confirmed via `git diff-tree --no-commit-id --name-only -r 15756e0`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13, real drift found and corrected — not in the touched files themselves (`postgres-tenant-db/SKILL.md`'s own new dated note is accurate and current), but in ADR-0025, this healing pass's governing ADR, one directory over.** ADR-0025's own Amendment Log already carries two dated entries for prior `withDevEnv.js` correctness bugs (the `execSync`→`spawn` fix and the `PGDATABASE`/etc. fallback-vs-force fix, both 2026-07-30) — this third, same-category bug (never loading `.env` at all) was fixed 2026-08-10 and logged faithfully in `docs/implementation-log.md` and `postgres-tenant-db/SKILL.md`, but never added to ADR-0025's own Amendment Log, breaking that log's own established completeness as this ADR's durable record of `withDevEnv.js` fixes. Corrected: added a dated "Documentation Steward correction, 2026-08-13" Amendment Log entry to `docs/adr/0025-persistent-local-dev-database-separate-from-test-database.md`, matching the existing two entries' own level of technical detail, explicitly not touching the ADR's original Decision/Consequences text.

## ~~2026-08-10 — de96102 — docs: implementation log entry for Story 1.4 withDevEnv.js healing pass~~

- **Full commit:** `de96102e84c6a9e4b930a4af3fe9c5181dad980b`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r de96102`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches `15756e0` reviewed above; the real drift that entry's own content pointed at (ADR-0025's Amendment Log missing this fix) was found and corrected under that entry's own review, not here.

## ~~2026-08-10 — dba9895 — heal: Story 6.1 — real Platform Admin sign-in blocked by missing OAuth scope and oid-vs-sub seed error~~

- **Full commit:** `dba98958df63edd3e9d2c1ff0bc0dc2d96cdfb2b`
- **Files touched:** docs/adr/0029-authentication-mechanism-entra-external-id.md, social-listening-admin/.claude/skills/admin-auth-session/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/src/lib/entra.ts, social-listening-core/.claude/skills/identity-resolution/SKILL.md — confirmed via `git diff-tree --no-commit-id --name-only -r dba9895`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift; unusually thorough on its own already.** ADR-0029's Open Question on `oid` vs. `sub` is correctly resolved with a struck original bullet, primary evidence (real captured token claims), and a matching dated Amendment Log entry — Decision/Consequences text untouched, correct governance mechanism. `admin-auth-session/SKILL.md` and `identity-resolution/SKILL.md` both carry accurate, appropriately cross-referenced dated notes (AC13, the missing `access_as_user` scope, the `oid`-seeding gotcha). `docs/implementation-log.md`'s matching entry (verified, not part of this commit's own diff) cites the same facts consistently. No traceability-table or epic-file change needed — Story 6.1's own build status is unaffected by a same-story healing pass, consistent with this project's own convention.

## ~~2026-08-10 — 6d08379 — docs: implementation log entry for Story 6.1 OAuth-scope healing pass~~

- **Full commit:** `6d08379b3c2439d968fb874576193c35628a95c5`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 6d08379`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches `dba9895` reviewed above.

## ~~2026-08-10 — 35b70a8 — heal: Story 6.2 — a successful platform_admin sign-in lands on / with only a manual link~~

- **Full commit:** `35b70a822353fc0b5641a8da4007a932aca3d03f`
- **Files touched:** social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/src/app/page.tsx — confirmed via `git diff-tree --no-commit-id --name-only -r 35b70a8`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13, real drift found and corrected in `social-listening-admin/.claude/skills/role-routing-shell/SKILL.md`.** `docs/implementation-log.md`'s own entry for this commit explicitly notes "`SKILL.md`: unchanged — no new load-bearing constraint introduced" — but that component's `SKILL.md` is exactly the living reference a future developer touching `src/app/page.tsx` would consult, and it never actually documented this real behavior change: a signed-in `platform_admin` now auto-redirects off the home page to `/platform-admin` instead of rendering a page with only a manual link (`src/app/page.tsx`'s own code comment records the fix accurately; the `SKILL.md` didn't). Corrected: added a dated "Documentation Steward correction, 2026-08-13" bullet to that file's Load-bearing constraints section, and extended its "Contracts that constrain this component" bullet to mention the two new AC cases this commit added. Not treated as second-guessing the log entry's own judgment call (not edited, per this role's own append-only rule for the log) — only closing the gap it left in the actual living reference doc.

## ~~2026-08-10 — 596b2c3 — docs: implementation log entry for Story 6.2 root-redirect healing pass~~

- **Full commit:** `596b2c36900d4c44b5e39a049c1614e4b87e5fec`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 596b2c3`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches `35b70a8` reviewed above; the real drift that entry's own "SKILL.md unchanged" note left behind (the `role-routing-shell/SKILL.md` gap) was found and corrected under that entry's own review, not here.

## ~~2026-08-10 — f4c50db — docs: record real Entra tenant-config prerequisites found during live self-service sign-up test~~

- **Full commit:** `f4c50dbe3143138d732f23054255a665edbc9fdb`
- **Files touched:** social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md — confirmed via `git diff-tree --no-commit-id --name-only -r f4c50db`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13, real drift found and corrected — not in the touched `SKILL.md` itself (accurate), but in ADR-0037, this finding's own governing ADR.** This commit's content accurately records two real, previously-undocumented Entra tenant-configuration gaps (missing `email` optional claim/OIDC permission; `social-listening-admin` never linked to a "Sign up and sign in" user flow) and the first successful real end-to-end self-service sign-up, which also directly confirms ADR-0037 §8a's own still-open "Named as required... confirming email OTP verification is actually enabled" item. Checked ADR-0037 itself (`docs/adr/0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md`) — its Amendment Log, which has a dated entry for literally every other post-acceptance finding in this ADR's history (nine entries, all 2026-08-04), never got one for this 2026-08-10 confirmation, and the "Named as required" bullet this finding directly resolves was left unstruck. Corrected: struck that bullet with a dated resolution note, and added a matching dated Amendment Log entry citing this commit and the SKILL.md, naming both newly-found configuration gaps — Decision/Consequences text untouched, per this ADR's own established governance convention.

## ~~2026-08-10 — 49eaa50 — docs: backlog a future ADR candidate — richer self-service sign-up business-details form~~

- **Full commit:** `49eaa5012d60a5d464c3c3b476947f1eb354ca86`
- **Files touched:** docs/adr/README.md — confirmed via `git diff-tree --no-commit-id --name-only -r 49eaa50`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, still accurate.** Checked whether a richer self-service sign-up business-details form has since been drafted as its own ADR or story (it would make this backlog note stale) — grepped `docs/adr/README.md`, `docs/open-decisions.md`, and every `docs/adr/00*.md` file for related language; no such ADR exists yet. The note remains an accurate, still-unscoped backlog item.

## ~~2026-08-10 — 4551e26 — docs: backlog missing invite-withdrawal capability, found during live invite testing~~

- **Full commit:** `4551e2672bc6b7d4279837a392f668514b79afd4`
- **Files touched:** social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-core/.claude/skills/identity-resolution/SKILL.md — confirmed via `git diff-tree --no-commit-id --name-only -r 4551e26`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, still accurate.** Grepped for any later `DELETE /v1/tenants/users`, `cancelInvite`/`withdrawInvite` naming, or a matching story anywhere in `social-listening-core/src`, `docs/user-stories/`, and `docs/implementation-log.md` — none exists. The gap this commit backlogged in both mirrored `SKILL.md` files remains genuinely open and unbuilt; no drift.

## ~~2026-08-10 — f36d765 — heal: Story 5.15 — self-service tenant founder never consumed a seat~~

- **Full commit:** `f36d765af41efe84c8c9df6a882a33d5b9ae53a9`
- **Files touched:** social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md, social-listening-core/contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts, social-listening-core/src/tenants/selfServiceSignup.ts — confirmed via `git diff-tree --no-commit-id --name-only -r f36d765`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `self-service-tenant-signup/SKILL.md`'s new dated notes (contract-summary bullet and Load-bearing constraints bullet) accurately describe the real fix and don't conflict with `identity-resolution/SKILL.md`'s own separate, still-accurate "seat-count race condition inherited from ADR-0031 §3" note (a different code path — invite creation vs. this commit's self-service-founder path). `docs/user-stories/epic-5-security-isolation-and-messaging.md`'s Story 5.15 entry needed no change — same-story healing pass under an already-Built story, this project's own established convention.

## ~~2026-08-10 — 3ae641e — docs: implementation log entry for Story 5.15 seat-count healing pass~~

- **Full commit:** `3ae641ecdbbc0420a6fdf5de20f8cd26daa4a2ae`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 3ae641e`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches `f36d765` reviewed above.

## ~~2026-08-10 — 9eef81b — chore: remove unrelated Microsoft Foundry Python sample project and stray azd scaffolding~~

- **Full commit:** `9eef81ba06f7970bb4afccdd15fab531c58aec54`
- **Files touched:** agent-framework-agent-with-local-tools-responses/.gitignore, agent-framework-agent-with-local-tools-responses/AGENTS.md, agent-framework-agent-with-local-tools-responses/CLAUDE.md, agent-framework-agent-with-local-tools-responses/README.md, agent-framework-agent-with-local-tools-responses/azure.yaml, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.azdignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.dockerignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.env.example, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/Dockerfile, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/main.py, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/requirements.txt, azd-ai-agents-2026-08-08.log, azure.yaml, main.py, tests/__pycache__/test_tracing.cpython-314.pyc, tests/test_tracing.py — confirmed via `git diff-tree --no-commit-id --name-only -r 9eef81b`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Pure removal of an unrelated sample never wired into this project's own architecture, ADRs, stories, or SKILL.md files. Grepped every `docs/` file for the removed paths — only the queue/bookkeeping files that are supposed to reference it (this file, the Ideal Manager's and Learning & Development Writer's own queues/registers) do.

## ~~2026-08-10 — 8018de4 — chore: remove .vscode/tasks.json and launch.json, dead since the Foundry sample's removal~~

- **Full commit:** `8018de477a0eb113c088bedbd7159bd5fb92c2c2`
- **Files touched:** .vscode/launch.json, .vscode/tasks.json — confirmed via `git diff-tree --no-commit-id --name-only -r 8018de4`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Both files referenced only the now-removed Foundry sample's own debug workflow; neither is cited by any doc in this project's chartered scope.

## ~~2026-08-11 — 8dff76b — docs: ADR governance pass — accept ADR-0044/0047/0048/0049/0050, resolve resulting stories~~

- **Full commit:** `8dff76ba2186816c7e7d39544a201d6aa75967e1`
- **Files touched:** docs/adr/0004-author-normalized-separately-from-post.md, docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md, docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md, docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md, docs/adr/0049-point-in-time-author-follower-count-on-social-post.md, docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md, docs/adr/README.md, docs/future-subsystems.md, docs/open-decisions.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-3-data-model-storage-and-archival.md — confirmed via `git diff-tree --no-commit-id --name-only -r 8dff76b`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift; large but internally consistent.** Cross-checked against current file state (already verified in detail while reviewing `8e1ac18` above, since this commit's own "Still outstanding" corrections are the same ones still visible in `docs/adr/README.md`'s dated history today): ADR-0044/0047/0048/0049/0050 all correctly show `Accepted (2026-08-11)`; the self-acknowledged ADR-0042 five-day stale-outstanding-claim bug is honestly dated-corrected, not silently rewritten; `docs/future-subsystems.md`'s new "Support & QA operations" section is still accurate today (no in-product support surface has since shipped, confirmed via a source grep). Story 1.5's status from this commit was itself superseded two commits later in this same queue (`aaf6bd7`, reviewed separately below) — not a defect of this commit, which accurately reflected ADR-0044's state at the time.

## ~~2026-08-12 — aaf6bd7 — feat: rebuild Story 1.5 watchlist CRUD against ADR-0044 (personal ownership, RFC 7396 PATCH, optimistic locking)~~

- **Full commit:** `aaf6bd72f312ce7df0dc60a376f2f893f3e1508c`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/watchlist-crud/SKILL.md, social-listening-core/contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts, social-listening-core/contracts/epic-3/story-3.8.self-service-tenant-initiated-deletion.contract.test.ts, social-listening-core/contracts/epic-5/story-5.10.retire-x-tenant-id.contract.test.ts, social-listening-core/migrations/0025_watchlists_ownership_and_versioning.sql, social-listening-core/src/db/withTenant.ts, social-listening-core/src/http/versions/v1/watchlistsRouter.ts, social-listening-core/src/tenants/tenantDeletion.ts, social-listening-core/src/watchlists/watchlistStore.ts — confirmed via `git diff-tree --no-commit-id --name-only -r aaf6bd7`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `docs/user-stories/epic-1-repository-and-api-foundation.md`'s Story 1.5 entry, `docs/implementation-plan.md`'s dated note, and `docs/user-stories/README.md` all consistently and accurately describe the real rework (per-user ownership, `If-Match`/optimistic locking, RFC 7396 merge-patch, the 400/404/409/422/428 error mapping) and the real cross-story collision found and fixed (Story 3.8 export/hard-delete pipeline). `watchlist-crud/SKILL.md` reflects the same current, correct contract.

## ~~2026-08-12 — c5fca67 — docs: implementation log entry for Story 1.5 watchlist ownership rebuild~~

- **Full commit:** `c5fca6765784532ecb8421b66ec2d980278a9f20`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r c5fca67`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches `aaf6bd7` reviewed above.

## ~~2026-08-12 — 63dcbce — feat: Story 1.10 -- Postgres boot-time readiness check and a real /v1/health~~

- **Full commit:** `63dcbced329a86999edbe2889db30f574c8c2dfd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/http-api-versioning/SKILL.md, social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/contracts/epic-1/story-1.10.postgres-readiness-and-health.contract.test.ts, social-listening-core/src/db/postgresReadiness.ts, social-listening-core/src/http/server.ts, social-listening-core/src/http/versions/v1/router.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 63dcbce`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-1-repository-and-api-foundation.md`'s Story 1.10 entry and `implementation-plan.md`'s matching dated note accurately describe the real boot-time readiness gate and database-aware `/v1/health`; `http-api-versioning/SKILL.md`'s own load-bearing note correctly cross-references Story 1.10 without duplicating its content, and correctly preserves the pre-existing "deliberately unauthenticated" boundary. Later same-day work (Story 1.10's database health indicator folded into Story 6.6's own scope, per `implementation-plan.md`'s own dated note reviewed above) is consistent with this commit, not contradicted by it.

## ~~2026-08-12 — 0694d2c — docs: implementation log entry for Story 1.10 Postgres readiness check~~

- **Full commit:** `0694d2c07b86ea7d61d5e6c9c0ecbbbb131e814e`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 0694d2c`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches `63dcbce` reviewed above.

## ~~2026-08-12 — 8cf76a2 — chore: stop tracking .claude/settings.local.json, gitignore it~~

- **Full commit:** `8cf76a2f3bdfe29a22404d19e92e7735312cff10`
- **Files touched:** .claude/settings.local.json, .gitignore — confirmed via `git diff-tree --no-commit-id --name-only -r 8cf76a2`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Pure tooling/gitignore housekeeping, nothing in this role's chartered scope.

## ~~2026-08-12 — f2c7788 — feat: Story 2.10 -- connector registration transparency, mechanically enforced (ADR-0048)~~

- **Full commit:** `f2c7788f4d21c971ed93488e5939392bf98504bb`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts — confirmed via `git diff-tree --no-commit-id --name-only -r f2c7788`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift; also confirms the malformed Story 2.10 stub flagged (not fixed) during the `f70b07d` review earlier in this queue was genuinely cleaned up here.** `epic-2-ingestion-connectors-and-rate-limits.md`'s Story 2.10 heading/Status/AC text is now well-formed (no typo, correct `Source: ADR-0048 (Accepted 2026-08-11) · Status: Ready — built 2026-08-12`). All four connectors' `SKILL.md` files' own "Registration transparency (ADR-0048)" sections are consistent with each other and with the real contract.

## ~~2026-08-12 — 9f90a82 — docs: implementation log entry for Story 2.10 connector registration transparency~~

- **Full commit:** `9f90a82063c95f83f3e13523fb63898f72c9ed50`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 9f90a82`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches `f2c7788` reviewed above.

## ~~2026-08-12 — afcb59e — feat: Story 2.11 -- tenant-owned-domain RSS connector with DNS TXT verification (ADR-0050)~~

- **Full commit:** `afcb59ed8e7dee15d261dbee6c5860783f3c6c8b`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts, social-listening-core/contracts/epic-2/story-2.11.tenant-owned-feed-connector.contract.test.ts, social-listening-core/migrations/0026_create_tenant_owned_feed_activations.sql, social-listening-core/src/connectors/tenantOwnedFeed/dnsVerification.ts, social-listening-core/src/connectors/tenantOwnedFeed/feedItemParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedConnector.ts, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantOwnedFeedRouter.ts — confirmed via `git diff-tree --no-commit-id --name-only -r afcb59e`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-2-ingestion-connectors-and-rate-limits.md`, `implementation-plan.md`, and `docs/user-stories/README.md` all consistently describe the same real build (DNS TXT verification, `authMode: 'none'`, organization-as-Author, the deliberate router-mounting-order choice to satisfy ADR-0048 without editing `connectorsRouter.ts`). Cross-checked forward against later same-queue entries (Story 6.12's UI build) — consistent, no contradiction.

## ~~2026-08-12 — 9f09393 — docs: implementation log entry for Story 2.11 tenant-owned-feed connector~~

- **Full commit:** `9f093933e2d7df0eada850f170ebe95fc1850516`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 9f09393`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches `afcb59e` reviewed above.

## ~~2026-08-12 — 34e9dfb — feat: Story 3.9 -- point-in-time author follower count on SocialPost (ADR-0049)~~

- **Full commit:** `34e9dfb8ae712a992ae275d6eb82221c64f9a3d8`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-3/story-3.9.author-follower-count-at-publish.contract.test.ts, social-listening-core/migrations/0027_add_social_posts_author_follower_count_at_publish.sql, social-listening-core/src/connectors/types.ts, social-listening-core/src/posts/socialPostStore.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 34e9dfb`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13, real drift found and corrected in ADR-0049 (governing ADR, not among this commit's own touched files).** This story genuinely resolved ADR-0049's own Open Question 5 (connector-capability declaration shape — decided as `SocialConnector.canProvideFollowerCountAtPublish`, modeled on ADR-0021's `supportedQueryFeatures`), and `epic-3-data-model-storage-and-archival.md`'s own Story 3.9 entry records that resolution accurately — but `docs/adr/0049-point-in-time-author-follower-count-on-social-post.md`'s own Open Questions section still listed it as unresolved, with no strikethrough or resolution note, unlike this project's own established pattern for closing an ADR's Open Question at/after implementation (e.g. ADR-0029's `oid`/`sub` resolution, ADR-0037's OTP-verification confirmation, both reviewed earlier in this pass). Corrected: struck the bullet with a dated resolution note and added a matching Amendment Log entry, citing this commit — Decision/Consequences text untouched.

## ~~2026-08-12 — 3d650c8 — docs: implementation log entry for Story 3.9 author follower count at publish~~

- **Full commit:** `3d650c8f6deecd8f565f7bdc265eef369eed47a5`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 3d650c8`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches `34e9dfb` reviewed above; the real drift that entry's own content pointed at (ADR-0049's unresolved Open Question 5) was found and corrected under that entry's own review, not here.

## ~~2026-08-12 — 4cd4ef1 — docs: correct wrong commit hash on the 2026-08-01 Story 1.5 implementation-log entry~~

- **Full commit:** `4cd4ef1618971b3e35966a69750cf9d5b9cffb6d`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 4cd4ef1`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, and independently re-verified rather than trusted.** This entry's own text says it confirmed the real commit's file list via `git show --stat` — exactly the tool this charter warns can truncate — so re-ran `git diff-tree --no-commit-id --name-only -r f317ace` directly: the real, untruncated file list matches this correction's own claimed nine files exactly, and the one named discrepancy (the original entry's stray `docs/open-items-and-deferred-work.md` claim) is correctly identified as a drafting error, not a second missing commit. The original 2026-08-01 entry is left unedited, per this log's own append-only rule; the correction is a proper new, dated, referencing entry.

## ~~2026-08-12 — fded97b — feat(social-listening-admin): rebuild Story 6.4 watchlist screen for real, against ADR-0044~~

- **Full commit:** `fded97b08813d7ab686582410c7d99668e5d4eac`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md, docs/user-stories/epic-6-tenant-admin-ui.md, docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/watchlist-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts, social-listening-admin/src/app/api/watchlists/[id]/route.ts, social-listening-admin/src/app/api/watchlists/route.ts, social-listening-admin/src/app/tenant/watchlists/WatchlistForm.tsx, social-listening-admin/src/app/tenant/watchlists/WatchlistRow.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r fded97b`, exact match (this is the commit that renamed `epic-6-admin-ui.md` → `epic-6-tenant-admin-ui.md` and split out `epic-7-platform-admin-ui.md`).
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean; one finding considered and deliberately not treated as drift.** The real watchlist rebuild is accurately described in `epic-6-tenant-admin-ui.md`'s own Story 6.4 entry (cross-checked earlier this pass against `aaf6bd7`). Checked whether the `epic-6-admin-ui.md` → `epic-6-tenant-admin-ui.md` rename left any dangling live reference to the old filename: it's cited by name in roughly a dozen places (`docs/adr/README.md`, ADR-0036, ADR-0037, `docs/user-stories/epic-5-security-isolation-and-messaging.md`, `docs/open-items-and-deferred-work.md`, `docs/future-subsystems.md`, `docs/security/security-register.md`, `docs/project docs/Stakeholder-Register.md`) — every one of them is dated prose narrating an event that happened before the 2026-08-12 rename, using the filename that was accurate at the time, the same "don't retroactively rewrite historical narration" discipline this project's own dated-note convention already applies everywhere else (e.g. `docs/implementation-log.md`'s own append-only rule). Not corrected, since correcting them would mean rewriting history to use a filename that didn't exist yet at the point being described.

## ~~2026-08-12 — d96d782 — docs: implementation log entry for Story 6.4 watchlist screen rebuild~~

- **Full commit:** `d96d782380bc109a2f8d718c4f1eaa5e0f99309e`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r d96d782`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (no removed lines). Matches `fded97b` reviewed above.

## ~~2026-08-12 — 4046e75 — feat(social-listening-admin): rebuild Story 6.5 connector status screen for real~~

- **Full commit:** `4046e75598214371efa888fbe6bca049e01bd1dd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx — confirmed via `git diff-tree --no-commit-id --name-only -r 4046e75`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-6-tenant-admin-ui.md`'s Story 6.5 Status line ("Built (real rework, 2026-08-12)"), `implementation-plan.md`'s and `user-stories/README.md`'s matching dated notes, and the SKILL.md's own updated contract citation all match `docs/implementation-log.md`'s own entry for this commit exactly (12/12 suites, 160/160 tests).

## ~~2026-08-12 — 2e77c17 — docs: implementation log entry for Story 6.5 connector status screen rebuild~~

- **Full commit:** `2e77c179a2152d0a27c588936602b6c715bcdd0d`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 2e77c17`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (18 insertions, 0 deletions, confirmed via `git show --numstat`). Matches `4046e75` reviewed above.

## ~~2026-08-12 — 51eecf0 — feat(social-listening-admin): rebuild Story 6.6 Platform Admin console for real~~

- **Full commit:** `51eecf0270472fb6d30f30bca3a53b6d0a9557f8`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/break-glass/request/route.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/break-glass/requests/[requestId]/execute/route.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/route.ts, social-listening-admin/src/app/api/admin/tenants/route.ts, social-listening-admin/src/app/platform-admin/BreakGlassPanel.tsx, social-listening-admin/src/app/platform-admin/ProvisionTenantForm.tsx, social-listening-admin/src/app/platform-admin/TenantAdminControls.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 51eecf0`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-7-platform-admin-ui.md`'s Story 6.6 entry (correctly relocated, correct commit/test counts, "12/12 suites, 178/178 tests" matching `docs/implementation-log.md` exactly) and the SKILL.md's own updated content both match reality.

## ~~2026-08-12 — 7102011 — docs: implementation log entry for Story 6.6 Platform Admin console rebuild~~

- **Full commit:** `710201121f23d5f5afd9c6e04c98e7ee340c2821`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 7102011`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (18 insertions, 0 deletions). Matches `51eecf0` reviewed above.

## ~~2026-08-12 — feae698 — feat(social-listening-admin): show Active/Inactive on every connector, not just connected ones~~

- **Full commit:** `feae698d9a7024381b824fd074866fb9069e4671`
- **Files touched:** docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx — confirmed via `git diff-tree --no-commit-id --name-only -r feae698`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** A small, self-contained enhancement to Story 6.5's already-current entry; no traceability table or SKILL.md claim needed touching (no new dependency, no new file).

## ~~2026-08-12 — e430a6b — docs: implementation log entry for the connector status Active/Inactive indicator~~

- **Full commit:** `e430a6bfa71157c55c0ce4ae088b122c20686829`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r e430a6b`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (16 insertions, 0 deletions). Matches `feae698` reviewed above.

## ~~2026-08-12 — e6c0617 — docs: ADR governance pass — accept ADR-0051, add Story 1.11~~

- **Full commit:** `e6c0617c745db7d9b91ef4989146b90d7811c28a`
- **Files touched:** docs/adr/0051-connector-activation-decoupled-from-credential.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md — confirmed via `git diff-tree --no-commit-id --name-only -r e6c0617`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `docs/adr/README.md`'s footnote 21 and master-table row for ADR-0051 both accurately reflect the acceptance and Story 1.11's addition; `epic-1-repository-and-api-foundation.md`'s Story 1.11 entry (added by this commit, drafting-only at this point) is consistent with `703e755`'s later build, reviewed next.

## ~~2026-08-12 — 18a0e38 — docs: companion ADR-0051 cross-reference notes — ADR-0009/0010/0022/0023/0024/0034~~

- **Full commit:** `18a0e38aa05b479cfb447410864a2482ab2fe660`
- **Files touched:** docs/adr/0009-connector-health-derived-not-stored.md, docs/adr/0010-error-handling-and-auto-disable-policy.md, docs/adr/0022-derived-data-caching-and-refresh-strategy.md, docs/adr/0023-proportional-connector-failure-threshold.md, docs/adr/0024-newswire-connector-direct-wire-rss-issuer-as-author.md, docs/adr/0034-connector-connect-disconnect-crud-ownership-tier-aware.md — confirmed via `git diff-tree --no-commit-id --name-only -r 18a0e38`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Directly verified all six named ADR files each carry a real, dated "Note on relation to ADR-0051" / "Supersession update" / Clarification section, none editing that ADR's own original Decision/Consequences text — exactly the governance-table categories this commit's own message claims, correctly applied.

## ~~2026-08-12 — 703e755 — feat: Story 1.11 — connector activation decoupled from credential presence~~

- **Full commit:** `703e7558d46e43461505ddb2eaca5380a6dd4ed5`
- **Files touched:** docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-core/contracts/epic-1/story-1.11.connector-activation.contract.test.ts, social-listening-core/contracts/epic-2/story-2.3.error-handling-auto-disable.contract.test.ts, social-listening-core/contracts/epic-2/story-2.4.bounded-queues-and-dead-lettering.contract.test.ts, social-listening-core/migrations/0028_create_connector_activations.sql, social-listening-core/src/connectors/connectorActivationStore.ts, social-listening-core/src/connectors/connectorHealth.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 703e755`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-1-repository-and-api-foundation.md`'s Story 1.11 entry correctly shows "Built 2026-08-12," matching `docs/implementation-log.md`'s own entry (54/54 suites, 391/391 tests).

## ~~2026-08-12 — 7ffd477 — docs: implementation log entry for Story 1.11 (social-listening-core@703e755)~~

- **Full commit:** `7ffd477322970f0e4d14d2d2f804ee12f1bc74ae`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 7ffd477`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (26 insertions, 0 deletions). Matches `703e755` reviewed above.

## ~~2026-08-12 — f8985b9 — docs: draft Stories 1.12, 2.12, 6.15 — closing three of Story 1.11's own named gaps~~

- **Full commit:** `f8985b977ec8382bdce9c79648a8b66ef3f224c9`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-6-tenant-admin-ui.md — confirmed via `git diff-tree --no-commit-id --name-only -r f8985b9`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** All three stories drafted here (1.12, 2.12, 6.15) were later built by the three commits reviewed immediately below, each with a real, matching "Built" note added at the correct time — consistent throughout.

## ~~2026-08-12 — c3af2a7 — feat: Story 1.12 — GET /v1/connectors/:platformId includes real isActive~~

- **Full commit:** `c3af2a7aa5d0ab439773a8edab512c2576737aa0`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/contracts/epic-1/story-1.12.connector-status-includes-activation.contract.test.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts — confirmed via `git diff-tree --no-commit-id --name-only -r c3af2a7`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-1-repository-and-api-foundation.md`'s Story 1.12 entry correctly shows "Built 2026-08-12" with a matching dated note (55/55 suites, 394/394 tests), consistent with `docs/implementation-log.md`.

## ~~2026-08-12 — c481e01 — docs: implementation log entry for Story 1.12 (social-listening-core@c3af2a7)~~

- **Full commit:** `c481e0135d4cd3ce1cfbfa48a26b8d28702025fa`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r c481e01`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (14 insertions, 0 deletions). Matches `c3af2a7` reviewed above.

## ~~2026-08-12 — da102a9 — feat: Story 2.12 — exclude retryable failures from the failing derivation~~

- **Full commit:** `da102a9e51f8229a7e617371efaa1c490d2fa2b6`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/contracts/epic-2/story-2.12.retryable-failures-excluded-from-auto-disable.contract.test.ts, social-listening-core/src/connectors/connectorHealth.ts — confirmed via `git diff-tree --no-commit-id --name-only -r da102a9`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-2-ingestion-connectors-and-rate-limits.md`'s Story 2.12 entry correctly shows "Built 2026-08-12," matching `docs/implementation-log.md` (55/55 suites, 399/399 tests).

## ~~2026-08-12 — 5adff09 — docs: implementation log entry for Story 2.12 (social-listening-core@da102a9)~~

- **Full commit:** `5adff094d2b35fce849dae6efb96b2566e904d13`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 5adff09`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (14 insertions, 0 deletions). Matches `da102a9` reviewed above.

## ~~2026-08-12 — 8abacce — docs: draft Story 2.13 — closing a real gap, ADR-0042 (Wikipedia) never got a story~~

- **Full commit:** `8abaccecdeba7c5534359297a2812c25f54142e6`
- **Files touched:** docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md — confirmed via `git diff-tree --no-commit-id --name-only -r 8abacce`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-2-ingestion-connectors-and-rate-limits.md`'s Story 2.13 correctly remains "Ready — no code exists yet" (still true as of this review), and `docs/adr/README.md`'s own footnote 16 correction note accurately describes the gap this commit found and closed.

## ~~2026-08-12 — cc7cae2 — feat: Story 6.15 — activate/deactivate controls on the connector screens~~

- **Full commit:** `cc7cae26080787f8221632552187c6fb6e2b942b`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/api/connectors/[platformId]/activate/route.ts, social-listening-admin/src/app/api/connectors/[platformId]/deactivate/route.ts, social-listening-admin/src/app/tenant/connectors/ActivateDeactivateButton.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r cc7cae2`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-6-tenant-admin-ui.md`'s Story 6.15 entry correctly shows "Built 2026-08-12" with the deliberate Story 6.5 contract rewrite (not addition) honestly noted, matching `docs/implementation-log.md` (13/13 suites, 197/197 tests).

## ~~2026-08-12 — 62d78ff — docs: implementation log entry for Story 6.15 (social-listening-admin@cc7cae2)~~

- **Full commit:** `62d78ffa57dd134cacef6aa076835123c047a4d5`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 62d78ff`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (22 insertions, 0 deletions). Matches `cc7cae2` reviewed above.

## ~~2026-08-12 — 6e110aa — fix: reject unresolved identity in admin role-gating (Story 6.2 healing)~~

- **Full commit:** `6e110aa7c5f2759d76822f52226b89312b0271dc`
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/lib/role-routing.ts, social-listening-core/scripts/ensureContractTestIdentity.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 6e110aa`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `role-routing-shell/SKILL.md`'s own "Load-bearing constraints" and contract-citation updates accurately describe the real `getRoleShell(null)` fix and the new real-core-instance test setup this healing pass added.

## ~~2026-08-12 — eb8b10b — docs: implementation log entry for the Story 6.2 role-gating healing pass~~

- **Full commit:** `eb8b10b2deee116df913c1f401b33edca7fe1bf3`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r eb8b10b`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (24 insertions, 0 deletions). Matches `6e110aa` reviewed above.

## ~~2026-08-12 — 4801a36 — fix: run pending migrations automatically before social-listening-core's dev server starts~~

- **Full commit:** `4801a36b470d8f8c48778b43020db18129443b55`
- **Files touched:** social-listening-core/README.md, social-listening-core/package.json — confirmed via `git diff-tree --no-commit-id --name-only -r 4801a36`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** README.md's new prose describes exactly what `package.json`'s `dev`/`dev:server` script split now does — no traceability table or story status is implicated by a pure dev-tooling fix (no `docs/implementation-log.md` entry expected either, consistent with this project's own convention for chore-only commits).

## ~~2026-08-12 — d8ba590 — feat: Story 6.11 — post feed screen in social-listening-admin~~

- **Full commit:** `d8ba590883512f353ed9c79872a321a5a30ad02f`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/app/tenant/posts/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts, social-listening-admin/src/lib/core-client.ts, social-listening-core/.claude/skills/posts-api/SKILL.md — confirmed via `git diff-tree --no-commit-id --name-only -r d8ba590`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-6-tenant-admin-ui.md`'s Story 6.11 entry correctly shows "Built (2026-08-12)"; the corrected stale `X-Tenant-Id` note in `social-listening-core/.claude/skills/posts-api/SKILL.md` (left over since Story 5.10/ADR-0033) is exactly the class of staleness this role exists to catch, and it's fixed in this same commit, not left for a later pass.

## ~~2026-08-12 — 6362dda — docs: implementation log entry for Story 6.11 (social-listening-admin@d8ba590)~~

- **Full commit:** `6362dda3d38ffbdf1365624d7a3fc4491e1459b1`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 6362dda`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (24 insertions, 0 deletions). Matches `d8ba590` reviewed above.

## ~~2026-08-12 — 99c1dcf — fix: activation now gates AI enrichment provider selection (Story 2.9 healing)~~

- **Full commit:** `99c1dcf04f08cc6d358e753df390b5802a56e728`
- **Files touched:** social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/social-post-enrichment/SKILL.md, social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts, social-listening-core/contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 99c1dcf`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Directly inspected the SKILL.md diffs: `azure-ai-language-connector/SKILL.md`'s new "Load-bearing constraints" bullets accurately describe the real `isConnectorActive()` gate now added to `tryProvider()`, and honestly name the previously-undecided PROVIDERS-order question as now Menno-confirmed intentional (not silently assumed). `social-post-enrichment/SKILL.md`'s "best-effort" bullet correctly extended to cover the new inactive-connector case.

## ~~2026-08-12 — 43d36ca — feat: show which AI provider enriched a post on the detail screen~~

- **Full commit:** `43d36caa6094083c993bb774c49ca9e2e0acc853`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 43d36ca`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Small, self-contained enhancement to Story 6.11's already-real post detail screen; `post-feed/SKILL.md`'s update is consistent with Story 6.16's own later text referencing the same `modelUsed` display.

## ~~2026-08-12 — 3b5f08b — docs: implementation log entries for the AI provider activation-gating fix and enrichment attribution enhancement~~

- **Full commit:** `3b5f08bc0b5c916607f841a090c49610761473ce`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 3b5f08b`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (32 insertions, 0 deletions). Matches `99c1dcf`/`43d36ca` reviewed above.

## ~~2026-08-12 — 216c32a — style: global baseline stylesheet for social-listening-admin~~

- **Full commit:** `216c32a048151d6c802580ded68dc4131ee54423`
- **Files touched:** social-listening-admin/src/app/globals.css, social-listening-admin/src/app/layout.tsx — confirmed via `git diff-tree --no-commit-id --name-only -r 216c32a`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Pure CSS/layout styling, no story/ADR/contract claim anywhere in this diff for any traceability doc to drift against.

## ~~2026-08-12 — e556c3c — docs: name the AI-provider status display gap on the connector status screen~~

- **Full commit:** `e556c3ca630a7d5d5f7f5106f88798715e7f6bf0`
- **Files touched:** social-listening-admin/.claude/skills/connector-status-view/SKILL.md — confirmed via `git diff-tree --no-commit-id --name-only -r e556c3c`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Pure, honest gap-documentation addition (AI providers permanently showing "no ingestion runs yet" even after real successful enrichment) — Menno's own explicit direction to leave the behavior as-is and just document it, correctly reflected as a named, deliberately-unaddressed item rather than silently patched or hidden.

## ~~2026-08-12 — 51a2b40 — feat: Story 6.16 (backend) — POST /v1/posts/:id/enrich~~

- **Full commit:** `51a2b4055acec4a4b07abfcb89e3b0f0f2b25120`
- **Files touched:** social-listening-core/.claude/skills/posts-api/SKILL.md, social-listening-core/contracts/epic-3/story-6.16.post-manual-enrich-endpoint.contract.test.ts, social-listening-core/src/http/versions/v1/postsRouter.ts, social-listening-core/src/posts/socialPostStore.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 51a2b40`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Backend half of Story 6.16, traceability (epic file, plan, README) updated together with the frontend half in the later `e5fec8f` commit, per that project's own established pattern for same-day backend+frontend+docs splits — confirmed the combined result is accurate.

## ~~2026-08-12 — 21da4f5 — feat: Story 6.16 (frontend) — manual "run enrichment now" button~~

- **Full commit:** `21da4f57568300c80047ceaa62e3e091ee7e02ad`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.16.manual-enrichment-button.contract.test.ts, social-listening-admin/src/app/api/posts/[id]/enrich/route.ts, social-listening-admin/src/app/tenant/posts/RunEnrichmentButton.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 21da4f5`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** Frontend half of Story 6.16; see `51a2b40`/`e5fec8f` for the full traceability confirmation.

## ~~2026-08-12 — e5fec8f — docs: Story 6.16 traceability and implementation log entries~~

- **Full commit:** `e5fec8fe0b46cb7c2dd7c9911249a92e2e423c22`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md — confirmed via `git diff-tree --no-commit-id --name-only -r e5fec8f`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-6-tenant-admin-ui.md`'s Story 6.16 entry correctly shows "Built 2026-08-12" citing both real commits (`51a2b40`, `21da4f5`) and matching test counts (`social-listening-admin` 15/15 suites, 235/235 tests) exactly as `docs/implementation-log.md` and `CLAUDE.md`'s own (pre-6.12/6.13) status line both stated at the time.

## ~~2026-08-12 — ab37bf3 — docs: clarify break-glass request intake channel (ADR-0030, Story 5.13)~~

- **Full commit:** `ab37bf330c9a9049554771efc032e240a31752d2`
- **Files touched:** docs/adr/0030-admin-tier-design-platform-admin-rls-exception.md, docs/user-stories/epic-5-security-isolation-and-messaging.md — confirmed via `git diff-tree --no-commit-id --name-only -r ab37bf3`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** ADR-0030 gained a proper dated "Clarification" section (correct governance-table category — an implicit requirement made explicit, not a Decision-text edit), and `epic-5-security-isolation-and-messaging.md`'s Story 5.13 entry carries a matching 2026-08-12 note — both confirmed present and consistent with each other.

## ~~2026-08-12 — f5bb2d4 — feat: tenant rename (PATCH /v1/admin/tenants/:id gains name)~~

- **Full commit:** `f5bb2d4fbc30fb9d671ebde3c13501ac27f8c162`
- **Files touched:** docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/route.ts, social-listening-admin/src/app/platform-admin/TenantAdminControls.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-core/.claude/skills/platform-admin-tenant-management/SKILL.md, social-listening-core/.claude/skills/tenants/SKILL.md, social-listening-core/contracts/epic-5/story-5.12.platform-admin-tenant-management.contract.test.ts, social-listening-core/migrations/0029_grant_platform_admin_name_update.sql, social-listening-core/src/http/versions/v1/adminTenantsRouter.ts, social-listening-core/src/tenants/tenantStore.ts — confirmed via `git diff-tree --no-commit-id --name-only -r f5bb2d4`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-5-security-isolation-and-messaging.md`'s Story 5.12 entry and `epic-7-platform-admin-ui.md`'s Story 6.6 entry both carry a matching 2026-08-12 "Enhancement" note citing the real new grant migration (0029) and the `name` field — cross-repo change, both repos' docs cross-checked and consistent.

## ~~2026-08-12 — 8905c21 — docs: implementation log entry for tenant rename enhancement (cross-repo@f5bb2d4)~~

- **Full commit:** `8905c219aae9f3b3d08b6bac87d3ffa01491b8c4`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 8905c21`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (16 insertions, 0 deletions). Matches `f5bb2d4` reviewed above.

## ~~2026-08-12 — c2aa7b1 — feat: ProvisionTenantForm gains an optional domain field~~

- **Full commit:** `c2aa7b121882b97bbc5a6041eb68aa7a2c77d2d2`
- **Files touched:** docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/api/admin/tenants/route.ts, social-listening-admin/src/app/platform-admin/ProvisionTenantForm.tsx — confirmed via `git diff-tree --no-commit-id --name-only -r c2aa7b1`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-7-platform-admin-ui.md`'s Story 6.6 entry carries a matching "Enhancement, 2026-08-12" note stating plainly no backend work was needed (the field already existed server-side) — accurate.

## ~~2026-08-12 — 8b54aae — docs: implementation log entry for ProvisionTenantForm domain field (social-listening-admin@c2aa7b1)~~

- **Full commit:** `8b54aaebc1bc3caf213c0e7503742844d830fe10`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 8b54aae`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (16 insertions, 0 deletions). Matches `c2aa7b1` reviewed above.

## ~~2026-08-13 — 57fe1de — docs: correct CLAUDE.md's stale Epic 6 build-status summary~~

- **Full commit:** `57fe1def1dbea307fd10f243c10584afa3144c21`
- **Files touched:** CLAUDE.md — confirmed via `git diff-tree --no-commit-id --name-only -r 57fe1de`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13/14 — real drift found and corrected, twice over.** This commit's own correction (accurate at the time — Stories 6.1–6.11, 6.15, 6.16 built, 15/15 suites/235/235 tests, 6.12/6.13/6.14 remaining) was itself overtaken the same day: Stories 6.12 (`e1e9913`), 6.13 (`500a4b9`), and 6.17 (`d0eb088`, drafted+built same day) all shipped after this commit landed, leaving `CLAUDE.md`'s status line and Map bullet stale again by the time of this review. **Corrected directly in `CLAUDE.md`:** the top-of-file status line now reflects Stories 6.1–6.13/6.15–6.17 built, Story 6.14 remaining Ready (18/18 suites, 301/301 tests, matching `docs/implementation-log.md`'s own Story 6.17 entry), with an explicit dated note explaining the correction rather than a silent rewrite; the Map's `social-listening-admin/` bullet updated to list 6.12/6.13/6.17 as built and only 6.14 as remaining; and the "most recently Story 6.1" claim about `docs/implementation-log.md`'s own most recent entry (stale since 2026-08-04) updated to Story 6.17. **A second, separate, pre-existing staleness also found and fixed in the same file:** items 3/22 both still said "37 ADRs" — stale since well before this very commit (this commit's own diff left that number untouched even though ADR-0051 had already been accepted the day before) — corrected to the current real count (53, all Accepted, per `docs/adr/README.md`'s own master index), phrased to point at that file's own count as authoritative rather than restating a number that will go stale again. `CLAUDE.md`'s own text explicitly frames itself as "a snapshot, not re-verified every session" — corrections applied in place, matching this commit's own established style, not as a dated-note append (unlike the append-only historical-record files this project treats differently, e.g. `docs/implementation-log.md`, ADRs).

## ~~2026-08-13 — e1e9913 — feat: tenant-owned-feed connector setup UI (Story 6.12, ADR-0050)~~

- **Full commit:** `e1e99139dedaa53eef7c018ba468ce934919c7a9`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/connect/route.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/verify-domain/route.ts, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r e1e9913`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-6-tenant-admin-ui.md`'s Story 6.12 entry correctly shows "Built 2026-08-13" with the named, honest gap (TXT instructions not re-fetchable after reload) documented rather than hidden, matching `docs/implementation-log.md` (16/16 suites, 261/261 tests). (CLAUDE.md's own staleness relative to this commit is the `57fe1de` finding above, not a defect in this commit itself.)

## ~~2026-08-13 — b155bc5 — docs: implementation log entry for Story 6.12 (social-listening-admin@e1e9913)~~

- **Full commit:** `b155bc51fb84952fb8c28367e26ee20d992401da`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r b155bc5`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (18 insertions, 0 deletions). Matches `e1e9913` reviewed above.

## ~~2026-08-13 — 500a4b9 — feat: self-service tenant deletion/offboarding UI (Story 6.13, ADR-0043)~~

- **Full commit:** `500a4b9a4383f1e01330c0e322e9c44e55ecf6ff`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/tenant-deletion-offboarding/SKILL.md, social-listening-admin/contracts/epic-6/story-6.13.tenant-deletion-offboarding.contract.test.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/confirm/route.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/export/route.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/request/route.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/route.ts, social-listening-admin/src/app/tenant/settings/delete/TenantDeletionPanel.tsx, social-listening-admin/src/app/tenant/settings/delete/page.tsx, social-listening-admin/src/lib/core-client.ts — confirmed via `git diff-tree --no-commit-id --name-only -r 500a4b9`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, no drift.** `epic-6-tenant-admin-ui.md`'s Story 6.13 entry correctly shows "Built 2026-08-13," honestly documenting the cross-component regression found/reverted against Story 6.9's sealed contract and the resulting no-in-app-link gap, matching `docs/implementation-log.md` (17/17 suites, 287/287 tests).

## ~~2026-08-13 — 42ff7b5 — docs: implementation log entry for Story 6.13 (social-listening-admin@500a4b9)~~

- **Full commit:** `42ff7b5e82f62989bb1e14c6b40b187b2876c574`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 42ff7b5`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13 — clean, appended only** (16 insertions, 0 deletions). Matches `500a4b9` reviewed above.

## ~~2026-08-13 — a479383 — feat: live ingestion-polling scheduler (Story 1.13, ADR-0052)~~

- **Full commit:** `a479383e2ae200b104732986531f47952971289b`
- **Files touched:** docs/adr/0052-live-ingestion-polling-scheduler.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/.claude/skills/live-ingestion-polling-scheduler/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts, social-listening-core/src/connectors/bootstrapConnectors.ts, social-listening-core/src/connectors/types.ts, social-listening-core/src/http/server.ts, social-listening-core/src/scheduler/pollScheduler.ts — confirmed via `git diff-tree --no-commit-id --name-only -r a479383`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13/14 — real drift found and corrected.** This single commit both drafted ADR-0052/accepted it and genuinely built Story 1.13 (real `pollScheduler.ts`, `bootstrapConnectors.ts`, a 433-line contract, full suite 58/58 suites, 425/425 tests, confirmed against `docs/implementation-log.md`'s own matching entry) — but `docs/user-stories/epic-1-repository-and-api-foundation.md`'s own Story 1.13 entry (added by this exact commit) was only ever given "Status: Ready" with drafting-only ("proven by a test...") framing, never a "Built" note, unlike `docs/implementation-plan.md`'s and `docs/user-stories/README.md`'s matching, already-accurate "Story 1.13 built" dated notes (also added by this same commit). One of the three doc files this commit touched was never brought up to date with the other two. **Corrected directly in `epic-1-repository-and-api-foundation.md`:** the Status line now reads "Built 2026-08-13," and a dated "Built 2026-08-13" + "Documentation Steward correction" note is appended after the Acceptance Criteria (no AC text itself changed), citing the real commit, contract file, and test counts, and explaining exactly what was stale and why.

## ~~2026-08-13 — 9a347c6 — docs: implementation log entry for Story 1.13 (social-listening-core@a479383)~~

- **Full commit:** `9a347c65f142bfb13d11b311d00fff464a7b96da`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 9a347c6`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13/14 — the log entry itself is clean, appended only** (18 insertions, 0 deletions) and factually accurate. The drift found in this neighborhood (`epic-1-repository-and-api-foundation.md`'s stale Story 1.13 status) belongs to `a479383`, the commit that actually introduced the epic-file text — see that entry above for the fix; this log-entry commit is not itself at fault.

## ~~2026-08-13 — d0eb088 — feat: tenant-wide activate/deactivate control on tenant-owned-feed screen (Story 6.17, ADR-0051)~~

- **Full commit:** `d0eb08813a3d083602bd05ed8349a6fae880fc5a`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.17.tenant-owned-feed-activation-control.contract.test.ts, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/page.tsx — confirmed via `git diff-tree --no-commit-id --name-only -r d0eb088`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13/14 — clean, no drift found belonging to this commit; one pre-existing related finding confirmed already fixed.** `epic-6-tenant-admin-ui.md`'s Story 6.17 entry correctly shows "Built" with a full, honest account of the `markVerified()`/`connector_activations` disconnect it closes, matching `docs/implementation-log.md` (18/18 suites, 301/301 tests). This story's own text names, but explicitly declines to fix, a documentation-accuracy finding on ADR-0051's Context section (its "de facto activation gate" claim) — verified directly that this was already corrected, with a proper dated "Documentation Steward correction, 2026-08-13" note on `docs/adr/0051-connector-activation-decoupled-from-credential.md` itself (not editing the original Context text), so no further action needed here.

## ~~2026-08-13 — 780f981 — docs: implementation log entry for Story 6.17 (social-listening-admin@d0eb088)~~

- **Full commit:** `780f9817c6516eefb487afadc9255151316301b8`
- **Files touched:** docs/implementation-log.md — confirmed via `git diff-tree --no-commit-id --name-only -r 780f981`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13/14 — clean, appended only** (18 insertions, 0 deletions). Matches `d0eb088` reviewed above.

## ~~2026-08-13 — bd9bbfc — docs: accept ADR-0053, draft Story 3.10 (canonical Markdown post-body normalization)~~

- **Full commit:** `bd9bbfc1e35a2ee821bd362be70e00a2d6b506fe`
- **Files touched:** docs/adr/0053-canonical-markdown-post-body-normalization-at-ingestion.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md — confirmed via `git diff-tree --no-commit-id --name-only -r bd9bbfc`, exact match.
- **Status:** ~~Pending review~~ **Reviewed 2026-08-13/14 — clean, no drift.** `docs/adr/README.md`'s footnote 23 and "Proposed (not yet decided): None outstanding" tracker both accurately reflect ADR-0053's same-day acceptance after twelve in-place revisions; `epic-3-data-model-storage-and-archival.md`'s Story 3.10 correctly shows "Ready" (drafting-only, no code written) — checked against the current repo state and confirmed still accurate as of this review (no build commit for Story 3.10 exists in this queue's range or after it).

**PM-side project docs (`docs/project docs/`), checked against this entire batch's real git state, per this role's 2026-08-06 scope extension:** no drift found. `Uncertainty-Management-Plan.md`'s risk register (R-04, and the connector-status entries) remains accurate and was not touched by anything in this batch; `Project Management Plans/Go-Live-Readiness-Definition.md`'s Stage 0 classification and its own already-existing 2026-08-06/2026-08-13 Documentation Steward corrections remain accurate and unaffected by this batch (they concern self-service sign-up, Stories 5.15–5.18/6.7, which predate this batch entirely); `Development-Approach-and-Life-Cycle-Plan.md`'s phase table already carries its own 2026-08-06 Phase 4.5 correction and was not further diverged by anything in this batch (this batch added no new phase). **One separate, lower-confidence, out-of-scope observation, not fixed:** `CLAUDE.md` (itself, beyond the specific staleness already corrected under `57fe1de` above) describes `docs/implementation-plan.md` as having "phases (0 through 6, plus an inserted Phase 4.5)," but `implementation-plan.md`'s own real phase headers only go up to Phase 5 (0, 1, 2, 3, 4, 4.5, 5) — "Phase 6" appears to be informal shorthand for "Epic 6/Admin UI" that predates this entire batch and isn't introduced or exposed by any commit reviewed in this pass; flagged here for a future, dedicated look rather than fixed speculatively under this session's time budget.

## ~~2026-08-13 — 13f5163 — docs: clear review backlog — Documentation Steward, L&D Writer, Ideal Manager passes (2026-08-13)~~

- **Full commit:** `13f5163e336b549c0bfb573021b6965114d7c578`
- **Files touched:** docs/adr/0051-connector-activation-decoupled-from-credential.md, docs/adr/feature-coverage-review.md, docs/implementation-log.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/manuals/system-admin-manual.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/open-decisions.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/project docs/Business-Case-v6.0.md, docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md, docs/project docs/Stakeholder-Register.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift of its own.** This commit is itself a correction pass (Documentation Steward/L&D Writer/Ideal Manager backlog clearing, 2026-08-13) — its own edits to ADR-0051 (a proper dated correction note, not an edit to original Context text), `docs/open-decisions.md`, `Stakeholder-Register.md`, `Business-Case-v6.0.md`, and `Go-Live-Readiness-Definition.md` were checked directly against current state and remain accurate; the manuals/`feature-coverage-review.md`/manager-register.md edits are outside this role's own chartered file scope (Learning & Development Writer / Ideal Manager territory respectively).

## ~~2026-08-13 — dcec172 — feat: Story 3.10 — canonical Markdown post-body storage and enrichment input (ADR-0053)~~

- **Full commit:** `dcec172f4f940fa048a3f05a2063e69628af0dc6`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/canonical-markdown-conversion/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.6.newswire-connector.contract.test.ts, social-listening-core/contracts/epic-3/story-3.10.canonical-markdown-post-body-normalization.contract.test.ts, social-listening-core/migrations/0030_add_social_posts_body_markdown.sql, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/src/connectors/gnews/gnewsConnector.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/newswire/rssFeedParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/feedItemParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/content/htmlToMarkdown.ts, social-listening-core/src/content/turndown-plugin-gfm.d.ts, social-listening-core/src/posts/socialPostStore.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** `canonical-markdown-conversion/SKILL.md`'s and `gnews-connector/SKILL.md`'s own "Relations to other components" claims (`htmlToMarkdown()` call sites, `insertSocialPost()`'s `body_markdown`/`body_markdown_version` fields, `enrichPost()` input widening) verified directly against the real code — real call sites confirmed at each connector's own `ingestX()` function, not only inside a contract fixture, per the relationship-assertion convention. `docs/user-stories/README.md`/`docs/implementation-plan.md`/`epic-3-data-model-storage-and-archival.md` all correctly show Story 3.10 Ready, drafting-only, at this point (built the same day, by `dcec172` itself — see that commit's own `df0c2c3` log entry below).

## ~~2026-08-13 — df0c2c3 — docs: implementation log entry for Story 3.10 (social-listening-core@dcec172)~~

- **Full commit:** `df0c2c3bbac458a9846e2c26adeb954626fec8e4`
- **Files touched:** docs/implementation-log.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only.** Matches `dcec172` reviewed above; file list confirmed via `git diff-tree`.

## ~~2026-08-13 — e59b2da — docs: methodology retrospective — relationship-assertion contracts, story resume, Built field, environment gotchas~~

- **Full commit:** `e59b2dabf32a9c95529ce6a75e1bdac4e5906dda`
- **Files touched:** .claude/agents/documentation-steward.md, .claude/skills/heal-contract-failure/SKILL.md, .claude/skills/implement-story/SKILL.md, CLAUDE.md, docs/environment-gotchas.md, docs/implementation-methodology.md, docs/project docs/Lessons-Learned-Register.md, docs/templates/component-skill-template.md, docs/user-stories/README.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** This is the commit that introduced the `**Built:**` field convention (`docs/user-stories/README.md`) and the relationship-assertion convention (`docs/implementation-methodology.md`) this very pass has been enforcing throughout — both conventions checked directly against their own stated scope (forward-only from 2026-08-13) and confirmed correctly applied across every epic file and `SKILL.md` touched later in this batch (see the many downstream findings below, all of which are instances of exactly the drift these two conventions exist to catch).

## ~~2026-08-13 — 6443562 — chore: rewrite root README, harden AGENTS.md, wire up VS Code test discovery~~

- **Full commit:** `6443562c92fd966d53f3c581cb46eaf67d35e6be`
- **Files touched:** .mcp.json, .vscode/extensions.json, .vscode/mcp.json, .vscode/settings.json, AGENTS.md, Dockerfile, README.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, requirements.txt, social-listening-admin/next-env.d.ts, social-listening-admin/package-lock.json
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Root `README.md` (rewritten whole by this commit) had gone stale over the following five days of real build activity never reflected back into it: its "Real connectors" bullet still said "Reddit is the next connector on the roadmap; Wikipedia has emerged as a stronger near-term candidate" after both Wikipedia (Story 2.13) and Facebook (Story 2.15) actually shipped as real, built connectors, and its "Where to start reading" section still said "stories across 7 epics" after Epic 8 (Analytics Dashboard) was added 2026-08-17. Corrected directly in `README.md` — the connectors bullet with a dated note (this file's "Status" section already defers to `CLAUDE.md`/the Log for point-in-time state, but this bullet is a factual architecture claim, not part of that deferred section), the epic count as a plain fix matching this file's own "snapshot for orientation, not re-verified every session" framing.

## ~~2026-08-13 — 8d210af — chore: post-commit hook queue entries for 6443562~~

- **Full commit:** `8d210af4300713a0622403ddd79c5c2d2c517740`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, mechanical.** Queue-entry append across `docs/management/pending-manager-reviews.md`, `docs/pending-documentation-steward-reviews.md`, `docs/pending-learning-development-reviews.md`, and `docs/time-tracking.md` for `6443562`. Nothing here makes a factual claim about shipped/decided project state for this role to audit.

## ~~2026-08-17 — ea9d9fe — fix: heal contract staleness from an uncommitted Server/Client component split~~

- **Full commit:** `ea9d9fe0e58b1ae7b2c3d7b566de5db92d1ee799`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/package-lock.json, social-listening-admin/package.json, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/layout.tsx, social-listening-admin/src/app/platform-admin/layout.tsx, social-listening-admin/src/app/sign-in/page.tsx, social-listening-admin/src/app/signed-out/page.tsx, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/ConnectorStatusClient.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/app/tenant/layout.tsx, social-listening-admin/src/app/tenant/page.tsx, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/RunEnrichmentButton.tsx, social-listening-admin/src/app/tenant/posts/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts, social-listening-admin/src/app/tenant/watchlists/WatchlistForm.tsx, social-listening-admin/src/app/tenant/watchlists/WatchlistRow.tsx, social-listening-admin/src/app/tenant/watchlists/WatchlistsClient.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/components/shell/AppHeader.tsx, social-listening-admin/src/components/shell/AppShell.tsx, social-listening-admin/src/components/shell/AppSidebar.tsx, social-listening-admin/src/components/shell/index.ts, social-listening-admin/src/components/shell/shell.test.ts, social-listening-admin/src/components/ui/ConfirmModal.tsx, social-listening-admin/src/components/ui/EmptyState.tsx, social-listening-admin/src/components/ui/InlineError.tsx, social-listening-admin/src/components/ui/RelativeTime.tsx, social-listening-admin/src/components/ui/Slideover.tsx, social-listening-admin/src/components/ui/StatusBadge.tsx, social-listening-admin/src/components/ui/TagInput.tsx, social-listening-admin/src/components/ui/components.test.ts, social-listening-admin/src/components/ui/index.ts, social-listening-admin/src/lib/core-client.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** Spot-checked `post-feed/SKILL.md`'s own rewritten content against the real Server/Client component split (`PostsFeedClient.tsx`) it describes — accurate. The six healed stories' own epic-file entries (6.2/6.3/6.5/6.11/6.12/6.15) show no resulting staleness from this refactor; the two real wording reconciliations this commit made (`StatusBadge`'s "Paused" label, the sign-in button text) match `frontend-design-specification.md` §6.1/§5.1 as claimed.

## ~~2026-08-17 — 30816ad — docs: log the 2026-08-17 healing pass for Stories 6.1/6.2/6.3/6.5/6.11/6.12/6.15~~

- **Full commit:** `30816ad3772725b6d4f69d2de660c17a5363d3e3`
- **Files touched:** docs/implementation-log.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only** (20 insertions). Matches `ea9d9fe` reviewed above.

## ~~2026-08-17 — 5558e11 — feat: Story 8.1 — Analytics dashboard shell, date-range filter, Overview and Sources tabs~~

- **Full commit:** `5558e11f61be16fce51cb49f31d252c80e11275b`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/src/app/api/analytics/summary/route.ts, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/AnimatedChartTooltip.tsx, social-listening-admin/src/app/tenant/analytics/GlobalDateRangePicker.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/SourcesTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/analytics/fetchAnalyticsSummary.ts, social-listening-admin/src/app/tenant/analytics/page.tsx
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 8.1's own header in `docs/user-stories/epic-8-analytics-dashboard.md` read `**Status:** Ready` even though it shipped in this exact commit and the story's own `**Built:**` field already said so — the story's narrative notes in `docs/user-stories/README.md` and `docs/implementation-plan.md` correctly said "built," but the epic file's own fixed-shape header didn't. Corrected directly (Status now "Built 2026-08-17"), as part of a single consolidated fix across all six Epic 8 stories (8.1–8.6) — see that file's own 2026-08-19 dated Documentation Steward note at the end for the full account and every hash verified.

## ~~2026-08-17 — 87e8cf4 — docs: ADR-0054 (Analytics Dashboard), Epic 8, and Story 8.1 traceability~~

- **Full commit:** `87e8cf4baba1c5d846277bbec015e7dd053aefa5`
- **Files touched:** docs/adr/0008-defer-topic-time-series-and-charting.md, docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/README.md, docs/design/frontend-design-specification.md, docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** `docs/adr/README.md` footnote 24 and ADR-0054's own Status line correctly track (Proposed at this point, accepted later the same day per the entry below); `docs/adr/0008-defer-topic-time-series-and-charting.md`'s new Pending-supersession note correctly names the exact, narrow scope ADR-0054 would change without editing ADR-0008's own Decision text; `docs/implementation-plan.md`/`docs/user-stories/README.md`/`epic-8-analytics-dashboard.md` all correctly show Story 8.1 traceability at this point. The Story 8.1 Status-line drift this commit's own epic-file entry carries is the same one already attributed to `5558e11` above, not repeated here.

## ~~2026-08-17 — a54bf05 — feat: Story 8.2 — Sentiment tab~~

- **Full commit:** `a54bf05bd12b169431c0f224c54016ffd6ea3355`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/SentimentTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected (same consolidated fix as `5558e11`).** Story 8.2's own header had the identical "Status: Ready despite a real Built field" drift — corrected in the same pass, see `epic-8-analytics-dashboard.md`'s own 2026-08-19 dated note.

## ~~2026-08-17 — 05cc132 — docs: log Story 8.2 (Sentiment tab) traceability~~

- **Full commit:** `05cc1326de12a3a6d9ff8a2f65ff1114766b2330`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, traceability accurate.** `docs/implementation-plan.md`/`docs/user-stories/epic-8-analytics-dashboard.md` correctly show Story 8.2 built at this point; the Status-line drift belongs to `a54bf05` above, already fixed.

## ~~2026-08-17 — 5fed9dd — feat: Story 8.3 — Conversations tab, closing out Epic 8~~

- **Full commit:** `5fed9ddaf072c30672a3c1d42fa55ec79723fb5b`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.3.conversations-tab.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/ConversationsTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected (same consolidated fix as `5558e11`).** Story 8.3's own header had the identical "Status: Ready despite a real Built field" drift — corrected in the same pass, see `epic-8-analytics-dashboard.md`'s own 2026-08-19 dated note.

## ~~2026-08-17 — 838ac19 — docs: log Story 8.3 (Conversations tab) traceability, closing out Epic 8~~

- **Full commit:** `838ac19eb70442139ae78075f9fef4a0d81b5485`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, traceability accurate.** Closing-out-Epic-8 framing in `docs/implementation-plan.md`/`docs/user-stories/README.md` was accurate at the time (all three original stories built); the Status-line drift belongs to `5fed9dd` above, already fixed.

## ~~2026-08-17 — 4082a8a — fix: no personal-scope credential/activation UI for AI providers (ADR-0028 Tier 2 only)~~

- **Full commit:** `4082a8a97b759daa72acf4144a98588db74d4635`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/ConnectorStatusClient.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** `connector-connect-disconnect/SKILL.md`/`connector-status-view/SKILL.md` correctly describe the new AI-provider personal-scope restriction; confirmed against the real `ConnectorsClient.tsx`/`ConnectorStatusClient.tsx` gating logic.

## ~~2026-08-17 — 5d0fb49 — fix(core): reject personal-scope connect/activate for AI provider connectors~~

- **Full commit:** `5d0fb49d7174e4941e770ffd0baef4534cd67e98`
- **Files touched:** docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md, social-listening-core/contracts/epic-1/story-1.11.connector-activation.contract.test.ts, social-listening-core/contracts/epic-1/story-1.7.ownership-tier-connect-disconnect.contract.test.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** `docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md`'s own healing note is a proper dated addition, not an edit to original Decision text, and accurately describes the core-side reject-personal-scope-for-AI-providers fix.

## ~~2026-08-17 — c1275ed — docs: log core-side healing pass, publish infrastructure migration runbook~~

- **Full commit:** `c1275ed0893c4f8c1865f7b738fafe2748515afe`
- **Files touched:** docs/adr/README.md, docs/implementation-log.md, docs/infrastructure-setup.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** `docs/adr/README.md` and `docs/implementation-log.md` entries confirmed accurate for the core-side healing pass and the new `docs/infrastructure-setup.md` runbook; nothing else in scope references either.

## ~~2026-08-17 — ae015e0 — feat(admin): Story 8.4 — Overview volume/sentiment charts, period-over-period comparison~~

- **Full commit:** `ae015e001f3f8071df7f02913685ac4f31b0a16d`
- **Files touched:** docs/implementation-plan.md, social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.4.overview-enrichment-period-comparison.contract.test.ts, social-listening-admin/src/app/api/analytics/summary/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/analytics/fetchAnalyticsSummary.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected (same consolidated fix as `5558e11`).** Story 8.4's own header had the identical "Status: Ready despite a real Built field" drift — corrected in the same pass, see `epic-8-analytics-dashboard.md`'s own 2026-08-19 dated note.

## ~~2026-08-17 — 63d3604 — docs: log Story 8.4, draft ADR-0055 (language/location enrichment feasibility)~~

- **Full commit:** `63d3604cf9ce0f416deac19ad2ead26d1bba3c19`
- **Files touched:** docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md, docs/adr/README.md, docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** `docs/adr/README.md`'s ADR-0055 draft entry and `docs/user-stories/epic-8-analytics-dashboard.md`'s Story 8.5 (Blocked pending ADR-0055) are both accurate at this point; the Story 8.4 Status-line drift belongs to `ae015e0` above, already fixed.

## ~~2026-08-17 — 6a55e8b — docs: accept ADR-0055, move Story 8.5 to Ready~~

- **Full commit:** `6a55e8bd4e52452ad83f202ffd838674db1506ec`
- **Files touched:** docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md, docs/adr/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** ADR-0055's Accepted status and Story 8.5's move to Ready are both confirmed current and correct against `docs/adr/README.md`/`epic-8-analytics-dashboard.md`.

## ~~2026-08-17 — 8b8bb14 — feat(admin): Story 8.5 — Languages breakdown widget~~

- **Full commit:** `8b8bb140a9c22ef5b0b77a3b6c2a3352cdd85c3d`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.3.conversations-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.5.languages-breakdown-widget.contract.test.ts, social-listening-admin/src/app/tenant/analytics/ConversationsTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected (same consolidated fix as `5558e11`).** Story 8.5's own header had the identical "Status: Ready despite a real Built field" drift — corrected in the same pass, see `epic-8-analytics-dashboard.md`'s own 2026-08-19 dated note.

## ~~2026-08-17 — fa457e9 — docs: log Story 8.5, close out Epic 8's traceability~~

- **Full commit:** `fa457e920bbb1e9f5a8854274780d5344136c9e3`
- **Files touched:** docs/adr/README.md, docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, traceability accurate.** `docs/adr/README.md`/`docs/implementation-plan.md`/`docs/user-stories/README.md`/epic file all correctly close out Epic 8's traceability at this point; the Status-line drift belongs to `8b8bb14` above, already fixed.

## ~~2026-08-17 — a17af3f — feat(admin): Story 8.6 — Sources tab per-source sentiment score, volume-over-time~~

- **Full commit:** `a17af3f6ba8488cda1f28155d5a5d57f4d866e93`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.6.sources-tab-sentiment-index-volume-history.contract.test.ts, social-listening-admin/src/app/tenant/analytics/SourcesTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected (same consolidated fix as `5558e11`).** Story 8.6's own header had the identical "Status: Ready despite a real Built field" drift — the last of the six Epic 8 stories with this drift; corrected together with the other five, see `epic-8-analytics-dashboard.md`'s own 2026-08-19 dated note (all six `**Built:**` hashes independently verified against `docs/implementation-log.md`).

## ~~2026-08-17 — 0ca3a9b — docs: log Story 8.6, draft ADR-0056 (AI-inferred Newswire dateline location)~~

- **Full commit:** `0ca3a9b1b18bb7ad5a3bed48f6e1a8c0f31567b3`
- **Files touched:** docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md, docs/adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md, docs/adr/README.md, docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, traceability accurate.** `docs/adr/README.md`'s ADR-0056 draft entry is accurate at this point (later corrected to Accepted the same day, per `bae1277` below — `docs/user-stories/README.md`'s own Epics table briefly described it as still-Proposed after that acceptance, a real drift found and fixed, see the `7c0572c` entry below for the full account); the Story 8.6 Status-line drift belongs to `a17af3f` above, already fixed.

## ~~2026-08-17 — eeb9c8c — fix(core): connect fails clearly when KEY_VAULT_KEY_ID is unconfigured~~

- **Full commit:** `eeb9c8c317d2430820a024c3a7a9ec45d53a54c1`
- **Files touched:** social-listening-core/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-core/.claude/skills/credential-envelope-encryption/SKILL.md, social-listening-core/contracts/epic-1/story-1.7.ownership-tier-connect-disconnect.contract.test.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** `connector-connect-disconnect/SKILL.md`/`credential-envelope-encryption/SKILL.md` accurately describe the new fail-fast behavior when `KEY_VAULT_KEY_ID` is unconfigured, confirmed against `connectorsRouter.ts`.

## ~~2026-08-17 — 1d49817 — docs: log Key Vault credential-storage healing pass~~

- **Full commit:** `1d49817b8f77d1cd6ad14ea53b917f043cca0536`
- **Files touched:** docs/adr/0014-credential-storage-envelope-encryption-oauth-first.md, docs/implementation-log.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** ADR-0014's new Healing note is a proper dated addition (not an edit to original Decision text) and accurately describes the real gap found and closed (the connect route's silent `'placeholder-key-id'` fallback).

## ~~2026-08-17 — a97cf30 — feat(admin): Story 6.18 — post feed search/filter operates over all matched posts~~

- **Full commit:** `a97cf300ff9edcfa9e8a11377ef4befa45b3c03a`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.18.post-feed-search-all-posts.contract.test.ts, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/page.tsx
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 6.18's own header in `epic-6-tenant-admin-ui.md` read `**Status:** Ready` despite a real, correct `**Built:**` field for this exact commit — corrected directly (Status now "Built 2026-08-17"), as part of a consolidated fix across ten stories in that epic file; see that file's own 2026-08-19 dated Documentation Steward note at the end for the full account.

## ~~2026-08-17 — 5c23158 — docs: log Story 6.18~~

- **Full commit:** `5c23158f8cbf35654c6512538cd66ed356f6c408`
- **Files touched:** docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, traceability accurate** other than the Status-line drift already attributed to `a97cf30` above.

## ~~2026-08-17 — a27aa10 — feat(admin): Story 6.14 — access-history view on the tenant users screen~~

- **Full commit:** `a27aa10cb5db80a1046de3e0a38274dbec42efd2`
- **Files touched:** social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.14.access-history-view.contract.test.ts, social-listening-admin/src/app/api/tenant-users/[id]/access-history/route.ts, social-listening-admin/src/app/tenant/users/AccessHistoryButton.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 6.14's own header read `**Status:** Ready` despite a real `**Built:**` field for this exact commit — corrected as part of the same consolidated `epic-6-tenant-admin-ui.md` fix as `a97cf30` above. (`CLAUDE.md`'s own stale "6.14 remains Ready but not yet built" claim, overtaken by this very commit, is the separate, larger finding fixed under the `e59b2da`/whole-batch CLAUDE.md correction — see that file's own 2026-08-19 dated note.)

## ~~2026-08-17 — 50c7de1 — docs: log Story 6.14~~

- **Full commit:** `50c7de116016cf33ce505ff19616515d4ea5377a`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `a27aa10` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-17 — 5886a3e — fix(admin): Provider filter's tenant-owned-feed option used the wrong value~~

- **Full commit:** `5886a3e87b9ac3c6c4cb33bca77ee3840ea0fe18`
- **Files touched:** social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** Small, contained fix (Provider filter's tenant-owned-feed option value); Story 6.11's own contract updated in the same commit, no traceability doc touched or left stale by it.

## ~~2026-08-17 — 177de14 — docs: log Provider filter tenant-owned-feed value fix~~

- **Full commit:** `177de14562aa558ad490fb6eafbc147a4282edc2`
- **Files touched:** docs/implementation-log.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only.** Matches `5886a3e` above.

## ~~2026-08-17 — ff66d31 — fix(core): shouldAttemptIngestion() allows a bounded probe once ceiling-failing~~

- **Full commit:** `ff66d311baf94aa1edf370d4f3453a6dbc1fbfa8`
- **Files touched:** docs/adr/0023-proportional-connector-failure-threshold.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/contracts/epic-2/story-2.5.proportional-failure-threshold.contract.test.ts, social-listening-core/src/connectors/connectorHealth.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** ADR-0023's new Clarification (2026-08-17, "absolute ceiling was never given a recovery path") is a proper dated addition, not an edit to original Decision/Consequences text, and accurately names the found gap and the bounded-probe fix; `connector-health-and-error-handling/SKILL.md` updated to match.

## ~~2026-08-17 — 6152308 — docs: log ADR-0023 ceiling-recovery healing pass~~

- **Full commit:** `61523086cb9fe191713ce0223b5ef1da2bd44894`
- **Files touched:** docs/implementation-log.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only.** Matches `ff66d31` above.

## ~~2026-08-17 — aa4f317 — feat(core): expose body_markdown over GET /v1/posts and GET /v1/posts/:id~~

- **Full commit:** `aa4f31767a6a59221b27677f4a5bdd3e6d82c66c`
- **Files touched:** social-listening-core/.claude/skills/posts-api/SKILL.md, social-listening-core/contracts/epic-3/story-6.19.post-body-markdown-exposure.contract.test.ts, social-listening-core/src/posts/socialPostStore.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** `posts-api/SKILL.md` accurately describes `body_markdown` now being selected by `GET /v1/posts`/`GET /v1/posts/:id`; this is the core half of Story 6.19, whose own epic-file Status-line drift is covered under `4f099a6` below.

## ~~2026-08-17 — 4bea1b8 — fix(core): GNews truncation marker has no '+' sign (ADR-0053 Open Q11 resolved)~~

- **Full commit:** `4bea1b849d0601c6d88c43607d969c5679d930a0`
- **Files touched:** docs/adr/0053-canonical-markdown-post-body-normalization-at-ingestion.md, social-listening-core/contracts/epic-3/story-3.10.canonical-markdown-post-body-normalization.contract.test.ts, social-listening-core/src/connectors/gnews/gnewsConnector.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** ADR-0053's own Open Question 11 (GNews truncation marker format) is resolved with a proper dated update, not a silent rewrite of the original Decision text.

## ~~2026-08-17 — 00812ac — docs: Implementation Log entries for body_markdown exposure and GNews marker fix~~

- **Full commit:** `00812ac0b968fef703c833b27337381ca068e943`
- **Files touched:** docs/implementation-log.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only.** Matches `aa4f317`/`4bea1b8` above.

## ~~2026-08-17 — 4f099a6 — feat(admin): render post detail body as real Markdown (Story 6.19)~~

- **Full commit:** `4f099a611faee8383e32d81efacbc97752b4a144`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.19.post-body-markdown-rendering.contract.test.ts, social-listening-admin/jest.config.js, social-listening-admin/package-lock.json, social-listening-admin/package.json, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 6.19's own header read `**Status:** Ready` despite a real `**Built:**` field (admin `@4f099a6`, core `@aa4f317`) for this exact commit — corrected as part of the same consolidated `epic-6-tenant-admin-ui.md` fix as `a97cf30` above.

## ~~2026-08-17 — 3edfed8 — docs: traceability for Story 6.19 (post body Markdown rendering)~~

- **Full commit:** `3edfed8271717dd8ff914b4acbdd1e5345d8b533`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `4f099a6` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-17 — b837b39 — feat(admin): show detected language and clean the card-list post snippet~~

- **Full commit:** `b837b390ad7de1a4acf61833f7191649c5022f0c`
- **Files touched:** docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.19.post-body-markdown-rendering.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** Story 6.11's/6.19's own contracts and `post-feed/SKILL.md` updated consistently with the real language-display/snippet-cleanup change; `epic-6-tenant-admin-ui.md`'s own dated correction on Story 6.19 (superseding AC5 for the card-list snippet) is properly append-only, not an edit to the original AC text.

## ~~2026-08-17 — b86e518 — docs: Implementation Log entry for language display + card-snippet fix~~

- **Full commit:** `b86e5184d2b6ec864eb1225a3d580d7bc1291061`
- **Files touched:** docs/implementation-log.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only.** Matches `b837b39` above.

## ~~2026-08-17 — 556bb65 — feat(core): expose caller tenant's own seat counts on GET /v1/tenants/users~~

- **Full commit:** `556bb65a75f501c2062f421ab8c4abd620ac5a15`
- **Files touched:** social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/contracts/epic-1/story-1.9.user-invite-offboard.contract.test.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** `identity-resolution/SKILL.md` accurately describes the new seat-count fields on `GET /v1/tenants/users`; this is the core half of the Team & Access redesign, whose own epic-file Status-line drift (Story 6.8) is covered under `1501247` below.

## ~~2026-08-17 — 1501247 — feat(admin): redesign the Team & Access screen (/tenant/users)~~

- **Full commit:** `150124760d4f30c920f173b7fa783739c3901fdc`
- **Files touched:** docs/design/frontend-design-specification.md, social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/users/AccessControl.tsx, social-listening-admin/src/app/tenant/users/AccessHistoryButton.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/components/ui/Modal.tsx, social-listening-admin/src/components/ui/components.test.ts, social-listening-admin/src/components/ui/index.ts, social-listening-admin/src/lib/core-client.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 6.8's own header (`epic-6-tenant-admin-ui.md`) read `**Status:** Ready` despite a real, correct (2026-08-10, backfilled 2026-08-17) `**Built:**` field — corrected as part of the same consolidated fix as `a97cf30` above. `frontend-design-specification.md`'s own new `Modal` primitive entry confirmed accurate against the real component.

## ~~2026-08-17 — 145d38c — docs: traceability for seat-counts enhancement and Team & Access redesign~~

- **Full commit:** `145d38c2cf4cbe56b4a983b209cb3cf252c14abd`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `1501247` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-17 — 0a1db2d — docs: draft ADR-0057 (tenant-owned-feed multi-feed administration)~~

- **Full commit:** `0a1db2d5461ad058af60de7eea7cfa546f3c5409`
- **Files touched:** docs/adr/0057-tenant-owned-feed-multi-feed-administration.md, docs/adr/README.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** ADR-0057 correctly drafted Proposed; `docs/adr/README.md`'s own "Proposed (not yet decided)" tracker correctly names it at this point (later revised and accepted, see `114d94f`/`bae1277` below).

## ~~2026-08-17 — 249402a — style(admin): widen the main content container from 900px to 1280px~~

- **Full commit:** `249402afba999f079b60bd9becdf1b7328dfe764`
- **Files touched:** social-listening-admin/src/app/globals.css
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** Pure CSS width change, no traceability claim anywhere depends on the 900px/1280px figure.

## ~~2026-08-17 — 114d94f — docs: revise ADR-0057 against an external review (4 points, checked)~~

- **Full commit:** `114d94f89f4447aec0766e944115ebcd6e0333fd`
- **Files touched:** docs/adr/0057-tenant-owned-feed-multi-feed-administration.md, docs/adr/README.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** ADR-0057's four-point external-review revision is recorded as a proper in-place revision (still Proposed at this point, per this project's own convention for a not-yet-accepted ADR), not a silent rewrite; `docs/adr/README.md` tracker matches.

## ~~2026-08-17 — bae1277 — docs: accept ADR-0056 and ADR-0057; draft Story 6.20~~

- **Full commit:** `bae127715fe0159194e1f5361e3cc893a516a22c`
- **Files touched:** docs/adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md, docs/adr/0057-tenant-owned-feed-multi-feed-administration.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected (found downstream, attributed here as the acceptance commit).** ADR-0056 and ADR-0057 are both correctly recorded as Accepted 2026-08-17 in `docs/adr/README.md` and in each ADR's own Status line — but `docs/user-stories/README.md`'s separate "Epics" master table (a distinct artifact from the narrative dated notes this commit itself updated correctly) still described ADR-0056 as "Proposed 2026-08-17" as of this review, a staleness that predates this commit (the master table was last touched 2026-08-11, well before ADR-0056 existed) but that this acceptance made newly wrong. Corrected directly in `docs/user-stories/README.md`'s Epics table (now "Accepted 2026-08-17") as part of a wider Epics-table correction — see the `7c0572c` entry below for the full account. Story 6.20's own Ready/drafting-only framing was accurate at this point.

## ~~2026-08-17 — 2acee9b — chore(admin): delete dead analytics prototype/demo code~~

- **Full commit:** `2acee9b15465f609319a3317ef5e6e603f05cc63`
- **Files touched:** social-listening-admin/src/lib/mockData.ts, social-listening-admin/src/lib/types.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** `mockData.ts`/`types.ts` confirmed actually deleted from disk, matching every doc reference to their removal.

## ~~2026-08-17 — bd126c8 — docs(admin): lock in the dead-analytics-code deletions with contract checks~~

- **Full commit:** `bd126c82da94343112cb31143806b60a4e16127e`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean.** `analytics-dashboard/SKILL.md`'s "Closed, 2026-08-17" note accurately describes the dead-code deletion being locked in with a contract check; confirmed against the real, now-passing `story-8.1...contract.test.ts` describe block.

## ~~2026-08-17 — fc41590 — docs: Implementation Log entry for dead analytics code cleanup~~

- **Full commit:** `fc415904debaaccc9ff8f4204b6025c774b155cc`
- **Files touched:** docs/implementation-log.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only.** Matches `2acee9b`/`bd126c8` above.

## ~~2026-08-17 — e9d797f — feat(core): tenant-owned-feed multi-feed administration (Story 6.20, core half)~~

- **Full commit:** `e9d797f64f67984fcb88985d0076ff21ab070d30`
- **Files touched:** social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.11.tenant-owned-feed-connector.contract.test.ts, social-listening-core/contracts/epic-2/story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts, social-listening-core/migrations/0031_add_removed_status_to_tenant_owned_feed_activations.sql, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts, social-listening-core/src/http/versions/v1/tenantOwnedFeedRouter.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, no drift.** `tenant-owned-feed-connector/SKILL.md` (core half of Story 6.20) accurately describes the three new endpoints and the `removed` status migration; the epic-file Status-line drift for Story 6.20 belongs to the admin half, `be1764d` below.

## ~~2026-08-17 — be1764d — feat(admin): tenant-owned-feed multi-feed administration (Story 6.20, admin half)~~

- **Full commit:** `be1764d002bec66d5dac71d33c49b108c07f47ee`
- **Files touched:** social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.17.tenant-owned-feed-activation-control.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/[id]/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 6.20's own header read `**Status:** Ready` despite a real `**Built:**` field (admin `@be1764d`, core `@e9d797f`) — corrected as part of the same consolidated `epic-6-tenant-admin-ui.md` fix as `a97cf30` above.

## ~~2026-08-17 — b05f317 — docs: traceability for Story 6.20 (tenant-owned-feed multi-feed administration)~~

- **Full commit:** `b05f3171003cc31acf6cb6378c99d0d18dc7f3b5`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `be1764d` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-17 — 3ef32ad — feat(story-5.19): wire SocialPostIngestedEvent/ConnectorHealthChangedEvent publishing into the real ingestion pipeline~~

- **Full commit:** `3ef32adab7d6b19cb88c375fa45127cf965192bb`
- **Files touched:** docs/adr/0058-wire-ingestion-events-into-real-connector-pipeline.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/ingestion-events/SKILL.md, social-listening-core/contracts/epic-5/story-5.19.wire-ingestion-events.contract.test.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/events/publishSocialPostIngestedEvents.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts, social-listening-core/src/watchlists/watchlistStore.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected, two instances.** (1) Story 5.19's own header (`epic-5-security-isolation-and-messaging.md`) read `**Status:** Ready` despite a real `**Built:**` field for this exact commit — corrected directly, with its own dated note. (2) `ingestion-events/SKILL.md`'s "Known gaps" section still said "Wikipedia's own connector (Story 2.13, separately paused pending ADR-0058) does not yet publish events" after Story 2.13 actually resumed and shipped with that exact wiring the same day (`591b0b8`) — the exact class of staleness this role's charter names by example ("flag one that still says 'no real connector exists' after one has shipped"). Corrected directly, bullet removed with a dated note pointing to the real call sites in `pollWikipedia.ts`.

## ~~2026-08-17 — 8ee53d9 — docs: implementation log entry for Story 5.19~~

- **Full commit:** `8ee53d9dbd625aa2cf97cd6b08fa7c4cabe58ef1`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-5-security-isolation-and-messaging.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only.** Matches `3ef32ad` above; both findings already attributed there.

## ~~2026-08-17 — 591b0b8 — feat(story-2.13): Wikipedia connector — MediaWiki Action API, revision re-poll via recentchanges, article-as-Author~~

- **Full commit:** `591b0b8bb8c15d2b45ddaacda15f3eec000ea292`
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/.claude/skills/wikipedia-connector/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts, social-listening-core/contracts/epic-2/story-2.13.wikipedia-connector.contract.test.ts, social-listening-core/src/authors/authorStore.ts, social-listening-core/src/connectors/bootstrapConnectors.ts, social-listening-core/src/connectors/wikipedia/pollWikipedia.ts, social-listening-core/src/connectors/wikipedia/wikipediaConnector.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 2.13's own header (`epic-2-ingestion-connectors-and-rate-limits.md`) read `**Status:** Ready` despite a real, correct `**Built:**` field for this exact commit — corrected directly, with a dated note distinguishing it from the story's own separate, still-accurate older 2026-08-17 correction note (left untouched per append-only convention). `wikipedia-connector/SKILL.md`'s "Relations to other components" claims (calls to `runIngestionAttempt()`, `listActiveWatchlistsForTenant()`/`publishSocialPostIngestedEvents()`) verified directly against `pollWikipedia.ts` — real production call sites confirmed, not contract-only.

## ~~2026-08-17 — e7055db — docs: implementation log entry for Story 2.13~~

- **Full commit:** `e7055db18ba7903372a0f71c2b1abb319929a5dc`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `591b0b8` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-17 — 21c30bf — feat(story-6.21): expose the Wikipedia connector in the Tenant Admin UI~~

- **Full commit:** `21c30bf64d19b31ae7a7e2c21798220ff38566d3`
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.21.wikipedia-connector-ui.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 6.21's own header (`epic-6-tenant-admin-ui.md`) read `**Status:** Ready` despite a real `**Built:**` field for this exact commit — corrected as part of the same consolidated fix as `a97cf30` above.

## ~~2026-08-17 — ce4c2fa — docs: implementation log entry for Story 6.21~~

- **Full commit:** `ce4c2fac261030a27db7bc1c189d051b9476f2fd`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `21c30bf` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-17 — fd6cdb3 — Design principals with Gemini Building a new frontend~~

- **Full commit:** `fd6cdb3a04b67d4237f93dfb65321a2d5d04c97d`
- **Files touched:** docs/design/Gemini Designs/.env.example, docs/design/Gemini Designs/.gitignore, docs/design/Gemini Designs/README.md, docs/design/Gemini Designs/index.html, docs/design/Gemini Designs/metadata.json, docs/design/Gemini Designs/package-lock.json, docs/design/Gemini Designs/package.json, docs/design/Gemini Designs/src/App.tsx, docs/design/Gemini Designs/src/components/ExportModal.tsx, docs/design/Gemini Designs/src/components/FilterBar.tsx, docs/design/Gemini Designs/src/components/FlyoutNav.tsx, docs/design/Gemini Designs/src/components/PostsPane.tsx, docs/design/Gemini Designs/src/components/SubTabs.tsx, docs/design/Gemini Designs/src/components/TopBar.tsx, docs/design/Gemini Designs/src/components/views/ActivityMapView.tsx, docs/design/Gemini Designs/src/components/views/AlertsView.tsx, docs/design/Gemini Designs/src/components/views/AuthViews.tsx, docs/design/Gemini Designs/src/components/views/ConversationsView.tsx, docs/design/Gemini Designs/src/components/views/LocationView.tsx, docs/design/Gemini Designs/src/components/views/OverviewView.tsx, docs/design/Gemini Designs/src/components/views/PostDetailView.tsx, docs/design/Gemini Designs/src/components/views/SearchSetupView.tsx, docs/design/Gemini Designs/src/components/views/SentimentView.tsx, docs/design/Gemini Designs/src/components/views/SettingsView.tsx, docs/design/Gemini Designs/src/components/views/SocialCenterView.tsx, docs/design/Gemini Designs/src/components/views/SourcesView.tsx, docs/design/Gemini Designs/src/data/mockData.ts, docs/design/Gemini Designs/src/index.css, docs/design/Gemini Designs/src/main.tsx, docs/design/Gemini Designs/src/types.ts, docs/design/Gemini Designs/tsconfig.json, docs/design/Gemini Designs/vite.config.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, out of traceability scope.** A design-prototype dump (`docs/design/Gemini Designs/`) — not real application code, no ADR/story/SKILL.md claims made or affected.

## ~~2026-08-17 — 2317c60 — The latest round of fronbend designs with Google AI Stduio App builder. Latest brainstorm sessions and the reworks of the frontend designs~~

- **Full commit:** `2317c60d7f23d90f96a3fb20dd8304ed4fcd1961`
- **Files touched:** docs/design/Google AI Studio/.env.example, docs/design/Google AI Studio/.gitignore, docs/design/Google AI Studio/README.md, docs/design/Google AI Studio/bun.lock, docs/design/Google AI Studio/index.html, docs/design/Google AI Studio/metadata.json, docs/design/Google AI Studio/package-lock.json, docs/design/Google AI Studio/package.json, docs/design/Google AI Studio/server.ts, docs/design/Google AI Studio/src/App.tsx, docs/design/Google AI Studio/src/components/ActivateDeactivateButton.tsx, docs/design/Google AI Studio/src/components/AnimatedChartTooltip.tsx, docs/design/Google AI Studio/src/components/ConfirmModal.tsx, docs/design/Google AI Studio/src/components/ConversationsDashboardTab.tsx, docs/design/Google AI Studio/src/components/D3SentimentGauge.tsx, docs/design/Google AI Studio/src/components/D3Sparkline.tsx, docs/design/Google AI Studio/src/components/D3TrendingTopicsChart.tsx, docs/design/Google AI Studio/src/components/EmptyState.tsx, docs/design/Google AI Studio/src/components/GlobalDateRangePicker.tsx, docs/design/Google AI Studio/src/components/InlineError.tsx, docs/design/Google AI Studio/src/components/LocationDashboardTab.tsx, docs/design/Google AI Studio/src/components/RelativeTime.tsx, docs/design/Google AI Studio/src/components/RunEnrichmentButton.tsx, docs/design/Google AI Studio/src/components/SentimentDashboardTab.tsx, docs/design/Google AI Studio/src/components/Sidebar.tsx, docs/design/Google AI Studio/src/components/Slideover.tsx, docs/design/Google AI Studio/src/components/SourcesDashboardTab.tsx, docs/design/Google AI Studio/src/components/StatusBadge.tsx, docs/design/Google AI Studio/src/components/TagInput.tsx, docs/design/Google AI Studio/src/components/TopBar.tsx, docs/design/Google AI Studio/src/context/AppContext.tsx, docs/design/Google AI Studio/src/index.css, docs/design/Google AI Studio/src/lib/store.ts, docs/design/Google AI Studio/src/main.tsx, docs/design/Google AI Studio/src/types/index.ts, docs/design/Google AI Studio/src/views/AdminConnectorsView.tsx, docs/design/Google AI Studio/src/views/AdminOverviewView.tsx, docs/design/Google AI Studio/src/views/AdminTenantsView.tsx, docs/design/Google AI Studio/src/views/AnalyticsDashboardView.tsx, docs/design/Google AI Studio/src/views/ConnectorStatusView.tsx, docs/design/Google AI Studio/src/views/ConnectorsView.tsx, docs/design/Google AI Studio/src/views/InviteAssistView.tsx, docs/design/Google AI Studio/src/views/PostsFeedView.tsx, docs/design/Google AI Studio/src/views/SignInView.tsx, docs/design/Google AI Studio/src/views/SignUpView.tsx, docs/design/Google AI Studio/src/views/SignedOutView.tsx, docs/design/Google AI Studio/src/views/SocialConnectorDetailsView.tsx, docs/design/Google AI Studio/src/views/TeamAccessView.tsx, docs/design/Google AI Studio/src/views/TenantDashboardView.tsx, docs/design/Google AI Studio/src/views/TenantDeleteView.tsx, docs/design/Google AI Studio/src/views/TenantOwnedFeedView.tsx, docs/design/Google AI Studio/src/views/TenantSettingsView.tsx, docs/design/Google AI Studio/src/views/WatchlistsView.tsx, docs/design/Google AI Studio/tsconfig.json, docs/design/Google AI Studio/vite.config.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, out of traceability scope.** A design-prototype dump (`docs/design/Google AI Studio/`) — not real application code, no ADR/story/SKILL.md claims made or affected.

## ~~2026-08-17 — c802b64 — feat(story-2.14): Wikipedia discovery search driven by the tenant's own watchlist terms~~

- **Full commit:** `c802b64ab2160d8a640ce7249655554201129630`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/wikipedia-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.14.wikipedia-watchlist-driven-discovery.contract.test.ts, social-listening-core/src/connectors/wikipedia/pollWikipedia.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 2.14's own header (`epic-2-ingestion-connectors-and-rate-limits.md`) read `**Status:** Ready` despite a real `**Built:**` field for this exact commit — corrected directly, same consolidated note as `591b0b8` above.

## ~~2026-08-17 — 8ed1e7b — docs: implementation log entry for Story 2.14~~

- **Full commit:** `8ed1e7b06ddd3558da5720455e4a663f10b56296`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `c802b64` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-18 — 8182706 — feat(story-6.22): add Wikipedia to the watchlist screen's platform-source list~~

- **Full commit:** `8182706d5f57a8fcc9ad8f5d680ec4c6e9fbc402`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/watchlist-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.22.wikipedia-watchlist-platform-source.contract.test.ts, social-listening-admin/src/app/tenant/watchlists/page.tsx
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 6.22's own header (`epic-6-tenant-admin-ui.md`) read `**Status:** Ready` despite a real `**Built:**` field for this exact commit — corrected as part of the same consolidated fix as `a97cf30` above.

## ~~2026-08-18 — 14ada1b — docs: implementation log entry for Story 6.22~~

- **Full commit:** `14ada1bbd9f235d87e9d16e5d63bf1d9d3cc40e2`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `8182706` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-18 — 3fedac3 — fix(story-2.16): azureAiLanguageConnector throws classified error on rejected document~~

- **Full commit:** `3fedac3ce1436b0e3384bd1d4acfa3d56c35fcdb`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.16.azure-ai-language-classified-document-error.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/azureAiLanguageConnector.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 2.16's own header (`epic-2-ingestion-connectors-and-rate-limits.md`) read `**Status:** Ready` despite a real `**Built:**` field for this exact commit, with the `**Built:**` line itself placed *before* the Source/Status line (the inverse of this file's usual ordering, a likely reason it wasn't already caught) — corrected directly.

## ~~2026-08-18 — 38c3e51 — docs(story-2.16): implementation log entry and Built field~~

- **Full commit:** `38c3e513ec3ac1345c839a7efdfe54c70bf6d31d`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `3fedac3` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-18 — 6a9b628 — feat(story-2.17): Azure OpenAI structured enrichment gains a summary field~~

- **Full commit:** `6a9b62856c6a2349182ec4c9ad7cf1ac8804e29e`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.17.azure-openai-summary-field.contract.test.ts, social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts, social-listening-core/src/connectors/types.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 2.17's own header had the identical inverted-order "Status: Ready despite a real Built field" drift as `3fedac3` above — corrected directly, same dated note.

## ~~2026-08-18 — 28090fe — docs(story-2.17): implementation log entry and Built field~~

- **Full commit:** `28090fe65741767dc9550b3bc3e433b75f9c6bb1`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `6a9b628` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-18 — 6550716 — feat(story-6.25): post feed shows most-recently-ingested posts first~~

- **Full commit:** `65507164bac4ef7fdfb48d82627a940670b39155`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.25.post-feed-newest-first.contract.test.ts, social-listening-admin/src/app/tenant/posts/page.tsx
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 6.25's own header (`epic-6-tenant-admin-ui.md`) had the identical inverted-order (`**Built:**` before `**Source:**`/`**Status:**`) drift as the other stories fixed in this file's consolidated 2026-08-19 note — corrected directly.

## ~~2026-08-18 — 05d9ee0 — docs(story-6.25): implementation log entry and Built field~~

- **Full commit:** `05d9ee02fbade63b466ee3025aa50b33166b7adb`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `6550716` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-18 — 03c37c9 — feat(story-6.26): post feed's Provider filter derives its options from real data~~

- **Full commit:** `03c37c91c3ffabfd69c15bb7339abf9b2e77d8fd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.25.post-feed-newest-first.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.26.post-feed-dynamic-provider-filter.contract.test.ts, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 6.26's own header had the identical inverted-order drift — corrected directly, same consolidated `epic-6-tenant-admin-ui.md` note.

## ~~2026-08-18 — 42e693f — docs(story-6.26): implementation log entry and Built field~~

- **Full commit:** `42e693f763cb36581bd2a0b145bf5c02b7295c6d`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `03c37c9` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-18 — 50a5914 — feat(story-2.15): Facebook connector -- tenant's own Page, Tier 3 credential~~

- **Full commit:** `50a5914641dcd9fc03d424f0994555b6389d8a0b`
- **Files touched:** docs/environment-gotchas.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/.claude/skills/facebook-connector/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-2/story-2.15.facebook-connector.contract.test.ts, social-listening-core/migrations/0032_add_ingestion_runs_credential_failure_flag.sql, social-listening-core/src/connectors/bootstrapConnectors.ts, social-listening-core/src/connectors/connectorHealth.ts, social-listening-core/src/connectors/facebook/facebookConnector.ts, social-listening-core/src/connectors/facebook/pollFacebook.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts, social-listening-core/src/http/versions/v1/facebookOAuthRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/ingestion/ingestionRunStore.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected, two instances.** (1) Story 2.15's own header had the identical inverted-order "Status: Ready despite a real Built field" drift as Stories 2.16/2.17 — corrected directly. (2) `live-ingestion-polling-scheduler/SKILL.md`'s own "Known gaps" section still said "No real per-user poll connector exists yet (Reddit unbuilt)" after Facebook (`pollFacebook(tenantId, userId)`, this exact commit) shipped as a real Tier-3 per-user connector — corrected directly, distinguishing the now-real connector from the still-genuinely-unbuilt Tier-3 scheduling loop itself (ADR-0061/Story 1.15).

## ~~2026-08-18 — caf50ed — docs(story-2.15): implementation log entry and Built field~~

- **Full commit:** `caf50ed7c77659ecdc5ae373b6c98c4833889c13`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only.** Matches `50a5914` above; both findings already attributed there.

## ~~2026-08-18 — 838e3dc — feat(story-1.14): poll scheduler skips a pair whose most recent run is still running~~

- **Full commit:** `838e3dc0adbd8e4a0330b132f2871e08128e2b23`
- **Files touched:** docs/adr/0052-live-ingestion-polling-scheduler.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/live-ingestion-polling-scheduler/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-1/story-1.14.poll-scheduler-skip-in-flight.contract.test.ts, social-listening-core/src/ingestion/ingestionRunStore.ts, social-listening-core/src/scheduler/pollScheduler.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected — the first instance found in this pass of what turned out to be a recurring class.** Story 1.14's own header (`epic-1-repository-and-api-foundation.md`) read `**Status:** Ready` right next to its own fixed-shape `**Built:** 2026-08-18 — social-listening-core@838e3dc` field — confirmed against `docs/implementation-log.md`'s matching entry (same commit, same 6/6 contract) that the build is real. Corrected directly with a dated note; this same "Ready" + real "Built" field combination was then found repeated in ten more stories across four other epic files later in this pass (see `docs/user-stories/README.md`'s own 2026-08-19 dated note for the full cross-file summary).

## ~~2026-08-18 — 3ce8db2 — docs(story-1.14): implementation log entry and Built field~~

- **Full commit:** `3ce8db2005d1e2b794101fb63c0c2049d584c0af`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-1-repository-and-api-foundation.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only.** Matches `838e3dc` above; the finding is already attributed there.

## ~~2026-08-18 — 535338f — feat(story-6.23): Facebook OAuth connect flow with Page selection~~

- **Full commit:** `535338ff3dac36738d0240fb0d4994ec2d478e3f`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/.env.example, social-listening-admin/contracts/epic-6/story-6.21.wikipedia-connector-ui.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.23.facebook-oauth-connect-flow.contract.test.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/callback/route.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/pending/route.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/select-page/route.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/start/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/ConnectorStatusClient.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/components/ui/StatusBadge.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/facebookOAuth.ts
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** Story 6.23's own header had the identical inverted-order (`**Built:**` before `**Source:**`/`**Status:**`) drift — corrected directly, same consolidated `epic-6-tenant-admin-ui.md` note as Stories 6.25/6.26.

## ~~2026-08-18 — f6a1794 — docs(story-6.23): implementation log entry and Built field~~

- **Full commit:** `f6a179406e217330ae5616f474f6ebeb8b656efc`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — clean, appended only**, matching `535338f` above; the epic-file Status-line drift is already attributed there.

## ~~2026-08-18 — 7c0572c — docs: ADR-0059/0060/0061 acceptance and Story 6.27/1.15 governance update~~

- **Full commit:** `7c0572c1dcabc8a0401e10d180955430b5a185d7`
- **Files touched:** docs/adr/0059-facebook-connector-tenant-owned-page-scope-organization-as-author.md, docs/adr/0060-facebook-connector-multiple-pages-per-user.md, docs/adr/0061-tier-3-poll-scheduler-per-user-enumeration.md, docs/adr/README.md, docs/open-decisions.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** ~~Pending review~~ **Reviewed 2026-08-19 — real drift found and corrected.** This commit accepted ADR-0059/0060/0061 and moved Story 6.27/1.15 to Ready, correctly updating `docs/adr/README.md` and both epic files — but never touched `docs/user-stories/README.md`'s separate "Epics" master table, which (per `git blame`) hadn't been updated for Epic 1 since 2026-08-11 and was missing Stories 1.11–1.15/ADRs 0051/0052/0061 entirely, missing Story 6.27/ADR-0060 from Epic 6's row, and still showed ADR-0056 as "Proposed" (stale since `bae1277`, 2026-08-17). Also found: `docs/implementation-plan.md`'s own Traceability table was missing Stories 1.14/1.15/6.27 entirely and still described Story 6.23 as "drafted, not yet built" after it shipped. All corrected directly, each with its own dated note; `CLAUDE.md`'s much larger, cascading staleness (last updated by `e59b2da`, five days before this final entry) was also found and corrected as part of this same pass — see that file's own 2026-08-19 dated note.

## 2026-08-19 — 6080795 — Scheduled doc review: 2026-08-19 — clear 81-entry backlog across all three review queues

- **Full commit:** `608079561c17597c1bfec604ae57551b2e21a148`
- **Files touched:** CLAUDE.md, README.md, docs/implementation-plan.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/project docs/Project Management Plans/Delivery-Management-Plan.md, docs/project docs/Project Management Plans/Integration-Management-Plan.md, docs/project docs/Project Management Plans/Measurement-Management-Plan.md, docs/project docs/Project Management Plans/Project-Work-Management-Plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-6-tenant-admin-ui.md, docs/user-stories/epic-8-analytics-dashboard.md, social-listening-core/.claude/skills/ingestion-events/SKILL.md, social-listening-core/.claude/skills/live-ingestion-polling-scheduler/SKILL.md
- **Status:** Pending review

## 2026-08-19 — 2c00920 — feat(docs): draft ADR-0062 — Analytics Dashboard Overview Tab Enhancement

- **Full commit:** `2c00920ee0755b4caf32b895e20b09bc6ed99c31`
- **Files touched:** docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/adr/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-19 — 67c546f — chore: post-commit hook outputs for ADR-0062 commit (2c00920)

- **Full commit:** `67c546f0ddcf7125c6860a304db1b711600712a6`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, scripts/git-hooks/post-commit, scripts/git-hooks/pre-commit
- **Status:** Pending review

## 2026-08-19 — 48f5cf3 — docs(adr-0062): replace selectedTopic with activeWatchlistFilter

- **Full commit:** `48f5cf3690c6f4d65175d148c8144f34e3495694`
- **Files touched:** docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-19 — a5d0036 — chore: post-commit hook outputs for activeWatchlistFilter revision (48f5cf3)

- **Full commit:** `a5d003631df657b9e89aeddbb17563de93faa7b0`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

## 2026-08-19 — 23a6dca — chore: post-commit hook outputs for a5d0036

- **Full commit:** `23a6dcaca33d4d084bfb5baec261416c406d9caa`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

## 2026-08-19 — 2f605b6 — docs(adr): draft ADR-0063 — post_watchlist_matches junction table and GET /v1/posts?watchlistId server-side filter

- **Full commit:** `2f605b667a26863f31dd28c7fa1d787c8b9471db`
- **Files touched:** docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md, docs/adr/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-19 — 59356e6 — chore: post-commit hook outputs for 2f605b6

- **Full commit:** `59356e60f2db66ec365cf7490059cc310a0e322d`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

## 2026-08-19 — 6f25f17 — chore: post-commit hook outputs for 59356e6

- **Full commit:** `6f25f171c9700b084988ff5339bcd844f7a59661`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

## 2026-08-19 — 6eb6062 — docs(adr): block selectedTopic/Watchlist on ADR-0063 in ADR-0062, Story 8.7, Story 8.9

- **Full commit:** `6eb6062b192135f8950e807ecb1d4e07c7360de2`
- **Files touched:** docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-19 — 24adf6c — chore: post-commit hook outputs for 6eb6062

- **Full commit:** `24adf6c546ffe6b108891ea52144bea41e3d7ba4`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

## 2026-08-19 — c1d6a44 — chore: post-commit hook outputs for 24adf6c

- **Full commit:** `c1d6a44f4ff89a6dc83cf509ff3f7105feaf6041`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

## 2026-08-19 — 17c563b — docs(adr): accept ADR-0063; move Story 3.11 to Ready

- **Full commit:** `17c563b71264e47a833fded1df66facaa34ced98`
- **Files touched:** docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md, docs/adr/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-19 — 31af056 — chore: post-commit hook outputs for 17c563b

- **Full commit:** `31af056e5b52958cbf0eceb884f03aa1ce6eb1b1`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

## 2026-08-19 — 5d3ec45 — Writen the ADRs 0064 0065 0066 0067 0068 0069

- **Full commit:** `5d3ec452c00b3c2af73303387aee6f4c00d7723b`
- **Files touched:** docs/adr/0064-location and geospatial insights from posts and authors.md, docs/adr/0065-active-watchlist-sourcing-via-brave-search-api.md, docs/adr/0066-active-watchlist-sourcing-via-bing-search-api.md, docs/adr/0067-reconfirm-facebook-connector, docs/adr/0068-instagram-connector, docs/adr/0069-linkedin-connector, docs/design/Google AI Studio/server.ts, docs/design/frontend-design-future-devs.md, docs/project docs/Spark-Capture-AI-Provider-Model-Agnosticism.md, docs/project docs/Spark-Capture-Service-Bus-Purposeful-Downstream-Subscriptions.md, social-listening-admin/next-env.d.ts, social-listening-core/.claude/skills/post-watchlist-match-persistence/SKILL.md, social-listening-core/contracts/epic-3/story-3.11.post-watchlist-match-persistence.contract.test.ts, social-listening-core/migrations/0036_create_post_watchlist_matches.sql, social-listening-core/src/events/publishSocialPostIngestedEvents.ts, social-listening-core/src/http/versions/v1/postsRouter.ts, social-listening-core/src/posts/socialPostStore.ts, social-listening-core/src/watchlists/postWatchlistMatchStore.ts
- **Status:** Pending review

## 2026-08-19 — 63902a1 — fix: Story 3.11 heal — post_watchlist_matches FK conflict, ambiguous-column JOIN bug, fixture typo

- **Full commit:** `63902a11b3c2c83f3db8077ac0944440e6f1daa9`
- **Files touched:** docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/post-watchlist-match-persistence/SKILL.md, social-listening-core/contracts/epic-3/story-3.11.post-watchlist-match-persistence.contract.test.ts, social-listening-core/migrations/0036_create_post_watchlist_matches.sql, social-listening-core/src/posts/socialPostStore.ts
- **Status:** Pending review

## 2026-08-19 — 6e6755e — docs: implementation log entry for Story 3.11 healing pass

- **Full commit:** `6e6755e8693a8708414a0b734f36374629fe320f`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-19 — 1d550a1 — docs: methodology amendment — epic-scoped local validation, CI as the unconditional full-suite gate

- **Full commit:** `1d550a1c8d749e634af4b065199d8303496763ce`
- **Files touched:** .claude/skills/heal-contract-failure/SKILL.md, .claude/skills/implement-story/SKILL.md, CLAUDE.md, docs/implementation-log.md, docs/implementation-methodology.md, docs/templates/ci-workflow.md
- **Status:** Pending review

## 2026-08-19 — 7698563 — feat: Story 8.7 — Overview Tab Enhancement (ADR-0062), folded in with ADR-0062/0063 acceptance

- **Full commit:** `7698563ba34ec7f71ec5c4deac609965101381ba`
- **Files touched:** docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, docs/user-stories/epic-8-analytics-dashboard.md, social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.4.overview-enrichment-period-comparison.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.7.overview-tab-enhancement.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/analytics/page.tsx
- **Status:** Pending review

## 2026-08-19 — 6a59885 — docs: implementation log entry for Story 8.7, Built hash finalized

- **Full commit:** `6a598854f83063c1bd61fb8a7628420c78e52b0e`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-20 — 2859a76 — feat(analytics-overview): live UI/UX refinements + stacked post-detail drawer

- **Full commit:** `2859a76da56c066a11053e50feb96833fe0415a4`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.4.overview-enrichment-period-comparison.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.7.overview-tab-enhancement.contract.test.ts, social-listening-admin/src/app/api/posts/[id]/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/posts/PostDetailPanel.tsx, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- **Status:** Pending review

## 2026-08-20 — efa96e8 — fix(analytics-overview): unreadable white-on-white post title in drawer rows

- **Full commit:** `efa96e8869d1b24b396cb2f7e9d00e872e20acc4`
- **Files touched:** social-listening-admin/src/app/globals.css
- **Status:** Pending review

## 2026-08-20 — cd6f41e — fix(post-feed): allocate the Newswire issuer to the author position

- **Full commit:** `cd6f41e08dea95d06748056c97e54802e35c6fb7`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- **Status:** Pending review

## 2026-08-20 — 75362d3 — fix(facebook-connector): denormalize Page id/name into rawPayload

- **Full commit:** `75362d338413dd2a1e2cc36d12219b48798f9118`
- **Files touched:** social-listening-core/.claude/skills/facebook-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.15.facebook-connector.contract.test.ts, social-listening-core/src/connectors/facebook/pollFacebook.ts
- **Status:** Pending review

## 2026-08-20 — 2fa45ba — fix(post-feed): surface Facebook Page author and original-post link

- **Full commit:** `2fa45ba5bfb07660987e34c90019241081e50094`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- **Status:** Pending review

## 2026-08-20 — 2f52c0f — feat(story-2.19): tenant-owned-feed per-feed name + per-item byline

- **Full commit:** `2f52c0f1079249e9508c5878bc100ff2543468a7`
- **Files touched:** docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.19.tenant-owned-feed-naming-and-byline.contract.test.ts, social-listening-core/contracts/epic-3/story-3.10.canonical-markdown-post-body-normalization.contract.test.ts, social-listening-core/migrations/0037_add_tenant_owned_feed_activations_name.sql, social-listening-core/src/connectors/tenantOwnedFeed/feedItemParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts, social-listening-core/src/http/versions/v1/tenantOwnedFeedRouter.ts
- **Status:** Pending review

## 2026-08-20 — e54f937 — docs: implementation log entry for Story 2.19, Built hash finalized

- **Full commit:** `e54f937c9994e126bee7944e9b071be3e524e9c1`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** Pending review

## 2026-08-20 — cc38b6a — feat(story-6.28): tenant-owned-feed friendly naming in setup UI

- **Full commit:** `cc38b6a9909eb4347d39789bd07e7f1e5027137d`
- **Files touched:** social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.28.tenant-owned-feed-friendly-naming.contract.test.ts, social-listening-admin/next-env.d.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/[id]/route.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/connect/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/lib/core-client.ts
- **Status:** Pending review

## 2026-08-20 — 1bb19f7 — docs: ADR filename fixes and governance review updates

- **Full commit:** `1bb19f703bf8d28a085172934b1edc6b07a46666`
- **Files touched:** docs/adr/0066-active-watchlist-sourcing-via-bing-search-api.md, docs/adr/0067-reconfirm-facebook-connector, docs/adr/0067-reconfirm-facebook-connector.md, docs/adr/0068-instagram-connector, docs/adr/0068-instagram-connector.md, docs/adr/0069-linkedin-connector, docs/adr/0069-linkedin-connector.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

## 2026-08-20 — 983ae70 — docs: sync tracking and review registers

- **Full commit:** `983ae70fc87dd679f695a486ad3bdd6ba37b38a0`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

## 2026-08-20 — 605e5a4 — feat(story-8.9): selectedTopic watchlist filter and Watchlist Coverage widget

- **Full commit:** `605e5a430aaa535dea868af78acd5d222ed1ea72`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.7.overview-tab-enhancement.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.9.watchlist-filter-and-coverage-widget.contract.test.ts, social-listening-admin/src/app/api/analytics/summary/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/analytics/fetchAnalyticsSummary.ts, social-listening-admin/src/app/tenant/analytics/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Status:** Pending review

## 2026-08-20 — 1fee797 — docs(story-8.9): record implementation and traceability for Story 8.9

- **Full commit:** `1fee7974ac43b9892c227ac9b5c7c5f4251aff3a`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-20 — 1320adb — docs(story-3.12): draft Story 3.12 and add ADR-0063 Amendment Log for historical backfill and discovery attribution

- **Full commit:** `1320adbb2fd8e54a955dce7fa3092ab8eeaa274c`
- **Files touched:** docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- **Status:** Pending review

## 2026-08-20 — 3adc060 — feat(story-3.12): post-watchlist match historical backfill and discovery attribution

- **Full commit:** `3adc06068ea5736c6fac6a2ae0794a49e07be533`
- **Files touched:** social-listening-core/.claude/skills/post-watchlist-match-persistence/SKILL.md, social-listening-core/.claude/skills/wikipedia-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.14.wikipedia-watchlist-driven-discovery.contract.test.ts, social-listening-core/contracts/epic-3/story-3.12.post-watchlist-match-backfill-and-discovery-attribution.contract.test.ts, social-listening-core/jest.global-setup.js, social-listening-core/migrations/0038_backfill_post_watchlist_matches.sql, social-listening-core/src/connectors/wikipedia/pollWikipedia.ts, social-listening-core/src/events/publishSocialPostIngestedEvents.ts, social-listening-core/src/watchlists/postWatchlistMatchStore.ts
- **Status:** Pending review

