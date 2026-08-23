# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0017 API Versioning and Compatibility Policy — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0017-api-versioning-and-compatibility-policy.md, ../Business-Requirements/BRD-0017-API-Versioning-And-Compatibility-Policy.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0017-api-versioning-and-compatibility-policy.md and the business requirements in BRD-0017-API-Versioning-And-Compatibility-Policy.md into functional design for **API Versioning And Compatibility Policy**.
SocialEngage's `social-listening-core` REST API is already consumed by the `social-listening-admin` UI and will eventually be consumed by additional independently deployable subsystems (Brand Reputation & Alerts, Social Care, Social Selling). Because none of these consumers share a deployment boundary with `social-listening-core`, an undocumented or ungoverned API change made for one consumer can silently break another.

This BRD captures the business need for an explicit API versioning and compatibility policy. The adopted approach is URI path versioning (`/v1/...`, `/v2/...`) with an additive-first compatibility rule: within a version only backward-compatible changes are allowed, while any breaking change is released as a new version that runs alongside the prior version for a defined deprecation window. This gives every downstream consumer a stable contract and the freedom to migrate on its own schedule.

The expected business value is reduced integration risk, lower retrofit cost, and a public API surface that can evolve without forcing lock-step deployments across the platform.

---

### 2.2 Scope
**In scope:**
- URI path versioning for all `social-listening-core` REST endpoints (`/v1/...`, `/v2/...`, etc.).
- Additive-first compatibility rule within any single API version.
- Release of breaking changes only as a new version, with the prior version kept running unmodified.
- A minimum 90-day deprecation window after a successor version ships.
- Programmatic deprecation signaling via `Deprecation` and `Sunset` response headers (RFC 8594).
- Route-handler structure that forks only the specific endpoints that actually change between versions, avoiding wholesale API duplication.
- CI contract checks that fail the build if a change would break a documented consumer expectation within a versioned path.

**Out of scope:**
- Service Bus event-schema versioning (covered separately by ADR-0019).
- Header- or content-negotiation versioning schemes.
- Long-lived API keys, public developer onboarding, or external third-party API consumer management.
- OpenAPI/Swagger documentation, rate limiting, webhooks, or auth mechanism changes (related to, but not part of, this policy).

## 3. Context and Background
`social-listening-core`'s REST API (§6) is already consumed by a second, independently deployable repository (`social-listening-admin`, ADR-0001), and per §1/§7 will eventually be consumed by further independently deployable subsystems (Brand Reputation & Alerts, Social Care, Social Selling) that read from it directly rather than through the admin UI. None of those consumers share a deploy with `social-listening-core`. Without a stated compatibility policy, a change to the API that's convenient for the next feature can silently break a consumer that isn't in the room when the change is made.
SocialEngage's `social-listening-core` REST API is already consumed by the `social-listening-admin` UI and will eventually be consumed by additional independently deployable subsystems (Brand Reputation & Alerts, Social Care, Social Selling). Because none of these consumers share a deployment boundary with `social-listening-core`, an undocumented or ungoverned API change made for one consumer can silently break another.

This BRD captures the business need for an explicit API versioning and compatibility policy. The adopted approach is URI path versioning (`/v1/...`, `/v2/...`) with an additive-first compatibility rule: within a version only backward-compatible changes are allowed, while any breaking change is released as a new version that runs alongside the prior version for a defined deprecation window. This gives every downstream consumer a stable contract and the freedom to migrate on its own schedule.

The expected business value is reduced integration risk, lower retrofit cost, and a public API surface that can evolve without forcing lock-step deployments across the platform.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Prevent silent breaking changes for downstream API consumers | Zero unannounced breaking changes shipped to `/v1/` after policy adoption; CI contract check catches incompatible response-shape changes |
| 2 | Enable independent deployment and upgrade schedules for `social-listening-core` and its consumers | Consumers can remain on an old version for the full deprecation window while the core ships new versions |
| 3 | Reduce long-term maintenance and retrofit cost | Versioning built in from Phase 0 rather than retrofitted once real endpoints and consumers exist |
| 4 | Create a clear, discoverable contract for future public/integrations use | All REST endpoints are reachable under a versioned path; deprecation status is programmatically detectable |

