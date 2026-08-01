# Ideation Enhanced: Social Listening & Engagement Platform — Phase 1: Social Listening / Insights Subsystem

**Parent Validation ID:** `docs/project docs/Business-Case.md` (Option C — Build, recommended 28 Jul 2026), cross-referenced with `Project-Charter.md` and `Stakeholder-Register.md` (same date) — together this repo's Concept Validation corpus. Originating spark: `Ideation-Document.md` / `Spark-Capture.md`.
**Document Baseline Version:** v1.0

## 1. Project Initialization & Stated Value

- **Refined Concept Scope:** Deliver a modular, Azure-native, multi-tenant social listening pipeline. Pluggable connectors ingest posts from social and news platforms, normalize them into a common `SocialPost`/`Author` schema, enrich them via a swappable AI provider (Azure AI Language), and expose the result through a versioned REST API and a Service Bus event stream that downstream subsystems can consume without re-deriving ingestion logic.
- **Value Delivery Goal:** Replace the two poor options currently available — opaque, vendor-locked enterprise aggregators, or hand-rolled per-platform integration — with a pipeline the operator fully owns: every ingested record is traceable to the exact process and moment it entered the system (`IngestionRun`), and the AI enrichment vendor is swappable rather than fixed. This targets durable reuse: the same connector and isolation pattern is intended to carry forward into three future subsystems (Brand Reputation & Alerts, Social Care, Social Selling) without re-engineering ingestion for each one.

## 2. Defined Boundaries: In-Scope vs. Out-of-Scope

- **Mandatory In-Scope Elements:**
  - Connector framework (`ProviderConnector`, `SocialConnector`, `AIProviderConnector` interfaces)
  - Reference connectors, starting with low-cost/free platforms (RSS/News proven first — GlobeNewswire + PR Newswire) and expanding toward the full target list (X, Reddit, YouTube, LinkedIn, Meta)
  - Normalization into the common `SocialPost` / `Author` schema
  - Enrichment via Azure AI Language (sentiment, entities, key phrases, language)
  - Watchlist configuration (keyword, hashtag, account, boolean query)
  - Multi-tenant Postgres storage with Row-Level Security
  - REST API and Service Bus events
  - Minimal admin UI: connect/disconnect platforms, manage watchlists, view connector health status
- **Strict Out-of-Scope Boundaries:**
  - Brand Reputation & Alerts, Social Care, and Social Selling subsystems — each is a separate future project with its own charter
  - Charting/dashboard visualization (e.g., topic-over-time graphs)
  - Geocoding of free-text profile locations
  - Sophisticated author-expertise scoring beyond raw `AuthorTopicSignal` fields
  - Enterprise governance frameworks (compliance registries, formal change-control boards) — explicitly deferred to a later governance pass, not this document

## 3. Preliminary Project Delivery Roles

- **Proposed Initiative Lead:** Menno — Sponsor, Product Owner, and tactical execution/milestone owner (solo project; no separate PM role exists per the Stakeholder Register).
- **Lead Solutions Architect:** Menno — the "Sole Developer" role in the Stakeholder Register encompasses technical design and systems integration; no separate architecture hire exists. `[TACTICAL ROLE - TO BE CONFIRMED]` if the project gains collaborators.
- **Target Beneficiaries:** Menno, first — as the builder proving the architecture with real data. Longer-term, small-to-mid-size organizations or agencies priced out of enterprise aggregators (not yet a committed market). Structurally, the three future downstream subsystems are also direct beneficiaries, as consumers of this subsystem's API and event stream.

## 4. Key Operational Dependencies

- **System Dependencies:** Azure Database for PostgreSQL, Azure Key Vault, Azure Service Bus, Azure AI Language; each connected platform's public API/feed (X, Reddit, YouTube, LinkedIn, Meta, RSS/Newswire — GlobeNewswire and PR Newswire specifically). Two repositories: `social-listening-core` (TypeScript/Node.js backend) and `social-listening-admin` (Next.js admin UI) — neither exists on disk yet as of this document's baseline.
- **Resource Dependencies:** Menno's available solo development time outside other commitments (ADPA, RPAS-Governance work). No external team, legal sign-off, or vendor procurement is currently required. `[FIELD - TO BE CONFIRMED BY DELIVERY TEAM]` for any future collaborators, should the project expand beyond solo scope.

