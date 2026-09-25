# Technical Design Specifications (TDS)

This directory contains feature-level **Technical Design Specifications (TDS)** for SocialEngage.

## The Specification Path

```
ADR (Architecture Decisions & Invariants)
  │
  ▼
BRD (Business Requirements & Rules)
  │
  ▼
FDD (Functional Design & Workflows)
  │
  ▼
TDS (Technical Design & Interface Contracts) ◄── [You Are Here]
  │
  ▼
User Story (Acceptance Criteria & Scenarios)
  │
  ▼
Contract Test (Executable Red/Green Validation)
```

## Template & Governance

- Use [`docs/templates/technical-design-specification-template.md`](../../templates/technical-design-specification-template.md) or [`docs/project docs/TDS-template.md`](../TDS-template.md) when drafting a new TDS.
- **Naming convention:** `TDS-XXXX-<Feature-Slug>.md` where `XXXX` matches the governing ADR number (e.g. `TDS-0118-Additional-Social-Platform-Publishing.md`).
- **Hierarchy Rule:** $\text{ADR} > \text{BRD/FDD} > \text{TDS} > \text{User Story}$.

## Required Technical Design Categories

Every TDS document must address:
1. **Document Control & Traceability Linkage** (ADR, BRD, FDD, User Story, Epic mapping)
2. **System Context & Topology** (Mermaid architecture diagram, boundary invariants)
3. **Data Architecture & Persistence Design** (PostgreSQL DDL, RLS policies, indexing matrix, data retention, caching)
4. **API, Interface & Contract Design** (REST routes, BFF proxies, Service Bus events, TypeScript types)
5. **Rate Limiting & Concurrency Gating** (`RequestGate` key format, window/rate, TTL, depth ceiling)
6. **Security, Identity & Credential Governance** (Credential tiering Tier 1/2/3, envelope encryption, RBAC matrix)
7. **Error Handling & Failure Classification** (`ClassifiableError`, `ErrorKind` mappings, circuit breaker)
8. **Testing & Contract Gate Plan** (Jest contract specs, AC mapping table, template DB isolation)
9. **Component Skill (`SKILL.md`) Documentation Updates** (Load-bearing invariants, extension points)
10. **Observability, Metrics & Telemetry** (Platform metrics counters/dimensions, structured logging)
11. **Migration, Rollout & Feature Gating** (Zero-downtime phases, feature flags, rollback procedure)
12. **Technical Assumptions, Dependencies & Open Questions** (Formal `[Q-XXXX-N]` syntax)

---

## Technical Design Specification Batch Roadmap

To catch up on the ~140 ADRs systematically without dropping architectural rigor or hallucinating specifications, the corpus is partitioned into 8 thematic execution batches:

| Batch | Scope & Domain | ADRs Covered | Governing Epics | Status |
|---|---|---|---|---|
| **Batch 1** | **Core Foundation & Tenant Isolation** | ADRs 0001–0003, 0014–0016, 0025, 0027–0033 | Epic 1, Epic 5 | **Complete (14/14 TDS)** |
| **Batch 2** | **Ingestion Pipeline & Connector Architecture** | ADRs 0005, 0006, 0009, 0010, 0020, 0023, 0024, 0026, 0034, 0042, 0048, 0050–0052, 0057–0061, 0067–0070 | Epic 1, Epic 2, Epic 5, Epic 6 | **Complete (23/23 TDS)** |
| **Batch 3** | **Data Architecture, Storage, Retention & Exports** | ADRs 0004, 0011, 0017–0019, 0039, 0044, 0049, 0053, 0063, 0074, 0090, 0111, 0124 | Epic 3, Epic 10 | **Complete (14/14 TDS)** |
| **Batch 4** | **Analytics, Metric Explainability & Dashboards** | ADRs 0007, 0008, 0022, 0054–0056, 0062, 0064, 0087, 0088, 0097, 0105, 0113, 0114, 0116, 0128, 0132, 0133, 0135, 0141 | Epic 4, Epic 8, Epic 10, Epic 11, Epic 12, Epic 13, Epic 16, Epic 17, Epic 18 | **Complete (20/20 TDS)** |
| **Batch 5** | **Identity, Security, Admin Console & Compliance** | ADRs 0030, 0035–0037, 0040, 0041, 0043, 0091–0094, 0107, 0112, 0123, 0125–0127 | Epic 5, Epic 6, Epic 7, Epic 10, Epic 12, Epic 13, Epic 15, Epic 16 | **Complete (16/16 TDS)** |
| **Batch 6** | **AI Enrichment, Search Sourcing & RAG Architecture** | ADRs 0038, 0065, 0066, 0076, 0081–0085, 0103, 0104, 0120, 0121, 0136–0140 | Epic 2, Epic 3, Epic 6, Epic 9, Epic 12, Epic 14, Epic 19 | **Complete (18/18 TDS)** |
| **Batch 7** | **Outbound Publishing, Polypost Composer & Social Care** | ADRs 0071–0073, 0075, 0086, 0095, 0098–0100, 0108, 0110, 0115, 0117–0119, 0129, 0131 | Epic 2, Epic 3, Epic 6, Epic 10, Epic 11, Epic 12, Epic 13, Epic 14, Epic 17 | **Complete (17/17 TDS)** |
| **Batch 8** | **Advanced Telemetry & Continuous Self-Learning** | ADRs 0077–0080, 0089, 0096, 0101, 0102, 0106, 0122, 0130, 0134 | Epic 9, Epic 10, Epic 11, Epic 12, Epic 14, Epic 17, Epic 18 | **Complete (12/12 TDS)** |

---

## Batch 1: Core Foundation & Tenant Isolation (Completed Specifications)

