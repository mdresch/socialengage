# SocialEngage — Envelope-Encrypted Credential Storage with OAuth-First Authentication

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage — Business Requirements Document for Envelope-Encrypted Credential Storage with OAuth-First Authentication |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | Menno |
| Approver(s) | Menno |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | Menno | Initial draft derived from ADR-0014, the design spec, and related user stories |

---

## 2. Executive Summary

**What problem are we solving?**  
SocialEngage must store tenant-owned credentials — OAuth tokens and API keys — for every social, news, and AI-provider connector. These credentials are highly sensitive: a single plaintext leak could let an attacker post, read, or act on behalf of a tenant. Before ADR-0014, the only credential storage path was a placeholder shim and no formal rule governed whether to use OAuth or API keys, leaving the system with unenforceable security and no recovery boundary.

**Who is affected?**  
Tenants and tenant admins who connect platforms; the platform operator and security/compliance reviewers who must guarantee isolation; and connector engineers who need a single, safe storage pattern.

**What is the proposed solution at a glance?**  
All credentials are encrypted at rest using envelope encryption backed by Azure Key Vault. The actual secret is encrypted by a data-encryption key, and that data-encryption key is itself encrypted by a key-encryption key (KEK) held in Key Vault. OAuth is used wherever the platform supports it; API keys are accepted only as a fallback for platforms that have no OAuth support.

**What business value do we expect?**  
A database compromise alone cannot expose tenant credentials in plaintext. OAuth gives tenants scoped, revocable, short-lived tokens. The design is fully Azure-native, avoids a bespoke key-management system, and supports the product goal of connecting to many platforms without forcing a uniform authentication model that would exclude legitimate API-key-only sources.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate plaintext credential storage | No credential value appears in plaintext in the database, backups, logs, or exports for any tenant or platform |
| 2 | Prefer OAuth for every platform that supports it | All connectors with OAuth capability use OAuth; API-key mode is used only where OAuth is unavailable |
| 3 | Maintain Azure-native key management | All key-encryption keys remain in Azure Key Vault; no third-party or bespoke KMS is introduced |
| 4 | Keep ingestion resilient to Key Vault faults | Key Vault throttling or outage is classified as a retryable error and does not cause permanent connector failure |
| 5 | Enable tenant-level revocation | Revoking a Key Vault key or disconnecting a credential renders the stored secret unusable |

---

## 4. Scope

### 4.1 In Scope

- Encryption of all tenant connector credentials at rest: OAuth tokens and API keys.
- Envelope encryption backed by Azure Key Vault for every stored credential.
- OAuth-first authentication: OAuth is the default for every platform that supports it.
- API-key entry as the fallback for platforms that do not support OAuth.
- The REST surface for connecting and disconnecting credentials.
- Connector retrieval and use of credentials during each poll, webhook registration, or enrichment call.
- Fail-fast behavior when the Key Vault key identifier is missing or invalid.
- Tenant-scoped storage and retrieval of credentials, enforced by the existing RLS and ownership-tier rules.

### 4.2 Out of Scope

- Implementation of a custom key-management service outside Azure Key Vault.
- OAuth token refresh logic itself (governed by ADR-0010 and the connector error-handling framework).
- Credential creation-authority and ownership-tier rules (governed upstream by ADR-0028).
- Audit logging of every credential operation, beyond the contract and health signals already defined by other ADRs.
- Long-lived API-key rotation automation for platforms that do not expose a programmatic rotation API.

### 4.3 Assumptions

- Azure Key Vault is provisioned and reachable in the target environment.
- Each connector or provider declares whether it supports OAuth or requires an API key.
- The connector error-handling framework already distinguishes retryable from non-retryable failures.
- Tenants are responsible for creating and revoking OAuth grants at the platform level.

### 4.4 Constraints

- The solution must remain Azure-native.
- API-key-only platforms cannot be excluded if the product continues to support RSS, newswire, or similar sources.
- The encryption design must not prevent the per-tenant, per-provider rate-limit and isolation model from functioning.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant / Tenant Admin | Owns and connects platform credentials | High | Credentials are stored safely, OAuth is used when possible, and disconnect works |
| Platform Operator | Runs the multi-tenant service | High | A database breach cannot expose plaintext credentials across tenants |
| Security / Compliance Reviewer | Validates architecture and controls | High | Proof of envelope encryption, Azure Key Vault, and no plaintext leakage |
| Connector Engineer | Builds and maintains connectors | Medium | A single, documented pattern for storing and retrieving credentials |
| Product Owner | Prioritizes platform support | Medium | OAuth preference does not block legitimate API-key-only platforms |

---

## 6. Current State (As-Is)

**Current process:**  
The system needs to store tenant credentials so connectors can poll or receive webhooks on a tenant's behalf. Before this ADR, the credential storage path contained a placeholder key identifier string (`placeholder-key-id`) and no enforced envelope-encryption step. Any real attempt to connect a platform could silently fail or store a credential that could not be decrypted correctly. There was no explicit rule preferring OAuth over API keys, and no single architectural decision describing how credentials should be protected at rest.

