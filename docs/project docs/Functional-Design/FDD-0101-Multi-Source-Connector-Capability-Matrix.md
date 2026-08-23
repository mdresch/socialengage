# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0101 Multi-Source Connector Capability Matrix — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft) |
| Related Documents | ADR-0101, BRD-0101, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

Connectors in the SocialEngage platform do not all provide the same actions. Some can only poll for content, while others support counting results, publishing outbound posts, replying to conversations, or pulling historical data. Today the UI has no standard way to discover what each platform supports, which risks presenting unsupported actions to users and forces the front-end team to hardcode or release front-end changes whenever a connector gains a new capability.

This FDD translates the accepted architecture and business requirements from ADR-0101 and BRD-0101 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - Defining a capability matrix contract for `SocialConnector` implementations (poll, count, publish, reply, backfill).
- A connector capability registry that exposes per-platform capabilities.
- A `GET /v1/connectors/capabilities` endpoint for UI consumption.
- Integrating capabilities into the `GET /v1/connectors/:platformId/health` response so health can be reported alongside capability limits.
- Backfill as an optional, bounded capability triggered by admin action.
- Capability declaration for at least three existing connectors.
- UI changes in `social-listening-admin` to read and display the capability matrix (stories 12.1 and 12.2).
- **Out of scope:** - Full implementation of the `count`, `publish`, `reply`, and `backfill` features themselves (this BRD only authorizes the discovery layer).
- Adding new connectors beyond those already in the platform.
- Automatic or scheduled historical backfill (backfill is triggered by Platform-Admin or Tenant-Admin action only).
- Changes to OAuth token refresh, media storage, or cross-platform author identity.
- Governing permissions for backfill beyond the existing role model.
- **Assumptions and constraints:** - `connector_activations` (ADR-0051) remains the source of truth for whether a connector is active for a tenant or user.
- Capabilities can vary by connector implementation and by the tenant's API tier or plan.
- The existing authentication and RLS model applies to the new endpoint.
- The front-end will consume the capabilities endpoint and no longer rely on hardcoded lists.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Connectors do not all do the same things
`docs/product-research/feature-designs/01-multi-source-ingestion.md` describes multi-source ingestion. The platform now has connectors that poll (GNews, Newswire, Wikipedia, Brave, Bing, tenant-owned-feed), OAuth connectors (Facebook, Instagram, LinkedIn), and an optional publish/reply path. The UI must know which actions are valid for each connector.

### 2. Capabilities are already emerging in separate ADRs
`ADR-0077` added `count?()`, `ADR-0073` added `reply?()`, and `ADR-0098` added `publish?()`. This ADR unifies them into a discoverable capability matrix.

