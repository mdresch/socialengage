# ADR-0001 Two-Repository Split — Business Requirements Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | ADR-0001 Two-Repository Split — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0001-two-repository-split.md, ../Business-Requirements/BRD-0001-Two-Repository-Split.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0001-two-repository-split.md and the business requirements in BRD-0001-Two-Repository-Split.md into functional design for **Two Repository Split**.
The Social Listening / Insights subsystem must provide a robust backend that ingests, normalizes, enriches, and stores social data, plus an administrative surface that lets tenants manage platforms, watchlists, and connector health. If these concerns are built as a single, tightly coupled deployable, the core backend can become entangled with the user-interface code, and future downstream subsystems may be forced to depend on UI-specific artifacts or internal implementation details. This Business Requirements Document captures the decision to split the subsystem into two independent repositories: `social-listening-core` for the backend and `social-listening-admin` for the Next.js administrative UI.

The proposed split makes `social-listening-core` a first-class product surface that is usable without any UI. `social-listening-admin` will interact with the core exclusively through a documented REST API and will never access the database directly. This arrangement gives downstream subsystems such as Brand Reputation & Alerts, Social Care, and Social Selling a stable, public contract to consume, both through the REST API for historical and on-demand reads and through Service Bus events for real-time notification. It also allows the admin UI to iterate on its own release cadence while the core backend is independently deployable, testable, and versionable.

The expected business value is a cleaner architectural boundary, reduced coupling, faster independent iteration, and an API that is kept honest by being the only way the project's own UI reaches the data.

---

### 2.2 Scope
**In scope:**
- Splitting the subsystem into two repositories:
  - `social-listening-core` — TypeScript/Node.js backend: connector framework, ingestion, normalization, enrichment, storage, event publishing, and REST API.
  - `social-listening-admin` — Next.js admin UI for tenant management of platforms, watchlists, and connector/AI-provider health.
- Requiring `social-listening-admin` to communicate with `social-listening-core` exclusively through the REST API.
- Ensuring `social-listening-core` can be built, deployed, and tested independently of `social-listening-admin`.
- Designing `social-listening-core` so downstream subsystems can consume its outputs through the REST API and Service Bus events.

**Out of scope:**
- Building the downstream subsystems themselves (Brand Reputation & Alerts, Social Care, Social Selling). They must not be blocked by this split, but are explicitly not part of this work.
- Allowing `social-listening-admin` to read or write the database directly.
- Defining the API versioning and compatibility policy (this is addressed by ADR-0017).
- Alerting, crisis detection, case routing, lead-generation, or charting/dashboard functionality.

## 3. Context and Background
The subsystem needs a backend that ingests, normalizes, enriches, and stores social data, plus an admin surface for tenants to connect platforms, manage watchlists, and check connector/AI-provider health. Downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling) will also need to consume this subsystem's data, and are explicitly out of scope for this spec but must not be blocked by decisions made here.
The Social Listening / Insights subsystem must provide a robust backend that ingests, normalizes, enriches, and stores social data, plus an administrative surface that lets tenants manage platforms, watchlists, and connector health. If these concerns are built as a single, tightly coupled deployable, the core backend can become entangled with the user-interface code, and future downstream subsystems may be forced to depend on UI-specific artifacts or internal implementation details. This Business Requirements Document captures the decision to split the subsystem into two independent repositories: `social-listening-core` for the backend and `social-listening-admin` for the Next.js administrative UI.

The proposed split makes `social-listening-core` a first-class product surface that is usable without any UI. `social-listening-admin` will interact with the core exclusively through a documented REST API and will never access the database directly. This arrangement gives downstream subsystems such as Brand Reputation & Alerts, Social Care, and Social Selling a stable, public contract to consume, both through the REST API for historical and on-demand reads and through Service Bus events for real-time notification. It also allows the admin UI to iterate on its own release cadence while the core backend is independently deployable, testable, and versionable.

The expected business value is a cleaner architectural boundary, reduced coupling, faster independent iteration, and an API that is kept honest by being the only way the project's own UI reaches the data.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Keep the backend usable without the admin UI | Downstream subsystems consume `social-listening-core` REST API and Service Bus events with no dependency on `social-listening-admin` |
| 2 | Enable independent deployability and release cadence for the backend and the admin UI | `social-listening-core` and `social-listening-admin` can each be deployed, rolled back, and scaled without coordinating a joint release |
| 3 | Maintain the REST API as a first-class, stable product surface | `social-listening-admin` reaches every data or state-changing operation through documented `social-listening-core` REST endpoints |

---

