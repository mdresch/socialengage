# Pending Manager Reviews

**Queued by:** `scripts/git-hooks/post-commit`, one entry per commit, automatically, non-blocking. **Reviewed by:** the Ideal Manager (`.claude/agents/ideal-manager.md`) whenever a Claude Code session is actively working in this repo and checks this file — not a live daemon, not guaranteed same-day. Append-only, same discipline as `docs/implementation-log.md`: a reviewed entry gets struck through with a dated resolution note pointing to `docs/management/manager-register.md`'s matching finding, never deleted.

---
## 2026-08-05 — 4701eff — Governance: 3 new ADRs, Stakeholder Register v2.7, 3 new AI reviewer roles, commit-review pipeline, Vercel setup

- **Full commit:** `4701eff6cb5a2a70ac6de1786799665e0317d321`
- **Files touched:** .claude/agents/ideal-manager.md, .claude/agents/knowledge-graph-semantic-data-modeling-reviewer.md, docs/adr/0018-data-retention-and-archival-policy.md, docs/adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md, docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, docs/adr/0040-self-service-signup-rate-limiting-and-abuse-prevention-mechanism.md, docs/adr/README.md, docs/ai-roles/.env.example, docs/ai-roles/README.md, docs/ai-roles/data-sovereignty-privacy-regulation-reviewer.md, docs/ai-roles/legal-compliance-reviewer.md, docs/ai-roles/scripts/invoke-ollama-agent.cjs, docs/architecture/knowledge-graph-register.md, docs/future-subsystems.md, docs/implementation-plan.md, docs/legal/legal-compliance-register.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/privacy/data-sovereignty-register.md, docs/project docs/Stakeholder-Register.md, docs/security/security-register.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-6-admin-ui.md, scripts/git-hooks/post-commit, scripts/setup-git-hooks.js, social-listening-admin/.gitignore, social-listening-admin/vercel.json
- ~~**Status:** Pending review~~
**Resolved 2026-08-05:** see docs/management/manager-register.md's matching entry.

## 2026-08-05 — 443819e — Add Story 6.2 role-gated routing shell

- **Full commit:** `443819efaaa09f7fe6d7b7b97d91b4d8e78743c5`
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/app/tenant/page.tsx, social-listening-admin/src/lib/role-routing.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 443819e/67430b7/57926be/99caf05/54f7ee7.

## 2026-08-05 — 67430b7 — Add Story 6.3 connector connect flow

- **Full commit:** `67430b7f2ae16ed9dfc30d0e0c17c98b994bffde`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/src/app/tenant/connectors/page.tsx
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 443819e/67430b7/57926be/99caf05/54f7ee7.

## 2026-08-05 — 57926be — Add Story 6.4 watchlist management screen

- **Full commit:** `57926befe8eb622fadab47df3b606876e87aef51`
- **Files touched:** social-listening-admin/.claude/skills/watchlist-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts, social-listening-admin/src/app/tenant/watchlists/page.tsx
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 443819e/67430b7/57926be/99caf05/54f7ee7.

## 2026-08-05 — 99caf05 — Add Story 6.5 connector status view

- **Full commit:** `99caf05f1f9063f179e5a85fd8c7dcbd69ae1795`
- **Files touched:** social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 443819e/67430b7/57926be/99caf05/54f7ee7.

## 2026-08-05 — 54f7ee7 — Traceability catch-up: Stories 6.2-6.5 (built in a parallel session, log/status uncommitted)

- **Full commit:** `54f7ee70381c7091364cb380337b0c5a6892aa4f`
- **Files touched:** docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 443819e/67430b7/57926be/99caf05/54f7ee7.

## 2026-08-05 — e08b0c0 — Implement Story 5.12: Platform Admin tenant management REST surface (ADR-0030, ADR-0031)

- **Full commit:** `e08b0c018e1a98540e5fc2a83a5b961006009974`
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/platform-admin-tenant-management/SKILL.md, social-listening-core/.claude/skills/tenant-auth-middleware/SKILL.md, social-listening-core/contracts/epic-5/story-5.12.platform-admin-tenant-management.contract.test.ts, social-listening-core/migrations/0020_grant_platform_admin_domain_update.sql, social-listening-core/src/http/auth/requireTenantUser.ts, social-listening-core/src/http/versions/v1/adminTenantsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/tenants/tenantStore.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing e08b0c0/acedb26.

## 2026-08-05 — acedb26 — Log Story 5.12 in the Implementation Log

- **Full commit:** `acedb26fca0764acb57e01b0c882ed1fbb0fa8ca`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing e08b0c0/acedb26.

## 2026-08-06 — 7b9cee5 — Implement Story 5.13: Platform Admin break-glass request/execute REST surface

- **Full commit:** `7b9cee589161d3bd52501413dda307b9b06934f2`
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/.claude/skills/platform-admin-break-glass-rest/SKILL.md, social-listening-core/contracts/epic-5/story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts, social-listening-core/src/admin/breakGlassCredentialReset.ts, social-listening-core/src/http/versions/v1/adminBreakGlassRouter.ts, social-listening-core/src/http/versions/v1/router.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 7b9cee5/abe4a55.

## 2026-08-06 — abe4a55 — Log Story 5.13 in the Implementation Log

- **Full commit:** `abe4a553b50d194082aee226f1bcb64b5953c353`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 7b9cee5/abe4a55.

## 2026-08-06 — 8cf4391 — Implement Story 5.14: Platform Admin audit-log query REST surface

- **Full commit:** `8cf439188b3ade1af4192840b3d97777fac8c4ca`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-6-admin-ui.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/.claude/skills/platform-admin-audit-log/SKILL.md, social-listening-core/contracts/epic-5/story-5.14.platform-admin-audit-log-rest-surface.contract.test.ts, social-listening-core/src/admin/auditLogCursor.ts, social-listening-core/src/admin/platformAdminAuditLog.ts, social-listening-core/src/http/versions/v1/adminAuditLogRouter.ts, social-listening-core/src/http/versions/v1/router.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 8cf4391/771a3c9.

## 2026-08-06 — 771a3c9 — Log Story 5.14 in the Implementation Log

- **Full commit:** `771a3c9ac16446883d80b9fc0949a284de96a7d2`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 8cf4391/771a3c9.

## 2026-08-06 — 9a25d54 — Accept ADR-0038 and ADR-0039, both as drafted

- **Full commit:** `9a25d541fb269dbb2e9ffcddb62550a5cc74fb4a`
- **Files touched:** docs/adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md, docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 9a25d54.

## 2026-08-06 — cfc6744 — Governance batch: Go-Live Readiness Definition, WIP limits, Lessons Learned Register, Manager review resolution

- **Full commit:** `cfc6744d95db8d22cf0e6e28f43ff04452b6a068`
- **Files touched:** docs/implementation-plan.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/open-decisions.md, docs/open-items-and-deferred-work.md, docs/project docs/Lessons-Learned-Register.md, docs/project docs/Project Management Plans/Development-Approach-and-Life-Cycle-Plan.md, docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md, docs/project docs/Project Management Plans/Uncertainty-Management-Plan.md, docs/project docs/Stakeholder-Register.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing cfc6744.

## 2026-08-06 — 6c8e806 — Accept ADR-0040 as drafted, closing out the three-ADR batch

- **Full commit:** `6c8e80600719cc477725f1dd04ffd8831c5f4a2c`
- **Files touched:** docs/adr/0040-self-service-signup-rate-limiting-and-abuse-prevention-mechanism.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 6c8e806.

## 2026-08-06 — 7f1fc90 — Heal Story 4.4 AC5b: compare refreshed_at against Postgres's own now(), not the test process's Date.now()

- **Full commit:** `7f1fc901f91d74e207880a7d9bff05e80c27fa53`
- **Files touched:** social-listening-core/.claude/skills/derived-data-caching-and-refresh/SKILL.md, social-listening-core/contracts/epic-4/story-4.4.derived-data-caching-and-refresh.contract.test.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 7f1fc90/2e6df21.

## 2026-08-06 — 2e6df21 — Log Story 4.4 AC5b healing pass in the Implementation Log

- **Full commit:** `2e6df2155f9ebbe4bcb3e0bfeabc3ff2e77f6fea`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 7f1fc90/2e6df21.

## 2026-08-06 — cbc8283 — Heal Story 2.6 AC3: retry PR Newswire's fetch with the same tolerance runIngestionAttempt() already has

- **Full commit:** `cbc828314a622528611657025ed9e2665f123df6`
- **Files touched:** social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.6.newswire-connector.contract.test.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing cbc8283/40defb5.

## 2026-08-06 — 40defb5 — Log Story 2.6 AC3 healing pass in the Implementation Log

- **Full commit:** `40defb52d3f0c66eac1f54a3cc37429a5346bdf7`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing cbc8283/40defb5.

## 2026-08-06 — 135a5a1 — Implement Story 5.15: Self-service tenant sign-up backend endpoint

- **Full commit:** `135a5a10a939ecb4640e5cdf7c11f404764f3e30`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-6-admin-ui.md, social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md, social-listening-core/contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts, social-listening-core/migrations/0021_create_tenant_signup_role.sql, social-listening-core/migrations/0022_create_domain_signup_attempts.sql, social-listening-core/src/admin/platformAdminAuditLog.ts, social-listening-core/src/db/tenantSignupPool.ts, social-listening-core/src/http/app.ts, social-listening-core/src/http/auth/testClaimsBypassMiddleware.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/selfServiceSignupRouter.ts, social-listening-core/src/tenants/selfServiceSignup.ts, social-listening-core/src/tenants/tenantStore.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 135a5a1/8fde7e1.

## 2026-08-06 — 8fde7e1 — Log Story 5.15 in the Implementation Log

- **Full commit:** `8fde7e1a1eae7ecf1333819d6b9776308255165d`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 135a5a1/8fde7e1.

## 2026-08-06 — dc66f14 — Optimize the Product & Market-Fit Reviewer's prompt, require a possible-solution field

- **Full commit:** `dc66f14f6a3a90322a19f86b0f042382aa9675cf`
- **Files touched:** docs/ai-roles/product-market-reviewer.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing dc66f14/fe4c7a2.

## 2026-08-06 — fe4c7a2 — Add a findings register for Product & Market-Fit Reviewer, plus a real Foundry Prompt Agent backend

- **Full commit:** `fe4c7a2c934031080c1510559659d1ba1ee81aa9`
- **Files touched:** docs/ai-roles/.env.example, docs/ai-roles/README.md, docs/ai-roles/package-lock.json, docs/ai-roles/package.json, docs/ai-roles/product-market-reviewer.md, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs, docs/ai-roles/scripts/invoke-mistral-agent.cjs, docs/product/product-market-register.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing dc66f14/fe4c7a2.

## 2026-08-06 — aa4bf87 — Extend Documentation Steward to PM docs, add a Learning & Development Writer, wire two more Foundry Prompt Agents

- **Full commit:** `aa4bf872a2acb36d6e15519d0f86ea1acace5f10`
- **Files touched:** .claude/agents/documentation-steward.md, .claude/agents/learning-development-writer.md, docs/ai-roles/.env.example, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs, docs/manuals/system-admin-manual.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, scripts/git-hooks/post-commit, scripts/setup-git-hooks.js
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing aa4bf87/55a02ab.

## 2026-08-06 — 55a02ab — Queue commit aa4bf87 for Manager, Documentation Steward, and Learning & Development review

- **Full commit:** `55a02aba43dec394c8f01c945cf48caa9e3996bb`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing aa4bf87/55a02ab.

## 2026-08-06 — 2106034 — Record two parked AI-role ideas: Infrastructure/Go-Live Readiness, Cost/FinOps

- **Full commit:** `2106034da535a6b7dd3bee6d98b0c7116ea288ac`
- **Files touched:** docs/ai-roles/README.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-06:** see docs/management/manager-register.md's entry reviewing 2106034.

## 2026-08-06 — a251050 — Implement Story 5.16: Same-Domain Invite Assist backend surface

- **Full commit:** `a2510508f543c8c10c12cfc3631675f88839964c`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/same-domain-invite-assist/SKILL.md, social-listening-core/contracts/epic-5/story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts, social-listening-core/src/http/versions/v1/domainSignupAttemptsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/tenants/domainSignupAttempts.ts, social-listening-core/src/tenants/selfServiceSignup.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 29914e2 — Log Story 5.16 in the Implementation Log

- **Full commit:** `29914e2aa914c407cdbd126261ed5dea01b13bed`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 63b5ce1 — Process Ideal Manager, Documentation Steward, and L&D Writer review queues

- **Full commit:** `63b5ce1a1c3b5d74d2fd9e6ff8dca4cee635285a`
- **Files touched:** docs/ai-roles/README.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/project docs/Stakeholder-Register.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 1f8960e — Heal Story 6.2: ResolvedIdentity is a discriminated union, not a flat {role}

