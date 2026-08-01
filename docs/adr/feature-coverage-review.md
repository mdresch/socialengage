# Feature-to-ADR coverage review

This review maps the major features called out in the design specification to the ADRs that capture the architectural decision for each one.

| Design-spec feature | ADR | Notes |
|---|---|---|
| Split backend and admin into separate repositories | [0001](0001-two-repository-split.md) | Keeps the core independently usable and allows the UI to evolve separately. |
| Generalized provider connector pattern for social and AI providers | [0002](0002-unified-provider-connector-pattern.md) | Establishes a single extension contract for platform and AI integrations. |
| Per-tenant per-provider rate limiting | [0003](0003-per-tenant-per-provider-rate-limiting.md) | Prevents quota misuse from bleeding across tenants or providers. |
| Author normalization as a shared entity | [0004](0004-author-normalized-separately-from-post.md) | Avoids per-post duplication of account-level identity data. |
| IngestionRun as immutable audit anchor | [0005](0005-ingestion-run-as-audit-anchor.md) | Makes acquisition history explicit and traceable. |
| Watchlist matching with connector-side preference | [0006](0006-watchlist-matching-connector-side-with-fallback.md) | Balances native filter support with a reliable fallback strategy. |
| AuthorTopicSignal as a minimal v1 materialized view | [0007](0007-author-topic-signal-minimal-v1.md) | Limits the initial model to raw signals and defers ranking logic. |
| Deferred topic time-series and charting work | [0008](0008-defer-topic-time-series-and-charting.md) | Keeps the initial subsystem scoped to ingestion and enrichment. |
| Connector health derived from ingestion history | [0009](0009-connector-health-derived-not-stored.md) | Removes drift risk by keeping health as a computed view. |
| Retry policy and auto-disable behavior | [0010](0010-error-handling-and-auto-disable-policy.md) | Defines when failures are retried versus permanently disabled. |
| Cursor-based pagination for the REST API | [0011](0011-cursor-based-pagination-for-posts-api.md) | Provides stable pagination for historical reads. |
| Thin event payloads with on-demand REST fetch | [0012](0012-thin-events-with-rest-fetch-on-demand.md) | Keeps eventing lightweight while preserving full data access. |
| Per-tenant Service Bus filtering | [0013](0013-per-tenant-event-filtering-via-subscription-rules.md) | Prevents tenants from receiving one another's events. |
| Envelope-encrypted credential storage and OAuth-first auth | [0014](0014-credential-storage-envelope-encryption-oauth-first.md) | Protects credentials and supports modern auth flows. |
| Tenant isolation through PostgreSQL RLS | [0015](0015-tenant-isolation-via-postgres-row-level-security.md) | Enforces multi-tenant boundaries at the data layer. |
| PostgreSQL as the primary database engine | [0016](0016-postgres-as-database-engine.md) | Aligns the data model with the platform's storage and RLS strengths. |
| API versioning and compatibility policy | [0017](0017-api-versioning-and-compatibility-policy.md) | Ensures future API changes remain manageable. |
| Retention and archival policy | [0018](0018-data-retention-and-archival-policy.md) | Makes data lifecycle management explicit. |
| Event schema versioning policy | [0019](0019-event-schema-versioning-policy.md) | Keeps downstream consumers from breaking on schema changes. |
| Rate-limit queue bounds and distributed gate state | [0020](0020-rate-limit-queue-bounds-and-distributed-gate-state.md) | Protects the system from runaway retries and backpressure. |
| Boolean watchlist query AST and capability matrix | [0021](0021-watchlist-boolean-query-ast-and-capability-matrix.md) | Standardizes matching logic across connectors with different capabilities. |
| Derived-data caching and refresh strategy | [0022](0022-derived-data-caching-and-refresh-strategy.md) | Makes derived views predictable and cacheable. |
| Proportional connector failure threshold | [0023](0023-proportional-connector-failure-threshold.md) | Ties auto-disable logic to connector volume rather than using a flat rule. |
| Newswire connector selection and issuer-as-author modeling | [0024](0024-newswire-connector-direct-wire-rss-issuer-as-author.md) | Captures a connector-specific implementation choice that was not in the original spec. |
| Persistent local development database separate from test DB | [0025](0025-persistent-local-dev-database-separate-from-test-database.md) | Stabilizes local development and avoids test-container churn. |
| RSS/News connector via GNews and publication-as-author modeling | [0026](0026-rss-news-connector-gnews-api-publication-as-author.md) | Makes the news connector concrete and records its author-modeling exception. |
| Connector as technical intermediary only | [0027](0027-connector-is-technical-intermediary-not-contracting-party.md) | Formalizes the governance boundary between SocialEngage and data-source relationships. |

This set gives the project a decision record for each major feature and policy area described in the design specification.
