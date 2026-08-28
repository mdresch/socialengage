# ADR-0134: Watchlist connector count and preview endpoint — refinements

**Status:** Proposed (2026-08-28)

**Authorizes:** targeted refinements to ADR-0077's `POST /v1/watchlists/preview-volume` endpoint and `SocialConnector.count?()` method — a documented connector-implementation priority order, an explicit confidence-display contract for the UI, and a new, additive `estimatedCost` projection block on the `WatchlistVolumePreview` response.

**Source:** `docs/adr/0077-watchlist-connector-count-method.md` (Accepted 2026-08-23), `26-watchlist-volume-preview-deep-research.md` (Deep Research Brief, Second Brain vault `raw/`, generated 2026-08-28)

---

## Context

### 1. ADR-0077 already shipped
ADR-0077 authorized `POST /v1/watchlists/preview-volume` and the optional `SocialConnector.count?()` method. It was Accepted 2026-08-23 and built the same week (Story 9.1, `social-listening-core@a4bf276`, 2026-08-24). This ADR does not reopen or re-derive that design — it carries forward its Decision, Consequences, and Open Questions unchanged and layers in three refinements surfaced by cross-industry research on pre-commitment sizing tools (ad-platform reach estimators, API count endpoints, cloud-cost calculators).

### 2. Cross-industry research validates the core design and surfaces one real gap
`26-watchlist-volume-preview-deep-research.md` compared ADR-0077's shape against Meta Ads Manager's Estimated Audience Size, Google Ads Reach Planner, X (Twitter) API v2's dedicated Tweet Counts endpoints, X's general (reactive-only) rate-limit model, and AWS Pricing Calculator. Most findings *confirm* ADR-0077's existing decisions: connector-specific `count?()` capability (validated directly by X's own dedicated counts endpoint), `connectorHealthStore`-based internal quota tracking rather than relying on upstream platforms (validated by X's own admission that no general pre-flight quota-check endpoint exists), and a `confidence` enum over a bare number (validated by Meta's deliberate shift away from precise numbers). One finding — AWS Pricing Calculator's "model your solution before building it, with a downstream cost estimate" pattern — identifies a real, currently out-of-scope gap: `FDD-0077` §13 Open Question Q1 explicitly deferred AI-enrichment/storage cost projection as a "future enhancement... out of scope for v1," but the research shows this is a well-precedented, expected extension of exactly this kind of tool, not speculative scope creep.

---

## Decision

### 1. Carried forward from ADR-0077 unchanged
Every element of ADR-0077 Decision §1–§6 (the `count?()` method signature, dry-run/no-side-effects rules, the 50-post fallback sample and extrapolation formula, the `POST /v1/watchlists/preview-volume` endpoint and its request/response shape, the quota/warning thresholds, and two-phase unsupported-query detection) remains exactly as Accepted and built. This ADR adds to that surface; it does not alter any existing field, threshold, or method signature.

### 2. New: documented connector-implementation priority order
Per the X (Twitter) API v2 Tweet Counts precedent — a dedicated, cheaply-billed counts endpoint shipped specifically to answer "how big is this before I fetch it" — connectors are prioritized for `count?()` implementation as follows:
1. **Connectors with a native, cheap count/total-results primitive** (GNews, Newswire, Brave Search, Bing Search, Wikipedia via `recentchanges` totals where available) implement `count?()` first, targeting `confidence: 'exact'`.
2. **Connectors without a native count primitive** (Facebook, Instagram, LinkedIn) rely on the existing sample-and-extrapolate fallback (ADR-0077 Decision §3) from day one; implementing a bespoke `count?()` for these is not required and is not blocked.

This is a priority/sequencing note for connector implementers, not a change to the `SocialConnector` interface or a new requirement on any specific connector.

### 3. New: explicit confidence-display contract for the UI
Per Meta Ads Manager's deliberate shift from a single precise number to a range, and Google Ads Reach Planner's own under-communication of uncertainty despite mature backend forecasting, `VolumePreviewPanel`/`ConnectorVolumeRow` (BRD-0077 §8.1 BR-008) **must** visually distinguish `confidence: 'exact'` from `confidence: 'estimate'` — e.g. `"12,340"` for exact vs. `"~45,000 (estimated)"` for estimate — rather than rendering every `estimatedPosts` value identically. This is a clarification of BR-008's existing "render the preview breakdown and warnings" requirement, made explicit because the research shows even category-leading tools (Google Ads Reach Planner) fail to do this well by default. No backend/API change; `confidence` and `sampleSize` are already returned by ADR-0077's response shape.

