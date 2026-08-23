# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0077 Watchlist Connector Count and Preview Volume — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Agent |
| Reviewer(s) | Menno, Product Owner / Technical Lead |
| Status | Approved |
| Related Documents | ADR-0077, BRD-0077, Feature design 26-watchlist-volume-preview, Epic 9 (Story 9.1) |

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer Agent | Finalized to Accepted ADR-0077 and Final BRD-0077. Aligned sample size 50, preview dry-run mode, partial failure handling, rateLimitCost, errorCode/errorMessage, and RequestGate.checkAvailability pre-check. |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates the Accepted ADR-0077 and Final BRD-0077 into a functional design for a watchlist volume preview capability. It describes how the backend exposes `POST /v1/watchlists/preview-volume`, how connectors optionally implement `count?()` and how non-count connectors fall back to a bounded preview sample, and how the UI surfaces per-connector estimates and warnings without persisting preview data.

### 2.2 Scope

**In scope:**

- A new `POST /v1/watchlists/preview-volume` endpoint that accepts `WatchlistAST`, `connectorIds`, and an optional `timeWindow`.
- An optional `SocialConnector.count?()` method for connectors that can return a native search-result count.
- A bounded fallback preview sample of **50 posts** for connectors that do not support counting, with extrapolation from the sample time span to the requested window.
- Preview dry-run semantics: preview calls must pass `mode: 'preview'` / `isDryRun: true` to `poll()` and must not update cursors, watermarks, checkpoints, or high-water marks; preview posts are discarded and not written to `social_posts`, `post_watchlist_matches`, or `outbound_activities`.
- Per-connector `WatchlistVolumePreview` breakdown fields: `connectorId`, `platformId`, `estimatedPosts`, `confidence`, `sampleSize` (where applicable), `rateLimitCost`, `warning`, `errorCode?`, and `errorMessage?`.
- Partial failure handling: a single connector failure is returned as `confidence: 'unavailable'` with `errorCode` and `errorMessage` and does not fail the entire HTTP request.
- Warning thresholds: `high_volume` (>100,000 posts per connector), `quota_risk` (failed `RequestGate.checkAvailability` pre-check, or the preview would consume more than 80% or 5% of the remaining rate-limit budget), and `unsupported_query`.
- `RequestGate.checkAvailability(connectorId, estimatedUnits)` pre-check before executing `count()` or a preview `poll()`.
- Two-phase unsupported-query detection: a shared, zero-API-cost `astCapabilityCheck` followed by connector-specific validation.
- UI support in the watchlist builder to render the preview breakdown and warnings.

**Out of scope:**

- Persisting preview posts to `social_posts`, `post_watchlist_matches`, or `outbound_activities`.
- A historical time-series table for estimate tracking (deferred optimization).
- AI cost projection for storage, compute, or enrichment (future enhancement).
- Blocking activation for high-volume queries; the Tenant-Admin retains the activation decision.
- Public API or integration access for the preview endpoint in v1.

### 2.3 Target Audience

Backend engineers, frontend engineers, QA, product owner, UX, and operations.

---

## 3. Context and Background

When a Tenant-Admin or Tenant-User creates a watchlist, they currently must activate it before they can estimate how many posts the query will pull across the selected connectors. Broad or poorly scoped queries can trigger unexpectedly large ingestion volumes, draining third-party API rate limits, increasing storage and AI-enrichment costs, and generating noise in the post feed.

ADR-0077 addresses this by adding an optional `SocialConnector.count?()` method and a new `POST /v1/watchlists/preview-volume` endpoint that returns a per-connector, tenant-scoped estimate before activation. Connectors that cannot count fall back to a bounded sample of 50 posts and extrapolate. The preview is read-only, does not mutate connector state, and does not persist posts.

- Source: `docs/adr/0077-watchlist-connector-count-method.md` (Accepted 2026-08-23)
- Business requirements: `docs/project docs/Business-Requirements/BRD-0077-Watchlist-Connector-Count-Method.md` (Final v1.0)
- Feature design: `docs/product-research/feature-designs/26-watchlist-volume-preview.md`
- User story: `docs/user-stories/epic-9-adr-0077-to-0085.md` — Story 9.1 (Status: Ready)