| TDS ID | Feature / Title | Governing ADR | User Story | Contract Test |
|---|---|---|---|---|
| [`TDS-0001`](TDS-0001-Two-Repository-Split.md) | Two-Repository Split & REST API Boundary | ADR-0001 | Story 1.1 | `story-1.1.repo-scaffold.contract.test.ts` |
| [`TDS-0002`](TDS-0002-Unified-Provider-Connector-Pattern.md) | Unified Provider Connector Pattern | ADR-0002 | Story 1.2 | `story-1.2.provider-connector-contract.contract.test.ts` |
| [`TDS-0003`](TDS-0003-Per-Tenant-Per-Provider-Rate-Limiting.md) | Per-Tenant Per-Provider Rate Limiting (`RequestGate`) | ADR-0003 | Story 1.3 | `story-1.3.per-tenant-rate-limiting.contract.test.ts` |
| [`TDS-0014`](TDS-0014-Credential-Storage-Envelope-Encryption-OAuth-First.md) | Credential Storage Envelope Encryption & OAuth-First | ADR-0014 | Story 1.7 | `story-1.7.credential-storage.contract.test.ts` |
| [`TDS-0015`](TDS-0015-Tenant-Isolation-Via-Postgres-Row-Level-Security.md) | Tenant Isolation via Postgres Row-Level Security | ADR-0015 | Story 5.4 | `story-5.4.tenant-isolation-rls.contract.test.ts` |
| [`TDS-0016`](TDS-0016-Postgres-As-Database-Engine.md) | Postgres as Database Engine & Health Probing | ADR-0016 | Story 1.10 | `story-1.10.postgres-readiness-and-health.contract.test.ts` |
| [`TDS-0025`](TDS-0025-Persistent-Local-Dev-Database-Separate-From-Test-Database.md) | Persistent Local Dev DB Separate from Test DB | ADR-0025 | Story 1.4 | `story-1.4.persistent-local-dev-database.contract.test.ts` |
| [`TDS-0027`](TDS-0027-Connector-Is-Technical-Intermediary-Not-Contracting-Party.md) | Connector as Technical Intermediary, Not Contracting Party | ADR-0027 | Category 1 No-Story | `story-1.7.connector-crud.contract.test.ts` |
| [`TDS-0028`](TDS-0028-Credential-Creation-Authority-Scoped-By-Ownership-Tier.md) | Credential Creation Authority Scoped by Ownership Tier | ADR-0028 | Story 1.7 (ADR-0034) | `story-1.7.connector-crud.contract.test.ts` |
| [`TDS-0029`](TDS-0029-Authentication-Mechanism-Entra-External-ID.md) | Authentication Mechanism: Entra External ID (OIDC) | ADR-0029 | Story 5.6 | `story-5.6.entra-external-id-auth.contract.test.ts` |
| [`TDS-0030`](TDS-0030-Admin-Tier-Design-Platform-Admin-RLS-Exception.md) | Admin-Tier Design: Platform Admin BYPASSRLS & Break-Glass | ADR-0030 | Story 5.7 | `story-5.7.platform-admin-rls-bypass.contract.test.ts` |
| [`TDS-0031`](TDS-0031-Tenants-Table-Shape.md) | `tenants` Table Shape & Self-Referential RLS | ADR-0031 | Story 5.8 | `story-5.8.tenants-table-shape.contract.test.ts` |
| [`TDS-0032`](TDS-0032-Users-Table-Shape-And-RLS.md) | `users` Table Shape, RLS & Request Identity Resolution | ADR-0032 | Story 5.9 | `story-5.9.users-table-shape-and-rls.contract.test.ts` |
| [`TDS-0033`](TDS-0033-Retire-X-Tenant-Id-Header-Placeholder.md) | Retire `X-Tenant-Id` in Favor of Bearer Auth | ADR-0033 | Story 5.10 | `story-5.10.retire-x-tenant-id-header.contract.test.ts` |

---

## Batch 2: Ingestion Pipeline & Connector Architecture (Completed Specifications)

