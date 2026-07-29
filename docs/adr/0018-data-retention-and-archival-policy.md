# ADR-0018: Data retention and archival policy

**Status:** Accepted (2026-07-29) — see Acceptance note below
**Source:** Not specified in the design spec, which explicitly leaves this open (§10 lists "specific dead-letter failure threshold" and "testing strategy" as open questions but doesn't mention retention at all). Flagged independently in ADR-0005's Negative consequences and in a Copilot review of this ADR series. This ADR originates a proposed policy; it does not document a prior decision.
**Acceptance note:** accepted with `rawPayload` retained hot for 90 days and `IngestionRun` retained hot for 18 months — reverting the 2026-07-28 alignment amendment that had shortened `IngestionRun` to match `rawPayload`'s 90-day window. Both windows are configurable (not hardcoded constants), rather than fixed at these values. See the Amendment Log for the full history of this number.

## Context

Two tables grow without bound by design:

- `SocialPost` — described in §6 as "high-volume and unbounded." Each row carries `rawPayload` (§4.2), the full original platform JSON, explicitly "never discarded."
- `IngestionRun` — a new row per poll or webhook trigger, per tenant, per platform (ADR-0005), which at any meaningful polling frequency across many tenants accumulates quickly.

Working against unconstrained retention: the linked design conversation that produced this spec anticipated topic-volume graphs spanning **years** ("i can see a count per day on a topic graph where the graph can be set to years"), and that capability — while explicitly deferred to a future subsystem (ADR-0008) — depends on `SocialPost.publishedAt` and `enrichment.entities`/`keyPhrases` still existing that far back. So "keep everything forever" and "delete aggressively" are both wrong defaults here: the former makes primary storage cost and query performance degrade indefinitely, the latter breaks a capability this platform was explicitly designed to support later.

## Decision

**The durable decision — this is what would need superseding, not just amending:**

Retention is tiered — hot primary storage plus cheaper archival storage — rather than a single uniform retention rule, and the tiering boundary is drawn per field/data-category rather than per table, since different fields within the same table have very different value-over-time profiles. Analytically valuable fields (the ones downstream aggregation depends on) are retained far longer than the bulky, rarely-re-read raw payload. Audit-anchor data (`IngestionRun`) is archived, never hard-deleted, because other rows hold foreign keys into it.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- **Aggregation-relevant fields** (`tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, `enrichment.*` excluding raw payload) — retained indefinitely in primary Postgres storage. These are exactly the fields the deferred `TopicDailyCount` (ADR-0008) and `AuthorTopicSignal` (ADR-0007) need, including for the multi-year graphing capability raised in the original design discussion.
- **`rawPayload` (JSONB)** — the bulkiest and least-frequently-queried field, and the one most directly responsible for table bloat at "high-volume and unbounded" scale. Accepted: retain in the hot Postgres row for **90 days** (configurable), then move to cheaper archival storage (Azure Blob Storage, keyed by post ID) and replace the JSONB column's content with a pointer/reference. This preserves §4.2's "never discarded" guarantee — the data still exists and is still traceable to the post it came from — without keeping the heaviest field hot indefinitely.
- **`IngestionRun`** — primarily operational/audit data (ADR-0005's "which process, at what time, with what connector version" trail), not analytical data queried by tenants. Accepted: retain individual run rows for **18 months** (configurable), after which they move to the same archival tier as aged-out `rawPayload`. Because every `SocialPost.acquisitionId` is a foreign key into `IngestionRun` (ADR-0005), archiving (not hard-deleting) is the required approach here — a hard delete would either orphan the FK or require cascading through every post it produced, neither of which is acceptable given `IngestionRun` is meant to be an *immutable* audit anchor.
- **Configurability:** both windows are exposed as configuration (e.g., a per-deployment or per-tenant setting), not hardcoded constants — so changing them going forward is an operational change, not a code change or an ADR amendment.
- **Mechanism:** implement the hot-tier boundary via monthly range partitioning on both `SocialPost` and `IngestionRun` (partitioned by `publishedAt`/`startedAt` respectively). Archival then becomes "detach and export the oldest partition," not a row-by-row delete/update sweep — cheaper, and avoids long-running mutation locks on a high-volume table.

**Explicitly not addressed by this ADR:** tenant offboarding / right-to-erasure requests (e.g. GDPR Article 17). That's a distinct legal/compliance question — who initiates deletion, what "deleted" means for archived/blob-tier data, what the SLA is — that deserves its own decision with input beyond what this ADR can respons‌ibly originate. Flagging it here so it isn't lost, not resolving it.

## Consequences

**Positive**
- The specific capability the original design conversation anticipated (multi-year topic graphs) stays possible, because the fields it depends on are never purged — only the heaviest, least-reused field (`rawPayload`) is tiered.
- Archiving `IngestionRun` instead of deleting it preserves the "immutable audit anchor" property (ADR-0005) rather than quietly breaking it once rows age out.
- Tiering by field rather than by whole-row deletion means primary storage growth is bounded by the actually-expensive part (raw JSON payloads), not by the analytically valuable part, which is a better fit for this system's own stated future use of the data.

**Negative**
- Requires building and operating an actual archival mechanism (blob export + pointer rewrite, or equivalent) — this is new infrastructure, not a configuration flag, and needs its own implementation design.
- A `SocialPost` older than 90 days no longer has its full raw payload immediately queryable; recovering it means a blob fetch, not a JSONB query. Any tooling that assumed `rawPayload` was always live-queryable (e.g., ad hoc debugging via `rawPayload->>'field'`) needs to account for the two-tier reality.
- The specific numbers (90 days for `rawPayload`, 18 months for `IngestionRun`) are accepted implementation defaults, not derived from any stated requirement in the spec — they may need revisiting once real storage cost data and actual reference patterns for aged raw payloads/runs are available. Being configurable rather than hardcoded lowers the cost of that revision.
- Monthly partitioning is a real schema commitment (partition key choice, partition-maintenance automation) made this early, before there's real volume data to validate the partition granularity against.

## Alternatives Considered

- **Retain everything indefinitely, no tiering** — simplest to implement (nothing to build), but directly at odds with `SocialPost` being explicitly "high-volume and unbounded" (§6); primary storage cost and query performance degrade without limit as tenants and time accumulate.
- **Fixed whole-row TTL with hard deletion** (e.g., delete `SocialPost` rows entirely after N months) — simple and bounds storage cleanly, but breaks the multi-year topic-graphing capability the original design conversation explicitly anticipated, and would also orphan `AuthorTopicSignal`/`IngestionRun` references depending on cutoff timing.

## Open questions (implementation defaults, not blocking acceptance)

- ~~Is 90 days the right window for both `rawPayload` and `IngestionRun`, or should they diverge, or be configurable?~~ **Resolved at acceptance:** they diverge (90 days / 18 months) and both are configurable rather than tenant-tied at this stage.
- Is monthly partitioning the right granularity, or is that premature before real ingestion-volume data exists?
- Tenant offboarding and right-to-erasure handling is out of scope here and needs its own decision.

## Amendment Log

Changes to the *implementation defaults* (specific day/month counts, partitioning granularity, which fields fall in which tier) are logged here, dated, instead of superseding this ADR. Superseding is only needed if the underlying decision changes — e.g., moving away from tiered hot/archival storage entirely, or archiving `IngestionRun` stops being required because the FK relationship in ADR-0005 changes.

- 2026-07-28 — Initial proposal: `rawPayload` to archival at 90 days, `IngestionRun` to archival at 18 months.
- 2026-07-28 — Revised after a second review round: `IngestionRun` window shortened from 18 months to 90 days (aligned with `rawPayload`); added monthly range partitioning as the archival mechanism for both tables.
- 2026-07-29 — Accepted: reverted `IngestionRun` back to its original 18-month window (no longer aligned with `rawPayload`'s 90 days); both windows made configurable rather than fixed constants.
