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
| Credential creation authority scoped by ownership tier | [0028](0028-credential-creation-authority-scoped-by-ownership-tier.md) | Prevents system-wide credentials and aligns creation rights with tenant/user roles. |
| Entra External ID authentication mechanism | [0029](0029-authentication-mechanism-entra-external-id.md) | Establishes the identity provider and token-issuer boundary. |
| Platform Admin and Tenant-Admin boundary model | [0030](0030-admin-tier-design-platform-admin-rls-exception.md) | Defines the bypass scope and admin-tier governance rules. |
| Tenants table shape and admin-only mutations | [0031](0031-tenants-table-shape.md) | Locks tenant metadata and seat/activation behavior. |
| Users table shape with RLS and access-ends model | [0032](0032-users-table-shape-and-rls.md) | Defines user identity, access lifecycle, and RLS scope. |
| Retire `X-Tenant-Id` header in favor of bearer identity | [0033](0033-retire-x-tenant-id-header-placeholder.md) | Removes header-based tenant trust in favor of resolved identity. |
| Connector connect/disconnect CRUD rework | [0034](0034-connector-connect-disconnect-crud-ownership-tier-aware.md) | Aligns connect/disconnect flows with ownership tiers. |
| Admin UI shape: one app with role-gated routes | [0035](0035-admin-ui-shape-one-app-role-gated.md) | Keeps Platform Admin and tenant UI in one deployable with strict routing. |
| Admin UI authentication/session and role-gating mechanism | [0036](0036-admin-ui-authentication-session-and-role-gating-mechanism.md) | Establishes the BFF session model and token handling. |
| Self-service tenant signup and first Tenant-Admin provisioning | [0037](0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md) | Defines the signup flow and constraints for new tenants. |
| AI enrichment provider selection (Azure AI Language first) | [0038](0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md) | Names the initial AI enrichment provider and swappability path. |
| Tenant offboarding export and deletion lifecycle | [0039](0039-tenant-offboarding-data-lifecycle-export-and-deletion.md) | Defines the export window and deletion mechanics. |
| Self-service signup rate limiting | [0040](0040-self-service-signup-rate-limiting-and-abuse-prevention-mechanism.md) | Protects signup endpoints from abuse and throttling gaps. |
| Platform Admin as a distinct identity kind | [0041](0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md) | Clarifies identity modeling for admin vs tenant roles. |
| Wikipedia connector design and article-as-author modeling | [0042](0042-wikipedia-connector-mediawiki-api-article-as-author.md) | Proposes the connector and defines author modeling for revisions. |
| Self-service tenant-initiated deletion | [0043](0043-self-service-tenant-initiated-deletion.md) | Establishes tenant-driven deletion flow and audit visibility. |
| Watchlist CRUD contract and PATCH semantics | [0044](0044-watchlist-api-design-and-database-schema-standardization.md) | Standardizes watchlist updates, errors, and row shape. |
| Cross-story supersession language pattern | [0047](0047-standard-pattern-for-cross-story-references-and-supersession-language.md) | Codifies how supersessions and cross-story references are written. |
| Connector registration verification guardrails | [0048](0048-no-core-pipeline-change-verification-for-new-connector-registration.md) | Requires evidence and CI checks for no-core-change registrations. |

This set gives the project a decision record for each major feature and policy area described in the design specification and its later ADR extensions.
