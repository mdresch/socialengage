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
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. This healing pass is the real routing-enforcement fix (a platform_admin session could previously land in the tenant shell with no server-side check, and vice versa) that `docs/manuals/system-admin-manual.md`'s own "Signing in" section already cites by this exact commit hash, describing the corrected, contract-verified behavior.

## 2026-08-06 — fb2eabc — Log the Story 6.2 healing pass in the Implementation Log

- **Full commit:** `fb2eabc2c3c69cd88fa489cc4189c3839ee865a8`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — this commit only appends the Implementation Log entry for the Story 6.2 healing pass (1f8960e), reviewed separately above.

## 2026-08-06 — 35f056a — Learning & Development Writer: one-time whole-project manual catch-up

- **Full commit:** `35f056a61ca013a7c81955c2198790cd37bb30c3`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/manuals/system-admin-manual.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new user-facing change — this is this very role's own earlier one-time whole-project manual catch-up pass (bootstrapping the three manuals against what had shipped as of 2026-08-06). Its own content has since been superseded by this session's further updates to all three manuals; nothing further to add on its own account.

## 2026-08-06 — 2061e72 — Add a standing author-rights check to the requirements-analyst charter

- **Full commit:** `2061e723e124f3a3b0769c21fb6bb5f7d7aab6f0`
- **Files touched:** .claude/agents/ba-requirements-analyst.md, docs/future-subsystems.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — governance-only: adds an author-rights check to the `ba-requirements-analyst` charter and a future-subsystems note. No product code or UI touched.

## 2026-08-06 — 4f7d9b9 — Write up real connector research: Reddit, X, YouTube, Meta, Wikipedia

- **Full commit:** `4f7d9b9e1848c8a9063f6c8ca5ca0edfb80e30b2`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — research notes on future connector candidates (Reddit, X, YouTube, Meta, Wikipedia) added to `docs/implementation-plan.md`/`docs/open-decisions.md`. None of these are built; nothing to document until one ships.

## 2026-08-06 — 82ca1e2 — Accept ADR-0041: Platform Admin is a distinct identity kind

- **Full commit:** `82ca1e219840370ce62e3a586348130502a8e9e9`
- **Files touched:** docs/adr/0030-admin-tier-design-platform-admin-rls-exception.md, docs/adr/0032-users-table-shape-and-rls.md, docs/adr/0035-admin-ui-shape-one-app-role-gated.md, docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, docs/adr/0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md, docs/adr/README.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — accepts ADR-0041 (Platform Admin as a distinct identity kind), an internal design-governance decision with no shipped code of its own.

## 2026-08-06 — 6e4321f — Knowledge-graph review: Wikipedia connector authorship modeling

- **Full commit:** `6e4321fd5b08aa078bc1bb8aa0af21842c4e7830`
- **Files touched:** docs/architecture/knowledge-graph-register.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — a knowledge-graph review note on Wikipedia connector authorship modeling (`docs/architecture/knowledge-graph-register.md`), not a shipped connector.

## 2026-08-06 — c0179f4 — Migrate Data Privacy/Sovereignty reviewers off Ollama to Foundry

- **Full commit:** `c0179f41db5b7ca9fdd83812897f7c66de28d9d9`
- **Files touched:** docs/ai-roles/.env.example, docs/ai-roles/README.md, docs/ai-roles/data-privacy-sovereignty-reviewer.md, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — migrates two AI-role reviewers from Ollama to Azure Foundry, internal tooling only.

## 2026-08-06 — 1187116 — Add stakeholder profiles for 12 personas across current and future scope

- **Full commit:** `11871169a72450e7275635ca2e4e9394ff4f676d`
- **Files touched:** docs/project docs/Stakeholder Management/Author-of-a-Post-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Data-Subject-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Legal-Advisor-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Platform-Admin-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Social-Selling-Strategist-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Sole-Operator-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Admin-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Brand-Reputation-Manager-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Business-Analyst-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Reader-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Social-Care-Agent-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-User-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Topic-Center-Analyst-Stakeholder-Profile.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — adds stakeholder persona profiles for 12 personas across current and future scope, internal PM documentation only.

## 2026-08-06 — 464e05a — Add a findings register for the Data Privacy & Sovereignty Reviewer

- **Full commit:** `464e05a91401c4d263b14a2c35a14fda75758d3f`
- **Files touched:** docs/ai-roles/README.md, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs, docs/privacy/data-privacy-sovereignty-register.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — adds a findings register for the Data Privacy & Sovereignty Reviewer AI role, internal governance tooling only.

## 2026-08-06 — cd308eb — Add real, auto-derived commit time-logging to post-commit; fix stale template

- **Full commit:** `cd308ebaa482415254a0d3eba62cb6f2ff75ecb1`
- **Files touched:** docs/templates/time-tracking.md, docs/time-tracking.md, scripts/git-hooks/post-commit
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — adds auto-derived commit time-logging to the `post-commit` hook and fixes a stale template, internal tooling only.

## 2026-08-06 — 406bf2c — Fix: auto-derived time-log row landed after the file footer, not in the table

- **Full commit:** `406bf2c327a88b188eb204eef11605acebb235f4`
- **Files touched:** docs/time-tracking.md, scripts/git-hooks/post-commit
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — fixes where an auto-derived time-log row landed in `docs/time-tracking.md`, internal tooling only.

## 2026-08-06 — f932f41 — Draft ADR-0042: Wikipedia connector (MediaWiki API, article-as-Author)

- **Full commit:** `f932f4115021702a264f3cb1c2852bb1a09d9280`
- **Files touched:** docs/adr/0004-author-normalized-separately-from-post.md, docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md, docs/adr/README.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — drafts ADR-0042 (Wikipedia connector), Proposed only at this commit; no connector code shipped. Not documented until built (it later became the still-undrafted-as-code Story 2.13, per commit 8abacce below).

## 2026-08-06 — 3a757b7 — Legal & Compliance Reviewer: first real review, ADR-0038

- **Full commit:** `3a757b704fb9496a415ec3a8e08c1747c1e4057a`
- **Files touched:** docs/legal/legal-compliance-register.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — the Legal & Compliance Reviewer AI role's first real review, recorded in `docs/legal/legal-compliance-register.md`. Internal governance record, not a product capability.

## 2026-08-06 — 7dddb56 — Data Privacy & Sovereignty Reviewer: first real review

- **Full commit:** `7dddb5660e012aab3c3c2d5f02a331ef60df8d54`
- **Files touched:** docs/privacy/data-privacy-sovereignty-register.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — the Data Privacy & Sovereignty Reviewer AI role's first real review, recorded in `docs/privacy/data-privacy-sovereignty-register.md`. Internal governance record only.

## 2026-08-06 — f5e4e41 — Documentation Steward: close the Stakeholder Management cross-reference gap

- **Full commit:** `f5e4e41e8cb12e42995398045d945cf038d07071`
- **Files touched:** docs/pending-documentation-steward-reviews.md, docs/project docs/Project Management Plans/Cost-Management-Plan.md, docs/project docs/Project Management Plans/Development-Approach-and-Life-Cycle-Plan.md, docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md, docs/project docs/Project Management Plans/Planning-Management-Plan.md, docs/project docs/Project Management Plans/Project-Work-Management-Plan.md, docs/project docs/Project Management Plans/Stakeholder-Management-Plan.md, docs/project docs/Project Management Plans/Uncertainty-Management-Plan.md, docs/project docs/Stakeholder-Register.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — Documentation Steward closing a cross-reference gap across the PM planning docs and Stakeholder Register, internal documentation only.

## 2026-08-06 — 3c96b74 — Auto-queue bookkeeping and time-log rows for recent commits

- **Full commit:** `3c96b74d1a0e56136cc66a7f5a80306b5aeb90d9`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — pure AI-role queue/time-tracking bookkeeping for recent commits.

## 2026-08-06 — 10e310d — Auto-queue bookkeeping for the prior bookkeeping commit

- **Full commit:** `10e310d25600cc6caa890a4acda8546031ba3c7b`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — pure AI-role queue/time-tracking bookkeeping for the prior bookkeeping commit.

## 2026-08-06 — 9bc1a48 — Draft ADR-0043: self-service, Tenant-Admin-initiated tenant deletion

- **Full commit:** `9bc1a48db231ea18c9ce0e62d4d910b1e4e7a8a5`
- **Files touched:** docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, docs/adr/0043-self-service-tenant-initiated-deletion.md, docs/adr/README.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change at this commit — drafts ADR-0043 (self-service tenant deletion), Proposed only; no code shipped here. The capability it eventually authorized shipped much later as Story 6.13's real screen (commit 500a4b9, documented in `docs/manuals/tenant-admin-manual.md`'s "Deleting your tenant" section, added this session).

## 2026-08-07 — 9a99257 — Implement Story 3.8: self-service tenant deletion (supersedes Story 3.7)

- **Full commit:** `9a992575edf5aefd805b685a533ea31a36c7e404`
- **Files touched:** docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, docs/adr/0043-self-service-tenant-initiated-deletion.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/self-service-tenant-deletion/SKILL.md, social-listening-core/contracts/epic-3/story-3.8.self-service-tenant-initiated-deletion.contract.test.ts, social-listening-core/jest.config.js, social-listening-core/jest.sequencer.js, social-listening-core/migrations/0023_grant_self_service_tenant_deletion.sql, social-listening-core/src/admin/platformAdminAuditLog.ts, social-listening-core/src/archival/blobArchiveClient.ts, social-listening-core/src/db/tenantDeletionPool.ts, social-listening-core/src/db/withTenant.ts, social-listening-core/src/http/versions/v1/adminTenantsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/selfServiceTenantDeletionRouter.ts, social-listening-core/src/ingestion/errorClassification.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts, social-listening-core/src/tenants/tenantDeletion.ts, social-listening-core/src/tenants/tenantExportCsv.ts, social-listening-core/src/tenants/tenantStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing screen shipped by this commit itself — Story 3.8 is real, contract-verified `social-listening-core` backend (self-service tenant deletion REST surface) with zero frontend caller at the time. The UI shipped over five months later as Story 6.13 (commit 500a4b9, 2026-08-13), now documented in `docs/manuals/tenant-admin-manual.md`'s "Deleting your tenant" section (added this session).

## 2026-08-07 — b80aa58 — Log Story 3.8 in the Implementation Log

- **Full commit:** `b80aa585d53be86167cefefd1c94a234da979f33`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 3.8's own Implementation Log entry; the underlying commit (9a99257) is reviewed separately above.

## 2026-08-07 — c5e1532 — Design documents mockup - microsoft-social-engagement-ui-mockup - including images from social engagement for reference - The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

