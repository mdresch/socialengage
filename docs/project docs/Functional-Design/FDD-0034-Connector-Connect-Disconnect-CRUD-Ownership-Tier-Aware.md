# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0034 Connector Connect/Disconnect CRUD – Ownership-Tier-Aware Credential Creation — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0034-connector-connect-disconnect-crud-ownership-tier-aware.md, ../Business-Requirements/BRD-0034-Connector-Connect-Disconnect-CRUD-Ownership-Tier-Aware.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0034-connector-connect-disconnect-crud-ownership-tier-aware.md and the business requirements in BRD-0034-Connector-Connect-Disconnect-CRUD-Ownership-Tier-Aware.md into functional design for **Connector Connect Disconnect CRUD Ownership Tier Aware**.
**What problem are we solving?** The existing connector connect/disconnect endpoints (`POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect`) were built against a placeholder authentication model that trusted the self-declared `X-Tenant-Id` header. They have no concept of caller role or credential ownership tier, and the credential store keys only on `(tenant_id, platform_id)`. This means any caller with a tenant header can connect or disconnect a tenant's credential, and a Tenant-Admin disconnecting a tenant-wide credential can silently delete an unrelated user's personal credential once user-bound credentials are introduced.

**Who is affected?** Tenant-Admins who manage tenant-wide platform credentials, tenant users who activate their own personal credentials, and the engineering team that must rework the already-shipped `connectorsRouter.ts` and `credentialStore.ts` to align with the real authentication and ownership-tier model.

**What is the proposed solution at a glance?** Add `owner_type` and `user_id` columns to `platform_credentials`, enforce application-layer authorization on the connect and disconnect endpoints using the bearer-token-resolved caller identity, and rework `deleteCredential` and `getLatestCredentialId` to operate on a single ownership-scoped credential rather than every credential for a `(tenant, platform)` pair. The route surface remains small: one `POST /v1/connectors/:platformId/connect` endpoint, body-discriminated by `ownerType`, with an asymmetric disconnect shape for the dual-actor revocation case.

**What business value do we expect?** Credential creation authority is enforced in code for the first time per ADR-0028's Tier 2/Tier 3 rules, a latent cross-credential deletion bug is closed before user-bound credentials exist, and the connector surface is ready for the real `Authorization: Bearer` identity model.

---

### 2.2 Scope
**In scope:**
- Additive migration to `platform_credentials` adding `owner_type` and `user_id` with a check constraint.
- Application-layer authorization checks in `connectorsRouter.ts` for `POST /v1/connectors/:platformId/connect`.
- Application-layer authorization checks for disconnecting tenant-wide and user-bound credentials.
- Rework of `deleteCredential(tenantId, platformId)` to `deleteCredential(tenantId, platformId, ownerType, userId?)`.
- Parameterization of `getLatestCredentialId` to accept `(tenantId, platformId, ownerType, userId?)`.
- Removal of `X-Tenant-Id` as an authorization source; use `req.tenantId`, `req.userId`, and `req.role` from ADR-0033's middleware.
- Contract tests that cover the new schema, role checks, ownership checks, and the one-vs-many credential deletion correctness case.

**Out of scope:**
- A second RLS predicate on `user_id`; authorization remains application-layer.
- Separate `/connect` and `/connect-personal` route trees; a single body-discriminated route is retained.
- Resolution of the missing `docs/implementation-log.md` entry for Story 1.6; this is a traceability follow-up, not part of this feature.
- Deciding whether a tenant may have multiple activations of the same platform or whether connector activation needs its own table; ADR-0051 resolves this separately.
- Admin UI screen work; Story 6.3 already covers the connector connect/disconnect UI against Story 1.7's REST surface.

## 3. Context and Background
`Business-Case-v6.0.md`'s own dependency matrix flagged, before any code existed, that connector connect/disconnect endpoints "could theoretically be built against the placeholder, but would need rework once real auth lands — not recommended." They were built anyway (Phase 1's "also build, not storied" scope), verified directly against the current codebase this session:

