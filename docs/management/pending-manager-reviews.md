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
- **Status:** Pending review

## 2026-08-05 — 67430b7 — Add Story 6.3 connector connect flow

- **Full commit:** `67430b7f2ae16ed9dfc30d0e0c17c98b994bffde`
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/src/app/tenant/connectors/page.tsx
- **Status:** Pending review

## 2026-08-05 — 57926be — Add Story 6.4 watchlist management screen

- **Full commit:** `57926befe8eb622fadab47df3b606876e87aef51`
- **Files touched:** social-listening-admin/.claude/skills/watchlist-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts, social-listening-admin/src/app/tenant/watchlists/page.tsx
- **Status:** Pending review

## 2026-08-05 — 99caf05 — Add Story 6.5 connector status view

- **Full commit:** `99caf05f1f9063f179e5a85fd8c7dcbd69ae1795`
- **Files touched:** social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- **Status:** Pending review

## 2026-08-05 — 54f7ee7 — Traceability catch-up: Stories 6.2-6.5 (built in a parallel session, log/status uncommitted)

- **Full commit:** `54f7ee70381c7091364cb380337b0c5a6892aa4f`
- **Files touched:** docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md
- **Status:** Pending review

## 2026-08-05 — e08b0c0 — Implement Story 5.12: Platform Admin tenant management REST surface (ADR-0030, ADR-0031)

- **Full commit:** `e08b0c018e1a98540e5fc2a83a5b961006009974`
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/platform-admin-tenant-management/SKILL.md, social-listening-core/.claude/skills/tenant-auth-middleware/SKILL.md, social-listening-core/contracts/epic-5/story-5.12.platform-admin-tenant-management.contract.test.ts, social-listening-core/migrations/0020_grant_platform_admin_domain_update.sql, social-listening-core/src/http/auth/requireTenantUser.ts, social-listening-core/src/http/versions/v1/adminTenantsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/tenants/tenantStore.ts
- **Status:** Pending review

## 2026-08-05 — acedb26 — Log Story 5.12 in the Implementation Log

- **Full commit:** `acedb26fca0764acb57e01b0c882ed1fbb0fa8ca`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-06 — 7b9cee5 — Implement Story 5.13: Platform Admin break-glass request/execute REST surface

- **Full commit:** `7b9cee589161d3bd52501413dda307b9b06934f2`
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/.claude/skills/platform-admin-break-glass-rest/SKILL.md, social-listening-core/contracts/epic-5/story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts, social-listening-core/src/admin/breakGlassCredentialReset.ts, social-listening-core/src/http/versions/v1/adminBreakGlassRouter.ts, social-listening-core/src/http/versions/v1/router.ts
- **Status:** Pending review

## 2026-08-06 — abe4a55 — Log Story 5.13 in the Implementation Log

- **Full commit:** `abe4a553b50d194082aee226f1bcb64b5953c353`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-06 — 8cf4391 — Implement Story 5.14: Platform Admin audit-log query REST surface

- **Full commit:** `8cf439188b3ade1af4192840b3d97777fac8c4ca`
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-6-admin-ui.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/.claude/skills/platform-admin-audit-log/SKILL.md, social-listening-core/contracts/epic-5/story-5.14.platform-admin-audit-log-rest-surface.contract.test.ts, social-listening-core/src/admin/auditLogCursor.ts, social-listening-core/src/admin/platformAdminAuditLog.ts, social-listening-core/src/http/versions/v1/adminAuditLogRouter.ts, social-listening-core/src/http/versions/v1/router.ts
- **Status:** Pending review

## 2026-08-06 — 771a3c9 — Log Story 5.14 in the Implementation Log

- **Full commit:** `771a3c9ac16446883d80b9fc0949a284de96a7d2`
- **Files touched:** docs/implementation-log.md
- **Status:** Pending review

## 2026-08-06 — 9a25d54 — Accept ADR-0038 and ADR-0039, both as drafted

- **Full commit:** `9a25d541fb269dbb2e9ffcddb62550a5cc74fb4a`
- **Files touched:** docs/adr/0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md, docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-3-data-model-storage-and-archival.md
- **Status:** Pending review

