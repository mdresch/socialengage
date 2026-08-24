import type { AdrItem, BrdItem, FddItem, StoryItem, EpicSummary, CodebaseMetrics } from './types';

export const CODEBASE_METRICS: CodebaseMetrics = {
  "coreSrcFiles": 132,
  "coreSrcLoc": 17648,
  "coreTestFiles": 95,
  "coreTestLoc": 23430,
  "coreMigrationFiles": 42,
  "coreMigrationLoc": 1581,
  "adminSrcFiles": 152,
  "adminSrcLoc": 26458,
  "adminTestFiles": 47,
  "adminTestLoc": 13517,
  "totalFiles": 468,
  "totalLoc": 82634
};

export const EPICS_SUMMARY: EpicSummary[] = [
  {
    "id": "Epic 1",
    "title": "Epic 1: Repository & API Foundation",
    "file": "epic-1-repository-and-api-foundation.md",
    "total": 16,
    "built": 15,
    "pending": 1,
    "progressPct": 93.8
  },
  {
    "id": "Epic 10",
    "title": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "file": "epic-10-adr-0086-to-0094.md",
    "total": 14,
    "built": 14,
    "pending": 0,
    "progressPct": 100.0
  },
  {
    "id": "Epic 11",
    "title": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "file": "epic-11-adr-0095-to-0100.md",
    "total": 12,
    "built": 12,
    "pending": 0,
    "progressPct": 100.0
  },
  {
    "id": "Epic 12",
    "title": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "file": "epic-12-adr-0101-to-0108.md",
    "total": 16,
    "built": 16,
    "pending": 0,
    "progressPct": 100.0
  },
  {
    "id": "Epic 13",
    "title": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "file": "epic-13-adr-0109-to-0117.md",
    "total": 14,
    "built": 14,
    "pending": 0,
    "progressPct": 100.0
  },
  {
    "id": "Epic 2",
    "title": "Epic 2: Ingestion, Connectors & Rate Limits",
    "file": "epic-2-ingestion-connectors-and-rate-limits.md",
    "total": 32,
    "built": 32,
    "pending": 0,
    "progressPct": 100.0
  },
  {
    "id": "Epic 3",
    "title": "Epic 3: Data Model, Storage & Archival",
    "file": "epic-3-data-model-storage-and-archival.md",
    "total": 17,
    "built": 17,
    "pending": 0,
    "progressPct": 100.0
  },
  {
    "id": "Epic 4",
    "title": "Epic 4: Derived Data, Analytics & Health",
    "file": "epic-4-derived-data-analytics-and-health.md",
    "total": 4,
    "built": 4,
    "pending": 0,
    "progressPct": 100.0
  },
  {
    "id": "Epic 5",
    "title": "Epic 5: Security, Isolation & Messaging",
    "file": "epic-5-security-isolation-and-messaging.md",
    "total": 19,
    "built": 12,
    "pending": 7,
    "progressPct": 63.2
  },
  {
    "id": "Epic 6",
    "title": "Epic 6: Tenant Admin UI",
    "file": "epic-6-tenant-admin-ui.md",
    "total": 40,
    "built": 35,
    "pending": 5,
    "progressPct": 87.5
  },
  {
    "id": "Epic 7",
    "title": "Epic 7: Platform Admin UI",
    "file": "epic-7-platform-admin-ui.md",
    "total": 1,
    "built": 1,
    "pending": 0,
    "progressPct": 100.0
  },
  {
    "id": "Epic 8",
    "title": "Epic 8: Analytics Dashboard",
    "file": "epic-8-analytics-dashboard.md",
    "total": 10,
    "built": 9,
    "pending": 1,
    "progressPct": 90.0
  },
  {
    "id": "Epic 9",
    "title": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "file": "epic-9-adr-0077-to-0085.md",
    "total": 11,
    "built": 11,
    "pending": 0,
    "progressPct": 100.0
  }
];

