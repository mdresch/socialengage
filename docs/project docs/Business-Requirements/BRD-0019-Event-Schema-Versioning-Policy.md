# Business Requirements Document — Event Schema Versioning Policy

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Event Schema Versioning Policy (ADR-0019) – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent, Product Architecture |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | BRD Writer Agent | Initial draft from ADR-0019, feature design 11, and Epic 5 story 5.5 |
| 1.0 | 2026-08-19 | Menno | Approved with ADR-0019 acceptance |

---

## 2. Executive Summary

SocialEngage publishes thin Service Bus events (`SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`) that are consumed by multiple independently deployable downstream subsystems, including Brand Reputation & Alerts, Social Care, and Social Selling. Today, no policy governs what happens when the shape of one of these event payloads needs to change after subscribers already exist. Without a versioning discipline, a seemingly small change—adding, renaming, or retyping a field—can silently break downstream consumers or force expensive, unplanned coordination across teams.

This initiative establishes a lightweight, event-specific versioning policy. Every event will carry a `schemaVersion` custom application property (the authoritative copy, inspectable by Service Bus itself), additive changes will not bump the version, and breaking changes will be managed through a short, coordinated cutover rather than an open-ended dual-publishing window. The policy is intentionally proportionate to the small size of these payloads and is accepted now so that the version signal can be attached from the first event published, avoiding a costly retrofit once real subscribers exist.

The expected business value is protected integration stability, lower operational risk for downstream teams, and a clear governance rule that keeps the event surface extensible without replicating the heavier versioning machinery of the public REST API.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Protect downstream subsystems from unexpected event schema changes | 100% of published events carry a `schemaVersion` property; no breaking change is released without a version bump |
| 2 | Enable Service Bus-level filtering, routing, and rejection by version | Subscribers can write SQL subscription filters on `schemaVersion` and reject incompatible versions before deserializing the body |
| 3 | Keep event versioning proportionate to thin payloads | Versioning rules are limited to a single integer property and a coordinated cutover; no multi-version publishing infrastructure is built speculatively |
| 4 | Avoid a costly retrofit after the first real subscriber exists | `schemaVersion` is attached from the first event published in Phase 3 and is not introduced after subscribers are live |

---

## 4. Scope

### 4.1 In Scope

- Versioning policy for `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`.
- Setting `schemaVersion` as a Service Bus custom application property on every published event message.
- Rules for additive, backward-compatible changes (no `schemaVersion` bump).
- Rules for breaking changes (`schemaVersion` bump plus coordinated cutover).
- Optional mirroring of `schemaVersion` into the JSON payload for consumer convenience.
- Service Bus subscription filter support based on the `schemaVersion` application property.

### 4.2 Out of Scope

- Full public REST API versioning (covered by ADR-0017).
- Indefinite, long-lived dual publishing of multiple event versions.
- Consumer-side deserialization logic or payload parsing beyond the version signal.
- Implementation of a subscriber registry or automated cutover tooling (remains an open question to be revisited once a real subscriber exists).

### 4.3 Assumptions

- Service Bus events remain thin, carrying only the minimal fields defined in ADR-0012.
- Downstream consumers are initially internal sibling subsystems with a small, known subscriber list.
- Additive changes add only optional fields that existing subscribers can safely ignore.

### 4.4 Constraints

- Service Bus SQL subscription filters can evaluate only message properties, not payload body content; therefore `schemaVersion` must be a message property, just as `tenantId` already is for ADR-0013.
- The policy must not duplicate or conflict with the REST API versioning strategy defined in ADR-0017.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Downstream subsystem developers (Brand Reputation & Alerts, Social Care, Social Selling) | Consumers of Service Bus events | High | Stable contracts, clear version signal, ability to filter/reject incompatible events at the transport level |
| Platform / Backend Engineering | Publisher of events | High | Lightweight rule set, no speculative infrastructure, alignment with `tenantId` message property handling |
| Product Owner / Platform-Admin | Governance and roadmap | Medium | Low operational overhead, future-proofing for public API/webhook consumers |
| Tenant-Admin / Tenant-User | Indirect beneficiaries of reliable integrations | Low–Medium | Trust that webhooks and integrations continue to work as the platform evolves |

---

## 6. Current State (As-Is)

**Current process:**

