# ADR-0021: Unified boolean-query AST for watchlist matching, with per-connector capability matrix

**Status:** Accepted (2026-07-29) — see Acceptance note below
**Source:** Not specified in the design spec. Flagged in ADR-0006's own Negative consequences ("matching logic now effectively exists in two places... need to behave equivalently... isn't specified here") and expanded on in a third-party architectural review. This ADR originates the policy; it does not document a prior decision.
**Acceptance note:** accepted with whole-query degradation for v1, as drafted — with only two connectors in near-term scope (RSS/News, Reddit; spec §10's committed order), there isn't yet a real case where per-clause degradation would recover meaningful value, and RSS likely has little-to-no native boolean support at all, making it close to "always fallback" regardless. Revisit once a 3rd connector's capability matrix actually shows partial, divergent support — the same rule-of-three trigger `docs/adr/README.md` already applies to the deferred connector-capability-registry idea. `supportedQueryFeatures` surfaces on the connector status page first (already planned admin UI scope for Phase 1, per ADR-0009/0010), plus a lightweight badge on the watchlist detail view ("using post-fetch matching for X") rather than a creation-time blocking warning — meets this ADR's "not silently absorbed" requirement without building creation-flow validation UI ahead of need. See the Amendment Log.

## Context

ADR-0006 established that watchlist matching happens connector-side where a platform supports native query filtering, falling back to post-fetch matching in the core otherwise. Its own Negative consequences already flag the resulting risk directly: matching logic exists in two places (each connector's native-query translation, and the shared post-fetch matcher) that need to behave *equivalently* for the same `Watchlist`, and nothing in the design ensures they actually do, especially for `booleanQuery` (`"acme AND (support OR help) NOT jobs"`) where platforms' native query grammars vary in what they can express.

## Decision

**The durable decision — this is what would need superseding, not just amending:**

A `Watchlist`'s `booleanQuery` (and `terms`/`matchType` generally) is parsed exactly once, at the core layer, into a canonical platform-agnostic abstract syntax tree (AST). Every connector that supports native server-side filtering translates *that same AST* into its own platform's query syntax; the shared post-fetch fallback matcher evaluates *that same AST* directly against normalized post text. Because both paths consume the identical parsed representation, they cannot silently diverge in how they interpret the tenant's query — there is one parse, many translations/evaluations of it, not multiple independent reimplementations of "what does this boolean query mean."

Each connector declares which AST node types it can translate to its platform's native query capability (e.g., a platform whose search API has no `NOT` operator declares that it can't translate `NOT` nodes). Anything a connector can't translate degrades to post-fetch matching, and — critically — this degradation is surfaced to the tenant, not silently absorbed, since a tenant relying on server-side filtering for cost/rate-limit reasons (ADR-0006's original motivation) needs to know when that assumption stops holding for a given platform.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- AST node types for v1: `AND`, `OR`, `NOT`, `TERM`, `HASHTAG`, `ACCOUNT`.
- Degradation granularity: **whole-query**, not per-clause — if any part of a `Watchlist`'s query can't be natively translated for a platform, the *entire* query for that platform falls back to post-fetch matching, rather than natively translating the parts it can and post-fetch-matching only the unsupported clause. Simpler to reason about and to explain to a tenant ("this platform isn't using native filtering for this watchlist") than a mixed per-clause state, at the cost of losing native-filtering's rate-limit benefit (ADR-0006) for the whole query when only one clause is the problem.
- Capability declaration: connectors expose a `supportedQueryFeatures: AstNodeType[]` field (extending the `SocialConnector` interface from ADR-0002) that the core checks against the parsed AST before attempting native translation.

## Consequences

**Positive**
- Closes the exact gap ADR-0006 already flagged: native-path and fallback-path matching are now guaranteed to agree, because they share one parse rather than two interpretations.
- The capability matrix makes platform query limitations an explicit, inspectable fact (useful for the admin UI's connector status view, ADR-0009/ADR-0010) instead of an implicit gap a tenant discovers by noticing inconsistent results.
- A single AST definition is the one place boolean-query semantics need to be specified and tested, rather than semantics being implicitly defined by however many connectors happen to interpret `booleanQuery` strings.

**Negative**
- Building and maintaining a real parser (even a small boolean-expression one) is new, non-trivial infrastructure that didn't exist in the original design.
- Whole-query degradation is a real capability loss for connectors that support most, but not all, AST node types — a platform lacking only `NOT` support loses native filtering entirely for any query using `NOT`, not just the `NOT` clause. Per-clause degradation would recover more of the native-filtering benefit but is materially more complex to implement and to explain to tenants.
- Every connector author now needs to understand and correctly declare `supportedQueryFeatures` — an incorrect declaration (claiming support that doesn't translate correctly) reintroduces exactly the silent-divergence risk this ADR exists to close.

## Alternatives Considered

- **Status quo: per-connector bespoke query translation, no shared AST** — what ADR-0006 currently describes; simplest per-connector, but is the source of the inconsistency risk this ADR addresses.
- **Require every connector to support the full boolean AST** — would eliminate degradation entirely, but is unrealistic given real platform search APIs vary widely in expressiveness (some RSS/newswire aggregators offer no boolean query support at all); would effectively block onboarding weaker-capability platforms.
- **Per-clause degradation instead of whole-query** — preserves more native-filtering benefit, rejected as the v1 default only for implementation simplicity and tenant-facing clarity, not because it's architecturally wrong; worth revisiting once whole-query degradation is shown to matter often enough in practice.

## Open questions for decision

- ~~Is whole-query degradation an acceptable v1 simplification, or does the native-filtering cost benefit (ADR-0006) matter enough that per-clause degradation should be built from the start?~~ **Resolved at acceptance:** whole-query, as drafted — with only RSS/News and Reddit in near-term scope, there isn't yet a real case where per-clause degradation recovers meaningful value; revisit once a 3rd connector's capability matrix shows partial, divergent support (rule of three).
- ~~Where does `supportedQueryFeatures` surface to the tenant — connector status page, watchlist creation UI, both?~~ **Resolved at acceptance:** the connector status page (already planned Phase 1 admin UI scope), plus a lightweight badge on the watchlist detail view — not a creation-time blocking warning, which would be building creation-flow validation UI ahead of need.

## Amendment Log

- 2026-07-28 — Initial proposal: shared AST, whole-query degradation granularity, `supportedQueryFeatures` capability declaration.
- 2026-07-29 — Accepted: whole-query degradation confirmed for v1; `supportedQueryFeatures` surfaces on the connector status page plus a watchlist-detail-view badge, not a creation-time blocking warning.
