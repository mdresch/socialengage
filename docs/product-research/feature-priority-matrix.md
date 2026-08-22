# Feature Priority Matrix

**Purpose:** a one-page scoring of all 26 feature designs in `docs/product-research/feature-designs/` by **impact**, **effort**, and **dependency risk**, with a recommended action. Built from the 2026-08-23 feature and stakeholder mapping pass.

**Scoring:**
- **Impact:** how much value the feature creates for the primary personas and the business.
- **Effort:** implementation cost, including backend, frontend, contract tests, and operational work.
- **Dependency risk:** how many other features, ADRs, or external APIs must already exist or be stable.

**Recommendation categories:**
- **Build now** — high impact, manageable effort and risk.
- **Needs ADR** — valuable but needs a cross-cutting architecture decision first.
- **Defer v2** — useful, but best after v1 is stable or after prerequisite features ship.
- **Park** — low impact or high effort/risk for the current phase.

---

| # | Feature | Primary personas | Impact | Effort | Dependency risk | Recommendation | Why |
|---|---------|------------------|--------|--------|-----------------|----------------|-----|
| 01 | Multi-source ingestion | Tenant-Admin, Sole-Operator, Tenant-User, Social-Selling-Strategist | High | Medium | Medium | **Build now** | Core to the platform; already partially built and other features depend on it. |
| 02 | Boolean query builder | Tenant-Admin, Tenant-Business-Analyst, Tenant-User, Topic-Center-Analyst | High | Medium | Medium | **Build now** | Required for watchlists; prerequisite for `05`, `08`, `20`. |
| 03 | AI sentiment analysis | Tenant-Brand-Reputation-Manager, Tenant-Reader, Tenant-User | High | Medium | Low | **Build now** | Adds immediate value to every post; no new infrastructure beyond `AIProviderConnector`. |
| 04 | AI topic clustering | Topic-Center-Analyst, Tenant-Brand-Reputation-Manager, Social-Selling-Strategist | High | Medium | Medium | **Build now** | Feeds `08`, `13`, `25`, `26`; needs `AuthorTopicSignal` stable. |
| 05 | Influencer discovery | Social-Selling-Strategist, Topic-Center-Analyst, Tenant-Brand-Reputation-Manager | Medium-High | Medium | Medium | **Build now** | Builds directly on `04` and `AuthorTopicSignal`; strong enterprise use case. |
| 06 | Unified social inbox | Tenant-Social-Care-Agent, Tenant-User | High | High | High | **Defer v2** | Requires real `SocialConnector.reply?()` for multiple platforms; big UI and workflow surface. |
| 07 | Publishing and scheduling | Tenant-User, Tenant-Social-Care-Agent | High | High | High | **Defer v2** | Complex state machine, per-platform media limits, and `SocialConnector.publish?()` for each platform. |
| 08 | Dashboards and analytics | Tenant-Reader, Tenant-Business-Analyst, Topic-Center-Analyst | High | Medium | Medium | **Build now** | `Epic 8` already underway; needed for product usability. |
| 09 | Real-time alerts | Tenant-Brand-Reputation-Manager, Tenant-Social-Care-Agent, Platform-Admin, Sole-Operator | High | Medium | Medium | **Build now** | Operational and brand-safety critical; depends on `08` and `02`. |
| 10 | Data export | Tenant-Business-Analyst, Author-of-a-Post, Data-Subject, Legal-Advisor | High | Medium | Medium | **Build now** | Compliance and analysis must-have; needed for `14`, `15`, `16`. |
| 11 | API and integrations | Tenant-Business-Analyst, Platform-Admin | High | Medium | Medium | **Build now** | Unlocks enterprise integrations; needed for `23`, `24` webhooks. |
| 12 | Multi-user workspaces and RBAC | Platform-Admin, Tenant-Admin, Legal-Advisor | High | High | High | **Build now** | Foundation for everything multi-tenant; already in flight. |
| 13 | Composed post author mention suggestions | Tenant-User, Social-Selling-Strategist, Tenant-Brand-Reputation-Manager | Medium | Medium | Medium | **Defer v2** | Nice-to-have for v1; depends on `07`, `04`, `05` being solid. |
| 14 | Author-initiated takedown | Author-of-a-Post, Data-Subject, Legal-Advisor | Medium | Medium | High | **Needs ADR** | Public, unauthenticated surface + DSR workflow; needs legal/ToS architecture. |
| 15 | DSR self-service portal | Data-Subject, Legal-Advisor, Tenant-Admin | Medium | High | High | **Needs ADR** | Cross-table export/erasure; tightly coupled to `10` and `12`. |
| 16 | Compliance audit pack | Legal-Advisor, Platform-Admin, Tenant-Admin | Medium | Medium | High | **Defer v2** | Requires `10`, `12`, `09` logs mature and `14`/`15` workflow defined. |
| 17 | Platform operations dashboard | Sole-Operator, Platform-Admin | Medium | Medium | Medium | **Build now** | Critical for go-live and cost control; can reuse `09` and `08` widgets. |
| 18 | Prospecting list | Social-Selling-Strategist, Tenant-Business-Analyst | Medium | Low | Low | **Build now** | Simple `watchlist`-style CRUD; builds on `05`. |
| 19 | Self-service onboarding checklist | Tenant-Admin, Sole-Operator | High | Low | Low | **Build now** | Fast win for activation and self-service; pure UI over existing endpoints. |
| 20 | Crisis threshold wizard | Tenant-Brand-Reputation-Manager, Tenant-Admin | High | Low | Medium | **Build now** | UI wrapper over `02` + `09`; huge brand-safety value. |
| 21 | Ad-hoc query endpoint | Tenant-Business-Analyst, Tenant-Brand-Reputation-Manager | Medium | High | High | **Needs ADR** | New query allowlist/RLS/performance architecture; risky to get wrong. |
| 22 | Metric explainability | Tenant-Reader, Tenant-User | Medium | Low | Low | **Build now** | Cheap, high-usability win; builds on `08` and `AIProviderConnector`. |
| 23 | Case handoff to CRM | Tenant-Social-Care-Agent, Tenant-User | Medium | High | High | **Needs ADR** | Needs a `CRMConnector` abstraction and CRM-specific auth/mapping. |
| 24 | Daily digest email | Tenant-User, Tenant-Reader, Tenant-Brand-Reputation-Manager | Medium | Medium | Medium | **Defer v2** | Needs `08`, `09`, `11`, and a reliable email provider. |
| 25 | Topic evolution timeline | Topic-Center-Analyst, Tenant-Brand-Reputation-Manager | Medium | High | High | **Defer v2** | Needs `04` and time-series aggregation (`TopicDailyCount`) to perform well. |
| 26 | Watchlist volume preview | Tenant-Admin, Tenant-User, Sole-Operator | High | Medium | Medium | **Build now** | Prevents runaway costs; fits naturally into `02` and `01`. |
| 27 | Preconfigured analytics views | Tenant-Reader, Tenant-Business-Analyst, Sole-Operator, Platform-Admin, Performance Review Agent | High | High | High | **Needs ADR** | Required for scalable dashboards and topic evolution; depends on `04`, `08`, and `TopicDailyCount` architecture. |
| 28 | Semantic search with RAG | Tenant-Business-Analyst, Topic-Center-Analyst, Tenant-Brand-Reputation-Manager | High | High | High | **Park** | Long-term differentiator; needs vector-store, embedding, and `RAGConnector` architecture spike. |

