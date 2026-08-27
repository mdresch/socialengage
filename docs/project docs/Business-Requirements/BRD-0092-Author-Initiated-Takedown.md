# Business Requirements Document (BRD)

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Author-initiated Takedown Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-28 |
| Author(s) | BRD Writer Agent (synthesized from ADR-0092 (Accepted 2026-08-28), feature design 14, feature-adr-scoping, and Epic 10 stories) |
| Approver(s) | Menno, Business Sponsor / Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial BRD drafted from Proposed ADR-0092 (Accepted 2026-08-28) and related feature design |

> **Note:** This BRD is based on ADR-0092 (Accepted 2026-08-28), which is currently **Proposed**. It is a draft for review and may change if the ADR is revised before acceptance.

---

## 2. Executive Summary

Public data ingested by SocialEngage is treated as borrowed from the original author or data subject. Without a clear, legal-grade path for an author to request removal, the platform faces trust, ethical, and regulatory risk — particularly under GDPR Article 17 and CCPA deletion-request obligations.

This initiative authorizes a public, unauthenticated takedown form that lets an author request the removal of their content from SocialEngage. Each submission becomes a tracked `data_subject_requests` ticket that is verified by email magic link, reviewed by a `Tenant-Admin` or escalated to a `Legal-Advisor`, and, if granted, results in a soft redaction of the affected `social_posts` row. The original post remains on the source platform; only SocialEngage's stored copy of the body and raw payload is redacted. This preserves referential integrity and audit continuity while removing sensitive content.

The expected business value is higher author and regulator trust, a defensible audit trail for each takedown decision, and a single, documented workflow replacing ad-hoc email or manual tracking.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide a legal-grade, self-service takedown path for authors and data subjects | Authors can submit and track a request without creating an account |
| 2 | Reduce legal and ethical risk from unauthorized or contested public content use | All takedown requests are tracked, reviewed, and resolved in `data_subject_requests` |
| 3 | Build trust and legitimacy with content authors and regulators | Clear messaging that the platform cannot remove source-platform content, only its own copy |
| 4 | Maintain audit and analytics continuity | Post rows and counts remain referentially intact; only `body_markdown` and `rawPayload` are redacted |

---

## 4. Scope

### 4.1 In Scope

- A public, unauthenticated `POST /public/v1/takedowns` form accepting `platform_post_url`, `requester_email`, `requester_name`, and `requester_affirmation`.
- Rate limiting to 3 submissions per IP per hour and anti-abuse controls (CAPTCHA recommended).
- Email magic-link verification before a request becomes visible to the tenant.
- A `data_subject_requests` table to track takedown submissions and their lifecycle.
- A `Tenant-Admin` review workflow supporting **Grant**, **Deny**, and **Escalate** decisions.
- Soft redaction of the `social_posts` row on grant (`body_markdown` replaced, `rawPayload` set to `null`, `redacted_at` and `redaction_request_id` populated).
- Triggering of `RAGConnector.deletePost()` and `post_watchlist_matches` cleanup on grant.
- Requester notification and a public status-check page using the request ID.
- Audit logging of submissions, reviews, and resolutions.

### 4.2 Out of Scope

- Deleting the post from the original social platform (Reddit, X, news site, etc.).
- Hard deletion of the `social_posts` row; soft redaction is the chosen default.
- Full data-subject-rights (DSR) self-service portal (access, correction, portability, erasure); those are covered by ADR-0093 and Story 10.12.
- Auto-grant policies or SLAs for response; these remain open questions.
- Anonymous takedown requests (email verification is required at this stage).
- Analytics-level adjustments for redacted posts; a separate ADR will cover that if needed.

### 4.3 Assumptions

- The platform will use an email-sending capability (e.g., Azure Communication Services) for magic-link verification and resolution notifications.
- The public form can be protected by IP-based rate limiting and a CAPTCHA service.
- `Tenant-Admin` review UI is available within the existing admin application (frontend delivered under Story 10.14).
- `RAGConnector.deletePost()` (ADR-0083) and the audit-log framework (ADR-0031) are available before this feature is implemented.

### 4.4 Constraints

