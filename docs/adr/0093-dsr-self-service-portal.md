# ADR-0093: DSR self-service portal

**Status:** Accepted (2026-08-28)

**Acceptance note (2026-08-28):** Accepted by Menno. Authorizes the public DSR portal for access, correction, and erasure requests, along with ZIP export package fulfillment. Story 10.12 is fully implemented and verified.

**Authorizes:** a tenant-scoped self-service portal where an end user can request access to, correction of, or erasure of the personal data a tenant holds about them, plus the worker that fulfills those requests.

**Source:** `docs/product-research/feature-designs/15-dsr-self-service-portal.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. GDPR/CCPA readiness is an enterprise requirement
`docs/product-research/feature-designs/15-dsr-self-service-portal.md` and the `Data-Subject`/`Legal-Advisor` stakeholder profiles require a self-service path for data-subject rights: access (portability), correction, and erasure. This is the second class of request alongside takedowns.

### 2. The platform does not hold much PII
SocialEngage ingests public posts. It does not collect direct PII such as email or phone unless a tenant's users have been invited. The request portal must clarify this scope.

### 3. Existing export and deletion primitives can be reused
`ADR-0090` (CSV export) and `ADR-0092` (takedown/redaction) already define export and redaction flows. The DSR worker can compose these into access, correction, and erasure actions.

---

## Decision

### 1. Request types and SLA
`data_subject_requests.type` (already created in ADR-0092) supports:
- `access` — deliver a copy of the user's data.
- `correction` — allow the user to propose a correction, subject to tenant review.
- `erasure` — remove the user's data from the tenant's scope.

Each request has a 30-day SLA from `received` to `resolved` by default, configurable per tenant.

### 2. Self-service portal endpoints
```
GET  /public/v1/dsr/requests?token=<magic-link-token>  // list the user's requests
POST /public/v1/dsr/requests                            // create a request
GET  /public/v1/dsr/requests/:id                        // view status
GET  /public/v1/dsr/requests/:id/download               // download access package
```

- The portal is public but per-request scoped by a magic-link token.
- Token is tied to `requester_email` and expires after 7 days.
- `POST` supports `type`, `reason`, and `supporting_links`.

### 3. Access package
- For `type='access'`, the worker generates a ZIP containing:
  - CSV of posts by the user (reusing `0090` export shape).
  - JSON of the user's profile/role in the tenant (if any).
  - A manifest file describing the data and the source.
- The package expires after 7 days.

### 4. Erasure worker
- For `type='erasure'`, the worker:
  - Finds all `social_posts` by the user's public handle/author_id within the tenant.
  - Redacts each using the `ADR-0092` takedown flow.
  - Removes the user's row from `users` if the email matches an invited user and the request is verified.
  - Updates `data_subject_requests.status` to `resolved`.

### 5. Correction flow
- For `type='correction'`, the worker creates a `correction_proposals` row.
- `Tenant-Admin` reviews and can accept/decline the proposal.
- Accepted corrections update `social_posts.enrichment` or a new `correction_notes` column; they do not modify the original public post on the source platform.

### 6. Tenant admin UI
- `GET /v1/admin/tenant/dsr-requests` lists open DSR requests for the tenant.
- `POST /v1/admin/tenant/dsr-requests/:id/resolve` allows admin review and resolution.
- `GET /v1/admin/tenant/dsr-requests/:id/audit` shows the fulfillment trail.

---

## Consequences

1. **Regulatory readiness:** the platform supports the core GDPR/CCPA self-service rights.
2. **Reuses existing flows:** access uses the export worker; erasure uses the redaction flow.
3. **Limited scope:** because the platform is public-post-only, the access package is usually small and the erasure set is bounded.
4. **Magic-link and email dependency:** the public portal requires email delivery and token storage.

---

## Alternatives considered

1. **Handle DSR requests through email only, with no self-service portal.**
   - *Rejected:* a self-service portal is required for the feature and for auditability.

2. **Combine takedown and DSR into a single generic "data rights" form.**
   - *Rejected:* takedown is about a specific public post; DSR is about the user's data footprint. Separate UIs reduce confusion and support different SLAs.

3. **Automatically grant all erasure requests after email verification.**
   - *Rejected:* erasure can affect analytics and legal holds. Tenant review is required, with escalation to `Legal-Advisor` if needed.

---

## Open questions

- How is the user's identity proven for an `access` or `erasure` request? Email verification only, or additional identity proof?
- Should the platform offer a data-processor addendum that clarifies tenant vs. platform responsibilities?
- How are cross-tenant erasure requests handled if the same user interacts with multiple tenants?
- Should `correction` support bulk corrections, or one at a time?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/15-dsr-self-service-portal.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0092` (takedown/redaction), `ADR-0090` (CSV export), `ADR-0031` (audit log)

### Pending supersession note (2026-08-28)

If ADR-0126 (Proposed, 2026-08-28) is accepted, this ADR's Decision §2 would be refined by ADR-0126's own §1–§3 — specifically Article 18 restriction-of-processing flag propagation and tamper-evident cryptographic request receipts. This is a pending note only: ADR-0126 is currently Proposed, not accepted.