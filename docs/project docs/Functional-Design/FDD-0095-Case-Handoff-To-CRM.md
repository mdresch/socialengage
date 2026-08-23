# Business Requirements Document (BRD)

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0095-case-handoff-to-crm.md, ../Business-Requirements/BRD-0095-Case-Handoff-To-CRM.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0095-case-handoff-to-crm.md and the business requirements in BRD-0095-Case-Handoff-To-CRM.md into functional design for **Case Handoff To CRM**.
This BRD defines the business requirements for ADR-0095 *Case handoff to CRM*. The feature lets a `Tenant-Social-Care-Agent` or `Tenant-Brand-Reputation-Manager` escalate a social-inbox item directly into an external CRM (HubSpot or Salesforce) as a lead, opportunity, or support case, without leaving the SocialEngage platform.

Currently, social care teams must manually copy post context, author details, and sentiment into their CRM or support tool, which causes context loss, duplicate data entry, and slower resolution. The proposed solution is a pluggable `CRMConnector` integration that pushes a typed case payload to the tenant's configured CRM, stores the resulting `crmCaseId` and `crmUrl`, and records the action in `outbound_activities` for audit and retry. In v1, the handoff is one-way, supports HubSpot and Salesforce, and reuses the existing connector-activation and outbound-activity patterns already established by ADR-0051, ADR-0073, and ADR-0075.

**Note:** ADR-0095 is currently `Proposed`. This BRD is a draft for review and may change once the ADR is accepted.

---

### 2.2 Scope
**In scope:**
- A `CRMConnector` interface (`pushCase`, `validateCredentials`, `status`) for CRM integrations.
- HubSpot and Salesforce v1 connector implementations.
- `POST /v1/inbox/items/:id/case` endpoint that accepts a case-type, optional assignee, notes, and custom fields.
- Storage of CRM credentials in `platform_credentials` with `credential_type = 'crm'`.
- Default field mapping from `CRMCasePayload` to CRM-specific object fields.
- Tenant-admin-configurable field overrides in a `crm_field_mappings` table.
- `outbound_activities` record with `activity_type='crm_handoff'` for every push.
- Idempotent and retryable push behavior where the target CRM allows it.
- UI action on post detail and inbox item to create a case, choose connector/case type, and display the resulting CRM link.

**Out of scope:**
- Bidirectional synchronization (CRM status updates pulled back into SocialEngage).
- CRM providers other than HubSpot and Salesforce in v1.
- Automatic case creation without user confirmation.
- AI-generated summaries or priority recommendations (deferred; listed as future enhancements in the feature design).
- Generic `POST /v1/crm/push` that exposes raw CRM objects.

## 3. Context and Background
See ADR Context.
This BRD defines the business requirements for ADR-0095 *Case handoff to CRM*. The feature lets a `Tenant-Social-Care-Agent` or `Tenant-Brand-Reputation-Manager` escalate a social-inbox item directly into an external CRM (HubSpot or Salesforce) as a lead, opportunity, or support case, without leaving the SocialEngage platform.

Currently, social care teams must manually copy post context, author details, and sentiment into their CRM or support tool, which causes context loss, duplicate data entry, and slower resolution. The proposed solution is a pluggable `CRMConnector` integration that pushes a typed case payload to the tenant's configured CRM, stores the resulting `crmCaseId` and `crmUrl`, and records the action in `outbound_activities` for audit and retry. In v1, the handoff is one-way, supports HubSpot and Salesforce, and reuses the existing connector-activation and outbound-activity patterns already established by ADR-0051, ADR-0073, and ADR-0075.

**Note:** ADR-0095 is currently `Proposed`. This BRD is a draft for review and may change once the ADR is accepted.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the loop between social listening and CRM/support workflows | A social-inbox item can be escalated to a CRM in a single action |
| 2 | Preserve full context during escalation | CRM case contains post excerpt, author, sentiment, platform, and a link back to the original item |
| 3 | Maintain auditability and compliance | Every handoff is recorded in `outbound_activities` with status and retry capability |
| 4 | Support multiple CRM vendors without vendor lock-in | HubSpot and Salesforce connectors ship in v1; the `CRMConnector` interface allows additional providers |
| 5 | Reduce manual data entry and duplicate cases | Batched/idempotent pushes prevent duplicate CRM records where the CRM supports it |

---

