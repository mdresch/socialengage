# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0014 Envelope-Encrypted Credential Storage with OAuth-First Authentication — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0014-credential-storage-envelope-encryption-oauth-first.md, ../Business-Requirements/BRD-0014-Credential-Storage-Envelope-Encryption-OAuth-First.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0014-credential-storage-envelope-encryption-oauth-first.md and the business requirements in BRD-0014-Credential-Storage-Envelope-Encryption-OAuth-First.md into functional design for **Credential Storage Envelope Encryption OAuth First**.
**What problem are we solving?**  
SocialEngage must store tenant-owned credentials — OAuth tokens and API keys — for every social, news, and AI-provider connector. These credentials are highly sensitive: a single plaintext leak could let an attacker post, read, or act on behalf of a tenant. Before ADR-0014, the only credential storage path was a placeholder shim and no formal rule governed whether to use OAuth or API keys, leaving the system with unenforceable security and no recovery boundary.

**Who is affected?**  
Tenants and tenant admins who connect platforms; the platform operator and security/compliance reviewers who must guarantee isolation; and connector engineers who need a single, safe storage pattern.

**What is the proposed solution at a glance?**  
All credentials are encrypted at rest using envelope encryption backed by Azure Key Vault. The actual secret is encrypted by a data-encryption key, and that data-encryption key is itself encrypted by a key-encryption key (KEK) held in Key Vault. OAuth is used wherever the platform supports it; API keys are accepted only as a fallback for platforms that have no OAuth support.

**What business value do we expect?**  
A database compromise alone cannot expose tenant credentials in plaintext. OAuth gives tenants scoped, revocable, short-lived tokens. The design is fully Azure-native, avoids a bespoke key-management system, and supports the product goal of connecting to many platforms without forcing a uniform authentication model that would exclude legitimate API-key-only sources.

---

### 2.2 Scope
**In scope:**
- Encryption of all tenant connector credentials at rest: OAuth tokens and API keys.
- Envelope encryption backed by Azure Key Vault for every stored credential.
- OAuth-first authentication: OAuth is the default for every platform that supports it.
- API-key entry as the fallback for platforms that do not support OAuth.
- The REST surface for connecting and disconnecting credentials.
- Connector retrieval and use of credentials during each poll, webhook registration, or enrichment call.
- Fail-fast behavior when the Key Vault key identifier is missing or invalid.
- Tenant-scoped storage and retrieval of credentials, enforced by the existing RLS and ownership-tier rules.

**Out of scope:**
- Implementation of a custom key-management service outside Azure Key Vault.
- OAuth token refresh logic itself (governed by ADR-0010 and the connector error-handling framework).
- Credential creation-authority and ownership-tier rules (governed upstream by ADR-0028).
- Audit logging of every credential operation, beyond the contract and health signals already defined by other ADRs.
- Long-lived API-key rotation automation for platforms that do not expose a programmatic rotation API.

## 3. Context and Background
The system connects to platforms using each tenant's own credentials (§1) — OAuth tokens where supported, API keys where not (e.g., some RSS/newswire providers, per §8). These credentials are highly sensitive: a leak would let an attacker act as the tenant on the connected platform, potentially across every tenant in the system if storage isn't isolated per credential.
**What problem are we solving?**  
SocialEngage must store tenant-owned credentials — OAuth tokens and API keys — for every social, news, and AI-provider connector. These credentials are highly sensitive: a single plaintext leak could let an attacker post, read, or act on behalf of a tenant. Before ADR-0014, the only credential storage path was a placeholder shim and no formal rule governed whether to use OAuth or API keys, leaving the system with unenforceable security and no recovery boundary.

**Who is affected?**  
Tenants and tenant admins who connect platforms; the platform operator and security/compliance reviewers who must guarantee isolation; and connector engineers who need a single, safe storage pattern.

**What is the proposed solution at a glance?**  
All credentials are encrypted at rest using envelope encryption backed by Azure Key Vault. The actual secret is encrypted by a data-encryption key, and that data-encryption key is itself encrypted by a key-encryption key (KEK) held in Key Vault. OAuth is used wherever the platform supports it; API keys are accepted only as a fallback for platforms that have no OAuth support.

**What business value do we expect?**  
A database compromise alone cannot expose tenant credentials in plaintext. OAuth gives tenants scoped, revocable, short-lived tokens. The design is fully Azure-native, avoids a bespoke key-management system, and supports the product goal of connecting to many platforms without forcing a uniform authentication model that would exclude legitimate API-key-only sources.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate plaintext credential storage | No credential value appears in plaintext in the database, backups, logs, or exports for any tenant or platform |
| 2 | Prefer OAuth for every platform that supports it | All connectors with OAuth capability use OAuth; API-key mode is used only where OAuth is unavailable |
| 3 | Maintain Azure-native key management | All key-encryption keys remain in Azure Key Vault; no third-party or bespoke KMS is introduced |
| 4 | Keep ingestion resilient to Key Vault faults | Key Vault throttling or outage is classified as a retryable error and does not cause permanent connector failure |
| 5 | Enable tenant-level revocation | Revoking a Key Vault key or disconnecting a credential renders the stored secret unusable |

