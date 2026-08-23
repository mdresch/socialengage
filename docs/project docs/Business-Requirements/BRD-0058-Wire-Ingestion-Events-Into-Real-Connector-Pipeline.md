# Business Requirements Document (BRD) — Wire Ingestion Events Into Real Connector Pipeline

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Wire Ingestion Events Into Real Connector Pipeline – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product/Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | BRD Writer Agent | Initial draft from ADR-0058, Story 5.19, and the multi-source ingestion feature design |

---

## 2. Executive Summary

**What problem are we solving?**

The SocialEngage Listening/Insights subsystem already has a real `publishEvent()` mechanism that sends `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` messages to a live Service Bus topic, and these events are contract-verified in isolation. However, a repository-wide search of the real connector pipeline (`src/connectors/`, `src/posts/`, `src/ingestion/`) found zero actual call sites. The event plumbing is built, but it is not wired into the live ingestion path, so downstream capabilities that depend on events (watchlist-hit notifications, connector-health alerting, and other real-time features) receive nothing today.

**Who is affected?**

Downstream subsystem developers, platform operators who expect Service Bus to reflect real ingestion and health changes, Tenant-Admins and Tenant-Users who will eventually rely on watchlist and connector alerts, and the connector maintainers who must ensure every connector emits the right events.

**What is the proposed solution at a glance?**

Every real connector (GNews, Newswire, tenant-owned-feed, and later Wikipedia) will publish `SocialPostIngestedEvent` once per matching watchlist immediately after a post has been successfully committed to the database. A new tenant-wide `listActiveWatchlistsForTenant()` store function supports this without adding elevated roles. `ConnectorHealthChangedEvent` will be published once, from the shared `runIngestionAttempt()` function, whenever a connector's derived health status changes across an ingestion attempt. All publishing is best-effort and never blocks ingestion.

**What business value do we expect?**

- The event-driven half of the architecture becomes real and exercised in production, not a fully-built but disconnected mechanism.
- Already-accepted thin event shapes (`ADR-0012`) are preserved; the gap is closed by adding real callers, not by redesigning the contract.
- Future connectors inherit health-event publishing automatically through `runIngestionAttempt()`.
- Downstream subsystems can finally rely on real events for watchlist hits and connector health transitions.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the documented gap between built event publishing and real ingestion callers | `publishEvent()` is invoked from every real connector's ingest loop and from `runIngestionAttempt()` for health changes |
| 2 | Preserve the already-accepted thin event contract | No changes to `SocialPostIngestedEvent` or `ConnectorHealthChangedEvent` shape or schema |
| 3 | Ensure no future connector is added without event wiring | New connectors that call `runIngestionAttempt()` and the standard ingest pattern publish events from day one |
| 4 | Protect ingestion availability from event-side failures | A Service Bus failure never rolls back or aborts a successful post insertion |
| 5 | Enable downstream real-time features | Downstream consumers receive real `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` messages |

---

## 4. Scope

### 4.1 In Scope

- Publishing `SocialPostIngestedEvent` from each real connector's per-post ingest loop (GNews, Newswire, tenant-owned-feed) after the post-insertion transaction has committed.
- Matching each newly ingested post against the tenant's active watchlists for that connector's `platformId` and publishing one event per matching watchlist.
- A new tenant-wide `listActiveWatchlistsForTenant(tenantId)` store function that returns all active watchlists for a tenant without an owning-user filter.
- Publishing `ConnectorHealthChangedEvent` from the shared `runIngestionAttempt()` function when the derived health status differs before and after an ingestion attempt.
- Best-effort publishing: every `publishEvent()` call is wrapped in catch-and-log logic that never re-throws.
- Fetching active watchlists once per connector poll batch, not once per post.
- Updating documentation (ADR index, user-stories index, and `ingestion-events/SKILL.md` known gaps) to reflect that real publishing now exists.

### 4.2 Out of Scope