1. The platform emits thin `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` messages to Azure Service Bus, per ADR-0012.
2. Downstream subsystems are planned but not yet live; none have a documented contract for how to handle payload shape changes.
3. No `schemaVersion` field exists on event messages today.
4. Any future change to an event payload—whether additive or breaking—would require ad hoc coordination with every consumer.

**Pain points:**

- No explicit rule for when a change is safe or when it requires a version bump.
- No transport-level signal that Service Bus can use for filtering, routing, or observability.
- If versioning is added after real subscribers exist, every historical event contract must be reconciled retroactively.

---

## 7. Future State (To-Be)

**New or improved process:**

1. Every event message published to Service Bus carries a `schemaVersion` custom application property, starting at `1`.
2. Adding a new optional field to an existing event type does not change `schemaVersion`; subscribers are expected to ignore unknown fields.
3. A breaking change—removing, renaming, retyping, or changing the meaning of a field—increments `schemaVersion` by `1` for that event type.
4. For breaking changes, the publisher emits both the old and new `schemaVersion` in parallel during a short, coordinated cutover. The old version is dropped only after all known subscribers confirm they have upgraded.
5. Subscribers can include, exclude, or dead-letter messages using Service Bus SQL filters on the `schemaVersion` application property, without paying the cost of deserializing an incompatible payload.

**Expected capabilities:**

- Version-aware event publishing from the first event emitted.
- Backward-compatible evolution of thin events without forced consumer redeployment.
- Transport-level version filtering that mirrors the existing `tenantId` filtering model.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall set `schemaVersion` as a Service Bus custom application property on every published `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`, starting at `1` | Must | Every event message has `schemaVersion=1` at first publication; value is readable by Service Bus filters | Backend Engineering |
| BR-002 | The system shall support adding new optional payload fields to an existing event type without changing `schemaVersion` | Must | A contract test confirms an optional field is added and `schemaVersion` remains unchanged | Backend Engineering |
| BR-003 | The system shall increment `schemaVersion` when an existing event type undergoes a breaking change (field removed, renamed, retyped, or meaning changed) | Must | A contract test confirms the version is incremented and the previous version is still emitted during cutover | Backend Engineering |
| BR-004 | The system shall publish both old and new `schemaVersion` messages in parallel during a coordinated cutover for breaking changes until all known subscribers confirm upgrade | Must | Cutover ends only after documented subscriber confirmation; no infinite dual-publish | Backend Engineering |
| BR-005 | The system may mirror `schemaVersion` into the JSON payload for consumer convenience, but the application property remains authoritative | Could | Payload `schemaVersion` matches the message property when present; consumers are documented to treat the message property as source of truth | Backend Engineering |
| BR-006 | The system shall allow subscribers to write Service Bus SQL filters on `schemaVersion` to include, exclude, or dead-letter specific versions | Must | A subscription rule filters by `schemaVersion` and receives only the intended version without body parsing | Backend Engineering |
| BR-007 | New event types shall be introduced as pure additions with their own initial `schemaVersion` and shall not affect the version of existing event types | Must | A new event type publishes at `schemaVersion=1` and does not change `SocialPostIngestedEvent` or `ConnectorHealthChangedEvent` versions | Backend Engineering |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `schemaVersion` must be inspectable by Service Bus itself (filters, routing, observability) | Reliability / Maintainability | Must | Service Bus SQL filter on `schemaVersion` is demonstrated in a contract test |
| NFR-002 | Event versioning must remain proportionate to thin payloads and not replicate REST API versioning overhead | Maintainability | Must | No additional versioning infrastructure beyond a single integer message property and cutover rule is required |
| NFR-003 | Publisher and consumer code must explicitly handle Service Bus message metadata for `schemaVersion` as well as for `tenantId` | Maintainability | Should | Code review or contract test confirms both properties are read from message metadata, not assumed to be payload-only |
| NFR-004 | The policy must support future public API/webhook consumers without redesign while the subscriber list remains small and internal | Scalability | Could | Public v1 event list (`SocialPostIngestedEvent`, `ConnectorHealthChangedEvent`) can adopt the same `schemaVersion` pattern |
| NFR-005 | No unversioned event is published after the policy is in effect | Compliance | Must | All event publishing paths set the `schemaVersion` property; any missing version causes a failed contract test |