---

## Suggested phase mapping

| Phase | Feature focus |
|-------|---------------|
| **Current / v1 completion** | `01`, `02`, `03`, `04`, `08`, `09`, `10`, `11`, `12`, `17`, `18`, `19`, `20`, `22`, `26` |
| **v1.5 / hardening** | `05`, `06`, `07` (reply/publish), `13`, `24`, `25`, `27` |
| **v2 / enterprise** | `14`, `15`, `16`, `21`, `23` |
| **Parked / investigate** | `28` |

---

## Top 5 candidates for the next implementation cycle

1. **`26-watchlist-volume-preview.md`** — lowest-risk win; prevents the most common operational surprise.
2. **`22-metric-explainability.md`** — cheap, improves every dashboard, and makes the product feel more accessible.
3. **`20-crisis-threshold-wizard.md`** — simple composition of `02` + `09`; high brand-safety value.
4. **`19-self-service-onboarding-checklist.md`** — pure UI over existing APIs; accelerates tenant activation.
5. **`18-prospecting-list.md`** — small CRUD feature; unlocks the `Social-Selling-Strategist` use case.

---

## Cross-cutting architecture gates

Before several features can ship, these foundations must be locked:

- **`AuthorTopicSignal` refresh and RLS** — needed by `04`, `05`, `13`, `25`.
- **`AIProviderConnector` contract and quota model** — needed by `03`, `04`, `13`, `22`, `24`.
- **Public/unauthenticated DSR surface design** — needed by `14`, `15`, `16`.
- **`SocialConnector.count?()` and `publish?()` interfaces** — needed by `06`, `07`, `26`.
- **Preconfigured analytics views (`TopicDailyCount`, `SourceDailyCount`, etc.)** — needed by `08`, `21`, `25`, `27`.
- **Cross-connector audit and redaction pipeline** — needed by `14`, `15`, `16`.
- **`RAGConnector` and vector-store integration (embedding, chunking, upsert, search)** — needed by `28` and any future AI-assistant features.
