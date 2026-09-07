---
title: "Implementation Plan — Story 15.1: Real-Time Alert Rule Exclusions, Caps, and Pre-Save Volume Preview (Backend)"
artifact_id: "Plan-Story-15.1"
entity_id: "8c7d312a0bf24b9da761920d3f821c15"
version: "1.0.0"
source_document: "docs/implementation-plans/Plan-Story-15.1-Alert-Rules-Refinements.md"
created_at: "2026-09-07T14:05:00.000Z"
modified_at: "2026-09-07T14:05:00.000Z"
authority_level: 1
confidence_score: 1.0
type: "plan"
status: "Proposed"
pm_class: "DeliveryArtifact"
pm_subclass: "ImplementationPlan"
pm_relationships:
  - plansStory: "[[Story 15.1]]"
  - derivesFromTDS: "[[TDS-0123]]"
  - informsContract: "[[contracts/epic-15/story-15.1.alert-rules-refinements.contract.test.ts]]"
domain_cluster: "Platform Architecture & Foundations"
dmbok_category: "Data Integration & Interoperability"
pmbok_category: "Integration Management"
babok_category: "Requirements Analysis & Design Definition (RADD)"
tags:
  - plan
  - implementation-plan
  - pre-execution
  - story/15.1
  - epic/15
  - dmbok/data-integration-interoperability
  - pmbok/integration-management
  - babok/requirements-analysis-design-definition-radd
  - project/socialengage
---

> [!NOTE] 🔗 **7-Way Heptagonal Traceability Mesh (ADR ↔ BRD ↔ FDD ↔ TDS ↔ Story ↔ Plan ↔ Walkthrough)**
> - 🏛️ **Architecture Decision:** [[ADR-0123|ADR-0123: Real-Time Alert Rules and Delivery — Refinements]]
> - 📋 **Business Requirements:** [[BRD-0123|BRD-0123: Real-Time Alert Rules And Delivery Refinements]]
> - 📐 **Functional Design:** [[FDD-0123|FDD-0123: Real-Time Alert Rules And Delivery Refinements]]
> - 🛠️ **Technical Design (TDS):** [[TDS-0123|TDS-0123: Real-Time Alert Rules & Delivery Refinements]]
> - 🎯 **User Stories & Delivery:** [[Story 15.1]]
> - 📋 **Pre-Execution Blueprint:** [[Plan-Story-15.1-Alert-Rules-Refinements|Plan: Story 15.1]]
> - 📜 **Proof of Execution:** [[Walkthrough-Story-15.1-Alert-Rules-Refinements|Walkthrough: Story 15.1]]

# Implementation Plan — Story 15.1: Real-time Alert Rule Exclusions, Caps, and Pre-Save Volume Preview (Backend)

Implement and verify **Story 15.1** (*Real-time alert rule exclusions, caps, and pre-save volume preview (backend)*), opening **Epic 15** in accordance with the **7-Way Heptagonal Traceability Mesh Protocol**. This implementation is strictly grounded in the Second Brain knowledge graph: [[ADR-0123]], [[BRD-0123]], [[FDD-0123]], [[TDS-0123]], and [[Story 15.1]].

---

## User Review Required

> [!IMPORTANT]
> **Order of Evaluation Invariant & Independent Exclusion Filter (TDS-0123 §2.2 / ADR-0123 §1)**:
> Noise exclusion MUST evaluate *before* threshold evaluation. Watchlists and topics exclusions are **completely independent disjunctive filters**:
> - If an ingested post matches ANY entry in `excluded_watchlist_ids`, it is dropped immediately (`reason: 'MATCHED_EXCLUDED_WATCHLIST'`).
> - If an ingested post matches ANY entry in `excluded_topic_ids`, it is dropped immediately (`reason: 'MATCHED_EXCLUDED_TOPIC'`).
> Neither filter depends on the other; matching *either* independently suppresses the post and guarantees zero records in `tenant_alerts`. A tenant can configure either, both, or neither.