export const ADR_LIST: AdrItem[] = [
  {
    "id": "001",
    "num": 1,
    "title": "Split into `social-listening-core` and `social-listening-admin` repositories",
    "status": "Accepted (2026-07-28)",
    "cluster": "Repository & Foundation",
    "file": "0001-two-repository-split.md",
    "storyRefs": [
      "1.1"
    ]
  },
  {
    "id": "002",
    "num": 2,
    "title": "Unified `ProviderConnector` contract for social platforms and AI providers",
    "status": "Accepted (2026-07-28)",
    "cluster": "Ingestion & Connectors",
    "file": "0002-unified-provider-connector-pattern.md",
    "storyRefs": [
      "2.1",
      "2.17"
    ]
  },
  {
    "id": "003",
    "num": 3,
    "title": "Rate limiting enforced per `(tenantId, providerId)` via a shared `RequestGate`",
    "status": "Accepted (2026-07-28)",
    "cluster": "Ingestion & Connectors",
    "file": "0003-per-tenant-per-provider-rate-limiting.md",
    "storyRefs": [
      "2.2"
    ]
  },
  {
    "id": "004",
    "num": 4,
    "title": "Normalize `Author` once per platform account, not embedded per post",
    "status": "Accepted (2026-07-28)",
    "cluster": "Data Model & Archival",
    "file": "0004-author-normalized-separately-from-post.md",
    "storyRefs": [
      "3.1"
    ]
  },
  {
    "id": "005",
    "num": 5,
    "title": "`IngestionRun` as the immutable acquisition/audit anchor for every post",
    "status": "Accepted (2026-07-28)",
    "cluster": "Data Model & Archival",
    "file": "0005-ingestion-run-as-audit-anchor.md",
    "storyRefs": [
      "3.2"
    ]
  },
  {
    "id": "006",
    "num": 6,
    "title": "Prefer connector-side native filtering for watchlist matching, with post-fetch matching as fallback",
    "status": "Accepted (2026-07-28)",
    "cluster": "Data Model & Archival",
    "file": "0006-watchlist-matching-connector-side-with-fallback.md",
    "storyRefs": [
      "3.3"
    ]
  },
  {
    "id": "007",
    "num": 7,
    "title": "`AuthorTopicSignal` ships with raw signals only, no computed expertise score",
    "status": "Accepted (2026-07-28)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0007-author-topic-signal-minimal-v1.md",
    "storyRefs": [
      "4.1"
    ]
  },
  {
    "id": "008",
    "num": 8,
    "title": "Defer `TopicDailyCount` aggregation and all charting to a future subsystem",
    "status": "Accepted (2026-07-28)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0008-defer-topic-time-series-and-charting.md",
    "storyRefs": [
      "4.2"
    ]
  },
  {
    "id": "009",
    "num": 9,
    "title": "`ConnectorHealth` is fully derived from `IngestionRun` history, not stored mutable state",
    "status": "Accepted (2026-07-28)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0009-connector-health-derived-not-stored.md",
    "storyRefs": [
      "4.3"
    ]
  },
  {
    "id": "010",
    "num": 10,
    "title": "Retryable-vs-non-retryable error policy with per-tenant auto-disable",
    "status": "Accepted (2026-07-28)",
    "cluster": "Ingestion & Connectors",
    "file": "0010-error-handling-and-auto-disable-policy.md",
    "storyRefs": [
      "2.3",
      "2.12"
    ]
  },
  {
    "id": "011",
    "num": 11,
    "title": "Cursor-based pagination for `GET /posts`",
    "status": "Accepted (2026-07-28)",
    "cluster": "Data Model & Archival",
    "file": "0011-cursor-based-pagination-for-posts-api.md",
    "storyRefs": [
      "3.4",
      "6.11",
      "6.18",
      "6.25"
    ]
  },
  {
    "id": "012",
    "num": 12,
    "title": "Service Bus events carry IDs and minimal fields only; full data is fetched via REST on demand",
    "status": "Accepted (2026-07-28)",
    "cluster": "Repository & Foundation",
    "file": "0012-thin-events-with-rest-fetch-on-demand.md",
    "storyRefs": [
      "5.1",
      "6.11"
    ]
  },
  {
    "id": "013",
    "num": 13,
    "title": "Per-tenant event filtering via Service Bus subscription SQL filters",
    "status": "Accepted (2026-07-28)",
    "cluster": "Repository & Foundation",
    "file": "0013-per-tenant-event-filtering-via-subscription-rules.md",
    "storyRefs": [
      "5.2"
    ]
  },
  {
    "id": "014",
    "num": 14,
    "title": "Envelope-encrypted credential storage via Azure Key Vault, OAuth preferred with API-key fallback",
    "status": "Accepted (2026-07-28)",
    "cluster": "Security & Multi-Tenancy",
    "file": "0014-credential-storage-envelope-encryption-oauth-first.md",
    "storyRefs": [
      "5.3"
    ]
  },
  {
    "id": "015",
    "num": 15,
    "title": "Enforce tenant isolation at the database layer with Postgres Row-Level Security",
    "status": "Accepted (2026-07-28)",
    "cluster": "Repository & Foundation",
    "file": "0015-tenant-isolation-via-postgres-row-level-security.md",
    "storyRefs": [
      "5.4"
    ]
  },
  {
    "id": "016",
    "num": 16,
    "title": "Postgres as the database engine",
    "status": "Accepted (2026-07-28)",
    "cluster": "Repository & Foundation",
    "file": "0016-postgres-as-database-engine.md",
    "storyRefs": [
      "1.2",
      "1.10"
    ]
  },
  {
    "id": "017",
    "num": 17,
    "title": "API versioning and compatibility policy",
    "status": "Accepted (2026-07-29) \u2014 decided ahead of its natural implementation phase (see below)",
    "cluster": "Repository & Foundation",
    "file": "0017-api-versioning-and-compatibility-policy.md",
    "storyRefs": [
      "1.3"
    ]
  },
  {
    "id": "018",
    "num": 18,
    "title": "Data retention and archival policy",
    "status": "Accepted (2026-07-29) \u2014 see Acceptance note below",
    "cluster": "Data Model & Archival",
    "file": "0018-data-retention-and-archival-policy.md",
    "storyRefs": [
      "3.5"
    ]
  },
  {
    "id": "019",
    "num": 19,
    "title": "Event schema versioning policy",
    "status": "Accepted (2026-07-29) \u2014 decided ahead of its natural implementation phase (see below)",
    "cluster": "Repository & Foundation",
    "file": "0019-event-schema-versioning-policy.md",
    "storyRefs": [
      "5.5"
    ]
  },
  {
    "id": "020",
    "num": 20,
    "title": "Rate-limit queue bounds, dead-letter handling, and distributed gate state",
    "status": "Accepted (2026-07-29) \u2014 see Acceptance note below",
    "cluster": "Ingestion & Connectors",
    "file": "0020-rate-limit-queue-bounds-and-distributed-gate-state.md",
    "storyRefs": [
      "2.4"
    ]
  },
  {
    "id": "021",
    "num": 21,
    "title": "Unified boolean-query AST for watchlist matching, with per-connector capability matrix",
    "status": "Accepted (2026-07-29) \u2014 see Acceptance note below",
    "cluster": "Data Model & Archival",
    "file": "0021-watchlist-boolean-query-ast-and-capability-matrix.md",
    "storyRefs": [
      "3.6"
    ]
  },
  {
    "id": "022",
    "num": 22,
    "title": "Derived-data caching and refresh strategy (`ConnectorHealth` read cache, `AuthorTopicSignal` refresh cadence)",
    "status": "Accepted (2026-07-29) \u2014 see Acceptance note below",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0022-derived-data-caching-and-refresh-strategy.md",
    "storyRefs": [
      "4.4"
    ]
  },
  {
    "id": "023",
    "num": 23,
    "title": "Proportional (rate-relative) connector failure threshold for auto-disable",
    "status": "Accepted (2026-07-29) \u2014 see Acceptance note below",
    "cluster": "Ingestion & Connectors",
    "file": "0023-proportional-connector-failure-threshold.md",
    "storyRefs": [
      "2.5",
      "2.12"
    ]
  },
  {
    "id": "024",
    "num": 24,
    "title": "Newswire connector \u2014 direct wire-service RSS feeds, with issuer-as-Author modeling",
    "status": "Accepted (2026-07-30) \u2014 see Acceptance note below",
    "cluster": "Ingestion & Connectors",
    "file": "0024-newswire-connector-direct-wire-rss-issuer-as-author.md",
    "storyRefs": [
      "2.6"
    ]
  },
  {
    "id": "025",
    "num": 25,
    "title": "Persistent local dev database, kept separate from the ephemeral test database",
    "status": "Accepted (2026-07-30) \u2014 see Acceptance note below",
    "cluster": "Repository & Foundation",
    "file": "0025-persistent-local-dev-database-separate-from-test-database.md",
    "storyRefs": [
      "1.4"
    ]
  },
  {
    "id": "026",
    "num": 26,
    "title": "RSS/News connector \u2014 GNews API, with publication-as-Author modeling",
    "status": "Accepted (2026-07-31) \u2014 drafted 2026-07-31 by the AI Business & Requirements Analyst persona (left Proposed, per its own charter boundary), reviewed and accepted later the same day by Menno as Sponsor. Story 2.7 moves to **Ready**.",
    "cluster": "Ingestion & Connectors",
    "file": "0026-rss-news-connector-gnews-api-publication-as-author.md",
    "storyRefs": [
      "2.7"
    ]
  },
  {
    "id": "027",
    "num": 27,
    "title": "Connector architecture is a technical intermediary only \u2014 SocialEngage is never a party to, reseller of, or intermediary in the connecting party's relationship with a data source",
    "status": "Accepted (2026-08-01) \u2014 drafted, revised twice (the paid-tier eligibility bullet added, then reversed), and reviewed by Menno as Sponsor all within the same day. Approved as written, including the corrected \"Source eligibility\" bullet and its \"no intermediary in billing or pricing\" clause \u2014 see Acceptance note below.",
    "cluster": "Ingestion & Connectors",
    "file": "0027-connector-is-technical-intermediary-not-contracting-party.md",
    "storyRefs": [
      "6.3"
    ]
  },
  {
    "id": "028",
    "num": 28,
    "title": "Credential creation authority is scoped by ownership tier \u2014 no system-wide credentials, tenant-wide credentials created only by Tenant-Admin, user-bound credentials self-activated by the user",
    "status": "Accepted (2026-08-03) \u2014 drafted by the AI Business & Requirements Analyst persona from a principle stated directly by Menno (Sponsor) this session, then revised in place multiple times the same day (tiers 2/3 grounded in concrete social-platform account-type examples; the AI-enrichment scope question resolved; the Reddit tier-2/app-only correction, verified against Reddit's own OAuth2 documentation; the respond/reply Tier 3 example and its Social Care out-of-scope flag) \u2014 then reviewed and accepted by Menno as Sponsor, same day. See Acceptance note below.",
    "cluster": "Security & Multi-Tenancy",
    "file": "0028-credential-creation-authority-scoped-by-ownership-tier.md",
    "storyRefs": []
  },
  {
    "id": "029",
    "num": 29,
    "title": "Authentication mechanism \u2014 Microsoft Entra External ID, integrated as a thin, pluggable OIDC token issuer",
    "status": "Accepted (2026-08-03) \u2014 drafted by the AI Business & Requirements Analyst persona, revised in place three times the same day (Alternatives Considered/Consequences below carry the full record), then reviewed and accepted by Menno. First of a seven-ADR batch (candidate ADRs #1\u2013#7, `docs/adr/README.md`'s 2026-07-30 governance note); ADRs #2\u2013#7 (this session) assume this ADR's shape \u2014 their own acceptance remains separate and pending.",
    "cluster": "Security & Multi-Tenancy",
    "file": "0029-authentication-mechanism-entra-external-id.md",
    "storyRefs": [
      "5.6"
    ]
  },
  {
    "id": "030",
    "num": 30,
    "title": "Admin-tier design \u2014 Platform Admin via a narrowly-scoped, audited `BYPASSRLS` role; Tenant-Admin via ordinary tenant-scoped RLS plus an application-layer role check",
    "status": "Accepted (2026-08-03) \u2014 drafted by the AI Business & Requirements Analyst persona, revised in place at review per Menno's break-glass instruction (Amendment Log below), then accepted. Second of a seven-ADR batch; assumes ADR-0029's authentication shape (single Entra external tenant, `sub`-based identity resolution, Postgres as sole owner of tenant/role/license data).",
    "cluster": "Security & Multi-Tenancy",
    "file": "0030-admin-tier-design-platform-admin-rls-exception.md",
    "storyRefs": [
      "5.7",
      "5.12",
      "5.13",
      "5.14",
      "6.6"
    ]
  },
  {
    "id": "031",
    "num": 31,
    "title": "`tenants` table shape and its own Row-Level Security policy",
    "status": "Accepted (2026-08-03) \u2014 drafted by the AI Business & Requirements Analyst persona, revised in place at review to add sign-up domain capture (Amendment Log below), then accepted. Third of a seven-ADR batch; assumes ADR-0029 (authentication) and ADR-0030 (Platform Admin's `platform_admin_role`, `BYPASSRLS`-based, scoped to this table).",
    "cluster": "Security & Multi-Tenancy",
    "file": "0031-tenants-table-shape.md",
    "storyRefs": [
      "1.8",
      "5.8",
      "5.12",
      "6.6"
    ]
  },
  {
    "id": "032",
    "num": 32,
    "title": "`users` table shape, RLS, and the request-time identity-resolution path",
    "status": "Accepted (2026-08-03) \u2014 drafted by the AI Business & Requirements Analyst persona, then accepted by Menno after a clarifying exchange (Acceptance note, Amendment Log below). Fourth of a seven-ADR batch; assumes ADR-0029 (authentication/Entra), ADR-0030 (bypass mechanism and its identity-resolution use), and ADR-0031 (`tenants` table this table references).",
    "cluster": "Security & Multi-Tenancy",
    "file": "0032-users-table-shape-and-rls.md",
    "storyRefs": [
      "1.9",
      "5.9",
      "5.17",
      "6.14"
    ]
  },
  {
    "id": "033",
    "num": 33,
    "title": "Retire `X-Tenant-Id` as the tenant-identity trust mechanism",
    "status": "Accepted (2026-08-03) \u2014 drafted by the AI Business & Requirements Analyst persona, reviewed and accepted by Menno as drafted, no revisions. Fifth of a seven-ADR batch; assumes ADR-0029 (Entra authentication), ADR-0030 (bypass mechanism), ADR-0031/ADR-0032 (`tenants`/`users` schemas and the identity-resolution path).",
    "cluster": "Security & Multi-Tenancy",
    "file": "0033-retire-x-tenant-id-header-placeholder.md",
    "storyRefs": [
      "5.10"
    ]
  },
  {
    "id": "034",
    "num": 34,
    "title": "Connector connect/disconnect CRUD \u2014 ownership-tier-aware credential creation, reworking Story 1.6's placeholder-auth shape",
    "status": "Accepted (2026-08-03) \u2014 drafted by the AI Business & Requirements Analyst persona, accepted by Menno with its own flagged interpretive question directly confirmed (Acceptance note below). Sixth of a seven-ADR batch; assumes ADR-0029 (authentication), ADR-0030 (Admin-tier), ADR-0031/ADR-0032 (`tenants`/`users`), and ADR-0033 (retiring `X-Tenant-Id`) \u2014 and must satisfy ADR-0028's already-Accepted credential-ownership-tier rules, which this ADR is the first to actually build against.",
    "cluster": "Security & Multi-Tenancy",
    "file": "0034-connector-connect-disconnect-crud-ownership-tier-aware.md",
    "storyRefs": [
      "1.7",
      "6.3"
    ]
  },
  {
    "id": "035",
    "num": 35,
    "title": "Admin UI's own shape \u2014 one role-gated Next.js app, not two separate deployables",
    "status": "Accepted (2026-08-03) \u2014 drafted by the AI Business & Requirements Analyst persona, accepted by Menno with its own flagged rule-of-three recommendation directly decided (Acceptance note below). Seventh and last of this batch; assumes ADR-0029\u20130034.",
    "cluster": "Repository & Foundation",
    "file": "0035-admin-ui-shape-one-app-role-gated.md",
    "storyRefs": [
      "6.2",
      "6.6"
    ]
  },
  {
    "id": "036",
    "num": 36,
    "title": "Admin UI's own authentication/session mechanism \u2014 server-side (BFF) session, no bearer token in browser JS, role-gating sourced from a new core identity endpoint",
    "status": "Accepted (2026-08-04) \u2014 drafted by the AI Business & Requirements Analyst persona (left Proposed, per its own charter boundary; this persona does not hold ADR-acceptance authority, the same rule ADR-0026/0027/0028/0029\u20130035 followed), revised in place four times the same day (Amendment Log below), then reviewed and accepted by Menno. Story 6.1 moves to **Ready**.",
    "cluster": "Security & Multi-Tenancy",
    "file": "0036-admin-ui-authentication-session-and-role-gating-mechanism.md",
    "storyRefs": [
      "5.11",
      "6.1",
      "6.2"
    ]
  },
  {
    "id": "037",
    "num": 37,
    "title": "Self-service tenant sign-up \u2014 authorization mechanism for unauthenticated tenant creation, domain-match handling, and public-email-provider exclusion",
    "status": "Accepted (2026-08-04) \u2014 drafted by the AI Business & Requirements Analyst persona (left Proposed, per its own charter boundary; this persona does not hold ADR-acceptance authority, the same rule ADR-0026/0027/0028/0029\u20130036 followed), revised in place twice at review (a Security & Architecture Reviewer finding on domain-match information disclosure, then Menno's own direct instruction on domain-match visibility/escalation), then accepted by Menno. Story 6.7 moves to **Ready** (still practically gated on the same not-yet-built cross-repo endpoint named throughout this ADR).",
    "cluster": "Security & Multi-Tenancy",
    "file": "0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md",
    "storyRefs": [
      "5.15",
      "5.16",
      "6.7",
      "6.10"
    ]
  },
  {
    "id": "038",
    "num": 38,
    "title": "AI enrichment provider selection \u2014 Azure AI Language as the first concrete `AIProviderConnector`, general-purpose-LLM structured extraction named as the deliberate second-provider swappability candidate",
    "status": "Accepted (2026-08-06) \u2014 drafted by the AI Business & Requirements Analyst persona (left Proposed, per its own charter boundary; this persona does not hold ADR-acceptance authority, the same rule ADR-0026/0027/0028/0029\u20130037 followed), then accepted by Menno as drafted. Story 2.8 moves to **Ready**.",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0038-ai-enrichment-provider-selection-azure-ai-language-first-llm-structured-extraction-named-second-candidate.md",
    "storyRefs": [
      "2.8",
      "2.9",
      "2.16",
      "2.17"
    ]
  },
  {
    "id": "039",
    "num": 39,
    "title": "Tenant offboarding data lifecycle \u2014 export before deletion, retention interaction, and what \"deleted\" means across primary, archival, and credential storage",
    "status": "Accepted (2026-08-06) \u2014 drafted by the AI Business & Requirements Analyst persona (left Proposed, per its own charter boundary; this persona does not hold ADR-acceptance authority), then accepted by Menno as drafted. Story 3.7 moves to **Ready**.",
    "cluster": "Data Model & Archival",
    "file": "0039-tenant-offboarding-data-lifecycle-export-and-deletion.md",
    "storyRefs": [
      "3.7"
    ]
  },
  {
    "id": "040",
    "num": 40,
    "title": "Self-service tenant sign-up rate limiting and abuse-prevention mechanism",
    "status": "Accepted (2026-08-06) \u2014 drafted by the AI Business & Requirements Analyst persona (left Proposed, per its own charter boundary; this persona does not hold ADR-acceptance authority), then accepted by Menno as drafted. Story 5.18 moves to **Ready**.",
    "cluster": "Security & Multi-Tenancy",
    "file": "0040-self-service-signup-rate-limiting-and-abuse-prevention-mechanism.md",
    "storyRefs": [
      "5.18"
    ]
  },
  {
    "id": "041",
    "num": 41,
    "title": "Platform Admin is a distinct identity *kind*, never a value within the tenant-user role enum \u2014 structural distinctness required at every layer, not only the database",
    "status": "Accepted (2026-08-06) \u2014 drafted by the AI Business & Requirements Analyst persona, at Menno's direct request, following a real healing pass the same day; accepted by Menno as Sponsor later the same day. Story: none \u2014 a no-story ADR, category 1 (see \"A note on this ADR's own place in the series' conventions\" below).",
    "cluster": "Repository & Foundation",
    "file": "0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md",
    "storyRefs": []
  },
  {
    "id": "042",
    "num": 42,
    "title": "Wikipedia connector \u2014 MediaWiki API, revision re-poll cadence, article-as-Author modeling",
    "status": "Accepted (2026-08-08) \u2014 drafted 2026-08-06 by the AI Business & Requirements Analyst persona, left Proposed per this persona's own charter boundary, then reviewed and approved by Menno (Sponsor) on 2026-08-08 (`\"ADR 0042 Approved\"`). Same rule ADR-0024/0026/0027/0028 followed for the drafting-vs-acceptance boundary.",
    "cluster": "Ingestion & Connectors",
    "file": "0042-wikipedia-connector-mediawiki-api-article-as-author.md",
    "storyRefs": [
      "2.13",
      "2.14"
    ]
  },
  {
    "id": "043",
    "num": 43,
    "title": "Self-service, Tenant-Admin-initiated tenant deletion \u2014 the sole tenant-deletion mechanism, full supersession of ADR-0039 Decision \u00a71",
    "status": "Accepted (2026-08-07) \u2014 drafted by the AI Business & Requirements Analyst persona, revised in place before acceptance (see below), then accepted by Menno as revised.",
    "cluster": "Security & Multi-Tenancy",
    "file": "0043-self-service-tenant-initiated-deletion.md",
    "storyRefs": [
      "3.8",
      "6.13"
    ]
  },
  {
    "id": "044",
    "num": 44,
    "title": "Watchlist CRUD contract \u2014 PATCH semantics, error mapping, and updated_at policy",
    "status": "Accepted (2026-08-11)",
    "cluster": "Data Model & Archival",
    "file": "0044-watchlist-api-design-and-database-schema-standardization.md",
    "storyRefs": [
      "1.5",
      "6.4"
    ]
  },
  {
    "id": "047",
    "num": 47,
    "title": "Standard pattern for cross-story references and supersession language",
    "status": "Accepted (2026-08-11)",
    "cluster": "Data Model & Archival",
    "file": "0047-standard-pattern-for-cross-story-references-and-supersession-language.md",
    "storyRefs": []
  },
  {
    "id": "048",
    "num": 48,
    "title": "Explicit policy for \"no core pipeline change\" verification when registering new connectors",
    "status": "Accepted (2026-08-11)",
    "cluster": "Ingestion & Connectors",
    "file": "0048-no-core-pipeline-change-verification-for-new-connector-registration.md",
    "storyRefs": [
      "2.10"
    ]
  },
  {
    "id": "049",
    "num": 49,
    "title": "Retain point-in-time author follower count on `SocialPost` as a scoped exception to normalized `Author` storage",
    "status": "Accepted (2026-08-11)",
    "cluster": "Data Model & Archival",
    "file": "0049-point-in-time-author-follower-count-on-social-post.md",
    "storyRefs": [
      "3.9"
    ]
  },
  {
    "id": "050",
    "num": 50,
    "title": "Tenant-owned-domain RSS/content-feed connector with DNS TXT domain ownership verification",
    "status": "Accepted (2026-08-11)",
    "cluster": "Ingestion & Connectors",
    "file": "0050-tenant-owned-domain-rss-content-feed-connector.md",
    "storyRefs": [
      "2.11",
      "2.19",
      "2.19",
      "6.12",
      "6.20"
    ]
  },
  {
    "id": "051",
    "num": 51,
    "title": "Connector activation decoupled from credential storage \u2014 two new, ownership-scoped `connector_activations`/`connector_user_activations` tables",
    "status": "Accepted (2026-08-12)",
    "cluster": "Ingestion & Connectors",
    "file": "0051-connector-activation-decoupled-from-credential.md",
    "storyRefs": [
      "1.11",
      "1.12",
      "6.15",
      "6.17",
      "6.21"
    ]
  },
  {
    "id": "052",
    "num": 52,
    "title": "Live ingestion-polling scheduler \u2014 connector registry bootstrap, generic per-connector `poll()` invocation, in-process interval loop with derived (not stored) cadence",
    "status": "Accepted (2026-08-13)",
    "cluster": "Ingestion & Connectors",
    "file": "0052-live-ingestion-polling-scheduler.md",
    "storyRefs": [
      "1.13",
      "1.14"
    ]
  },
  {
    "id": "053",
    "num": 53,
    "title": "A canonical Markdown post-body representation \u2014 computed once at ingestion, stored on `social_posts`, decoupling N ingestion sources from M future consumers",
    "status": "Accepted (2026-08-13)",
    "cluster": "Data Model & Archival",
    "file": "0053-canonical-markdown-post-body-normalization-at-ingestion.md",
    "storyRefs": [
      "3.10",
      "6.19"
    ]
  },
  {
    "id": "054",
    "num": 54,
    "title": "Tenant-facing Analytics Dashboard \u2014 v1 scope, client-side data-source strategy, and a scoped, narrow supersession of ADR-0008's charting deferral",
    "status": "Accepted (2026-08-17)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md",
    "storyRefs": [
      "6.18",
      "8.1",
      "8.2",
      "8.3",
      "8.4",
      "8.6"
    ]
  },
  {
    "id": "055",
    "num": 55,
    "title": "Language and location enrichment for the Analytics Dashboard \u2014 surfacing an already-captured field vs. a still-absent one",
    "status": "Accepted (2026-08-17)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0055-analytics-language-and-location-enrichment-feasibility.md",
    "storyRefs": [
      "8.5"
    ]
  },
  {
    "id": "056",
    "num": 56,
    "title": "AI-provider-inferred origin location from a Newswire post's own dateline text \u2014 feasibility, architecture, and v1-scope recommendation",
    "status": "Accepted (2026-08-17)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0056-ai-inferred-origin-location-newswire-dateline-extraction.md",
    "storyRefs": []
  },
  {
    "id": "057",
    "num": 57,
    "title": "Multi-feed administration for the tenant-owned-feed connector \u2014 list, edit, and remove, resolving ADR-0050 Open Question 2",
    "status": "Accepted (2026-08-17)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0057-tenant-owned-feed-multi-feed-administration.md",
    "storyRefs": [
      "6.20"
    ]
  },
  {
    "id": "058",
    "num": 58,
    "title": "Wire `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` publishing into the real ingestion pipeline",
    "status": "Accepted (2026-08-17)",
    "cluster": "Ingestion & Connectors",
    "file": "0058-wire-ingestion-events-into-real-connector-pipeline.md",
    "storyRefs": [
      "5.19"
    ]
  },
  {
    "id": "059",
    "num": 59,
    "title": "Facebook connector \u2014 narrowed to a tenant's own connected Page (Standard/Advanced Access), organization-as-Author modeling; genuine public-content social listening found not viable",
    "status": "Unknown",
    "cluster": "Ingestion & Connectors",
    "file": "0059-facebook-connector-tenant-owned-page-scope-organization-as-author.md",
    "storyRefs": [
      "2.15",
      "2.18",
      "6.23"
    ]
  },
  {
    "id": "060",
    "num": 60,
    "title": "Facebook connector \u2014 one user may connect more than one Page (cardinality, not credential-tier, change)",
    "status": "Unknown",
    "cluster": "Ingestion & Connectors",
    "file": "0060-facebook-connector-multiple-pages-per-user.md",
    "storyRefs": [
      "6.27"
    ]
  },
  {
    "id": "061",
    "num": 61,
    "title": "Tier-3 (user-bound) poll scheduling \u2014 per-user enumeration, cross-user health/in-flight isolation, `pollUser()` as a new generic scheduler surface",
    "status": "Unknown",
    "cluster": "Ingestion & Connectors",
    "file": "0061-tier-3-poll-scheduler-per-user-enumeration.md",
    "storyRefs": [
      "1.15"
    ]
  },
  {
    "id": "062",
    "num": 62,
    "title": "Analytics Dashboard \u2014 Overview Tab Enhancement: multi-dimensional filter model, AI Spike Storyteller, statistical volume forecast, and widget scope",
    "status": "Accepted (2026-08-19)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0062-analytics-dashboard-overview-tab-enhancement.md",
    "storyRefs": [
      "8.7",
      "8.8"
    ]
  },
  {
    "id": "063",
    "num": 63,
    "title": "Post-watchlist match persistence \u2014 `post_watchlist_matches` junction table and `GET /v1/posts?watchlistId` server-side filter",
    "status": "Accepted (2026-08-19)",
    "cluster": "Data Model & Archival",
    "file": "0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md",
    "storyRefs": [
      "3.11",
      "3.12",
      "8.9"
    ]
  },
  {
    "id": "064",
    "num": 64,
    "title": "Location and geospatial insights from posts and authors",
    "status": "Accepted (2026-08-20)",
    "cluster": "Data Model & Archival",
    "file": "0064-location-and-geospatial-insights-from-posts-and-authors.md",
    "storyRefs": [
      "2.20",
      "8.10"
    ]
  },
  {
    "id": "065",
    "num": 65,
    "title": "Active Watchlist Sourcing via Brave Search API \u2014 Polling Connector, Post Ingestion Grounding, and LLM Enrichment",
    "status": "Accepted (2026-08-20)",
    "cluster": "Ingestion & Connectors",
    "file": "0065-active-watchlist-sourcing-via-brave-search-api.md",
    "storyRefs": [
      "2.21",
      "6.30"
    ]
  },
  {
    "id": "066",
    "num": 66,
    "title": "Active Watchlist Sourcing via Bing Search API (Azure) \u2014 Polling Connector, Post Ingestion Grounding, and LLM Enrichment",
    "status": "Accepted (2026-08-20)",
    "cluster": "Ingestion & Connectors",
    "file": "0066-active-watchlist-sourcing-via-bing-search-api.md",
    "storyRefs": [
      "2.22",
      "6.32"
    ]
  },
  {
    "id": "067",
    "num": 67,
    "title": "Facebook Connector (`facebook`) \u2014 Platform Connector Scope Reconfirmation, Managed Pages vs. Personal User Profiles, Hosting Page Dependency, and Two-Tier Author Resolution",
    "status": "Accepted (2026-08-20; amended 2026-08-22)",
    "cluster": "Ingestion & Connectors",
    "file": "0067-reconfirm-facebook-connector.md",
    "storyRefs": [
      "2.23",
      "6.33",
      "6.37"
    ]
  },
  {
    "id": "068",
    "num": 68,
    "title": "Instagram Connector (`instagram`) \u2014 Platform Connector Scope, Business/Creator Account Model, Hosting Profile Dependency, and Tier-3 OAuth Harmonization",
    "status": "Accepted (2026-08-20)",
    "cluster": "Ingestion & Connectors",
    "file": "0068-instagram-connector.md",
    "storyRefs": [
      "2.24",
      "6.34"
    ]
  },
  {
    "id": "069",
    "num": 69,
    "title": "LinkedIn Connector (`linkedin`) \u2014 OAuth 2.0 Account Connection, Token Lifecycle, and Ingestion Architecture",
    "status": "Accepted (2026-08-20)",
    "cluster": "Ingestion & Connectors",
    "file": "0069-linkedin-connector.md",
    "storyRefs": [
      "2.25",
      "6.35"
    ]
  },
  {
    "id": "070",
    "num": 70,
    "title": "Connector Ingestion Health Status, Hanging Run Watchdog Reconciliation, and Inactivity Alerting",
    "status": "Accepted (2026-08-20)",
    "cluster": "Ingestion & Connectors",
    "file": "0070-connector-ingestion-status-hanging-run-reconciliation-and-alerts.md",
    "storyRefs": [
      "1.16",
      "6.29"
    ]
  },
  {
    "id": "071",
    "num": 71,
    "title": "Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI",
    "status": "Accepted (2026-08-20)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0071-human-in-the-loop-post-enrichment-overrides-and-cascading-drawer-ui.md",
    "storyRefs": [
      "3.13",
      "6.31"
    ]
  },
  {
    "id": "072",
    "num": 72,
    "title": "Cross-Platform Polypost Composer and Multi-Network Preview Engine",
    "status": "Accepted (2026-08-22)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0072-cross-platform-polypost-composer-and-multi-network-preview-engine.md",
    "storyRefs": [
      "6.36"
    ]
  },
  {
    "id": "073",
    "num": 73,
    "title": "Outbound Reply to Ingested Posts via Platform APIs",
    "status": "Accepted (2026-08-22)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0073-outbound-reply-to-ingested-posts.md",
    "storyRefs": [
      "2.26",
      "2.27",
      "3.14",
      "6.38"
    ]
  },
  {
    "id": "074",
    "num": 74,
    "title": "Tenant-Facing Workspace and Matched-Posts Export",
    "status": "Accepted (2026-08-23)",
    "cluster": "Data Model & Archival",
    "file": "0074-tenant-facing-workspace-and-posts-export.md",
    "storyRefs": [
      "3.16",
      "6.40"
    ]
  },
  {
    "id": "075",
    "num": 75,
    "title": "Outbound Social Post Publishing via Platform APIs",
    "status": "Accepted (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0075-outbound-social-post-publishing.md",
    "storyRefs": [
      "2.28",
      "2.29",
      "2.30",
      "3.15",
      "6.39"
    ]
  },
  {
    "id": "076",
    "num": 76,
    "title": "Composer Deep Research Agent \u2014 Context Summary from Post Text, Key Phrases, and Search Results",
    "status": "Accepted (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0076-composer-deep-research-agent.md",
    "storyRefs": [
      "2.31",
      "2.32",
      "3.17",
      "6.41"
    ]
  },
  {
    "id": "077",
    "num": 77,
    "title": "Watchlist connector count and preview endpoint",
    "status": "Accepted 2026-08-23 (review adjustments incorporated 2026-08-23)",
    "cluster": "Ingestion & Connectors",
    "file": "0077-watchlist-connector-count-method.md",
    "storyRefs": [
      "9.1"
    ]
  },
  {
    "id": "078",
    "num": 78,
    "title": "Metric explainability endpoint",
    "status": "Accepted (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0078-metric-explainability-endpoint.md",
    "storyRefs": [
      "9.2"
    ]
  },
  {
    "id": "079",
    "num": 79,
    "title": "Crisis template bundle and activation",
    "status": "Accepted (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0079-crisis-template-bundle-and-activation.md",
    "storyRefs": [
      "9.3",
      "9.4"
    ]
  },
  {
    "id": "080",
    "num": 80,
    "title": "Onboarding checklist state",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0080-onboarding-checklist-state.md",
    "storyRefs": [
      "9.5",
      "9.6"
    ]
  },
  {
    "id": "081",
    "num": 81,
    "title": "RAGConnector provider abstraction",
    "status": "Proposed (2026-08-23)",
    "cluster": "Ingestion & Connectors",
    "file": "0081-rag-connector-provider-abstraction.md",
    "storyRefs": [
      "9.7"
    ]
  },
  {
    "id": "082",
    "num": 82,
    "title": "RAG post chunking and embedding pipeline",
    "status": "Proposed (2026-08-23)",
    "cluster": "Data Model & Archival",
    "file": "0082-rag-post-chunking-and-embedding.md",
    "storyRefs": [
      "9.8"
    ]
  },
  {
    "id": "083",
    "num": 83,
    "title": "RAG vector-store RLS and metadata",
    "status": "Proposed (2026-08-23)",
    "cluster": "Data Model & Archival",
    "file": "0083-rag-vector-store-rls-and-metadata.md",
    "storyRefs": [
      "9.9"
    ]
  },
  {
    "id": "084",
    "num": 84,
    "title": "RAG search and ask endpoint",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0084-rag-search-and-ask-endpoint.md",
    "storyRefs": [
      "9.10"
    ]
  },
  {
    "id": "085",
    "num": 85,
    "title": "RAG UI/UX and loading patterns",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0085-rag-ui-ux-and-loading-patterns.md",
    "storyRefs": [
      "9.11"
    ]
  },
  {
    "id": "086",
    "num": 86,
    "title": "Prospecting list model and sharing",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0086-prospecting-list-model-and-sharing.md",
    "storyRefs": [
      "10.1",
      "10.2"
    ]
  },
  {
    "id": "087",
    "num": 87,
    "title": "Preconfigured analytics views",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0087-preconfigured-analytics-views.md",
    "storyRefs": [
      "10.3"
    ]
  },
  {
    "id": "088",
    "num": 88,
    "title": "Ad-hoc query allowlist",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0088-ad-hoc-query-allowlist.md",
    "storyRefs": [
      "10.4",
      "10.5"
    ]
  },
  {
    "id": "089",
    "num": 89,
    "title": "Platform operations dashboard",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0089-platform-operations-dashboard.md",
    "storyRefs": [
      "10.6",
      "10.7"
    ]
  },
  {
    "id": "090",
    "num": 90,
    "title": "Data export \u2014 posts CSV",
    "status": "Proposed (2026-08-23)",
    "cluster": "Data Model & Archival",
    "file": "0090-data-export-posts-csv.md",
    "storyRefs": [
      "10.8"
    ]
  },
  {
    "id": "091",
    "num": 91,
    "title": "Real-time alert rules and delivery",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0091-real-time-alert-rules-and-delivery.md",
    "storyRefs": [
      "10.9",
      "10.10"
    ]
  },
  {
    "id": "092",
    "num": 92,
    "title": "Author-initiated takedown",
    "status": "Proposed (2026-08-23)",
    "cluster": "Data Model & Archival",
    "file": "0092-author-initiated-takedown.md",
    "storyRefs": [
      "10.11"
    ]
  },
  {
    "id": "093",
    "num": 93,
    "title": "DSR self-service portal",
    "status": "Proposed (2026-08-23)",
    "cluster": "Data Model & Archival",
    "file": "0093-dsr-self-service-portal.md",
    "storyRefs": [
      "10.12"
    ]
  },
  {
    "id": "094",
    "num": 94,
    "title": "Compliance audit pack",
    "status": "Proposed (2026-08-23)",
    "cluster": "Data Model & Archival",
    "file": "0094-compliance-audit-pack.md",
    "storyRefs": [
      "10.13"
    ]
  },
  {
    "id": "095",
    "num": 95,
    "title": "Case handoff to CRM",
    "status": "Proposed (2026-08-23)",
    "cluster": "Data Model & Archival",
    "file": "0095-case-handoff-to-crm.md",
    "storyRefs": [
      "11.1",
      "11.2"
    ]
  },
  {
    "id": "096",
    "num": 96,
    "title": "Daily digest email",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0096-daily-digest-email.md",
    "storyRefs": [
      "11.3",
      "11.4"
    ]
  },
  {
    "id": "097",
    "num": 97,
    "title": "Topic evolution timeline",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0097-topic-evolution-timeline.md",
    "storyRefs": [
      "11.5",
      "11.6"
    ]
  },
  {
    "id": "098",
    "num": 98,
    "title": "Publishing and scheduling",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0098-publishing-and-scheduling.md",
    "storyRefs": [
      "11.7",
      "11.8"
    ]
  },
  {
    "id": "099",
    "num": 99,
    "title": "Unified social inbox and reply",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0099-unified-social-inbox-and-reply.md",
    "storyRefs": [
      "11.9",
      "11.10"
    ]
  },
  {
    "id": "100",
    "num": 100,
    "title": "Composed post author mention suggestions",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0100-composed-post-author-mention-suggestions.md",
    "storyRefs": [
      "11.11",
      "11.12"
    ]
  },
  {
    "id": "101",
    "num": 101,
    "title": "Multi-source connector capability matrix",
    "status": "Proposed (2026-08-23)",
    "cluster": "Ingestion & Connectors",
    "file": "0101-multi-source-connector-capability-matrix.md",
    "storyRefs": [
      "12.1",
      "12.2"
    ]
  },
  {
    "id": "102",
    "num": 102,
    "title": "Boolean query AST and visual builder",
    "status": "Proposed (2026-08-23)",
    "cluster": "Data Model & Archival",
    "file": "0102-boolean-query-ast-and-visual-builder.md",
    "storyRefs": [
      "12.3",
      "12.4"
    ]
  },
  {
    "id": "103",
    "num": 103,
    "title": "AI sentiment analysis aspect schema",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0103-ai-sentiment-analysis-aspect-schema.md",
    "storyRefs": [
      "12.5",
      "12.6"
    ]
  },
  {
    "id": "104",
    "num": 104,
    "title": "AI topic clustering post-topics schema",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0104-ai-topic-clustering-post-topics-schema.md",
    "storyRefs": [
      "12.7",
      "12.8"
    ]
  },
  {
    "id": "105",
    "num": 105,
    "title": "Dashboards and analytics widget contracts",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0105-dashboards-and-analytics-widget-contracts.md",
    "storyRefs": [
      "12.9",
      "12.10"
    ]
  },
  {
    "id": "106",
    "num": 106,
    "title": "API and integrations \u2014 versioning and webhooks",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0106-api-and-integrations-versioning-and-webhooks.md",
    "storyRefs": [
      "12.11",
      "12.12"
    ]
  },
  {
    "id": "107",
    "num": 107,
    "title": "Multi-user workspaces and RBAC permissions",
    "status": "Proposed (2026-08-23)",
    "cluster": "Security & Multi-Tenancy",
    "file": "0107-multi-user-workspaces-and-rbac-permissions.md",
    "storyRefs": [
      "12.13",
      "12.14"
    ]
  },
  {
    "id": "108",
    "num": 108,
    "title": "Influencer discovery and scoring",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0108-influencer-discovery-and-scoring.md",
    "storyRefs": [
      "12.15",
      "12.16"
    ]
  },
  {
    "id": "109",
    "num": 109,
    "title": "Connector health auto-disable and recovery",
    "status": "Proposed (2026-08-23)",
    "cluster": "Ingestion & Connectors",
    "file": "0109-connector-health-auto-disable-and-recovery.md",
    "storyRefs": [
      "13.1"
    ]
  },
  {
    "id": "110",
    "num": 110,
    "title": "Per-connector query translation and validation",
    "status": "Proposed (2026-08-23)",
    "cluster": "Ingestion & Connectors",
    "file": "0110-per-connector-query-translation-and-validation.md",
    "storyRefs": [
      "13.2",
      "13.3"
    ]
  },
  {
    "id": "111",
    "num": 111,
    "title": "Export bounding, streaming, and size caps",
    "status": "Proposed (2026-08-23)",
    "cluster": "Data Model & Archival",
    "file": "0111-export-bounding-streaming-and-size-caps.md",
    "storyRefs": [
      "10.8",
      "13.4"
    ]
  },
  {
    "id": "112",
    "num": 112,
    "title": "Feature gating and seat-limit enforcement",
    "status": "Proposed (2026-08-23)",
    "cluster": "Security & Multi-Tenancy",
    "file": "0112-feature-gating-and-seat-limit-enforcement.md",
    "storyRefs": [
      "13.5",
      "13.6"
    ]
  },
  {
    "id": "113",
    "num": 113,
    "title": "Metric explainability prompt and caching",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0113-metric-explainability-prompt-and-caching.md",
    "storyRefs": [
      "13.7"
    ]
  },
  {
    "id": "114",
    "num": 114,
    "title": "Platform metrics table and Azure Metrics integration",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0114-platform-metrics-table-and-azure-metrics.md",
    "storyRefs": [
      "10.6",
      "13.8"
    ]
  },
  {
    "id": "115",
    "num": 115,
    "title": "Publishing \u2014 media upload and asset targeting",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0115-publishing-media-upload-and-asset-targeting.md",
    "storyRefs": [
      "13.9",
      "13.10"
    ]
  },
  {
    "id": "116",
    "num": 116,
    "title": "Semantic drift detection",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0116-semantic-drift-detection.md",
    "storyRefs": [
      "13.11",
      "13.12"
    ]
  },
  {
    "id": "117",
    "num": 117,
    "title": "Prospecting list export and CRM push",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0117-prospecting-list-export-and-crm-push.md",
    "storyRefs": [
      "13.13",
      "13.14"
    ]
  },
  {
    "id": "118",
    "num": 118,
    "title": "Additional Social Platform Publishing",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0118-additional-social-platform-publishing.md",
    "storyRefs": []
  },
  {
    "id": "119",
    "num": 119,
    "title": "Editing and Deleting Published Outbound Posts",
    "status": "Proposed (2026-08-23)",
    "cluster": "Analytics, Dashboards & Ops",
    "file": "0119-editing-and-deleting-published-outbound-posts.md",
    "storyRefs": []
  },
  {
    "id": "120",
    "num": 120,
    "title": "SearchProviderConnector \u2014 Shared One-Off Search Abstraction",
    "status": "Proposed (2026-08-23)",
    "cluster": "Ingestion & Connectors",
    "file": "0120-search-provider-connector.md",
    "storyRefs": []
  },
  {
    "id": "121",
    "num": 121,
    "title": "Composer Deep Research Caching, Re-Trigger, and Cost Justification",
    "status": "Proposed (2026-08-23)",
    "cluster": "AI Enrichment & Intelligence",
    "file": "0121-composer-deep-research-caching-retrigger-cost.md",
    "storyRefs": []
  }
];

