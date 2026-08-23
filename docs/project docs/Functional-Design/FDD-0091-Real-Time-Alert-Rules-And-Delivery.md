# BRD-0091: Real-Time Alert Rules and Delivery

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0091: Real-Time Alert Rules and Delivery |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0091-real-time-alert-rules-and-delivery.md, ../Business-Requirements/BRD-0091-Real-Time-Alert-Rules-And-Delivery.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0091-real-time-alert-rules-and-delivery.md and the business requirements in BRD-0091-Real-Time-Alert-Rules-And-Delivery.md into functional design for **Real Time Alert Rules And Delivery**.
Users currently discover reputation spikes, campaign surges, and connector problems by polling dashboards. This is too slow for 24/7 brand, crisis, and operations teams, and it forces analysts to keep a dashboard open at all times to catch meaningful changes. The **Real-Time Alert Rules and Delivery** capability turns the platform from a passive reporting tool into an active notification system.

The proposed solution authorizes an `alert_rules` data model, a threshold-evaluation worker, and multi-channel delivery (in-app, email, webhook) for both tenant-scoped and platform-scoped real-time alerts. Rules can fire on keyword mentions, topic volume, negative-sentiment share, post volume over a watchlist, or connector-health state changes. Each rule carries a configurable cooldown to prevent alert spam. When a threshold is crossed, the system stores a `tenant_alerts` row and dispatches the alert through the channels the rule owner has opted into.

Expected outcomes include faster crisis response, better operational awareness of connector health, and a foundation for the `20-crisis-threshold-wizard` feature. Because ADR-0091 is still **Proposed**, this BRD is a draft for review; its requirements may be revised once the ADR is accepted.

---

### 2.2 Scope
**In scope:**
- `alert_rules` table and tenant-scoped RLS protection.
- Five v1 rule types: volume, sentiment, keyword, topic, and connector-health.
- Asynchronous `AlertEvaluationWorker` consuming `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`.
- In-app delivery via a `tenant_alerts` table.
- Optional email delivery (Azure Communication Services or tenant-configured SMTP) subject to an `email` list in the rule.
- Optional webhook delivery (tenant-configured URL, signed payload) subject to `webhooks` in the rule.
- Per-rule `cooldown_minutes` (default 60 minutes) to suppress repeated triggers.
- User ability to acknowledge an alert and reset the cooldown.
- Tenant-wide rules created by `Tenant-Admin` and personal rules created by `Tenant-User` for their own watchlists.
- Platform-wide connector-health rules for `Platform-Admin` (open question; to be confirmed).

**Out of scope:**
- Synchronous, in-process alert evaluation inside the ingestion worker.
- Complex boolean combinations in rule thresholds for v1.
- Default-on email delivery for all alerts.
- Digest mode (daily/weekly) for non-critical rules (deferred; likely in v1.5).
- Advanced AI threshold recommendations, alert summarization, or false-positive filtering for v1.
- Public API documentation for alert rules (covered by `11-api-and-integrations`).

## 3. Context and Background
See ADR Context.
Users currently discover reputation spikes, campaign surges, and connector problems by polling dashboards. This is too slow for 24/7 brand, crisis, and operations teams, and it forces analysts to keep a dashboard open at all times to catch meaningful changes. The **Real-Time Alert Rules and Delivery** capability turns the platform from a passive reporting tool into an active notification system.

The proposed solution authorizes an `alert_rules` data model, a threshold-evaluation worker, and multi-channel delivery (in-app, email, webhook) for both tenant-scoped and platform-scoped real-time alerts. Rules can fire on keyword mentions, topic volume, negative-sentiment share, post volume over a watchlist, or connector-health state changes. Each rule carries a configurable cooldown to prevent alert spam. When a threshold is crossed, the system stores a `tenant_alerts` row and dispatches the alert through the channels the rule owner has opted into.

Expected outcomes include faster crisis response, better operational awareness of connector health, and a foundation for the `20-crisis-threshold-wizard` feature. Because ADR-0091 is still **Proposed**, this BRD is a draft for review; its requirements may be revised once the ADR is accepted.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce time to detect reputation or volume anomalies | Users are notified within seconds to minutes of threshold crossing instead of discovering it in a dashboard |
| 2 | Minimize alert noise and fatigue | Alert frequency is bounded by per-rule cooldown and tenant-scoped suppression |
| 3 | Improve operational awareness of connector health | Platform and tenant users are alerted to failing or stalled connectors without manual polling |
| 4 | Enable flexible, multi-channel alerting | In-app is the default; email and webhook are opt-in per rule |
| 5 | Provide a foundation for crisis-threshold wizards | `alert_rules` and `watchlists` can be composed into reusable crisis templates |

---

