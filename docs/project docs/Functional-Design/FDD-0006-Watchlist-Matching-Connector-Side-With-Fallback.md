# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0006 Watchlist Matching — Connector-Side with Fallback — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Menno, FDD Writer |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0006 is Accepted; BRD-0006's own document control lists "Draft" but its own Approval section and downstream ADRs treat it as settled — flagged in §13 Open Questions rather than silently overridden) |
| Related Documents | ADR-0006, ADR-0002, ADR-0003, ADR-0021, ADR-0044, ADR-0063, BRD-0006, Story 3.3, Story 3.6 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0006 (prefer connector-side native filtering for watchlist matching, with post-fetch matching as fallback) and BRD-0006 into a functional design for how a single `Watchlist` definition produces consistent matched posts whether a platform can filter natively or not.

### 2.2 Scope

- **In scope:** the decision of whether a given `(connector, watchlist matchType)` pair uses native server-side filtering or core post-fetch matching; connector capability declaration (`supportedQueryFeatures`); the equivalence requirement between the two matching paths; observability of which path was used per run.
- **Out of scope:** onboarding any specific new connector; the watchlist query-builder UI (ADR-0021/Story 3.6 territory); alerting/case-routing/downstream analytics on matched posts; the canonical boolean-query AST itself (ADR-0021, consumed here but designed separately); the `post_watchlist_matches` junction table schema details (ADR-0063).

### 2.3 Target Audience

Connector developers deciding whether their platform needs native translation or the fallback path; core backend engineers maintaining the shared post-fetch matcher; QA engineers proving equivalence between the two paths; tenant admins relying on watchlists behaving the same regardless of source platform.

---

## 3. Context and Background

