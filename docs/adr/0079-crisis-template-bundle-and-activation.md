# ADR-0079: Crisis template bundle and activation

**Status:** Accepted (2026-08-23)

**Acceptance note (2026-08-23).** Accepted per the structured review in this session; template parameterization, notification-channel binding, transactional activation, foreign-key lifecycle, and playbook linking were incorporated.

**Authorizes:** a small, data-driven "crisis template" bundle format and an activation flow that creates a preconfigured `watchlist` and `alert_rule` for common reputation-crisis scenarios.

**Source:** `docs/product-research/feature-designs/20-crisis-threshold-wizard.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Brand reputation crises need fast, consistent setup
`docs/product-research/feature-designs/20-crisis-threshold-wizard.md` describes a wizard that lets a `Tenant-Brand-Reputation-Manager` or `Tenant-Admin` activate one-click alert templates for common reputation risks: brand crisis, product recall, executive-name attack, competitor surge, and data-breach rumor. The goal is to reduce setup friction and standardize the first response.

### 2. `watchlists` and `alert_rule` primitives already exist
`ADR-0044` and the built watchlist/alert infrastructure provide the underlying tables and endpoints. The crisis wizard is a UI and data-bundle layer on top of these primitives; it does not introduce a new workflow engine or a new alerting pipeline.

### 3. Playbooks should remain data, not workflow
Each template includes a `playbook` — recommended steps, owners, and time-boxed actions. The first version keeps the playbook as configuration, not as an enforced workflow. Enforcement and workflow orchestration are explicitly deferred to a future subsystem.

---

## Decision

### 1. New `crisis_templates` platform table
A small, platform-wide table stores the default templates. It is not tenant-scoped. `template_key` is unique and immutable.

```sql
crisis_templates (
  id uuid,
  template_key text UNIQUE,    -- e.g. 'brand-crisis'
  name text,
  description text,
  default_query text,          -- human-readable boolean query string with mustache placeholders
  default_ast jsonb,           -- parsed WatchlistAST with mustache placeholders
  parameters jsonb,            -- [{ "key": "brand_name", "label": "Brand Name", "type": "string", "required": true }]
  default_thresholds jsonb,    -- e.g. { "volume_spike_pct": 50, "negative_sentiment_pct": 60 }
  playbook jsonb,              -- ordered steps with owner, action, sla_minutes
  is_active boolean default true
);
```

`default_query` and `default_ast` may contain mustache-style placeholders such as `{{brand_name}}` and `{{competitors}}`. These are interpolated at activation time using the caller-supplied `variables` map before `default_ast` is compiled and stored on the generated `watchlist`.

### 2. New `tenant_crisis_templates` table for activations
When a tenant activates a template, a row is written and it owns the generated `watchlist_id` and `alert_rule_id`.

```sql
tenant_crisis_templates (
  id uuid,
  tenant_id uuid,
  template_key text,
  watchlist_id uuid REFERENCES watchlists(id) ON DELETE CASCADE,
  alert_rule_id uuid REFERENCES alert_rules(id) ON DELETE CASCADE,
  variables jsonb,             -- activation-time parameter values
  custom_thresholds jsonb,
  playbook jsonb,              -- snapshot of crisis_templates.playbook at activation time
  created_by_user_id uuid,
  created_at timestamptz
);
```

Foreign keys use `ON DELETE CASCADE`: deleting a generated `watchlist` or `alert_rule` removes the associated `tenant_crisis_templates` record and prevents orphaned activation rows.

### 3. Activation flow and request/response contract
`POST /v1/crisis-templates/:templateKey/activate`:

```ts
// Request (HTTP 201 if successful)
{
  name?: string;                                  // optional custom watchlist/alert name
  variables: Record<string, string | string[]>;   // e.g. { brand_name: "Acme", competitors: ["CompA"] }
  customQuery?: string;                           // optional override rendered from variables
  customThresholds?: {
    volumeSpikePct?: number;
    negativeSentimentPct?: number;
    timeWindowMinutes?: number;
  };
  notificationChannelIds: string[];               // target destinations for the alert_rule; required
}

