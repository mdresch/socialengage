# Developer Learning Plan

**Owner:** Menno Drescher  
**Maintained by:** `personal-development-reviewer` agent (`.claude/agents/personal-development-reviewer.md`), append-only  
**Queue file:** `docs/pending-personal-development-reviews.md` (populated by `scripts/git-hooks/post-commit`)  
**Last updated:** 2026-09-09

> **Discipline:** This file is append-only. Existing entries are never edited or deleted — assessments, goals, and progress notes are dated and accumulated over time so the growth trajectory remains readable. A new "Current Skills Inventory" snapshot replaces the previous one by appending a new dated snapshot section, not by editing the old one. See `.claude/agents/personal-development-reviewer.md` for the charter.

---

## Skills Inventory — 2026-09-09

Derived from `docs/implementation-log.md`, `docs/adr/README.md`, and real git history across `social-listening-core/` and `social-listening-admin/` as of this snapshot.

### Languages & Runtimes
- **TypeScript / Node.js** — primary throughout; real, contract-verified production use across all epics (Phases 0–4.5, Epics 6–9, 13–14). Strong.
- **SQL / PostgreSQL** — multi-tenant schema design with database-level RLS from day one (ADR-0015); real migrations, `withTenant()` query helpers, materialized views (precomputed-analytics-views skill). Strong.
- **Shell scripting (POSIX sh)** — post-commit hook (`scripts/git-hooks/post-commit`), setup scripts, CI workflow steps. Moderate.
- **JavaScript (ESM/CJS)** — auxiliary scripts (`scripts/synthesize-telemetry.mjs`, `docs/ai-roles/scripts/*.mjs`, `docs/templates/check-implementation-log.cjs`). Moderate.

### Frameworks & Libraries
- **Next.js (App Router)** — full admin UI (`social-listening-admin/`), BFF session pattern (ADR-0036), role-gated routing, server actions. Strong (Epics 6–8, 40+ stories).
- **Jest** — contract-first TDD discipline enforced across all stories; per-run Postgres template-database cloning for isolation (ADR tracked in `docs/implementation-methodology.md`). Strong.
- **Express / Node.js HTTP** — REST API backend (`social-listening-core/`) with versioned routing, RLS, connector framework. Strong.
- **React** — UI components inside Next.js; real-time inbox, composers, analytics dashboard. Moderate–strong.

### Cloud & Infrastructure (Azure-native)
- **Azure PostgreSQL + RLS** — core data store; multi-tenant isolation, real provisioned instance. Strong.
- **Azure Key Vault** — credential envelope encryption (ADR-0028 / credential-envelope-encryption skill); real Key Vault, not mocked. Strong.
- **Azure Service Bus** — ingestion event pipeline, wired to real polling scheduler (Story 5.19 / ingestion-events skill). Moderate–strong.
- **Azure Blob Storage** — async export jobs (ADR-0111 / export-jobs skill), 7-day lifecycle policy, SAS presigned URLs. Moderate.
- **Azure Entra External ID** — real Entra-backed authentication (ADR-0033, Story 5.10), bearer-token resolution, `GET /v1/me`, role-gating. Strong.
- **Azure AI Language** — first real `AIProviderConnector` implementation (enrichPost, sentiment, entity extraction). Moderate–strong.
- **Azure OpenAI (GPT-5-mini)** — second real `AIProviderConnector`; structured/JSON-schema-constrained output; also powers Composer Deep Research `research?()` (Stories 2.31–2.32). Moderate.
- **Azure AI Foundry Prompt Agents** — three real portal-authored agents wired via `invoke-azure-foundry-agent.mjs`; Entra/DefaultAzureCredential auth pattern (not API-key). Moderate (operational; not yet building new agents programmatically).

### Architectural Patterns
- **Contract-first TDD** — contracts in `contracts/` gate implementation; `enforce-contract-first.cjs` hook mechanically blocks premature writes; real green/red suite discipline across 100+ stories. Strong.
- **Multi-tenant SaaS with database-level isolation** — from-day-one property, not retrofitted; RLS, `withTenant()`, tenant-scoped credential ownership (ADR-0028). Strong.
- **Connector framework / provider abstraction** — nine real connectors (ingestion + enrichment), capability-matrix taxonomy, authMode tiers (public/OAuth/service), activation state machine. Strong.
- **Outbound engagement framework** — `reply?()`/`publish?()` protocol, real Facebook/LinkedIn implementations, outbound audit tables, rate-limit gates (Stories 2.26–2.32, ADR-0073/0075). Moderate–strong.
- **Append-only / event-sourced logging** — implementation log, queue files, manager register, time tracking; design discipline reproduced consistently across governance artifacts. Strong (design discipline); moderate (formal event-sourcing in application code).
- **ADR-driven decision records** — 121 real ADRs, most Accepted; clear "hard-to-reverse" threshold; cross-referenced against BRDs, FDDs, stories, and SKILL.md files. Strong.
- **Privacy-preserving audit architecture** — hash-chaining, cryptographic audit log, compliance evidence bundle (ADR-0127, Story 16.3 / compliance skill). Moderate (designed and built; limited operational experience).
- **RAG pipeline** — vector embeddings, RLS-scoped retrieval, chunking, Azure OpenAI integration (rag-vector-rls, rag-chunking-pipeline, rag-connector skills). Moderate.

