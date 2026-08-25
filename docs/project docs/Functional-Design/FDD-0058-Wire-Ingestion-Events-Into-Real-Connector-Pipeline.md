# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0058 Wire Ingestion Events Into Real Connector Pipeline — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0058-wire-ingestion-events-into-real-connector-pipeline.md, ../Business-Requirements/BRD-0058-Wire-Ingestion-Events-Into-Real-Connector-Pipeline.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0058-wire-ingestion-events-into-real-connector-pipeline.md and the business requirements in BRD-0058-Wire-Ingestion-Events-Into-Real-Connector-Pipeline.md into functional design for **Wire Ingestion Events Into Real Connector Pipeline**.
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

### 2.2 Scope
**In scope:**
- Publishing `SocialPostIngestedEvent` from each real connector's per-post ingest loop (GNews, Newswire, tenant-owned-feed) after the post-insertion transaction has committed.
- Matching each newly ingested post against the tenant's active watchlists for that connector's `platformId` and publishing one event per matching watchlist.
- A new tenant-wide `listActiveWatchlistsForTenant(tenantId)` store function that returns all active watchlists for a tenant without an owning-user filter.
- Publishing `ConnectorHealthChangedEvent` from the shared `runIngestionAttempt()` function when the derived health status differs before and after an ingestion attempt.
- Best-effort publishing: every `publishEvent()` call is wrapped in catch-and-log logic that never re-throws.
- Fetching active watchlists once per connector poll batch, not once per post.
- Updating documentation (ADR index, user-stories index, and `ingestion-events/SKILL.md` known gaps) to reflect that real publishing now exists.

**Out of scope:**
- Throttling, batching, or deduplicating `SocialPostIngestedEvent` messages when a single post matches many watchlists (deferred to staging validation and future design).
- Building a real downstream subscriber or consumer of these events.
- Modifying the already-accepted `SocialPostIngestedEvent` or `ConnectorHealthChangedEvent` payload shapes.
- Refactoring watchlist ownership model or RLS beyond the new read-only, ingestion-context store function.
- Wiring the Wikipedia connector inside Story 5.19; it adopts the same pattern when its own build resumes.

## 3. Context and Background
See ADR Context.
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

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the documented gap between built event publishing and real ingestion callers | `publishEvent()` is invoked from every real connector's ingest loop and from `runIngestionAttempt()` for health changes |
| 2 | Preserve the already-accepted thin event contract | No changes to `SocialPostIngestedEvent` or `ConnectorHealthChangedEvent` shape or schema |
| 3 | Ensure no future connector is added without event wiring | New connectors that call `runIngestionAttempt()` and the standard ingest pattern publish events from day one |
| 4 | Protect ingestion availability from event-side failures | A Service Bus failure never rolls back or aborts a successful post insertion |
| 5 | Enable downstream real-time features | Downstream consumers receive real `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` messages |

---