**Positive consequences (from ADR):**
1. **CRM integration is pluggable:** the platform supports HubSpot and Salesforce v1, with room for more.
2. **Actionable listening:** a post can become a CRM record in one click.
3. **Reuses outbound audit:** the handoff follows the same `outbound_activities` pattern as replies and publishing.
4. **Field-mapping complexity:** custom mappings require validation but are essential for CRM adoption.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a `CRMConnector` interface with `pushCase`, `validateCredentials`, and `status` methods | Must | Interface compiles; at least two providers implement it | Technical Lead |
| BR-002 | The system shall support HubSpot and Salesforce CRM providers in v1 | Must | Each provider can push a `CRMCasePayload` and return `crmCaseId` and `crmUrl` | Product Owner |
| BR-003 | The system shall expose `POST /v1/inbox/items/:id/case` to create a CRM case from an inbox/social item | Must | Endpoint accepts `crmConnectorId`, `caseType`, `assignedTo`, `notes`, and `customFields`; returns `outboundActivityId`, `crmCaseId`, and `crmUrl` | Product Owner |
| BR-004 | The system shall store CRM credentials in `platform_credentials` with `credential_type='crm'` | Must | Credentials are isolated by ownership tier and tenant/user | Technical Lead |
| BR-005 | The system shall allow a `Tenant-Admin` to override default CRM field mappings via a `crm_field_mappings` table | Should | Mapping overrides are tenant-scoped and validated before use | Product Owner |
| BR-006 | The system shall record every handoff in `outbound_activities` with `activity_type='crm_handoff'` | Must | Record includes `post_id`, `author_id`, `crm_case_id`, `crm_url`, and `response_status` | Technical Lead |
| BR-007 | The system shall support idempotent `pushCase` calls where the CRM allows it | Should | Retry of the same `post_id` to the same connector does not create a duplicate CRM record | Technical Lead |
| BR-008 | The UI shall provide a "Create case in CRM" action on `PostDetail` and `InboxItem` | Must | Action opens a dialog and, on success, displays the CRM link | Product Owner |
| BR-009 | The UI dialog shall let the user choose the CRM connector, `caseType`, assignee, and notes | Should | All optional fields are clearly labeled and validated | Product Owner |
| BR-010 | The UI shall surface connector errors and allow the user to retry a failed handoff | Should | Error messages explain the failure; retry reuses the same `outbound_activities` anchor | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Social-Care-Agent | Primary user; escalates inbox items to CRM | High | One-click handoff with clear confirmation and CRM link |
| Tenant-User | Reviews assigned conversations | High | See linked CRM case on the inbox item |
| Tenant-Admin | Configures CRM connector and field mappings | High | Secure credential setup and customizable mapping per tenant |
| Tenant-Brand-Reputation-Manager | Tracks which reputation issues are handed off | Medium | Visibility into handoff status and linked support cases |
| Product Owner | Defines feature scope and acceptance | Medium | Clean contract, pluggable design, and auditable handoffs |
| Technical Lead | Reviews architecture and security | Medium | Reuse of existing connector patterns and secure credential storage |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 11.1 | epic-11-adr-0095-to-0100.md | As backend engineer, I want a `CRMConnector` interface, HubSpot and Salesforce implementations, and `POST /v1/inbox/:id/case`, so that a `Tenant-Social-Care-... | `CRMConnector` interface with `pushCase()`, `validateCredentials()`, and `status()`.; CRM credentials stored in `platform_credentials` with `credential_type=... |
| Story 11.2 | epic-11-adr-0095-to-0100.md | As `Tenant-Social-Care-Agent`, I want a "Create case in CRM" action on the post detail and inbox item, so that I can push a relevant post into our CRM withou... | "Create case" button on `PostDetail` and `InboxItem`.; A modal lets the user pick the CRM connector, `caseType`, assignee, and optional notes.; On success, t... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `CRMCasePayload` (postId, authorId, authorName, authorPublicUrl, postExcerpt, platformId, publishedAt, sentiment, watchlistId, caseType, assignedTo) | Typed payload pushed to the CRM | `social_posts` / `inbox_items` | Product / Engineering | Personal data (author details) |
| `outbound_activities` row (`activity_type='crm_handoff'`) | Audit and idempotency anchor | Generated at handoff | Engineering | Operational |
| `platform_credentials` with `credential_type='crm'` | CRM authentication secrets | Tenant/user activation | Engineering | High (credentials) |
| `crm_field_mappings` | Tenant overrides of default field mapping | Tenant-Admin configuration | Product | Operational |
| `crmCaseId` / `crmUrl` | External reference returned by the CRM | CRM provider response | Product | Operational |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A user may only hand off an inbox item to a CRM connector that is activated for their tenant or user tier. |
| BRU-002 | A `Tenant-Admin` or `Tenant-User` may activate a CRM connector for themselves; a `Tenant-Admin` may also activate it tenant-wide. |
| BRU-003 | A handoff must write an `outbound_activities` row with `activity_type='crm_handoff'` before returning a success response. |
| BRU-004 | Custom `crm_field_mappings` are validated to ensure target fields exist for the selected CRM provider. |
| BRU-005 | A `post_id` + `crm_connector_id` combination is the idempotency anchor for retry. |
| BRU-006 | PII may only be sent to the CRM if the integration contract and tenant configuration explicitly allow it. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0051 connector activation pattern | Internal | Technical Lead | Already in place |
| D-002 | ADR-0073/0075 `outbound_activities` pattern | Internal | Technical Lead | Already in place |
| D-003 | `docs/product-research/feature-designs/23-case-handoff-to-crm.md` | Internal | Product Owner | Already in place |
| D-004 | Story 11.1 (backend `CRMConnector` and `POST /v1/inbox/:id/case`) | Internal | Engineering | Required before Story 11.2 |
| D-005 | Story 11.2 (case handoff UI) | Internal | Engineering | Depends on Story 11.1 |

