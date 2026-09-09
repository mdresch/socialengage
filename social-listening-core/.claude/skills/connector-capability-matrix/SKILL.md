---
name: connector-capability-matrix
description: Explains the SocialConnector capability matrix, sourceType taxonomy, and the GET /v1/connectors/capabilities endpoint.
---

# Connector Capability Matrix Skill

## Contracts that constrain this component

- `social-listening-core/contracts/epic-12/story-12.1.connector-capability-matrix.contract.test.ts` — Story 12.1 contract test.

## Background & ADR-0101 Context
Different connectors provide different ingestion, verification, count, publish, reply, and backfill capabilities. ADR-0101 establishes a canonical `SocialConnectorCapabilities` interface with a mandatory `sourceType` taxonomy, allowing the frontend admin UI, composers, and downstream consumers to dynamically discover which operations are supported on each data platform.

## Taxonomy (`sourceType`)
- `'social'` — Facebook, Instagram, LinkedIn, YouTube
- `'news'` — GNews, Newswire, Brave Search, Bing Search
- `'blog'` — Tenant-Owned Feed (RSS / Atom)
- `'wiki'` — Wikipedia
- `'forum'` — Forum communities
- `'review'` — Review platforms
- `'broadcast'` — Radio / TV / Podcasts

## Schema (`SocialConnectorCapabilities`)
```ts
export interface SocialConnectorCapabilities {
  sourceType: 'social' | 'news' | 'forum' | 'review' | 'broadcast' | 'blog' | 'wiki';
  poll: boolean | { cadenceMs: number; supportsTimeWindow: boolean };
  count?: { supportsExactCount: boolean };
  publish?: { supportsScheduling: boolean; supportedAssetTypes: string[] };
  reply?: boolean;
  backfill?: { supportsHistorical: boolean; maxLookbackDays: number };
}
```

## Endpoints
- `GET /v1/connectors/capabilities` — Authenticated list of all registered connectors with their capabilities and authMode.
- `GET /v1/connectors/:platformId/health` — Combines `ConnectorHealth` with the connector's resolved capabilities.
