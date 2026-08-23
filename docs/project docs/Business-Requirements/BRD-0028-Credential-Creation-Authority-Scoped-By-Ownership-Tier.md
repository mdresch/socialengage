# SocialEngage – Credential Creation Authority Scoped by Ownership Tier

## Business Requirements Document (BRD)

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Credential Creation Authority Scoped by Ownership Tier – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-03 | AI Business & Requirements Analyst | Initial draft extracted from ADR-0028 and accepted by Menno |
| 1.0 | 2026-08-19 | AI Business & Requirements Analyst | Final BRD approved, incorporating related stories and build status |

---

## 2. Executive Summary

**What problem are we solving?** The platform already stores credentials securely (ADR-0014) and refuses to pool or share them across connecting parties (ADR-0027), but neither decision states *who* in the organization is authorized to create a credential. As the multi-tenant model matures, this gap creates real risk: an ordinary user could create a tenant-wide credential, a Tenant-Admin could activate a personal credential on a user's behalf, or SocialEngage could end up holding a single platform-level credential that intermediates billing and access for every tenant. ADR-0028 closes the gap by scoping credential-creation authority to exactly three ownership tiers.

**Who is affected?** Platform Admins, Tenant-Admins, tenant users, the SocialEngage operations and finance functions, and future connector owners (e.g., Reddit, AI enrichment providers).

**What is the proposed solution at a glance?** No system-wide credentials are ever created for an external data source. Tenant-wide credentials are created only by a Tenant-Admin. User-bound credentials are made available by the system but created only by the user’s own activation. The external platform’s own account/asset model determines whether a given connector capability is tenant-wide (e.g., a Company Page, a multi-admin Group, an app-only grant) or user-bound (e.g., a personal profile, an `authorization_code` grant). Data visibility remains a separate concern, governed by tenant-scoped RLS.

**What business value do we expect?** A defensible authorization boundary, elimination of platform-level credential and billing concentration, direct vendor-to-tenant cost settlement, and protection of individual users from having credentials created or activated on their behalf.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Establish unambiguous creation authority for every credential | 100% of credential create/delete actions are traceable to an authorized actor; contract tests cover tenant and user tiers |
| 2 | Prevent platform-wide credential pooling and billing concentration | No platform-level credentials for external data sources; zero shared credentials across tenants |
| 3 | Enable per-user credential activation for personal accounts | User-bound credentials are only created/activated by the owning user |
| 4 | Keep harvested-data visibility independent of credential ownership | Tenant users see the same ingested posts regardless of whether a tenant-wide or user-bound credential harvested them, per RLS |

---

## 4. Scope

### 4.1 In Scope

- Defining three credential-ownership tiers: system (prohibited), tenant, and user.
- Tenant-Admin-only creation of tenant-wide credentials for external data sources (e.g., GNews API key, Azure AI Language, app-only Reddit, Facebook/LinkedIn Company Page or multi-admin Group).
- User-only self-activation of user-bound credentials (e.g., personal social profile, Reddit `authorization_code` grant for reply/messaging).
- Enforcement of creation and deletion authority in the credential lifecycle (delivered by Story 1.7 / ADR-0034).
- Role-gated connect flow in the Admin UI (Story 6.3).
- AI enrichment credentials being tenant-owned only, with cost settled directly between the tenant and the vendor.

### 4.2 Out of Scope

