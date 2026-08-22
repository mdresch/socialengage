# AI Enhancement Opportunities per Feature

A cross-cutting view of where AI can add value to every capability in `docs/product-research/feature-designs/`. These are not implementation commitments; they are candidates for ADRs, experiments, and v2/v3 backlog items.

---

## 01 Multi-source ingestion

- **Source-quality scoring:** AI ranks sources by reliability, bias, and freshness before they are activated.
- **Duplicate/merge detection:** LLM + vector similarity to spot the same story across RSS, news, and social.
- **Content summarization:** long-form news or review articles are summarized before display in the post feed.
- **Auto-categorization:** incoming posts are pre-tagged by topic, source type, and urgency.

## 02 Boolean query builder

- **Natural-language to Boolean:** user types “show me positive mentions of our brand in English but not from trolls” and the AI emits a valid `watchlist_ast`.
- **Query explanation:** AI explains why a query matched or missed a post in plain language.
- **Suggested refinements:** based on sample results, the AI recommends excluding keywords or adding operators to reduce noise.
- **Connector-aware validation:** the builder warns when a query cannot be translated into a connector's native filtering.

## 03 AI sentiment analysis

- **Aspect-based sentiment:** identify *what* the post is positive/negative about (e.g., price vs. battery life).
- **Emotion and sarcasm detection:** move beyond positive/negative to joy, anger, fear, irony.
- **Multilingual zero-shot sentiment:** a single model that works across the supported languages without per-language retraining.
- **Confidence and explainability:** show the phrases that drove the score.

## 04 AI topic clustering

- **Generative topic labels:** cluster names are human-readable summaries rather than raw keywords.
- **Trend and anomaly detection:** the AI flags emerging clusters and unusual spikes automatically.
- **Merge/rename suggestions:** the UI can recommend that two AI-generated topics are actually the same.
- **Topic drift tracking:** detect when the meaning of a topic changes over time.

## 05 Influencer discovery

- **AI scoring model:** learn from historical engagement and relevance to rank authors.
- **Bot/fake-follower detection:** the AI flags inauthentic engagement.
- **Lookalike author recommendations:** given one high-value author, the AI suggests similar ones.
- **Topical relevance matching:** score an author’s recent content against a watchlist or campaign theme.

## 06 Unified social inbox

- **Reply suggestions:** generate context-aware reply drafts for the inbox composer.
- **Tone and style adaptation:** adjust the draft to be formal, friendly, or apologetic.
- **Urgency and intent routing:** the AI predicts which messages need the fastest response and to whom they should be assigned.
- **Crisis/escalation scoring:** flag a conversation that is likely to escalate before it does.

## 07 Publishing and scheduling

- **AI copy assistance:** rephrase, shorten, expand, or adjust tone in the Polypost Composer (ADR-0072).
- **Deep research agent:** one-off Brave/Bing research summarized for the author (ADR-0076).
- **Optimal send-time prediction:** learn from historical engagement per asset and recommend the best slot.
- **Per-platform adaptation:** auto-tailor length, hashtags, and mentions for each target network.
- **Alt-text generation and image suitability review:** AI suggests accessible text and warns if an image may violate platform rules.
- **Post-performance preview:** a simulated prediction of engagement before publishing.

## 08 Dashboards and analytics

- **AI Spike Storyteller:** automatically explain why a metric changed (ADR-0062).
- **Natural-language analytics:** ask “what was the most negative topic last week?” and get a chart + summary.
- **Anomaly and forecast:** time-series detection of unusual patterns and forward-looking projections.
- **Automated insight cards:** the AI surfaces the top 3 takeaways from a dashboard view.

## 09 Real-time alerts

- **Smart threshold recommendation:** the AI learns normal volume patterns and suggests alert thresholds.
- **Alert summarization:** when a spike occurs, the AI writes a short paragraph of what is happening and why.
- **False-positive filtering:** the AI suppresses repeated or irrelevant triggers.
- **Root-cause snippets:** the alert includes the most representative posts driving the trigger.

## 10 Data export

- **AI-generated export summary:** a plain-language overview of what is in the export and why it might matter.
- **Smart redaction suggestions:** the AI flags fields that may contain PII or secrets before export.
- **Data quality scoring:** warn if the exported dataset is incomplete, skewed, or has gaps.
- **Natural-language export builder:** “give me all negative Facebook mentions from July” is turned into the right filters and format.

## 11 API and integrations

- **Webhook payload summarization:** the AI writes a compact, human-readable summary of a webhook event.
- **Natural-language API query builder:** a helper that turns a question into the right `GET /v1/posts` query parameters.
- **Integration recommendation:** based on tenant usage, the AI suggests which CRM/support tool to connect.
- **Anomaly detection on API usage:** flag unusual access patterns per key/tenant.

## 12 Multi-user workspaces and RBAC

- **Role-recommendation engine:** the AI suggests whether a new user should be `tenant_user` or `tenant_admin` based on their domain.
- **Audit-log summarization:** turn raw `platform_admin_audit_log` rows into a human-readable activity summary.
- **Access-pattern anomaly detection:** flag when a user or key is accessing data outside their normal pattern.
- **Right-to-erasure assistance:** the AI helps identify which data belongs to a user being deleted or exported.

---

## Cross-cutting AI themes

| Theme | Example features |
|---|---|
| **AI for writing** | Polypost copy assistance, reply suggestions, alt-text, per-platform rewrites, query builder natural language |
| **AI for analysis** | Sentiment, topic clustering, influencer scoring, spike storytelling, dashboard insights, source quality scoring |
| **AI for decisions** | Optimal send time, alert thresholds, urgency routing, escalation scoring, role recommendations, integration suggestions |
