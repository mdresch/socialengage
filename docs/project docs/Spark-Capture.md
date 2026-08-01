# Spark Capture: An Open, Modular Replacement for Microsoft Social Engagement

**Captured Date:** 31 July 2026
**Originator:** Menno

---

### 1. The Big Idea

Build a social listening and engagement platform that picks up where Microsoft Social Engagement (MSE) left off when Microsoft killed it in 2020 — but do it as a set of independent, swappable pieces instead of one locked-down suite. Every social platform is a connector you can plug in or unplug. Every AI enrichment provider (sentiment, entities) is swappable too. And instead of one monolithic product, it's four capability areas — Listening, Brand Reputation, Social Care, Social Selling — built as separate subsystems, starting with Listening/Insights, each one consuming the last rather than duplicating it.

### 2. The Frustration (The "Why Now?")

MSE covered a real need — social insights, reputation monitoring, case routing, sales signals, all tied into CRM workflows — and then it just went away, with Microsoft's own replacement openly described as *not* a real substitute. What's left for anyone wanting that capability today is a bad choice between two extremes: expensive enterprise aggregators like Brandwatch or Meltwater with opaque pricing and vendor lock-in, or rolling your own integration against every platform's distinct auth model, rate limits, and data shape by hand. And even MSE itself, while it existed, was criticized for being a black box — no API, no access to your own underlying data. Nobody's building the option that's both affordable/ownable *and* transparent.

### 3. The Dream Outcome

An operator — not a vendor — owns the data and the pipeline. Turning a new social platform or a new AI provider on is a connector swap, not a core-code change. Every single post that lands in the system is traceable back to exactly when and how it arrived, with the full raw payload kept — nothing hidden, nothing black-boxed. Multiple organizations can run on the same platform with real database-level isolation, not just app-level filtering, and each one controls its own credentials and which platforms it has switched on. And because Listening is built first as a clean foundation, the next capability area — reputation alerts, case routing, sales signals — gets to consume already-normalized, already-traceable data instead of re-solving ingestion from scratch.

### 4. Who Benefits?

- **Menno, first** — as the solo builder, this is also the proving ground: validating the connector pattern and architecture with real data before anyone else touches it
- **Small-to-mid-size organizations and agencies** currently priced out of, or locked into, enterprise social listening tools — a plausible audience once the core is proven, not a committed market yet
- **Whoever builds the next three subsystems** (Brand Reputation & Alerts, Social Care, Social Selling) — each inherits clean, traceable, already-ingested data instead of building its own pipeline