- The form must remain public and unauthenticated by design to avoid excluding non-tenant authors.
- PII from requesters must be minimized: only email, name, and affirmation are stored.
- Requester details must not be visible to the tenant until the magic link is verified.
- All decisions must be auditable and non-repudiable.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Author-of-a-Post | Primary — the person whose public content is ingested | High | A simple, no-account way to request removal and receive a tracking ID |
| Data-Subject | Primary — any individual exercising erasure rights | High | A documented, auditable path to request erasure under GDPR/CCPA |
| Legal-Advisor | Primary — reviews takedown decisions and audit packs | High | A complete log of requests, decisions, redaction outcomes, and notes |
| Platform-Admin | Secondary — may review/escalate requests | Medium | A queue of requests without exposure to unrelated tenant data |
| Tenant-Admin | Secondary — reviews requests affecting their tenant | High | Ability to grant, deny, or escalate and confirm redaction |

---

## 6. Current State (As-Is)

There is no public, self-service path for an author to request the removal of their content from SocialEngage. Requests, if they occur, arrive through informal channels (email, support tickets) and are handled manually, inconsistently, and without a central audit trail.

**Pain points:**
- No standardized intake form or legal attestation.
- No tracking of request status, review decisions, or redaction outcomes.
- Manual redaction risks missing derived indexes, watchlist matches, or vector-store entries.
- Lack of defensible evidence for regulatory or legal review.
- Authors may mistakenly believe the platform can delete the post from the source site.

---

## 7. Future State (To-Be)

A public takedown form allows any author or data subject to submit a removal request using the original post URL and contact details. The request is verified by a magic link, tracked in `data_subject_requests`, and surfaced to the affected tenant's admin only after verification. The `Tenant-Admin` reviews the request and chooses to grant, deny, or escalate it.

On grant, the platform soft-redacts the `social_posts` row, replacing the `body_markdown` with a redaction marker, setting `rawPayload` to `null`, and recording `redacted_at` and `redaction_request_id`. The `RAGConnector.deletePost()` method and `post_watchlist_matches` cleanup are triggered to remove derived content. The requester is notified of the resolution and can check the request status at any time using the provided request ID.

