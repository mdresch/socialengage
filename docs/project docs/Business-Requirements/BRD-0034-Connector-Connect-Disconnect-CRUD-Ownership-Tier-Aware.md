# BRD-0034 – Connector Connect/Disconnect CRUD – Ownership-Tier-Aware Credential Creation

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0034 – Connector Connect/Disconnect CRUD – Ownership-Tier-Aware Credential Creation |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-19 | AI Business & Requirements Analyst | Initial BRD generated from ADR-0034 and related user stories |

---

## 2. Executive Summary

**What problem are we solving?** The existing connector connect/disconnect endpoints (`POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect`) were built against a placeholder authentication model that trusted the self-declared `X-Tenant-Id` header. They have no concept of caller role or credential ownership tier, and the credential store keys only on `(tenant_id, platform_id)`. This means any caller with a tenant header can connect or disconnect a tenant's credential, and a Tenant-Admin disconnecting a tenant-wide credential can silently delete an unrelated user's personal credential once user-bound credentials are introduced.

**Who is affected?** Tenant-Admins who manage tenant-wide platform credentials, tenant users who activate their own personal credentials, and the engineering team that must rework the already-shipped `connectorsRouter.ts` and `credentialStore.ts` to align with the real authentication and ownership-tier model.

**What is the proposed solution at a glance?** Add `owner_type` and `user_id` columns to `platform_credentials`, enforce application-layer authorization on the connect and disconnect endpoints using the bearer-token-resolved caller identity, and rework `deleteCredential` and `getLatestCredentialId` to operate on a single ownership-scoped credential rather than every credential for a `(tenant, platform)` pair. The route surface remains small: one `POST /v1/connectors/:platformId/connect` endpoint, body-discriminated by `ownerType`, with an asymmetric disconnect shape for the dual-actor revocation case.

**What business value do we expect?** Credential creation authority is enforced in code for the first time per ADR-0028's Tier 2/Tier 3 rules, a latent cross-credential deletion bug is closed before user-bound credentials exist, and the connector surface is ready for the real `Authorization: Bearer` identity model.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enforce ADR-0028's ownership-tier rules for credential creation and deletion in the connector connect/disconnect endpoints | Contract tests prove tenant-wide credentials are created only by Tenant-Admins and user-bound credentials only by the acting user |
| 2 | Prevent a Tenant-Admin's ordinary tenant-wide disconnect from silently deleting another user's personal credential | Contract test demonstrates one tenant-wide and one user-bound credential for the same platform can coexist and be disconnected independently |
| 3 | Keep the REST route surface small and maintainable for a solo project | Only one `POST /v1/connectors/:platformId/connect` route is introduced or retained, with body-discriminated authorization |
| 4 | Provide an offboarding safety valve so a departing user's personal credential can be revoked by a Tenant-Admin | Contract test proves a same-tenant Tenant-Admin can delete a user-bound credential, but cannot create or activate one on a user's behalf |
| 5 | Migrate existing credentials without data loss or downtime | All existing `platform_credentials` rows remain valid as tenant-wide credentials after the additive migration |

---

## 4. Scope

### 4.1 In Scope

- Additive migration to `platform_credentials` adding `owner_type` and `user_id` with a check constraint.
- Application-layer authorization checks in `connectorsRouter.ts` for `POST /v1/connectors/:platformId/connect`.
- Application-layer authorization checks for disconnecting tenant-wide and user-bound credentials.
- Rework of `deleteCredential(tenantId, platformId)` to `deleteCredential(tenantId, platformId, ownerType, userId?)`.
- Parameterization of `getLatestCredentialId` to accept `(tenantId, platformId, ownerType, userId?)`.
- Removal of `X-Tenant-Id` as an authorization source; use `req.tenantId`, `req.userId`, and `req.role` from ADR-0033's middleware.
- Contract tests that cover the new schema, role checks, ownership checks, and the one-vs-many credential deletion correctness case.

### 4.2 Out of Scope

- A second RLS predicate on `user_id`; authorization remains application-layer.
- Separate `/connect` and `/connect-personal` route trees; a single body-discriminated route is retained.
- Resolution of the missing `docs/implementation-log.md` entry for Story 1.6; this is a traceability follow-up, not part of this feature.
- Deciding whether a tenant may have multiple activations of the same platform or whether connector activation needs its own table; ADR-0051 resolves this separately.
- Admin UI screen work; Story 6.3 already covers the connector connect/disconnect UI against Story 1.7's REST surface.