- Throttling, batching, or deduplicating `SocialPostIngestedEvent` messages when a single post matches many watchlists (deferred to staging validation and future design).
- Building a real downstream subscriber or consumer of these events.
- Modifying the already-accepted `SocialPostIngestedEvent` or `ConnectorHealthChangedEvent` payload shapes.
- Refactoring watchlist ownership model or RLS beyond the new read-only, ingestion-context store function.
- Wiring the Wikipedia connector inside Story 5.19; it adopts the same pattern when its own build resumes.

### 4.3 Assumptions

- The existing `resolveWatchlistAstDispatch()` and `matchPostsForWatchlistAst()` functions correctly evaluate watchlist ASTs against an already-inserted post.
- `buildSocialPostIngestedEvent()` and `buildConnectorHealthChangedEvent()` are available and contract-verified.
- The live `social-listening-events` Service Bus topic and `publishEvent()` publisher are operational.
- Watchlists are deliberately per-user within a tenant; the new tenant-wide function is for ingestion-context matching only.

### 4.4 Constraints

- No new elevated Postgres role or `BYPASSRLS` credential may be created to implement `listActiveWatchlistsForTenant()`.
- Event publishing must remain a best-effort side effect; the REST API and database are the source of truth.
- No throttling is built for v1; Service Bus throughput must be observed during staging validation.
- All changes must preserve the existing owner-scoped `listWatchlists(tenantId, userId)` for Admin-UI use.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Downstream Subsystem Developer (Brand Reputation & Alerts) | Consumer of real events for watchlist hits and health changes | High | Events actually fire when posts and health change, with accurate `watchlistId` and status transitions |
| Platform Operator | Owns Service Bus throughput and connector observability | High | Message volume is predictable and health events are emitted without per-connector wiring |
| Tenant-Admin / Sole-Operator | End users of connector health and watchlist hit features | Medium | Watchlist matches and connector status changes are reflected reliably and without blocking ingestion |
| Connector Maintainer | Adds and maintains `SocialConnector` implementations | Medium | Clear, reusable pattern for event publishing that does not need re-invention per connector |
| Product/Technical Lead | Decision sponsor | High | The documented gap is closed with traceable acceptance criteria and minimal architectural debt |

---

## 6. Current State (As-Is)

**Current process:**

A real ingestion cycle polls a source, normalizes the result, and calls `insertSocialPost()` to store the post. `publishEvent()`, `buildSocialPostIngestedEvent()`, and `buildConnectorHealthChangedEvent()` exist and are tested in isolation. `listWatchlists()` is available but is intentionally scoped by both `tenantId` and `userId` for the Admin UI. Connector health is derived on demand from `ingestion_runs` and `platform_credentials`, with no stored `previous_status`.

**Pain points:**

- `publishEvent()` has zero real call sites in the actual connector pipeline, so the event-driven path is not exercised in production.
- `SocialPostIngestedEvent.watchlistId` is required, but no real ingestion path has ever performed watchlist matching before publishing.
- There is no existing function that can list every active watchlist for a tenant, which is what ingestion-time matching requires.
- `ConnectorHealthChangedEvent` has no previous-state snapshot to diff against.
- Downstream subsystems that intend to subscribe to these events cannot rely on them yet.

---

## 7. Future State (To-Be)

**New or improved process:**

1. Each connector's ingest function (`ingestGNewsArticles()`, `ingestNewswireItems()`, `ingestTenantOwnedFeedItems()`, and later Wikipedia's equivalent) begins a poll batch by fetching the tenant's active watchlists scoped to its own `platformId`.
2. For each post, after `insertSocialPost()` resolves and the transaction is committed, the connector evaluates the post against each candidate watchlist.
3. For every matching watchlist, the connector publishes one `SocialPostIngestedEvent` using the unmodified, already-accepted thin event shape.
4. `runIngestionAttempt()` calls `deriveConnectorHealth()` immediately before opening an `IngestionRun` and again immediately after closing it; if the status differs, it publishes one `ConnectorHealthChangedEvent`.
5. Every `publishEvent()` call is wrapped in catch-and-log logic; a failure does not roll back the post insertion or the ingestion attempt.

