# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0001 Two-Repository Split — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Menno, FDD Writer |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0001 is Accepted) |
| Related Documents | ADR-0001, BRD-0001, Story 1.1, ADR-0012, ADR-0013, ADR-0015, ADR-0016, ADR-0017 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0001 (Split into `social-listening-core` and `social-listening-admin` repositories) and BRD-0001 into a functional design: the concrete behaviors, boundaries, and rules that keep the backend (`social-listening-core`) and the admin UI (`social-listening-admin`) as two independently usable, independently deployable systems connected only by a REST API. It exists so any engineer adding a feature to either repository can check, mechanically, whether the feature respects the repository boundary.

### 2.2 Scope

- **In scope:** the boundary contract between `social-listening-core` and `social-listening-admin` — what each repository is allowed to own, how the admin UI is required to reach the backend, how downstream subsystems are expected to integrate, and what "independently deployable" means operationally.
- **Out of scope:** the downstream subsystems themselves (Brand Reputation & Alerts, Social Care, Social Selling); the specific REST API versioning scheme (ADR-0017/FDD-0017); the specific event schema and filtering mechanism (ADR-0012/ADR-0013); any feature-level functional design internal to either repository.

### 2.3 Target Audience

Backend engineer (owns `social-listening-core`), admin UI engineer (owns `social-listening-admin`), future downstream-subsystem engineers, solo technical lead/product owner (Menno) making the accept/reject call on any change that would cross the boundary.

---

## 3. Context and Background

- **Problem/opportunity:** without an enforced boundary, a two-concern subsystem (ingest/normalize/enrich/store vs. tenant-facing admin surface) tends to collapse into one tightly coupled deployable. That collapse would let `social-listening-admin` read the database directly, let the REST API atrophy into an admin-only afterthought, and force any future downstream subsystem (Brand Reputation & Alerts, Social Care, Social Selling) to depend on UI internals instead of a stable public contract.
- **Business/user value:** independent release cadence for backend vs. UI; a REST API that is proven honest because it is the *only* way the project's own UI reaches its own data; downstream subsystems can integrate without waiting on or coupling to the admin UI.
- **Source requirements:** ADR-0001; BRD-0001 (BR-001 through BR-005, BRU-001 through BR-005); Story 1.1 (Epic 1).
- **Constraints/dependencies:** solo-developer project — tooling for the split must stay simple (no dedicated platform team); API changes must be coordinated across repos and, eventually, downstream consumers; the versioning policy that makes coordination safe is deferred to ADR-0017 (tracked as a dependency, not built here).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Keep `social-listening-core` usable with zero UI dependency | Core builds, runs its full contract suite, and serves a working REST API with `social-listening-admin` absent from the environment |
| G2 | Force all `social-listening-admin` state access through the REST API | Admin repository's dependency manifest contains no Postgres driver or DB connection string; every admin feature traces to one or more documented core REST endpoints |
| G3 | Allow independent deploy/rollback of each repository | A release or rollback of one repository completes without a coordinated joint release of the other |
| G4 | Make the REST API a stable, reusable product surface for downstream subsystems | Brand Reputation & Alerts / Social Care / Social Selling can integrate via REST API and Service Bus events with no dependency on `social-listening-admin` artifacts |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Repository boundary enforcement

- **Description:** `social-listening-core` and `social-listening-admin` exist as two physically separate repositories with disjoint responsibilities. Core owns the connector framework, ingestion, normalization, enrichment, storage, event publishing, and the REST API. Admin owns rendering, user input collection, and forwarding every state change to core over HTTP.
- **Triggers:** any commit that adds a new feature to either repository; any dependency-manifest change; any new module import.
- **Inputs:** proposed source changes (new files, new dependencies, new API calls) in either repository.
- **Processing:** a change is boundary-compliant only if (a) `social-listening-admin`'s package manifest contains no database driver or connection string of any kind, and (b) every read or mutation the admin UI performs is implemented as a call to a documented `social-listening-core` REST endpoint rather than an in-process shared module that reaches core internals or the database.
- **Outputs:** a repository tree that is separately buildable, separately testable, and separately deployable; a REST API surface that is exercised end-to-end by the project's own admin UI.
- **Error handling:** a change that violates the boundary (e.g., a Postgres client added to `social-listening-admin`) is a defect to be caught by code review and, per BRU-005/NFR-005, an automated contract check; it should never reach production.
- **Edge cases:** a feature that is naturally UI-only (e.g., client-side form validation, layout) has no core counterpart and is exempt from the "must call a core endpoint" rule; a feature that needs data core doesn't yet expose requires a new/extended core endpoint first, not a workaround.

