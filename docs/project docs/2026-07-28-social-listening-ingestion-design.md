# Social Listening / Insights Subsystem — Design Spec

**Date:** 2026-07-28
**Status:** Approved for implementation
**Scope:** First subsystem of a standalone social monitoring platform (rebuild inspired by the discontinued Microsoft Social Engagement). Later subsystems — Brand Reputation & Alerts, Social Care, Social Selling — are out of scope for this spec and will be designed separately, consuming this subsystem's outputs.

---

## 1. Purpose & Context

This subsystem is responsible for:
- Connecting to multiple social/web platforms per tenant, using each tenant's own credentials
- Ingesting posts matching tenant-defined watchlists (keywords, hashtags, accounts, boolean queries)
- Normalizing platform-specific data into a common schema
- Enriching posts with sentiment, entities, and key phrases via a swappable AI provider
- Persisting data with strict multi-tenant isolation
- Exposing ingested data to downstream subsystems via events (real-time) and a REST API (historical/query)

It does **not** include: alerting/crisis detection, case routing, lead-gen recommendations, or any charting/dashboard UI — these are explicitly deferred to future subsystems.

---

## 2. Architecture Overview

Two separate repositories:

- **`social-listening-core`** — backend. Connector framework, ingestion, normalization, enrichment, storage, event publishing, REST API. Designed to be fully usable independent of any UI.
- **`social-listening-admin`** — Next.js. Thin admin layer: OAuth connect/disconnect flows, watchlist management, connector/AI-provider health status. Talks to `social-listening-core`'s REST API only; never touches the database directly.

**Tech stack:** TypeScript/Node.js throughout. Azure-native: Azure Database for PostgreSQL, Azure Key Vault–backed envelope encryption for credentials, Azure AI Language for enrichment (swappable via the AI provider connector pattern), Azure Service Bus for eventing.

**High-level data flow:**

```
[Platform APIs / Webhooks]
        |
        v
[Provider Connector Layer]  (per-platform adapters, poll or push)
        |
        v
[Normalization]  -> common SocialPost + Author schema
        |
        v
[Enrichment via AI Provider Connector]  (sentiment, entities, key phrases, language)
        |
        v
[Postgres — RLS, tenant-isolated]
        |                                  |
        v                                  v
[Azure Service Bus]                  [REST API]
(real-time events, thin)             (historical/query, paginated)
        |
        v
(future: Brand Reputation, Social Care, Social Selling subsystems)
```

---

## 3. Connector Framework

### 3.1 Generalized Provider Connector Pattern

Both social platforms and AI enrichment providers are specializations of a shared base contract — connect, discover, respect rate limits, execute. This lets AI providers (Azure AI Language today; OpenAI, Claude, or others later) be swapped using the exact same registration pattern as social platforms.

```typescript
interface RateLimitConfig {
  strategy: 'fixed-window' | 'token-bucket' | 'quota-based';
  requestsPerWindow?: number;
  windowSeconds?: number;
  quotaPerDay?: number;
  costPerRequest?: (endpoint: string) => number;
  supportsLiveHeaders: boolean;
}

interface ProviderConnector {
  providerId: string;
  authMode: 'oauth' | 'apiKey';
  getRateLimitConfig(): RateLimitConfig;
  parseRateLimitHeaders?(headers: Headers): Partial<RateLimitState>;
}

interface SocialConnector extends ProviderConnector {
  deliveryMode: 'push' | 'poll';
  getAuthUrl?(tenantId: string): string;
  handleAuthCallback?(code: string): Promise<Credential>;
  validateApiKey?(key: string): Promise<boolean>;
  refreshToken?(credential: Credential): Promise<Credential>;
  poll?(credential: Credential, watchlist: Watchlist): Promise<RawPost[]>;
  registerWebhook?(credential: Credential, watchlist: Watchlist): Promise<void>;
  handleWebhookPayload?(payload: unknown): RawPost[];
  normalize(raw: RawPost): { post: SocialPost; author: Author };
}

interface AIProviderConnector extends ProviderConnector {
  listModels(credential: Credential): Promise<ModelInfo[]>;
  getModelRateLimit(modelId: string): RateLimitConfig;
  getModelCapabilities(modelId: string): ModelCapabilities;
  analyze(text: string, modelId: string, settings: ModelSettings): Promise<AnalysisResult>;
}
```

### 3.2 Rate Limiting

