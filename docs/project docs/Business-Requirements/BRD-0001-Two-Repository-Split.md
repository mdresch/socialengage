# ADR-0001 Two-Repository Split — Business Requirements Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | ADR-0001 Two-Repository Split – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | Menno, BRD Writer Agent |
| Approver(s) | Menno, Project Sponsor / Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | Menno | Initial draft derived from ADR-0001, Design Spec §2, and Story 1.1 |

---

## 2. Executive Summary

The Social Listening / Insights subsystem must provide a robust backend that ingests, normalizes, enriches, and stores social data, plus an administrative surface that lets tenants manage platforms, watchlists, and connector health. If these concerns are built as a single, tightly coupled deployable, the core backend can become entangled with the user-interface code, and future downstream subsystems may be forced to depend on UI-specific artifacts or internal implementation details. This Business Requirements Document captures the decision to split the subsystem into two independent repositories: `social-listening-core` for the backend and `social-listening-admin` for the Next.js administrative UI.

The proposed split makes `social-listening-core` a first-class product surface that is usable without any UI. `social-listening-admin` will interact with the core exclusively through a documented REST API and will never access the database directly. This arrangement gives downstream subsystems such as Brand Reputation & Alerts, Social Care, and Social Selling a stable, public contract to consume, both through the REST API for historical and on-demand reads and through Service Bus events for real-time notification. It also allows the admin UI to iterate on its own release cadence while the core backend is independently deployable, testable, and versionable.

The expected business value is a cleaner architectural boundary, reduced coupling, faster independent iteration, and an API that is kept honest by being the only way the project's own UI reaches the data.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Keep the backend usable without the admin UI | Downstream subsystems consume `social-listening-core` REST API and Service Bus events with no dependency on `social-listening-admin` |
| 2 | Enable independent deployability and release cadence for the backend and the admin UI | `social-listening-core` and `social-listening-admin` can each be deployed, rolled back, and scaled without coordinating a joint release |
| 3 | Maintain the REST API as a first-class, stable product surface | `social-listening-admin` reaches every data or state-changing operation through documented `social-listening-core` REST endpoints |

---

## 4. Scope

### 4.1 In Scope

- Splitting the subsystem into two repositories:
  - `social-listening-core` — TypeScript/Node.js backend: connector framework, ingestion, normalization, enrichment, storage, event publishing, and REST API.
  - `social-listening-admin` — Next.js admin UI for tenant management of platforms, watchlists, and connector/AI-provider health.
- Requiring `social-listening-admin` to communicate with `social-listening-core` exclusively through the REST API.
- Ensuring `social-listening-core` can be built, deployed, and tested independently of `social-listening-admin`.
- Designing `social-listening-core` so downstream subsystems can consume its outputs through the REST API and Service Bus events.

### 4.2 Out of Scope

- Building the downstream subsystems themselves (Brand Reputation & Alerts, Social Care, Social Selling). They must not be blocked by this split, but are explicitly not part of this work.
- Allowing `social-listening-admin` to read or write the database directly.
- Defining the API versioning and compatibility policy (this is addressed by ADR-0017).
- Alerting, crisis detection, case routing, lead-generation, or charting/dashboard functionality.

### 4.3 Assumptions

- The technology stack remains TypeScript/Node.js throughout, with Azure-native services for database, secrets, enrichment, and eventing.
- `social-listening-admin` is implemented as a Next.js application.
- `social-listening-core` exposes a public, documented REST API that becomes the single integration surface for the admin UI.
- Multi-tenant isolation is enforced at the database layer by `social-listening-core`.

### 4.4 Constraints

- The project is driven by a solo developer, so repository and deployment tooling must be simple enough to maintain without a dedicated platform team.
- The split must not introduce hidden coupling that lets the admin UI depend on internal core modules.
- API changes in `social-listening-core` must be coordinated with `social-listening-admin` and, eventually, downstream subsystems.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Admin UI Developer | Builds and maintains `social-listening-admin` | High | Stable REST API endpoints, no direct database access, clear error contracts |
| Backend / Platform Engineer | Builds and maintains `social-listening-core` | High | Independent deploy/test cycle, clean API surface, no hidden UI dependencies |
| Downstream Subsystem Lead | Consumes `social-listening-core` output for Brand Reputation, Social Care, Social Selling | Medium | Public REST API and event topics, documented contracts, no admin UI dependency |
| Tenant Admin (End User) | Uses `social-listening-admin` to manage connectors, watchlists, and health | Medium | Reliable UI that reflects core state without data inconsistencies |
| Product Owner / Sponsor (Menno) | Owns scope and priorities | High | Maintainable architecture that supports current and future subsystems |

---

## 6. Current State (As-Is)