**Positive consequences (from ADR):**
**Positive**
- Downstream subsystems (Brand Reputation, Social Care, Social Selling) can consume `social-listening-core`'s REST API and Service Bus events without any dependency on the admin UI.
- The core is independently deployable, testable, and versionable; the admin UI can iterate on its own release cadence.
- Forcing the admin UI through the REST API (rather than direct DB access) means the API surface is exercised by the project's own UI from day one, which keeps it honest as a real product surface rather than an afterthought.

**Negative**
- Two repositories to version, deploy, and keep compatible; API changes in core must be coordinated with the admin UI, and eventually with downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling), which per §7 will consume core's output two ways — the REST API for on-demand/historical reads and Service Bus events for real-time notification (see ADR-0012, ADR-0013).
- Local development requires running both repos (or mocking the core API) to exercise the admin UI end-to-end.
- The spec does not state an API versioning or compatibility policy (e.g., a `/v1/` prefix, deprecation window) for `social-listening-core`'s REST API. With two independently deployable repos — soon three-plus once downstream subsystems integrate — a core change could break the admin UI or a downstream consumer silently unless a versioning strategy is established; this is a gap worth closing with its own ADR before the first breaking change is needed.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The subsystem shall be divided into two repositories: `social-listening-core` and `social-listening-admin` | Must | Source code, package manifests, and deployment units are clearly separated into the two repository paths | Product Owner |
| BR-002 | `social-listening-admin` shall access `social-listening-core` exclusively through its REST API | Must | The admin repository contains no database driver, connection string, or direct database access; every admin feature is implemented as a call to a documented core REST endpoint | Product Owner |
| BR-003 | `social-listening-core` shall be deployable, testable, and usable independently of `social-listening-admin` | Must | Core builds, runs its contract suite, and exposes a working REST API without the admin repository being present | Technical Lead |
| BR-004 | Downstream subsystems shall be able to consume `social-listening-core` outputs via REST API and Service Bus events | Should | Public documentation describes the REST endpoints and event topics available to consumers; no downstream consumer depends on `social-listening-admin` artifacts | Product Owner |
| BR-005 | `social-listening-admin` shall not bypass `social-listening-core` to reach internal modules or the database | Must | Code review and automated contract checks confirm that the admin UI has no in-process shared code path that reaches core internals | Technical Lead |

### 5.1 Architecture Decision
Split the subsystem into two repositories:

- **`social-listening-core`** — TypeScript/Node.js backend: connector framework, ingestion, normalization, enrichment, storage, event publishing, and the REST API. Designed to be fully usable independent of any UI.
- **`social-listening-admin`** — Next.js admin UI. Talks to `social-listening-core` exclusively through its REST API; it never accesses the database directly.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Admin UI Developer | Builds and maintains `social-listening-admin` | High | Stable REST API endpoints, no direct database access, clear error contracts |
| Backend / Platform Engineer | Builds and maintains `social-listening-core` | High | Independent deploy/test cycle, clean API surface, no hidden UI dependencies |
| Downstream Subsystem Lead | Consumes `social-listening-core` output for Brand Reputation, Social Care, Social Selling | Medium | Public REST API and event topics, documented contracts, no admin UI dependency |
| Tenant Admin (End User) | Uses `social-listening-admin` to manage connectors, watchlists, and health | Medium | Reliable UI that reflects core state without data inconsistencies |
| Product Owner / Sponsor (Menno) | Owns scope and priorities | High | Maintainable architecture that supports current and future subsystems |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.1 | epic-1-repository-and-api-foundation.md | As admin UI developer, I want `social-listening-admin` to talk to `social-listening-core` strictly through its REST API, never directly to the database, so t... | `social-listening-admin`'s dependency manifest contains no Postgres driver or database connection string.; Every admin-UI feature (connect/disconnect a platf... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Repository boundary metadata | Which code, packages, and deployment manifests belong to `social-listening-core` vs. `social-listening-admin` | ADR-0001, Design Spec §2 | Technical Lead | Internal |
| REST API contract | Public endpoints, request/response shapes, and version prefix used by `social-listening-admin` and downstream consumers | `social-listening-core` API layer | Technical Lead | Internal |
| Service Bus event topics | Real-time event topics published by `social-listening-core` for downstream consumption | `social-listening-core` event publisher | Technical Lead | Internal |
| Deployment configuration | Independent build, test, and release settings for each repository | CI/CD pipeline owner | Technical Lead | Internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | `social-listening-admin` must not include a Postgres driver or database connection string. |
| BRU-002 | Every feature in `social-listening-admin` that reads or mutates state must be implemented as a call to a `social-listening-core` REST endpoint. |
| BRU-003 | `social-listening-core` may be released, deployed, and rolled back without a corresponding `social-listening-admin` release. |
| BRU-004 | Downstream subsystems must not take a dependency on `social-listening-admin` code, assets, or deployment artifacts. |
| BRU-005 | A documented API versioning and compatibility policy must be in place before the first breaking API change is shipped. |