- **Problem/opportunity:** watchlists support four match types (`keyword`, `hashtag`, `account`, `boolean`) scoped to a subset of connected platforms. Platforms differ in what filtering they support natively — some accept a query syntax at the API/webhook level, others return an unfiltered stream that must be matched client-side. Fetching everything and discarding mismatches wastes rate-limit budget and bandwidth, which matters most on quota-constrained platforms (e.g., YouTube's daily quota-cost model).
- **Business/user value:** native filtering avoids paying rate-limit cost for posts that will just be discarded; the post-fetch fallback means watchlists still work uniformly across every platform, including ones whose API can't express boolean queries, without forking the `Watchlist` model per platform.
- **Source requirements:** ADR-0006; BRD-0006 (BR-001–BR-007, BRU-001–BRU-005); Story 3.3 (built `social-listening-core@f3254d9`), Story 3.6 (ADR-0021, shipped 2026-07-30, closing the equivalence question more rigorously for boolean-query AST matching).
- **Constraints/dependencies:** matching logic now effectively exists in two places (per-connector query translation, and a shared post-fetch matcher), which must behave equivalently for the same `Watchlist` or tenants see inconsistent results depending on which platform matched a post; boolean query semantics must be translatable into every supported platform's native syntax where available, and platforms with weaker query grammars may only support an approximation — a gap this ADR flags but does not fully resolve (documented per-connector).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Reduce rate-limit cost/bandwidth spent fetching non-matching posts | Percentage of connector calls filtered natively on supported platforms; reduced quota consumption per matched post |
| G2 | Preserve uniform watchlist behavior across all supported platforms | A given watchlist produces the same matched posts against the same input data regardless of matching path used |
| G3 | Avoid per-platform watchlist model divergence | The `Watchlist` schema remains unchanged as new connectors are added |
| G4 | Make fallback usage visible and auditable | Operators/tenants can see which watchlist+platform pairs use post-fetch fallback |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Connector capability declaration (`supportedQueryFeatures`)

- **Description:** each connector declares which watchlist match types (and, for boolean queries, which AST node types per ADR-0021) it can honor via the platform's own native query syntax.
- **Triggers:** connector registration/implementation time; consulted by the pipeline whenever a watchlist is applied against that connector's platform.
- **Inputs:** the connector's own knowledge of its platform's query capabilities.
- **Processing:** the connector exposes a `supportedQueryFeatures` declaration; the framework reads it to decide, per `(connector, watchlist.matchType)` pair, whether native translation or post-fetch matching applies.
- **Outputs:** a routing decision consumed by 5.2/5.3.
- **Error handling:** a connector claiming support for a match type it cannot actually honor is a defect caught by equivalence contract tests (5.4), not a runtime condition.
- **Edge cases:** a connector that partially supports a match type (e.g., keyword but not boolean) — routes keyword watchlists natively and boolean watchlists to fallback, per its own declared granularity.

### 5.2 Feature / Capability: Native connector-side query translation

- **Description:** for platforms that support it, the connector translates a `Watchlist`'s terms/boolean query into the platform's own native query syntax and includes it in the outbound fetch/subscription request.
- **Triggers:** an ingestion cycle for a connector whose `supportedQueryFeatures` covers the active watchlist's `matchType`.
- **Inputs:** the `Watchlist` definition (terms, `booleanQuery`, `matchType`); the platform's native query grammar.
- **Processing:** translate the watchlist's terms/boolean AST into the platform's native syntax; send the translated filter with the outbound request so the platform itself returns only matching results (or a close approximation, per any documented semantic gap).
- **Outputs:** an outbound request that already carries the platform-native filter; posts returned are presumed already matched, subject to the platform's own filtering accuracy.
- **Error handling:** a watchlist query that cannot be translated into the platform's native syntax (e.g., unsupported boolean operator) is a non-retryable failure for that run — surfaced with a clear `errorSummary`, not silently ignored or blindly retried (BR-007/BRU-004).
- **Edge cases:** a platform whose native grammar can express only an approximation of the requested boolean semantics — the gap must be documented per-connector; the design does not mandate perfect fidelity, only that any gap is known and surfaced, not silently absorbed.

### 5.3 Feature / Capability: Core post-fetch matching (fallback)

- **Description:** for platforms without native filtering support for a given match type, the connector fetches the available stream unfiltered, and the core evaluates the `Watchlist` against each normalized `SocialPost` before persisting a match.
- **Triggers:** an ingestion cycle for a connector whose `supportedQueryFeatures` does not cover the active watchlist's `matchType`.
- **Inputs:** the normalized `SocialPost` stream from the connector; the `Watchlist` definition.
- **Processing:** for each normalized post, evaluate the watchlist's terms/boolean query against the post's text and relevant metadata using the shared, tenant-isolated post-fetch matcher; persist only posts that match as watchlist matches.
- **Outputs:** matched `SocialPost` records identical in shape and content to what native filtering would have produced for the same input data.
- **Error handling:** a post that fails to evaluate cleanly (e.g., malformed normalized text) is treated per the pipeline's general error handling, not specific to matching.
- **Edge cases:** a watchlist with `matchType: 'boolean'` against a connector with no boolean support at all — the entire boolean AST is evaluated in the fallback matcher; per ADR-0021/Story 3.6, this is treated as an independent, more rigorously specified matching mode for boolean queries specifically, layered on top of this ADR's original keyword/hashtag/account (OR-only) equivalence guarantee from Story 3.3.

### 5.4 Feature / Capability: Native/fallback equivalence guarantee

- **Description:** the same `Watchlist`, applied to the same underlying input data, must produce the same matched-post set whether matching happened natively (connector-side) or via the core fallback matcher.
- **Triggers:** any watchlist that could plausibly be served by either path (i.e., its `matchType` is supported natively by some connectors and not others).
- **Inputs:** identical input post data fed through both the native-translation path (mocked/simulated platform) and the fallback matcher.
- **Processing:** contract tests compare native-path results against fallback-path results for the same watchlist and input data, asserting they match exactly (for the Story 3.3 OR-only keyword/hashtag/account shape) or per the AST-level equivalence Story 3.6/ADR-0021 established for boolean queries.
- **Outputs:** a permanent regression-suite guarantee that the two matching implementations do not silently diverge.
- **Error handling:** a detected divergence between native and fallback results is a contract-test failure, blocking release — this is the primary defense against the "matching logic exists in two places" risk this ADR names directly.
- **Edge cases:** a platform's native grammar can only approximate the requested boolean semantics (5.2's edge case) — in that specific, documented case, exact equivalence is not expected; the gap itself, not silent divergence, is what must be visible.