export const BRD_LIST: BrdItem[] = [
  {
    "id": "BRD-0001",
    "num": 1,
    "title": "Split into `social-listening-core` and `social-listening-admin` repositories",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0001-Two-Repository-Split.md"
  },
  {
    "id": "BRD-0002",
    "num": 2,
    "title": "Unified `ProviderConnector` contract for social platforms and AI providers",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0002-Unified-Provider-Connector-Pattern.md"
  },
  {
    "id": "BRD-0003",
    "num": 3,
    "title": "Rate limiting enforced per `(tenantId, providerId)` via a shared `RequestGate`",
    "status": "Draft / Pending review",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0003-Per-Tenant-Per-Provider-Rate-Limiting.md"
  },
  {
    "id": "BRD-0004",
    "num": 4,
    "title": "Normalize `Author` once per platform account, not embedded per post",
    "status": "Draft / Pending review",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0004-Author-Normalized-Separately-From-Post.md"
  },
  {
    "id": "BRD-0005",
    "num": 5,
    "title": "`IngestionRun` as the immutable acquisition/audit anchor for every post",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0005-Ingestion-Run-As-Audit-Anchor.md"
  },
  {
    "id": "BRD-0006",
    "num": 6,
    "title": "Prefer connector-side native filtering for watchlist matching, with post-fetch matching as fallback",
    "status": "Draft",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0006-Watchlist-Matching-Connector-Side-With-Fallback.md"
  },
  {
    "id": "BRD-0007",
    "num": 7,
    "title": "`AuthorTopicSignal` ships with raw signals only, no computed expertise score",
    "status": "Approved",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0007-Author-Topic-Signal-Minimal-V1.md"
  },
  {
    "id": "BRD-0008",
    "num": 8,
    "title": "Defer `TopicDailyCount` aggregation and all charting to a future subsystem",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0008-Defer-Topic-Time-Series-And-Charting.md"
  },
  {
    "id": "BRD-0009",
    "num": 9,
    "title": "`ConnectorHealth` is fully derived from `IngestionRun` history, not stored mutable state",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0009-Connector-Health-Derived-Not-Stored.md"
  },
  {
    "id": "BRD-0010",
    "num": 10,
    "title": "Retryable-vs-non-retryable error policy with per-tenant auto-disable",
    "status": "Draft",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0010-Error-Handling-And-Auto-Disable-Policy.md"
  },
  {
    "id": "BRD-0011",
    "num": 11,
    "title": "Cursor-based pagination for `GET /posts`",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0011-Cursor-Based-Pagination-For-Posts-API.md"
  },
  {
    "id": "BRD-0012",
    "num": 12,
    "title": "Service Bus events carry IDs and minimal fields only; full data is fetched via REST on demand",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0012-Thin-Events-With-REST-Fetch-On-Demand.md"
  },
  {
    "id": "BRD-0013",
    "num": 13,
    "title": "Per-tenant event filtering via Service Bus subscription SQL filters",
    "status": "Unknown",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0013-Per-Tenant-Event-Filtering-Via-Subscription-Rules.md"
  },
  {
    "id": "BRD-0014",
    "num": 14,
    "title": "Envelope-encrypted credential storage via Azure Key Vault, OAuth preferred with API-key fallback",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0014-Credential-Storage-Envelope-Encryption-OAuth-First.md"
  },
  {
    "id": "BRD-0015",
    "num": 15,
    "title": "Enforce tenant isolation at the database layer with Postgres Row-Level Security",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0015-Tenant-Isolation-Via-Postgres-Row-Level-Security.md"
  },
  {
    "id": "BRD-0016",
    "num": 16,
    "title": "Postgres as the database engine",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0016-Postgres-As-Database-Engine.md"
  },
  {
    "id": "BRD-0017",
    "num": 17,
    "title": "API versioning and compatibility policy",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0017-API-Versioning-And-Compatibility-Policy.md"
  },
  {
    "id": "BRD-0018",
    "num": 18,
    "title": "Data retention and archival policy",
    "status": "Approved",
    "pillar": "Trust, Compliance & Data Sovereignty",
    "file": "BRD-0018-Data-Retention-And-Archival-Policy.md"
  },
  {
    "id": "BRD-0019",
    "num": 19,
    "title": "Event schema versioning policy",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0019-Event-Schema-Versioning-Policy.md"
  },
  {
    "id": "BRD-0020",
    "num": 20,
    "title": "Rate-limit queue bounds, dead-letter handling, and distributed gate state",
    "status": "Draft / Pending review",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0020-Rate-Limit-Queue-Bounds-And-Distributed-Gate-State.md"
  },
  {
    "id": "BRD-0021",
    "num": 21,
    "title": "Unified boolean-query AST for watchlist matching, with per-connector capability matrix",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0021-Watchlist-Boolean-Query-AST-And-Capability-Matrix.md"
  },
  {
    "id": "BRD-0022",
    "num": 22,
    "title": "Derived-data caching and refresh strategy (`ConnectorHealth` read cache, `AuthorTopicSignal` refresh cadence)",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0022-Derived-Data-Caching-And-Refresh-Strategy.md"
  },
  {
    "id": "BRD-0023",
    "num": 23,
    "title": "Proportional (rate-relative) connector failure threshold for auto-disable",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0023-Proportional-Connector-Failure-Threshold.md"
  },
  {
    "id": "BRD-0024",
    "num": 24,
    "title": "Newswire connector \u2014 direct wire-service RSS feeds, with issuer-as-Author modeling",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0024-Newswire-Connector-Direct-Wire-RSS-Issuer-As-Author.md"
  },
  {
    "id": "BRD-0025",
    "num": 25,
    "title": "Persistent local dev database, kept separate from the ephemeral test database",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0025-Persistent-Local-Dev-Database-Separate-From-Test-Database.md"
  },
  {
    "id": "BRD-0026",
    "num": 26,
    "title": "RSS/News connector \u2014 GNews API, with publication-as-Author modeling",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0026-RSS-News-Connector-GNews-API-Publication-As-Author.md"
  },
  {
    "id": "BRD-0027",
    "num": 27,
    "title": "Connector architecture is a technical intermediary only \u2014 SocialEngage is never a party to, reseller of, or intermediary in the connecting party's relationship with a data source",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0027-Connector-Is-Technical-Intermediary-Not-Contracting-Party.md"
  },
  {
    "id": "BRD-0028",
    "num": 28,
    "title": "Credential creation authority is scoped by ownership tier \u2014 no system-wide credentials, tenant-wide credentials created only by Tenant-Admin, user-bound credentials self-activated by the user",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0028-Credential-Creation-Authority-Scoped-By-Ownership-Tier.md"
  },
  {
    "id": "BRD-0029",
    "num": 29,
    "title": "Authentication mechanism \u2014 Microsoft Entra External ID, integrated as a thin, pluggable OIDC token issuer",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0029-Authentication-Mechanism-Entra-External-ID.md"
  },
  {
    "id": "BRD-0030",
    "num": 30,
    "title": "Admin-tier design \u2014 Platform Admin via a narrowly-scoped, audited `BYPASSRLS` role; Tenant-Admin via ordinary tenant-scoped RLS plus an application-layer role check",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0030-Admin-Tier-Design-Platform-Admin-RLS-Exception.md"
  },
  {
    "id": "BRD-0031",
    "num": 31,
    "title": "`tenants` table shape and its own Row-Level Security policy",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0031-Tenants-Table-Shape.md"
  },
  {
    "id": "BRD-0032",
    "num": 32,
    "title": "`users` table shape, RLS, and the request-time identity-resolution path",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0032-Users-Table-Shape-And-RLS.md"
  },
  {
    "id": "BRD-0033",
    "num": 33,
    "title": "Retire `X-Tenant-Id` as the tenant-identity trust mechanism",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0033-Retire-X-Tenant-Id-Header-Placeholder.md"
  },
  {
    "id": "BRD-0034",
    "num": 34,
    "title": "Connector connect/disconnect CRUD \u2014 ownership-tier-aware credential creation, reworking Story 1.6's placeholder-auth shape",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0034-Connector-Connect-Disconnect-CRUD-Ownership-Tier-Aware.md"
  },
  {
    "id": "BRD-0035",
    "num": 35,
    "title": "Admin UI's own shape \u2014 one role-gated Next.js app, not two separate deployables",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0035-Admin-UI-Shape-One-App-Role-Gated.md"
  },
  {
    "id": "BRD-0036",
    "num": 36,
    "title": "Admin UI's own authentication/session mechanism \u2014 server-side (BFF) session, no bearer token in browser JS, role-gating sourced from a new core identity endpoint",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0036-Admin-UI-Authentication-Session-And-Role-Gating-Mechanism.md"
  },
  {
    "id": "BRD-0037",
    "num": 37,
    "title": "Self-service tenant sign-up \u2014 authorization mechanism for unauthenticated tenant creation, domain-match handling, and public-email-provider exclusion",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0037-Self-Service-Tenant-Signup-And-First-Tenant-Admin-Provisioning.md"
  },
  {
    "id": "BRD-0038",
    "num": 38,
    "title": "AI enrichment provider selection \u2014 Azure AI Language as the first concrete `AIProviderConnector`, general-purpose-LLM structured extraction named as the deliberate second-provider swappability candidate",
    "status": "Accepted",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0038-AI-Enrichment-Provider-Selection.md"
  },
  {
    "id": "BRD-0039",
    "num": 39,
    "title": "Tenant offboarding data lifecycle \u2014 export before deletion, retention interaction, and what \"deleted\" means across primary, archival, and credential storage",
    "status": "Approved",
    "pillar": "Trust, Compliance & Data Sovereignty",
    "file": "BRD-0039-Tenant-Offboarding-Data-Lifecycle-Export-And-Deletion.md"
  },
  {
    "id": "BRD-0040",
    "num": 40,
    "title": "Self-service tenant sign-up rate limiting and abuse-prevention mechanism",
    "status": "Approved",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0040-Self-Service-Signup-Rate-Limiting-And-Abuse-Prevention-Mechanism.md"
  },
  {
    "id": "BRD-0041",
    "num": 41,
    "title": "Platform Admin is a distinct identity *kind*, never a value within the tenant-user role enum \u2014 structural distinctness required at every layer, not only the database",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0041-Platform-Admin-Is-A-Distinct-Identity-Kind-Not-A-Role-Value.md"
  },
  {
    "id": "BRD-0042",
    "num": 42,
    "title": "Wikipedia connector \u2014 MediaWiki API, revision re-poll cadence, article-as-Author modeling",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0042-Wikipedia-Connector-MediaWiki-API-Article-As-Author.md"
  },
  {
    "id": "BRD-0043",
    "num": 43,
    "title": "Self-service, Tenant-Admin-initiated tenant deletion \u2014 the sole tenant-deletion mechanism, full supersession of ADR-0039 Decision \u00a71",
    "status": "Approved (Accepted 2026-08-07)",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0043-Self-Service-Tenant-Initiated-Deletion.md"
  },
  {
    "id": "BRD-0044",
    "num": 44,
    "title": "Watchlist CRUD contract \u2014 PATCH semantics, error mapping, and updated_at policy",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0044-Watchlist-API-Design-And-Database-Schema-Standardization.md"
  },
  {
    "id": "BRD-0047",
    "num": 47,
    "title": "Standard pattern for cross-story references and supersession language",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0047-Standard-Pattern-For-Cross-Story-References-And-Supersession-Language.md"
  },
  {
    "id": "BRD-0048",
    "num": 48,
    "title": "Explicit policy for \"no core pipeline change\" verification when registering new connectors",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0048-No-Core-Pipeline-Change-Verification-For-New-Connector-Registration.md"
  },
  {
    "id": "BRD-0049",
    "num": 49,
    "title": "Retain point-in-time author follower count on `SocialPost` as a scoped exception to normalized `Author` storage",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0049-Point-In-Time-Author-Follower-Count-On-Social-Post.md"
  },
  {
    "id": "BRD-0050",
    "num": 50,
    "title": "Tenant-owned-domain RSS/content-feed connector with DNS TXT domain ownership verification",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0050-Tenant-Owned-Domain-RSS-Content-Feed-Connector.md"
  },
  {
    "id": "BRD-0051",
    "num": 51,
    "title": "Connector activation decoupled from credential storage \u2014 two new, ownership-scoped `connector_activations`/`connector_user_activations` tables",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0051-Connector-Activation-Decoupled-From-Credential.md"
  },
  {
    "id": "BRD-0052",
    "num": 52,
    "title": "Live ingestion-polling scheduler \u2014 connector registry bootstrap, generic per-connector `poll()` invocation, in-process interval loop with derived (not stored) cadence",
    "status": "Draft for review (source ADR-0052 Accepted 2026-08-13)",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0052-Live-Ingestion-Polling-Scheduler.md"
  },
  {
    "id": "BRD-0053",
    "num": 53,
    "title": "A canonical Markdown post-body representation \u2014 computed once at ingestion, stored on `social_posts`, decoupling N ingestion sources from M future consumers",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0053-Canonical-Markdown-Post-Body-Normalization-At-Ingestion.md"
  },
  {
    "id": "BRD-0054",
    "num": 54,
    "title": "Tenant-facing Analytics Dashboard \u2014 v1 scope, client-side data-source strategy, and a scoped, narrow supersession of ADR-0008's charting deferral",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0054-Tenant-Facing-Analytics-Dashboard-Scope-And-Data-Source-Strategy.md"
  },
  {
    "id": "BRD-0055",
    "num": 55,
    "title": "Language and location enrichment for the Analytics Dashboard \u2014 surfacing an already-captured field vs. a still-absent one",
    "status": "Approved",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0055-Analytics-Language-And-Location-Enrichment-Feasibility.md"
  },
  {
    "id": "BRD-0056",
    "num": 56,
    "title": "AI-provider-inferred origin location from a Newswire post's own dateline text \u2014 feasibility, architecture, and v1-scope recommendation",
    "status": "Approved",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0056-AI-Inferred-Origin-Location-Newswire-Dateline-Extraction.md"
  },
  {
    "id": "BRD-0057",
    "num": 57,
    "title": "Multi-feed administration for the tenant-owned-feed connector \u2014 list, edit, and remove, resolving ADR-0050 Open Question 2",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0057-Tenant-Owned-Feed-Multi-Feed-Administration.md"
  },
  {
    "id": "BRD-0058",
    "num": 58,
    "title": "Wire `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` publishing into the real ingestion pipeline",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0058-Wire-Ingestion-Events-Into-Real-Connector-Pipeline.md"
  },
  {
    "id": "BRD-0059",
    "num": 59,
    "title": "Facebook connector \u2014 narrowed to a tenant's own connected Page (Standard/Advanced Access), organization-as-Author modeling; genuine public-content social listening found not viable",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0059-Facebook-Connector-Tenant-Owned-Page-Scope-Organization-As-Author.md"
  },
  {
    "id": "BRD-0060",
    "num": 60,
    "title": "Facebook connector \u2014 one user may connect more than one Page (cardinality, not credential-tier, change)",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0060-Facebook-Connector-Multiple-Pages-Per-User.md"
  },
  {
    "id": "BRD-0061",
    "num": 61,
    "title": "Tier-3 (user-bound) poll scheduling \u2014 per-user enumeration, cross-user health/in-flight isolation, `pollUser()` as a new generic scheduler surface",
    "status": "Draft for review (source ADR-0061 Accepted 2026-08-18)",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0061-Tier-3-Poll-Scheduler-Per-User-Enumeration.md"
  },
  {
    "id": "BRD-0062",
    "num": 62,
    "title": "Analytics Dashboard \u2014 Overview Tab Enhancement: multi-dimensional filter model, AI Spike Storyteller, statistical volume forecast, and widget scope",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0062-Analytics-Dashboard-Overview-Tab-Enhancement.md"
  },
  {
    "id": "BRD-0063",
    "num": 63,
    "title": "Post-watchlist match persistence \u2014 `post_watchlist_matches` junction table and `GET /v1/posts?watchlistId` server-side filter",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0063-Post-Watchlist-Matches-Junction-Table-And-Server-Side-Watchlist-Filter.md"
  },
  {
    "id": "BRD-0064",
    "num": 64,
    "title": "Location and geospatial insights from posts and authors",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0064-Location-And-Geospatial-Insights-From-Posts-And-Authors.md"
  },
  {
    "id": "BRD-0065",
    "num": 65,
    "title": "Active Watchlist Sourcing via Brave Search API \u2014 Polling Connector, Post Ingestion Grounding, and LLM Enrichment",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0065-Active-Watchlist-Sourcing-Via-Brave-Search-API.md"
  },
  {
    "id": "BRD-0066",
    "num": 66,
    "title": "Active Watchlist Sourcing via Bing Search API (Azure) \u2014 Polling Connector, Post Ingestion Grounding, and LLM Enrichment",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0066-Active-Watchlist-Sourcing-Via-Bing-Search-API.md"
  },
  {
    "id": "BRD-0067",
    "num": 67,
    "title": "Facebook Connector (`facebook`) \u2014 Platform Connector Scope Reconfirmation, Managed Pages vs. Personal User Profiles, Hosting Page Dependency, and Two-Tier Author Resolution",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0067-Reconfirm-Facebook-Connector.md"
  },
  {
    "id": "BRD-0068",
    "num": 68,
    "title": "Instagram Connector (`instagram`) \u2014 Platform Connector Scope, Business/Creator Account Model, Hosting Profile Dependency, and Tier-3 OAuth Harmonization",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0068-Instagram-Connector.md"
  },
  {
    "id": "BRD-0069",
    "num": 69,
    "title": "LinkedIn Connector (`linkedin`) \u2014 OAuth 2.0 Account Connection, Token Lifecycle, and Ingestion Architecture",
    "status": "Approved",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0069-LinkedIn-Connector.md"
  },
  {
    "id": "BRD-0070",
    "num": 70,
    "title": "Connector Ingestion Health Status, Hanging Run Watchdog Reconciliation, and Inactivity Alerting",
    "status": "Draft / Pending review",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0070-Connector-Ingestion-Status-Hanging-Run-Reconciliation-And-Alerts.md"
  },
  {
    "id": "BRD-0071",
    "num": 71,
    "title": "Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI",
    "status": "Approved",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0071-Human-In-The-Loop-Post-Enrichment-Overrides-And-Cascading-Drawer-UI.md"
  },
  {
    "id": "BRD-0072",
    "num": 72,
    "title": "Cross-Platform Polypost Composer and Multi-Network Preview Engine",
    "status": "Accepted",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0072-Cross-Platform-Polypost-Composer-And-Multi-Network-Preview-Engine.md"
  },
  {
    "id": "BRD-0073",
    "num": 73,
    "title": "Outbound Reply to Ingested Posts via Platform APIs",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0073-Outbound-Reply-To-Ingested-Posts.md"
  },
  {
    "id": "BRD-0074",
    "num": 74,
    "title": "Tenant-Facing Workspace and Matched-Posts Export",
    "status": "Draft / Pending review",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0074-Tenant-Facing-Workspace-and-Matched-Posts-Export.md"
  },
  {
    "id": "BRD-0075",
    "num": 75,
    "title": "Outbound Social Post Publishing via Platform APIs",
    "status": "Draft / Pending review",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0075-Outbound-Social-Post-Publishing.md"
  },
  {
    "id": "BRD-0076",
    "num": 76,
    "title": "Composer Deep Research Agent \u2014 Context Summary from Post Text, Key Phrases, and Search Results",
    "status": "Approved",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0076-Composer-Deep-Research-Agent.md"
  },
  {
    "id": "BRD-0077",
    "num": 77,
    "title": "Watchlist connector count and preview endpoint",
    "status": "Final",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0077-Watchlist-Connector-Count-Method.md"
  },
  {
    "id": "BRD-0078",
    "num": 78,
    "title": "Metric explainability endpoint",
    "status": "Draft / Review \u2013 ADR-0078 is Accepted; BRD is ready for final review/approval",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0078-Metric-Explainability-Endpoint.md"
  },
  {
    "id": "BRD-0079",
    "num": 79,
    "title": "Crisis template bundle and activation",
    "status": "Approved",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0079-Crisis-Template-Bundle-And-Activation.md"
  },
  {
    "id": "BRD-0080",
    "num": 80,
    "title": "Onboarding checklist state",
    "status": "Draft for review \u2014 parent ADR-0080 is Proposed and may change",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0080-Onboarding-Checklist-State.md"
  },
  {
    "id": "BRD-0081",
    "num": 81,
    "title": "RAGConnector provider abstraction",
    "status": "Draft / Review",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0081-RAG-Connector-Provider-Abstraction.md"
  },
  {
    "id": "BRD-0082",
    "num": 82,
    "title": "RAG post chunking and embedding pipeline",
    "status": "Draft \u2013 ADR-0082 is Proposed; this BRD is for review and may change",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0082-RAG-Post-Chunking-And-Embedding.md"
  },
  {
    "id": "BRD-0083",
    "num": 83,
    "title": "RAG vector-store RLS and metadata",
    "status": "Draft for review \u2014 ADR-0083 is currently Proposed",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0083-RAG-Vector-Store-RLS-And-Metadata.md"
  },
  {
    "id": "BRD-0084",
    "num": 84,
    "title": "RAG search and ask endpoint",
    "status": "Draft for Review (source ADR-0084 is Proposed)",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0084-RAG-Search-And-Ask-Endpoint.md"
  },
  {
    "id": "BRD-0085",
    "num": 85,
    "title": "RAG UI/UX and loading patterns",
    "status": "Draft \u2013 based on ADR-0085, which is **Proposed** and may change",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0085-RAG-UI-UX-And-Loading-Patterns.md"
  },
  {
    "id": "BRD-0086",
    "num": 86,
    "title": "Prospecting list model and sharing",
    "status": "Draft",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0086-Prospecting-List-Model-And-Sharing.md"
  },
  {
    "id": "BRD-0087",
    "num": 87,
    "title": "Preconfigured analytics views",
    "status": "Draft \u2014 aligned with proposed ADR-0087; subject to review and change",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0087-Preconfigured-Analytics-Views.md"
  },
  {
    "id": "BRD-0088",
    "num": 88,
    "title": "Ad-hoc query allowlist",
    "status": "Draft for review",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0088-Ad-Hoc-Query-Allowlist.md"
  },
  {
    "id": "BRD-0089",
    "num": 89,
    "title": "Platform operations dashboard",
    "status": "Draft (ADR-0089 is Proposed; this BRD is for review and may change upon acceptance)",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0089-Platform-Operations-Dashboard.md"
  },
  {
    "id": "BRD-0090",
    "num": 90,
    "title": "Data export \u2014 posts CSV",
    "status": "Draft",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0090-Data-Export-Posts-CSV.md"
  },
  {
    "id": "BRD-0091",
    "num": 91,
    "title": "Real-time alert rules and delivery",
    "status": "Draft for review \u2013 source ADR-0091 is **Proposed** and may change",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0091-Real-Time-Alert-Rules-And-Delivery.md"
  },
  {
    "id": "BRD-0092",
    "num": 92,
    "title": "Author-initiated takedown",
    "status": "Draft",
    "pillar": "Trust, Compliance & Data Sovereignty",
    "file": "BRD-0092-Author-Initiated-Takedown.md"
  },
  {
    "id": "BRD-0093",
    "num": 93,
    "title": "DSR self-service portal",
    "status": "Draft for review \u2014 source ADR-0093 is Proposed and may change",
    "pillar": "Trust, Compliance & Data Sovereignty",
    "file": "BRD-0093-DSR-Self-Service-Portal.md"
  },
  {
    "id": "BRD-0094",
    "num": 94,
    "title": "Compliance audit pack",
    "status": "Draft for Review",
    "pillar": "Trust, Compliance & Data Sovereignty",
    "file": "BRD-0094-Compliance-Audit-Pack.md"
  },
  {
    "id": "BRD-0095",
    "num": 95,
    "title": "Case handoff to CRM",
    "status": "Draft",
    "pillar": "Trust, Compliance & Data Sovereignty",
    "file": "BRD-0095-Case-Handoff-To-CRM.md"
  },
  {
    "id": "BRD-0096",
    "num": 96,
    "title": "Daily digest email",
    "status": "Draft for Review \u2014 ADR-0096 is currently Proposed and may change",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0096-Daily-Digest-Email.md"
  },
  {
    "id": "BRD-0097",
    "num": 97,
    "title": "Topic evolution timeline",
    "status": "Draft for review \u2014 authorizing ADR is Proposed and may change",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0097-Topic-Evolution-Timeline.md"
  },
  {
    "id": "BRD-0098",
    "num": 98,
    "title": "Publishing and scheduling",
    "status": "Draft",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0098-Publishing-And-Scheduling.md"
  },
  {
    "id": "BRD-0099",
    "num": 99,
    "title": "Unified social inbox and reply",
    "status": "Draft",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0099-Unified-Social-Inbox-And-Reply.md"
  },
  {
    "id": "BRD-0100",
    "num": 100,
    "title": "Composed post author mention suggestions",
    "status": "Draft",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0100-Composed-Post-Author-Mention-Suggestions.md"
  },
  {
    "id": "BRD-0101",
    "num": 101,
    "title": "Multi-source connector capability matrix",
    "status": "Draft",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0101-Multi-Source-Connector-Capability-Matrix.md"
  },
  {
    "id": "BRD-0102",
    "num": 102,
    "title": "Boolean query AST and visual builder",
    "status": "Draft (source ADR-0102 is Proposed)",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0102-Boolean-Query-AST-And-Visual-Builder.md"
  },
  {
    "id": "BRD-0103",
    "num": 103,
    "title": "AI sentiment analysis aspect schema",
    "status": "Draft for review \u2014 ADR-0103 is currently Proposed and may change",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0103-AI-Sentiment-Analysis-Aspect-Schema.md"
  },
  {
    "id": "BRD-0104",
    "num": 104,
    "title": "AI topic clustering post-topics schema",
    "status": "Draft for review (ADR-0104 is Proposed)",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0104-AI-Topic-Clustering-Post-Topics-Schema.md"
  },
  {
    "id": "BRD-0105",
    "num": 105,
    "title": "Dashboards and analytics widget contracts",
    "status": "Draft",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0105-Dashboards-And-Analytics-Widget-Contracts.md"
  },
  {
    "id": "BRD-0106",
    "num": 106,
    "title": "API and integrations \u2014 versioning and webhooks",
    "status": "Draft \u2014 for review; may change because the source ADR is **Proposed**",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0106-API-And-Integrations-Versioning-And-Webhooks.md"
  },
  {
    "id": "BRD-0107",
    "num": 107,
    "title": "Multi-user workspaces and RBAC permissions",
    "status": "Draft",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0107-Multi-User-Workspaces-And-RBAC-Permissions.md"
  },
  {
    "id": "BRD-0108",
    "num": 108,
    "title": "Influencer discovery and scoring",
    "status": "Draft",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0108-Influencer-Discovery-And-Scoring.md"
  },
  {
    "id": "BRD-0109",
    "num": 109,
    "title": "Connector health auto-disable and recovery",
    "status": "Draft for Review",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0109-Connector-Health-Auto-Disable-And-Recovery.md"
  },
  {
    "id": "BRD-0110",
    "num": 110,
    "title": "Per-connector query translation and validation",
    "status": "Draft \u2014 ADR-0110 is Proposed and may change before final acceptance",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0110-Per-Connector-Query-Translation-And-Validation.md"
  },
  {
    "id": "BRD-0111",
    "num": 111,
    "title": "Export bounding, streaming, and size caps",
    "status": "Draft \u2014 ADR-0111 is currently Proposed and may change before acceptance",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0111-Export-Bounding-Streaming-And-Size-Caps.md"
  },
  {
    "id": "BRD-0112",
    "num": 112,
    "title": "Feature gating and seat-limit enforcement",
    "status": "Draft (source ADR-0112 is Proposed; this BRD is for review and may change)",
    "pillar": "Multi-Tenant Isolation & Security",
    "file": "BRD-0112-Feature-Gating-And-Seat-Limit-Enforcement.md"
  },
  {
    "id": "BRD-0113",
    "num": 113,
    "title": "Metric explainability prompt and caching",
    "status": "Draft for Review",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0113-Metric-Explainability-Prompt-And-Caching.md"
  },
  {
    "id": "BRD-0114",
    "num": 114,
    "title": "Platform metrics table and Azure Metrics integration",
    "status": "Draft",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0114-Platform-Metrics-Table-And-Azure-Metrics.md"
  },
  {
    "id": "BRD-0115",
    "num": 115,
    "title": "Publishing \u2014 media upload and asset targeting",
    "status": "Proposed \u2014 draft for review; may change before acceptance",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0115-Publishing-Media-Upload-And-Asset-Targeting.md"
  },
  {
    "id": "BRD-0116",
    "num": 116,
    "title": "Semantic drift detection",
    "status": "Draft for review",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0116-Semantic-Drift-Detection.md"
  },
  {
    "id": "BRD-0117",
    "num": 117,
    "title": "Prospecting list export and CRM push",
    "status": "Draft for review",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0117-Prospecting-List-Export-And-CRM-Push.md"
  },
  {
    "id": "BRD-0118",
    "num": 118,
    "title": "Additional Social Platform Publishing",
    "status": "Draft (ADR-0118 is Proposed)",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0118-Additional-Social-Platform-Publishing.md"
  },
  {
    "id": "BRD-0119",
    "num": 119,
    "title": "Editing and Deleting Published Outbound Posts",
    "status": "Draft",
    "pillar": "Analytics, Dashboards & Operations",
    "file": "BRD-0119-Editing-And-Deleting-Published-Outbound-Posts.md"
  },
  {
    "id": "BRD-0120",
    "num": 120,
    "title": "SearchProviderConnector \u2014 Shared One-Off Search Abstraction",
    "status": "Draft",
    "pillar": "Universal Sourcing & Connectors",
    "file": "BRD-0120-Search-Provider-Connector.md"
  },
  {
    "id": "BRD-0121",
    "num": 121,
    "title": "Composer Deep Research Caching, Re-Trigger, and Cost Justification",
    "status": "Draft \u2014 ADR-0121 is Proposed and may change",
    "pillar": "AI Enrichment & Topic Intelligence",
    "file": "BRD-0121-Composer-Deep-Research-Caching-Retrigger-Cost.md"
  }
];