---

## 4. Goals and Objectives

|| ID | Goal | Success Criteria |
|---|---|---|---|
|| G1 | Prevent runaway ingestion and rate-limit costs from overbroad watchlists | Number of watchlist activations later manually throttled or disabled due to excessive volume is reduced |
|| G2 | Enable informed, self-service watchlist tuning before activation | Users preview volume at least once before activating a watchlist with more than one connector |
|| G3 | Reduce support and operational overhead from unintended high-volume queries | Fewer support requests tied to unexpectedly large post counts or quota exhaustion |
|| G4 | Preserve connector-specific transparency | Each connector's estimate clearly shows whether it is `exact`, `estimate`, or `unavailable` |

---

## 5. Functional Requirements

### 5.1 Feature: `POST /v1/watchlists/preview-volume`

- **Description:** Accepts a watchlist AST, a list of selected connector IDs, and an optional time window. Returns a `WatchlistVolumePreview` with a total estimate and a per-connector breakdown.
- **Triggers:** User clicks **Preview volume** in the watchlist builder; programmatic callers may call the endpoint directly (internal UI use only in v1).
- **Inputs:**
  - `ast: WatchlistAST`
  - `connectorIds: string[]`
  - `timeWindow?: { start?: ISOString; end?: ISOString }`
- **Processing:**
  1. Authenticate and enforce tenant-scoped RLS.
  2. Validate that each `connectorId` is credentialed and accessible to the caller under existing ownership-tier rules.
  3. Run `astCapabilityCheck(ast, connector.supportedOperators)` for each connector.
  4. For each connector, call `RequestGate.checkAvailability(connectorId, estimatedUnits)` before executing any remote call.
  5. If the connector implements `count?()`, call `count({ ast, timeWindow })`.
  6. Otherwise, fall back to `sample?()` if available, or `poll({ ast, timeWindow, mode: 'preview', limit: 50 })` / `isDryRun: true`.
  7. If the connector does not support `count?()` and the sample is smaller than 50, the sample size is the exact count for that window.
  8. Extrapolate non-count samples using `Cadence (r) = sampleSize / Δt_sample` and `Estimated Posts = r × Δt_requested_window`.
  9. Apply warning thresholds: `high_volume`, `quota_risk`, `unsupported_query`.
  10. Aggregate the breakdown and compute `totalEstimatedPosts`.
- **Outputs:**

```ts
{
  totalEstimatedPosts: number;
  breakdown: Array<{
    connectorId: string;
    platformId: string;
    estimatedPosts: number;
    confidence: 'exact' | 'estimate' | 'unavailable';
    sampleSize?: number;
    rateLimitCost: number;
    warning: 'none' | 'high_volume' | 'quota_risk' | 'unsupported_query';
    errorCode?: string;
    errorMessage?: string;
  }>;
}
```

- **Error handling:** A single connector failure is isolated to its breakdown item (`confidence: 'unavailable'`, `errorCode`, `errorMessage`). The HTTP request as a whole returns 200 with the remaining breakdown. Quota pre-check failures raise a `QuotaExceededPreviewError` internally and are mapped to `warning: 'quota_risk'` / `confidence: 'unavailable'` for that connector. Cross-tenant or unauthorized requests return 403/404.
- **Edge cases:**
  - Connector does not implement `count?()` and does not return any posts in the sample → `estimatedPosts: 0`, `confidence: 'exact'`.
  - Connector returns fewer than 50 posts → `confidence: 'exact'`, `sampleSize` is the actual count.
  - `timeWindow` not provided → connector decides a sensible default (e.g. last 24h) or uses the watchlist's own window.

### 5.2 Feature: `SocialConnector.count?()`

- **Description:** Optional connector method that returns a native count or estimate for a watchlist AST over a time window.
- **Inputs:**

```ts
{
  ctx: ConnectorContext;
  args: { ast: WatchlistAST; timeWindow: TimeWindow };
}
```

- **Outputs:**

