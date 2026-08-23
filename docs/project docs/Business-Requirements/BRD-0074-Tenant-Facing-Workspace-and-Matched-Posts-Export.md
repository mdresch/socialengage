# Business Requirements Document (BRD) — Tenant-Facing Workspace and Matched-Posts Export

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Tenant-Facing Workspace and Matched-Posts Export — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Devin (AI assistant) on behalf of product research session |
| Approver(s) | Menno — Product Owner / Sole Developer |
| Status | Draft / Pending review |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | Devin | Initial draft from ADR-0074 |

---

## 2. Executive Summary

SocialEngage tenants currently have no on-demand, self-service way to export their own data. The offboarding flow does produce an export, but it is coupled to deletion and is not available as an ordinary tenant action. The Google AI Studio `TenantSettingsView.tsx` design shows two export buttons that must be backed by real `social-listening-core` API calls, not client-side mocks.

This BRD authorizes two tenant-facing, synchronous export endpoints: a full workspace JSON archive and a matched-posts CSV export. These endpoints satisfy operational backup, compliance portability, and downstream analysis needs for `Tenant-Admin` and `Tenant-User` roles without involving `Platform-Admin` or the offboarding lifecycle.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable `Tenant-Admin` to back up the full tenant workspace | `GET /v1/tenants/me/export/workspace` returns a valid JSON archive within 30 seconds for v1 size cap. |
| 2 | Enable `Tenant-User` and `Tenant-Admin` to export matched posts as CSV | `GET /v1/posts/export.csv` is reachable from the post feed and settings screens and opens correctly in Excel. |
| 3 | Preserve the platform-admin content-free boundary | `Platform-Admin` receives `403` on both endpoints; no tenant content crosses the boundary. |
| 4 | Eliminate mock/fallback data in the UI | All export actions call real `social-listening-core` endpoints; no client-side `useApp()` or `exportTenantData()` helper. |

---

## 4. Scope

### 4.1 In Scope

- `GET /v1/tenants/me/export/workspace` — full workspace JSON archive for `Tenant-Admin`.
- `GET /v1/posts/export.csv` — matched-posts CSV export for `Tenant-Admin` and `Tenant-User`.
- Authorization and RLS scoping behind existing auth middleware.
- Synchronous export with size and row caps for v1.

### 4.2 Out of Scope

- Async background export to Azure Blob Storage for very large tenants (deferred to ADR-0111).
- One-row-per-match "exploded" CSV expansion.
- Raw `rawPayload`, credential secrets, OAuth refresh tokens, or Key Vault envelopes.
- Client-side CSV generation or mock data in the UI.

### 4.3 Assumptions

- Existing `GET /v1/posts` filters and `watchlistId` matching (ADR-0063) are available for reuse.
- The workspace export can reuse assembly logic from the deletion export helper.
- `Tenant-Admin` is permitted to access other users' private watchlists for the workspace export only.

### 4.4 Constraints

- Synchronous response size capped at 100 MB for workspace JSON.
- Synchronous CSV row count capped at 10,000 rows for v1.
- No `Platform-Admin` access to tenant content.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `Tenant-Admin` | Primary user of full workspace export | High | Back up or migrate the entire tenant configuration, watchlists, posts, and connector metadata. |
| `Tenant-User` | Primary user of matched-posts CSV export | High | Take the same post results they see in the feed and analyze them in Excel, BI tools, or another system. |
| `Tenant-Brand-Reputation-Manager` | Secondary user of CSV export | Medium | Download matched mentions for reporting and external sharing. |
| `Platform-Admin` | Must have zero access to tenant content | High | The endpoint must enforce the platform-admin content-free boundary (ADR-0030/0041). |

---

## 6. Current State (As-Is)

**Current process:**
1. `Tenant-Admin` may request a workspace export only as part of the self-service tenant deletion flow (ADR-0043).
2. No endpoint exists for a tenant to export matched posts as CSV.
3. The `TenantSettingsView.tsx` design references non-existent `useApp()` and `exportTenantData()` helpers.

**Pain points:**
- Tenants cannot back up their own data on demand.
- The offboarding export is conceptually coupled to deletion and a 30-day lifecycle.
- The UI design cannot ship because it has no real backend API to call.

---

## 7. Future State (To-Be)

**New or improved process:**
1. `Tenant-Admin` visits `/tenant/settings` and clicks **Export Full Workspace (JSON)**.
2. The admin UI calls `GET /v1/tenants/me/export/workspace` and downloads the JSON file.
3. `Tenant-Admin` or `Tenant-User` clicks **Export Matched Posts (CSV)** from the settings or post feed.
4. The admin UI calls `GET /v1/posts/export.csv` with the same filters as the current post view and downloads the CSV file.

