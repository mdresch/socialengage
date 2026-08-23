# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0013 Per-Tenant Event Filtering via Service Bus Subscription Rules — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0013-per-tenant-event-filtering-via-subscription-rules.md, ../Business-Requirements/BRD-0013-Per-Tenant-Event-Filtering-Via-Subscription-Rules.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0013-per-tenant-event-filtering-via-subscription-rules.md and the business requirements in BRD-0013-Per-Tenant-Event-Filtering-Via-Subscription-Rules.md into functional design for **Per Tenant Event Filtering Via Subscription Rules**.
The `social-listening-core` subsystem publishes `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` events to an Azure Service Bus topic so that downstream products (e.g., Brand Reputation & Alerts, Social Care, Social Selling) can react in real time. Each downstream product serves only a subset of tenants — not every tenant on the platform. BRD-0013 captures the business requirement that event traffic must be filtered **per tenant** **before** it reaches a subscriber, so that a downstream subsystem receives only the events for tenants it is entitled to serve.

The chosen approach is to enforce this boundary at the messaging layer through **Azure Service Bus subscription SQL filters on `tenantId`**. This prevents client-side filtering mistakes, reduces the risk of cross-tenant data exposure, and keeps downstream subscriber code simple.

---

### 2.2 Scope
**In scope:**
- `SocialPostIngestedEvent` routing for `tenantId` filtering.  
- `ConnectorHealthChangedEvent` routing for `tenantId` filtering.  
- Azure Service Bus topic/subscription configuration.  
- SQL filter rules on the `tenantId` message property.  
- Mechanism to keep tenant entitlement lists in sync with subscription filters.

**Out of scope:**
- Payload-level filtering (events remain thin).  
- Authorization or authentication of downstream subscribers (handled by other ADRs).  
- Database tenant isolation (see ADR-0015).  
- Dead-letter and retry policy (see ADR-0010).  

---