| TDS ID | Feature / Title | Governing ADR | User Story | Contract Test |
|---|---|---|---|---|
| [`TDS-0005`](TDS-0005-Ingestion-Run-As-Audit-Anchor.md) | `IngestionRun` as Audit Anchor for Post Ingestion | ADR-0005 | Story 2.1 | `story-2.1.ingestion-run-anchor.contract.test.ts` |
| [`TDS-0006`](TDS-0006-Watchlist-Matching-Connector-Side-With-Fallback.md) | Watchlist Matching Connector-Side with Fallback | ADR-0006 | Story 2.2 | `story-2.2.watchlist-matching.contract.test.ts` |
| [`TDS-0009`](TDS-0009-Connector-Health-Derived-Not-Stored.md) | Connector Health Derived Not Stored | ADR-0009 | Story 4.3 | `story-4.3.connector-health-derived.contract.test.ts` |
| [`TDS-0010`](TDS-0010-Error-Handling-And-Auto-Disable-Policy.md) | Error Handling & Auto-Disable Policy | ADR-0010 | Story 2.3 | `story-2.3.error-handling-and-auto-disable.contract.test.ts` |
| [`TDS-0020`](TDS-0020-Rate-Limit-Queue-Bounds-And-Distributed-Gate-State.md) | Rate Limit Queue Bounds & Distributed Gate State | ADR-0020 | Story 2.4 | `story-2.4.rate-limit-queue-bounds.contract.test.ts` |
| [`TDS-0023`](TDS-0023-Proportional-Connector-Failure-Threshold.md) | Proportional Connector Failure Threshold & Circuit Breaker | ADR-0023 | Story 2.5 | `story-2.5.proportional-failure-threshold.contract.test.ts` |
| [`TDS-0024`](TDS-0024-Newswire-Connector-Direct-Wire-RSS-Issuer-As-Author.md) | Newswire Connector: Direct Wire RSS with Issuer-as-Author | ADR-0024 | Story 2.6 | `story-2.6.newswire-connector.contract.test.ts` |
| [`TDS-0026`](TDS-0026-RSS-News-Connector-GNews-API-Publication-As-Author.md) | RSS/News Connector: GNews API with Publication-as-Author | ADR-0026 | Story 2.7 | `story-2.7.gnews-connector.contract.test.ts` |
| [`TDS-0034`](TDS-0034-Connector-Connect-Disconnect-CRUD-Ownership-Tier-Aware.md) | Connector Connect/Disconnect CRUD Ownership-Tier-Aware | ADR-0034 | Story 1.7 | `story-1.7.ownership-tier-connect-disconnect.contract.test.ts` |
| [`TDS-0042`](TDS-0042-Wikipedia-Connector-MediaWiki-API-Article-As-Author.md) | Wikipedia Connector: MediaWiki API Article-as-Author | ADR-0042 | Story 2.8 | `story-2.8.wikipedia-connector.contract.test.ts` |
| [`TDS-0048`](TDS-0048-No-Core-Pipeline-Change-Verification-For-New-Connector-Registration.md) | No Core Pipeline Change Verification for New Connector Registration | ADR-0048 | Story 2.10 | `story-2.10.connector-registration-transparency.contract.test.ts` |
| [`TDS-0050`](TDS-0050-Tenant-Owned-Domain-RSS-Content-Feed-Connector.md) | Tenant-Owned-Domain RSS Content-Feed Connector with DNS TXT Verification | ADR-0050 | Story 2.11 | `story-2.11.tenant-owned-feed-connector.contract.test.ts` |
| [`TDS-0051`](TDS-0051-Connector-Activation-Decoupled-From-Credential.md) | Connector Activation Decoupled from Credential Storage | ADR-0051 | Story 1.11 / 1.12 | `story-1.11.connector-activation.contract.test.ts` |
| [`TDS-0052`](TDS-0052-Live-Ingestion-Polling-Scheduler.md) | Live Ingestion Polling Scheduler & In-Flight Guards | ADR-0052 | Story 1.13 / 1.14 | `story-1.13.live-ingestion-polling-scheduler.contract.test.ts` |
| [`TDS-0057`](TDS-0057-Tenant-Owned-Feed-Multi-Feed-Administration.md) | Multi-Feed Administration for Tenant-Owned-Feed Connector | ADR-0057 | Story 6.20 | `story-6.20.tenant-owned-feed-multi-feed-administration.contract.test.ts` |
| [`TDS-0058`](TDS-0058-Wire-Ingestion-Events-Into-Real-Connector-Pipeline.md) | Wire Ingestion Events into Real Connector Pipeline | ADR-0058 | Story 5.19 | `story-5.19.wire-ingestion-events.contract.test.ts` |
| [`TDS-0059`](TDS-0059-Facebook-Connector-Tenant-Owned-Page-Scope-Organization-As-Author.md) | Facebook Connector: Tenant-Owned Page Scope & Organization Author | ADR-0059 | Story 2.15 | `story-2.15.facebook-connector.contract.test.ts` |
| [`TDS-0060`](TDS-0060-Facebook-Connector-Multiple-Pages-Per-User.md) | Facebook Connector: Multiple Pages Per User Cardinality Architecture | ADR-0060 | Story 6.27 | `story-6.27.facebook-multi-page-support.contract.test.ts` |
| [`TDS-0061`](TDS-0061-Tier-3-Poll-Scheduler-Per-User-Enumeration.md) | Tier-3 (User-Bound) Poll Scheduling Engine with Per-User Isolation | ADR-0061 | Story 1.15 | `story-1.15.tier3-poll-scheduling.contract.test.ts` |
| [`TDS-0067`](TDS-0067-Reconfirm-Facebook-Connector.md) | Facebook Connector Scope Reconfirmation & Two-Tier Author Resolution | ADR-0067 | Story 2.23 | `story-2.23.facebook-page-dependency-and-author-resolution.contract.test.ts` |
| [`TDS-0068`](TDS-0068-Instagram-Connector.md) | Instagram Connector: Business/Creator Scope & Carousel Normalization | ADR-0068 | Story 2.24 | `story-2.24.instagram-connector.contract.test.ts` |
| [`TDS-0069`](TDS-0069-LinkedIn-Connector.md) | LinkedIn Connector: OAuth 2.0 & Ingestion Architecture | ADR-0069 | Story 2.25 | `story-2.25.linkedin-connector.contract.test.ts` |
| [`TDS-0070`](TDS-0070-Connector-Ingestion-Status-Hanging-Run-Reconciliation-And-Alerts.md) | Ingestion Watchdog Reconciliation & Inactivity Alerting | ADR-0070 | Story 1.16 | `story-1.16.ingestion-watchdog-and-stalled-alerts.contract.test.ts` |

---

## Batch 3: Data Architecture, Storage, Retention & Exports (Completed Specifications)

