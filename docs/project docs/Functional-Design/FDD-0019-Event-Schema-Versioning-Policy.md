# Business Requirements Document — Event Schema Versioning Policy

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — Event Schema Versioning Policy |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0019-event-schema-versioning-policy.md, ../Business-Requirements/BRD-0019-Event-Schema-Versioning-Policy.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0019-event-schema-versioning-policy.md and the business requirements in BRD-0019-Event-Schema-Versioning-Policy.md into functional design for **Event Schema Versioning Policy**.
SocialEngage publishes thin Service Bus events (`SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`) that are consumed by multiple independently deployable downstream subsystems, including Brand Reputation & Alerts, Social Care, and Social Selling. Today, no policy governs what happens when the shape of one of these event payloads needs to change after subscribers already exist. Without a versioning discipline, a seemingly small change—adding, renaming, or retyping a field—can silently break downstream consumers or force expensive, unplanned coordination across teams.

This initiative establishes a lightweight, event-specific versioning policy. Every event will carry a `schemaVersion` custom application property (the authoritative copy, inspectable by Service Bus itself), additive changes will not bump the version, and breaking changes will be managed through a short, coordinated cutover rather than an open-ended dual-publishing window. The policy is intentionally proportionate to the small size of these payloads and is accepted now so that the version signal can be attached from the first event published, avoiding a costly retrofit once real subscribers exist.

The expected business value is protected integration stability, lower operational risk for downstream teams, and a clear governance rule that keeps the event surface extensible without replicating the heavier versioning machinery of the public REST API.

---

### 2.2 Scope
**In scope:**
- Versioning policy for `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`.
- Setting `schemaVersion` as a Service Bus custom application property on every published event message.
- Rules for additive, backward-compatible changes (no `schemaVersion` bump).
- Rules for breaking changes (`schemaVersion` bump plus coordinated cutover).
- Optional mirroring of `schemaVersion` into the JSON payload for consumer convenience.
- Service Bus subscription filter support based on the `schemaVersion` application property.

**Out of scope:**
- Full public REST API versioning (covered by ADR-0017).
- Indefinite, long-lived dual publishing of multiple event versions.
- Consumer-side deserialization logic or payload parsing beyond the version signal.
- Implementation of a subscriber registry or automated cutover tooling (remains an open question to be revisited once a real subscriber exists).

## 3. Context and Background
ADR-0012 established that Service Bus events (`SocialPostIngestedEvent`, `ConnectorHealthChangedEvent`, §7) are deliberately thin — a handful of ID and status fields, with full data fetched via REST on demand. Multiple independently deployable downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling) will each subscribe and parse these payloads. Nothing in the spec says what happens when an event payload's shape needs to change after subscribers already exist — whether that's adding a field, changing one, or introducing genuinely new event types.
SocialEngage publishes thin Service Bus events (`SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`) that are consumed by multiple independently deployable downstream subsystems, including Brand Reputation & Alerts, Social Care, and Social Selling. Today, no policy governs what happens when the shape of one of these event payloads needs to change after subscribers already exist. Without a versioning discipline, a seemingly small change—adding, renaming, or retyping a field—can silently break downstream consumers or force expensive, unplanned coordination across teams.

This initiative establishes a lightweight, event-specific versioning policy. Every event will carry a `schemaVersion` custom application property (the authoritative copy, inspectable by Service Bus itself), additive changes will not bump the version, and breaking changes will be managed through a short, coordinated cutover rather than an open-ended dual-publishing window. The policy is intentionally proportionate to the small size of these payloads and is accepted now so that the version signal can be attached from the first event published, avoiding a costly retrofit once real subscribers exist.

The expected business value is protected integration stability, lower operational risk for downstream teams, and a clear governance rule that keeps the event surface extensible without replicating the heavier versioning machinery of the public REST API.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Protect downstream subsystems from unexpected event schema changes | 100% of published events carry a `schemaVersion` property; no breaking change is released without a version bump |
| 2 | Enable Service Bus-level filtering, routing, and rejection by version | Subscribers can write SQL subscription filters on `schemaVersion` and reject incompatible versions before deserializing the body |
| 3 | Keep event versioning proportionate to thin payloads | Versioning rules are limited to a single integer property and a coordinated cutover; no multi-version publishing infrastructure is built speculatively |
| 4 | Avoid a costly retrofit after the first real subscriber exists | `schemaVersion` is attached from the first event published in Phase 3 and is not introduced after subscribers are live |

---

