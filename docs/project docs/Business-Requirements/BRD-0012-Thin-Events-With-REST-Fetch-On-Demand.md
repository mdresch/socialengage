# Business Requirements Document (BRD) — Thin Events with REST Fetch On-Demand

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Thin Events with REST Fetch On-Demand – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product/Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | BRD Writer Agent | Initial draft from ADR-0012 and related design artifacts |

---

## 2. Executive Summary

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

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Keep post data authoritative in one place | No full post body, engagement metrics, or raw payload are duplicated inside event payloads |
| 2 | Make real-time eventing cost-efficient at ingestion volume | Published event payload size and schema remain bounded and stable over time |
| 3 | Enable cheap triage for downstream alerting subsystems | Brand Reputation & Alerts can decide whether to act using only the thin event fields, without a REST round-trip for every message |

---

## 4. Scope

### 4.1 In Scope

- Defining the thin payload shape for `SocialPostIngestedEvent`.
- Defining the thin payload shape for `ConnectorHealthChangedEvent`.
- Requiring that full post data be available on demand through a REST `GET /posts/:id` endpoint.
- Mandating that any subscriber needing more than the thin fields fetch the authoritative full state via REST.
- Treating the REST API, backed by the core database, as the single source of truth for full post content.

### 4.2 Out of Scope

- Carrying the full post body, engagement metrics, or raw payload inside events.
- Carrying diff/change-only payloads inside events as an alternative to REST fetch.
- Building the downstream Brand Reputation & Alerts, Social Care, or Social Selling subsystems.
- Providing replay or backfill of post content from the event stream alone.
- Solving event delivery guarantees, per-tenant subscription filtering, or event schema versioning (governed by ADR-0013, ADR-0017, and ADR-0019).

### 4.3 Assumptions

- The core REST API and its database will remain the authoritative source for full post and connector-health data.
- Downstream subsystems have network access to the REST API and Service Bus.
- Events are a best-effort notification channel; the REST API is the system of record.

### 4.4 Constraints

- Event payloads must remain intentionally small and stable.
- No post content that can be corrected or enriched after publishing may be cached inside the event contract.
- The design must not require schema changes to events every time `SocialPost` gains a new field.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Downstream Subsystem Developer (Brand Reputation & Alerts) | Consumer of thin events and REST API | High | Fast triage, authoritative data on demand, no stale copies |
| Downstream Subsystem Developer (Social Care / Social Selling) | Consumer of thin events and REST API | High | Reliable references to posts and connector state |
| Platform Operator | Owns Service Bus throughput and API capacity | Medium | Predictable message size and scalable subscriber fetch patterns |
| Tenant-Admin | Owns tenant data and connector health | Medium | Tenant data stays accurate, not duplicated across systems |
| Product/Technical Lead | Decision sponsor | High | Clear scope, traceable requirements, low architectural debt |

---

## 6. Current State (As-Is)

**Current process:**

The ingestion pipeline stores posts in the core database and exposes them through a REST API. Downstream subsystems will subscribe to events to decide whether to act on newly ingested posts or connector-health changes. Before this decision, the event contract was undecided: events could potentially carry the full post body, a change-only diff, or only a minimal reference.

**Pain points:**

- Full bodies in events would create duplicate copies of post content that can become stale after enrichment, correction, or reprocessing.
- Large event payloads increase Service Bus cost and coupling between the post schema and every downstream subscriber.
- Change-only/diff payloads add versioning complexity without a clear benefit when the REST API already provides the current full state.
- Subscribers acting on every event would be forced to receive data they may not need.

---

## 7. Future State (To-Be)

**New or improved process:**