| TDS ID | Feature / Title | Governing ADR | User Story | Contract Test |
|---|---|---|---|---|
| [`TDS-0004`](TDS-0004-Author-Normalized-Separately-From-Post.md) | Author Entity Normalization & Profile Lifecycle | ADR-0004 | Story 3.1 | `story-3.1.author-normalization.contract.test.ts` |
| [`TDS-0011`](TDS-0011-Cursor-Based-Pagination-For-Posts-API.md) | Cursor-Based Pagination for Posts API (`seq`) | ADR-0011 | Story 3.4 | `story-3.4.cursor-pagination.contract.test.ts` |
| [`TDS-0017`](TDS-0017-API-Versioning-And-Compatibility-Policy.md) | HTTP API Versioning & Backward Compatibility Policy | ADR-0017 | Story 1.3 (v1) | `story-1.3.http-api-versioning.contract.test.ts` |
| [`TDS-0018`](TDS-0018-Data-Retention-And-Archival-Policy.md) | Data Retention, Archival & Partition Lifecycle | ADR-0018 | Story 3.5 | `story-3.5.data-retention-and-archival.contract.test.ts` |
| [`TDS-0019`](TDS-0019-Event-Schema-Versioning-Policy.md) | Domain Event Schema Versioning & Forward Compatibility | ADR-0019 | Story 5.5 | `story-5.5.event-schema-versioning.contract.test.ts` |
| [`TDS-0039`](TDS-0039-Tenant-Offboarding-Data-Lifecycle-Export-And-Deletion.md) | Tenant Offboarding, Data Lifecycle Export & Deletion | ADR-0039 | Story 3.7 / 3.8 | `story-3.8.tenant-deletion-offboarding.contract.test.ts` |
| [`TDS-0044`](TDS-0044-Watchlist-API-Design-And-Database-Schema-Standardization.md) | Watchlist CRUD Contract, RFC 7396 PATCH & Optimistic Locking | ADR-0044 | Story 1.5 | `story-1.5.watchlist-crud.contract.test.ts` |
| [`TDS-0049`](TDS-0049-Point-In-Time-Author-Follower-Count-On-Social-Post.md) | Point-in-Time Author Follower Count Snapshot on SocialPost | ADR-0049 | Story 3.9 | `story-3.9.author-follower-count-at-publish.contract.test.ts` |
| [`TDS-0053`](TDS-0053-Canonical-Markdown-Post-Body-Normalization-At-Ingestion.md) | Canonical Markdown Normalization Computed Once at Ingestion | ADR-0053 | Story 3.10 | `story-3.10.canonical-markdown-post-body-normalization.contract.test.ts` |
| [`TDS-0063`](TDS-0063-Post-Watchlist-Matches-Junction-Table-And-Server-Side-Watchlist-Filter.md) | Post-Watchlist Matches Junction Table & Server-Side Filter | ADR-0063 | Story 3.11 / 3.12 | `story-3.11.post-watchlist-match-persistence.contract.test.ts` |
| [`TDS-0074`](TDS-0074-Tenant-Facing-Workspace-And-Posts-Export.md) | Tenant-Facing Workspace JSON & Matched-Posts CSV Export | ADR-0074 | Story 3.16 / 6.40 | `story-3.16.tenant-workspace-and-posts-export.contract.test.ts` |
| [`TDS-0090`](TDS-0090-Data-Export-Posts-CSV.md) | Posts CSV Data Export & Background Export Worker Engine | ADR-0090 | Story 10.8 | `story-10.8.data-export-posts-csv.contract.test.ts` |
| [`TDS-0111`](TDS-0111-Export-Bounding-Streaming-And-Size-Caps.md) | Export Resource Guards, Sync/Async Thresholds & Blob Lifecycle | ADR-0111 | Story 13.4 | `story-13.4.export-bounding-streaming-and-size-caps.contract.test.ts` |
| [`TDS-0124`](TDS-0124-Data-Export-Posts-CSV-Sampling-And-Bounded-Lookback.md) | Export Lookback Validation & Representative Systematic Sampling | ADR-0124 | Story 15.2 | `story-10.8.data-export-posts-csv.contract.test.ts` |

---

## Batch 4: Analytics, Metric Explainability & Dashboards (Completed Specifications)

