# ADR-0016: Postgres as the database engine

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §2 "Architecture Overview" states the conclusion ("Azure Database for PostgreSQL"); §4.2 and §8 show two concrete dependencies on Postgres-specific features (JSONB `rawPayload`, RLS-based isolation). The underlying trade-off discussion is not in the spec document itself — it took place in the chat conversation that produced the spec, shared at https://claude.ai/share/c7015a31-d8c9-4927-b394-f7fe9130f0be, and is quoted below.

## Context

The spec commits to Postgres in one line (§2). The reasoning behind that line was worked out earlier in the design conversation, when asked to choose between the two Azure database options under consideration (Azure SQL and Postgres):

> Q: Between the two Azure options you mentioned, which database engine?
> A: Not sure — want your recommendation
>
> For this workload, I'd recommend Azure Database for PostgreSQL, for a few concrete reasons:
>
> - **JSONB support** — social posts from different platforms have wildly different schemas (a tweet vs. a Reddit comment vs. a YouTube comment). Postgres's JSONB lets you store the raw normalized-but-flexible payload without forcing a rigid schema, while still being queryable/indexable.
> - **Row-Level Security (RLS)** — Postgres has native RLS, which is a strong fit for your multi-tenant isolation requirement: you can enforce "tenant A can never see tenant B's rows" at the database layer itself, not just in application code. That's a meaningful defense-in-depth layer given you're also storing encrypted credentials.
> - **Full-text search + extensions** — built-in full-text search covers keyword/hashtag tracking reasonably well out of the box, and pgvector gives you a future path to embedding-based semantic search/sentiment clustering without changing databases later.
> - **Node/TypeScript ecosystem** — Prisma and Drizzle (the two leading TS ORMs) both have first-class Postgres support; Azure SQL support is comparatively secondary in both.
>
> Azure SQL is a fine engine, but it's a stronger fit for rigid, relational, transactional workloads (e.g. financial ledgers) — less natural for the flexible, high-volume, semi-structured ingestion this system needs.
>
> Q: Sound good?
> A: Yes, go with Postgres

Two of the four reasons given (JSONB, RLS) went on to become load-bearing in the spec itself — §4.2's `rawPayload` and §8's RLS-based tenant isolation (ADR-0015). The other two (full-text search, `pgvector`) were part of the original rationale but are not exercised by anything in the current spec — noted below as headroom rather than active justification.

## Decision

Use Azure Database for PostgreSQL as the sole database engine, per the reasoning above. The two reasons that carry direct, present-day weight are native JSONB (backing `rawPayload`, §4.2) and native Row-Level Security (backing tenant isolation, §8, ADR-0015). Full-text search and `pgvector` were cited as additional reasons at decision time but describe future capability headroom, not something the current spec commits to using.

## Consequences

**Positive**
- JSONB gives `rawPayload` a queryable, indexable column type instead of an opaque blob (e.g., a `TEXT` column holding serialized JSON) — directly addressing the schema variance across platforms (a tweet vs. a Reddit comment vs. a YouTube comment) called out in the original reasoning.
- Native RLS is enforced by the database engine itself, not just in application code — the specific defense-in-depth property the original discussion flagged as mattering given credentials are also stored in the same database.
- Un-exercised today, but real optionality: `pgvector` gives a future path to embedding-based semantic search or sentiment clustering without a database migration if that's ever wanted; built-in full-text search is available for keyword/hashtag matching without adding a search-engine dependency.
- Prisma/Drizzle (the leading TypeScript ORMs) both treat Postgres as first-class, consistent with the rest of the stack being TypeScript/Node.js throughout (§2).

**Negative**
- Two of the four original reasons (full-text search, `pgvector`) aren't used by anything the spec currently does — they're carried as future-proofing, which is a reasonable bet but means part of this decision's justification won't be validated until (if) those capabilities are actually exercised.
- Committing to Postgres-specific features (JSONB operators, RLS policies) at the schema level means a future engine migration, if ever needed, is not a mechanical port: RLS policies and any JSONB-specific queries would need to be reimplemented, not just translated.

## Alternatives Considered

- **Azure SQL (SQL Server)** — the alternative actually weighed in the original discussion. Rejected as "a stronger fit for rigid, relational, transactional workloads (e.g. financial ledgers) — less natural for the flexible, high-volume, semi-structured ingestion this system needs." *(Addendum, not from the original discussion: Azure SQL does have its own row-level security predicate mechanism, so RLS-equivalent isolation isn't uniquely a Postgres capability — but the design in ADR-0015 was worked out against Postgres's specific implementation, so choosing Azure SQL would still mean re-validating that isolation approach against a different RLS implementation, not just relabeling it.)*
- **Azure Cosmos DB** — not discussed in the original conversation; noted here as a gap-filling comparison. Would fit `rawPayload`'s schema flexibility and tenant partitioning, but has no native RLS equivalent (isolation would fall back to partition-key discipline enforced at the application/query layer, the weaker pattern ADR-0015 argues against) and is a worse fit for the relational joins the data model relies on (`SocialPost.authorId` → `Author`, `acquisitionId` → `IngestionRun`).

## Note on provenance

Unlike ADR-0001–0015, this decision's rationale isn't in the design spec document — it's in the chat conversation that produced the spec (linked above), which recorded only the conclusion ("Azure Database for PostgreSQL") into the written document. The blockquote in Context is the actual text from that conversation. The Azure SQL entry under Alternatives Considered is likewise from that conversation; the Cosmos DB entry and the Azure-SQL RLS addendum are not — those are this ADR's own analysis, marked accordingly.