---

**Positive consequences (from ADR):**
**Positive**
- Envelope encryption (data encrypted with a data key, which is itself encrypted by a key-encryption key held in Key Vault) means a database compromise alone doesn't expose credentials in plaintext — the attacker would also need Key Vault access, raising the bar significantly.
- Preferring OAuth means most credentials are scoped, revocable by the tenant at the platform level, and short-lived with refresh (tying directly into the automatic-refresh-before-fail behavior in ADR-0010) — properties long-lived API keys don't have.
- Being Azure-native (Key Vault) keeps credential security aligned with the rest of the stack's Azure-native posture (§2), avoiding a bespoke KMS integration.

**Negative**
- API-key-based platforms don't get the scoping/revocability/short-lifetime benefits OAuth provides; a leaked API key is valid until the tenant manually rotates it, and the system has no automatic-refresh safety net for that credential type.
- Envelope encryption adds an operational dependency on Key Vault availability for every credential read (e.g., before each poll or webhook registration); Key Vault throttling or an outage becomes a potential ingestion-blocking failure mode that connector error handling (ADR-0010) needs to classify correctly (almost certainly retryable).

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall store OAuth tokens and API keys only in encrypted form at rest; plaintext must never be written to the database, logs, backups, or exports | Must | Credential values are not visible in stored rows, logs, backups, or exports; inspection confirms envelope-encrypted storage | Product Owner |
| BR-002 | The system shall use OAuth authentication for all platforms and providers that support it | Must | OAuth flow is initiated for every declared `authMode:'oauth'` connector; API-key entry is unavailable for those connectors | Product Owner |
| BR-003 | The system shall support API-key authentication only for platforms that do not support OAuth | Must | API-key input is offered only for connectors whose `authMode` is `apiKey` | Product Owner |
| BR-004 | The system shall encrypt every credential using envelope encryption backed by Azure Key Vault | Must | Each credential has an encrypted data-encryption key (DEK) and the DEK is encrypted by a Key Vault KEK | Technical Lead |
| BR-005 | The system shall allow an authorized tenant user to connect and disconnect a platform credential | Must | `POST /v1/connectors/:platformId/connect` stores an envelope-encrypted credential and `DELETE /v1/connectors/:platformId/disconnect` removes it | Product Owner |
| BR-006 | The system shall fail fast if the Key Vault key identifier is missing or invalid | Must | The connect route returns a clear error and refuses to store the credential when `KEY_VAULT_KEY_ID` is unset or invalid | Technical Lead |
| BR-007 | The system shall render previously stored credentials unreadable when the Key Vault key is revoked or deleted | Should | A test revokes the KEK and confirms that decryption of existing credentials fails | Technical Lead |

### 5.1 Architecture Decision
- Encrypt OAuth tokens and API keys at rest using envelope encryption backed by Azure Key Vault.
- Use OAuth wherever a platform supports it; fall back to API keys only for platforms without OAuth support.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant / Tenant Admin | Owns and connects platform credentials | High | Credentials are stored safely, OAuth is used when possible, and disconnect works |
| Platform Operator | Runs the multi-tenant service | High | A database breach cannot expose plaintext credentials across tenants |
| Security / Compliance Reviewer | Validates architecture and controls | High | Proof of envelope encryption, Azure Key Vault, and no plaintext leakage |
| Connector Engineer | Builds and maintains connectors | Medium | A single, documented pattern for storing and retrieving credentials |
| Product Owner | Prioritizes platform support | Medium | OAuth preference does not block legitimate API-key-only platforms |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.3 | epic-5-security-isolation-and-messaging.md | As tenant connecting a social platform or AI provider, I want my OAuth tokens and API keys encrypted at rest via Azure Key Vault–backed envelope encryption, ... | Credential values are never stored or logged in plaintext at any point in the write path — verified by inspecting stored rows and application logs.; Connecti... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Encrypted credential value | The OAuth token, refresh token, or API key encrypted by a DEK | Tenant-supplied credential | Credential Store | Highly sensitive |
| Encrypted data-encryption key (DEK) | Per-credential or per-tenant key, itself encrypted by the Key Vault KEK | Derived at storage time | Credential Store | Highly sensitive |
| Key Vault key identifier | Reference to the KEK used to wrap the DEK | Azure Key Vault configuration | Platform Operator | Highly sensitive |
| `authMethod` | Whether the stored credential is `oauth` or `apiKey` | Connector/platform declaration | Connector Registry | Operational |
| `refreshTokenExpiresAt` | Expiry timestamp for OAuth refresh tokens, where available | OAuth token exchange | Credential Store | Operational |
| `tenantId` / `owner_type` | Tenant and ownership-tier scoping for the credential | Tenant/User identity | Identity / RLS | Operational |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | OAuth is the default authentication mode for all newly connected platforms that support it. |
| BRU-002 | API keys are permitted only for platforms that do not support OAuth. |
| BRU-003 | Credential plaintext must never be logged, returned in API responses, or included in exports. |
| BRU-004 | A credential may not be stored unless a valid Azure Key Vault key identifier is configured. |
| BRU-005 | Credentials are stored in a tenant-scoped table and are subject to row-level security and ADR-0028 ownership-tier rules upstream of storage. |
| BRU-006 | Revoking or deleting the Key Vault KEK renders all credentials encrypted under that key unreadable. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0010 — automatic token refresh and retryable error classification | Internal | Technical Lead | Accepted |
| D-002 | ADR-0028 — credential creation authority and ownership tiers | Internal | Technical Lead | Accepted |
| D-003 | ADR-0015 — row-level security for tenant isolation | Internal | Technical Lead | Accepted |
| D-004 | Azure Key Vault provisioned and reachable | External | Platform Operator | Operational |
| D-005 | Connector framework (`ProviderConnector` / `SocialConnector` contract) | Internal | Technical Lead | Implemented |