**Expected capabilities:**

- Real `SocialPostIngestedEvent` messages flow for every watchlist match produced by the live ingestion pipeline.
- Real `ConnectorHealthChangedEvent` messages flow whenever any connector's health transitions.
- New connectors receive health-event publishing automatically through `runIngestionAttempt()`.
- Ingestion remains resilient to Service Bus failures.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall publish one `SocialPostIngestedEvent` for each active watchlist that matches a newly ingested post | Must | Contract test proves a post matching two watchlists emits exactly two correctly-keyed events, and a post matching zero watchlists emits none | Product Owner |
| BR-002 | The system shall evaluate active watchlists once per connector poll batch, not once per post | Must | Code-path assertion confirms a single `listActiveWatchlistsForTenant()` call per batch regardless of post count | Technical Lead |
| BR-003 | The system shall fetch active watchlists in a tenant-wide, ingestion-context store function without an owning-user filter | Must | A test confirms a watchlist owned by user B is returned when called with no `userId` context | Product Owner |
| BR-004 | The system shall publish `SocialPostIngestedEvent` only after `insertSocialPost()` has resolved and the write is committed | Must | Contract test orders the database write before the `publishEvent()` call | Technical Lead |
| BR-005 | The system shall publish `ConnectorHealthChangedEvent` when derived connector health changes across an ingestion attempt | Must | Test drives a connector from `healthy` to `failing` and asserts exactly one event with correct `previousStatus` and `newStatus` | Product Owner |
| BR-006 | The system shall swallow and log `publishEvent()` failures without failing or rolling back ingestion | Must | Test injects a throwing publisher and confirms the post is still stored and the ingestion attempt does not fail | Technical Lead |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Event publishing must remain a best-effort, non-blocking side effect of ingestion | Reliability | Must | No `publishEvent()` call is `await`ed in a way that could abort the surrounding post-insert or ingestion attempt |
| NFR-002 | Watchlist fetching must be O(1) per poll batch | Performance | Must | Batch-scoped fetch is called once per poll cycle and passed through the per-post loop |
| NFR-003 | No new elevated database role or `BYPASSRLS` credential may be introduced | Security | Must | `listActiveWatchlistsForTenant()` is implemented using existing tenant-scoped read paths, verified by RLS contract tests |
| NFR-004 | Service Bus message throughput from multi-watchlist fan-out must be monitored during staging | Observability | Should | Staging run captures peak messages per batch and any broker throttling/rejection metrics |
| NFR-005 | The existing thin event shapes must not change | Maintainability | Must | `buildSocialPostIngestedEvent()` and `buildConnectorHealthChangedEvent()` signatures and outputs remain unchanged |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A `SocialPostIngestedEvent` is published only when a post matches at least one active watchlist for the connector's `platformId`. |
| BRU-002 | One `SocialPostIngestedEvent` is published per matching watchlist, not per post. |
| BRU-003 | Event publishing is non-blocking; `publishEvent()` failures are caught, logged, and never re-thrown. |
| BRU-004 | `ConnectorHealthChangedEvent` is published only when the derived health status differs between the before- and after-snapshot of `runIngestionAttempt()`. |
| BRU-005 | Active watchlists for ingestion matching are filtered to those whose `platform_ids` include the connector's own `providerId`. |
| BRU-006 | The REST API and database remain the source of truth; Service Bus events are best-effort notifications. |
| BRU-007 | The new `listActiveWatchlistsForTenant()` function is read-only and is never exposed as a replacement for the owner-scoped `listWatchlists()` Admin-UI view. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost` | Ingested post record, including `provider_id`, `tenant_id`, and `rawPayload` | `social_posts` table (post-insert) | Product Owner | High — tenant-scoped content |
| `Watchlist` | Active watchlist with `platform_ids`, `is_active`, and boolean query AST | `watchlists` table via `listActiveWatchlistsForTenant()` | Product Owner | High — tenant-scoped |
| `Watchlist match result` | Boolean outcome of `matchPostsForWatchlistAst()` for a specific post and watchlist | Ingestion loop evaluation | Technical Lead | Medium — derived |
| `IngestionRun` | Audit record of each connector poll attempt | `ingestion_runs` table | Technical Lead | Medium — audit data |
| `ConnectorHealth` | Derived status from `ingestion_runs` and `platform_credentials` | `deriveConnectorHealth()` | Product Owner | Medium — operational status |
| `SocialPostIngestedEvent` | Thin event with `tenantId`, `postId`, `platformId`, `watchlistId`, `sentiment`, `publishedAt`, `occurredAt` | `buildSocialPostIngestedEvent()` | Technical Lead | High — tenant pointer |
| `ConnectorHealthChangedEvent` | Thin event with `tenantId`, `platformId`, `previousStatus`, `newStatus`, `occurredAt` | `buildConnectorHealthChangedEvent()` | Technical Lead | Medium — operational status |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| `SocialPostIngestedEvent` volume by connector | Track real event publishing throughput and multi-watchlist fan-out | Platform Operator / Technical Lead | Daily |
| `ConnectorHealthChangedEvent` volume by platform | Monitor health-transition event patterns and noisy connectors | Platform Operator / Technical Lead | Daily |
| Watchlist match count per poll batch | Observe matching workload and potential fan-out spikes | Technical Lead | Per staging run / Weekly |
| Service Bus publish failure rate | Confirm best-effort behavior and detect broker issues | Platform Operator | Real-time / Daily |
| Ingestion run success rate | Ensure event-side changes have not degraded ingestion | Product Owner / Technical Lead | Daily |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Watchlists are re-queried per post, creating an N+1 load per poll batch | Medium | High | Mandate one `listActiveWatchlistsForTenant()` call per batch and verify with a contract test | Technical Lead |
| R-002 | A popular post matching many watchlists generates a large fan-out of Service Bus messages | Medium | High | Monitor message throughput during staging validation; defer a throttle/batch design until real volume data exists | Product Owner |
| R-003 | A downstream subscriber reads a post before the insertion is committed | Medium | High | Publish only after `insertSocialPost()` resolves and any surrounding transaction has committed | Technical Lead |
| R-004 | The new tenant-wide watchlist function is misused in an Admin-UI context | Low | High | Use a clearly distinct function name and guard with RLS/contract tests that prove the two scopes cannot be confused | Product Owner |
| R-005 | No real subscriber exists yet, so events flow to a topic with no consumer | High | Low | Document this explicitly as an unchanged gap; it is the subscriber side that is not in scope here | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` shapes are already accepted (ADR-0012) | Internal | Technical Lead | Already accepted and contract-tested |
| D-002 | Service Bus publisher `publishEvent()` is real and available (ADR-0013 / ADR-0019 / Story 5.2 / Story 5.5) | Internal | Technical Lead | Already built |
| D-003 | `resolveWatchlistAstDispatch()` and `matchPostsForWatchlistAst()` are built and tested (Story 2.11 / 3.6) | Internal | Technical Lead | Already built; used directly as a fallback evaluator |
| D-004 | `deriveConnectorHealth()` and `runIngestionAttempt()` exist (ADR-0009 / Story 1.13) | Internal | Technical Lead | Already built |
| D-005 | Watchlist RLS and ownership model is in place (ADR-0044) | Internal | Product Owner | Already built |
| D-006 | Best-effort side-effect precedent from `enrichPost()` (ADR-0038) | Internal | Technical Lead | Already accepted |
| D-007 | Story 5.19 implements the wiring across the three existing connectors and the health-diff | Internal | Technical Lead | Built 2026-08-17 per `social-listening-core@3ef32ad` |
| D-008 | Story 2.13 (Wikipedia) resumes and adopts the same `SocialPostIngestedEvent` wiring | Internal | Product Owner | Paused pending this ADR; to be resumed |