### 5.2 Feature / Capability: Admin UI as a REST API consumer

- **Description:** every tenant-facing capability in `social-listening-admin` (connect/disconnect a connector, manage watchlists, view connector/AI-provider health, and all subsequently built admin screens) is implemented purely as HTTP calls to `social-listening-core`'s REST API.
- **Triggers:** a user action in the admin UI that reads or changes state (e.g., clicking "Connect", saving a watchlist, loading a status screen).
- **Inputs:** user input from the browser; the current BFF session (per ADR-0036, established in later ADRs) used to authenticate the call to core.
- **Processing:** the admin UI's server-side layer translates the user action into one or more calls against documented core REST endpoints; it performs no direct database query and holds no database credential.
- **Outputs:** UI state updated from the REST response; no side channel to the database.
- **Error handling:** if a core endpoint is unreachable or returns an error, the admin UI surfaces a user-facing error/degraded state — it never falls back to a direct database read as a workaround.
- **Edge cases:** local development, where `social-listening-core` may not be running — the admin UI should degrade or fail explicitly rather than silently stub in fabricated data from a hidden path to the database.

### 5.3 Feature / Capability: Independent deployability

- **Description:** each repository can be built, tested, released, and rolled back on its own schedule without requiring a simultaneous release of the other.
- **Triggers:** a release or rollback decision for either repository.
- **Inputs:** the repository's own build artifact and its own CI pipeline result.
- **Processing:** `social-listening-core`'s release process does not require `social-listening-admin` to be present, built, or passing; `social-listening-admin`'s release process consumes whatever version of the core REST API is currently deployed and reachable, and does not require redeploying core in lockstep.
- **Outputs:** two independently versioned deployment artifacts.
- **Error handling:** a failed release of one repository does not block or force a rollback of the other, except where an intentional, coordinated breaking API change is in flight (governed by ADR-0017, out of scope here).
- **Edge cases:** a breaking core API change that the admin UI has not yet adopted — this is the coordination case BRU-005/NFR-005/ADR-0017 exist to manage; until a versioning policy gate is in place, such a change must not ship.

### 5.4 Feature / Capability: Downstream subsystem integration surface

- **Description:** `social-listening-core` exposes two integration mechanisms usable independently of `social-listening-admin`: the REST API (for on-demand and historical reads) and Service Bus events (for real-time notification), per Design Spec §7 and ADR-0012/ADR-0013.
- **Triggers:** a future downstream subsystem (Brand Reputation & Alerts, Social Care, Social Selling) needing this subsystem's data.
- **Inputs:** the downstream subsystem's own integration code, calling core's public REST endpoints and/or subscribing to core's Service Bus topics.
- **Processing:** core treats the admin UI as just one more REST client with no privileged access; nothing in core's public surface assumes the admin UI's presence, session model, or request shape beyond standard auth.
- **Outputs:** REST responses and Service Bus events consumable by any authorized client.
- **Error handling:** core's public surface must not silently depend on admin-UI-only conventions (e.g., cookies only the BFF sets) for downstream, non-admin callers; such assumptions are boundary violations.
- **Edge cases:** a downstream subsystem's data need that no current endpoint or event topic serves — resolved by extending core's public surface, never by granting direct database access.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Admin UI Developer | Builds `social-listening-admin`; must not reach the database directly |
| Backend/Platform Engineer | Builds `social-listening-core`; owns the REST API and event publishing |
| Downstream Subsystem Engineer | Future consumer of core's REST API and Service Bus events |
| Tenant Admin / Tenant User (end user) | Uses `social-listening-admin` screens; indirectly depends on the boundary holding |
| Product Owner / Technical Lead (Menno) | Owns the split decision and approves any boundary exception |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 1.1) | admin UI developer | have `social-listening-admin` talk to `social-listening-core` strictly through its REST API, never directly to the database | the core stays independently deployable/testable and downstream subsystems get the same API surface the admin UI relies on | (1) Admin's manifest has no Postgres driver/connection string; (2) every admin feature calls a documented core REST endpoint, no bypass path; (3) core and admin can each be deployed, rolled back, and scaled independently |

