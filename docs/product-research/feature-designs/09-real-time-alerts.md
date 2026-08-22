---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# Real-time alerts

### What it is
Notifications — in-app, email, or webhook — when a keyword, topic, sentiment, or volume threshold is crossed.

### End-user benefits
- **Crisis response:** know about a spike in negative mentions immediately.
- **Campaign monitoring:** get notified when a hashtag takes off.
- **Operational awareness:** track connector health and ingestion status.

### Core details
- `ConnectorHealth` and `ingestion_runs` already feed a health model.
- Alert rules can be built on top of the analytics dashboard filters: watchlist, sentiment, volume, provider, author.
- Delivery: in-app banner, email, Service Bus event, or webhook. ADR-0012/0013 eventing already exists.

### Implementation complexity
**Medium.** The data and event plumbing exist. The new work is alert-rule storage, threshold evaluation, and delivery channels. Webhook delivery is easiest because it reuses existing outbound patterns.

### Growth and reach
Alerts move users from "check the dashboard" to "get told when something matters." That is essential for any 24/7 brand or crisis team.

---

## Technical design

- **Data flow:** ingestion of `social_posts` or `ConnectorHealth` change → `alert_evaluator` compares stream against `alert_rules` (watchlist, sentiment, volume, provider, author thresholds) → when a rule fires, create `alert_event` and dispatch via in-app notification, email, webhook, or Service Bus event.
- **Component interactions:** the evaluator can run off `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` (ADR-0012/0013). Webhook delivery reuses the same `outbound_activities` pattern as publishing.
- **REST/Service Bus contracts:** `POST /v1/alerts/rules`, `GET /v1/alerts/rules`, `DELETE /v1/alerts/rules/:id`, `GET /v1/alerts/events`, `SocialPostIngestedEvent`, `ConnectorHealthChangedEvent`, `AlertTriggeredEvent`.
- **Storage:** `alert_rules` (tenant-scoped, RLS) with `watchlist_id`, `metric`, `threshold`, `delivery_method`; `alert_events` (tenant-scoped) with `rule_id`, `triggered_at`, `payload`, `acknowledged_by`.
- **Security considerations:** RLS; webhooks must be signed with a tenant-specific secret; email delivery must not leak tenant data in logs; alert payloads should not include raw PII beyond what the user is authorized to see.

## Backend principles

- **Event-driven evaluation.** v1 can fire alerts by subscribing to existing `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` rather than polling. This reuses the Service Bus plumbing already in place.
- **Rule model is dashboard-filter aware.** Alert rules should reuse the same predicate model as the analytics dashboard filters (watchlist, provider, sentiment, language, author, date range) so users can "alert on this view."
- **Postgres + RLS.** `alert_rules` and `alert_events` are `tenant_id`-scoped and RLS-protected. Tenant admins can create rules; tenant users can create personal rules for their own watchlists.
- **Contract-test targets.** Verify that a rule fires when a threshold is crossed, that multiple delivery channels are exercised, that a rule can be disabled/acknowledged, and that an alert never leaks another tenant's data.

## Frontend / UI principles

- **User flow:** user creates an alert rule from a dashboard view or manually → selects metric/threshold/delivery → sees alert history → can acknowledge or dismiss.
- **Component hierarchy:** `AlertRulesPage` → `AlertRuleForm` (metric, threshold, delivery, watchlist) → `AlertEventsList` (history/acknowledge).
- **State management:** React state for the form; server state for rules and events; in-app notifications can be a top-level `AlertBanner` component.
- **Accessibility and responsive design:** Threshold inputs have clear units and min/max; delivery method is a radio group; alert list supports keyboard actions for acknowledge/dismiss.

## Open questions

