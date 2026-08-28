# ADR-0091: Real-time alert rules and delivery

**Status:** Accepted (2026-08-28)

**Acceptance note (2026-08-28):** Accepted by Menno. Authorizes the real-time alert rules engine, cooldown suppression, and alerts inbox triage workflow. Story 10.9 and Story 10.10 are fully implemented and verified.

**Authorizes:** an `alert_rules` data model, threshold-evaluation engine, and delivery channels (in-app, email, webhook) for tenant-scoped and platform-scoped real-time alerts.

**Source:** `docs/product-research/feature-designs/09-real-time-alerts.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Alerts turn dashboards into action
`docs/product-research/feature-designs/09-real-time-alerts.md` and `docs/product-research/feature-designs/20-crisis-threshold-wizard.md` both require a system that notifies users when a keyword, topic, sentiment, volume, or connector-health threshold is crossed. Without alerts, users must poll the dashboard.

### 2. The data pipeline already emits events
`SocialPostIngestedEvent` and `ConnectorHealthChangedEvent` (ADR-0012/0013) provide the hooks. A rule engine can subscribe to these events and evaluate thresholds.

### 3. Delivery must be tenant-scoped and cost-aware
Alerts are noisy if not bounded. The system must cap alert frequency, support per-tenant suppression, and avoid spam. Email and webhook delivery are optional and must be opt-in.

---

## Decision

### 1. New `alert_rules` table
```sql
alert_rules (
  id uuid,
  tenant_id uuid,
  owner_id uuid,
  name text,
  type text,                  -- 'volume' | 'sentiment' | 'keyword' | 'connector-health' | 'topic'
  watchlist_id uuid,          -- optional, for volume/keyword/topic
  threshold jsonb,            -- rule-specific structure
  delivery jsonb,             -- { inApp: true, email: [], webhooks: [] }
  cooldown_minutes int default 60,
  is_active boolean default true,
  last_triggered_at timestamptz,
  created_at timestamptz
);
```

### 2. Rule types and thresholds
- **volume** — `threshold: { minPosts: number, overMinutes: number }`.
- **sentiment** — `threshold: { negativePct: number, overMinutes: number }`.
- **keyword** — `threshold: { keyword: string, minMentions: number }`, applied to `post.body_markdown`.
- **topic** — `threshold: { topicId: string, minMentions: number }`.
- **connector-health** — `threshold: { platformId: string, state: 'failing' | 'stalled' }`.

### 3. Evaluation trigger
- An `AlertEvaluationWorker` consumes `SocialPostIngestedEvent` and `ConnectorHealthChangedEvent`.
- For post events, it checks whether the post matches any active rule's `watchlist_id` and whether the rule's window/threshold is met.
- For health events, it checks the `connector-health` rules for the affected platform.
- Evaluation is tenant-scoped by event metadata.

### 4. Delivery channels
- **In-app:** the alert appears in the UI and is stored in a new `tenant_alerts` table.
- **Email:** via Azure Communication Services or a tenant-configured SMTP. Subject to `delivery.email` list.
- **Webhook:** `POST` to a tenant-configured URL with a signed payload. See `ADR-0092` (API/webhooks) for the signing convention.

### 5. Cooldown and suppression
- A rule cannot trigger more than once per `cooldown_minutes`.
- `tenant_alerts` stores one row per trigger, not one per matching post.
- Users can acknowledge an alert, which resets the `last_triggered_at` cooldown.

### 6. Alert payload
```ts
{
  alertRuleId: string;
  alertRuleName: string;
  tenantId: string;
  triggeredAt: string;
  type: string;
  summary: string;          // one-sentence description
  matchingPostCount?: number;
  watchlistId?: string;
  platformId?: string;
}
```

---

## Consequences

1. **Faster crisis response:** users are told when something changes instead of discovering it in a dashboard.
2. **Bounded noise:** cooldown and per-rule thresholds prevent alert spam.
3. **Foundation for `20-crisis-threshold-wizard`:** the wizard creates `alert_rules` and `watchlists` from templates.
4. **Delivery cost:** email and webhook delivery are metered; in-app alerts are cheapest.

---

## Alternatives considered

1. **Evaluate rules synchronously in the ingestion worker.**
   - *Rejected:* it couples alerting to the ingestion hot path and could slow ingestion. A worker decouples the two.

2. **Support complex boolean combinations in rule thresholds.**
   - *Rejected:* v1 thresholds are intentionally simple. Boolean watchlists already provide the filter; the rule only checks counts or percentages.

3. **Default all alerts to email.**
   - *Rejected:* it creates deliverability and cost risk. In-app is the default; email and webhook are opt-in.

---

## Open questions

- Should alert evaluation be real-time (per-event) or batched (every N minutes)?
- How are duplicate alert emails suppressed across a tenant?
- Should `Platform-Admin` have platform-wide alert rules (e.g., a connector failing across any tenant)?
- What is the maximum number of active alert rules per tenant?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/09-real-time-alerts.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0012`/`ADR-0013` (events), `ADR-0044` (watchlists), `ADR-0087` (precomputed views, for fast threshold evaluation)

### Pending supersession note (2026-08-28)

If ADR-0123 (Proposed, 2026-08-28) is accepted, this ADR's Decision §1 and §5 would be extended by ADR-0123's own §1–§4 — specifically rule-level noise exclusions (excluded_watchlist_ids, excluded_topic_ids), a hard per-rule daily cap (max_alerts_per_day), sensitivity presets, and a pre-save alert volume preview endpoint (POST /v1/alert-rules/preview). This is a pending note only: ADR-0123 is currently Proposed, not accepted. Per ADR-0047 §2, don't assume already-shipped code changes automatically — it would only change once ADR-0123's own story is actually built following acceptance. This ADR's original Decision and Consequences text above is unchanged and remains the historical record.