| TDS ID | Feature / Title | Governing ADR | User Story | Contract Test |
|---|---|---|---|---|
| [`TDS-0007`](TDS-0007-Author-Topic-Signal-Minimal-V1.md) | Author Topic Signal Minimal V1 | ADR-0007 | Story 4.1 | `story-4.1.author-topic-signal-minimal-v1.contract.test.ts` |
| [`TDS-0008`](TDS-0008-Defer-Topic-Time-Series-And-Charting.md) | Defer Topic Time Series and Charting | ADR-0008 | Story 4.2 | `story-4.2.topic-time-series-deferred.contract.test.ts` |
| [`TDS-0022`](TDS-0022-Derived-Data-Caching-And-Refresh-Strategy.md) | Derived Data Caching and Refresh Strategy | ADR-0022 | Story 4.4 | `story-4.4.derived-data-caching-and-refresh.contract.test.ts` |
| [`TDS-0054`](TDS-0054-Tenant-Facing-Analytics-Dashboard-Scope-And-Data-Source-Strategy.md) | Tenant-Facing Analytics Dashboard Scope & Data-Source Strategy | ADR-0054 | Story 8.1 | `story-8.1.analytics-dashboard-shell-overview-sources.contract.test.ts` |
| [`TDS-0055`](TDS-0055-Analytics-Language-And-Location-Enrichment-Feasibility.md) | Analytics Language & Location Enrichment Feasibility | ADR-0055 | Story 8.5 | `story-8.5.languages-breakdown-widget.contract.test.ts` |
| [`TDS-0056`](TDS-0056-AI-Inferred-Origin-Location-Newswire-Dateline-Extraction.md) | AI-Inferred Origin Location from Newswire Dateline Extraction | ADR-0056 | Story 4.2 (Res.) | `story-2.9.ai-provider-connector.contract.test.ts` |
| [`TDS-0062`](TDS-0062-Analytics-Dashboard-Overview-Tab-Enhancement.md) | Analytics Dashboard Overview Tab Enhancement | ADR-0062 | Story 8.7 / 8.8 | `story-8.7.overview-tab-enhancement.contract.test.ts` |
| [`TDS-0064`](TDS-0064-Location-And-Geospatial-Insights-From-Posts-And-Authors.md) | Location and Geospatial Insights from Posts and Authors | ADR-0064 | Story 2.20 / 8.10 | `story-8.10.location-and-geospatial-insights.contract.test.ts` |
| [`TDS-0087`](TDS-0087-Preconfigured-Analytics-Views.md) | Preconfigured Analytics Views | ADR-0087 | Story 10.3 / 8.4 | `story-10.3.preconfigured-analytics-views.contract.test.ts` |
| [`TDS-0088`](TDS-0088-Ad-Hoc-Query-Allowlist.md) | Ad-Hoc Query Allowlist | ADR-0088 | Story 10.4 / 10.5 | `story-10.4.ad-hoc-query-endpoint.contract.test.ts` |
| [`TDS-0097`](TDS-0097-Topic-Evolution-Timeline.md) | Topic Evolution Timeline | ADR-0097 | Story 11.5 / 11.6 | `story-11.5.topic-evolution.contract.test.ts` |
| [`TDS-0105`](TDS-0105-Dashboards-And-Analytics-Widget-Contracts.md) | Dashboards and Analytics Widget Contracts | ADR-0105 | Story 12.9 / 12.10 | `story-12.9.dashboard-widget-contracts.contract.test.ts` |
| [`TDS-0113`](TDS-0113-Metric-Explainability-Prompt-And-Caching.md) | Metric Explainability Prompt and Caching | ADR-0113 | Story 13.7 / 9.2 | `story-13.7.metric-explainability-prompt-and-caching.contract.test.ts` |
| [`TDS-0114`](TDS-0114-Platform-Metrics-Table-And-Azure-Metrics.md) | Platform Metrics Table and Azure Metrics Integration | ADR-0114 | Story 10.6 / 13.8 | `story-13.8.platform-metrics-table-and-azure-metrics.contract.test.ts` |
| [`TDS-0116`](TDS-0116-Semantic-Drift-Detection.md) | Semantic Drift Detection | ADR-0116 | Story 13.11 / 13.12 | `story-13.11.semantic-drift-detection.contract.test.ts` |
| [`TDS-0128`](TDS-0128-Platform-Operations-Dashboard-Refinements.md) | Platform Operations Dashboard Refinements | ADR-0128 | Story 16.4 / 10.7 | `story-10.7.platform-operations-dashboard.contract.test.ts` |
| [`TDS-0132`](TDS-0132-Ad-Hoc-Query-Allowlist-Refinements.md) | Ad-Hoc Query Allowlist Refinements | ADR-0132 | Story 17.2 / 10.4 | `story-10.4.ad-hoc-query-endpoint.contract.test.ts` |
| [`TDS-0133`](TDS-0133-Metric-Explainability-Endpoint-Refinements.md) | Metric Explainability Endpoint Refinements | ADR-0133 | Story 17.3 / 13.7 | `story-13.7.metric-explainability-prompt-and-caching.contract.test.ts` |
| [`TDS-0135`](TDS-0135-Preconfigured-Analytics-Views-Refinements.md) | Preconfigured Analytics Views Refinements | ADR-0135 | Story 18.2 / 10.3 | `story-10.3.preconfigured-analytics-views.contract.test.ts` |
| [`TDS-0141`](TDS-0141-Analytics-And-UI-Contract-Refinements.md) | Analytics and UI Contract Refinements | ADR-0141 | Story 6.9/8.6/8.7 | `story-8.6.sources-tab-sentiment-index-volume-history.contract.test.ts` |

---

## Batch 5: Identity, Security, Admin Console & Compliance (Completed Specifications)