### Social / Third-Party Connectors
- **Facebook Graph API** — OAuth flow, Page attribution, real `reply()`/`publish()` (Stories 2.15/2.27/2.30). Moderate–strong.
- **LinkedIn API** — OAuth, real publish flow (Stories 2.25/2.29). Moderate.
- **Instagram Graph API** — ingestion connector (Story 2.24). Moderate.
- **GNews / Newswire RSS / tenant-owned-feed** — ingestion connectors, live polling scheduler. Moderate–strong.
- **Brave Search / Bing Search** — active watchlist-sourcing search connectors, one-off research helpers (ADR-0065/0066). Moderate.
- **Wikipedia** — read-only ingestion connector (ADR-0042). Moderate.
- **Mistral / Gemini / Ollama** — external AI-role automation scripts (not application connectors); real API calls with findings registers. Moderate (operational scripting).

### AI / ML
- **LLM prompt engineering** — Foundry Prompt Agent authoring, system instruction design across all six external reviewer roles. Moderate.
- **Structured output / JSON schema constraints** — Azure OpenAI `response_format`, ADR-0103 confidence tiering. Moderate.
- **Topic clustering and embeddings** — ADR-0104 AI topic clustering, `post_topics` junction, 7-day rolling refresh. Moderate.

### Tooling & Process
- **Git hooks + enforcement** — `enforce-contract-first.cjs` (PreToolUse), `post-commit` (queue + telemetry + Second Brain sync). Strong.
- **CI/CD** — real GitHub Actions CI, contract-suite green gate. Moderate.
- **Obsidian Second Brain + Dataview** — automated sync via `sync-committed-to-secondbrain.mjs`; Knowledge Graph view. Moderate (operator); light (builder).
- **Solo-project governance** — Business Case, Charter, Stakeholder Register, nine PM Plans; AI-role roster across eleven domain-pull reviewers. Moderate–strong.

---

## Learning Goals — 2026-09-09

These are intentional growth areas, not gaps in delivered work — the skills inventory above reflects real, shipped capability, not aspirational claims.

### Near-term (Epics 9–14 roadmap horizon)

1. **Real-time / event-driven architecture at scale** — the ingestion pipeline and Service Bus integration are built; next growth area is stateful stream processing patterns (backpressure, exactly-once delivery, replay) as ingestion volume grows. Directly relevant to live-ingestion-polling-scheduler, Service Bus, and the alert-rules infrastructure.
2. **Vector search depth** — RAG pipeline is operational; deepen understanding of embedding model selection, index tuning, hybrid sparse+dense retrieval, and RLS-safe vector queries. Relevant to composer-research, mention-suggestions, influencer-discovery.
3. **LLM agent orchestration patterns** — Foundry Prompt Agents are operational via script; next growth area is programmatic multi-step agent chains (tool use, plan-and-execute, structured reasoning traces). Relevant to Composer Deep Research (ADR-0076) and any future AI-heavy stories.
4. **Outbound publishing reliability** — Facebook/LinkedIn `publish()` is built; growth area is retry semantics, idempotency keys, partial-batch failure handling, and rate-limit hedging at a multi-platform scale. Relevant to additional-publishing-roadmap skill.
5. **PostgreSQL performance at multi-tenant scale** — strong on schema design and RLS; growth areas include query plan analysis, partial indexes for tenant-scoped access patterns, and connection-pool tuning as tenant count grows.

### Medium-term (post-Epic 14 / v2 horizon)

6. **Kubernetes / container orchestration** — current Azure deployment is not containerized; growth area if the project ever moves to AKS or container-based hosting.
7. **Formal privacy-preserving computation** — hash-chaining and audit log are built (ADR-0127); deeper growth area is differential privacy, secure multi-party computation, and zero-knowledge proofs for more advanced compliance scenarios.
8. **Mobile / cross-platform client** — all current UI is web (Next.js); no mobile experience exists. If a mobile client ever becomes a real goal, React Native or progressive web app patterns would be the natural growth area.

---

## Progress Notes (append-only)

### 2026-09-09 — Initial snapshot (personal-development-reviewer)

First snapshot seeded from real implementation history. Observation: the skills inventory is deep on the Azure-native, multi-tenant SaaS, and contract-first TDD domains, which directly reflects nine months of focused build across ~14 epics and 121 ADRs in a single, coherent product. The breadth of connector integrations (nine real connectors, three AI providers, six external AI-reviewer roles) is a genuine distinguishing capability — fewer solo projects accumulate real OAuth flows, real cloud services, and real AI connector implementations all in one codebase.

The identified growth areas are honest: event-driven scale, vector search depth, and LLM orchestration are adjacent to work already shipped (they're the "next hard problem" in each respective area), not disconnected aspirations. The three medium-term goals (Kubernetes, formal privacy computation, mobile) are genuinely speculative at this project's current stage and should not be treated as active commitments.

**No action required from this snapshot beyond committing it as a baseline.**