```ts
{
  count: number;
  confidence: 'exact' | 'estimate';
  sampleSize?: number;
  rateLimitCost?: number;
  unsupportedOperators?: string[];
}
```

- **Error handling:** The connector may throw or return `unsupportedOperators`; the preview controller maps these to `unsupported_query` or `unavailable` as appropriate.

### 5.3 Feature: Preview dry-run mode

- **Description:** Preview calls must not mutate connector state or persist data.
- **Rules:**
  - If `sample?()` is implemented, the preview controller calls `sample?()` instead of `poll()`.
  - If `poll()` is used, it must receive `mode: 'preview'` / `isDryRun: true` in `ConnectorContext` / `pollArgs`.
  - Connector `poll()` implementations must skip watermark, cursor, checkpoint, and high-water-mark updates when preview mode is active.
  - Posts fetched for the preview sample are not written to `social_posts`, `post_watchlist_matches`, or `outbound_activities`. They are discarded after counting.

### 5.4 Feature: Warning and quota handling

- **Description:** Detect and surface high-volume, quota-risk, and unsupported-query conditions.
- **Rules:**
  - `high_volume` when a single connector's `estimatedPosts` exceeds 100,000.
  - `quota_risk` when `RequestGate.checkAvailability(connectorId, estimatedUnits)` fails, or the preview would consume more than 80% of the connector's remaining rate-limit budget, or more than 5% of the remaining budget.
  - `unsupported_query` when `astCapabilityCheck` or the connector's own validation reports unsupported operators.
- **Outputs:** A `warning` value in each breakdown item.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

|| Actor | Role |
|---|---|
|| Tenant-Admin | Primary decision maker for tenant watchlists; can preview before activating and see per-connector risk |
|| Tenant-User | Builds personal or team watchlists; refines queries based on volume estimates |
|| Tenant-Brand-Reputation-Manager | Quickly scopes crisis or brand watchlists without large data commitments |
|| Tenant-Business-Analyst | Uses the preview to scope exploratory watchlists |

### 6.2 User Stories / Use Cases

|| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|---|
|| Story 9.1 | backend engineer | `SocialConnector.count?()` and `POST /v1/watchlists/preview-volume` to return a per-connector, tenant-scoped estimate of how many posts a watchlist would match | `Tenant-Admin` and `Tenant-Brand-Reputation-Manager` can see expected load before activating a watchlist | `SocialConnector` interface exposes an optional `count?()` method returning `ConnectorCountResult`; at least one existing connector implements `count?()`; connectors without `count?()` fall back to a bounded preview sample of 50 and extrapolate; `POST /v1/watchlists/preview-volume` is tenant-scoped and RLS-gated; partial failures return `confidence: 'unavailable'` with `errorCode`/`errorMessage`; `high_volume`/`quota_risk`/`unsupported_query` warnings triggered per ADR-0077; contract tests cover exact, estimate, fallback, `unavailable`, and cross-tenant cases. |

### 6.3 Workflow: Preview volume before activation

1. User opens the watchlist builder and enters a query.
2. User selects one or more connectors.
3. User clicks **Preview volume**.
4. UI calls `POST /v1/watchlists/preview-volume` with `ast`, `connectorIds`, and optional `timeWindow`.
5. Backend runs connector previews concurrently with `RequestGate.checkAvailability` pre-checks.
6. Backend returns `WatchlistVolumePreview` with `totalEstimatedPosts` and a per-connector breakdown.
7. UI renders the breakdown, warnings, and a total.
8. User refines the query or clicks **Activate**.
9. Activation still uses the existing `POST /v1/watchlists` or `PATCH /v1/watchlists/:id` endpoint.

---

## 7. Data Requirements

### 7.1 Data Inputs

- `WatchlistAST` — boolean query AST from the watchlist builder.
- `connectorIds` — list of selected connector IDs.
- `timeWindow` — optional ISO start/end interval.
- Connector credentials and `RequestGate` budget state.

### 7.2 Data Outputs

- `WatchlistVolumePreview` JSON response.
- Per-connector `ConnectorCountResult` or fallback sample-derived estimate.
- No persisted posts, matches, or outbound activities.