- Should the alert evaluator be a Service Bus consumer or a synchronous hook inside `publishSocialPostIngestedEvents.ts`?
- Which delivery channels are in v1 (in-app, email, webhook)?
- How do we avoid alert fatigue (grouping, cooldown, digest mode)?
- Do we need a separate "connector health alert" by default for all activated connectors?
- Should alert rules be role-gated to tenant admins only, or per-user?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Service Bus consumer vs. synchronous hook?** | Use a **Service Bus consumer** (asynchronous) rather than a synchronous hook. Ingestion should not wait for alert evaluation. The existing `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` already provide the right decoupling. | Notification system architecture guides (Codelit, Dusko Licanin) recommend an async dispatch queue for multi-channel delivery; synchronous alert evaluation would add latency and failure modes to ingestion. |
| **v1 delivery channels?** | **In-app and email in v1; webhooks in v1.5**. In-app is the channel you own and is cheapest; email is for reference/persistence; webhooks are for integrations and need more plumbing. | SaaS notification best practices: in-app first, email for later reference, webhooks for external systems. Pulsar's 3-tier framework also maps to digest/email/alert channels. |
| **Avoid alert fatigue?** | Implement a **3-tier severity model**, **grouping by watchlist/topic**, a **per-rule cooldown** (e.g., 15 minutes before the same rule fires again), and **daily/weekly digest mode** as the default for non-critical rules. | Pulsar and Socialhose recommend 3-tier alerts (routine/elevated/critical) and batching; Later says alert fatigue is the #1 failure mode; Vista Social recommends escalation paths and triage rotation. |
| **Connector health alerts by default?** | **Yes**, but with throttling: one health-alert per connector per hour (or per state change). Health is an operational signal; default alerts prevent silent connector failures, but unthrottled they create noise. | Xpoz and social listening operational guides treat connector/platform health as a core alert source; cooldown is essential to avoid spam. |
| **Alert rules role-gated?** | **Tenant admins can create tenant-wide rules; tenant users can create personal rules** for their own watchlists. Alerting is an operational artifact, but personal monitoring is a common analyst need. | RBAC patterns in SaaS: shared resources by admin, personal resources by user; this matches the project's existing watchlist ownership model. |

### Sources consulted

- Pulsar: social listening alert strategy — https://www.pulsarplatform.com/guides/how-to-set-up-social-listening-strategy
- Xpoz: setting up social listening alerts — https://www.xpoz.ai/blog/tutorials/setting-up-effective-social-listening-alerts/
- Socialhose: smart alerts and mailing lists — https://socialhose.net/blog/mailing-lists-email-alerts/
- Later: social media monitoring strategy — https://later.com/blog/social-media-monitoring-strategy/
- Vista Social: social listening for agencies — https://vistasocial.com/insights/social-listening-for-agencies/
- Codelit: notification system architecture — https://codelit.io/blog/notification-system-architecture
- Dusko Licanin: SaaS notification system — https://www.duskolicanin.com/blog/saas-notification-system-in-app-email-push-2026
- James Ross: SaaS notification system — https://www.jamesrossjr.com/blog/saas-notification-system

## Persona acceptance

- **Tenant-Brand-Reputation-Manager (primary):** can create 3-tier alert rules (routine/elevated/critical), receive real-time notification of reputation spikes, and see the posts driving an alert.
- **Tenant-Social-Care-Agent (primary):** can get alerted to high-priority customer issues with an SLA timer and a direct link to the inbox.
- **Platform-Admin (primary):** receives platform-wide connector and AI-provider health alerts with cooldown to avoid noise.
- **Sole-Operator (primary):** can set cost and rate-limit alerts and get digest emails rather than per-event noise.
- **Tenant-User (secondary):** can subscribe to personal alerts on their own watchlists.
- **Tenant-Reader (secondary):** sees in-app alert banners for critical reputation events without needing to configure rules.

## AI enhancements

- **Smart threshold recommendation:** the AI learns normal volume patterns and suggests alert thresholds.
- **Alert summarization:** when a spike occurs, the AI writes a short paragraph of what is happening and why.
- **False-positive filtering:** the AI suppresses repeated or irrelevant triggers.
- **Root-cause snippets:** the alert includes the most representative posts driving the trigger.