---

- The tenant has already activated a CRM connector with valid credentials.
- The user performing the handoff has the appropriate role (`Tenant-Social-Care-Agent`, `Tenant-Brand-Reputation-Manager`, etc.).
- HubSpot and Salesforce APIs remain available and reachable from the platform.
- The existing `outbound_activities` table can accommodate `crm_handoff` rows.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | CRM credentials and field mappings must be isolated per tenant/user | Security | Must | RLS and ownership-tier checks prevent cross-tenant access |
| NFR-002 | Handoff API response time should be under 5 seconds for the 95th percentile | Performance | Should | Monitored in production for 30 days |
| NFR-003 | Handoff failures are retried and logged without data loss | Reliability | Must | Failed `outbound_activities` can be retried; no silent drops |
| NFR-004 | The connector framework is extensible to new CRM providers | Maintainability | Must | New provider requires only a new `CRMConnector` implementation and field mapping |
| NFR-005 | UI is keyboard-navigable and provides clear success/error messages | Accessibility | Should | Dialog passes basic keyboard and screen-reader checks |

---

## 11. Error Handling and Exceptions
1. **CRM integration is pluggable:** the platform supports HubSpot and Salesforce v1, with room for more.
2. **Actionable listening:** a post can become a CRM record in one click.
3. **Reuses outbound audit:** the handoff follows the same `outbound_activities` pattern as replies and publishing.
4. **Field-mapping complexity:** custom mappings require validation but are essential for CRM adoption.

---

## 12. Assumptions and Dependencies
- The tenant has already activated a CRM connector with valid credentials.
- The user performing the handoff has the appropriate role (`Tenant-Social-Care-Agent`, `Tenant-Brand-Reputation-Manager`, etc.).
- HubSpot and Salesforce APIs remain available and reachable from the platform.
- The existing `outbound_activities` table can accommodate `crm_handoff` rows.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | CRM API rate limits cause handoff failures | Medium | High | Implement idempotent retries, queue failed pushes, and surface retry UI | Technical Lead |
| R-002 | Field mapping errors produce invalid CRM records | Medium | Medium | Validate `crm_field_mappings` and provide default mappings per provider | Product Owner |
| R-003 | Low adoption by social care agents | Medium | Medium | Include one-click action, clear CRM link, and training for new UI | Product Owner |
| R-004 | HubSpot/Salesforce object model changes break mapping | Low | Medium | Abstract mapping behind `CRMConnector`; keep provider-specific logic isolated | Technical Lead |
| R-005 | PII sent to CRM without proper consent | Low | High | Enforce tenant-level PII consent flag and default to minimal payload | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0095-case-handoff-to-crm.md`
- BRD: `../Business-Requirements/BRD-0095-Case-Handoff-To-CRM.md`
- Feature design: `docs/product-research/feature-designs/23-case-handoff-to-crm.md``
- Feature design: `docs/product-research/feature-designs/06-unified-social-inbox.md``
- Deep research: `docs/product-research/reports/23-case-handoff-to-crm-deep-research.md``
- User stories: see extracted stories above