- **Full commit:** `1f8960ef3058e28a20ddc678c6b202ec71441cd3`
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/jest.config.js, social-listening-admin/src/app/api/auth/callback/route.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/app/tenant/page.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/role-routing.ts, social-listening-admin/src/lib/session.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — fb2eabc — Log the Story 6.2 healing pass in the Implementation Log

- **Full commit:** `fb2eabc2c3c69cd88fa489cc4189c3839ee865a8`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 35f056a — Learning & Development Writer: one-time whole-project manual catch-up

- **Full commit:** `35f056a61ca013a7c81955c2198790cd37bb30c3`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/manuals/system-admin-manual.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 2061e72 — Add a standing author-rights check to the requirements-analyst charter

- **Full commit:** `2061e723e124f3a3b0769c21fb6bb5f7d7aab6f0`
- **Files touched:** .claude/agents/ba-requirements-analyst.md, docs/future-subsystems.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 4f7d9b9 — Write up real connector research: Reddit, X, YouTube, Meta, Wikipedia

- **Full commit:** `4f7d9b9e1848c8a9063f6c8ca5ca0edfb80e30b2`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 82ca1e2 — Accept ADR-0041: Platform Admin is a distinct identity kind

- **Full commit:** `82ca1e219840370ce62e3a586348130502a8e9e9`
- **Files touched:** docs/adr/0030-admin-tier-design-platform-admin-rls-exception.md, docs/adr/0032-users-table-shape-and-rls.md, docs/adr/0035-admin-ui-shape-one-app-role-gated.md, docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, docs/adr/0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md, docs/adr/README.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 6e4321f — Knowledge-graph review: Wikipedia connector authorship modeling

- **Full commit:** `6e4321fd5b08aa078bc1bb8aa0af21842c4e7830`
- **Files touched:** docs/architecture/knowledge-graph-register.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — c0179f4 — Migrate Data Privacy/Sovereignty reviewers off Ollama to Foundry

- **Full commit:** `c0179f41db5b7ca9fdd83812897f7c66de28d9d9`
- **Files touched:** docs/ai-roles/.env.example, docs/ai-roles/README.md, docs/ai-roles/data-privacy-sovereignty-reviewer.md, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 1187116 — Add stakeholder profiles for 12 personas across current and future scope

- **Full commit:** `11871169a72450e7275635ca2e4e9394ff4f676d`
- **Files touched:** docs/project docs/Stakeholder Management/Author-of-a-Post-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Data-Subject-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Legal-Advisor-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Platform-Admin-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Social-Selling-Strategist-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Sole-Operator-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Admin-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Brand-Reputation-Manager-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Business-Analyst-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Reader-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-Social-Care-Agent-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Tenant-User-Stakeholder-Profile.md, docs/project docs/Stakeholder Management/Topic-Center-Analyst-Stakeholder-Profile.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 464e05a — Add a findings register for the Data Privacy & Sovereignty Reviewer

- **Full commit:** `464e05a91401c4d263b14a2c35a14fda75758d3f`
- **Files touched:** docs/ai-roles/README.md, docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs, docs/privacy/data-privacy-sovereignty-register.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — cd308eb — Add real, auto-derived commit time-logging to post-commit; fix stale template

- **Full commit:** `cd308ebaa482415254a0d3eba62cb6f2ff75ecb1`
- **Files touched:** docs/templates/time-tracking.md, docs/time-tracking.md, scripts/git-hooks/post-commit
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 406bf2c — Fix: auto-derived time-log row landed after the file footer, not in the table

- **Full commit:** `406bf2c327a88b188eb204eef11605acebb235f4`
- **Files touched:** docs/time-tracking.md, scripts/git-hooks/post-commit
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — f932f41 — Draft ADR-0042: Wikipedia connector (MediaWiki API, article-as-Author)

- **Full commit:** `f932f4115021702a264f3cb1c2852bb1a09d9280`
- **Files touched:** docs/adr/0004-author-normalized-separately-from-post.md, docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md, docs/adr/README.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 3a757b7 — Legal & Compliance Reviewer: first real review, ADR-0038

- **Full commit:** `3a757b704fb9496a415ec3a8e08c1747c1e4057a`
- **Files touched:** docs/legal/legal-compliance-register.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 7dddb56 — Data Privacy & Sovereignty Reviewer: first real review

- **Full commit:** `7dddb5660e012aab3c3c2d5f02a331ef60df8d54`
- **Files touched:** docs/privacy/data-privacy-sovereignty-register.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — f5e4e41 — Documentation Steward: close the Stakeholder Management cross-reference gap

- **Full commit:** `f5e4e41e8cb12e42995398045d945cf038d07071`
- **Files touched:** docs/pending-documentation-steward-reviews.md, docs/project docs/Project Management Plans/Cost-Management-Plan.md, docs/project docs/Project Management Plans/Development-Approach-and-Life-Cycle-Plan.md, docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md, docs/project docs/Project Management Plans/Planning-Management-Plan.md, docs/project docs/Project Management Plans/Project-Work-Management-Plan.md, docs/project docs/Project Management Plans/Stakeholder-Management-Plan.md, docs/project docs/Project Management Plans/Uncertainty-Management-Plan.md, docs/project docs/Stakeholder-Register.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 3c96b74 — Auto-queue bookkeeping and time-log rows for recent commits

- **Full commit:** `3c96b74d1a0e56136cc66a7f5a80306b5aeb90d9`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 10e310d — Auto-queue bookkeeping for the prior bookkeeping commit

- **Full commit:** `10e310d25600cc6caa890a4acda8546031ba3c7b`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-06 — 9bc1a48 — Draft ADR-0043: self-service, Tenant-Admin-initiated tenant deletion

- **Full commit:** `9bc1a48db231ea18c9ce0e62d4d910b1e4e7a8a5`
- **Files touched:** docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, docs/adr/0043-self-service-tenant-initiated-deletion.md, docs/adr/README.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing a251050/29914e2/63b5ce1/1f8960e/fb2eabc/35f056a/2061e72/4f7d9b9/82ca1e2/6e4321f/c0179f4/1187116/464e05a/cd308eb/406bf2c/f932f41/3a757b7/7dddb56/f5e4e41/3c96b74/10e310d/9bc1a48.

## 2026-08-07 — 9a99257 — Implement Story 3.8: self-service tenant deletion (supersedes Story 3.7)

- **Full commit:** `9a992575edf5aefd805b685a533ea31a36c7e404`
- **Files touched:** docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, docs/adr/0043-self-service-tenant-initiated-deletion.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/self-service-tenant-deletion/SKILL.md, social-listening-core/contracts/epic-3/story-3.8.self-service-tenant-initiated-deletion.contract.test.ts, social-listening-core/jest.config.js, social-listening-core/jest.sequencer.js, social-listening-core/migrations/0023_grant_self_service_tenant_deletion.sql, social-listening-core/src/admin/platformAdminAuditLog.ts, social-listening-core/src/archival/blobArchiveClient.ts, social-listening-core/src/db/tenantDeletionPool.ts, social-listening-core/src/db/withTenant.ts, social-listening-core/src/http/versions/v1/adminTenantsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/selfServiceTenantDeletionRouter.ts, social-listening-core/src/ingestion/errorClassification.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts, social-listening-core/src/tenants/tenantDeletion.ts, social-listening-core/src/tenants/tenantExportCsv.ts, social-listening-core/src/tenants/tenantStore.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 9a99257/b80aa58.

## 2026-08-07 — b80aa58 — Log Story 3.8 in the Implementation Log

- **Full commit:** `b80aa585d53be86167cefefd1c94a234da979f33`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 9a99257/b80aa58.

## 2026-08-07 — c5e1532 — Design documents mockup - microsoft-social-engagement-ui-mockup - including images from social engagement for reference - The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