export const FDD_LIST: FddItem[] = [
  {
    "id": "FDD-0001",
    "num": 1,
    "title": "Split into `social-listening-core` and `social-listening-admin` repositories",
    "status": "Approved (source ADR-0001 is Accepted)",
    "file": "FDD-0001-Two-Repository-Split.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0002",
    "num": 2,
    "title": "Unified `ProviderConnector` contract for social platforms and AI providers",
    "status": "Approved (source ADR-0002 is Accepted)",
    "file": "FDD-0002-Unified-Provider-Connector-Pattern.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0003",
    "num": 3,
    "title": "Rate limiting enforced per `(tenantId, providerId)` via a shared `RequestGate`",
    "status": "Approved (source ADR-0003 is Accepted)",
    "file": "FDD-0003-Per-Tenant-Per-Provider-Rate-Limiting.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0004",
    "num": 4,
    "title": "Normalize `Author` once per platform account, not embedded per post",
    "status": "Approved (source ADR-0004 is Accepted; carries several accepted supersession/generalization notes \u2014 ADR-0024, ADR-0026, ADR-0042, ADR-0049, ADR-0050 \u2014 all folded in below)",
    "file": "FDD-0004-Author-Normalized-Separately-From-Post.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0005",
    "num": 5,
    "title": "`IngestionRun` as the immutable acquisition/audit anchor for every post",
    "status": "Approved (source ADR-0005 is Accepted)",
    "file": "FDD-0005-Ingestion-Run-As-Audit-Anchor.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0006",
    "num": 6,
    "title": "Prefer connector-side native filtering for watchlist matching, with post-fetch matching as fallback",
    "status": "Approved (source ADR-0006 is Accepted; BRD-0006's own document control lists \"Draft\" but its own Approval section and downstream ADRs treat it as settled \u2014 flagged in \u00a713 Open Questions rather than silently overridden)",
    "file": "FDD-0006-Watchlist-Matching-Connector-Side-With-Fallback.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0007",
    "num": 7,
    "title": "`AuthorTopicSignal` ships with raw signals only, no computed expertise score",
    "status": "Approved (source ADR-0007 is Accepted)",
    "file": "FDD-0007-Author-Topic-Signal-Minimal-V1.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0008",
    "num": 8,
    "title": "Defer `TopicDailyCount` aggregation and all charting to a future subsystem",
    "status": "Approved (source ADR-0008 is Accepted; narrowly, partially superseded by ADR-0054, 2026-08-17 \u2014 see \u00a73 and \u00a713)",
    "file": "FDD-0008-Defer-Topic-Time-Series-And-Charting.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0009",
    "num": 9,
    "title": "`ConnectorHealth` is fully derived from `IngestionRun` history, not stored mutable state",
    "status": "Approved (source ADR-0009 is Accepted; the `failing` rule is superseded by ADR-0023's rate-relative threshold, folded in below; unaffected by ADR-0051's later connector-activation concept)",
    "file": "FDD-0009-Connector-Health-Derived-Not-Stored.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0010",
    "num": 10,
    "title": "Retryable-vs-non-retryable error policy with per-tenant auto-disable",
    "status": "Draft",
    "file": "FDD-0010-Error-Handling-And-Auto-Disable-Policy.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0011",
    "num": 11,
    "title": "Cursor-based pagination for `GET /posts`",
    "status": "Draft",
    "file": "FDD-0011-Cursor-Based-Pagination-For-Posts-API.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0012",
    "num": 12,
    "title": "Service Bus events carry IDs and minimal fields only; full data is fetched via REST on demand",
    "status": "Draft",
    "file": "FDD-0012-Thin-Events-With-REST-Fetch-On-Demand.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0013",
    "num": 13,
    "title": "Per-tenant event filtering via Service Bus subscription SQL filters",
    "status": "Draft",
    "file": "FDD-0013-Per-Tenant-Event-Filtering-Via-Subscription-Rules.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0014",
    "num": 14,
    "title": "Envelope-encrypted credential storage via Azure Key Vault, OAuth preferred with API-key fallback",
    "status": "Draft",
    "file": "FDD-0014-Credential-Storage-Envelope-Encryption-OAuth-First.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0015",
    "num": 15,
    "title": "Enforce tenant isolation at the database layer with Postgres Row-Level Security",
    "status": "Draft",
    "file": "FDD-0015-Tenant-Isolation-Via-Postgres-Row-Level-Security.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0016",
    "num": 16,
    "title": "Postgres as the database engine",
    "status": "Draft",
    "file": "FDD-0016-Postgres-As-Database-Engine.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0017",
    "num": 17,
    "title": "API versioning and compatibility policy",
    "status": "Draft",
    "file": "FDD-0017-API-Versioning-And-Compatibility-Policy.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0018",
    "num": 18,
    "title": "Data retention and archival policy",
    "status": "Draft",
    "file": "FDD-0018-Data-Retention-And-Archival-Policy.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0019",
    "num": 19,
    "title": "Event schema versioning policy",
    "status": "Draft",
    "file": "FDD-0019-Event-Schema-Versioning-Policy.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0020",
    "num": 20,
    "title": "Rate-limit queue bounds, dead-letter handling, and distributed gate state",
    "status": "Draft",
    "file": "FDD-0020-Rate-Limit-Queue-Bounds-And-Distributed-Gate-State.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0021",
    "num": 21,
    "title": "Unified boolean-query AST for watchlist matching, with per-connector capability matrix",
    "status": "Approved (source ADR-0021 is Accepted; this FDD documents the shipped design \u2014 see Story 3.6)",
    "file": "FDD-0021-Watchlist-Boolean-Query-AST-And-Capability-Matrix.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0022",
    "num": 22,
    "title": "Derived-data caching and refresh strategy (`ConnectorHealth` read cache, `AuthorTopicSignal` refresh cadence)",
    "status": "Approved (source ADR-0022 is Accepted; documents shipped design \u2014 Story 4.4)",
    "file": "FDD-0022-Derived-Data-Caching-And-Refresh-Strategy.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0023",
    "num": 23,
    "title": "Proportional (rate-relative) connector failure threshold for auto-disable",
    "status": "Approved (source ADR-0023 is Accepted; documents shipped design, healed per its own 2026-08-12/2026-08-17 Clarifications \u2014 Stories 2.5, 2.12)",
    "file": "FDD-0023-Proportional-Connector-Failure-Threshold.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0024",
    "num": 24,
    "title": "Newswire connector \u2014 direct wire-service RSS feeds, with issuer-as-Author modeling",
    "status": "Approved (source ADR-0024 is Accepted; documents shipped design \u2014 Story 2.6)",
    "file": "FDD-0024-Newswire-Connector-Direct-Wire-RSS-Issuer-As-Author.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0025",
    "num": 25,
    "title": "Persistent local dev database, kept separate from the ephemeral test database",
    "status": "Approved (source ADR-0025 is Accepted; documents shipped design \u2014 Story 1.4)",
    "file": "FDD-0025-Persistent-Local-Dev-Database-Separate-From-Test-Database.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0026",
    "num": 26,
    "title": "RSS/News connector \u2014 GNews API, with publication-as-Author modeling",
    "status": "Approved (source ADR-0026 is Accepted; documents shipped design \u2014 Story 2.7)",
    "file": "FDD-0026-RSS-News-Connector-GNews-API-Publication-As-Author.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0027",
    "num": 27,
    "title": "Connector architecture is a technical intermediary only \u2014 SocialEngage is never a party to, reseller of, or intermediary in the connecting party's relationship with a data source",
    "status": "Approved (source ADR-0027 is Accepted; a governance/policy constraint, not a build)",
    "file": "FDD-0027-Connector-Is-Technical-Intermediary-Not-Contracting-Party.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0028",
    "num": 28,
    "title": "Credential creation authority is scoped by ownership tier \u2014 no system-wide credentials, tenant-wide credentials created only by Tenant-Admin, user-bound credentials self-activated by the user",
    "status": "Draft",
    "file": "FDD-0028-Credential-Creation-Authority-Scoped-By-Ownership-Tier.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0029",
    "num": 29,
    "title": "Authentication mechanism \u2014 Microsoft Entra External ID, integrated as a thin, pluggable OIDC token issuer",
    "status": "Draft",
    "file": "FDD-0029-Authentication-Mechanism-Entra-External-ID.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0030",
    "num": 30,
    "title": "Admin-tier design \u2014 Platform Admin via a narrowly-scoped, audited `BYPASSRLS` role; Tenant-Admin via ordinary tenant-scoped RLS plus an application-layer role check",
    "status": "Draft",
    "file": "FDD-0030-Admin-Tier-Design-Platform-Admin-RLS-Exception.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0031",
    "num": 31,
    "title": "`tenants` table shape and its own Row-Level Security policy",
    "status": "Draft",
    "file": "FDD-0031-Tenants-Table-Shape.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0032",
    "num": 32,
    "title": "`users` table shape, RLS, and the request-time identity-resolution path",
    "status": "Draft",
    "file": "FDD-0032-Users-Table-Shape-And-RLS.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0033",
    "num": 33,
    "title": "Retire `X-Tenant-Id` as the tenant-identity trust mechanism",
    "status": "Draft",
    "file": "FDD-0033-Retire-X-Tenant-Id-Header-Placeholder.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0034",
    "num": 34,
    "title": "Connector connect/disconnect CRUD \u2014 ownership-tier-aware credential creation, reworking Story 1.6's placeholder-auth shape",
    "status": "Draft",
    "file": "FDD-0034-Connector-Connect-Disconnect-CRUD-Ownership-Tier-Aware.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0035",
    "num": 35,
    "title": "Admin UI's own shape \u2014 one role-gated Next.js app, not two separate deployables",
    "status": "Draft",
    "file": "FDD-0035-Admin-UI-Shape-One-App-Role-Gated.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0036",
    "num": 36,
    "title": "Admin UI's own authentication/session mechanism \u2014 server-side (BFF) session, no bearer token in browser JS, role-gating sourced from a new core identity endpoint",
    "status": "Draft",
    "file": "FDD-0036-Admin-UI-Authentication-Session-And-Role-Gating-Mechanism.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0037",
    "num": 37,
    "title": "Self-service tenant sign-up \u2014 authorization mechanism for unauthenticated tenant creation, domain-match handling, and public-email-provider exclusion",
    "status": "Draft",
    "file": "FDD-0037-Self-Service-Tenant-Signup-And-First-Tenant-Admin-Provisioning.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0038",
    "num": 38,
    "title": "AI enrichment provider selection \u2014 Azure AI Language as the first concrete `AIProviderConnector`, general-purpose-LLM structured extraction named as the deliberate second-provider swappability candidate",
    "status": "Draft",
    "file": "FDD-0038-AI-Enrichment-Provider-Selection.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0039",
    "num": 39,
    "title": "Tenant offboarding data lifecycle \u2014 export before deletion, retention interaction, and what \"deleted\" means across primary, archival, and credential storage",
    "status": "Draft",
    "file": "FDD-0039-Tenant-Offboarding-Data-Lifecycle-Export-And-Deletion.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0040",
    "num": 40,
    "title": "Self-service tenant sign-up rate limiting and abuse-prevention mechanism",
    "status": "Draft",
    "file": "FDD-0040-Self-Service-Signup-Rate-Limiting-And-Abuse-Prevention-Mechanism.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0041",
    "num": 41,
    "title": "Platform Admin is a distinct identity *kind*, never a value within the tenant-user role enum \u2014 structural distinctness required at every layer, not only the database",
    "status": "Approved (documents an already-Accepted, no-story ADR)",
    "file": "FDD-0041-Platform-Admin-Is-A-Distinct-Identity-Kind-Not-A-Role-Value.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0042",
    "num": 42,
    "title": "Wikipedia connector \u2014 MediaWiki API, revision re-poll cadence, article-as-Author modeling",
    "status": "Approved (ADR-0042 Accepted 2026-08-08; connector built via Story 2.13/2.14, UI via Story 6.21/6.22)",
    "file": "FDD-0042-Wikipedia-Connector-MediaWiki-API-Article-As-Author.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0043",
    "num": 43,
    "title": "Self-service, Tenant-Admin-initiated tenant deletion \u2014 the sole tenant-deletion mechanism, full supersession of ADR-0039 Decision \u00a71",
    "status": "Approved (ADR-0043 Accepted 2026-08-07; backend built via Story 3.8, UI via Story 6.13)",
    "file": "FDD-0043-Self-Service-Tenant-Initiated-Deletion.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0044",
    "num": 44,
    "title": "Watchlist CRUD contract \u2014 PATCH semantics, error mapping, and updated_at policy",
    "status": "Approved (ADR-0044 Accepted 2026-08-11; built via Story 1.5)",
    "file": "FDD-0044-Watchlist-API-Design-And-Database-Schema-Standardization.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0047",
    "num": 47,
    "title": "Standard pattern for cross-story references and supersession language",
    "status": "Approved (ADR-0047 Accepted 2026-08-11; no-story, documentation-authoring convention, effective immediately)",
    "file": "FDD-0047-Standard-Pattern-For-Cross-Story-References-And-Supersession-Language.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0048",
    "num": 48,
    "title": "Explicit policy for \"no core pipeline change\" verification when registering new connectors",
    "status": "Approved (ADR-0048 Accepted 2026-08-11; built via Story 2.10, 2026-08-12)",
    "file": "FDD-0048-No-Core-Pipeline-Change-Verification-For-New-Connector-Registration.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0049",
    "num": 49,
    "title": "Retain point-in-time author follower count on `SocialPost` as a scoped exception to normalized `Author` storage",
    "status": "Approved (ADR-0049 Accepted 2026-08-11; built via Story 3.9, 2026-08-12)",
    "file": "FDD-0049-Point-In-Time-Author-Follower-Count-On-Social-Post.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0050",
    "num": 50,
    "title": "Tenant-owned-domain RSS/content-feed connector with DNS TXT domain ownership verification",
    "status": "Draft",
    "file": "FDD-0050-Tenant-Owned-Domain-RSS-Content-Feed-Connector.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0051",
    "num": 51,
    "title": "Connector activation decoupled from credential storage \u2014 two new, ownership-scoped `connector_activations`/`connector_user_activations` tables",
    "status": "Draft",
    "file": "FDD-0051-Connector-Activation-Decoupled-From-Credential.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0052",
    "num": 52,
    "title": "Live ingestion-polling scheduler \u2014 connector registry bootstrap, generic per-connector `poll()` invocation, in-process interval loop with derived (not stored) cadence",
    "status": "Draft",
    "file": "FDD-0052-Live-Ingestion-Polling-Scheduler.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0053",
    "num": 53,
    "title": "A canonical Markdown post-body representation \u2014 computed once at ingestion, stored on `social_posts`, decoupling N ingestion sources from M future consumers",
    "status": "Draft",
    "file": "FDD-0053-Canonical-Markdown-Post-Body-Normalization-At-Ingestion.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0054",
    "num": 54,
    "title": "Tenant-facing Analytics Dashboard \u2014 v1 scope, client-side data-source strategy, and a scoped, narrow supersession of ADR-0008's charting deferral",
    "status": "Draft",
    "file": "FDD-0054-Tenant-Facing-Analytics-Dashboard-Scope-And-Data-Source-Strategy.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0055",
    "num": 55,
    "title": "Language and location enrichment for the Analytics Dashboard \u2014 surfacing an already-captured field vs. a still-absent one",
    "status": "Draft",
    "file": "FDD-0055-Analytics-Language-And-Location-Enrichment-Feasibility.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0056",
    "num": 56,
    "title": "AI-provider-inferred origin location from a Newswire post's own dateline text \u2014 feasibility, architecture, and v1-scope recommendation",
    "status": "Draft",
    "file": "FDD-0056-AI-Inferred-Origin-Location-Newswire-Dateline-Extraction.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0057",
    "num": 57,
    "title": "Multi-feed administration for the tenant-owned-feed connector \u2014 list, edit, and remove, resolving ADR-0050 Open Question 2",
    "status": "Draft",
    "file": "FDD-0057-Tenant-Owned-Feed-Multi-Feed-Administration.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0058",
    "num": 58,
    "title": "Wire `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` publishing into the real ingestion pipeline",
    "status": "Draft",
    "file": "FDD-0058-Wire-Ingestion-Events-Into-Real-Connector-Pipeline.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0059",
    "num": 59,
    "title": "Facebook connector \u2014 narrowed to a tenant's own connected Page (Standard/Advanced Access), organization-as-Author modeling; genuine public-content social listening found not viable",
    "status": "Draft",
    "file": "FDD-0059-Facebook-Connector-Tenant-Owned-Page-Scope-Organization-As-Author.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0060",
    "num": 60,
    "title": "Facebook connector \u2014 one user may connect more than one Page (cardinality, not credential-tier, change)",
    "status": "Draft",
    "file": "FDD-0060-Facebook-Connector-Multiple-Pages-Per-User.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0061",
    "num": 61,
    "title": "Tier-3 (user-bound) poll scheduling \u2014 per-user enumeration, cross-user health/in-flight isolation, `pollUser()` as a new generic scheduler surface",
    "status": "Draft",
    "file": "FDD-0061-Tier-3-Poll-Scheduler-Per-User-Enumeration.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0062",
    "num": 62,
    "title": "Analytics Dashboard \u2014 Overview Tab Enhancement: multi-dimensional filter model, AI Spike Storyteller, statistical volume forecast, and widget scope",
    "status": "Draft",
    "file": "FDD-0062-Analytics-Dashboard-Overview-Tab-Enhancement.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0063",
    "num": 63,
    "title": "Post-watchlist match persistence \u2014 `post_watchlist_matches` junction table and `GET /v1/posts?watchlistId` server-side filter",
    "status": "Approved",
    "file": "FDD-0063-Post-Watchlist-Matches-Junction-Table-And-Server-Side-Watchlist-Filter.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0064",
    "num": 64,
    "title": "Location and geospatial insights from posts and authors",
    "status": "Approved",
    "file": "FDD-0064-Location-And-Geospatial-Insights-From-Posts-And-Authors.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0065",
    "num": 65,
    "title": "Active Watchlist Sourcing via Brave Search API \u2014 Polling Connector, Post Ingestion Grounding, and LLM Enrichment",
    "status": "Approved",
    "file": "FDD-0065-Active-Watchlist-Sourcing-Via-Brave-Search-API.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0066",
    "num": 66,
    "title": "Active Watchlist Sourcing via Bing Search API (Azure) \u2014 Polling Connector, Post Ingestion Grounding, and LLM Enrichment",
    "status": "Approved",
    "file": "FDD-0066-Active-Watchlist-Sourcing-Via-Bing-Search-API.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0067",
    "num": 67,
    "title": "Facebook Connector (`facebook`) \u2014 Platform Connector Scope Reconfirmation, Managed Pages vs. Personal User Profiles, Hosting Page Dependency, and Two-Tier Author Resolution",
    "status": "Draft",
    "file": "FDD-0067-Reconfirm-Facebook-Connector.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0068",
    "num": 68,
    "title": "Instagram Connector (`instagram`) \u2014 Platform Connector Scope, Business/Creator Account Model, Hosting Profile Dependency, and Tier-3 OAuth Harmonization",
    "status": "Approved",
    "file": "FDD-0068-Instagram-Connector.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0069",
    "num": 69,
    "title": "LinkedIn Connector (`linkedin`) \u2014 OAuth 2.0 Account Connection, Token Lifecycle, and Ingestion Architecture",
    "status": "Approved",
    "file": "FDD-0069-LinkedIn-Connector.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0070",
    "num": 70,
    "title": "Connector Ingestion Health Status, Hanging Run Watchdog Reconciliation, and Inactivity Alerting",
    "status": "Approved",
    "file": "FDD-0070-Connector-Ingestion-Status-Hanging-Run-Reconciliation-And-Alerts.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0071",
    "num": 71,
    "title": "Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI",
    "status": "Draft",
    "file": "FDD-0071-Human-In-The-Loop-Post-Enrichment-Overrides-And-Cascading-Drawer-UI.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0072",
    "num": 72,
    "title": "Cross-Platform Polypost Composer and Multi-Network Preview Engine",
    "status": "Draft",
    "file": "FDD-0072-Cross-Platform-Polypost-Composer-And-Multi-Network-Preview-Engine.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0073",
    "num": 73,
    "title": "Outbound Reply to Ingested Posts via Platform APIs",
    "status": "Approved",
    "file": "FDD-0073-Outbound-Reply-To-Ingested-Posts.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0074",
    "num": 74,
    "title": "Tenant-Facing Workspace and Matched-Posts Export",
    "status": "Approved",
    "file": "FDD-0074-Tenant-Facing-Workspace-and-Matched-Posts-Export.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0075",
    "num": 75,
    "title": "Outbound Social Post Publishing via Platform APIs",
    "status": "Approved (source ADR-0075 is Accepted 2026-08-23; source BRD-0075 is Draft/Pending review \u2014 see Section 13)",
    "file": "FDD-0075-Outbound-Social-Post-Publishing.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0076",
    "num": 76,
    "title": "Composer Deep Research Agent \u2014 Context Summary from Post Text, Key Phrases, and Search Results",
    "status": "Approved",
    "file": "FDD-0076-Composer-Deep-Research-Agent.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0077",
    "num": 77,
    "title": "Watchlist connector count and preview endpoint",
    "status": "Approved",
    "file": "FDD-0077-Watchlist-Connector-Count-Method.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0078",
    "num": 78,
    "title": "Metric explainability endpoint",
    "status": "Draft / Review",
    "file": "FDD-0078-Metric-Explainability-Endpoint.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0079",
    "num": 79,
    "title": "Crisis template bundle and activation",
    "status": "Draft for Review",
    "file": "FDD-0079-Crisis-Template-Bundle-And-Activation.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0080",
    "num": 80,
    "title": "Onboarding checklist state",
    "status": "Draft / Review",
    "file": "FDD-0080-Onboarding-Checklist-State.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0081",
    "num": 81,
    "title": "RAGConnector provider abstraction",
    "status": "Draft / Review",
    "file": "FDD-0081-RAG-Connector-Provider-Abstraction.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0082",
    "num": 82,
    "title": "RAG post chunking and embedding pipeline",
    "status": "Draft",
    "file": "FDD-0082-RAG-Post-Chunking-And-Embedding.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0083",
    "num": 83,
    "title": "RAG vector-store RLS and metadata",
    "status": "Draft",
    "file": "FDD-0083-RAG-Vector-Store-RLS-And-Metadata.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0084",
    "num": 84,
    "title": "RAG search and ask endpoint",
    "status": "Draft",
    "file": "FDD-0084-RAG-Search-And-Ask-Endpoint.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0085",
    "num": 85,
    "title": "RAG UI/UX and loading patterns",
    "status": "Draft",
    "file": "FDD-0085-RAG-UI-UX-And-Loading-Patterns.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0086",
    "num": 86,
    "title": "Prospecting list model and sharing",
    "status": "Draft",
    "file": "FDD-0086-Prospecting-List-Model-And-Sharing.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0087",
    "num": 87,
    "title": "Preconfigured analytics views",
    "status": "Draft",
    "file": "FDD-0087-Preconfigured-Analytics-Views.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0088",
    "num": 88,
    "title": "Ad-hoc query allowlist",
    "status": "Draft",
    "file": "FDD-0088-Ad-Hoc-Query-Allowlist.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0089",
    "num": 89,
    "title": "Platform operations dashboard",
    "status": "Draft",
    "file": "FDD-0089-Platform-Operations-Dashboard.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0090",
    "num": 90,
    "title": "Data export \u2014 posts CSV",
    "status": "Draft",
    "file": "FDD-0090-Data-Export-Posts-CSV.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0091",
    "num": 91,
    "title": "Real-time alert rules and delivery",
    "status": "Draft",
    "file": "FDD-0091-Real-Time-Alert-Rules-And-Delivery.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0092",
    "num": 92,
    "title": "Author-initiated takedown",
    "status": "Draft",
    "file": "FDD-0092-Author-Initiated-Takedown.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0093",
    "num": 93,
    "title": "DSR self-service portal",
    "status": "Draft",
    "file": "FDD-0093-DSR-Self-Service-Portal.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0094",
    "num": 94,
    "title": "Compliance audit pack",
    "status": "Draft",
    "file": "FDD-0094-Compliance-Audit-Pack.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0095",
    "num": 95,
    "title": "Case handoff to CRM",
    "status": "Draft",
    "file": "FDD-0095-Case-Handoff-To-CRM.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0096",
    "num": 96,
    "title": "Daily digest email",
    "status": "Draft",
    "file": "FDD-0096-Daily-Digest-Email.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0097",
    "num": 97,
    "title": "Topic evolution timeline",
    "status": "Draft",
    "file": "FDD-0097-Topic-Evolution-Timeline.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0098",
    "num": 98,
    "title": "Publishing and scheduling",
    "status": "Draft",
    "file": "FDD-0098-Publishing-And-Scheduling.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0099",
    "num": 99,
    "title": "Unified social inbox and reply",
    "status": "Draft",
    "file": "FDD-0099-Unified-Social-Inbox-And-Reply.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0100",
    "num": 100,
    "title": "Composed post author mention suggestions",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft)",
    "file": "FDD-0100-Composed-Post-Author-Mention-Suggestions.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0101",
    "num": 101,
    "title": "Multi-source connector capability matrix",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft)",
    "file": "FDD-0101-Multi-Source-Connector-Capability-Matrix.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0102",
    "num": 102,
    "title": "Boolean query AST and visual builder",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft (source ADR-0102 is Proposed))",
    "file": "FDD-0102-Boolean-Query-AST-And-Visual-Builder.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0103",
    "num": 103,
    "title": "AI sentiment analysis aspect schema",
    "status": "Draft \u2014 ADR-0103 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted",
    "file": "FDD-0103-AI-Sentiment-Analysis-Aspect-Schema.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0104",
    "num": 104,
    "title": "AI topic clustering post-topics schema",
    "status": "Draft \u2014 ADR-0104 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted",
    "file": "FDD-0104-AI-Topic-Clustering-Post-Topics-Schema.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0105",
    "num": 105,
    "title": "Dashboards and analytics widget contracts",
    "status": "Draft \u2014 ADR-0105 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted",
    "file": "FDD-0105-Dashboards-And-Analytics-Widget-Contracts.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0106",
    "num": 106,
    "title": "API and integrations \u2014 versioning and webhooks",
    "status": "Draft \u2014 ADR-0106 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted",
    "file": "FDD-0106-API-And-Integrations-Versioning-And-Webhooks.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0107",
    "num": 107,
    "title": "Multi-user workspaces and RBAC permissions",
    "status": "Draft \u2014 ADR-0107 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted",
    "file": "FDD-0107-Multi-User-Workspaces-And-RBAC-Permissions.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0108",
    "num": 108,
    "title": "Influencer discovery and scoring",
    "status": "Draft \u2014 ADR-0108 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted",
    "file": "FDD-0108-Influencer-Discovery-And-Scoring.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0109",
    "num": 109,
    "title": "Connector health auto-disable and recovery",
    "status": "Draft \u2014 ADR-0109 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted",
    "file": "FDD-0109-Connector-Health-Auto-Disable-And-Recovery.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0110",
    "num": 110,
    "title": "Per-connector query translation and validation",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft \u2014 ADR-0110 is Proposed and may change before final acceptance)",
    "file": "FDD-0110-Per-Connector-Query-Translation-And-Validation.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0111",
    "num": 111,
    "title": "Export bounding, streaming, and size caps",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft \u2014 ADR-0111 is currently Proposed and may change before acceptance)",
    "file": "FDD-0111-Export-Bounding-Streaming-And-Size-Caps.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0112",
    "num": 112,
    "title": "Feature gating and seat-limit enforcement",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft (source ADR-0112 is Proposed; this BRD is for review and may change))",
    "file": "FDD-0112-Feature-Gating-And-Seat-Limit-Enforcement.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0113",
    "num": 113,
    "title": "Metric explainability prompt and caching",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft for Review)",
    "file": "FDD-0113-Metric-Explainability-Prompt-And-Caching.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0114",
    "num": 114,
    "title": "Platform metrics table and Azure Metrics integration",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft)",
    "file": "FDD-0114-Platform-Metrics-Table-And-Azure-Metrics.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0115",
    "num": 115,
    "title": "Publishing \u2014 media upload and asset targeting",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Proposed \u2014 draft for review; may change before acceptance)",
    "file": "FDD-0115-Publishing-Media-Upload-And-Asset-Targeting.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0116",
    "num": 116,
    "title": "Semantic drift detection",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft for review)",
    "file": "FDD-0116-Semantic-Drift-Detection.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0117",
    "num": 117,
    "title": "Prospecting list export and CRM push",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft for review)",
    "file": "FDD-0117-Prospecting-List-Export-And-CRM-Push.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0118",
    "num": 118,
    "title": "Additional Social Platform Publishing",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft (ADR-0118 is Proposed))",
    "file": "FDD-0118-Additional-Social-Platform-Publishing.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0119",
    "num": 119,
    "title": "Editing and Deleting Published Outbound Posts",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft)",
    "file": "FDD-0119-Editing-And-Deleting-Published-Outbound-Posts.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0120",
    "num": 120,
    "title": "SearchProviderConnector \u2014 Shared One-Off Search Abstraction",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft)",
    "file": "FDD-0120-Search-Provider-Connector.md",
    "conformance": "100% (14/14 sections)"
  },
  {
    "id": "FDD-0121",
    "num": 121,
    "title": "Composer Deep Research Caching, Re-Trigger, and Cost Justification",
    "status": "Draft (ADR status: Proposed (2026-08-23); BRD status: Draft \u2014 ADR-0121 is Proposed and may change)",
    "file": "FDD-0121-Composer-Deep-Research-Caching-Retrigger-Cost.md",
    "conformance": "100% (14/14 sections)"
  }
];