The subsystem is defined by an approved design specification that combines backend ingestion and the admin surface in a single conceptual boundary. At present, the repositories have not yet been physically split, and there is no enforced rule that the admin UI must reach the backend through a public REST API. This creates the following pain points:

- The core backend and the admin UI can become implicitly coupled if they share code or database access patterns.
- Downstream subsystems may be forced to consume implementation details rather than a stable public interface.
- The REST API could become an afterthought, optimized only for the admin UI instead of being a reusable product surface.
- Independent deployment, versioning, and rollback of the backend and the UI are not guaranteed.

---

## 7. Future State (To-Be)

After the split is implemented, the subsystem consists of two distinct repositories with a clear contract between them.

**New or improved process:**

1. `social-listening-core` is the authoritative backend. It owns all data, business logic for ingestion/enrichment, the REST API, and event publishing.
2. `social-listening-admin` is a thin Next.js layer. It renders screens, collects user input, and forwards all state changes to `social-listening-core` via the REST API.
3. Downstream subsystems integrate with `social-listening-core` through the REST API and/or Service Bus events, independent of `social-listening-admin`.
4. Each repository is built, tested, versioned, and deployed independently, with API contract tests preventing silent breakage.

**Expected capabilities:**

- `social-listening-core` is fully usable without any UI.
- `social-listening-admin` connects to `social-listening-core` exclusively through documented REST endpoints.
- `social-listening-core` can be released on its own schedule, and `social-listening-admin` can iterate its UX without backend changes.
- Future subsystems can adopt `social-listening-core` as a service rather than as a code dependency.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The subsystem shall be divided into two repositories: `social-listening-core` and `social-listening-admin` | Must | Source code, package manifests, and deployment units are clearly separated into the two repository paths | Product Owner |
| BR-002 | `social-listening-admin` shall access `social-listening-core` exclusively through its REST API | Must | The admin repository contains no database driver, connection string, or direct database access; every admin feature is implemented as a call to a documented core REST endpoint | Product Owner |
| BR-003 | `social-listening-core` shall be deployable, testable, and usable independently of `social-listening-admin` | Must | Core builds, runs its contract suite, and exposes a working REST API without the admin repository being present | Technical Lead |
| BR-004 | Downstream subsystems shall be able to consume `social-listening-core` outputs via REST API and Service Bus events | Should | Public documentation describes the REST endpoints and event topics available to consumers; no downstream consumer depends on `social-listening-admin` artifacts | Product Owner |
| BR-005 | `social-listening-admin` shall not bypass `social-listening-core` to reach internal modules or the database | Must | Code review and automated contract checks confirm that the admin UI has no in-process shared code path that reaches core internals | Technical Lead |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `social-listening-core` and `social-listening-admin` shall each be independently deployable | Maintainability | Must | A release or rollback of one repository completes without requiring a simultaneous release of the other |
| NFR-002 | The `social-listening-core` REST API shall remain stable for consumers | Reliability | Must | Breaking API changes are only shipped under a new version, following the versioning policy established in ADR-0017 |
| NFR-003 | The database layer shall remain reachable only through `social-listening-core` | Security | Must | No repository other than `social-listening-core` holds credentials or connection paths to the database; RLS remains the tenant-isolation mechanism |
| NFR-004 | `social-listening-core` shall be testable without `social-listening-admin` or a UI | Maintainability | Must | The core contract suite passes when `social-listening-admin` is not running |
| NFR-005 | API changes shall be coordinated across repositories and downstream consumers | Maintainability | Should | CI includes a contract check that fails the build if an API change would break an existing consumer expectation |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `social-listening-admin` must not include a Postgres driver or database connection string. |
| BRU-002 | Every feature in `social-listening-admin` that reads or mutates state must be implemented as a call to a `social-listening-core` REST endpoint. |
| BRU-003 | `social-listening-core` may be released, deployed, and rolled back without a corresponding `social-listening-admin` release. |
| BRU-004 | Downstream subsystems must not take a dependency on `social-listening-admin` code, assets, or deployment artifacts. |
| BRU-005 | A documented API versioning and compatibility policy must be in place before the first breaking API change is shipped. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Repository boundary metadata | Which code, packages, and deployment manifests belong to `social-listening-core` vs. `social-listening-admin` | ADR-0001, Design Spec §2 | Technical Lead | Internal |
| REST API contract | Public endpoints, request/response shapes, and version prefix used by `social-listening-admin` and downstream consumers | `social-listening-core` API layer | Technical Lead | Internal |
| Service Bus event topics | Real-time event topics published by `social-listening-core` for downstream consumption | `social-listening-core` event publisher | Technical Lead | Internal |
| Deployment configuration | Independent build, test, and release settings for each repository | CI/CD pipeline owner | Technical Lead | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| API call volume by consumer | Confirm that `social-listening-admin` and downstream subsystems use the REST API as intended | Product Owner | Per release |
| Independent deployment count | Track how often `social-listening-core` and `social-listening-admin` are released separately | Technical Lead | Per release |
| Downstream integration count | Measure adoption of `social-listening-core` by Brand Reputation, Social Care, and Social Selling | Product Owner | Quarterly |
| API breaking-change incidents | Monitor whether unversioned breaking changes reach consumers | Technical Lead | Per release |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A change in `social-listening-core` breaks `social-listening-admin` or a downstream consumer silently | Medium | High | Enforce the API versioning and compatibility policy (ADR-0017) and add cross-repo contract tests | Technical Lead |
| R-002 | Maintaining two repositories adds versioning, deployment, and compatibility overhead | Medium | Medium | Keep CI pipelines simple, automate contract checks, and document the interface before implementation | Technical Lead |
| R-003 | Local development becomes more complex because both repositories must run | High | Low | Provide a local Docker Compose setup or documented `social-listening-core` mock for admin UI development | Technical Lead |
| R-004 | API versioning policy is missing when the first breaking change is needed | High | High | Treat ADR-0017 as a dependency and adopt `/v1/` prefix and deprecation headers before any breaking change | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Design Spec §2 — Architecture Overview | Internal | Product Owner | Approved (source document for ADR-0001) |
| D-002 | ADR-0017 — API Versioning and Compatibility Policy | Internal | Technical Lead | Accepted 2026-07-29; closes the versioning gap noted in ADR-0001 |
| D-003 | ADR-0012 — Thin Events with REST Fetch On-Demand | Internal | Technical Lead | Accepted; defines how downstream consumers receive real-time events |
| D-004 | ADR-0013 — Per-Tenant Event Filtering via Subscription Rules | Internal | Technical Lead | Accepted; governs tenant-scoped event consumption |
| D-005 | ADR-0015 — Tenant Isolation via Postgres Row-Level Security | Internal | Technical Lead | Accepted; ensures database isolation remains in `social-listening-core` |
| D-006 | ADR-0016 — Postgres as the Database Engine | Internal | Technical Lead | Accepted; data-layer foundation for `social-listening-core` |
| D-007 | Story 1.1 — Core REST API Access for the Admin UI | Internal | Product Owner | Ready (derived from ADR-0001) |

