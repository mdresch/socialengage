## 📋 [DOCUMENT HEADER METADATA BLOCK]

- **Project Title:** Social Listening & Engagement Platform — Phase 1: Social Listening / Insights Subsystem
- **Operational Stance:** ADPA Governance Verified
- **Active Lifecycle Stage:** Structuring
- **Current Target Completeness Threshold:** 0.90

**Provenance note on lifecycle-stage selection:** `CLAUDE.md`'s header line ("Phase 0 sealed — planning corpus complete, zero implementation code exists yet") is stale relative to `docs/implementation-log.md`, which is the git-hash-verified source of truth per `docs/implementation-methodology.md`'s own convention. As of the log's last entry (2026-07-30, Story 1.4, commit `5f43ca9`), 25/25 ADRs are Accepted, 25/25 user stories have a logged commit, and the full accumulated contract suite stands at 113/113 passing across two real repositories, against real (not mocked) Azure Key Vault, Service Bus, and Blob Storage instances. This is well past rough concept tracking — architecture is locked and code exists — but formal enterprise PM artifacts (a WBS, a RACI matrix, a cost baseline, an authentication layer) have never existed until this document. That combination — "system locks in core architectures and flags remaining data dependencies" — is the Structuring phase's own definition, not Ideation's or Audit's. `[AI-INFERRED DEFAULT PATTERN – Justification: the three-tier phase table in the governing system prompt (§3) ties Structuring specifically to "locks in core architectures and flags remaining data dependencies," which matches this project's ADR-driven architecture lock combined with an unresolved authentication/tenant-provisioning gap more precisely than either other phase.]`

---

### SECTION 1: EXECUTIVE SUMMARY & STRATEGIC BOUNDARIES

#### 1.1 Executive Summary & Strategic Boundary Definitions

This project builds a modular, Azure-native, multi-tenant social listening platform as a successor to Microsoft Social Engagement (discontinued 16 Jan 2020, no direct replacement). The Social Listening / Insights subsystem is the first of four planned capability areas and the only one currently in build. Its Architecture Viewpoint boundary (see Section 4) is fixed by the 25 Accepted ADRs in `docs/adr/README.md`: a `ProviderConnector`-based ingestion pipeline (ADR-0002) normalizing posts into `SocialPost`/`Author` (ADR-0004), enforcing tenant isolation via Postgres Row-Level Security (ADR-0015) and per-`(tenantId, providerId)` rate limiting (ADR-0003), with credentials envelope-encrypted through Azure Key Vault (ADR-0014). The strategic boundary excludes the three downstream subsystems (Brand Reputation & Alerts, Social Care, Social Selling — Charter §3 "Out of Scope"), charting/dashboard visualization (ADR-0008), and — critically, per the 2026-07-30 governance brainstorm logged in `docs/adr/README.md` — a formal multi-tenant Admin/Tenant/User provisioning model, which does not exist in any ADR yet.

#### 1.2 Core Project Objectives & Measurable KPI Bounds