- `social-listening-core/src/http/versions/v1/connectorsRouter.ts` implements `POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect`, both trusting `req.header('X-Tenant-Id')` as the entire tenant boundary, with **no role or ownership check of any kind** — any caller presenting any `X-Tenant-Id` value can connect or disconnect that tenant's credential for any platform.
- `social-listening-core/src/credentials/credentialStore.ts`'s `storeCredential(tenantId, platformId, plaintext, keyVaultKeyId)` and `deleteCredential(tenantId, platformId)` both key exclusively on `(tenant_id, platform_id)` — `platform_credentials` has no concept of *who within the tenant* owns a given credential, because no `users` table or ownership-tier model existed when it was built.
- A real contract test exists and passes (`social-listening-core/contracts/epic-1/story-1.6.connector-connect-disconnect.contract.test.ts`, 8 assertions, AC0–AC7), confirmed directly this session — the code is real and working against its own, pre-ADR-0028 contract.
- **A genuine documentation gap, found and flagged rather than fixed here:** `docs/implementation-plan.md` and `docs/open-items-and-deferred-work.md` both describe "Story 1.6" as complete, citing specific files and an 8-contract pass — but `docs/implementation-log.md`, the append-only, git-hash-verified record `docs/templates/check-implementation-log.cjs` checks, has **no corresponding entry at all**. The code and its contract test genuinely exist on disk (verified directly, this session, not merely trusted from prose) — this is a real traceability gap in exactly the sense this persona's own mandate treats as evidence, not process pedantry. Flagged for Menno or the AI Delivery Agent to close (append the missing entry, or state why one was never required) — appending a log entry is that skill's own job, not this ADR's, and is not done here.

