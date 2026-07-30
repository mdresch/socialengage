# Architecture Decision Records — Social Listening / Insights Subsystem

ADRs derived from [`2026-07-28-social-listening-ingestion-design.md`](../project%20docs/2026-07-28-social-listening-ingestion-design.md) (Status: Approved for implementation). Each record captures one architecturally significant decision from that spec, with the context and alternatives that motivated it.

Each ADR feeds a [user story](../user-stories/README.md); each story is built per [`docs/implementation-methodology.md`](../implementation-methodology.md) (contract-first, component `SKILL.md`s, permanent regression suite) — so an ADR's decision stays enforced in code, not just recorded in prose.

## Conventions for changing an existing ADR

Four situations, four different responses — don't default to editing the original Decision/Consequences text in place:

| Situation | Response |
|---|---|
| The underlying decision itself changes | New ADR, or a superseding ADR that says so explicitly |
| The decision stands, but *why* it was made needs more explanation | Add a "Note on provenance" or similar, without altering the original text (e.g. ADR-0002, ADR-0016) |
| An adjustable parameter changes (a window length, a threshold) | Log it in that ADR's "Amendment Log" (e.g. ADR-0017–0019) — doesn't need superseding |
| Implementation surfaces a constraint that was already logically required by the decision, just not stated | Add a dated "Clarification" section (e.g. ADR-0013) — not a new decision, just making an implicit requirement explicit |
| A still-Proposed ADR would change part of this (Accepted) ADR's decision, if accepted | Add a dated "Pending supersession note" pointing to it, naming exactly which part would change (e.g. ADR-0009/0010 → ADR-0023) — not an edit to the original text, and not a full supersession unless the whole decision is affected |
| A "Pending supersession note" above becomes real because the other ADR gets accepted | Add a dated "Supersession update" note confirming it, without editing the original Pending supersession note or Decision text (e.g. ADR-0009/0010, once ADR-0023 was accepted) — and don't assume already-shipped code changes automatically; it only changes when the superseding ADR's own story is actually built |

The common thread: the original Decision and Consequences text is a historical record and stays put. Everything learned later is appended, dated, and labeled by which of the four categories it is.

