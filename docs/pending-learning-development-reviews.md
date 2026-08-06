# Pending Learning & Development Reviews

**Queued by:** `scripts/git-hooks/post-commit`, one entry per commit, automatically, non-blocking. **Reviewed by:** the Learning & Development Writer (`.claude/agents/learning-development-writer.md`) whenever a Claude Code session is actively working in this repo and checks this file — not a live daemon, not guaranteed same-day. Append-only, same discipline as `docs/implementation-log.md`: a reviewed entry gets struck through with a dated resolution note (whether the commit shipped anything user-facing, and which manual(s) got updated, if any), never deleted.

**What "reviewed" means here:** the Writer may edit the three manuals under `docs/manuals/` directly (`Edit`/`Write` tools) — but it never commits its own changes. A human commit (Menno's own, or Claude Code committing only when explicitly asked to) is the approval gate, the same "propose in the working tree, human commit confirms" pattern this project already uses for every other AI-role output. An entry here is only marked resolved once any resulting manual edit has actually been committed, not merely drafted. Most commits will resolve with "no user-facing change — nothing to document" and that's a legitimate, reportable outcome, not a non-answer.

---
## 2026-08-06 — aa4bf87 — Extend Documentation Steward to PM docs, add a Learning & Development Writer, wire two more Foundry Prompt Agents

- **Full commit:** `aa4bf872a2acb36d6e15519d0f86ea1acace5f10`
- **Files touched:** .claude/agents/documentation-steward.md, .claude/agents/learning-development-writer.md, docs/ai-roles/.env.example, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs, docs/manuals/system-admin-manual.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, scripts/git-hooks/post-commit, scripts/setup-git-hooks.js
- ~~**Status:** Pending review~~
- **Resolved 2026-08-06 (Learning & Development Writer):** No user-facing change — nothing to document. This commit is AI-roles/governance tooling: it extends `documentation-steward`'s scope to PM docs, charters this very Learning & Development Writer role, and wires two more Foundry Prompt Agents into `invoke-azure-foundry-agent.mjs`. It does touch `docs/manuals/*.md`, but only to bootstrap those three manuals with the Story 6.1 sign-in content that had already shipped in earlier commits (c643553/6f35a70) — no new end-user-facing capability shipped in this commit itself. Manuals left as-is; already accurate.

## 2026-08-06 — 55a02ab — Queue commit aa4bf87 for Manager, Documentation Steward, and Learning & Development review

- **Full commit:** `55a02aba43dec394c8f01c945cf48caa9e3996bb`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-06 (Learning & Development Writer):** No user-facing change — nothing to document. This commit only appends queue entries (for commit aa4bf87) to the Manager, Documentation Steward, and this very Learning & Development review queues — pure AI-role governance bookkeeping, no product code or UI touched.

## 2026-08-06 — 2106034 — Record two parked AI-role ideas: Infrastructure/Go-Live Readiness, Cost/FinOps

- **Full commit:** `2106034da535a6b7dd3bee6d98b0c7116ea288ac`
- **Files touched:** docs/ai-roles/README.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-06 (Learning & Development Writer):** No user-facing change — nothing to document. This commit only records two parked, not-yet-chartered AI-role ideas (Infrastructure/Go-Live Readiness Reviewer, Cost/FinOps Reviewer) in `docs/ai-roles/README.md`, an internal tooling roster — no product capability shipped, so none of the three manuals apply.

## 2026-08-06 — a251050 — Implement Story 5.16: Same-Domain Invite Assist backend surface

- **Full commit:** `a2510508f543c8c10c12cfc3631675f88839964c`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/same-domain-invite-assist/SKILL.md, social-listening-core/contracts/epic-5/story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts, social-listening-core/src/http/versions/v1/domainSignupAttemptsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/tenants/domainSignupAttempts.ts, social-listening-core/src/tenants/selfServiceSignup.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-06 (Learning & Development Writer, whole-project catch-up pass):** No user-facing screen shipped — `GET /v1/tenants/domain-signup-attempts` is real, working `social-listening-core` backend, but Story 6.10 (the Tenant-Admin-facing "Same-Domain Invite Assist" view that would consume it) is Ready but not built in `social-listening-admin`. Named in `docs/manuals/tenant-admin-manual.md`'s "What's not built yet" section (added this same pass) as a backend-exists/no-screen-yet gap, not documented as a usable capability.

## 2026-08-06 — 29914e2 — Log Story 5.16 in the Implementation Log

- **Full commit:** `29914e2aa914c407cdbd126261ed5dea01b13bed`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-06 (Learning & Development Writer, whole-project catch-up pass):** No user-facing change — this commit only appends Story 5.16's own Implementation Log entry; the underlying commit (a251050) is reviewed separately above.

## 2026-08-06 — 63b5ce1 — Process Ideal Manager, Documentation Steward, and L&D Writer review queues

- **Full commit:** `63b5ce1a1c3b5d74d2fd9e6ff8dca4cee635285a`
- **Files touched:** docs/ai-roles/README.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/project docs/Stakeholder-Register.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-06 (Learning & Development Writer, whole-project catch-up pass):** No user-facing change — pure AI-role governance queue bookkeeping (Manager/Documentation Steward/L&D review queues, the AI-roles roster, the Stakeholder Register), no product code or UI touched.

## 2026-08-06 — 1f8960e — Heal Story 6.2: ResolvedIdentity is a discriminated union, not a flat {role}

- **Full commit:** `1f8960ef3058e28a20ddc678c6b202ec71441cd3`
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/jest.config.js, social-listening-admin/src/app/api/auth/callback/route.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/app/tenant/page.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/role-routing.ts, social-listening-admin/src/lib/session.ts
- **Status:** Pending review

## 2026-08-06 — fb2eabc — Log the Story 6.2 healing pass in the Implementation Log

- **Full commit:** `fb2eabc2c3c69cd88fa489cc4189c3839ee865a8`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-06 — 35f056a — Learning & Development Writer: one-time whole-project manual catch-up

- **Full commit:** `35f056a61ca013a7c81955c2198790cd37bb30c3`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/manuals/system-admin-manual.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md
- **Status:** Pending review

## 2026-08-06 — 2061e72 — Add a standing author-rights check to the requirements-analyst charter

- **Full commit:** `2061e723e124f3a3b0769c21fb6bb5f7d7aab6f0`
- **Files touched:** .claude/agents/ba-requirements-analyst.md, docs/future-subsystems.md
- **Status:** Pending review

## 2026-08-06 — 4f7d9b9 — Write up real connector research: Reddit, X, YouTube, Meta, Wikipedia

- **Full commit:** `4f7d9b9e1848c8a9063f6c8ca5ca0edfb80e30b2`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md
- **Status:** Pending review

## 2026-08-06 — 82ca1e2 — Accept ADR-0041: Platform Admin is a distinct identity kind

- **Full commit:** `82ca1e219840370ce62e3a586348130502a8e9e9`
- **Files touched:** docs/adr/0030-admin-tier-design-platform-admin-rls-exception.md, docs/adr/0032-users-table-shape-and-rls.md, docs/adr/0035-admin-ui-shape-one-app-role-gated.md, docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, docs/adr/0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md, docs/adr/README.md
- **Status:** Pending review

## 2026-08-06 — 6e4321f — Knowledge-graph review: Wikipedia connector authorship modeling

- **Full commit:** `6e4321fd5b08aa078bc1bb8aa0af21842c4e7830`
- **Files touched:** docs/architecture/knowledge-graph-register.md
- **Status:** Pending review

## 2026-08-06 — c0179f4 — Migrate Data Privacy/Sovereignty reviewers off Ollama to Foundry

- **Full commit:** `c0179f41db5b7ca9fdd83812897f7c66de28d9d9`
- **Files touched:** docs/ai-roles/.env.example, docs/ai-roles/README.md, docs/ai-roles/data-privacy-sovereignty-reviewer.md, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs
- **Status:** Pending review

## 2026-08-06 — 1187116 — Add stakeholder profiles for 12 personas across current and future scope

- **Full commit:** `11871169a72450e7275635ca2e4e9394ff4f676d`
- **Files touched:** docs/project docs/Stakeholder Management/Author-of-a-Post-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Data-Subject-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Legal-Advisor-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Platform-Admin-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Social-Selling-Strategist-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Sole-Operator-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Admin-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Brand-Reputation-Manager-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Business-Analyst-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Reader-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Social-Care-Agent-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-User-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Topic-Center-Analyst-Stakeholder-Profile.md
- **Status:** Pending review

## 2026-08-06 — 464e05a — Add a findings register for the Data Privacy & Sovereignty Reviewer

- **Full commit:** `464e05a91401c4d263b14a2c35a14fda75758d3f`
- **Files touched:** docs/ai-roles/README.md, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs, docs/privacy/data-privacy-sovereignty-register.md
- **Status:** Pending review

## 2026-08-06 — cd308eb — Add real, auto-derived commit time-logging to post-commit; fix stale template

- **Full commit:** `cd308ebaa482415254a0d3eba62cb6f2ff75ecb1`
- **Files touched:** docs/templates/time-tracking.md, docs/time-tracking.md, scripts/git-hooks/post-commit
- **Status:** Pending review

## 2026-08-06 — 406bf2c — Fix: auto-derived time-log row landed after the file footer, not in the table

- **Full commit:** `406bf2c327a88b188eb204eef11605acebb235f4`
- **Files touched:** docs/time-tracking.md, scripts/git-hooks/post-commit
- **Status:** Pending review

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

