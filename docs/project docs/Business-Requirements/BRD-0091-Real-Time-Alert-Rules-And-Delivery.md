# BRD-0091: Real-Time Alert Rules and Delivery

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Real-Time Alert Rules and Delivery – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-28 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft for review – source ADR-0091 (Accepted 2026-08-28) is **Proposed** and may change |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0091 (Accepted 2026-08-28), feature design `09-real-time-alerts.md`, and Epic 10 stories |

---

## 2. Executive Summary

Users currently discover reputation spikes, campaign surges, and connector problems by polling dashboards. This is too slow for 24/7 brand, crisis, and operations teams, and it forces analysts to keep a dashboard open at all times to catch meaningful changes. The **Real-Time Alert Rules and Delivery** capability turns the platform from a passive reporting tool into an active notification system.

The proposed solution authorizes an `alert_rules` data model, a threshold-evaluation worker, and multi-channel delivery (in-app, email, webhook) for both tenant-scoped and platform-scoped real-time alerts. Rules can fire on keyword mentions, topic volume, negative-sentiment share, post volume over a watchlist, or connector-health state changes. Each rule carries a configurable cooldown to prevent alert spam. When a threshold is crossed, the system stores a `tenant_alerts` row and dispatches the alert through the channels the rule owner has opted into.

Expected outcomes include faster crisis response, better operational awareness of connector health, and a foundation for the `20-crisis-threshold-wizard` feature. Because ADR-0091 (Accepted 2026-08-28) is still **Proposed**, this BRD is a draft for review; its requirements may be revised once the ADR is accepted.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce time to detect reputation or volume anomalies | Users are notified within seconds to minutes of threshold crossing instead of discovering it in a dashboard |
| 2 | Minimize alert noise and fatigue | Alert frequency is bounded by per-rule cooldown and tenant-scoped suppression |
| 3 | Improve operational awareness of connector health | Platform and tenant users are alerted to failing or stalled connectors without manual polling |
| 4 | Enable flexible, multi-channel alerting | In-app is the default; email and webhook are opt-in per rule |
| 5 | Provide a foundation for crisis-threshold wizards | `alert_rules` and `watchlists` can be composed into reusable crisis templates |

---

## 4. Scope

### 4.1 In Scope

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

### 4.2 Out of Scope

- Synchronous, in-process alert evaluation inside the ingestion worker.
- Complex boolean combinations in rule thresholds for v1.
- Default-on email delivery for all alerts.
- Digest mode (daily/weekly) for non-critical rules (deferred; likely in v1.5).
- Advanced AI threshold recommendations, alert summarization, or false-positive filtering for v1.
- Public API documentation for alert rules (covered by `11-api-and-integrations`).

### 4.3 Assumptions

- `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` (ADR-0012/0013) are available and carry tenant-scoped metadata.
- Watchlists (ADR-0044) already exist and can be referenced by `watchlist_id`.
- Precomputed analytics views (ADR-0087) may be used for fast threshold evaluation.
- Tenant-level email and webhook configuration are either present or collected during rule setup.

### 4.4 Constraints

- Delivery channels that cost money (email, webhook calls) must be opt-in to control cost and deliverability.
- Alert evaluation must not block or slow the ingestion hot path.
- All alert data and rules must be protected by tenant RLS.
- Webhook payloads must be signed per tenant to prevent tampering (see ADR-0092 for convention).

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Brand-Reputation-Manager | Primary user | High | Create 3-tier alert rules, receive real-time reputation-spike notifications, see posts driving an alert |
| Tenant-Social-Care-Agent | Primary user | High | Receive high-priority customer-issue alerts with SLA timer and direct link to the inbox |
| Platform-Admin | Primary user | High | Receive platform-wide connector and AI-provider health alerts with throttling |
| Sole-Operator | Primary user | Medium | Set cost and rate-limit alerts and receive digest emails rather than per-event noise |
| Tenant-User | Secondary user | Medium | Subscribe to personal alerts on owned watchlists |
| Tenant-Reader | Secondary user | Low | See in-app alert banners for critical reputation events |

---

## 6. Current State (As-Is)

**Current process:**
1. Posts are ingested and connector health is tracked, but users must open the analytics dashboard or connector status screen to notice changes.
2. There is no systematic way to define thresholds such as "alert me if negative sentiment on this watchlist exceeds 40% in 15 minutes" or "alert me if a connector is failing."
3. Crisis response depends on manual refresh cycles or external monitoring tools.