| # | Title | Spec Section |
|---|-------|--------------|
| [0001](0001-two-repository-split.md) | Split into `social-listening-core` and `social-listening-admin` repositories | §2 |
| [0002](0002-unified-provider-connector-pattern.md)² | Unified `ProviderConnector` contract for social platforms and AI providers | §3.1 |
| [0003](0003-per-tenant-per-provider-rate-limiting.md) | Rate limiting enforced per `(tenantId, providerId)` via a shared `RequestGate` | §3.2 |
| [0004](0004-author-normalized-separately-from-post.md) | Normalize `Author` once per platform account, not embedded per post | §4.1 |
| [0005](0005-ingestion-run-as-audit-anchor.md) | `IngestionRun` as the immutable acquisition/audit anchor for every post | §4.3 |
| [0006](0006-watchlist-matching-connector-side-with-fallback.md) | Prefer connector-side native filtering for watchlist matching, with post-fetch fallback | §4.4 |
| [0007](0007-author-topic-signal-minimal-v1.md) | `AuthorTopicSignal` ships with raw signals only, no computed expertise score | §4.5 |
| [0008](0008-defer-topic-time-series-and-charting.md) | Defer `TopicDailyCount` aggregation and all charting to a future subsystem | §4.6, §9 |
| [0009](0009-connector-health-derived-not-stored.md) | `ConnectorHealth` is fully derived from `IngestionRun` history, not stored mutable state | §5 |
| [0010](0010-error-handling-and-auto-disable-policy.md) | Retryable-vs-non-retryable error policy with per-tenant auto-disable | §5 |
| [0011](0011-cursor-based-pagination-for-posts-api.md) | Cursor-based pagination for `GET /posts` | §6 |
| [0012](0012-thin-events-with-rest-fetch-on-demand.md) | Service Bus events carry IDs and minimal fields only; full data fetched via REST on demand | §7 |
| [0013](0013-per-tenant-event-filtering-via-subscription-rules.md) | Per-tenant event filtering via Service Bus subscription SQL filters | §7 |
| [0014](0014-credential-storage-envelope-encryption-oauth-first.md) | Envelope-encrypted credential storage via Azure Key Vault, OAuth preferred with API-key fallback | §8 |
| [0015](0015-tenant-isolation-via-postgres-row-level-security.md) | Enforce tenant isolation at the database layer with Postgres Row-Level Security | §8 |
| [0016](0016-postgres-as-database-engine.md)¹ | Postgres as the database engine | §2, §4.2, §8 |
| [0017](0017-api-versioning-and-compatibility-policy.md)³ | API versioning and compatibility policy | — (originated, see below) |
| [0018](0018-data-retention-and-archival-policy.md)⁴ | Data retention and archival policy | ADR-0005 Negative consequences |
| [0019](0019-event-schema-versioning-policy.md)³ | Event schema versioning policy | — (originated, see below) |
| [0020](0020-rate-limit-queue-bounds-and-distributed-gate-state.md)⁵ | Rate-limit queue bounds, dead-letter handling, and distributed gate state | ADR-0003 Negative consequences; third-party review |
| [0021](0021-watchlist-boolean-query-ast-and-capability-matrix.md)⁵ | Unified boolean-query AST for watchlist matching, with per-connector capability matrix | ADR-0006 Negative consequences; third-party review |
| [0022](0022-derived-data-caching-and-refresh-strategy.md)⁵ | Derived-data caching and refresh strategy (`ConnectorHealth` cache, `AuthorTopicSignal` refresh cadence) | ADR-0007, ADR-0009 Negative consequences; third-party review |
| [0023](0023-proportional-connector-failure-threshold.md)⁵ | Proportional (rate-relative) connector failure threshold for auto-disable | Spec §5/§10 placeholder; third-party review |
| [0024](0024-newswire-connector-direct-wire-rss-issuer-as-author.md)⁶ | Newswire connector — direct wire-service RSS feeds (GlobeNewswire, PR Newswire), with issuer-as-Author modeling | §10 (platform roster, order not yet decided) |
| [0025](0025-persistent-local-dev-database-separate-from-test-database.md)⁷ | Persistent local dev Postgres database, kept separate from Jest's ephemeral test database | — (originated, see below) |

¹ Unlike 0001–0015, the spec states this decision as a given rather than arguing it — the spec doesn't carry the reasoning. The reasoning is instead sourced from the chat conversation that produced the spec (linked in the ADR), not from the spec document itself. See its "Note on provenance."

² Mostly spec-sourced (§3.1/§3.3), with one exception: the `deliveryMode` rationale in its Consequences section is sourced from the same chat conversation as ADR-0016, not from the spec. See its "Note on provenance."

³ Originated as Proposed ADRs (gaps neither the spec nor the design conversation addressed), then accepted on 2026-07-29 — deliberately ahead of the implementation phase that would otherwise touch them (Phase 0 of `docs/implementation-plan.md`), because both are cheap to build in from day one and expensive to retrofit later. See each ADR's "Acceptance note." Unlike ADR-0016, these don't have spec/chat-sourced reasoning to cite — the reasoning is the ADR's own, same as when they were Proposed; only the Status changed.

⁴ Also originated as a Proposed ADR, accepted on 2026-07-29 — unlike ADR-0017/0019, this one wasn't accepted early for a schedule reason; it's a straightforward acceptance of the tiered-retention policy with `rawPayload` at 90 days and `IngestionRun` at 18 months, both configurable. See its "Acceptance note" and Amendment Log for the full numeric history.

