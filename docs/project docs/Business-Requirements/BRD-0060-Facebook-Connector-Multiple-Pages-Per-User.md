# Business Requirements Document (BRD) — Facebook Connector: Multiple Pages per User

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage — Facebook Connector: Multiple Pages per User |
| Version | 1.0 |
| Date | 2026-08-18 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno (Sponsor, Product Owner, Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-18 | AI Business & Requirements Analyst | Initial draft synthesizing ADR-0060 and Story 6.27 |
| 1.0 | 2026-08-18 | Menno | Approved as Accepted |

---

## 2. Executive Summary

The Facebook connector currently allows one tenant user to select and connect exactly one Facebook Page after completing the Meta OAuth flow. For users who personally administer many Pages — as is common for founders, social-media managers, and small teams — this forces a choice of which single Page to monitor, or requires consuming one of the tenant's limited license seats per additional Page administrator. This is operationally impractical when a tenant's license seats are capped at five users.

This BRD defines the business need for allowing one individual user to connect and manage multiple Facebook Pages under a single OAuth grant. The user's `/me/accounts` call already returns every Page they administer; the product should store, poll, and report on each selected Page independently while preserving the existing per-user credential-ownership model.

The expected outcome is that a tenant user can connect all the Pages they personally administer without needing additional seats, see each Page's individual connection health, and disconnect or reconnect Pages independently.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate the per-seat workaround for multi-Page Facebook administrators | A single user can connect more than one Facebook Page without creating a new tenant user account |
| 2 | Preserve independent per-Page visibility and manageability | Each connected Page displays its own status, health, and disconnect action in the Admin UI |
| 3 | Maintain the existing personal-credential ownership model | No tenant admin or platform admin can connect, list, or remove a Page on another user's behalf |
| 4 | Avoid unnecessary cost and plaintext exposure | Listing connected Pages does not require decrypting stored credentials |
| 5 | Keep existing connectors and credential flows regression-free | GNews, Newswire, tenant-owned-feed, and other platform credential flows continue to operate unchanged |

---

## 4. Scope

### 4.1 In Scope

- A new child registry of Facebook Pages connected by a user (`facebook_connected_pages`) with status tracking (`connected`, `removed`, `orphaned`).
- Upsert behavior when a user re-selects an already-connected Page (token refresh without duplicate rows).
- Automatic `orphaned` detection when a previously connected Page no longer appears in a re-consent `/me/accounts` response.
- Per-Page, sequential polling inside the existing Facebook ingestion path, with one independent ingestion run per Page.
- A new nullable `page_id` field on `ingestion_runs` to anchor per-Page health and audit data.
- Page-aware connector health derivation, callable per Page while keeping the existing platform-level rollup unchanged when no Page is supplied.
- New REST endpoints for listing and soft-removing a caller's own connected Pages, authorized on the caller's own user identity.
- A revised multi-select Page picker and a per-Page connected-Page list in the Admin UI.
- Clear UI copy that distinguishes between the user's overall personal Facebook activation switch and the status of each individual Page.

### 4.2 Out of Scope

- Re-opening the Tier 2 vs. Tier 3 credential-ownership question for Facebook; the per-user, self-authorized model from ADR-0059 remains unchanged.
- A tenant admin or platform admin listing or managing another user's connected Pages.
- Editing Page attributes (name, Page id, token) in place; re-consent and re-selection is the supported refresh path.
- Re-designing the `RequestGate` rate-limit keying to per-user or per-Page granularity; this remains an open operational risk to be measured before addressing.
- Closing the general Tier-3 scheduler trigger gap; this is governed by ADR-0061 / Story 1.15.
- Ingestion of comments, mentions, or other non-Page-post content; this was already out of scope for the Facebook connector.

### 4.3 Assumptions

- A Facebook user with admin rights on multiple Pages will continue to see all of them in the Meta `/me/accounts` response after OAuth.
- The number of Pages per user is small enough (tens, not thousands) that the initial `GET .../pages` list endpoint does not require pagination.
- The tenant license seat count remains capped at a small number (e.g., 5), making the multi-Page-per-user capability materially valuable.
- Existing `RequestGate` serialization and pacing are sufficient to prevent an uncontrolled concurrent burst against Meta's API when the per-Page poll loop is sequential.

### 4.4 Constraints

- The design must keep `platform_credentials` a provider-agnostic, encrypted store — no Facebook-specific columns can be added there.
- Every new backend change must be additive and backward-compatible for every existing connector and existing API consumer.
- The `/select-page` endpoint change is internal-only (sole caller is the SocialEngage Admin UI), so a non-backward-compatible shape change is acceptable.
- All new REST endpoints must follow the established convention that another user's private resource returns `404`, not `403`.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User with multiple Facebook Pages | End user connecting the Pages | High | Connect several Pages under one sign-in; see and manage each Page independently |
| Tenant Admin | License and connector oversight | Medium | Monitor connector health without needing extra seats; no cross-user management requirement |
| Product Owner (Menno) | Sponsor and decision maker | High | Realistic multi-Page support that does not force a seat-per-Page model |
| Engineering / Backend | Builds storage, REST, and polling changes | High | Clear, additive schema and endpoint contracts that do not break existing connectors |
| Engineering / Admin UI | Builds the multi-select picker and per-Page list | High | Per-Page health data and disconnect endpoints scoped to the caller's identity |
| Security / Compliance | Reviews authorization and data handling | Medium | No plaintext leakage, no cross-user access, no weakening of the Tier-3 ownership rule |

---

## 6. Current State (As-Is)

After completing the Meta OAuth flow, the user is presented with a single-select Page picker. Selecting one Page stores one credential and creates one active Facebook connection for that user. A second Page can only be connected by a second tenant user who personally administers that Page and personally completes the OAuth flow.

**Pain points:**
- A user who administers many Pages must pick exactly one, leaving the rest unmonitored.
- Connecting every Page the user administers would require one license seat per additional user, which is not practical under a 5-seat cap.
- The existing credential read/delete paths are keyed only by `(tenant, platform, ownerType, user)`, so even if two Page rows existed today, the older one would become unreachable and a disconnect would remove every row for that user.
- Connector health is reported at the platform level only, so one failing Page cannot be distinguished from another.

---

## 7. Future State (To-Be)

A tenant user completes one Facebook OAuth flow and is presented with a multi-select list of all Pages returned by `/me/accounts`. They select any number of Pages and connect them all in one action. Each selected Page becomes its own stored, independently-polled connection.

**Expected capabilities:**
- The user can connect, view, and disconnect each Page individually.
- Each Page has its own status (`connected`, `removed`, `orphaned`) and its own connector-health badge.
- A re-consent that no longer returns a previously connected Page auto-marks that Page as `orphaned` rather than leaving it silently stale.
- One Page's polling failure does not stop the other Pages from being polled.
- The user's personal Facebook activation switch still covers all connected Pages collectively, and the UI clearly states when the switch is off.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow one user to connect more than one Facebook Page under a single OAuth grant | Must | A single `/select-page` request can accept multiple Page ids and create one stored connection per selected Page | Product Owner |
| BR-002 | The system shall store Page metadata (id, name, status, credential reference) separately from the encrypted credential payload | Must | A dedicated Facebook-scoped child table exists; listing Pages does not require credential decryption | Product Owner |
| BR-003 | The system shall support re-selecting an already-connected Page as a token refresh, not a duplicate | Must | Re-selecting an existing Page updates the existing row (new credential id and name) and preserves `connected` status | Product Owner |
| BR-004 | The system shall detect and surface Pages that have lost authorization | Must | A re-consent not returning a previously connected Page transitions that Page to `orphaned` | Product Owner |
| BR-005 | The system shall poll each connected Page independently and sequentially | Must | `pollFacebook` iterates over the caller's connected Pages one at a time, creating one `IngestionRun` per Page | Engineering |
| BR-006 | The system shall derive connector health per Page without changing existing platform-level health | Must | `deriveConnectorHealth` accepts an optional Page id; existing callers see identical behavior when Page id is omitted | Engineering |
| BR-007 | The system shall provide a caller-scoped list of their own connected Pages | Must | `GET /v1/connectors/facebook/pages` returns only the calling user's Pages, with `parentConnectionActive` and per-Page health | Engineering |
| BR-008 | The system shall allow a user to soft-remove one of their connected Pages | Must | `DELETE /v1/connectors/facebook/pages/:id` sets the row to `removed` and deletes the specific credential | Engineering |
| BR-009 | The Admin UI shall show a multi-select Page picker and a per-Page connected-Page list | Must | The picker uses checkboxes and a plural action; the connected view lists each Page with its own status, health, and disconnect action | Product Owner |
| BR-010 | The Admin UI shall render partial outcomes of a multi-Page connect clearly | Should | A response with both successful and failed Pages displays both lists and per-Page error messages | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Existing connectors and credential-store consumers must continue to work unchanged | Maintainability | Must | All existing contract tests for GNews, Newswire, tenant-wide credentials, and other connectors pass unmodified |
| NFR-002 | Page listing must not expose or require plaintext credential material | Security | Must | The `facebook_connected_pages` table carries only non-secret Page metadata; credential decryption is not invoked to render the list |
| NFR-003 | Per-Page polling must not trigger concurrent bursts against Meta | Reliability | Must | The per-Page loop is sequential, reusing the existing `RequestGate` serialization |
| NFR-004 | Health derivation must remain backward-compatible for all other connectors | Maintainability | Must | Calls to `deriveConnectorHealth` without a Page id produce byte-for-byte unchanged results |
| NFR-005 | New endpoints must follow the established cross-user privacy convention | Security | Must | Another user's Page returns `404`, never `403` |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A Facebook Page connection is a Tier-3, per-user resource; no tenant admin or platform admin may list, create, or remove it on another user's behalf. |
| BRU-002 | A user may only see and manage Pages connected under their own resolved identity. |
| BRU-003 | Re-selecting an already-connected Page is an upsert (refresh), not a duplicate. |
| BRU-004 | `removed` means the user deliberately disconnected the Page; `orphaned` means Meta's grant no longer includes it; both statuses stop polling. |
| BRU-005 | Disconnecting a Page soft-removes the registry row and immediately deletes the associated encrypted credential. |
| BRU-006 | The user's personal Facebook activation switch controls polling for all of that user's connected Pages collectively; it does not change the connected/disconnected status of any individual Page. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `facebook_connected_pages` rows | Non-secret registry of a user's connected Pages (id, tenant_id, user_id, page_id, page_name, credential_id, status, timestamps) | Derived from Meta `/me/accounts` and OAuth selection | Backend / Tenant User | Internal — no credential plaintext |
| `platform_credentials` rows (Facebook) | Encrypted Page access token, one per connected Page | Meta OAuth token exchange | Backend / Tenant User | High — encrypted, never exposed in list views |
| `ingestion_runs.page_id` | Optional Page discriminator for per-Page health and audit | Facebook per-Page poll attempt | Backend | Internal |
| `ConnectorHealth` per Page | Per-Page health status derived from the Page's own `ingestion_runs` | Derived from `ingestion_runs` | Backend | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Per-Page connection status | Show which Pages are connected, removed, or orphaned | Tenant User / Tenant Admin | Real-time in Admin UI |
| Per-Page connector health badge | Identify which specific Page needs reconnection | Tenant User / Tenant Admin | Real-time in Admin UI |
| Count of connected Pages per user | License and operational visibility | Tenant Admin / Product Owner | On demand |
| Partial-connect success/failure counts | Surface how many Pages succeeded vs. failed in a multi-select connect action | Tenant User | Per connect attempt |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Shared `RequestGate` budget becomes a bottleneck as a user's Page count grows | Medium | Medium | Sequential per-Page polling reuses existing pacing; re-keying deferred until measured | Engineering |
| R-002 | `orphaned` detection only happens on re-consent, not proactively | High (by design) | Low | The product does not silently poll with stale access; UI copy explains `orphaned` clearly | Product Owner |
| R-003 | Two different users connect the same underlying Page and their health signals blend | Low | Low | Named and accepted as an edge case; revisit only if real occurrence is observed | Engineering |
| R-004 | UI changes make the per-user activation switch and per-Page list confusing | Medium | Medium | Banner copy explicitly states when the parent connection is deactivated | Product Owner |
| R-005 | Existing connectors or credential flows regress | Low | High | Additive-only changes; existing contract tests must pass unmodified | Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0059 (Facebook connector OAuth and Tier-3 ownership) | Governing | Product Owner | Already Accepted; not reopened |
| D-002 | ADR-0057 (multi-feed administration UI shape) | Precedent | Product Owner | Already Accepted; shape reused, authorization corrected |
| D-003 | ADR-0061 (Tier-3 per-user poll scheduler) | Operational prerequisite | Engineering | Separate story; needed for actual ingestion to run |
| D-004 | Meta Graph API `/me/accounts` returning all admin Pages | External | Product Owner | Already relied upon by Story 6.23 |
| D-005 | Story 6.23 (Facebook OAuth single-Page connect) | Implementation predecessor | Engineering | Built 2026-08-18 |

---

## 14. Acceptance Criteria

- A user can complete one Facebook OAuth flow, select multiple Pages from the multi-select picker, and have each selected Page stored as its own connected Page.
- Re-selecting an already-connected Page updates the existing row without violating uniqueness or creating a duplicate.
- A re-consent that no longer returns a previously connected Page marks that Page `orphaned` and stops polling it.
- `pollFacebook` creates one `IngestionRun` per connected Page, in sequence, and one Page's failure does not stop the next Page from being attempted.
- `GET /v1/connectors/facebook/pages` returns only the calling user's Pages, including `parentConnectionActive` and per-Page `connectorHealth`.
- `DELETE /v1/connectors/facebook/pages/:id` soft-removes the row and deletes only that specific credential, returning `404` for another user's Page.
- The Admin UI replaces the single-Page picker with a multi-select picker and the single-Page footer with a per-Page list including health badges and disconnect actions.
- The Admin UI renders a clear banner when the user's personal Facebook connection is deactivated.
- All existing connector and credential contract tests for non-Facebook platforms continue to pass unchanged.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Tier-3 credential | A user-bound credential that only the individual user may create, activate, or disconnect for themselves; no admin may act on the user's behalf. |
| Page (Facebook) | A Facebook Page that the user has administrator rights on and that can be selected for ingestion. |
| `orphaned` | A previously connected Page whose `page_id` no longer appears in a re-consent `/me/accounts` response, indicating the user's admin grant for that specific Page has ended. |
| `removed` | A Page deliberately disconnected by the user via the soft-remove endpoint. |
| `parentConnectionActive` | The overall on/off activation state of the user's personal Facebook connector, covering all of that user's connected Pages collectively. |
| `RequestGate` | The existing rate-limit pacing mechanism that serializes calls sharing a `(tenantId, providerId)` key. |

---

## 16. Appendices

### Reference Documents

- [ADR-0060: Facebook connector — one user may connect more than one Page](../adr/0060-facebook-connector-multiple-pages-per-user.md)
- [ADR-0059: Facebook connector (single-Page OAuth and Tier-3 ownership)](../adr/0059-facebook-connector-oauth-and-tier-3-ownership.md)
- [ADR-0057: Tenant-owned-feed multi-feed administration](../adr/0057-tenant-owned-feed-multi-feed-administration.md)
- [ADR-0028: Credential/connector authority (ownership tiers)](../adr/0028-credential-connector-authority.md)
- [Story 6.27: Facebook — support connecting more than one Page per user](../user-stories/epic-6-tenant-admin-ui.md#story-627--facebook-support-connecting-more-than-one-page-per-user)
- [Story 6.23: Facebook OAuth connect flow](../user-stories/epic-6-tenant-admin-ui.md#story-623--facebook-oauth-connect-flow)
- [Story 1.15: Tier-3 per-user poll scheduler](../user-stories/epic-1-repository-and-api-foundation.md#story-115--tier-3-per-user-poll-scheduler)

### Notes on Missing Source Material

- No dedicated `docs/product-research/feature-designs/` or `docs/product-research/reports/` file was found for this feature. The BRD is therefore synthesized directly from the ADR and the user story.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | — | 2026-08-18 |
| Product Owner | Menno | — | 2026-08-18 |
| Technical Lead | Menno | — | 2026-08-18 |
| Other Stakeholder | — | — | — |
