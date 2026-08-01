# Concept Validation: Social Listening & Engagement Platform

**Parent Spark ID:** `docs/project docs/Spark-Capture.md` — "An Open, Modular Replacement for Microsoft Social Engagement" (captured 31 Jul 2026)

## 1. Documented Business Need

Microsoft Social Engagement (MSE) covered social insights, brand reputation monitoring, social care case routing, and social selling — then was discontinued in January 2020 with no direct successor; Microsoft's own replacement (Dynamics 365 Market Insights) is openly described as not equivalent. Since then, the operational gap it left has not closed. Anyone who wants to monitor social and web conversations about their brand or products today has to choose between two poor options: expensive enterprise aggregators (Brandwatch, Meltwater) with opaque pricing and no ownership of the underlying data pipeline, or hand-building integrations against each platform's distinct auth model, rate limits, and data shape — a real, nontrivial engineering effort repeated per platform. MSE itself, while it existed, added a third frustration on top: it was a black box, with no API and no access to the underlying data it collected on a customer's behalf. This is not a problem that resolves itself — the market has had six years to produce a direct successor and hasn't, so the gap is a standing one, not a temporary lag.

## 2. Solution Hypothesis

Build a modular, multi-tenant social listening platform where every social platform and every AI enrichment provider is a swappable connector rather than a hard-coded integration, and where the operator — not a vendor — retains full ownership of the data pipeline. Concretely: a connector framework normalizes posts from any platform into a common schema, an AI provider (initially Azure AI Language) enriches them with sentiment and entities, and every ingested record keeps its full raw payload plus a traceable acquisition record (`IngestionRun`) so nothing is hidden. This directly bridges the operational gap: the connector pattern removes the "rebuild integration per platform" burden that makes the DIY option costly, while full data ownership and audit traceability remove the "black box" and "vendor lock-in" objections that make both existing options unattractive. The platform is built one subsystem at a time — Social Listening / Insights first — so the hypothesis is tested on a bounded slice before the wider four-subsystem vision (adding Brand Reputation, Social Care, Social Selling) is committed to.

## 3. High-Level Value Proposition

**Qualitative:**
- Full ownership and control of the data pipeline, with no vendor black box and full audit traceability of every ingested record
- No per-platform re-engineering burden when a new social or AI provider is added — a connector swap, not a core pipeline change
- Avoids single-vendor dependency for AI enrichment specifically, since the provider is swappable rather than fixed
- A foundation that future capability areas (Brand Reputation, Social Care, Social Selling) can build on directly, rather than each re-deriving its own ingestion pipeline

**Early quantitative (potential ranges only — not committed figures):**
- Could potentially avoid the recurring, per-seat licensing cost pattern typical of enterprise aggregators, though no specific competitor quote has been obtained to date — treat as directional, not budgeted
- The one documented cost anchor available is platform API access itself: paid-tier access (e.g., X) can range from tens to thousands of dollars per month depending on read volume, which is why free/low-cost platforms are the intended starting point rather than a baseline savings estimate
- No time-savings or throughput figures have been measured yet — none should be assumed until at least one connector is running end-to-end

## 4. Operational Alignment Check

**Systems and data environments this interacts with:** Azure Database for PostgreSQL, Azure Key Vault, Azure Service Bus, and Azure AI Language form the core technical environment; each connector additionally depends on the public API or feed of its target platform (X, Reddit, YouTube, LinkedIn, Meta, and RSS/Newswire sources — GlobeNewswire and PR Newswire specifically). The system itself splits into two repositories, a backend (`social-listening-core`) and an admin UI (`social-listening-admin`), neither of which exists on disk yet.

**Functional teams / immediate integration points:** None today — this is a solo effort with no internal team to align across. The nearest thing to "integration points" are forward-looking: the three future subsystems (Brand Reputation & Alerts, Social Care, Social Selling) are each expected to consume this subsystem's REST API and event stream rather than build their own ingestion, so any interface decision made here has direct downstream consequences even though no consumer exists yet.

## 5. Preliminary Feasibility Assumptions

- Assumes the target platforms' public APIs or feeds (X, Reddit, YouTube, LinkedIn, Meta, RSS/Newswire) expose sufficient, Terms-of-Service-compliant read access for listening use cases, and that this access stays stable enough to build a connector against.
- Assumes Azure AI Language (or a swappable equivalent) can deliver sentiment/entity enrichment at a cost and quality workable for a solo, self-funded project — with the option to swap providers if that assumption breaks.
- Assumes solo development bandwidth is sufficient to carry at least the first subsystem (Social Listening / Insights) to a working end-to-end demo before the wider four-subsystem vision is evaluated further.