### 4.3 Assumptions

- Real bearer-token authentication and identity-resolution middleware from ADR-0029/ADR-0033 is in place before this work is built.
- The `users` table and role model from ADR-0031/ADR-0032 are in place.
- Every existing `platform_credentials` row represents a tenant-wide credential (ADR-0028 Tier 2), so the additive migration can safely default `owner_type` to `'tenant'` and `user_id` to `NULL`.
- The `connector_activations` / `connector_user_activations` tables described by ADR-0051 will be built separately and do not change this BRD's scope.

### 4.4 Constraints

- No destructive migration; existing rows and existing callers of `getLatestCredentialId` must continue to work or be explicitly re-signed.
- The route surface should not grow faster than the authorization complexity requires.
- All behavior must be provable by contract tests under this project's contract-first methodology.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Creates and removes tenant-wide credentials; offboards users | High | Must be able to manage tenant connectors and revoke stale personal credentials without accidentally deleting another user's credential |
| Tenant User | Creates and removes own personal credentials | High | Must be able to connect a personal account without help, and must not have credentials created on their behalf |
| Platform Admin | Operates the platform, has no tenant content access | Low | Wants the security model to be consistent and auditable |
| Security / Compliance | Ensures credential ownership and least-privilege access | High | Wants role-based authority enforced in code, not by client declaration |
| Engineering | Implements the schema migration, router, and store changes | High | Wants a clear, testable authorization boundary and minimal rework surface |

---

## 6. Current State (As-Is)

**Current process:**
1. A caller invokes `POST /v1/connectors/:platformId/connect` with an `X-Tenant-Id` header and a plaintext credential body.
2. `connectorsRouter.ts` stores the credential through `credentialStore.storeCredential(tenantId, platformId, ...)`.
3. A caller invokes `DELETE /v1/connectors/:platformId/disconnect` with an `X-Tenant-Id` header.
4. `credentialStore.deleteCredential(tenantId, platformId)` removes all credentials for that `(tenant, platform)` pair.
5. `credentialStore.getLatestCredentialId(tenantId, platformId)` returns the most recently created credential for that pair, used by ingestion and health checks.

**Pain points:**
- No role check: any caller with a tenant header can connect or disconnect any tenant's credential.
- No ownership tier: `platform_credentials` has no `owner_type` or `user_id`, so tenant-wide and user-bound credentials cannot be distinguished.
- Unsafe deletion: `deleteCredential` deletes every credential for a `(tenant, platform)` pair, which will silently remove a user's personal credential when a Tenant-Admin only intended to remove the tenant-wide one.
- Ambiguous lookup: `getLatestCredentialId` returns the latest by creation time, which is no longer a reliable proxy for "the credential to use" once multiple ownership tiers exist.
- Placeholder auth: the endpoints still trust `X-Tenant-Id` rather than the bearer-token-resolved identity.

---

## 7. Future State (To-Be)

**New or improved process:**
1. A signed-in caller invokes `POST /v1/connectors/:platformId/connect` with an `ownerType` body field (`'tenant'` or `'user'`, default `'tenant'`).
2. If `ownerType` is `'tenant'`, the handler requires `req.role === 'tenant_admin'` and inserts a row with `owner_type = 'tenant'`, `user_id = NULL`.
3. If `ownerType` is `'user'`, the handler always sets `user_id = req.userId` and inserts a row with `owner_type = 'user'`, ignoring any client-supplied `user_id`.
4. To disconnect a tenant-wide credential, the caller must be a Tenant-Admin; to disconnect a user-bound credential, the caller must be the owning user or a Tenant-Admin of the same tenant.
5. `deleteCredential` and `getLatestCredentialId` are invoked with `(tenantId, platformId, ownerType, userId?)` so each call targets exactly one credential.
6. All endpoints use `req.tenantId`, `req.userId`, and `req.role` from the `Authorization: Bearer` token, never `X-Tenant-Id`.

