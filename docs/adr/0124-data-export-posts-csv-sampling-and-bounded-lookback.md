# ADR-0124: Data export — posts CSV sampling and bounded lookback

**Status:** Proposed (2026-08-28)

**Authorizes:** two additive refinements to ADR-0090's `GET /v1/posts/export.csv` contract — an explicit maximum lookback (date-range) bound, and an opt-in sampling mode offered as an alternative to a hard block or forced async hand-off when a request would exceed the synchronous row threshold — driven by competitive research across Brandwatch, Hootsuite, and Meltwater.

**Source:** `docs/product-research/feature-designs/10-data-export.md`, `docs/product-research/feature-adr-scoping.md`, and `docs/product-research/reports/10-data-export-deep-research.md` (generated 2026-08-28)

---

## Context

### 1. ADR-0090 is Accepted and its story is built
ADR-0090 (Accepted 2026-08-28) authorized `GET /v1/posts/export.csv` — its query parameters, CSV column set, RLS/bounding rules, and async hand-off for large exports. Story 10.8 is built and verified (`social-listening-core@fdb9bb8`, 2026-08-28). This ADR does not reopen that endpoint's architecture — it is a refinement layer, informed by a deep research brief generated after ADR-0090's acceptance.

### 2. The research brief confirms the core design and surfaces two concrete gaps
`docs/product-research/reports/10-data-export-deep-research.md` finds `data_export` has 11/12 "yes" support (tied with `real_time_alerts` as the second-most universal feature) and explicitly validates ADR-0090's two-endpoint simplicity against Brandwatch's fragmented per-module export surface as a cautionary counter-example (research finding #1/Implication #1: "resist per-widget export sprawl"). It also surfaces two specific gaps ADR-0090 left unaddressed: no maximum date-range bound distinct from the row/size cap (Implication #2, citing Hootsuite's 18-month Inbox export ceiling), and no alternative to an outright block when a request exceeds bounds (Implication #3, citing Meltwater's sampling-parameter model).

### 3. Blob/SAS lifecycle mechanics are owned elsewhere, not re-decided here
The research brief's Implication #4 (short-TTL, server-generated, rate-limited SAS URLs, per AWS's presigned-URL guidance) bears on export *bounding and streaming* mechanics, which ADR-0111 (Proposed, revised 2026-08-28 in light of this same research) owns. This ADR does not re-decide SAS TTL or Blob lifecycle; see "Relation to ADR-0090" below for the exact scope split.

---

## Decision

This ADR **extends** ADR-0090's Decision. Everything in ADR-0090 §1 (endpoint and query parameters) except the addition below, §2 (CSV columns), §3 (RLS and bounding), §4 (async hand-off mechanics), and §5 (no secrets) carries forward unchanged. See "Relation to ADR-0090" for the precise diff.

### 1. Explicit maximum lookback bound
- `GET /v1/posts/export.csv` and its async sibling now reject a `start`/`end` range wider than a platform-configured maximum lookback, defaulted to **24 months**.
- This is a bound distinct from and in addition to the existing row-count (`limit`) cap in ADR-0090 §1/§3 — a request can be within the row cap but still span an excessive date range (e.g. a low-volume watchlist queried over five years), which the row cap alone does not catch.
- A request exceeding the maximum lookback returns `400 EXPORT_RANGE_TOO_LARGE` with the configured maximum named in the error body, before any query executes.
- The 24-month default is chosen as a concrete, cited enterprise reference point (Hootsuite's Inbox 2.0 CSV export ships an 18-month cap; SocialEngage sets a somewhat more generous but still explicit and bounded figure) — research finding #3/Implication #2.

### 2. Opt-in sampling as an alternative to a hard block
- A new optional query parameter, `sample: boolean` (default `false`), is added to `GET /v1/posts/export.csv`.
- When the matched result set would exceed the synchronous row threshold (owned by ADR-0111) and the caller passes `sample=true`, the endpoint returns a **representative sample** — up to the synchronous threshold's row count, selected via deterministic systematic sampling across the full matched set ordered by `published_at` — instead of forcing the request to async or rejecting it outright.
- Default behavior (`sample` omitted or `false`) is unchanged from ADR-0090/ADR-0111: exceeding the synchronous threshold still triggers the existing async hand-off.
- The sampled response carries an additional response header, `X-SocialEngage-Sampled: true`, and the CSV's own first comment/metadata row (or an equivalent out-of-band marker, left to the implementing story) states the sample fraction, so a consumer cannot mistake a sample for the complete matched set.
- This directly answers the research brief's Implication #3: "offering a representative sample export is friendlier than simply rejecting the request," modeled on Meltwater's max-document-count/percentage sampling parameters for high-volume topics.

### 3. Two-endpoint simplicity — reaffirmed, not changed
- ADR-0090's choice of two clean endpoints (`posts/export.csv` for CSV, `ADR-0074`'s workspace JSON export) over Brandwatch's per-module fragmented export surface is reaffirmed. Future dashboard-widget-level export (if built per ADR-0105's widget contracts) should be implemented as a thin wrapper over this same bounded CSV path, not a new per-widget export subsystem — research finding #1/Implication #1. No change is made here; this is named explicitly so a future reviewer does not mistake silence for an oversight.