### 7.3 Data Model / Entities

|| Entity | Key Attributes | Relationships |
|---|---|---|
|| `WatchlistAST` | `query` tree, `tenantId` (via RLS) | Supplied by watchlist builder |
|| `ConnectorCountResult` | `count`, `confidence`, `sampleSize?`, `rateLimitCost?`, `unsupportedOperators?` | Returned by `SocialConnector.count?()` or derived from fallback sample |
|| `WatchlistVolumePreview` | `totalEstimatedPosts`, `breakdown[]` | Produced by `WatchlistVolumePreviewService` |

### 7.4 Validation Rules

- `ast` must be a valid watchlist AST.
- `connectorIds` must each resolve to a connector the caller is authorized to use.
- `timeWindow` start, if provided, must not be after end.
- `RequestGate.checkAvailability` must pass before any remote call.

---

## 8. Business Rules and Logic

|| ID | Rule | Applies To |
|---|---|---|---|
|| BR1 | A preview is a read-only, non-persistent operation; it may not create or modify watchlists, posts, or matches, and must run in dry-run preview mode | All preview calls |
|| BR2 | Preview calls use the caller's connector credentials and respect the same ownership tiers and RLS as live ingestion | `WatchlistVolumePreviewService` |
|| BR3 | A connector with `count?()` may return `confidence: 'exact'` or `confidence: 'estimate'` and may also return `rateLimitCost` and `unsupportedOperators` | `SocialConnector.count?()` |
|| BR4 | A connector without `count?()` must fall back to a bounded sample; the default sample size is **50** | Fallback sampling |
|| BR5 | A `high_volume` warning is triggered when a single connector's estimated posts exceed 100,000 | Warning aggregation |
|| BR6 | A `quota_risk` warning is triggered when `RequestGate.checkAvailability` fails, or the preview would consume more than 80% or more than 5% of the connector's remaining rate-limit budget | Warning aggregation |
|| BR7 | An `unsupported_query` warning is triggered when the watchlist AST contains operators the connector cannot evaluate, detected first by `astCapabilityCheck` and then by connector validation | Warning aggregation |
|| BR8 | A connector preview failure is returned as `confidence: 'unavailable'` with `errorCode` and `errorMessage`; it does not fail the entire preview request | Partial failure handling |
|| BR9 | Activation remains a separate, explicit action; warnings do not block activation in v1 | Watchlist builder flow |

---

## 9. Interfaces and Integrations

|| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
|| `WatchlistBuilder` (admin UI) | Outbound | Initiates preview requests | HTTPS / JSON |
|| `POST /v1/watchlists/preview-volume` | Inbound | Receives preview requests | HTTPS / JSON |
|| `WatchlistVolumePreviewService` | Internal | Orchestrates per-connector previews | TypeScript / in-process |
|| `SocialConnector.count?()` | Internal | Native count for supported connectors | TypeScript / Promise |
|| `SocialConnector.sample?()` | Internal | Safe, non-mutating sample if implemented | TypeScript / Promise |
|| `SocialConnector.poll()` | Internal | Fallback preview sample with `mode: 'preview'` / `isDryRun: true` | TypeScript / Promise |
|| `RequestGate` | Internal | Rate-limit pre-check and budget tracking | TypeScript / in-process |
|| `connectorHealthStore` | Internal | Provides remaining rate-limit budget | TypeScript / in-process |

---

## 10. Non-Functional Considerations

- **Performance:** Preview calls must consume no more than 5% of a connector's remaining rate-limit budget. Connector previews run concurrently.
- **Security:** The endpoint is tenant-scoped and RLS-gated; cross-tenant and unauthorized requests return 403/404.
- **Compliance:** Preview data is not retained; sample posts and counts are discarded after the response is returned.
- **Reliability:** The preview degrades gracefully; a single connector failure does not fail the entire request.
- **Maintainability:** Contract tests must cover exact count, estimate, fallback, `unavailable` partial failure, and cross-tenant cases.
- **Accessibility:** The preview table in the UI has clear headers and screen-reader announcements for warnings; mobile view stacks connector rows vertically.