1. When a post is ingested, the pipeline publishes a `SocialPostIngestedEvent` carrying only `tenantId`, `postId`, `platformId`, `watchlistId`, `sentiment`, `publishedAt`, and `occurredAt`.
2. When connector health changes, the pipeline publishes a `ConnectorHealthChangedEvent` carrying only `tenantId`, `platformId`, `previousStatus`, `newStatus`, and `occurredAt`.
3. A downstream subscriber that decides to act fetches the full, authoritative post record from `GET /posts/:id`.
4. A subscriber like Brand Reputation & Alerts can use `sentiment` in the event to make an initial triage decision without an immediate REST call.
5. The REST API remains the only place where full post text, engagement metrics, and raw payload live, eliminating stale duplicates.

**Expected capabilities:**

- Event payloads stay small and stable regardless of how `SocialPost` evolves.
- New post fields do not force event-schema changes.
- Subscribers always get the latest, authoritative data when they fetch on demand.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall publish `SocialPostIngestedEvent` carrying only `tenantId`, `postId`, `platformId`, `watchlistId`, `sentiment`, `publishedAt`, and `occurredAt` | Must | Payload excludes post text, engagement metrics, and raw payload; verified by contract test | Product Owner |
| BR-002 | The system shall publish `ConnectorHealthChangedEvent` carrying only `tenantId`, `platformId`, `previousStatus`, `newStatus`, and `occurredAt` | Must | Payload contains only status-transition fields; verified by contract test | Product Owner |
| BR-003 | The system shall expose a REST endpoint that returns the full post record for a given `postId` | Must | `GET /posts/:id` returns authoritative post data including text, metrics, and raw payload | Product Owner |
| BR-004 | Subscribers that need more than the thin fields shall fetch full data via the REST endpoint on demand | Must | Any consumer requiring full content uses `GET /posts/:id`; no downstream system reconstructs full content from events alone | Technical Lead |
| BR-005 | `SocialPostIngestedEvent` shall include `sentiment` to enable triage without a REST round-trip | Should | Subscribers can make an initial "does this need attention" decision using only the thin event | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Event payload size and schema must remain bounded and stable as `SocialPost` fields grow | Maintainability | Must | Adding a new `SocialPost` field does not require an event-schema change |
| NFR-002 | The REST API must be the single source of truth for full post content | Reliability | Must | No authoritative post content is duplicated inside events or held by subscribers based on events alone |
| NFR-003 | The REST API must be available for on-demand fetches at acceptable latency | Performance | Should | `GET /posts/:id` latency remains within the platform SLO under expected subscriber load |
| NFR-004 | Event design must avoid creating stale data copies in downstream systems | Data Quality | Must | Downstream systems cannot hold post content that has become stale relative to the core database |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Event payloads must never include the full post body, engagement metrics, or raw payload. |
| BRU-002 | The REST API, backed by the core database, is the only authoritative source for full post content. |
| BRU-003 | `sentiment` in `SocialPostIngestedEvent` is provided for triage only and is not authoritative for any decision that requires the full post context. |
| BRU-004 | `ConnectorHealthChangedEvent` may carry only status-transition fields; no detailed health history or diagnostic data belongs in the event. |
| BRU-005 | A subscriber requiring more than the thin event fields must fetch the full record on demand through the REST API. |

---

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Ingestion event volume | Track event publishing throughput | Platform Operator / Technical Lead | Daily |
| Subscriber REST fetch rate | Monitor API load generated by downstream consumers | Platform Operator / Technical Lead | Real-time / Daily |
| Average event payload size | Confirm thin-event design keeps payloads bounded | Technical Lead | Weekly |
| Stale-data incident count | Verify no subscriber holds stale post copies | Product Owner / Technical Lead | Monthly |
| Connector health change frequency | Observe health-transition event patterns | Platform Operator | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | REST API becomes overloaded by large numbers of on-demand subscriber fetches | High | High | Rate limiting, caching, horizontal scaling, and monitoring of fetch patterns | Technical Lead |
| R-002 | Subscribers cannot fully reconstruct or backfill post content if the REST API is unavailable or the post is deleted | Medium | High | Document the dependency on API availability and retention policy; consider audit/history if backfill becomes a future requirement | Product Owner |
| R-003 | Downstream teams misinterpret `sentiment` in the thin event as authoritative | Medium | Medium | Document in event contract and API docs that `sentiment` is triage-only; full context requires a REST fetch | Product Owner |
| R-004 | Event schema still changes when a new mandatory thin field is needed | Low | Medium | Treat thin fields as highly stable; apply schema versioning (ADR-0019) for any unavoidable breaking change | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | REST API `GET /posts/:id` endpoint is built and authoritative | Internal | Technical Lead | Already built per ADR-0011 / Story 3.4, Story 5.1 |
| D-002 | Service Bus publish mechanism is available | Internal / Infrastructure | Platform Operator | Already built per ADR-0013, ADR-0019, Story 5.1/5.2/5.5 |
| D-003 | Per-tenant event filtering (ADR-0013) in place to secure downstream subscriptions | Internal | Technical Lead | Accepted; implemented via `tenantId` message property and subscription filters |
| D-004 | Event schema versioning (ADR-0019) in place for future non-additive changes | Internal | Technical Lead | Accepted; `schemaVersion` carried as a message property |

