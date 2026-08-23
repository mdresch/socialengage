# Business Requirements Document (BRD) — Facebook Connector: Multiple Pages per User

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Facebook Connector: Multiple Pages per User |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0060-facebook-connector-multiple-pages-per-user.md, ../Business-Requirements/BRD-0060-Facebook-Connector-Multiple-Pages-Per-User.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0060-facebook-connector-multiple-pages-per-user.md and the business requirements in BRD-0060-Facebook-Connector-Multiple-Pages-Per-User.md into functional design for **Facebook Connector Multiple Pages Per User**.
The Facebook connector currently allows one tenant user to select and connect exactly one Facebook Page after completing the Meta OAuth flow. For users who personally administer many Pages — as is common for founders, social-media managers, and small teams — this forces a choice of which single Page to monitor, or requires consuming one of the tenant's limited license seats per additional Page administrator. This is operationally impractical when a tenant's license seats are capped at five users.

This BRD defines the business need for allowing one individual user to connect and manage multiple Facebook Pages under a single OAuth grant. The user's `/me/accounts` call already returns every Page they administer; the product should store, poll, and report on each selected Page independently while preserving the existing per-user credential-ownership model.

The expected outcome is that a tenant user can connect all the Pages they personally administer without needing additional seats, see each Page's individual connection health, and disconnect or reconnect Pages independently.

---

### 2.2 Scope
**In scope:**
- A new child registry of Facebook Pages connected by a user (`facebook_connected_pages`) with status tracking (`connected`, `removed`, `orphaned`).
- Upsert behavior when a user re-selects an already-connected Page (token refresh without duplicate rows).
- Automatic `orphaned` detection when a previously connected Page no longer appears in a re-consent `/me/accounts` response.
- Per-Page, sequential polling inside the existing Facebook ingestion path, with one independent ingestion run per Page.
- A new nullable `page_id` field on `ingestion_runs` to anchor per-Page health and audit data.
- Page-aware connector health derivation, callable per Page while keeping the existing platform-level rollup unchanged when no Page is supplied.
- New REST endpoints for listing and soft-removing a caller's own connected Pages, authorized on the caller's own user identity.
- A revised multi-select Page picker and a per-Page connected-Page list in the Admin UI.
- Clear UI copy that distinguishes between the user's overall personal Facebook activation switch and the status of each individual Page.

**Out of scope:**
- Re-opening the Tier 2 vs. Tier 3 credential-ownership question for Facebook; the per-user, self-authorized model from ADR-0059 remains unchanged.
- A tenant admin or platform admin listing or managing another user's connected Pages.
- Editing Page attributes (name, Page id, token) in place; re-consent and re-selection is the supported refresh path.
- Re-designing the `RequestGate` rate-limit keying to per-user or per-Page granularity; this remains an open operational risk to be measured before addressing.
- Closing the general Tier-3 scheduler trigger gap; this is governed by ADR-0061 / Story 1.15.
- Ingestion of comments, mentions, or other non-Page-post content; this was already out of scope for the Facebook connector.

## 3. Context and Background
See ADR Context.
The Facebook connector currently allows one tenant user to select and connect exactly one Facebook Page after completing the Meta OAuth flow. For users who personally administer many Pages — as is common for founders, social-media managers, and small teams — this forces a choice of which single Page to monitor, or requires consuming one of the tenant's limited license seats per additional Page administrator. This is operationally impractical when a tenant's license seats are capped at five users.

This BRD defines the business need for allowing one individual user to connect and manage multiple Facebook Pages under a single OAuth grant. The user's `/me/accounts` call already returns every Page they administer; the product should store, poll, and report on each selected Page independently while preserving the existing per-user credential-ownership model.

The expected outcome is that a tenant user can connect all the Pages they personally administer without needing additional seats, see each Page's individual connection health, and disconnect or reconnect Pages independently.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate the per-seat workaround for multi-Page Facebook administrators | A single user can connect more than one Facebook Page without creating a new tenant user account |
| 2 | Preserve independent per-Page visibility and manageability | Each connected Page displays its own status, health, and disconnect action in the Admin UI |
| 3 | Maintain the existing personal-credential ownership model | No tenant admin or platform admin can connect, list, or remove a Page on another user's behalf |
| 4 | Avoid unnecessary cost and plaintext exposure | Listing connected Pages does not require decrypting stored credentials |
| 5 | Keep existing connectors and credential flows regression-free | GNews, Newswire, tenant-owned-feed, and other platform credential flows continue to operate unchanged |

---

**Positive consequences (from ADR):**
**Positive**