### 5.5 Feature / Capability: Matching-path observability

- **Description:** for every ingestion run, the system records which matching path (native or fallback) was used, and how many posts were fetched, matched, and skipped.
- **Triggers:** the close of an `IngestionRun` (ADR-0005) for an execution that applied one or more watchlists.
- **Inputs:** counts accumulated during the run; the matching path used for the applicable watchlist/connector pair.
- **Processing:** populate `IngestionRun`'s existing `postsIngested`/`postsSkipped` fields (ADR-0005) plus a record of which matching path applied; surface fallback usage in connector health/status views (BR-006).
- **Outputs:** operator- and tenant-visible signal of which watchlist+platform combinations are relying on fallback matching rather than native filtering.
- **Error handling:** missing or inconsistent path/counts data is an observability gap to fix, not something the matching logic itself depends on functioning.
- **Edge cases:** a run that uses native filtering for one watchlist and fallback for another simultaneously (multiple active watchlists against the same connector) — both are recorded distinctly, not merged into one ambiguous value.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant Admin | Configures a `Watchlist`, expecting it to work uniformly across every connected platform |
| Connector Developer | Implements native query translation and declares `supportedQueryFeatures` for a platform |
| Core Backend Engineer | Maintains the shared post-fetch fallback matcher |
| Platform Operator | Monitors fallback usage and rate-limit cost implications |
| QA / Contract Engineer | Maintains equivalence contract tests between native and fallback paths |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 3.3) | tenant configuring a watchlist | have matching happen on the platform's own server when it supports query filtering, falling back to post-fetch matching in the core when it doesn't | rate-limit budget isn't spent fetching posts that don't match, wherever that's avoidable | (1) connectors that translate terms include the filter in outbound requests; (2) connectors without native support have the core evaluate every fetched post before persisting matches; (3) a given `Watchlist` produces the same matched posts regardless of source platform (for the OR-only keyword/hashtag/account shape); (4) no matching posts lost to translation errors; (5) rate-limit cost/bandwidth not spent where native filtering is available; (6) matching path used per run is recorded and queryable |
| US2 (Story 3.6, ADR-0021) | tenant using a boolean-query watchlist | have the boolean AST matched consistently regardless of platform | boolean queries behave the same everywhere, with a more rigorous equivalence guarantee than the original OR-only shape | Story 3.6's own acceptance criteria (ADR-0021/FDD-0021) — an independent, parallel matching mode, not a replacement of Story 3.3's |

### 6.3 Workflow Diagrams / Steps

**Workflow: Applying a watchlist during ingestion**

1. Ingestion pipeline loads the active `Watchlist`(s) scoped to the platform being polled/pushed.
2. For each watchlist, the pipeline checks the connector's `supportedQueryFeatures` against the watchlist's `matchType`.
3. If supported natively: connector translates the watchlist into the platform's native query syntax and includes it in the outbound request (5.2). Returned posts are treated as already matched.
4. If not supported natively: connector fetches the unfiltered/available stream; the core's post-fetch matcher evaluates each normalized post against the watchlist before persisting a match (5.3).
5. The `IngestionRun` records fetched/matched/skipped counts and which matching path was used (5.5).
6. A malformed or non-translatable watchlist query fails that run's matching step with a clear, non-retryable error recorded in `errorSummary` (5.2 error handling).

**Workflow: Verifying native/fallback equivalence (build-time)**

1. QA/contract test feeds identical input post data through both a mocked fully-native platform and a mocked no-native-support platform for the same watchlist.
2. Test asserts the two matched-post sets are identical (Story 3.3 shape) or AST-equivalent (Story 3.6/ADR-0021 shape).
3. A divergence fails the build, preventing release.

