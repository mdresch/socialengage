---
name: search-provider-connector
description: Explains the SearchProviderConnector abstraction (ADR-0120) for one-off web search providers, including query shapes, registration, activation and credential gating, and dedicated rate limiting.
---

# SearchProviderConnector Abstraction

## Overview

Story 14.3 (ADR-0120) establishes a first-class `SearchProviderConnector` abstraction for on-demand public web search. This generalizes one-off search capabilities (initially created as internal helpers in Story 2.31 / ADR-0076) so that Brave Search, Bing Search, and future search engines can be invoked by downstream features without duplicating query building, credential extraction, or rate-limiting.

## Core Interface Contract

The contract lives in `src/connectors/types.ts`:

```typescript
export interface SearchRequest {
  q: string;
  limit?: number; // default 5, hard cap 10
  freshness?: 'any' | 'day' | 'week' | 'month';
  market?: string; // optional ISO country/language hint (e.g. 'en-US')
}

export interface SearchItem {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

export interface SearchResponse {
  results: SearchItem[];
}

export interface SearchProviderConnector {
  readonly providerId: string;
  search?(ctx: ConnectorContext, request: SearchRequest): Promise<SearchResponse>;
  getRateLimitConfig?(): RateLimitConfig;
  getSearchRateLimitConfig?(): RateLimitConfig;
}
```

## Guiding Principles & Invariants

1. **Registry Integration (ADR-0048):**
   - Search connectors are registered in `src/connectors/registry.ts` via `registerSearchProviderConnector()` and discovered via `getSearchProviderConnector()` or `listSearchProviderConnectors()`.
   - `bootstrapConnectors.ts` registers search-capable connectors at startup.

2. **Gating on Activation & Credentials (ADR-0051, ADR-0028):**
   - A search connector must be activated in `connector_activations` for the tenant.
   - The tenant must have a valid credential stored in `platform_credentials`.
   - Inactive or uncredentialed invocations throw descriptive errors.

3. **Dedicated Rate-Limit Gating (ADR-0020, ADR-0120 §4):**
   - Rate limiting uses a dedicated `RequestGate` key: `${tenantId}:${providerId}:search`.
   - Search calls never starve ingestion polls, outbound posts, or AI research gates.
   - Accessed via `acquireForSearch(tenantId, connector)`.

4. **Optional Method & Error Semantics:**
   - `search?()` is optional on `SearchProviderConnector`. If a caller attempts to execute search on a provider without `search?()`, the system raises `search_not_supported`.

5. **Ephemeral & Read-Only:**
   - One-off search is strictly ephemeral: it never writes to `social_posts` or `post_watchlist_matches`.
