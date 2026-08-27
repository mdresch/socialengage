# Business Requirements Document (BRD) — DSR Self-Service Portal

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – DSR Self-Service Portal Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-28 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft for review — source ADR-0093 (Accepted 2026-08-28) is Proposed and may change |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0093 (Accepted 2026-08-28), feature design, and user stories |

---

## 2. Executive Summary

SocialEngage needs a tenant-scoped, self-service portal through which individuals can exercise their data-subject rights: access (portability), correction, and erasure of the personal data a tenant holds about them. Today these requests are not supported through an automated channel; they would arrive ad-hoc and be tracked manually. The proposed DSR self-service portal provides a structured intake, token-scoped public access, automated fulfillment for common request types, and an auditable review path for tenant administrators and legal advisors.

The portal will reuse the existing CSV export and takedown/redaction capabilities already accepted in ADR-0090 and ADR-0092, reducing the new surface area while meeting GDPR Articles 15–18 and CCPA access/deletion obligations. End users benefit from transparency and status tracking; tenants benefit from reduced support overhead and a defensible compliance record.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable GDPR/CCPA data-subject rights self-service | All access, correction, and erasure requests can be submitted, tracked, and resolved through the portal |
| 2 | Reduce manual compliance support load | DSR requests are handled with minimal manual intervention for access and erasure workflows |
| 3 | Build tenant and regulator trust | Every request is auditable, time-stamped, and fulfilled within the configured SLA |
| 4 | Reuse existing platform export and redaction primitives | Access and erasure leverage ADR-0090 export and ADR-0092 redaction to limit new complexity |

---

## 4. Scope

### 4.1 In Scope

- Public, token-scoped DSR request intake for access, correction, and erasure.
- Magic-link token lifecycle tied to requester email, expiring after 7 days.
- Automated access-package generation (CSV post export + JSON profile + manifest, expiring after 7 days).
- Automated erasure workflow that redacts the requester's posts and removes the user row when verified.
- Correction workflow that creates a reviewable proposal for Tenant-Admin acceptance or decline.
- Tenant-Admin review, resolution, and audit-trail endpoints for DSR requests.
- SLA tracking with a default 30-day target, configurable per tenant.
- Logging of DSR actions in the platform audit log.

### 4.2 Out of Scope

- Takedown requests (handled by ADR-0092 and Story 10.11).
- Automated, unconditional approval of erasure requests (tenant review remains required).
- Bulk correction processing (single-proposal flow only).
- Cross-tenant consolidated erasure (handled on a per-tenant basis).
- Identity proof beyond email verification at this stage.

### 4.3 Assumptions

- The tenant has configured email delivery for magic-link issuance.
- Data-subject rights apply only to data the tenant holds within SocialEngage; source-platform content is not directly modified.
- The existing `data_subject_requests` table from ADR-0092 is available and reused.

### 4.4 Constraints

- Must comply with 30-day GDPR response timelines by default.
- Must not expose one requester's data to another requester.
- Must preserve audit logs and referential integrity during erasure.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Data-Subject | End user whose data is held | High | Submit, track, and download responses to data requests |
| Legal-Advisor | Compliance and legal oversight | High | Produce timestamped, auditable records of every request and response |
| Tenant-Admin | Tenant-level administration | High | Review, grant, deny, escalate, and resolve DSR requests |
| Sole-Operator | Platform operations and monitoring | Medium | Monitor request volume, SLA compliance, and overdue requests |

---

## 6. Current State (As-Is)

SocialEngage ingests public posts and currently has no self-service mechanism for data-subject access, correction, or erasure requests. Requesters would have to contact the tenant or platform operator directly. Without a structured intake:

- There is no guaranteed audit trail for data-subject interactions.
- Manual tracking of 30-day SLAs is error-prone.
- Fulfillment requires ad-hoc queries and manual redaction.
- The limited PII held by the platform is not surfaced to individuals in a portable form.

---