**Pain points:**
- A database compromise could expose tenant credentials in plaintext.
- Long-lived API keys, where used, cannot be automatically revoked or refreshed by the platform.
- OAuth's benefits (scoped, short-lived, tenant-revocable tokens) were not mandated.
- Key Vault was referenced in the architecture but not mechanically enforced at the connect boundary.

---

## 7. Future State (To-Be)

**New or improved process:**  
When a tenant connects a platform, the system determines whether the platform supports OAuth. If it does, the tenant is guided through the OAuth flow; if it does not, an API key is collected. In either case, the resulting credential is encrypted with a data-encryption key, that data-encryption key is encrypted by a KEK stored in Azure Key Vault, and the encrypted bundle is persisted. Before every poll, webhook registration, or enrichment call, the system retrieves and decrypts the credential through Key Vault. If the Key Vault key is missing, invalid, or revoked, the connect or retrieval operation fails closed with a clear, actionable error.

**Expected capabilities:**
- All credentials are stored as opaque, envelope-encrypted envelopes in the database.
- OAuth is the default authentication path for every OAuth-capable platform.
- API-key mode is available only for platforms without OAuth support.
- Revocation of the Key Vault KEK renders all dependent credentials unreadable.
- Connector error handling treats Key Vault unavailability as a retryable failure.
- The connect route refuses to store a credential unless a real, valid Key Vault key is configured.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall store OAuth tokens and API keys only in encrypted form at rest; plaintext must never be written to the database, logs, backups, or exports | Must | Credential values are not visible in stored rows, logs, backups, or exports; inspection confirms envelope-encrypted storage | Product Owner |
| BR-002 | The system shall use OAuth authentication for all platforms and providers that support it | Must | OAuth flow is initiated for every declared `authMode:'oauth'` connector; API-key entry is unavailable for those connectors | Product Owner |
| BR-003 | The system shall support API-key authentication only for platforms that do not support OAuth | Must | API-key input is offered only for connectors whose `authMode` is `apiKey` | Product Owner |
| BR-004 | The system shall encrypt every credential using envelope encryption backed by Azure Key Vault | Must | Each credential has an encrypted data-encryption key (DEK) and the DEK is encrypted by a Key Vault KEK | Technical Lead |
| BR-005 | The system shall allow an authorized tenant user to connect and disconnect a platform credential | Must | `POST /v1/connectors/:platformId/connect` stores an envelope-encrypted credential and `DELETE /v1/connectors/:platformId/disconnect` removes it | Product Owner |
| BR-006 | The system shall fail fast if the Key Vault key identifier is missing or invalid | Must | The connect route returns a clear error and refuses to store the credential when `KEY_VAULT_KEY_ID` is unset or invalid | Technical Lead |
| BR-007 | The system shall render previously stored credentials unreadable when the Key Vault key is revoked or deleted | Should | A test revokes the KEK and confirms that decryption of existing credentials fails | Technical Lead |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Credentials are encrypted at rest using a strong algorithm; the KEK never leaves Azure Key Vault | Security | Must | Security review confirms AES-256 (or equivalent) envelope encryption and Key Vault-only KEK access |
| NFR-002 | Key Vault throttling or outage is handled as a retryable failure | Reliability | Must | Connector error policy classifies Key Vault faults as retryable and retries with exponential backoff |
| NFR-003 | Disconnected or revoked credentials cannot be recovered by SocialEngage | Compliance | Should | Credential deletion removes both the encrypted value and the encrypted DEK; no shadow copies remain |
| NFR-004 | The solution uses standard Azure Key Vault client libraries; no bespoke KMS | Maintainability | Should | Code review confirms Azure SDK usage and absence of custom key-management code |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | OAuth is the default authentication mode for all newly connected platforms that support it. |
| BRU-002 | API keys are permitted only for platforms that do not support OAuth. |
| BRU-003 | Credential plaintext must never be logged, returned in API responses, or included in exports. |
| BRU-004 | A credential may not be stored unless a valid Azure Key Vault key identifier is configured. |
| BRU-005 | Credentials are stored in a tenant-scoped table and are subject to row-level security and ADR-0028 ownership-tier rules upstream of storage. |
| BRU-006 | Revoking or deleting the Key Vault KEK renders all credentials encrypted under that key unreadable. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Encrypted credential value | The OAuth token, refresh token, or API key encrypted by a DEK | Tenant-supplied credential | Credential Store | Highly sensitive |
| Encrypted data-encryption key (DEK) | Per-credential or per-tenant key, itself encrypted by the Key Vault KEK | Derived at storage time | Credential Store | Highly sensitive |
| Key Vault key identifier | Reference to the KEK used to wrap the DEK | Azure Key Vault configuration | Platform Operator | Highly sensitive |
| `authMethod` | Whether the stored credential is `oauth` or `apiKey` | Connector/platform declaration | Connector Registry | Operational |
| `refreshTokenExpiresAt` | Expiry timestamp for OAuth refresh tokens, where available | OAuth token exchange | Credential Store | Operational |
| `tenantId` / `owner_type` | Tenant and ownership-tier scoping for the credential | Tenant/User identity | Identity / RLS | Operational |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Credential connect/disconnect success and failure counts | Track storage health and catch Key Vault misconfiguration | Platform Operator | Daily |
| OAuth vs. API-key distribution by platform | Verify OAuth-first policy and identify API-key-only usage | Product Owner | Weekly |
| Key Vault throttling / retry events | Detect availability issues before they block ingestion | Platform Operator | Real-time / weekly |
| Credential status summary (active, expiring, revoked) | Support tenant admin UI and connector health views | Tenant Admin | On demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Key Vault throttling or outage blocks credential retrieval and ingestion | Medium | High | Classify as retryable per ADR-0010; surface connector health; avoid hot caching of KEK | Technical Lead |
| R-002 | Long-lived API keys cannot be automatically revoked or refreshed | Medium | Medium | Restrict API keys to platforms without OAuth; warn tenant admins; support manual rotation | Product Owner |
| R-003 | Missing or invalid Key Vault configuration silently breaks new connections | Low | High | Fail fast at the connect route with a clear error; never fall back to placeholder key IDs | Technical Lead |
| R-004 | Key Vault key rotation leaves old credentials unreadable if not re-encrypted | Low | High | Document and test a re-encryption path; keep key version metadata with each credential | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0010 — automatic token refresh and retryable error classification | Internal | Technical Lead | Accepted |
| D-002 | ADR-0028 — credential creation authority and ownership tiers | Internal | Technical Lead | Accepted |
| D-003 | ADR-0015 — row-level security for tenant isolation | Internal | Technical Lead | Accepted |
| D-004 | Azure Key Vault provisioned and reachable | External | Platform Operator | Operational |
| D-005 | Connector framework (`ProviderConnector` / `SocialConnector` contract) | Internal | Technical Lead | Implemented |

