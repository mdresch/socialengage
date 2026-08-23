# Business Requirements Document – Tenant-Owned Feed Multi-Feed Administration

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0057 — Tenant-Owned Feed Multi-Feed Administration |
| Version | 1.0 |
| Date | 2026-08-17 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Sponsor/Product Owner/Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-17 | BRD Writer Agent | Initial BRD generated from ADR-0057, Story 6.20, and related ADR-0050 context. |

---

## 2. Executive Summary

SocialEngage's tenant-owned-domain content-feed connector already supports multiple verified domains and feeds at the storage and polling layers, but the product currently exposes only a single-feed setup flow. A tenant that has verified one domain has no supported path to add a second domain or a second feed under an already-verified domain. This Business Requirements Document (BRD) formalizes the business need to administer tenant-owned feeds after the initial setup: viewing all configured feeds, editing feed URLs, and removing feeds, while fixing a pre-existing under-authorization gap in the connect/verify endpoints.

The proposed solution introduces tenant-admin-only list, edit, and soft-remove capabilities, plus a same-domain multi-feed shortcut that skips redundant DNS TXT verification when the tenant has already proven domain ownership. The result is a scalable, auditable feed-management experience that closes the gap between what the platform already supports and what tenants can actually reach through the product.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable tenants to manage multiple owned-domain feeds from the Admin UI | A Tenant-Admin can list, edit feed URL, and remove any feed in the tenant-owned-feed connector screen |
| 2 | Close the authorization gap on tenant-wide connector actions | `connect` and `verify-domain` are gated to `tenant_admin` only, consistent with all other tenant-wide connectors |
| 3 | Preserve a complete domain-verification audit trail | Removed feeds remain queryable with status history; no hard deletion is required to stop polling |
| 4 | Reduce unnecessary DNS friction for legitimate same-domain multi-feed configurations | A second feed under an already-verified domain is auto-verified without requiring another TXT record |
| 5 | Keep ongoing operating costs visible and unbounded-by-default | Feed count remains uncapped at v1, with explicit cost/load monitoring and review triggers identified |

---

## 4. Scope

### 4.1 In Scope

- REST endpoints to list, update feed URL, and soft-remove tenant-owned feed activations.
- Storing and exposing the new `removed` status value for `tenant_owned_feed_activations`.
- Re-authorizing `connect` and `verify-domain` to `tenant_admin` only.
- Auto-verification of additional feeds registered under an already-verified same domain.
- Admin UI replacement of the single-activation `TenantOwnedFeedSetup` state machine with a real per-tenant feed list.
- Per-row actions in the Admin UI: "Verify now" (pending only), "Edit feed URL" (any status), "Remove" (any status, with confirmation).
- Visual distinction between per-feed status and the separate, tenant-wide connector activation state.
- Persistent "Connect another feed" action, never gated on the absence of existing feeds.

### 4.2 Out of Scope

- A hard cap on the number of feeds per tenant at v1.
- Scheduled cleanup of stale `pending` or `removed` rows.
- A token-regeneration/retry endpoint for expired `pending` activations (remove-and-reconnect is the supported path).
- Platform-Admin cross-tenant feed visibility.
- Changes to Newswire's hardcoded, non-tenant-configurable feed set.
- Hard deletion of already-ingested `SocialPost` or `Author` rows tied to a removed feed.

### 4.3 Assumptions

- The storage layer (`tenant_owned_feed_activations`) already supports one-to-many rows per tenant; no schema redesign is needed beyond widening the `status` `CHECK` constraint.
- DNS TXT-record domain ownership verification remains the trust primitive for new domains.
- The tenant-wide connector activation switch (`connector_activations`) remains a separate concept managed by ADR-0051.

### 4.4 Constraints

- PostgreSQL `CHECK` constraints cannot be altered in place; the migration must drop and re-add the constraint.
- No new `GRANT` is needed for soft removal because it is implemented as an `UPDATE`.
- All new administration endpoints must be `tenant_admin`-only.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Configures and maintains the tenant's owned-domain feeds | High | Add, list, edit, and remove feeds without engineering help |
| Tenant User | Consumes ingested posts from tenant-owned feeds | Medium | Trust that only authorized tenant admins can claim domain ownership |
| Product Owner (Menno) | Sponsor and decision owner | High | Close ADR-0050 Open Question 2; keep scope honest and bounded |
| Engineering / Technical Lead | Implements core and Admin UI changes | High | Clear requirements that follow existing patterns and avoid speculative ceilings |
| Operations / Cost Owner | Monitors cloud/ingestion costs | Medium | Visibility into unbounded feed count and its cost/load implications |