### 3. Hardcoding capabilities in the UI is brittle
A connector should declare its capabilities so the UI can disable or hide unsupported actions without a front-end release.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Make connector actions discoverable and consistent across the platform. | The admin UI and composer can read capabilities from a single endpoint and reflect them accurately. |
| 2 | Reduce front-end releases required when a connector gains a new capability. | New capabilities are reflected in the UI without a dedicated UI code change in 100% of cases. |
| 3 | Enable safe, gated rollout of `count`, `publish`, `reply`, and `backfill` features. | Each new feature checks the capability matrix before exposing its UI or API surface. |
| 4 | Improve tenant-admin confidence when connecting and activating sources. | Tenant admins can see, per platform, which actions are supported before they configure credentials. |
| 5 | Extend the platform's coverage of multi-source listening and engagement. | New sources can be added by declaring their capabilities, supporting the broader multi-source ingestion strategy. |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| FR-001 | Each `SocialConnector` implementation shall expose `getCapabilities()` returning the `poll`, `count`, `publish`, `reply`, and `backfill` capability matrix. | Must | Every connector in the registry returns a capability object matching the ADR contract. | Backend Engineer |
| FR-002 | The connector registry shall expose `getConnectorCapabilities(platformId)` to look up capabilities by platform. | Must | Given a `platformId`, the registry returns the matching connector's capabilities or a clear not-found. | Backend Engineer |
| FR-003 | The system shall provide `GET /v1/connectors/capabilities` returning all registered connectors with `platformId`, `name`, `authMode`, and `capabilities`. | Must | Endpoint returns a stable, typed JSON array; tenant RLS applies. | Backend Engineer |
| FR-004 | `GET /v1/connectors/:platformId/health` shall combine `ConnectorHealth` with capabilities and surface whether the connector is capability-limited. | Should | Response includes health status and a `capabilityLimited` flag or equivalent. | Backend Engineer |
| FR-005 | Capabilities shall be allowed to vary by connector implementation, version, or tenant API tier. | Should | A platform with multiple tiers or versions returns different capability values without breaking the UI. | Backend Engineer |
| FR-006 | The admin UI connector list and composer shall display capability badges and disable/hide unsupported actions with tooltips. | Should | UI shows `poll`, `publish`, `reply`, `count` badges; unsupported items are disabled and explain why. | Frontend Engineer |
| FR-007 | `backfill` shall be optional, bounded by `maxLookbackDays`, and triggered by an explicit Platform-Admin or Tenant-Admin action. | Could | Backfill is only shown for connectors that declare `backfill.support` and requires admin authorization. | Backend Engineer / Product Owner |
| FR-008 | At least three existing connectors shall return realistic, contract-valid capability objects. | Must | Contract tests pass for three real connectors. | Backend Engineer |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Primary user of the connector setup and status screens | High | See which actions each platform supports before connecting or activating it. |
| Sole-Operator | Daily operator monitoring ingestion and platform health | High | Understand per-connector capability limits and rate-limit saturation. |
| Tenant-User | Consumer of the normalized post feed and composer | Medium | Only see actions in the composer that the selected platform actually supports. |
| Social-Selling-Strategist | Uses source-specific author and post data | Medium | Trust that platform filters and actions reflect the real capabilities of each source. |
| Platform-Admin | Operates cross-tenant health and error dashboards | Low–Medium | See aggregate, tenant-safe connector capability coverage. |
| Backend Engineer | Implements and tests the capability contract | High | A clear, version-aware interface that is testable and registry-discoverable. |
| Product Owner | Owns roadmap and acceptance | Medium | A foundation that unblocks later `count`, `publish`, `reply`, and `backfill` stories. |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 12.1 | backend engineer | `SocialConnector.getCapabilities()` and `GET /v1/connectors/capabilities`, | the admin UI and composer can discover what each platform supports. | `SocialConnector` returns `poll`, `count`, `publish`, `reply`, and `backfill` capabilities.; Capabilities can vary by connector implementation and tenant API tier.; `GET /v1/connectors/capabilities` returns all registered connectors with their capabilities. |
| 12.2 | `Tenant-Admin` | the connector list and composer to show which actions each platform supports, | I don't try to use a feature a connector doesn't have. | `ConnectorsView` shows badges for `poll`, `publish`, `reply`, `count`.; The composer only offers publishable platforms for the current tenant.; Unsupported platforms are shown as disabled with a tooltip. |

### 6.3 Workflow Diagrams / Steps

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

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `platformId` | Short identifier for the source platform (e.g., `gnews`, `facebook`) | Connector registry | Backend | None |
| `name` | Human-readable platform name | Connector registry | Backend | None |
| `authMode` | Authentication mode (`api_key`, `oauth`, `none`) | Connector implementation | Backend | None |
| `poll` | Polling cadence and time-window support | Connector implementation | Backend | None |
| `count` | Exact-count support | Connector implementation / API tier | Backend | None |
| `publish` | Scheduling support and allowed asset types | Connector implementation / API tier | Backend | None |
| `reply` | Whether replies are supported | Connector implementation | Backend | None |
| `backfill` | Historical ingestion support and `maxLookbackDays` | Connector implementation | Backend | None |
| `ConnectorHealth` | Health status combined with capability limits | Health subsystem | Backend | Operational |
| `connector_activations` | Active/inactive state for tenant or user | Tenant/user tables | Backend | Tenant-scoped |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | Connector implementations are the source of truth for their own capabilities. |
| BRU-002 | `connector_activations` determines whether a connector is active for a tenant or user; capabilities are independent of activation state. |
| BRU-003 | A connector may be `healthy` and `capability-limited` at the same time (e.g., its API key tier does not support `count`). |
| BRU-004 | `backfill` is an explicit, admin-triggered operation and is bounded by `maxLookbackDays` for that connector. |
| BRU-005 | The front-end shall not hardcode platform capabilities; it shall derive them from `GET /v1/connectors/capabilities`. |
| BRU-006 | Optional capabilities (`count`, `publish`, `reply`, `backfill`) must be absent or declare `false`/`unsupported` when not available. |
| BRU-007 | Permission to trigger `backfill` follows the existing Platform-Admin / Tenant-Admin role model until a separate permission is explicitly added. |