**Expected capabilities:**
- Distinction between tenant-wide and user-bound credentials at the schema and authorization layers.
- A Tenant-Admin can connect and disconnect tenant-wide credentials only.
- A tenant user can connect and disconnect their own user-bound credentials; a same-tenant Tenant-Admin can also disconnect a user-bound credential for offboarding.
- Multiple credentials of different ownership types can coexist for the same `(tenant, platform)` pair.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall store an `owner_type` (`'tenant'` \| `'user'`) and optional `user_id` on every `platform_credentials` row, enforced by a check constraint | Must | `owner_type='tenant'` rows have `user_id` NULL; `owner_type='user'` rows have a non-null, FK-valid `user_id` | Engineering |
| BR-002 | The system shall allow a Tenant-Admin to create a tenant-wide credential for a platform | Must | `POST /v1/connectors/:platformId/connect` with `ownerType:'tenant'` succeeds for `tenant_admin`, returns `201` | Engineering |
| BR-003 | The system shall allow a tenant user to create a user-bound credential for a platform and set `user_id` to the caller's own resolved identity | Must | `POST .../connect` with `ownerType:'user'` sets `user_id` to `req.userId` and ignores any client-supplied `user_id`; proven by a test that supplies a different `user_id` | Engineering |
| BR-004 | The system shall reject a non-Tenant-Admin attempting to create a tenant-wide credential | Must | `POST .../connect` with `ownerType:'tenant'` from a `tenant_user` returns `403` | Engineering |
| BR-005 | The system shall allow a Tenant-Admin to disconnect a tenant-wide credential | Must | `DELETE .../disconnect` for `owner_type='tenant'` succeeds for `tenant_admin` and returns `200` or `204` | Engineering |
| BR-006 | The system shall allow the owning user or a same-tenant Tenant-Admin to disconnect a user-bound credential | Must | `DELETE .../disconnect` (or equivalent user-bound disconnect shape) succeeds for the owning `tenant_user` or the tenant's `tenant_admin`, and fails for other callers | Engineering |
| BR-007 | The system shall reject connect/disconnect attempts by unauthorized callers | Must | 403 is returned for any caller that does not meet the role/ownership rule for the requested operation | Engineering |
| BR-008 | The system shall scope `deleteCredential` to a single credential identified by `(tenantId, platformId, ownerType, userId?)` | Must | A test with one tenant-wide and one user-bound credential for the same `platformId` confirms disconnecting one does not remove the other | Engineering |
| BR-009 | The system shall parameterize `getLatestCredentialId` by `(tenantId, platformId, ownerType, userId?)` so callers request the exact credential they need | Should | Ingestion/health callers retrieve the credential by explicit ownership scope, not by latest-creation-time assumption | Engineering |
| BR-010 | The system shall use a single `POST /v1/connectors/:platformId/connect` route, body-discriminated by `ownerType` | Should | No second `connect-personal` route is introduced unless a later ADR decides it is necessary | Engineering |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Existing `platform_credentials` rows remain valid and no data is lost after the migration | Data Integrity | Must | After the additive migration, every pre-existing row is `owner_type='tenant'`, `user_id=NULL`; the contract test suite still passes |
| NFR-002 | Authorization is enforced at the application layer, not by a second RLS predicate on `user_id` | Security | Should | `tenant_isolation` RLS policy remains `tenant_id`-only; no new per-user RLS predicate is added to `platform_credentials` |
| NFR-003 | The REST route surface must not grow faster than the authorization complexity requires | Maintainability | Should | The new connect surface is one `POST` route; disconnect uses an existing or minimally-discriminated shape |
| NFR-004 | Rework must be covered by contract tests and must not break existing ingestion or health endpoints | Reliability | Must | Full `social-listening-core` contract suite passes with the new connector and credential store changes |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A credential with `owner_type = 'tenant'` must have `user_id = NULL` |
| BRU-002 | A credential with `owner_type = 'user'` must have a non-null `user_id` that references an existing `users` row |
| BRU-003 | Tenant-wide credentials may only be created or deleted by a caller whose resolved role is `tenant_admin` |
| BRU-004 | User-bound credentials are always created by the acting caller; any client-supplied `user_id` in the request body is ignored and never trusted |
| BRU-005 | A user-bound credential may be deleted by the owning user or by a Tenant-Admin of the same tenant, and by no other tenant user |
| BRU-006 | Every `platform_credentials` row that existed before this change is interpreted as `owner_type = 'tenant'`, `user_id = NULL` |
| BRU-007 | Credential row visibility remains tenant-scoped through the existing RLS policy; role and ownership authorization is an application-layer concern |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `platform_credentials.owner_type` | Ownership tier discriminator (`'tenant'` or `'user'`) | Additive migration on `platform_credentials` | Engineering | High – determines authorization scope |
| `platform_credentials.user_id` | Foreign key to `users(id)` for user-bound credentials; `NULL` for tenant-wide | Additive migration on `platform_credentials` | Engineering | High – links credential to a person |
| `platform_credentials` existing columns | Encrypted credential envelope, `tenant_id`, `platform_id`, etc. | Existing table (Story 1.6/2.6/2.7) | Engineering | High – secret material, encrypted per ADR-0014 |
| `users.id` / `users.role` | Caller identity and role used by authorization checks | `users` table (ADR-0031/ADR-0032) | Engineering | High – personal/role data |
| `connector_activations` (related, out of scope) | Separate activation state per platform, tenant-wide | ADR-0051 / Story 1.11 | Engineering | Medium – operational state, not credential content |
| `connector_user_activations` (related, out of scope) | Separate activation state per platform, per user | ADR-0051 / Story 1.11 | Engineering | Medium – operational state, not credential content |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Tenant-wide vs user-bound credential count per tenant/platform | Track adoption of personal connector activation | Product team | Monthly |
| Unauthorized connect/disconnect attempts (403 count) | Monitor for misuse or misconfigured clients | Security / Operations | Real-time / daily |
| Connect/disconnect API latency | Ensure the reworked endpoints remain performant | Engineering | Continuous |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The interpretive extension that a Tenant-Admin may delete (but not create/activate) a user-bound credential conflicts with a stricter reading of ADR-0028 | Low | Medium | Confirmed as drafted by Menno at ADR-0034 acceptance; documented as a named interpretation in the BRD and ADR | Product Owner |
| R-002 | Reworking already-shipped `connectorsRouter.ts` and `credentialStore.ts` introduces regressions in ingestion, health, or existing contract tests | Medium | High | Maintain full contract-test coverage for both old and new behavior; additive migration only; re-run the full `social-listening-core` suite before merge | Engineering |
| R-003 | `deleteCredential` and `getLatestCredentialId` signature changes break other callers such as pollers or health checks | Medium | High | Re-sign every consumer of these functions to pass `(tenantId, platformId, ownerType, userId?)`; enforce via contract tests | Engineering |
| R-004 | The missing `docs/implementation-log.md` entry for Story 1.6 undermines traceability and auditability | Low | Medium | Append the missing entry (or a documented reason for its absence) in a separate traceability pass; flagged in ADR-0034 Context | AI Delivery Agent / Menno |
| R-005 | Multiple credentials per `(tenant, platform)` pair make "most recently created" an unsafe selection heuristic for ingestion | Medium | High | Parameterize `getLatestCredentialId` by ownership scope so the poller requests exactly the credential it needs | Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0028 (credential creation authority scoped by ownership tier) | Governing ADR | Product Owner | Accepted 2026-08-03 |
| D-002 | ADR-0029 (authentication) | Governing ADR | Product Owner | Accepted 2026-08-03 |
| D-003 | ADR-0030/0031/0032 (admin tier, tenants, users tables) | Governing ADR / schema | Product Owner | Accepted 2026-08-03 |
| D-004 | ADR-0033 (retiring `X-Tenant-Id` in favor of bearer-token identity) | Governing ADR | Product Owner | Accepted 2026-08-03 |
| D-005 | ADR-0051 (connector activation decoupled from credential presence) | Related ADR | Product Owner | Accepted 2026-08-12; built as Story 1.11 |
| D-006 | Story 1.6 (existing placeholder-auth connect/disconnect code) | Pre-existing implementation | Engineering | Already shipped |
| D-007 | Story 6.3 (Admin UI connector connect/disconnect screen) | Downstream UI | Engineering | Built 2026-08-05 against Story 1.7's REST surface |