- Closes the real, concrete business gap Menno named directly — one person's one OAuth grant can now result in as many connected, independently-polled, independently-monitored Pages as they actually administer, with no seat-count workaround required.
- `platform_credentials` needs zero schema change and zero rework of its existing exported functions (`storeCredential`, `readCredential`, `getLatestCredentialId`, `deleteCredential` all keep their current signatures and behavior) — every non-Facebook caller of this shared, provider-agnostic store is completely unaffected.
- Surfaces and fixes, as a direct consequence of this design, a real latent bug found while investigating (`deleteCredential('user')`'s all-rows-for-tuple deletion, Context above) before it could ever be triggered live, by giving Facebook's own disconnect path a narrower, additive function (`deleteCredentialById`) instead.
- Per-Page health (Decision §4) gives a tenant an actionable signal — which specific Page needs reconnecting — rather than an ambiguous aggregate, directly serving the stated reason multiple Pages matter (independent management, not just independent ingestion).
- Reuses ADR-0057's list/soft-remove UI and endpoint shape where it genuinely fits, while explicitly correcting the one place its precedent would have produced the wrong authorization model (tenant-wide vs. per-user) if copied uncritically.

**Negative**

- **A real, non-trivial schema and code-path expansion**, not a UI-only change: a new table (`facebook_connected_pages`), a new nullable column on `ingestion_runs` (`page_id`), a new `deriveConnectorHealth()` parameter threaded through `runIngestionAttempt()`'s two call sites, a new additive `credentialStore.ts` function, two new REST endpoints, and a revised (breaking, not backward-compatible) `/select-page` request shape. Named honestly as materially bigger than "let the picker allow multiple checkboxes," which is the risk this ADR exists to prevent understating.
- **`pollFacebook()`'s fan-out means one user's poll cycle now makes N times as many Graph API calls as today, against a `RequestGate` still keyed only by `(tenantId, providerId)` (ADR-0003), not per-user or per-Page.** If multiple tenant users each connect several Pages, all of their calls draw from one shared, tenant-wide rate budget under Facebook's own connector `getRateLimitConfig()` placeholder (`facebookConnector.ts` line 158, already an explicitly-named flat placeholder, not the real per-Page Engaged-Users ceiling). **Verified at review (see Amendment Log): `RequestGate` (`requestGate.ts`) already serializes and paces every call sharing one key rather than bursting, so the risk is not an uncontrolled concurrent burst against Meta — it is the shared budget being divided across more callers, causing later Pages in a large fan-out to wait longer, up to `RequestGate`'s own 6-hour queue TTL (ADR-0020), before a `QueueTtlExceededError` abandons that Page's attempt for the cycle.** This ADR does not redesign `RequestGate`'s keying — named as a real, concrete follow-up risk in Open Questions, not solved here, consistent with ADR-0020's own precedent of deferring distributed/multi-dimensional rate-limit work until a real, demonstrated need forces it.
- **The `pageId`-only health-derivation key has a real, named blind spot** (Decision §4's own edge case: two different users independently connecting the same underlying Page) — not solved, left as an Open Question.
- **`/select-page`'s request-shape change is a breaking change to that endpoint**, not additive — acceptable only because its sole caller is `social-listening-admin` itself, both under this ADR's own control; would not be acceptable if this endpoint had any external/public caller.
- **One `IngestionRun` per connected Page per poll cycle materially increases `ingestion_runs` row volume** for any tenant user with many connected Pages — the same category of unbounded-growth concern ADR-0057's own Consequences named for feed count, here scaled by Page count instead. Not bounded here; no real, demonstrated cap exists to justify inventing one.

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User with multiple Facebook Pages | End user connecting the Pages | High | Connect several Pages under one sign-in; see and manage each Page independently |
| Tenant Admin | License and connector oversight | Medium | Monitor connector health without needing extra seats; no cross-user management requirement |
| Product Owner (Menno) | Sponsor and decision maker | High | Realistic multi-Page support that does not force a seat-per-Page model |
| Engineering / Backend | Builds storage, REST, and polling changes | High | Clear, additive schema and endpoint contracts that do not break existing connectors |
| Engineering / Admin UI | Builds the multi-select picker and per-Page list | High | Per-Page health data and disconnect endpoints scoped to the caller's identity |
| Security / Compliance | Reviews authorization and data handling | Medium | No plaintext leakage, no cross-user access, no weakening of the Tier-3 ownership rule |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.15 | epic-1-repository-and-api-foundation.md |  | `ingestion_runs` gains a new, nullable `user_id UUID REFERENCES users(id)` column, populated only by a Tier-3 connector's own poll path — proven by a test co... |
| Story 6.27 | epic-6-tenant-admin-ui.md | As tenant user who personally administers more than one Facebook Page, I want to connect several of my own Pages under one Facebook sign-in, see each one's o... | A new `facebook_connected_pages` table exists exactly as ADR-0060 Decision §1 specifies (`id`, `tenant_id`, `user_id`, `page_id`, `page_name`, `credential_id... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `facebook_connected_pages` rows | Non-secret registry of a user's connected Pages (id, tenant_id, user_id, page_id, page_name, credential_id, status, timestamps) | Derived from Meta `/me/accounts` and OAuth selection | Backend / Tenant User | Internal — no credential plaintext |
| `platform_credentials` rows (Facebook) | Encrypted Page access token, one per connected Page | Meta OAuth token exchange | Backend / Tenant User | High — encrypted, never exposed in list views |
| `ingestion_runs.page_id` | Optional Page discriminator for per-Page health and audit | Facebook per-Page poll attempt | Backend | Internal |
| `ConnectorHealth` per Page | Per-Page health status derived from the Page's own `ingestion_runs` | Derived from `ingestion_runs` | Backend | Internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A Facebook Page connection is a Tier-3, per-user resource; no tenant admin or platform admin may list, create, or remove it on another user's behalf. |
| BRU-002 | A user may only see and manage Pages connected under their own resolved identity. |
| BRU-003 | Re-selecting an already-connected Page is an upsert (refresh), not a duplicate. |
| BRU-004 | `removed` means the user deliberately disconnected the Page; `orphaned` means Meta's grant no longer includes it; both statuses stop polling. |
| BRU-005 | Disconnecting a Page soft-removes the registry row and immediately deletes the associated encrypted credential. |
| BRU-006 | The user's personal Facebook activation switch controls polling for all of that user's connected Pages collectively; it does not change the connected/disconnected status of any individual Page. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0059 (Facebook connector OAuth and Tier-3 ownership) | Governing | Product Owner | Already Accepted; not reopened |
| D-002 | ADR-0057 (multi-feed administration UI shape) | Precedent | Product Owner | Already Accepted; shape reused, authorization corrected |
| D-003 | ADR-0061 (Tier-3 per-user poll scheduler) | Operational prerequisite | Engineering | Separate story; needed for actual ingestion to run |
| D-004 | Meta Graph API `/me/accounts` returning all admin Pages | External | Product Owner | Already relied upon by Story 6.23 |
| D-005 | Story 6.23 (Facebook OAuth single-Page connect) | Implementation predecessor | Engineering | Built 2026-08-18 |

---

- A Facebook user with admin rights on multiple Pages will continue to see all of them in the Meta `/me/accounts` response after OAuth.
- The number of Pages per user is small enough (tens, not thousands) that the initial `GET .../pages` list endpoint does not require pagination.
- The tenant license seat count remains capped at a small number (e.g., 5), making the multi-Page-per-user capability materially valuable.
- Existing `RequestGate` serialization and pacing are sufficient to prevent an uncontrolled concurrent burst against Meta's API when the per-Page poll loop is sequential.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Existing connectors and credential-store consumers must continue to work unchanged | Maintainability | Must | All existing contract tests for GNews, Newswire, tenant-wide credentials, and other connectors pass unmodified |
| NFR-002 | Page listing must not expose or require plaintext credential material | Security | Must | The `facebook_connected_pages` table carries only non-secret Page metadata; credential decryption is not invoked to render the list |
| NFR-003 | Per-Page polling must not trigger concurrent bursts against Meta | Reliability | Must | The per-Page loop is sequential, reusing the existing `RequestGate` serialization |
| NFR-004 | Health derivation must remain backward-compatible for all other connectors | Maintainability | Must | Calls to `deriveConnectorHealth` without a Page id produce byte-for-byte unchanged results |
| NFR-005 | New endpoints must follow the established cross-user privacy convention | Security | Must | Another user's Page returns `404`, never `403` |

---

## 11. Error Handling and Exceptions
**Positive**

- Closes the real, concrete business gap Menno named directly — one person's one OAuth grant can now result in as many connected, independently-polled, independently-monitored Pages as they actually administer, with no seat-count workaround required.
- `platform_credentials` needs zero schema change and zero rework of its existing exported functions (`storeCredential`, `readCredential`, `getLatestCredentialId`, `deleteCredential` all keep their current signatures and behavior) — every non-Facebook caller of this shared, provider-agnostic store is completely unaffected.
- Surfaces and fixes, as a direct consequence of this design, a real latent bug found while investigating (`deleteCredential('user')`'s all-rows-for-tuple deletion, Context above) before it could ever be triggered live, by giving Facebook's own disconnect path a narrower, additive function (`deleteCredentialById`) instead.
- Per-Page health (Decision §4) gives a tenant an actionable signal — which specific Page needs reconnecting — rather than an ambiguous aggregate, directly serving the stated reason multiple Pages matter (independent management, not just independent ingestion).
- Reuses ADR-0057's list/soft-remove UI and endpoint shape where it genuinely fits, while explicitly correcting the one place its precedent would have produced the wrong authorization model (tenant-wide vs. per-user) if copied uncritically.

**Negative**

- **A real, non-trivial schema and code-path expansion**, not a UI-only change: a new table (`facebook_connected_pages`), a new nullable column on `ingestion_runs` (`page_id`), a new `deriveConnectorHealth()` parameter threaded through `runIngestionAttempt()`'s two call sites, a new additive `credentialStore.ts` function, two new REST endpoints, and a revised (breaking, not backward-compatible) `/select-page` request shape. Named honestly as materially bigger than "let the picker allow multiple checkboxes," which is the risk this ADR exists to prevent understating.
- **`pollFacebook()`'s fan-out means one user's poll cycle now makes N times as many Graph API calls as today, against a `RequestGate` still keyed only by `(tenantId, providerId)` (ADR-0003), not per-user or per-Page.** If multiple tenant users each connect several Pages, all of their calls draw from one shared, tenant-wide rate budget under Facebook's own connector `getRateLimitConfig()` placeholder (`facebookConnector.ts` line 158, already an explicitly-named flat placeholder, not the real per-Page Engaged-Users ceiling). **Verified at review (see Amendment Log): `RequestGate` (`requestGate.ts`) already serializes and paces every call sharing one key rather than bursting, so the risk is not an uncontrolled concurrent burst against Meta — it is the shared budget being divided across more callers, causing later Pages in a large fan-out to wait longer, up to `RequestGate`'s own 6-hour queue TTL (ADR-0020), before a `QueueTtlExceededError` abandons that Page's attempt for the cycle.** This ADR does not redesign `RequestGate`'s keying — named as a real, concrete follow-up risk in Open Questions, not solved here, consistent with ADR-0020's own precedent of deferring distributed/multi-dimensional rate-limit work until a real, demonstrated need forces it.
- **The `pageId`-only health-derivation key has a real, named blind spot** (Decision §4's own edge case: two different users independently connecting the same underlying Page) — not solved, left as an Open Question.
- **`/select-page`'s request-shape change is a breaking change to that endpoint**, not additive — acceptable only because its sole caller is `social-listening-admin` itself, both under this ADR's own control; would not be acceptable if this endpoint had any external/public caller.
- **One `IngestionRun` per connected Page per poll cycle materially increases `ingestion_runs` row volume** for any tenant user with many connected Pages — the same category of unbounded-growth concern ADR-0057's own Consequences named for feed count, here scaled by Page count instead. Not bounded here; no real, demonstrated cap exists to justify inventing one.

---

## 12. Assumptions and Dependencies
- A Facebook user with admin rights on multiple Pages will continue to see all of them in the Meta `/me/accounts` response after OAuth.
- The number of Pages per user is small enough (tens, not thousands) that the initial `GET .../pages` list endpoint does not require pagination.
- The tenant license seat count remains capped at a small number (e.g., 5), making the multi-Page-per-user capability materially valuable.
- Existing `RequestGate` serialization and pacing are sufficient to prevent an uncontrolled concurrent burst against Meta's API when the per-Page poll loop is sequential.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Shared `RequestGate` budget becomes a bottleneck as a user's Page count grows | Medium | Medium | Sequential per-Page polling reuses existing pacing; re-keying deferred until measured | Engineering |
| R-002 | `orphaned` detection only happens on re-consent, not proactively | High (by design) | Low | The product does not silently poll with stale access; UI copy explains `orphaned` clearly | Product Owner |
| R-003 | Two different users connect the same underlying Page and their health signals blend | Low | Low | Named and accepted as an edge case; revisit only if real occurrence is observed | Engineering |
| R-004 | UI changes make the per-user activation switch and per-Page list confusing | Medium | Medium | Banner copy explicitly states when the parent connection is deactivated | Product Owner |
| R-005 | Existing connectors or credential flows regress | Low | High | Additive-only changes; existing contract tests must pass unmodified | Engineering |

---

## 14. Appendix
- ADR: `../../adr/0060-facebook-connector-multiple-pages-per-user.md`
- BRD: `../Business-Requirements/BRD-0060-Facebook-Connector-Multiple-Pages-Per-User.md`
- Feature design: `docs/product-research/feature-designs/``
- Deep research: `docs/product-research/reports/``
- User stories: see extracted stories above