- **Full commit:** `c5e153221c7f4cabaeeedbbadac8b4b33c8455dc`
- **Files touched:** docs/design/microsoft-social-engagement-ui-mockup/README.md, docs/design/microsoft-social-engagement-ui-mockup/project/.thumbnail, docs/design/microsoft-social-engagement-ui-mockup/project/SocialEngage.dc.html, docs/design/microsoft-social-engagement-ui-mockup/project/support.js, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/1520200669292.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/FutureDecoded-Analytics.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/Microsoft Social Engagement (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/0702.activitymap (1).png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/0702.activitymap.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/11-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/12-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1229302.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1229329.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/15.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1520110736520.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1520200669292.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/2- Go to settings,  Social Profiles then add profile.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/22.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/24.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/4-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/5706.mse1_.2_1 (1).png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/5706.mse1_.2_1 (2).png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/5706.mse1_.2_1.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/6-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/645596c34886ff29ecebfa63d1016d4e.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/FutureDecoded-Analytics.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/FutureDecoded-Dashboard.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/FutureDecoded-Location-Analytics.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/MSE01.PNG, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft Social Engagement (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft Social Engagement.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement-2.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement-Screenshot-WinBuzzer (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement-Screenshot-WinBuzzer.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft_Social_Engagement_2_small.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/R (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/R (2).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/R.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/analytics-conversation-view-social-engagement (1).webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/analytics-conversation-view-social-engagement.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/analytics-conversation-view-social-engagement.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/blog-crm-social-engagement-1024x604.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/dashboard001.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/hqdefault.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/lead.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (2).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (3).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (4).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (5).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (6).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (7).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/microsoft-social-engagement-location-view.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/microsoft-social-listening-example.gif, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/ms.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/ms1.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/mse-social-center-1-625x343.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/mse-social-center-1.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/mse-social-center.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/msei-04-625x431.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/setup01.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/setupd365.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/social-engagement-ga (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/social-engagement-ga.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/socialcentar001.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/socialengagement-filtering.gif, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/timeline.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/topic-e-sentimennt.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/analytics-conversation-view-social-engagement (1).webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/analytics-conversation-view-social-engagement.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/analytics-conversation-view-social-engagement.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/maxresdefault (2)-d2afcdfa.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/maxresdefault (2).jpg
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — a dump of the original Microsoft Social Engagement HTML/CSS/JS mockup and its reference screenshots into `docs/design/`. This is prototype/reference material for future design work, not anything shipped in either real repo.

## 2026-08-08 — 769c28c — Designs from converting the HTML to Next js frontend pages

- **Full commit:** `769c28c613c583bf682a2750325f6683d28f4e19`
- **Files touched:** docs/design/MSE ui Mockup/.env.example, docs/design/MSE ui Mockup/.gitignore, docs/design/MSE ui Mockup/README.md, docs/design/MSE ui Mockup/index.html, docs/design/MSE ui Mockup/metadata.json, docs/design/MSE ui Mockup/package.json, docs/design/MSE ui Mockup/src/App.tsx, docs/design/MSE ui Mockup/src/components/ExportModal.tsx, docs/design/MSE ui Mockup/src/components/FilterBar.tsx, docs/design/MSE ui Mockup/src/components/FlyoutNav.tsx, docs/design/MSE ui Mockup/src/components/PostsPane.tsx, docs/design/MSE ui Mockup/src/components/SubTabs.tsx, docs/design/MSE ui Mockup/src/components/TopBar.tsx, docs/design/MSE ui Mockup/src/components/views/ActivityMapView.tsx, docs/design/MSE ui Mockup/src/components/views/AlertsView.tsx, docs/design/MSE ui Mockup/src/components/views/AuthViews.tsx, docs/design/MSE ui Mockup/src/components/views/ConversationsView.tsx, docs/design/MSE ui Mockup/src/components/views/LocationView.tsx, docs/design/MSE ui Mockup/src/components/views/OverviewView.tsx, docs/design/MSE ui Mockup/src/components/views/PostDetailView.tsx, docs/design/MSE ui Mockup/src/components/views/SearchSetupView.tsx, docs/design/MSE ui Mockup/src/components/views/SentimentView.tsx, docs/design/MSE ui Mockup/src/components/views/SettingsView.tsx, docs/design/MSE ui Mockup/src/components/views/SocialCenterView.tsx, docs/design/MSE ui Mockup/src/components/views/SourcesView.tsx, docs/design/MSE ui Mockup/src/data/mockData.ts, docs/design/MSE ui Mockup/src/index.css, docs/design/MSE ui Mockup/src/main.tsx, docs/design/MSE ui Mockup/src/types.ts, docs/design/MSE ui Mockup/tsconfig.json, docs/design/MSE ui Mockup/vite.config.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — a hand-authored React/Vite conversion of the mockup into `docs/design/MSE ui Mockup/`, still design reference material, not part of `social-listening-admin` itself. No screen described here is reachable by signing into the real app.

## 2026-08-08 — c33353d — Story 1.1 healing: restore repo independence by removing parent package.json

- **Full commit:** `c33353df14e4bfdefe3417642946261dc7486653`
- **Files touched:** social-listening-admin/package.json
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — a Story 1.1 healing pass restoring `social-listening-admin`'s repo independence by removing a stray parent `package.json`. Build/tooling plumbing only.

## 2026-08-08 — 5b7a69f — Governance updates: heal-contract-failure SKILL enhancements, new ADRs 0044-0048, and traceability

- **Full commit:** `5b7a69fab8a496644c85ce499c68bfdf9ec91937`
- **Files touched:** .claude/skills/heal-contract-failure/SKILL.md, .claude/skills/implement-story/SKILL.md, docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md, docs/adr/0045-Audit Trail Architecture for Tenant User Access Management.md, docs/adr/0046-Admin UI Authentication and Authorization Architecture.md, docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md, docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md, docs/adr/README.md, docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — governance updates to the `heal-contract-failure`/`implement-story` skills and four new ADRs (0044–0048), internal process documentation only.

## 2026-08-08 — 4ff04cd — Add Foundry Toolkit setup and configuration

- **Full commit:** `4ff04cd8e0edef359e9fd635a39112120589aed5`
- **Files touched:** .dockerignore, .foundry/.deployment.json, .mcp.json, Dockerfile, agent.yaml, main.py
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — adds unrelated Microsoft Foundry Toolkit setup/deployment scaffolding (later removed, see commits 9eef81b/8018de4 below), not part of either product repo.

## 2026-08-08 — 488ac49 — Healing pass: Stories 2.7, 5.7, 5.13 — contract fixes and implementation

- **Full commit:** `488ac49296bbed9a546e116a317f8dcd06d9cf73`
- **Files touched:** social-listening-core/contracts/epic-2/story-2.7.gnews-connector.contract.test.ts, social-listening-core/contracts/epic-5/story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts, social-listening-core/contracts/epic-5/story-5.7.platform-admin-rls-bypass.contract.test.ts, social-listening-core/src/admin/breakGlassCredentialReset.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — a healing pass fixing contract/implementation bugs in Stories 2.7 (GNews), 5.7, and 5.13 (break-glass), all backend-only with no frontend surface touched.

## 2026-08-08 — fa7954c — UI mock designs: globals, types, mockData, and Tailwind config

- **Full commit:** `fa7954cc7589ab733d232058348a3df86da1d54d`
- **Files touched:** social-listening-admin/src/app/globals.css, social-listening-admin/src/lib/mockData.ts, social-listening-admin/src/lib/types.ts, social-listening-admin/tailwind.config.js
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No independently reportable user-facing change — this adds the mock-data/styling scaffolding (`mockData.ts`, `types.ts`, Tailwind config) underlying what were, at this point in the project's history, still the placeholder tenant screens the manuals' now-removed 2026-08-06 "current limitation" notes described. Superseded once those screens went real in later commits (already reflected above/below).

## 2026-08-08 — 34b5333 — Setup: Codacy config, VS Code MCP settings, Claude settings, and pending reviews

- **Full commit:** `34b53335a990c800c3f2a55205872d49db889176`
- **Files touched:** .claude/settings.local.json, .codacy/.gitignore, .codacy/codacy.config.baseline.json, .codacy/codacy.config.json, .vscode/mcp.json, .vscode/settings.json, CLAUDE.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — Codacy config, VS Code MCP settings, Claude settings, and pending-review bookkeeping. Tooling only.

## 2026-08-08 — 0c3409b — Add Foundry agent tracing tests

- **Full commit:** `0c3409b635a12bd3e469475d694297fa685efe5e`
- **Files touched:** tests/__pycache__/test_tracing.cpython-314.pyc, tests/test_tracing.py
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — adds tests for unrelated Foundry agent tracing scaffolding (later removed, see 9eef81b below), not part of either product repo.

## 2026-08-08 — bb42281 — gitignore: exclude Python __pycache__ and bytecode files

- **Full commit:** `bb42281beacfa448b37d3b32ef25d4885daa0625`
- **Files touched:** .gitignore
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — a `.gitignore` entry excluding Python bytecode files.

## 2026-08-08 — ac05777 — Time tracking: auto-log rows for commits 0c3409b and bb42281

- **Full commit:** `ac057771f4c46e384a4a612e62da234aee445868`
- **Files touched:** docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — auto-logged time-tracking rows for two prior commits.

## 2026-08-08 — 13a909f — Time tracking: log commit HH:MM as day-timeline marker

- **Full commit:** `13a909fe377efa76d11232402d7291ed40363560`
- **Files touched:** docs/time-tracking.md, scripts/git-hooks/post-commit
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — adds a day-timeline marker convention to time-tracking, internal tooling only.

## 2026-08-08 — 2b2d40b — Implement Story 6.6 platform admin console

- **Full commit:** `2b2d40bf77361a8854fbd0c7a2c98c3379aec269`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. This is Story 6.6's original 2026-08-08 build of the Platform Admin console; `docs/manuals/system-admin-manual.md`'s "Honest history" note (added this session) names this exact date as the original build, before the 2026-08-12 rebuild replaced its three non-interactive sections with real controls.

## 2026-08-08 — 77e1bfc — Log Story 6.6 in the Implementation Log

- **Full commit:** `77e1bfcbdd5bc56a14feb42cd4d2dde85d17f27e`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 6.6's own Implementation Log entry; the underlying commit (2b2d40b) is reviewed separately above.

## 2026-08-08 — 8abdb48 — feat: add azd and ai agent deployment config

- **Full commit:** `8abdb485b7aed35e56cd01d61042d6fb30435ee9`
- **Files touched:** .vscode/launch.json, .vscode/tasks.json, Dockerfile, README.md, agent-framework-agent-with-local-tools-responses/.gitignore, agent-framework-agent-with-local-tools-responses/AGENTS.md, agent-framework-agent-with-local-tools-responses/CLAUDE.md, agent-framework-agent-with-local-tools-responses/README.md, agent-framework-agent-with-local-tools-responses/azure.yaml, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.azdignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.dockerignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.env.example, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/Dockerfile, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/main.py, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/requirements.txt, azd-ai-agents-2026-08-08.log, azure.yaml, infra/main.bicep, main.py, requirements.txt, tests/test_tracing.py
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — adds unrelated azd/AI-agent deployment config (Dockerfile, bicep, launch/tasks.json), not part of either product repo. Later substantially removed (see 9eef81b/8018de4 below).

## 2026-08-09 — 0b9e1dd — ADR changes and updates approvals - VSCode Copilot Registration and project optimizations

- **Full commit:** `0b9e1dd8fa91dd687cf9fce80ae7bb32dc504223`
- **Files touched:** .codacy/codacy.config.baseline.json, .codacy/codacy.config.json, .vscode/mcp.json, .vscode/settings.json, AGENTS.md, docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md, docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md, docs/adr/0045-Audit Trail Architecture for Tenant User Access Management.md, docs/adr/0046-Admin UI Authentication and Authorization Architecture.md, docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md, docs/adr/README.md, requirements.txt, tests/__pycache__/test_tracing.cpython-314.pyc
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — ADR file touch-ups plus VS Code Copilot registration/optimization config, internal tooling and governance only.

## 2026-08-09 — 11186b7 — update github copilot instructions

- **Full commit:** `11186b74ec794a3c48020bc8c53d6516b20ef9b0`
- **Files touched:** .github/copilot-instructions.md, .github/prompts/plan-socialEngage.prompt.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — updates GitHub Copilot instructions and a planning prompt file, internal tooling only.

## 2026-08-09 — 10fc934 — feat: Story 1.8 — GET /v1/tenants/me tenant self-view endpoint (ADR-0031)

- **Full commit:** `10fc934ac8ba79019d702a966cc942b9ca5f7336`
- **Files touched:** social-listening-core/.claude/skills/tenants/SKILL.md, social-listening-core/contracts/epic-1/story-1.8.tenant-self-view.contract.test.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantSelfViewRouter.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing screen at this commit — Story 1.8 is a real `social-listening-core` backend endpoint (`GET /v1/tenants/me`) with no frontend caller yet. It's exactly what powers Story 6.9's tenant settings screen, shipped the next day (commit 9ec62fa) and documented in both `docs/manuals/tenant-admin-manual.md`'s and `docs/manuals/user-manual.md`'s "Viewing your tenant's settings" sections.

## 2026-08-09 — 4de308e — heal: Story 3.5 — fix archival partition eligibility boundary condition (ADR-0018)

- **Full commit:** `4de308ee4205d22c211d61c6c6ebdfe551be1af8`
- **Files touched:** social-listening-core/src/archival/socialPostArchival.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — a healing pass fixing an archival partition-eligibility boundary condition in `social-listening-core`, an internal batch job with no user-visible surface.

## 2026-08-09 — 75cc58d — docs: ADR-0018 amendment + SKILL.md update for partition eligibility boundary fix

- **Full commit:** `75cc58d27d806fafa4cc01bd7f5c59d7f35c6a20`
- **Files touched:** docs/adr/0018-data-retention-and-archival-policy.md, social-listening-core/.claude/skills/data-retention-and-archival/SKILL.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — an ADR-0018 amendment and SKILL.md update documenting the 4de308e fix above, internal documentation only.

## 2026-08-09 — 3badf2f — feat: Story 1.9 — user invitation and offboarding REST surface (ADR-0032)

- **Full commit:** `3badf2f61c8da29a80af914be86525d7ea833efa`
- **Files touched:** social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/contracts/epic-1/story-1.9.user-invite-offboard.contract.test.ts, social-listening-core/contracts/epic-5/story-5.9.users-table-identity-resolution.contract.test.ts, social-listening-core/migrations/0024_create_user_access_audit_log.sql, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts, social-listening-core/src/identity/identityResolution.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing screen at this commit — Story 1.9 is a real `social-listening-core` backend endpoint (user invitation/offboarding REST surface) with no frontend caller yet. It's exactly what powers Story 6.8's user management screen, shipped the next day (commit 6b7fc00) and documented in `docs/manuals/tenant-admin-manual.md`'s "Managing your tenant's users" and `docs/manuals/user-manual.md`'s "Viewing your tenant's users" sections.

## 2026-08-09 — afd270f — docs: implementation log entry for Story 1.9

- **Full commit:** `afd270fbe4e57ebd1371c853265295b0d95719e7`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 1.9's own Implementation Log entry; the underlying commit (3badf2f) is reviewed separately above.

## 2026-08-09 — 2b44637 — feat: Story 6.7 — self-service tenant sign-up UI (ADR-0037)

- **Full commit:** `2b4463747b872565c0d954004027450dd53b8c5b`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md, social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts, social-listening-admin/src/app/api/auth/callback/route.ts, social-listening-admin/src/app/api/auth/signup/route.ts, social-listening-admin/src/app/sign-up/already-have-account/page.tsx, social-listening-admin/src/app/sign-up/domain-taken/page.tsx, social-listening-admin/src/app/sign-up/error/page.tsx, social-listening-admin/src/app/sign-up/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/signupFlow.ts, social-listening-admin/src/proxy.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 6.7 (self-service tenant sign-up UI) is documented in `docs/manuals/tenant-admin-manual.md`'s "How you get your own tenant today" section, including the honest caveat that this path isn't open to the general public yet at Stage 0.

## 2026-08-09 — d114c16 — docs: implementation log entry for Story 6.7

- **Full commit:** `d114c16032ff3a3c6e03839b58e67fa85d99bdee`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 6.7's own Implementation Log entry; the underlying commit (2b44637) is reviewed separately above.

## 2026-08-10 — 832f7b3 — heal: parallel-worker race between Story 6.1/6.7's spawned dev servers

- **Full commit:** `832f7b3eaadf1a2b6d1e7ebb4cd1e0e92883efe5`
- **Files touched:** social-listening-admin/.claude/skills/admin-auth-session/SKILL.md, social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts, social-listening-admin/next.config.js
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — a healing pass fixing a parallel-worker race between two contract tests' own spawned dev servers, test infrastructure only.

## 2026-08-10 — 09160c4 — docs: implementation log entry for healing pass (6.1/6.7 dev-server race)

- **Full commit:** `09160c43570f3c71095a75dbee641486a2e03107`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the healing pass above (832f7b3).

## 2026-08-10 — c89ee47 — chore: regenerate next-env.d.ts/tsconfig.json for per-test distDir

- **Full commit:** `c89ee47eadb4c3bffa66d1e19ac37da4dba5df13`
- **Files touched:** social-listening-admin/next-env.d.ts, social-listening-admin/tsconfig.json
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — regenerates `next-env.d.ts`/`tsconfig.json` for a per-test build directory, build tooling only.

## 2026-08-10 — 6b7fc00 — feat: Story 6.8 — Tenant-Admin user invitation and management screen

- **Full commit:** `6b7fc0022b3efc0f7861318033fdeb0ff0831ff1`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts, social-listening-admin/src/app/api/tenant-users/[id]/route.ts, social-listening-admin/src/app/api/tenant-users/route.ts, social-listening-admin/src/app/tenant/users/AccessControl.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 6.8 (Tenant-Admin user invitation and management screen) is documented in `docs/manuals/tenant-admin-manual.md`'s "Managing your tenant's users" section, and its Tenant-User-visible (view-only) half in `docs/manuals/user-manual.md`'s "Viewing your tenant's users" section.

## 2026-08-10 — 09b626f — docs: implementation log entries for Story 6.8 and its healing follow-up

- **Full commit:** `09b626faf39b7ba370ecaab2fef1db11e2a1ff7e`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entries for Story 6.8 and its healing follow-up; the underlying commit (6b7fc00) is reviewed separately above.

## 2026-08-10 — 9ec62fa — feat: Story 6.9 — tenant settings screen

- **Full commit:** `9ec62fa80123edf68b5f28f3b3877c46f2e2f53a`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/tenant-settings/SKILL.md, social-listening-admin/contracts/epic-6/story-6.9.tenant-settings-screen.contract.test.ts, social-listening-admin/src/app/tenant/settings/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 6.9 (tenant settings screen) is documented identically in both `docs/manuals/tenant-admin-manual.md`'s and `docs/manuals/user-manual.md`'s "Viewing your tenant's settings" sections (correctly, since this screen has no role difference).

## 2026-08-10 — 1e18c4b — docs: implementation log entry for Story 6.9

- **Full commit:** `1e18c4b6bba373ac526df14cd47c04f4a380ffd3`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 6.9's own Implementation Log entry; the underlying commit (9ec62fa) is reviewed separately above.

## 2026-08-10 — 3661ce9 — feat: Story 6.10 — Same-Domain Invite Assist view, closing out Epic 6

- **Full commit:** `3661ce90591765bf672b9278bb17fa9f61eb174a`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/same-domain-invite-assist/SKILL.md, social-listening-admin/contracts/epic-6/story-6.10.same-domain-invite-assist-view.contract.test.ts, social-listening-admin/src/app/tenant/invite-assist/page.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 6.10 (Same-Domain Invite Assist view) is documented in `docs/manuals/tenant-admin-manual.md`'s "Reviewing same-domain sign-up attempts" section, correctly omitted from `docs/manuals/user-manual.md` since this screen is Tenant-Admin only.

## 2026-08-10 — 19d50d7 — docs: implementation log entry for Story 6.10

- **Full commit:** `19d50d74f254ac4c5e5bcdb2525f635ca10baa75`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 6.10's own Implementation Log entry; the underlying commit (3661ce9) is reviewed separately above.

## 2026-08-10 — 5fe1999 — feat: Story 5.17 — access-history read endpoint (ADR-0032 §9)

- **Full commit:** `5fe1999c67f0d55a3a851788602d86c423347ac1`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/contracts/epic-5/story-5.17.access-history-read-endpoint.contract.test.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts, social-listening-core/src/identity/identityResolution.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing screen at this commit — Story 5.17 is a real `social-listening-core` backend endpoint (access-history read) with no frontend caller anywhere in `social-listening-admin` (confirmed directly: no reference to it in `social-listening-admin/src`). Named as a real, open gap in `docs/manuals/tenant-admin-manual.md`'s "What's not built yet" section this session (Story 6.14, the screen that would consume it, is drafted but not built).

## 2026-08-10 — f0e3c36 — docs: implementation log entry for Story 5.17

- **Full commit:** `f0e3c361e7c948e4415a7c0219bba4d0bef0682d`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 5.17's own Implementation Log entry; the underlying commit (5fe1999) is reviewed separately above.

## 2026-08-10 — 99b58c3 — heal: retry break-glass password-reset/TAP calls on transient Graph 409s

- **Full commit:** `99b58c31f8b129e85227336cc52bd0aa88b1bba3`
- **Files touched:** social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/src/admin/breakGlassCredentialReset.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed — this healing pass adds retry-on-transient-Graph-409 to the break-glass password-reset/TAP calls, an internal reliability fix. It doesn't change any step a Platform Admin takes; the break-glass flow it protects is already documented in `docs/manuals/system-admin-manual.md`'s "Break-glass credential reset" section.

## 2026-08-10 — d78c598 — docs: implementation log entry for break-glass retry healing pass

- **Full commit:** `d78c598861351f6f326918bb9e54e3de3506699e`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the break-glass retry healing pass above (99b58c3).

## 2026-08-10 — 7a2466d — feat: Story 5.18 — self-service sign-up rate limiting (ADR-0040)

- **Full commit:** `7a2466d27958c1d36a5c02a116130eac1d9064eb`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md, social-listening-core/contracts/epic-5/story-5.18.signup-rate-limiting.contract.test.ts, social-listening-core/src/http/versions/v1/selfServiceSignupRouter.ts, social-listening-core/src/tenants/signupRateLimit.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed — Story 5.18 (self-service sign-up rate limiting) is a real backend safety measure, but `social-listening-admin`'s sign-up screen has no dedicated rate-limit UI state (confirmed: no 429/rate-limit handling anywhere in `social-listening-admin/src/app`) — a rate-limited attempt surfaces through the same generic error handling already described in `docs/manuals/tenant-admin-manual.md`'s sign-up section.

## 2026-08-10 — d1ad0c6 — docs: implementation log entry for Story 5.18

- **Full commit:** `d1ad0c6f549e79074052a9a75bb45b1f5ec64889`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 5.18's own Implementation Log entry; the underlying commit (7a2466d) is reviewed separately above.

## 2026-08-10 — f70b07d — feat: Story 2.8 — Azure AI Language connector, real AIProviderConnector (ADR-0038)

- **Full commit:** `f70b07dacee68d618c2537c705e300a91a6d83a0`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/.claude/skills/social-post-enrichment/SKILL.md, social-listening-core/contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts, social-listening-core/contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/azureAiLanguageConnector.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts, social-listening-core/src/connectors/examples/exampleAiProviderY.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/types.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 2.8 (Azure AI Language, the first real `AIProviderConnector`) is why "Azure AI Language" now appears as a connectable platform in both `docs/manuals/tenant-admin-manual.md`'s and `docs/manuals/user-manual.md`'s "Connecting a platform" sections.

## 2026-08-10 — 80cc28d — docs: implementation log entry for Story 2.8

- **Full commit:** `80cc28d676ad6c4377e0f2f3a626eaaec1a7a0f2`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 2.8's own Implementation Log entry; the underlying commit (f70b07d) is reviewed separately above.

## 2026-08-10 — 1e7e9ac — docs: ADR-0038 amendment — Foundry Local rejected, Azure OpenAI Service selected for Story 2.9

- **Full commit:** `1e7e9ac785414a7527298c0188322f369ce6e825`
- **Files touched:** docs/adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — an ADR-0038 amendment (Foundry Local rejected, Azure OpenAI Service selected for Story 2.9), internal design-decision documentation only, no code shipped in this commit.

## 2026-08-10 — 54b32fa — docs: ADR-0038 correction — gpt-4o-mini deprecated, gpt-5-mini deployed instead

- **Full commit:** `54b32fa5f67ae65d20320e733377945af775b09b`
- **Files touched:** docs/adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — an ADR-0038 correction (a specific model deployment name), internal documentation only.

## 2026-08-10 — 69310ba — feat: Story 2.9 — second AIProviderConnector, Azure OpenAI (gpt-5-mini), provider swappability

- **Full commit:** `69310ba80ae4be83e51e5cf4f7c7f51063b3cbdd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts, social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 2.9 (the second `AIProviderConnector`, Azure OpenAI) is why "Azure OpenAI Service" now appears as a connectable platform in both manuals' "Connecting a platform" sections.

## 2026-08-10 — 9007da1 — docs: implementation log entry for Story 2.9

- **Full commit:** `9007da1efbf888cfef55168c6eab6379aca9d558`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 2.9's own Implementation Log entry; the underlying commit (69310ba) is reviewed separately above.

## 2026-08-10 — 292a22a — feat: Story 2.9 follow-up — self-review + overallConfidence for Azure OpenAI enrichment

- **Full commit:** `292a22adcc17be9e3190900618444f240c6ef6ed`
- **Files touched:** social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts, social-listening-core/src/connectors/types.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — adds self-review and `overallConfidence` fields to Azure OpenAI enrichment internally. Confirmed neither field is displayed anywhere in `social-listening-admin`'s post feed/detail screens today — an internal enrichment-quality mechanism, not a UI-visible capability.

## 2026-08-10 — d936082 — docs: implementation log addendum for Story 2.9 self-review/overallConfidence follow-up

- **Full commit:** `d936082690e4b8da7c23b4e4945aafdcf72d065f`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends an Implementation Log addendum for the self-review/overallConfidence follow-up above (292a22a).

## 2026-08-10 — 8e1ac18 — docs: draft ADR-0049 and ADR-0050 (Proposed) from Cursor Composer brainstorm session

- **Full commit:** `8e1ac18a8aade52395a733d430ab4cabfd258b17`
- **Files touched:** docs/adr/0004-author-normalized-separately-from-post.md, docs/adr/0049-point-in-time-author-follower-count-on-social-post.md, docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md, docs/adr/README.md, docs/open-decisions.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — drafts ADR-0049 and ADR-0050, both Proposed only at this commit; no code shipped here.

## 2026-08-10 — 7d978e0 — docs: correct overstated Story 6.3 connect-flow claims in AI connector SKILL.mds

- **Full commit:** `7d978e0bd46f8b8823cd4f8d6e74316670bf8900`
- **Files touched:** social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — corrects overstated Story 6.3 connect-flow claims in two connector SKILL.mds (internal documentation accuracy), no product code touched.

## 2026-08-10 — 1dbd26a — heal: Story 6.3 — real connector connect/disconnect flow, not a static placeholder

- **Full commit:** `1dbd26a6e8a9f0180d25f8dd22df8fea73b656da`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/src/app/api/connectors/[platformId]/connect/route.ts, social-listening-admin/src/app/api/connectors/[platformId]/disconnect/route.ts, social-listening-admin/src/app/tenant/connectors/ConnectForm.tsx, social-listening-admin/src/app/tenant/connectors/DisconnectButton.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected, and directly load-bearing for it. This healing pass is what made Story 6.3's connect/disconnect flow real instead of a static placeholder — it's exactly the fix that lets `docs/manuals/tenant-admin-manual.md`'s and `docs/manuals/user-manual.md`'s "Connecting a platform" sections describe genuinely working behavior; the "current limitation, as of 2026-08-06" placeholder notes those manuals previously carried have been removed this session as stale.

## 2026-08-10 — d545174 — docs: implementation log entry for Story 6.3 healing pass

- **Full commit:** `d545174725734e5664bdb733b3e546d7528e042a`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the Story 6.3 healing pass above (1dbd26a).

## 2026-08-10 — 15756e0 — heal: Story 1.4 — withDevEnv.js never loaded .env, only jest's test setup did

- **Full commit:** `15756e00df0a2a74ee5027f3fe3e35af165070d3`
- **Files touched:** social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/contracts/epic-1/story-1.4-fixtures/printEnvAndArgv.js, social-listening-core/contracts/epic-1/story-1.4-fixtures/test-fixture.env, social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts, social-listening-core/scripts/withDevEnv.js
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — a healing pass fixing `scripts/withDevEnv.js` never loading `.env`, local dev tooling only.

## 2026-08-10 — de96102 — docs: implementation log entry for Story 1.4 withDevEnv.js healing pass

- **Full commit:** `de96102e84c6a9e4b930a4af3fe9c5181dad980b`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the withDevEnv.js healing pass above (15756e0).

## 2026-08-10 — dba9895 — heal: Story 6.1 — real Platform Admin sign-in blocked by missing OAuth scope and oid-vs-sub seed error

- **Full commit:** `dba98958df63edd3e9d2c1ff0bc0dc2d96cdfb2b`
- **Files touched:** docs/adr/0029-authentication-mechanism-entra-external-id.md, social-listening-admin/.claude/skills/admin-auth-session/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/src/lib/entra.ts, social-listening-core/.claude/skills/identity-resolution/SKILL.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed — this healing pass fixes a real infrastructure/config defect (a missing OAuth scope, plus an `oid`-vs-`sub` seed-data error) that was silently misrouting every real Platform Admin sign-in. It makes the already-generically-described "sign in with your organization's Microsoft Entra identity" flow in `docs/manuals/system-admin-manual.md` genuinely work end to end — no new or different step for the reader to follow, so no manual text changes.

## 2026-08-10 — 6d08379 — docs: implementation log entry for Story 6.1 OAuth-scope healing pass

- **Full commit:** `6d08379b3c2439d968fb874576193c35628a95c5`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the OAuth-scope healing pass above (dba9895).

## 2026-08-10 — 35b70a8 — heal: Story 6.2 — a successful platform_admin sign-in lands on / with only a manual link

- **Full commit:** `35b70a822353fc0b5641a8da4007a932aca3d03f`
- **Files touched:** social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/src/app/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. This healing pass fixed a successful platform_admin sign-in landing on `/` with only a manual link; `docs/manuals/system-admin-manual.md`'s "Signing in" step 3 already describes the corrected, auto-routed behavior, not the pre-fix state.

## 2026-08-10 — 596b2c3 — docs: implementation log entry for Story 6.2 root-redirect healing pass

- **Full commit:** `596b2c36900d4c44b5e39a049c1614e4b87e5fec`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the root-redirect healing pass above (35b70a8).

## 2026-08-10 — f4c50db — docs: record real Entra tenant-config prerequisites found during live self-service sign-up test

- **Full commit:** `f4c50dbe3143138d732f23054255a665edbc9fdb`
- **Files touched:** social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — records real Entra tenant-configuration prerequisites discovered during live self-service sign-up testing, in that component's own internal SKILL.md. Operational/setup notes for whoever configures Entra, not a change to any screen or flow.

## 2026-08-10 — 49eaa50 — docs: backlog a future ADR candidate — richer self-service sign-up business-details form

- **Full commit:** `49eaa5012d60a5d464c3c3b476947f1eb354ca86`
- **Files touched:** docs/adr/README.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — backlogs a future ADR candidate (a richer self-service sign-up business-details form) in `docs/adr/README.md`. Not built; nothing to document.

## 2026-08-10 — 4551e26 — docs: backlog missing invite-withdrawal capability, found during live invite testing

- **Full commit:** `4551e2672bc6b7d4279837a392f668514b79afd4`
- **Files touched:** social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-core/.claude/skills/identity-resolution/SKILL.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — backlogs a missing invite-withdrawal capability found during live testing, in two components' own internal SKILL.mds. Not built; nothing to document.

## 2026-08-10 — f36d765 — heal: Story 5.15 — self-service tenant founder never consumed a seat

- **Full commit:** `f36d765af41efe84c8c9df6a882a33d5b9ae53a9`
- **Files touched:** social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md, social-listening-core/contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts, social-listening-core/src/tenants/selfServiceSignup.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed — this healing pass fixes an internal data-correctness bug (a self-service tenant founder never consumed a licensed seat), affecting the accuracy of seat counts shown on the Platform Admin console's tenant registry and the tenant settings screen — but not their already-accurate generic description ("how many of your licensed seats are currently used out of your total") in either manual.

## 2026-08-10 — 3ae641e — docs: implementation log entry for Story 5.15 seat-count healing pass

- **Full commit:** `3ae641ecdbbc0420a6fdf5de20f8cd26daa4a2ae`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the seat-count healing pass above (f36d765).

## 2026-08-10 — 9eef81b — chore: remove unrelated Microsoft Foundry Python sample project and stray azd scaffolding

- **Full commit:** `9eef81ba06f7970bb4afccdd15fab531c58aec54`
- **Files touched:** agent-framework-agent-with-local-tools-responses/.gitignore, agent-framework-agent-with-local-tools-responses/AGENTS.md, agent-framework-agent-with-local-tools-responses/CLAUDE.md, agent-framework-agent-with-local-tools-responses/README.md, agent-framework-agent-with-local-tools-responses/azure.yaml, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.azdignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.dockerignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.env.example, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/Dockerfile, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/main.py, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/requirements.txt, azd-ai-agents-2026-08-08.log, azure.yaml, main.py, tests/__pycache__/test_tracing.cpython-314.pyc, tests/test_tracing.py
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — removes an unrelated Microsoft Foundry Python sample project and stray azd scaffolding (added in 4ff04cd/8abdb48/0c3409b above), a cleanup with nothing to do with either product repo.

## 2026-08-10 — 8018de4 — chore: remove .vscode/tasks.json and launch.json, dead since the Foundry sample's removal

- **Full commit:** `8018de477a0eb113c088bedbd7159bd5fb92c2c2`
- **Files touched:** .vscode/launch.json, .vscode/tasks.json
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — removes `.vscode/tasks.json`/`launch.json`, dead since the Foundry sample's removal above. Tooling cleanup only.

## 2026-08-11 — 8dff76b — docs: ADR governance pass — accept ADR-0044/0047/0048/0049/0050, resolve resulting stories

- **Full commit:** `8dff76ba2186816c7e7d39544a201d6aa75967e1`
- **Files touched:** docs/adr/0004-author-normalized-separately-from-post.md, docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md, docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md, docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md, docs/adr/0049-point-in-time-author-follower-count-on-social-post.md, docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md, docs/adr/README.md, docs/future-subsystems.md, docs/open-decisions.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — an ADR governance pass accepting ADR-0044/0047/0048/0049/0050 and resolving the stories they gate. Acceptance alone ships nothing; the actual code for each lands in later commits, reviewed on their own merits above/below.

## 2026-08-12 — aaf6bd7 — feat: rebuild Story 1.5 watchlist CRUD against ADR-0044 (personal ownership, RFC 7396 PATCH, optimistic locking)

- **Full commit:** `aaf6bd72f312ce7df0dc60a376f2f893f3e1508c`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/watchlist-crud/SKILL.md, social-listening-core/contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts, social-listening-core/contracts/epic-3/story-3.8.self-service-tenant-initiated-deletion.contract.test.ts, social-listening-core/contracts/epic-5/story-5.10.retire-x-tenant-id.contract.test.ts, social-listening-core/migrations/0025_watchlists_ownership_and_versioning.sql, social-listening-core/src/db/withTenant.ts, social-listening-core/src/http/versions/v1/watchlistsRouter.ts, social-listening-core/src/tenants/tenantDeletion.ts, social-listening-core/src/watchlists/watchlistStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. This rebuilds Story 1.5's watchlist CRUD backend against ADR-0044 (personal ownership, RFC 7396 PATCH, optimistic locking) — exactly the behavior `docs/manuals/tenant-admin-manual.md`'s "Managing watchlists" section already describes (private-to-you ownership, the "changed elsewhere" conflict message).

## 2026-08-12 — c5fca67 — docs: implementation log entry for Story 1.5 watchlist ownership rebuild

- **Full commit:** `c5fca6765784532ecb8421b66ec2d980278a9f20`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the Story 1.5 watchlist ownership rebuild above (aaf6bd7).

## 2026-08-12 — 63dcbce — feat: Story 1.10 -- Postgres boot-time readiness check and a real /v1/health

- **Full commit:** `63dcbced329a86999edbe2889db30f574c8c2dfd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/http-api-versioning/SKILL.md, social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/contracts/epic-1/story-1.10.postgres-readiness-and-health.contract.test.ts, social-listening-core/src/db/postgresReadiness.ts, social-listening-core/src/http/server.ts, social-listening-core/src/http/versions/v1/router.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 1.10 (Postgres boot-time readiness check and a real `/v1/health`) is what powers the Platform Admin console's "Database health" indicator; `docs/manuals/system-admin-manual.md` now cites Story 1.10 directly in that section (added this session).

## 2026-08-12 — 0694d2c — docs: implementation log entry for Story 1.10 Postgres readiness check

- **Full commit:** `0694d2c07b86ea7d61d5e6c9c0ecbbbb131e814e`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 1.10's own Implementation Log entry; the underlying commit (63dcbce) is reviewed separately above.

## 2026-08-12 — 8cf76a2 — chore: stop tracking .claude/settings.local.json, gitignore it

- **Full commit:** `8cf76a2f3bdfe29a22404d19e92e7735312cff10`
- **Files touched:** .claude/settings.local.json, .gitignore
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — stops tracking `.claude/settings.local.json`, gitignores it. Tooling only.

## 2026-08-12 — f2c7788 — feat: Story 2.10 -- connector registration transparency, mechanically enforced (ADR-0048)

- **Full commit:** `f2c7788f4d21c971ed93488e5939392bf98504bb`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — Story 2.10 (connector registration transparency) is a mechanically-enforced CI guardrail against a hardcoded per-provider switch, internal to `social-listening-core`'s own test suite. No UI surface.

## 2026-08-12 — 9f90a82 — docs: implementation log entry for Story 2.10 connector registration transparency

- **Full commit:** `9f90a82063c95f83f3e13523fb63898f72c9ed50`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 2.10's own Implementation Log entry; the underlying commit (f2c7788) is reviewed separately above.

## 2026-08-12 — afcb59e — feat: Story 2.11 -- tenant-owned-domain RSS connector with DNS TXT verification (ADR-0050)

- **Full commit:** `afcb59ed8e7dee15d261dbee6c5860783f3c6c8b`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts, social-listening-core/contracts/epic-2/story-2.11.tenant-owned-feed-connector.contract.test.ts, social-listening-core/migrations/0026_create_tenant_owned_feed_activations.sql, social-listening-core/src/connectors/tenantOwnedFeed/dnsVerification.ts, social-listening-core/src/connectors/tenantOwnedFeed/feedItemParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedConnector.ts, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantOwnedFeedRouter.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing screen at this commit — Story 2.11 is a real `social-listening-core` backend connector (tenant-owned-domain RSS with DNS TXT verification) with no frontend caller yet. The UI shipped as Story 6.12 (commit e1e9913, 2026-08-13), now documented in both manuals' "Monitoring your own company domain's content feed" sections (added this session).

## 2026-08-12 — 9f09393 — docs: implementation log entry for Story 2.11 tenant-owned-feed connector

- **Full commit:** `9f093933e2d7df0eada850f170ebe95fc1850516`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 2.11's own Implementation Log entry; the underlying commit (afcb59e) is reviewed separately above.

## 2026-08-12 — 34e9dfb — feat: Story 3.9 -- point-in-time author follower count on SocialPost (ADR-0049)

- **Full commit:** `34e9dfb8ae712a992ae275d6eb82221c64f9a3d8`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-3/story-3.9.author-follower-count-at-publish.contract.test.ts, social-listening-core/migrations/0027_add_social_posts_author_follower_count_at_publish.sql, social-listening-core/src/connectors/types.ts, social-listening-core/src/posts/socialPostStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — Story 3.9 adds a point-in-time author follower count to `SocialPost`'s own data model. Confirmed not displayed anywhere in `social-listening-admin`'s post feed or detail screens today — a backend field with no UI surface yet.

## 2026-08-12 — 3d650c8 — docs: implementation log entry for Story 3.9 author follower count at publish

- **Full commit:** `3d650c8f6deecd8f565f7bdc265eef369eed47a5`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 3.9's own Implementation Log entry; the underlying commit (34e9dfb) is reviewed separately above.

## 2026-08-12 — 4cd4ef1 — docs: correct wrong commit hash on the 2026-08-01 Story 1.5 implementation-log entry

- **Full commit:** `4cd4ef1618971b3e35966a69750cf9d5b9cffb6d`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — corrects a wrong commit hash on an existing Implementation Log entry, a documentation-accuracy fix with no product code touched.

## 2026-08-12 — fded97b — feat(social-listening-admin): rebuild Story 6.4 watchlist screen for real, against ADR-0044

- **Full commit:** `fded97b08813d7ab686582410c7d99668e5d4eac`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md, docs/user-stories/epic-6-tenant-admin-ui.md, docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/watchlist-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts, social-listening-admin/src/app/api/watchlists/[id]/route.ts, social-listening-admin/src/app/api/watchlists/route.ts, social-listening-admin/src/app/tenant/watchlists/WatchlistForm.tsx, social-listening-admin/src/app/tenant/watchlists/WatchlistRow.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 6.4's watchlist screen rebuild (against ADR-0044, for real) is what `docs/manuals/tenant-admin-manual.md`'s and `docs/manuals/user-manual.md`'s "Managing watchlists" sections describe.

## 2026-08-12 — d96d782 — docs: implementation log entry for Story 6.4 watchlist screen rebuild

- **Full commit:** `d96d782380bc109a2f8d718c4f1eaa5e0f99309e`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the Story 6.4 watchlist screen rebuild above (fded97b).

## 2026-08-12 — 4046e75 — feat(social-listening-admin): rebuild Story 6.5 connector status screen for real

- **Full commit:** `4046e75598214371efa888fbe6bca049e01bd1dd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 6.5's connector status screen rebuild (for real) is what both manuals' "Checking connector status" sections describe.

## 2026-08-12 — 2e77c17 — docs: implementation log entry for Story 6.5 connector status screen rebuild

- **Full commit:** `2e77c179a2152d0a27c588936602b6c715bcdd0d`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the Story 6.5 connector status screen rebuild above (4046e75).

## 2026-08-12 — 51eecf0 — feat(social-listening-admin): rebuild Story 6.6 Platform Admin console for real

- **Full commit:** `51eecf0270472fb6d30f30bca3a53b6d0a9557f8`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/break-glass/request/route.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/break-glass/requests/[requestId]/execute/route.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/route.ts, social-listening-admin/src/app/api/admin/tenants/route.ts, social-listening-admin/src/app/platform-admin/BreakGlassPanel.tsx, social-listening-admin/src/app/platform-admin/ProvisionTenantForm.tsx, social-listening-admin/src/app/platform-admin/TenantAdminControls.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected, and directly load-bearing for it. This is the real rebuild of Story 6.6's Platform Admin console (Provision tenant, Update tenant, and Break-glass had each been a single non-interactive `<p>`); `docs/manuals/system-admin-manual.md` was rewritten in full this session to describe this real console, including an "Honest history" note naming this rebuild directly.

## 2026-08-12 — 7102011 — docs: implementation log entry for Story 6.6 Platform Admin console rebuild

- **Full commit:** `710201121f23d5f5afd9c6e04c98e7ee340c2821`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the Story 6.6 Platform Admin console rebuild above (51eecf0).

## 2026-08-12 — feae698 — feat(social-listening-admin): show Active/Inactive on every connector, not just connected ones

- **Full commit:** `feae698d9a7024381b824fd074866fb9069e4671`
- **Files touched:** docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. This enhancement (showing Active/Inactive on every connector, not just connected ones) is described in both manuals' "Checking connector status" and "Connecting a platform" sections.

## 2026-08-12 — e430a6b — docs: implementation log entry for the connector status Active/Inactive indicator

- **Full commit:** `e430a6bfa71157c55c0ce4ae088b122c20686829`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the connector status Active/Inactive indicator above (feae698).

## 2026-08-12 — e6c0617 — docs: ADR governance pass — accept ADR-0051, add Story 1.11

- **Full commit:** `e6c0617c745db7d9b91ef4989146b90d7811c28a`
- **Files touched:** docs/adr/0051-connector-activation-decoupled-from-credential.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change at this commit — an ADR governance pass accepting ADR-0051 and drafting Story 1.11 (Ready, not yet built at this point). The actual code lands in the next commit, reviewed below.

## 2026-08-12 — 18a0e38 — docs: companion ADR-0051 cross-reference notes — ADR-0009/0010/0022/0023/0024/0034

- **Full commit:** `18a0e38aa05b479cfb447410864a2482ab2fe660`
- **Files touched:** docs/adr/0009-connector-health-derived-not-stored.md, docs/adr/0010-error-handling-and-auto-disable-policy.md, docs/adr/0022-derived-data-caching-and-refresh-strategy.md, docs/adr/0023-proportional-connector-failure-threshold.md, docs/adr/0024-newswire-connector-direct-wire-rss-issuer-as-author.md, docs/adr/0034-connector-connect-disconnect-crud-ownership-tier-aware.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — companion ADR-0051 cross-reference notes across six other ADRs, internal documentation only.

## 2026-08-12 — 703e755 — feat: Story 1.11 — connector activation decoupled from credential presence

- **Full commit:** `703e7558d46e43461505ddb2eaca5380a6dd4ed5`
- **Files touched:** docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-core/contracts/epic-1/story-1.11.connector-activation.contract.test.ts, social-listening-core/contracts/epic-2/story-2.3.error-handling-auto-disable.contract.test.ts, social-listening-core/contracts/epic-2/story-2.4.bounded-queues-and-dead-lettering.contract.test.ts, social-listening-core/migrations/0028_create_connector_activations.sql, social-listening-core/src/connectors/connectorActivationStore.ts, social-listening-core/src/connectors/connectorHealth.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing screen at this commit — Story 1.11 is a real `social-listening-core` backend change (connector activation decoupled from credential presence) with no frontend caller yet. The UI shipped the same day as Story 6.15 (commit cc7cae2), documented in both manuals already.

## 2026-08-12 — 7ffd477 — docs: implementation log entry for Story 1.11 (social-listening-core@703e755)

- **Full commit:** `7ffd477322970f0e4d14d2d2f804ee12f1bc74ae`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 1.11's own Implementation Log entry; the underlying commit (703e755) is reviewed separately above.

## 2026-08-12 — f8985b9 — docs: draft Stories 1.12, 2.12, 6.15 — closing three of Story 1.11's own named gaps

- **Full commit:** `f8985b977ec8382bdce9c79648a8b66ef3f224c9`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change at this commit — drafts Stories 1.12, 2.12, and 6.15 (Ready, not yet built at this point). Each is reviewed on its own merits at its own build commit below.

## 2026-08-12 — c3af2a7 — feat: Story 1.12 — GET /v1/connectors/:platformId includes real isActive

- **Full commit:** `c3af2a7aa5d0ab439773a8edab512c2576737aa0`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/contracts/epic-1/story-1.12.connector-status-includes-activation.contract.test.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing screen at this commit — Story 1.12 (`GET /v1/connectors/:platformId` includes real `isActive`) is a real backend change with no frontend caller yet. It's exactly what Story 6.15's Activate/Deactivate control (commit cc7cae2, reviewed below) reads.

## 2026-08-12 — c481e01 — docs: implementation log entry for Story 1.12 (social-listening-core@c3af2a7)

- **Full commit:** `c481e0135d4cd3ce1cfbfa48a26b8d28702025fa`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 1.12's own Implementation Log entry; the underlying commit (c3af2a7) is reviewed separately above.

## 2026-08-12 — da102a9 — feat: Story 2.12 — exclude retryable failures from the failing derivation

- **Full commit:** `da102a9e51f8229a7e617371efaa1c490d2fa2b6`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/contracts/epic-2/story-2.12.retryable-failures-excluded-from-auto-disable.contract.test.ts, social-listening-core/src/connectors/connectorHealth.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed — Story 2.12 (excluding retryable failures from the failing derivation) is an internal connector-health calculation correctness fix. It doesn't change what a connector status screen shows structurally, only makes the already-documented "real health" more accurate.

## 2026-08-12 — 5adff09 — docs: implementation log entry for Story 2.12 (social-listening-core@da102a9)

- **Full commit:** `5adff094d2b35fce849dae6efb96b2566e904d13`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 2.12's own Implementation Log entry; the underlying commit (da102a9) is reviewed separately above.

## 2026-08-12 — 8abacce — docs: draft Story 2.13 — closing a real gap, ADR-0042 (Wikipedia) never got a story

- **Full commit:** `8abaccecdeba7c5534359297a2812c25f54142e6`
- **Files touched:** docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — drafts Story 2.13 (Wikipedia connector, closing a real gap that ADR-0042 never got a story for). Not built; nothing to document.

## 2026-08-12 — cc7cae2 — feat: Story 6.15 — activate/deactivate controls on the connector screens

- **Full commit:** `cc7cae26080787f8221632552187c6fb6e2b942b`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/api/connectors/[platformId]/activate/route.ts, social-listening-admin/src/app/api/connectors/[platformId]/deactivate/route.ts, social-listening-admin/src/app/tenant/connectors/ActivateDeactivateButton.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 6.15 (activate/deactivate controls on the connector screens) is explicitly named in both manuals' "Connecting a platform" sections.

## 2026-08-12 — 62d78ff — docs: implementation log entry for Story 6.15 (social-listening-admin@cc7cae2)

- **Full commit:** `62d78ffa57dd134cacef6aa076835123c047a4d5`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 6.15's own Implementation Log entry; the underlying commit (cc7cae2) is reviewed separately above.

## 2026-08-12 — 6e110aa — fix: reject unresolved identity in admin role-gating (Story 6.2 healing)

- **Full commit:** `6e110aa7c5f2759d76822f52226b89312b0271dc`
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/lib/role-routing.ts, social-listening-core/scripts/ensureContractTestIdentity.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed — this healing pass (rejecting an unresolved identity in admin role-gating) is internal hardening of the sign-in/routing enforcement path already described generically in all three manuals' "Signing in" sections; it introduces no new step or screen for any reader.

## 2026-08-12 — eb8b10b — docs: implementation log entry for the Story 6.2 role-gating healing pass

- **Full commit:** `eb8b10b2deee116df913c1f401b33edca7fe1bf3`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the Story 6.2 role-gating healing pass above (6e110aa).

## 2026-08-12 — 4801a36 — fix: run pending migrations automatically before social-listening-core's dev server starts

- **Full commit:** `4801a36b470d8f8c48778b43020db18129443b55`
- **Files touched:** social-listening-core/README.md, social-listening-core/package.json
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — makes `social-listening-core`'s dev server run pending migrations automatically before starting, a local developer-experience fix with no product-facing surface.

## 2026-08-12 — d8ba590 — feat: Story 6.11 — post feed screen in social-listening-admin

- **Full commit:** `d8ba590883512f353ed9c79872a321a5a30ad02f`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/app/tenant/posts/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts, social-listening-admin/src/lib/core-client.ts, social-listening-core/.claude/skills/posts-api/SKILL.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 6.11 (the post feed screen) is what `docs/manuals/tenant-admin-manual.md`'s and `docs/manuals/user-manual.md`'s "Browsing your tenant's posts" sections describe.

## 2026-08-12 — 6362dda — docs: implementation log entry for Story 6.11 (social-listening-admin@d8ba590)

- **Full commit:** `6362dda3d38ffbdf1365624d7a3fc4491e1459b1`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 6.11's own Implementation Log entry; the underlying commit (d8ba590) is reviewed separately above.

## 2026-08-12 — 99c1dcf — fix: activation now gates AI enrichment provider selection (Story 2.9 healing)

- **Full commit:** `99c1dcf04f08cc6d358e753df390b5802a56e728`
- **Files touched:** social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/social-post-enrichment/SKILL.md, social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts, social-listening-core/contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed — this healing pass makes tenant-wide/personal activation actually gate which AI provider is used for enrichment. It doesn't introduce a new screen or step; both manuals' enrichment sections already describe "whichever AI provider your tenant currently has connected and active," which is precisely what this fix makes true.

## 2026-08-12 — 43d36ca — feat: show which AI provider enriched a post on the detail screen

- **Full commit:** `43d36caa6094083c993bb774c49ca9e2e0acc853`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. This enhancement (showing which AI provider enriched a post on the detail screen) is why both manuals' "Running enrichment manually" sections mention "which provider produced them"/"Enriched by."

## 2026-08-12 — 3b5f08b — docs: implementation log entries for the AI provider activation-gating fix and enrichment attribution enhancement

- **Full commit:** `3b5f08bc0b5c916607f841a090c49610761473ce`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entries for the AI-provider activation-gating fix and the enrichment-attribution enhancement above (99c1dcf, 43d36ca).

## 2026-08-12 — 216c32a — style: global baseline stylesheet for social-listening-admin

- **Full commit:** `216c32a048151d6c802580ded68dc4131ee54423`
- **Files touched:** social-listening-admin/src/app/globals.css, social-listening-admin/src/app/layout.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. All three manuals now note the 2026-08-12 global baseline stylesheet as a visual-only change, with no effect on how any documented screen works.

## 2026-08-12 — e556c3c — docs: name the AI-provider status display gap on the connector status screen

- **Full commit:** `e556c3ca630a7d5d5f7f5106f88798715e7f6bf0`
- **Files touched:** social-listening-admin/.claude/skills/connector-status-view/SKILL.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. The AI-provider "last successful fetch" display gap this commit names in the connector-status-view SKILL.md is already captured as a "Current limitation" in both manuals' "Checking connector status" sections.

## 2026-08-12 — 51a2b40 — feat: Story 6.16 (backend) — POST /v1/posts/:id/enrich

- **Full commit:** `51a2b4055acec4a4b07abfcb89e3b0f0f2b25120`
- **Files touched:** social-listening-core/.claude/skills/posts-api/SKILL.md, social-listening-core/contracts/epic-3/story-6.16.post-manual-enrich-endpoint.contract.test.ts, social-listening-core/src/http/versions/v1/postsRouter.ts, social-listening-core/src/posts/socialPostStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing screen at this commit on its own — Story 6.16's backend half (`POST /v1/posts/:id/enrich`) has no frontend caller until the very next commit (21da4f5, same day), reviewed together with it below.

## 2026-08-12 — 21da4f5 — feat: Story 6.16 (frontend) — manual "run enrichment now" button

- **Full commit:** `21da4f57568300c80047ceaa62e3e091ee7e02ad`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.16.manual-enrichment-button.contract.test.ts, social-listening-admin/src/app/api/posts/[id]/enrich/route.ts, social-listening-admin/src/app/tenant/posts/RunEnrichmentButton.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. Story 6.16 (the manual "Run enrichment now" button) is what both manuals' "Running enrichment manually on an older post" sections describe.

## 2026-08-12 — e5fec8f — docs: Story 6.16 traceability and implementation log entries

- **Full commit:** `e5fec8fe0b46cb7c2dd7c9911249a92e2e423c22`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 6.16's own traceability and Implementation Log entries; the underlying commits (51a2b40, 21da4f5) are reviewed separately above.

## 2026-08-12 — ab37bf3 — docs: clarify break-glass request intake channel (ADR-0030, Story 5.13)

- **Full commit:** `ab37bf330c9a9049554771efc032e240a31752d2`
- **Files touched:** docs/adr/0030-admin-tier-design-platform-admin-rls-exception.md, docs/user-stories/epic-5-security-isolation-and-messaging.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — clarifies the break-glass request intake channel in ADR-0030 and Story 5.13's own text. Internal design/story documentation only, no behavior change to the already-documented break-glass flow.

## 2026-08-12 — f5bb2d4 — feat: tenant rename (PATCH /v1/admin/tenants/:id gains name)

- **Full commit:** `f5bb2d4fbc30fb9d671ebde3c13501ac27f8c162`
- **Files touched:** docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/route.ts, social-listening-admin/src/app/platform-admin/TenantAdminControls.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-core/.claude/skills/platform-admin-tenant-management/SKILL.md, social-listening-core/.claude/skills/tenants/SKILL.md, social-listening-core/contracts/epic-5/story-5.12.platform-admin-tenant-management.contract.test.ts, social-listening-core/migrations/0029_grant_platform_admin_name_update.sql, social-listening-core/src/http/versions/v1/adminTenantsRouter.ts, social-listening-core/src/tenants/tenantStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. This enhancement (tenant rename via `PATCH /v1/admin/tenants/:id`) is why `docs/manuals/system-admin-manual.md`'s "Editing a tenant" section describes a real name field.

## 2026-08-12 — 8905c21 — docs: implementation log entry for tenant rename enhancement (cross-repo@f5bb2d4)

- **Full commit:** `8905c219aae9f3b3d08b6bac87d3ffa01491b8c4`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the tenant rename enhancement above (f5bb2d4).

## 2026-08-12 — c2aa7b1 — feat: ProvisionTenantForm gains an optional domain field

- **Full commit:** `c2aa7b121882b97bbc5a6041eb68aa7a2c77d2d2`
- **Files touched:** docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/api/admin/tenants/route.ts, social-listening-admin/src/app/platform-admin/ProvisionTenantForm.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected. This enhancement (`ProvisionTenantForm` gains an optional domain field) is why `docs/manuals/system-admin-manual.md`'s "Provisioning a new tenant" section describes the optional domain field.

## 2026-08-12 — 8b54aae — docs: implementation log entry for ProvisionTenantForm domain field (social-listening-admin@c2aa7b1)

- **Full commit:** `8b54aaebc1bc3caf213c0e7503742844d830fe10`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the ProvisionTenantForm domain field enhancement above (c2aa7b1).

## 2026-08-13 — 57fe1de — docs: correct CLAUDE.md's stale Epic 6 build-status summary

- **Full commit:** `57fe1def1dbea307fd10f243c10584afa3144c21`
- **Files touched:** CLAUDE.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — corrects CLAUDE.md's own stale Epic 6 build-status summary, internal documentation only. (This exact staleness — CLAUDE.md still saying Stories 6.12/6.13 were "Ready but not yet built" after they'd actually shipped — is what this review pass independently re-confirmed by reading `docs/implementation-log.md` and the real commits directly, rather than trusting that summary.)

## 2026-08-13 — e1e9913 — feat: tenant-owned-feed connector setup UI (Story 6.12, ADR-0050)

- **Full commit:** `e1e99139dedaa53eef7c018ba468ce934919c7a9`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/connect/route.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/verify-domain/route.ts, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected, added this session. Story 6.12 (tenant-owned-feed connector setup UI) is documented in a new "Monitoring your own company domain's content feed" section in both `docs/manuals/tenant-admin-manual.md` and `docs/manuals/user-manual.md`.

## 2026-08-13 — b155bc5 — docs: implementation log entry for Story 6.12 (social-listening-admin@e1e9913)

- **Full commit:** `b155bc51fb84952fb8c28367e26ee20d992401da`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 6.12's own Implementation Log entry; the underlying commit (e1e9913) is reviewed separately above.

## 2026-08-13 — 500a4b9 — feat: self-service tenant deletion/offboarding UI (Story 6.13, ADR-0043)

- **Full commit:** `500a4b9a4383f1e01330c0e322e9c44e55ecf6ff`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/tenant-deletion-offboarding/SKILL.md, social-listening-admin/contracts/epic-6/story-6.13.tenant-deletion-offboarding.contract.test.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/confirm/route.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/export/route.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/request/route.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/route.ts, social-listening-admin/src/app/tenant/settings/delete/TenantDeletionPanel.tsx, social-listening-admin/src/app/tenant/settings/delete/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected, added this session. Story 6.13 (self-service tenant deletion/offboarding UI) is documented in a new "Deleting your tenant" section in `docs/manuals/tenant-admin-manual.md` (correctly Tenant-Admin only — no equivalent section added to `docs/manuals/user-manual.md`, matching this screen's own real role gate).

## 2026-08-13 — 42ff7b5 — docs: implementation log entry for Story 6.13 (social-listening-admin@500a4b9)

- **Full commit:** `42ff7b5e82f62989bb1e14c6b40b187b2876c574`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 6.13's own Implementation Log entry; the underlying commit (500a4b9) is reviewed separately above.

## 2026-08-13 — a479383 — feat: live ingestion-polling scheduler (Story 1.13, ADR-0052)

- **Full commit:** `a479383e2ae200b104732986531f47952971289b`
- **Files touched:** docs/adr/0052-live-ingestion-polling-scheduler.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/.claude/skills/live-ingestion-polling-scheduler/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts, social-listening-core/src/connectors/bootstrapConnectors.ts, social-listening-core/src/connectors/types.ts, social-listening-core/src/http/server.ts, social-listening-core/src/scheduler/pollScheduler.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected, added this session. Story 1.13 (the live ingestion-polling scheduler) is the first time this app's real running instance ever ingested anything automatically — both manuals' "Browsing your tenant's posts" sections now open with a note on the automatic background polling cadence this story introduced, and the honest fact that no automatic ingestion existed at all before it.

## 2026-08-13 — 9a347c6 — docs: implementation log entry for Story 1.13 (social-listening-core@a479383)

- **Full commit:** `9a347c65f142bfb13d11b311d00fff464a7b96da`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 1.13's own Implementation Log entry; the underlying commit (a479383) is reviewed separately above.

## 2026-08-13 — d0eb088 — feat: tenant-wide activate/deactivate control on tenant-owned-feed screen (Story 6.17, ADR-0051)

- **Full commit:** `d0eb08813a3d083602bd05ed8349a6fae880fc5a`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.17.tenant-owned-feed-activation-control.contract.test.ts, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No new manual text needed this pass — already reflected, added this session. Story 6.17 (tenant-wide activate/deactivate on the tenant-owned-feed screen) is described in step 5 of `docs/manuals/tenant-admin-manual.md`'s "Monitoring your own company domain's content feed" section, and in `docs/manuals/user-manual.md`'s equivalent section.

## 2026-08-13 — 780f981 — docs: implementation log entry for Story 6.17 (social-listening-admin@d0eb088)

- **Full commit:** `780f9817c6516eefb487afadc9255151316301b8`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — appends Story 6.17's own Implementation Log entry; the underlying commit (d0eb088) is reviewed separately above.

## 2026-08-13 — bd9bbfc — docs: accept ADR-0053, draft Story 3.10 (canonical Markdown post-body normalization)

- **Full commit:** `bd9bbfc1e35a2ee821bd362be70e00a2d6b506fe`
- **Files touched:** docs/adr/0053-canonical-markdown-post-body-normalization-at-ingestion.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-13 (Learning & Development Writer):** No user-facing change — confirmed directly, not just trusted from this entry's own description. This commit accepts ADR-0053 (a `body_markdown` column decision) and drafts Story 3.10; no migration, no code, and no UI exist for either yet. Nothing to document until Story 3.10 is actually built and, per that story's own scope, surfaces in a UI a reader would notice.

## 2026-08-13 — 13f5163 — docs: clear review backlog — Documentation Steward, L&D Writer, Ideal Manager passes (2026-08-13)

- **Full commit:** `13f5163e336b549c0bfb573021b6965114d7c578`
- **Files touched:** docs/adr/0051-connector-activation-decoupled-from-credential.md, docs/adr/feature-coverage-review.md, docs/implementation-log.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/manuals/system-admin-manual.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/open-decisions.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/project docs/Business-Case-v6.0.md, docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md, docs/project docs/Stakeholder-Register.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — nothing to document. This commit is the 2026-08-13 Documentation Steward/L&D Writer/Ideal Manager queue-clearing pass itself (queue bookkeeping, ADR/PM-doc corrections, and that same pass's own manual updates) — its manual edits are the ones already reviewed under their own originating entries (e.g. Stories 6.12/6.13/6.17/1.13) elsewhere in this file, not a new capability of its own.

## 2026-08-13 — dcec172 — feat: Story 3.10 — canonical Markdown post-body storage and enrichment input (ADR-0053)

- **Full commit:** `dcec172f4f940fa048a3f05a2063e69628af0dc6`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/canonical-markdown-conversion/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.6.newswire-connector.contract.test.ts, social-listening-core/contracts/epic-3/story-3.10.canonical-markdown-post-body-normalization.contract.test.ts, social-listening-core/migrations/0030_add_social_posts_body_markdown.sql, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/src/connectors/gnews/gnewsConnector.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/newswire/rssFeedParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/feedItemParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/content/htmlToMarkdown.ts, social-listening-core/src/content/turndown-plugin-gfm.d.ts, social-listening-core/src/posts/socialPostStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change yet. Story 3.10 adds the `body_markdown` column and has every real connector populate it at ingestion time, but nothing in `social-listening-admin` reads or renders it at this commit — `GET /v1/posts`/`GET /v1/posts/:id` didn't expose it until Story 6.19's core half (`aa4f317`, reviewed separately below), and no screen rendered it until Story 6.19's admin half (`4f099a6`). Confirmed directly, not assumed.

## 2026-08-13 — df0c2c3 — docs: implementation log entry for Story 3.10 (social-listening-core@dcec172)

- **Full commit:** `df0c2c3bbac458a9846e2c26adeb954626fec8e4`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — appends Story 3.10's own Implementation Log entry; the underlying commit (dcec172) is reviewed separately above.

## 2026-08-13 — e59b2da — docs: methodology retrospective — relationship-assertion contracts, story resume, Built field, environment gotchas

- **Full commit:** `e59b2dabf32a9c95529ce6a75e1bdac4e5906dda`
- **Files touched:** .claude/agents/documentation-steward.md, .claude/skills/heal-contract-failure/SKILL.md, .claude/skills/implement-story/SKILL.md, CLAUDE.md, docs/environment-gotchas.md, docs/implementation-methodology.md, docs/project docs/Lessons-Learned-Register.md, docs/templates/component-skill-template.md, docs/user-stories/README.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — an internal methodology retrospective (relationship-assertion contracts, story-resume discipline, the Built field, environment gotchas). No product code or UI touched.

## 2026-08-13 — 6443562 — chore: rewrite root README, harden AGENTS.md, wire up VS Code test discovery

- **Full commit:** `6443562c92fd966d53f3c581cb46eaf67d35e6be`
- **Files touched:** .mcp.json, .vscode/extensions.json, .vscode/mcp.json, .vscode/settings.json, AGENTS.md, Dockerfile, README.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, requirements.txt, social-listening-admin/next-env.d.ts, social-listening-admin/package-lock.json
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — internal tooling: rewrites the root README, hardens AGENTS.md, and wires up VS Code test discovery. Nothing in `social-listening-admin` or `social-listening-core`'s own product surface changed.

## 2026-08-13 — 8d210af — chore: post-commit hook queue entries for 6443562

- **Full commit:** `8d210af4300713a0622403ddd79c5c2d2c517740`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — post-commit hook queue bookkeeping for 6443562, reviewed separately above.

## 2026-08-17 — ea9d9fe — fix: heal contract staleness from an uncommitted Server/Client component split

- **Full commit:** `ea9d9fe0e58b1ae7b2c3d7b566de5db92d1ee799`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/package-lock.json, social-listening-admin/package.json, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/layout.tsx, social-listening-admin/src/app/platform-admin/layout.tsx, social-listening-admin/src/app/sign-in/page.tsx, social-listening-admin/src/app/signed-out/page.tsx, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/ConnectorStatusClient.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/app/tenant/layout.tsx, social-listening-admin/src/app/tenant/page.tsx, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/RunEnrichmentButton.tsx, social-listening-admin/src/app/tenant/posts/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts, social-listening-admin/src/app/tenant/watchlists/WatchlistForm.tsx, social-listening-admin/src/app/tenant/watchlists/WatchlistRow.tsx, social-listening-admin/src/app/tenant/watchlists/WatchlistsClient.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/components/shell/AppHeader.tsx, social-listening-admin/src/components/shell/AppShell.tsx, social-listening-admin/src/components/shell/AppSidebar.tsx, social-listening-admin/src/components/shell/index.ts, social-listening-admin/src/components/shell/shell.test.ts, social-listening-admin/src/components/ui/ConfirmModal.tsx, social-listening-admin/src/components/ui/EmptyState.tsx, social-listening-admin/src/components/ui/InlineError.tsx, social-listening-admin/src/components/ui/RelativeTime.tsx, social-listening-admin/src/components/ui/Slideover.tsx, social-listening-admin/src/components/ui/StatusBadge.tsx, social-listening-admin/src/components/ui/TagInput.tsx, social-listening-admin/src/components/ui/components.test.ts, social-listening-admin/src/components/ui/index.ts, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — a contract-healing pass reconciling test coverage against an already-existing (uncommitted, pre-dating this session) Server/Client Component split in `social-listening-admin`. Confirmed directly against `docs/implementation-log.md`'s own account: every flagged Acceptance Criterion's real behavior (the ADR-0027 disclosure, `ActivateDeactivateButton` gating, connect/disconnect, connector health rendering) was already present, just relocated into the new Client Components — this pass proves the same real behavior, not new capability. One real product decision surfaced and was confirmed intentional, not a regression: posts now open in a Slideover panel rather than a separate `/tenant/posts/:id` navigation link — already reflected in this manual's own Posts-screen description.

## 2026-08-17 — 30816ad — docs: log the 2026-08-17 healing pass for Stories 6.1/6.2/6.3/6.5/6.11/6.12/6.15

- **Full commit:** `30816ad3772725b6d4f69d2de660c17a5363d3e3`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — appends the Implementation Log entry for the 2026-08-17 healing pass (Stories 6.1/6.2/6.3/6.5/6.11/6.12/6.15) reviewed immediately above (ea9d9fe).

## 2026-08-17 — 5558e11 — feat: Story 8.1 — Analytics dashboard shell, date-range filter, Overview and Sources tabs

- **Full commit:** `5558e11f61be16fce51cb49f31d252c80e11275b`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/src/app/api/analytics/summary/route.ts, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/AnimatedChartTooltip.tsx, social-listening-admin/src/app/tenant/analytics/GlobalDateRangePicker.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/SourcesTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/analytics/fetchAnalyticsSummary.ts, social-listening-admin/src/app/tenant/analytics/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, shipped new screen — documented this pass. Story 8.1 (Analytics dashboard shell, date-range filter, Overview and Sources tabs) is the first commit of what became the full six-story Analytics Dashboard (Epic 8, ADR-0054). A new "Analytics dashboard (Stories 8.1–8.6)" section was added to both `docs/manuals/tenant-admin-manual.md` and `docs/manuals/user-manual.md`, describing the dashboard as it stands today (after Stories 8.2–8.6 also shipped, all reviewed below) — verified directly against the real, current `social-listening-admin/src/app/tenant/analytics/*` source, not from this commit's own AC prose alone. Confirmed reachable by both `tenant_admin` and `tenant_user` identities (`AnalyticsPage` gates only on the ordinary 'tenant' shell, and "Analytics" appears in `AppSidebar.tsx`'s nav for both roles) — correctly documented in both manuals, not just the Tenant Admin one.

## 2026-08-17 — 87e8cf4 — docs: ADR-0054 (Analytics Dashboard), Epic 8, and Story 8.1 traceability

- **Full commit:** `87e8cf4baba1c5d846277bbec015e7dd053aefa5`
- **Files touched:** docs/adr/0008-defer-topic-time-series-and-charting.md, docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/README.md, docs/design/frontend-design-specification.md, docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — ADR-0054/Epic 8/Story 8.1 traceability bookkeeping; the underlying capability (5558e11) is reviewed separately above.

## 2026-08-17 — a54bf05 — feat: Story 8.2 — Sentiment tab

- **Full commit:** `a54bf05bd12b169431c0f224c54016ffd6ea3355`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/SentimentTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, shipped new screen content — documented this pass as part of the combined "Analytics dashboard" section (see 5558e11 above). Story 8.2 adds the Sentiment tab (donut, sentiment-over-time chart, Top fans/Top critics, positive/negative key-phrase clouds, click-to-filter) — described in both manuals' Analytics section.

## 2026-08-17 — 05cc132 — docs: log Story 8.2 (Sentiment tab) traceability

- **Full commit:** `05cc1326de12a3a6d9ff8a2f65ff1114766b2330`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/epic-8-analytics-dashboard.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — Story 8.2 traceability bookkeeping; the underlying capability (a54bf05) is reviewed separately above.

## 2026-08-17 — 5fed9dd — feat: Story 8.3 — Conversations tab, closing out Epic 8

- **Full commit:** `5fed9ddaf072c30672a3c1d42fa55ec79723fb5b`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.3.conversations-tab.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/ConversationsTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, shipped new screen content — documented this pass as part of the combined "Analytics dashboard" section (see 5558e11 above). Story 8.3 adds the Conversations tab (key-phrase cloud, top-phrases-over-time chart, click-to-filter), closing Epic 8's original three-tab scope — described in both manuals.

## 2026-08-17 — 838ac19 — docs: log Story 8.3 (Conversations tab) traceability, closing out Epic 8

- **Full commit:** `838ac19eb70442139ae78075f9fef4a0d81b5485`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/epic-8-analytics-dashboard.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — Story 8.3 traceability bookkeeping; the underlying capability (5fed9dd) is reviewed separately above.

## 2026-08-17 — 4082a8a — fix: no personal-scope credential/activation UI for AI providers (ADR-0028 Tier 2 only)

- **Full commit:** `4082a8a97b759daa72acf4144a98588db74d4635`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/ConnectorStatusClient.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, user-visible restriction — documented this pass. Found live: a personal ("Just for me") activation of Azure AI Language silently succeeded but had no effect, since enrichment only ever reads a tenant-wide credential/activation for an AI provider (ADR-0028 Decision §1, Tier 2 only). This admin-side fix removes the Scope selector and the personal Activate/Deactivate control for Azure AI Language and Azure OpenAI Service specifically (GNews keeps both), and shows a non-Tenant-Admin an honest "ask your Tenant-Admin to connect this platform" note instead of a button that would just fail. `docs/manuals/tenant-admin-manual.md`'s and `docs/manuals/user-manual.md`'s own "Connecting a platform" sections now state this restriction plainly (step 5 in the Tenant Admin manual, step 4 in the User manual).

## 2026-08-17 — 5d0fb49 — fix(core): reject personal-scope connect/activate for AI provider connectors

- **Full commit:** `5d0fb49d7174e4941e770ffd0baef4534cd67e98`
- **Files touched:** docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md, social-listening-core/contracts/epic-1/story-1.11.connector-activation.contract.test.ts, social-listening-core/contracts/epic-1/story-1.7.ownership-tier-connect-disconnect.contract.test.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No separate manual text needed — this is the `social-listening-core` backend half of the same fix reviewed immediately above (4082a8a): `connectorsRouter.ts`'s `forbidsUserScope()` now also rejects `ownerType: 'user'` for any AI provider connector on both `/connect` and `/activate`, the actual mechanism enforcing the UI-side restriction already documented.

## 2026-08-17 — c1275ed — docs: log core-side healing pass, publish infrastructure migration runbook

- **Full commit:** `c1275ed0893c4f8c1865f7b738fafe2748515afe`
- **Files touched:** docs/adr/README.md, docs/implementation-log.md, docs/infrastructure-setup.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs the core-side healing pass above (5d0fb49) and publishes `docs/infrastructure-setup.md`'s own real Azure migration runbook (Key Vault/Storage/Service Bus/AI Language/OpenAI) — an operator-facing infrastructure document, not an end-user-facing manual concern (see the System Admin Manual's own separate "Infrastructure & credential operations" section for that distinction, unaffected by this commit).

## 2026-08-17 — ae015e0 — feat(admin): Story 8.4 — Overview volume/sentiment charts, period-over-period comparison

- **Full commit:** `ae015e001f3f8071df7f02913685ac4f31b0a16d`
- **Files touched:** docs/implementation-plan.md, social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.4.overview-enrichment-period-comparison.contract.test.ts, social-listening-admin/src/app/api/analytics/summary/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/analytics/fetchAnalyticsSummary.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, shipped new screen content — documented this pass as part of the combined "Analytics dashboard" section (see 5558e11 above). Story 8.4 adds a real volume-over-time chart and sentiment donut to the Overview tab, plus real period-over-period percentage-change badges when the date picker's "Compare to previous period" toggle is on — both described in the Analytics section's step 1 (date range/comparison) and step 2 (Overview tab) in both manuals, and named in "What's not built yet" as Overview-only, not yet on the other three tabs.

## 2026-08-17 — 63d3604 — docs: log Story 8.4, draft ADR-0055 (language/location enrichment feasibility)

- **Full commit:** `63d3604cf9ce0f416deac19ad2ead26d1bba3c19`
- **Files touched:** docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md, docs/adr/README.md, docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 8.4 (reviewed above) and drafts ADR-0055 (language/location enrichment feasibility) — a draft ADR decides nothing built yet, per this role's own hard rule against documenting the roadmap.

## 2026-08-17 — 6a55e8b — docs: accept ADR-0055, move Story 8.5 to Ready

- **Full commit:** `6a55e8bd4e52452ad83f202ffd838674db1506ec`
- **Files touched:** docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md, docs/adr/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — accepts ADR-0055 and moves Story 8.5 to Ready. An accepted ADR and a Ready story are not yet shipped, contract-verified capability — nothing to document until Story 8.5 itself ships (reviewed below, 8b8bb14).

## 2026-08-17 — 8b8bb14 — feat(admin): Story 8.5 — Languages breakdown widget

- **Full commit:** `8b8bb140a9c22ef5b0b77a3b6c2a3352cdd85c3d`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.3.conversations-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.5.languages-breakdown-widget.contract.test.ts, social-listening-admin/src/app/tenant/analytics/ConversationsTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, shipped new screen content — documented this pass as part of the combined "Analytics dashboard" section (see 5558e11 above). Story 8.5 adds the Languages breakdown widget to the Conversations tab (real per-language post counts, click-to-filter) — described in the Analytics section's step 4 in both manuals, and the detected-language field it surfaces is also named in the Posts-screen sections (see b837b39 below for its separate post-feed surfacing).

## 2026-08-17 — fa457e9 — docs: log Story 8.5, close out Epic 8's traceability

- **Full commit:** `fa457e920bbb1e9f5a8854274780d5344136c9e3`
- **Files touched:** docs/adr/README.md, docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 8.5 (reviewed above) and closes out Epic 8's own traceability bookkeeping.

## 2026-08-17 — a17af3f — feat(admin): Story 8.6 — Sources tab per-source sentiment score, volume-over-time

- **Full commit:** `a17af3f6ba8488cda1f28155d5a5d57f4d866e93`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.6.sources-tab-sentiment-index-volume-history.contract.test.ts, social-listening-admin/src/app/tenant/analytics/SourcesTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, shipped new screen content — documented this pass as part of the combined "Analytics dashboard" section (see 5558e11 above). Story 8.6 adds a real 0–10 weighted sentiment score and a volume-over-time chart per source to the Sources tab — described in the Analytics section's step 5 in both manuals, including the honest "blank when a source has no enriched posts yet" behavior (never a fabricated default).

## 2026-08-17 — 0ca3a9b — docs: log Story 8.6, draft ADR-0056 (AI-inferred Newswire dateline location)

- **Full commit:** `0ca3a9b1b18bb7ad5a3bed48f6e1a8c0f31567b3`
- **Files touched:** docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md, docs/adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md, docs/adr/README.md, docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 8.6 (reviewed above) and drafts ADR-0056 (AI-inferred Newswire dateline location) — a draft ADR, not yet built, correctly left undocumented per this role's hard rule.

## 2026-08-17 — eeb9c8c — fix(core): connect fails clearly when KEY_VAULT_KEY_ID is unconfigured

- **Full commit:** `eeb9c8c317d2430820a024c3a7a9ec45d53a54c1`
- **Files touched:** social-listening-core/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-core/.claude/skills/credential-envelope-encryption/SKILL.md, social-listening-core/contracts/epic-1/story-1.7.ownership-tier-connect-disconnect.contract.test.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No end-user manual documentation needed. This fixes `POST /:platformId/connect` to fail with a clear, actionable error instead of an opaque one when the operator's own `KEY_VAULT_KEY_ID` environment variable is unset — a real live bug (Menno hit "Failed to store credential" connecting GNews after a fresh Key Vault migration), but the underlying cause is an infrastructure/deployment misconfiguration, not a normal path any tenant identity reaches during ordinary use. Not added to either tenant-facing manual for that reason; belongs, if anywhere, in the System Admin Manual's existing "Infrastructure & credential operations" section, which already covers Key Vault as an operator concern — left as-is since that section already names Key Vault credential handling generally and this is a narrow error-message improvement, not a new operator-facing capability.

## 2026-08-17 — 1d49817 — docs: log Key Vault credential-storage healing pass

- **Full commit:** `1d49817b8f77d1cd6ad14ea53b917f043cca0536`
- **Files touched:** docs/adr/0014-credential-storage-envelope-encryption-oauth-first.md, docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs the Key Vault credential-storage healing pass reviewed immediately above (eeb9c8c).

## 2026-08-17 — a97cf30 — feat(admin): Story 6.18 — post feed search/filter operates over all matched posts

- **Full commit:** `a97cf300ff9edcfa9e8a11377ef4befa45b3c03a`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.18.post-feed-search-all-posts.contract.test.ts, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, user-visible behavior change — documented this pass. Story 6.18 widens the Posts screen's search box and Provider/Sentiment/Watchlist filters to operate over the tenant's entire ingested history (via a new paginated `fetchAllPosts()` fetch), not just the current 20-post page as before — a real, confirmed gap Menno found live. Both manuals' "Browsing your tenant's posts" sections now state this explicitly ("search and every filter operate over your tenant's entire ingested history, not just the current page").

## 2026-08-17 — 5c23158 — docs: log Story 6.18

- **Full commit:** `5c23158f8cbf35654c6512538cd66ed356f6c408`
- **Files touched:** docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 6.18 (reviewed above).

## 2026-08-17 — a27aa10 — feat(admin): Story 6.14 — access-history view on the tenant users screen

- **Full commit:** `a27aa10cb5db80a1046de3e0a38274dbec42efd2`
- **Files touched:** social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.14.access-history-view.contract.test.ts, social-listening-admin/src/app/api/tenant-users/[id]/access-history/route.ts, social-listening-admin/src/app/tenant/users/AccessHistoryButton.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, shipped new screen — documented this pass. Story 6.14 (access-history view) is the one story explicitly named at the start of this session as the sole remaining Ready-but-unbuilt gap in Epic 6, now built: a "View access history" action per row on the Team & Access screen, Tenant-Admin only. A new "Reviewing a user's access history (Story 6.14)" section was added to `docs/manuals/tenant-admin-manual.md` only — correctly not added to `docs/manuals/user-manual.md`, since `page.tsx` renders `AccessHistoryButton` only inside the `isTenantAdmin`-gated Actions column, confirmed directly against the real source, not assumed from the story's own AC text.

## 2026-08-17 — 50c7de1 — docs: log Story 6.14

- **Full commit:** `50c7de116016cf33ce505ff19616515d4ea5377a`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 6.14 (reviewed above).

## 2026-08-17 — 5886a3e — fix(admin): Provider filter's tenant-owned-feed option used the wrong value

- **Full commit:** `5886a3e87b9ac3c6c4cb33bca77ee3840ea0fe18`
- **Files touched:** social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, user-visible bugfix, folded into the general Posts-screen description rather than given its own section. Fixes the Provider filter's "Tenant Feed" option, which used an underscored `tenant_owned_feed` value that never matched any real post's own hyphenated `tenant-owned-feed` provider id, so selecting it always returned zero results. This specific value mismatch is now moot regardless — Story 6.26 (reviewed below, 03c37c9) replaced the whole hardcoded option list with one derived from real data — so no separate manual note was needed; the current, accurate behavior is already described in both manuals' Posts sections.

## 2026-08-17 — 177de14 — docs: log Provider filter tenant-owned-feed value fix

- **Full commit:** `177de14562aa558ad490fb6eafbc147a4282edc2`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs the Provider filter value fix (reviewed above, 5886a3e).

## 2026-08-17 — ff66d31 — fix(core): shouldAttemptIngestion() allows a bounded probe once ceiling-failing

- **Full commit:** `ff66d311baf94aa1edf370d4f3453a6dbc1fbfa8`
- **Files touched:** docs/adr/0023-proportional-connector-failure-threshold.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/contracts/epic-2/story-2.5.proportional-failure-threshold.contract.test.ts, social-listening-core/src/connectors/connectorHealth.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing manual content needed. Fixes a real circuit-breaker deadlock in `shouldAttemptIngestion()` (a connector that tripped the 20-consecutive-failure ceiling could never poll again, even after its underlying problem — a missing credential — was fixed) by allowing one probe attempt every 15 minutes once failing. This is backend ingestion-reliability behavior with no corresponding screen or user-facing control — a tenant simply sees the connector recover on its own once the underlying cause is fixed, already covered generically by the existing connector-status documentation (health states, consecutive-failure count) in both manuals.

## 2026-08-17 — 6152308 — docs: log ADR-0023 ceiling-recovery healing pass

- **Full commit:** `61523086cb9fe191713ce0223b5ef1da2bd44894`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs the ADR-0023 ceiling-recovery healing pass reviewed immediately above (ff66d31).

## 2026-08-17 — aa4f317 — feat(core): expose body_markdown over GET /v1/posts and GET /v1/posts/:id

- **Full commit:** `aa4f31767a6a59221b27677f4a5bdd3e6d82c66c`
- **Files touched:** social-listening-core/.claude/skills/posts-api/SKILL.md, social-listening-core/contracts/epic-3/story-6.19.post-body-markdown-exposure.contract.test.ts, social-listening-core/src/posts/socialPostStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No separate manual text needed — this is the `social-listening-core` half of Story 6.19 (exposing the already-stored `body_markdown` column over `GET /v1/posts`/`GET /v1/posts/:id`). Not yet user-visible on its own; the admin-side half that actually renders it (4f099a6, reviewed below) is what the manuals cite.

## 2026-08-17 — 4bea1b8 — fix(core): GNews truncation marker has no '+' sign (ADR-0053 Open Q11 resolved)

- **Full commit:** `4bea1b849d0601c6d88c43607d969c5679d930a0`
- **Files touched:** docs/adr/0053-canonical-markdown-post-body-normalization-at-ingestion.md, social-listening-core/contracts/epic-3/story-3.10.canonical-markdown-post-body-normalization.contract.test.ts, social-listening-core/src/connectors/gnews/gnewsConnector.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No separate manual text needed. A real data-accuracy fix (GNews's free-tier truncation marker has no `+` sign — `ADR-0053` Open Question 11 resolved against a real observed article) improving the accuracy of the same `body_markdown` content both manuals' Posts sections already describe as rendered Markdown — not a new capability or screen of its own.

## 2026-08-17 — 00812ac — docs: Implementation Log entries for body_markdown exposure and GNews marker fix

- **Full commit:** `00812ac0b968fef703c833b27337381ca068e943`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs both fixes reviewed immediately above (aa4f317, 4bea1b8).

## 2026-08-17 — 4f099a6 — feat(admin): render post detail body as real Markdown (Story 6.19)

- **Full commit:** `4f099a611faee8383e32d81efacbc97752b4a144`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.19.post-body-markdown-rendering.contract.test.ts, social-listening-admin/jest.config.js, social-listening-admin/package-lock.json, social-listening-admin/package.json, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, user-visible rendering change — documented this pass. Story 6.19's admin half renders `bodyMarkdown` as real, formatted Markdown (via `react-markdown`, never raw HTML) on both the Posts-screen slide-over and the standalone `/tenant/posts/:id` detail route, closing this story out. Both manuals' "Browsing your tenant's posts" sections now describe the detail panel's body as "rendered as real, formatted Markdown."

## 2026-08-17 — 3edfed8 — docs: traceability for Story 6.19 (post body Markdown rendering)

- **Full commit:** `3edfed8271717dd8ff914b4acbdd1e5345d8b533`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 6.19 (reviewed above, aa4f317/4f099a6).

## 2026-08-17 — b837b39 — feat(admin): show detected language and clean the card-list post snippet

- **Full commit:** `b837b390ad7de1a4acf61833f7191649c5022f0c`
- **Files touched:** docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.19.post-body-markdown-rendering.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, user-visible change — documented this pass. Adds the detected language to both post-detail surfaces (already reflected in both manuals' Posts sections: "you'll also see ... the detected language right in the list" / detail panel), and fixes the card-list snippet to show clean, HTML-stripped text (via a bounded, parsed-then-flattened Markdown prefix) instead of raw, un-stripped HTML for Newswire/tenant-owned-feed posts — folded into the existing "title and body preview" wording in both manuals' Posts sections rather than given a separate line, since it's a display-quality correction to an already-documented list, not a new capability.

## 2026-08-17 — b86e518 — docs: Implementation Log entry for language display + card-snippet fix

- **Full commit:** `b86e5184d2b6ec864eb1225a3d580d7bc1291061`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs the language-display and card-snippet fix reviewed immediately above (b837b39).

## 2026-08-17 — 556bb65 — feat(core): expose caller tenant's own seat counts on GET /v1/tenants/users

- **Full commit:** `556bb65a75f501c2062f421ab8c4abd620ac5a15`
- **Files touched:** social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/contracts/epic-1/story-1.9.user-invite-offboard.contract.test.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No separate manual text needed — this is the `social-listening-core` backend prerequisite for the Team & Access redesign reviewed immediately below (1501247): exposes the caller's own tenant `licenseSeatCount`/`activeSeatCount` on `GET /v1/tenants/users`, the real numbers that screen's new seat meter reads.

## 2026-08-17 — 1501247 — feat(admin): redesign the Team & Access screen (/tenant/users)

- **Full commit:** `150124760d4f30c920f173b7fa783739c3901fdc`
- **Files touched:** docs/design/frontend-design-specification.md, social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/users/AccessControl.tsx, social-listening-admin/src/app/tenant/users/AccessHistoryButton.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/components/ui/Modal.tsx, social-listening-admin/src/components/ui/components.test.ts, social-listening-admin/src/components/ui/index.ts, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real UI redesign — documented this pass. The renamed "Team & access" screen (`/tenant/users`) gains a real seat-utilization meter (556bb65's own new data) and a restyled table; the underlying invite/access-control actions are unchanged. Both manuals' user-management sections were retitled "Managing your tenant's users — Team & access (Story 6.8, redesigned 2026-08-17)" / "Viewing your tenant's users — Team & access," with the seat meter described and every reference to "Tenant Users" elsewhere in each manual (e.g. the Same-Domain Invite Assist link target) updated to the real current screen name.

## 2026-08-17 — 145d38c — docs: traceability for seat-counts enhancement and Team & Access redesign

- **Full commit:** `145d38c2cf4cbe56b4a983b209cb3cf252c14abd`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs the seat-counts enhancement and Team & Access redesign reviewed immediately above (556bb65, 1501247).

## 2026-08-17 — 0a1db2d — docs: draft ADR-0057 (tenant-owned-feed multi-feed administration)

- **Full commit:** `0a1db2d5461ad058af60de7eea7cfa546f3c5409`
- **Files touched:** docs/adr/0057-tenant-owned-feed-multi-feed-administration.md, docs/adr/README.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — drafts ADR-0057 (tenant-owned-feed multi-feed administration), correctly left undocumented per this role's hard rule against documenting the roadmap; nothing built yet at this commit.

## 2026-08-17 — 249402a — style(admin): widen the main content container from 900px to 1280px

- **Full commit:** `249402afba999f079b60bd9becdf1b7328dfe764`
- **Files touched:** social-listening-admin/src/app/globals.css
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real but purely cosmetic UI change — documented briefly, not with its own section. Widens the main content container from 900px to 1280px; no screen's behavior changed. Both manuals' "Current coverage" notes now mention this alongside the existing 2026-08-12 stylesheet note.

## 2026-08-17 — 114d94f — docs: revise ADR-0057 against an external review (4 points, checked)

- **Full commit:** `114d94f89f4447aec0766e944115ebcd6e0333fd`
- **Files touched:** docs/adr/0057-tenant-owned-feed-multi-feed-administration.md, docs/adr/README.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — revises ADR-0057 against external review, still a draft ADR at this commit, nothing built yet.

## 2026-08-17 — bae1277 — docs: accept ADR-0056 and ADR-0057; draft Story 6.20

- **Full commit:** `bae127715fe0159194e1f5361e3cc893a516a22c`
- **Files touched:** docs/adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md, docs/adr/0057-tenant-owned-feed-multi-feed-administration.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — accepts ADR-0056 and ADR-0057 and drafts Story 6.20. Acceptance and a Ready story are not yet shipped capability; nothing to document until Story 6.20 itself ships (reviewed below, e9d797f/be1764d).

## 2026-08-17 — 2acee9b — chore(admin): delete dead analytics prototype/demo code

- **Full commit:** `2acee9b15465f609319a3317ef5e6e603f05cc63`
- **Files touched:** social-listening-admin/src/lib/mockData.ts, social-listening-admin/src/lib/types.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — confirmed directly, not assumed from the commit's own "cleanup" framing. Deletes four confirmed-dead files (`mockData.ts`, `types.ts`, and the untracked `SentimentDashboardTab.tsx`/`ConversationsDashboardTab.tsx` prototype siblings) that were never imported anywhere in the real, shipped Analytics Dashboard — `AnalyticsClient.tsx` has only ever imported the real `OverviewTab`/`SentimentTab`/`ConversationsTab`/`SourcesTab.tsx` files this manual's own Analytics section already documents. No real screen or capability was removed.

## 2026-08-17 — bd126c8 — docs(admin): lock in the dead-analytics-code deletions with contract checks

- **Full commit:** `bd126c82da94343112cb31143806b60a4e16127e`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — completes the same dead-code cleanup reviewed immediately above (2acee9b) with the contract-test/SKILL.md updates a failed multi-path `git add` had dropped from that commit; no code behavior of its own.

## 2026-08-17 — fc41590 — docs: Implementation Log entry for dead analytics code cleanup

- **Full commit:** `fc415904debaaccc9ff8f4204b6025c774b155cc`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs the dead-analytics-code cleanup reviewed above (2acee9b, bd126c8).

## 2026-08-17 — e9d797f — feat(core): tenant-owned-feed multi-feed administration (Story 6.20, core half)

- **Full commit:** `e9d797f64f67984fcb88985d0076ff21ab070d30`
- **Files touched:** social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.11.tenant-owned-feed-connector.contract.test.ts, social-listening-core/contracts/epic-2/story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts, social-listening-core/migrations/0031_add_removed_status_to_tenant_owned_feed_activations.sql, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts, social-listening-core/src/http/versions/v1/tenantOwnedFeedRouter.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No separate manual text needed — this is the `social-listening-core` backend half of Story 6.20 (three new `tenant_admin`-only REST endpoints: list/edit/remove a tenant-owned-feed activation, plus a domain-reuse auto-verify path, plus a new, previously-absent `tenant_admin` role gate on `connect`/`verify-domain`). The user-facing effect — including the significant correction that this whole flow is now Tenant-Admin only — is documented together with the admin half reviewed immediately below (be1764d).

## 2026-08-17 — be1764d — feat(admin): tenant-owned-feed multi-feed administration (Story 6.20, admin half)

- **Full commit:** `be1764d002bec66d5dac71d33c49b108c07f47ee`
- **Files touched:** social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.17.tenant-owned-feed-activation-control.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/[id]/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, substantial UI change with a real capability correction — documented this pass, and it's the highest-value single finding of this review pass. Story 6.20 replaces the old single-activation tenant-owned-feed screen with a real multi-feed admin list (edit feed URL, remove a feed, persistent DNS TXT details across reloads) — **and, confirmed directly against `tenantOwnedFeedRouter.ts`, every one of `connect`/`verify-domain`/the new `GET .../activations` list/`PATCH`/`DELETE` now requires `identity.role === 'tenant_admin'`, including the list endpoint itself.** This reverses what both manuals previously said (Story 6.12/6.17: "Both a Tenant-Admin and a Tenant User can set this up"), which was accurate only up to 2026-08-17. `docs/manuals/tenant-admin-manual.md`'s "Monitoring your own company domain's content feed" section was rewritten in full (multi-feed list, edit/remove, persistent TXT details, and a prominent "Corrected 2026-08-17" note explaining the tightening); `docs/manuals/user-manual.md`'s equivalent section was replaced with a short "Your organization's own company domain content feed (Story 6.12, corrected 2026-08-19)" note stating plainly this is now Tenant-Admin only, and the capability was removed from that manual's own "Current coverage" list and added to its "What's not built yet" list instead.

## 2026-08-17 — b05f317 — docs: traceability for Story 6.20 (tenant-owned-feed multi-feed administration)

- **Full commit:** `b05f3171003cc31acf6cb6378c99d0d18dc7f3b5`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 6.20 (reviewed above, e9d797f/be1764d).

## 2026-08-17 — 3ef32ad — feat(story-5.19): wire SocialPostIngestedEvent/ConnectorHealthChangedEvent publishing into the real ingestion pipeline

- **Full commit:** `3ef32adab7d6b19cb88c375fa45127cf965192bb`
- **Files touched:** docs/adr/0058-wire-ingestion-events-into-real-connector-pipeline.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/ingestion-events/SKILL.md, social-listening-core/contracts/epic-5/story-5.19.wire-ingestion-events.contract.test.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/events/publishSocialPostIngestedEvents.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts, social-listening-core/src/watchlists/watchlistStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change. Story 5.19 wires real `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` publishing into the live ingestion pipeline (Service Bus) — a backend integration event stream with no corresponding screen, control, or visible behavior change for any tenant identity. Nothing in either manual describes Service Bus events, correctly.

## 2026-08-17 — 8ee53d9 — docs: implementation log entry for Story 5.19

- **Full commit:** `8ee53d9dbd625aa2cf97cd6b08fa7c4cabe58ef1`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-5-security-isolation-and-messaging.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 5.19 (reviewed above, 3ef32ad).

## 2026-08-17 — 591b0b8 — feat(story-2.13): Wikipedia connector — MediaWiki Action API, revision re-poll via recentchanges, article-as-Author

- **Full commit:** `591b0b8bb8c15d2b45ddaacda15f3eec000ea292`
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/.claude/skills/wikipedia-connector/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts, social-listening-core/contracts/epic-2/story-2.13.wikipedia-connector.contract.test.ts, social-listening-core/src/authors/authorStore.ts, social-listening-core/src/connectors/bootstrapConnectors.ts, social-listening-core/src/connectors/wikipedia/pollWikipedia.ts, social-listening-core/src/connectors/wikipedia/wikipediaConnector.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change yet at this commit. Story 2.13 builds the real Wikipedia connector (MediaWiki Action API, revision re-poll, article-as-Author) in `social-listening-core`, but confirmed directly (and later confirmed live by Menno himself, per Story 6.21's own Implementation Log entry): no screen anywhere in `social-listening-admin` listed Wikipedia yet, so the connector was invisible in the actual product despite existing and working on the backend. Documented once it became reachable (Story 6.21, reviewed below, 21c30bf).

## 2026-08-17 — e7055db — docs: implementation log entry for Story 2.13

- **Full commit:** `e7055db18ba7903372a0f71c2b1abb319929a5dc`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 2.13 (reviewed above, 591b0b8).

## 2026-08-17 — 21c30bf — feat(story-6.21): expose the Wikipedia connector in the Tenant Admin UI

- **Full commit:** `21c30bf64d19b31ae7a7e2c21798220ff38566d3`
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.21.wikipedia-connector-ui.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, shipped new UI surface — documented this pass. Story 6.21 adds Wikipedia as a connectable, activatable platform on the Connect a platform and Connector status screens (no credential needed, tenant-wide only) — closing the exact "invisible in the product" gap named above (591b0b8). Both manuals' "Connecting a platform" and "Checking connector status" sections now list Wikipedia among the real supported platforms.

## 2026-08-17 — ce4c2fa — docs: implementation log entry for Story 6.21

- **Full commit:** `ce4c2fac261030a27db7bc1c189d051b9476f2fd`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 6.21 (reviewed above, 21c30bf).

## 2026-08-17 — fd6cdb3 — Design principals with Gemini Building a new frontend

- **Full commit:** `fd6cdb3a04b67d4237f93dfb65321a2d5d04c97d`
- **Files touched:** docs/design/Gemini Designs/.env.example, docs/design/Gemini Designs/.gitignore, docs/design/Gemini Designs/README.md, docs/design/Gemini Designs/index.html, docs/design/Gemini Designs/metadata.json, docs/design/Gemini Designs/package-lock.json, docs/design/Gemini Designs/package.json, docs/design/Gemini Designs/src/App.tsx, docs/design/Gemini Designs/src/components/ExportModal.tsx, docs/design/Gemini Designs/src/components/FilterBar.tsx, docs/design/Gemini Designs/src/components/FlyoutNav.tsx, docs/design/Gemini Designs/src/components/PostsPane.tsx, docs/design/Gemini Designs/src/components/SubTabs.tsx, docs/design/Gemini Designs/src/components/TopBar.tsx, docs/design/Gemini Designs/src/components/views/ActivityMapView.tsx, docs/design/Gemini Designs/src/components/views/AlertsView.tsx, docs/design/Gemini Designs/src/components/views/AuthViews.tsx, docs/design/Gemini Designs/src/components/views/ConversationsView.tsx, docs/design/Gemini Designs/src/components/views/LocationView.tsx, docs/design/Gemini Designs/src/components/views/OverviewView.tsx, docs/design/Gemini Designs/src/components/views/PostDetailView.tsx, docs/design/Gemini Designs/src/components/views/SearchSetupView.tsx, docs/design/Gemini Designs/src/components/views/SentimentView.tsx, docs/design/Gemini Designs/src/components/views/SettingsView.tsx, docs/design/Gemini Designs/src/components/views/SocialCenterView.tsx, docs/design/Gemini Designs/src/components/views/SourcesView.tsx, docs/design/Gemini Designs/src/data/mockData.ts, docs/design/Gemini Designs/src/index.css, docs/design/Gemini Designs/src/main.tsx, docs/design/Gemini Designs/src/types.ts, docs/design/Gemini Designs/tsconfig.json, docs/design/Gemini Designs/vite.config.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — a design-reference artifact only ("Design principles with Gemini, building a new frontend"), not shipped, contract-verified code. Correctly omitted from every manual per this role's hard rule against documenting the roadmap or a design preview.

## 2026-08-17 — 2317c60 — The latest round of fronbend designs with Google AI Stduio App builder. Latest brainstorm sessions and the reworks of the frontend designs

- **Full commit:** `2317c60d7f23d90f96a3fb20dd8304ed4fcd1961`
- **Files touched:** docs/design/Google AI Studio/.env.example, docs/design/Google AI Studio/.gitignore, docs/design/Google AI Studio/README.md, docs/design/Google AI Studio/bun.lock, docs/design/Google AI Studio/index.html, docs/design/Google AI Studio/metadata.json, docs/design/Google AI Studio/package-lock.json, docs/design/Google AI Studio/package.json, docs/design/Google AI Studio/server.ts, docs/design/Google AI Studio/src/App.tsx, docs/design/Google AI Studio/src/components/ActivateDeactivateButton.tsx, docs/design/Google AI Studio/src/components/AnimatedChartTooltip.tsx, docs/design/Google AI Studio/src/components/ConfirmModal.tsx, docs/design/Google AI Studio/src/components/ConversationsDashboardTab.tsx, docs/design/Google AI Studio/src/components/D3SentimentGauge.tsx, docs/design/Google AI Studio/src/components/D3Sparkline.tsx, docs/design/Google AI Studio/src/components/D3TrendingTopicsChart.tsx, docs/design/Google AI Studio/src/components/EmptyState.tsx, docs/design/Google AI Studio/src/components/GlobalDateRangePicker.tsx, docs/design/Google AI Studio/src/components/InlineError.tsx, docs/design/Google AI Studio/src/components/LocationDashboardTab.tsx, docs/design/Google AI Studio/src/components/RelativeTime.tsx, docs/design/Google AI Studio/src/components/RunEnrichmentButton.tsx, docs/design/Google AI Studio/src/components/SentimentDashboardTab.tsx, docs/design/Google AI Studio/src/components/Sidebar.tsx, docs/design/Google AI Studio/src/components/Slideover.tsx, docs/design/Google AI Studio/src/components/SourcesDashboardTab.tsx, docs/design/Google AI Studio/src/components/StatusBadge.tsx, docs/design/Google AI Studio/src/components/TagInput.tsx, docs/design/Google AI Studio/src/components/TopBar.tsx, docs/design/Google AI Studio/src/context/AppContext.tsx, docs/design/Google AI Studio/src/index.css, docs/design/Google AI Studio/src/lib/store.ts, docs/design/Google AI Studio/src/main.tsx, docs/design/Google AI Studio/src/types/index.ts, docs/design/Google AI Studio/src/views/AdminConnectorsView.tsx, docs/design/Google AI Studio/src/views/AdminOverviewView.tsx, docs/design/Google AI Studio/src/views/AdminTenantsView.tsx, docs/design/Google AI Studio/src/views/AnalyticsDashboardView.tsx, docs/design/Google AI Studio/src/views/ConnectorStatusView.tsx, docs/design/Google AI Studio/src/views/ConnectorsView.tsx, docs/design/Google AI Studio/src/views/InviteAssistView.tsx, docs/design/Google AI Studio/src/views/PostsFeedView.tsx, docs/design/Google AI Studio/src/views/SignInView.tsx, docs/design/Google AI Studio/src/views/SignUpView.tsx, docs/design/Google AI Studio/src/views/SignedOutView.tsx, docs/design/Google AI Studio/src/views/SocialConnectorDetailsView.tsx, docs/design/Google AI Studio/src/views/TeamAccessView.tsx, docs/design/Google AI Studio/src/views/TenantDashboardView.tsx, docs/design/Google AI Studio/src/views/TenantDeleteView.tsx, docs/design/Google AI Studio/src/views/TenantOwnedFeedView.tsx, docs/design/Google AI Studio/src/views/TenantSettingsView.tsx, docs/design/Google AI Studio/src/views/WatchlistsView.tsx, docs/design/Google AI Studio/tsconfig.json, docs/design/Google AI Studio/vite.config.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — another design-reference artifact only (Google AI Studio App Builder frontend explorations), not shipped code. Same treatment as fd6cdb3 immediately above: correctly omitted from every manual.

## 2026-08-17 — c802b64 — feat(story-2.14): Wikipedia discovery search driven by the tenant's own watchlist terms

- **Full commit:** `c802b64ab2160d8a640ce7249655554201129630`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/wikipedia-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.14.wikipedia-watchlist-driven-discovery.contract.test.ts, social-listening-core/src/connectors/wikipedia/pollWikipedia.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No separate manual text needed. Story 2.14 fixes Wikipedia discovery to search each tenant's own active watchlist terms rather than a shared hardcoded literal ("Anthropic") — a real correctness fix to which articles get discovered, not a new screen or control. The watchlist-driven behavior this fix guarantees is exactly what both manuals' "Managing watchlists" sections already describe generically (a watchlist's own terms drive what's matched); no separate line needed.

## 2026-08-17 — 8ed1e7b — docs: implementation log entry for Story 2.14

- **Full commit:** `8ed1e7b06ddd3558da5720455e4a663f10b56296`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 2.14 (reviewed above, c802b64).

## 2026-08-18 — 8182706 — feat(story-6.22): add Wikipedia to the watchlist screen's platform-source list

- **Full commit:** `8182706d5f57a8fcc9ad8f5d680ec4c6e9fbc402`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/watchlist-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.22.wikipedia-watchlist-platform-source.contract.test.ts, social-listening-admin/src/app/tenant/watchlists/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, user-visible UI change — documented this pass. Story 6.22 adds Wikipedia to the Manage watchlists screen's own separate platform list (`SOCIAL_PLATFORMS`), closing a second, distinct instance of the same hardcoded-list gap Story 6.21 had already fixed on the Connect a platform screen — found live when Menno tried to point a watchlist at Wikipedia and couldn't. Both manuals' "Managing watchlists" sections now name Wikipedia as a selectable platform (Story 6.22).

## 2026-08-18 — 14ada1b — docs: implementation log entry for Story 6.22

- **Full commit:** `14ada1bbd9f235d87e9d16e5d63bf1d9d3cc40e2`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 6.22 (reviewed above, 8182706).

## 2026-08-18 — 3fedac3 — fix(story-2.16): azureAiLanguageConnector throws classified error on rejected document

- **Full commit:** `3fedac3ce1436b0e3384bd1d4acfa3d56c35fcdb`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.16.azure-ai-language-classified-document-error.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/azureAiLanguageConnector.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing manual content needed. Fixes a real, silent enrichment failure (Azure AI Language threw an unclassified `TypeError` on an oversized document — every real Wikipedia post's own enrichment attempt — rather than failing over cleanly) found while investigating why Wikipedia posts had zero enrichment. The tenant-visible symptom this fixes (Wikipedia posts falling back to Azure OpenAI enrichment, or none, rather than silently erroring) isn't a distinct, describable screen behavior — it's covered by the existing, honest "enrichment is best-effort" framing already implicit in both manuals' "Running enrichment manually" sections; no new claim was added.

## 2026-08-18 — 38c3e51 — docs(story-2.16): implementation log entry and Built field

- **Full commit:** `38c3e513ec3ac1345c839a7efdfe54c70bf6d31d`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs the Story 2.16 fix reviewed immediately above (3fedac3).

## 2026-08-18 — 6a9b628 — feat(story-2.17): Azure OpenAI structured enrichment gains a summary field

- **Full commit:** `6a9b62856c6a2349182ec4c9ad7cf1ac8804e29e`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.17.azure-openai-summary-field.contract.test.ts, social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts, social-listening-core/src/connectors/types.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change yet — confirmed directly against the real `social-listening-admin` source (`postDisplay.ts` and every screen that reads `PostEnrichmentSummary`), not assumed. Story 2.17 adds a real `summary` field to Azure OpenAI's own structured enrichment output, but nothing in `social-listening-admin` reads or renders `enrichment.summary` anywhere — zero matches on a repo-wide grep. Named as a real, honest gap in both manuals' "What's not built yet" sections ("A concise AI-generated summary field ... no screen displays it yet") rather than described as a working feature.

## 2026-08-18 — 28090fe — docs(story-2.17): implementation log entry and Built field

- **Full commit:** `28090fe65741767dc9550b3bc3e433b75f9c6bb1`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 2.17 (reviewed above, 6a9b628).

## 2026-08-18 — 6550716 — feat(story-6.25): post feed shows most-recently-ingested posts first

- **Full commit:** `65507164bac4ef7fdfb48d82627a940670b39155`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.25.post-feed-newest-first.contract.test.ts, social-listening-admin/src/app/tenant/posts/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, user-visible behavior change — documented this pass. Story 6.25 reverses the Posts screen's display order to newest-ingested-first (previously oldest-first, since the backend's own `GET /v1/posts` pagination is oldest-first by design and was never reversed for display) — a client-side reversal of the already-fully-fetched post array, no backend pagination change. Both manuals' "Browsing your tenant's posts" sections now open with "**newest-ingested first** (Story 6.25)."

## 2026-08-18 — 05d9ee0 — docs(story-6.25): implementation log entry and Built field

- **Full commit:** `05d9ee02fbade63b466ee3025aa50b33166b7adb`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 6.25 (reviewed above, 6550716).

## 2026-08-18 — 03c37c9 — feat(story-6.26): post feed's Provider filter derives its options from real data

- **Full commit:** `03c37c91c3ffabfd69c15bb7339abf9b2e77d8fd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.25.post-feed-newest-first.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.26.post-feed-dynamic-provider-filter.contract.test.ts, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, user-visible change — documented this pass. Story 6.26 makes the Posts screen's Provider filter derive its options from whichever providers the tenant's own real posts actually contain, rather than a hardcoded three-option list that had already gone stale once Wikipedia posts started arriving with nowhere to filter by them. Both manuals' "Browsing your tenant's posts" sections now describe the Provider filter as automatically including every platform the tenant actually has posts from (Story 6.26).

## 2026-08-18 — 42e693f — docs(story-6.26): implementation log entry and Built field

- **Full commit:** `42e693f763cb36581bd2a0b145bf5c02b7295c6d`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 6.26 (reviewed above, 03c37c9).

## 2026-08-18 — 50a5914 — feat(story-2.15): Facebook connector -- tenant's own Page, Tier 3 credential

- **Full commit:** `50a5914641dcd9fc03d424f0994555b6389d8a0b`
- **Files touched:** docs/environment-gotchas.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/.claude/skills/facebook-connector/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-2/story-2.15.facebook-connector.contract.test.ts, social-listening-core/migrations/0032_add_ingestion_runs_credential_failure_flag.sql, social-listening-core/src/connectors/bootstrapConnectors.ts, social-listening-core/src/connectors/connectorHealth.ts, social-listening-core/src/connectors/facebook/facebookConnector.ts, social-listening-core/src/connectors/facebook/pollFacebook.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts, social-listening-core/src/http/versions/v1/facebookOAuthRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/ingestion/ingestionRunStore.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change yet at this commit. Story 2.15 builds the real Facebook connector in `social-listening-core` (OAuth, a tenant's own connected Page's own posts only, Tier 3/personal-only credential) — but no screen in `social-listening-admin` offered any way to actually connect it until Story 6.23 (reviewed below, 535338f). Documented once it became reachable.

## 2026-08-18 — caf50ed — docs(story-2.15): implementation log entry and Built field

- **Full commit:** `caf50ed7c77659ecdc5ae373b6c98c4833889c13`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 2.15 (reviewed above, 50a5914).

## 2026-08-18 — 838e3dc — feat(story-1.14): poll scheduler skips a pair whose most recent run is still running

- **Full commit:** `838e3dc0adbd8e4a0330b132f2871e08128e2b23`
- **Files touched:** docs/adr/0052-live-ingestion-polling-scheduler.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/live-ingestion-polling-scheduler/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-1/story-1.14.poll-scheduler-skip-in-flight.contract.test.ts, social-listening-core/src/ingestion/ingestionRunStore.ts, social-listening-core/src/scheduler/pollScheduler.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing manual content needed. Story 1.14 closes a real scheduler gap (two overlapping polls of the same connector could both start before the first one finished, especially for Wikipedia's own long-running batches) found while investigating a live "duplicate posts" report from Menno — the investigation itself found no actual duplicate rows, just legitimate rapid-edit noise, but did find and fix the real overlap risk underneath it. This is backend scheduling reliability with no corresponding screen or control; already covered generically by the existing "polls automatically in the background" framing in both manuals' Posts sections.

## 2026-08-18 — 3ce8db2 — docs(story-1.14): implementation log entry and Built field

- **Full commit:** `3ce8db2005d1e2b794101fb63c0c2049d584c0af`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-1-repository-and-api-foundation.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 1.14 (reviewed above, 838e3dc).

## 2026-08-18 — 535338f — feat(story-6.23): Facebook OAuth connect flow with Page selection

- **Full commit:** `535338ff3dac36738d0240fb0d4994ec2d478e3f`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/.env.example, social-listening-admin/contracts/epic-6/story-6.21.wikipedia-connector-ui.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.23.facebook-oauth-connect-flow.contract.test.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/callback/route.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/pending/route.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/select-page/route.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/start/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/ConnectorStatusClient.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/components/ui/StatusBadge.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/facebookOAuth.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** Real, shipped new UI surface — documented this pass. Story 6.23 builds the real Facebook OAuth connect flow: a redirect to Facebook's own sign-in, a Page picker for anyone managing more than one, activation, and a distinct "Reconnect required" status when Facebook revokes the connection — this project's first OAuth-based connector and first Tier-3(personal)-only one. A new "Connecting your own Facebook Page (Story 6.23)" section was added to both `docs/manuals/tenant-admin-manual.md` and `docs/manuals/user-manual.md` (reachable by both roles, confirmed directly against `ConnectorsClient.tsx`'s `personalScopeAllowed: true`/`tenantScopeAllowed: false` for the `facebook` platform entry), plus the "Checking connector status" sections' new mention of the Reconnect-required state. The real, named gaps this story itself documents (no Disconnect control, the connected Page's own name cached only in a browser cookie) are carried into both manuals' own limitation notes and "What's not built yet" lists.

## 2026-08-18 — f6a1794 — docs(story-6.23): implementation log entry and Built field

- **Full commit:** `f6a179406e217330ae5616f474f6ebeb8b656efc`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — logs Story 6.23 (reviewed above, 535338f).

## 2026-08-18 — 7c0572c — docs: ADR-0059/0060/0061 acceptance and Story 6.27/1.15 governance update

- **Full commit:** `7c0572c1dcabc8a0401e10d180955430b5a185d7`
- **Files touched:** docs/adr/0059-facebook-connector-tenant-owned-page-scope-organization-as-author.md, docs/adr/0060-facebook-connector-multiple-pages-per-user.md, docs/adr/0061-tier-3-poll-scheduler-per-user-enumeration.md, docs/adr/README.md, docs/open-decisions.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-19 (Learning & Development Writer):** No user-facing change — accepts ADR-0059/0060/0061 (the last of these three, the Facebook connector ADR, documents a decision already reflected in the shipped Story 6.23 reviewed above; the other two — multiple connected Pages per user, Tier-3 per-user poll scheduling — are accepted decisions with no story built against them yet) and updates Story 6.27/1.15 governance bookkeeping. Acceptance and a drafted/Ready story are not yet shipped, contract-verified capability — correctly nothing added to either manual on this commit's own account.

## ~~2026-08-19 — 6080795 — Scheduled doc review: 2026-08-19 — clear 81-entry backlog across all three review queues~~

- **Full commit:** `608079561c17597c1bfec604ae57551b2e21a148`
- **Files touched:** CLAUDE.md, README.md, docs/implementation-plan.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/project docs/Project Management Plans/Delivery-Management-Plan.md, docs/project docs/Project Management Plans/Integration-Management-Plan.md, docs/project docs/Project Management Plans/Measurement-Management-Plan.md, docs/project docs/Project Management Plans/Project-Work-Management-Plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-6-tenant-admin-ui.md, docs/user-stories/epic-8-analytics-dashboard.md, social-listening-core/.claude/skills/ingestion-events/SKILL.md, social-listening-core/.claude/skills/live-ingestion-polling-scheduler/SKILL.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** This is this very role's own prior scheduled pass — its own commit message confirms real, substantial updates to both `docs/manuals/tenant-admin-manual.md` and `docs/manuals/user-manual.md` (Wikipedia/Facebook connectors, AI-provider personal-scope restriction, Story 6.14 access history, Team & Access redesign, post feed changes, the new Analytics dashboard, and a real correction reversing a prior claim about tenant-owned-feed monitoring's own tenant-admin-only scope). Spot-checked against current manual text — all named additions are present and accurate. Nothing further to add on this commit's own account; Story 6.24 (AI-provider grouping on the connector status screen), built the next day and still undocumented in either manual, is a real gap but stems from a later, unqueued commit — see the `17c563b` cross-reference in this pass's own Documentation Steward queue entry for the underlying hook-gap finding, not repeated here.

## ~~2026-08-19 — 2c00920 — feat(docs): draft ADR-0062 — Analytics Dashboard Overview Tab Enhancement~~

- **Full commit:** `2c00920ee0755b4caf32b895e20b09bc6ed99c31`
- **Files touched:** docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/adr/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — drafts ADR-0062 (Analytics Dashboard Overview Tab Enhancement), Proposed only; Stories 8.7/8.8 drafted alongside, both Blocked. No code shipped, nothing to document until built and the ADR is accepted.

## ~~2026-08-19 — 67c546f — chore: post-commit hook outputs for ADR-0062 commit (2c00920)~~

- **Full commit:** `67c546f0ddcf7125c6860a304db1b711600712a6`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, scripts/git-hooks/post-commit, scripts/git-hooks/pre-commit
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — queue/time-log bookkeeping plus an internal hook touch-up, no product code or UI touched.

## ~~2026-08-19 — 48f5cf3 — docs(adr-0062): replace selectedTopic with activeWatchlistFilter~~

- **Full commit:** `48f5cf3690c6f4d65175d148c8144f34e3495694`
- **Files touched:** docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — an in-place ADR-0062 revision (still Proposed) and matching Story 8.7 AC update. No code shipped.

## ~~2026-08-19 — a5d0036 — chore: post-commit hook outputs for activeWatchlistFilter revision (48f5cf3)~~

- **Full commit:** `a5d003631df657b9e89aeddbb17563de93faa7b0`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — queue/time-log bookkeeping.

## ~~2026-08-19 — 23a6dca — chore: post-commit hook outputs for a5d0036~~

- **Full commit:** `23a6dcaca33d4d084bfb5baec261416c406d9caa`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — queue/time-log bookkeeping.

## ~~2026-08-19 — 2f605b6 — docs(adr): draft ADR-0063 — post_watchlist_matches junction table and GET /v1/posts?watchlistId server-side filter~~

- **Full commit:** `2f605b667a26863f31dd28c7fa1d787c8b9471db`
- **Files touched:** docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md, docs/adr/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — drafts ADR-0063 (Proposed only), Story 3.11/8.9 drafted alongside, both Blocked. No backend or UI code shipped.

## ~~2026-08-19 — 59356e6 — chore: post-commit hook outputs for 2f605b6~~

- **Full commit:** `59356e60f2db66ec365cf7490059cc310a0e322d`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — queue/time-log bookkeeping.

## ~~2026-08-19 — 6f25f17 — chore: post-commit hook outputs for 59356e6~~

- **Full commit:** `6f25f171c9700b084988ff5339bcd844f7a59661`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — queue/time-log bookkeeping.

## ~~2026-08-19 — 6eb6062 — docs(adr): block selectedTopic/Watchlist on ADR-0063 in ADR-0062, Story 8.7, Story 8.9~~

- **Full commit:** `6eb6062b192135f8950e807ecb1d4e07c7360de2`
- **Files touched:** docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — a further in-place ADR-0062 revision (still Proposed) per Menno's own direction, plus matching Story 8.7/8.9 AC rewrites. No code shipped.

## ~~2026-08-19 — 24adf6c — chore: post-commit hook outputs for 6eb6062~~

- **Full commit:** `24adf6c546ffe6b108891ea52144bea41e3d7ba4`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — queue/time-log bookkeeping.

## ~~2026-08-19 — c1d6a44 — chore: post-commit hook outputs for 24adf6c~~

- **Full commit:** `c1d6a44f4ff89a6dc83cf509ff3f7105feaf6041`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — queue/time-log bookkeeping.

## ~~2026-08-19 — 17c563b — docs(adr): accept ADR-0063; move Story 3.11 to Ready~~

- **Full commit:** `17c563b71264e47a833fded1df66facaa34ced98`
- **Files touched:** docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md, docs/adr/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — accepts ADR-0063 and moves Story 3.11 to Ready; Story 8.9 remains Blocked pending Story 3.11's own implementation and Story 8.7's own build. Acceptance and a Ready story are not yet shipped, contract-verified capability — correctly nothing to document on this commit's own account. (This project's Documentation Steward pass the same day found and corrected a real traceability gap this ADR-0062/0063 drafting saga left in `docs/user-stories/README.md`/`docs/implementation-plan.md` — outside this role's own manual-only scope, not repeated here.)

## ~~2026-08-19 — 31af056 — chore: post-commit hook outputs for 17c563b~~

- **Full commit:** `31af056e5b52958cbf0eceb884f03aa1ce6eb1b1`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** ~~Pending review~~
- **Resolved 2026-08-20 (Learning & Development Writer):** No user-facing change — queue/time-log bookkeeping.

## 2026-08-20 — 532e713 — Scheduled doc review: 2026-08-20 — clear 14-entry backlog across all three review queues

- **Full commit:** `532e7134a7e254fcf70fbbfa6d6cb3bc3ffe1977`
- **Files touched:** docs/implementation-plan.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/user-stories/README.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — this is a prior scheduled review pass's own governance/queue-clearing commit (traceability-table and Epics-table corrections plus review-queue bookkeeping), not product code. Confirmed the L&D Writer's own review recorded in this commit's body was accurate at the time.

## 2026-08-20 — d5ef459 — chore: post-commit hook outputs for 532e713

- **Full commit:** `d5ef4597f396b559dd9d75c9a6df6bdb6a5c179f`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure post-commit-hook bookkeeping output (time-tracking + review queues only).

## 2026-08-20 — d4c8ca0 — chore: post-commit hook outputs for d5ef459

- **Full commit:** `d4c8ca0b276fadee003b8f407c3a9df87a08a144`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure post-commit-hook bookkeeping output.

## 2026-08-20 — 6673537 — fix(post-commit hook): stop the queue files from re-queuing their own bookkeeping commits

- **Full commit:** `66735370992a4a48420236e90a5b97ddf339ed8c`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, scripts/git-hooks/post-commit
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — a fix to the internal `post-commit` git hook's own self-referential re-queuing behavior. Affects how this and the other two AI-role queues get populated, not anything a `platform_admin`/`tenant_admin`/`tenant_user` session can see or do.

## 2026-08-19 — 5d3ec45 — Writen the ADRs 0064 0065 0066 0067 0068 0069

- **Full commit:** `5d3ec452c00b3c2af73303387aee6f4c00d7723b`
- **Files touched:** docs/adr/0064-location and geospatial insights from posts and authors.md, docs/adr/0065-active-watchlist-sourcing-via-brave-search-api.md, docs/adr/0066-active-watchlist-sourcing-via-bing-search-api.md, docs/adr/0067-reconfirm-facebook-connector, docs/adr/0068-instagram-connector, docs/adr/0069-linkedin-connector, docs/design/Google AI Studio/server.ts, docs/design/frontend-design-future-devs.md, docs/project docs/Spark-Capture-AI-Provider-Model-Agnosticism.md, docs/project docs/Spark-Capture-Service-Bus-Purposeful-Downstream-Subscriptions.md, social-listening-admin/next-env.d.ts, social-listening-core/.claude/skills/post-watchlist-match-persistence/SKILL.md, social-listening-core/contracts/epic-3/story-3.11.post-watchlist-match-persistence.contract.test.ts, social-listening-core/migrations/0036_create_post_watchlist_matches.sql, social-listening-core/src/events/publishSocialPostIngestedEvents.ts, social-listening-core/src/http/versions/v1/postsRouter.ts, social-listening-core/src/posts/socialPostStore.ts, social-listening-core/src/watchlists/postWatchlistMatchStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No new manual-facing capability shipped in this commit itself. The bulk of it is drafting six new, not-yet-built ADRs (0064 Location/Geospatial, 0065 Brave Search, 0066 Bing Search, 0067 Facebook reconfirm, 0068 Instagram, 0069 LinkedIn) — none of these are built connectors or screens yet, so none belong in a manual. This commit also (per its own mis-labeled commit message, confirmed against `docs/implementation-log.md`'s own 2026-08-19 healing-pass entry) happened to contain the bulk of Story 3.11's real backend implementation — `GET /v1/posts?watchlistId=` — but that endpoint has no admin-UI consumer of its own until Story 8.9's Analytics widget ships (reviewed separately below, `605e5a4`); nothing to document from this commit standing alone.

## 2026-08-19 — 63902a1 — fix: Story 3.11 heal — post_watchlist_matches FK conflict, ambiguous-column JOIN bug, fixture typo

- **Full commit:** `63902a11b3c2c83f3db8077ac0944440e6f1daa9`
- **Files touched:** docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/post-watchlist-match-persistence/SKILL.md, social-listening-core/contracts/epic-3/story-3.11.post-watchlist-match-persistence.contract.test.ts, social-listening-core/migrations/0036_create_post_watchlist_matches.sql, social-listening-core/src/posts/socialPostStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change of its own — a `social-listening-core` backend healing pass (schema FK fix, an ambiguous-column bug fix on `GET /v1/posts?watchlistId=`, a fixture typo) with no admin-UI screen. This backend endpoint is what Story 8.9's Watchlist Coverage widget and topic selector later consume — documented there (`605e5a4`, below) once a real screen exists.

## 2026-08-19 — 6e6755e — docs: implementation log entry for Story 3.11 healing pass

- **Full commit:** `6e6755e8693a8708414a0b734f36374629fe320f`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — only appends the Implementation Log entry for the Story 3.11 healing pass (`63902a1`), reviewed separately above.

## 2026-08-19 — 1d550a1 — docs: methodology amendment — epic-scoped local validation, CI as the unconditional full-suite gate

- **Full commit:** `1d550a1c8d749e634af4b065199d8303496763ce`
- **Files touched:** .claude/skills/heal-contract-failure/SKILL.md, .claude/skills/implement-story/SKILL.md, CLAUDE.md, docs/implementation-log.md, docs/implementation-methodology.md, docs/templates/ci-workflow.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — an internal process/tooling amendment (epic-scoped local validation vs. CI as the full-suite gate). No product code or UI touched.

## 2026-08-19 — 7698563 — feat: Story 8.7 — Overview Tab Enhancement (ADR-0062), folded in with ADR-0062/0063 acceptance

- **Full commit:** `7698563ba34ec7f71ec5c4deac609965101381ba`
- **Files touched:** docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/0062-analytics-dashboard-overview-tab-enhancement.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, docs/user-stories/epic-8-analytics-dashboard.md, social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.4.overview-enrichment-period-comparison.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.7.overview-tab-enhancement.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/analytics/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real, contract-verified, user-facing change — Story 8.7 fully replaces the Analytics Overview tab's three-KPI-card layout with an eight-widget, three-column grid (Sentiment Gauge, Authors by Source, Volume & Projections with forecast/Crisis Alert Radar, Key Phrases, Languages, Sources, Top Authors, a reserved Spike Storyteller slot) plus click-to-filter and a filter-chip bar, and removes the period-over-period delta badges that used to render there. `docs/manuals/tenant-admin-manual.md` and `docs/manuals/user-manual.md`'s "Analytics dashboard" sections rewritten to describe this grid (superseding the pre-8.7 description), citing Story 8.7; both manuals' "Current limitations" updated to note the comparison checkbox no longer renders anywhere. (Folded together with several later polish commits in this same pass — see `2859a76` onward below for the rest of what changed before this section's final wording was set.)

## 2026-08-19 — 6a59885 — docs: implementation log entry for Story 8.7, Built hash finalized

- **Full commit:** `6a598854f83063c1bd61fb8a7628420c78e52b0e`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-8-analytics-dashboard.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change of its own — only finalizes Story 8.7's Implementation Log entry and story-file status; the underlying capability is reviewed under `7698563` above.

## 2026-08-20 — 2859a76 — feat(analytics-overview): live UI/UX refinements + stacked post-detail drawer

- **Full commit:** `2859a76da56c066a11053e50feb96833fe0415a4`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.4.overview-enrichment-period-comparison.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.7.overview-tab-enhancement.contract.test.ts, social-listening-admin/src/app/api/posts/[id]/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/posts/PostDetailPanel.tsx, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real, user-facing change, folded into the same manual rewrite as Story 8.7 above. Key changes reflected: the Overview tab's post drawer is now a stacked two-panel drawer (list plus on-demand full detail); `PostDetailPanel` (shared with the ordinary Posts screen) now also renders Azure OpenAI's executive summary (Story 2.17) for the first time in any screen — both manuals' Posts sections and "What's not built yet" lists updated to stop calling the summary field undisplayed. Also the source of the detail panel's telemetry no longer including an ingestion-run identifier — both manuals' Posts sections and gap lists corrected to say so plainly rather than repeat the stale "shown as a raw identifier" claim.

## 2026-08-20 — efa96e8 — fix(analytics-overview): unreadable white-on-white post title in drawer rows

- **Full commit:** `efa96e8869d1b24b396cb2f7e9d00e872e20acc4`
- **Files touched:** social-listening-admin/src/app/globals.css
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No manual text needed — a one-line CSS color-contrast fix to the drawer rows added in the immediately-preceding commit (`2859a76`), not a new capability. Covered implicitly by that entry's own review.

## 2026-08-20 — cd6f41e — fix(post-feed): allocate the Newswire issuer to the author position

- **Full commit:** `cd6f41e08dea95d06748056c97e54802e35c6fb7`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real, user-facing bug fix to an already-documented screen (Story 6.11's Posts feed) — every real Newswire post's author was rendering blank; now shows the issuing organization. Both manuals' Posts sections updated with a new "Author names are real, not placeholders" note covering this and the companion Facebook fix (`2fa45ba`).

## 2026-08-20 — 75362d3 — fix(facebook-connector): denormalize Page id/name into rawPayload

- **Full commit:** `75362d338413dd2a1e2cc36d12219b48798f9118`
- **Files touched:** social-listening-core/.claude/skills/facebook-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.15.facebook-connector.contract.test.ts, social-listening-core/src/connectors/facebook/pollFacebook.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No manual text of its own — a `social-listening-core` backend fix (denormalizing the connected Page's id/name into `rawPayload` so the admin UI can read it) with no UI of its own. Its user-visible effect (a real Facebook Page name showing as the post's author) is documented under the companion admin-side fix, `2fa45ba`, below.

## 2026-08-20 — 2fa45ba — fix(post-feed): surface Facebook Page author and original-post link

- **Full commit:** `2fa45ba5bfb07660987e34c90019241081e50094`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real, user-facing bug fix — a connected Facebook Page's own name now shows as a post's author (paired with `75362d3`'s backend change), and the "Open original" link now works for Facebook posts on both the Posts screen and the Analytics Overview drawer, where it previously rendered nothing. Reflected in both manuals' Posts sections (the same "Author names are real" note as `cd6f41e`) and in the Analytics Overview description's mention of the drawer's "Open original" link.

## 2026-08-20 — 2f52c0f — feat(story-2.19): tenant-owned-feed per-feed name + per-item byline

- **Full commit:** `2f52c0f1079249e9508c5878bc100ff2543468a7`
- **Files touched:** docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.19.tenant-owned-feed-naming-and-byline.contract.test.ts, social-listening-core/contracts/epic-3/story-3.10.canonical-markdown-post-body-normalization.contract.test.ts, social-listening-core/migrations/0037_add_tenant_owned_feed_activations_name.sql, social-listening-core/src/connectors/tenantOwnedFeed/feedItemParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts, social-listening-core/src/http/versions/v1/tenantOwnedFeedRouter.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** `social-listening-core` backend half of Story 2.19 (per-feed `name` column/API support, per-item byline extraction denormalized into `rawPayload`) — no admin UI of its own. Its user-visible effects are documented once the matching admin-side screen change ships: the per-item byline is covered by the Posts-screen author note (`cd6f41e`/`2fa45ba` above), and the per-feed name field is documented under `cc38b6a` (Story 6.28) below.

## 2026-08-20 — e54f937 — docs: implementation log entry for Story 2.19, Built hash finalized

- **Full commit:** `e54f937c9994e126bee7944e9b071be3e524e9c1`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — only finalizes Story 2.19's Implementation Log entry and story status.

## 2026-08-20 — cc38b6a — feat(story-6.28): tenant-owned-feed friendly naming in setup UI

- **Full commit:** `cc38b6a9909eb4347d39789bd07e7f1e5027137d`
- **Files touched:** social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.28.tenant-owned-feed-friendly-naming.contract.test.ts, social-listening-admin/next-env.d.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/[id]/route.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/connect/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real, user-facing, Tenant-Admin-only screen change — Story 6.28 adds an optional "Name (optional)" field when connecting a domain feed, and a matching field when editing one, with named feeds shown by their friendly name (domain as secondary text) in the feed list. `docs/manuals/tenant-admin-manual.md`'s "Monitoring your own company domain's content feed" section updated to describe this (Story 6.28 added to its own heading and step text). Not documented in `docs/manuals/user-manual.md` — this whole screen has been Tenant-Admin only since Story 6.20.

## 2026-08-20 — 1bb19f7 — docs: ADR filename fixes and governance review updates

- **Full commit:** `1bb19f703bf8d28a085172934b1edc6b07a46666`
- **Files touched:** docs/adr/0066-active-watchlist-sourcing-via-bing-search-api.md, docs/adr/0067-reconfirm-facebook-connector, docs/adr/0067-reconfirm-facebook-connector.md, docs/adr/0068-instagram-connector, docs/adr/0068-instagram-connector.md, docs/adr/0069-linkedin-connector, docs/adr/0069-linkedin-connector.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — ADR filename corrections (adding missing `.md` extensions to 0067/0068/0069) and review-queue bookkeeping. No connector named in these ADRs is built.

## 2026-08-20 — 983ae70 — docs: sync tracking and review registers

- **Full commit:** `983ae70fc87dd679f695a486ad3bdd6ba37b38a0`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure review/tracking register bookkeeping.

## 2026-08-20 — 605e5a4 — feat(story-8.9): selectedTopic watchlist filter and Watchlist Coverage widget

- **Full commit:** `605e5a430aaa535dea868af78acd5d222ed1ea72`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.7.overview-tab-enhancement.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.9.watchlist-filter-and-coverage-widget.contract.test.ts, social-listening-admin/src/app/api/analytics/summary/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/analytics/fetchAnalyticsSummary.ts, social-listening-admin/src/app/tenant/analytics/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real, user-facing change — Story 8.9 adds a "Topic / Watchlist" selector that re-queries posts server-side (using the `GET /v1/posts?watchlistId=` endpoint Story 3.11 built), and a Watchlist Coverage donut widget on the Overview tab showing how matched posts split across a tenant's active watchlists. Both manuals' Analytics dashboard sections rewritten to describe this selector and widget, citing Story 8.9.

## 2026-08-20 — 1fee797 — docs(story-8.9): record implementation and traceability for Story 8.9

- **Full commit:** `1fee7974ac43b9892c227ac9b5c7c5f4251aff3a`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — only finalizes Story 8.9's Implementation Log/traceability entries; the underlying capability is reviewed under `605e5a4` above.

## 2026-08-20 — 1320adb — docs(story-3.12): draft Story 3.12 and add ADR-0063 Amendment Log for historical backfill and discovery attribution

- **Full commit:** `1320adbb2fd8e54a955dce7fa3092ab8eeaa274c`
- **Files touched:** docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — drafts Story 3.12 (not yet built at this commit) and an ADR-0063 Amendment Log entry. Nothing shipped yet.

## 2026-08-20 — 3adc060 — feat(story-3.12): post-watchlist match historical backfill and discovery attribution

- **Full commit:** `3adc06068ea5736c6fac6a2ae0794a49e07be533`
- **Files touched:** social-listening-core/.claude/skills/post-watchlist-match-persistence/SKILL.md, social-listening-core/.claude/skills/wikipedia-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.14.wikipedia-watchlist-driven-discovery.contract.test.ts, social-listening-core/contracts/epic-3/story-3.12.post-watchlist-match-backfill-and-discovery-attribution.contract.test.ts, social-listening-core/jest.global-setup.js, social-listening-core/migrations/0038_backfill_post_watchlist_matches.sql, social-listening-core/src/connectors/wikipedia/pollWikipedia.ts, social-listening-core/src/events/publishSocialPostIngestedEvents.ts, social-listening-core/src/watchlists/postWatchlistMatchStore.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No admin-UI change — a `social-listening-core`-only backend backfill (historical `post_watchlist_matches` rows) and discovery-attribution fix. This improves the accuracy of data the Watchlist Coverage widget (Story 8.9, already documented under `605e5a4`) reads, but ships no new screen or control of its own to document.

## 2026-08-20 — af83d18 — docs(story-3.12): record Story 3.12 implementation and update traceability

- **Full commit:** `af83d1870bb86467fb7f3370e6bfdb845ced3f69`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — only finalizes Story 3.12's Implementation Log/traceability entries; reviewed under `3adc060` above.

## 2026-08-20 — aa1e7f5 — fix(analytics): sort watchlist coverage descending by post count and limit to top 6 items

- **Full commit:** `aa1e7f5802d2ca7af48ef119aca91f365af3af50`
- **Files touched:** social-listening-admin/contracts/epic-8/story-8.9.watchlist-filter-and-coverage-widget.contract.test.ts, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Minor real refinement to the Watchlist Coverage widget already documented under `605e5a4` (Story 8.9) — sorts descending by post count and caps to the top 6. Folded into this pass's Analytics dashboard rewrite rather than given its own manual line.

## 2026-08-20 — 3e3c352 — docs: update review logs and time tracking

- **Full commit:** `3e3c352bf6cbac8a13095db155665a370162b4cf`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure review/time-tracking bookkeeping.

## 2026-08-20 — 3d7d743 — fix(analytics): align topic selector, date range picker, and matching posts count on a single control line

- **Full commit:** `3d7d7435a8a67f17d4e68b6b165e3772c8e747f6`
- **Files touched:** social-listening-admin/contracts/epic-6/story-6.26.post-feed-dynamic-provider-filter.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.3.conversations-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.4.overview-enrichment-period-comparison.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.5.languages-breakdown-widget.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.6.sources-tab-sentiment-index-volume-history.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Pure visual alignment fix (topic selector, date-range picker, and matching-posts count on one control line) to the header controls already documented as a group under `1edd1e7` below. No independent manual text needed.

## 2026-08-20 — ee03f09 — docs: update review logs and time tracking

- **Full commit:** `ee03f09f33d03d94f23ff6d7f5703060af192356`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure review/time-tracking bookkeeping.

## 2026-08-20 — 1edd1e7 — feat(analytics): promote toolbar items to header for persistent visibility across all tabs

- **Full commit:** `1edd1e7b091e1ba40799074aaefb0f8f43fbdd0d`
- **Files touched:** social-listening-admin/contracts/epic-8/story-8.9.watchlist-filter-and-coverage-widget.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real, user-facing layout change — the Topic/Watchlist selector, date-range picker, and matching-posts-count button move from being Overview-tab-only controls into the Analytics page's own persistent header, visible on every tab. Both manuals' Analytics dashboard sections rewritten with a new "Header controls, shared across every tab" opening point describing this.

## 2026-08-20 — 8e50e38 — docs: update reviews and time tracking

- **Full commit:** `8e50e387ba9fbdfe27e8cac2932de6d95ffa5f11`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure review/time-tracking bookkeeping.

## 2026-08-20 — 76941c0 — feat(shell): add icons to sidebar navigation items and make sidebar collapsable

- **Full commit:** `76941c005b8fd6feb0a26b262f03b1a8af67e4f9`
- **Files touched:** social-listening-admin/src/app/globals.css, social-listening-admin/src/components/shell/AppSidebar.tsx, social-listening-admin/src/components/shell/shell.test.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real but purely navigational/visual change — adds icons to the sidebar nav items and a collapse control; no screen's behavior or available actions change. Both manuals' "Current coverage" notes updated with a one-line mention (matching the existing convention for the earlier stylesheet/content-width visual changes), no new section warranted.

## 2026-08-20 — 6115e1b — docs: update review tracking

- **Full commit:** `6115e1b4a1708a79f8d57df3380dbd28795081f9`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure review/time-tracking bookkeeping.

## 2026-08-20 — 8d9b6f3 — feat(tenant): update overview metric cards with icons, full-width grid, and real actuals

- **Full commit:** `8d9b6f365123c8747d52f43a5804a70fe6f165c5`
- **Files touched:** social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real, user-facing change to the tenant landing page (`/tenant`), which neither manual had ever described as its own section before this pass — a real, longstanding gap this pass closes rather than one this specific commit opened. Added a new "Your tenant's workspace overview" section to both manuals (Story 6.2, this commit cited for the real metric cards/icons/actuals) describing the four metric cards, degraded-connector banner, Recent Ingestion Stream, and Active Connectors panel, read directly from `social-listening-admin/src/app/tenant/page.tsx`.

## 2026-08-20 — 142638c — docs: update review logs

- **Full commit:** `142638c24d5e21c5dc8a5fb627abcec7ae77713f`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure review/time-tracking bookkeeping.

## 2026-08-20 — cb953f1 — fix(tenant): show most-recently ingested posts first in recent ingestion stream

- **Full commit:** `cb953f1d197bf09f6c7cfc1cbcc57950d5276038`
- **Files touched:** social-listening-admin/src/app/tenant/page.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real bug fix to the Recent Ingestion Stream panel documented under `8d9b6f3` above (it now correctly shows newest-ingested-first, matching the ordering fix Story 6.25 already applied to the full Posts screen) — folded into that same new "workspace overview" section rather than given a separate manual line.

## 2026-08-20 — c3044d0 — docs: update review logs

- **Full commit:** `c3044d0593e42deeb88fd941f0bd8f4039450cb1`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure review/time-tracking bookkeeping.

## 2026-08-20 — 72a15c9 — feat(analytics): place Sources and Authors widgets underneath volume graph in centre column

- **Full commit:** `72a15c91b2114e92f0a5496402d44b48acbca145`
- **Files touched:** social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Layout-only change to the Overview tab's centre column (Sources and Top Authors widgets placed side by side beneath the volume graph) — already reflected in this pass's Analytics dashboard rewrite (Story 8.7 entry, `7698563`), which describes the final centre-column layout directly rather than each intermediate rearrangement.

## 2026-08-20 — 034e968 — docs: update review logs

- **Full commit:** `034e968612549535e418d716e7f14b4c111c9173`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure review/time-tracking bookkeeping.

## 2026-08-20 — 8cbb71a — feat(analytics): add well-known platform icons and dynamic percentage linebars to sources widget

- **Full commit:** `8cbb71a022a1c48e8bbef8a0795312ac07e4a74b`
- **Files touched:** social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Visual refinement to the Sources widget (platform icons, real percentage bars) already covered by this pass's Analytics dashboard rewrite's description of the Sources widget ("real percentage bars") — no separate manual line needed.

## 2026-08-20 — 624c626 — docs: update review tracking

- **Full commit:** `624c6263f819237845fa7982f4f7a31a59ebfef3`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure review/time-tracking bookkeeping.

## 2026-08-20 — d2dff0d — feat(analytics): add platform icons and brand coloring to Authors by Source widget

- **Full commit:** `d2dff0dd7e5a29bc37eb37b64f65c07499c756fe`
- **Files touched:** social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Visual-only change (platform icons and brand coloring on the Authors-by-Source donut) — the widget itself is already documented under this pass's Analytics dashboard rewrite; no separate manual line needed.

## 2026-08-20 — ad3e8be — docs: update review logs

- **Full commit:** `ad3e8be50c8a8a784522d90390b378a98096b6bc`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — pure review/time-tracking bookkeeping.

## 2026-08-20 — 8bc60a1 — Story 2.20: Country-level geospatial extraction and normalization on post enrichment (ADR-0064)

- **Full commit:** `8bc60a17381f19368dc34de4332ad62a18c8eb17`
- **Files touched:** docs/adr/0064-location and geospatial insights from posts and authors.md, docs/adr/0064-location-and-geospatial-insights-from-posts-and-authors.md, docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-8-analytics-dashboard.md, social-listening-core/.claude/skills/social-post-enrichment/SKILL.md, social-listening-core/contracts/epic-2/story-2.20.geospatial-enrichment.contract.test.ts, social-listening-core/src/connectors/geo/geoCountryUtils.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/newswire/rssFeedParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/feedItemParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/connectors/types.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** `social-listening-core` backend-only — real country-level extraction on ingestion (GNews `source.country`, Newswire/tenant-owned-feed explicit country tags and domain fallbacks) with no UI of its own. This is exactly the data Story 8.10's Location & Geospatial Insights map (below, `75a0a4a`) reads; documented there once the real screen exists, per this role's own "document only where a screen exists" discipline.

## 2026-08-20 — 93dadab — Merge remote-tracking branch 'origin/main'

- **Full commit:** `93dadabf2c3e52e4e25c20f26acc61a5fbe8dc87`
- **Files touched:** 
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — an empty merge commit (`git diff-tree` shows no files of its own); every real change it merges is reviewed individually elsewhere in this batch.

## 2026-08-20 — 75a0a4a — Story 8.10: Location & Geospatial Insights on Overview tab with SVG choropleth map (ADR-0064)

- **Full commit:** `75a0a4a72328f56953c49f3622b3e0ebfd0830ea`
- **Files touched:** docs/implementation-plan.md, social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.10.location-and-geospatial-insights.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.7.overview-tab-enhancement.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/CountryWorldMap.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** Real, contract-verified, user-facing change — adds a Location & Geospatial Insights widget to the Analytics Overview tab: an SVG world-map choropleth shaded by matched-post volume per country (fed by Story 2.20's country extraction), a "Top Countries" list, and click-to-filter by country. Both manuals' Analytics dashboard sections rewritten to describe this widget (Story 8.10), and their "no Location tab" limitation lines corrected — country-level location insight now exists, embedded on the Overview tab rather than as a separate tab; the remaining honest gap is that it's country-level only.

## 2026-08-20 — 168e5f7 — docs: record Story 8.10 implementation in user stories and log

- **Full commit:** `168e5f75ae88234db755aea052b5c0d143bb8bdd`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-8-analytics-dashboard.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — only finalizes Story 8.10's Implementation Log/traceability entries; reviewed under `75a0a4a` above.

## 2026-08-20 — 70035d7 — docs: draft ADR-0070, Story 1.16, and Story 6.29 for connector ingestion status, watchdog, and alerts

- **Full commit:** `70035d7e03eeb2e2e3a3020938ba91cf511ab4d6`
- **Files touched:** docs/adr/0070-connector-ingestion-status-hanging-run-reconciliation-and-alerts.md, docs/adr/README.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — drafts ADR-0070 and Stories 1.16/6.29 (connector ingestion-status watchdog and alerts). Docs/ADR-only, confirmed no `src/` code touched; nothing built or contract-verified yet, so nothing belongs in a manual.

## 2026-08-20 — f00b34c — docs: accept ADR-0070 and update Stories 1.16 and 6.29 with lock-safe watchdog and health precedence

- **Full commit:** `f00b34cf34d4185043728eba09aa2f9df7e58588`
- **Files touched:** docs/adr/0070-connector-ingestion-status-hanging-run-reconciliation-and-alerts.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
- **Resolved 2026-08-26 (Learning & Development Writer, scheduled pass):** No user-facing change — accepts ADR-0070 and refines Stories 1.16/6.29's own spec text (lock-safe watchdog, health precedence). Still docs/ADR-only, confirmed no `src/` code touched; Story 1.16/6.29 remain unbuilt per `docs/implementation-log.md` — nothing to document yet.

## 2026-08-26 — 8029cd9 — Scheduled doc review: 2026-08-26 — clear 49-entry backlog across all three review queues

- **Full commit:** `8029cd951fd8c2fa72b2b13e5fed900ce26926f8`
- **Files touched:** docs/adr/README.md, docs/implementation-log.md, docs/implementation-plan.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-6-tenant-admin-ui.md, docs/user-stories/epic-8-analytics-dashboard.md, social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.9.watchlist-filter-and-coverage-widget.contract.test.ts
- **Status:** Pending review

