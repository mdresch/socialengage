# BRD-0051 — Connector Activation Decoupled From Credential Presence

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0051 — Connector Activation Decoupled From Credential Presence |
| Version | 1.0 |
| Date | 2026-08-12 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno (Sponsor / Product Owner) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-12 | AI Business & Requirements Analyst | Initial draft derived from ADR-0051 and related user stories |

---

## 2. Executive Summary

The SocialEngage platform currently treats "this connector has a stored credential" and "this connector is intentionally turned on" as the same thing. For connectors that require an API key or OAuth token, the only way a Tenant-Admin can pause ingestion is to delete the credential entirely, which forces a complete reconnect later. For connectors that require no credential at all, such as Newswire, there is no on/off switch — every tenant sees the connector as active from the moment it is shipped. These gaps recreate the historical failure mode of the discontinued Microsoft Social Engagement product, where a connector could be effectively disconnected (and its stored credential lost) simply because it exhausted a rate-limit quota.

This BRD formalizes the business need for a separate, persisted **connector activation** signal that is independent of both credential presence and derived connector health. A Tenant-Admin or individual tenant user must be able to turn a connector on or off for their own ownership scope without losing any stored secret, and a connector must not begin polling until both activation and the necessary capability conditions are met. The solution introduces two ownership-scoped activation tables, new REST endpoints, and dedicated Admin UI controls, enabling non-destructive pauses and explicit opt-in for all connector types.

The expected business value is reduced support and reconfiguration cost, elimination of accidental credential loss, and a clear separation between human intent, credential validity, and runtime health — which also creates the preconditions for future capabilities such as pre-activation volume and cost estimates.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable non-destructive pausing of credentialed connectors | A Tenant-Admin can deactivate and later reactivate a connector without re-entering its API key or OAuth token |
| 2 | Give Tenant-Admins explicit opt-in control over no-credential connectors | Newswire and future `authMode: 'none'` connectors default to inactive until a deliberate activation action is taken |
| 3 | Separate the signals of intent, credential presence, and health | No ingestion attempt is made unless all three signals are satisfied for the same ownership scope |
| 4 | Reduce historical MSE-style disconnect risk | Pausing a connector never deletes its credential or makes reconnection necessary |
| 5 | Preserve a future option for pre-activation impact estimation | Activation is a real, queryable "about to turn on" state before any ingestion starts |

---

## 4. Scope

### 4.1 In Scope

