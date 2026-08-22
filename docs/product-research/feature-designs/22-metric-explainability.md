---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Metric explainability

### What it is

A dashboard and analytics feature that adds a short, plain-language explanation to every number, chart, and KPI. It tells the Tenant-Reader and Tenant-User what the metric means, what changed, and why it matters, in one sentence or less.

### End-user benefits

- **Instant understanding:** users do not need to interpret charts or metric names.
- **Trust:** explanations make it clear that a number is grounded in real data, not arbitrary.
- **Faster decisions:** users can act on a metric without asking an analyst.
- **Accessibility:** text explanations complement visual charts for screen readers and non-technical users.

### Core details

- Every dashboard widget, post summary, and alert card shows an `ℹ️` or inline explanation.
- Explanations are generated from the query context, time range, and the actual result.
- Examples: "Negative sentiment jumped 15% because three high-reach posts criticized your product launch." / "Topic 'AI safety' rose to 4% of all mentions today, up from 1% last week."
- The AI generates explanations; users can optionally edit or disable them per dashboard.
- Explanations are transient and computed on the fly; no extra storage in v1.

### Implementation complexity

**Low-to-medium.** Requires an `AIProviderConnector` method that takes a metric and context and returns a sentence. The heavy part is prompt engineering and caching, not infrastructure.

### Growth and reach

Improves accessibility and usability for every dashboard view. A low-cost, high-impact feature for the Tenant-Reader and Tenant-User personas.

---

## Technical design

- **Data flow:** dashboard or analytics view loads a metric → frontend calls `POST /v1/explain` with metric type, value, context, and time range → `MetricExplainabilityService` builds a prompt for `AIProviderConnector` → returns a one-sentence explanation → UI renders it.
- **Component interactions:** `DashboardWidget` / `PostSummaryCard` / `AlertCard` → `MetricExplanation` → `POST /v1/explain`.
- **REST/Service Bus contracts:** `POST /v1/explain` returns `{ explanation, confidence }`. No events.
- **Storage:** None in v1. v2 can cache explanations by `(metric_key, time_range, result_hash)` in a short-lived cache.
- **Security considerations:** The prompt contains only tenant-scoped aggregate data, not raw post bodies. No PII is sent to the AI provider unless explicitly included by the user.

## Backend principles

- **Request-scoped explanations.** Explanations are computed on demand and not persisted.
- **Deterministic where possible.** For the same metric and context, the explanation should be stable and not hallucinated.
- **Confidence-graded.** Low-confidence explanations should be marked as such or omitted.
- **Cost-aware.** Large dashboards may call the AI many times; consider batching explanations or allowing per-widget opt-out.

## Frontend / UI principles

- **User flow:** user sees a metric → hovers or clicks for an explanation → short text appears inline or in a tooltip.
- **Component hierarchy:** `MetricExplanation` → `ExplanationTooltip` / `ExplanationBadge`.
- **State management:** Local state per metric; fetch explanation when visible or on demand.
- **Accessibility and responsive design:** Explanations are real text, not tooltips only; they can be read by screen readers.

## Open questions

- Should explanations be generated for every metric, or only for the top-level KPIs?
- Should the user be able to turn explanations off globally or per widget?
- How do we handle explanations that are wrong or misleading?
- Should explanations support multiple languages from the start?
- Should the AI also explain why a metric *changed* between two periods, or just what it is?

## AI enhancements

- **Causal summary:** the AI identifies the top 2–3 posts, authors, or sources driving a change.
- **Comparison narrative:** the AI explains period-over-period changes, e.g., "Engagement is up 20% because one post from @example went viral."
- **Personalized tone:** the AI can adjust explanation complexity for `Tenant-Reader` (simple) vs. `Tenant-Business-Analyst` (detailed).

## Persona acceptance

- **Tenant-Reader (primary):** can understand any dashboard number without asking an analyst.
- **Tenant-User (primary):** sees clear, one-sentence explanations for alerts and post summaries.
- **Tenant-Business-Analyst (secondary):** can see the same numbers with a deeper, optional explanation of drivers and context.
- **Tenant-Brand-Reputation-Manager (secondary):** can read the reason behind a sentiment or reach spike directly from the dashboard.
