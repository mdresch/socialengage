# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0051 Connector Activation Decoupled From Credential Presence — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0051-connector-activation-decoupled-from-credential.md, ../Business-Requirements/BRD-0051-Connector-Activation-Decoupled-From-Credential.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0051-connector-activation-decoupled-from-credential.md and the business requirements in BRD-0051-Connector-Activation-Decoupled-From-Credential.md into functional design for **Connector Activation Decoupled From Credential**.
The SocialEngage platform currently treats "this connector has a stored credential" and "this connector is intentionally turned on" as the same thing. For connectors that require an API key or OAuth token, the only way a Tenant-Admin can pause ingestion is to delete the credential entirely, which forces a complete reconnect later. For connectors that require no credential at all, such as Newswire, there is no on/off switch — every tenant sees the connector as active from the moment it is shipped. These gaps recreate the historical failure mode of the discontinued Microsoft Social Engagement product, where a connector could be effectively disconnected (and its stored credential lost) simply because it exhausted a rate-limit quota.

This BRD formalizes the business need for a separate, persisted **connector activation** signal that is independent of both credential presence and derived connector health. A Tenant-Admin or individual tenant user must be able to turn a connector on or off for their own ownership scope without losing any stored secret, and a connector must not begin polling until both activation and the necessary capability conditions are met. The solution introduces two ownership-scoped activation tables, new REST endpoints, and dedicated Admin UI controls, enabling non-destructive pauses and explicit opt-in for all connector types.

The expected business value is reduced support and reconfiguration cost, elimination of accidental credential loss, and a clear separation between human intent, credential validity, and runtime health — which also creates the preconditions for future capabilities such as pre-activation volume and cost estimates.

---