- System-wide credentials for any connecting party (explicitly forbidden).
- SocialEngage’s own operational infrastructure credentials (Postgres, Key Vault, Service Bus).
- The exact mechanics of Tenant-Admin authentication, role shape, and RLS (deferred to ADR-0032 and candidate ADR #2).
- The detailed user-activation UX beyond role gating.
- Verification of Reddit’s commercial-use terms, paid-tier pricing, or developer approval process.
- Social Care respond/reply capabilities (parked in `docs/future-subsystems.md`).

### 4.3 Assumptions

- A real tenant, user, and role model exists or is being built in parallel (ADR-0032, ADR-0033, ADR-0034, ADR-0051).
- Real caller identity is resolved via Entra External ID (ADR-0029 / ADR-0033).
- The external platform’s own account and grant model determines whether a capability is tier 2 or tier 3.

### 4.4 Constraints

- Existing pre-authentication credentials must remain valid as tenant-wide after migration (no destructive backfill).
- Platform Admin may not create, view, or use any tenant or user credential.
- SocialEngage must not act as a billing or contractual intermediary between a tenant and any data source.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Admin | Provision/suspend tenants; break-glass only; no tenant data access | Medium | Clear boundary that excludes credential access |
| Tenant-Admin | Manage tenant-wide connectors, invite users, offboard users | High | Authority to create/maintain tenant credentials without overreach into personal accounts |
| Tenant User | Connect personal accounts, view/watchlist posts | High | No one can create or activate a personal credential on their behalf |
| Legal / Compliance | Audit, contracts, billing, privacy | Medium | Defensible authorization trail; no intermediary liability |
| SocialEngage Operations | Platform stability and cost containment | High | No pooled credentials; no project-level billing leakage |

---

## 6. Current State (As-Is)

**Current process:**
1. Credentials are stored using envelope encryption (ADR-0014).
2. The existing `POST /v1/connectors/:platformId/connect` endpoint was built in Story 1.6 with placeholder `X-Tenant-Id` trust.
3. No ownership-tier or role concept exists in that surface; any caller presenting a tenant header can connect or disconnect that tenant’s credentials.
4. AI enrichment was originally costed as a single project-operated Azure subscription, which conflicts with the no-pooling principle.

**Pain points:**
- Ambiguity about who may create which credential, risking unauthorized or pooled credentials.
- Risk of a Tenant-Admin creating or deleting a personal credential on a user’s behalf.
- Risk of SocialEngage holding a platform-wide AI enrichment credential and becoming a billing intermediary.
- No auditable, role-scoped authority to point to for security reviews.

---

## 7. Future State (To-Be)

**New or improved process:**
1. Every credential created in `platform_credentials` carries an explicit `owner_type` (`tenant` or `user`) and a nullable `user_id`.
2. Only a `tenant_admin` can create or delete a tenant-wide credential.
3. Only the resolved user can create or delete their own user-bound credential; a Tenant-Admin may delete it only in an offboarding scenario.
4. The Admin UI connect flow shows the `tenant` option only to Tenant-Admins, and always offers the `user` option to the signed-in user.
5. AI provider credentials (Azure AI Language, Azure OpenAI) are always tenant-owned.
6. Platform Admin has no create/view/use access to credentials; break-glass is limited to forcing a Tenant-Admin’s own credential reset (ADR-0030).

**Expected capabilities:**
- Tenant-wide credential creation gated to Tenant-Admin.
- Personal credential self-activation by the individual user.
- Clear separation between who owns the credential and who can see the harvested data.
- No project-level subscription for AI enrichment; tenants settle costs directly with the vendor.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall not create any system-wide (platform-level) credential for a tenant’s or user’s relationship with an external data source | Must | No `platform_credentials` row lacks a tenant_id; no single credential is shared across tenants; no project-owned GNews/Reddit/AI key exists | Product Owner |
| BR-002 | The system shall allow only a Tenant-Admin to create a tenant-wide credential | Must | `POST .../connect` with `ownerType: 'tenant'` returns `403` for non-tenant-admins; tenant admin can create; row stored as `owner_type='tenant'`, `user_id` NULL | Product Owner |
| BR-003 | The system shall allow a user to create or activate only their own user-bound credential | Must | `POST .../connect` with `ownerType: 'user'` sets `user_id` to the caller’s own resolved id, ignores any client-supplied `user_id`, and returns `403` for an unresolved or unauthorized caller | Product Owner |
| BR-004 | The system shall allow credential deletion only by an authorized party | Must | Tenant-wide credentials can be deleted by a Tenant-Admin; user-bound credentials can be deleted by the owning user or a Tenant-Admin of the same tenant for offboarding; all other calls are rejected | Product Owner |
| BR-005 | The system shall require AI enrichment provider credentials to be tenant-owned | Must | Azure AI Language and Azure OpenAI connectors reject `ownerType: 'user'` and only permit tenant-wide activation; no project-level subscription is created or held by SocialEngage | Product Owner |
| BR-006 | The Admin UI connect flow shall expose the tenant option only to Tenant-Admins | Should | The `ownerType: 'tenant'` control is hidden when the signed-in role is not `tenant_admin`; the `ownerType: 'user'` control is always available to the signed-in user | Product Owner |
| BR-007 | The system shall keep harvested-data visibility governed by tenant, not by credential tier | Must | Posts ingested via a user-bound credential are visible to the tenant the same way posts from a tenant-wide credential are; no per-user post visibility is introduced | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Credential creation must be protected by role-based authorization | Security | Must | Every contract test verifies `403` for an unauthorized role and `201/200` for an authorized role |
| NFR-002 | Every credential creation and deletion must be traceable to a resolved identity | Audit | Should | The platform captures actor, `owner_type`, and `platform_id` in access history or an equivalent audit record |
| NFR-003 | Stored credential values must never be visible to tenant admins or other users | Privacy / Security | Must | The API never returns the stored credential; storage is encrypted and access is bound to the owning tenant or user |
| NFR-004 | Ownership-tier enforcement must be centralized in the authorization and store layer, not ad-hoc | Maintainability | Should | All checks route through the resolved-identity and role logic used across the application |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A credential is either tenant-wide (`owner_type='tenant'`) or user-bound (`owner_type='user'`); no other value is permitted. |
| BRU-002 | Tenant-wide credentials can only be created by a caller whose resolved role is `tenant_admin`. |
| BRU-003 | User-bound credentials can only be created or activated by the user to whom they are bound; any client-supplied `user_id` is ignored. |
| BRU-004 | Platform Admin may not create, view, or use any tenant or user credential; break-glass is limited to forcing a Tenant-Admin credential reset per ADR-0030. |
| BRU-005 | Whether a connector capability is tier 2 or tier 3 is determined by the external platform’s account or grant model, not by the UI’s visible account list. |
| BRU-006 | Azure AI Language and Azure OpenAI credentials are always tenant-owned; no personal variant exists. |
| BRU-007 | Credential ownership does not determine harvested-data visibility; visibility remains tenant-scoped per ADR-0004, ADR-0005, and ADR-0015. |
| BRU-008 | SocialEngage is never a billing or contractual intermediary for any external data source credential. |
| BRU-009 | Existing credentials created before this model are defaulted to `owner_type='tenant'` to preserve backward compatibility. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `platform_credentials.owner_type` | Enum distinguishing tenant-wide from user-bound | ADR-0034 / Story 1.7 | Product Owner | Operational |
| `platform_credentials.user_id` | Nullable foreign key to `users`; required when `owner_type='user'` | ADR-0034 / Story 1.7 | Product Owner | Personal data |
| `platform_credentials.credential` | Encrypted OAuth grant or API key | ADR-0014 | Product Owner | Secret |
| `connector_activations` | Tenant-wide activation state per platform | ADR-0051 / Story 1.11 | Product Owner | Operational |
| `connector_user_activations` | User-bound activation state per platform and user | ADR-0051 / Story 1.11 | Product Owner | Personal data |
| Resolved identity (`role`, `tenant_id`, `user_id`) | Caller context from Entra token | ADR-0029 / ADR-0033 | Product Owner | Personal data |
| `platform_admin_audit_log` | Record of privileged actions | ADR-0030 / ADR-0031 | Product Owner | Audit / Operational |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Unauthorized credential-creation attempts | Detect role-gating failures or abuse | Security / Operations | Real-time via logs |
| Credential count by ownership tier and platform | Track adoption and authorization posture | Product team | Monthly |
| AI provider credential activation by tenant | Allocate costs and verify no project-wide credential exists | Finance / Operations | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Users confuse tenant-wide and personal account types (e.g., Facebook Page vs. profile) | Medium | Medium | Clear UI copy and provider-specific account selection guidance | Product Owner |
| R-002 | Existing project-level AI enrichment cost plan no longer fits the tenant-owned model | High | High | Update `Cost-Management-Plan.md` with per-tenant cost model before committing budget | Product Owner / Sponsor |
| R-003 | The “Tenant-Admin” role name may change if the role model is redesigned | Low | Medium | Treat the rule as a principle; revise terminology only if the underlying principle is unchanged | Product Owner |
| R-004 | Support pressure to let Platform Admin view or reset tenant credentials | Medium | Low | Document break-glass limits and enforce them in code (ADR-0030) | Product Owner |
| R-005 | A future connector is misclassified as tier 2 or tier 3 | Medium | High | Require every connector ADR to explicitly cite the platform’s account/grant model and apply the tier test | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0027: no credential pooling | Accepted / architectural | Sponsor | Already in place |
| D-002 | ADR-0014: credential envelope encryption | Accepted / architectural | Sponsor | Already in place |
| D-003 | ADR-0029 / ADR-0033: Entra identity resolution | Accepted / architectural | Sponsor | Already in place |
| D-004 | ADR-0034 / Story 1.7: ownership-tier schema and enforcement | Accepted / buildable | Product Owner | Already in place |
| D-005 | ADR-0030: Platform Admin break-glass limits | Accepted / architectural | Sponsor | Already in place |
| D-006 | ADR-0051: connector activation/deactivation | Accepted / buildable | Product Owner | Already in place |
| D-007 | ADR-0032 / ADR-0033: tenant and user table shape | Accepted / architectural | Sponsor | Already in place |
| D-008 | Story 6.3: Admin UI connect/disconnect screen | Built | Product Owner | Already in place |

---

## 14. Acceptance Criteria

- Story 1.7 contract tests pass: `platform_credentials` schema supports `owner_type` and `user_id`; tenant-wide `POST .../connect` requires `tenant_admin`; user-bound `POST .../connect` ignores supplied `user_id` and uses the caller’s own; deletion is scoped by owner type and user.
- Story 6.3 contract tests pass: the Admin UI shows `ownerType: 'tenant'` only to `tenant_admin`; `ownerType: 'user'` is always offered; provider copy makes it unambiguous that the user is signing up directly with the data source.
- The implementation-log and relevant skills (`connector-connect-disconnect`, `connector-status-view`) cite ADR-0028 as the governing constraint.
- No `platform_credentials` row exists without a tenant_id or with a shared platform-level credential.
- Azure AI Language and Azure OpenAI connectors reject an `ownerType: 'user'` request at both the `connect` and `activate` surfaces.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Credential** | An OAuth grant or API key that authenticates access to an external data source. |
| **Ownership tier** | One of three scopes for credential creation authority: system (forbidden for external data sources), tenant (admin-created, usable across the tenant), or user (self-activated, personal to one user). |
| **Tenant-Admin** | The administrative role within a tenant that can manage tenant-wide connectors, users, and settings. |
| **User-bound credential** | A credential bound to an individual user account; only that user may create or activate it. |
| **Platform Admin** | The SocialEngage platform operator who can provision tenants and perform break-glass actions, but may not access tenant data or credentials. |
| **AI provider connector** | A connector that consumes Azure AI Language or Azure OpenAI for enrichment; always tenant-owned under this policy. |
| **External data source** | A social platform, news API, newswire, or AI enrichment provider covered by ADR-0027’s “connecting party” framing. |

---

## 16. Appendices

### Reference documents

- `docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md` — source ADR.
- `docs/adr/0027-credential-pooling.md` — precedent “no pooling or sharing” rule.
- `docs/adr/0014-credential-envelope-encryption.md` — credential storage mechanics.
- `docs/adr/0030-platform-admin-break-glass.md` — Platform Admin boundaries.
- `docs/adr/0034-connector-ownership-tier.md` — schema and enforcement (Story 1.7 source).
- `docs/adr/0051-connector-activation.md` — activation/deactivation scope.
- `docs/user-stories/epic-1-repository-and-api-foundation.md` — Story 1.7 (ownership-tier-aware connect/disconnect).
- `docs/user-stories/epic-6-tenant-admin-ui.md` — Story 6.3 (role-gated connect flow UI).
- `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` — related RBAC and workspace context.
- `docs/project docs/Business-Case-v6.0.md` — per-user credential ownership requirement.
- `docs/project docs/Project Management Plans/Cost-Management-Plan.md` — AI enrichment cost impact.

### Notes on missing materials

- No dedicated `docs/product-research/feature-designs/<feature>.md` exists for credential-creation authority; the closest related feature design is `12-multi-user-workspaces-and-rbac.md`.
- No `docs/product-research/reports/<feature>-deep-research.md` exists for this ADR.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno |  | 2026-08-19 |
| Product Owner | Menno |  | 2026-08-19 |
| Technical Lead | Menno |  | 2026-08-19 |
| Other Stakeholder |  |  |  |