---

**Positive consequences (from ADR):**
**Positive**
- Standard, well-understood pattern — any consumer (including future subsystems built by teams unfamiliar with this codebase's internals) immediately knows what `/v2/posts` implies without reading this ADR.
- Visible in logs, API gateway routing rules, and monitoring dashboards by construction, unlike header-based versioning which requires inspecting request headers to know which contract is in play.
- Admin UI and downstream subsystems can each upgrade to a new version on their own schedule within the deprecation window, rather than being forced to move in lockstep with `social-listening-core`'s deploys.

**Negative**
- Running two versions in parallel during a deprecation window means both must be tested and kept correct simultaneously — real maintenance cost, proportional to how many endpoints actually diverge between versions.
- URI versioning applies at a coarse (whole-API) granularity by convention; a single field change on one endpoint forces a decision about the *entire* version, even though only one endpoint changed. This is a known trade-off of path versioning and is mitigated, not eliminated, by only forking the specific changed handlers.
- The 90-day window is a placeholder default, not derived from anything in the spec or prior discussion — it needs an actual decision, likely informed by how many downstream subsystems exist and their own release cadences once they're built.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall expose every REST endpoint under a versioned URI path (e.g. `/v1/...`). | Must | No unversioned route exists; all documented endpoints are reachable under `/v1/`. | Backend Engineering |
| BR-002 | Within a version, the system shall allow only additive, backward-compatible changes. | Must | New optional fields, new endpoints, new optional query parameters, and new enum values are permitted; no field removal, renaming, type change, or behavior change occurs without a new version. | Backend Engineering |
| BR-003 | The system shall release breaking API changes as a new version and keep the prior version running unmodified. | Must | A `/v2/` or later prefix is introduced for breaking changes; the prior version continues to serve traffic unchanged. | Backend Engineering |
| BR-004 | The system shall signal deprecated versions with `Deprecation` and `Sunset` response headers. | Must | Responses from deprecated endpoints include `Deprecation` and `Sunset` headers per RFC 8594. | Backend Engineering |
| BR-005 | The system shall maintain a deprecated version for at least 90 days after its successor ships. | Must | The deprecated version is available and unmodified for 90 days from the successor version's release date. | Product Owner |
| BR-006 | CI shall fail the build if a change would break a documented consumer expectation within the current version. | Should | Contract tests compare response shapes against snapshots/expectations and fail on incompatible changes to `/v1/`. | Backend Engineering |
| BR-007 | Version forking shall be confined to the endpoints that actually changed between versions. | Should | Route handlers do not duplicate unchanged endpoints per version; only changed handlers have version-specific logic. | Backend Engineering |

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

The API must support breaking-change evolution through explicit versioning, under an additive-first compatibility rule: within a version, only backward-compatible changes are allowed (new optional fields, new endpoints, new optional query parameters, new enum values a consumer wasn't already exhaustively switching on); anything that removes or renames a field, changes a field's type or meaning, or changes existing endpoint behavior in a way that could break a consumer requires a new version, with the old version kept running unmodified alongside it for a deprecation window before removal. This is scoped to the REST API only — Service Bus event-schema evolution is addressed separately in ADR-0019, since events are thin (ADR-0012) and warrant a lighter-weight policy than the full REST surface.

**Initial implementation (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- Versioning scheme: **URI path versioning** (`/v1/...`, `/v2/...`).
- Deprecation window: **90 days** minimum after a successor version ships.
- Deprecation signaling: `Deprecation` and `Sunset` response headers ([RFC 8594](https://www.rfc-editor.org/rfc/rfc8594)), so it's programmatically detectable, not just documented in a changelog.
- Route handlers should be structured so version forking only happens at the specific endpoints that actually changed — not duplicated wholesale per version — to avoid the maintenance cost of two full copies of the API for the length of the deprecation window.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `social-listening-admin` UI team | Primary API consumer | High | Stable `/v1/` contract while new features are added |
| Future downstream subsystem teams (Brand Reputation, Social Care, Social Selling) | Future API consumers | High | Clear migration path and deprecation notice |
| Backend engineering team | API provider | High | Simple, maintainable route structure and CI enforcement |
| Product Owner | Scope and priority owner | Medium | Low-risk evolution of the public API surface |
| Platform Operations | Uptime and monitoring | Medium | Version visibility in logs, routing rules, and dashboards |
| Tenant-Admin / Tenant-User | Indirect consumers via UI and integrations | Low | No disruption to existing integrations |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.3 | epic-1-repository-and-api-foundation.md | As API consumer (admin UI or a future downstream subsystem), I want `social-listening-core`'s REST API served behind a `/v1/` path prefix, with breaking chan... | Every REST endpoint is reachable under `/v1/...`; no unversioned route exists.; A deprecated version continues serving unmodified traffic and returns `Deprec... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| API version prefix | Version segment in the request URI path (e.g. `v1`, `v2`) | Incoming HTTP request | API Platform | None |
| Deprecation status | Whether a version or endpoint is deprecated, plus sunset date | ADR Amendment Log / deployment configuration | API Platform | Internal |
| Consumer contract snapshot | Expected response-shape definitions used by CI contract checks | Contract tests / feature design | Engineering | Internal |
| Version traffic metrics | Request counts per version for monitoring and migration planning | Application logs / monitoring | Platform Operations | Internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Within a version, only additive changes are allowed: new optional fields, new endpoints, new optional query parameters, and new enum values that a consumer was not already exhaustively switching on. |
| BRU-002 | A breaking change is any removal or renaming of a field, change to a field's type or meaning, or change to existing endpoint behavior that could break a consumer. |
| BRU-003 | Any breaking change requires a new API version; the old version continues to serve unmodified traffic for at least 90 days. |
| BRU-004 | Deprecated endpoints must include `Deprecation` and `Sunset` response headers per RFC 8594. |
| BRU-005 | Version forking must occur only at the specific handlers that changed, not by duplicating the entire API per version. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Express route structure supports versioned routers | Internal | Backend Engineering | Built in Phase 0 |
| D-002 | CI contract-check infrastructure | Internal | Backend Engineering | Built with Story 1.3 |
| D-003 | ADR-0019 (Service Bus event-schema versioning) | External / Related | Architecture | Accepted separately |
| D-004 | Future downstream subsystems adopt versioned endpoints | External | Product / Consumers | As subsystems are built |
| D-005 | Real authentication and RLS middleware (ADR-0033) | Internal | Backend Engineering | Built |

---

- Downstream consumers are initially a small, known set of internal subsystems (`social-listening-admin` and future platform modules).
- Breaking API changes will be infrequent but realistic as the platform evolves.
- A 90-day deprecation window is a reasonable starting default and can be adjusted via the ADR's Amendment Log.

**The durable decision — this is what would need superseding, not just amending:**

The API must support breaking-change evolution through explicit versioning, under an additive-first compatibility rule: within a version, only backward-compatible changes are allowed (new optional fields, new endpoints, new optional query parameters, new enum values a consumer wasn't already exhaustively switching on); anything that removes or renames a field, changes a field's type or meaning, or changes existing endpoint behavior in a way that could break a consumer requires a new version, with the old version kept running unmodified alongside it for a deprecation window before removal. This is scoped to the REST API only — Service Bus event-schema evolution is addressed separately in ADR-0019, since events are thin (ADR-0012) and warrant a lighter-weight policy than the full REST surface.

**Initial implementation (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- Versioning scheme: **URI path versioning** (`/v1/...`, `/v2/...`).
- Deprecation window: **90 days** minimum after a successor version ships.
- Deprecation signaling: `Deprecation` and `Sunset` response headers ([RFC 8594](https://www.rfc-editor.org/rfc/rfc8594)), so it's programmatically detectable, not just documented in a changelog.
- Route handlers should be structured so version forking only happens at the specific endpoints that actually changed — not duplicated wholesale per version — to avoid the maintenance cost of two full copies of the API for the length of the deprecation window.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The versioning policy must be enforceable through CI and code review. | Maintainability | Must | A contract-check job runs on every PR and rejects unversioned or breaking-in-place changes. |
| NFR-002 | The active API version must be visible in logs, gateway routing rules, and monitoring dashboards. | Operability | Should | Requests are tagged with the version path segment; dashboards can filter by version. |
| NFR-003 | Running two versions in parallel must not double the maintenance burden for unchanged endpoints. | Maintainability | Should | Code review confirms unchanged endpoints are not duplicated across version routers. |

---

## 11. Error Handling and Exceptions
**Positive**
- Standard, well-understood pattern — any consumer (including future subsystems built by teams unfamiliar with this codebase's internals) immediately knows what `/v2/posts` implies without reading this ADR.
- Visible in logs, API gateway routing rules, and monitoring dashboards by construction, unlike header-based versioning which requires inspecting request headers to know which contract is in play.
- Admin UI and downstream subsystems can each upgrade to a new version on their own schedule within the deprecation window, rather than being forced to move in lockstep with `social-listening-core`'s deploys.

**Negative**
- Running two versions in parallel during a deprecation window means both must be tested and kept correct simultaneously — real maintenance cost, proportional to how many endpoints actually diverge between versions.
- URI versioning applies at a coarse (whole-API) granularity by convention; a single field change on one endpoint forces a decision about the *entire* version, even though only one endpoint changed. This is a known trade-off of path versioning and is mitigated, not eliminated, by only forking the specific changed handlers.
- The 90-day window is a placeholder default, not derived from anything in the spec or prior discussion — it needs an actual decision, likely informed by how many downstream subsystems exist and their own release cadences once they're built.

## 12. Assumptions and Dependencies
- Downstream consumers are initially a small, known set of internal subsystems (`social-listening-admin` and future platform modules).
- Breaking API changes will be infrequent but realistic as the platform evolves.
- A 90-day deprecation window is a reasonable starting default and can be adjusted via the ADR's Amendment Log.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Running two API versions in parallel increases testing and maintenance cost. | Medium | High | Fork only the changed handlers; use contract tests to keep both versions correct. | Technical Lead |
| R-002 | The 90-day deprecation window may not match downstream subsystem release cadences. | Medium | Medium | Make the window an implementation default that can be adjusted via the ADR Amendment Log. | Product Owner |
| R-003 | URI path versioning conventionally bumps the whole API, even for one endpoint change. | Medium | Medium | Isolate version forking to the specific changed endpoints rather than duplicating the full API. | Technical Lead |
| R-004 | Consumers may ignore deprecation headers and miss the migration window. | Low | High | Add monitoring, proactive communications, and migration documentation for each deprecated version. | Customer Success / Product Owner |
| R-005 | CI contract checks may be too coarse and block legitimate additive changes. | Low | Medium | Design contract checks to compare response-shape compatibility, not exact equality, and review failures. | Backend Engineering |

---

## 14. Appendix
- ADR: `../../adr/0017-api-versioning-and-compatibility-policy.md`
- BRD: `../Business-Requirements/BRD-0017-API-Versioning-And-Compatibility-Policy.md`
- Feature design: `docs/product-research/feature-designs/11-api-and-integrations.md`
- Deep research: `docs/product-research/reports/11-api-and-integrations-deep-research.md``
- User stories: see extracted stories above