### 6.3 Workflow Diagrams / Steps

**Workflow: Admin UI performs a tenant action (e.g., connect a platform)**

1. Tenant Admin clicks "Connect" in `social-listening-admin`.
2. Admin UI's server-side (BFF) layer constructs an authenticated HTTP request to the corresponding `social-listening-core` REST endpoint.
3. `social-listening-core` validates the request (auth, tenant scope, payload), applies its business logic, and persists any state change under RLS-enforced tenant isolation (ADR-0015).
4. Core returns a REST response.
5. Admin UI updates the rendered screen from that response; at no point does step 2–5 touch the database directly from the admin repository.

**Workflow: Downstream subsystem consumes core output**

1. A downstream subsystem authenticates against `social-listening-core`'s REST API (or subscribes to a Service Bus topic).
2. It reads historical/on-demand data via REST, or receives a thin real-time event via Service Bus.
3. If the event is thin, the subsystem fetches full detail via the REST API on demand (ADR-0012).
4. No step requires `social-listening-admin` to be deployed, running, or even to exist.

---

## 7. Data Requirements

### 7.1 Data Inputs

`social-listening-core` is the sole owner and reader/writer of the Postgres database. `social-listening-admin` never reads or writes the database; its only input is REST responses from core plus browser-submitted user input.

### 7.2 Data Outputs

Core produces REST responses (JSON) consumed by the admin UI and by downstream subsystems, and thin Service Bus events consumed by downstream subsystems (per ADR-0012/ADR-0013).

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| Repository | name (`social-listening-core` \| `social-listening-admin`), owned responsibilities, deployment unit, package manifest | Two peer entities connected only by the REST API contract |
| REST API Contract | version prefix, documented endpoints, request/response shapes | Owned by `social-listening-core`; consumed by `social-listening-admin` and downstream subsystems |
| Service Bus Event Topic | topic name, thin event schema | Owned by `social-listening-core`; consumed by downstream subsystems (not by the admin UI) |
| Deployment Unit | build artifact, CI pipeline, release/rollback state | One per repository; independently versioned |

### 7.4 Validation Rules

- `social-listening-admin`'s dependency manifest must contain zero database-driver packages or connection-string configuration — checked at review time and, per BRU-005/NFR-005, ideally by an automated contract check.
- Every state-changing or state-reading admin UI code path must resolve to a documented core REST endpoint; an admin code path with no corresponding endpoint is invalid.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `social-listening-admin` must not include a Postgres driver or database connection string. | `social-listening-admin` |
| BR2 | Every feature in `social-listening-admin` that reads or mutates state must be implemented as a call to a `social-listening-core` REST endpoint. | `social-listening-admin` |
| BR3 | `social-listening-core` may be released, deployed, and rolled back without a corresponding `social-listening-admin` release, and vice versa. | Both repositories |
| BR4 | Downstream subsystems must not take a dependency on `social-listening-admin` code, assets, or deployment artifacts. | Downstream subsystems |
| BR5 | A documented API versioning and compatibility policy (ADR-0017) must be in place before the first breaking API change ships. | `social-listening-core` |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `social-listening-admin` → `social-listening-core` | Outbound (admin), Inbound (core) | Every tenant-facing admin action (connectors, watchlists, health) | HTTPS REST / JSON |
| `social-listening-core` → Postgres | Outbound | Sole authoritative data store, RLS-enforced tenant isolation | Postgres wire protocol |
| `social-listening-core` → downstream subsystems (future) | Outbound | On-demand/historical reads | HTTPS REST / JSON |
| `social-listening-core` → Azure Service Bus → downstream subsystems (future) | Outbound | Real-time thin-event notification | Service Bus / AMQP |

