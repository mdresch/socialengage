# Business Requirements Document (BRD)

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Case and Lead Handoff to CRM Business Requirements Document |
| Version | 1.1 |
| Date | 2026-08-28 |
| Author(s) | BRD Writer Agent & Architecture Review Team |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0095, feature design `23-case-handoff-to-crm.md`, and Epic 11 stories |
| 1.1 | 2026-08-28 | Technical Lead | Updated per accepted ADR-0095 review: added tier-1 Microsoft Dynamics 365 Dataverse support alongside Salesforce and HubSpot; generalized `CRMCasePayload` for post escalations and author prospecting pushes; added `crm_field_mappings` schema, fail-closed `409 Conflict` deduplication, and `outbound_activities` audit tracking |

---

## 2. Executive Summary

This BRD defines the business requirements for **ADR-0095 (Case and Lead Handoff to CRM)**. The feature empowers social care agents (`Tenant-Social-Care-Agent`), brand reputation managers (`Tenant-Brand-Reputation-Manager`), and social sellers (`Social-Selling-Strategist`) to escalate social posts, customer inquiries, or prospective leads directly into an external CRM (Microsoft Dynamics 365, Salesforce, or HubSpot) without manual data entry or context loss.

The platform provides a pluggable `CRMConnector` provider abstraction, custom field mapping, fail-closed duplicate protection, and an audit trail in `outbound_activities`.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the loop between social listening and CRM workflows | Social care agents and sellers can escalate an item or author in a single click |
| 2 | Deliver Tier-1 Microsoft Dynamics 365 Support | Full Dataverse Web API parity alongside Salesforce and HubSpot |
| 3 | Unified Post & Prospecting List Support | Power both single post escalations (`/v1/inbox/items/:id/case`) and author lead pushes (ADR-0117) |
| 4 | Prevent duplicate ticket and lead creation | Fail-closed deduplication checking previous successful handoffs (`409 Conflict`) |
| 5 | Maintain auditability and retry resilience | Every handoff recorded in `outbound_activities` with diagnostic logging |

---

## 4. Scope

### 4.1 In Scope
- Pluggable `CRMConnector` provider architecture (`pushEntity`, `validateCredentials`, `status`).
- Support for **Microsoft Dynamics 365** (Dataverse Web API v9.2), **Salesforce** (REST API), and **HubSpot** (CRM v3 API).
- Entity mappings for `lead`, `opportunity`, and `support` cases.
- Tenant-configurable field overrides stored in `crm_field_mappings`.
- Deduplication with `409 Conflict` returning existing CRM links unless `allowDuplicate: true` is passed.
- Recording all attempts in `outbound_activities` with `activity_type = 'crm_handoff'`.

### 4.2 Out of Scope
- Bidirectional synchronization (pulling CRM updates into SocialEngage in v1).
- Unattended automatic push without user initiation in v1.

---

## 5. Stakeholder Profiles & User Needs

| Stakeholder | Key Needs |
|---|---|
| **Tenant-Social-Care-Agent** | Fast escalation of negative or urgent mentions to CRM support cases with original post context. |
| **Social-Selling-Strategist** | Seamless push of prospective authors into CRM leads/opportunities from prospecting lists. |
| **Tenant-Admin** | Straightforward connector setup via Azure AD / OAuth and custom field mapping configuration. |
| **Sole Operator / Product Owner** | Multi-tenant security isolation, zero vendor lock-in, and reliable audit logs. |

---

## 6. Business Requirements & Acceptance Criteria

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| **BR-001** | `CRMConnector` Abstraction | Must | Typed interface with `pushEntity`, `validateCredentials`, and `status`. |
| **BR-002** | Dynamics 365, Salesforce & HubSpot Support | Must | All three providers support `lead`, `opportunity`, and `support` creation with deep links. |
| **BR-003** | Dual Post & Author Escalation | Must | Generalized payload supports post excerpts and author-only prospecting leads. |
| **BR-004** | Custom Field Mapping Schema | Should | `crm_field_mappings` table enables tenant-specific target field overrides. |
| **BR-005** | Duplicate Handoff Protection | Must | Returns `409 Conflict` if already pushed, unless overridden with `allowDuplicate: true`. |
| **BR-006** | Outbound Activity Audit Logging | Must | Inserts `outbound_activities` record for every push with error details on failure. |
| **BR-007** | Handoff Action UI | Must | UI dialogs on post detail, inbox, and prospecting lists to trigger handoffs. |

---

## 7. Related Documents
- Architecture Decision: `docs/adr/0095-case-handoff-to-crm.md` (Accepted 2026-08-28)
- Functional Design: `docs/project docs/Functional-Design/FDD-0095-Case-Handoff-To-CRM.md`
- Connector Activation: `docs/adr/0051-connector-activation-and-credential-storage.md`
- Outbound Activities: `docs/adr/0073-outbound-reply-dispatch.md`, `docs/adr/0075-outbound-post-publishing.md`
- Prospecting Lists: `docs/adr/0086-prospecting-list-model-and-sharing.md`, `docs/adr/0117-prospecting-list-export-and-crm-push.md`
