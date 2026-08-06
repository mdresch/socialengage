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

## 2026-08-06 — a251050 — Implement Story 5.16: Same-Domain Invite Assist backend surface

- **Full commit:** `a2510508f543c8c10c12cfc3631675f88839964c`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/same-domain-invite-assist/SKILL.md, social-listening-core/contracts/epic-5/story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts, social-listening-core/src/http/versions/v1/domainSignupAttemptsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/tenants/domainSignupAttempts.ts, social-listening-core/src/tenants/selfServiceSignup.ts
- **Status:** Pending review

## 2026-08-06 — 29914e2 — Log Story 5.16 in the Implementation Log

- **Full commit:** `29914e2aa914c407cdbd126261ed5dea01b13bed`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-06 — 63b5ce1 — Process Ideal Manager, Documentation Steward, and L&D Writer review queues

- **Full commit:** `63b5ce1a1c3b5d74d2fd9e6ff8dca4cee635285a`
- **Files touched:** docs/ai-roles/README.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/project docs/Stakeholder-Register.md
- **Status:** Pending review

## 2026-08-06 — 1f8960e — Heal Story 6.2: ResolvedIdentity is a discriminated union, not a flat {role}

- **Full commit:** `1f8960ef3058e28a20ddc678c6b202ec71441cd3`
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/jest.config.js, social-listening-admin/src/app/api/auth/callback/route.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/app/tenant/page.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/role-routing.ts, social-listening-admin/src/lib/session.ts
- **Status:** Pending review

## 2026-08-06 — fb2eabc — Log the Story 6.2 healing pass in the Implementation Log

- **Full commit:** `fb2eabc2c3c69cd88fa489cc4189c3839ee865a8`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

