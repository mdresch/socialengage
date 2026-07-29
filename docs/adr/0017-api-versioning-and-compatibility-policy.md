# ADR-0017: API versioning and compatibility policy

**Status:** Accepted (2026-07-29) — decided ahead of its natural implementation phase (see below)
**Source:** Not specified in the design spec or the linked design conversation. This ADR originates the policy; it does not document a prior decision. Flagged as a gap in ADR-0001's Negative consequences and independently identified in a Copilot review of this ADR series.
**Acceptance note:** accepted deliberately early, in Phase 0 of `docs/implementation-plan.md`, rather than in whatever phase would otherwise touch API versioning — this is cheap to build in from the start (a `/v1/` prefix on every route) and materially more expensive to retrofit once real endpoints and consumers exist. The 90-day deprecation window below is still an implementation default, adjustable via the Amendment Log without reopening acceptance.

## Context

`social-listening-core`'s REST API (§6) is already consumed by a second, independently deployable repository (`social-listening-admin`, ADR-0001), and per §1/§7 will eventually be consumed by further independently deployable subsystems (Brand Reputation & Alerts, Social Care, Social Selling) that read from it directly rather than through the admin UI. None of those consumers share a deploy with `social-listening-core`. Without a stated compatibility policy, a change to the API that's convenient for the next feature can silently break a consumer that isn't in the room when the change is made.

## Decision

**The durable decision — this is what would need superseding, not just amending:**

The API must support breaking-change evolution through explicit versioning, under an additive-first compatibility rule: within a version, only backward-compatible changes are allowed (new optional fields, new endpoints, new optional query parameters, new enum values a consumer wasn't already exhaustively switching on); anything that removes or renames a field, changes a field's type or meaning, or changes existing endpoint behavior in a way that could break a consumer requires a new version, with the old version kept running unmodified alongside it for a deprecation window before removal. This is scoped to the REST API only — Service Bus event-schema evolution is addressed separately in ADR-0019, since events are thin (ADR-0012) and warrant a lighter-weight policy than the full REST surface.

**Initial implementation (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- Versioning scheme: **URI path versioning** (`/v1/...`, `/v2/...`).
- Deprecation window: **90 days** minimum after a successor version ships.
- Deprecation signaling: `Deprecation` and `Sunset` response headers ([RFC 8594](https://www.rfc-editor.org/rfc/rfc8594)), so it's programmatically detectable, not just documented in a changelog.
- Route handlers should be structured so version forking only happens at the specific endpoints that actually changed — not duplicated wholesale per version — to avoid the maintenance cost of two full copies of the API for the length of the deprecation window.

## Consequences

**Positive**
- Standard, well-understood pattern — any consumer (including future subsystems built by teams unfamiliar with this codebase's internals) immediately knows what `/v2/posts` implies without reading this ADR.
- Visible in logs, API gateway routing rules, and monitoring dashboards by construction, unlike header-based versioning which requires inspecting request headers to know which contract is in play.
- Admin UI and downstream subsystems can each upgrade to a new version on their own schedule within the deprecation window, rather than being forced to move in lockstep with `social-listening-core`'s deploys.

**Negative**
- Running two versions in parallel during a deprecation window means both must be tested and kept correct simultaneously — real maintenance cost, proportional to how many endpoints actually diverge between versions.
- URI versioning applies at a coarse (whole-API) granularity by convention; a single field change on one endpoint forces a decision about the *entire* version, even though only one endpoint changed. This is a known trade-off of path versioning and is mitigated, not eliminated, by only forking the specific changed handlers.
- The 90-day window is a placeholder default, not derived from anything in the spec or prior discussion — it needs an actual decision, likely informed by how many downstream subsystems exist and their own release cadences once they're built.

## Alternatives Considered

- **Header/content-negotiation versioning** (e.g. `Accept: application/vnd.social-listening.v1+json`) — cleaner URIs and no route duplication, but harder to test casually (can't just hit a URL in a browser or paste it into a log search), and the benefit it's optimized for — supporting many independent third-party API consumers — doesn't apply here, since consumers are a small, known set (internal downstream subsystems).
- **No explicit versioning; additive-changes-only forever** — avoids the whole mechanism, but provides no escape hatch for a genuine breaking change (e.g., correcting a v1 design mistake discovered after a downstream subsystem has already integrated against it), which is a realistic scenario for a platform's first, still-evolving subsystem.

## Open question (implementation default, not blocking acceptance)

The 90-day deprecation window is this ADR's proposed default, not a settled number — worth confirming against how this platform actually expects downstream subsystems to be built and released once any exist. Changing the window length is an implementation-default change (see Amendment Log below), not grounds to supersede the ADR.

## Amendment Log

Changes to the *implementation* section (versioning scheme, window length, signaling mechanism) are logged here, dated, instead of superseding this ADR. Superseding is only needed if the underlying decision itself — that explicit, breaking-change-capable versioning is required at all — changes.

- 2026-07-28 — Initial proposal: URI path versioning, 6-month deprecation window, RFC 8594 headers.
- 2026-07-28 — Revised after a second review round: deprecation window shortened to 90 days.
