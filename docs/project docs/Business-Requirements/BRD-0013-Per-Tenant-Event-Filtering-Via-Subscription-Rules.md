# BRD-0013: Per-Tenant Event Filtering via Service Bus Subscription Rules

## Document Control

| Field | Value |
|---|---|
| **BRD ID** | BRD-0013 |
| **ADR Reference** | [ADR-0013: Per-tenant event filtering via Service Bus subscription SQL filters](../../0013-per-tenant-event-filtering-via-subscription-rules.md) |
| **Status** | Draft |
| **Author** | BRD Writer Agent |
| **Date** | 2026-07-28 |
| **Version** | 1.0 |
| **Source Spec** | [Design Spec §7 — Service Bus Event Schema](../../2026-07-28-social-listening-ingestion-design.md#7-service-bus-event-schema) |

---

## 1. Executive Summary

The `social-listening-core` subsystem publishes `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` events to an Azure Service Bus topic so that downstream products (e.g., Brand Reputation & Alerts, Social Care, Social Selling) can react in real time. Each downstream product serves only a subset of tenants — not every tenant on the platform. BRD-0013 captures the business requirement that event traffic must be filtered **per tenant** **before** it reaches a subscriber, so that a downstream subsystem receives only the events for tenants it is entitled to serve.

The chosen approach is to enforce this boundary at the messaging layer through **Azure Service Bus subscription SQL filters on `tenantId`**. This prevents client-side filtering mistakes, reduces the risk of cross-tenant data exposure, and keeps downstream subscriber code simple.

---

## 2. Business Background and Problem Statement

### 2.1 Context

- `social-listening-core` is a multi-tenant ingestion and enrichment platform.  
- Events are deliberately thin — they carry IDs and minimal decision fields; full payloads are retrieved on demand via the REST API.  
- Events include `tenantId` so that routing and authorization decisions can be made.  
- Downstream subsystems are independently deployed products that each serve a subset of tenants.  

### 2.2 Problem

If every subscriber receives the full event stream for every tenant, each downstream subsystem must implement, test, and maintain its own tenant-scope filter. This creates:

1. **Data-exposure risk** — a bug or misconfiguration in any subscriber can cause one tenant's data to be processed by a subsystem that does not serve that tenant.  
2. **Operational complexity** — every new subsystem repeats the same filtering logic.  
3. **Scalability friction** — adding a new subsystem that serves a different tenant subset requires changes in the publishing code or in the subscriber.  

---

## 3. Business Objectives

| # | Objective | Success Indicator |
|---|---|---|
| BO-1 | Guarantee that a downstream subsystem only receives events for tenants it serves | No event for an unentitled tenant is delivered to a subscriber in normal operation |
| BO-2 | Reduce the risk of cross-tenant data leakage | Filtering is enforced by the messaging platform, not only by application code |
| BO-3 | Simplify downstream subscriber implementations | Subscribers do not need to implement tenant-scope filtering to avoid leakage |
| BO-4 | Support independent tenant onboarding/offboarding for each downstream product | Adding or removing a tenant from a product does not require changes to the publisher code |
| BO-5 | Remain operationally scalable as the tenant and subsystem counts grow | New subscriptions and filters can be added without redesigning the topic |

---

## 4. Scope

### 4.1 In Scope

- `SocialPostIngestedEvent` routing for `tenantId` filtering.  
- `ConnectorHealthChangedEvent` routing for `tenantId` filtering.  
- Azure Service Bus topic/subscription configuration.  
- SQL filter rules on the `tenantId` message property.  
- Mechanism to keep tenant entitlement lists in sync with subscription filters.  

### 4.2 Out of Scope

- Payload-level filtering (events remain thin).  
- Authorization or authentication of downstream subscribers (handled by other ADRs).  
- Database tenant isolation (see ADR-0015).  
- Dead-letter and retry policy (see ADR-0010).  

---

## 5. Stakeholders

| Stakeholder | Role | Interest |
|---|---|---|
| Product / Tenant Owners | Define which tenants each downstream product serves | Correct, auditable routing |
| Architecture Team | Owns messaging topology and tenant isolation strategy | Secure, scalable design |
| Downstream Engineering Teams | Consume events to build products such as Brand Reputation | Simple integration contract |
| Platform Operations | Manage Azure Service Bus subscriptions and rules | Operational tooling and monitoring |
| Security / Compliance | Review cross-tenant exposure controls | Evidence of boundary enforcement |

---

## 6. Functional Business Requirements

### 6.1 Event Publishing

| ID | Requirement |
|---|---|
| FBR-1 | `social-listening-core` must publish `SocialPostIngestedEvent` events to an Azure Service Bus topic for every ingested post. |
| FBR-2 | `social-listening-core` must publish `ConnectorHealthChangedEvent` events to the same Azure Service Bus topic when connector health changes. |
| FBR-3 | Each published event must include the `tenantId` as an Azure Service Bus application property, distinct from the JSON payload body. |

### 6.2 Subscription Filtering

| ID | Requirement |
|---|---|
| FBR-4 | Each downstream subsystem must have a dedicated Service Bus subscription. |
| FBR-5 | Each subscription must include a SQL filter rule that evaluates `tenantId` and accepts only events for tenants the subsystem serves. |
| FBR-6 | A tenant may be served by multiple downstream subsystems; each such subsystem must have its own independent filter rule. |
| FBR-7 | A downstream subsystem may serve multiple tenants; a single subscription may include a filter rule covering all entitled tenants (e.g., `tenantId IN ('t1', 't2', ...)`). |

### 6.3 Subscription-Filter Lifecycle

| ID | Requirement |
|---|---|
| FBR-8 | When a tenant becomes entitled to a downstream subsystem, the corresponding subscription filter must be updated to include that `tenantId`. |
| FBR-9 | When a tenant is removed from a downstream subsystem, the corresponding subscription filter must be updated to exclude that `tenantId`. |
| FBR-10 | Filter changes must be auditable and reversible. |

### 6.4 Filtering Guarantees

| ID | Requirement |
|---|---|
| FBR-11 | The messaging layer must never deliver an event for an unentitled `tenantId` to a downstream subscription in normal operation. |
| FBR-12 | Subscription filters must be evaluated before the event reaches subscriber client code. |

---

## 7. Non-Functional Business Requirements

| ID | Requirement | Criterion |
|---|---|---|
| NFR-1 | **Security** | Tenant isolation is enforced at the messaging layer, not solely by subscribers. |
| NFR-2 | **Reliability** | Filter misconfiguration or drift must be detectable through monitoring and change tracking. |
| NFR-3 | **Scalability** | The design must support growth in tenant count and downstream subsystem count without redesigning the topic topology. |
| NFR-4 | **Maintainability** | Tenant entitlement changes for a downstream subsystem must not require a deployment of `social-listening-core`. |
| NFR-5 | **Observability** | Subscription and rule configuration must be queryable and auditable. |

---

## 8. Business Rules

1. **BR-001 — Tenant-boundary rule:** A downstream subsystem may only process data for tenants explicitly assigned to it.  
2. **BR-002 — Filter-authority rule:** Service Bus SQL filters, not subscriber code, are the authoritative boundary for event routing.  
3. **BR-003 — Property rule:** `tenantId` must be emitted as a Service Bus application property; it cannot be filtered from the JSON payload alone.  
4. **BR-004 — Lifecycle rule:** Changes in a downstream product's tenant list must be reflected in its subscription filter.  
5. **BR-005 — Shared-tenant rule:** A tenant may appear in multiple subscription filters; each such filter is owned by the corresponding downstream subsystem.  

---

## 9. Use Cases

### UC-1 — New tenant enables a downstream product

| | |
|---|---|
| **Actor** | Product / Tenant Owner |
| **Trigger** | A tenant signs up for or is provisioned into a downstream subsystem. |
| **Outcome** | The downstream subsystem's Service Bus subscription SQL filter is updated to include the new `tenantId`, so it begins receiving the tenant's events. |

### UC-2 — Tenant leaves a downstream product

| | |
|---|---|
| **Actor** | Product / Tenant Owner |
| **Trigger** | A tenant disables or is de-provisioned from a downstream subsystem. |
| **Outcome** | The corresponding subscription filter is updated to remove the `tenantId`; no further events for that tenant are delivered to that subsystem. |

### UC-3 — New downstream subsystem is launched

| | |
|---|---|
| **Actor** | Downstream Engineering Team |
| **Trigger** | A new product needs to consume `social-listening-core` events. |
| **Outcome** | A new Service Bus subscription is created with a SQL filter over the set of tenants the product serves; `social-listening-core` requires no code change. |

---

## 10. Assumptions and Constraints

### 10.1 Assumptions

- Azure Service Bus SQL filters are the chosen messaging mechanism (per ADR-0013).  
- `tenantId` values are stable, non-null, and unique within the platform.  
- Downstream subsystems already know which tenants they serve via their own provisioning/entitlement store.  
- The operations team has the authority and tooling to manage Service Bus rules.  

### 10.2 Constraints

- Service Bus subscription rules have practical limits on count and complexity per topic; monitor as the tenant and subsystem count grows (per ADR-0013).  
- SQL filters can only evaluate message properties, not the message body.  
- This BRD does not define the automation mechanism for rule updates; that is left to implementation.  

---

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Subscription filter drift vs. actual tenant entitlements | High — incorrect data exposure or missing data | Automate filter synchronization from the authoritative entitlement store and audit rule changes |
| Approaching Service Bus rule count or complexity limits | Medium — filtering stops working or new tenants cannot be added | Monitor rule usage, set alerts before limits, and plan topic splitting if scale demands it |
| `tenantId` omitted or incorrectly set on events | High — filters fail or leak data | Validate `tenantId` is present as an application property in the publisher and in CI contract tests |
| Manual, opaque filter changes | Medium — human error, no rollback | Treat rules as code/configuration, version changes, and enforce change approval |

---

## 12. Dependencies

| Dependency | Reference |
|---|---|
| Event schema and publisher design | Design Spec §7, ADR-0012 (thin events) |
| `tenantId` emitted as application property | ADR-0013 Clarification (2026-07-28) |
| Database tenant isolation | ADR-0015 |
| Messaging dead-letter / retry policy | ADR-0010 |

---

## 13. Acceptance Criteria

1. `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` events are published with `tenantId` as a Service Bus application property.  
2. Each downstream subsystem has a dedicated Service Bus subscription with a SQL filter on `tenantId`.  
3. For every entitlement combination tested, events for an entitled tenant are delivered to the downstream subscription; events for an unentitled tenant are not delivered.  
4. A documented process exists to add or remove a tenant from a downstream subsystem's filter without a `social-listening-core` deployment.  
5. A monitoring or audit mechanism exists to detect filter drift.  

---

## 14. Traceability

| Business Requirement | ADR Reference | Spec Reference |
|---|---|---|
| FBR-1, FBR-2, FBR-3 | ADR-0013 Clarification | Design Spec §7 |
| FBR-4 — FBR-12 | ADR-0013 Decision | Design Spec §7 |
| BO-1 — BO-5, NFR-1 — NFR-5 | ADR-0013 Consequences | Design Spec §7, §8 |

---

## 15. Approval

| Role | Name | Signature / Date |
|---|---|---|
| Product Owner | | |
| Architect | | |
| Security / Compliance | | |
| Downstream Engineering Lead | | |

---

*End of Document*