**Positive consequences (from ADR):**
**Positive**
- Matches the proportionality of ADR-0012's original thin-events decision — a 7-field payload doesn't need the same versioning machinery as a full REST resource surface with dozens of fields and nested objects.
- Coordinated cutover (rather than long-lived dual-publishing) avoids building and maintaining a multi-version event-publishing system for what is, by design, a small and stable payload shape.
- `schemaVersion` as a message property, consistent with how `tenantId` already needs to work for ADR-0013 to function, lets Service Bus itself — filters, routing, observability tooling — act on version without any consumer deserializing the body, and lets a subscriber reject an incompatible version before paying the cost of parsing it.

**Negative**
- A coordinated cutover requires actually knowing who's subscribed and confirming they've upgraded before dropping the old shape — this needs a real subscriber registry or at minimum a manual coordination process, which doesn't exist yet since no downstream subsystem has been built.
- If the subscriber list grows large or includes external/third-party consumers later (not anticipated by this spec, which scopes downstream consumers to sibling subsystems within the same platform), "coordinate a cutover" stops being realistic and this policy would need to be revisited in favor of something closer to ADR-0017's approach.
- Using a message property as the authoritative version signal (rather than only a payload field) means publisher and consumer code must handle Service Bus message metadata explicitly, not just deserialize a JSON body — marginally more surface than a payload-only approach, though it's the same surface `tenantId` handling already requires.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall set `schemaVersion` as a Service Bus custom application property on every published `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`, starting at `1` | Must | Every event message has `schemaVersion=1` at first publication; value is readable by Service Bus filters | Backend Engineering |
| BR-002 | The system shall support adding new optional payload fields to an existing event type without changing `schemaVersion` | Must | A contract test confirms an optional field is added and `schemaVersion` remains unchanged | Backend Engineering |
| BR-003 | The system shall increment `schemaVersion` when an existing event type undergoes a breaking change (field removed, renamed, retyped, or meaning changed) | Must | A contract test confirms the version is incremented and the previous version is still emitted during cutover | Backend Engineering |
| BR-004 | The system shall publish both old and new `schemaVersion` messages in parallel during a coordinated cutover for breaking changes until all known subscribers confirm upgrade | Must | Cutover ends only after documented subscriber confirmation; no infinite dual-publish | Backend Engineering |
| BR-005 | The system may mirror `schemaVersion` into the JSON payload for consumer convenience, but the application property remains authoritative | Could | Payload `schemaVersion` matches the message property when present; consumers are documented to treat the message property as source of truth | Backend Engineering |
| BR-006 | The system shall allow subscribers to write Service Bus SQL filters on `schemaVersion` to include, exclude, or dead-letter specific versions | Must | A subscription rule filters by `schemaVersion` and receives only the intended version without body parsing | Backend Engineering |
| BR-007 | New event types shall be introduced as pure additions with their own initial `schemaVersion` and shall not affect the version of existing event types | Must | A new event type publishes at `schemaVersion=1` and does not change `SocialPostIngestedEvent` or `ConnectorHealthChangedEvent` versions | Backend Engineering |

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