---

## 14. Acceptance Criteria

- **AC1 – Schema migration:** `platform_credentials` carries `owner_type` (`'tenant'` \| `'user'`, default `'tenant'`, not null) and a nullable `user_id` referencing `users(id)`, with a check constraint that enforces the `(owner_type='tenant' AND user_id IS NULL)` or `(owner_type='user' AND user_id IS NOT NULL)` shape. The migration is additive and every existing row remains valid.
- **AC2 – Tenant-wide connect authorization:** `POST /v1/connectors/:platformId/connect` with `ownerType:'tenant'` (or omitted) succeeds only when the caller's resolved role is `tenant_admin`; it returns `403` for `tenant_user` or anonymous callers.
- **AC3 – User-bound connect ownership:** `POST /v1/connectors/:platformId/connect` with `ownerType:'user'` sets `user_id` to the caller's own resolved `req.userId`; any `user_id` supplied by the client is ignored and has no effect, proven by a contract test that supplies a different `user_id`.
- **AC4 – Tenant-wide disconnect authorization:** Deleting a tenant-wide credential requires the caller's resolved role to be `tenant_admin`.
- **AC5 – User-bound disconnect dual actor:** Deleting a user-bound credential succeeds for the owning user, or for a Tenant-Admin of the same tenant (offboarding), and fails for all other callers.
- **AC6 – Scoped deletion:** `deleteCredential(...)` is re-signed to `(tenantId, platformId, ownerType, userId?)` and a contract test with one tenant-wide and one user-bound credential for the same `platformId` proves disconnecting one does not remove the other.
- **AC7 – Identity source:** `X-Tenant-Id` is no longer read or trusted by any connect/disconnect endpoint; caller identity comes exclusively from the `Authorization: Bearer` token resolved per ADR-0029/ADR-0033.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `owner_type` | Column on `platform_credentials` that marks a credential as either tenant-wide (`'tenant'`) or user-bound (`'user'`) |
| `user_id` | Foreign key from `platform_credentials` to `users(id)`, populated only when `owner_type = 'user'` |
| Tier 2 (ADR-0028) | Tenant-wide credential authority, restricted to the Tenant-Admin role |
| Tier 3 (ADR-0028) | User-bound credential authority, created only by the owning user's own act of activation |
| `ownerType` | Request body field on `POST /v1/connectors/:platformId/connect` selecting `'tenant'` or `'user'` |
| Application-layer authorization | Role and ownership checks performed in the HTTP handler, not by database RLS predicates |
| Offboarding revocation | A Tenant-Admin deleting a departed or unresponsive user's personal credential without being able to create or activate it on that user's behalf |

