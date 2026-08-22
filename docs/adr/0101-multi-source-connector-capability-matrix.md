# ADR-0101: Multi-source connector capability matrix

**Status:** Proposed (2026-08-23)

**Authorizes:** a `SocialConnector` capability matrix (`poll`, `count`, `publish`, `reply`, `backfill`) and the `GET /v1/connectors/capabilities` endpoint that lets the UI render the right actions per platform.

**Source:** `docs/product-research/feature-designs/01-multi-source-ingestion.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Connectors do not all do the same things
`docs/product-research/feature-designs/01-multi-source-ingestion.md` describes multi-source ingestion. The platform now has connectors that poll (GNews, Newswire, Wikipedia, Brave, Bing, tenant-owned-feed), OAuth connectors (Facebook, Instagram, LinkedIn), and an optional publish/reply path. The UI must know which actions are valid for each connector.

### 2. Capabilities are already emerging in separate ADRs
`ADR-0077` added `count?()`, `ADR-0073` added `reply?()`, and `ADR-0098` added `publish?()`. This ADR unifies them into a discoverable capability matrix.

### 3. Hardcoding capabilities in the UI is brittle
A connector should declare its capabilities so the UI can disable or hide unsupported actions without a front-end release.

---

## Decision

### 1. `SocialConnector` capability interface
```ts
interface SocialConnectorCapabilities {
  poll: boolean | { cadenceMs: number; supportsTimeWindow: boolean };
  count?: { supportsExactCount: boolean };
  publish?: { supportsScheduling: boolean; supportedAssetTypes: string[] };
  reply?: boolean;
  backfill?: { supportsHistorical: boolean; maxLookbackDays: number };
}

interface SocialConnector {
  // ... existing ...
  getCapabilities(): SocialConnectorCapabilities;
}
```

### 2. Capability registry
- Each connector implementation returns a static or runtime `SocialConnectorCapabilities` object.
- The registry in `src/connectors/registry.ts` exposes `getConnectorCapabilities(platformId)`.
- Capabilities can vary by connector version or by the tenant's API tier.

### 3. `GET /v1/connectors/capabilities` endpoint
```ts
// Response
{
  platformId: string;
  name: string;
  authMode: 'api_key' | 'oauth' | 'none';
  capabilities: SocialConnectorCapabilities;
}
```

- Returns all registered connectors and their capabilities.
- The admin UI and composer use this to decide which platforms to offer for publishing, reply, and preview.

### 4. Connector health and activation flow
- `connector_activations` (ADR-0051) remains the source of truth for "is this connector active for this tenant/user".
- `GET /v1/connectors/:platformId/health` uses `ConnectorHealth` and `getCapabilities()` to report whether the connector is available and healthy.
- A connector can be `healthy` but `capability-limited` (e.g., API key tier does not support `count`).

### 5. Backfill and historical ingestion
- `backfill?()` allows a connector to ingest historical posts beyond the normal polling window.
- It is optional and bounded by `maxLookbackDays`.
- Backfill is triggered by a Platform-Admin or Tenant-Admin action, not automatically.

---

## Consequences

1. **UI reflects reality:** the composer shows only publishable platforms for the current tenant.
2. **No front-end churn:** adding a new capability to a connector does not require UI code changes.
3. **Foundation for `count`, `publish`, and `reply` features:** capabilities are the first gate; actual implementation follows.
4. **Version drift:** as platforms change their APIs, capability declarations may need runtime updates.

---

## Alternatives considered

1. **Hardcode capabilities in the admin UI config.**
   - *Rejected:* it duplicates connector knowledge and becomes stale. Capabilities belong with the connector.

2. **Use a static JSON file for capabilities.**
   - *Rejected:* it cannot reflect runtime state or tenant-specific API tiers. The connector implementation is the source of truth.

3. **Infer capabilities from which methods are implemented at runtime.**
   - *Rejected:* `SocialConnector` may stub methods with error throws. Explicit `getCapabilities()` is clearer.

---

## Open questions

- Should `count` capability vary by connector or by platform? A single platform may have multiple connector implementations.
- How are capability differences per API tier exposed? A `tier` field or `capabilities.tier`?
- Should `backfill` require a separate `tenant_admin` permission?
- How is `getCapabilities()` tested in contract tests?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0077` (count), `ADR-0073` (reply), `ADR-0098` (publish), `ADR-0051` (connector activation)