Events version independently from, and more lightly than, the REST API (ADR-0017), because they're intentionally thin (a handful of fields, not full resource bodies, per ADR-0012). New event types are pure additions with no versioning question — only changes to an *existing* event type's shape need a policy. A version signal must be inspectable by Service Bus itself (routing, filters, observability), not only visible after a consumer deserializes the JSON body — this mirrors a constraint that already exists implicitly in ADR-0013: subscription SQL filters can only evaluate Service Bus message properties, not payload body content, so `tenantId` must already be set as a message property (in addition to appearing in the payload) for ADR-0013's per-tenant filtering to work as described at all. `schemaVersion` should follow the same pattern, for the same reason.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- `schemaVersion` (a number, starting at `1`) is set as a **Service Bus custom application property** on every event message — this is the authoritative copy, inspectable by filters and tooling without deserializing the body. It may optionally also be mirrored into the JSON payload for consumers that only look at the deserialized body, but the property is the source of truth.
- Additive, backward-compatible changes to an existing event type (new optional payload field) do **not** bump `schemaVersion` — subscribers ignoring unknown fields (the expected behavior) are unaffected.
- A breaking change to an existing event type's shape (removing/renaming a field, changing a field's type or meaning) bumps `schemaVersion` for that event type. The publisher emits both the old and new `schemaVersion` in parallel during a coordinated cutover — not an indefinite dual-publish window like ADR-0017's REST deprecation period — because the subscriber list here is small and known (internal downstream subsystems, not a public API), making a "confirm you've upgraded, then we stop publishing the old shape" cutover realistic in a way it isn't for a public REST API.
- Because `schemaVersion` is a message property, a subscriber can reject or dead-letter an incompatible version at the transport level, or even filter it out via its own SQL filter, without ever deserializing a payload shape it doesn't understand.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Downstream subsystem developers (Brand Reputation & Alerts, Social Care, Social Selling) | Consumers of Service Bus events | High | Stable contracts, clear version signal, ability to filter/reject incompatible events at the transport level |
| Platform / Backend Engineering | Publisher of events | High | Lightweight rule set, no speculative infrastructure, alignment with `tenantId` message property handling |
| Product Owner / Platform-Admin | Governance and roadmap | Medium | Low operational overhead, future-proofing for public API/webhook consumers |
| Tenant-Admin / Tenant-User | Indirect beneficiaries of reliable integrations | Low–Medium | Trust that webhooks and integrations continue to work as the platform evolves |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.5 | epic-5-security-isolation-and-messaging.md | As downstream subsystem consuming ingestion events long-term, I want every event to carry a `schemaVersion` as a Service Bus application property (not only i... | Every published event carries a `schemaVersion` Service Bus application property, starting at `1`.; Adding a new optional payload field to an existing event ... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `schemaVersion` (integer) | Version of the event payload shape, set as a Service Bus custom application property on every message | Event publisher | Platform Engineering | Operational metadata; no personal data |
| `schemaVersion` payload mirror (optional integer) | Same value optionally embedded in the JSON body for consumer convenience | Event publisher | Platform Engineering | Operational metadata; no personal data |
| `SocialPostIngestedEvent` payload | Minimal event body (tenant, post, platform, watchlist identifiers plus sentiment and timestamps, per ADR-0012) | Ingestion pipeline | Platform Engineering | Mixed; includes tenant and post identifiers |
| `ConnectorHealthChangedEvent` payload | Minimal status-transition body (previous/new status, tenant, platform, occurredAt, per ADR-0012) | Connector health service | Platform Engineering | Mixed; includes tenant and connector identifiers |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Every published event message shall carry a `schemaVersion` Service Bus custom application property. |
| BRU-002 | `schemaVersion` is a positive integer starting at `1` and increments by `1` for each breaking change to the same event type. |
| BRU-003 | Additive, backward-compatible changes (new optional payload fields) do not change `schemaVersion`. |
| BRU-004 | New event types are introduced with their own initial `schemaVersion` of `1` and do not affect the version of any other event type. |
| BRU-005 | A breaking change requires a coordinated cutover: the publisher emits both old and new `schemaVersion` messages in parallel until all known subscribers confirm they have upgraded, then the old version is dropped. |
| BRU-006 | Subscribers may filter, reject, or dead-letter incompatible `schemaVersion` values at the Service Bus transport level, without deserializing the message body. |
| BRU-007 | The `schemaVersion` custom application property is authoritative; any `schemaVersion` value mirrored in the JSON payload is advisory only. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0012 thin events design | Design input / already accepted | Platform Engineering | Resolved |
| D-002 | ADR-0013 per-tenant message property filtering | Design input / already accepted | Platform Engineering | Resolved |
| D-003 | ADR-0017 REST API versioning | Related discipline (not to be conflated) | API Team | Resolved |
| D-004 | First real subscriber (likely Brand Reputation & Alerts) | Needed to validate coordinated cutover realism | Product Owner | Revisit when subscriber exists |
| D-005 | Story 5.5 implementation (Epic 5, Phase 3) | Scheduled engineering work | Engineering | Phase 3 |

---

- Service Bus events remain thin, carrying only the minimal fields defined in ADR-0012.
- Downstream consumers are initially internal sibling subsystems with a small, known subscriber list.
- Additive changes add only optional fields that existing subscribers can safely ignore.

**The durable decision — this is what would need superseding, not just amending:**

Events version independently from, and more lightly than, the REST API (ADR-0017), because they're intentionally thin (a handful of fields, not full resource bodies, per ADR-0012). New event types are pure additions with no versioning question — only changes to an *existing* event type's shape need a policy. A version signal must be inspectable by Service Bus itself (routing, filters, observability), not only visible after a consumer deserializes the JSON body — this mirrors a constraint that already exists implicitly in ADR-0013: subscription SQL filters can only evaluate Service Bus message properties, not payload body content, so `tenantId` must already be set as a message property (in addition to appearing in the payload) for ADR-0013's per-tenant filtering to work as described at all. `schemaVersion` should follow the same pattern, for the same reason.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- `schemaVersion` (a number, starting at `1`) is set as a **Service Bus custom application property** on every event message — this is the authoritative copy, inspectable by filters and tooling without deserializing the body. It may optionally also be mirrored into the JSON payload for consumers that only look at the deserialized body, but the property is the source of truth.
- Additive, backward-compatible changes to an existing event type (new optional payload field) do **not** bump `schemaVersion` — subscribers ignoring unknown fields (the expected behavior) are unaffected.
- A breaking change to an existing event type's shape (removing/renaming a field, changing a field's type or meaning) bumps `schemaVersion` for that event type. The publisher emits both the old and new `schemaVersion` in parallel during a coordinated cutover — not an indefinite dual-publish window like ADR-0017's REST deprecation period — because the subscriber list here is small and known (internal downstream subsystems, not a public API), making a "confirm you've upgraded, then we stop publishing the old shape" cutover realistic in a way it isn't for a public REST API.
- Because `schemaVersion` is a message property, a subscriber can reject or dead-letter an incompatible version at the transport level, or even filter it out via its own SQL filter, without ever deserializing a payload shape it doesn't understand.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `schemaVersion` must be inspectable by Service Bus itself (filters, routing, observability) | Reliability / Maintainability | Must | Service Bus SQL filter on `schemaVersion` is demonstrated in a contract test |
| NFR-002 | Event versioning must remain proportionate to thin payloads and not replicate REST API versioning overhead | Maintainability | Must | No additional versioning infrastructure beyond a single integer message property and cutover rule is required |
| NFR-003 | Publisher and consumer code must explicitly handle Service Bus message metadata for `schemaVersion` as well as for `tenantId` | Maintainability | Should | Code review or contract test confirms both properties are read from message metadata, not assumed to be payload-only |
| NFR-004 | The policy must support future public API/webhook consumers without redesign while the subscriber list remains small and internal | Scalability | Could | Public v1 event list (`SocialPostIngestedEvent`, `ConnectorHealthChangedEvent`) can adopt the same `schemaVersion` pattern |
| NFR-005 | No unversioned event is published after the policy is in effect | Compliance | Must | All event publishing paths set the `schemaVersion` property; any missing version causes a failed contract test |