### 2.2 Scope
**In scope:**
- Two ownership-scoped activation tables: `connector_activations` (tenant-wide) and `connector_user_activations` (per-user).
- Lazy creation semantics: rows are written only on an explicit activate or deactivate action, not pre-populated.
- New `POST /v1/connectors/:platformId/activate` and `POST /v1/connectors/:platformId/deactivate` endpoints, discriminated by `ownerType`.
- Authorization mirroring the existing `connect`/`disconnect` split (`tenant_admin` for tenant scope, caller's own identity for user scope).
- Extension of `GET /v1/connectors/:platformId` to return an `isActive` boolean for tenant-wide scope.
- Ingestion gating: `shouldAttemptIngestion()` requires an active flag for the matching ownership scope.
- Admin UI activate/deactivate controls on the connector list and connector status screens.
- Distinct, clearly labeled "Deactivate" (pause, preserves credential) and "Disconnect" (delete credential) actions.
- Tenant-wide activation control on the tenant-owned-feed connector setup screen.

**Out of scope:**
- Live credential validation or "test connection" calls per connector.
- System-driven automatic connector deactivation.
- Correction of the `retryable` / `non-retryable` failure distinction in `deriveConnectorHealth()` (covered separately by ADR-0010/0023 Clarification notes).
- Platform-wide connector catalog, staged rollout, or canary availability.
- Pre-activation volume/cost estimation mechanism (explicitly left as a future capability).
- A user-scoped read of activation state in `GET /v1/connectors/:platformId`.

## 3. Context and Background
See ADR Context.
The SocialEngage platform currently treats "this connector has a stored credential" and "this connector is intentionally turned on" as the same thing. For connectors that require an API key or OAuth token, the only way a Tenant-Admin can pause ingestion is to delete the credential entirely, which forces a complete reconnect later. For connectors that require no credential at all, such as Newswire, there is no on/off switch — every tenant sees the connector as active from the moment it is shipped. These gaps recreate the historical failure mode of the discontinued Microsoft Social Engagement product, where a connector could be effectively disconnected (and its stored credential lost) simply because it exhausted a rate-limit quota.

This BRD formalizes the business need for a separate, persisted **connector activation** signal that is independent of both credential presence and derived connector health. A Tenant-Admin or individual tenant user must be able to turn a connector on or off for their own ownership scope without losing any stored secret, and a connector must not begin polling until both activation and the necessary capability conditions are met. The solution introduces two ownership-scoped activation tables, new REST endpoints, and dedicated Admin UI controls, enabling non-destructive pauses and explicit opt-in for all connector types.

The expected business value is reduced support and reconfiguration cost, elimination of accidental credential loss, and a clear separation between human intent, credential validity, and runtime health — which also creates the preconditions for future capabilities such as pre-activation volume and cost estimates.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable non-destructive pausing of credentialed connectors | A Tenant-Admin can deactivate and later reactivate a connector without re-entering its API key or OAuth token |
| 2 | Give Tenant-Admins explicit opt-in control over no-credential connectors | Newswire and future `authMode: 'none'` connectors default to inactive until a deliberate activation action is taken |
| 3 | Separate the signals of intent, credential presence, and health | No ingestion attempt is made unless all three signals are satisfied for the same ownership scope |
| 4 | Reduce historical MSE-style disconnect risk | Pausing a connector never deletes its credential or makes reconnection necessary |
| 5 | Preserve a future option for pre-activation impact estimation | Activation is a real, queryable "about to turn on" state before any ingestion starts |

---

**Positive consequences (from ADR):**
**Positive**
- Closes a real, currently-shipped bug: Newswire can finally be turned off for a tenant that doesn't want it, and every tenant no longer gets it silently on by default.
- Makes "pause" non-destructive for credentialed connectors — a Tenant-Admin no longer has to choose between "stay connected" and "lose the stored key," directly addressing the historical MSE failure mode Menno described (a connector disconnected — meaning credential lost — merely for exhausting quota) by ensuring that even if a future auto-pause mechanism is ever built, pausing will never mean losing the credential.
- Resolves ADR-0034's own named-but-unresolved Open Question with a concrete answer, rather than leaving it open indefinitely.
- A single, uniform mechanism (`connector_activations`) covers both `authMode: 'none'` and credentialed connectors, rather than each connector type inventing its own on/off gate the way ADR-0050 happened to for its own DNS-verification flow.
- Deliberately narrow scope (manual-only, no live validation) avoids building speculative machinery — no quota-tracking-driven auto-disable, no per-connector cost-incurring validation calls — ahead of an actual, named trigger or need.
- Creates the precondition for a future pre-activation impact estimate: because activation is now a real, queryable "about to turn this on" signal that exists before ingestion can start, a future capability could let a Tenant-Admin see an estimated downstream impact (ingestion volume, and — critically for `AIProviderConnector`s whose enrichment calls are billed per-invocation, ADR-0038 — estimated cost) before committing to activation, rather than discovering it only after real traffic starts. This ADR doesn't build that estimation mechanism, but its design doesn't foreclose it either — see Decision §2 and Open Question 8.

**Negative**
- Two new tables and two new endpoints are real, non-trivial implementation work for whoever picks up the resulting Story — two schema migrations, RLS policy on both tables, ownership-tier-aware authorization checks (mirroring `connect`/`disconnect`'s own existing split), and two new route handlers, plus a UI change to `social-listening-admin`'s connector and status screens to replace both hardcoded `authMode === 'none' → connected: true` branches.
- `GET /v1/connectors/:platformId`'s response shape (and the `ConnectorHealth` derivation/cache it wraps) will need to combine two now-separate signals — activation state and derived health — into one coherent "is this connector usable" answer; this ADR names the requirement (see ADR-0022's new dated note) without designing the combined response shape.
- Two distinct, similarly-named actions (deactivate vs. disconnect) for credentialed connectors is more UI surface and more opportunity for a Tenant-Admin to pick the wrong one — the Admin UI copy needs to make the destructive-vs-non-destructive distinction unmistakable, not assumed self-evident from a button label alone.
- Live credential validation remains a real, unaddressed gap: a Tenant-Admin can activate a connector whose stored credential is already dead, and won't find out until the next ingestion attempt fails — this ADR does not close that gap, only names it.
- The system-driven auto-deactivation question is left open rather than decided, which means the exact MSE-style failure mode this ADR exists to fix could theoretically resurface later if a future auto-disable mechanism is designed carelessly — named explicitly as a risk to weigh carefully whenever that future ADR is drafted, not a promise that it can't happen again.
- Platform-wide connector availability (staged/gradual rollout to validate a new connector's real-world performance before general availability) is a real, related gap this ADR does not close — a connector still goes from nonexistent to available-to-every-tenant the instant its code ships, with no in-between state. Not a current need (this project has no live tenants under real load yet), but a concrete, specific future trigger is named in Decision §9, not designed here.

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Configures and controls connectors for the tenant | High | Non-destructive pause, explicit opt-in, clear UI distinction between pause and disconnect |
| Tenant User | May own personal credentials for Tier 3 connectors | Medium | Activate/deactivate personal scope without admin involvement |
| Platform Admin | Owns overall platform and connector rollout | Low in this pass | No speculative platform-wide availability machinery |
| Product Owner (Menno) | Sponsor and decision authority | High | Alignment with historical MSE lessons and ADR intent |
| Engineering / QA | Builds and verifies the feature | High | Clear, testable ownership and idempotency rules |
| Customer Support | Handles connector reconfiguration issues | Medium | Fewer re-credentialing incidents and clearer user-visible states |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.11 | epic-1-repository-and-api-foundation.md | As Tenant-Admin or an individual tenant user, I want to turn a connector on or off for my own ownership scope, independent of whether a credential is stored,... | Two new tables exist: `connector_activations` (`tenant_id`, `platform_id`, `is_active boolean not null default false`, `activated_at`, `deactivated_at`, `upd... |
| Story 1.12 | epic-1-repository-and-api-foundation.md | As Tenant-Admin or tenant user viewing a connector's status, I want `GET /v1/connectors/:platformId` to tell me whether the connector is actually turned on, ... | `GET /v1/connectors/:platformId`'s response gains an `isActive` field (`boolean`), read via `isConnectorActive()` (`connectorActivationStore.ts`) for `ownerT... |
| Story 6.15 | epic-6-tenant-admin-ui.md | As Tenant-Admin or tenant user, I want to turn a connector on or off directly from the screens where I already manage it, so that pausing a connector — inste... | `core-client.ts` gains `activatePlatform(platformId, ownerType)` / `deactivatePlatform(platformId, ownerType, userId?)`, mirroring `connectPlatform()`/`disco... |
| Story 6.17 | epic-6-tenant-admin-ui.md | As Tenant-Admin who has already DNS-verified one or more tenant-owned-feed domains, I want to actually turn tenant-owned-feed polling on from the same screen... | `/tenant/connectors/tenant-owned-feed` (`TenantOwnedFeedPage`/`TenantOwnedFeedSetup.tsx`, Story 6.12) reads the connector's real current tenant-wide activati... |
| Story 6.21 | epic-6-tenant-admin-ui.md | As Tenant-Admin, I want to see Wikipedia listed alongside my other connectors and be able to activate it, so that a connector that's real and fully built on ... | `tenant/connectors/page.tsx`'s `PLATFORMS` array gains a `wikipedia` entry: `authMode: 'none'`, `credentialFields: []`, `personalScopeAllowed: false` — the i... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `connector_activations` | Tenant-wide connector on/off state | New table derived from ADR-0051 | Engineering | Tenant-confidential configuration |
| `connector_user_activations` | Per-user connector on/off state for credentialed connectors | New table derived from ADR-0051 | Engineering | Tenant- and user-confidential configuration |
| `platform_credentials` | Stored connector credentials (unchanged) | Existing table per ADR-0034 | Engineering | High — encrypted secrets |
| `ConnectorStatus.isActive` | Combined response field exposing tenant-wide activation | `GET /v1/connectors/:platformId` per Story 1.12 | Engineering | Tenant-confidential configuration |
| `ingestion_runs` | Connector attempt history, including `retryable` flag (unchanged) | Existing table per ADR-0010/0023 | Engineering | Operational telemetry |

---

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- The existing two-tier ownership model for credentials (tenant-wide and per-user, per ADR-0028/ADR-0034) remains in place.
- Connectors already declare an `authMode` (`none`, `api_key`, `oauth`) and are registered in the shared connector registry.
- A real scheduler will later consume the activation signal to decide whether to poll a tenant/connector pair.
- `authMode: 'none'` connectors never support a personal/user ownership scope.

**The durable decision — this is what would need superseding, not just amending:**

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Activation tables enforce tenant isolation | Security | Must | RLS predicates restrict rows to the caller's tenant per ADR-0015 |
| NFR-002 | Per-user activation ownership is enforced at the application layer | Security | Must | `ownerType: 'user'` always uses the resolved caller's `userId`; no client spoofing |
| NFR-003 | Activation endpoints mirror the authorization shape of connect/disconnect | Security | Must | `tenant_admin` for tenant scope; self (or admin override) for user scope |
| NFR-004 | Activation state changes are synchronous and side-effect-free | Reliability | Must | No ingestion run is created or cancelled by an activate/deactivate call |
| NFR-005 | The solution requires no historical data migration or backfill | Maintainability | Must | Existing tenants read as inactive for new connectors until explicitly activated |

---

## 11. Error Handling and Exceptions
**Positive**
- Closes a real, currently-shipped bug: Newswire can finally be turned off for a tenant that doesn't want it, and every tenant no longer gets it silently on by default.
- Makes "pause" non-destructive for credentialed connectors — a Tenant-Admin no longer has to choose between "stay connected" and "lose the stored key," directly addressing the historical MSE failure mode Menno described (a connector disconnected — meaning credential lost — merely for exhausting quota) by ensuring that even if a future auto-pause mechanism is ever built, pausing will never mean losing the credential.
- Resolves ADR-0034's own named-but-unresolved Open Question with a concrete answer, rather than leaving it open indefinitely.
- A single, uniform mechanism (`connector_activations`) covers both `authMode: 'none'` and credentialed connectors, rather than each connector type inventing its own on/off gate the way ADR-0050 happened to for its own DNS-verification flow.
- Deliberately narrow scope (manual-only, no live validation) avoids building speculative machinery — no quota-tracking-driven auto-disable, no per-connector cost-incurring validation calls — ahead of an actual, named trigger or need.
- Creates the precondition for a future pre-activation impact estimate: because activation is now a real, queryable "about to turn this on" signal that exists before ingestion can start, a future capability could let a Tenant-Admin see an estimated downstream impact (ingestion volume, and — critically for `AIProviderConnector`s whose enrichment calls are billed per-invocation, ADR-0038 — estimated cost) before committing to activation, rather than discovering it only after real traffic starts. This ADR doesn't build that estimation mechanism, but its design doesn't foreclose it either — see Decision §2 and Open Question 8.

**Negative**
- Two new tables and two new endpoints are real, non-trivial implementation work for whoever picks up the resulting Story — two schema migrations, RLS policy on both tables, ownership-tier-aware authorization checks (mirroring `connect`/`disconnect`'s own existing split), and two new route handlers, plus a UI change to `social-listening-admin`'s connector and status screens to replace both hardcoded `authMode === 'none' → connected: true` branches.
- `GET /v1/connectors/:platformId`'s response shape (and the `ConnectorHealth` derivation/cache it wraps) will need to combine two now-separate signals — activation state and derived health — into one coherent "is this connector usable" answer; this ADR names the requirement (see ADR-0022's new dated note) without designing the combined response shape.
- Two distinct, similarly-named actions (deactivate vs. disconnect) for credentialed connectors is more UI surface and more opportunity for a Tenant-Admin to pick the wrong one — the Admin UI copy needs to make the destructive-vs-non-destructive distinction unmistakable, not assumed self-evident from a button label alone.
- Live credential validation remains a real, unaddressed gap: a Tenant-Admin can activate a connector whose stored credential is already dead, and won't find out until the next ingestion attempt fails — this ADR does not close that gap, only names it.
- The system-driven auto-deactivation question is left open rather than decided, which means the exact MSE-style failure mode this ADR exists to fix could theoretically resurface later if a future auto-disable mechanism is designed carelessly — named explicitly as a risk to weigh carefully whenever that future ADR is drafted, not a promise that it can't happen again.
- Platform-wide connector availability (staged/gradual rollout to validate a new connector's real-world performance before general availability) is a real, related gap this ADR does not close — a connector still goes from nonexistent to available-to-every-tenant the instant its code ships, with no in-between state. Not a current need (this project has no live tenants under real load yet), but a concrete, specific future trigger is named in Decision §9, not designed here.

---

## 12. Assumptions and Dependencies
- The existing two-tier ownership model for credentials (tenant-wide and per-user, per ADR-0028/ADR-0034) remains in place.
- Connectors already declare an `authMode` (`none`, `api_key`, `oauth`) and are registered in the shared connector registry.
- A real scheduler will later consume the activation signal to decide whether to poll a tenant/connector pair.
- `authMode: 'none'` connectors never support a personal/user ownership scope.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Users confuse "Deactivate" with "Disconnect" and unintentionally delete credentials | Medium | High | UI labels, icons, and a two-click confirm for disconnect; keep deactivate visually adjacent but separate | Product |
| R-002 | Tenant-Admin expects an immediate poll when activating and sees none | Medium | Medium | In-product copy explains "takes effect on next cycle"; no instant poll promise | Product |
| R-003 | A future auto-deactivation mechanism repeats the historical MSE disconnect failure | Low | High | Future auto-deactivation requires its own ADR with explicit quota/health trigger design and historical-risk review | Product Owner |
| R-004 | Two similarly named tables create maintenance burden or query-path confusion | Medium | Low | Clear naming (`connector_activations` vs `connector_user_activations`) and store-layer methods that choose the right table by `ownerType` | Engineering |
| R-005 | Activation and health checks in `shouldAttemptIngestion()` interact unexpectedly | Medium | High | Contract tests cover all combinations: active+healthy, active+failing, inactive+healthy, no-credential, etc. | Engineering / QA |

---

## 14. Appendix
- ADR: `../../adr/0051-connector-activation-decoupled-from-credential.md`
- BRD: `../Business-Requirements/BRD-0051-Connector-Activation-Decoupled-From-Credential.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above