**Positive consequences (from ADR):**
1. **Faster crisis response:** users are told when something changes instead of discovering it in a dashboard.
2. **Bounded noise:** cooldown and per-rule thresholds prevent alert spam.
3. **Foundation for `20-crisis-threshold-wizard`:** the wizard creates `alert_rules` and `watchlists` from templates.
4. **Delivery cost:** email and webhook delivery are metered; in-app alerts are cheapest.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall support `alert_rules` scoped to a tenant and owned by a user | Must | Rules are stored with `tenant_id` and `owner_id`; cross-tenant access is blocked by RLS | Product Owner |
| BR-002 | The system shall support volume, sentiment, keyword, topic, and connector-health rule types | Must | Each rule type has a documented `threshold` schema and fires correctly | Product Owner |
| BR-003 | The system shall evaluate rules asynchronously from ingestion events | Must | `AlertEvaluationWorker` consumes `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` without blocking ingestion | Product Owner |
| BR-004 | The system shall deliver alerts in-app by default | Must | Each trigger creates one row in `tenant_alerts` and is surfaced in the UI | Product Owner |
| BR-005 | The system shall optionally deliver alerts via email | Should | Email delivery only occurs when `delivery.email` is populated and the tenant has email configuration | Product Owner |
| BR-006 | The system shall optionally deliver alerts via webhook | Should | Webhook `POST` is sent only when `delivery.webhooks` is populated and the payload is signed | Product Owner |
| BR-007 | The system shall enforce a per-rule cooldown before re-triggering | Must | A rule cannot fire more than once per `cooldown_minutes`; acknowledgment resets `last_triggered_at` | Product Owner |
| BR-008 | The system shall allow users to acknowledge an alert | Should | Acknowledgment resets the rule cooldown and updates the `tenant_alerts` status | Product Owner |
| BR-009 | The system shall support tenant-wide rules created by `Tenant-Admin` and personal rules created by `Tenant-User` | Should | Role gating matches existing watchlist ownership model | Product Owner |
| BR-010 | The system shall provide a standard alert payload | Must | Payload contains `alertRuleId`, `alertRuleName`, `tenantId`, `triggeredAt`, `type`, `summary`, `matchingPostCount?`, `watchlistId?`, and `platformId?` | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Brand-Reputation-Manager | Primary user | High | Create 3-tier alert rules, receive real-time reputation-spike notifications, see posts driving an alert |
| Tenant-Social-Care-Agent | Primary user | High | Receive high-priority customer-issue alerts with SLA timer and direct link to the inbox |
| Platform-Admin | Primary user | High | Receive platform-wide connector and AI-provider health alerts with throttling |
| Sole-Operator | Primary user | Medium | Set cost and rate-limit alerts and receive digest emails rather than per-event noise |
| Tenant-User | Secondary user | Medium | Subscribe to personal alerts on owned watchlists |
| Tenant-Reader | Secondary user | Low | See in-app alert banners for critical reputation events |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 10.9 | epic-10-adr-0086-to-0094.md | As backend engineer, I want `alert_rules`, an `AlertEvaluationWorker`, and in-app/email/webhook delivery, so that `Tenant-Brand-Reputation-Manager` is notifi... | `alert_rules` table supports `volume`, `sentiment`, `keyword`, `topic`, and `connector-health` rule types.; The worker consumes `SocialPostIngestedEvent` and... |
| Story 10.10 | epic-10-adr-0086-to-0094.md | As `Tenant-Brand-Reputation-Manager`, I want an alert rules page and an in-app alert feed, so that I can create rules, acknowledge alerts, and see recent tri... | `AlertRulesView` for creating and editing rules.; `AlertsInboxView` shows triggered alerts with status, severity, and source.; Users can acknowledge, snooze,... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `alert_rules` | Tenant/user-owned rule definitions, thresholds, and delivery preferences | ADR-0091 | Tenant / Rule owner | Tenant configuration; no PII |
| `tenant_alerts` | One row per rule trigger, including payload, status, and acknowledgment | ADR-0091 | Tenant / Rule owner | May include alert summaries; no raw post bodies |
| `watchlist_id` | Optional reference to the watchlist a post-based rule filters on | ADR-0044 | Tenant | Same sensitivity as watchlist query |
| `threshold` | Rule-specific JSONB threshold such as `minPosts`, `negativePct`, or `keyword` | ADR-0091 | Rule owner | Tenant configuration |
| `delivery` | JSONB of selected channels: in-app, email list, webhook list | ADR-0091 | Rule owner | Tenant configuration; may include webhook URLs |
| `SocialPostIngestedEvent` | Event stream that triggers post-based rule evaluation | ADR-0012 | Platform | Post metadata only |
| `ConnectorHealthChangedEvent` | Event stream that triggers connector-health rule evaluation | ADR-0013 | Platform | Health status and platform id |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A rule cannot trigger more than once within its configured `cooldown_minutes`. |
| BRU-002 | In-app delivery is the default; email and webhook delivery require explicit opt-in. |
| BRU-003 | `Tenant-Admin` may create tenant-wide rules; `Tenant-User` may create personal rules for their own watchlists. |
| BRU-004 | `tenant_alerts` stores one row per rule trigger, not one row per matching post. |
| BRU-005 | Acknowledging an alert resets the rule's `last_triggered_at` and its cooldown. |
| BRU-006 | Webhook payloads must be signed with a tenant-specific secret. |
| BRU-007 | Email and webhook logs must not contain raw post content or PII. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0091 acceptance | Internal | Menno | Upon ADR review and approval |
| D-002 | `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` (ADR-0012/0013) | Internal | Technical Lead | Already built |
| D-003 | Watchlists (ADR-0044) | Internal | Technical Lead | Already built |
| D-004 | Precomputed analytics views (ADR-0087) for fast threshold evaluation | Internal | Technical Lead | In progress |
| D-005 | Webhook signing convention (ADR-0092) | Internal | Technical Lead | To be aligned before webhook delivery |
| D-006 | Story 10.9 — Real-time alert rules and delivery (backend) | Internal | Engineering | When ADR accepted |
| D-007 | Story 10.10 — Real-time alert UI (frontend) | Internal | Engineering | After Story 10.9 |