---

- Azure Key Vault is provisioned and reachable in the target environment.
- Each connector or provider declares whether it supports OAuth or requires an API key.
- The connector error-handling framework already distinguishes retryable from non-retryable failures.
- Tenants are responsible for creating and revoking OAuth grants at the platform level.

- Encrypt OAuth tokens and API keys at rest using envelope encryption backed by Azure Key Vault.
- Use OAuth wherever a platform supports it; fall back to API keys only for platforms without OAuth support.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Credentials are encrypted at rest using a strong algorithm; the KEK never leaves Azure Key Vault | Security | Must | Security review confirms AES-256 (or equivalent) envelope encryption and Key Vault-only KEK access |
| NFR-002 | Key Vault throttling or outage is handled as a retryable failure | Reliability | Must | Connector error policy classifies Key Vault faults as retryable and retries with exponential backoff |
| NFR-003 | Disconnected or revoked credentials cannot be recovered by SocialEngage | Compliance | Should | Credential deletion removes both the encrypted value and the encrypted DEK; no shadow copies remain |
| NFR-004 | The solution uses standard Azure Key Vault client libraries; no bespoke KMS | Maintainability | Should | Code review confirms Azure SDK usage and absence of custom key-management code |

---

## 11. Error Handling and Exceptions
**Positive**
- Envelope encryption (data encrypted with a data key, which is itself encrypted by a key-encryption key held in Key Vault) means a database compromise alone doesn't expose credentials in plaintext — the attacker would also need Key Vault access, raising the bar significantly.
- Preferring OAuth means most credentials are scoped, revocable by the tenant at the platform level, and short-lived with refresh (tying directly into the automatic-refresh-before-fail behavior in ADR-0010) — properties long-lived API keys don't have.
- Being Azure-native (Key Vault) keeps credential security aligned with the rest of the stack's Azure-native posture (§2), avoiding a bespoke KMS integration.

**Negative**
- API-key-based platforms don't get the scoping/revocability/short-lifetime benefits OAuth provides; a leaked API key is valid until the tenant manually rotates it, and the system has no automatic-refresh safety net for that credential type.
- Envelope encryption adds an operational dependency on Key Vault availability for every credential read (e.g., before each poll or webhook registration); Key Vault throttling or an outage becomes a potential ingestion-blocking failure mode that connector error handling (ADR-0010) needs to classify correctly (almost certainly retryable).

## 12. Assumptions and Dependencies
- Azure Key Vault is provisioned and reachable in the target environment.
- Each connector or provider declares whether it supports OAuth or requires an API key.
- The connector error-handling framework already distinguishes retryable from non-retryable failures.
- Tenants are responsible for creating and revoking OAuth grants at the platform level.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Key Vault throttling or outage blocks credential retrieval and ingestion | Medium | High | Classify as retryable per ADR-0010; surface connector health; avoid hot caching of KEK | Technical Lead |
| R-002 | Long-lived API keys cannot be automatically revoked or refreshed | Medium | Medium | Restrict API keys to platforms without OAuth; warn tenant admins; support manual rotation | Product Owner |
| R-003 | Missing or invalid Key Vault configuration silently breaks new connections | Low | High | Fail fast at the connect route with a clear error; never fall back to placeholder key IDs | Technical Lead |
| R-004 | Key Vault key rotation leaves old credentials unreadable if not re-encrypted | Low | High | Document and test a re-encryption path; keep key version metadata with each credential | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0014-credential-storage-envelope-encryption-oauth-first.md`
- BRD: `../Business-Requirements/BRD-0014-Credential-Storage-Envelope-Encryption-OAuth-First.md`
- Feature design: `docs/product-research/feature-designs/<credential-storage>.md``
- Deep research: `docs/product-research/reports/<credential-storage>-deep-research.md``
- User stories: see extracted stories above