- **Full commit:** `c5e153221c7f4cabaeeedbbadac8b4b33c8455dc`
- **Files touched:** docs/design/microsoft-social-engagement-ui-mockup/README.md, docs/design/microsoft-social-engagement-ui-mockup/project/.thumbnail, docs/design/microsoft-social-engagement-ui-mockup/project/SocialEngage.dc.html, docs/design/microsoft-social-engagement-ui-mockup/project/support.js, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/1520200669292.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/FutureDecoded-Analytics.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/Microsoft Social Engagement (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/0702.activitymap (1).png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/0702.activitymap.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/11-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/12-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1229302.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1229329.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/15.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1520110736520.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/1520200669292.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/2- Go to settings,  Social Profiles then add profile.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/22.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/24.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/4-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/5706.mse1_.2_1 (1).png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/5706.mse1_.2_1 (2).png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/5706.mse1_.2_1.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/6-2.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/645596c34886ff29ecebfa63d1016d4e.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/FutureDecoded-Analytics.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/FutureDecoded-Dashboard.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/FutureDecoded-Location-Analytics.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/MSE01.PNG, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft Social Engagement (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft Social Engagement.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement-2.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement-Screenshot-WinBuzzer (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement-Screenshot-WinBuzzer.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft-Social-Engagement.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/Microsoft_Social_Engagement_2_small.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/R (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/R (2).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/R.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/analytics-conversation-view-social-engagement (1).webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/analytics-conversation-view-social-engagement.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/analytics-conversation-view-social-engagement.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/blog-crm-social-engagement-1024x604.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/dashboard001.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/hqdefault.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/lead.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (2).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (3).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (4).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (5).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (6).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault (7).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/maxresdefault.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/microsoft-social-engagement-location-view.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/microsoft-social-listening-example.gif, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/ms.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/ms1.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/mse-social-center-1-625x343.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/mse-social-center-1.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/mse-social-center.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/msei-04-625x431.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/setup01.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/setupd365.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/social-engagement-ga (1).jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/social-engagement-ga.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/socialcentar001.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/socialengagement-filtering.gif, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/timeline.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/SocialEngage/topic-e-sentimennt.png, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/analytics-conversation-view-social-engagement (1).webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/analytics-conversation-view-social-engagement.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/analytics-conversation-view-social-engagement.webp, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/maxresdefault (2)-d2afcdfa.jpg, docs/design/microsoft-social-engagement-ui-mockup/project/uploads/maxresdefault (2).jpg
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c5e1532/769c28c/fa7954c.

## 2026-08-08 — 769c28c — Designs from converting the HTML to Next js frontend pages

- **Full commit:** `769c28c613c583bf682a2750325f6683d28f4e19`
- **Files touched:** docs/design/MSE ui Mockup/.env.example, docs/design/MSE ui Mockup/.gitignore, docs/design/MSE ui Mockup/README.md, docs/design/MSE ui Mockup/index.html, docs/design/MSE ui Mockup/metadata.json, docs/design/MSE ui Mockup/package.json, docs/design/MSE ui Mockup/src/App.tsx, docs/design/MSE ui Mockup/src/components/ExportModal.tsx, docs/design/MSE ui Mockup/src/components/FilterBar.tsx, docs/design/MSE ui Mockup/src/components/FlyoutNav.tsx, docs/design/MSE ui Mockup/src/components/PostsPane.tsx, docs/design/MSE ui Mockup/src/components/SubTabs.tsx, docs/design/MSE ui Mockup/src/components/TopBar.tsx, docs/design/MSE ui Mockup/src/components/views/ActivityMapView.tsx, docs/design/MSE ui Mockup/src/components/views/AlertsView.tsx, docs/design/MSE ui Mockup/src/components/views/AuthViews.tsx, docs/design/MSE ui Mockup/src/components/views/ConversationsView.tsx, docs/design/MSE ui Mockup/src/components/views/LocationView.tsx, docs/design/MSE ui Mockup/src/components/views/OverviewView.tsx, docs/design/MSE ui Mockup/src/components/views/PostDetailView.tsx, docs/design/MSE ui Mockup/src/components/views/SearchSetupView.tsx, docs/design/MSE ui Mockup/src/components/views/SentimentView.tsx, docs/design/MSE ui Mockup/src/components/views/SettingsView.tsx, docs/design/MSE ui Mockup/src/components/views/SocialCenterView.tsx, docs/design/MSE ui Mockup/src/components/views/SourcesView.tsx, docs/design/MSE ui Mockup/src/data/mockData.ts, docs/design/MSE ui Mockup/src/index.css, docs/design/MSE ui Mockup/src/main.tsx, docs/design/MSE ui Mockup/src/types.ts, docs/design/MSE ui Mockup/tsconfig.json, docs/design/MSE ui Mockup/vite.config.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c5e1532/769c28c/fa7954c.

## 2026-08-08 — c33353d — Story 1.1 healing: restore repo independence by removing parent package.json

- **Full commit:** `c33353df14e4bfdefe3417642946261dc7486653`
- **Files touched:** social-listening-admin/package.json
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc.

## 2026-08-08 — 5b7a69f — Governance updates: heal-contract-failure SKILL enhancements, new ADRs 0044-0048, and traceability

- **Full commit:** `5b7a69fab8a496644c85ce499c68bfdf9ec91937`
- **Files touched:** .claude/skills/heal-contract-failure/SKILL.md, .claude/skills/implement-story/SKILL.md, docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md, docs/adr/0045-Audit Trail Architecture for Tenant User Access Management.md, docs/adr/0046-Admin UI Authentication and Authorization Architecture.md, docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md, docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md, docs/adr/README.md, docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc.

## 2026-08-08 — 4ff04cd — Add Foundry Toolkit setup and configuration

- **Full commit:** `4ff04cd8e0edef359e9fd635a39112120589aed5`
- **Files touched:** .dockerignore, .foundry/.deployment.json, .mcp.json, Dockerfile, agent.yaml, main.py
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 4ff04cd/8abdb48.

## 2026-08-08 — 488ac49 — Healing pass: Stories 2.7, 5.7, 5.13 — contract fixes and implementation

- **Full commit:** `488ac49296bbed9a546e116a317f8dcd06d9cf73`
- **Files touched:** social-listening-core/contracts/epic-2/story-2.7.gnews-connector.contract.test.ts, social-listening-core/contracts/epic-5/story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts, social-listening-core/contracts/epic-5/story-5.7.platform-admin-rls-bypass.contract.test.ts, social-listening-core/src/admin/breakGlassCredentialReset.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc.

## 2026-08-08 — fa7954c — UI mock designs: globals, types, mockData, and Tailwind config

- **Full commit:** `fa7954cc7589ab733d232058348a3df86da1d54d`
- **Files touched:** social-listening-admin/src/app/globals.css, social-listening-admin/src/lib/mockData.ts, social-listening-admin/src/lib/types.ts, social-listening-admin/tailwind.config.js
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c5e1532/769c28c/fa7954c.

## 2026-08-08 — 34b5333 — Setup: Codacy config, VS Code MCP settings, Claude settings, and pending reviews

- **Full commit:** `34b53335a990c800c3f2a55205872d49db889176`
- **Files touched:** .claude/settings.local.json, .codacy/.gitignore, .codacy/codacy.config.baseline.json, .codacy/codacy.config.json, .vscode/mcp.json, .vscode/settings.json, CLAUDE.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc.

## 2026-08-08 — 0c3409b — Add Foundry agent tracing tests

- **Full commit:** `0c3409b635a12bd3e469475d694297fa685efe5e`
- **Files touched:** tests/__pycache__/test_tracing.cpython-314.pyc, tests/test_tracing.py
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc.

## 2026-08-08 — bb42281 — gitignore: exclude Python __pycache__ and bytecode files

- **Full commit:** `bb42281beacfa448b37d3b32ef25d4885daa0625`
- **Files touched:** .gitignore
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc.

## 2026-08-08 — ac05777 — Time tracking: auto-log rows for commits 0c3409b and bb42281

- **Full commit:** `ac057771f4c46e384a4a612e62da234aee445868`
- **Files touched:** docs/time-tracking.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc.

## 2026-08-08 — 13a909f — Time tracking: log commit HH:MM as day-timeline marker

- **Full commit:** `13a909fe377efa76d11232402d7291ed40363560`
- **Files touched:** docs/time-tracking.md, scripts/git-hooks/post-commit
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc.

## 2026-08-08 — 2b2d40b — Implement Story 6.6 platform admin console

- **Full commit:** `2b2d40bf77361a8854fbd0c7a2c98c3379aec269`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc.

## 2026-08-08 — 77e1bfc — Log Story 6.6 in the Implementation Log

- **Full commit:** `77e1bfcbdd5bc56a14feb42cd4d2dde85d17f27e`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing c33353d/5b7a69f/488ac49/34b5333/0c3409b/bb42281/ac05777/13a909f/2b2d40b/77e1bfc.

## 2026-08-08 — 8abdb48 — feat: add azd and ai agent deployment config

- **Full commit:** `8abdb485b7aed35e56cd01d61042d6fb30435ee9`
- **Files touched:** .vscode/launch.json, .vscode/tasks.json, Dockerfile, README.md, agent-framework-agent-with-local-tools-responses/.gitignore, agent-framework-agent-with-local-tools-responses/AGENTS.md, agent-framework-agent-with-local-tools-responses/CLAUDE.md, agent-framework-agent-with-local-tools-responses/README.md, agent-framework-agent-with-local-tools-responses/azure.yaml, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.azdignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.dockerignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.env.example, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/Dockerfile, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/main.py, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/requirements.txt, azd-ai-agents-2026-08-08.log, azure.yaml, infra/main.bicep, main.py, requirements.txt, tests/test_tracing.py
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 4ff04cd/8abdb48.

## 2026-08-09 — 0b9e1dd — ADR changes and updates approvals - VSCode Copilot Registration and project optimizations

- **Full commit:** `0b9e1dd8fa91dd687cf9fce80ae7bb32dc504223`
- **Files touched:** .codacy/codacy.config.baseline.json, .codacy/codacy.config.json, .vscode/mcp.json, .vscode/settings.json, AGENTS.md, docs/adr/0042-wikipedia-connector-mediawiki-api-article-as-author.md, docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md, docs/adr/0045-Audit Trail Architecture for Tenant User Access Management.md, docs/adr/0046-Admin UI Authentication and Authorization Architecture.md, docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md, docs/adr/README.md, requirements.txt, tests/__pycache__/test_tracing.cpython-314.pyc
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 0b9e1dd/11186b7.

## 2026-08-09 — 11186b7 — update github copilot instructions

- **Full commit:** `11186b74ec794a3c48020bc8c53d6516b20ef9b0`
- **Files touched:** .github/copilot-instructions.md, .github/prompts/plan-socialEngage.prompt.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 0b9e1dd/11186b7.

## 2026-08-09 — 10fc934 — feat: Story 1.8 — GET /v1/tenants/me tenant self-view endpoint (ADR-0031)

- **Full commit:** `10fc934ac8ba79019d702a966cc942b9ca5f7336`
- **Files touched:** social-listening-core/.claude/skills/tenants/SKILL.md, social-listening-core/contracts/epic-1/story-1.8.tenant-self-view.contract.test.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantSelfViewRouter.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 10fc934/4de308e/75cc58d/3badf2f/afd270f.

## 2026-08-09 — 4de308e — heal: Story 3.5 — fix archival partition eligibility boundary condition (ADR-0018)

- **Full commit:** `4de308ee4205d22c211d61c6c6ebdfe551be1af8`
- **Files touched:** social-listening-core/src/archival/socialPostArchival.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 10fc934/4de308e/75cc58d/3badf2f/afd270f.

## 2026-08-09 — 75cc58d — docs: ADR-0018 amendment + SKILL.md update for partition eligibility boundary fix

- **Full commit:** `75cc58d27d806fafa4cc01bd7f5c59d7f35c6a20`
- **Files touched:** docs/adr/0018-data-retention-and-archival-policy.md, social-listening-core/.claude/skills/data-retention-and-archival/SKILL.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 10fc934/4de308e/75cc58d/3badf2f/afd270f.

## 2026-08-09 — 3badf2f — feat: Story 1.9 — user invitation and offboarding REST surface (ADR-0032)

- **Full commit:** `3badf2f61c8da29a80af914be86525d7ea833efa`
- **Files touched:** social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/contracts/epic-1/story-1.9.user-invite-offboard.contract.test.ts, social-listening-core/contracts/epic-5/story-5.9.users-table-identity-resolution.contract.test.ts, social-listening-core/migrations/0024_create_user_access_audit_log.sql, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts, social-listening-core/src/identity/identityResolution.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 10fc934/4de308e/75cc58d/3badf2f/afd270f.

## 2026-08-09 — afd270f — docs: implementation log entry for Story 1.9

- **Full commit:** `afd270fbe4e57ebd1371c853265295b0d95719e7`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 10fc934/4de308e/75cc58d/3badf2f/afd270f.

## 2026-08-09 — 2b44637 — feat: Story 6.7 — self-service tenant sign-up UI (ADR-0037)

- **Full commit:** `2b4463747b872565c0d954004027450dd53b8c5b`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md, social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts, social-listening-admin/src/app/api/auth/callback/route.ts, social-listening-admin/src/app/api/auth/signup/route.ts, social-listening-admin/src/app/sign-up/already-have-account/page.tsx, social-listening-admin/src/app/sign-up/domain-taken/page.tsx, social-listening-admin/src/app/sign-up/error/page.tsx, social-listening-admin/src/app/sign-up/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/signupFlow.ts, social-listening-admin/src/proxy.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 2b44637/d114c16.

## 2026-08-09 — d114c16 — docs: implementation log entry for Story 6.7

- **Full commit:** `d114c16032ff3a3c6e03839b58e67fa85d99bdee`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing 2b44637/d114c16.

## 2026-08-10 — 832f7b3 — heal: parallel-worker race between Story 6.1/6.7's spawned dev servers

- **Full commit:** `832f7b3eaadf1a2b6d1e7ebb4cd1e0e92883efe5`
- **Files touched:** social-listening-admin/.claude/skills/admin-auth-session/SKILL.md, social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts, social-listening-admin/next.config.js
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 09160c4 — docs: implementation log entry for healing pass (6.1/6.7 dev-server race)

- **Full commit:** `09160c43570f3c71095a75dbee641486a2e03107`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — c89ee47 — chore: regenerate next-env.d.ts/tsconfig.json for per-test distDir

- **Full commit:** `c89ee47eadb4c3bffa66d1e19ac37da4dba5df13`
- **Files touched:** social-listening-admin/next-env.d.ts, social-listening-admin/tsconfig.json
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 6b7fc00 — feat: Story 6.8 — Tenant-Admin user invitation and management screen

- **Full commit:** `6b7fc0022b3efc0f7861318033fdeb0ff0831ff1`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts, social-listening-admin/src/app/api/tenant-users/[id]/route.ts, social-listening-admin/src/app/api/tenant-users/route.ts, social-listening-admin/src/app/tenant/users/AccessControl.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 09b626f — docs: implementation log entries for Story 6.8 and its healing follow-up

- **Full commit:** `09b626faf39b7ba370ecaab2fef1db11e2a1ff7e`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 9ec62fa — feat: Story 6.9 — tenant settings screen

- **Full commit:** `9ec62fa80123edf68b5f28f3b3877c46f2e2f53a`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/tenant-settings/SKILL.md, social-listening-admin/contracts/epic-6/story-6.9.tenant-settings-screen.contract.test.ts, social-listening-admin/src/app/tenant/settings/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 1e18c4b — docs: implementation log entry for Story 6.9

- **Full commit:** `1e18c4b6bba373ac526df14cd47c04f4a380ffd3`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 3661ce9 — feat: Story 6.10 — Same-Domain Invite Assist view, closing out Epic 6

- **Full commit:** `3661ce90591765bf672b9278bb17fa9f61eb174a`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/same-domain-invite-assist/SKILL.md, social-listening-admin/contracts/epic-6/story-6.10.same-domain-invite-assist-view.contract.test.ts, social-listening-admin/src/app/tenant/invite-assist/page.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 19d50d7 — docs: implementation log entry for Story 6.10

- **Full commit:** `19d50d74f254ac4c5e5bcdb2525f635ca10baa75`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 5fe1999 — feat: Story 5.17 — access-history read endpoint (ADR-0032 §9)

- **Full commit:** `5fe1999c67f0d55a3a851788602d86c423347ac1`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/contracts/epic-5/story-5.17.access-history-read-endpoint.contract.test.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts, social-listening-core/src/identity/identityResolution.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — f0e3c36 — docs: implementation log entry for Story 5.17

- **Full commit:** `f0e3c361e7c948e4415a7c0219bba4d0bef0682d`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 99b58c3 — heal: retry break-glass password-reset/TAP calls on transient Graph 409s

- **Full commit:** `99b58c31f8b129e85227336cc52bd0aa88b1bba3`
- **Files touched:** social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/src/admin/breakGlassCredentialReset.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — d78c598 — docs: implementation log entry for break-glass retry healing pass

- **Full commit:** `d78c598861351f6f326918bb9e54e3de3506699e`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 7a2466d — feat: Story 5.18 — self-service sign-up rate limiting (ADR-0040)

- **Full commit:** `7a2466d27958c1d36a5c02a116130eac1d9064eb`
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md, social-listening-core/contracts/epic-5/story-5.18.signup-rate-limiting.contract.test.ts, social-listening-core/src/http/versions/v1/selfServiceSignupRouter.ts, social-listening-core/src/tenants/signupRateLimit.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — d1ad0c6 — docs: implementation log entry for Story 5.18

- **Full commit:** `d1ad0c6f549e79074052a9a75bb45b1f5ec64889`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — f70b07d — feat: Story 2.8 — Azure AI Language connector, real AIProviderConnector (ADR-0038)

- **Full commit:** `f70b07dacee68d618c2537c705e300a91a6d83a0`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/.claude/skills/social-post-enrichment/SKILL.md, social-listening-core/contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts, social-listening-core/contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/azureAiLanguageConnector.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts, social-listening-core/src/connectors/examples/exampleAiProviderY.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/types.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 80cc28d — docs: implementation log entry for Story 2.8

- **Full commit:** `80cc28d676ad6c4377e0f2f3a626eaaec1a7a0f2`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 1e7e9ac — docs: ADR-0038 amendment — Foundry Local rejected, Azure OpenAI Service selected for Story 2.9

- **Full commit:** `1e7e9ac785414a7527298c0188322f369ce6e825`
- **Files touched:** docs/adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 54b32fa — docs: ADR-0038 correction — gpt-4o-mini deprecated, gpt-5-mini deployed instead

- **Full commit:** `54b32fa5f67ae65d20320e733377945af775b09b`
- **Files touched:** docs/adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 69310ba — feat: Story 2.9 — second AIProviderConnector, Azure OpenAI (gpt-5-mini), provider swappability

- **Full commit:** `69310ba80ae4be83e51e5cf4f7c7f51063b3cbdd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts, social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 9007da1 — docs: implementation log entry for Story 2.9

- **Full commit:** `9007da1efbf888cfef55168c6eab6379aca9d558`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 292a22a — feat: Story 2.9 follow-up — self-review + overallConfidence for Azure OpenAI enrichment

- **Full commit:** `292a22adcc17be9e3190900618444f240c6ef6ed`
- **Files touched:** social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts, social-listening-core/src/connectors/types.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — d936082 — docs: implementation log addendum for Story 2.9 self-review/overallConfidence follow-up

- **Full commit:** `d936082690e4b8da7c23b4e4945aafdcf72d065f`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 8e1ac18 — docs: draft ADR-0049 and ADR-0050 (Proposed) from Cursor Composer brainstorm session

- **Full commit:** `8e1ac18a8aade52395a733d430ab4cabfd258b17`
- **Files touched:** docs/adr/0004-author-normalized-separately-from-post.md, docs/adr/0049-point-in-time-author-follower-count-on-social-post.md, docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md, docs/adr/README.md, docs/open-decisions.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 7d978e0 — docs: correct overstated Story 6.3 connect-flow claims in AI connector SKILL.mds

- **Full commit:** `7d978e0bd46f8b8823cd4f8d6e74316670bf8900`
- **Files touched:** social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 1dbd26a — heal: Story 6.3 — real connector connect/disconnect flow, not a static placeholder

- **Full commit:** `1dbd26a6e8a9f0180d25f8dd22df8fea73b656da`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/src/app/api/connectors/[platformId]/connect/route.ts, social-listening-admin/src/app/api/connectors/[platformId]/disconnect/route.ts, social-listening-admin/src/app/tenant/connectors/ConnectForm.tsx, social-listening-admin/src/app/tenant/connectors/DisconnectButton.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — d545174 — docs: implementation log entry for Story 6.3 healing pass

- **Full commit:** `d545174725734e5664bdb733b3e546d7528e042a`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 15756e0 — heal: Story 1.4 — withDevEnv.js never loaded .env, only jest's test setup did

- **Full commit:** `15756e00df0a2a74ee5027f3fe3e35af165070d3`
- **Files touched:** social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/contracts/epic-1/story-1.4-fixtures/printEnvAndArgv.js, social-listening-core/contracts/epic-1/story-1.4-fixtures/test-fixture.env, social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts, social-listening-core/scripts/withDevEnv.js
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — de96102 — docs: implementation log entry for Story 1.4 withDevEnv.js healing pass

- **Full commit:** `de96102e84c6a9e4b930a4af3fe9c5181dad980b`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — dba9895 — heal: Story 6.1 — real Platform Admin sign-in blocked by missing OAuth scope and oid-vs-sub seed error

- **Full commit:** `dba98958df63edd3e9d2c1ff0bc0dc2d96cdfb2b`
- **Files touched:** docs/adr/0029-authentication-mechanism-entra-external-id.md, social-listening-admin/.claude/skills/admin-auth-session/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/src/lib/entra.ts, social-listening-core/.claude/skills/identity-resolution/SKILL.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 6d08379 — docs: implementation log entry for Story 6.1 OAuth-scope healing pass

- **Full commit:** `6d08379b3c2439d968fb874576193c35628a95c5`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 35b70a8 — heal: Story 6.2 — a successful platform_admin sign-in lands on / with only a manual link

- **Full commit:** `35b70a822353fc0b5641a8da4007a932aca3d03f`
- **Files touched:** social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/src/app/page.tsx
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 596b2c3 — docs: implementation log entry for Story 6.2 root-redirect healing pass

- **Full commit:** `596b2c36900d4c44b5e39a049c1614e4b87e5fec`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — f4c50db — docs: record real Entra tenant-config prerequisites found during live self-service sign-up test

- **Full commit:** `f4c50dbe3143138d732f23054255a665edbc9fdb`
- **Files touched:** social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 49eaa50 — docs: backlog a future ADR candidate — richer self-service sign-up business-details form

- **Full commit:** `49eaa5012d60a5d464c3c3b476947f1eb354ca86`
- **Files touched:** docs/adr/README.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — 4551e26 — docs: backlog missing invite-withdrawal capability, found during live invite testing

- **Full commit:** `4551e2672bc6b7d4279837a392f668514b79afd4`
- **Files touched:** social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-core/.claude/skills/identity-resolution/SKILL.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing the 2026-08-10 batch (832f7b3 through 4551e26, see docs/management/manager-register.md entry for the full commit list).

## 2026-08-10 — f36d765 — heal: Story 5.15 — self-service tenant founder never consumed a seat

- **Full commit:** `f36d765af41efe84c8c9df6a882a33d5b9ae53a9`
- **Files touched:** social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md, social-listening-core/contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts, social-listening-core/src/tenants/selfServiceSignup.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing f36d765/3ae641e.

## 2026-08-10 — 3ae641e — docs: implementation log entry for Story 5.15 seat-count healing pass

- **Full commit:** `3ae641ecdbbc0420a6fdf5de20f8cd26daa4a2ae`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-10:** see docs/management/manager-register.md reviewing f36d765/3ae641e.

## 2026-08-10 — 9eef81b — chore: remove unrelated Microsoft Foundry Python sample project and stray azd scaffolding

- **Full commit:** `9eef81ba06f7970bb4afccdd15fab531c58aec54`
- **Files touched:** agent-framework-agent-with-local-tools-responses/.gitignore, agent-framework-agent-with-local-tools-responses/AGENTS.md, agent-framework-agent-with-local-tools-responses/CLAUDE.md, agent-framework-agent-with-local-tools-responses/README.md, agent-framework-agent-with-local-tools-responses/azure.yaml, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.azdignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.dockerignore, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/.env.example, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/Dockerfile, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/main.py, agent-framework-agent-with-local-tools-responses/src/agent-framework-agent-with-local-tools-responses/requirements.txt, azd-ai-agents-2026-08-08.log, azure.yaml, main.py, tests/__pycache__/test_tracing.cpython-314.pyc, tests/test_tracing.py
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 9eef81b/8018de4.

## 2026-08-10 — 8018de4 — chore: remove .vscode/tasks.json and launch.json, dead since the Foundry sample's removal

- **Full commit:** `8018de477a0eb113c088bedbd7159bd5fb92c2c2`
- **Files touched:** .vscode/launch.json, .vscode/tasks.json
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 9eef81b/8018de4.

## 2026-08-11 — 8dff76b — docs: ADR governance pass — accept ADR-0044/0047/0048/0049/0050, resolve resulting stories

- **Full commit:** `8dff76ba2186816c7e7d39544a201d6aa75967e1`
- **Files touched:** docs/adr/0004-author-normalized-separately-from-post.md, docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md, docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md, docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md, docs/adr/0049-point-in-time-author-follower-count-on-social-post.md, docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md, docs/adr/README.md, docs/future-subsystems.md, docs/open-decisions.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 8dff76b.

## 2026-08-12 — aaf6bd7 — feat: rebuild Story 1.5 watchlist CRUD against ADR-0044 (personal ownership, RFC 7396 PATCH, optimistic locking)

- **Full commit:** `aaf6bd72f312ce7df0dc60a376f2f893f3e1508c`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/watchlist-crud/SKILL.md, social-listening-core/contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts, social-listening-core/contracts/epic-3/story-3.8.self-service-tenant-initiated-deletion.contract.test.ts, social-listening-core/contracts/epic-5/story-5.10.retire-x-tenant-id.contract.test.ts, social-listening-core/migrations/0025_watchlists_ownership_and_versioning.sql, social-listening-core/src/db/withTenant.ts, social-listening-core/src/http/versions/v1/watchlistsRouter.ts, social-listening-core/src/tenants/tenantDeletion.ts, social-listening-core/src/watchlists/watchlistStore.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — c5fca67 — docs: implementation log entry for Story 1.5 watchlist ownership rebuild

- **Full commit:** `c5fca6765784532ecb8421b66ec2d980278a9f20`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — 63dcbce — feat: Story 1.10 -- Postgres boot-time readiness check and a real /v1/health

- **Full commit:** `63dcbced329a86999edbe2889db30f574c8c2dfd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/http-api-versioning/SKILL.md, social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/contracts/epic-1/story-1.10.postgres-readiness-and-health.contract.test.ts, social-listening-core/src/db/postgresReadiness.ts, social-listening-core/src/http/server.ts, social-listening-core/src/http/versions/v1/router.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — 0694d2c — docs: implementation log entry for Story 1.10 Postgres readiness check

- **Full commit:** `0694d2c07b86ea7d61d5e6c9c0ecbbbb131e814e`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — 8cf76a2 — chore: stop tracking .claude/settings.local.json, gitignore it

- **Full commit:** `8cf76a2f3bdfe29a22404d19e92e7735312cff10`
- **Files touched:** .claude/settings.local.json, .gitignore
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — f2c7788 — feat: Story 2.10 -- connector registration transparency, mechanically enforced (ADR-0048)

- **Full commit:** `f2c7788f4d21c971ed93488e5939392bf98504bb`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — 9f90a82 — docs: implementation log entry for Story 2.10 connector registration transparency

- **Full commit:** `9f90a82063c95f83f3e13523fb63898f72c9ed50`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — afcb59e — feat: Story 2.11 -- tenant-owned-domain RSS connector with DNS TXT verification (ADR-0050)

- **Full commit:** `afcb59ed8e7dee15d261dbee6c5860783f3c6c8b`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts, social-listening-core/contracts/epic-2/story-2.11.tenant-owned-feed-connector.contract.test.ts, social-listening-core/migrations/0026_create_tenant_owned_feed_activations.sql, social-listening-core/src/connectors/tenantOwnedFeed/dnsVerification.ts, social-listening-core/src/connectors/tenantOwnedFeed/feedItemParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedConnector.ts, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantOwnedFeedRouter.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — 9f09393 — docs: implementation log entry for Story 2.11 tenant-owned-feed connector

- **Full commit:** `9f093933e2d7df0eada850f170ebe95fc1850516`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — 34e9dfb — feat: Story 3.9 -- point-in-time author follower count on SocialPost (ADR-0049)

- **Full commit:** `34e9dfb8ae712a992ae275d6eb82221c64f9a3d8`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-3/story-3.9.author-follower-count-at-publish.contract.test.ts, social-listening-core/migrations/0027_add_social_posts_author_follower_count_at_publish.sql, social-listening-core/src/connectors/types.ts, social-listening-core/src/posts/socialPostStore.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — 3d650c8 — docs: implementation log entry for Story 3.9 author follower count at publish

- **Full commit:** `3d650c8f6deecd8f565f7bdc265eef369eed47a5`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — 4cd4ef1 — docs: correct wrong commit hash on the 2026-08-01 Story 1.5 implementation-log entry

- **Full commit:** `4cd4ef1618971b3e35966a69750cf9d5b9cffb6d`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing aaf6bd7/c5fca67/63dcbce/0694d2c/8cf76a2/f2c7788/9f90a82/afcb59e/9f09393/34e9dfb/3d650c8/4cd4ef1.

## 2026-08-12 — fded97b — feat(social-listening-admin): rebuild Story 6.4 watchlist screen for real, against ADR-0044

- **Full commit:** `fded97b08813d7ab686582410c7d99668e5d4eac`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md, docs/user-stories/epic-6-tenant-admin-ui.md, docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/watchlist-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts, social-listening-admin/src/app/api/watchlists/[id]/route.ts, social-listening-admin/src/app/api/watchlists/route.ts, social-listening-admin/src/app/tenant/watchlists/WatchlistForm.tsx, social-listening-admin/src/app/tenant/watchlists/WatchlistRow.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — d96d782 — docs: implementation log entry for Story 6.4 watchlist screen rebuild

- **Full commit:** `d96d782380bc109a2f8d718c4f1eaa5e0f99309e`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — 4046e75 — feat(social-listening-admin): rebuild Story 6.5 connector status screen for real

- **Full commit:** `4046e75598214371efa888fbe6bca049e01bd1dd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — 2e77c17 — docs: implementation log entry for Story 6.5 connector status screen rebuild

- **Full commit:** `2e77c179a2152d0a27c588936602b6c715bcdd0d`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — 51eecf0 — feat(social-listening-admin): rebuild Story 6.6 Platform Admin console for real

- **Full commit:** `51eecf0270472fb6d30f30bca3a53b6d0a9557f8`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/break-glass/request/route.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/break-glass/requests/[requestId]/execute/route.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/route.ts, social-listening-admin/src/app/api/admin/tenants/route.ts, social-listening-admin/src/app/platform-admin/BreakGlassPanel.tsx, social-listening-admin/src/app/platform-admin/ProvisionTenantForm.tsx, social-listening-admin/src/app/platform-admin/TenantAdminControls.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — 7102011 — docs: implementation log entry for Story 6.6 Platform Admin console rebuild

- **Full commit:** `710201121f23d5f5afd9c6e04c98e7ee340c2821`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — feae698 — feat(social-listening-admin): show Active/Inactive on every connector, not just connected ones

- **Full commit:** `feae698d9a7024381b824fd074866fb9069e4671`
- **Files touched:** docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — e430a6b — docs: implementation log entry for the connector status Active/Inactive indicator

- **Full commit:** `e430a6bfa71157c55c0ce4ae088b122c20686829`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — e6c0617 — docs: ADR governance pass — accept ADR-0051, add Story 1.11

- **Full commit:** `e6c0617c745db7d9b91ef4989146b90d7811c28a`
- **Files touched:** docs/adr/0051-connector-activation-decoupled-from-credential.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — 18a0e38 — docs: companion ADR-0051 cross-reference notes — ADR-0009/0010/0022/0023/0024/0034

- **Full commit:** `18a0e38aa05b479cfb447410864a2482ab2fe660`
- **Files touched:** docs/adr/0009-connector-health-derived-not-stored.md, docs/adr/0010-error-handling-and-auto-disable-policy.md, docs/adr/0022-derived-data-caching-and-refresh-strategy.md, docs/adr/0023-proportional-connector-failure-threshold.md, docs/adr/0024-newswire-connector-direct-wire-rss-issuer-as-author.md, docs/adr/0034-connector-connect-disconnect-crud-ownership-tier-aware.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — 703e755 — feat: Story 1.11 — connector activation decoupled from credential presence

- **Full commit:** `703e7558d46e43461505ddb2eaca5380a6dd4ed5`
- **Files touched:** docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-core/contracts/epic-1/story-1.11.connector-activation.contract.test.ts, social-listening-core/contracts/epic-2/story-2.3.error-handling-auto-disable.contract.test.ts, social-listening-core/contracts/epic-2/story-2.4.bounded-queues-and-dead-lettering.contract.test.ts, social-listening-core/migrations/0028_create_connector_activations.sql, social-listening-core/src/connectors/connectorActivationStore.ts, social-listening-core/src/connectors/connectorHealth.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — 7ffd477 — docs: implementation log entry for Story 1.11 (social-listening-core@703e755)

- **Full commit:** `7ffd477322970f0e4d14d2d2f804ee12f1bc74ae`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — f8985b9 — docs: draft Stories 1.12, 2.12, 6.15 — closing three of Story 1.11's own named gaps

- **Full commit:** `f8985b977ec8382bdce9c79648a8b66ef3f224c9`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing fded97b/d96d782/4046e75/2e77c17/51eecf0/7102011/feae698/e430a6b/e6c0617/18a0e38/703e755/7ffd477/f8985b9.

## 2026-08-12 — c3af2a7 — feat: Story 1.12 — GET /v1/connectors/:platformId includes real isActive

- **Full commit:** `c3af2a7aa5d0ab439773a8edab512c2576737aa0`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/contracts/epic-1/story-1.12.connector-status-includes-activation.contract.test.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — c481e01 — docs: implementation log entry for Story 1.12 (social-listening-core@c3af2a7)

- **Full commit:** `c481e0135d4cd3ce1cfbfa48a26b8d28702025fa`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — da102a9 — feat: Story 2.12 — exclude retryable failures from the failing derivation

- **Full commit:** `da102a9e51f8229a7e617371efaa1c490d2fa2b6`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/contracts/epic-2/story-2.12.retryable-failures-excluded-from-auto-disable.contract.test.ts, social-listening-core/src/connectors/connectorHealth.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 5adff09 — docs: implementation log entry for Story 2.12 (social-listening-core@da102a9)

- **Full commit:** `5adff094d2b35fce849dae6efb96b2566e904d13`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 8abacce — docs: draft Story 2.13 — closing a real gap, ADR-0042 (Wikipedia) never got a story

- **Full commit:** `8abaccecdeba7c5534359297a2812c25f54142e6`
- **Files touched:** docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — cc7cae2 — feat: Story 6.15 — activate/deactivate controls on the connector screens

- **Full commit:** `cc7cae26080787f8221632552187c6fb6e2b942b`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/api/connectors/[platformId]/activate/route.ts, social-listening-admin/src/app/api/connectors/[platformId]/deactivate/route.ts, social-listening-admin/src/app/tenant/connectors/ActivateDeactivateButton.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 62d78ff — docs: implementation log entry for Story 6.15 (social-listening-admin@cc7cae2)

- **Full commit:** `62d78ffa57dd134cacef6aa076835123c047a4d5`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 6e110aa — fix: reject unresolved identity in admin role-gating (Story 6.2 healing)

- **Full commit:** `6e110aa7c5f2759d76822f52226b89312b0271dc`
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/lib/role-routing.ts, social-listening-core/scripts/ensureContractTestIdentity.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — eb8b10b — docs: implementation log entry for the Story 6.2 role-gating healing pass

- **Full commit:** `eb8b10b2deee116df913c1f401b33edca7fe1bf3`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 4801a36 — fix: run pending migrations automatically before social-listening-core's dev server starts

- **Full commit:** `4801a36b470d8f8c48778b43020db18129443b55`
- **Files touched:** social-listening-core/README.md, social-listening-core/package.json
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — d8ba590 — feat: Story 6.11 — post feed screen in social-listening-admin

- **Full commit:** `d8ba590883512f353ed9c79872a321a5a30ad02f`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/app/tenant/posts/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts, social-listening-admin/src/lib/core-client.ts, social-listening-core/.claude/skills/posts-api/SKILL.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 6362dda — docs: implementation log entry for Story 6.11 (social-listening-admin@d8ba590)

- **Full commit:** `6362dda3d38ffbdf1365624d7a3fc4491e1459b1`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 99c1dcf — fix: activation now gates AI enrichment provider selection (Story 2.9 healing)

- **Full commit:** `99c1dcf04f08cc6d358e753df390b5802a56e728`
- **Files touched:** social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/social-post-enrichment/SKILL.md, social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts, social-listening-core/contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 43d36ca — feat: show which AI provider enriched a post on the detail screen

- **Full commit:** `43d36caa6094083c993bb774c49ca9e2e0acc853`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 3b5f08b — docs: implementation log entries for the AI provider activation-gating fix and enrichment attribution enhancement

- **Full commit:** `3b5f08bc0b5c916607f841a090c49610761473ce`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 216c32a — style: global baseline stylesheet for social-listening-admin

- **Full commit:** `216c32a048151d6c802580ded68dc4131ee54423`
- **Files touched:** social-listening-admin/src/app/globals.css, social-listening-admin/src/app/layout.tsx
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — e556c3c — docs: name the AI-provider status display gap on the connector status screen

- **Full commit:** `e556c3ca630a7d5d5f7f5106f88798715e7f6bf0`
- **Files touched:** social-listening-admin/.claude/skills/connector-status-view/SKILL.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 51a2b40 — feat: Story 6.16 (backend) — POST /v1/posts/:id/enrich

- **Full commit:** `51a2b4055acec4a4b07abfcb89e3b0f0f2b25120`
- **Files touched:** social-listening-core/.claude/skills/posts-api/SKILL.md, social-listening-core/contracts/epic-3/story-6.16.post-manual-enrich-endpoint.contract.test.ts, social-listening-core/src/http/versions/v1/postsRouter.ts, social-listening-core/src/posts/socialPostStore.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 21da4f5 — feat: Story 6.16 (frontend) — manual "run enrichment now" button

- **Full commit:** `21da4f57568300c80047ceaa62e3e091ee7e02ad`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.16.manual-enrichment-button.contract.test.ts, social-listening-admin/src/app/api/posts/[id]/enrich/route.ts, social-listening-admin/src/app/tenant/posts/RunEnrichmentButton.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — e5fec8f — docs: Story 6.16 traceability and implementation log entries

- **Full commit:** `e5fec8fe0b46cb7c2dd7c9911249a92e2e423c22`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — ab37bf3 — docs: clarify break-glass request intake channel (ADR-0030, Story 5.13)

- **Full commit:** `ab37bf330c9a9049554771efc032e240a31752d2`
- **Files touched:** docs/adr/0030-admin-tier-design-platform-admin-rls-exception.md, docs/user-stories/epic-5-security-isolation-and-messaging.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — f5bb2d4 — feat: tenant rename (PATCH /v1/admin/tenants/:id gains name)

- **Full commit:** `f5bb2d4fbc30fb9d671ebde3c13501ac27f8c162`
- **Files touched:** docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/route.ts, social-listening-admin/src/app/platform-admin/TenantAdminControls.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-core/.claude/skills/platform-admin-tenant-management/SKILL.md, social-listening-core/.claude/skills/tenants/SKILL.md, social-listening-core/contracts/epic-5/story-5.12.platform-admin-tenant-management.contract.test.ts, social-listening-core/migrations/0029_grant_platform_admin_name_update.sql, social-listening-core/src/http/versions/v1/adminTenantsRouter.ts, social-listening-core/src/tenants/tenantStore.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 8905c21 — docs: implementation log entry for tenant rename enhancement (cross-repo@f5bb2d4)

- **Full commit:** `8905c219aae9f3b3d08b6bac87d3ffa01491b8c4`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — c2aa7b1 — feat: ProvisionTenantForm gains an optional domain field

- **Full commit:** `c2aa7b121882b97bbc5a6041eb68aa7a2c77d2d2`
- **Files touched:** docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/api/admin/tenants/route.ts, social-listening-admin/src/app/platform-admin/ProvisionTenantForm.tsx
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-12 — 8b54aae — docs: implementation log entry for ProvisionTenantForm domain field (social-listening-admin@c2aa7b1)

- **Full commit:** `8b54aaebc1bc3caf213c0e7503742844d830fe10`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing c3af2a7/c481e01/da102a9/5adff09/8abacce/cc7cae2/62d78ff/6e110aa/eb8b10b/4801a36/d8ba590/6362dda/99c1dcf/43d36ca/3b5f08b/216c32a/e556c3c/51a2b40/21da4f5/e5fec8f/ab37bf3/f5bb2d4/8905c21/c2aa7b1/8b54aae.

## 2026-08-13 — 57fe1de — docs: correct CLAUDE.md's stale Epic 6 build-status summary

- **Full commit:** `57fe1def1dbea307fd10f243c10584afa3144c21`
- **Files touched:** CLAUDE.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc.

## 2026-08-13 — e1e9913 — feat: tenant-owned-feed connector setup UI (Story 6.12, ADR-0050)

- **Full commit:** `e1e99139dedaa53eef7c018ba468ce934919c7a9`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/connect/route.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/verify-domain/route.ts, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc.

## 2026-08-13 — b155bc5 — docs: implementation log entry for Story 6.12 (social-listening-admin@e1e9913)

- **Full commit:** `b155bc51fb84952fb8c28367e26ee20d992401da`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc.

## 2026-08-13 — 500a4b9 — feat: self-service tenant deletion/offboarding UI (Story 6.13, ADR-0043)

- **Full commit:** `500a4b9a4383f1e01330c0e322e9c44e55ecf6ff`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/tenant-deletion-offboarding/SKILL.md, social-listening-admin/contracts/epic-6/story-6.13.tenant-deletion-offboarding.contract.test.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/confirm/route.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/export/route.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/request/route.ts, social-listening-admin/src/app/api/tenants/self-service-deletion/route.ts, social-listening-admin/src/app/tenant/settings/delete/TenantDeletionPanel.tsx, social-listening-admin/src/app/tenant/settings/delete/page.tsx, social-listening-admin/src/lib/core-client.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc.

## 2026-08-13 — 42ff7b5 — docs: implementation log entry for Story 6.13 (social-listening-admin@500a4b9)

- **Full commit:** `42ff7b5e82f62989bb1e14c6b40b187b2876c574`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc.

## 2026-08-13 — a479383 — feat: live ingestion-polling scheduler (Story 1.13, ADR-0052)

- **Full commit:** `a479383e2ae200b104732986531f47952971289b`
- **Files touched:** docs/adr/0052-live-ingestion-polling-scheduler.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/.claude/skills/live-ingestion-polling-scheduler/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts, social-listening-core/src/connectors/bootstrapConnectors.ts, social-listening-core/src/connectors/types.ts, social-listening-core/src/http/server.ts, social-listening-core/src/scheduler/pollScheduler.ts
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc.

## 2026-08-13 — 9a347c6 — docs: implementation log entry for Story 1.13 (social-listening-core@a479383)

- **Full commit:** `9a347c65f142bfb13d11b311d00fff464a7b96da`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc.

## 2026-08-13 — d0eb088 — feat: tenant-wide activate/deactivate control on tenant-owned-feed screen (Story 6.17, ADR-0051)

- **Full commit:** `d0eb08813a3d083602bd05ed8349a6fae880fc5a`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.17.tenant-owned-feed-activation-control.contract.test.ts, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/page.tsx
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc.

## 2026-08-13 — 780f981 — docs: implementation log entry for Story 6.17 (social-listening-admin@d0eb088)

- **Full commit:** `780f9817c6516eefb487afadc9255151316301b8`
- **Files touched:** docs/implementation-log.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc.

## 2026-08-13 — bd9bbfc — docs: accept ADR-0053, draft Story 3.10 (canonical Markdown post-body normalization)

- **Full commit:** `bd9bbfc1e35a2ee821bd362be70e00a2d6b506fe`
- **Files touched:** docs/adr/0053-canonical-markdown-post-body-normalization-at-ingestion.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- ~~**Status:** Pending review~~
**Resolved 2026-08-14:** see docs/management/manager-register.md's entry reviewing 57fe1de/e1e9913/b155bc5/500a4b9/42ff7b5/a479383/9a347c6/d0eb088/780f981/bd9bbfc.

## 2026-08-13 — 13f5163 — docs: clear review backlog — Documentation Steward, L&D Writer, Ideal Manager passes (2026-08-13)

- **Full commit:** `13f5163e336b549c0bfb573021b6965114d7c578`
- **Files touched:** docs/adr/0051-connector-activation-decoupled-from-credential.md, docs/adr/feature-coverage-review.md, docs/implementation-log.md, docs/management/manager-register.md, docs/management/pending-manager-reviews.md, docs/manuals/system-admin-manual.md, docs/manuals/tenant-admin-manual.md, docs/manuals/user-manual.md, docs/open-decisions.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/project docs/Business-Case-v6.0.md, docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md, docs/project docs/Stakeholder-Register.md
- **Status:** Pending review

## 2026-08-13 — dcec172 — feat: Story 3.10 — canonical Markdown post-body storage and enrichment input (ADR-0053)

- **Full commit:** `dcec172f4f940fa048a3f05a2063e69628af0dc6`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/canonical-markdown-conversion/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.6.newswire-connector.contract.test.ts, social-listening-core/contracts/epic-3/story-3.10.canonical-markdown-post-body-normalization.contract.test.ts, social-listening-core/migrations/0030_add_social_posts_body_markdown.sql, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/src/connectors/gnews/gnewsConnector.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/newswire/rssFeedParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/feedItemParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/content/htmlToMarkdown.ts, social-listening-core/src/content/turndown-plugin-gfm.d.ts, social-listening-core/src/posts/socialPostStore.ts
- **Status:** Pending review

## 2026-08-13 — df0c2c3 — docs: implementation log entry for Story 3.10 (social-listening-core@dcec172)

- **Full commit:** `df0c2c3bbac458a9846e2c26adeb954626fec8e4`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-13 — e59b2da — docs: methodology retrospective — relationship-assertion contracts, story resume, Built field, environment gotchas

- **Full commit:** `e59b2dabf32a9c95529ce6a75e1bdac4e5906dda`
- **Files touched:** .claude/agents/documentation-steward.md, .claude/skills/heal-contract-failure/SKILL.md, .claude/skills/implement-story/SKILL.md, CLAUDE.md, docs/environment-gotchas.md, docs/implementation-methodology.md, docs/project docs/Lessons-Learned-Register.md, docs/templates/component-skill-template.md, docs/user-stories/README.md
- **Status:** Pending review

## 2026-08-13 — 6443562 — chore: rewrite root README, harden AGENTS.md, wire up VS Code test discovery

- **Full commit:** `6443562c92fd966d53f3c581cb46eaf67d35e6be`
- **Files touched:** .mcp.json, .vscode/extensions.json, .vscode/mcp.json, .vscode/settings.json, AGENTS.md, Dockerfile, README.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, requirements.txt, social-listening-admin/next-env.d.ts, social-listening-admin/package-lock.json
- **Status:** Pending review

## 2026-08-13 — 8d210af — chore: post-commit hook queue entries for 6443562

- **Full commit:** `8d210af4300713a0622403ddd79c5c2d2c517740`
- **Files touched:** docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md
- **Status:** Pending review

## 2026-08-17 — ea9d9fe — fix: heal contract staleness from an uncommitted Server/Client component split

- **Full commit:** `ea9d9fe0e58b1ae7b2c3d7b566de5db92d1ee799`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/package-lock.json, social-listening-admin/package.json, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/layout.tsx, social-listening-admin/src/app/platform-admin/layout.tsx, social-listening-admin/src/app/sign-in/page.tsx, social-listening-admin/src/app/signed-out/page.tsx, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/ConnectorStatusClient.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/app/tenant/layout.tsx, social-listening-admin/src/app/tenant/page.tsx, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/RunEnrichmentButton.tsx, social-listening-admin/src/app/tenant/posts/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts, social-listening-admin/src/app/tenant/watchlists/WatchlistForm.tsx, social-listening-admin/src/app/tenant/watchlists/WatchlistRow.tsx, social-listening-admin/src/app/tenant/watchlists/WatchlistsClient.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/components/shell/AppHeader.tsx, social-listening-admin/src/components/shell/AppShell.tsx, social-listening-admin/src/components/shell/AppSidebar.tsx, social-listening-admin/src/components/shell/index.ts, social-listening-admin/src/components/shell/shell.test.ts, social-listening-admin/src/components/ui/ConfirmModal.tsx, social-listening-admin/src/components/ui/EmptyState.tsx, social-listening-admin/src/components/ui/InlineError.tsx, social-listening-admin/src/components/ui/RelativeTime.tsx, social-listening-admin/src/components/ui/Slideover.tsx, social-listening-admin/src/components/ui/StatusBadge.tsx, social-listening-admin/src/components/ui/TagInput.tsx, social-listening-admin/src/components/ui/components.test.ts, social-listening-admin/src/components/ui/index.ts, social-listening-admin/src/lib/core-client.ts
- **Status:** Pending review

## 2026-08-17 — 30816ad — docs: log the 2026-08-17 healing pass for Stories 6.1/6.2/6.3/6.5/6.11/6.12/6.15

- **Full commit:** `30816ad3772725b6d4f69d2de660c17a5363d3e3`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-17 — 5558e11 — feat: Story 8.1 — Analytics dashboard shell, date-range filter, Overview and Sources tabs

- **Full commit:** `5558e11f61be16fce51cb49f31d252c80e11275b`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/src/app/api/analytics/summary/route.ts, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/AnimatedChartTooltip.tsx, social-listening-admin/src/app/tenant/analytics/GlobalDateRangePicker.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/SourcesTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/analytics/fetchAnalyticsSummary.ts, social-listening-admin/src/app/tenant/analytics/page.tsx
- **Status:** Pending review

## 2026-08-17 — 87e8cf4 — docs: ADR-0054 (Analytics Dashboard), Epic 8, and Story 8.1 traceability

- **Full commit:** `87e8cf4baba1c5d846277bbec015e7dd053aefa5`
- **Files touched:** docs/adr/0008-defer-topic-time-series-and-charting.md, docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/README.md, docs/design/frontend-design-specification.md, docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-17 — a54bf05 — feat: Story 8.2 — Sentiment tab

- **Full commit:** `a54bf05bd12b169431c0f224c54016ffd6ea3355`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/SentimentTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts
- **Status:** Pending review

## 2026-08-17 — 05cc132 — docs: log Story 8.2 (Sentiment tab) traceability

- **Full commit:** `05cc1326de12a3a6d9ff8a2f65ff1114766b2330`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-17 — 5fed9dd — feat: Story 8.3 — Conversations tab, closing out Epic 8

- **Full commit:** `5fed9ddaf072c30672a3c1d42fa55ec79723fb5b`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.3.conversations-tab.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/ConversationsTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts
- **Status:** Pending review

## 2026-08-17 — 838ac19 — docs: log Story 8.3 (Conversations tab) traceability, closing out Epic 8

- **Full commit:** `838ac19eb70442139ae78075f9fef4a0d81b5485`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/management/pending-manager-reviews.md, docs/pending-documentation-steward-reviews.md, docs/pending-learning-development-reviews.md, docs/time-tracking.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-17 — 4082a8a — fix: no personal-scope credential/activation UI for AI providers (ADR-0028 Tier 2 only)

- **Full commit:** `4082a8a97b759daa72acf4144a98588db74d4635`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/ConnectorStatusClient.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- **Status:** Pending review

## 2026-08-17 — 5d0fb49 — fix(core): reject personal-scope connect/activate for AI provider connectors

- **Full commit:** `5d0fb49d7174e4941e770ffd0baef4534cd67e98`
- **Files touched:** docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md, social-listening-core/contracts/epic-1/story-1.11.connector-activation.contract.test.ts, social-listening-core/contracts/epic-1/story-1.7.ownership-tier-connect-disconnect.contract.test.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- **Status:** Pending review

## 2026-08-17 — c1275ed — docs: log core-side healing pass, publish infrastructure migration runbook

- **Full commit:** `c1275ed0893c4f8c1865f7b738fafe2748515afe`
- **Files touched:** docs/adr/README.md, docs/implementation-log.md, docs/infrastructure-setup.md
- **Status:** Pending review

## 2026-08-17 — ae015e0 — feat(admin): Story 8.4 — Overview volume/sentiment charts, period-over-period comparison

- **Full commit:** `ae015e001f3f8071df7f02913685ac4f31b0a16d`
- **Files touched:** docs/implementation-plan.md, social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.4.overview-enrichment-period-comparison.contract.test.ts, social-listening-admin/src/app/api/analytics/summary/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/analytics/AnalyticsClient.tsx, social-listening-admin/src/app/tenant/analytics/OverviewTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/analytics/fetchAnalyticsSummary.ts
- **Status:** Pending review

## 2026-08-17 — 63d3604 — docs: log Story 8.4, draft ADR-0055 (language/location enrichment feasibility)

- **Full commit:** `63d3604cf9ce0f416deac19ad2ead26d1bba3c19`
- **Files touched:** docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md, docs/adr/README.md, docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-17 — 6a55e8b — docs: accept ADR-0055, move Story 8.5 to Ready

- **Full commit:** `6a55e8bd4e52452ad83f202ffd838674db1506ec`
- **Files touched:** docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md, docs/adr/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-17 — 8b8bb14 — feat(admin): Story 8.5 — Languages breakdown widget

- **Full commit:** `8b8bb140a9c22ef5b0b77a3b6c2a3352cdd85c3d`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.3.conversations-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.5.languages-breakdown-widget.contract.test.ts, social-listening-admin/src/app/tenant/analytics/ConversationsTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- **Status:** Pending review

## 2026-08-17 — fa457e9 — docs: log Story 8.5, close out Epic 8's traceability

- **Full commit:** `fa457e920bbb1e9f5a8854274780d5344136c9e3`
- **Files touched:** docs/adr/README.md, docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-17 — a17af3f — feat(admin): Story 8.6 — Sources tab per-source sentiment score, volume-over-time

- **Full commit:** `a17af3f6ba8488cda1f28155d5a5d57f4d866e93`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.2.sentiment-tab.contract.test.ts, social-listening-admin/contracts/epic-8/story-8.6.sources-tab-sentiment-index-volume-history.contract.test.ts, social-listening-admin/src/app/tenant/analytics/SourcesTab.tsx, social-listening-admin/src/app/tenant/analytics/analyticsData.ts
- **Status:** Pending review

## 2026-08-17 — 0ca3a9b — docs: log Story 8.6, draft ADR-0056 (AI-inferred Newswire dateline location)

- **Full commit:** `0ca3a9b1b18bb7ad5a3bed48f6e1a8c0f31567b3`
- **Files touched:** docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md, docs/adr/0055-analytics-language-and-location-enrichment-feasibility.md, docs/adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md, docs/adr/README.md, docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-8-analytics-dashboard.md
- **Status:** Pending review

## 2026-08-17 — eeb9c8c — fix(core): connect fails clearly when KEY_VAULT_KEY_ID is unconfigured

- **Full commit:** `eeb9c8c317d2430820a024c3a7a9ec45d53a54c1`
- **Files touched:** social-listening-core/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-core/.claude/skills/credential-envelope-encryption/SKILL.md, social-listening-core/contracts/epic-1/story-1.7.ownership-tier-connect-disconnect.contract.test.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- **Status:** Pending review

## 2026-08-17 — 1d49817 — docs: log Key Vault credential-storage healing pass

- **Full commit:** `1d49817b8f77d1cd6ad14ea53b917f043cca0536`
- **Files touched:** docs/adr/0014-credential-storage-envelope-encryption-oauth-first.md, docs/implementation-log.md
- **Status:** Pending review

## 2026-08-17 — a97cf30 — feat(admin): Story 6.18 — post feed search/filter operates over all matched posts

- **Full commit:** `a97cf300ff9edcfa9e8a11377ef4befa45b3c03a`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.18.post-feed-search-all-posts.contract.test.ts, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/page.tsx
- **Status:** Pending review

## 2026-08-17 — 5c23158 — docs: log Story 6.18

- **Full commit:** `5c23158f8cbf35654c6512538cd66ed356f6c408`
- **Files touched:** docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-17 — a27aa10 — feat(admin): Story 6.14 — access-history view on the tenant users screen

- **Full commit:** `a27aa10cb5db80a1046de3e0a38274dbec42efd2`
- **Files touched:** social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.14.access-history-view.contract.test.ts, social-listening-admin/src/app/api/tenant-users/[id]/access-history/route.ts, social-listening-admin/src/app/tenant/users/AccessHistoryButton.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Status:** Pending review

## 2026-08-17 — 50c7de1 — docs: log Story 6.14

- **Full commit:** `50c7de116016cf33ce505ff19616515d4ea5377a`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-17 — 5886a3e — fix(admin): Provider filter's tenant-owned-feed option used the wrong value

- **Full commit:** `5886a3e87b9ac3c6c4cb33bca77ee3840ea0fe18`
- **Files touched:** social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx
- **Status:** Pending review

## 2026-08-17 — 177de14 — docs: log Provider filter tenant-owned-feed value fix

- **Full commit:** `177de14562aa558ad490fb6eafbc147a4282edc2`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-17 — ff66d31 — fix(core): shouldAttemptIngestion() allows a bounded probe once ceiling-failing

- **Full commit:** `ff66d311baf94aa1edf370d4f3453a6dbc1fbfa8`
- **Files touched:** docs/adr/0023-proportional-connector-failure-threshold.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/contracts/epic-2/story-2.5.proportional-failure-threshold.contract.test.ts, social-listening-core/src/connectors/connectorHealth.ts
- **Status:** Pending review

## 2026-08-17 — 6152308 — docs: log ADR-0023 ceiling-recovery healing pass

- **Full commit:** `61523086cb9fe191713ce0223b5ef1da2bd44894`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-17 — aa4f317 — feat(core): expose body_markdown over GET /v1/posts and GET /v1/posts/:id

- **Full commit:** `aa4f31767a6a59221b27677f4a5bdd3e6d82c66c`
- **Files touched:** social-listening-core/.claude/skills/posts-api/SKILL.md, social-listening-core/contracts/epic-3/story-6.19.post-body-markdown-exposure.contract.test.ts, social-listening-core/src/posts/socialPostStore.ts
- **Status:** Pending review

## 2026-08-17 — 4bea1b8 — fix(core): GNews truncation marker has no '+' sign (ADR-0053 Open Q11 resolved)

- **Full commit:** `4bea1b849d0601c6d88c43607d969c5679d930a0`
- **Files touched:** docs/adr/0053-canonical-markdown-post-body-normalization-at-ingestion.md, social-listening-core/contracts/epic-3/story-3.10.canonical-markdown-post-body-normalization.contract.test.ts, social-listening-core/src/connectors/gnews/gnewsConnector.ts
- **Status:** Pending review

## 2026-08-17 — 00812ac — docs: Implementation Log entries for body_markdown exposure and GNews marker fix

- **Full commit:** `00812ac0b968fef703c833b27337381ca068e943`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-17 — 4f099a6 — feat(admin): render post detail body as real Markdown (Story 6.19)

- **Full commit:** `4f099a611faee8383e32d81efacbc97752b4a144`
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.19.post-body-markdown-rendering.contract.test.ts, social-listening-admin/jest.config.js, social-listening-admin/package-lock.json, social-listening-admin/package.json, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Status:** Pending review

## 2026-08-17 — 3edfed8 — docs: traceability for Story 6.19 (post body Markdown rendering)

- **Full commit:** `3edfed8271717dd8ff914b4acbdd1e5345d8b533`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-17 — b837b39 — feat(admin): show detected language and clean the card-list post snippet

- **Full commit:** `b837b390ad7de1a4acf61833f7191649c5022f0c`
- **Files touched:** docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.19.post-body-markdown-rendering.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx
- **Status:** Pending review

## 2026-08-17 — b86e518 — docs: Implementation Log entry for language display + card-snippet fix

- **Full commit:** `b86e5184d2b6ec864eb1225a3d580d7bc1291061`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-17 — 556bb65 — feat(core): expose caller tenant's own seat counts on GET /v1/tenants/users

- **Full commit:** `556bb65a75f501c2062f421ab8c4abd620ac5a15`
- **Files touched:** social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/contracts/epic-1/story-1.9.user-invite-offboard.contract.test.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts
- **Status:** Pending review

## 2026-08-17 — 1501247 — feat(admin): redesign the Team & Access screen (/tenant/users)

- **Full commit:** `150124760d4f30c920f173b7fa783739c3901fdc`
- **Files touched:** docs/design/frontend-design-specification.md, social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/users/AccessControl.tsx, social-listening-admin/src/app/tenant/users/AccessHistoryButton.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/components/ui/Modal.tsx, social-listening-admin/src/components/ui/components.test.ts, social-listening-admin/src/components/ui/index.ts, social-listening-admin/src/lib/core-client.ts
- **Status:** Pending review

## 2026-08-17 — 145d38c — docs: traceability for seat-counts enhancement and Team & Access redesign

- **Full commit:** `145d38c2cf4cbe56b4a983b209cb3cf252c14abd`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-17 — 0a1db2d — docs: draft ADR-0057 (tenant-owned-feed multi-feed administration)

- **Full commit:** `0a1db2d5461ad058af60de7eea7cfa546f3c5409`
- **Files touched:** docs/adr/0057-tenant-owned-feed-multi-feed-administration.md, docs/adr/README.md
- **Status:** Pending review

## 2026-08-17 — 249402a — style(admin): widen the main content container from 900px to 1280px

- **Full commit:** `249402afba999f079b60bd9becdf1b7328dfe764`
- **Files touched:** social-listening-admin/src/app/globals.css
- **Status:** Pending review

## 2026-08-17 — 114d94f — docs: revise ADR-0057 against an external review (4 points, checked)

- **Full commit:** `114d94f89f4447aec0766e944115ebcd6e0333fd`
- **Files touched:** docs/adr/0057-tenant-owned-feed-multi-feed-administration.md, docs/adr/README.md
- **Status:** Pending review

## 2026-08-17 — bae1277 — docs: accept ADR-0056 and ADR-0057; draft Story 6.20

- **Full commit:** `bae127715fe0159194e1f5361e3cc893a516a22c`
- **Files touched:** docs/adr/0056-ai-inferred-origin-location-newswire-dateline-extraction.md, docs/adr/0057-tenant-owned-feed-multi-feed-administration.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-17 — 2acee9b — chore(admin): delete dead analytics prototype/demo code

- **Full commit:** `2acee9b15465f609319a3317ef5e6e603f05cc63`
- **Files touched:** social-listening-admin/src/lib/mockData.ts, social-listening-admin/src/lib/types.ts
- **Status:** Pending review

## 2026-08-17 — bd126c8 — docs(admin): lock in the dead-analytics-code deletions with contract checks

- **Full commit:** `bd126c82da94343112cb31143806b60a4e16127e`
- **Files touched:** social-listening-admin/.claude/skills/analytics-dashboard/SKILL.md, social-listening-admin/contracts/epic-8/story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts
- **Status:** Pending review

## 2026-08-17 — fc41590 — docs: Implementation Log entry for dead analytics code cleanup

- **Full commit:** `fc415904debaaccc9ff8f4204b6025c774b155cc`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-17 — e9d797f — feat(core): tenant-owned-feed multi-feed administration (Story 6.20, core half)

- **Full commit:** `e9d797f64f67984fcb88985d0076ff21ab070d30`
- **Files touched:** social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.11.tenant-owned-feed-connector.contract.test.ts, social-listening-core/contracts/epic-2/story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts, social-listening-core/migrations/0031_add_removed_status_to_tenant_owned_feed_activations.sql, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts, social-listening-core/src/http/versions/v1/tenantOwnedFeedRouter.ts
- **Status:** Pending review

## 2026-08-17 — be1764d — feat(admin): tenant-owned-feed multi-feed administration (Story 6.20, admin half)

- **Full commit:** `be1764d002bec66d5dac71d33c49b108c07f47ee`
- **Files touched:** social-listening-admin/.claude/skills/tenant-owned-feed-connector-setup/SKILL.md, social-listening-admin/contracts/epic-6/story-6.12.tenant-owned-feed-connector-setup.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.17.tenant-owned-feed-activation-control.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts, social-listening-admin/src/app/api/connectors/tenant-owned-feed/[id]/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx, social-listening-admin/src/app/tenant/connectors/tenant-owned-feed/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Status:** Pending review

## 2026-08-17 — b05f317 — docs: traceability for Story 6.20 (tenant-owned-feed multi-feed administration)

- **Full commit:** `b05f3171003cc31acf6cb6378c99d0d18dc7f3b5`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-17 — 3ef32ad — feat(story-5.19): wire SocialPostIngestedEvent/ConnectorHealthChangedEvent publishing into the real ingestion pipeline

- **Full commit:** `3ef32adab7d6b19cb88c375fa45127cf965192bb`
- **Files touched:** docs/adr/0058-wire-ingestion-events-into-real-connector-pipeline.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/ingestion-events/SKILL.md, social-listening-core/contracts/epic-5/story-5.19.wire-ingestion-events.contract.test.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/events/publishSocialPostIngestedEvents.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts, social-listening-core/src/watchlists/watchlistStore.ts
- **Status:** Pending review

## 2026-08-17 — 8ee53d9 — docs: implementation log entry for Story 5.19

- **Full commit:** `8ee53d9dbd625aa2cf97cd6b08fa7c4cabe58ef1`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-5-security-isolation-and-messaging.md
- **Status:** Pending review

## 2026-08-17 — 591b0b8 — feat(story-2.13): Wikipedia connector — MediaWiki Action API, revision re-poll via recentchanges, article-as-Author

- **Full commit:** `591b0b8bb8c15d2b45ddaacda15f3eec000ea292`
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/.claude/skills/wikipedia-connector/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts, social-listening-core/contracts/epic-2/story-2.13.wikipedia-connector.contract.test.ts, social-listening-core/src/authors/authorStore.ts, social-listening-core/src/connectors/bootstrapConnectors.ts, social-listening-core/src/connectors/wikipedia/pollWikipedia.ts, social-listening-core/src/connectors/wikipedia/wikipediaConnector.ts
- **Status:** Pending review

## 2026-08-17 — e7055db — docs: implementation log entry for Story 2.13

- **Full commit:** `e7055db18ba7903372a0f71c2b1abb319929a5dc`
- **Files touched:** docs/implementation-log.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** Pending review

## 2026-08-17 — 21c30bf — feat(story-6.21): expose the Wikipedia connector in the Tenant Admin UI

- **Full commit:** `21c30bf64d19b31ae7a7e2c21798220ff38566d3`
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.21.wikipedia-connector-ui.contract.test.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- **Status:** Pending review

## 2026-08-17 — ce4c2fa — docs: implementation log entry for Story 6.21

- **Full commit:** `ce4c2fac261030a27db7bc1c189d051b9476f2fd`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-17 — fd6cdb3 — Design principals with Gemini Building a new frontend

- **Full commit:** `fd6cdb3a04b67d4237f93dfb65321a2d5d04c97d`
- **Files touched:** docs/design/Gemini Designs/.env.example, docs/design/Gemini Designs/.gitignore, docs/design/Gemini Designs/README.md, docs/design/Gemini Designs/index.html, docs/design/Gemini Designs/metadata.json, docs/design/Gemini Designs/package-lock.json, docs/design/Gemini Designs/package.json, docs/design/Gemini Designs/src/App.tsx, docs/design/Gemini Designs/src/components/ExportModal.tsx, docs/design/Gemini Designs/src/components/FilterBar.tsx, docs/design/Gemini Designs/src/components/FlyoutNav.tsx, docs/design/Gemini Designs/src/components/PostsPane.tsx, docs/design/Gemini Designs/src/components/SubTabs.tsx, docs/design/Gemini Designs/src/components/TopBar.tsx, docs/design/Gemini Designs/src/components/views/ActivityMapView.tsx, docs/design/Gemini Designs/src/components/views/AlertsView.tsx, docs/design/Gemini Designs/src/components/views/AuthViews.tsx, docs/design/Gemini Designs/src/components/views/ConversationsView.tsx, docs/design/Gemini Designs/src/components/views/LocationView.tsx, docs/design/Gemini Designs/src/components/views/OverviewView.tsx, docs/design/Gemini Designs/src/components/views/PostDetailView.tsx, docs/design/Gemini Designs/src/components/views/SearchSetupView.tsx, docs/design/Gemini Designs/src/components/views/SentimentView.tsx, docs/design/Gemini Designs/src/components/views/SettingsView.tsx, docs/design/Gemini Designs/src/components/views/SocialCenterView.tsx, docs/design/Gemini Designs/src/components/views/SourcesView.tsx, docs/design/Gemini Designs/src/data/mockData.ts, docs/design/Gemini Designs/src/index.css, docs/design/Gemini Designs/src/main.tsx, docs/design/Gemini Designs/src/types.ts, docs/design/Gemini Designs/tsconfig.json, docs/design/Gemini Designs/vite.config.ts
- **Status:** Pending review

## 2026-08-17 — 2317c60 — The latest round of fronbend designs with Google AI Stduio App builder. Latest brainstorm sessions and the reworks of the frontend designs

- **Full commit:** `2317c60d7f23d90f96a3fb20dd8304ed4fcd1961`
- **Files touched:** docs/design/Google AI Studio/.env.example, docs/design/Google AI Studio/.gitignore, docs/design/Google AI Studio/README.md, docs/design/Google AI Studio/bun.lock, docs/design/Google AI Studio/index.html, docs/design/Google AI Studio/metadata.json, docs/design/Google AI Studio/package-lock.json, docs/design/Google AI Studio/package.json, docs/design/Google AI Studio/server.ts, docs/design/Google AI Studio/src/App.tsx, docs/design/Google AI Studio/src/components/ActivateDeactivateButton.tsx, docs/design/Google AI Studio/src/components/AnimatedChartTooltip.tsx, docs/design/Google AI Studio/src/components/ConfirmModal.tsx, docs/design/Google AI Studio/src/components/ConversationsDashboardTab.tsx, docs/design/Google AI Studio/src/components/D3SentimentGauge.tsx, docs/design/Google AI Studio/src/components/D3Sparkline.tsx, docs/design/Google AI Studio/src/components/D3TrendingTopicsChart.tsx, docs/design/Google AI Studio/src/components/EmptyState.tsx, docs/design/Google AI Studio/src/components/GlobalDateRangePicker.tsx, docs/design/Google AI Studio/src/components/InlineError.tsx, docs/design/Google AI Studio/src/components/LocationDashboardTab.tsx, docs/design/Google AI Studio/src/components/RelativeTime.tsx, docs/design/Google AI Studio/src/components/RunEnrichmentButton.tsx, docs/design/Google AI Studio/src/components/SentimentDashboardTab.tsx, docs/design/Google AI Studio/src/components/Sidebar.tsx, docs/design/Google AI Studio/src/components/Slideover.tsx, docs/design/Google AI Studio/src/components/SourcesDashboardTab.tsx, docs/design/Google AI Studio/src/components/StatusBadge.tsx, docs/design/Google AI Studio/src/components/TagInput.tsx, docs/design/Google AI Studio/src/components/TopBar.tsx, docs/design/Google AI Studio/src/context/AppContext.tsx, docs/design/Google AI Studio/src/index.css, docs/design/Google AI Studio/src/lib/store.ts, docs/design/Google AI Studio/src/main.tsx, docs/design/Google AI Studio/src/types/index.ts, docs/design/Google AI Studio/src/views/AdminConnectorsView.tsx, docs/design/Google AI Studio/src/views/AdminOverviewView.tsx, docs/design/Google AI Studio/src/views/AdminTenantsView.tsx, docs/design/Google AI Studio/src/views/AnalyticsDashboardView.tsx, docs/design/Google AI Studio/src/views/ConnectorStatusView.tsx, docs/design/Google AI Studio/src/views/ConnectorsView.tsx, docs/design/Google AI Studio/src/views/InviteAssistView.tsx, docs/design/Google AI Studio/src/views/PostsFeedView.tsx, docs/design/Google AI Studio/src/views/SignInView.tsx, docs/design/Google AI Studio/src/views/SignUpView.tsx, docs/design/Google AI Studio/src/views/SignedOutView.tsx, docs/design/Google AI Studio/src/views/SocialConnectorDetailsView.tsx, docs/design/Google AI Studio/src/views/TeamAccessView.tsx, docs/design/Google AI Studio/src/views/TenantDashboardView.tsx, docs/design/Google AI Studio/src/views/TenantDeleteView.tsx, docs/design/Google AI Studio/src/views/TenantOwnedFeedView.tsx, docs/design/Google AI Studio/src/views/TenantSettingsView.tsx, docs/design/Google AI Studio/src/views/WatchlistsView.tsx, docs/design/Google AI Studio/tsconfig.json, docs/design/Google AI Studio/vite.config.ts
- **Status:** Pending review

## 2026-08-17 — c802b64 — feat(story-2.14): Wikipedia discovery search driven by the tenant's own watchlist terms

- **Full commit:** `c802b64ab2160d8a640ce7249655554201129630`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/wikipedia-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.14.wikipedia-watchlist-driven-discovery.contract.test.ts, social-listening-core/src/connectors/wikipedia/pollWikipedia.ts
- **Status:** Pending review

## 2026-08-17 — 8ed1e7b — docs: implementation log entry for Story 2.14

- **Full commit:** `8ed1e7b06ddd3558da5720455e4a663f10b56296`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** Pending review

## 2026-08-18 — 8182706 — feat(story-6.22): add Wikipedia to the watchlist screen's platform-source list

- **Full commit:** `8182706d5f57a8fcc9ad8f5d680ec4c6e9fbc402`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/watchlist-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.22.wikipedia-watchlist-platform-source.contract.test.ts, social-listening-admin/src/app/tenant/watchlists/page.tsx
- **Status:** Pending review

## 2026-08-18 — 14ada1b — docs: implementation log entry for Story 6.22

- **Full commit:** `14ada1bbd9f235d87e9d16e5d63bf1d9d3cc40e2`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-18 — 3fedac3 — fix(story-2.16): azureAiLanguageConnector throws classified error on rejected document

- **Full commit:** `3fedac3ce1436b0e3384bd1d4acfa3d56c35fcdb`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.16.azure-ai-language-classified-document-error.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/azureAiLanguageConnector.ts
- **Status:** Pending review

## 2026-08-18 — 38c3e51 — docs(story-2.16): implementation log entry and Built field

- **Full commit:** `38c3e513ec3ac1345c839a7efdfe54c70bf6d31d`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** Pending review

## 2026-08-18 — 6a9b628 — feat(story-2.17): Azure OpenAI structured enrichment gains a summary field

- **Full commit:** `6a9b62856c6a2349182ec4c9ad7cf1ac8804e29e`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.17.azure-openai-summary-field.contract.test.ts, social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts, social-listening-core/src/connectors/types.ts
- **Status:** Pending review

## 2026-08-18 — 28090fe — docs(story-2.17): implementation log entry and Built field

- **Full commit:** `28090fe65741767dc9550b3bc3e433b75f9c6bb1`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** Pending review

## 2026-08-18 — 6550716 — feat(story-6.25): post feed shows most-recently-ingested posts first

- **Full commit:** `65507164bac4ef7fdfb48d82627a940670b39155`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.25.post-feed-newest-first.contract.test.ts, social-listening-admin/src/app/tenant/posts/page.tsx
- **Status:** Pending review

## 2026-08-18 — 05d9ee0 — docs(story-6.25): implementation log entry and Built field

- **Full commit:** `05d9ee02fbade63b466ee3025aa50b33166b7adb`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-18 — 03c37c9 — feat(story-6.26): post feed's Provider filter derives its options from real data

- **Full commit:** `03c37c91c3ffabfd69c15bb7339abf9b2e77d8fd`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.25.post-feed-newest-first.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.26.post-feed-dynamic-provider-filter.contract.test.ts, social-listening-admin/src/app/tenant/posts/PostsFeedClient.tsx
- **Status:** Pending review

## 2026-08-18 — 42e693f — docs(story-6.26): implementation log entry and Built field

- **Full commit:** `42e693f763cb36581bd2a0b145bf5c02b7295c6d`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-18 — 50a5914 — feat(story-2.15): Facebook connector -- tenant's own Page, Tier 3 credential

- **Full commit:** `50a5914641dcd9fc03d424f0994555b6389d8a0b`
- **Files touched:** docs/environment-gotchas.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/.claude/skills/facebook-connector/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-2/story-2.15.facebook-connector.contract.test.ts, social-listening-core/migrations/0032_add_ingestion_runs_credential_failure_flag.sql, social-listening-core/src/connectors/bootstrapConnectors.ts, social-listening-core/src/connectors/connectorHealth.ts, social-listening-core/src/connectors/facebook/facebookConnector.ts, social-listening-core/src/connectors/facebook/pollFacebook.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts, social-listening-core/src/http/versions/v1/facebookOAuthRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/ingestion/ingestionRunStore.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts
- **Status:** Pending review

## 2026-08-18 — caf50ed — docs(story-2.15): implementation log entry and Built field

- **Full commit:** `caf50ed7c77659ecdc5ae373b6c98c4833889c13`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md
- **Status:** Pending review

## 2026-08-18 — 838e3dc — feat(story-1.14): poll scheduler skips a pair whose most recent run is still running

- **Full commit:** `838e3dc0adbd8e4a0330b132f2871e08128e2b23`
- **Files touched:** docs/adr/0052-live-ingestion-polling-scheduler.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/live-ingestion-polling-scheduler/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-1/story-1.13.live-ingestion-polling-scheduler.contract.test.ts, social-listening-core/contracts/epic-1/story-1.14.poll-scheduler-skip-in-flight.contract.test.ts, social-listening-core/src/ingestion/ingestionRunStore.ts, social-listening-core/src/scheduler/pollScheduler.ts
- **Status:** Pending review

## 2026-08-18 — 3ce8db2 — docs(story-1.14): implementation log entry and Built field

- **Full commit:** `3ce8db2005d1e2b794101fb63c0c2049d584c0af`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-1-repository-and-api-foundation.md
- **Status:** Pending review

## 2026-08-18 — 535338f — feat(story-6.23): Facebook OAuth connect flow with Page selection

- **Full commit:** `535338ff3dac36738d0240fb0d4994ec2d478e3f`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/.env.example, social-listening-admin/contracts/epic-6/story-6.21.wikipedia-connector-ui.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.23.facebook-oauth-connect-flow.contract.test.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/callback/route.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/pending/route.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/select-page/route.ts, social-listening-admin/src/app/api/connectors/facebook/oauth/start/route.ts, social-listening-admin/src/app/globals.css, social-listening-admin/src/app/tenant/connectors/ConnectorsClient.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/ConnectorStatusClient.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/components/ui/StatusBadge.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/facebookOAuth.ts
- **Status:** Pending review

## 2026-08-18 — f6a1794 — docs(story-6.23): implementation log entry and Built field

- **Full commit:** `f6a179406e217330ae5616f474f6ebeb8b656efc`
- **Files touched:** docs/implementation-log.md, docs/user-stories/epic-6-tenant-admin-ui.md
- **Status:** Pending review

## 2026-08-18 — 7c0572c — docs: ADR-0059/0060/0061 acceptance and Story 6.27/1.15 governance update

- **Full commit:** `7c0572c1dcabc8a0401e10d180955430b5a185d7`
- **Files touched:** docs/adr/0059-facebook-connector-tenant-owned-page-scope-organization-as-author.md, docs/adr/0060-facebook-connector-multiple-pages-per-user.md, docs/adr/0061-tier-3-poll-scheduler-per-user-enumeration.md, docs/adr/README.md, docs/open-decisions.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-6-tenant-admin-ui.md
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

