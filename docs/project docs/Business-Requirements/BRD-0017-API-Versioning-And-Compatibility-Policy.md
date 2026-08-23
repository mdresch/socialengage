# Business Requirements Document – API Versioning and Compatibility Policy

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – API Versioning and Compatibility Policy BRD |
| Version | 1.0 |
| Date | 2026-08-22 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-22 | BRD Writer Agent | Initial draft from ADR-0017, feature design 11, and Story 1.3 |
| 1.0 | 2026-08-22 | BRD Writer Agent | Approved for business use |

---

## 2. Executive Summary

SocialEngage's `social-listening-core` REST API is already consumed by the `social-listening-admin` UI and will eventually be consumed by additional independently deployable subsystems (Brand Reputation & Alerts, Social Care, Social Selling). Because none of these consumers share a deployment boundary with `social-listening-core`, an undocumented or ungoverned API change made for one consumer can silently break another.

This BRD captures the business need for an explicit API versioning and compatibility policy. The adopted approach is URI path versioning (`/v1/...`, `/v2/...`) with an additive-first compatibility rule: within a version only backward-compatible changes are allowed, while any breaking change is released as a new version that runs alongside the prior version for a defined deprecation window. This gives every downstream consumer a stable contract and the freedom to migrate on its own schedule.

The expected business value is reduced integration risk, lower retrofit cost, and a public API surface that can evolve without forcing lock-step deployments across the platform.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Prevent silent breaking changes for downstream API consumers | Zero unannounced breaking changes shipped to `/v1/` after policy adoption; CI contract check catches incompatible response-shape changes |
| 2 | Enable independent deployment and upgrade schedules for `social-listening-core` and its consumers | Consumers can remain on an old version for the full deprecation window while the core ships new versions |
| 3 | Reduce long-term maintenance and retrofit cost | Versioning built in from Phase 0 rather than retrofitted once real endpoints and consumers exist |
| 4 | Create a clear, discoverable contract for future public/integrations use | All REST endpoints are reachable under a versioned path; deprecation status is programmatically detectable |

---

## 4. Scope

### 4.1 In Scope

- URI path versioning for all `social-listening-core` REST endpoints (`/v1/...`, `/v2/...`, etc.).
- Additive-first compatibility rule within any single API version.
- Release of breaking changes only as a new version, with the prior version kept running unmodified.
- A minimum 90-day deprecation window after a successor version ships.
- Programmatic deprecation signaling via `Deprecation` and `Sunset` response headers (RFC 8594).
- Route-handler structure that forks only the specific endpoints that actually change between versions, avoiding wholesale API duplication.
- CI contract checks that fail the build if a change would break a documented consumer expectation within a versioned path.

### 4.2 Out of Scope

- Service Bus event-schema versioning (covered separately by ADR-0019).
- Header- or content-negotiation versioning schemes.
- Long-lived API keys, public developer onboarding, or external third-party API consumer management.
- OpenAPI/Swagger documentation, rate limiting, webhooks, or auth mechanism changes (related to, but not part of, this policy).

### 4.3 Assumptions

- Downstream consumers are initially a small, known set of internal subsystems (`social-listening-admin` and future platform modules).
- Breaking API changes will be infrequent but realistic as the platform evolves.
- A 90-day deprecation window is a reasonable starting default and can be adjusted via the ADR's Amendment Log.

### 4.4 Constraints

- Must be implemented from Phase 0; no unversioned routes may be introduced.
- The policy must be enforceable through CI and code review without manual checking.
- The cost of running two versions in parallel must be minimized by isolating version forking to changed handlers.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `social-listening-admin` UI team | Primary API consumer | High | Stable `/v1/` contract while new features are added |
| Future downstream subsystem teams (Brand Reputation, Social Care, Social Selling) | Future API consumers | High | Clear migration path and deprecation notice |
| Backend engineering team | API provider | High | Simple, maintainable route structure and CI enforcement |
| Product Owner | Scope and priority owner | Medium | Low-risk evolution of the public API surface |
| Platform Operations | Uptime and monitoring | Medium | Version visibility in logs, routing rules, and dashboards |
| Tenant-Admin / Tenant-User | Indirect consumers via UI and integrations | Low | No disruption to existing integrations |

---

## 6. Current State (As-Is)