---

## 14. Acceptance Criteria

- A new `listActiveWatchlistsForTenant(tenantId): Promise<Watchlist[]>` store function exists and is proven to return active watchlists for a tenant regardless of owning user.
- Each of the three real connectors' ingest functions fetches tenant active watchlists once per poll batch, filters by the connector's `platformId`, and publishes one `SocialPostIngestedEvent` per matching watchlist after the post is committed.
- A contract test confirms a post matching two watchlists publishes exactly two events, and a post matching zero watchlists publishes none.
- A contract or code-path assertion confirms the watchlist fetch is called exactly once per poll batch.
- A contract test confirms `SocialPostIngestedEvent` is published only after `insertSocialPost()` has resolved and the database write is observable.
- `runIngestionAttempt()` calls `deriveConnectorHealth()` before and after the run and publishes exactly one `ConnectorHealthChangedEvent` when and only when the status differs.
- A contract test confirms a connector moving from `healthy` to `failing` emits one health-changed event with the correct `previousStatus` and `newStatus`.
- A contract test confirms a rejected or throwing `publishEvent()` does not fail or roll back the surrounding post insertion or ingestion attempt.
- `docs/adr/README.md`, `docs/user-stories/README.md`, and `ingestion-events/SKILL.md` are updated to reflect that real event publishing now exists.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `SocialPostIngestedEvent` | Thin event published when an ingested post matches an active watchlist. |
| `ConnectorHealthChangedEvent` | Thin event published when a connector's derived health status transitions. |
| `listActiveWatchlistsForTenant()` | New tenant-wide, ingestion-context store function that returns all active watchlists for a tenant without an owning-user filter. |
| Poll batch | A single connector poll cycle that may insert many posts. |
| Best-effort publishing | A pattern where `publishEvent()` failures are caught and logged and never block the primary ingestion transaction. |
| `runIngestionAttempt()` | Shared function every connector calls to execute a poll attempt and record an `IngestionRun`. |
| `deriveConnectorHealth()` | Function that derives a connector's health from `ingestion_runs` and `platform_credentials` at read time. |
| Watchlist AST | The boolean query tree used to decide whether a post matches a watchlist. |

