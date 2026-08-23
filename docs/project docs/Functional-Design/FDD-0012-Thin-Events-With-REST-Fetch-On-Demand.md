# Business Requirements Document (BRD) — Thin Events with REST Fetch On-Demand

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Thin Events with REST Fetch On-Demand |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0012-thin-events-with-rest-fetch-on-demand.md, ../Business-Requirements/BRD-0012-Thin-Events-With-REST-Fetch-On-Demand.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0012-thin-events-with-rest-fetch-on-demand.md and the business requirements in BRD-0012-Thin-Events-With-REST-Fetch-On-Demand.md into functional design for **Thin Events With REST Fetch On Demand**.
**What problem are we solving?**

The SocialEngage Listening/Insights subsystem publishes ingestion events that downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling) consume. A key design choice is whether those events carry a full post body or only a minimal reference. Carrying full post bodies risks creating second, potentially-stale copies of content and couples every subscriber to schema changes in `SocialPost`.

**Who is affected?**

Downstream subsystem developers, platform operators who must keep eventing scalable and secure, and ultimately tenants whose posts and connector-health data must remain consistent and authoritative.

**What is the proposed solution at a glance?**

`SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` carry only the IDs and minimal fields a subscriber needs to decide whether to act. Any downstream subsystem that needs full post content or detailed status history fetches it on demand through the existing REST API (`GET /posts/:id`).

**What business value do we expect?**

- A single, authoritative source of truth for full post content (the REST API).
- Small, stable event payloads that are cheap to publish and do not require breaking changes when post fields grow.
- The ability for alert-oriented subsystems to triage events cheaply by reading `sentiment` directly from the event, while still relying on the REST API for authoritative details.

---

### 2.2 Scope
**In scope:**
- Defining the thin payload shape for `SocialPostIngestedEvent`.
- Defining the thin payload shape for `ConnectorHealthChangedEvent`.
- Requiring that full post data be available on demand through a REST `GET /posts/:id` endpoint.
- Mandating that any subscriber needing more than the thin fields fetch the authoritative full state via REST.
- Treating the REST API, backed by the core database, as the single source of truth for full post content.

**Out of scope:**
- Carrying the full post body, engagement metrics, or raw payload inside events.
- Carrying diff/change-only payloads inside events as an alternative to REST fetch.
- Building the downstream Brand Reputation & Alerts, Social Care, or Social Selling subsystems.
- Providing replay or backfill of post content from the event stream alone.
- Solving event delivery guarantees, per-tenant subscription filtering, or event schema versioning (governed by ADR-0013, ADR-0017, and ADR-0019).

## 3. Context and Background
Downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling) will subscribe to ingestion events to decide whether to act on new posts or connector-health changes. Events could either carry the full post body or a minimal reference, and this choice has lasting implications once multiple subsystems depend on the event schema.
**What problem are we solving?**

The SocialEngage Listening/Insights subsystem publishes ingestion events that downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling) consume. A key design choice is whether those events carry a full post body or only a minimal reference. Carrying full post bodies risks creating second, potentially-stale copies of content and couples every subscriber to schema changes in `SocialPost`.

**Who is affected?**

Downstream subsystem developers, platform operators who must keep eventing scalable and secure, and ultimately tenants whose posts and connector-health data must remain consistent and authoritative.

**What is the proposed solution at a glance?**

`SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` carry only the IDs and minimal fields a subscriber needs to decide whether to act. Any downstream subsystem that needs full post content or detailed status history fetches it on demand through the existing REST API (`GET /posts/:id`).

**What business value do we expect?**

- A single, authoritative source of truth for full post content (the REST API).
- Small, stable event payloads that are cheap to publish and do not require breaking changes when post fields grow.
- The ability for alert-oriented subsystems to triage events cheaply by reading `sentiment` directly from the event, while still relying on the REST API for authoritative details.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Keep post data authoritative in one place | No full post body, engagement metrics, or raw payload are duplicated inside event payloads |
| 2 | Make real-time eventing cost-efficient at ingestion volume | Published event payload size and schema remain bounded and stable over time |
| 3 | Enable cheap triage for downstream alerting subsystems | Brand Reputation & Alerts can decide whether to act using only the thin event fields, without a REST round-trip for every message |

---

**Positive consequences (from ADR):**
**Positive**
- Avoids two systems holding potentially-stale duplicate copies of post data: the REST API (backed by Postgres) is the single source of truth for full post content, and events never risk going stale relative to it after an enrichment update or correction.
- Small, stable event payloads are cheap to publish at ingestion volume and are less likely to need a breaking schema change as new fields get added to `SocialPost` — new post fields don't require touching the event contract.
- `sentiment` being included directly in the thin event lets a subscriber like Brand Reputation & Alerts make a cheap "does this need attention" decision without a REST round-trip for every single event, while still treating the API as authoritative for anything beyond that first triage.