**Pain points:**
- Reputation spikes can go unnoticed until the next dashboard check.
- Connector failures are discovered reactively, often after data has already been missed.
- There is no single, auditable place to see which rules fired and when.
- Users who need 24/7 coverage must keep the dashboard open.

---

## 7. Future State (To-Be)

**New or improved process:**
1. A user creates an `alert_rule` from a dashboard view or from a dedicated alert rules page, selecting a metric/threshold, watchlist (where applicable), delivery channels, and cooldown.
2. The `AlertEvaluationWorker` subscribes to `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` and evaluates the event against all active rules for the relevant tenant.
3. When a threshold is met and the rule cooldown has elapsed, the worker stores one `tenant_alerts` row per trigger and dispatches the alert through the selected in-app, email, and webhook channels.
4. Users see in-app banners and an alert history; they can acknowledge an alert to reset the cooldown.

**Expected capabilities:**
- Real-time notification of keyword, topic, sentiment, volume, and connector-health threshold crossings.
- Per-rule cooldown and suppression to prevent alert storms.
- Multi-channel delivery with in-app as the default and email/webhook as opt-in.
- A clear, auditable history of triggered alerts per tenant.
- Foundation for crisis templates that bundle `watchlist` + `alert_rule` presets.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Alert evaluation latency must not materially delay ingestion | Performance | Must | Ingestion p95 latency remains within existing SLA when alert evaluation is enabled |
| NFR-002 | Alert rules and events must be protected by tenant RLS | Security | Must | Contract tests prove no cross-tenant rule or alert leakage |
| NFR-003 | Webhook payloads must be signed with a tenant-specific secret | Security | Must | Signature verification succeeds for valid payloads and fails for tampered payloads |
| NFR-004 | Email delivery must not leak tenant data in logs | Security | Must | No raw post bodies, PII, or secrets appear in delivery logs |
| NFR-005 | The system must support at least 100 active rules per tenant without degradation | Scalability | Should | Evaluation p99 latency remains under 1 second for active rule sets up to 100 per tenant |
| NFR-006 | The UI must provide accessible threshold inputs and alert actions | Usability | Should | Threshold fields have clear units and min/max; alert list supports keyboard acknowledge/dismiss |

---

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `alert_rules` | Tenant/user-owned rule definitions, thresholds, and delivery preferences | ADR-0091 (Accepted 2026-08-28) | Tenant / Rule owner | Tenant configuration; no PII |
| `tenant_alerts` | One row per rule trigger, including payload, status, and acknowledgment | ADR-0091 (Accepted 2026-08-28) | Tenant / Rule owner | May include alert summaries; no raw post bodies |
| `watchlist_id` | Optional reference to the watchlist a post-based rule filters on | ADR-0044 | Tenant | Same sensitivity as watchlist query |
| `threshold` | Rule-specific JSONB threshold such as `minPosts`, `negativePct`, or `keyword` | ADR-0091 (Accepted 2026-08-28) | Rule owner | Tenant configuration |
| `delivery` | JSONB of selected channels: in-app, email list, webhook list | ADR-0091 (Accepted 2026-08-28) | Rule owner | Tenant configuration; may include webhook URLs |
| `SocialPostIngestedEvent` | Event stream that triggers post-based rule evaluation | ADR-0012 | Platform | Post metadata only |
| `ConnectorHealthChangedEvent` | Event stream that triggers connector-health rule evaluation | ADR-0013 | Platform | Health status and platform id |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Alerts triggered per rule | Track rule noise and effectiveness | Tenant-Admin / Product team | Real-time and daily |
| Alert delivery success/failure | Monitor email and webhook reliability | Platform-Admin / Operations | Hourly |
| Time from event to alert | Measure real-time responsiveness | Product team / Operations | Daily |
| Active rules per tenant | Capacity planning and cost control | Platform-Admin | Daily |
| Most acknowledged/dismissed alerts | Identify noisy or misconfigured rules | Product team | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Alert fatigue drives users to ignore alerts | Medium | High | Implement cooldown, grouping by watchlist/topic, and future digest mode | Product Owner |
| R-002 | Email/webhook delivery creates cost and deliverability exposure | Medium | Medium | Keep channels opt-in, rate-limit per tenant, and track delivery success | Technical Lead |
| R-003 | Synchronous evaluation slows ingestion | Low | High | Decouple via `AlertEvaluationWorker` (asynchronous) | Technical Lead |
| R-004 | Multi-tenant data leakage via alerts or rule payloads | Low | High | Enforce RLS, omit raw PII from payloads, sign webhooks | Technical Lead |
| R-005 | Webhook signing convention not yet finalized | Medium | Medium | Coordinate with ADR-0092 before implementation | Product Owner |
| R-006 | ADR-0091 (Accepted 2026-08-28) is still Proposed and may change | High | Medium | Treat this BRD as draft; re-validate after ADR acceptance | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0091 (Accepted 2026-08-28) acceptance | Internal | Menno | Upon ADR review and approval |
| D-002 | `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` (ADR-0012/0013) | Internal | Technical Lead | Already built |
| D-003 | Watchlists (ADR-0044) | Internal | Technical Lead | Already built |
| D-004 | Precomputed analytics views (ADR-0087) for fast threshold evaluation | Internal | Technical Lead | In progress |
| D-005 | Webhook signing convention (ADR-0092) | Internal | Technical Lead | To be aligned before webhook delivery |
| D-006 | Story 10.9 — Real-time alert rules and delivery (backend) | Internal | Engineering | When ADR accepted |
| D-007 | Story 10.10 — Real-time alert UI (frontend) | Internal | Engineering | After Story 10.9 |