| TDS ID | Feature / Title | Governing ADR | User Story | Contract Test |
|---|---|---|---|---|
| [`TDS-0035`](TDS-0035-Admin-UI-Shape-One-App-Role-Gated.md) | Admin UI Shape: Unified Single-App Architecture & Role-Gated Views | ADR-0035 | Story 6.2 / 6.6 | `story-6.2.admin-role-gated-views.contract.test.ts` |
| [`TDS-0036`](TDS-0036-Admin-UI-Authentication-Session-And-Role-Gating-Mechanism.md) | Admin UI Authentication, Session Lifecycle & Role-Gating Guards | ADR-0036 | Story 5.11 / 6.1 / 6.2 | `story-5.11.session-management.contract.test.ts` |
| [`TDS-0037`](TDS-0037-Self-Service-Tenant-Signup-And-First-Tenant-Admin-Provisioning.md) | Self-Service Tenant Signup & Initial Tenant-Admin Provisioning | ADR-0037 | Story 5.15 / 6.7 | `story-5.15.self-service-tenant-signup.contract.test.ts` |
| [`TDS-0040`](TDS-0040-Self-Service-Signup-Rate-Limiting-And-Abuse-Prevention-Mechanism.md) | Self-Service Signup Rate Limiting, IP Throttling & Abuse Prevention | ADR-0040 | Story 5.18 | `story-5.18.signup-abuse-prevention.contract.test.ts` |
| [`TDS-0041`](TDS-0041-Platform-Admin-Is-A-Distinct-Identity-Kind-Not-A-Role-Value.md) | Platform-Admin as Distinct Identity Kind & Break-Glass Boundary | ADR-0041 | Story 5.7 / 5.11 / 6.6 | `story-5.7.platform-admin-identity-kind.contract.test.ts` |
| [`TDS-0043`](TDS-0043-Self-Service-Tenant-Initiated-Deletion.md) | Self-Service Tenant-Initiated Deletion & Grace Period Lifecycle | ADR-0043 | Story 3.8 / 6.13 | `story-3.8.tenant-self-deletion.contract.test.ts` |
| [`TDS-0091`](TDS-0091-Real-Time-Alert-Rules-And-Delivery.md) | Real-Time Alert Rule Engine, Cooldown Suppression & Alert Inbox | ADR-0091 | Story 10.9 / 10.10 | `story-10.9.real-time-alert-rules.contract.test.ts` |
| [`TDS-0092`](TDS-0092-Author-Initiated-Takedown.md) | Author-Initiated Takedown Public Portal & Soft-Redaction Engine | ADR-0092 | Story 10.11 / 10.12 | `story-10.11.author-takedown-redaction.contract.test.ts` |
| [`TDS-0093`](TDS-0093-DSR-Self-Service-Portal.md) | Data Subject Rights (DSR) Self-Service Portal & Review Engine | ADR-0093 | Story 10.13 | `story-10.13.dsr-portal-lifecycle.contract.test.ts` |
| [`TDS-0094`](TDS-0094-Compliance-Audit-Pack.md) | Compliance Audit Pack Generation & Evidence Bundle Engine | ADR-0094 | Story 10.14 | `story-10.14.compliance-audit-pack.contract.test.ts` |
| [`TDS-0107`](TDS-0107-Multi-User-Workspaces-And-RBAC-Permissions.md) | Multi-User Workspaces & Fine-Grained RBAC Resource Sharing | ADR-0107 | Story 12.13 / 12.14 | `story-12.13.multi-user-workspaces-rbac.contract.test.ts` |
| [`TDS-0112`](TDS-0112-Feature-Gating-And-Seat-Limit-Enforcement.md) | Feature Gating, Plan Tiers & Active Seat-Limit Enforcement Engine | ADR-0112 | Story 13.5 / 13.6 | `story-13.5.feature-gating-and-seat-limit-enforcement.contract.test.ts` |
| [`TDS-0123`](TDS-0123-Real-Time-Alert-Rules-And-Delivery-Refinements.md) | Real-Time Alert Rule Refinements: Noise Exclusion, Daily Caps & Preview | ADR-0123 | Story 15.1 | `story-15.1.alert-rules-refinements.contract.test.ts` |
| [`TDS-0125`](TDS-0125-Author-Initiated-Takedown-Refinements.md) | Author-Initiated Takedown Refinements: 45-Day SLA, CAPTCHA & AI Redaction | ADR-0125 | Story 16.1 | `story-16.1.takedown-sla-and-enrichment-cascade.contract.test.ts` |
| [`TDS-0126`](TDS-0126-DSR-Self-Service-Portal-Refinements.md) | DSR Portal Refinements: Article 18 Restriction & Cryptographic Receipts | ADR-0126 | Story 16.2 | `story-16.2.dsr-article-18-restriction.contract.test.ts` |
| [`TDS-0127`](TDS-0127-Compliance-Audit-Pack-Refinements.md) | Compliance Audit Pack Refinements: Merkle Hash Chaining & Manifests | ADR-0127 | Story 16.3 | `story-16.3.audit-hash-chaining-manifest.contract.test.ts` |

---

## Batch 6: AI Enrichment, Search Sourcing & RAG Architecture (Completed Specifications)

| TDS ID | Feature / Title | Governing ADR | User Story | Contract Test |
|---|---|---|---|---|
| [`TDS-0038`](TDS-0038-AI-Enrichment-Provider-Selection.md) | AI Enrichment Provider Selection: Azure AI Language & Azure OpenAI | ADR-0038 | Story 2.8 / 2.9 | `story-2.8.azure-ai-language-connector.contract.test.ts` |
| [`TDS-0065`](TDS-0065-Active-Watchlist-Sourcing-Via-Brave-Search-API.md) | Active Watchlist Sourcing via Brave Search API | ADR-0065 | Story 2.21 | `story-2.21.brave-search-connector.contract.test.ts` |
| [`TDS-0066`](TDS-0066-Active-Watchlist-Sourcing-Via-Bing-Search-API.md) | Active Watchlist Sourcing via Bing Search API (Azure) | ADR-0066 | Story 2.22 | `story-2.22.bing-search-connector.contract.test.ts` |
| [`TDS-0076`](TDS-0076-Composer-Deep-Research-Agent.md) | Composer Deep Research Agent: Context Summary & Comparison | ADR-0076 | Story 3.17 / 6.41 | `story-3.17.composer-deep-research.contract.test.ts` |
| [`TDS-0081`](TDS-0081-RAG-Connector-Provider-Abstraction.md) | RAGConnector Provider Abstraction & Vector Store Interface | ADR-0081 | Story 9.7 | `story-9.7.rag-connector.contract.test.ts` |
| [`TDS-0082`](TDS-0082-RAG-Post-Chunking-And-Embedding.md) | RAG Post Chunking and Embedding Pipeline | ADR-0082 | Story 9.8 | `story-9.8.rag-chunking-pipeline.contract.test.ts` |
| [`TDS-0083`](TDS-0083-RAG-Vector-Store-RLS-And-Metadata.md) | RAG Vector-Store RLS, Pre-Filtering & Metadata Schema | ADR-0083 | Story 9.9 | `story-9.9.rag-vector-rls.contract.test.ts` |
| [`TDS-0084`](TDS-0084-RAG-Search-And-Ask-Endpoint.md) | RAG Search & Ask Endpoints: Vector Retrieval & SSE Streaming | ADR-0084 | Story 9.10 | `story-9.10.rag-endpoints.contract.test.ts` |
| [`TDS-0085`](TDS-0085-RAG-UI-UX-And-Loading-Patterns.md) | RAG UI/UX, Streaming Patterns & Citation Mechanics | ADR-0085 | Story 9.11 | `story-9.11.rag-discovery-ui.contract.test.ts` |
| [`TDS-0103`](TDS-0103-AI-Sentiment-Analysis-Aspect-Schema.md) | AI Sentiment Analysis Aspect Schema & Confidence Tiering | ADR-0103 | Story 12.5 / 12.6 | `story-12.5.ai-sentiment-aspect-schema.contract.test.ts` |
| [`TDS-0104`](TDS-0104-AI-Topic-Clustering-Post-Topics-Schema.md) | AI Topic Clustering Post Topics Schema & Topic Catalog | ADR-0104 | Story 12.7 / 12.8 | `story-12.7.ai-topic-clustering-post-topics-schema.contract.test.ts` |
| [`TDS-0120`](TDS-0120-Search-Provider-Connector.md) | SearchProviderConnector: Shared One-Off Search Abstraction | ADR-0120 | Story 14.3 | `story-14.3.search-provider-connector.contract.test.ts` |
| [`TDS-0121`](TDS-0121-Composer-Deep-Research-Caching-Retrigger-Cost.md) | Composer Deep Research Caching, Re-Trigger & Cost Telemetry | ADR-0121 | Story 14.4 | `story-14.4.composer-research-caching.contract.test.ts` |
| [`TDS-0136`](TDS-0136-RAG-Connector-Provider-Abstraction-Namespace-Per-Tenant.md) | RAGConnector Provider Abstraction: Namespace-Per-Tenant Isolation | ADR-0136 | Story 19.1 | `story-19.1.rag-connector-namespace.contract.test.ts` |
| [`TDS-0137`](TDS-0137-RAG-Post-Chunking-And-Embedding-Namespace-Routing.md) | RAG Post Chunking and Embedding: Namespace Routing | ADR-0137 | Story 19.2 | `story-19.2.rag-chunking-namespace-routing.contract.test.ts` |
| [`TDS-0138`](TDS-0138-RAG-Vector-Store-Namespace-Per-Tenant-Isolation.md) | RAG Vector Store: Namespace-Per-Tenant Isolation & pgvector RLS | ADR-0138 | Story 19.3 | `story-19.3.rag-vector-store-namespace.contract.test.ts` |
| [`TDS-0139`](TDS-0139-RAG-Search-And-Ask-Endpoint-Namespace-Resolution.md) | RAG Search and Ask Endpoint: Namespace Resolution | ADR-0139 | Story 19.4 | `story-19.4.rag-search-ask-namespace.contract.test.ts` |
| [`TDS-0140`](TDS-0140-RAG-UI-UX-And-Loading-Patterns-Refinements.md) | RAG UI/UX & Loading Patterns Refinements: RAF Stream Draining | ADR-0140 | Story 19.5 | `story-19.5.rag-ui-refinements.contract.test.ts` |