**Negative**
- Every subscriber that needs more than the thin fields must make a follow-up REST call per relevant event, adding latency and REST API load proportional to how many events subscribers act on — at high ingestion volume this could become a meaningful load pattern the core API needs to handle.
- Subscribers cannot fully reconstruct post content from the event stream alone (e.g., for replay/backfill scenarios); they depend on the REST API being available and the post not having been deleted since the event fired.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall publish `SocialPostIngestedEvent` carrying only `tenantId`, `postId`, `platformId`, `watchlistId`, `sentiment`, `publishedAt`, and `occurredAt` | Must | Payload excludes post text, engagement metrics, and raw payload; verified by contract test | Product Owner |
| BR-002 | The system shall publish `ConnectorHealthChangedEvent` carrying only `tenantId`, `platformId`, `previousStatus`, `newStatus`, and `occurredAt` | Must | Payload contains only status-transition fields; verified by contract test | Product Owner |
| BR-003 | The system shall expose a REST endpoint that returns the full post record for a given `postId` | Must | `GET /posts/:id` returns authoritative post data including text, metrics, and raw payload | Product Owner |
| BR-004 | Subscribers that need more than the thin fields shall fetch full data via the REST endpoint on demand | Must | Any consumer requiring full content uses `GET /posts/:id`; no downstream system reconstructs full content from events alone | Technical Lead |
| BR-005 | `SocialPostIngestedEvent` shall include `sentiment` to enable triage without a REST round-trip | Should | Subscribers can make an initial "does this need attention" decision using only the thin event | Product Owner |

### 5.1 Architecture Decision
Keep events deliberately thin. `SocialPostIngestedEvent` carries `tenantId`, `postId`, `platformId`, `watchlistId`, `sentiment`, `publishedAt`, and `occurredAt` — not the post's text, engagement metrics, or raw payload. `ConnectorHealthChangedEvent` similarly carries only status transition fields. Subscribers fetch full post data via the REST API (`GET /posts/:id`) on demand.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Downstream Subsystem Developer (Brand Reputation & Alerts) | Consumer of thin events and REST API | High | Fast triage, authoritative data on demand, no stale copies |
| Downstream Subsystem Developer (Social Care / Social Selling) | Consumer of thin events and REST API | High | Reliable references to posts and connector state |
| Platform Operator | Owns Service Bus throughput and API capacity | Medium | Predictable message size and scalable subscriber fetch patterns |
| Tenant-Admin | Owns tenant data and connector health | Medium | Tenant data stays accurate, not duplicated across systems |
| Product/Technical Lead | Decision sponsor | High | Clear scope, traceable requirements, low architectural debt |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.1 | epic-5-security-isolation-and-messaging.md | As downstream subsystem developer (e.g. Brand Reputation & Alerts), I want `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` to carry only IDs and the ... | `SocialPostIngestedEvent` contains `tenantId`, `postId`, `platformId`, `watchlistId`, `sentiment`, `publishedAt`, `occurredAt` — no post text, engagement met... |
| Story 6.11 | epic-6-tenant-admin-ui.md | As tenant user or Tenant-Admin, I want to see the posts my tenant's connected platforms have actually collected, so that I can confirm ingestion is working a... | A `/tenant/posts` screen calls the real `GET /v1/posts` and renders each post: whatever title/text is derivable from `rawPayload` (heterogeneous per connecto... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenantId` | Tenant the event belongs to | Ingestion pipeline / event publisher | Platform Operator | High — multi-tenant isolation |
| `postId` | Unique identifier for the ingested post | `social_posts` table | Technical Lead | High — tenant-scoped content pointer |
| `platformId` | Source platform for the post or connector | Connector/publisher metadata | Technical Lead | Medium |
| `watchlistId` | Watchlist that matched the post | Watchlist matching result | Product Owner | High — tenant-scoped |
| `sentiment` | Inferred sentiment category | Post enrichment | Product Owner | Medium |
| `publishedAt` | Original publication timestamp of the post | Post metadata | Product Owner | Low |
| `occurredAt` | Timestamp when the event was generated | Event publisher | Technical Lead | Low |
| `previousStatus` / `newStatus` | Connector health transition values | Connector health derivation | Technical Lead | Medium |
| Full post record (text, metrics, raw payload) | Authoritative post content | `GET /posts/:id` REST API | Product Owner | High — tenant data |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Event payloads must never include the full post body, engagement metrics, or raw payload. |
| BRU-002 | The REST API, backed by the core database, is the only authoritative source for full post content. |
| BRU-003 | `sentiment` in `SocialPostIngestedEvent` is provided for triage only and is not authoritative for any decision that requires the full post context. |
| BRU-004 | `ConnectorHealthChangedEvent` may carry only status-transition fields; no detailed health history or diagnostic data belongs in the event. |
| BRU-005 | A subscriber requiring more than the thin event fields must fetch the full record on demand through the REST API. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | REST API `GET /posts/:id` endpoint is built and authoritative | Internal | Technical Lead | Already built per ADR-0011 / Story 3.4, Story 5.1 |
| D-002 | Service Bus publish mechanism is available | Internal / Infrastructure | Platform Operator | Already built per ADR-0013, ADR-0019, Story 5.1/5.2/5.5 |
| D-003 | Per-tenant event filtering (ADR-0013) in place to secure downstream subscriptions | Internal | Technical Lead | Accepted; implemented via `tenantId` message property and subscription filters |
| D-004 | Event schema versioning (ADR-0019) in place for future non-additive changes | Internal | Technical Lead | Accepted; `schemaVersion` carried as a message property |

