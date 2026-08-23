# Business Requirements Document (BRD) — Tenant-Facing Workspace and Matched-Posts Export

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Tenant-Facing Workspace and Matched-Posts Export |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0074-tenant-facing-workspace-and-posts-export.md, ../Business-Requirements/BRD-0074-Tenant-Facing-Workspace-and-Matched-Posts-Export.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0074-tenant-facing-workspace-and-posts-export.md and the business requirements in BRD-0074-Tenant-Facing-Workspace-and-Matched-Posts-Export.md into functional design for **Tenant Facing Workspace and Matched Posts Export**.
SocialEngage tenants currently have no on-demand, self-service way to export their own data. The offboarding flow does produce an export, but it is coupled to deletion and is not available as an ordinary tenant action. The Google AI Studio `TenantSettingsView.tsx` design shows two export buttons that must be backed by real `social-listening-core` API calls, not client-side mocks.

This BRD authorizes two tenant-facing, synchronous export endpoints: a full workspace JSON archive and a matched-posts CSV export. These endpoints satisfy operational backup, compliance portability, and downstream analysis needs for `Tenant-Admin` and `Tenant-User` roles without involving `Platform-Admin` or the offboarding lifecycle.

---

### 2.2 Scope
**In scope:**
- `GET /v1/tenants/me/export/workspace` — full workspace JSON archive for `Tenant-Admin`.
- `GET /v1/posts/export.csv` — matched-posts CSV export for `Tenant-Admin` and `Tenant-User`.
- Authorization and RLS scoping behind existing auth middleware.
- Synchronous export with size and row caps for v1.

**Out of scope:**
- Async background export to Azure Blob Storage for very large tenants (deferred to ADR-0111).
- One-row-per-match "exploded" CSV expansion.
- Raw `rawPayload`, credential secrets, OAuth refresh tokens, or Key Vault envelopes.
- Client-side CSV generation or mock data in the UI.

## 3. Context and Background
See ADR Context.
SocialEngage tenants currently have no on-demand, self-service way to export their own data. The offboarding flow does produce an export, but it is coupled to deletion and is not available as an ordinary tenant action. The Google AI Studio `TenantSettingsView.tsx` design shows two export buttons that must be backed by real `social-listening-core` API calls, not client-side mocks.

This BRD authorizes two tenant-facing, synchronous export endpoints: a full workspace JSON archive and a matched-posts CSV export. These endpoints satisfy operational backup, compliance portability, and downstream analysis needs for `Tenant-Admin` and `Tenant-User` roles without involving `Platform-Admin` or the offboarding lifecycle.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable `Tenant-Admin` to back up the full tenant workspace | `GET /v1/tenants/me/export/workspace` returns a valid JSON archive within 30 seconds for v1 size cap. |
| 2 | Enable `Tenant-User` and `Tenant-Admin` to export matched posts as CSV | `GET /v1/posts/export.csv` is reachable from the post feed and settings screens and opens correctly in Excel. |
| 3 | Preserve the platform-admin content-free boundary | `Platform-Admin` receives `403` on both endpoints; no tenant content crosses the boundary. |
| 4 | Eliminate mock/fallback data in the UI | All export actions call real `social-listening-core` endpoints; no client-side `useApp()` or `exportTenantData()` helper. |

---

