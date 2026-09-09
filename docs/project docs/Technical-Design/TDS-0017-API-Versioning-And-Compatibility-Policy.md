# Technical Design Specification (TDS) — API Versioning and Compatibility Policy

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0017: REST API Versioning and Backward Compatibility Policy |
| **Document ID** | `TDS-0017` |
| **Feature Name** | URI Path Versioning, RFC 8594 Deprecation Signaling, and Additive-First Evolution |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-04 |
| **Last Updated** | 2026-09-04 |
| **Governing Skill** | `social-listening-core/.claude/skills/http-api-versioning/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0017` | [ADR-0017: API versioning and compatibility policy](../../adr/0017-api-versioning-and-compatibility-policy.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0017` | [BRD-0017: API Versioning And Compatibility Policy](../Business-Requirements/BRD-0017-API-Versioning-And-Compatibility-Policy.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0017` | [FDD-0017: API Versioning And Compatibility Policy](../Functional-Design/FDD-0017-API-Versioning-And-Compatibility-Policy.md) | Fully Aligned |
| **Governing User Story** | `Story 1.3` | [Epic 1: Repository and API Foundation](../../user-stories/epic-1-repository-and-api-foundation.md#story-13--api-versioning-and-compatibility-policy) | Acceptance Target |
| **Executable Contract Test** | `Story 1.3 Contract` | `contracts/epic-1/story-1.3.api-versioning.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Clients["API Consumers"]
        AdminUI["social-listening-admin (BFF / Client)"]
        ExternalSubsystems["Brand Reputation / Care Subsystems"]
    end

    subgraph CoreGateway["Core Express HTTP Router (app.ts)"]
        V1Router["/v1 Router -> Shared Core Domain Services"]
        V2Router["/v2 Router -> Divergent Handlers Only"]
        DeprecateMiddleware["RFC 8594 Middleware (Deprecation, Sunset Headers)"]
    end

    subgraph Domain["Shared Domain Services"]
        PostService["postStore.ts"]
        WatchlistService["watchlistStore.ts"]
    end

    AdminUI -->|Calls /v1/...| V1Router
    ExternalSubsystems -->|Calls /v1/... (Deprecated)| DeprecateMiddleware
    DeprecateMiddleware --> V1Router
    ExternalSubsystems -->|Calls /v2/... (Current)| V2Router

    V1Router --> PostService
    V2Router --> PostService
    V1Router --> WatchlistService
    V2Router --> WatchlistService
```

### 2.2 Architectural Boundaries & Invariants
- **URI Path Versioning:** All public REST endpoints must be prefixed with a major version segment: `/v1/...`, `/v2/...`. Unversioned root routes (e.g. `/posts`) are prohibited except for platform health check `/healthz`.
- **Additive-First Evolution Rule:** Within a given major version (e.g. `/v1/`), only non-breaking changes are permitted:
  - New endpoints.
  - New optional query parameters or request body fields.
  - New non-null response fields.
- **Breaking Change Prohibition:** Renaming fields, altering field data types, removing endpoints, or tightening validation constraints requires minting a new major version prefix (`/v2/`).
- **90-Day Deprecation Window & Sunset Signaling:** When a major version is succeeded, the prior version remains fully functional for a minimum of 90 days. Deprecated endpoints emit RFC 8594 `Deprecation` and `Sunset` headers.
- **Handler-Level Forking:** When introducing `/v2/`, only endpoints with divergent contracts are implemented as new handlers; unmodified endpoints delegate directly to the shared underlying domain service.

---

## 3. Data Architecture & Persistence Design

- API versioning is entirely decoupled from the database schema. Database migrations maintain backward compatibility through additive columns and non-breaking views, allowing `/v1` and `/v2` handlers to execute against the same PostgreSQL database concurrently.

---

## 4. API, Interface & Integration Contract Design

### 4.1 RFC 8594 Deprecation Middleware (`src/http/middleware/deprecation.ts`)
```typescript
import { Request, Response, NextFunction } from 'express';

export interface DeprecationOptions {
  deprecationDate?: string; // e.g. "@1756512000" or ISO date
  sunsetDate: string;       // RFC 1123 HTTP-date string, e.g. "Wed, 11 Nov 2026 00:00:00 GMT"
  link?: string;           // URL to migration documentation
}

export function deprecateVersion(options: DeprecationOptions) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Deprecation', options.deprecationDate ?? 'true');
    res.setHeader('Sunset', options.sunsetDate);
    if (options.link) {
      res.setHeader('Link', `<${options.link}>; rel="sunset"`);
    }
    next();
  };
}
```

### 4.2 Router Mount Hierarchy (`src/http/app.ts`)
```typescript
import express from 'express';
import { v1Router } from './versions/v1/router';
import { deprecateVersion } from './middleware/deprecation';

export function createApp() {
  const app = express();
  app.use(express.json());

  // Health endpoint (unversioned infrastructure probe)
  app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

  // v1 Routes (current production default)
  app.use('/v1', v1Router);

  // Example future deprecation wiring when v2 ships:
  // app.use('/v1', deprecateVersion({ sunsetDate: 'Thu, 01 Jan 2027 00:00:00 GMT' }), v1Router);
  // app.use('/v2', v2Router);

  return app;
}
```

---

## 5. Rate Limiting, Concurrency & Flow Control

- Rate limiting is keyed on `(tenantId, providerId)` or `(tenantId, userId)` across all API versions uniformly via `RequestGate`. A client cannot bypass rate limits by toggling between `/v1/` and `/v2/` endpoints.

---

## 6. Security, Identity & Credential Governance

- Authentication middleware (`tenantAuthMiddleware.ts`) validates Entra External ID JWT bearer tokens identically across `/v1` and `/v2`. Tenant RLS context (`withTenant`) applies equally regardless of version prefix.

---

## 7. Error Handling, Resilience & Failure Classification

- Standardized error format across all versions:
  ```json
  {
    "error": {
      "code": "BAD_REQUEST",
      "message": "Invalid query parameter 'limit'",
      "details": []
    }
  }
  ```

---

## 8. Testing & Contract Gate Plan

### 8.1 Contract Tests
Contract test file: `contracts/epic-1/story-1.3.api-versioning.contract.test.ts`.

| Test ID | Scenario | Verification Method |
|---|---|---|
| `TEST-VER-01` | Mandatory `/v1/` route prefix | Call `/v1/posts`; verify 200 OK. Call unversioned `/posts`; verify 404 Not Found. |
| `TEST-VER-02` | Unversioned health probe | Call `/healthz`; assert 200 OK without version prefix. |
| `TEST-VER-03` | Additive field non-breaking | Add optional query parameter `tag` to `/v1/posts`; verify existing test contracts pass without regression. |
| `TEST-VER-04` | RFC 8594 deprecation headers | Mount mock deprecated route; assert `Deprecation` and `Sunset` headers match RFC standards. |

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

Updates to `.claude/skills/http-api-versioning/SKILL.md`:
- **Routing Standard:** All new REST controllers must be mounted under `src/http/versions/v1/`.
- **Breaking Change Rule:** Never remove or alter existing response field names without approval and version bump.

---

## 10. Observability, Metrics & Operational Telemetry

- `http_requests_total{version="v1|v2", endpoint, status_code}` (counter)
- `deprecated_endpoint_calls_total{version, client_id}` (counter)

---

## 11. Migration, Rollout & Feature Gating

- Established as a foundational routing convention in Phase 0.
- All subsequent features built natively under `/v1/`.

---

## 12. Technical Assumptions, Dependencies & Open Questions

### 12.1 Assumptions & Dependencies
- **[A-0017-1]** Downstream clients support RFC 8594 response headers.
- **[D-0017-1]** Express routing architecture supports sub-router mounting.

### 12.2 Open Questions
- [x] **[Q-0017-1]** *Deprecation Duration:* Settled at 90 days minimum window.
- [x] **[Q-0017-2]** *Versioning Pattern:* Path versioning chosen over HTTP Accept headers.