- Deliver a working, multi-tenant ingestion pipeline with at least one platform connector end-to-end — **met**: the Newswire connector (ADR-0024, Story 2.6, commit `0169143`) ingests real GlobeNewswire/PR Newswire RSS data, proven against live feeds, not fixtures.
- Prove the connector framework generalizes across social platforms and AI enrichment providers without core pipeline changes — **partially met**: generalized across ingestion connector *types* (poll, push, native-filter — ADR-0002/0006); the `AIProviderConnector` half is architecturally defined (ADR-0002) but has no real implementation yet (Phase 2's "also build, not storied" gap, `docs/implementation-plan.md`).
- Establish database-level multi-tenant isolation and full acquisition traceability from the start — **met at the code-contract level**: RLS proven by Story 5.4's contract, `IngestionRun` shipped as the immutable audit anchor (ADR-0005). `[MANDATORY GOVERNANCE CHALLENGE – Alternative Perspective: Business Case §8's own wording — "two tenants' data provably cannot cross-contaminate" — implies a runtime, two-live-tenant verification, not just a passing unit contract. Those are different bars; the contract-level bar is met, the operational bar is not yet demonstrated.]`
- Produce a REST API and event stream downstream subsystems can build on without re-deriving ingestion — **partially met**: `/v1/` API and thin event payload builders exist (ADR-0012/0017), but nothing in the real ingestion pipeline calls `publishEvent()` on an actual `IngestionRun`/`ConnectorHealth` state change yet (per the Story 5.5 log entry).

#### 1.3 BABOK Business Analysis Approach & Elicitation Methods

Elicitation in this project has no stakeholder panel to draw on — the Stakeholder Register (`docs/project docs/Stakeholder-Register.md`) names Menno as the sole internal stakeholder (Sponsor, Product Owner, Sole Developer). The actual elicitation chain is document-to-document extraction: a chat-conversation-derived design specification (`2026-07-28-social-listening-ingestion-design.md`) → 25 ADRs, each capturing one architecturally significant decision with its alternatives → 25 user stories, one per ADR → this document series (Spark Capture → Concept Validation → Ideation Enhanced → this document). `[AI-INFERRED DEFAULT PATTERN – Justification: BABOK's "elicitation methods" concept is mapped here to "document analysis" and "expert judgment" as its two closest formal BABOK technique matches, since no interviews/workshops/surveys occurred — a legitimate technique pairing for a solo-authored corpus, not an invented one.]` The one genuine external elicitation substitute that did occur: two independent rounds of third-party architectural review (Copilot, then Gemini), which surfaced ADR-0017/0019's originating gaps and ADR-0020–0023's four open decisions — functionally a peer-review elicitation technique standing in for a stakeholder workshop.

#### 1.4 BABOK Requirements Life Cycle Management Scheme

This project already runs a real, operating requirements lifecycle mechanism, not a placeholder one: `docs/adr/README.md`'s own governance table defines five distinct response types for how a decision (a "requirement" in BABOK terms) may change post-acceptance — new/superseding ADR, provenance note, Amendment Log entry, dated Clarification, or Pending-supersession/Supersession-update note — with the rule that "the original Decision and Consequences text is a historical record and stays put." One level below decisions, `docs/implementation-methodology.md` applies the identical discipline to Jest contracts: "a passing contract only changes via a dated note pointing to the ADR change that justifies it — never a silent edit." Traceability closes the loop through `docs/implementation-log.md`, whose entries are independently re-verified against git history by `docs/templates/check-implementation-log.cjs`, not merely asserted. This is a materially stronger requirements-traceability scheme than most solo projects operate under.

---

### SECTION 2: STAKEHOLDER MANAGEMENT & RACI REPRESENTATION

#### 2.1 Stakeholder Register

| Stakeholder | Category | Interest / Stake | Influence | Engagement Level |
|---|---|---|---|---|
| Menno | Internal | Sponsor, Product Owner, Sole Developer — owns vision, funds project, builds and maintains the system | High | Lead |
| Future end users / tenants | External (future) | Reliable ingestion, accurate sentiment, trustworthy data handling | Low (currently) | Monitor |
| Social platform providers (X, Reddit, YouTube, LinkedIn, Meta, RSS/Newswire) | External | ToS compliance, fair API use, not being treated as a scraping target | High — can revoke access or change pricing/terms unilaterally | Manage closely |
| Microsoft Azure | External / Vendor | Postgres, Key Vault, Service Bus, Blob Storage, AI Language usage within service terms | Medium | Keep informed |
| AI enrichment providers (Azure AI Language now; OpenAI/Claude potential future) | External / Vendor | API usage within terms | Medium | Keep informed — connector abstraction already isolates this dependency |
| Data subjects (authors of ingested social posts) | External / Indirect | Fair, lawful, privacy-respecting handling of their public data | Low (no direct relationship), ethically significant | Monitor / respect by design |
| Future collaborators / team members | Internal (future, TBD) | Clear architecture and documentation to onboard into | Low (currently) | Monitor |

#### 2.2 Communication Management Strategy & Routing Channels

No team-synchronization channel exists or is needed today — there is one practitioner. The real, already-operating communication mechanism is asynchronous and git-anchored: `docs/implementation-log.md` (append-only, one entry per completed story, git-hash-verified) and dated notes appended to ADRs serve as the continuity channel between one working session and the next, which `docs/implementation-methodology.md` states explicitly is *why* the whole document series exists ("context resets between sessions and this is a solo-developer project with no team memory to fall back on"). The one materialized external routing channel to date is the two rounds of third-party architectural review (Copilot, then Gemini) that fed directly into ADR-0017/0019–0023 and the deferred-findings list in `implementation-methodology.md`. `[MANDATORY GOVERNANCE CHALLENGE – Alternative Perspective: PMBOK's Communications Management domain assumes routing information between distinct human roles; here sender and receiver are the same person at different points in time. The genuinely load-bearing "communication" risk is not interpersonal but temporal — whether a future session (human or AI-assisted) can reconstruct context correctly from these artifacts alone, which is a documentation-completeness risk, not a stakeholder-routing one.]`

#### 2.3 RACI Matrix (Responsible, Accountable, Consulted, Informed)

| WBS Area | Menno (Initiative Lead) | Menno (Lead Solutions Architect) | Platform / Cloud Vendors (Azure, social & newswire providers) | Future Collaborators |
|---|:---:|:---:|:---:|:---:|
| 1.0 Repository & API Foundation | R/A | R/A | C | I |
| 2.0 Ingestion, Connectors & Rate Limits | R/A | R/A | C | I |
| 3.0 Data Model, Storage & Archival | R/A | R/A | I | I |
| 4.0 Derived Data, Analytics & Health | R/A | R/A | I | I |
| 5.0 Security, Isolation & Messaging | R/A | R/A | C | I |
| Multi-Tenant Admin/Tenant/User Model (ungoverned) | R/A | R/A | I | I |

`[MANDATORY GOVERNANCE CHALLENGE – Alternative Perspective: a RACI matrix's entire purpose is separating accountability across distinct actors so no single point of failure holds both R and A on every row. Here Menno holds R and A on every row of every WBS area, by structural necessity (Stakeholder Register: "Sole Developer") — the matrix is technically complete but analytically degenerate, and its real value is forward compatibility (a template to populate correctly the day a second contributor exists) rather than present-day risk distribution. This directly reinforces Risk R-03 (Section 7.2) rather than mitigating it.]` The "Platform / Cloud Vendors" column is Consulted where a connector's design must respect a specific provider's ToS/rate-limit/auth constraints (e.g., ADR-0024's RSS-only, no-OAuth Newswire scope), Informed elsewhere.

---

### SECTION 3: SCOPE, WBS, AND LIFECYCLE TAILORING ARCHITECTURE

#### 3.1 PMBOK Lifecycle Tailoring Baseline

This project tailors away from a predictive/waterfall baseline (fixed calendar, resourced schedule, EVM tracking — Charter §5 explicitly declines calendar dates: "milestones are sequenced by dependency, not by date") and away from fixed-length agile iterations (no sprint cadence exists). The baseline actually in force is **decision-gated, contract-verified delivery**: a phase (`docs/implementation-plan.md` Phases 0–5) closes when its stories' Jest contracts pass and the governing ADRs are Accepted — not on a date, and not on a story-point velocity. This is the foundational tailoring choice; Section 8.2 details how each individual PMBOK process group is concretely adapted under it.

#### 3.2 PMBOK Knowledge Area Mapping Matrix

| Knowledge Area | Current Project Mechanism | Reference |
|---|---|---|
| Integration Management | ADR series + git-hash-verified Implementation Log tie every decision to a shipped commit | Section 9.1 |
| Scope Management | Charter §3 In/Out-of-Scope boundary; only architecturally significant decisions get an ADR (25 total) | Section 3.3 |
| Schedule Management | Dependency-ordered Phases 0–5, deliberately no calendar dates | Section 3.5 |
| Cost Management | Business Case §5 cost table; no formal budget ceiling set yet | Section 3.6 |
| Quality Management | Contract-first TDD, permanent regression suite, three enforcement layers | Section 7.1 |
| Resource Management | Solo allocation — Menno holds every role | Section 3.7 |
| Communications Management | Git-anchored async log + two third-party review rounds | Section 2.2 |
| Risk Management | Business Case §7 / Charter §8 risks, expanded to a 4-row register here | Section 7.2 |
| Procurement Management | Azure pay-as-you-go only; no formal procurement process | Section 3.8 |
| Stakeholder Management | 7-entry Stakeholder Register | Section 2.1 |

#### 3.3 Project Scope Statement & High-Level Exclusions

**In scope (Phase 1, Charter §3):** connector framework (`ProviderConnector`/`SocialConnector`/`AIProviderConnector`); reference connectors starting with RSS/Newswire (shipped) and expanding toward X, Reddit, YouTube, LinkedIn, Meta; normalization into `SocialPost`/`Author`; enrichment via Azure AI Language; watchlist configuration (keyword/hashtag/account/boolean AST); multi-tenant Postgres with RLS; REST API and Service Bus events; a minimal admin UI.

**Strict exclusions:** Brand Reputation & Alerts, Social Care, and Social Selling subsystems (separate future charters); charting/topic-time-series visualization (ADR-0008); geocoding of free-text profile locations; author-expertise scoring beyond raw `AuthorTopicSignal` fields; CODEOWNERS/OpenAPI-first contract governance (explicitly deferred in `docs/adr/README.md` until a real downstream consumer exists); the distributed Redis-backed `RequestGate` state (ADR-0020, explicitly deferred until a second concurrent instance is actually deployed, not built speculatively).

#### 3.4 Work Breakdown Structure — Level 2 Code Identifiers

`[AI-INFERRED DEFAULT PATTERN – Justification: this project's 5 Epics (docs/user-stories/README.md) already partition all 25 ADR-derived stories into non-overlapping thematic groups with no other WBS ever having been drafted — applying PMBOK WBS Level 2 coding directly onto that existing, unmodified taxonomy is the smallest-inference mapping available, not a new decomposition invented for this document.]`

| WBS L2 Code | Name | Governing ADRs |
|---|---|---|
| 1.0 | Repository & API Foundation | 0001, 0016, 0017, 0025 |
| 2.0 | Ingestion, Connectors & Rate Limits | 0002, 0003, 0010, 0020, 0023, 0024 |
| 3.0 | Data Model, Storage & Archival | 0004, 0005, 0006, 0011, 0018, 0021 |
| 4.0 | Derived Data, Analytics & Health | 0007, 0008, 0009, 0022 |
| 5.0 | Security, Isolation & Messaging | 0012, 0013, 0014, 0015, 0019 |

#### 3.5 Schedule Milestones, Hard Deadlines & Critical Path Dependencies

Charter §5's M1–M7 remain dependency-sequenced, not calendar-dated. Actual status against them: M1 (repos scaffolded) through M6 (API & events live) all have shipped storied work per `docs/implementation-log.md`; M7 (Phase 1 review / go/no-go on a downstream subsystem) has not been formally executed. **No hard calendar deadlines exist** — `[MANDATORY GOVERNANCE CHALLENGE – Alternative Perspective: PMBOK's schedule-management mechanics assume at least a target end date to compute float/critical path against; Charter §5 explicitly declines one. The critical *path* is real and can be stated in dependency terms even without dates — but "hard deadlines" cannot be rendered here without inventing a date the project has deliberately never set, which the Anti-Consolidation and Verbatim Ingestion rules both forbid.]` The actual dependency-form critical path, per `docs/adr/README.md`'s own candidate-ADR ordering: (1) authentication mechanism → (2) Admin-tier RLS-exception design → (3) `tenants` table shape → (4) `users` table + RLS → (5) retiring the `X-Tenant-Id` placeholder → (6) connector connect/disconnect CRUD → (7) admin UI shape. Nothing past step (1) can be soundly built, since every later step assumes an authenticated caller identity that does not yet exist.

#### 3.6 Cost Management Framework & Allocated Budget Guardrails

Per Business Case §5: recurring costs are Azure Database for PostgreSQL, Key Vault, Service Bus, and usage-billed Azure AI Language; the dominant variable cost is paid-tier platform API access (X specifically named as ranging "tens to thousands of dollars per month" depending on read volume). **No formal budget ceiling has been set.** The one guardrail already recommended (Business Case §5) and still outstanding: define a monthly cost cap before connecting any paid-tier platform API, and continue prioritizing free/low-cost platforms (RSS/Newswire — already done; Reddit — not yet built) ahead of paid tiers. `[MANDATORY GOVERNANCE CHALLENGE – Alternative Perspective: PMBOK Cost Management assumes an approved cost baseline to measure variance against (this is also EVM's prerequisite, Section 7.1). None exists here by deliberate choice (self-funded, no external budget authority to approve one against) — so "guardrail" in this project means a spend ceiling that halts further build, not a baseline to report variance from.]`

#### 3.7 Human Resource Allocation & Project Team Composition

One resource: Menno, holding Sponsor, Product Owner, Lead Solutions Architect, sole Developer, sole Tester, and sole Operator roles simultaneously (Stakeholder Register). No other internal role is populated. Assumption A-01 (Charter §6) — sufficient available time outside ADPA and RPAS-Governance commitments — is this resource plan's single load-bearing constraint.

#### 3.8 Procurement Management Plan & Vendor Constraints

The only standing vendor relationship is Microsoft Azure, consumed pay-as-you-go under Azure's standard terms — no negotiated contract, RFP, or vendor-selection process exists or is warranted at this spend level. Each social/newswire platform is a data-API dependency, not a procurement relationship (no purchase order; access is governed by each platform's published API Terms of Service, per Stakeholder Register's "Manage closely" strategy). `[MANDATORY GOVERNANCE CHALLENGE – Alternative Perspective: PMBOK Procurement Management assumes a make-or-buy decision process and formal vendor agreements. Business Case §3's own Options-Considered analysis (Buy enterprise aggregator / Buy narrow SaaS / Build) is the closest real analog to a make-or-buy study this project has — and it already concluded "Build" for the core platform, leaving no procurement surface beyond commodity cloud consumption. Treating this field as materially empty is the honest answer, not an omission.]`

#### 3.9 Change Management Workflow & Approval Thresholds

A real, already-operating change workflow exists at the decision layer: `docs/adr/README.md`'s five-category table (new/superseding ADR; provenance note; Amendment Log entry; dated Clarification; Pending-supersession/Supersession-update note) governs how any Accepted ADR may change, with the explicit rule that original Decision/Consequences text is never edited in place. At the code layer, `docs/implementation-methodology.md` mirrors this: a passing contract changes only via a dated note citing the ADR change that justifies it. **Approval threshold:** since Menno is simultaneously proposer and approver, the operative control is procedural, not a second-signature — Story 2.5's log entry (`docs/implementation-log.md`, 2026-07-30) is a concrete precedent: implementation was explicitly paused for the user's sign-off before any already-shipped contract was touched, with the full blast radius traced first. That precedent — pause before touching shipped work, trace impact before asking — is this project's real approval threshold.

---

### SECTION 4: TOGAF ARCHITECTURE VIEWPOINTS & GAP DATA

#### 4.1 TOGAF Business Architecture Scope

**Viewpoint: Business Capability Viewpoint.** Business scope is the four-capability MSE-successor vision (Ideation Document §3): Social Listening / Insights (in build), Brand Reputation & Alerts, Social Care, Social Selling (all three explicitly deferred, `docs/implementation-plan.md`: "Not covered at all"). Within the in-scope capability, the business actor model is itself incomplete: `docs/adr/README.md`'s 2026-07-30 governance note records that no `tenants` table, `users` table, or Admin tier exists anywhere in the codebase — "tenant" is purely a `tenant_id` UUID convention. The brainstormed (undrafted) target actor model is three-tier: Platform Admin → Tenant (with a Tenant-Admin role) → Tenant User, invite-only onboarding gated by a per-tenant license/seat count.

#### 4.2 TOGAF Data & Application Architecture Frameworks

**Viewpoint: Data Dissemination / Application Communication Viewpoint.** Two applications: `social-listening-core` (TypeScript/Node.js backend — connectors, ingestion, enrichment, API, events) and `social-listening-admin` (Next.js, REST-only client of core — ADR-0001). Thirteen migrations shipped (`migrations/0001`–`0013`) implementing: `social_posts` (JSONB raw payload, monthly-range-partitioned by `created_at`, cursor via monotonic `seq`), `authors` (normalized once per platform account, ADR-0004), `ingestion_runs` (immutable audit anchor, partitioned, composite PK, FK to `social_posts` deliberately dropped after Postgres's `DETACH PARTITION` was found incompatible with a live cross-partition FK), `author_topic_signals` (plain table, hourly `pg_cron` refresh, not yet the "materialized view" ADR-0007 originally described), and `platform_credentials` (envelope-encrypted secrets plus a status field feeding auto-disable). See Section 6 for the DMBOK-level model detail.

#### 4.3 TOGAF Technology Architecture Viewpoint Metrics

**Viewpoint: Technology Standards Viewpoint.** Real, measured baseline: Postgres (RLS + monthly range partitioning — ADR-0016/0015/0018), Azure Key Vault (`social-listening-dev-kv`, resource group `social-listening-dev`, envelope encryption verified against the live instance), Azure Service Bus (`social-listening-dev` namespace, Standard tier, `social-listening-events` topic, per-tenant SQL subscription filters — ADR-0013, verified live), Azure Blob Storage (archival target for `rawPayload`/`IngestionRun`, ADR-0018), `pg_cron` on a custom Postgres 17 image (Story 4.4, no Alpine package existed so a Debian-based image was built). Measured system health as of the last log entry: **113/113** accumulated contract tests passing, **25/25** ADRs Accepted, **25/25** user stories with a logged, git-hash-verified commit.

#### 4.4 Gap Analysis — Baseline Architecture (Aᵦ) → Target Architecture (Aₜ)

| Dimension | Aᵦ (Baseline — shipped today) | Aₜ (Target — per ADR README's candidate list / Charter vision) | Delta |
|---|---|---|---|
| Authentication | None — `X-Tenant-Id` is an unauthenticated client-supplied header | A real authentication mechanism (candidate ADR #1) | Blocking — nothing downstream of it can be soundly built |
| Tenant provisioning | `tenant_id` UUID convention only, no `tenants` table | Three-tier Platform Admin → Tenant → Tenant User model (candidates #2–#4) | Not drafted |
| Connectors live | 1 (Newswire, ADR-0024) | Full roster: X, Reddit, YouTube, LinkedIn, Meta (spec §10) | 4 platforms, Reddit next per `docs/implementation-plan.md` |
| AI enrichment | `AIProviderConnector` interface defined, no real provider wired | Azure AI Language wired into ingestion (Phase 2 "also build" gap) | Not built |
| Eventing | Payload builders + real Service Bus infra exist | Ingestion pipeline actually calls `publishEvent()` on real state changes | Not wired |
| Downstream subsystems | None | Brand Reputation, Social Care, Social Selling each consuming this subsystem's API/events | Explicitly deferred, out of this document's scope |
| Distributed rate-gate | Single-instance in-process `RequestGate` | Redis-backed shared gate state (ADR-0020) | Deliberately deferred until a 2nd concurrent instance is real |

---

### SECTION 5: SABSA OPERATIONAL TRUST MODEL & BOUNDARIES

#### 5.1 SABSA Operational Trust Model Core Statement

No tenant's data, credentials, or derived signals are ever accessible to another tenant, and no caller is trusted with tenant-scoped data without first crossing two independently enforced boundaries: the **database session boundary**, where every tenant table carries a Postgres Row-Level Security policy keyed on `tenant_id` (ADR-0015), and the **secrets boundary**, where every stored platform credential is envelope-encrypted with a data key itself encrypted by a Key-Vault-held key-encryption key (ADR-0014). Trust is established at these two infrastructure boundaries, not asserted at the application layer alone — but this statement has one currently-unresolved precondition, stated explicitly in Section 5.2.

#### 5.2 SABSA Trust Boundary Mappings

- **Data-layer trust boundary:** RLS policy per `tenant_id`, present on every tenant table since Story 5.4 (ADR-0015). Verified by a passing contract, not yet load/chaos-tested with two live tenants (Phase 5, not started — `docs/implementation-plan.md`).
- **Secrets trust boundary:** Azure Key Vault-backed envelope encryption (ADR-0014), verified against a real Key Vault instance (Story 5.3).
- **Superuser/admin bypass boundary:** the migration role already holds a documented RLS superuser bypass; Story 4.4's `pg_cron` scheduled refresh job runs under that same admin role, flagged directly in its own log entry as "the still-missing sanctioned cross-tenant-batch-job bypass — now resolved for this one real case." This is a real, named exception to the trust model, not a hypothetical one, and it foreshadows candidate ADR #2 (an Admin-tier RLS exception "same shape as the migration role's existing superuser bypass").
- **Caller-identity trust boundary — currently open:** `X-Tenant-Id` is a client-supplied, unauthenticated placeholder header (per the 2026-07-30 governance brainstorm). `[MANDATORY GOVERNANCE CHALLENGE – Alternative Perspective: this is the model's actual weak point. RLS correctly isolates tenants once a tenant_id claim is trusted, but nothing in the current architecture authenticates that claim — a caller can assert any tenant_id today. The trust model's own strength at the data and secrets layers is real, but is currently anchored on an unauthenticated input, which is a materially different risk posture than the confident tone of Section 5.1's core statement alone would suggest.]`

#### 5.3 SABSA Security Requirement Traceability Matrix

| Business Driver Code | Target Security Objective | Implied Threat Scenario | Prescribed Security Control Mechanism |
| :--- | :--- | :--- | :--- |
| **BD-01** | Guarantee database-level tenant isolation | A compromised or misconfigured application-layer filter leaks another tenant's posts or credentials | Postgres Row-Level Security enforced per `tenant_id` on every tenant table (ADR-0015), verified by Story 5.4's contract test |
| **BD-02** | Guarantee every ingested record is traceable to its exact acquisition process and moment (the anti-"MSE black box" driver) | Silent data loss or unverifiable provenance if an ingestion attempt's outcome isn't recorded, including abandoned/dead-lettered attempts | `IngestionRun` immutable audit anchor (ADR-0005), extended to record queue-TTL abandonment and per-request dead-lettering (ADR-0020) |
| **BD-03** | Prevent tenant platform credentials from being recoverable from a database compromise alone | Database breach exposing plaintext OAuth tokens or API keys, enabling attacker impersonation on the connected platform | Envelope encryption via Azure Key Vault — data key encrypted by a Key-Vault-held key-encryption key (ADR-0014), verified against a real Key Vault instance (Story 5.3) |
| **BD-04** | Authenticate every API caller and bind them to exactly one tenant before granting access | `X-Tenant-Id` is a client-supplied, unauthenticated placeholder — any caller can currently claim any `tenant_id` | `[MANDATORY GOVERNANCE CHALLENGE – Alternative Perspective: no control exists yet. This is the project's most significant open trust-boundary gap — candidate future ADR #1 ("authentication mechanism — blocks everything else," per docs/adr/README.md's own dependency ordering) is a hard prerequisite, not an optional hardening pass.]` |

#### 5.4 Security Control Matrix: Strategy-to-Component Linkage

BD-01 → `social-listening-core/migrations/0002_enable_rls_social_posts.sql` and equivalent RLS-enabling migrations, enforced through `src/db/withTenant.ts`. BD-02 → `src/ingestion/ingestionRunStore.ts` and `src/ingestion/runIngestionAttempt.ts`. BD-03 → `src/credentials/envelopeEncryption.ts`, `src/credentials/keyVaultProvider.ts`, `src/credentials/credentialStore.ts`. BD-04 → no component exists; the nearest present-day artifact is the literal string `X-Tenant-Id` in `social-listening-core/src/http`, which candidate ADR #1 and #5 (retire the placeholder) would replace.

---

### SECTION 6: DATA GOVERNANCE & METADATA STANDARDS (DMBOK)

**Data Governance Policy & Stewardship Roles:** No formal DMBOK-chartered data governance body or named Data Steward role exists. `[AI-INFERRED DEFAULT PATTERN – Justification: Stakeholder Register's "Sole Developer" role is the only entity with authority over data model, retention, and access decisions, so it is the de facto Data Steward by elimination, not an invented title.]` The operative governance policy that does exist and is real: full raw-payload retention (`rawPayload` JSONB, 90 days, ADR-0018) specifically to avoid the "black box" criticism levelled at MSE (Ideation Document §4); tiered `IngestionRun` retention (18 months, configurable) with monthly range partitioning as the archival mechanism for both `social_posts` and `ingestion_runs`; explicit ethical stewardship commitments in the Stakeholder Register toward data subjects (authors of ingested posts) — "retain only what's needed, respect platform ToS on data use, avoid resolving free-text location into precise geodata, no repurposing beyond stated listening/insights use."

**Data Architecture & Model Specifications:** Core entities, all shipped: `SocialPost` (JSONB `raw_payload`, `enrichment` fields added Story 4.2, monotonic `seq` for cursor pagination after a millisecond/microsecond precision bug was caught by Story 3.4's own contract, partitioned monthly by `created_at` since `publishedAt` is nullable and cannot be a partition key — a Postgres-forced deviation logged in ADR-0018's Amendment Log); `Author` (normalized once per platform account, ADR-0004, issuer-as-Author modeling added for Newswire by ADR-0024); `IngestionRun` (immutable audit anchor, ADR-0005, partitioned, composite PK, FK to `SocialPost` dropped due to a real Postgres `DETACH PARTITION` constraint); `AuthorTopicSignal` (raw signals only, no computed expertise score, ADR-0007, hourly `pg_cron`-refreshed, ADR-0022); `PlatformCredentials` (envelope-encrypted, status field driving auto-disable). Thirteen migrations (`0001`–`0013`) constitute the full shipped schema as of the last Implementation Log entry.

---

### SECTION 7: RISK REGISTER & QUALITY CONTROL

#### 7.1 Quality Metrics and EVM Rules

**Quality control mechanism (real, operating):** contract-first TDD — a Jest contract encoding each story's Acceptance Criteria is written *before* implementation, mechanically enforced in real time by a `PreToolUse` hook (`enforce-contract-first.cjs`) that blocks writes to `<repo>/src/**` until a contract exists, backed by a pre-commit hook and CI/branch-protection as two further layers. Contracts are permanent regression guards — never deleted, only superseded with a dated note. Self-healing on failure follows a fixed five-step re-validation sequence (Intent → Contract → SKILL.md → Implementation → full-suite validation) with a hard rule against weakening any check to reach green, and a bounded-retry cap of 3 full walks per failure before mandatory escalation. Measured quality state: 113/113 accumulated contracts passing.

**EVM (Earned Value Management):** `[MANDATORY GOVERNANCE CHALLENGE – Alternative Perspective: standard EVM (Planned Value, Earned Value, Actual Cost, CPI, SPI) requires a resourced, time-phased cost/schedule baseline. Charter §5 explicitly declines calendar dates and Business Case §5 explicitly declines a budget ceiling — both prerequisites for EVM are deliberately absent, by the same solo/self-funded reasoning that declined a distributed rate-limit gate before it was needed (ADR-0020). Computing a literal CPI/SPI here would require fabricating a baseline that does not exist, which the Anti-Consolidation and Verbatim Ingestion rules both forbid.]` The nearest legitimate adapted proxy: `[AI-INFERRED DEFAULT PATTERN – Justification: story-count is the only quantity this project already tracks consistently across its own artifacts (ADR README, user-stories README, Implementation Log), so it is the least-invented substitute for a cost-based EV curve.]` — **story-based earned value:** 25/25 storied Acceptance-Criteria-bearing stories shipped (100% of ADR-mapped scope); un-storied "also build" scope (real Reddit/X/YouTube/LinkedIn/Meta connectors, AI-provider wiring, admin UI screens beyond the Phase 1 minimum, event-publish wiring) remains unquantified since it was deliberately never broken into ADRs (`docs/implementation-plan.md`: "ordinary CRUD surface... was never architecturally interesting enough to warrant its own ADR, but it's real, necessary work").

#### 7.2 PMBOK Risk Register Matrix

| Risk ID | Targeted System / Asset | Risk Description | Measurable Trigger Condition | Time-Bound Operational Impact State | Escalation Path |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R-01** | Paid-tier platform API connectors (e.g., X) | Platform API pricing or ToS policy changes make a connector economically or technically infeasible (Business Case §7) | A targeted platform's published API terms change after a connector is scoped but before it ships, or monthly platform-API spend exceeds the (not-yet-set) monthly cost cap | Affected connector's `ConnectorHealth` trips to `failing` within one polling cycle under ADR-0023's proportional rule (≥50% of ≥5 attempts, or ≥20 consecutive failures), auto-disabling that platform's ingestion per tenant | Menno (Initiative Lead) — sole tier |
| **R-02** | Four-subsystem roadmap (Listening + 3 deferred subsystems) | Scope creep across subsystems outruns solo development bandwidth (Charter §8) | A second subsystem's charter is drafted before Business Case §8's four Phase-1 success criteria are all independently verified against Milestone M7 | Phase 1 review gate (M7) is bypassed; downstream work begins against an unvalidated architectural bet | Menno (Initiative Lead) |
| **R-03** | All solo delivery capacity (5 epics, 25 ADRs) | Solo-developer bus factor — no redundancy if Menno's availability changes (Charter §8) | `[AI-INFERRED DEFAULT PATTERN – Justification: Charter Assumption A-01 ("sufficient available time") was never numerically quantified, so the nearest observable leading indicator already present in this project's own artifacts is used as the trigger proxy instead of inventing a threshold.]` A gap exceeding 30 days between consecutive `docs/implementation-log.md` entries | Documentation (ADRs, SKILL.mds, Implementation Log) is the only asset that survives a bus-factor event — total project pause, not degraded throughput, since no team exists to absorb continuity | Menno — no Tier 2 exists |
| **R-04** | `social-listening-core`'s tenant-authentication boundary (`X-Tenant-Id` header) | No authentication mechanism exists; `X-Tenant-Id` is a client-supplied, unauthenticated placeholder (2026-07-30 governance brainstorm) | Any caller beyond Menno's own local testing is granted network access to a deployed `social-listening-core` instance before candidate ADR #1 is drafted and accepted | Immediate cross-tenant data exposure via `tenant_id` spoofing — RLS correctly isolates tenants once `tenant_id` is trusted, but nothing today authenticates that claim | `[MANDATORY GOVERNANCE CHALLENGE – Alternative Perspective: this is arguably mis-classified as a probabilistic "risk" at all — it is a certain, currently-open gap (100% likelihood the moment any real external deployment occurs), and belongs on a release-blocking dependency list rather than a risk register once external users are contemplated.]` Menno — hard release gate |

---

### SECTION 8: LIFECYCLE MANAGEMENT & ROADMAPS

#### 8.1 Strategic Next Steps & Quick Wins

1. **Draft candidate ADR #1 (authentication mechanism).** Per `docs/adr/README.md`'s own dependency ordering, this blocks every other multi-tenant governance ADR (#2–#7) and directly closes Risk R-04 and SABSA gap BD-04.
2. **Set the monthly platform-API cost cap (Business Case §5).** Zero engineering cost, directly gates Risk R-01, and is the one outstanding action item from the Business Case that has never been executed.
3. **Close the Phase 1–3 "also build, not storied" gaps:** a second real connector (Reddit, per `docs/implementation-plan.md`'s stated order), watchlist/connector CRUD REST endpoints, the admin UI's connect/watchlist/status screens, the real `AIProviderConnector` (Azure AI Language) implementation wired into the ingestion pipeline, and wiring `publishEvent()` into real `IngestionRun`/`ConnectorHealth` state changes.
4. **Execute Milestone M7 (Phase 1 review)** once Business Case §8's four success criteria are independently re-verified — three are code-contract-verified today; the fourth ("two tenants' data provably cannot cross-contaminate") still needs the live two-tenant runtime proof flagged in Section 1.2.

#### 8.2 PMBOK Lifecycle Tailoring Adaptations

| Standard PMBOK Mechanic | Adaptation In Force Here |
|---|---|
| Formal WBS with resourced work packages | Epics reused as WBS L2 (Section 3.4); no work-package-level resourcing, since one resource exists |
| Time-phased schedule baseline / critical path with dates | Dependency-ordered phase sequencing only (Section 3.5); no dates by deliberate Charter §5 choice |
| Earned Value Management | Not used — no cost/schedule baseline exists to measure against (Section 7.1); story-completion ratio used as an adapted proxy |
| Formal Quality Management Plan + QA gate reviews | Replaced by contract-first TDD + 3 mechanical enforcement layers (Section 7.1) — arguably stricter than a review-based QA gate, since it is tool-enforced rather than advisory |
| Change Control Board approval | Replaced by the ADR Amendment/Supersession convention (Section 3.9) — same practitioner proposes and approves, but every change is dated, appended (never edited in place), and cross-referenced |
| Closing process / formal sign-off | Replaced by an Implementation Log entry, independently re-verified against git by `check-implementation-log.cjs` — closure is machine-checkable, not just asserted |

---

### SECTION 9: ARCHITECTURAL DECISION LOGS

#### 9.1 Formal Decision, Alternative Analysis & Rationale Log

**Decision — Build vs. Buy (Business Case §3–4).** Alternatives: (A) buy an enterprise aggregator (Brandwatch/Meltwater) — fastest time-to-value, but reintroduces the "black box"/vendor-lock-in problem this project exists to avoid; (B) buy a narrow single-platform SaaS tool — cheaper, but no multi-tenant/connector architecture and no extensibility to the three downstream subsystems; (C) build (chosen) — full ownership, swappable AI provider, connector pattern scales without redesign, at the cost of solo build/maintenance burden and slower time-to-value. **Rationale:** phase the investment — validate the Listening/Insights subsystem alone (including one working connector end-to-end) before committing further time to the other three subsystems, explicitly limiting exposure if solo bandwidth or platform-API cost turns out more constraining than expected.

**Decision — Newswire provider selection (ADR-0024).** Alternatives traced through two revisions: an initial RTPR (paid wire service) candidate → dropped entirely after real pricing research → direct wire-service RSS (GlobeNewswire + PR Newswire), free, `authMode: 'none'`. **Rationale:** two follow-up deep-research passes (~25 additional provider candidates) found nothing that beat the accepted free-RSS scope; the accepted design also introduced a scoped `Author`-modeling exception (issuer-as-Author) the original 23-ADR series hadn't anticipated.

**Decision — Distributed rate-limit gate state, build-now vs. defer (ADR-0020).** Alternatives: build the Redis-backed distributed `RequestGate` immediately (uniform correctness under any future concurrency) vs. ship the single-instance in-process gate first and defer the distributed half. **Rationale (chosen: defer):** the distributed half is only load-bearing once a second concurrent `social-listening-core` instance actually runs — a condition with no team-driven scaling pressure behind it in a solo deployment, and which may never arise. Building it speculatively would add a new operational dependency (Redis) with no current correctness gap to justify it; the single-instance gate already satisfies ADR-0003 correctly on its own.

**Decision — Proportional vs. flat connector auto-disable threshold (ADR-0023, superseding part of ADR-0010).** Alternatives: keep the flat "≥10 failures/hour" rule already shipped in Stories 2.3/4.3, or move to a rate-relative rule. **Rationale (chosen: rate-relative — ≥50% of ≥5 attempts, or ≥20 consecutive failures):** a flat count treats a slow-moving, low-volume connector and a high-volume one identically, which is unfair to differently-paced connectors. Before implementation, the exact blast radius on already-shipped contracts was traced precisely (Story 4.3 needed zero changes; only one assertion in Story 2.3's AC4 was fundamentally incompatible with any rate-based rule) and the user's explicit sign-off was obtained before any shipped contract was touched — the trade-off being a deliberately delayed migration (Story 2.5 scheduled to Phase 4, not built immediately alongside ADR-0023's acceptance) so the healing could be scoped and reviewed rather than rushed.

---

## Provenance & Completeness Self-Assessment (33-Field Registry)

| Field | Status | Weight |
|---|---|---|
| F01 Project Name & Metadata Alignment | Sourced | 1 |
| F02 Executive Summary & Boundaries | Sourced | 1 |
| F03 PMBOK Lifecycle Tailoring Baseline | Sourced + 1 inference | 1 |
| F04 PMBOK Knowledge Area Matrix | AI-Inferred structure, sourced content | 1 |
| F05 Stakeholder Register | Sourced (verbatim from Stakeholder-Register.md) | 1 |
| F06 Communication Strategy | Sourced + 1 governance challenge | 1 |
| F07 Objectives & KPI Bounds | Sourced + 1 governance challenge | 1 |
| F08 Scope Statement & Exclusions | Sourced | 1 |
| F09 WBS Level 2 Codes | AI-Inferred (epic→WBS mapping) | 1 |
| F10 Schedule Milestones & Critical Path | Sourced + 1 governance challenge (no dates exist) | 1 |
| F11 Cost Management Framework | Sourced + 1 governance challenge | 1 |
| F12 EVM Metric Tracking Rules | Governance-challenged; no baseline exists to compute real EVM | 0.5 |
| F13 Quality Management Policy | Sourced (contract-first TDD, 3 enforcement layers) | 1 |
| F14 HR Allocation & Team Composition | Sourced | 1 |
| F15 RACI Matrix | Sourced + 1 governance challenge (degenerate single-actor case) | 1 |
| F16 Procurement Plan & Vendor Constraints | Sourced + 1 governance challenge (structurally thin) | 1 |
| F17 Change Management Workflow | Sourced (ADR Amendment/Supersession convention) | 1 |
| F18 TOGAF Business Architecture Scope | Sourced | 1 |
| F19 TOGAF Data & Application Architecture | Sourced | 1 |
| F20 TOGAF Technology Viewpoint Metrics | Sourced (real measured 113/25/25 baseline) | 1 |
| F21 SABSA Trust Model Core Statement | Sourced (derived from ADR-0014/0015) | 1 |
| F22 SABSA Trust Boundary Mappings | Sourced + 1 governance challenge (BD-04 gap) | 1 |
| F23 SABSA Traceability Matrix — BD-01 row | Sourced | 1 |
| F24 SABSA Security Control Matrix | Sourced (real file/component names from Implementation Log) | 1 |
| F25 BABOK BA Approach & Elicitation | Sourced + 1 inference (BABOK technique naming) | 1 |
| F26 BABOK Requirements Lifecycle Mgmt | Sourced | 1 |
| F27 DMBOK Data Governance & Stewardship | Sourced + 1 inference (de facto Steward title) | 1 |
| F28 DMBOK Data Architecture & Model Specs | Sourced | 1 |
| F29 Risk Register — R-01 | Sourced | 1 |
| F30 Risk Register — R-02 / R-03 | Sourced + 1 inference (R-03 trigger proxy) | 1 |
| F31 Strategic Next Steps & Quick Wins | Sourced | 1 |
| F32 PMBOK Lifecycle Tailoring Adaptations | Sourced | 1 |
| F33 Decision, Alternative Analysis & Rationale Log | Sourced (4 real, already-made decisions) | 1 |

**C = 32.5 / 33 ≈ 0.985.** This exceeds the declared Structuring-phase target (C ≥ 0.90) and would satisfy Audit-phase's stricter bar as well were it not for F12: no `[TBD]`/`[TO BE CONFIRMED]` token appears anywhere in this document — every gap is rendered through one of the two mandated provenance tags rather than left bare — but F12 (EVM) is scored at 0.5 rather than 1 because a genuine PMBOK-standard EVM calculation is structurally impossible without fabricating the cost/schedule baseline this project has deliberately never set, and no amount of tagging converts an impossible calculation into a complete one.
