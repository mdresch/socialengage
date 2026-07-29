# Business Case
### Social Listening & Engagement Platform

**Author:** Menno
**Date:** 28 July 2026
**Status:** Draft — v0.1

---

## 1. Executive Summary

This business case evaluates whether to build a standalone social listening platform, inspired by the discontinued Microsoft Social Engagement (MSE), as a self-funded solo project. The recommendation is to proceed with a phased build, starting with a single subsystem (Social Listening / Insights) whose design has already been specified, before committing further investment to the three downstream subsystems (Brand Reputation, Social Care, Social Selling).

## 2. Problem Statement

There is no direct, actively maintained successor to MSE, and the alternatives on the market are either expensive enterprise aggregators with opaque pricing and no data ownership, or narrow single-platform SaaS tools with no path to the broader case-routing and lead-gen workflows MSE originally offered. Building official platform integrations from scratch is a real but bounded engineering effort — this is what this project sets out to do deliberately and modularly, rather than as an afterthought.

## 3. Options Considered

| Option | Pros | Cons |
|---|---|---|
| **A. Buy — enterprise aggregator** (Brandwatch, Meltwater) | Fastest time-to-value; broad platform coverage already solved; vendor handles compliance/scraping. | Expensive, enterprise-tier pricing; no ownership of data pipeline or architecture; reintroduces the "black box" problem this project is meant to avoid. |
| **B. Buy — narrow SaaS listening tool** | Lower cost than enterprise aggregators; quick to start. | Typically single-platform or limited coverage; no multi-tenant/connector architecture; little to no extensibility to Brand Reputation, Social Care, or Social Selling later. |
| **C. Build — this project (recommended)** | Full ownership of data and architecture; swappable AI provider avoids vendor lock-in; connector pattern scales to new platforms without redesign; directly reusable skills for ADPA-adjacent architecture work. | Solo build effort and ongoing maintenance burden; slower time-to-value; ongoing platform API costs borne directly. |

## 4. Recommendation

Proceed with Option C (build), but phase the investment: deliver and validate the Social Listening / Insights subsystem first — including at least one working connector end-to-end — before committing further time or cost to Brand Reputation, Social Care, or Social Selling. This limits exposure if platform API costs or solo development bandwidth turn out to be more constraining than expected, while still validating the core architectural bet (the connector framework) early.

## 5. Costs

| Cost Item | Type | Notes |
|---|---|---|
| Azure Database for PostgreSQL | Recurring | Scales with data volume; start on a low-tier instance for solo/early use. |
| Azure Key Vault | Recurring | Low cost at solo scale; billed per operation/secret. |
| Azure Service Bus | Recurring | Basic/Standard tier sufficient initially. |
| Azure AI Language | Usage-based | Billed per text record processed for sentiment/entity extraction. |
| Platform API access (X paid tier, etc.) | Recurring / variable | Largest and most variable cost. X's paid tiers alone can range from tens to thousands of dollars per month depending on read volume — this is the key cost driver to monitor and cap early. |
| Development time (solo) | Time investment | Not a cash cost, but the primary real cost of the project — opportunity cost against other priorities. |

No formal budget ceiling has been set at this stage. Given this is self-funded, it is recommended that a monthly cost cap be defined before connecting any paid-tier platform API (particularly X), and that free/low-cost platforms (Reddit, YouTube, RSS/news) be prioritised for the earliest working connectors to prove the pipeline before incurring the largest variable cost.

## 6. Benefits

- Full ownership and control of the data pipeline — no vendor black box, full audit traceability of every ingested record
- Swappable AI provider avoids dependency on a single enrichment vendor's pricing or roadmap
- Reusable architectural pattern (connector framework, multi-tenant isolation, event-driven design) that has direct crossover value with existing ADPA and RPAS-Governance work
- Optionality — if the platform proves valuable, it can grow into a product; if not, the architecture and skills gained still have standalone value

## 7. Risks

- Platform API changes or pricing changes (a real risk — this is precisely why MSE-style tools have historically been vulnerable, and why X's own pricing has already reshaped this market once)
- Solo development bandwidth — four subsystems is a substantial scope for one person; scope must be actively managed
- Platform Terms of Service compliance — each connector must be built against the platform's actual current API terms, not assumptions
- Cost creep — usage-based AI enrichment and paid-tier social APIs can scale unpredictably with data volume if not capped

## 8. Success Criteria for Phase 1

- At least one platform connector (recommend starting with Reddit or RSS, per the cost analysis above) ingesting real data end-to-end
- Sentiment/entity enrichment working via Azure AI Language
- Multi-tenant isolation verified (two tenants' data provably cannot cross-contaminate)
- Working REST API and at least one downstream event consumed successfully