---

## 14. Acceptance Criteria

- `social-listening-admin`'s dependency manifest contains no Postgres driver or database connection string.
- Every admin UI feature (connect/disconnect a platform, manage watchlists, view connector status) is implemented as a call to a `social-listening-core` REST endpoint, with no in-process shared code path that bypasses the API.
- `social-listening-core` and `social-listening-admin` can each be deployed, rolled back, and scaled independently without coordinating a joint release.
- The REST API and Service Bus events are documented and reachable by downstream subsystems without requiring `social-listening-admin`.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `social-listening-core` | The TypeScript/Node.js backend repository responsible for ingestion, normalization, enrichment, storage, event publishing, and the REST API. |
| `social-listening-admin` | The Next.js administrative UI repository for tenant platform, watchlist, and health management. |
| Downstream subsystems | Future subsystems that consume `social-listening-core` output: Brand Reputation & Alerts, Social Care, and Social Selling. |
| REST API | The public HTTP interface exposed by `social-listening-core` that both the admin UI and downstream consumers must use. |
| Service Bus | Azure Service Bus, used by `social-listening-core` to publish real-time, thin events for downstream consumption. |
| Connector framework | The generalized provider pattern in `social-listening-core` for social platforms and AI enrichment providers. |
| Row-Level Security (RLS) | Postgres RLS policies that enforce tenant isolation at the database layer. |

---

## 16. Appendices

### 16.1 Reference Documents

- `docs/adr/0001-two-repository-split.md` — the source ADR.
- `docs/project docs/2026-07-28-social-listening-ingestion-design.md` §2 — Design Spec Architecture Overview.
- `docs/design/frontend-design-specification.md` — authoritative frontend design for `social-listening-admin`.
- `docs/user-stories/epic-1-repository-and-api-foundation.md` — Story 1.1 derived from ADR-0001.
- `docs/user-stories/README.md` — epic and story index.

### 16.2 Missing or Not-Applicable Sources

- No dedicated `docs/product-research/feature-designs/<feature>.md` file was found for the repository-split decision; the Design Spec §2 and the source ADR provide the relevant architectural context.
- No `docs/product-research/reports/<feature>-deep-research.md` file was found for the repository-split decision.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