### 4. New, additive: `estimatedCost` projection block
```ts
// Extends the existing WatchlistVolumePreview response (ADR-0077 Decision §4) — additive only
{
  totalEstimatedPosts: number;
  breakdown: Array<{ /* unchanged, see ADR-0077 Decision §4 */ }>;
  estimatedCost?: {
    storageGbPerMonth: number;         // projected raw + enrichment storage growth
    aiEnrichmentCallsPerMonth: number; // projected AIProviderConnector calls
    currency: 'USD';
    confidence: 'exact' | 'estimate' | 'unavailable'; // inherits the least-confident connector's rating
  };
}
```
- `estimatedCost` is **optional** and **additive** — its absence is not a breaking change for any existing caller of `POST /v1/watchlists/preview-volume`.
- It is derived from `totalEstimatedPosts` and the tenant's existing per-post storage/enrichment cost constants (no new pricing model is introduced by this ADR — the multiplier source is an implementation detail for the story that builds this).
- `estimatedCost.confidence` is never more confident than the least-confident connector in `breakdown` — an `unavailable` connector in the breakdown makes the whole cost projection `unavailable`, following AWS Pricing Calculator's own principle of not projecting cost from an incomplete usage estimate.
- The response remains a single JSON payload — no separate export endpoint is authorized by this ADR; a CSV/PDF export of the preview, if ever built, is out of scope here.

---

## Relation to ADR-0077

This ADR is an additive refinement of ADR-0077, not a supersession. Every field, method, threshold, and endpoint ADR-0077 authorized remains exactly as accepted and built (Decision §1 above). The three changes are:
1. A non-binding implementation-priority note for connector authors (Decision §2) — no interface change.
2. A clarification of an existing UI requirement (Decision §3) — no API change.
3. One new, optional, additive response field (Decision §4) — no existing field changes shape or meaning.

None of these require revisiting Story 9.1's already-built and shipped contract. If accepted, this ADR's own follow-up story (Epic 18) implements Decision §3 (UI change) and Decision §4 (new backend field + UI rendering) as incremental work on top of the existing, unmodified `WatchlistVolumePreviewService`.

---

## Consequences

**Positive**
1. UI uncertainty communication is made explicit and testable rather than left to interpretation, closing a real gap even mature competitors (Google Ads Reach Planner) leave open.
2. `estimatedCost` directly answers FDD-0077 §13 Q1 ("Should the preview also estimate AI-enrichment cost?") with research-backed confidence that this is expected, not speculative.
3. Zero risk to the already-shipped Story 9.1 contract — additive-only changes.

**Negative**
1. `estimatedCost`'s per-post cost constants need a real source (tenant billing config, or a hardcoded estimate) — this ADR does not pick one; that is left to the implementing story.
2. The confidence-display contract change requires a small frontend update to `ConnectorVolumeRow` even though no backend field changes.

---

## Open questions

Carried forward from ADR-0077's own "Open questions (answered)" table — all remain answered as documented there. This ADR adds one new, owned open item: `estimatedCost`'s per-post cost-constant source is **deferred to the implementing story** (Consequences above), not to a further ADR.

---

## Footnotes

- Original ADR: `docs/adr/0077-watchlist-connector-count-method.md` (Accepted 2026-08-23; built 2026-08-24, Story 9.1)
- Deep research: `26-watchlist-volume-preview-deep-research.md` (Second Brain vault, `raw/`)
- Related feature design: `docs/product-research/feature-designs/26-watchlist-volume-preview.md`
- Related BRD/FDD: `BRD-0077-Watchlist-Connector-Count-Method.md`, `FDD-0077-Watchlist-Connector-Count-Method.md` (each carry a 2026-08-28 dated note pointing here) and this ADR's own `BRD-0134`/`FDD-0134`