**Expected capabilities:**
- Public, unauthenticated takedown intake with rate limiting and CAPTCHA.
- Magic-link email verification to confirm requester identity.
- Central tracking of request status and reviewer decisions.
- Soft redaction that preserves referential integrity and audit continuity.
- End-to-end notification and status visibility for the requester.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a public form to submit takedown requests with `platform_post_url`, `requester_email`, `requester_name`, and `requester_affirmation` | Must | `POST /public/v1/takedowns` accepts the required fields and returns a request ID | Product Owner |
| BR-002 | The system shall enforce anti-abuse controls on the public form | Must | Rate limit of 3 submissions per IP per hour and CAPTCHA or equivalent protection is active | Technical Lead |
| BR-003 | The system shall verify requester email via a magic link before the request is visible to the tenant | Must | Request is not written to `data_subject_requests` with `status='received'` until the magic link is confirmed | Product Owner |
| BR-004 | The system shall track takedown requests in a `data_subject_requests` table | Must | Table stores type, tenant, post, requester details, status, reviewer, timestamps, and notes | Technical Lead |
| BR-005 | The system shall support `Tenant-Admin` review of takedown requests | Must | Admin can grant, deny, or escalate a request and add reviewer notes | Product Owner |
| BR-006 | The system shall soft-redact the `social_posts` row on grant | Must | `body_markdown` is replaced with a redaction marker, `rawPayload` is `null`, `redacted_at` and `redaction_request_id` are populated | Technical Lead |
| BR-007 | The system shall remove derived content on grant | Must | `RAGConnector.deletePost()` is invoked and `post_watchlist_matches` is cleaned up | Technical Lead |
| BR-008 | The system shall notify the requester when the request is resolved | Should | Email or status update is sent on `granted`, `denied`, or `escalated` | Product Owner |
| BR-009 | The system shall provide a public status page for requesters | Should | A status page or endpoint returns the current `status` and resolution notes when given a request ID | Product Owner |
| BR-010 | The system shall log all takedown submissions, reviews, and resolutions to the audit log | Must | `platform_admin_audit_log` records submission, verification, and review events | Technical Lead |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Public endpoints must be protected against automated abuse and denial-of-service | Security | Must | Rate limiting and bot mitigation verified by contract tests |
| NFR-002 | Requester PII must be minimized and not exposed to tenants before verification | Security / Compliance | Must | No tenant-visible request details until magic-link verification completes |
| NFR-003 | The soft-redaction flow must preserve referential integrity across `social_posts`, matches, and RAG indexes | Reliability | Must | Foreign keys and downstream references remain valid after redaction |
| NFR-004 | The takedown form and status page must be usable on mobile and accessible to screen readers | Usability / Accessibility | Should | Manual accessibility and responsive-design checks pass |
| NFR-005 | Takedown requests must support GDPR/CCPA compliance evidence | Compliance | Must | Audit log and `data_subject_requests` row can be exported in a compliance pack |
| NFR-006 | Magic links and request status endpoints must be available with 99.9% uptime during business hours | Reliability | Should | Monitoring shows no more than 0.1% unavailability over 30 days |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | An author or data subject may submit a takedown request without having a SocialEngage account. |
| BRU-002 | A takedown request is not visible to the affected tenant until the requester's email has been verified by a magic link. |
| BRU-003 | A `Tenant-Admin` must review and explicitly grant, deny, or escalate every verified request; automatic execution is not allowed. |
| BRU-004 | On grant, the `social_posts` row is soft-redacted, not hard-deleted, to preserve referential and audit integrity. |
| BRU-005 | Redaction removes `body_markdown` and `rawPayload` from SocialEngage but does not remove the post from the original social platform. |
| BRU-006 | The requester must provide a legal attestation (`requester_affirmation`) confirming their right to request removal. |
| BRU-007 | Status transitions must be one of `received` → `under_review` → (`granted` / `denied` / `escalated`) and recorded with reviewer and timestamp. |
| BRU-008 | PII from the requester must be retained only as long as required for resolution and legal hold. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `data_subject_requests` | Tracks every data-subject request, including takedowns, with full lifecycle and reviewer audit | Form submission / review actions | Platform | Personal data / legal record |
| `social_posts.body_markdown` | Post body text; replaced with redaction marker on grant | Ingested public post / redaction worker | Tenant | Public until redacted, then redacted |
| `social_posts.rawPayload` | Raw provider payload; set to `null` on grant | Ingested public post / redaction worker | Tenant | Connector-specific, may contain PII |
| `social_posts.redacted_at` | Timestamp when the post was redacted | Redaction worker | Tenant | System metadata |
| `social_posts.redaction_request_id` | Foreign key to the takedown request | Redaction worker | Tenant | System metadata |
| `post_watchlist_matches` | Derived matches to be cleaned up when a post is redacted | Watchlist matcher / redaction worker | Tenant | Derived data |
| `platform_admin_audit_log` | Records submission, verification, review, and redaction events | Audit framework | Platform | Audit / legal record |
| `requester_email` / `requester_name` | Contact details of the person requesting takedown | Public form | Platform | Personal data |
| `requester_affirmation` | Legal attestation text provided by the requester | Public form | Platform | Legal evidence |
| `platform_post_url` | URL of the post on the original platform | Public form | Platform / Tenant | Public identifier |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Takedown request volume by status | Track intake and resolution backlog | Legal-Advisor / Platform-Admin | Daily / ad hoc |
| Average resolution time | Measure SLA and operational efficiency | Legal-Advisor / Tenant-Admin | Weekly |
| Redaction count by tenant and platform | Understand content-removal patterns | Platform-Admin / Compliance | Monthly |
| Duplicate or clustered requests | Identify coordinated or abusive campaigns (AI-assisted in v2) | Legal-Advisor / Platform-Admin | Ad hoc |
| Audit pack exports | Provide tamper-evident compliance records | Legal-Advisor / Regulators | Ad hoc |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Public form is abused for spam, frivolous, or malicious takedowns | Medium | High | Rate limiting, CAPTCHA, affirmation attestation, and review gate before redaction | Technical Lead |
| R-002 | Requester cannot prove they are the author of the post | High | Medium | Require original platform URL and legal affirmation; escalation path to `Legal-Advisor` for disputed cases | Product Owner |
| R-003 | Magic-link email delivery fails or is delayed | Medium | Medium | Retry logic, status page, and fallback notification path; monitor email provider health | Technical Lead |
| R-004 | Redaction misses derived data in RAG indexes or matches | Medium | High | Trigger `RAGConnector.deletePost()` and `post_watchlist_matches` cleanup as part of grant flow | Technical Lead |
| R-005 | Tenants or authors misunderstand that source-platform content is not removed | Medium | High | Clear in-form messaging and confirmation page stating the scope of removal | Product Owner |
| R-006 | GDPR/CCPA response deadlines are missed | Medium | High | Track `created_at` and `resolved_at`; future auto-escalation/SLA alert rules (deferred) | Legal-Advisor |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0083 `RAGConnector.deletePost()` implementation | Internal | Technical Lead | Before takedown grant flow ships |
| D-002 | ADR-0031 audit-log framework | Internal | Technical Lead | Before takedown review events are logged |
| D-003 | ADR-0043 tenant deletion/offboarding patterns | Internal | Technical Lead | For consistent redaction/deletion semantics |
| D-004 | Email-sending capability (Azure Communication Services or similar) | External | Technical Lead | Before magic-link verification ships |
| D-005 | Story 10.11 — Author-initiated takedown (backend) | Internal | Product Owner | Ready; builds first |
| D-006 | Story 10.14 — Trust and rights admin UI (frontend) | Internal | Product Owner | Ready; depends on Stories 10.11–10.13 |