---

- `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` (ADR-0012/0013) are available and carry tenant-scoped metadata.
- Watchlists (ADR-0044) already exist and can be referenced by `watchlist_id`.
- Precomputed analytics views (ADR-0087) may be used for fast threshold evaluation.
- Tenant-level email and webhook configuration are either present or collected during rule setup.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Alert evaluation latency must not materially delay ingestion | Performance | Must | Ingestion p95 latency remains within existing SLA when alert evaluation is enabled |
| NFR-002 | Alert rules and events must be protected by tenant RLS | Security | Must | Contract tests prove no cross-tenant rule or alert leakage |
| NFR-003 | Webhook payloads must be signed with a tenant-specific secret | Security | Must | Signature verification succeeds for valid payloads and fails for tampered payloads |
| NFR-004 | Email delivery must not leak tenant data in logs | Security | Must | No raw post bodies, PII, or secrets appear in delivery logs |
| NFR-005 | The system must support at least 100 active rules per tenant without degradation | Scalability | Should | Evaluation p99 latency remains under 1 second for active rule sets up to 100 per tenant |
| NFR-006 | The UI must provide accessible threshold inputs and alert actions | Usability | Should | Threshold fields have clear units and min/max; alert list supports keyboard acknowledge/dismiss |

---

## 11. Error Handling and Exceptions
1. **Faster crisis response:** users are told when something changes instead of discovering it in a dashboard.
2. **Bounded noise:** cooldown and per-rule thresholds prevent alert spam.
3. **Foundation for `20-crisis-threshold-wizard`:** the wizard creates `alert_rules` and `watchlists` from templates.
4. **Delivery cost:** email and webhook delivery are metered; in-app alerts are cheapest.

---

## 12. Assumptions and Dependencies
- `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` (ADR-0012/0013) are available and carry tenant-scoped metadata.
- Watchlists (ADR-0044) already exist and can be referenced by `watchlist_id`.
- Precomputed analytics views (ADR-0087) may be used for fast threshold evaluation.
- Tenant-level email and webhook configuration are either present or collected during rule setup.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Alert fatigue drives users to ignore alerts | Medium | High | Implement cooldown, grouping by watchlist/topic, and future digest mode | Product Owner |
| R-002 | Email/webhook delivery creates cost and deliverability exposure | Medium | Medium | Keep channels opt-in, rate-limit per tenant, and track delivery success | Technical Lead |
| R-003 | Synchronous evaluation slows ingestion | Low | High | Decouple via `AlertEvaluationWorker` (asynchronous) | Technical Lead |
| R-004 | Multi-tenant data leakage via alerts or rule payloads | Low | High | Enforce RLS, omit raw PII from payloads, sign webhooks | Technical Lead |
| R-005 | Webhook signing convention not yet finalized | Medium | Medium | Coordinate with ADR-0092 before implementation | Product Owner |
| R-006 | ADR-0091 is still Proposed and may change | High | Medium | Treat this BRD as draft; re-validate after ADR acceptance | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0091-real-time-alert-rules-and-delivery.md`
- BRD: `../Business-Requirements/BRD-0091-Real-Time-Alert-Rules-And-Delivery.md`
- Feature design: `docs/product-research/feature-designs/09-real-time-alerts.md``
- Feature design: `docs/product-research/feature-designs/20-crisis-threshold-wizard.md``
- Deep research: _No deep-research report found._
- User stories: see extracted stories above