**Positive consequences (from ADR):**
**Positive**
- Closes a real, honestly-self-documented gap (`ingestion-events/SKILL.md`'s own "Known gaps" already named it) rather than letting it persist as new connectors keep getting added without ever exercising the event-publishing path for real.
- `SocialPostIngestedEvent`'s already-Accepted shape needs no change — the gap was never the shape, it was that nothing ever ran real matching before publishing.
- `ConnectorHealthChangedEvent`'s placement inside `runIngestionAttempt()` means this ADR's own second half requires zero future per-connector wiring — a real, durable simplification for whoever builds the next connector.
- Reuses every piece of already-built, already-tested machinery (`resolveWatchlistAstDispatch`, `matchPostsForWatchlistAst`, `deriveConnectorHealth`, `publishEvent`, `build*Event`) — no new mechanism invented, only new callers of existing ones.

**Negative**
- **Real, new per-poll-cycle cost**: every successfully-inserted post now triggers a tenant-wide watchlist fetch plus AST evaluation against every platform-matching watchlist, for every connector's every poll cycle. Not measured against real tenant-scale watchlist counts; a real, named performance question if a tenant ever accumulates a very large number of active watchlists — not solved here.
- **A post matching many watchlists publishes many events** — intentional (Decision §1), but a real fan-out multiplier on Service Bus message volume that didn't exist before this ADR; not bounded or throttled.
- **`listActiveWatchlistsForTenant()` is a second, structurally similar but differently-scoped watchlist-listing function** living alongside the existing owner-scoped `listWatchlists()` — a real, if narrow, surface-area increase or a future contributor could reach for.
- **No subscriber consumes these events in production today** — this ADR makes real publishing happen, but doesn't change the fact that ADR-0019's own "Known gaps" already names no real coordinated-cutover subscriber existing yet (e.g. a future Brand Reputation & Alerts feature). Real events will flow into a topic with no real listener, until one is built — not a reason to defer, since the publish-side gap is what's being closed here, but named so it isn't mistaken for "and now alerts work."

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall publish one `SocialPostIngestedEvent` for each active watchlist that matches a newly ingested post | Must | Contract test proves a post matching two watchlists emits exactly two correctly-keyed events, and a post matching zero watchlists emits none | Product Owner |
| BR-002 | The system shall evaluate active watchlists once per connector poll batch, not once per post | Must | Code-path assertion confirms a single `listActiveWatchlistsForTenant()` call per batch regardless of post count | Technical Lead |
| BR-003 | The system shall fetch active watchlists in a tenant-wide, ingestion-context store function without an owning-user filter | Must | A test confirms a watchlist owned by user B is returned when called with no `userId` context | Product Owner |
| BR-004 | The system shall publish `SocialPostIngestedEvent` only after `insertSocialPost()` has resolved and the write is committed | Must | Contract test orders the database write before the `publishEvent()` call | Technical Lead |
| BR-005 | The system shall publish `ConnectorHealthChangedEvent` when derived connector health changes across an ingestion attempt | Must | Test drives a connector from `healthy` to `failing` and asserts exactly one event with correct `previousStatus` and `newStatus` | Product Owner |
| BR-006 | The system shall swallow and log `publishEvent()` failures without failing or rolling back ingestion | Must | Test injects a throwing publisher and confirms the post is still stored and the ingestion attempt does not fail | Technical Lead |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Downstream Subsystem Developer (Brand Reputation & Alerts) | Consumer of real events for watchlist hits and health changes | High | Events actually fire when posts and health change, with accurate `watchlistId` and status transitions |
| Platform Operator | Owns Service Bus throughput and connector observability | High | Message volume is predictable and health events are emitted without per-connector wiring |
| Tenant-Admin / Sole-Operator | End users of connector health and watchlist hit features | Medium | Watchlist matches and connector status changes are reflected reliably and without blocking ingestion |
| Connector Maintainer | Adds and maintains `SocialConnector` implementations | Medium | Clear, reusable pattern for event publishing that does not need re-invention per connector |
| Product/Technical Lead | Decision sponsor | High | The documented gap is closed with traceable acceptance criteria and minimal architectural debt |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.19 | epic-5-security-isolation-and-messaging.md | As platform operator whose Service Bus events are meant to drive downstream, real-time features (watchlist-hit notifications, connector-health alerting), I w... | A new `listActiveWatchlistsForTenant(tenantId): Promise<Watchlist[]>` store function (`watchlistStore.ts`) — tenant-wide (`app.tenant_id` RLS only, no owning... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- The existing `resolveWatchlistAstDispatch()` and `matchPostsForWatchlistAst()` functions correctly evaluate watchlist ASTs against an already-inserted post.
- `buildSocialPostIngestedEvent()` and `buildConnectorHealthChangedEvent()` are available and contract-verified.
- The live `social-listening-events` Service Bus topic and `publishEvent()` publisher are operational.
- Watchlists are deliberately per-user within a tenant; the new tenant-wide function is for ingestion-context matching only.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Event publishing must remain a best-effort, non-blocking side effect of ingestion | Reliability | Must | No `publishEvent()` call is `await`ed in a way that could abort the surrounding post-insert or ingestion attempt |
| NFR-002 | Watchlist fetching must be O(1) per poll batch | Performance | Must | Batch-scoped fetch is called once per poll cycle and passed through the per-post loop |
| NFR-003 | No new elevated database role or `BYPASSRLS` credential may be introduced | Security | Must | `listActiveWatchlistsForTenant()` is implemented using existing tenant-scoped read paths, verified by RLS contract tests |
| NFR-004 | Service Bus message throughput from multi-watchlist fan-out must be monitored during staging | Observability | Should | Staging run captures peak messages per batch and any broker throttling/rejection metrics |
| NFR-005 | The existing thin event shapes must not change | Maintainability | Must | `buildSocialPostIngestedEvent()` and `buildConnectorHealthChangedEvent()` signatures and outputs remain unchanged |

---

## 11. Error Handling and Exceptions
**Positive**
- Closes a real, honestly-self-documented gap (`ingestion-events/SKILL.md`'s own "Known gaps" already named it) rather than letting it persist as new connectors keep getting added without ever exercising the event-publishing path for real.
- `SocialPostIngestedEvent`'s already-Accepted shape needs no change — the gap was never the shape, it was that nothing ever ran real matching before publishing.
- `ConnectorHealthChangedEvent`'s placement inside `runIngestionAttempt()` means this ADR's own second half requires zero future per-connector wiring — a real, durable simplification for whoever builds the next connector.
- Reuses every piece of already-built, already-tested machinery (`resolveWatchlistAstDispatch`, `matchPostsForWatchlistAst`, `deriveConnectorHealth`, `publishEvent`, `build*Event`) — no new mechanism invented, only new callers of existing ones.

**Negative**
- **Real, new per-poll-cycle cost**: every successfully-inserted post now triggers a tenant-wide watchlist fetch plus AST evaluation against every platform-matching watchlist, for every connector's every poll cycle. Not measured against real tenant-scale watchlist counts; a real, named performance question if a tenant ever accumulates a very large number of active watchlists — not solved here.
- **A post matching many watchlists publishes many events** — intentional (Decision §1), but a real fan-out multiplier on Service Bus message volume that didn't exist before this ADR; not bounded or throttled.
- **`listActiveWatchlistsForTenant()` is a second, structurally similar but differently-scoped watchlist-listing function** living alongside the existing owner-scoped `listWatchlists()` — a real, if narrow, surface-area increase or a future contributor could reach for.
- **No subscriber consumes these events in production today** — this ADR makes real publishing happen, but doesn't change the fact that ADR-0019's own "Known gaps" already names no real coordinated-cutover subscriber existing yet (e.g. a future Brand Reputation & Alerts feature). Real events will flow into a topic with no real listener, until one is built — not a reason to defer, since the publish-side gap is what's being closed here, but named so it isn't mistaken for "and now alerts work."

---

## 12. Assumptions and Dependencies
- The existing `resolveWatchlistAstDispatch()` and `matchPostsForWatchlistAst()` functions correctly evaluate watchlist ASTs against an already-inserted post.
- `buildSocialPostIngestedEvent()` and `buildConnectorHealthChangedEvent()` are available and contract-verified.
- The live `social-listening-events` Service Bus topic and `publishEvent()` publisher are operational.
- Watchlists are deliberately per-user within a tenant; the new tenant-wide function is for ingestion-context matching only.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Watchlists are re-queried per post, creating an N+1 load per poll batch | Medium | High | Mandate one `listActiveWatchlistsForTenant()` call per batch and verify with a contract test | Technical Lead |
| R-002 | A popular post matching many watchlists generates a large fan-out of Service Bus messages | Medium | High | Monitor message throughput during staging validation; defer a throttle/batch design until real volume data exists | Product Owner |
| R-003 | A downstream subscriber reads a post before the insertion is committed | Medium | High | Publish only after `insertSocialPost()` resolves and any surrounding transaction has committed | Technical Lead |
| R-004 | The new tenant-wide watchlist function is misused in an Admin-UI context | Low | High | Use a clearly distinct function name and guard with RLS/contract tests that prove the two scopes cannot be confused | Product Owner |
| R-005 | No real subscriber exists yet, so events flow to a topic with no consumer | High | Low | Document this explicitly as an unchanged gap; it is the subscriber side that is not in scope here | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0058-wire-ingestion-events-into-real-connector-pipeline.md`
- BRD: `../Business-Requirements/BRD-0058-Wire-Ingestion-Events-Into-Real-Connector-Pipeline.md`
- Feature design: _No dedicated feature-design file found._
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above