> [!IMPORTANT]
> **Dual Throttling Model (Cap & Cooldown)**:
> A rule fires if and only if BOTH conditions are satisfied:
> 1. Burst spacing: `now - last_triggered_at >= cooldown_minutes`
> 2. Rolling ceiling: `COUNT(tenant_alerts in past 24 hours) < max_alerts_per_day`

> [!NOTE]
> **Read-Only Simulation Preview Invariant**:
> `POST /v1/alert-rules/preview` is strictly idempotent and read-only. It generates zero database mutations, validates lookback window bounds $[1, 30]$ days, and executes with sub-50ms latency using precomputed count views where available.

---

## Proposed Changes

### 1. Database Migration Layer (`social-listening-core/migrations`)

#### [NEW] `0076_add_alert_rules_refinements.sql`
- Alter `alert_rules` table:
  - Add `excluded_watchlist_ids UUID[] NOT NULL DEFAULT '{}'`
  - Add `excluded_topic_ids TEXT[] NOT NULL DEFAULT '{}'`
  - Add `max_alerts_per_day INT NOT NULL DEFAULT 20`
- Create index on `tenant_alerts`:
  - `CREATE INDEX IF NOT EXISTS idx_tenant_alerts_rolling_cap ON tenant_alerts (tenant_id, alert_rule_id, created_at);`

---

### 2. Alert Rules Data Store (`social-listening-core/src/alerts`)

#### [MODIFY] `alertRulesStore.ts`
- Extend `AlertRule`, `CreateAlertRuleInput`, `UpdateAlertRuleInput` interfaces with:
  - `excluded_watchlist_ids: string[]` / `excludedWatchlistIds?: string[]`
  - `excluded_topic_ids: string[]` / `excludedTopicIds?: string[]`
  - `max_alerts_per_day: number` / `maxAlertsPerDay?: number`
- Update `createAlertRule`:
  - Persist `excluded_watchlist_ids`, `excluded_topic_ids`, `max_alerts_per_day` (defaulting to empty arrays and 20).
- Update `updateAlertRule`:
  - Support updating exclusions and daily cap dynamically.
- Update `triggerAlert`:
  - Add optional post context `{ matchedWatchlistIds?: string[]; topicIds?: string[] }`.
  - Suppress if post matches any ID in `rule.excluded_watchlist_ids` or topic in `rule.excluded_topic_ids`.
  - Rolling 24-hour cap enforcement: query `COUNT(*)::int` from `tenant_alerts` where `tenant_id = $1 AND alert_rule_id = $2 AND created_at >= now() - interval '24 hours'`. If count >= `max_alerts_per_day`, suppress firing.
  - Retain existing `cooldown_minutes` check and transactional alert row insertion.

---

### 3. Alert Evaluation & Simulation Engine (`social-listening-core/src/alerts`)

#### [NEW] `alertEvaluationWorker.ts`
- Define TypeScript interfaces per TDS-0123 §3.2:
  - `SensitivityPreset` ('fewer' | 'balanced' | 'more')
  - `AlertRuleRefinements`
  - `AlertRulePreviewRequest`
  - `AlertRulePreviewResponse`
- Export `evaluateRuleForPost`:
  - Evaluates rule against incoming post with strict pipeline order:
    1. Noise Exclusion Check (`excluded_watchlist_ids`, `excluded_topic_ids`)
    2. Rolling 24h Daily Cap Check (`count >= max_alerts_per_day`)
    3. Cooldown Suppression Check (`cooldown_minutes`)
    4. Threshold Evaluator (`volume_spike`, `negative_sentiment_spike`, `negative_sentiment_burst`, `connector_error`)
    5. Fire & Record
- Export `simulateAlertRulePreview`:
  - Validates `lookbackDays` (1 to 30, default 7; returns 400 `INVALID_LOOKBACK_WINDOW` if invalid).
  - Validates `excludedWatchlistIds` (valid UUIDs; returns 400 `INVALID_EXCLUSION_ID` if malformed).
  - Replays historical post counts over the window (leveraging `watchlist_daily_counts` or `social_posts` table), applying exclusions, simulated cooldown, and rolling daily cap.
  - Returns `{ estimatedAlertCount: number, lookbackDays: number, sensitivity?: SensitivityPreset }`.