---

## 10. Non-Functional Considerations

- **Performance:** REST round-trip becomes the only path for admin UI state access — no direct-DB shortcut is available to compensate for a slow endpoint, so core endpoints the admin UI depends on must be adequately fast on their own.
- **Security/access control:** database credentials exist only within `social-listening-core`; `social-listening-admin` holds none, shrinking the attack surface that could reach tenant data directly. Tenant isolation (RLS, ADR-0015) is enforced at a single choke point.
- **Scalability:** the two repositories can be scaled independently (e.g., scale core ingestion workers separately from admin UI request handlers).
- **Reliability/availability:** admin UI availability is now bounded by core API availability; a core outage degrades or breaks the admin UI, by design, rather than silently falling back to stale direct-DB reads.
- **Audit and logging:** all tenant-facing state changes pass through core's REST layer, giving a single place to log/audit every mutation — no shadow write path from the admin UI.
- **Accessibility / localization:** not applicable to this ADR's scope; owned by the admin UI's own design system.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Core REST endpoint unreachable from admin UI | Generic "can't reach the service right now" / degraded screen | Admin UI surfaces an error state; never falls back to direct DB access |
| Core returns a validation/auth error | Contextual error tied to the failed action (e.g., "not authorized") | Admin UI relays core's error; no admin-side reinterpretation that hides the real cause |
| A proposed admin feature has no corresponding core endpoint | N/A (caught pre-release) | Treated as a design gap: the endpoint must be added to core before the admin feature ships |
| A dependency-manifest change adds a database driver to `social-listening-admin` | N/A (caught in review/CI) | Change is rejected; boundary violation |

---

## 12. Assumptions and Dependencies

- Technology stack remains TypeScript/Node.js throughout, Azure-native for database, secrets, enrichment, and eventing.
- `social-listening-admin` is a Next.js application.
- Multi-tenant isolation is enforced at the database layer, inside `social-listening-core` only (ADR-0015).
- Dependency: ADR-0017 (API Versioning and Compatibility Policy) must land before the first breaking core API change.
- Dependency: ADR-0012/ADR-0013 define how downstream subsystems consume thin events and per-tenant filtering.
- Dependency: ADR-0015/ADR-0016 define the tenant-isolation and database-engine foundation core relies on.
- Both repositories currently live as subdirectories of one workspace repo pending an eventual real repository split (a project-level fact, not a change to this ADR's decision).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | What automated contract check enforces BR2/NFR-005 (no admin bypass of the REST API) beyond manual code review? | Technical Lead | When CI tooling is extended past current lightweight solo-project CI |
| Q2 | When does the physical repository split (currently two subdirectories of one workspace repo) actually happen? | Product Owner | Unscheduled — tracked as a known gap, not blocking current work |

---

## 14. Appendix

- **Glossary:** see BRD-0001 §15 for full term definitions (`social-listening-core`, `social-listening-admin`, downstream subsystems, REST API, Service Bus, connector framework, RLS).
- **Reference links:** `docs/adr/0001-two-repository-split.md`; `docs/project docs/Business-Requirements/BRD-0001-Two-Repository-Split.md`; `docs/user-stories/epic-1-repository-and-api-foundation.md` (Story 1.1); `docs/adr/0012-thin-events-with-rest-fetch-on-demand.md`; `docs/adr/0013-per-tenant-event-filtering-via-subscription-rules.md`; `docs/adr/0015-tenant-isolation-via-postgres-row-level-security.md`; `docs/adr/0016-postgres-as-database-engine.md`; `docs/adr/0017-api-versioning-and-compatibility-policy.md`.
- **Feature design / deep research:** none found — BRD-0001 §16.2 confirms no `docs/product-research/feature-designs/` or `reports/` file exists for the repository-split decision; this is an architectural ADR, not a product feature.
- **Diagrams:** none beyond the workflow steps in §6.3.
- **Revision history:** v1.0, 2026-08-23 — regenerated from ADR-0001/BRD-0001/Story 1.1 to replace a defective prior version that duplicated the BRD's flat requirements table instead of a per-capability functional breakdown.