---

## 11. Error Handling and Exceptions

|| Scenario | User-Facing Message | System Behavior |
|---|---|---|---|
|| Single connector `count()` / `poll()` throws | Error shown only for that connector row | Breakdown item set to `confidence: 'unavailable'`, with `errorCode` and `errorMessage`; other connectors still return |
|| `RequestGate.checkAvailability` fails | Quota risk warning on the connector row | `warning: 'quota_risk'`, `confidence: 'unavailable'` |
|| Unsupported operators in AST | Unsupported query warning on the connector row | `warning: 'unsupported_query'`; call may be skipped or short-circuited |
|| Estimated posts > 100,000 per connector | High volume warning on the connector row | `warning: 'high_volume'`; activation is still allowed |
|| Cross-tenant or unauthorized connector | Generic 403/404 | Request rejected before preview execution |

---

## 12. Assumptions and Dependencies

- ADR-0077 is Accepted and implementation is unblocked.
- The watchlist builder already produces a valid watchlist AST and time window.
- Connectors already expose tenant-scoped credentials and a `RequestGate` for rate limiting.
- The `SocialConnector` interface can accept an optional `count?()` method without breaking existing connectors.
- `RequestGate` and rate-limit budget tracking are already in place.
- Users preview before activating; existing activation endpoints remain unchanged.
- Story 9.1 (Watchlist connector count and preview volume endpoint) is Ready and will be implemented after this FDD is approved.

---

## 13. Open Questions

|| ID | Question | Owner | Target Resolution |
|---|---|---|---|
|| Q1 | Should the preview also estimate AI-enrichment cost based on projected post count? | Product Owner | Future enhancement; out of scope for v1 |
|| Q2 | Should a high-volume warning block activation or only require confirmation? | Product Owner | v1: warning only; activation remains explicit |

---

## 14. Appendix

### 14.1 Reference Documents

- ADR-0077 — `../../adr/0077-watchlist-connector-count-method.md` (Accepted 2026-08-23)
- BRD-0077 — `../Business-Requirements/BRD-0077-Watchlist-Connector-Count-Method.md` (Final v1.0)
- Feature design — `../../product-research/feature-designs/26-watchlist-volume-preview.md`
- Feature-to-ADR scoping — `../../product-research/feature-adr-scoping.md`
- User story — `../../user-stories/epic-9-adr-0077-to-0085.md`, **Story 9.1 — Watchlist connector count and preview volume endpoint (Status: Ready)**
- Related skills — `social-listening-core/.claude/skills/watchlist-matching/SKILL.md`, `social-listening-core/.claude/skills/provider-connector-framework/SKILL.md`
- Related source ADRs — ADR-0024, ADR-0026, ADR-0064, ADR-0065, ADR-0066, ADR-0067, ADR-0070, ADR-0059

### 14.2 Glossary

|| Term | Definition |
|---|---|
|| Watchlist | A tenant-scoped boolean query used to continuously ingest matching posts from selected connectors |
|| AST | Abstract syntax tree representing the structured watchlist query |
|| `SocialConnector` | The pluggable backend interface for individual platform connectors |
|| `count?()` | An optional connector method that estimates how many posts a watchlist query would match |
|| `ConnectorCountResult` | A per-connector count result with confidence, optional sample size, rate limit cost, and unsupported operators |
|| `WatchlistVolumePreview` | The aggregated response object from `POST /v1/watchlists/preview-volume` |
|| `previewSampleSize` | The fixed maximum number of posts sampled for connectors that cannot count directly; default **50** |
|| `confidence` | Indicator of estimate quality: `exact`, `estimate`, or `unavailable` |
|| `RequestGate` | The existing rate-limit gate for connector calls |
|| `astCapabilityCheck` | A shared, zero-API-cost check that validates an AST against a connector's `supportedOperators` |
|| `mode: 'preview'` / `isDryRun: true` | A flag passed to `poll()` that prevents watermark, cursor, checkpoint, and high-water-mark updates |