---

## 11. Error Handling and Exceptions
**Positive**
- Matches the proportionality of ADR-0012's original thin-events decision — a 7-field payload doesn't need the same versioning machinery as a full REST resource surface with dozens of fields and nested objects.
- Coordinated cutover (rather than long-lived dual-publishing) avoids building and maintaining a multi-version event-publishing system for what is, by design, a small and stable payload shape.
- `schemaVersion` as a message property, consistent with how `tenantId` already needs to work for ADR-0013 to function, lets Service Bus itself — filters, routing, observability tooling — act on version without any consumer deserializing the body, and lets a subscriber reject an incompatible version before paying the cost of parsing it.

**Negative**
- A coordinated cutover requires actually knowing who's subscribed and confirming they've upgraded before dropping the old shape — this needs a real subscriber registry or at minimum a manual coordination process, which doesn't exist yet since no downstream subsystem has been built.
- If the subscriber list grows large or includes external/third-party consumers later (not anticipated by this spec, which scopes downstream consumers to sibling subsystems within the same platform), "coordinate a cutover" stops being realistic and this policy would need to be revisited in favor of something closer to ADR-0017's approach.
- Using a message property as the authoritative version signal (rather than only a payload field) means publisher and consumer code must handle Service Bus message metadata explicitly, not just deserialize a JSON body — marginally more surface than a payload-only approach, though it's the same surface `tenantId` handling already requires.

## 12. Assumptions and Dependencies
- Service Bus events remain thin, carrying only the minimal fields defined in ADR-0012.
- Downstream consumers are initially internal sibling subsystems with a small, known subscriber list.
- Additive changes add only optional fields that existing subscribers can safely ignore.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Coordinated cutover process is not yet defined; the old version could be dropped before all subscribers upgrade | Medium | High | Do not execute a breaking change until a subscriber registry or confirmation process exists; revisit once the first real subscriber (likely Brand Reputation & Alerts) is live | Platform Architect |
| R-002 | Subscriber list grows to include external or third-party consumers, making a coordinated cutover unrealistic | Low | High | Trigger a policy review and move toward a deprecation/dual-publish model closer to ADR-0017 if that happens | Product Owner |
| R-003 | Publisher and consumer code must handle Service Bus message metadata explicitly, slightly increasing implementation surface | Medium | Low | Reuse the existing `tenantId` message property handling pattern and document the contract in the integration guide | Backend Lead |

---

## 14. Appendix
- ADR: `../../adr/0019-event-schema-versioning-policy.md`
- BRD: `../Business-Requirements/BRD-0019-Event-Schema-Versioning-Policy.md`
- Feature design: `docs/product-research/feature-designs/11-api-and-integrations.md`
- Deep research: `docs/product-research/reports/`;`
- User stories: see extracted stories above