---

---

## 9. Interfaces and Integrations

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

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Capability discovery shall respect existing tenant RLS and authentication. | Security | Must | Only capabilities the caller is authorized to see are returned; no cross-tenant leakage. |
| NFR-002 | The capabilities endpoint shall respond in under 500 ms at the 95th percentile for the full connector registry. | Performance | Should | Measured in contract and load tests. |
| NFR-003 | The capability contract shall be version-stable and additive only. | Maintainability | Must | New capability fields are optional and do not break existing clients. |
| NFR-004 | The UI shall remain usable and accessible when an action is disabled (keyboard focus, ARIA labels, tooltips). | Usability / Accessibility | Should | WCAG 2.1 AA patterns for disabled controls and error/tooltip text. |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Platform APIs change, causing the declared capabilities to become stale. | Medium | Medium | Treat capabilities as runtime-discoverable and version-aware; schedule regular connector audits. | Product Owner |
| R-002 | UI or downstream consumers misinterpret capability fields and expose unsupported actions anyway. | Low | Medium | Add contract tests and front-end unit tests for each capability-driven render decision. | QA / Frontend Lead |
| R-003 | Backfill is triggered without clear quota or policy, causing tenant surprise. | Low | High | Require explicit admin confirmation, enforce `maxLookbackDays`, and document quota counting. | Product Owner |
| R-004 | Tier- or version-specific capabilities create inconsistent UX across tenants. | Medium | Low | Keep capability names stable and use clear tooltips; document tier differences. | Product Owner |
| R-005 | `GET /v1/connectors/capabilities` becomes a coupling point for the front-end. | Low | Low | Keep the contract additive and versioned; avoid embedding deep business logic in the response. | Technical Lead |

---

---

## 12. Assumptions and Dependencies

- `connector_activations` (ADR-0051) remains the source of truth for whether a connector is active for a tenant or user.
- Capabilities can vary by connector implementation and by the tenant's API tier or plan.
- The existing authentication and RLS model applies to the new endpoint.
- The front-end will consume the capabilities endpoint and no longer rely on hardcoded lists.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0051: `connector_activations` source of truth | Internal / Architecture | Technical Lead | Accepted; already built. |
| D-002 | ADR-0073: `reply?()` connector interface | Internal / Architecture | Technical Lead | Accepted; capability to be unified. |
| D-003 | ADR-0077: `count?()` connector interface | Internal / Architecture | Technical Lead | Accepted; capability to be unified. |
| D-004 | ADR-0098: `publish?()` connector interface | Internal / Architecture | Technical Lead | Accepted; capability to be unified. |
| D-005 | `docs/product-research/feature-designs/01-multi-source-ingestion.md` | Internal / Product Research | Product Owner | Complete; referenced by ADR. |
| D-006 | `docs/product-research/feature-adr-scoping.md` | Internal / Product Research | Product Owner | Complete; referenced by ADR. |
| D-007 | Epic 12 stories 12.1 and 12.2 | Internal / Implementation | Engineering | Ready; linked in appendices. |
| D-008 | Existing `SocialConnector` framework and `registry.ts` | Internal / Codebase | Backend Engineer | Already built. |

---

---

## 13. Open Questions

- Should `count` capability vary by connector or by platform? A single platform may have multiple connector implementations.
- How are capability differences per API tier exposed? A `tier` field or `capabilities.tier`?
- Should `backfill` require a separate `tenant_admin` permission?
- How is `getCapabilities()` tested in contract tests?

---

---

## 14. Appendix

### Reference Documents

- ADR-0101: `docs/adr/0101-multi-source-connector-capability-matrix.md`
- BRD-0101: `docs/project docs/Business-Requirements/BRD-0101-Multi-Source-Connector-Capability-Matrix.md`
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- User stories: `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0101 and BRD-0101. |