export const STORIES_LIST: StoryItem[] = [
  {
    "storyId": "1.1",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Core REST API access for the admin UI",
    "source": "ADR-0001",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 socialengage@8fa7a66"
  },
  {
    "storyId": "1.2",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Postgres as the database engine",
    "source": "ADR-0016",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@bce8cfc"
  },
  {
    "storyId": "1.3",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "REST API versioning and compatibility policy",
    "source": "ADR-0017",
    "status": "Ready (accepted 2026-07-29, ahead of its natural phase \u2014 see ADR-0017's Acceptance note)",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@1ebc971"
  },
  {
    "storyId": "1.4",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Persistent local dev database, separate from the ephemeral test database",
    "source": "ADR-0025",
    "status": "Ready \u2014 accepted 2026-07-30, the same day it was built and verified (see ADR-0025's Acceptance note on why this is a deliberate exception to Phase 0's \"also build, not storied\" classification of local dev tooling)",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@5f43ca9"
  },
  {
    "storyId": "1.5",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Watchlist CRUD REST surface, personal/per-user, with ADR-0044's PATCH/error/locking contract",
    "source": "ADR-0044 (Accepted 2026-08-11)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-12 \u2014 social-listening-core@aaf6bd7"
  },
  {
    "storyId": "1.6",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Connector connect/disconnect REST surface (placeholder-auth shape)",
    "source": "Phase 1 \"also build, not storied\" work (see `docs/open-items-and-deferred-work.md` \u00a7A, `docs/implementation-plan.md` Phase 1)",
    "status": "Ready \u2014 already built and contract-verified (see `docs/implementation-plan.md`'s 2026-08-01 update); this entry is added retroactively, 2026-08-03, to give the already-in-use \"Story 1.6\" label a home in this file, per this project's own \"don't rewrite history\" convention (no prior entry existed here for it).",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "1.7",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Ownership-tier-aware connector connect/disconnect, superseding Story 1.6",
    "source": "ADR-0034",
    "status": "Ready \u2014 ADR-0034 accepted 2026-08-03, its own flagged interpretive question (Tenant-Admin's offboarding revocation authority) confirmed as drafted. All dependencies (ADR-0028\u20130033) now Accepted. Scheduled last in Phase 4.5 (`docs/implementation-plan.md`) \u2014 the only remaining Blocked-to-Ready transition in that phase; Phase 4.5 now has no Blocked stories left.",
    "isBuilt": true,
    "builtInfo": "2026-08-04 \u2014 social-listening-core@82c2d68"
  },
  {
    "storyId": "1.8",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Tenant self-view REST endpoint",
    "source": "ADR-0031 (Accepted)",
    "status": "Built 2026-08-09 (`social-listening-core@10fc934`, `contracts/epic-1/story-1.8.tenant-self-view.contract.test.ts`, 8/8, full suite 44/44 suites / 272/272 tests \u2014 see `docs/implementation-log.md`). No new ADR needed. `tenants.md`'s own RLS policy (Story 5.8, built) already proves a tenant-scoped session sees exactly its own row at the database layer; this story only adds the HTTP route calling into it, the same ordinary CRUD-shaped surface-exposure Story 1.5 already established as not needing its own ADR.",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "1.9",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "User invitation and offboarding REST surface",
    "source": "ADR-0032 (Accepted)",
    "status": "Ready \u2014 no new ADR needed. ADR-0032 \u00a76 (invite/link flow) and \u00a79 (`access_ends_at`) already fully designed the schema, RLS, and seat-enforcement mechanics this story exposes over HTTP; the same ordinary CRUD-shaped surface-exposure Story 1.5 already established as not needing its own ADR.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "1.10",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Postgres boot-time readiness check and a real `/v1/health`",
    "source": "ADR-0016 (Postgres as the database engine, Accepted)",
    "status": "Ready \u2014 built 2026-08-12. ADR-0016 already decided Postgres is this project's database engine; a boot-time connectivity check and a database-aware liveness route are operational implementation detail under that already-decided architecture, the same \"ordinary surface work needs no new ADR\" category Stories 1.5/1.8/1.9 already established.",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "1.11",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Connector activation, decoupled from credential presence",
    "source": "ADR-0051 (Accepted 2026-08-12)",
    "status": "Ready \u2014 ADR-0051 accepted the same day it was drafted, after seven in-place revisions during live review (see ADR-0051's own Amendment Log). All dependencies (ADR-0028, ADR-0034/Story 1.7) already Accepted/built.",
    "isBuilt": true,
    "builtInfo": "2026-08-12 \u2014 social-listening-core@703e755"
  },
  {
    "storyId": "1.12",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "`GET /v1/connectors/:platformId` combines activation state with derived health",
    "source": "ADR-0051 Open Question 5 (Accepted 2026-08-12)",
    "status": "Ready \u2014 no new ADR needed. This is an additive response-shape extension of an already-decided, already-shipped endpoint (Story 4.4/ADR-0022), the same \"ordinary surface work\" category Stories 1.5/1.8/1.9 already established as not needing one. Depends on Story 1.11 (`connector_activations`/`connector_user_activations`, built).",
    "isBuilt": true,
    "builtInfo": "2026-08-12 \u2014 social-listening-core@c3af2a7"
  },
  {
    "storyId": "1.13",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Live ingestion-polling scheduler: registry bootstrap, generic per-connector `poll()`, derived-cadence loop",
    "source": "ADR-0052 (Accepted 2026-08-13)",
    "status": "Ready \u2014 ADR-0052 accepted the same day it was drafted, after four in-place revisions during live review (see ADR-0052's own Amendment Log). Depends on Story 1.11 (`connector_activations`/`shouldAttemptIngestion()`, built) and Story 1.12 (`isActive` read, built) \u2014 both already Accepted/built; no new ADR-0029\u20130034-style dependency chain.",
    "isBuilt": true,
    "builtInfo": "2026-08-13 \u2014 social-listening-core@a479383"
  },
  {
    "storyId": "1.14",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Poll scheduler: skip a pair whose most recent run is still `status: 'running'`",
    "source": "ADR-0052 Decision \u00a75b (Clarification, 2026-08-18)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-core@838e3dc"
  },
  {
    "storyId": "1.15",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Tier-3 (user-bound) poll scheduling: per-user enumeration, cross-user health/in-flight isolation",
    "source": "ADR-0061 (Accepted 2026-08-18)",
    "status": "Ready. Accepted as drafted, verbatim: *\"ADR-0061 is complete, coherent, and ready for my acceptance. It cleanly bridges the gap between ADR-0060's data model and the background scheduling engine, resolving all implicit cross-user race conditions before they ever manifest in production. Excellent work and I approve ADR 0061\"* \u2014 no review-round amendments, so every Acceptance Criterion below is unchanged from the original drafting pass.",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-core@b270662"
  },
  {
    "storyId": "1.16",
    "epicId": "Epic 1",
    "epicTitle": "Epic 1: Repository & API Foundation",
    "title": "Ingestion Run Watchdog Reconciliation, Stalled Health Derivation, and Service Bus Ingestion Alert Events",
    "source": "ADR-0070 (Accepted 2026-08-20)",
    "status": "Built",
    "isBuilt": true,
    "builtInfo": "2026-08-20 (social-listening-core@ae1bd98)"
  },
  {
    "storyId": "10.1",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Prospecting list model and sharing (backend)",
    "source": "ADR-0086",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.2",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Prospecting list UI (frontend)",
    "source": "ADR-0086",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 10.1)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.3",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Preconfigured analytics views (backend)",
    "source": "ADR-0087",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.4",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Ad-hoc query endpoint (backend)",
    "source": "ADR-0088",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.5",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Ad-hoc query UI (frontend)",
    "source": "ADR-0088",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 10.4)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.6",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Platform metrics table and Azure Metrics integration (backend)",
    "source": "ADR-0114 / ADR-0089",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.7",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Platform operations dashboard (frontend)",
    "source": "ADR-0089",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 10.6)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.8",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Data export posts CSV (backend)",
    "source": "ADR-0090 / ADR-0111",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.9",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Real-time alert rules and delivery (backend)",
    "source": "ADR-0091",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.10",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Real-time alert UI (frontend)",
    "source": "ADR-0091",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 10.9)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.11",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Author-initiated takedown (backend)",
    "source": "ADR-0092",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.12",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "DSR self-service portal (backend)",
    "source": "ADR-0093",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.13",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Compliance audit pack (backend)",
    "source": "ADR-0094",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "10.14",
    "epicId": "Epic 10",
    "epicTitle": "Epic 10: Analytics, operations, and trust (ADRs 0086\u20130094)",
    "title": "Trust and rights admin UI (frontend)",
    "source": "ADRs 0092, 0093, 0094",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Stories 10.11, 10.12, 10.13)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.1",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "CRM connector and case handoff (backend)",
    "source": "ADR-0095",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.2",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Case handoff to CRM UI (frontend)",
    "source": "ADR-0095",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 11.1)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.3",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Daily digest email (backend)",
    "source": "ADR-0096",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.4",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Daily digest email UI (frontend)",
    "source": "ADR-0096",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 11.3)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.5",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Topic evolution timeline (backend)",
    "source": "ADR-0097",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.6",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Topic evolution timeline UI (frontend)",
    "source": "ADR-0097",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 11.5)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.7",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Publishing and scheduling (backend)",
    "source": "ADR-0098",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.8",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Publishing and scheduling UI (frontend)",
    "source": "ADR-0098",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 11.7)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.9",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Unified social inbox and reply (backend)",
    "source": "ADR-0099",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.10",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Unified social inbox and reply UI (frontend)",
    "source": "ADR-0099",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 11.9)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.11",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Composed post author mention suggestions (backend)",
    "source": "ADR-0100",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Stories 9.10 and 11.10)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "11.12",
    "epicId": "Epic 11",
    "epicTitle": "Epic 11: Engagement, workflow, and composer (ADRs 0095\u20130100)",
    "title": "Composed post mention suggestions UI (frontend)",
    "source": "ADR-0100",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 11.11)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.1",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Connector capability matrix (backend)",
    "source": "ADR-0101",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.2",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Connector capability matrix UI (frontend)",
    "source": "ADR-0101",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 12.1)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.3",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Boolean query AST and visual builder (backend)",
    "source": "ADR-0102",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.4",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Boolean query visual builder (frontend)",
    "source": "ADR-0102",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 12.3)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.5",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "AI sentiment aspect schema (backend)",
    "source": "ADR-0103",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.6",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "AI sentiment aspect UI (frontend)",
    "source": "ADR-0103",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 12.5)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.7",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "AI topic clustering post-topics schema (backend)",
    "source": "ADR-0104",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.8",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Topic curation and selected topic UI (frontend)",
    "source": "ADR-0104",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 12.7)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.9",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Dashboard widget contracts (backend)",
    "source": "ADR-0105",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.10",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Dashboard widget renderer (frontend)",
    "source": "ADR-0105",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 12.9)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.11",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Public API versioning and webhooks (backend)",
    "source": "ADR-0106",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.12",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Webhook management UI (frontend)",
    "source": "ADR-0106",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 12.11)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.13",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Multi-user workspaces and RBAC permissions (backend)",
    "source": "ADR-0107",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.14",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "RBAC and workspace settings UI (frontend)",
    "source": "ADR-0107",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 12.13)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.15",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Influencer discovery and scoring (backend)",
    "source": "ADR-0108",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "12.16",
    "epicId": "Epic 12",
    "epicTitle": "Epic 12: Foundation depth and AI refinements (ADRs 0101\u20130108)",
    "title": "Influencer discovery UI (frontend)",
    "source": "ADR-0108",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 12.15)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.1",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Connector health auto-disable and recovery (backend)",
    "source": "ADR-0109",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.2",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Per-connector query translation and validation (backend)",
    "source": "ADR-0110",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.3",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Query capability warnings in watchlist builder (frontend)",
    "source": "ADR-0110",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 13.2)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.4",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Export bounding, streaming, and size caps (backend)",
    "source": "ADR-0111",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.5",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Feature gating and seat-limit enforcement (backend)",
    "source": "ADR-0112",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.6",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Plan and seat management UI (frontend)",
    "source": "ADR-0112",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 13.5)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.7",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Metric explainability prompt and caching (backend)",
    "source": "ADR-0113",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.8",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Platform metrics table and Azure Metrics (backend)",
    "source": "ADR-0114",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.9",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Publishing media upload and asset targeting (backend)",
    "source": "ADR-0115",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.10",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Media upload and asset targeting UI (frontend)",
    "source": "ADR-0115",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 13.9)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.11",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Semantic drift detection (backend)",
    "source": "ADR-0116",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Epic 9 RAG)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.12",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Semantic drift UI (frontend)",
    "source": "ADR-0116",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 13.11)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.13",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Prospecting list export and CRM push (backend)",
    "source": "ADR-0117",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "13.14",
    "epicId": "Epic 13",
    "epicTitle": "Epic 13: Sub-decisions, v2 features, and closing loops (ADRs 0109\u20130117)",
    "title": "Prospecting export and CRM push UI (frontend)",
    "source": "ADR-0117",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 13.13)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "2.1",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Unified provider connector framework",
    "source": "ADR-0002",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@7604c25"
  },
  {
    "storyId": "2.2",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Per-tenant, per-provider rate limiting",
    "source": "ADR-0003",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@00322f2"
  },
  {
    "storyId": "2.3",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Retryable/non-retryable error handling with per-tenant auto-disable",
    "source": "ADR-0010",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@10e7c43"
  },
  {
    "storyId": "2.4",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Bounded rate-limit queues, request-level dead-lettering, and distributed gate state",
    "source": "ADR-0020",
    "status": "Ready (accepted 2026-07-29; scheduled for Phase 4 \u2014 see `docs/implementation-plan.md`; numbers kept flat and queue-depth rejection folds into existing `ConnectorHealth` states, per ADR-0020's Acceptance note)",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@6a21c8b"
  },
  {
    "storyId": "2.5",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Proportional, rate-relative connector failure threshold",
    "source": "ADR-0023",
    "status": "Ready \u2014 implemented 2026-07-30 (50%/5-attempt floor/20-consecutive kept as launch defaults, per ADR-0023's Acceptance note)",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@fc4245c"
  },
  {
    "storyId": "2.6",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Newswire connector: direct wire-service RSS, issuer-as-Author",
    "source": "ADR-0024",
    "status": "Ready \u2014 accepted 2026-07-30 (GlobeNewswire + PR Newswire v1 scope, AccessWire/Business Wire deferred, per ADR-0024's Acceptance note)",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@0169143"
  },
  {
    "storyId": "2.7",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "RSS/News connector: GNews API, publication-as-Author",
    "source": "ADR-0026",
    "status": "Ready (drafted 2026-07-31 by the AI Business & Requirements Analyst persona, left Proposed rather than self-accepted the same day since that persona doesn't hold ADR-acceptance authority \u2014 see ADR-0026's own Status line; accepted by Menno later the same day, 2026-07-31)",
    "isBuilt": true,
    "builtInfo": "2026-08-01 \u2014 social-listening-core@8e3a54d"
  },
  {
    "storyId": "2.8",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Concrete AI enrichment provider connector: Azure AI Language",
    "source": "ADR-0038 (Accepted 2026-08-06)",
    "status": "Ready. Sourced from a new ADR because the concrete provider choice, once Menno's own follow-up widened the comparison to include general-purpose-LLM structured extraction, is a genuine, hard-to-reverse, primary-source-researched selection \u2014 the same bar ADR-0024/0026 already established for connector-provider selection, not ordinary CRUD/UI surface.",
    "isBuilt": true,
    "builtInfo": "2026-08-10 \u2014 social-listening-core@f70b07d"
  },
  {
    "storyId": "2.9",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Second AIProviderConnector: Azure-hosted LLM swappability validation",
    "source": "Story 2.1 connector-abstraction contract, Story 2.8 follow-up note, and ADR-0038 \u00a72/Open Questions",
    "status": "Built 2026-08-10 (`social-listening-core`, real Azure OpenAI Service resource, `gpt-5-mini` \u2014 see ADR-0038's own Amendment Log for the Claude-in-Foundry-vs-Azure-OpenAI research and the `gpt-4o-mini`\u2192`gpt-5-mini` deployment correction, and `docs/implementation-log.md` for the full build account).",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "2.10",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Connector Registration Transparency",
    "source": "ADR-0048 (Accepted 2026-08-11)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-12 \u2014 social-listening-core@f2c7788"
  },
  {
    "storyId": "2.11",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Tenant-owned-domain RSS/content-feed connector with DNS TXT verification",
    "source": "ADR-0050 (Accepted 2026-08-11)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-12 \u2014 social-listening-core@afcb59e"
  },
  {
    "storyId": "2.12",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "`deriveConnectorHealth()` excludes retryable failures from the `failing` derivation",
    "source": "ADR-0010 \u00a7Clarification (2026-08-12), ADR-0023 \u00a7Clarification (2026-08-12)",
    "status": "Built 2026-08-12 \u2014 no new ADR needed. This corrects an implementation gap against ADR-0010's own already-Accepted Decision text (\"retryable errors \u2192 automatic retry; non-retryable \u2192 immediate `failing` status\"), per that ADR's own dated Clarification and ADR-0023's matching one \u2014 not a new decision, the same \"implementation catches up to an already-stated policy\" category ADR-0009/0010's own prior \"Supersession update\" notes already used for Story 2.5.",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "2.13",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Wikipedia connector: MediaWiki Action API, revision re-poll cadence, article-as-Author",
    "source": "ADR-0042 (Accepted 2026-08-08)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-core@591b0b8. **A real, confirmed drafting gap, not a new decision:** ADR-0042's own acceptance note (2026-08-08) states directly that \"a story would be added to Epic 2 only at this ADR's acceptance, not before,\" the same \"no story until acceptance\" precedent every connector-selection ADR in this series follows (ADR-0024/0026/0050) \u2014 but that story was never actually drafted, confirmed directly by grepping every `docs/user-stories/epic-*.md` file for `ADR-0042` and finding zero matches, four days after acceptance. Closed here."
  },
  {
    "storyId": "2.14",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Wikipedia discovery search driven by the tenant's own watchlist terms",
    "source": "ADR-0042 \u00a75 (Accepted 2026-08-08)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-core@c802b64. No new ADR needed \u2014 ADR-0042 Decision \u00a75 already named this directly as implementation-time work (\"Exact AST-to-CirrusSearch-syntax translation is an implementation-time task, not fixed by this ADR\"), the same \"resolve an already-Accepted ADR's own named open item directly\" precedent Story 5.8 (\u00a75's `domain` column), Story 5.11 (\u00a75's endpoint shape), and Story 5.17 (\u00a79's audit mechanics) already established."
  },
  {
    "storyId": "2.15",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Facebook connector: tenant's own connected Page, posts only, Tier 3 credential",
    "source": "ADR-0059 (Accepted 2026-08-18)",
    "status": "Ready \u2014 a real, unresolved precondition named up front, not a formality: ADR-0059 Decision \u00a73 found that onboarding any real, unaffiliated tenant's Page requires SocialEngage's own registered Meta App to clear Business Verification and pass permission-by-permission App Review (`pages_show_list`, `pages_read_engagement`), neither of which is confirmed achievable for a solo-developer project \u2014 App Review approval is a discretionary human review, not a mechanical check (ADR-0059's own review-round addition). This story's own contract can be built and proven against a Menno-administered test Page under Standard Access (the degenerate, no-App-Review case ADR-0059 Decision \u00a73 itself names) without either gate being cleared first; **onboarding any real tenant's Page beyond that test case is blocked on Business Verification/App Review succeeding, separately from this story's own build-and-test completion.** Named here rather than silently assumed resolved.",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-core@50a5914"
  },
  {
    "storyId": "2.16",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "`azureAiLanguageConnector.analyze()` throws a classified error instead of crashing on a rejected document",
    "source": "No new ADR needed \u2014 this corrects an implementation gap against ADR-0038's own already-Accepted Decision text (enrichment is best-effort, additive, never a hard dependency of ingestion succeeding) and `enrichPost.ts`'s own already-stated contract (\"Never throws... a programming error... all resolve to `undefined`\"), the same \"implementation catches up to an already-stated policy\" category Story 2.12 already used for `deriveConnectorHealth()`. **Status:** Built 2026-08-18.",
    "status": "Built 2026-08-18.",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-core@3fedac3"
  },
  {
    "storyId": "2.17",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Azure OpenAI's structured enrichment call also returns a stored `summary` field",
    "source": "No new ADR needed \u2014 additive widening of `AnalyzeResult` (ADR-0002/ADR-0038's own already-Accepted `AIProviderConnector` interface), the same \"widen the interface, existing callers unaffected\" pattern Story 2.8/2.9 already established for `sentimentScores`/`entities`/`overallConfidence`. **Status:** Built 2026-08-18.",
    "status": "Built 2026-08-18.",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-core@6a9b628"
  },
  {
    "storyId": "2.18",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Facebook connector captures post-level engagement counts (reactions, comments, shares)",
    "source": "ADR-0059 Decision \u00a72",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-core@35e35c3"
  },
  {
    "storyId": "2.19",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Tenant-owned feed: per-feed display name, and per-item author (byline) extraction",
    "source": "ADR-0050's own 2026-08-20 Amendment Log entry \u2014 two additive, backward-compatible extensions of the already-Accepted ADR-0050, neither requiring re-acceptance. **Status:** Ready",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-20 \u2014 social-listening-core@2f52c0f (backend half only \u2014 see Explicitly out of scope below for the admin-side UI, Story 6.28)"
  },
  {
    "storyId": "2.20",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Country-level geospatial extraction and normalization on post enrichment",
    "source": "ADR-0064 (Proposed 2026-08-19)",
    "status": "Built 2026-08-20",
    "isBuilt": true,
    "builtInfo": "2026-08-20 \u2014 social-listening-core"
  },
  {
    "storyId": "2.21",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Active Watchlist Sourcing via Brave Search API: Polling connector, query transformation, and junction linking",
    "source": "ADR-0065 (Accepted 2026-08-20)",
    "status": "Implemented",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "2.22",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Active Watchlist Sourcing via Bing Search API (Azure): Polling connector, candidate evaluation cap, and URL canonicalisation",
    "source": "ADR-0066 (Accepted 2026-08-20)",
    "status": "Implemented",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "2.23",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Facebook connector: Graph API `from` extraction, hosting Page post dependency, and two-tier author resolution",
    "source": "ADR-0067 (Accepted 2026-08-20)",
    "status": "Implemented",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "2.24",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Instagram Business Connector: Tier-3 OAuth Poller, Single-Row Carousel Normalization, Lookback Pagination, and Error Reclassification",
    "source": "ADR-0068 (Accepted 2026-08-20)",
    "status": "Implemented",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "2.25",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "LinkedIn Connector: Confidential Client OAuth, Token Lifecycle with Persisted Expiry, Rest.li Rate Limiting, and 1-Hour Poller Guardrails",
    "source": "ADR-0069 (Accepted 2026-08-20)",
    "status": "Implemented",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "2.26",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Connector Reply Framework and Outbound Rate Gate",
    "source": "ADR-0073 (Accepted 2026-08-22)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-23 \u2014 social-listening-core@e3df7d9"
  },
  {
    "storyId": "2.27",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Facebook Page Reply Implementation",
    "source": "ADR-0073 (Accepted 2026-08-22)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-23 \u2014 social-listening-core@2da26eb"
  },
  {
    "storyId": "2.28",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Connector Publish Framework and Outbound Post Rate Gate",
    "source": "ADR-0075 (Accepted 2026-08-23)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-23 \u2014 social-listening-core@f1e0f9b"
  },
  {
    "storyId": "2.29",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Facebook Page Post Publishing",
    "source": "ADR-0075 (Accepted 2026-08-23)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-23 \u2014 social-listening-core@4234834"
  },
  {
    "storyId": "2.30",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "LinkedIn Post Publishing",
    "source": "ADR-0075 (Accepted 2026-08-23)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-23 \u2014 social-listening-core@3a65691"
  },
  {
    "storyId": "2.31",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Brave and Bing one-off research search helpers",
    "source": "ADR-0076 (Accepted 2026-08-23)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-23 \u2014 social-listening-core@4949200"
  },
  {
    "storyId": "2.32",
    "epicId": "Epic 2",
    "epicTitle": "Epic 2: Ingestion, Connectors & Rate Limits",
    "title": "Azure OpenAI `research?()` capability",
    "source": "ADR-0076 (Accepted 2026-08-23)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-23 \u2014 social-listening-core@7854300"
  },
  {
    "storyId": "3.1",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Normalized author entity",
    "source": "ADR-0004",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@34264e6"
  },
  {
    "storyId": "3.2",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "IngestionRun as the audit anchor for every post",
    "source": "ADR-0005",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@34264e6"
  },
  {
    "storyId": "3.3",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Connector-side watchlist filtering with post-fetch fallback",
    "source": "ADR-0006",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@f3254d9"
  },
  {
    "storyId": "3.4",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Cursor-based pagination for the posts API",
    "source": "ADR-0011",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@a5399d5"
  },
  {
    "storyId": "3.5",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Tiered data retention and archival",
    "source": "ADR-0018",
    "status": "Ready (accepted 2026-07-29; scheduled for Phase 4 \u2014 see `docs/implementation-plan.md`, since storage volume rather than correctness is the driver)",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@f4bd93c"
  },
  {
    "storyId": "3.6",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Unified boolean-query AST for watchlist matching",
    "source": "ADR-0021",
    "status": "Ready (accepted 2026-07-29; scheduled for Phase 4 \u2014 see `docs/implementation-plan.md`; whole-query degradation kept for v1, per ADR-0021's Acceptance note)",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@5c375ec"
  },
  {
    "storyId": "3.7",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Tenant offboarding data lifecycle: export and deletion",
    "source": "ADR-0039 (Accepted 2026-08-06)",
    "status": "Retired 2026-08-07 \u2014 never built as specified below. See Story 3.8, which now owns this entire capability.",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "3.8",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Self-service, Tenant-Admin-initiated tenant deletion: request, export, grace period, confirmation",
    "source": "ADR-0043 (Accepted 2026-08-07)",
    "status": "Ready. Now the sole tenant-deletion mechanism (Story 3.7 retired, above) \u2014 ADR-0043 was corrected in place before acceptance to supersede ADR-0039 Decision \u00a71 in full, not narrowly on its \"cannot self-delete\" sentence, once Story 3.7's own build surfaced the collision described in its retirement note.",
    "isBuilt": true,
    "builtInfo": "2026-08-07 \u2014 social-listening-core@9a99257"
  },
  {
    "storyId": "3.9",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Point-in-time author follower count on `SocialPost`",
    "source": "ADR-0049 (Accepted 2026-08-11)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-12 \u2014 social-listening-core@34e9dfb"
  },
  {
    "storyId": "3.10",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Canonical Markdown post-body storage and enrichment input (`body_markdown`, `body_markdown_version`)",
    "source": "ADR-0053 (Accepted 2026-08-13)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-13 \u2014 social-listening-core@dcec172"
  },
  {
    "storyId": "3.11",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Post-watchlist match persistence: `post_watchlist_matches` junction table, ingestion write, and `GET /v1/posts?watchlistId` filter",
    "source": "ADR-0063 (Accepted 2026-08-19)",
    "status": "Built 2026-08-19 \u2014 resumed mid-implementation from a prior session via `heal-contract-failure` (real schema conflict, ambiguous-column SQL bug, and fixture bug found and fixed \u2014 see ADR-0063's own Amendment Log and `docs/implementation-log.md`).",
    "isBuilt": true,
    "builtInfo": "2026-08-19 \u2014 social-listening-core@63902a1"
  },
  {
    "storyId": "3.12",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Post-watchlist match historical backfill and discovery-driven watchlist attribution",
    "source": "ADR-0063 (2026-08-20 Amendment Log entry)",
    "status": "Built 2026-08-20",
    "isBuilt": true,
    "builtInfo": "2026-08-20 \u2014 social-listening-core@3adc060"
  },
  {
    "storyId": "3.13",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Post Enrichment Overrides API and Re-Enrichment Precedence Guard",
    "source": "ADR-0071 (Accepted 2026-08-20)",
    "status": "Implemented",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "3.14",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Outbound Reply Audit Table and `POST /v1/posts/:id/replies` API",
    "source": "ADR-0073 (Accepted 2026-08-22)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-24 \u2014 social-listening-core@e3e661b"
  },
  {
    "storyId": "3.15",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Outbound Post Publishing Audit Table and `POST /v1/outbound/posts` API",
    "source": "ADR-0075 (Accepted 2026-08-23)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-24 \u2014 social-listening-core@8e7f312"
  },
  {
    "storyId": "3.16",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Tenant-facing workspace and matched-posts export endpoints",
    "source": "ADR-0074 (Accepted 2026-08-23)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-24 \u2014 social-listening-core@0d11e3f"
  },
  {
    "storyId": "3.17",
    "epicId": "Epic 3",
    "epicTitle": "Epic 3: Data Model, Storage & Archival",
    "title": "Composer deep research REST endpoint",
    "source": "ADR-0076 (Accepted 2026-08-23)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "4.1",
    "epicId": "Epic 4",
    "epicTitle": "Epic 4: Derived Data, Analytics & Health",
    "title": "Raw author-topic signals for expert-finding",
    "source": "ADR-0007",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@16d6fea"
  },
  {
    "storyId": "4.2",
    "epicId": "Epic 4",
    "epicTitle": "Epic 4: Derived Data, Analytics & Health",
    "title": "Deferred topic time-series aggregation",
    "source": "ADR-0008",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@ec66c3b"
  },
  {
    "storyId": "4.3",
    "epicId": "Epic 4",
    "epicTitle": "Epic 4: Derived Data, Analytics & Health",
    "title": "Derived connector health from IngestionRun history",
    "source": "ADR-0009",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@10e7c43"
  },
  {
    "storyId": "4.4",
    "epicId": "Epic 4",
    "epicTitle": "Epic 4: Derived Data, Analytics & Health",
    "title": "Derived-data caching and refresh strategy",
    "source": "ADR-0022",
    "status": "Ready (accepted 2026-07-29; scheduled for Phase 4 \u2014 see `docs/implementation-plan.md`; 60s TTL, hourly refresh, and in-process cache locality all kept as originally proposed, per ADR-0022's Acceptance note)",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@56385ba"
  },
  {
    "storyId": "5.1",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Thin ingestion events with REST fetch on demand",
    "source": "ADR-0012",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@1e4e7d2"
  },
  {
    "storyId": "5.2",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Per-tenant event filtering via Service Bus subscription rules",
    "source": "ADR-0013",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@e2dd7d7"
  },
  {
    "storyId": "5.3",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Envelope-encrypted credential storage with OAuth-first auth",
    "source": "ADR-0014",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@133b0cb"
  },
  {
    "storyId": "5.4",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Tenant isolation via Postgres Row-Level Security",
    "source": "ADR-0015",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-07-29 \u2014 social-listening-core@bce8cfc"
  },
  {
    "storyId": "5.5",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Event schema versioning via Service Bus message property",
    "source": "ADR-0019",
    "status": "Ready (accepted 2026-07-29, ahead of its natural phase \u2014 see ADR-0019's Acceptance note); implementation still waits for Phase 3, when events are first published",
    "isBuilt": true,
    "builtInfo": "2026-07-30 \u2014 social-listening-core@914dfce"
  },
  {
    "storyId": "5.6",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Authentication via Microsoft Entra External ID",
    "source": "ADR-0029",
    "status": "Ready \u2014 ADR-0029 accepted 2026-08-03 (\"reviewed ADR 0029 and approved\"). Scheduled in Phase 4.5, first in that phase's own dependency chain (`docs/implementation-plan.md`) \u2014 Story 5.7 depends on this story's caller identity and is also Ready \u2014 ADR-0030 accepted 2026-08-03.",
    "isBuilt": true,
    "builtInfo": "2026-08-03 \u2014 socialengage@caa4c57"
  },
  {
    "storyId": "5.7",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Platform Admin's audited, narrowly-scoped RLS bypass",
    "source": "ADR-0030",
    "status": "Ready \u2014 ADR-0030 accepted 2026-08-03, revised at review to add a narrow break-glass mechanism (Tenant-Admin credential reset only, no other tenant-data access). Scheduled in Phase 4.5 (`docs/implementation-plan.md`), second in that phase's dependency chain \u2014 depends on Story 5.6 (Ready) for the caller identity a Platform Admin action authenticates; Story 5.8 is also Ready \u2014 ADR-0031 accepted 2026-08-03.",
    "isBuilt": true,
    "builtInfo": "2026-08-03 \u2014 social-listening-core@3378e00"
  },
  {
    "storyId": "5.8",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "`tenants` table with its own RLS policy",
    "source": "ADR-0031",
    "status": "Ready \u2014 ADR-0031 accepted 2026-08-03, revised at review to add sign-up domain capture (`tenants.domain`, for future same-domain sign-up routing). Scheduled in Phase 4.5 (`docs/implementation-plan.md`), third in that phase's dependency chain \u2014 depends on Story 5.7 (Ready) for the bypass role; Story 5.9 is also Ready \u2014 ADR-0032 accepted 2026-08-03.",
    "isBuilt": true,
    "builtInfo": "2026-08-03 \u2014 social-listening-core@e6de8df"
  },
  {
    "storyId": "5.9",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "`users` table, RLS, and request-time identity resolution",
    "source": "ADR-0032",
    "status": "Ready \u2014 ADR-0032 accepted 2026-08-03, revised at review to replace `status`'s `'suspended'` value with a nullable `access_ends_at` timestamp (\u00a79). Scheduled in Phase 4.5 (`docs/implementation-plan.md`), fourth in that phase's dependency chain \u2014 depends on Story 5.8 (Ready) for the `tenants.id` foreign-key target; Story 5.10 is also Ready \u2014 ADR-0033 accepted 2026-08-03.",
    "isBuilt": true,
    "builtInfo": "2026-08-03 \u2014 social-listening-core@b0839ed"
  },
  {
    "storyId": "5.10",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Retire `X-Tenant-Id` as a trust mechanism",
    "source": "ADR-0033",
    "status": "Ready \u2014 ADR-0033 accepted 2026-08-03, as drafted, no revisions. Scheduled in Phase 4.5 (`docs/implementation-plan.md`), fifth and last of that phase's own dependency chain \u2014 depends on Story 5.9 (Ready) for the resolution path it relies on. Story 1.7 (Epic 1) is also Ready \u2014 ADR-0034 accepted 2026-08-03; Phase 4.5 has no Blocked stories left.",
    "isBuilt": true,
    "builtInfo": "2026-08-03 \u2014 social-listening-core@3580687"
  },
  {
    "storyId": "5.11",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "`GET /v1/me`: expose a signed-in caller's own resolved identity over HTTP",
    "source": "ADR-0036 \u00a75 (Accepted 2026-08-04)",
    "status": "Ready \u2014 ADR-0036 accepted 2026-08-04 (\"ADR 0036 is approved\"). This story resolves ADR-0036's own still-open \"exact path, response shape, and name of the new core-side identity-exposure endpoint\" Open Question at drafting time \u2014 the same way Story 5.8 resolved ADR-0031 \u00a75's `domain`-column details and Story 6.7 resolved several of ADR-0037's own named open items directly, rather than treating an Accepted ADR's own flagged Open Question as a blocker to drafting the story it names as a prerequisite.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "5.12",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Platform Admin tenant management REST surface",
    "source": "ADR-0030, ADR-0031 (both Accepted)",
    "status": "Ready \u2014 no new ADR needed. Both governing ADRs already fully locked the authorization boundary (which columns `platform_admin_role` may write, which tables it may touch at all) at the database layer; this story exposes that already-designed boundary over HTTP, the same \"ordinary CRUD-adjacent surface, no new architectural decision\" category Story 5.11 already established when resolving ADR-0036 \u00a75's analogous gap.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "5.13",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Platform Admin break-glass request/execute REST surface",
    "source": "ADR-0030 (Accepted)",
    "status": "Ready \u2014 no new ADR needed. ADR-0030 \u00a73 and its two Clarifications already fully designed the two-phase mechanism this story exposes over HTTP; Story 5.7 already builds and contract-tests the underlying store/mechanism layer.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "5.14",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Platform Admin audit-log query REST surface",
    "source": "ADR-0030 (Accepted)",
    "status": "Ready \u2014 no new ADR needed. `platform_admin_audit_log`'s schema and write path already exist (Story 5.7); this story adds a read-only query endpoint over already-existing, already-Platform-Admin-scoped data.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "5.15",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Self-service tenant sign-up backend endpoint",
    "source": "ADR-0037 (Accepted)",
    "status": "Ready \u2014 no new ADR needed. ADR-0037 \u00a71\u2013\u00a79 already exhaustively designed this endpoint's own behavior, schema, and role; this story builds directly against an already-Accepted ADR's own \"Named as required, not designed here\" list, the same relationship Story 6.7 already has to this same ADR for the UI half.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "5.16",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Same-Domain Invite Assist backend surface and Platform-Admin escalation",
    "source": "ADR-0037 \u00a78b/\u00a78c (Accepted)",
    "status": "Ready \u2014 no new ADR needed. ADR-0037 \u00a78b/\u00a78c already exhaustively decided the data model, per-domain aggregation, and escalation-logging mechanics this story exposes; only the backend half of `docs/open-decisions.md` \u00a71's own named gap (\"has no owning story\").",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "5.17",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Audit trail for `access_ends_at` writes",
    "source": "ADR-0032 \u00a79 (Accepted)",
    "status": "Ready \u2014 no new ADR needed; this story resolves ADR-0032 \u00a79's own named Open Question (the exact audit mechanism) directly, the same way Story 5.8 resolved ADR-0031 \u00a75's `domain`-column details and Story 5.11 resolved ADR-0036 \u00a75's endpoint shape \u2014 an implementation-time mechanics question, not a fresh architectural one, since the underlying principle (every `access_ends_at` write is auditable) is already decided.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "5.18",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Self-service sign-up rate limiting and abuse prevention",
    "source": "ADR-0040 (Accepted 2026-08-06)",
    "status": "Ready. A genuinely undecided, hard-to-reverse new mechanism (a new keying scheme, real DoS/availability stakes if built wrong) \u2014 ADR-0037 \u00a77 itself already named this as \"not designed here... a precondition, not an optional hardening pass,\" the same bar that earned ADR-0020 its own ADR for an analogous rate-limit-mechanism decision.",
    "isBuilt": true,
    "builtInfo": "2026-08-10 \u2014 social-listening-core@7a2466d"
  },
  {
    "storyId": "5.19",
    "epicId": "Epic 5",
    "epicTitle": "Epic 5: Security, Isolation & Messaging",
    "title": "Wire `SocialPostIngestedEvent`/`ConnectorHealthChangedEvent` publishing into the real ingestion pipeline",
    "source": "ADR-0058 (Accepted 2026-08-17)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-core@3ef32ad"
  },
  {
    "storyId": "6.1",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Next.js scaffold and Entra sign-in (server-side session)",
    "source": "ADR-0036",
    "status": "Ready \u2014 ADR-0036 accepted 2026-08-04 (\"ADR 0036 is approved\"). Also has a real cross-repo prerequisite: `social-listening-core` needs a new `GET /v1/me`-shaped endpoint (ADR-0036 \u00a75) that does not exist today \u2014 confirmed directly against `src/identity/identityResolution.ts` and every `versions/v1/*Router.ts` file. That endpoint is `social-listening-core` work, out of this repo's/this document's own scope to build, and must exist before this story's AC6 can be verified end-to-end. **2026-08-05: that endpoint now has its own story, Story 5.11** (`docs/user-stories/epic-5-security-isolation-and-messaging.md`, Epic 5, Ready, not yet built) \u2014 sourced from ADR-0036 \u00a75 directly, no new ADR. This story's own dependency is unchanged: still blocked in practice until Story 5.11 is actually built, not merely drafted. **2026-08-05, later the same day: Story 5.11 is now built** (`contracts/epic-5/story-5.11.get-v1-me.contract.test.ts`, `docs/implementation-log.md`) \u2014 this story's AC6 dependency is satisfied.",
    "isBuilt": true,
    "builtInfo": "2026-08-04 \u2014 social-listening-admin@c643553"
  },
  {
    "storyId": "6.2",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Role-gated routing shell (Tenant-Admin/Tenant User vs. Platform Admin)",
    "source": "ADR-0035 (governing structural constraint, cited per that ADR's own recommendation) and ADR-0036 \u00a74",
    "status": "Ready \u2014 both governing ADRs are now Accepted (ADR-0035; ADR-0036 as of 2026-08-04) \u2014 practically sequenced immediately after Story 6.1, which it cannot be built without.",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "6.3",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Connector connect/disconnect flow",
    "source": "Phase 1 \"also build, not storied\" (`docs/implementation-plan.md`), against Story 1.7's real REST surface (ADR-0034) and ADR-0027's disclosure requirement",
    "status": "Ready \u2014 practically sequenced after Stories 6.1/6.2.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "6.4",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Watchlist management screen, real rework against ADR-0044's ownership/PATCH/locking contract",
    "source": "Phase 1 \"also build, not storied\" (`docs/implementation-plan.md`), against Story 1.5's real REST surface (as reworked 2026-08-12 by ADR-0044)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-12 \u2014 social-listening-admin@fded97b"
  },
  {
    "storyId": "6.5",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Connector status view, real rework (fixture data replaced with the real endpoint)",
    "source": "Phase 1 \"also build, not storied\" (`docs/implementation-plan.md`), against Story 4.3's derived `ConnectorHealth`",
    "status": "Built (real rework, 2026-08-12), with a named, real backend gap (unchanged, see below) \u2014 previously marked \"Built\" in error on 2026-08-05; see the rework note below for the fix and this line for the real build.",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "6.6",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "relocated to Epic 7 (Platform Admin UI)",
    "source": "",
    "status": "",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "6.7",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Self-service sign-up: new user becomes first Tenant-Admin of a new tenant",
    "source": "ADR-0037 (Accepted 2026-08-04)",
    "status": "Ready \u2014 ADR-0037 accepted 2026-08-04 (\"ADR 0037 is approved as well\"), together with three direct instructions folded into the ADR's new \u00a78 (email-verification precondition; a Tenant-Admin-facing \"Same-Domain Invite Assist\" proposal on domain-match rejection; a Platform-Admin-visible escalation signal for repeated attempts). Also has two real cross-repo prerequisites, neither of which exists today: (1) a new `POST /v1/tenants/self-service-signup`-shaped `social-listening-core` endpoint (ADR-0037's own \"Named as required, not designed here\" section) that accepts a validated-but-otherwise-unmatched Entra bearer token and provisions a tenant plus its first Tenant-Admin atomically; (2) `GET /v1/me` (ADR-0036 \u00a75, built 2026-08-05 as Story 5.11 \u2014 see Story 6.1's own updated Status line above), needed after a successful sign-up to hydrate the admin UI's session with the caller's newly-resolved `tenant_admin` identity, exactly the way Story 6.1 already depends on it for ordinary sign-in. **Also practically sequenced after Story 6.1** \u2014 this story reuses Story 6.1's own BFF session mechanism (server-side session cookie, `core-client.ts`'s single bearer-attachment choke point) rather than inventing a second one; it does not exist as a standalone screen outside that session shape.",
    "isBuilt": true,
    "builtInfo": "2026-08-09 \u2014 social-listening-admin@2b44637"
  },
  {
    "storyId": "6.8",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Tenant-Admin: user invitation and management screen",
    "source": "Phase 1/Phase 3 \"also build, not storied\" (`docs/implementation-plan.md`), against Story 1.9's real REST surface",
    "status": "Built 2026-08-10 \u2014 no new ADR needed, Story 1.5/6.3/6.4's own precedent for ordinary CRUD/UI surface against an already-real REST surface. Practically sequenced after Stories 1.9 and 6.2 (role-gating) both existing.",
    "isBuilt": true,
    "builtInfo": "2026-08-10 \u2014 social-listening-admin@6b7fc00 (backfilled 2026-08-17, per the Built convention's forward-only rule, while touching this story again \u2014 the field records the original build commit only, per its own fixed two-shape format; this screen has since been extended multiple times, most recently a 2026-08-17 visual redesign \u2014 see `docs/implementation-log.md` for the full commit history, not this single field)"
  },
  {
    "storyId": "6.9",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Tenant settings screen",
    "source": "Phase 1/Phase 3 \"also build, not storied\" (`docs/implementation-plan.md`), against Story 1.8's real REST surface",
    "status": "Ready \u2014 no new ADR needed, Story 1.5/6.3/6.4's own precedent. Practically sequenced after Story 1.8 exists.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "6.10",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Same-Domain Invite Assist view (Tenant-Admin dashboard)",
    "source": "ADR-0037 \u00a78b (Accepted), against Story 5.16's real REST surface",
    "status": "Ready \u2014 no new ADR needed, ADR-0037 \u00a78b already exhaustively decided the mechanism this screen surfaces; only the screen itself is undesigned. Practically sequenced after Story 5.16 exists.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "6.11",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Post feed (browse ingested posts)",
    "source": "Phase 1/Phase 3 \"also build, not storied\" (`docs/implementation-plan.md`), against Story 3.4's real `GET /v1/posts` REST surface (ADR-0011 cursor pagination) and Story 5.1's `GET /v1/posts/:id` (ADR-0012)",
    "status": "Built (2026-08-12) \u2014 see the dated note below.",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "6.12",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Tenant-owned-feed connector setup UI",
    "source": "ADR-0050 (Accepted)",
    "status": "Ready \u2014 no new ADR needed, ADR-0050 already fully specifies the connect/verify flow; same precedent Story 6.3 used for the original connect/disconnect screen against ADR-0034's REST surface.",
    "isBuilt": true,
    "builtInfo": "2026-08-13 \u2014 social-listening-admin@e1e9913"
  },
  {
    "storyId": "6.13",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Self-service tenant deletion/offboarding UI",
    "source": "ADR-0043 (Accepted)",
    "status": "Ready \u2014 no new ADR needed, ADR-0043 already fully specifies the request/export/grace-period/cancel/confirm flow; same \"ordinary CRUD/UI surface against an already-real REST surface\" precedent as Story 6.3.",
    "isBuilt": true,
    "builtInfo": "2026-08-13 \u2014 social-listening-admin@500a4b9"
  },
  {
    "storyId": "6.14",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Access-history view (extends Story 6.8's user management screen)",
    "source": "ADR-0032 \u00a79 (Accepted), against Story 5.17's real REST surface",
    "status": "Built 2026-08-17 \u2014 no new ADR needed. Already named as a real, deliberate gap in Story 6.8's own text (\"a natural companion, not required by this story's own Acceptance Criteria to ship in the same pass\") and its own 2026-08-10 build note (\"remains unbuilt, per this story's own named scope limit\") \u2014 this story closes that named gap, it doesn't discover a new one.",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-admin@a27aa10"
  },
  {
    "storyId": "6.15",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Activate/deactivate controls on the connectors and connector-status screens",
    "source": "ADR-0051 (Accepted 2026-08-12)",
    "status": "Ready \u2014 no new ADR needed, the same \"ordinary UI/CRUD surface\" category Stories 6.3/6.4/6.5 already established. Depends on Story 1.11 (`POST .../activate|deactivate`, built) and **Story 1.12** (`GET /v1/connectors/:platformId` returning real `isActive`, Ready but not yet built as of this drafting) \u2014 this story cannot correctly render current activation state on page load until Story 1.12 ships; it can be built and its own contract written against Story 1.12's not-yet-existing field in the meantime, the same \"contract written, implementation waits on a named dependency\" sequencing Story 1.9 already used for Story 5.17.",
    "isBuilt": true,
    "builtInfo": "2026-08-12 \u2014 social-listening-admin@cc7cae2"
  },
  {
    "storyId": "6.16",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Manual \"run enrichment now\" button on the post detail screen",
    "source": "Story 6.11's own post detail screen, against Story 2.8/2.9's already-built `enrichPost()`",
    "status": "Ready \u2014 no new ADR needed, exposes an already-real internal function over a new REST endpoint, the same \"ordinary CRUD-adjacent surface, no new architectural decision\" category `GET /v1/me` and Story 1.12 already established.",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "6.19",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Render the post detail body as real, formatted Markdown",
    "source": "Story 3.10/ADR-0053's already-built `body_markdown` field, against Story 6.11's own post detail screen",
    "status": "Ready \u2014 no new ADR needed, exposes an already-real, already-populated column over REST (`SocialPostSummary`/`SocialPostFull`, unmodified queries widened, not a new endpoint), the same \"ordinary CRUD-adjacent surface, no new architectural decision\" category Story 6.16 already established for this exact pair of screens.",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-admin@4f099a6 (core half: social-listening-core@aa4f317)"
  },
  {
    "storyId": "6.17",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Tenant-wide activate/deactivate control on the tenant-owned-feed connector screen",
    "source": "ADR-0051 (Accepted 2026-08-12), extending Story 6.15's own already-built wiring pattern to a screen Story 6.15 never covered",
    "status": "Ready \u2014 no new ADR needed. This is not a new architectural decision: ADR-0051 already fully decided the two-table, ownership-scoped activation mechanism and its REST surface; ADR-0028/ADR-0034 already decided the `tenant_admin`-only authorization split for the tenant-wide scope. This story wires an already-decided, already-built, already-generic backend mechanism onto one more screen \u2014 the identical \"expose/wire an already-decided policy over REST, no new decision\" category Story 6.16's own text used to justify skipping a new ADR for `POST /v1/posts/:id/enrich`, and the category Story 6.15 itself already established for wiring the same mechanism onto the Story 6.3/6.5 screens.",
    "isBuilt": true,
    "builtInfo": "2026-08-13 \u2014 social-listening-admin@d0eb088"
  },
  {
    "storyId": "6.18",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Post feed search/filter operates over all matched posts, not just the current page",
    "source": "ADR-0011 (cursor pagination, Accepted) \u2014 no new ADR needed; `GET /v1/posts` itself is unchanged, this is purely a client-side data-fetching pattern change, the same \"page through everything client-side, no new backend endpoint\" shape ADR-0054 Decision \u00a73 already established for the Analytics Dashboard (Story 8.1's `fetchAnalyticsSummary.ts`)",
    "status": "Built 2026-08-17",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-admin@a97cf30"
  },
  {
    "storyId": "6.20",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Multi-feed administration for the tenant-owned-feed connector (list, edit, remove)",
    "source": "[ADR-0057](../adr/0057-tenant-owned-feed-multi-feed-administration.md), Accepted 2026-08-17 \u2014 resolves ADR-0050's own Open Question 2, left open since that ADR's 2026-08-11 acceptance",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-admin@be1764d (core half: social-listening-core@e9d797f)"
  },
  {
    "storyId": "6.21",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Expose the Wikipedia connector in the Tenant Admin UI",
    "source": "Story 2.13's own real, generic `POST/DELETE /v1/connectors/:platformId/activate|deactivate` surface (ADR-0051), against a connector that already exists (`wikipedia`, `authMode: 'none'`)",
    "status": "Built 2026-08-18",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-admin@21c30bf \u2014 no new ADR needed, the same \"ordinary UI/CRUD surface, exposes an already-built, already-generic mechanism\" category Stories 6.15/6.16/6.18/6.19/6.20 already established."
  },
  {
    "storyId": "6.22",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Add Wikipedia to the watchlist screen's platform-source list",
    "source": "Story 2.13's own real, generic `SocialConnector` (`wikipedia`, `authMode: 'none'`)",
    "status": "Built 2026-08-18",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-admin@8182706 \u2014 no new ADR needed, the same \"ordinary UI/CRUD surface, exposes an already-built, already-generic mechanism\" category Story 6.21 already established for this exact connector on a different screen."
  },
  {
    "storyId": "6.23",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Facebook connector: OAuth connect flow with Page selection",
    "source": "ADR-0059 (Accepted 2026-08-18), against Story 2.15's real backend surface",
    "status": "Ready, with the same precondition Story 2.15 itself carries, inherited rather than repeated in full: this story's own OAuth flow and Page picker can be built and proven against a Menno-administered test Page under Meta's Standard Access (no App Review needed for that degenerate case, per ADR-0059 Decision \u00a73) \u2014 onboarding any real, unaffiliated tenant's Page still requires SocialEngage's own Meta App to separately clear Business Verification and App Review first. Not blocked on Story 2.15 being fully built first \u2014 both can be developed in parallel against the same ADR, but this story's own end-to-end proof needs Story 2.15's OAuth exchange/token storage to exist.",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-admin@535338f"
  },
  {
    "storyId": "6.24",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Connector status screen groups Connectors and AI Providers into separate sections, with honest AI-provider metrics",
    "source": "No new ADR needed \u2014 resolves `connector-status-view/SKILL.md`'s own already-named \"Known gaps\" entry from 2026-08-12 (\"a real UX mismatch, deliberately left unaddressed for now... options considered, not decided: reword the copy for AI providers specifically, or give them real success/failure tracking\"), the same \"resolve an already-named, deliberately-deferred gap directly\" category Story 2.14/6.22 already established for ADR-level open items, applied here to a SKILL.md-documented one instead. **Status:** Ready.",
    "status": "Ready.",
    "isBuilt": true,
    "builtInfo": "2026-08-19 \u2014 social-listening-admin@5d76e44"
  },
  {
    "storyId": "6.25",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Post feed shows most-recently-ingested posts first",
    "source": "No new ADR needed \u2014 a display-order fix over data ADR-0011's already-Accepted cursor pagination already provides in full; no change to the pagination mechanism itself. **Status:** Built 2026-08-18.",
    "status": "Built 2026-08-18.",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-admin@6550716"
  },
  {
    "storyId": "6.26",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Post feed's Provider filter derives its options from real data, not a hardcoded list",
    "source": "No new ADR needed \u2014 an ordinary CRUD/UI-surface fix, the same category Story 6.21/6.22 already established for the identical bug on two other screens. **Status:** Built 2026-08-18.",
    "status": "Built 2026-08-18.",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-admin@03c37c9"
  },
  {
    "storyId": "6.27",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Facebook: support connecting more than one Page per user",
    "source": "ADR-0060 (Accepted 2026-08-18)",
    "status": "Ready.",
    "isBuilt": true,
    "builtInfo": "2026-08-18 \u2014 social-listening-admin@b58b323 (core half: social-listening-core@b58b323)"
  },
  {
    "storyId": "6.29",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Connector Ingestion Status Badges, Stalled Alerts Banner, and On-Demand Re-sync Action",
    "source": "ADR-0070 (Accepted 2026-08-20)",
    "status": "Built 2026-08-20",
    "isBuilt": true,
    "builtInfo": "2026-08-20 (`social-listening-admin`)"
  },
  {
    "storyId": "6.30",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Brave Search API Connector Setup, Activation, and Status Screen",
    "source": "ADR-0065 (Accepted 2026-08-20)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-21 \u2014 social-listening-admin@dedfb6b"
  },
  {
    "storyId": "6.31",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Human-in-the-Loop Post Enrichment Cascading Edit Drawer",
    "source": "ADR-0071 (Accepted 2026-08-20)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "6.32",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Bing Search API (Azure) Connector Setup, Activation, and Status Screen",
    "source": "ADR-0066 (Accepted 2026-08-20)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "6.33",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Facebook connector: Display hosting Page attribution and author distinction in Post Feed and Details Drawer",
    "source": "ADR-0067 (Accepted 2026-08-20)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "6.34",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Instagram Business Connector Setup, Multi-Account Picker, and Post Feed/Drawer Presentation",
    "source": "ADR-0068 (Accepted 2026-08-20)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "6.35",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "LinkedIn Connector Setup Screen, Scope Degradation Badge, and Post Feed/Drawer Presentation",
    "source": "ADR-0069 (Accepted 2026-08-20)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "6.36",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Cross-Platform Polypost Composer & Multi-Network Preview Engine",
    "source": "ADR-0072 (Accepted 2026-08-22)",
    "status": "Built 2026-08-22",
    "isBuilt": true,
    "builtInfo": "2026-08-22 \u2014 social-listening-admin@f459114"
  },
  {
    "storyId": "6.37",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Post Feed and Post Detail Facebook Page & Matched Watchlist Attribution",
    "source": "ADR-0067 (Accepted 2026-08-20; amended 2026-08-22)",
    "status": "Built 2026-08-22",
    "isBuilt": true,
    "builtInfo": "2026-08-22 \u2014 social-listening-admin@b40041f (core half: social-listening-core@b40041f)"
  },
  {
    "storyId": "6.38",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Post Detail Reply Action, Composer Drawer, and Replies Tab",
    "source": "ADR-0073 (Accepted 2026-08-22)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "6.39",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Polypost Composer Real Publish Flow",
    "source": "ADR-0075 (Accepted 2026-08-23)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "6.40",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Tenant settings screen: styled workspace profile, export actions, and offboarding link",
    "source": "ADR-0074 (Accepted 2026-08-23)",
    "status": "Ready \u2014 depends on Story 3.16 (backend endpoints)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "6.41",
    "epicId": "Epic 6",
    "epicTitle": "Epic 6: Tenant Admin UI",
    "title": "Composer Deep Research panel UI",
    "source": "ADR-0076 (Accepted 2026-08-23)",
    "status": "Ready \u2014 depends on Story 3.17",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "6.6",
    "epicId": "Epic 7",
    "epicTitle": "Epic 7: Platform Admin UI",
    "title": "Platform Admin console (Phase 3 \"beyond the Phase 1 minimum\")",
    "source": "ADR-0030 (Admin-tier design), ADR-0031 (`tenants` table shape), ADR-0035 (structural constraint) \u2014 all Accepted. **A real, substantial, previously-unnamed backend gap this story depends on:** confirmed directly against `.claude/skills/tenants/SKILL.md` (\"No HTTP/REST surface exists for `tenants` yet... a future Admin UI story would add `POST/GET/PATCH` routes calling into `tenantStore.ts`\") and `.claude/skills/platform-admin-access/SKILL.md` (break-glass request/execute and the audit log are store/mechanism-level only, Stories 5.7/5.8, with no HTTP surface either). **This story cannot be built against `social-listening-core` as it exists today** \u2014 every screen below needs a corresponding core REST endpoint that does not yet exist.",
    "status": "Built (real rework, 2026-08-12) \u2014 see the correction below for the fix and the Built note further down for the real build.",
    "isBuilt": true,
    "builtInfo": ""
  },
  {
    "storyId": "8.1",
    "epicId": "Epic 8",
    "epicTitle": "Epic 8: Analytics Dashboard",
    "title": "Analytics dashboard shell, global date-range filter, Overview tab, Sources tab",
    "source": "ADR-0054 (Accepted 2026-08-17)",
    "status": "Ready \u2014 ADR-0054 accepted 2026-08-17, via a structured approval decision in the orchestrating session (\"Approve as summarized\" \u2014 see ADR-0054's own Acceptance note), accepted as drafted, no revisions.",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-admin@5558e11"
  },
  {
    "storyId": "8.2",
    "epicId": "Epic 8",
    "epicTitle": "Epic 8: Analytics Dashboard",
    "title": "Sentiment tab",
    "source": "ADR-0054 (Accepted 2026-08-17)",
    "status": "Ready \u2014 ADR-0054 accepted 2026-08-17 (see ADR-0054's own Acceptance note). Practically sequenced after Story 8.1 (tab shell, date-range wiring, and the paginated fetch-and-aggregate loop this story reuses).",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-admin@a54bf05"
  },
  {
    "storyId": "8.3",
    "epicId": "Epic 8",
    "epicTitle": "Epic 8: Analytics Dashboard",
    "title": "Conversations tab",
    "source": "ADR-0054 (Accepted 2026-08-17)",
    "status": "Ready \u2014 ADR-0054 accepted 2026-08-17 (see ADR-0054's own Acceptance note). Practically sequenced after Story 8.1 (tab shell, date-range wiring, and the paginated fetch-and-aggregate loop this story reuses).",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-admin@5fed9dd"
  },
  {
    "storyId": "8.4",
    "epicId": "Epic 8",
    "epicTitle": "Epic 8: Analytics Dashboard",
    "title": "Overview enrichment: volume chart, sentiment donut, period-over-period comparison",
    "source": "ADR-0054 (Accepted 2026-08-17) \u2014 no new ADR needed; both pieces below stay inside Decision \u00a72's already-accepted Overview scope (\"reusing the same computed aggregates... not a novel widget of its own\") and Decision \u00a73's data-source strategy (100% client-side, zero new backend surface)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-admin@ae015e0"
  },
  {
    "storyId": "8.5",
    "epicId": "Epic 8",
    "epicTitle": "Epic 8: Analytics Dashboard",
    "title": "Languages breakdown widget",
    "source": "ADR-0055 (Accepted 2026-08-17)",
    "status": "Ready \u2014 ADR-0055 accepted 2026-08-17, via a structured approval decision in the orchestrating session (Menno: \"yes please extend the language field\" \u2014 see ADR-0055's own Acceptance note), accepted as drafted, no revisions.",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-admin@8b8bb14"
  },
  {
    "storyId": "8.6",
    "epicId": "Epic 8",
    "epicTitle": "Epic 8: Analytics Dashboard",
    "title": "Sources tab enrichment: per-source sentiment score, per-source volume-over-time",
    "source": "ADR-0054 (Accepted 2026-08-17) \u2014 no new ADR needed; stays inside Decision \u00a72's already-accepted Sources scope (\"post-volume and sentiment breakdown per real `providerId`\") and Decision \u00a73's data-source strategy (100% client-side, zero new backend surface)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "2026-08-17 \u2014 social-listening-admin@a17af3f"
  },
  {
    "storyId": "8.7",
    "epicId": "Epic 8",
    "epicTitle": "Epic 8: Analytics Dashboard",
    "title": "Overview Tab Enhancement: 3-column grid, 7-dimension filter model, statistical volume forecast, filter chips, deep-link share state",
    "source": "ADR-0062 (Accepted 2026-08-19)",
    "status": "Built 2026-08-19 \u2014 full accumulated `social-listening-admin` suite green (38/38 suites, 577/577 tests) after fixing two real, ADR-authorized cross-story regressions in Story 8.1's and Story 8.4's own contracts (see each story's own dated note).",
    "isBuilt": true,
    "builtInfo": "2026-08-19 \u2014 social-listening-admin@7698563"
  },
  {
    "storyId": "8.8",
    "epicId": "Epic 8",
    "epicTitle": "Epic 8: Analytics Dashboard",
    "title": "AI Spike Storyteller: `POST /v1/posts/explain-spike` endpoint + frontend widget",
    "source": "ADR-0062 (Accepted 2026-08-19)",
    "status": "Ready",
    "isBuilt": false,
    "builtInfo": ""
  },
  {
    "storyId": "8.9",
    "epicId": "Epic 8",
    "epicTitle": "Epic 8: Analytics Dashboard",
    "title": "`selectedTopic` watchlist filter and Watchlist Coverage widget",
    "source": "ADR-0063 (Accepted 2026-08-19)",
    "status": "Built 2026-08-20",
    "isBuilt": true,
    "builtInfo": "2026-08-20 \u2014 social-listening-admin@605e5a4"
  },
  {
    "storyId": "8.10",
    "epicId": "Epic 8",
    "epicTitle": "Epic 8: Analytics Dashboard",
    "title": "Location & Geospatial Insights: Country aggregation, Top Countries widget, and SVG Choropleth Map",
    "source": "ADR-0064 (Accepted 2026-08-20)",
    "status": "Built 2026-08-20",
    "isBuilt": true,
    "builtInfo": "2026-08-20 \u2014 social-listening-admin@75a0a4a"
  },
  {
    "storyId": "9.1",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "Watchlist connector count and preview volume endpoint",
    "source": "ADR-0077 (Accepted 2026-08-23)",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "9.2",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "Metric explainability endpoint",
    "source": "ADR-0078",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "9.3",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "Crisis template bundle and activation (backend)",
    "source": "ADR-0079",
    "status": "Ready",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "9.4",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "Crisis threshold wizard (frontend)",
    "source": "ADR-0079",
    "status": "Ready (depends on Story 9.3)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "9.5",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "Onboarding checklist state (backend)",
    "source": "ADR-0080",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "9.6",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "Onboarding checklist UI (frontend)",
    "source": "ADR-0080",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 9.5)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "9.7",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "RAGConnector provider abstraction (backend)",
    "source": "ADR-0081",
    "status": "Blocked \u2014 pending ADR acceptance",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "9.8",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "RAG post chunking and embedding pipeline (backend)",
    "source": "ADR-0082",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 9.7)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "9.9",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "RAG vector-store RLS and metadata (backend)",
    "source": "ADR-0083",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 9.7)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "9.10",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "RAG search and ask endpoint (backend)",
    "source": "ADR-0084",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 9.8 and 9.9)",
    "isBuilt": true,
    "builtInfo": "not yet"
  },
  {
    "storyId": "9.11",
    "epicId": "Epic 9",
    "epicTitle": "Epic 9: v1.5 feature implementations (ADRs 0077\u20130085)",
    "title": "RAG UI/UX and loading patterns (frontend)",
    "source": "ADR-0085",
    "status": "Blocked \u2014 pending ADR acceptance (depends on Story 9.10)",
    "isBuilt": true,
    "builtInfo": "not yet"
  }
];