## 7. Future State (To-Be)

A public DSR portal will allow a requester to create, view, and download responses for access, correction, and erasure requests using a magic-link token. The platform will:

- Issue a request-scoped token tied to the requester's email.
- Generate a downloadable access package for access requests.
- Redact the requester's content and, where verified, remove the user record for erasure requests.
- Create reviewable correction proposals that a Tenant-Admin can accept or decline.
- Surface all open and historical requests to Tenant-Admins and Legal-Advisors with status and SLA due dates.
- Record all actions in the platform audit log for defensibility.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow a data subject to submit an access request | Must | Request is created, token issued, and 30-day due date assigned | Product Owner |
| BR-002 | The system shall allow a data subject to submit a correction request | Must | Correction proposal is created and queued for Tenant-Admin review | Product Owner |
| BR-003 | The system shall allow a data subject to submit an erasure request | Must | Request is created and routed for tenant review before fulfillment | Product Owner |
| BR-004 | The system shall generate an access package containing posts, profile, and manifest | Must | ZIP is generated with CSV, JSON, and manifest; download expires after 7 days | Product Owner |
| BR-005 | The system shall redact requester posts on erasure approval | Must | All posts by the requester's public handle/author_id are redacted per ADR-0092 | Product Owner |
| BR-006 | The system shall remove the verified user row on erasure approval | Must | User record is deleted or tombstoned when email matches an invited, verified user | Product Owner |
| BR-007 | The system shall allow Tenant-Admins to list and resolve DSR requests | Must | Admin UI shows open requests, status, reviewer notes, and resolution actions | Product Owner |
| BR-008 | The system shall allow Tenant-Admins to view the DSR fulfillment audit trail | Must | Audit endpoint shows the sequence of fulfillment events for a request | Product Owner |
| BR-009 | The system shall track SLA due dates per request | Must | Due date is computed from tenant policy and shown to requester and admin | Product Owner |
| BR-010 | The system shall support magic-link token expiry | Must | Token expires after 7 days; expired links cannot access request data | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Access-package downloads must be presigned and expire after 7 days | Security | Must | Verified by contract tests |
| NFR-002 | DSLA tracking must default to 30 days and be configurable per tenant | Compliance | Must | Tenant policy overrides default |
| NFR-003 | All DSR actions must be written to the audit log | Reliability | Must | Audit log contains request lifecycle events |
| NFR-004 | The public portal must not disclose one request to another | Security | Must | Token scoping prevents cross-request access |
| NFR-005 | Erasure must preserve referential integrity and audit history | Compliance | Must | Redaction uses tombstones or cryptographic redaction |
| NFR-006 | Correction must not alter the original source-platform post | Compliance | Must | Accepted corrections update `social_posts.enrichment` or `correction_notes` only |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A requester may only view or download their own DSR request using the issued token. |
| BRU-002 | Access packages expire 7 days after generation. |
| BRU-003 | Magic-link tokens expire 7 days after issuance. |
| BRU-004 | Erasure requests require Tenant-Admin review and cannot be auto-granted. |
| BRU-005 | Correction proposals must be accepted or declined by a Tenant-Admin before any data change. |
| BRU-006 | Accepted corrections may not modify the original public post on the source platform. |
| BRU-007 | The default SLA from receipt to resolution is 30 days, configurable per tenant. |
| BRU-008 | User-row removal on erasure is permitted only when the request email matches an invited, verified user. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `data_subject_requests` | Tracks request type, status, requester email, received/resolved dates, SLA | ADR-0092/0093 | Platform | Personal data / legal |
| `correction_proposals` | Holds proposed corrections pending Tenant-Admin review | ADR-0093 (Accepted 2026-08-28) | Tenant | Personal data |
| Access package ZIP | CSV of posts, JSON profile, manifest, stored in Blob | ADR-0090/0093 | Tenant | Personal data |
| `social_posts` | Public posts redacted during erasure or corrected via enrichment | Existing | Tenant | Public / personal |
| `users` | Tenant user record, removable on verified erasure | Existing | Tenant | Personal data |
| `platform_admin_audit_log` | Audit trail of DSR actions | ADR-0031 | Platform | Legal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| DSR request volume by type | Track demand for access, correction, erasure | Tenant-Admin / Sole-Operator | Weekly |
| SLA compliance rate | Ensure requests are resolved within policy | Legal-Advisor / Sole-Operator | Weekly |
| Overdue DSR requests | Escalate at-risk requests | Tenant-Admin / Legal-Advisor | Daily |
| Erasure and correction outcomes | Measure request disposition trends | Legal-Advisor | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Magic-link or token exposure could allow unauthorized data access | Low | High | Short expiry (7 days), one-token-per-request, rate-limited resend | Technical Lead |
| R-002 | Erasure affects analytics or legal holds | Medium | High | Tenant-Admin review required; redaction preserves audit trail | Legal-Advisor |
| R-003 | Identity verification limited to email may be insufficient for high-risk erasure | Medium | Medium | Document as open question; escalate to Legal-Advisor if doubt | Product Owner |
| R-004 | Access packages may be small or empty because platform holds mostly public posts | Medium | Low | Clear messaging in portal about the scope of held data | Product Owner |
| R-005 | Cross-tenant requests for the same individual are handled independently | Medium | Medium | Scope to per-tenant workflow and document open question | Legal-Advisor |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0090 CSV export | Internal / Technical | Technical Lead | Accepted prior to DSR access package |
| D-002 | ADR-0092 takedown/redaction | Internal / Technical | Technical Lead | Accepted prior to DSR erasure flow |
| D-003 | ADR-0031 audit log | Internal / Technical | Technical Lead | Accepted prior to DSR audit trail |
| D-004 | Email delivery for magic links | Internal / Technical | Technical Lead | Available before portal launch |
| D-005 | Story 10.14 Trust and rights admin UI | Internal / Frontend | Product Owner | Depends on Story 10.12 backend |

