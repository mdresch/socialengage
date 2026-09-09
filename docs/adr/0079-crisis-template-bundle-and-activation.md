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

## Open Questions

- [x] **[Q-0079-1]** ~~**Which templates ship in v1?**~~ **Resolved by ADR-0131:** Five core templates specified (Brand Crisis, Product Recall, Executive Attack, Service Outage, Regulatory Inquest). **Five core templates:** Brand Crisis, Product Recall, Executive Attack, Competitor Surge, Data-Breach Rumor. They are seeded via migration/JSON fixtures. A `Platform-Admin` CRUD UI is deferred to v2.
- [x] **[Q-0079-2]** ~~**Editable by any `tenant_admin` or only creator?**~~ **Resolved by ADR-0131:** Standard Tenant-Admin RBAC governs activation and customization. **Standard RBAC:** any `tenant_admin` or `tenant_user` with watchlist/alert permissions can edit or deactivate the generated watchlist and alert rule.
- [x] **[Q-0079-3]** ~~**How are `default_thresholds` validated?**~~ **Resolved by ADR-0131:** `default_thresholds` and `customThresholds` validation schemas locked. `default_thresholds` and `customThresholds` are validated against the core `AlertRuleThresholds` JSON Schema/Zod schema before any DB write.
- [ ] **[Q-0079-4]** **Should `competitor surge` require competitor names?** **Yes, mandatory.** The `competitors` variable is required for that template; activation fails without it.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/20-crisis-threshold-wizard.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0044` (Watchlist CRUD), `ADR-0021` (boolean query AST); see the 2026-08-25 Correction below on the "alert-rule design" reference that used to sit here — no such accepted ADR existed at acceptance time.

---

## Correction (2026-08-25) — Context §2 was factually inaccurate at acceptance

Found by an `implement-story` agent that stopped rather than freelance a schema decision for Story 9.3, and confirmed independently by grep across both repos' `src/`, `migrations/`, and `contracts/` (2026-08-25):

**Context §2's claim — "`ADR-0044` and the built watchlist/alert infrastructure provide the underlying tables and endpoints" — is wrong.**

- `ADR-0044` (`docs/adr/0044-watchlist-api-design-and-database-schema-standardization.md`) is the `watchlists` CRUD/schema contract only. It never mentions `alert_rule` anywhere in its Decision, Appendices, or Amendment Log.
- **No `alert_rules` table, no `AlertRule` type, and no notification-channel concept exist anywhere** in `social-listening-core/src`, `social-listening-core/migrations`, `social-listening-admin/src`, or either repo's `contracts/` — zero matches on `alert_rule`, `AlertRule`, `notificationChannel`, or `notification_channel` project-wide, verified 2026-08-25.
- The real owning ADR for alert rules and delivery is **ADR-0091** (`docs/adr/0091-real-time-alert-rules-and-delivery.md`) — **Status: Proposed**, not Accepted — and its corresponding **Story 10.9** (`docs/user-stories/epic-10-adr-0086-to-0094.md`) is explicitly **"Blocked — pending ADR acceptance."** ADR-0091's own design (rule types `volume`/`sentiment`/`keyword`/`topic`/`connector-health`, an `AlertEvaluationWorker`, `tenant_alerts`, cooldowns) is materially richer than anything this ADR itself specified for `alert_rule`.
- The former Footnotes entry "alert-rule design" (removed above, preserved here for the record) pointed at nothing — no accepted ADR for alert rules existed when this ADR was accepted on 2026-08-23.

Per `docs/adr/README.md`'s "Conventions for changing an existing ADR" — the common thread that original Decision/Consequences text is a historical record and stays put — the Decision, Consequences, and Alternatives-considered sections above are **not rewritten**. This Correction documents that Context §2's stated reasoning was wrong; the Amendment immediately below is what actually changes the live contract.

## Amendment (2026-08-25) — v1 Decision rescoped: activation creates a `watchlist` only; `alert_rule` deferred to ADR-0091

**Resolution: Defer.** Two options were weighed:

1. **Defer** (chosen) — rescope v1 so activation creates only the `watchlist`; store thresholds and notification-channel *intent* as data on `tenant_crisis_templates` for later use; real `alert_rule` wiring becomes a named follow-on once ADR-0091 is accepted and Story 10.9 is built.
2. **Minimal now** — define a deliberately narrow `alert_rules` table scoped strictly to what this ADR needs, explicitly provisional, expected to be extended once ADR-0091 lands.

**Why Defer, not Minimal-now:**

1. ADR-0091 is Proposed, not Accepted, and specifies a materially richer `alert_rules` design (§Decision above) than anything this ADR itself scoped. Building a narrower, ADR-0079-only `alert_rules` table now creates a second, competing schema under the same table name that ADR-0091 would then have to reconcile with or replace outright — the same speculative-infrastructure-ahead-of-an-accepted-design risk `ADR-0020` (distributed rate-limit gate) was deliberately deferred to avoid, and this project's established general bias against building provisional infrastructure ahead of an accepted design.
2. The "minimal now" alternative also silently depends on a notification-channel concept — something to validate/resolve `notificationChannelIds` against — that **does not exist anywhere in the codebase either** (verified 2026-08-25, same grep pass as the Correction above). FDD-0079 §9 asserts a "Notification-channel service (existing)" — that is also incorrect and is corrected in FDD-0079's own amendment. Building even a minimal `alert_rules` table now would require inventing a notification-channel registry that no accepted ADR defines — real scope creep beyond what this ADR itself set out to decide.
3. Nothing about the wizard's core value (fast, one-click activation of a preconfigured watchlist with a linked playbook) requires alert delivery to exist yet. The watchlist alone is functional and independently useful; alert delivery is additive, not load-bearing for v1's stated business objectives except the "protection" framing named as a negative consequence below.

**Revised v1 Decision** (this section is the live contract for the `alert_rule`-touching portions of §2 and §3 above, per `ADR-0047` §4's "last dated appendix is the live contract" — the original text above is unedited historical record):

1. **§2's `tenant_crisis_templates` table drops the `alert_rule_id uuid REFERENCES alert_rules(id) ON DELETE CASCADE` column.** In its place:
   - `notification_channel_ids jsonb` — the caller's requested destinations, stored as **intent only**, not resolved or validated against any real channel/delivery mechanism (none exists).
   - `thresholds jsonb` — the effective thresholds (`default_thresholds` merged with any `customThresholds`), stored unchanged so they are available once real alert-rule wiring lands.
2. **§3's activation flow drops step 5** ("Create an `alert_rule` from `default_thresholds`… linked to the new watchlist."). The single transaction now writes only the `watchlist` and the `tenant_crisis_templates` row (carrying `thresholds` and `notification_channel_ids` as stored data, not a live, evaluating alert).
3. **§3's response contract drops `alertRuleId`.** Revised response: `{ tenantCrisisTemplateId, watchlistId, status: 'active', playbook, thresholds, notificationChannelIds }`. No `alert_rule` is created; the response must not imply one exists.
4. **`notificationChannelIds` remains a required activation-request field** (original §3's "required" rule is unchanged) — captured now as stated intent, not silently dropped, so the eventual ADR-0091 integration doesn't need a separate backfill migration for intent that was never captured.
5. **§4 ("Customization is allowed") and §5 ("Playbook is read-only advisory data") are unaffected** — both already only ever touched `watchlist`/`tenant_crisis_templates` data, not `alert_rule`.

**Pending supersession note, per `docs/adr/README.md` row 5** (a still-Proposed ADR — `ADR-0091`, Proposed 2026-08-23 — would change part of this Decision if accepted): once `ADR-0091` is Accepted **and** its **Story 10.9** is actually built (per `docs/adr/README.md` row 6 / `ADR-0047` §2 — acceptance alone does not change shipped behavior), a follow-on story, not yet numbered, wires crisis-template activation to create a real `alert_rules` row from `tenant_crisis_templates.thresholds` and `.notification_channel_ids`, and backfills `alert_rule_id`-equivalent linkage for activations that predate that story. This note will get a dated "Supersession update" here once `ADR-0091` is actually accepted, following the same pattern `ADR-0009`'s Pending-supersession-note → Supersession-update → implementation-confirmation sequence already established in this project.

**Consequences of this amendment (additive to the original Consequences section above):**

- *Positive:* v1 ships without inventing a second, throwaway `alert_rules`/notification-channel schema that `ADR-0091` would need to reconcile with or discard later; the ADR is now honest about what infrastructure actually exists.
- *Negative:* v1 crisis-template activation **does not deliver real-time alerts.** A `Tenant-Brand-Reputation-Manager` who activates a template gets monitoring (the `watchlist`) but no notification until the `ADR-0091` follow-on ships. This must be stated plainly in the wizard UI (Story 9.4), not left implicit — see that story's revised Acceptance Criteria.
- *Negative:* Business Objective framing that promised "faster time to **protection**" (BRD-0079 §3, Objective 1) overstates v1 delivery — the BRD is corrected accordingly below.

## Amendment Log

- 2026-08-25 — Correction (Context §2 factual error) and Amendment (v1 Decision rescoped to defer `alert_rule` creation to `ADR-0091`) — see sections above. Drafted by the Business & Requirements Analyst persona in response to an `implement-story` agent that stopped rather than freelance a schema decision for Story 9.3; requested directly by Menno. This ADR remains **Accepted** — the amendment rescopes v1's implementation surface, it does not reopen or reverse the core decision to ship a crisis-template-activation feature.

### Pending supersession note (2026-08-28)

If ADR-0131 (Proposed, 2026-08-28) is accepted, this ADR's Decision §2 would be refined by ADR-0131's own §1–§3 — specifically auto-calibrated threshold baselines from trailing 14-day standard deviation and multi-recipient escalation trees. This is a pending note only: ADR-0131 is currently Proposed, not accepted.