---

## 6. Current State (As-Is)

**Current process:**

1. A Tenant-Admin opens the `TenantOwnedFeedSetup` screen and runs the connect flow.
2. The system creates a single `pending` activation and returns TXT-record instructions.
3. Once DNS propagation is detected, the admin calls `verify-domain` and the activation becomes `verified`.
4. The screen then renders a terminal "connected and active" view with no path back to the connect form.
5. No list, edit, or remove capability exists above the store layer.

**Pain points:**

- A tenant who owns `blog.example.com` and `newsroom.example.com` (or multiple feeds under the same domain) cannot configure the second one through the product.
- TXT-record instructions are lost on page reload because no endpoint exposes the existing activation.
- `connect` and `verify-domain` allow any `tenant_user` to register a domain-ownership claim for the entire tenant, unlike every other tenant-wide connector action.
- A verified per-feed status is visually indistinguishable from the tenant-wide connector activation switch, which can leave a tenant confused about why polling is not happening.

---

## 7. Future State (To-Be)

**New or improved process:**

1. The Tenant-Admin opens a single feed-management screen.
2. The screen lists every activation for the tenant, regardless of status, with columns for domain, feed URL, status, and verification/expiry dates.
3. The admin can "Connect another feed" at any time; if the domain is already verified, the new activation is auto-verified.
4. For any existing activation, the admin can edit the feed URL (but not the domain) or remove it with a confirmation step.
5. Removed activations transition to `removed` status and immediately stop being polled; historical `SocialPost` and `Author` rows remain intact.
6. The screen clearly distinguishes per-feed verification from the separate tenant-wide connector on/off switch.

**Expected capabilities:**

