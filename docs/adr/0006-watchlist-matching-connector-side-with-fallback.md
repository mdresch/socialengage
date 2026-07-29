# ADR-0006: Prefer connector-side native filtering for watchlist matching, with post-fetch matching as fallback

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §4.4 "Watchlist"

## Context

Watchlists support four match types (`keyword`, `hashtag`, `account`, `boolean`) scoped to a subset of connected platforms. Platforms differ in what filtering they support natively: some accept a query syntax at the API/webhook level, others return an unfiltered stream that must be matched client-side.

## Decision

Translate a `Watchlist`'s terms/boolean query into each platform's own native query syntax and let matching happen connector-side wherever the platform supports it. For platforms without native filtering support, fall back to post-fetch matching in the core after normalization.

## Consequences

**Positive**
- Connector-side filtering avoids fetching and paying rate-limit cost (per ADR-0003) for posts that will just be discarded, which matters most for platforms with tight quotas (e.g., YouTube's daily quota-cost model).
- Falling back to post-fetch matching means watchlists still work uniformly across every platform, including ones whose API can't express boolean queries, without changing the `Watchlist` model per platform.

**Negative**
- Matching logic now effectively exists in two places (each connector's query translation, and a shared post-fetch matcher), which need to behave equivalently for the same `Watchlist` or tenants will see inconsistent results depending on which platform matched a post.
- Boolean query semantics (`"acme AND (support OR help) NOT jobs"`) must be translatable into every supported platform's native syntax where available; platforms with weaker query grammars may only support an approximation, which isn't specified here and will need per-connector documentation of any semantic gaps.

## Alternatives Considered

- **Always do post-fetch matching in the core, ignore native filtering** — one matching implementation, fully consistent behavior, but wastes rate-limit budget and bandwidth fetching posts that get discarded, which is a meaningful cost on quota-constrained platforms.
- **Require every connector to support native filtering** — would simplify the core to a single code path, but isn't achievable for platforms whose APIs don't offer server-side query filtering, and would block onboarding those platforms entirely.