## 5. Measurable Performance Indicators (KPIs)

- **Quantitative Baseline Targets:**
  - At least one platform connector ingesting real data end-to-end
  - Sentiment/entity/key-phrase enrichment populated via Azure AI Language on ingested posts
  - Two test tenants confirmed fully isolated at both the database (RLS) and rate-limit level, with zero cross-contamination
  - REST API live with at least one downstream event successfully consumed
  - *(No cash-value or percentage targets are set — the Business Case explicitly leaves the budget ceiling undefined at this stage; cost management is scoped instead as a monthly API-cost cap to be set before connecting any paid-tier platform.)*
- **Qualitative Validation Markers:**
  - Connector framework demonstrably generalizes across both social platforms and AI enrichment providers without core pipeline changes
  - Admin UI supports a full connect → configure watchlist → view health loop for at least one platform
  - Phase 1 review (Milestone M7) produces a clear go/no-go read on investing in a downstream subsystem

## 6. Project Assumptions & Early-Stage Risk Log

### Core Execution Assumptions (BABOK Matrix)

- **Assumption A-01:** Menno has sufficient available time outside other commitments (ADPA, RPAS-Governance work) to sustain solo development through Phase 1. — *Proposed Validation Method:* Self-check at each milestone gate (M1–M7); re-scope if a milestone stalls significantly.
- **Assumption A-02:** Azure remains the preferred cloud platform, and the platform APIs used by initial connectors (starting with RSS/Newswire) remain accessible under their current terms for the duration of the build. — *Proposed Validation Method:* Per-connector API/Terms-of-Service review immediately before that connector is built (the precedent already set for the Newswire connector).

### Initial Risk Log (PMBOK Format)

| Risk ID | Risk Description | Impact (L/M/H) | Proposed Mitigation Strategy | Anticipated Risk Owner |
| :--- | :--- | :---: | :--- | :--- |
| **R-01** | Platform API pricing or policy changes affect the cost or feasibility of a specific connector (X's own pricing has already reshaped this market once). | H | Prioritize free/low-cost platforms (RSS/News, Reddit) for the earliest connectors; set a defined monthly cost cap before connecting any paid-tier API such as X. | Menno (Initiative Lead) |
| **R-02** | Scope creep across the four-subsystem vision outruns solo development bandwidth. | M | Phase-gate investment — validate this subsystem's success criteria at Milestone M7 before committing further time to Brand Reputation, Social Care, or Social Selling. | Menno (Initiative Lead) |
| **R-03** | Solo-developer bus factor — no redundancy if Menno's availability changes. | M | Keep design specs and documentation (this document, ADRs, Implementation Log) current enough to double as onboarding material if the project ever gains a collaborator. | Menno (Initiative Lead) |

## 7. Initial Communications Plan

- **Team-Level Status Frequency:** No internal team exists yet, so no synchronization cadence is required today. Menno self-reviews progress at each milestone gate (M1–M7). `[FIELD - TO BE CONFIRMED BY DELIVERY TEAM]` if collaborators join.
- **Stakeholder Information Flow:** As Sponsor, Product Owner, and Sole Developer simultaneously, Menno is both the source and the recipient of status information. In place of upward reporting to a separate management tier, the dated Implementation Log (`docs/implementation-log.md`) and the ADRs'/User Stories' own dated status notes serve as the durable, asynchronous record of progress and blockers.

## 8. Decision Readiness Assessment

- **Next Validation Gate:** Set a monthly API-cost cap before connecting any paid-tier platform (per Business Case §5); execute Milestones M1–M6; reach Milestone M7 (Phase 1 review) to decide whether to proceed to a downstream subsystem.
- **Pipeline Stage:** Pre-Governance Evaluation / Review Pending