---

## 7. Data Requirements

### 7.1 Data Inputs

`Watchlist` definition (`matchType`, `terms`, `booleanQuery`, `platformIds`); connector `supportedQueryFeatures` declarations; normalized `SocialPost` stream from connectors.

### 7.2 Data Outputs

Matched `SocialPost` records (via native filtering or fallback matching); `IngestionRun` fields recording fetched/matched/skipped counts and matching path used; connector health/status signals showing fallback usage per platform.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `Watchlist` | `id`, `tenantId`, `name`, `matchType` (`keyword`\|`hashtag`\|`account`\|`boolean`), `terms`, `booleanQuery`, `platformIds`, `isActive` | Applied against every connector in `platformIds`; shared schema across native and fallback paths (BRU-003) |
| `supportedQueryFeatures` | connector-declared set of match types/AST node types it can honor natively | Owned by each `SocialConnector` (ADR-0002); consulted per watchlist application |
| `SocialPost` (matched) | normalized post text/metadata; linked to the watchlist(s) it matched | Produced by either native-filtered fetch or fallback matcher; content is identical regardless of path |
| `IngestionRun` (extended usage) | `postsIngested`, `postsSkipped`, matching path used | Existing entity from ADR-0005; this ADR adds path observability to it |

### 7.4 Validation Rules

- A connector whose `supportedQueryFeatures` includes the watchlist's `matchType` must use native server-side filtering when available (BRU-001).
- If a connector does not support the watchlist's terms natively, the core post-fetch matcher must evaluate the normalized post's text and relevant metadata (BRU-002).
- The `Watchlist` definition is shared across all platforms; per-platform query differences are handled inside the connector, never by changing the watchlist schema (BRU-003).
- Non-retryable failures, including malformed or non-translatable watchlist queries, must be surfaced to the tenant and must not trigger blind retry (BRU-004).
- The same watchlist must produce the same matched-post set for the same underlying input data, regardless of which matching path was used (BRU-005), subject to the documented approximation exception in 5.2/5.4.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A connector whose declared capabilities cover a watchlist's `matchType` must use native filtering, not fallback, when available. | Connectors |
| BR2 | A connector without native support for a watchlist's terms routes to core post-fetch matching. | Connectors, core matcher |
| BR3 | The `Watchlist` schema is never forked per platform to accommodate connector query capability differences. | `Watchlist` model |
| BR4 | Native and fallback matching must produce equivalent results for the same watchlist and input data. | Both matching paths |
| BR5 | Malformed or non-translatable watchlist queries fail with a clear, non-retryable error, never a silent retry loop. | Ingestion pipeline |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Platform API/webhook (per connector) | Outbound from core | Carries the translated native filter when supported | Platform-specific REST/query syntax |
| `SocialConnector` (ADR-0002) | In-process | Source of `supportedQueryFeatures` and `normalize()` output | In-process |
| `RequestGate` (ADR-0003) | In-process | Rate-limit cost this ADR's native-filtering preference helps minimize | In-process |
| Boolean-query AST (ADR-0021) | In-process | Canonical representation consumed for boolean-query translation/fallback | In-process |
| `IngestionRun` (ADR-0005) | In-process | Records matching-path observability data | In-process |
| `post_watchlist_matches` (ADR-0063) | In-process | Stores the resulting match records | Postgres |

---

## 10. Non-Functional Considerations