---

- The core REST API and its database will remain the authoritative source for full post and connector-health data.
- Downstream subsystems have network access to the REST API and Service Bus.
- Events are a best-effort notification channel; the REST API is the system of record.

Keep events deliberately thin. `SocialPostIngestedEvent` carries `tenantId`, `postId`, `platformId`, `watchlistId`, `sentiment`, `publishedAt`, and `occurredAt` — not the post's text, engagement metrics, or raw payload. `ConnectorHealthChangedEvent` similarly carries only status transition fields. Subscribers fetch full post data via the REST API (`GET /posts/:id`) on demand.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Event payload size and schema must remain bounded and stable as `SocialPost` fields grow | Maintainability | Must | Adding a new `SocialPost` field does not require an event-schema change |
| NFR-002 | The REST API must be the single source of truth for full post content | Reliability | Must | No authoritative post content is duplicated inside events or held by subscribers based on events alone |
| NFR-003 | The REST API must be available for on-demand fetches at acceptable latency | Performance | Should | `GET /posts/:id` latency remains within the platform SLO under expected subscriber load |
| NFR-004 | Event design must avoid creating stale data copies in downstream systems | Data Quality | Must | Downstream systems cannot hold post content that has become stale relative to the core database |

---

## 11. Error Handling and Exceptions
**Positive**
- Avoids two systems holding potentially-stale duplicate copies of post data: the REST API (backed by Postgres) is the single source of truth for full post content, and events never risk going stale relative to it after an enrichment update or correction.
- Small, stable event payloads are cheap to publish at ingestion volume and are less likely to need a breaking schema change as new fields get added to `SocialPost` — new post fields don't require touching the event contract.
- `sentiment` being included directly in the thin event lets a subscriber like Brand Reputation & Alerts make a cheap "does this need attention" decision without a REST round-trip for every single event, while still treating the API as authoritative for anything beyond that first triage.

**Negative**
- Every subscriber that needs more than the thin fields must make a follow-up REST call per relevant event, adding latency and REST API load proportional to how many events subscribers act on — at high ingestion volume this could become a meaningful load pattern the core API needs to handle.
- Subscribers cannot fully reconstruct post content from the event stream alone (e.g., for replay/backfill scenarios); they depend on the REST API being available and the post not having been deleted since the event fired.

## 12. Assumptions and Dependencies
- The core REST API and its database will remain the authoritative source for full post and connector-health data.
- Downstream subsystems have network access to the REST API and Service Bus.
- Events are a best-effort notification channel; the REST API is the system of record.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | REST API becomes overloaded by large numbers of on-demand subscriber fetches | High | High | Rate limiting, caching, horizontal scaling, and monitoring of fetch patterns | Technical Lead |
| R-002 | Subscribers cannot fully reconstruct or backfill post content if the REST API is unavailable or the post is deleted | Medium | High | Document the dependency on API availability and retention policy; consider audit/history if backfill becomes a future requirement | Product Owner |
| R-003 | Downstream teams misinterpret `sentiment` in the thin event as authoritative | Medium | Medium | Document in event contract and API docs that `sentiment` is triage-only; full context requires a REST fetch | Product Owner |
| R-004 | Event schema still changes when a new mandatory thin field is needed | Low | Medium | Treat thin fields as highly stable; apply schema versioning (ADR-0019) for any unavoidable breaking change | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0012-thin-events-with-rest-fetch-on-demand.md`
- BRD: `../Business-Requirements/BRD-0012-Thin-Events-With-REST-Fetch-On-Demand.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Feature design: `docs/product-research/feature-designs/09-real-time-alerts.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above