---

## 14. Acceptance Criteria

- `SocialPostIngestedEvent` contains exactly the thin fields `tenantId`, `postId`, `platformId`, `watchlistId`, `sentiment`, `publishedAt`, `occurredAt`, and no post text, engagement metrics, or raw payload.
- `ConnectorHealthChangedEvent` contains only `tenantId`, `platformId`, `previousStatus`, `newStatus`, `occurredAt`.
- A subscriber can retrieve the full post record for any `postId` received in an event via `GET /posts/:id`.
- The full post content is not duplicated or held as authoritative in any downstream system based on the event alone.
- Adding a new `SocialPost` field does not require a change to the thin event payload contract.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Thin event | A lightweight event payload that carries only identifiers and minimal fields, not full domain objects. |
| REST fetch on demand | Retrieving the full authoritative record from the REST API when a subscriber needs more than the thin event provides. |
| Single source of truth | The one system or service whose copy of data is treated as authoritative; here, the core REST API for full post content. |
| Triage | The initial decision by a downstream subsystem about whether an event warrants further action, often made using minimal fields. |
| `SocialPostIngestedEvent` | The thin event published when a post is ingested and matched to a watchlist. |
| `ConnectorHealthChangedEvent` | The thin event published when a connector's health status changes. |

---

## 16. Appendices

### Reference documents

- [ADR-0012: Thin Events with REST Fetch On-Demand](../../adr/0012-thin-events-with-rest-fetch-on-demand.md)
- [Design Spec §7 "Service Bus Event Schema"](../../project%20docs/2026-07-28-social-listening-ingestion-design.md)
- [ADR-0013: Per-Tenant Event Filtering via Subscription Rules](../../adr/0013-per-tenant-event-filtering-via-subscription-rules.md)
- [ADR-0017: API Versioning for Integrations and Webhooks](../../adr/0017-api-versioning-for-integrations-and-webhooks.md)
- [ADR-0019: Event Schema Versioning via Service Bus Message Property](../../adr/0019-event-schema-versioning-via-service-bus-message-property.md)

### Related user stories

- [Story 5.1 — Thin ingestion events with REST fetch on demand](../../user-stories/epic-5-security-isolation-and-messaging.md) (Source: ADR-0012)
- [Story 5.2 — Per-tenant event filtering via Service Bus subscription rules](../../user-stories/epic-5-security-isolation-and-messaging.md) (Source: ADR-0013)
- [Story 5.5 — Event schema versioning via Service Bus message property](../../user-stories/epic-5-security-isolation-and-messaging.md) (Source: ADR-0019)
- [Story 6.11 — Post feed browse ingested posts](../../user-stories/epic-6-tenant-admin-ui.md) (depends on `GET /v1/posts` and `GET /v1/posts/:id`)

### Notes on missing sources

- No standalone `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file was found directly referencing ADR-0012. The governing context is captured in the Design Spec §7 "Service Bus Event Schema" and the ADR itself.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Other Stakeholder | | | |