## 3. Context and Background
Downstream subsystems typically serve a subset of tenants, not all of them (e.g., only tenants who've enabled Brand Reputation & Alerts). Every `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` carries `tenantId`, and events must reach only the subscribers entitled to that tenant's data — never all subscribers regardless of which tenants they serve.
The `social-listening-core` subsystem publishes `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` events to an Azure Service Bus topic so that downstream products (e.g., Brand Reputation & Alerts, Social Care, Social Selling) can react in real time. Each downstream product serves only a subset of tenants — not every tenant on the platform. BRD-0013 captures the business requirement that event traffic must be filtered **per tenant** **before** it reaches a subscriber, so that a downstream subsystem receives only the events for tenants it is entitled to serve.

The chosen approach is to enforce this boundary at the messaging layer through **Azure Service Bus subscription SQL filters on `tenantId`**. This prevents client-side filtering mistakes, reduces the risk of cross-tenant data exposure, and keeps downstream subscriber code simple.

---

## 4. Goals and Objectives
| # | Objective | Success Indicator |
|---|---|---|
| BO-1 | Guarantee that a downstream subsystem only receives events for tenants it serves | No event for an unentitled tenant is delivered to a subscriber in normal operation |
| BO-2 | Reduce the risk of cross-tenant data leakage | Filtering is enforced by the messaging platform, not only by application code |
| BO-3 | Simplify downstream subscriber implementations | Subscribers do not need to implement tenant-scope filtering to avoid leakage |
| BO-4 | Support independent tenant onboarding/offboarding for each downstream product | Adding or removing a tenant from a product does not require changes to the publisher code |
| BO-5 | Remain operationally scalable as the tenant and subsystem counts grow | New subscriptions and filters can be added without redesigning the topic |

---

**Positive consequences (from ADR):**
**Positive**
- Filtering happens at the messaging layer, so a subscriber never even receives (and can't accidentally process or leak) events for tenants outside its scope — this is a stronger boundary than trusting every subscriber to filter correctly in application code.
- Keeps subscriber-side code simpler: no need to implement and maintain a tenant-scope filter in every downstream subsystem.
- Scales naturally as new subsystems come online with different tenant subsets — each just declares its own subscription filter rather than the core needing to know about per-subsystem tenant scoping.

**Negative**
- Subscription filters need to be kept in sync with which tenants each subsystem serves (e.g., as tenants enable/disable a downstream subsystem), which is operational state living in Service Bus configuration rather than in this subsystem's own database — a potential source of drift if not automated.
- SQL filter rules on Service Bus topics have practical limits on count/complexity per topic; a very large number of individually-scoped subscriptions could approach those limits and needs monitoring as the tenant/subsystem count grows.

## 5. Functional Requirements
Use Azure Service Bus subscription SQL filters on `tenantId` so each downstream subscription only receives events for the tenants it actually serves, rather than every subscriber receiving the full event stream and filtering client-side.

### 5.1 Architecture Decision
Use Azure Service Bus subscription SQL filters on `tenantId` so each downstream subscription only receives events for the tenants it actually serves, rather than every subscriber receiving the full event stream and filtering client-side.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role | Interest |
|---|---|---|
| Product / Tenant Owners | Define which tenants each downstream product serves | Correct, auditable routing |
| Architecture Team | Owns messaging topology and tenant isolation strategy | Secure, scalable design |
| Downstream Engineering Teams | Consume events to build products such as Brand Reputation | Simple integration contract |
| Platform Operations | Manage Azure Service Bus subscriptions and rules | Operational tooling and monitoring |
| Security / Compliance | Review cross-tenant exposure controls | Evidence of boundary enforcement |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.2 | epic-5-security-isolation-and-messaging.md | As downstream subsystem serving only a subset of tenants, I want my Service Bus subscription to receive events only for the tenants I actually serve, filtere... | `tenantId` is emitted as a Service Bus application property on every event message, not only inside the JSON payload body (required for SQL subscription filt... |


## 7. Data Requirements
See BRD Data Requirements.

## 8. Business Rules and Logic
1. **BR-001 — Tenant-boundary rule:** A downstream subsystem may only process data for tenants explicitly assigned to it.  
2. **BR-002 — Filter-authority rule:** Service Bus SQL filters, not subscriber code, are the authoritative boundary for event routing.  
3. **BR-003 — Property rule:** `tenantId` must be emitted as a Service Bus application property; it cannot be filtered from the JSON payload alone.  
4. **BR-004 — Lifecycle rule:** Changes in a downstream product's tenant list must be reflected in its subscription filter.  
5. **BR-005 — Shared-tenant rule:** A tenant may appear in multiple subscription filters; each such filter is owned by the corresponding downstream subsystem.  

---

## 9. Interfaces and Integrations
| Dependency | Reference |
|---|---|
| Event schema and publisher design | Design Spec §7, ADR-0012 (thin events) |
| `tenantId` emitted as application property | ADR-0013 Clarification (2026-07-28) |
| Database tenant isolation | ADR-0015 |
| Messaging dead-letter / retry policy | ADR-0010 |

---

| Dependency | Reference |
|---|---|
| Event schema and publisher design | Design Spec §7, ADR-0012 (thin events) |
| `tenantId` emitted as application property | ADR-0013 Clarification (2026-07-28) |
| Database tenant isolation | ADR-0015 |
| Messaging dead-letter / retry policy | ADR-0010 |

---

Use Azure Service Bus subscription SQL filters on `tenantId` so each downstream subscription only receives events for the tenants it actually serves, rather than every subscriber receiving the full event stream and filtering client-side.

## 10. Non-Functional Considerations
**Positive**
- Filtering happens at the messaging layer, so a subscriber never even receives (and can't accidentally process or leak) events for tenants outside its scope — this is a stronger boundary than trusting every subscriber to filter correctly in application code.
- Keeps subscriber-side code simpler: no need to implement and maintain a tenant-scope filter in every downstream subsystem.
- Scales naturally as new subsystems come online with different tenant subsets — each just declares its own subscription filter rather than the core needing to know about per-subsystem tenant scoping.

**Negative**
- Subscription filters need to be kept in sync with which tenants each subsystem serves (e.g., as tenants enable/disable a downstream subsystem), which is operational state living in Service Bus configuration rather than in this subsystem's own database — a potential source of drift if not automated.
- SQL filter rules on Service Bus topics have practical limits on count/complexity per topic; a very large number of individually-scoped subscriptions could approach those limits and needs monitoring as the tenant/subsystem count grows.

## 11. Error Handling and Exceptions
**Positive**
- Filtering happens at the messaging layer, so a subscriber never even receives (and can't accidentally process or leak) events for tenants outside its scope — this is a stronger boundary than trusting every subscriber to filter correctly in application code.
- Keeps subscriber-side code simpler: no need to implement and maintain a tenant-scope filter in every downstream subsystem.
- Scales naturally as new subsystems come online with different tenant subsets — each just declares its own subscription filter rather than the core needing to know about per-subsystem tenant scoping.

**Negative**
- Subscription filters need to be kept in sync with which tenants each subsystem serves (e.g., as tenants enable/disable a downstream subsystem), which is operational state living in Service Bus configuration rather than in this subsystem's own database — a potential source of drift if not automated.
- SQL filter rules on Service Bus topics have practical limits on count/complexity per topic; a very large number of individually-scoped subscriptions could approach those limits and needs monitoring as the tenant/subsystem count grows.

## 12. Assumptions and Dependencies
| Dependency | Reference |
|---|---|
| Event schema and publisher design | Design Spec §7, ADR-0012 (thin events) |
| `tenantId` emitted as application property | ADR-0013 Clarification (2026-07-28) |
| Database tenant isolation | ADR-0015 |
| Messaging dead-letter / retry policy | ADR-0010 |

---

## 13. Open Questions / Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Subscription filter drift vs. actual tenant entitlements | High — incorrect data exposure or missing data | Automate filter synchronization from the authoritative entitlement store and audit rule changes |
| Approaching Service Bus rule count or complexity limits | Medium — filtering stops working or new tenants cannot be added | Monitor rule usage, set alerts before limits, and plan topic splitting if scale demands it |
| `tenantId` omitted or incorrectly set on events | High — filters fail or leak data | Validate `tenantId` is present as an application property in the publisher and in CI contract tests |
| Manual, opaque filter changes | Medium — human error, no rollback | Treat rules as code/configuration, version changes, and enforce change approval |

---

## 14. Appendix
- ADR: `../../adr/0013-per-tenant-event-filtering-via-subscription-rules.md`
- BRD: `../Business-Requirements/BRD-0013-Per-Tenant-Event-Filtering-Via-Subscription-Rules.md`
- Feature design: _No dedicated feature-design file found._
- Deep research: _No deep-research report found._
- User stories: see extracted stories above