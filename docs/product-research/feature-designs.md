# Feature Design Notes — Competitive Capabilities for SocialEngage

These are high-level design sketches for each capability surfaced in `competitor-feature-matrix.json` <ref_file file="D:\Source\socialengage\docs\product-research\competitor-feature-matrix.json" />. Each section describes the feature, the end-user value, and what building it into SocialEngage would mean given the existing architecture.

---

## 1. Multi-source ingestion

### What it is
The ability to pull public and owned content from more than one kind of source — social networks, news sites, RSS feeds, review sites, blogs, broadcast, and the open web — into a single normalized post stream.

### End-user benefits
- **One dashboard for the whole conversation** instead of switching between platform-native tools.
- **Context across channels:** a brand crisis or campaign can be tracked on X, in news coverage, on Reddit, and on owned Facebook Pages simultaneously.
- **Better coverage** of owned channels, competitors, and industry keywords.

### Core details
- Each source becomes a `SocialConnector` with a `poll()` loop, `authMode`, and `Author` modeling.
- A source capability matrix records which connectors support boolean watchlists, media, comments, or historical backfill.
- `IngestionRun` remains the audit anchor; each source posts into the same `social_posts` table with `provider_id` and `rawPayload`.

### Implementation complexity
**Medium per new connector.** The framework already exists (`ProviderConnector`, `SocialConnector`, `registry.ts`, live scheduler). Adding a new source is mostly: primary-source verify the API/RSS, model the `Author` and `SocialPost` mapping, rate-limit through `RequestGate`, and add the connector-specific `SKILL.md`. OAuth connectors (Instagram, LinkedIn, Facebook) are higher effort than RSS/API-key.

### Growth and reach
More sources means the product can replace more point tools. It is the primary lever for moving from a single-use listening tool to an enterprise intelligence platform.

---

## 2. Boolean query builder

### What it is
A structured query interface that lets users build precise mention filters with `AND`, `OR`, `NOT`, phrase matching, grouping, and field scoping (author, source, language, location).

### End-user benefits
- **Precision:** reduce noise by excluding common false positives.
- **Shareability:** queries can be saved as watchlists and reused across the team.
- **Power for analysts:** brand + campaign - competitor, in English, from news only, becomes a single reusable watchlist.

### Core details
- The `watchlists` table already stores a boolean AST (`watchlist_ast`) and `matchType`.
- A UI query builder generates the AST visually and validates it against the per-connector capability matrix.
- Connector-side native filtering is preferred; `matchesWatchlist()` fallback runs in the ingestion pipeline.

### Implementation complexity
**Medium for the backend; higher for the UI.** The AST and fallback matching are already implemented. The main remaining work is a visual, platform-aware query composer and real-time validation against connector capabilities.

### Growth and reach
A good query builder lowers the skill barrier for non-technical users and increases the accuracy of dashboards and alerts, making the product credible next to Brandwatch/Talkwalker.

---

## 3. AI sentiment analysis

### What it is
Classifying the emotional tone of a post or mention as positive, negative, neutral, or mixed, ideally per-sentence and per-aspect.

### End-user benefits
- **Instant triage:** see which mentions need a response and which are noise.
- **Trend tracking:** spot sentiment shifts during a campaign or crisis.
- **Reporting:** stakeholder-ready metrics on brand health.

### Core details
- SocialEngage already uses `AIProviderConnector` enrichment (`sentiment`, `keyPhrases`, `entities`) stored in `social_posts.enrichment`.
- `detectedLanguage` is computed; `body_markdown` gives the canonical input text.
- The design is provider-agnostic; Azure AI Language and Azure OpenAI already plug in.

### Implementation complexity
**Low-to-medium.** Sentiment is already built. The next level is aspect-based sentiment, per-language fine-tuning, and exposing sentiment in the analytics dashboard widgets. New models can be swapped in through the existing `AIProviderConnector` interface.

### Growth and reach
Sentiment is table stakes for social listening. Strong, explainable sentiment scoring is a prerequisite for the Crisis Alert Radar, Sentiment Trajectory, and executive dashboards.

---

## 4. AI topic clustering

### What it is
Automatically grouping related mentions into emergent themes or topics without requiring the user to pre-define every keyword.

### End-user benefits
- **Discover unknown unknowns:** a new complaint, competitor narrative, or product issue surfaces automatically.
- **Reduce manual taxonomy work:** the system suggests topics rather than forcing the user to maintain lists.
- **Better reporting:** topics can be used as filter dimensions across the analytics dashboard.