- **Performance:** fallback matching must not cause the ingestion pipeline to exceed documented p95 latency for supported volume (NFR-002); native filtering directly reduces wasted fetch/compute on quota-constrained platforms.
- **Security/access control:** post-fetch matching is tenant-scoped — one tenant's watchlist matching must not access or affect another tenant's data (NFR-001).
- **Scalability:** heavy reliance on post-fetch matching increases core compute; per-connector fallback rate should be monitored so optimization (caching/indexing) can be targeted where needed.
- **Reliability/availability:** both matching paths are exercised by a permanent regression suite (NFR-004) to guard against silent divergence.
- **Audit and logging:** every `IngestionRun` records posts fetched, matched, skipped, and which path was used (NFR-003), queryable by operator dashboards.
- **Accessibility/localization:** not applicable to the matching engine itself; any UI surfacing fallback usage inherits the admin UI's own standards.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Watchlist query cannot be translated into a platform's native syntax | Non-retryable failure surfaced to the tenant, reason recorded | Run fails that watchlist's matching step; `errorSummary` records the cause; no blind retry (BR5) |
| Native and fallback paths produce different matched-post sets for the same input (defect) | N/A (caught in contract tests) | Contract test failure blocks release; not something that should reach production |
| A platform's native grammar can only approximate the requested boolean semantics | Documented per-connector limitation, surfaced where relevant | Accepted, documented gap — not treated as silent divergence |
| Connector declares `supportedQueryFeatures` it cannot actually honor | N/A (caught by equivalence tests) | Treated as a connector defect to fix |
| Post fails to evaluate cleanly during fallback matching | Handled per general pipeline error policy | Not specific to matching; follows ADR-0010/ADR-0023 |

---

## 12. Assumptions and Dependencies

- The `Watchlist` model includes `matchType`, `terms`, `booleanQuery`, and `platformIds`.
- Each connector can declare which query features it supports natively.
- The core can access normalized post text, metadata, and platform identifiers to perform post-fetch matching.
- Rate-limit and cost discipline (ADR-0003) is already enforced by the connector framework.
- Dependency: ADR-0002 supplies the connector contract this pattern layers on top of.
- Dependency: ADR-0021 supplies the canonical boolean-query AST and capability matrix that Story 3.6 uses to give boolean queries a more rigorous equivalence guarantee than Story 3.3's original OR-only shape.
- Dependency: ADR-0005 supplies `IngestionRun`, extended here with matching-path observability.
- Dependency: ADR-0063 supplies the `post_watchlist_matches` junction table storing match results.
- Dependency: ADR-0044 defines the `Watchlist` API/schema this ADR's matching logic operates against.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | BRD-0006's own Document Control table lists Status "Draft" while its Approval section and every downstream ADR (0021, 0044, 0063) treat this decision as settled and built — should the BRD's status field be corrected? | Documentation Steward | Flagged here rather than silently assumed; does not block this FDD, since the source ADR-0006 itself is Accepted |
| Q2 | What is the exact, per-connector documented list of boolean-semantic approximation gaps referenced in ADR-0006's Consequences? | Connector Developer(s) | Tracked per-connector, not centrally, per BRD-0006's own Out-of-Scope note |

---

## 14. Appendix

- **Glossary:** see BRD-0006 §15 (Watchlist, Match type, Connector-side matching, Post-fetch matching, Native query syntax, `supportedQueryFeatures`, Boolean AST, Normalized post, Rate-limit cost).
- **Reference links:** `docs/adr/0006-watchlist-matching-connector-side-with-fallback.md`; `docs/project docs/Business-Requirements/BRD-0006-Watchlist-Matching-Connector-Side-With-Fallback.md`; `docs/user-stories/epic-3-data-model-storage-and-archival.md` (Story 3.3); `docs/adr/0021-watchlist-boolean-query-ast-and-capability-matrix.md`; `docs/adr/0002-unified-provider-connector-pattern.md`; `docs/adr/0003-per-tenant-per-provider-rate-limiting.md`; `docs/adr/0005-ingestion-run-as-audit-anchor.md`.
- **Feature design/deep research:** none found — BRD-0006 Appendix E confirms no `docs/product-research/feature-designs/` or `reports/` file exists specific to connector-side watchlist matching; rationale is captured directly in the design spec (§4.4) and the ADR.
- **Diagrams:** none beyond the workflow steps in §6.3.
- **Revision history:** v1.0, 2026-08-23 — regenerated from ADR-0006/BRD-0006/Story 3.3 (and Story 3.6/ADR-0021 cross-reference) to replace a defective prior version that copied the BRD's flat requirements table instead of a per-capability functional breakdown.