---

## Relation to ADR-0090

This ADR is a refinement of ADR-0090 (Accepted 2026-08-28), not a reversal of it. Specifically:

- **ADR-0090 §1** (endpoint and query parameters) is extended with two new query-level controls: the maximum-lookback validation (§1 above) and the opt-in `sample` parameter (§2 above). The existing `watchlistId`, `start`, `end`, `limit`, `format` parameters and their existing semantics are unaffected.
- **ADR-0090 §2** (CSV columns) is unaffected — sampled exports use the exact same column set.
- **ADR-0090 §3** (RLS and bounding) and **§5** (no secrets) are unaffected — sampling and the lookback bound are additional guards layered on top of the existing RLS/redaction rules, not a relaxation of them.
- **ADR-0090 §4** (async hand-off) is unaffected in its own right; the *thresholds* that trigger it are owned by ADR-0111 (Proposed, itself revised 2026-08-28 with the same research), not by this ADR. This ADR's sampling option is an alternative path available *before* that threshold forces a hand-off, not a change to the threshold itself.
- If this ADR is accepted, Story 10.8 (already Built) is **not** retroactively changed — per this series' convention (`docs/adr/README.md`'s row 6 / ADR-0047 §2), already-shipped code changes only when this ADR's own story (Epic 15, below) is actually built.

---

## Consequences

**Positive**
1. **Closes a real enterprise-expectation gap** (an explicit, stated maximum export lookback) using a concrete, cited competitor reference point rather than leaving the bound implicit or unbounded.
2. **Improves UX for high-volume watchlists** — a tenant can get a fast, representative CSV immediately via `sample=true` instead of always waiting on an async job for anything over the sync threshold.
3. **No weakening of existing safeguards** — RLS, redaction, and the row/size caps ADR-0111 owns are all unaffected; this ADR only adds a date-range guard and an opt-in alternative path.
4. **Explicitly reaffirms architectural discipline** (two-endpoint simplicity) against a documented competitor anti-pattern, giving future contributors a citation to point to if asked to fragment export per widget/surface.

**Negative**
1. Deterministic systematic sampling needs a concrete, testable algorithm (e.g. fixed-stride selection over the `published_at`-ordered result set) — specified at the level of intent here, left to the implementing story for exact implementation.
2. The sampled/full distinction must be unambiguous to CSV consumers (BI tools, spreadsheets) that may not parse an HTTP response header — the implementing story must decide the concrete in-file marker convention.
3. A configurable maximum lookback adds one more platform-level setting to document and keep in sync with `ADR-0111`'s and `ADR-0074`'s own bounding rules.

---

## Alternatives considered

1. **Fold these changes directly into ADR-0090 as a dated Revision section instead of a new ADR.**
   - *Rejected:* ADR-0090 is Accepted and its story is Built; per `docs/adr/README.md`'s governance table, an Accepted ADR's Decision/Consequences text is a historical record that stays put. New query-parameter surface (sampling, lookback validation) belongs in a new, still-Proposed ADR, with a Pending supersession note left on ADR-0090 itself.

2. **Make sampling the default behavior whenever the sync threshold is exceeded, rather than opt-in.**
   - *Rejected:* silently substituting a sample for what a caller expects to be the complete matched set is a correctness surprise. Requiring explicit `sample=true` keeps ADR-0090/ADR-0111's existing default behavior (async hand-off) as the safe default, and makes sampling a deliberate, visible choice.

3. **Set the maximum lookback bound to Hootsuite's exact 18 months.**
   - *Rejected:* 18 months is cited as a reference point, not a requirement; SocialEngage sets 24 months as a still-explicit, still-bounded, but more generous default, consistent with the research's own framing of it as "a concrete reference point," not a hard number to copy verbatim.

---

## Open questions

- What is the exact deterministic sampling algorithm (fixed-stride vs. reservoir vs. hash-based) for `sample=true`? Deferred to the implementing story.
- Should the maximum lookback (24 months default) be plan-configurable, mirroring ADR-0112's feature-gating model? Deferred; noted as a natural follow-up once ADR-0112 is accepted.
- What is the exact in-file marker convention communicating "this is a sample" to a CSV consumer with no access to response headers? Deferred to the implementing story.
- Does the DSR self-service portal (`15-dsr-self-service-portal`, named in ADR-0090's own Consequences) ever want `sample=true`? Presumed no (a DSR access response must be complete, not sampled) but not formally decided here.

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/10-data-export.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Deep research brief: `docs/product-research/reports/10-data-export-deep-research.md` (generated 2026-08-28)
- Related ADRs: `ADR-0090` (Accepted 2026-08-28, the ADR this refines), `ADR-0111` (export bounding/streaming/size caps — Proposed, revised 2026-08-28 with the same research, owns SAS TTL and row-threshold mechanics), `ADR-0074` (workspace JSON export), `ADR-0015` (tenant RLS), `ADR-0018` (retention), `ADR-0105` (dashboard widget contracts — future widget-export wrapper reference)