---

## Batch 7: Outbound Publishing, Polypost Composer & Social Care (Completed Specifications)

| TDS ID | Feature / Title | Governing ADR | User Story | Contract Test |
|---|---|---|---|---|
| [`TDS-0071`](TDS-0071-Human-In-The-Loop-Post-Enrichment-Overrides.md) | Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI | ADR-0071 | Story 3.13 / 6.31 | `story-3.13.post-enrichment-overrides.contract.test.ts` |
| [`TDS-0072`](TDS-0072-Cross-Platform-Polypost-Composer-And-Preview-Engine.md) | Cross-Platform Polypost Composer and Multi-Network Preview Engine | ADR-0072 | Story 6.36 | `story-6.36.polypost-composer.contract.test.ts` |
| [`TDS-0073`](TDS-0073-Outbound-Reply-To-Ingested-Posts.md) | Outbound Reply to Ingested Posts via Platform APIs | ADR-0073 | Story 2.26 / 2.27 / 3.14 / 6.38 | `story-2.26.connector-reply-framework.contract.test.ts` |
| [`TDS-0075`](TDS-0075-Outbound-Social-Post-Publishing.md) | Outbound Social Post Publishing via Platform APIs | ADR-0075 | Story 2.28 / 2.29 / 2.30 / 3.15 / 6.39 | `story-2.28.connector-publish-framework.contract.test.ts` |
| [`TDS-0086`](TDS-0086-Prospecting-List-Model-And-Sharing.md) | Prospecting List Model and Sharing | ADR-0086 | Story 10.1 / 10.2 | `story-10.1.prospecting-list-model.contract.test.ts` |
| [`TDS-0095`](TDS-0095-Case-And-Lead-Handoff-To-CRM.md) | Case and Lead Handoff to CRM (Dynamics 365, Salesforce, HubSpot) | ADR-0095 | Story 11.1 / 11.2 | `story-11.1.crm-connector-handoff.contract.test.ts` |
| [`TDS-0098`](TDS-0098-Publishing-And-Scheduling.md) | Publishing and Scheduling | ADR-0098 | Story 11.7 / 11.8 | `story-11.7.publishing-and-scheduling.contract.test.ts` |
| [`TDS-0099`](TDS-0099-Unified-Social-Inbox-And-Reply.md) | Unified Social Inbox and Reply | ADR-0099 | Story 11.9 / 11.10 | `story-11.9.unified-social-inbox.contract.test.ts` |
| [`TDS-0100`](TDS-0100-Composed-Post-Author-Mention-Suggestions.md) | Composed Post Author Mention Suggestions | ADR-0100 | Story 11.11 / 11.12 | `story-11.11.mention-suggestions.contract.test.ts` |
| [`TDS-0108`](TDS-0108-Influencer-Discovery-And-Scoring.md) | Influencer Discovery and Scoring | ADR-0108 | Story 12.15 / 12.16 | `story-12.15.influencer-discovery-scoring.contract.test.ts` |
| [`TDS-0110`](TDS-0110-Per-Connector-Query-Translation-And-Validation.md) | Per-Connector Query Translation and Validation | ADR-0110 | Story 13.2 / 13.3 | `story-13.2.query-translation.contract.test.ts` |
| [`TDS-0115`](TDS-0115-Publishing-Media-Upload-And-Asset-Targeting.md) | Publishing — Media Upload and Asset Targeting | ADR-0115 | Story 13.9 / 13.10 | `story-13.9.media-upload-asset-targeting.contract.test.ts` |
| [`TDS-0117`](TDS-0117-Prospecting-List-Export-And-CRM-Push.md) | Prospecting List Export and CRM Push | ADR-0117 | Story 13.13 / 13.14 | `story-13.13.prospecting-export-crm-push.contract.test.ts` |
| [`TDS-0118`](TDS-0118-Additional-Social-Platform-Publishing.md) | Additional Social Platform Publishing Roadmap | ADR-0118 | Story 14.1 | `story-14.1.additional-social-platform-publishing-roadmap.contract.test.ts` |
| [`TDS-0119`](TDS-0119-Editing-And-Deleting-Published-Outbound-Posts.md) | Editing and Deleting Published Outbound Posts | ADR-0119 | Story 14.2 | `story-14.2.editing-and-deleting-published-outbound-posts.contract.test.ts` |
| [`TDS-0129`](TDS-0129-Prospecting-List-Model-Refinements-Deduplicated-CRM-Sync.md) | Prospecting List Model Refinements — Deduplicated CRM Sync and Scoped Team Sharing | ADR-0129 | Story 17.1 | `story-17.1.prospecting-list-refinements.contract.test.ts` |
| [`TDS-0131`](TDS-0131-Crisis-Template-Bundle-Refinements-Baseline-Escalation.md) | Crisis Template Bundle Refinements — Automated Baseline Calibration and Escalation Trees | ADR-0131 | Story 17.3 | `story-17.3.crisis-baseline-escalation.contract.test.ts` |