- Two ownership-scoped activation tables: `connector_activations` (tenant-wide) and `connector_user_activations` (per-user).
- Lazy creation semantics: rows are written only on an explicit activate or deactivate action, not pre-populated.
- New `POST /v1/connectors/:platformId/activate` and `POST /v1/connectors/:platformId/deactivate` endpoints, discriminated by `ownerType`.
- Authorization mirroring the existing `connect`/`disconnect` split (`tenant_admin` for tenant scope, caller's own identity for user scope).
- Extension of `GET /v1/connectors/:platformId` to return an `isActive` boolean for tenant-wide scope.
- Ingestion gating: `shouldAttemptIngestion()` requires an active flag for the matching ownership scope.
- Admin UI activate/deactivate controls on the connector list and connector status screens.
- Distinct, clearly labeled "Deactivate" (pause, preserves credential) and "Disconnect" (delete credential) actions.
- Tenant-wide activation control on the tenant-owned-feed connector setup screen.

### 4.2 Out of Scope

- Live credential validation or "test connection" calls per connector.
- System-driven automatic connector deactivation.
- Correction of the `retryable` / `non-retryable` failure distinction in `deriveConnectorHealth()` (covered separately by ADR-0010/0023 Clarification notes).
- Platform-wide connector catalog, staged rollout, or canary availability.
- Pre-activation volume/cost estimation mechanism (explicitly left as a future capability).
- A user-scoped read of activation state in `GET /v1/connectors/:platformId`.

### 4.3 Assumptions

- The existing two-tier ownership model for credentials (tenant-wide and per-user, per ADR-0028/ADR-0034) remains in place.
- Connectors already declare an `authMode` (`none`, `api_key`, `oauth`) and are registered in the shared connector registry.
- A real scheduler will later consume the activation signal to decide whether to poll a tenant/connector pair.
- `authMode: 'none'` connectors never support a personal/user ownership scope.

### 4.4 Constraints

- No pre-population or backfill of activation rows: tenant creation stays a single `INSERT` into `tenants`.
- No second RLS predicate for per-user rows: ownership is enforced at the application layer, mirroring `platform_credentials`.
- Activation changes are synchronous writes only; they do not trigger an immediate ingestion run or cancel one already in flight.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Configures and controls connectors for the tenant | High | Non-destructive pause, explicit opt-in, clear UI distinction between pause and disconnect |
| Tenant User | May own personal credentials for Tier 3 connectors | Medium | Activate/deactivate personal scope without admin involvement |
| Platform Admin | Owns overall platform and connector rollout | Low in this pass | No speculative platform-wide availability machinery |
| Product Owner (Menno) | Sponsor and decision authority | High | Alignment with historical MSE lessons and ADR intent |
| Engineering / QA | Builds and verifies the feature | High | Clear, testable ownership and idempotency rules |
| Customer Support | Handles connector reconfiguration issues | Medium | Fewer re-credentialing incidents and clearer user-visible states |

---

## 6. Current State (As-Is)

**Current process:**

1. A connector with `authMode: 'none'` (Newswire) has no credential to store and is hardcoded as `connected: true` in the Admin UI for every tenant. There is no lever to turn it off.
2. A connector with `authMode: 'api_key'` or `'oauth'` is treated as connected if and only if a `platform_credentials` row exists for that tenant/platform/owner scope.
3. To "pause" a credentialed connector, a Tenant-Admin must call `disconnect`, which performs a hard `DELETE FROM platform_credentials`.
4. Re-enabling the connector later requires re-entering the secret or re-authorizing via OAuth from scratch.
5. Ingestion gating in `shouldAttemptIngestion()` checks derived health only and does not distinguish administrative pause from genuine failure.

**Pain points:**
- No-credential connectors cannot be opted out of, so every tenant ingests Newswire regardless of need.
- Pausing a credentialed connector is destructive: the stored credential is lost.
- The only two states visible to the user are "has credential" and "credential gone," conflating capability with intent.
- A future auto-pause mechanism (e.g., on quota exhaustion) would, under the current model, force the same re-credentialing pain.

---

## 7. Future State (To-Be)

**New or improved process:**

1. Every connector has a persisted **activation** state stored separately from any credential.
2. For the tenant-wide scope, `connector_activations` records whether the Tenant-Admin has turned the connector on.
3. For the per-user scope, `connector_user_activations` records whether the individual user has turned their personal credential on.
4. A Tenant-Admin or user calls `POST .../activate` or `POST .../deactivate` to change intent, while `POST .../connect` and `POST .../disconnect` continue to manage credential storage.
5. The Admin UI renders an explicit **Activate** / **Deactivate** control on the connector list, status, and tenant-owned-feed setup screens.
6. Ingestion is attempted only when activation, credential (where required), and health all hold for the same scope.
7. Activation changes take effect on the next ingestion cycle; no ingestion run is triggered or aborted by the change itself.

**Expected capabilities:**
- Non-destructive pause of any credentialed connector.
- Explicit, reversible opt-in for `authMode: 'none'` connectors.
- Clear separation between "turned on," "has a valid credential," and "is healthy."
- Foundation for a future pre-activation volume/cost preview before a Tenant-Admin commits to turning a connector on.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall maintain a tenant-wide connector activation record | Must | `connector_activations` table exists with one row per `(tenant, platform)`; `is_active` is `false` when the row is absent | Engineering |
| BR-002 | The system shall maintain a per-user connector activation record for credentialed connectors | Must | `connector_user_activations` table exists with one row per `(tenant, platform, user)`; never used for `authMode: 'none'` | Engineering |
| BR-003 | The system shall create activation rows only on explicit user action | Must | No row is inserted at tenant creation, connector registration, or by migration; first activate/deactivate creates the row | Engineering |
| BR-004 | The system shall provide a tenant-wide activate endpoint | Must | `POST /v1/connectors/:platformId/activate` with `ownerType: 'tenant'` requires `tenant_admin` role and writes `connector_activations` | Engineering |
| BR-005 | The system shall provide a tenant-wide deactivate endpoint | Must | `POST /v1/connectors/:platformId/deactivate` with `ownerType: 'tenant'` requires `tenant_admin` role and sets `is_active = false` | Engineering |
| BR-006 | The system shall provide per-user activate and deactivate endpoints | Must | `ownerType: 'user'` uses the caller's own identity; `deactivate` also permits a `tenant_admin` override for the target user | Engineering |
| BR-007 | The system shall expose current tenant-wide activation in connector status | Must | `GET /v1/connectors/:platformId` returns `isActive: boolean` read fresh on every request | Engineering |
| BR-008 | The system shall gate ingestion on activation state | Must | `shouldAttemptIngestion()` requires an active row for the matching scope in addition to healthy status | Engineering |
| BR-009 | The Admin UI shall display activate/deactivate controls on the connector list and status screens | Must | New `ActivateDeactivateButton` rendered for every platform; Newswire no longer hardcoded as active | Product / Engineering |
| BR-010 | The Admin UI shall keep disconnect and deactivate actions visually and behaviorally distinct | Must | Deactivate pauses and preserves the credential; disconnect deletes the credential; both remain available | Product / Engineering |
| BR-011 | The system shall treat repeated activate/deactivate calls as idempotent | Should | Second identical call does not error or update timestamps needlessly | Engineering |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Activation tables enforce tenant isolation | Security | Must | RLS predicates restrict rows to the caller's tenant per ADR-0015 |
| NFR-002 | Per-user activation ownership is enforced at the application layer | Security | Must | `ownerType: 'user'` always uses the resolved caller's `userId`; no client spoofing |
| NFR-003 | Activation endpoints mirror the authorization shape of connect/disconnect | Security | Must | `tenant_admin` for tenant scope; self (or admin override) for user scope |
| NFR-004 | Activation state changes are synchronous and side-effect-free | Reliability | Must | No ingestion run is created or cancelled by an activate/deactivate call |
| NFR-005 | The solution requires no historical data migration or backfill | Maintainability | Must | Existing tenants read as inactive for new connectors until explicitly activated |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Activation is a pure intent signal and does not imply credential validity, health, or that ingestion will occur. |
| BRU-002 | A connector actually polls only when `is_active = true`, any required credential is present, and derived health is not `failing`. |
| BRU-003 | Deactivate preserves the credential in `platform_credentials`; Disconnect deletes the credential. The two are never the same operation. |
| BRU-004 | Activating or deactivating one ownership scope (tenant-wide or per-user) has no effect on the other scope for the same connector. |
| BRU-005 | `ownerType: 'user'` is invalid for `authMode: 'none'` connectors — no personal scope exists for connectors without a personal credential. |
| BRU-006 | Absence of an activation row is equivalent to `is_active = false`. |
| BRU-007 | Every activation and deactivation is a human action; the system does not flip the flag automatically. |
| BRU-008 | Activation changes take effect on the next ingestion cycle, not immediately. |
| BRU-009 | Newly created tenants and newly shipped connectors have no pre-created activation rows. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `connector_activations` | Tenant-wide connector on/off state | New table derived from ADR-0051 | Engineering | Tenant-confidential configuration |
| `connector_user_activations` | Per-user connector on/off state for credentialed connectors | New table derived from ADR-0051 | Engineering | Tenant- and user-confidential configuration |
| `platform_credentials` | Stored connector credentials (unchanged) | Existing table per ADR-0034 | Engineering | High — encrypted secrets |
| `ConnectorStatus.isActive` | Combined response field exposing tenant-wide activation | `GET /v1/connectors/:platformId` per Story 1.12 | Engineering | Tenant-confidential configuration |
| `ingestion_runs` | Connector attempt history, including `retryable` flag (unchanged) | Existing table per ADR-0010/0023 | Engineering | Operational telemetry |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Active connectors per tenant | Track which connectors are turned on and by whom | Product / Support | Ad hoc |
| Activation/deactivation event log | Audit tenant/user connector state changes | Compliance / Support | Real-time on request |
| Active-but-failing connectors | Highlight connectors that are on but not healthy due to credential or runtime issues | Operations / Support | Daily |
| Paused-but-credentialed connectors | Identify connectors intentionally deactivated but ready to resume | Tenant-Admin / Support | Ad hoc |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Users confuse "Deactivate" with "Disconnect" and unintentionally delete credentials | Medium | High | UI labels, icons, and a two-click confirm for disconnect; keep deactivate visually adjacent but separate | Product |
| R-002 | Tenant-Admin expects an immediate poll when activating and sees none | Medium | Medium | In-product copy explains "takes effect on next cycle"; no instant poll promise | Product |
| R-003 | A future auto-deactivation mechanism repeats the historical MSE disconnect failure | Low | High | Future auto-deactivation requires its own ADR with explicit quota/health trigger design and historical-risk review | Product Owner |
| R-004 | Two similarly named tables create maintenance burden or query-path confusion | Medium | Low | Clear naming (`connector_activations` vs `connector_user_activations`) and store-layer methods that choose the right table by `ownerType` | Engineering |
| R-005 | Activation and health checks in `shouldAttemptIngestion()` interact unexpectedly | Medium | High | Contract tests cover all combinations: active+healthy, active+failing, inactive+healthy, no-credential, etc. | Engineering / QA |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0028 / ADR-0034 ownership-tier model for credentials | Internal / Architectural | Engineering | Already Accepted |
| D-002 | ADR-0010 / ADR-0023 `retryable` failure distinction for health derivation | Internal / Corrective | Engineering | Accepted; implemented via Story 2.12 |
| D-003 | ADR-0050 tenant-owned-feed DNS verification flow | Internal / Connector-specific | Engineering | Accepted; UI wiring via Story 6.17 |
| D-004 | Story 1.11 — backend schema and REST surface for activation | Internal | Engineering | Built 2026-08-12 |
| D-005 | Story 1.12 — `GET /v1/connectors/:platformId` `isActive` field | Internal | Engineering | Built 2026-08-12 |
| D-006 | Story 6.15 — Admin UI activate/deactivate controls | Internal | Engineering | Built 2026-08-12 |
| D-007 | Story 6.17 — tenant-owned-feed activation control | Internal | Engineering | Ready |
| D-008 | Dedicated feature design or deep-research brief for connector activation | Internal / Research | Product | Not found; BRD synthesized from ADR and stories (see Appendix) |

---

## 14. Acceptance Criteria

1. `POST /v1/connectors/:platformId/activate` and `.../deactivate` exist and are discriminated by `ownerType` with the same authorization as `connect`/`disconnect`.
2. `connector_activations` and `connector_user_activations` are created lazily only on an explicit action; no rows are pre-populated.
3. `GET /v1/connectors/:platformId` returns `isActive: false` when no `connector_activations` row exists.
4. `shouldAttemptIngestion()` requires an active row for the matching scope before attempting to poll.
5. The Admin UI no longer hardcodes `authMode: 'none'` connectors as always active; Newswire renders Inactive until a Tenant-Admin activates it.
6. Deactivate and disconnect are separate UI actions; deactivate preserves the credential.
7. Activating one ownership scope does not create, modify, or read the other scope's table.
8. Repeated activate or deactivate calls are idempotent no-ops when the state already matches.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Activation** | A persisted human intent signal indicating that a connector is turned on for a specific ownership scope. |
| **authMode** | The authentication mode of a connector — `none`, `api_key`, or `oauth`. |
| **connector_activations** | Tenant-wide table storing whether a connector is active for a tenant. |
| **connector_user_activations** | Per-user table storing whether a user-owned connector is active. |
| **Deactivate** | Pause a connector without deleting its stored credential. |
| **Disconnect** | Remove a stored credential, effectively forgetting the connector for that scope. |
| **ownerType** | Request body discriminator: `'tenant'` (tenant-wide) or `'user'` (per-user). |
| **RLS** | Row-Level Security: the tenant-isolation mechanism on every tenant-scoped table. |
| **shouldAttemptIngestion** | The function that decides whether a connector is eligible to be polled. |
| **ConnectorHealth** | Derived status of a connector based on recent ingestion runs. |

---

## 16. Appendices

### 16.1 Reference Documents

- [ADR-0051: Connector activation decoupled from credential storage](../../adr/0051-connector-activation-decoupled-from-credential.md)
- [Story 1.11 — Connector activation, decoupled from credential presence](../../user-stories/epic-1-repository-and-api-foundation.md)
- [Story 1.12 — `GET /v1/connectors/:platformId` combines activation state with derived health](../../user-stories/epic-1-repository-and-api-foundation.md)
- [Story 2.12 — `deriveConnectorHealth()` excludes retryable failures from the `failing` derivation](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
- [Story 6.15 — Activate/deactivate controls on the connectors and connector-status screens](../../user-stories/epic-6-tenant-admin-ui.md)
- [Story 6.17 — Tenant-wide activate/deactivate control on the tenant-owned-feed connector screen](../../user-stories/epic-6-tenant-admin-ui.md)

### 16.2 Source Notes

- No dedicated `docs/product-research/feature-designs/<feature>.md` file exists for connector activation itself; this BRD was synthesized directly from ADR-0051 and the related user stories listed above.
- No `docs/product-research/reports/<feature>-deep-research.md` file was found for connector activation; the `07-publishing-and-scheduling-deep-research.md` report does not cover this capability.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-12 |
| Product Owner | Menno | | 2026-08-12 |
| Technical Lead | Menno | | 2026-08-12 |
| Other Stakeholder | | | |