### Core details
- Topic clustering can be added as an enrichment step or a scheduled aggregation.
- Inputs: `body_markdown`, `enrichment` JSONB, `published_at`, `provider_id`.
- Outputs: a new `post_topics` or `topic` dimension stored in `enrichment`, plus a `TopicCoverage` widget on the dashboard.

### Implementation complexity
**Medium.** Azure OpenAI is already wired in; a `topic` enrichment model could be added to `enrichPost()` without a schema migration. The heavier work is the UI: surfacing clusters, letting users rename/merge them, and integrating the `selectedTopic` filter.

### Growth and reach
Topic clustering turns the product from reactive search into proactive discovery. That is the difference between a monitoring tool and a market-intelligence tool.

---

## 5. Influencer discovery

### What it is
Identifying accounts and authors who drive conversations, scored by reach, engagement, topical relevance, and audience fit.

### End-user benefits
- **Better outreach lists:** find advocates and detractors with real authority on a topic.
- **Campaign planning:** know who matters before launching a partnership.
- **Crisis context:** distinguish a single angry user from a high-reach account escalating a complaint.

### Core details
- The `Author` table already normalizes authors per platform (`author.name`, `author.url`, `author.follower_count` on `SocialPost`).
- Influencer scoring needs a new derived model: `AuthorTopicSignal` already captures raw signals; a computed `influence_score` could be layered on top.
- Scoring inputs: follower count, mention volume, engagement, watchlist relevance, and network amplification.

### Implementation complexity
**Medium-to-high.** The data is there; the harder part is defining a defensible, explainable scoring algorithm and adding the UI for discovery, lists, and export. There are also platform-terms considerations for storing public author metadata.

### Growth and reach
Influencer discovery opens a second buyer: PR, partnerships, and advocacy teams. It also justifies higher seat pricing.

---

## 6. Unified social inbox

### What it is
A single, team-owned view of all mentions, comments, DMs, and replies that need a human response, with triage, assignment, and status tracking.

### End-user benefits
- **Faster response times:** one place to see everything that needs action.
- **Accountability:** assign mentions to owners and track resolution.
- **Audit trail:** every reply and its outcome is recorded.

### Core details
- The outbound foundation is already being built: `outbound_activities` (Stories 3.14/3.15) and `SocialConnector.reply?()` (Stories 2.26/2.27, 6.38).
- An inbox is essentially a tenant-scoped view over `outbound_activities` plus incoming mentions that require a response.
- Needs `assignment` status, `owner`, `priority`, and `resolution` columns on top of `outbound_activities`.

### Implementation complexity
**High.** It requires reply/publish to be real, per-connector `reply?()` implementations, an inbox UI, assignment workflows, and real-time update mechanics. It is the most expensive feature on this list.

### Growth and reach
The inbox is what turns listening into social care and community management. It is the bridge to larger support, marketing, and customer-success teams.

---

## 7. Publishing and scheduling

### What it is
Composing, previewing, scheduling, and publishing outbound posts to one or more connected social assets from within the same tool that handles listening.

### End-user benefits
- **One workflow:** no need to switch to Hootsuite/Buffer for outgoing content.
- **Multi-asset dispatch:** write once, publish to multiple Facebook Pages or LinkedIn profiles.
- **Planned cadence:** queue content in advance and view it alongside inbound listening.

### Core details
- ADR-0075 and Story 2.28–2.30, 3.15, 6.39 already define the architecture: `SocialConnector.publish?()`, `POST /v1/outbound/posts`, `outbound_activities` `activity_type='post'`, and `target_asset_id`.
- A `scheduled_for` column on `outbound_activities` enables deferred publishing once a background scheduler exists.
- The Polypost Composer (ADR-0072) is the authoring surface.

### Implementation complexity
**High.** Beyond the core endpoint, each platform needs OAuth scope verification, per-asset targeting, rate-limit gating, media upload, and preview rendering. Facebook is the v1 target; LinkedIn/others follow.

### Growth and reach
Publishing makes SocialEngage a full social media management suite, not just a listening tool. It competes directly with Sprout Social, Hootsuite, and Sprinklr.

---

## 8. Dashboards and analytics

### What it is
Visual, interactive views of listening data: volume, sentiment, sources, topics, authors, and engagement over time.

### End-user benefits
- **At-a-glance brand health:** no need to export data to build charts.
- **Stakeholder reporting:** shareable dashboards for executives and clients.
- **Decision support:** spot trends and compare performance.

### Core details
- Epic 8 (Analytics Dashboard) is already built: Overview, Sentiment, Conversations, Sources, Language, Location.
- Widgets are client-side aggregated from `GET /v1/posts` and `enrichment`, keeping backend changes minimal per ADR-0054.
- Future depth: watchlist-coverage, topic breakdowns, and per-asset performance.