---

## 16. Appendices

### Appendix A – Source and related architecture documents

- [ADR-0034: Connector connect/disconnect CRUD — ownership-tier-aware credential creation, reworking Story 1.6's placeholder-auth shape](../../adr/0034-connector-connect-disconnect-crud-ownership-tier-aware.md) — primary source ADR.
- [ADR-0028: Credential creation authority scoped by ownership tier](../../adr/0028-credential-creation-authority-ownership-tier.md) — governing Tier 2/Tier 3 rule.
- [ADR-0029: Authentication](../../adr/0029-authentication.md) — bearer-token authentication.
- [ADR-0030: Admin tier](../../adr/0030-admin-tier.md), [ADR-0031: Tenants](../../adr/0031-tenants.md), [ADR-0032: Users](../../adr/0032-users.md) — identity and role tables.
- [ADR-0033: Retiring `X-Tenant-Id`](../../adr/0033-retiring-x-tenant-id.md) — caller identity from `Authorization: Bearer`.
- [ADR-0051: Connector activation decoupled from credential presence](../../adr/0051-connector-activation-decoupled.md) — resolves the open "activation table" question raised by ADR-0034.
- [Business-Case-v6.0.md](../../project%20docs/Business-Requirements/Business-Case-v6.0.md) §6 Dependency Matrix — originally flagged the placeholder-auth rework risk.

### Appendix B – User stories

- [Story 1.6 — Connector connect/disconnect REST surface (placeholder-auth shape)](../user-stories/epic-1-repository-and-api-foundation.md#story-16) — pre-existing, superseded work.
- [Story 1.7 — Ownership-tier-aware connector connect/disconnect, superseding Story 1.6](../user-stories/epic-1-repository-and-api-foundation.md#story-17) — buildable story for this BRD.
- [Story 1.11 — Connector activation, decoupled from credential presence](../user-stories/epic-1-repository-and-api-foundation.md#story-111) — related activation work per ADR-0051.
- [Story 6.3 — Connector connect/disconnect flow](../user-stories/epic-6-tenant-admin-ui.md#story-63) — Admin UI screen built against Story 1.7's REST surface.

### Appendix C – Missing sources

- **Feature design:** No matching `docs/product-research/feature-designs/<feature>.md` file was found for the connector connect/disconnect ownership-tier feature. The related Admin UI flow is covered by Story 6.3 and the `social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md` component skill.
- **Deep-research brief:** No `docs/product-research/reports/<feature>-deep-research.md` file was found for this ADR.
- **Implementation log gap:** `docs/implementation-log.md` does not contain an entry for the already-shipped Story 1.6 code; this is a standing traceability item surfaced by ADR-0034 and is not closed by this BRD.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