The `social-listening-core` REST API is in early development and is already consumed by `social-listening-admin`. Additional subsystems are planned to read from the API directly rather than through the admin UI.

**Current process:**
- New endpoints and response shapes are added as features are built.
- There is no explicit compatibility policy or versioning scheme in place.
- Consumers are expected to track the latest core deployment implicitly.

**Pain points:**
- A change convenient for one feature can silently break a consumer not involved in the change.
- Without a deprecation window, consumers must upgrade in lockstep with core deployments.
- Retrofitting versioning after real endpoints and consumers exist is materially more expensive than building it in from the start.

---

## 7. Future State (To-Be)

After this policy is adopted, the `social-listening-core` REST API is versioned from day one.

**New or improved process:**
- Every REST endpoint is exposed under a versioned path (starting with `/v1/`).
- Within a version, only additive, backward-compatible changes are permitted.
- Any breaking change (removal, rename, type/meaning change, or altered existing behavior) is released as a new version.
- The old version continues to serve unmodified traffic for at least 90 days after the successor version ships.
- Deprecated endpoints return `Deprecation` and `Sunset` headers so consumers can detect and plan migration programmatically.
- Route handlers are organized so version forking happens only at the specific endpoints that changed, not as a full duplicate of the entire API.

**Expected capabilities:**
- Consumers can build against a stable `/v1/` contract.
- New versions can be deployed without forcing immediate consumer upgrades.
- Breaking changes are explicitly versioned and discoverable in logs, routing rules, and monitoring dashboards.
- CI prevents accidental breaking changes within a version by contract-checking response shapes.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall expose every REST endpoint under a versioned URI path (e.g. `/v1/...`). | Must | No unversioned route exists; all documented endpoints are reachable under `/v1/`. | Backend Engineering |
| BR-002 | Within a version, the system shall allow only additive, backward-compatible changes. | Must | New optional fields, new endpoints, new optional query parameters, and new enum values are permitted; no field removal, renaming, type change, or behavior change occurs without a new version. | Backend Engineering |
| BR-003 | The system shall release breaking API changes as a new version and keep the prior version running unmodified. | Must | A `/v2/` or later prefix is introduced for breaking changes; the prior version continues to serve traffic unchanged. | Backend Engineering |
| BR-004 | The system shall signal deprecated versions with `Deprecation` and `Sunset` response headers. | Must | Responses from deprecated endpoints include `Deprecation` and `Sunset` headers per RFC 8594. | Backend Engineering |
| BR-005 | The system shall maintain a deprecated version for at least 90 days after its successor ships. | Must | The deprecated version is available and unmodified for 90 days from the successor version's release date. | Product Owner |
| BR-006 | CI shall fail the build if a change would break a documented consumer expectation within the current version. | Should | Contract tests compare response shapes against snapshots/expectations and fail on incompatible changes to `/v1/`. | Backend Engineering |
| BR-007 | Version forking shall be confined to the endpoints that actually changed between versions. | Should | Route handlers do not duplicate unchanged endpoints per version; only changed handlers have version-specific logic. | Backend Engineering |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The versioning policy must be enforceable through CI and code review. | Maintainability | Must | A contract-check job runs on every PR and rejects unversioned or breaking-in-place changes. |
| NFR-002 | The active API version must be visible in logs, gateway routing rules, and monitoring dashboards. | Operability | Should | Requests are tagged with the version path segment; dashboards can filter by version. |
| NFR-003 | Running two versions in parallel must not double the maintenance burden for unchanged endpoints. | Maintainability | Should | Code review confirms unchanged endpoints are not duplicated across version routers. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Within a version, only additive changes are allowed: new optional fields, new endpoints, new optional query parameters, and new enum values that a consumer was not already exhaustively switching on. |
| BRU-002 | A breaking change is any removal or renaming of a field, change to a field's type or meaning, or change to existing endpoint behavior that could break a consumer. |
| BRU-003 | Any breaking change requires a new API version; the old version continues to serve unmodified traffic for at least 90 days. |
| BRU-004 | Deprecated endpoints must include `Deprecation` and `Sunset` response headers per RFC 8594. |
| BRU-005 | Version forking must occur only at the specific handlers that changed, not by duplicating the entire API per version. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| API version prefix | Version segment in the request URI path (e.g. `v1`, `v2`) | Incoming HTTP request | API Platform | None |
| Deprecation status | Whether a version or endpoint is deprecated, plus sunset date | ADR Amendment Log / deployment configuration | API Platform | Internal |
| Consumer contract snapshot | Expected response-shape definitions used by CI contract checks | Contract tests / feature design | Engineering | Internal |
| Version traffic metrics | Request counts per version for monitoring and migration planning | Application logs / monitoring | Platform Operations | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| API version traffic distribution | Track which consumers are still on deprecated versions | Platform Operations / Product Team | Daily / on-demand |
| Deprecation warnings served | Count of `Deprecation`/`Sunset` headers returned | Engineering / Product Team | Weekly |
| Time-to-version-migration | Measure how long consumers take to move off deprecated versions | Product Owner | Per deprecation window |
| Breaking-change incidents | Track any unintended breaking changes caught or shipped | Engineering | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Running two API versions in parallel increases testing and maintenance cost. | Medium | High | Fork only the changed handlers; use contract tests to keep both versions correct. | Technical Lead |
| R-002 | The 90-day deprecation window may not match downstream subsystem release cadences. | Medium | Medium | Make the window an implementation default that can be adjusted via the ADR Amendment Log. | Product Owner |
| R-003 | URI path versioning conventionally bumps the whole API, even for one endpoint change. | Medium | Medium | Isolate version forking to the specific changed endpoints rather than duplicating the full API. | Technical Lead |
| R-004 | Consumers may ignore deprecation headers and miss the migration window. | Low | High | Add monitoring, proactive communications, and migration documentation for each deprecated version. | Customer Success / Product Owner |
| R-005 | CI contract checks may be too coarse and block legitimate additive changes. | Low | Medium | Design contract checks to compare response-shape compatibility, not exact equality, and review failures. | Backend Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Express route structure supports versioned routers | Internal | Backend Engineering | Built in Phase 0 |
| D-002 | CI contract-check infrastructure | Internal | Backend Engineering | Built with Story 1.3 |
| D-003 | ADR-0019 (Service Bus event-schema versioning) | External / Related | Architecture | Accepted separately |
| D-004 | Future downstream subsystems adopt versioned endpoints | External | Product / Consumers | As subsystems are built |
| D-005 | Real authentication and RLS middleware (ADR-0033) | Internal | Backend Engineering | Built |