---

## 14. Acceptance Criteria

- `alert_rules` table exists with `volume`, `sentiment`, `keyword`, `topic`, and `connector-health` rule types.
- `AlertEvaluationWorker` fires a rule when its threshold is crossed and does not fire when the threshold is not crossed.
- Cooldown prevents a rule from triggering more than once within `cooldown_minutes`.
- In-app, email, and webhook delivery channels are each exercised by a contract test.
- A rule can be disabled and enabled without deleting it.
- A user can acknowledge an alert.
- No tenant can read another tenant's rules or alert history.
- Alert payloads do not include raw PII beyond what the user is authorized to see.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `alert_rule` | A tenant-scoped, user-owned configuration that defines when and how an alert should fire. |
| `tenant_alerts` | The per-trigger record of an alert, stored for in-app history and acknowledgment. |
| `AlertEvaluationWorker` | The asynchronous worker that consumes ingestion and health events and evaluates rules. |
| `cooldown_minutes` | The minimum interval between consecutive triggers of the same rule. |
| `watchlist` | A saved Boolean query used to filter posts; can be referenced by volume/keyword/topic alert rules. |
| `in-app delivery` | Surfacing the alert in the admin UI through `tenant_alerts` and an alert banner. |
| `webhook` | An HTTP `POST` to a tenant-configured URL carrying a signed alert payload. |

---

## 16. Appendices

### 16.1 Reference Documents

- ADR-0091 (Accepted 2026-08-28): Real-time alert rules and delivery (`docs/adr/0091-real-time-alert-rules-and-delivery.md`)
- Feature design: Real-time alerts (`docs/product-research/feature-designs/09-real-time-alerts.md`)
- Feature-to-ADR scoping plan (`docs/product-research/feature-adr-scoping.md`)
- Related ADRs: ADR-0012, ADR-0013, ADR-0044, ADR-0087

### 16.2 Related User Stories

- **Story 10.9** — Real-time alert rules and delivery (backend)
  - *As a* backend engineer, *I want* `alert_rules`, an `AlertEvaluationWorker`, and in-app/email/webhook delivery, *so that* `Tenant-Brand-Reputation-Manager` is notified when thresholds are crossed.
  - Key acceptance criteria: support the five rule types; consume the two event types; enforce cooldown; support three delivery channels; store one `tenant_alerts` row per trigger.
- **Story 10.10** — Real-time alert UI (frontend)
  - *As a* `Tenant-Brand-Reputation-Manager`, *I want* an alert rules page and an in-app alert feed, *so that* I can create rules, acknowledge alerts, and see recent triggers.
  - Key acceptance criteria: `AlertRulesView` for creating/editing rules; `AlertsInboxView` with status, severity, and source; acknowledge/snooze/resolve actions; configurable delivery preferences.

### 16.3 Open Questions to Resolve

- Should alert evaluation be real-time (per-event) or batched (every N minutes)?
- How are duplicate alert emails suppressed across a tenant?
- Should `Platform-Admin` have platform-wide alert rules (e.g., a connector failing across any tenant)?
- What is the maximum number of active alert rules per tenant?

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