ADR-0028 already requires: no system-wide credential ever; a tenant-wide credential created only by Tenant-Admin; a user-bound credential created only by the user's own act of activation, never by Tenant-Admin or Platform Admin on their behalf. Story 1.6's shipped code satisfies none of these distinctions, because it predates the `users`/Tenant-Admin model entirely — it is not wrong for what it was asked to prove (Phase 1's end-to-end pipeline), but it is now the concrete gap this ADR closes.
**What problem are we solving?** The existing connector connect/disconnect endpoints (`POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect`) were built against a placeholder authentication model that trusted the self-declared `X-Tenant-Id` header. They have no concept of caller role or credential ownership tier, and the credential store keys only on `(tenant_id, platform_id)`. This means any caller with a tenant header can connect or disconnect a tenant's credential, and a Tenant-Admin disconnecting a tenant-wide credential can silently delete an unrelated user's personal credential once user-bound credentials are introduced.

**Who is affected?** Tenant-Admins who manage tenant-wide platform credentials, tenant users who activate their own personal credentials, and the engineering team that must rework the already-shipped `connectorsRouter.ts` and `credentialStore.ts` to align with the real authentication and ownership-tier model.

**What is the proposed solution at a glance?** Add `owner_type` and `user_id` columns to `platform_credentials`, enforce application-layer authorization on the connect and disconnect endpoints using the bearer-token-resolved caller identity, and rework `deleteCredential` and `getLatestCredentialId` to operate on a single ownership-scoped credential rather than every credential for a `(tenant, platform)` pair. The route surface remains small: one `POST /v1/connectors/:platformId/connect` endpoint, body-discriminated by `ownerType`, with an asymmetric disconnect shape for the dual-actor revocation case.

**What business value do we expect?** Credential creation authority is enforced in code for the first time per ADR-0028's Tier 2/Tier 3 rules, a latent cross-credential deletion bug is closed before user-bound credentials exist, and the connector surface is ready for the real `Authorization: Bearer` identity model.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enforce ADR-0028's ownership-tier rules for credential creation and deletion in the connector connect/disconnect endpoints | Contract tests prove tenant-wide credentials are created only by Tenant-Admins and user-bound credentials only by the acting user |
| 2 | Prevent a Tenant-Admin's ordinary tenant-wide disconnect from silently deleting another user's personal credential | Contract test demonstrates one tenant-wide and one user-bound credential for the same platform can coexist and be disconnected independently |
| 3 | Keep the REST route surface small and maintainable for a solo project | Only one `POST /v1/connectors/:platformId/connect` route is introduced or retained, with body-discriminated authorization |
| 4 | Provide an offboarding safety valve so a departing user's personal credential can be revoked by a Tenant-Admin | Contract test proves a same-tenant Tenant-Admin can delete a user-bound credential, but cannot create or activate one on a user's behalf |
| 5 | Migrate existing credentials without data loss or downtime | All existing `platform_credentials` rows remain valid as tenant-wide credentials after the additive migration |

---

**Positive consequences (from ADR):**
**Positive**
- Directly builds ADR-0028's Tier 2/Tier 3 rules into real, enforced code for the first time — ADR-0028 itself has no story because nothing was buildable against it yet (its own "A note on this ADR's own place in the series' conventions"); this ADR is exactly the "candidate ADR #6" it named as the eventual home for that build.
- Item 4 (§4.4) closes a real correctness bug before it can ever manifest against real user data — caught during this ADR's own drafting, not after a real Tenant-Admin accidentally wipes a colleague's personal credential.
- The single-route, body-discriminated design (§5) keeps this project's route surface from growing faster than its actual authorization complexity requires.

**Negative**
- This ADR's own reading of ADR-0028 on revocation authority (§3, Tenant-Admin may delete but not create/activate a user-bound credential) is a genuine interpretive extension, not something ADR-0028 explicitly decided — named honestly rather than presented as settled; Menno's acceptance pass should confirm or reject it specifically, not wave it through as already-decided.
- §4's rework (schema migration, new authorization checks, `deleteCredential`/`getLatestCredentialId` signature changes) touches already-shipped, already-tested code — a real, non-trivial rework cost this project's own `Business-Case-v6.0.md` flagged as foreseeable before Story 1.6 was ever built, and is now due.
- The missing `docs/implementation-log.md` entry for Story 1.6 (Context, above) is a real, standing traceability gap this ADR surfaces but does not close — named plainly as unresolved, per this persona's own evidentiary standard, rather than assumed fixed by drafting this ADR.

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Creates and removes tenant-wide credentials; offboards users | High | Must be able to manage tenant connectors and revoke stale personal credentials without accidentally deleting another user's credential |
| Tenant User | Creates and removes own personal credentials | High | Must be able to connect a personal account without help, and must not have credentials created on their behalf |
| Platform Admin | Operates the platform, has no tenant content access | Low | Wants the security model to be consistent and auditable |
| Security / Compliance | Ensures credential ownership and least-privilege access | High | Wants role-based authority enforced in code, not by client declaration |
| Engineering | Implements the schema migration, router, and store changes | High | Wants a clear, testable authorization boundary and minimal rework surface |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.7 | epic-1-repository-and-api-foundation.md | As Tenant-Admin or an individual tenant user, I want connecting or disconnecting a platform credential to respect who is actually allowed to create or remove... | `platform_credentials` carries `owner_type` (`'tenant'` | `'user'`, default `'tenant'`) and a nullable `user_id` (required and FK-valid when `owner_type = 'u... |
| Story 1.11 | epic-1-repository-and-api-foundation.md | As Tenant-Admin or an individual tenant user, I want to turn a connector on or off for my own ownership scope, independent of whether a credential is stored,... | Two new tables exist: `connector_activations` (`tenant_id`, `platform_id`, `is_active boolean not null default false`, `activated_at`, `deactivated_at`, `upd... |
| Story 5.10 | epic-5-security-isolation-and-messaging.md | As platform operator responsible for this project's own stated security posture, I want every `/v1` endpoint to derive tenant identity exclusively from a val... | No `/v1` route reads `req.header('X-Tenant-Id')` to determine tenant identity — verified by a repository-wide check (or equivalent test) that no route handle... |
| Story 6.3 | epic-6-tenant-admin-ui.md | As Tenant-Admin or tenant user connecting a platform, I want a screen that lets me connect or disconnect a platform credential, tenant-wide or personal as my... | Lists the platforms with a real, shipped connector today (GNews/RSS-News, Newswire) with their current connection state, calling `GET`-equivalent state and `... |
| Story 6.12 | epic-6-tenant-admin-ui.md | As tenant wanting to monitor my own company's blog or newsroom feed, I want a setup flow that walks me through proving domain ownership and then activates po... | A dedicated connect flow (a new screen or a clearly distinct section of the connectors screen — not shoehorned into Story 6.3's existing single-credential `C... |
| Story 6.17 | epic-6-tenant-admin-ui.md | As Tenant-Admin who has already DNS-verified one or more tenant-owned-feed domains, I want to actually turn tenant-owned-feed polling on from the same screen... | `/tenant/connectors/tenant-owned-feed` (`TenantOwnedFeedPage`/`TenantOwnedFeedSetup.tsx`, Story 6.12) reads the connector's real current tenant-wide activati... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `platform_credentials.owner_type` | Ownership tier discriminator (`'tenant'` or `'user'`) | Additive migration on `platform_credentials` | Engineering | High – determines authorization scope |
| `platform_credentials.user_id` | Foreign key to `users(id)` for user-bound credentials; `NULL` for tenant-wide | Additive migration on `platform_credentials` | Engineering | High – links credential to a person |
| `platform_credentials` existing columns | Encrypted credential envelope, `tenant_id`, `platform_id`, etc. | Existing table (Story 1.6/2.6/2.7) | Engineering | High – secret material, encrypted per ADR-0014 |
| `users.id` / `users.role` | Caller identity and role used by authorization checks | `users` table (ADR-0031/ADR-0032) | Engineering | High – personal/role data |
| `connector_activations` (related, out of scope) | Separate activation state per platform, tenant-wide | ADR-0051 / Story 1.11 | Engineering | Medium – operational state, not credential content |
| `connector_user_activations` (related, out of scope) | Separate activation state per platform, per user | ADR-0051 / Story 1.11 | Engineering | Medium – operational state, not credential content |

---

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- Real bearer-token authentication and identity-resolution middleware from ADR-0029/ADR-0033 is in place before this work is built.
- The `users` table and role model from ADR-0031/ADR-0032 are in place.
- Every existing `platform_credentials` row represents a tenant-wide credential (ADR-0028 Tier 2), so the additive migration can safely default `owner_type` to `'tenant'` and `user_id` to `NULL`.
- The `connector_activations` / `connector_user_activations` tables described by ADR-0051 will be built separately and do not change this BRD's scope.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Existing `platform_credentials` rows remain valid and no data is lost after the migration | Data Integrity | Must | After the additive migration, every pre-existing row is `owner_type='tenant'`, `user_id=NULL`; the contract test suite still passes |
| NFR-002 | Authorization is enforced at the application layer, not by a second RLS predicate on `user_id` | Security | Should | `tenant_isolation` RLS policy remains `tenant_id`-only; no new per-user RLS predicate is added to `platform_credentials` |
| NFR-003 | The REST route surface must not grow faster than the authorization complexity requires | Maintainability | Should | The new connect surface is one `POST` route; disconnect uses an existing or minimally-discriminated shape |
| NFR-004 | Rework must be covered by contract tests and must not break existing ingestion or health endpoints | Reliability | Must | Full `social-listening-core` contract suite passes with the new connector and credential store changes |

---

## 11. Error Handling and Exceptions
**Positive**
- Directly builds ADR-0028's Tier 2/Tier 3 rules into real, enforced code for the first time — ADR-0028 itself has no story because nothing was buildable against it yet (its own "A note on this ADR's own place in the series' conventions"); this ADR is exactly the "candidate ADR #6" it named as the eventual home for that build.
- Item 4 (§4.4) closes a real correctness bug before it can ever manifest against real user data — caught during this ADR's own drafting, not after a real Tenant-Admin accidentally wipes a colleague's personal credential.
- The single-route, body-discriminated design (§5) keeps this project's route surface from growing faster than its actual authorization complexity requires.

**Negative**
- This ADR's own reading of ADR-0028 on revocation authority (§3, Tenant-Admin may delete but not create/activate a user-bound credential) is a genuine interpretive extension, not something ADR-0028 explicitly decided — named honestly rather than presented as settled; Menno's acceptance pass should confirm or reject it specifically, not wave it through as already-decided.
- §4's rework (schema migration, new authorization checks, `deleteCredential`/`getLatestCredentialId` signature changes) touches already-shipped, already-tested code — a real, non-trivial rework cost this project's own `Business-Case-v6.0.md` flagged as foreseeable before Story 1.6 was ever built, and is now due.
- The missing `docs/implementation-log.md` entry for Story 1.6 (Context, above) is a real, standing traceability gap this ADR surfaces but does not close — named plainly as unresolved, per this persona's own evidentiary standard, rather than assumed fixed by drafting this ADR.

## 12. Assumptions and Dependencies
- Real bearer-token authentication and identity-resolution middleware from ADR-0029/ADR-0033 is in place before this work is built.
- The `users` table and role model from ADR-0031/ADR-0032 are in place.
- Every existing `platform_credentials` row represents a tenant-wide credential (ADR-0028 Tier 2), so the additive migration can safely default `owner_type` to `'tenant'` and `user_id` to `NULL`.
- The `connector_activations` / `connector_user_activations` tables described by ADR-0051 will be built separately and do not change this BRD's scope.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The interpretive extension that a Tenant-Admin may delete (but not create/activate) a user-bound credential conflicts with a stricter reading of ADR-0028 | Low | Medium | Confirmed as drafted by Menno at ADR-0034 acceptance; documented as a named interpretation in the BRD and ADR | Product Owner |
| R-002 | Reworking already-shipped `connectorsRouter.ts` and `credentialStore.ts` introduces regressions in ingestion, health, or existing contract tests | Medium | High | Maintain full contract-test coverage for both old and new behavior; additive migration only; re-run the full `social-listening-core` suite before merge | Engineering |
| R-003 | `deleteCredential` and `getLatestCredentialId` signature changes break other callers such as pollers or health checks | Medium | High | Re-sign every consumer of these functions to pass `(tenantId, platformId, ownerType, userId?)`; enforce via contract tests | Engineering |
| R-004 | The missing `docs/implementation-log.md` entry for Story 1.6 undermines traceability and auditability | Low | Medium | Append the missing entry (or a documented reason for its absence) in a separate traceability pass; flagged in ADR-0034 Context | AI Delivery Agent / Menno |
| R-005 | Multiple credentials per `(tenant, platform)` pair make "most recently created" an unsafe selection heuristic for ingestion | Medium | High | Parameterize `getLatestCredentialId` by ownership scope so the poller requests exactly the credential it needs | Engineering |

---

## 14. Appendix
- ADR: `../../adr/0034-connector-connect-disconnect-crud-ownership-tier-aware.md`
- BRD: `../Business-Requirements/BRD-0034-Connector-Connect-Disconnect-CRUD-Ownership-Tier-Aware.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above