### Implementation complexity
**Low-to-medium for v1; medium for depth.** The dashboard scaffold exists. New widgets mostly consume existing endpoints. Heavy aggregation or time-series tables would require revisiting ADR-0008's "no `TopicDailyCount`" deferral.

### Growth and reach
Dashboards are a retention and sales tool. They make the value of ingestion visible immediately, especially for non-analyst buyers.

---

## 9. Real-time alerts

### What it is
Notifications — in-app, email, or webhook — when a keyword, topic, sentiment, or volume threshold is crossed.

### End-user benefits
- **Crisis response:** know about a spike in negative mentions immediately.
- **Campaign monitoring:** get notified when a hashtag takes off.
- **Operational awareness:** track connector health and ingestion status.

### Core details
- `ConnectorHealth` and `ingestion_runs` already feed a health model.
- Alert rules can be built on top of the analytics dashboard filters: watchlist, sentiment, volume, provider, author.
- Delivery: in-app banner, email, Service Bus event, or webhook. ADR-0012/0013 eventing already exists.

### Implementation complexity
**Medium.** The data and event plumbing exist. The new work is alert-rule storage, threshold evaluation, and delivery channels. Webhook delivery is easiest because it reuses existing outbound patterns.

### Growth and reach
Alerts move users from "check the dashboard" to "get told when something matters." That is essential for any 24/7 brand or crisis team.

---

## 10. Data export

### What it is
Allowing tenants to download their listening data and workspace metadata in machine-readable formats (JSON, CSV) for backup, analysis, or compliance.

### End-user benefits
- **Portability:** users are not locked into the product for analysis.
- **Compliance:** GDPR/CCPA data portability and audit requirements.
- **Deeper analysis:** import posts into Excel, BI, or custom models.

### Core details
- ADR-0074 and Stories 3.16/6.40 define the first step: `GET /v1/tenants/me/export/workspace` (JSON) and `GET /v1/posts?format=csv` (CSV).
- Exports must be bounded, synchronous, and respect RLS.
- The deletion/offboarding export already exists (Story 3.8); on-demand export should reuse the same patterns.

### Implementation complexity
**Medium.** Bounded streaming, CSV serialization, and size caps need careful design. Workspace JSON is more complex because it spans multiple tables and must avoid leaking secrets.

### Growth and reach
Export is an enterprise procurement checkbox. It also makes the product safer for customers who need custody of their own data.

---

## 11. API and integrations

### What it is
A documented REST API and pre-built integrations that let other systems consume SocialEngage data or trigger actions.

### End-user benefits
- **Workflow integration:** push posts into CRM, support, or BI tools.
- **Automation:** trigger actions from volume spikes, sentiment changes, or new mentions.
- **Custom frontends:** build internal dashboards on top of the same data.

### Core details
- SocialEngage already has `/v1` API endpoints and Service Bus events (`SocialPostIngestedEvent`, `ConnectorHealthChangedEvent`).
- A public API surface would mean stable versioning (ADR-0017), rate limiting, and better auth documentation.
- Webhooks could be delivered from existing Service Bus topics.

### Implementation complexity
**Low for v1; medium for a public, versioned API.** The internal API exists. The work is documentation, versioning discipline, and external developer onboarding.

### Growth and reach
APIs embed the product into customers' stacks, increasing switching costs and enabling channel partners.

---

## 12. Multi-user workspaces and RBAC

### What it is
Tenant-scoped workspaces with role-based access: platform admin, tenant admin, tenant user, and fine-grained permissions for connectors, watchlists, posts, and settings.

### End-user benefits
- **Team separation:** each tenant has its own data and users.
- **Least privilege:** tenant admins manage connectors and users; tenant users manage their own watchlists and posts.
- **Governance:** audit logs track who did what.

### Core details
- This is already built: Entra External ID, `resolveIdentity()`, RLS on every tenant table, `tenant_admin`/`tenant_user`/`platform_admin` roles, and `platform_admin_audit_log`.
- Future depth: per-connector permissions, per-watchlist sharing, and more granular feature gating.

### Implementation complexity
**Core is already built; additions are low-to-medium.** The architecture is multi-tenant from day one. New RBAC dimensions (e.g., who can publish vs. reply) can be added by extending the `ResolvedIdentity` role checks.

### Growth and reach
Proper RBAC is a prerequisite for selling to enterprises and agencies. It is also a differentiator against SMB tools that offer only flat team access.

---