---

## 14. Acceptance Criteria

- A data subject can create an access, correction, or erasure request through the public portal.
- A magic-link token is issued per request and expires after 7 days.
- Access requests generate a downloadable ZIP package that expires after 7 days.
- Erasure requests redact all posts by the requester and remove the user row when verified.
- Correction requests create a `correction_proposals` row for Tenant-Admin review.
- Tenant-Admin can list, review, resolve, and audit DSR requests.
- All DSR actions are logged in the platform audit log.
- Default 30-day SLA is tracked and visible to both requester and admin.

---

## 15. Glossary

| Term | Definition |
|---|---|
| DSR | Data-Subject Request — a request by an individual to exercise rights over their personal data. |
| DSAR | Data-Subject Access Request — a specific type of DSR for obtaining a copy of held data. |
| Data-Subject | The individual whose personal data is held by a tenant. |
| Magic-link token | A time-limited, request-scoped token used to access the public DSR portal. |
| Access package | A downloadable ZIP containing the requester's data (posts CSV, profile JSON, manifest). |
| Correction proposal | A pending suggested change to held data, subject to Tenant-Admin review. |
| Tombstone | A placeholder that preserves referential integrity and audit history after redaction. |

---

## 16. Appendices

### Reference Documents

- Source ADR: `docs/adr/0093-dsr-self-service-portal.md`
- Feature design: `docs/product-research/feature-designs/15-dsr-self-service-portal.md`
- Scoping document: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: ADR-0090 (CSV export), ADR-0092 (takedown/redaction), ADR-0031 (audit log)
- Related user stories: Story 10.12 (DSR self-service portal — backend), Story 10.14 (Trust and rights admin UI — frontend)

### Missing Source

- No `docs/product-research/reports/<feature>-deep-research.md` file was found for the DSR self-service portal. If a deep-research brief is produced later, it should be linked here.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
