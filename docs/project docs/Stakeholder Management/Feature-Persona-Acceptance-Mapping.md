# Feature → Persona Mapping and Acceptance Criteria

**Purpose:** map the 12 social-listening feature designs (`docs/product-research/feature-designs/`) to the stakeholders/personas in this folder, identify the strongest feature matches, and define persona-specific acceptance criteria. Also flags additional feature requests implied by the stakeholder profiles.

---

## Quick-reference matrix

| Persona | Primary features | Secondary features | Additional request surfaced |
|---|---|---|---|
| **Author-of-a-Post** | 10 — Data Export | 12 — RBAC | Author-initiated takedown / right-to-erasure request |
| **Data-Subject** | 10 — Data Export | 12 — RBAC | Data portability and deletion request portal |
| **Legal-Advisor** | 10 — Data Export | 12 — RBAC, 09 — Real-time Alerts | Decision-log and compliance audit trail for all escalations |
| **Platform-Admin** | 09 — Real-time Alerts, 08 — Dashboards | 12 — RBAC, 01 — Multi-source Ingestion | Platform-wide health/usage/cost dashboard |
| **Social-Selling-Strategist** | 05 — Influencer Discovery, 04 — AI Topic Clustering | 02 — Boolean Query Builder, 11 — API | CRM-style prospecting lists and outreach export |
| **Sole-Operator** | 09 — Real-time Alerts, 08 — Dashboards | 01 — Multi-source Ingestion, 10 — Data Export | Operational cost and capacity observability |
| **Tenant-Admin** | 01 — Multi-source Ingestion, 02 — Boolean Query Builder, 12 — RBAC | 09 — Real-time Alerts, 10 — Data Export | Self-service tenant onboarding checklist |
| **Tenant-Brand-Reputation-Manager** | 09 — Real-time Alerts, 03 — AI Sentiment Analysis, 04 — AI Topic Clustering | 08 — Dashboards, 02 — Boolean Query Builder | Crisis threshold wizard and escalation playbooks |
| **Tenant-Business-Analyst** | 02 — Boolean Query Builder, 10 — Data Export, 11 — API | 08 — Dashboards, 04 — AI Topic Clustering | SQL/GraphQL-style query endpoint for ad-hoc analysis |
| **Tenant-Reader** | 08 — Dashboards, 09 — Real-time Alerts | 03 — AI Sentiment Analysis | Natural-language explanations for all metrics |
| **Tenant-Social-Care-Agent** | 06 — Unified Social Inbox, 09 — Real-time Alerts | 07 — Publishing and Scheduling, 03 — AI Sentiment Analysis | Response SLA timer and case-management handoff |
| **Tenant-User** | 01–04, 06–09 | 05, 10, 11 | AI-generated daily summary of mentions and actions |
| **Topic-Center-Analyst** | 04 — AI Topic Clustering, 05 — Influencer Discovery, 08 — Dashboards | 02 — Boolean Query Builder, 03 — AI Sentiment Analysis | Topic evolution timeline and semantic-drift view |

---

## Persona-by-persona detail

### Author-of-a-Post
- **Best match:** `10-data-export.md` — the author is the data subject for any public post that is exported.
- **Acceptance:**
  - A regular workspace export does not include the raw post text of a single author unless that author is within the tenant's data scope.
  - The platform's data handling respects platform ToS and does not repurpose public posts beyond listening/insights.
  - (Future) An author-initiated takedown request can be logged, assigned a request ID, and routed to the Legal/tenant workflow.
- **Additional request:** `Author-Initiated Takedown` workflow — a public, non-authenticated form for an author to request removal of a specific post, creating a DSR ticket.

### Data-Subject
- **Best match:** `10-data-export.md` and `12-multi-user-workspaces-and-rbac.md`.
- **Acceptance:**
  - `POST /v1/me/delete` (or future DSR endpoint) accepts a request and returns a ticket/tracking ID.
  - Data export for a data subject contains only their own data in a machine-readable format.
  - PII and credentials are redacted from any export that could indirectly expose the data subject.
- **Additional request:** `DSR Self-Service Portal` — submit access, rectification, and erasure requests without contacting support.

### Legal-Advisor
- **Best match:** `10-data-export.md`, `12-multi-user-workspaces-and-rbac.md`, `09-real-time-alerts.md`.
- **Acceptance:**
  - Every approval, export, escalation, and takedown action is appended to `platform_admin_audit_log` with actor, timestamp, and result.
  - The product can produce a defensible report of what was collected, why, and for how long.
  - Alert and response workflows capture the exact post, context, and decision at the moment of action.
- **Additional request:** `Compliance Audit Pack` — one-click PDF/JSON export of all decisions and data handling for a given period and tenant.

### Platform-Admin
- **Best match:** `09-real-time-alerts.md` and `08-dashboards-and-analytics.md`.
- **Acceptance:**
  - Platform Admin console shows per-tenant active connector count, ingestion volume, and error rate without exposing tenant content.
  - Connector-health and AI-provider health alert rules are configured by default.
  - Platform-level dashboard supports drill-down to the connector level but not to post content.
- **Additional request:** `Platform Operations Dashboard` — cost, capacity, and queue-depth metrics across all tenants.

### Social-Selling-Strategist
- **Best match:** `05-influencer-discovery.md` and `04-ai-topic-clustering.md`.
- **Acceptance:**
  - Influencer discovery can be filtered by watchlist, topic, engagement, and follower-authenticity score.
  - Topics and authors can be saved to a `List` with notes and exported to CSV/CRM via `10-data-export.md`.
  - AI topic clusters surface commercial-intent signals (e.g., "buying", "comparing").