**Positive consequences (from ADR):**
- `social-listening-core` gains two new, real, tenant-scoped export endpoints.
- The deletion export in `tenantDeletion.ts` stays unchanged in scope; the new workspace export may refactor shared query/assembly code into a reusable `assembleTenantExport()` helper.
- `social-listening-admin` can implement the design's two export buttons against real API calls.
- The design's `useApp`/`exportTenantData` client-side helper is not implemented; the equivalent actions are real `core-client.ts` calls.
- `lucide-react` is still not a project dependency; the UI styling of the export buttons is a separate frontend concern and remains out of this ADR's scope.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | `Tenant-Admin` can request a full workspace JSON archive. | Must | `GET /v1/tenants/me/export/workspace` returns `200` with a JSON body for `tenant_admin` only. | Product Owner |
| BR-002 | Workspace export contains safe tenant metadata. | Must | Includes tenant, users, watchlists, connector activations, non-secret `platform_credentials` metadata, and canonical post rows. | Product Owner |
| BR-003 | Workspace export excludes sensitive material. | Must | No credential secrets, refresh tokens, Key Vault envelopes, `rawPayload` internals, or full `enrichment` JSONB. | Product Owner |
| BR-004 | Workspace export is size-capped for v1. | Must | Returns an error if the document exceeds 100 MB. | Product Owner |
| BR-005 | `Tenant-Admin` or `Tenant-User` can export matched posts as CSV. | Must | `GET /v1/posts/export.csv` is reachable to both roles. | Product Owner |
| BR-006 | CSV contains the expected columns. | Must | Columns: `id`, `published_at`, `provider`, `author_name`, `author_url`, `title`, `body_markdown`, `url`, `sentiment`, `keywords`, `watchlist_ids`. | Product Owner |
| BR-007 | CSV honors the same filters as `GET /v1/posts`. | Must | Supports `watchlistId`, `provider`, `source`, `author`, `search`, and date filters. | Product Owner |
| BR-008 | CSV is UTF-8 with BOM and RFC 4180-ish quoting. | Should | Opens correctly in Excel and passes RFC 4180-ish validation. | Product Owner |
| BR-009 | CSV row count is capped for v1. | Must | Synchronous export limited to 10,000 rows. | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `Tenant-Admin` | Primary user of full workspace export | High | Back up or migrate the entire tenant configuration, watchlists, posts, and connector metadata. |
| `Tenant-User` | Primary user of matched-posts CSV export | High | Take the same post results they see in the feed and analyze them in Excel, BI tools, or another system. |
| `Tenant-Brand-Reputation-Manager` | Secondary user of CSV export | Medium | Download matched mentions for reporting and external sharing. |
| `Platform-Admin` | Must have zero access to tenant content | High | The endpoint must enforce the platform-admin content-free boundary (ADR-0030/0041). |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 3.16 | epic-3-data-model-storage-and-archival.md | As Tenant-Admin or tenant user, I want to download a full workspace JSON archive and a CSV of matched posts on demand from `social-listening-core`, so that I... | See epic file. |
| Story 6.40 | epic-6-tenant-admin-ui.md | As Tenant-Admin or tenant user, I want the Tenant Settings page to present workspace metadata in styled cards and offer real export/offboarding actions, so t... | See epic file. |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Tenant metadata | Name, domain, created date | `tenants` | `Tenant-Admin` | Low |
| Users list | Tenant user emails/roles | `users` | `Tenant-Admin` | Medium |
| Watchlists | Query AST, owner, status | `watchlists` | `Tenant-Admin` | Medium |
| Connector activations | Platform, active/inactive, tier | `connector_activations` | `Tenant-Admin` | Low |
| Platform credentials metadata | Provider, owner type, created date | `platform_credentials` | `Tenant-Admin` | Medium |
| Canonical post rows | `body_markdown`, `sentiment`, `topics`, etc. | `social_posts` | `tenant_user` / `tenant_admin` | Medium |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | `Tenant-Admin` is the only role permitted to call `GET /v1/tenants/me/export/workspace`. |
| BRU-002 | `Tenant-User` and `Tenant-Admin` may call `GET /v1/posts/export.csv` with their own tenant's posts. |
| BRU-003 | `Platform-Admin` cannot access tenant export content. |
| BRU-004 | Workspace export must not include credential secrets, OAuth tokens, or Key Vault envelopes. |
| BRU-005 | Exports are synchronous and capped for v1; async unbounded exports are deferred. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0015 (RLS) | Internal | Technical Lead | Already Accepted |
| D-002 | ADR-0016 (Postgres) | Internal | Technical Lead | Already Accepted |
| D-003 | ADR-0029/0033 (Entra auth) | Internal | Technical Lead | Already Accepted |
| D-004 | ADR-0031 (`GET /v1/tenants/me`) | Internal | Technical Lead | Already Accepted |
| D-005 | ADR-0044 (watchlist ownership and privacy) | Internal | Technical Lead | Already Accepted |
| D-006 | ADR-0063 (`post_watchlist_matches`) | Internal | Technical Lead | Already Accepted |
| D-007 | `social-listening-admin` Tenant Settings UI | Internal | Product Owner | Before go-live |

---

- Existing `GET /v1/posts` filters and `watchlistId` matching (ADR-0063) are available for reuse.
- The workspace export can reuse assembly logic from the deletion export helper.
- `Tenant-Admin` is permitted to access other users' private watchlists for the workspace export only.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Workspace export completes within 30 seconds under the v1 size cap. | Performance | Must | Contract test with 100 MB ceiling passes. |
| NFR-002 | First CSV byte reaches the client within 5 seconds for the first 1,000 rows. | Performance | Should | Measured by contract test with representative dataset. |
| NFR-003 | `Platform-Admin` is blocked from both endpoints. | Security | Must | Returns `403` for any `platform_admin` identity. |
| NFR-004 | Cross-tenant access is prevented. | Security | Must | Another tenant's export request returns `403`/`404`. |
| NFR-005 | Each export is audited. | Compliance | Should | `tenant_id`, `user_id`, and `export_type` are recorded in an audit log. |

---

## 11. Error Handling and Exceptions
- `social-listening-core` gains two new, real, tenant-scoped export endpoints.
- The deletion export in `tenantDeletion.ts` stays unchanged in scope; the new workspace export may refactor shared query/assembly code into a reusable `assembleTenantExport()` helper.
- `social-listening-admin` can implement the design's two export buttons against real API calls.
- The design's `useApp`/`exportTenantData` client-side helper is not implemented; the equivalent actions are real `core-client.ts` calls.
- `lucide-react` is still not a project dependency; the UI styling of the export buttons is a separate frontend concern and remains out of this ADR's scope.

## 12. Assumptions and Dependencies
- Existing `GET /v1/posts` filters and `watchlistId` matching (ADR-0063) are available for reuse.
- The workspace export can reuse assembly logic from the deletion export helper.
- `Tenant-Admin` is permitted to access other users' private watchlists for the workspace export only.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Large tenants hit the 100 MB / 10,000-row cap. | Medium | Medium | Document the cap; defer async background export to ADR-0111. | Product Owner |
| R-002 | CSV opens with garbled characters in Excel. | Low | Low | Use UTF-8 BOM and RFC 4180-ish quoting. | Technical Lead |
| R-003 | Workspace export accidentally exposes credential secrets. | Low | High | Implement explicit exclusion list and contract tests for secret-bearing fields. | Technical Lead |
| R-004 | Synchronous export blocks the event loop. | Low | Medium | Stream CSV row-by-row; build JSON from a bounded cursor. | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0074-tenant-facing-workspace-and-posts-export.md`
- BRD: `../Business-Requirements/BRD-0074-Tenant-Facing-Workspace-and-Matched-Posts-Export.md`
- Feature design: `docs/product-research/feature-designs/10-data-export.md](../product-research/feature-designs/10-data-export.md`
- Feature design: `docs/product-research/feature-designs/10-data-export.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- Deep research: _No deep-research report found._
- User stories: see extracted stories above