---

## 14. Acceptance Criteria

- `POST /public/v1/takedowns` accepts `platform_post_url`, `requester_email`, `requester_name`, and `requester_affirmation` and returns a request ID.
- The public endpoint is rate-limited to 3 submissions per IP per hour.
- A verification email with a magic link is sent; the request only enters `data_subject_requests` with `status='received'` after the magic link is confirmed.
- `data_subject_requests` tracks the full lifecycle with `received`, `under_review`, `granted`, `denied`, and `escalated` statuses.
- A `Tenant-Admin` can grant, deny, or escalate a verified request and add reviewer notes.
- On grant, the `social_posts` row is soft-redacted: `body_markdown` is replaced with `[redacted — takedown request <id>]`, `rawPayload` is `null`, and `redacted_at` and `redaction_request_id` are populated.
- `RAGConnector.deletePost()` is triggered and `post_watchlist_matches` is cleaned up on grant.
- The requester is notified of the resolution and can check the request status.
- All submissions, verifications, reviews, and redactions are recorded in the audit log.
- The takedown form clearly states that the original post is not removed from the source platform.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Author-of-a-Post | The person who created the public content ingested by SocialEngage. |
| Data-Subject | An individual whose personal data is processed by the platform and who can exercise rights such as erasure. |
| Magic Link | A one-time, time-limited URL sent by email to verify the requester's address. |
| Soft Redaction | Replacing sensitive content with a placeholder while retaining the row and its referential integrity for audit continuity. |
| Takedown | A request to remove a stored copy of a public post from SocialEngage, not from the original platform. |
| `data_subject_requests` | The tracking table for data-subject rights requests, including takedowns, access, correction, and portability. |
| `social_posts` | The canonical table of ingested social posts. |
| `post_watchlist_matches` | Derived rows linking posts to watchlists. |
| `RAGConnector` | The provider abstraction for vector/RAG storage, including `deletePost()`. |

---

## 16. Appendices

### Reference Documents

- ADR-0092 (Accepted 2026-08-28): Author-initiated takedown — `docs/adr/0092-author-initiated-takedown.md` (Proposed)
- Feature design 14: Author-initiated takedown — `docs/product-research/feature-designs/14-author-initiated-takedown.md`
- Feature-to-ADR Scoping Plan — `docs/product-research/feature-adr-scoping.md`
- Epic 10 user stories — `docs/user-stories/epic-10-adr-0086-to-0094.md`
- Related ADRs: ADR-0083 (RAG deletion sync), ADR-0043 (tenant deletion/offboarding), ADR-0031 (audit log)

### Related User Stories

| Epic / Story ID | Intent | Key Acceptance Criteria |
|---|---|---|
| Story 10.11 — Author-initiated takedown (backend) | As a backend engineer, I want a public takedown form, `data_subject_requests`, and a soft-redaction flow for `social_posts` so that authors can request removal of their content. | Public `POST /public/v1/takedowns`; magic-link verification; tracked statuses; soft redaction; `RAGConnector.deletePost()` triggered. |
| Story 10.14 — Trust and rights admin UI (frontend) | As a `Tenant-Admin`, I want a single "Trust & Compliance" section for takedowns, DSR requests, and audit packs so that I can manage data-subject rights and audit requests in one place. | `TrustAndComplianceView` with tabs; review/grant/deny/escalate; audit-pack generation and download. |

### Missing / TBD Sources

- No `docs/product-research/reports/14-author-initiated-takedown-deep-research.md` file was found; deep-research brief is absent.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
