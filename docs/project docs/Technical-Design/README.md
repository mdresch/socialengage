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
| **Batch 3** | **Data Architecture, Storage, Retention & Exports** | ADRs 0004, 0011, 0017–0019, 0039, 0044, 0049, 0053, 0063, 0074, 0090, 0111, 0124 | Epic 3, Epic 10 | Pending |
| **Batch 4** | **Analytics, Metric Explainability & Dashboards** | ADRs 0007, 0008, 0022, 0054–0056, 0062, 0064, 0087, 0088, 0097, 0105, 0113, 0114, 0116, 0128, 0132, 0133, 0135, 0141 | Epic 4, Epic 8, Epic 13 | Pending |
| **Batch 5** | **Identity, Security, Admin Console & Compliance** | ADRs 0030, 0035–0037, 0040, 0041, 0043, 0091–0094, 0107, 0112, 0123, 0125–0127 | Epic 5, Epic 6, Epic 7, Epic 10 | Pending |
| **Batch 6** | **AI Enrichment, Search Sourcing & RAG Architecture** | ADRs 0038, 0065, 0066, 0076, 0081–0085, 0103, 0104, 0120, 0121, 0136–0140 | Epic 2, Epic 9, Epic 14 | Pending |
| **Batch 7** | **Outbound Publishing, Polypost Composer & Social Care** | ADRs 0071–0073, 0075, 0086, 0095, 0098–0100, 0108, 0110, 0115, 0117–0119, 0129, 0131 | Epic 11, Epic 12, Epic 13, Epic 14 | Pending |
| **Batch 8** | **Advanced Telemetry & Continuous Self-Learning** | ADRs 0078–0080, 0089, 0096, 0101, 0102, 0106, 0122, 0130, 0134 | Epic 14, Epic 15+ | Pending |

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