---

## 14. Acceptance Criteria

- Every REST endpoint in `social-listening-core` is reachable under a `/v1/` path prefix; no unversioned route exists.
- A deprecated API version continues to serve unmodified traffic and returns `Deprecation` and `Sunset` response headers (RFC 8594) for at least 90 days after its successor version ships.
- CI includes a contract check that fails the build if a change to a `/v1/` response shape would break a documented consumer expectation.
- Version forking is confined to the specific endpoints that changed; unchanged endpoints are not duplicated across version routers.
- The policy is scoped to the REST API only; Service Bus event versioning is handled under ADR-0019.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Additive change | An API change that only adds new, optional elements without altering existing behavior or removing anything. |
| Breaking change | Any API change that removes or renames a field, changes a field's type or meaning, or alters existing endpoint behavior in a consumer-observable way. |
| Deprecation window | The minimum period during which an older API version remains available after a newer version is released. |
| RFC 8594 | The "The Sunset HTTP Header Field" specification, used here for `Deprecation` and `Sunset` headers. |
| URI path versioning | An API versioning scheme where the version appears in the URL path (e.g. `/v1/posts`). |
| Version forking | Implementing version-specific behavior only at the endpoints that actually changed between versions. |

---

## 16. Appendices

### Reference Documents

- [ADR-0017: API versioning and compatibility policy](../../../docs/adr/0017-api-versioning-and-compatibility-policy.md)
- [Feature design: API and integrations](../../../docs/product-research/feature-designs/11-api-and-integrations.md)
- [User story: Story 1.3 — REST API versioning and compatibility policy](../../../docs/user-stories/epic-1-repository-and-api-foundation.md)

### Missing Source

- No `docs/product-research/reports/11-api-and-integrations-deep-research.md` file was found; competitive deep-research brief is therefore not included in this BRD.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-22 |
| Product Owner | Menno | | 2026-08-22 |
| Technical Lead | Menno | | 2026-08-22 |
| Other Stakeholder | | | |