⁵ ADR-0020–0023, all also originated as Proposed ADRs and all accepted on 2026-07-29, closing out this series' last four open decisions. Each ADR's own "Acceptance note" and Amendment Log carry the specifics, but the shared thread: numeric implementation defaults were kept as originally proposed in every case (no real traffic data existed to justify changing them), and two decisions were deliberately sequenced rather than built immediately — ADR-0020's Redis-backed distributed `RequestGate` state waits for an actual second concurrent instance to be deployed, and ADR-0023's rate-relative failure threshold doesn't retroactively change Stories 2.3/4.3's already-shipped flat-rule code until Story 2.5 is actually built (see ADR-0009's and ADR-0010's "Supersession update" notes). ADR-0023's `deliveryMode`-based variation question was deferred, not resolved — logged as a known gap, revisit once a push-mode connector exists.

⁶ ADR-0024 is a genuine 24th ADR, outside the original "23 ADRs, one per story" scope this series started with (see `CLAUDE.md`) — it originates a connector-specific provider selection and a scoped `Author`-modeling exception, not a decision the original design spec or its 23-ADR derivation anticipated. Drafted ahead of implementation like ADR-0017/0019, revised twice during review (RTPR's real pricing, then dropped entirely for direct wire-service RSS — see its own Amendment Log), then accepted 2026-07-30 the same day, with Story 2.6 added to Epic 2. Its own Acceptance note records that two follow-up deep-research passes (~25 additional candidates) found nothing that beat the accepted GlobeNewswire+PR Newswire scope.

⁷ ADR-0025 is a genuine 25th ADR, and — unlike every other ADR in this series — its own subject matter is dev tooling, not production architecture: `docs/implementation-plan.md`'s Phase 0 explicitly pre-classifies "local dev environment" as "also build, not storied," the same category this README's own "Not captured as ADRs" section uses for testing-strategy/CI details generally. It's here anyway as an explicit, user-directed exception — see its own Acceptance note — because the friction it fixes (a shared ephemeral test container getting torn down out from under a running dev server) was hit and demonstrated in practice, and fixing it surfaced a genuine `execSync`-vs-`spawn` correctness bug worth a durable record. Story 1.4 added to Epic 1, accepted the same day it was built and verified.

## Proposed (not yet decided)

**None currently outstanding.** ADR-0024 (Newswire connector — direct wire-service RSS feeds, with issuer-as-Author modeling) and ADR-0025 (persistent local dev database) were both accepted the same day they were drafted — see footnotes 6/7 and each ADR's own Acceptance note. As of 2026-07-30, all 25 ADRs in this series (the original 23, plus ADR-0024 and ADR-0025) are Accepted.

These originated new policy rather than documenting an existing decision — gaps identified during review (independently by this series' author and by two rounds of Copilot review) that the spec and design conversation left unaddressed. Each separated a durable *decision* from adjustable *implementation defaults*, with an Amendment Log for logging parameter changes (e.g. a deprecation window changing from 6 to 12 months) without superseding the ADR — that pattern remains in force post-acceptance; only a change to the underlying decision itself now warrants superseding. (ADR-0017, ADR-0018, ADR-0019, ADR-0020, ADR-0021, ADR-0022, and ADR-0023 have all since been accepted — see the main table above — and none remain in this section.)

Third-party review also surfaced a numeric disagreement with ADR-0017's original default, resolved and logged in that ADR's own Amendment Log (not a new ADR): ADR-0017's deprecation window shortened from 6 months to 90 days. A similar review-round disagreement briefly shortened ADR-0018's `IngestionRun` archival window from 18 months to 90 days (aligned with `rawPayload`'s window), but that alignment was reverted at acceptance — see ADR-0018's Amendment Log — back to 18 months, now configurable. Monthly range partitioning was added as the archival mechanism for both `SocialPost` and `IngestionRun` regardless of the window length. ADR-0020–0023 saw no such numeric disagreements — each was accepted with its originally proposed defaults unchanged (see footnote 5).

**Still outstanding, not yet drafted:** ADR-0004's point-in-time author snapshot (retaining `followerCount`-at-publish-time on `SocialPost` despite `Author` being normalized) was flagged as a genuine trade-off — not a strict improvement — during the same review round, but wasn't included in the batch above. Needs an explicit go/no-go before drafting, since it partially reintroduces the per-post duplication ADR-0004 argued against.

**Multi-tenant Admin/Tenant/User model (brainstormed 2026-07-30, not yet drafted):** no `tenants` table, `users` table, or Admin tier exist anywhere in this series — "tenant" today is purely a `tenant_id` UUID convention (ADR-0015 isolates it; nothing provisions it). A same-day brainstorm settled several shapes without drafting any ADR yet (paused mid-session, to be continued):
- Three tiers: Platform Admin → Tenant (with its own Tenant-Admin role) → Tenant User.
- User onboarding: invite-only, gated by a per-tenant license/seat count — no request-then-approve queue.
- Connectors are tenant-owned only; personal-account connectors are a future Social Selling subsystem's concern, not this one's.
- Platform Admin's boundary leans toward provisioning-only (create/suspend a tenant, set its license count), zero tenant-data access — floated, not locked.
- Two opens, unresolved: whether connector *activation* needs its own table separate from `platform_credentials` (built around an encrypted secret every connector doesn't have — Newswire's `authMode: 'none'` has none); whether a tenant needs multiple activations of one platform (e.g. several Facebook Pages).

Candidate future ADRs, roughly in dependency order, none drafted: (1) authentication mechanism — blocks everything else; (2) Admin-tier design (an RLS exception, same shape as the migration role's existing superuser bypass); (3) `tenants` table shape; (4) `users` table shape + RLS; (5) retiring the `X-Tenant-Id` header placeholder; (6) connector connect/disconnect CRUD; (7) admin UI's own shape (one app or two).

Considered and explicitly **not** drafted as ADRs, per review discussion:
- **Capability-based connector composition / connector capability registry** — premature for a two-branch hierarchy (`SocialConnector`, `AIProviderConnector`); the spec doesn't describe a third, structurally different provider type that would justify it yet. Revisit if one materializes (rule of three).
- **CODEOWNERS / repo ownership** — reasonable, but a repo-governance artifact, not an architecture decision.
- **OpenAPI-first contract governance, connector certification, sandbox/test harness, DR/replay strategy** — reasonable platform-maturity investments, but ahead of where this subsystem is: pre-implementation, no downstream consumers built yet. **Revisit trigger:** before the first downstream subsystem (likely Brand Reputation & Alerts) begins integrating against `social-listening-core`'s API — not before, per a second round of Copilot review.
- **Consumer contract ownership** (who owns backward compatibility as the producer/consumer graph grows — `social-listening-core` vs. each downstream subsystem) — flagged as a likely future ADR candidate once implementation begins and a second or third real downstream consumer exists to reason about. Not drafted now, and not pinned to a specific number since 0020–0023 are now in use — noted so it isn't lost.

## Not captured as ADRs

The following are called out in the spec but are scope boundaries or process decisions rather than architecture decisions, so they're not recorded as ADRs — none of them involve the kind of hard-to-reverse technical trade-off this series exists to justify:

- Initial connector build order — **resolved 2026-07-29**, see spec §10 and `docs/implementation-plan.md` (RSS/News first, then Reddit; remaining platforms prioritized in Phase 4)
- Exact connector auto-disable failure threshold — governed by ADR-0010's flat placeholder through Phase 3; superseded 2026-07-30 by ADR-0023's proportional rule (Story 2.5, implemented ahead of the rest of Phase 4 — see `docs/implementation-log.md`); see spec §10. (Distinct from ADR-0020's separate per-request dead-letter threshold, Story 2.4.)
- Testing strategy and CI/CD pipeline details for the two repos — **resolved 2026-07-29**, see spec §10 (lightweight CI given this is a solo-developer project, not team-scale process). **Exception, 2026-07-30:** ADR-0025 (persistent local dev database) is dev tooling in this same general category, captured as an ADR anyway by explicit user decision after real friction was hit in practice — see its own Acceptance note and footnote 7 above. Not a reversal of this bullet's general rule, just a named, flagged exception to it.
- Geocoding of `profileLocation` — explicitly out of scope, §9, no decision made to record
