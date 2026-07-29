# Project Charter
### Social Listening & Engagement Platform — Phase 1: Social Listening / Insights Subsystem

**Project Sponsor:** Menno
**Project Manager:** Menno
**Date:** 28 July 2026
**Status:** Draft — pending self-approval to proceed to implementation

---

## 1. Purpose and Justification

Microsoft Social Engagement was discontinued in January 2020 without a direct successor, leaving a gap between expensive enterprise social listening aggregators and narrow single-platform tools. This project builds a modular, multi-tenant, Azure-native alternative — starting with the foundational Social Listening / Insights subsystem — that avoids vendor lock-in through a pluggable connector architecture for both social platforms and AI enrichment providers. Full justification, options considered, and cost/benefit analysis are documented in the accompanying Business Case.

## 2. Objectives

- Deliver a working, multi-tenant social listening ingestion pipeline covering at least one social platform connector end-to-end
- Prove the connector framework generalizes across both social platforms and AI enrichment providers without core pipeline changes
- Establish database-level multi-tenant isolation and full acquisition traceability (IngestionRun) as non-negotiable architectural properties from the start, not retrofitted later
- Produce a REST API and event stream that downstream subsystems (Brand Reputation, Social Care, Social Selling) can build on without re-deriving ingestion logic

## 3. Scope

### In Scope (Phase 1)

- Connector framework (`ProviderConnector`, `SocialConnector`, `AIProviderConnector` interfaces)
- Reference connectors: initial platform(s) selected per the Business Case's cost-phasing recommendation, expanding toward the full target list (X, Reddit, YouTube, LinkedIn, Meta, RSS/News, Newswire) over time
- Normalization into the common `SocialPost` / `Author` schema
- Enrichment via Azure AI Language (sentiment, entities, key phrases, language)
- Watchlist configuration (keyword, hashtag, account, boolean)
- Multi-tenant Postgres storage with Row-Level Security
- REST API (Section 6 of design spec) and Service Bus events (Section 7)
- Minimal admin UI: connect/disconnect platforms, manage watchlists, view connector health status

### Out of Scope (Phase 1)

- Brand Reputation & Alerts, Social Care, and Social Selling subsystems — each is a separate future project with its own charter
- Charting/dashboard visualization (e.g. topic-over-time graphs) — deferred to a future insights subsystem
- Geocoding of free-text profile locations
- Sophisticated author-expertise scoring beyond raw `AuthorTopicSignal` fields

## 4. Deliverables

- `social-listening-core` repository (backend: connectors, ingestion, enrichment, API, events)
- `social-listening-admin` repository (Next.js admin UI)
- Approved design specification (completed — see 2026-07-28 design doc)
- Working end-to-end demo: at least one connector, ingesting, enriching, and exposing data via API and events

## 5. High-Level Milestones

| Milestone | Description |
|---|---|
| M1 — Repos scaffolded | `social-listening-core` and `social-listening-admin` repos created; base project structure, CI, and Azure resource provisioning (Postgres, Key Vault, Service Bus) in place. |
| M2 — Connector framework built | `ProviderConnector` base contract, `SocialConnector` and `AIProviderConnector` interfaces, `RequestGate` rate limiting implemented and unit tested. |
| M3 — First connector live | One low-cost platform connector (recommended: Reddit or RSS/News) ingesting real data end-to-end into Postgres. |
| M4 — Enrichment pipeline live | Azure AI Language connected via the `AIProviderConnector` pattern; sentiment, entities, key phrases, and language populated on ingested posts. |
| M5 — Multi-tenant isolation verified | Two test tenants confirmed fully isolated at the database (RLS) and rate-limit level. |
| M6 — API & events live | REST API (Section 6 of design spec) and Service Bus events (Section 7) functional; admin UI can connect a platform and manage a watchlist end-to-end. |
| M7 — Phase 1 review | Business case success criteria assessed; decision point on whether to proceed to a downstream subsystem (Brand Reputation, Social Care, or Social Selling). |

No fixed calendar dates are set at charter stage, given this is a solo, self-funded project without external deadline pressure. Milestones are sequenced by dependency, not by date; timeline commitments can be added once implementation begins.

## 6. Assumptions

- Menno has sufficient available time outside other commitments (ADPA, RPAS-Governance work) to sustain solo development
- Azure remains the preferred cloud platform for the duration of Phase 1
- Platform APIs used by initial connectors remain accessible under current terms for the duration of the build

## 7. Constraints

- Self-funded — no external budget; cloud and API costs must stay within a self-imposed, currently undefined ceiling (recommend setting this before connecting any paid-tier API, per the Business Case)
- Solo development capacity — no team to parallelize work across subsystems or connectors
- Must comply with each platform's Terms of Service; no scraping or unauthorized access methods

## 8. High-Level Risks

- Platform API pricing or policy changes affecting cost or feasibility of specific connectors
- Scope creep across four subsystems without disciplined phase gating
- Solo-developer bus factor — no redundancy if availability changes

Full risk detail is in the Business Case; this charter tracks risk at a summary level only.

## 9. Success Criteria

As defined in the Business Case, Section 8: at least one connector ingesting real data end-to-end, working enrichment via Azure AI Language, verified multi-tenant isolation, and a functioning REST API with at least one consumed event. Meeting these criteria triggers the Phase 1 review milestone (M7) and the decision on whether to proceed to a downstream subsystem.

## 10. Approval

As a solo project, formal sign-off is a self-commitment to proceed rather than a multi-party approval. This charter is considered approved when the sponsor (Menno) elects to begin implementation.

**Approved by:** _______________________ (Menno, Sponsor)
**Date:** _______________________