## Summary: where SocialEngage stands

| Feature | Current state | Priority for growth |
|---|---|---|
| Multi-source ingestion | Strong and expanding | Keep building connectors |
| Boolean query builder | Backend ready; UI needed | High for analyst adoption |
| AI sentiment analysis | Built; deepen to aspect-based | Medium |
| AI topic clustering | Not built; enrichment path is clear | High for differentiation |
| Influencer discovery | Partial data; needs scoring + UI | Medium-high |
| Unified social inbox | Foundation via ADR-0073/0075 | Very high (turns listening into care) |
| Publishing and scheduling | Proposed (ADR-0075) | Very high (full-suite play) |
| Dashboards and analytics | v1 built; deepen | Medium |
| Real-time alerts | Not built; data exists | High for operational value |
| Data export | Proposed (ADR-0074) | High for enterprise trust |
| API and integrations | Internal; document/version | Medium |
| Multi-user workspaces and RBAC | Built; add finer grain | Medium |

---

## 13–28. Additional feature designs

The following feature designs were added from the stakeholder/persona mapping pass. They are documented in full in the numbered files under `docs/product-research/feature-designs/`. A priority matrix is maintained in `feature-priority-matrix.md`.

| # | Feature | File | Primary trigger | Notes |
|---|---------|------|-----------------|-------|
| 13 | Composed post author mention suggestions | `13-composed-post-author-mention-suggestions.md` | Social-Selling-Strategist, Tenant-User | AI-suggested `@mentions` from the Polypost Composer. |
| 14 | Author-initiated takedown | `14-author-initiated-takedown.md` | Author-of-a-Post, Data-Subject | Public DSR takedown form for ingested posts. |
| 15 | DSR self-service portal | `15-dsr-self-service-portal.md` | Data-Subject, Legal-Advisor | Self-service access/erasure/restriction requests. |
| 16 | Compliance audit pack | `16-compliance-audit-pack.md` | Legal-Advisor, Platform-Admin | One-click audit report for a tenant and period. |
| 17 | Platform operations dashboard | `17-platform-operations-dashboard.md` | Sole-Operator, Platform-Admin | Cross-tenant health, cost, and capacity dashboard. |
| 18 | Prospecting list | `18-prospecting-list.md` | Social-Selling-Strategist | Save, score, and export author leads. |
| 19 | Self-service onboarding checklist | `19-self-service-onboarding-checklist.md` | Tenant-Admin, Sole-Operator | Guided new-tenant setup wizard. |
| 20 | Crisis threshold wizard | `20-crisis-threshold-wizard.md` | Tenant-Brand-Reputation-Manager | Pre-built reputation-crisis alert templates. |
| 21 | Ad-hoc query endpoint | `21-ad-hoc-query-endpoint.md` | Tenant-Business-Analyst | Server-side aggregation over tenant data. |
| 22 | Metric explainability | `22-metric-explainability.md` | Tenant-Reader, Tenant-User | Plain-language explanations for dashboard numbers. |
| 23 | Case handoff to CRM | `23-case-handoff-to-crm.md` | Tenant-Social-Care-Agent | Escalate an inbox item to a CRM case. |
| 24 | Daily digest email | `24-daily-digest-email.md` | Tenant-User, Tenant-Reader | AI-generated daily mention summary email. |
| 25 | Topic evolution timeline | `25-topic-evolution-timeline.md` | Topic-Center-Analyst | Topic volume, source, and semantic-drift over time. |
| 26 | Watchlist volume preview | `26-watchlist-volume-preview.md` | Tenant-Admin, Tenant-User | Pre-activation per-connector post count estimate. |
| 27 | Preconfigured analytics views | `27-preconfigured-analytics-views.md` | Sole-Operator, Platform-Admin, Tenant-Business-Analyst, Tenant-Reader | Precomputed time-series and aggregate views to keep dashboards and analytics fast. |
| 28 | Semantic search with RAG | `28-semantic-search-rag.md` | Tenant-Business-Analyst, Topic-Center-Analyst, Tenant-Brand-Reputation-Manager | Vector-backed semantic search and natural-language Q&A over ingested posts. |

### Priority recommendation (top 5)

From `feature-priority-matrix.md`, the strongest near-term candidates are:

1. `26-watchlist-volume-preview` — prevents runaway ingestion costs.
2. `22-metric-explainability` — cheap accessibility win.
3. `20-crisis-threshold-wizard` — simple `02` + `09` composition.
4. `19-self-service-onboarding-checklist` — pure UI over existing APIs.
5. `18-prospecting-list` — simple CRUD for social selling.