- List every tenant-owned feed activation including `pending`, `verified`, `expired`, and `removed`.
- Edit `feedUrl` on any activation; reject attempts to edit `domain` in place.
- Soft-remove any activation with full status history retained.
- Auto-verify same-domain additional feeds to avoid redundant DNS work.
- Restrict `connect` and `verify-domain` to `tenant_admin`.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a tenant-scoped list of all tenant-owned feed activations. | Must | Returns every row for the caller's tenant, including `pending`, `verified`, `expired`, and `removed`, with id, domain, feedUrl, status, txtRecordHost, txtRecordValue, tokenExpiresAt, verifiedAt, and createdAt. | Product Owner |
| BR-002 | The system shall allow a Tenant-Admin to edit the feed URL of an existing activation. | Must | `PATCH` accepts `{ feedUrl }` only; requests containing `domain` are rejected with `400`; edits work for `pending` and `verified` statuses. | Product Owner |
| BR-003 | The system shall allow a Tenant-Admin to soft-remove an activation. | Must | `DELETE` transitions `status` to `removed`; ingested posts/authors are not deleted; the row stops being polled automatically. | Product Owner |
| BR-004 | The system shall auto-verify a new feed under a domain the tenant has already verified. | Must | `connect` checks for an existing `verified` activation with the same `domain`; if found, the new row is created and immediately `verified` without showing TXT instructions. | Product Owner |
| BR-005 | The system shall require `tenant_admin` role for `connect` and `verify-domain`. | Must | A caller whose resolved role is not `tenant_admin` receives `403` for both endpoints. | Product Owner |
| BR-006 | The Admin UI shall display a real per-tenant feed list with per-row actions. | Must | List shows domain, feed URL, status, and dates; actions include "Verify now" (pending only), "Edit feed URL" (any status), and "Remove" (any status with confirmation). | Product Owner |
| BR-007 | The system shall preserve a full audit trail of activations, including removed ones. | Must | `removed` rows remain in the database and remain queryable through the list endpoint; no hard delete is performed. | Product Owner |
| BR-008 | The Admin UI shall make the tenant-wide connector activation state visible on the same screen. | Must | A verified per-feed row is not presented as "currently polling" when the tenant-wide connector switch is off. | Product Owner |
| BR-009 | The system shall not impose a feed-count ceiling at v1. | Must | No arbitrary limit is enforced on the number of activations per tenant. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All new administration endpoints must reject non-`tenant_admin` callers. | Security | Must | Contract tests prove `403` for `tenant_user` and any other non-admin role. |
| NFR-002 | List queries must remain scoped to the caller's tenant. | Security | Must | `withTenant()`-equivalent scoping is applied; no cross-tenant leakage. |
| NFR-003 | Feed polling must ignore removed or non-verified activations. | Reliability | Must | Existing `getVerifiedActivations()` filter continues to be the only polling source; `removed` rows are never polled. |
| NFR-004 | Soft removal must not delete or modify ingested `SocialPost`/`Author` rows. | Data integrity | Must | Existing rows remain queryable after removal. |
| NFR-005 | The feed list endpoint must return within 2 seconds for tenants with up to 100 activations. | Performance | Should | Latency measured in contract tests or production monitoring at the 95th percentile. |
| NFR-006 | The Admin UI must communicate the difference between per-feed status and the tenant-wide connector switch. | Usability | Must | Screen copy or banner explains that verified feeds are not polled while the connector-wide switch is off. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Only a `tenant_admin` may perform tenant-wide tenant-owned-feed administration (`list`, `edit`, `remove`, `connect`, `verify-domain`). |
| BRU-002 | The `domain` of an activation may not be edited in place; a tenant wanting a different domain must remove the old activation and connect a new one. |
| BRU-003 | The `feedUrl` of an activation may be edited regardless of `pending` or `verified` status, and the edit does not affect the verification token or its TTL. |
| BRU-004 | Removing an activation is a soft removal: `status` becomes `removed`; the underlying data is retained. |
| BRU-005 | A feed may be added under a domain already verified by the same tenant without a second DNS TXT verification step. |
| BRU-006 | No maximum number of tenant-owned feeds is enforced at v1. |
| BRU-007 | `removed` and `expired` activations must not be counted or polled as active feeds. |
| BRU-008 | Already-ingested `SocialPost` and `Author` rows are not deleted when an activation is removed. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenant_owned_feed_activations.id` | Unique activation identifier | Store/API | Engineering | Internal |
| `tenant_owned_feed_activations.tenant_id` | Tenant owner of the activation | Store/API | Engineering | Internal |
| `tenant_owned_feed_activations.domain` | Verified or claimed domain | Admin input / DNS verification | Product | Business-critical |
| `tenant_owned_feed_activations.feed_url` | RSS/Atom feed URL to poll | Admin input | Product | Business-critical |
| `tenant_owned_feed_activations.status` | `pending` / `verified` / `expired` / `removed` | System | Engineering | Internal |
| `tenant_owned_feed_activations.verification_token` | Token used to derive the TXT record value | System | Engineering | Internal |
| `tenant_owned_feed_activations.txt_record_host` | Hostname used for DNS TXT record | System | Engineering | Internal |
| `tenant_owned_feed_activations.token_expires_at` | Token expiry timestamp | System | Engineering | Internal |
| `tenant_owned_feed_activations.verified_at` | When the domain was verified | System | Engineering | Internal |
| `tenant_owned_feed_activations.created_at` | Activation creation timestamp | System | Engineering | Internal |
| `connector_activations.is_active` | Tenant-wide on/off switch for the connector (separate from per-feed status) | ADR-0051 | Engineering | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Activations by status per tenant | Monitor pending/verified/expired/removed distribution | Operations | Daily |
| Same-domain auto-verification count | Track adoption of the no-re-verification shortcut | Product Owner | Weekly |
| Tenant-owned-feed poll volume | Measure outbound HTTP load as feed count grows | Operations | Daily |
| Average time from `pending` to `verified` | Understand DNS-verification friction | Product Owner | Weekly |
| `tenant_user` denied attempts on `connect`/`verify-domain` | Confirm the new role gate is effective | Security / Operations | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Unbounded feed count increases outbound poll and storage costs | Medium | High | Monitor feed count and poll volume; set a review trigger for a future cap or throttling once real usage data exists | Operations |
| R-002 | `removed` and `expired` rows accumulate with no scheduled cleanup | Medium | Medium | Document as a known gap; schedule a future ADR/story for a cleanup job | Product Owner |
| R-003 | Tenants confuse per-feed verification with the tenant-wide connector switch | Medium | High | UI explicitly distinguishes the two states with copy and a banner when the connector-wide switch is off | Product Owner |
| R-004 | Existing `tenant_user` workflows break when `connect`/`verify-domain` become `tenant_admin`-only | Low | Medium | Communicate the role change; the pre-existing behavior was inconsistent and unauthorized | Product Owner |
| R-005 | Editing `feedUrl` on a `pending` activation could be misinterpreted as resetting the token TTL | Low | Low | Document in code and skill that `feedUrl` and token TTL are orthogonal | Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0050 tenant-owned-domain connector design | Internal / architectural | Product Owner | Already accepted |
| D-002 | ADR-0051 tenant-wide connector activation switch | Internal / architectural | Product Owner | Already accepted |
| D-003 | Story 6.20 — multi-feed administration implementation | Internal / delivery | Engineering | Built 2026-08-17 |
| D-004 | `tenant_owned_feed_activations` `CHECK` constraint migration | Internal / technical | Engineering | Built with Story 6.20 |
| D-005 | `TenantOwnedFeedSetup.tsx` Admin UI list redesign | Internal / delivery | Engineering | Built with Story 6.20 |
| D-006 | Platform-Admin cross-tenant feed visibility (future) | Internal / future | Product Owner | Out of scope for BRD-0057 |

---

## 14. Acceptance Criteria

- A `tenant_admin` can list every `tenant_owned_feed_activations` row for their tenant, including `removed` rows.
- `PATCH` accepts only `feedUrl`; a request with `domain` returns `400`.
- `DELETE` soft-removes an activation, setting `status` to `removed`, and the row is no longer polled.
- A second feed under an already-verified same-domain is created with `verified` status and no TXT-record instructions.
- `connect` and `verify-domain` return `403` for callers whose resolved role is not `tenant_admin`.
- The Admin UI renders a per-tenant list with domain, feed URL, status, and per-row actions.
- The list screen visibly distinguishes per-feed verification from the tenant-wide connector activation switch.
- No hard deletion of `SocialPost`/`Author` rows occurs on feed removal.
- No feed-count cap is enforced at v1.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Activation | A row in `tenant_owned_feed_activations` representing a tenant's claim and configuration for one owned feed. |
| Auto-verification | Server-side marking of a new activation as `verified` when the tenant already holds a `verified` activation for the same domain. |
| DNS TXT verification | The process of proving domain ownership by publishing a generated token as a DNS TXT record and polling for its presence. |
| Removed (status) | A soft-deleted state for an activation; the row remains in the database but is no longer polled. |
| Soft removal | A status transition that stops a resource from being active without deleting its historical data. |
| Tenant-Admin | A user role with permission to perform tenant-wide configuration and connector actions. |
| Tenant-Owned Feed | An RSS/Atom or other content feed under a domain controlled by the tenant, ingested by the `tenant-owned-feed` connector. |
| Tenant-Wide Connector Switch | The `connector_activations.is_active` flag that controls whether the whole `tenant-owned-feed` connector polls for a tenant, independent of per-feed status. |

---

## 16. Appendices

### Reference Documents

- [ADR-0057: Multi-feed administration for the tenant-owned-feed connector](../adr/0057-tenant-owned-feed-multi-feed-administration.md) — primary source, Accepted 2026-08-17.
- [ADR-0050: Tenant-owned-domain RSS/content-feed connector](../adr/0050-tenant-owned-domain-rss-content-feed-connector.md) — governing connector design.
- [Story 6.20 — Multi-feed administration for the tenant-owned-feed connector](../user-stories/epic-6-tenant-admin-ui.md) — implementation story.
- [ADR-0051: Tenant-wide connector activation](../adr/0051-connector-activation-deactivation-tenant-wide.md) — tenant-wide on/off switch (referenced for scope separation).

### Missing Source Material

- No related `docs/product-research/feature-designs/<feature>.md` file was found for the tenant-owned-feed connector.
- No `docs/product-research/reports/<feature>-deep-research.md` file was found for this feature.

These missing research artifacts are noted here per the BRD Writer Agent's standard process; the BRD was produced from the accepted ADR and the built implementation story instead.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-17 |
| Product Owner | Menno | | 2026-08-17 |
| Technical Lead | Menno | | 2026-08-17 |
| Other Stakeholder | | | |
