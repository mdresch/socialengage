# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0092 Author Initiated Takedown — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0092-author-initiated-takedown.md, ../Business-Requirements/BRD-0092-Author-Initiated-Takedown.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0092-author-initiated-takedown.md and the business requirements in BRD-0092-Author-Initiated-Takedown.md into functional design for **Author Initiated Takedown**.
Public data ingested by SocialEngage is treated as borrowed from the original author or data subject. Without a clear, legal-grade path for an author to request removal, the platform faces trust, ethical, and regulatory risk — particularly under GDPR Article 17 and CCPA deletion-request obligations.

This initiative authorizes a public, unauthenticated takedown form that lets an author request the removal of their content from SocialEngage. Each submission becomes a tracked `data_subject_requests` ticket that is verified by email magic link, reviewed by a `Tenant-Admin` or escalated to a `Legal-Advisor`, and, if granted, results in a soft redaction of the affected `social_posts` row. The original post remains on the source platform; only SocialEngage's stored copy of the body and raw payload is redacted. This preserves referential integrity and audit continuity while removing sensitive content.

The expected business value is higher author and regulator trust, a defensible audit trail for each takedown decision, and a single, documented workflow replacing ad-hoc email or manual tracking.

---

### 2.2 Scope
**In scope:**
- A public, unauthenticated `POST /public/v1/takedowns` form accepting `platform_post_url`, `requester_email`, `requester_name`, and `requester_affirmation`.
- Rate limiting to 3 submissions per IP per hour and anti-abuse controls (CAPTCHA recommended).
- Email magic-link verification before a request becomes visible to the tenant.
- A `data_subject_requests` table to track takedown submissions and their lifecycle.
- A `Tenant-Admin` review workflow supporting **Grant**, **Deny**, and **Escalate** decisions.
- Soft redaction of the `social_posts` row on grant (`body_markdown` replaced, `rawPayload` set to `null`, `redacted_at` and `redaction_request_id` populated).
- Triggering of `RAGConnector.deletePost()` and `post_watchlist_matches` cleanup on grant.
- Requester notification and a public status-check page using the request ID.
- Audit logging of submissions, reviews, and resolutions.

**Out of scope:**
- Deleting the post from the original social platform (Reddit, X, news site, etc.).
- Hard deletion of the `social_posts` row; soft redaction is the chosen default.
- Full data-subject-rights (DSR) self-service portal (access, correction, portability, erasure); those are covered by ADR-0093 and Story 10.12.
- Auto-grant policies or SLAs for response; these remain open questions.
- Anonymous takedown requests (email verification is required at this stage).
- Analytics-level adjustments for redacted posts; a separate ADR will cover that if needed.

## 3. Context and Background
See ADR Context.
Public data ingested by SocialEngage is treated as borrowed from the original author or data subject. Without a clear, legal-grade path for an author to request removal, the platform faces trust, ethical, and regulatory risk — particularly under GDPR Article 17 and CCPA deletion-request obligations.

This initiative authorizes a public, unauthenticated takedown form that lets an author request the removal of their content from SocialEngage. Each submission becomes a tracked `data_subject_requests` ticket that is verified by email magic link, reviewed by a `Tenant-Admin` or escalated to a `Legal-Advisor`, and, if granted, results in a soft redaction of the affected `social_posts` row. The original post remains on the source platform; only SocialEngage's stored copy of the body and raw payload is redacted. This preserves referential integrity and audit continuity while removing sensitive content.

The expected business value is higher author and regulator trust, a defensible audit trail for each takedown decision, and a single, documented workflow replacing ad-hoc email or manual tracking.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide a legal-grade, self-service takedown path for authors and data subjects | Authors can submit and track a request without creating an account |
| 2 | Reduce legal and ethical risk from unauthorized or contested public content use | All takedown requests are tracked, reviewed, and resolved in `data_subject_requests` |
| 3 | Build trust and legitimacy with content authors and regulators | Clear messaging that the platform cannot remove source-platform content, only its own copy |
| 4 | Maintain audit and analytics continuity | Post rows and counts remain referentially intact; only `body_markdown` and `rawPayload` are redacted |

---