---

## 9. Interfaces and Integrations
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

- The technology stack remains TypeScript/Node.js throughout, with Azure-native services for database, secrets, enrichment, and eventing.
- `social-listening-admin` is implemented as a Next.js application.
- `social-listening-core` exposes a public, documented REST API that becomes the single integration surface for the admin UI.
- Multi-tenant isolation is enforced at the database layer by `social-listening-core`.

Split the subsystem into two repositories:

- **`social-listening-core`** — TypeScript/Node.js backend: connector framework, ingestion, normalization, enrichment, storage, event publishing, and the REST API. Designed to be fully usable independent of any UI.
- **`social-listening-admin`** — Next.js admin UI. Talks to `social-listening-core` exclusively through its REST API; it never accesses the database directly.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `social-listening-core` and `social-listening-admin` shall each be independently deployable | Maintainability | Must | A release or rollback of one repository completes without requiring a simultaneous release of the other |
| NFR-002 | The `social-listening-core` REST API shall remain stable for consumers | Reliability | Must | Breaking API changes are only shipped under a new version, following the versioning policy established in ADR-0017 |
| NFR-003 | The database layer shall remain reachable only through `social-listening-core` | Security | Must | No repository other than `social-listening-core` holds credentials or connection paths to the database; RLS remains the tenant-isolation mechanism |
| NFR-004 | `social-listening-core` shall be testable without `social-listening-admin` or a UI | Maintainability | Must | The core contract suite passes when `social-listening-admin` is not running |
| NFR-005 | API changes shall be coordinated across repositories and downstream consumers | Maintainability | Should | CI includes a contract check that fails the build if an API change would break an existing consumer expectation |

---

## 11. Error Handling and Exceptions
**Positive**
- Downstream subsystems (Brand Reputation, Social Care, Social Selling) can consume `social-listening-core`'s REST API and Service Bus events without any dependency on the admin UI.
- The core is independently deployable, testable, and versionable; the admin UI can iterate on its own release cadence.
- Forcing the admin UI through the REST API (rather than direct DB access) means the API surface is exercised by the project's own UI from day one, which keeps it honest as a real product surface rather than an afterthought.

**Negative**
- Two repositories to version, deploy, and keep compatible; API changes in core must be coordinated with the admin UI, and eventually with downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling), which per §7 will consume core's output two ways — the REST API for on-demand/historical reads and Service Bus events for real-time notification (see ADR-0012, ADR-0013).
- Local development requires running both repos (or mocking the core API) to exercise the admin UI end-to-end.
- The spec does not state an API versioning or compatibility policy (e.g., a `/v1/` prefix, deprecation window) for `social-listening-core`'s REST API. With two independently deployable repos — soon three-plus once downstream subsystems integrate — a core change could break the admin UI or a downstream consumer silently unless a versioning strategy is established; this is a gap worth closing with its own ADR before the first breaking change is needed.

## 12. Assumptions and Dependencies
- The technology stack remains TypeScript/Node.js throughout, with Azure-native services for database, secrets, enrichment, and eventing.
- `social-listening-admin` is implemented as a Next.js application.
- `social-listening-core` exposes a public, documented REST API that becomes the single integration surface for the admin UI.
- Multi-tenant isolation is enforced at the database layer by `social-listening-core`.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A change in `social-listening-core` breaks `social-listening-admin` or a downstream consumer silently | Medium | High | Enforce the API versioning and compatibility policy (ADR-0017) and add cross-repo contract tests | Technical Lead |
| R-002 | Maintaining two repositories adds versioning, deployment, and compatibility overhead | Medium | Medium | Keep CI pipelines simple, automate contract checks, and document the interface before implementation | Technical Lead |
| R-003 | Local development becomes more complex because both repositories must run | High | Low | Provide a local Docker Compose setup or documented `social-listening-core` mock for admin UI development | Technical Lead |
| R-004 | API versioning policy is missing when the first breaking change is needed | High | High | Treat ADR-0017 as a dependency and adopt `/v1/` prefix and deprecation headers before any breaking change | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0001-two-repository-split.md`
- BRD: `../Business-Requirements/BRD-0001-Two-Repository-Split.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above