---

## 16. Appendices

### Reference documents

- [ADR-0058: Wire `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` publishing into the real ingestion pipeline](../../adr/0058-wire-ingestion-events-into-real-connector-pipeline.md)
- [ADR-0012: Thin Events with REST Fetch On-Demand](../../adr/0012-thin-events-with-rest-fetch-on-demand.md)
- [ADR-0013: Per-Tenant Event Filtering via Subscription Rules](../../adr/0013-per-tenant-event-filtering-via-subscription-rules.md)
- [ADR-0019: Event Schema Versioning via Service Bus Message Property](../../adr/0019-event-schema-versioning-via-service-bus-message-property.md)
- [ADR-0038: Non-blocking side effects in ingestion (best-effort `enrichPost` precedent)](../../adr/0038-best-effort-side-effects-do-not-fail-ingestion.md)
- [ADR-0044: Watchlist API Design and Database Schema Standardization](../../adr/0044-watchlist-api-design-and-database-schema-standardization.md)
- [ADR-0048: No Core Pipeline Change Verification for New Connector Registration](../../adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md)
- [Feature Design 01: Multi-source Ingestion](../product-research/feature-designs/01-multi-source-ingestion.md)

### Related user stories

- [Story 5.19 — Wire `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` publishing into the real ingestion pipeline](../../user-stories/epic-5-security-isolation-and-messaging.md) (Source: ADR-0058)
- [Story 2.13 — Wikipedia connector](../../user-stories/epic-2-connectors-and-sources.md) (adopts this pattern when resumed)

### Notes on missing sources

- No standalone `docs/product-research/reports/<feature>-deep-research.md` file was found for this specific feature. The governing context is captured in the ADR, the multi-source ingestion feature design, and the referenced user stories.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Other Stakeholder | | | |