// Response (HTTP 201 Created)
{
  tenantCrisisTemplateId: string;
  watchlistId: string;
  alertRuleId: string;
  status: 'active';
  playbook: Array<{
    step: number;
    action: string;
    ownerRole: string;
    slaMinutes?: number;
  }>;
}
```

1. Look up `crisis_templates` by `template_key`. Verify it is `is_active` and that every `required` parameter in `parameters` is present in `variables`.
2. Validate `customThresholds` (if provided) against the `AlertRuleThresholds` JSON Schema/Zod schema before any write.
3. Interpolate `default_query` and `default_ast` with `variables` to produce a concrete watchlist query and AST.
4. Create a `watchlist` from the rendered AST under the caller's `user_id`.
5. Create an `alert_rule` from `default_thresholds` (or `customThresholds`) and `notificationChannelIds`, linked to the new watchlist. Populate `alert_rule.metadata` with `tenant_crisis_template_id` and a `playbook` snapshot.
6. Write the `tenant_crisis_templates` record, including the `playbook` snapshot and activation `variables`.
7. Return the new `tenantCrisisTemplateId`, `watchlistId`, `alertRuleId`, `status: 'active'`, and the `playbook`.

The entire activation flow executes inside a single database transaction; if any step fails, all writes are rolled back.

### 4. Customization is allowed, not required
The wizard lets the user preview `default_query` (rendered with sample or supplied `variables`) and `default_thresholds` and change them before activation. Defaults are copied from `crisis_templates` at activation time and become independent tenant assets.

### 5. Playbook is read-only advisory data
`playbook` is returned to the UI and shown inline with the alert. It is not executed or enforced. v1 does not track whether a playbook step was completed. The `playbook` is stored as a snapshot on `tenant_crisis_templates` and embedded in `alert_rule.metadata.playbook` so the alerting engine can include it in notifications without a runtime join.

---

## Consequences

### Positive
1. **Faster time to protection:** a reputation manager can activate monitoring in under a minute.
2. **Reuses existing primitives:** no new alert engine, no new query engine, no new data pipeline.
3. **Standardization with local control:** defaults are shared, but each tenant's activated template is a separate `watchlist` and `alert_rule` they can edit or delete.
4. **Deferred workflow:** the first version does not enforce playbook SLAs or owner assignment. That remains a future feature.

### Negative
1. **Template parameterization adds interpolation complexity:** mustache-style placeholders must be validated and substituted correctly to keep the watchlist AST valid.
2. **Delivery channels are a hard prerequisite:** the activation request is invalid without at least one `notificationChannelIds` entry.
3. **Playbook and threshold data is duplicated:** the `playbook` snapshot is stored on both `tenant_crisis_templates` and `alert_rule.metadata`, which means changes to the source template do not retroactively affect already-activated templates.

---

## Alternatives considered

1. **Embed templates as hardcoded code instead of database rows.**
   - *Rejected:* it requires a release to change templates and makes per-tenant customization harder.

2. **Create a new `crisis_alerts` table separate from `alert_rules`.**
   - *Rejected:* it duplicates the alerting pipeline. The existing `alert_rule` model already supports threshold, watchlist, and delivery.

3. **Enforce playbook steps as a workflow engine in v1.**
   - *Rejected:* it expands scope dramatically. The first version is a configuration and UI feature, not a workflow orchestrator.

---

## Open questions

- **Which templates ship in v1?** **Five core templates:** Brand Crisis, Product Recall, Executive Attack, Competitor Surge, Data-Breach Rumor. They are seeded via migration/JSON fixtures. A `Platform-Admin` CRUD UI is deferred to v2.
- **Editable by any `tenant_admin` or only creator?** **Standard RBAC:** any `tenant_admin` or `tenant_user` with watchlist/alert permissions can edit or deactivate the generated watchlist and alert rule.
- **How are `default_thresholds` validated?** `default_thresholds` and `customThresholds` are validated against the core `AlertRuleThresholds` JSON Schema/Zod schema before any DB write.
- **Should `competitor surge` require competitor names?** **Yes, mandatory.** The `competitors` variable is required for that template; activation fails without it.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/20-crisis-threshold-wizard.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0044` (Watchlist CRUD), `ADR-0021` (boolean query AST), alert-rule design