---

## 14. Acceptance Criteria

- Credential values are never stored or logged in plaintext; inspection of stored rows and application logs confirms this.
- OAuth is used for every connector that declares OAuth support; API-key entry is only offered for `apiKey` connectors.
- Revoking the Key Vault KEK renders previously stored credentials unreadable.
- `POST /v1/connectors/:platformId/connect` stores the credential using envelope encryption and returns `201` with the credential id, platformId, and authMethod.
- `DELETE /v1/connectors/:platformId/disconnect` removes the stored credential for the calling tenant and platform.
- The connect route returns a clear, actionable error and refuses storage when the Key Vault key is not genuinely configured.
- Connector retrieval and use decrypts the credential through Azure Key Vault before each poll, webhook registration, or enrichment call.
- Exports and workspace archive payloads exclude credential secrets, OAuth tokens, refresh tokens, and Key Vault envelopes.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Envelope encryption | A pattern in which data is encrypted with a data-encryption key (DEK), and the DEK is itself encrypted by a key-encryption key (KEK). |
| Key-encryption key (KEK) | The master key held in Azure Key Vault; used to wrap (encrypt) the data-encryption keys. |
| Data-encryption key (DEK) | A key used to encrypt the actual credential value; the DEK is stored only in its encrypted form. |
| OAuth 2.0 | A token-based delegated authorization protocol that supports short-lived access tokens and refresh tokens. |
| API key | A long-lived shared secret used for authentication by platforms that do not support OAuth. |
| `authMode` | A connector-level declaration of whether the platform uses `oauth` or `apiKey` authentication. |

---

## 16. Appendices

### Appendix A — Source ADR
- `docs/adr/0014-credential-storage-envelope-encryption-oauth-first.md`

### Appendix B — Design Specification
- `docs/project docs/2026-07-28-social-listening-ingestion-design.md` — §8 "Security & Multi-Tenancy — Credential storage"

### Appendix C — Related User Stories

| Story | Epic | Title | Relevance |
|---|---|---|---|
| Story 1.6 | Epic 1 — Repository and API Foundation | Connector connect/disconnect REST surface | First REST surface for envelope-encrypted credential storage |
| Story 5.3 | Epic 5 — Security, Isolation & Messaging | Envelope-encrypted credential storage with OAuth-first auth | Direct implementation story for ADR-0014 |
| Story 2.7 | Epic 2 — Ingestion Connectors and Rate Limits | RSS/News connector: GNews API, publication-as-Author | Uses ADR-0014 for a per-tenant API-key connector |
| Story 2.8 | Epic 2 — Ingestion Connectors and Rate Limits | Concrete AI enrichment provider connector: Azure AI Language | Uses ADR-0014 for a tenant-owned AI credential |
| Story 2.25 | Epic 2 — Ingestion Connectors and Rate Limits | LinkedIn Connector: Confidential Client OAuth, Token Lifecycle with Persisted Expiry | Persists OAuth tokens through ADR-0014 envelope encryption |
| Story 6.23 | Epic 6 — Tenant Admin UI | Facebook OAuth connect flow | UI for connecting an OAuth credential that is stored under ADR-0014 |

### Appendix D — Research / Feature-Design Notes

No dedicated `docs/product-research/feature-designs/<credential-storage>.md` or `docs/product-research/reports/<credential-storage>-deep-research.md` file was found for this ADR. The relevant product context is drawn from the design spec §8 and the ADR itself.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Other Stakeholder | | | |