---

## Batch 8: Advanced Telemetry & Continuous Self-Learning (Completed Specifications)

| TDS ID | Feature / Title | Governing ADR | User Story | Contract Test |
|---|---|---|---|---|
| [`TDS-0077`](TDS-0077-Watchlist-Connector-Count-Method.md) | Watchlist Connector Count and Preview Volume Endpoint | ADR-0077 | Story 9.1 | `story-9.1.watchlist-preview-volume.contract.test.ts` |
| [`TDS-0078`](TDS-0078-Metric-Explainability-Endpoint.md) | Metric Explainability Endpoint | ADR-0078 | Story 9.2 | `story-9.2.metric-explainability.contract.test.ts` |
| [`TDS-0079`](TDS-0079-Crisis-Template-Bundle-And-Activation.md) | Crisis Template Bundle and Activation | ADR-0079 | Story 9.3 / 9.4 | `story-9.3.crisis-template-bundle.contract.test.ts` |
| [`TDS-0080`](TDS-0080-Onboarding-Checklist-State.md) | Onboarding Checklist State | ADR-0080 | Story 9.5 / 9.6 | `story-9.5.onboarding-checklist.contract.test.ts` |
| [`TDS-0089`](TDS-0089-Platform-Operations-Dashboard.md) | Platform Operations Dashboard | ADR-0089 | Story 10.6 / 10.7 | `story-10.7.platform-operations-dashboard.contract.test.ts` |
| [`TDS-0096`](TDS-0096-Daily-Digest-Email.md) | Daily Digest Email (Timezone-Aware, Precomputed Views & AI Summary) | ADR-0096 | Story 11.3 / 11.4 | `story-11.3.daily-digest-email.contract.test.ts` |
| [`TDS-0101`](TDS-0101-Multi-Source-Connector-Capability-Matrix.md) | Multi-Source Connector Capability Matrix | ADR-0101 | Story 12.1 / 12.2 | `story-12.1.connector-capability-matrix.contract.test.ts` |
| [`TDS-0102`](TDS-0102-Boolean-Query-AST-And-Visual-Builder.md) | Boolean Query AST and Visual Builder | ADR-0102 | Story 12.3 / 12.4 | `story-12.3.boolean-query-ast.contract.test.ts` |
| [`TDS-0106`](TDS-0106-API-And-Integrations-Versioning-And-Webhooks.md) | API and Integrations — Versioning and Webhooks | ADR-0106 | Story 12.11 / 12.12 | `story-12.11.public-api-and-webhooks.contract.test.ts` |
| [`TDS-0122`](TDS-0122-Continuous-Self-Learning-Synthesis-And-Telemetry-Feedback-Loop.md) | Continuous Self-Learning Synthesis and Telemetry Feedback Architecture | ADR-0122 | Story 14.5 | `story-14.5.self-learning-telemetry.contract.test.ts` |
| [`TDS-0130`](TDS-0130-Onboarding-Checklist-State-Refinements-Role-Tailored-Trees.md) | Onboarding Checklist State Refinements — Role-Tailored Step Trees and Automated Verification Probes | ADR-0130 | Story 17.2 | `story-17.2.onboarding-probes.contract.test.ts` |
| [`TDS-0134`](TDS-0134-Watchlist-Connector-Count-Method-Refinements.md) | Watchlist Connector Count Method Refinements — UI Confidence Contract & Cost Projections | ADR-0134 | Story 18.1 | `story-18.1.watchlist-volume-confidence-and-cost.contract.test.ts` |
| [`TDS-0144`](TDS-0144-Repository-Segregation-And-API-Gateway-Implementation.md) | Repository Segregation and API Gateway Implementation | ADR-0144 | Story 20.1 / 20.2 | `story-20.1.openapi-spec-generation.contract.test.ts` (Story 20.2's own contract still pending — *Documentation Steward correction, 2026-09-25: this row previously read "Pending" for both stories; Story 20.1's contract shipped 2026-09-17, `social-listening-core@fc5a6856`, confirmed on disk at `social-listening-core/contracts/epic-20/`*) |