Every connector declares its own platform-imposed limits via `getRateLimitConfig()` — these are never invented by the core, only reflected from what the platform documents (e.g. X's per-tier request windows, YouTube's daily quota-cost model, Reddit's per-minute cap).

- A shared `RequestGate` in the core enforces limits **per `(tenantId, providerId)`** — never globally — since each tenant brings independent credentials/quota.
- Where a platform returns live rate-limit state in response headers, `parseRateLimitHeaders()` updates the gate's live state, which takes priority over the static declared config.
- Requests that would exceed the limit are **queued and retried after window reset**, never dropped silently.
- AI providers extend this one level deeper: rate limits are typically per-model (`getModelRateLimit(modelId)`), not just per-provider.

### 3.3 Adding a New Platform or AI Provider

Implementing the interface + registering it. No changes to the core pipeline required.

---

## 4. Data Model

### 4.1 `Author`

Normalized once per platform account, not duplicated per post.

```typescript
interface Author {
  id: string;
  tenantId: string;
  platformId: string;
  externalAuthorId: string;
  handle: string;
  displayName?: string;
  profileLocation?: string;        // raw self-reported text, e.g. "London, UK" — not geocoded
  followerCount?: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  rawProfilePayload?: Record<string, unknown>;
}
```

Upserted on `(tenantId, platformId, externalAuthorId)` as new posts arrive.

### 4.2 `SocialPost`

```typescript
interface SocialPost {
  id: string;
  tenantId: string;
  platformId: string;
  externalId: string;
  authorId: string;                // FK -> Author
  acquisitionId: string;           // FK -> IngestionRun
  ingestedAt: Date;
  text: string;
  url: string;
  publishedAt: Date;
  engagementMetrics: { likes?: number; shares?: number; comments?: number; views?: number };
  postGeoLocation?: { lat: number; lng: number; placeName?: string };  // rare; per-event, not per-author
  watchlistId: string;
  rawPayload: Record<string, unknown>;   // JSONB, full original payload — never discarded
  enrichment?: {
    sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
    sentimentScores?: { positive: number; neutral: number; negative: number };
    keyPhrases?: string[];
    entities?: { text: string; category: string; confidenceScore: number }[];
    detectedLanguage?: string;
    modelUsed?: { providerId: string; modelId: string };  // traceability
    enrichedAt?: Date;
  };
}
```

Unique constraint on `(platformId, externalId)` prevents duplicate ingestion across overlapping polls/webhooks.

### 4.3 `IngestionRun` (acquisition tracking)

```typescript
interface IngestionRun {
  id: string;                      // acquisition ID
  tenantId: string;
  platformId: string;
  connectorVersion: string;
  triggerType: 'poll' | 'webhook';
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'succeeded' | 'failed' | 'partial';
  postsIngested: number;
  postsSkipped: number;            // e.g. duplicates
  errorSummary?: string;
  retryable?: boolean;
}
```

Every `SocialPost` links to the `IngestionRun` that produced it via `acquisitionId`. This is the immutable audit anchor: which process, at what time, with what connector version, brought this data in.

### 4.4 `Watchlist`

```typescript
interface Watchlist {
  id: string;
  tenantId: string;
  name: string;
  matchType: 'keyword' | 'hashtag' | 'account' | 'boolean';
  terms: string[];
  booleanQuery?: string;           // e.g. "acme AND (support OR help) NOT jobs"
  platformIds: string[];           // scoped to a subset of connected platforms
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Matching happens connector-side where the platform supports native filtering (translated into the platform's own query syntax); post-fetch matching is the fallback for platforms without it.

### 4.5 `AuthorTopicSignal` (materialized view, periodic refresh)

Supports "find an author knowledgeable about topic X." Kept deliberately simple for v1 — no computed expertise score, raw signals only, so ranking logic stays with the API consumer rather than being baked into the data model prematurely.

```typescript
interface AuthorTopicSignal {
  authorId: string;
  tenantId: string;
  topic: string;                   // normalized entity/keyphrase
  mentionCount: number;
  firstMentionAt: Date;
  lastMentionAt: Date;
  activeMonthsCount: number;       // distinct calendar months with >=1 mention — favors sustained engagement
  avgEngagement: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
}
```

### 4.6 Deferred (explicitly out of scope for this subsystem)

- `TopicDailyCount` — daily mention-count time series for charting topic volume over time. Underlying data (`enrichment.entities`/`keyPhrases`, `publishedAt`) is already captured; the aggregation and any charting UI is deferred to a future insights/dashboard subsystem.

---

## 5. Connector Health

`ConnectorHealth` is **not** separately tracked mutable state — it is computed from `IngestionRun` history, so there is exactly one source of truth and no possibility of drift.

```typescript
interface ConnectorHealth {
  tenantId: string;
  platformId: string;
  status: 'healthy' | 'degraded' | 'failing' | 'disconnected';   // derived
  lastSuccessfulFetchAt?: Date;    // derived
  lastAttemptAt: Date;             // derived
  consecutiveFailures: number;     // derived
  credentialStatus: 'valid' | 'expiring_soon' | 'expired' | 'revoked';  // genuinely separate state, lives on Credential
}
```

Derivation logic (simplified):
- `failing`: ≥10 failed `IngestionRun`s within the last hour for this `(tenantId, platformId)`
- `degraded`: some recent failures, but a successful run within the last hour
- `disconnected`: no runs recorded
- `healthy`: otherwise

**Error handling:**
- Retryable errors (rate limit, transient network, 5xx) → exponential backoff, automatic retry
- Non-retryable errors (401/403, malformed watchlist) → immediate `failing`, surfaced to tenant, no blind retry
- OAuth token refresh attempted automatically before failing; only surfaces to the user if refresh itself fails
- After the failure threshold, the connector auto-disables for that tenant with a clear reason, rather than silently failing indefinitely
- All isolation is per-tenant: one tenant's failing/expired connector never affects another tenant's ingestion

---

## 6. REST API Surface (v1)

```
POST   /connectors/:platformId/connect
DELETE /connectors/:platformId/disconnect
GET    /connectors                                    — list + derived ConnectorHealth

POST   /watchlists
GET    /watchlists
PATCH  /watchlists/:id
DELETE /watchlists/:id

GET    /posts?watchlistId=&platformId=&from=&to=&sentiment=&cursor=   — cursor-paginated
GET    /posts/:id

GET    /authors/:id
GET    /topics/:topic/authors?sortBy=activeMonths|mentionCount        — expert-finder query

POST   /ai-providers/:providerId/connect
GET    /ai-providers/:providerId/models
POST   /ai-providers/:providerId/select-model
```

Cursor-based pagination on `/posts` (not offset), since the table is high-volume and unbounded.

---

## 7. Service Bus Event Schema

Events are deliberately thin — IDs and the minimal fields needed for a downstream subscriber to decide whether to act, not full post bodies. Full data is fetched via the REST API on demand, avoiding two systems holding potentially-stale duplicate copies.

```typescript
interface SocialPostIngestedEvent {
  eventType: 'social.post.ingested';
  tenantId: string;
  postId: string;
  platformId: string;
  watchlistId: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  publishedAt: Date;
  occurredAt: Date;
}

interface ConnectorHealthChangedEvent {
  eventType: 'connector.health.changed';
  tenantId: string;
  platformId: string;
  previousStatus: string;
  newStatus: string;
  occurredAt: Date;
}
```

Per-tenant filtering is handled via Service Bus subscription SQL filters on `tenantId`, so downstream subsystems only receive events for tenants they serve.

---

## 8. Security & Multi-Tenancy

- **Credential storage:** OAuth tokens and API keys are encrypted at rest using envelope encryption backed by Azure Key Vault. OAuth is used wherever a platform supports it; API keys are the fallback for platforms without OAuth (e.g. some RSS/newswire providers).
- **Tenant isolation:** Enforced at the database layer via Postgres Row-Level Security on every table carrying `tenantId` — not just application-level filtering.
- **Rate limit isolation:** Enforced per `(tenantId, providerId)`, so one tenant's usage never throttles another's.

---

## 9. Explicitly Out of Scope (this spec)

- Charting/visualization UI (topic-over-time graphs, dashboards) — deferred to a future insights subsystem
- Brand Reputation, Social Care, Social Selling subsystems — each will be its own spec, consuming this subsystem's events/API
- Geocoding of `profileLocation` free text into structured region data
- Sophisticated expertise scoring beyond raw `AuthorTopicSignal` fields

---

## 10. Open Questions for Implementation Phase

**Resolved (2026-07-29), see [`docs/implementation-plan.md`](../implementation-plan.md):**

- **Initial connector build order:** RSS/News first (poll-only, API-key auth, no paid tier — validates the full pipeline cheaply), then Reddit second (poll, OAuth, real rate limits and boolean-query needs — proves the `ProviderConnector` abstraction, ADR-0002, generalizes rather than having been shaped around only the first connector). Both are Phase 1 of the implementation plan. Remaining platforms (X, YouTube, LinkedIn, Meta, Newswire) are prioritized during Phase 4 (multi-connector scale-out), order not yet decided.
- **Dead-letter failure threshold:** the flat "10 consecutive failures" placeholder (ADR-0010) governs through Phases 1–3. ADR-0023 (Proposed — a proportional, rate-relative threshold) is deferred to Phase 4, to be tuned once real differently-paced connectors exist to tune it against, per the "Pending supersession note" already recorded in ADR-0009 and ADR-0010.
- **Testing strategy and CI/CD pipeline:** this is a solo-developer personal project, not a team effort — recommend starting deliberately lightweight rather than provisioning team-scale process for a team of one. Concretely: GitHub Actions on every push/PR running lint, type-check, and unit tests for both repos; one integration-test tier running against an ephemeral/dockerized Postgres instance (RLS policies and JSONB behavior need real Postgres, not a mock); no CODEOWNERS, no OpenAPI-first contract-testing pipeline yet (both already deferred per `docs/adr/README.md`'s "Considered and explicitly not drafted" list, for the same reason — process built for contributors/consumers that don't exist yet). Revisit if the project gains contributors or a real downstream subsystem consumer.