---

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `schemaVersion` (integer) | Version of the event payload shape, set as a Service Bus custom application property on every message | Event publisher | Platform Engineering | Operational metadata; no personal data |
| `schemaVersion` payload mirror (optional integer) | Same value optionally embedded in the JSON body for consumer convenience | Event publisher | Platform Engineering | Operational metadata; no personal data |
| `SocialPostIngestedEvent` payload | Minimal event body (tenant, post, platform, watchlist identifiers plus sentiment and timestamps, per ADR-0012) | Ingestion pipeline | Platform Engineering | Mixed; includes tenant and post identifiers |
| `ConnectorHealthChangedEvent` payload | Minimal status-transition body (previous/new status, tenant, platform, occurredAt, per ADR-0012) | Connector health service | Platform Engineering | Mixed; includes tenant and connector identifiers |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Published event count by `schemaVersion` and event type | Track cutover progress and verify both old and new versions are emitted | Platform Operations | Per cutover / continuous |
| Subscriber lag by `schemaVersion` | Identify downstream consumers still receiving an old version | Backend Engineering | Per cutover |
| Dead-lettered events due to incompatible `schemaVersion` | Monitor operational health and detect mismatched consumer expectations | Platform Operations | Real-time / alert-driven |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Coordinated cutover process is not yet defined; the old version could be dropped before all subscribers upgrade | Medium | High | Do not execute a breaking change until a subscriber registry or confirmation process exists; revisit once the first real subscriber (likely Brand Reputation & Alerts) is live | Platform Architect |
| R-002 | Subscriber list grows to include external or third-party consumers, making a coordinated cutover unrealistic | Low | High | Trigger a policy review and move toward a deprecation/dual-publish model closer to ADR-0017 if that happens | Product Owner |
| R-003 | Publisher and consumer code must handle Service Bus message metadata explicitly, slightly increasing implementation surface | Medium | Low | Reuse the existing `tenantId` message property handling pattern and document the contract in the integration guide | Backend Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0012 thin events design | Design input / already accepted | Platform Engineering | Resolved |
| D-002 | ADR-0013 per-tenant message property filtering | Design input / already accepted | Platform Engineering | Resolved |
| D-003 | ADR-0017 REST API versioning | Related discipline (not to be conflated) | API Team | Resolved |
| D-004 | First real subscriber (likely Brand Reputation & Alerts) | Needed to validate coordinated cutover realism | Product Owner | Revisit when subscriber exists |
| D-005 | Story 5.5 implementation (Epic 5, Phase 3) | Scheduled engineering work | Engineering | Phase 3 |

---

## 14. Acceptance Criteria

- Every published event carries a `schemaVersion` Service Bus application property, starting at `1`.
- Adding a new optional payload field to an existing event type does not change `schemaVersion`.
- A breaking change to an existing event type's shape increments `schemaVersion`, and the publisher emits both the old and new version in parallel until all known subscribers confirm they have upgraded.
- A subscriber can filter or reject messages by `schemaVersion` using a Service Bus subscription rule, without deserializing the message body.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Additive change | A change that adds a new optional field to an event payload without affecting existing fields; backward compatible. |
| Breaking change | A change that removes, renames, retypes, or changes the meaning of an existing field in an event payload. |
| Coordinated cutover | A short, bounded period during which both the old and new `schemaVersion` of an event type are published, ending when all known subscribers confirm they have upgraded. |
| Custom application property | A name-value pair set on an Azure Service Bus message by the publisher, inspectable by SQL subscription filters. |
| `schemaVersion` | The integer property that represents the shape version of a specific event type. |
| Service Bus | The Azure messaging service used to publish events to downstream subsystems. |
| Thin event | An event that carries only the minimal fields needed to decide whether to act, with full resource data fetched via REST on demand (per ADR-0012). |

---

## 16. Appendices

- [ADR-0019: Event schema versioning policy](../../../docs/adr/0019-event-schema-versioning-policy.md)
- [Feature design 11: API and integrations](../../../docs/product-research/feature-designs/11-api-and-integrations.md)
- [Epic 5, Story 5.5 — Event schema versioning via Service Bus message property](../../../docs/user-stories/epic-5-security-isolation-and-messaging.md)
- Deep-research brief for this feature: *Not found in `docs/product-research/reports/`; explicitly noted as missing source.*
- Related ADRs: ADR-0012 (thin events), ADR-0013 (per-tenant filtering), ADR-0017 (REST API versioning)

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Other Stakeholder | Platform Architect | | |