**Expected capabilities:**
- Real, tenant-scoped, auth-gated export endpoints.
- Workspace JSON that is a safe metadata archive, not a raw credential dump.
- CSV that matches the columns and filters visible in the post feed.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Workspace export completes within 30 seconds under the v1 size cap. | Performance | Must | Contract test with 100 MB ceiling passes. |
| NFR-002 | First CSV byte reaches the client within 5 seconds for the first 1,000 rows. | Performance | Should | Measured by contract test with representative dataset. |
| NFR-003 | `Platform-Admin` is blocked from both endpoints. | Security | Must | Returns `403` for any `platform_admin` identity. |
| NFR-004 | Cross-tenant access is prevented. | Security | Must | Another tenant's export request returns `403`/`404`. |
| NFR-005 | Each export is audited. | Compliance | Should | `tenant_id`, `user_id`, and `export_type` are recorded in an audit log. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `Tenant-Admin` is the only role permitted to call `GET /v1/tenants/me/export/workspace`. |
| BRU-002 | `Tenant-User` and `Tenant-Admin` may call `GET /v1/posts/export.csv` with their own tenant's posts. |
| BRU-003 | `Platform-Admin` cannot access tenant export content. |
| BRU-004 | Workspace export must not include credential secrets, OAuth tokens, or Key Vault envelopes. |
| BRU-005 | Exports are synchronous and capped for v1; async unbounded exports are deferred. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Tenant metadata | Name, domain, created date | `tenants` | `Tenant-Admin` | Low |
| Users list | Tenant user emails/roles | `users` | `Tenant-Admin` | Medium |
| Watchlists | Query AST, owner, status | `watchlists` | `Tenant-Admin` | Medium |
| Connector activations | Platform, active/inactive, tier | `connector_activations` | `Tenant-Admin` | Low |
| Platform credentials metadata | Provider, owner type, created date | `platform_credentials` | `Tenant-Admin` | Medium |
| Canonical post rows | `body_markdown`, `sentiment`, `topics`, etc. | `social_posts` | `tenant_user` / `tenant_admin` | Medium |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Export usage count | Track how often exports are requested | Product Owner | Ad-hoc |
| Export size/row distribution | Size async-export need | Product Owner | Ad-hoc |
| Failed export attempts | Detect auth or capacity issues | Technical Lead | Ad-hoc |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Large tenants hit the 100 MB / 10,000-row cap. | Medium | Medium | Document the cap; defer async background export to ADR-0111. | Product Owner |
| R-002 | CSV opens with garbled characters in Excel. | Low | Low | Use UTF-8 BOM and RFC 4180-ish quoting. | Technical Lead |
| R-003 | Workspace export accidentally exposes credential secrets. | Low | High | Implement explicit exclusion list and contract tests for secret-bearing fields. | Technical Lead |
| R-004 | Synchronous export blocks the event loop. | Low | Medium | Stream CSV row-by-row; build JSON from a bounded cursor. | Technical Lead |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- [ ] `Tenant-Admin` can download a valid workspace JSON from the Tenant Settings page.
- [ ] `Tenant-User` and `Tenant-Admin` can download a valid CSV from the post feed or tenant settings.
- [ ] Contract tests for both endpoints pass, including negative cases for role and cross-tenant access.
- [ ] No `rawPayload`, credential secret, or OAuth token appears in any export output.
- [ ] UI uses real `core-client.ts` calls; no mock data or client-side `useApp()` helper.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Workspace export | A tenant-scoped JSON archive of tenant metadata, users, watchlists, connector activations, and posts. |
| Matched posts | Posts that satisfy the filters and `watchlistId` supplied to `GET /v1/posts`. |
| Safe metadata | Data that does not include credentials, secrets, tokens, or raw internal payload structures. |
| Content-free boundary | The rule that `Platform-Admin` must not be able to read any tenant content. |

---

## 16. Appendices

- [ADR-0074: Tenant-Facing Workspace and Matched-Posts Export](../adr/0074-tenant-facing-workspace-and-posts-export.md)
- [TenantSettingsView.tsx design](../design/Google AI Studio/src/views/TenantSettingsView.tsx) (reference)
- [docs/product-research/feature-designs/10-data-export.md](../product-research/feature-designs/10-data-export.md)

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-23 |
| Product Owner | Menno | | 2026-08-23 |
| Technical Lead | Menno | | 2026-08-23 |
| Other Stakeholder | | | |
