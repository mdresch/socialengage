---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# AI sentiment analysis

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

## Technical design

- **Data flow:** `SocialPost` inserted → `enrichPost()` invokes `AIProviderConnector.analyze()` with `body_markdown` and `detectedLanguage` → provider returns `sentiment`, `confidence`, `keyPhrases`, `entities` → stored in `social_posts.enrichment` JSONB → analytics and post feed read from JSONB.
- **Component interactions:** `ProviderConnector`/`AIProviderConnector` interface allows swapping Azure AI Language and Azure OpenAI (Story 2.9/2.10); `enrichPost()` is provider-agnostic and structured-output aware.
- **REST/Service Bus contracts:** `POST /v1/posts/:id/enrich` for manual enrichment (Story 6.16); `SocialPostIngestedEvent` triggers async enrichment; `GET /v1/posts` returns `enrichment`.
- **Storage:** `social_posts.enrichment` JSONB for raw model output; `published_at` and `provider_id` provide time-series context.
- **Security considerations:** No PII in enrichment payloads; `tenant_id` RLS; model output is deterministic/reproducible; fallback on provider failure to prevent ingestion blocking.

## Backend principles

- **Provider-agnostic `AIProviderConnector`.** Sentiment is one field in a pluggable enrichment pipeline. Add new models by registering a new AI connector, not by branching `enrichPost()`.
- **Postgres + RLS.** `social_posts` is already tenant-scoped and RLS-protected. No new table needed until aspect-based or historical roll-ups are introduced.
- **Idempotent, async enrichment.** Re-running `enrichPost()` on the same post must be safe and overwrite the JSONB blob. Live ingestion and manual re-enrichment both use the same path.
- **Contract-test targets.** Verify `sentiment` label domain (positive/neutral/negative/mixed), provider fallback, language-gated routing, and that enrichment does not break `social_posts` RLS.

## Frontend / UI principles

- **User flow:** post feed shows sentiment chips → filter by sentiment → dashboard widget shows sentiment over time → user can trigger manual re-enrichment.
- **Component hierarchy:** `SentimentChip` (post list) → `SentimentFilter` (feed filter) → `SentimentWidget` (dashboard line/donut chart).
- **State management:** Dashboard widgets read from `GET /v1/posts` with aggregations client-side; post feed uses server-side sentiment filter.
- **Accessibility and responsive design:** Color-blind safe chips (icon + text), screen-reader announcements for sentiment filter changes, responsive chart using recharts or equivalent.

## Open questions

- Should we move from document-level to aspect-based sentiment ("battery life" vs. "price")?
- Do we need per-language models or is a single multilingual model sufficient?
- How should confidence scores be exposed to end users?
- Should historical posts be re-enriched when a new model is deployed?
- What is the cost/usage budget for Azure AI Language per tenant?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Document vs. aspect-based sentiment?** | Keep **document-level in v1** and add **opinion mining / aspect-based sentiment** as a v2 `enrichment` enhancement. Azure AI Language already supports `opinionMining=true` at no extra cost, and the same JSONB `enrichment` blob can absorb aspect-level data without a schema migration. | Azure Learn docs show opinion mining is an extension of sentiment analysis and is included in the same pricing tier. Research surveys on cross-lingual ABSA confirm that multilingual pre-trained models (mBERT, XLM-R) and fine-tuned LLMs are the state of the art. |
| **Per-language models or one multilingual model?** | Use **one multilingual model for v1**. Azure AI Language's sentiment analysis is multilingual; XLM-R/mBERT research demonstrates strong cross-lingual transfer. Add per-language fine-tuning only when a specific low-resource language underperforms. | Cross-lingual ABSA survey and LREC 2026 papers show that mPLMs are now the standard tool for multilingual ABSA, with LLMs reaching the highest scores. |
| **Confidence score UI?** | Expose a **low / medium / high** confidence pill and a **"What drove this?"** expansion that shows the contributing phrases. Azure AI Language returns confidence per sentence/aspect; make it visible but not the primary metric. | Azure opinion-mining API returns confidence scores and aspect/phrase drivers. Sentiment explainability is a known UX best practice. |
| **Re-enrich historical posts?** | **Yes, on demand**, not automatically. Provide a tenant-scoped "Re-enrich posts" action for a selected watchlist + date range. Charge the cost against the tenant's AI quota; model upgrades are not worth a full corpus re-enrichment unless the user explicitly asks. | Azure container and async docs show reprocessing is straightforward but billed per text record. Re-enrichment should be treated as a controlled, cost-capped job. |
| **Cost/usage budget?** | Use the **5,000 free text records/month** tier, then standard pay-per-1,000. Enforce a per-tenant monthly cap (e.g., 100k records for `tenant_user`, 500k for `tenant_admin`) and an 80% usage alert. Sentiment and key-phrase extraction count as separate text records if called together. | Azure pricing pages note 5,000 free records/month across Language features and tiered pricing per 1,000 text records. Async calls charge per feature per text record. |

### Sources consulted

- Cross-lingual ABSA survey — https://nlp.kiv.zcu.cz/upload/Cross_lingual_Aspect_Based_Sentiment_Analysis__A_Survey_on_Tasks__Approaches__and_Challenges.pdf
- LREC 2026 cross-lingual ABSA — https://lrec.elra.info/lrec2026-main-635
- ACL 2026 multilingual ABSA — https://aclanthology.org/2026.findings-acl.298/
- Azure AI Language pricing — https://azure.microsoft.com/en-us/pricing/details/language/
- Azure async billing — https://learn.microsoft.com/en-us/azure/ai-services/language-service/concepts/use-asynchronously
- Azure sentiment and opinion mining — https://learn.microsoft.com/en-us/azure/ai-services/language-service/sentiment-opinion-mining/how-to/call-api
- Azure sentiment containers — https://learn.microsoft.com/en-us/azure/ai-services/language-service/sentiment-opinion-mining/how-to/use-containers

## Persona acceptance

- **Tenant-Brand-Reputation-Manager (primary):** can see sentiment trend, volume, and the posts driving negative or positive shifts at a glance.
- **Tenant-Reader (primary):** can understand sentiment labels without technical knowledge; each score includes a confidence indicator and the phrases that drove it.
- **Tenant-User (primary):** can filter the post feed by sentiment and trigger a manual re-enrichment when needed.
- **Tenant-Social-Care-Agent (secondary):** can triage complaints faster by sorting the inbox by negative sentiment and confidence.
- **Topic-Center-Analyst (secondary):** can correlate topic volume with sentiment change to detect deteriorating themes.

## AI enhancements

- **Aspect-based sentiment:** identify *what* the post is positive/negative about (e.g., price vs. battery life).
- **Emotion and sarcasm detection:** move beyond positive/negative to joy, anger, fear, irony.
- **Multilingual zero-shot sentiment:** a single model that works across the supported languages without per-language retraining.
- **Confidence and explainability:** show the phrases that drove the score.