**Positive consequences (from ADR):**
1. **Trust and defensibility:** authors have a clear, legal-grade path to request removal.
2. **Audit trail:** every request is tracked and resolved, not silently executed.
3. **Soft redaction protects the platform:** the row can still be referenced in audit packs without exposing the content.
4. **Magic-link dependency:** public form requires an email-sending capability (Azure Communication Services or similar).

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Author-of-a-Post | Primary — the person whose public content is ingested | High | A simple, no-account way to request removal and receive a tracking ID |
| Data-Subject | Primary — any individual exercising erasure rights | High | A documented, auditable path to request erasure under GDPR/CCPA |
| Legal-Advisor | Primary — reviews takedown decisions and audit packs | High | A complete log of requests, decisions, redaction outcomes, and notes |
| Platform-Admin | Secondary — may review/escalate requests | Medium | A queue of requests without exposure to unrelated tenant data |
| Tenant-Admin | Secondary — reviews requests affecting their tenant | High | Ability to grant, deny, or escalate and confirm redaction |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 10.11 | epic-10-adr-0086-to-0094.md | As backend engineer, I want a public takedown form, `data_subject_requests`, and a soft-redaction flow for `social_posts`, so that authors can request remova... | `POST /public/v1/takedowns` accepts `platform_post_url`, `requester_email`, `requester_name`, and `requester_affirmation`.; Magic-link verification is sent b... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0083 `RAGConnector.deletePost()` implementation | Internal | Technical Lead | Before takedown grant flow ships |
| D-002 | ADR-0031 audit-log framework | Internal | Technical Lead | Before takedown review events are logged |
| D-003 | ADR-0043 tenant deletion/offboarding patterns | Internal | Technical Lead | For consistent redaction/deletion semantics |
| D-004 | Email-sending capability (Azure Communication Services or similar) | External | Technical Lead | Before magic-link verification ships |
| D-005 | Story 10.11 — Author-initiated takedown (backend) | Internal | Product Owner | Ready; builds first |
| D-006 | Story 10.14 — Trust and rights admin UI (frontend) | Internal | Product Owner | Ready; depends on Stories 10.11–10.13 |

---

- The platform will use an email-sending capability (e.g., Azure Communication Services) for magic-link verification and resolution notifications.
- The public form can be protected by IP-based rate limiting and a CAPTCHA service.
- `Tenant-Admin` review UI is available within the existing admin application (frontend delivered under Story 10.14).
- `RAGConnector.deletePost()` (ADR-0083) and the audit-log framework (ADR-0031) are available before this feature is implemented.

## 10. Non-Functional Considerations
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

## 11. Error Handling and Exceptions
1. **Trust and defensibility:** authors have a clear, legal-grade path to request removal.
2. **Audit trail:** every request is tracked and resolved, not silently executed.
3. **Soft redaction protects the platform:** the row can still be referenced in audit packs without exposing the content.
4. **Magic-link dependency:** public form requires an email-sending capability (Azure Communication Services or similar).

---

## 12. Assumptions and Dependencies
- The platform will use an email-sending capability (e.g., Azure Communication Services) for magic-link verification and resolution notifications.
- The public form can be protected by IP-based rate limiting and a CAPTCHA service.
- `Tenant-Admin` review UI is available within the existing admin application (frontend delivered under Story 10.14).
- `RAGConnector.deletePost()` (ADR-0083) and the audit-log framework (ADR-0031) are available before this feature is implemented.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Public form is abused for spam, frivolous, or malicious takedowns | Medium | High | Rate limiting, CAPTCHA, affirmation attestation, and review gate before redaction | Technical Lead |
| R-002 | Requester cannot prove they are the author of the post | High | Medium | Require original platform URL and legal affirmation; escalation path to `Legal-Advisor` for disputed cases | Product Owner |
| R-003 | Magic-link email delivery fails or is delayed | Medium | Medium | Retry logic, status page, and fallback notification path; monitor email provider health | Technical Lead |
| R-004 | Redaction misses derived data in RAG indexes or matches | Medium | High | Trigger `RAGConnector.deletePost()` and `post_watchlist_matches` cleanup as part of grant flow | Technical Lead |
| R-005 | Tenants or authors misunderstand that source-platform content is not removed | Medium | High | Clear in-form messaging and confirmation page stating the scope of removal | Product Owner |
| R-006 | GDPR/CCPA response deadlines are missed | Medium | High | Track `created_at` and `resolved_at`; future auto-escalation/SLA alert rules (deferred) | Legal-Advisor |

---

## 14. Appendix
- ADR: `../../adr/0092-author-initiated-takedown.md`
- BRD: `../Business-Requirements/BRD-0092-Author-Initiated-Takedown.md`
- Feature design: `docs/product-research/feature-designs/14-author-initiated-takedown.md``
- Deep research: `docs/product-research/reports/14-author-initiated-takedown-deep-research.md``
- User stories: see extracted stories above