---

### 4. HTTP API & Routing Layer (`social-listening-core/src/http`)

#### [MODIFY] `alertRulesRouter.ts`
- `POST /rules` & `PATCH /rules/:id`:
  - Accept `excluded_watchlist_ids` / `excludedWatchlistIds`, `excluded_topic_ids` / `excludedTopicIds`, `max_alerts_per_day` / `maxAlertsPerDay`.
  - Validate UUID array format for `excluded_watchlist_ids`.
  - Validate positive integer bounded $[1, 500]$ for `max_alerts_per_day`.
- `POST /preview`:
  - Mount simulation handler executing `simulateAlertRulePreview`.
  - Enforce tenant isolation via caller identity.

#### [MODIFY] `router.ts`
- Mount `v1Router.use('/alert-rules', authMiddleware, alertRulesRouter);` alongside existing `v1Router.use('/alerts', authMiddleware, alertRulesRouter);` so both `POST /v1/alert-rules/preview` and `POST /v1/alerts/rules/preview` route cleanly to the alert rules router.

---

### 5. Contract Testing Layer (`social-listening-core/contracts/epic-15`)

#### [NEW] `story-15.1.alert-rules-refinements.contract.test.ts`
Executable contract test suite asserting:
1. **Schema & CRUD**: Rule creation and patch with `excluded_watchlist_ids`, `excluded_topic_ids`, and `max_alerts_per_day`.
2. **Noise Exclusion**: Post matching excluded watchlist or excluded topic is suppressed and does not fire alert.
3. **Rolling Daily Cap**: Daily cap strictly enforced at `max_alerts_per_day` within 24h rolling window; alerts beyond cap are suppressed.
4. **Dual Throttling**: Cooldown gap spacing works in tandem with daily ceiling.
5. **Simulation Preview Endpoint (`POST /v1/alert-rules/preview`)**:
   - Accurately estimates alert firing count over lookback window (7 days).
   - Validates `lookbackDays` bounds ($[1, 30]$), rejecting out-of-bounds with 400.
   - Validates exclusion UUID format, rejecting malformed IDs with 400.
   - Enforces cross-tenant isolation (foreign tenant posts/counts are ignored).
   - Confirms read-only zero database mutation invariant.

---

### 6. Heptagonal Traceability & Knowledge Graph Synchronization

1. **Pre-Execution Blueprint**:
   - Persist this implementation plan to `wiki/Projects/SocialEngage/04.5 Implementation Plans/Plan-Story-15.1-Alert-Rules-Refinements.md` and `docs/implementation-plans/Plan-Story-15.1-Alert-Rules-Refinements.md`.
2. **Proof of Execution Walkthrough**:
   - Persist walkthrough upon completion to `wiki/Projects/SocialEngage/06.5 Implementation Walkthroughs/Walkthrough-Story-15.1-Alert-Rules-Refinements.md` and `docs/walkthroughs/walkthrough-story-15.1.md`.
3. **Story & Architecture Alignment**:
   - Update `Story 15.1.md` frontmatter (`status: "Built"`, relationships, verifiedBy links).
   - Update `TDS-0123.md` and `ADR-0123.md` with implementation verification links.
   - Run `node scripts/compile-ontology-graph.mjs` ensuring 100% graph health.

---

## Verification Plan

### Automated Tests
1. **Contract Test Execution**:
   ```powershell
   npm test -- contracts/epic-15/story-15.1.alert-rules-refinements.contract.test.ts
   ```
2. **Regression Check**:
   ```powershell
   npm test -- contracts/epic-10/story-10.9.real-time-alert-rules.contract.test.ts
   ```
3. **Typecheck Verification**:
   ```powershell
   npm run typecheck
   ```
4. **Ontology Graph Health**:
   ```powershell
   node scripts/compile-ontology-graph.mjs
   ```

### Manual Verification
- Verify `POST /v1/alert-rules/preview` returns valid estimated alert counts and sensitivity hints without creating database rows.
- Verify `alert_rules` schema in PostgreSQL has correct constraints and indexes.
