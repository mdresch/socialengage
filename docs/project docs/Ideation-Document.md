# Ideation Document
### Social Listening & Engagement Platform

**Author:** Menno
**Date:** 28 July 2026
**Status:** Draft — v0.1

---

## 1. Origin of the Idea

Microsoft Social Engagement (MSE) was a social listening and engagement product built alongside Dynamics 365, covering social insights, brand reputation monitoring, social care (case routing), and social selling. Microsoft discontinued MSE for new customers on 16 January 2019 and fully retired it on 16 January 2020, replacing it with Dynamics 365 Market Insights — a tool Microsoft itself described as not a direct replacement.

This leaves a recognisable gap: a social listening tool with strong CRM-adjacent workflows (turning a social post into a lead or a case), without being locked into an expensive all-in-one CRM suite or an opaque third-party aggregator. MSE itself was criticised for being something of a black box — no API, no access to the underlying data — which limited what customers could do with their own data.

## 2. Problem / Opportunity Statement

Organisations that want to monitor social and web conversations about their brand, products, or topics of interest currently face a narrow set of options: expensive enterprise aggregators (Brandwatch, Meltwater) with opaque pricing and vendor lock-in, or piecing together official platform APIs themselves — a nontrivial engineering effort given each platform's distinct auth model, rate limits, and data shape.

There is an opportunity to build a modern, modular alternative that:

- Treats each social/AI platform as a swappable connector rather than a hard-coded integration
- Gives the operator (not a vendor) ownership of the data and the analysis pipeline
- Is multi-tenant from day one, so it can serve more than one organisation's needs without redesign
- Avoids the "black box" criticism levelled at MSE by retaining full raw payloads and full audit traceability of every ingested record

## 3. Initial Concept

A standalone, Azure-native, multi-tenant platform structured around four capability areas mirroring MSE's original scope, built as independent subsystems rather than one monolith:

- **Social Listening / Insights** — ingest posts across platforms, normalize, enrich with sentiment/entities, and expose data via API and events. *(First subsystem — spec already completed.)*
- **Brand Reputation & Alerts** — crisis detection, influencer tracking, sentiment trend alerts, consuming Listening's event stream.
- **Social Care** — case/ticket routing from social posts into a service workflow, consuming Listening's data.
- **Social Selling** — recommendations and lead-generation signals for sales use, consuming Listening's data.

Each subsystem is designed, specced, and built independently, consuming the Listening subsystem's outputs rather than duplicating ingestion logic.

## 4. Key Differentiators from MSE and Existing Tools

- Pluggable connector framework — new social platforms or AI enrichment providers added without touching core pipeline code
- Swappable AI provider for enrichment (Azure AI Language today; OpenAI, Claude, or others later) rather than a single hard-coded vendor
- Full raw-payload retention (JSONB) and per-post acquisition tracking (IngestionRun) — nothing is a black box, everything is traceable to the exact process and moment it entered the system
- Multi-tenant with database-level isolation (Postgres Row-Level Security), not just application-level filtering
- User-controlled platform activation — each tenant brings their own credentials and toggles platforms on/off independently

## 5. Target Users (Initial Thinking)

Given this starts as a solo, personal project, the initial "user" is the builder — proving the architecture and connector pattern with real data. A plausible longer-term audience, once validated, includes small-to-mid-size organisations or agencies that want social listening capability without enterprise aggregator pricing or lock-in. This is not a committed target market at this stage — it is a direction worth validating once the core subsystem is working.

## 6. Open Questions Carried Into the Business Case

- Is the ongoing goal a personal/portfolio project, an eventual product, or purely an architectural exercise?
- What is an acceptable ongoing cost ceiling (API tiers, Azure spend) given this is self-funded?
- How much of the four-subsystem vision is realistic to pursue solo, versus scoping permanently down to Listening + one downstream subsystem?

## 7. Next Steps

- Complete business case (cost/benefit, build-vs-buy comparison)
- Complete stakeholder register
- Draft project charter for the first subsystem (Social Listening / Insights)
- Hand off approved design spec to implementation (Claude Code / VS Code)
