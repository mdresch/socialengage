# ADR-0079: Crisis template bundle and activation

**Status:** Proposed (2026-08-23)

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
A small, platform-wide table stores the default templates. It is not tenant-scoped.

```sql
crisis_templates (
  id uuid,
  template_key text,           -- e.g. 'brand-crisis'
  name text,
  default_query text,          -- human-readable boolean query string
  default_ast jsonb,           -- parsed WatchlistAST
  default_thresholds jsonb,    -- e.g. { volume_spike_pct: 50, negative_sentiment_pct: 60 }
  playbook jsonb,              -- ordered steps with owner, action, sla_minutes
  is_active boolean default true
);
```

### 2. New `tenant_crisis_templates` table for activations
When a tenant activates a template, a row is written and it owns the generated `watchlist_id` and `alert_rule_id`.

```sql
tenant_crisis_templates (
  id uuid,
  tenant_id uuid,
  template_key text,
  watchlist_id uuid,
  alert_rule_id uuid,
  custom_thresholds jsonb,
  created_by_user_id uuid,
  created_at timestamptz
);
```

### 3. Activation flow
`POST /v1/crisis-templates/:templateId/activate`:

1. Look up `crisis_templates` by `template_key`.
2. Create a `watchlist` from `default_ast` (or the user’s customized query) under the caller's `user_id`.
3. Create an `alert_rule` from `default_thresholds` (or customized values) linked to that watchlist.
4. Write the `tenant_crisis_templates` record.
5. Return the new `watchlist`, `alert_rule`, and `tenant_crisis_templates` ids.

### 4. Customization is allowed, not required
The wizard lets the user preview `default_query` and `default_thresholds` and change them before activation. Defaults are not hardcoded per tenant; they are copied from `crisis_templates` at activation time.

### 5. Playbook is read-only advisory data
`playbook` is returned to the UI and shown inline with the alert. It is not executed or enforced. v1 does not track whether a playbook step was completed.

---

## Consequences

1. **Faster time to protection:** a reputation manager can activate monitoring in under a minute.
2. **Reuses existing primitives:** no new alert engine, no new query engine, no new data pipeline.
3. **Standardization with local control:** defaults are shared, but each tenant’s activated template is a separate `watchlist` and `alert_rule` they can edit or delete.
4. **Deferred workflow:** the first version does not enforce playbook SLAs or owner assignment. That remains a future feature.

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

- Which templates ship in v1? Should the list be editable by `Platform-Admin`?
- Should an activated template be editable by any `tenant_admin` or only by the user who activated it?
- How are template `default_thresholds` validated against `alert_rule` capabilities?
- Should `competitor surge` require the user to supply competitor names at activation time?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/20-crisis-threshold-wizard.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0044` (Watchlist CRUD), `ADR-0021` (boolean query AST), alert-rule design