- **Additional request:** `Prospecting List` feature — save, score, and export author leads with contact hints (link-in-bio, public email).

### Sole-Operator
- **Best match:** `09-real-time-alerts.md` and `08-dashboards-and-analytics.md`.
- **Acceptance:**
  - Default alert rules cover connector health, AI quota, and rate-limit saturation.
  - Dashboard shows cost and request-volume trends per connector and per AI provider.
  - All platform actions have clear recovery steps in the admin UI without requiring CLI/DB access.
- **Additional request:** `Operational Runbook Widget` — for each alert, display the exact command/UI flow to resolve it.

### Tenant-Admin
- **Best match:** `01-multi-source-ingestion.md`, `02-boolean-query-builder.md`, `12-multi-user-workspaces-and-rbac.md`.
- **Acceptance:**
  - Connector setup and activation is wizard-driven and requires no code.
  - Watchlist query builder validates connector-native capability and falls back transparently.
  - Tenant-Admin can invite/revoke users and view last-login/role from the admin UI.
- **Additional request:** `Self-Service Onboarding Checklist` — guided steps for connectors, first watchlist, and first user.

### Tenant-Brand-Reputation-Manager
- **Best match:** `09-real-time-alerts.md`, `03-ai-sentiment-analysis.md`, `04-ai-topic-clustering.md`.
- **Acceptance:**
  - Alert rules can trigger on negative-sentiment spike, topic drift, or high-reach negative mention.
  - Sentiment and topic widgets show change-over-time with clear explanation of what changed.
  - Alert payload includes representative posts, source, reach, and recommended next step.
- **Additional request:** `Crisis Threshold Wizard` — pre-built templates for brand-crisis, product-recall, and executive-name alerts.

### Tenant-Business-Analyst
- **Best match:** `02-boolean-query-builder.md`, `10-data-export.md`, `11-api-and-integrations.md`.
- **Acceptance:**
  - Watchlist query builder supports exporting the AST and sample results for validation.
  - CSV/JSON export bounds are documented and predictable (e.g., 50k rows synchronous, async above).
  - Public API returns stable `GET /v1/posts` with filtering, pagination, and documented rate limits.
- **Additional request:** `Ad-hoc Query Endpoint` — allow analysts to run server-side aggregations (e.g., `GROUP BY`) over their tenant's data.

### Tenant-Reader
- **Best match:** `08-dashboards-and-analytics.md`, `09-real-time-alerts.md`.
- **Acceptance:**
  - Dashboard widgets show plain-language labels and short explanations of what each number means.
  - Sentiment and topic summaries are visual and avoid requiring query-language knowledge.
  - Alert notifications are actionable and include a direct link to the relevant dashboard view.
- **Additional request:** `Metric Explainability` — one-sentence natural-language explanation for every number on the dashboard.

### Tenant-Social-Care-Agent
- **Best match:** `06-unified-social-inbox.md`, `09-real-time-alerts.md`.
- **Acceptance:**
  - Inbox items are triaged by sentiment, urgency, and source; DMs and comments appear in one queue with filters.
  - Each inbox item has a visible SLA timer and an escalation button.
  - Reply composer supports context-aware drafts and per-platform formatting.
- **Additional request:** `Case-Handoff to CRM` — create a case in the tenant's connected CRM from an inbox item.

### Tenant-User
- **Best match:** `02-boolean-query-builder.md`, `06-unified-social-inbox.md`, `08-dashboards-and-analytics.md`, `09-real-time-alerts.md`.
- **Acceptance:**
  - A `Tenant-User` can create watchlists, reply to posts, view dashboards, and manage their own connectors.
  - UI distinguishes content they own (personal connectors) from tenant-assigned content.
  - Alerts and daily digests are scoped to the watchlists they can access.
- **Additional request:** `Daily Digest Email` — a once-daily AI summary of top mentions, sentiment, and actions due.

### Topic-Center-Analyst
- **Best match:** `04-ai-topic-clustering.md`, `05-influencer-discovery.md`, `08-dashboards-and-analytics.md`.
- **Acceptance:**
  - Topic clusters can be compared across time periods and sources.
  - Each topic has a detail view with related authors, sample posts, and sentiment trend.
  - Topic drift is surfaced when the label or meaning of a cluster changes over time.
- **Additional request:** `Topic Evolution Timeline` — a dedicated view showing how a topic's meaning, volume, and sources have changed week-over-week.

---

## Additional feature candidates emerging from the personas

1. **Author-Initiated Takedown** — non-authenticated request form for public post authors; creates a DSR ticket.
2. **DSR Self-Service Portal** — access, rectification, and erasure requests for end users and data subjects.
3. **Compliance Audit Pack** — one-click export of all tenant decisions, data handling, and alert responses for a period.
4. **Platform Operations Dashboard** — cost, capacity, queue depth, and cross-tenant health.
5. **Prospecting List** — save/score/export influencer and author leads for social selling.
6. **Self-Service Onboarding Checklist** — guided tenant setup.
7. **Crisis Threshold Wizard** — pre-built alert templates for reputation crises.
8. **Ad-hoc Query Endpoint** — server-side aggregation for analysts.
9. **Metric Explainability** — one-sentence explanations for dashboard numbers.
10. **Case-Handoff to CRM** — inbox-to-CRM case creation.
11. **Daily Digest Email** — AI-generated daily summary.
12. **Topic Evolution Timeline** — semantic drift and topic history view.

---

## Recommended next step

For each of the primary/secondary matches above, the relevant `docs/product-research/feature-designs/*.md` should have a `Persona acceptance` sub-section added to its `## Research-based recommendations` (or the existing `## Frontend / UI principles`) so that the feature design carries the persona lens forward into story drafting and ADR work.
