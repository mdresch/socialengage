# Business Requirements Document (BRD)

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Connector as Technical Intermediary Only |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno (Sponsor) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | AI Business & Requirements Analyst | Initial draft from ADR-0027 |
| 1.0 | 2026-08-19 | Menno (Sponsor) | Approved as written |

---

## 2. Executive Summary

**What problem are we solving?**  
SocialEngage connects tenants and users to external data sources (news APIs, newswires, social platforms, AI enrichment providers) through a connector architecture. Without an explicit business rule, future connectors or commercial decisions could quietly position SocialEngage as a reseller, credential pooler, or billing intermediary for those third-party relationships. That would expose the project to contractual, pricing, and liability risk it is not resourced to assume.

**Who is affected?**  
- Connecting parties (tenants today, potentially individual users once the Users model is defined).  
- Future connector authors and the AI Delivery Agent building connector CRUD flows.  
- Platform and tenant administrators who must communicate the signup relationship clearly.

**What is the proposed solution at a glance?**  
Adopt the principle that SocialEngage's connector layer is strictly a technical intermediary: it executes the OAuth handshake, validates API keys, stores encrypted credentials, and polls/normalizes data. It never signs terms, pools credentials, resells tiers, or bills on behalf of a connecting party. The connecting party maintains a direct account and credential relationship with the data source under that source's own terms.

**What business value do we expect?**  
- Bounded legal and commercial exposure for a self-funded solo project.  
- A durable, written constraint that future connector selection and UI flows must satisfy.  
- Preservation of the "own your data and access, don't recreate the black box" positioning established in the business case.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Make SocialEngage's non-intermediary role explicit and durable across every current and future connector | All new connector ADRs cite ADR-0027 / this BRD as a governing constraint |
| 2 | Prevent SocialEngage from assuming data-source contractual, pricing, or liability risk | No connector design pools credentials, resells tiers, or bills connecting parties on a source's behalf |
| 3 | Preserve direct-source relationships for connecting parties | Each connecting party signs up and holds their own credential directly with the data source |
| 4 | Support clear UI copy and tenant-facing disclosure | Connector connect-flow copy states that the relationship is directly with the provider, not through SocialEngage |

---

## 4. Scope

### 4.1 In Scope

- The project-wide principle that SocialEngage's connector architecture is a technical intermediary only.
- Application of the principle to all data sources: social platforms, newswires, general-news APIs, AI enrichment providers, and any future source.
- No pooling, no sharing, and no SocialEngage-held credentials across connecting parties.
- No contracting, negotiating, or accepting a source's terms on a connecting party's behalf.
- No billing, reselling, mark-up, or cost-fronting for any source tier, free or paid.
- Connector selection: build only sources whose published terms permit the automated, third-party API use the connector requires.
- Requirement for future connector connect-flow UI to make the direct-provider relationship unambiguous.

### 4.2 Out of Scope

- Resolving the tenant-vs-user connecting-party model (deferred to candidate ADRs #1–#4).  
- Designing the specific Admin UI copy or disclosure pattern for the connect flow (named as a follow-up for candidate ADR #6).  
- Reopening or re-verifying historical connector rejections (RTPR, NewsAPI.org, Currents API) against paid tiers.  
- Drafting a public-facing Terms of Use or customer-facing legal document.  
- Changing accepted ADR-0002, ADR-0014, ADR-0024, or ADR-0026 text; this BRD cites them as precedent.

### 4.3 Assumptions

- The existing per-tenant credential pattern (ADR-0014 / ADR-0026) remains the default until a Users model is defined.  
- A self-funded, solo-project posture means SocialEngage has no budget or organizational capacity to absorb third-party contractual risk.  
- Data-source terms are public, current, and reviewable at connector-selection time.

### 4.4 Constraints

- Connector designs must not violate a source's Terms of Service or developer agreement.  
- No source credential may be stored at a platform/SocialEngage-wide level (also reinforced by ADR-0028).  
- The project cannot commit to paid tiers, reseller arrangements, or revenue-share agreements.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Sponsor) | Project owner and decision authority | High | Clear, durable principle that protects the project from unacknowledged liability |
| Future Connector Authors | Designers of new data-source integrations | High | A written rule to evaluate against when proposing sources and auth models |
| AI Delivery Agent / Developers | Implementers of connector CRUD and connect flow | High | Guidance on permitted credential ownership and required UI disclosure |
| Tenant Administrators | Users who activate connectors | Medium | Clear understanding that they sign up and pay (if required) directly with the provider |
| Platform Providers (S-03) | External data-source vendors | Medium | Assurance that SocialEngage builds against their published API terms without reselling access |

---

## 6. Current State (As-Is)

**Current process:**  
The connector architecture (ADR-0002) defines a purely technical contract: `getAuthUrl` / `handleAuthCallback` for OAuth, `validateApiKey` for API keys, `poll` / `normalize` for data acquisition, and encrypted credential storage (ADR-0014). The GNews (ADR-0026) and Newswire (ADR-0024) connectors already require the connecting party to hold their own credential or read a public feed directly. This practice is project-wide but has only been stated per-connector.

**Pain points:**
- No explicit, durable rule exists to prevent a future connector from proposing pooled credentials or a reseller/aggregator model.
- The "no contracting party" posture is implicit and inferable only from three accepted connector ADRs.
- Future work (Reddit, paid-tier sources, AI enrichment) could introduce ambiguity about who holds the commercial relationship.

---

## 7. Future State (To-Be)

**New or improved process:**  
Every connector is selected, designed, and documented under the explicit principle that SocialEngage provides only the technical mechanism to use a relationship the connecting party already has. When a connector is built, the connector-selection review confirms that the source's published terms permit the automated use required. The connecting party independently obtains any necessary account, API key, OAuth grant, or paid tier. The future Admin UI connect-flow includes clear copy that the connecting party is creating their own account with the provider and that SocialEngage is not an intermediary in billing or pricing.

**Expected capabilities:**
- A written, accepted business/architecture rule that all connector ADRs can reference and satisfy.  
- A project-wide "no credential pooling, no reselling, no billing intermediation" guard.  
- Clear downstream constraints for the Users model and connector CRUD work.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The connector architecture shall provide only technical connection, credential-storage, and data-acquisition mechanisms | Must | ADR-0002 contract (OAuth, API-key validation, poll/normalize) is used; no commercial terms are represented | Product Owner |
| BR-002 | Each connecting party shall hold their own direct credential with each data source | Must | Credentials are stored per-tenant (today) or per-user (when defined); no platform-wide credential exists | Product Owner |
| BR-003 | SocialEngage shall not sign up for, negotiate, or accept a data source's terms on a connecting party's behalf | Must | No connector design includes SocialEngage as the contractual party; TOS acceptance is performed by the connecting party | Product Owner |
| BR-004 | SocialEngage shall not invoice, resell, mark up, or absorb a data source's paid-tier cost | Must | No billing or pricing pass-through appears in connector design, admin UI, or business model | Product Owner |
| BR-005 | A connector shall be built only when the source's published terms permit the automated, third-party API use the connector requires | Must | Connector selection record includes a terms-permit-use check; paid-only sources are viable if the connecting party pays the source directly | Product Owner |
| BR-006 | The connector connect-flow UI shall disclose that the connecting party is signing up directly with the provider | Should | UI copy states the provider relationship is direct and that SocialEngage is not an intermediary in billing or pricing | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Connector-selection decisions are documented and reviewable | Compliance | Must | Each connector ADR references ADR-0027 / this BRD and records the terms-permit-use rationale |
| NFR-002 | The no-intermediary principle remains stable across tenant and user model changes | Maintainability | Must | Future Authentication/Users ADRs explicitly satisfy this constraint |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | SocialEngage's connector architecture is a technical intermediary only and never becomes a party to, reseller of, or intermediary in a data-source relationship. |
| BRU-002 | One connecting party's credential may not be pooled, aggregated, or shared with another connecting party. |
| BRU-003 | SocialEngage does not assume liability for a data source's terms, pricing, rate limits, or a connecting party's violation of those terms. |
| BRU-004 | A connector may only be built for a data source whose published terms permit the automated, third-party API use the connector requires. |
| BRU-005 | If a source requires a paid tier, the connecting party must obtain and pay for that tier directly with the source; SocialEngage does not intermediate billing or pricing. |
| BRU-006 | Future connector connect-flow UI must make it unambiguous that the connecting party is creating their own account/credential directly with the provider. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Provider credential (OAuth token, API key) | Per-tenant or per-user encrypted credential held by the connecting party, not SocialEngage | Data source and connecting party | Connecting party | High |
| Connector selection rationale | Terms-permit-use review recorded at connector-selection time | Connector ADR / BRD-0027 | Product Owner | Internal |
| Connect-flow disclosure copy | UI text stating direct provider relationship and no billing intermediation | Product / UX design | Product Owner | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Connector ADR compliance checklist | Track whether each new connector ADR cites and satisfies the no-intermediary principle | Product Owner / Architect | Per connector proposal |
| Open disclosure-copy backlog | Track the future connect-flow UI requirement | Product Owner | Per release planning |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Future connector author proposes pooled or platform-held credentials to reduce onboarding friction | Medium | High | Enforce this BRD/ADR-0027 as a mandatory review gate and require explicit supersession if ever changed | Product Owner |
| R-002 | Paid-tier sources create pressure to bill or resell through SocialEngage | Low | High | Reiterate BRU-005 in connector selection and business-model discussions; reject any design with pass-through pricing | Product Owner |
| R-003 | Connecting parties misunderstand SocialEngage's role and expect support or liability for source terms | Medium | Medium | Implement connect-flow disclosure and support documentation that directs source-TOS questions to the provider | Product Owner |
| R-004 | Users model reopens the credential-granularity question | Medium | Medium | When ADR-0014 is extended, explicitly preserve the no-pooling rule at the new per-user granularity | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0002 connector contract (technical only) | Internal / Precedent | Product Owner | Accepted |
| D-002 | ADR-0014 encrypted credential storage | Internal / Precedent | Technical Lead | Accepted |
| D-003 | ADR-0024 and ADR-0026 per-connector practice | Internal / Precedent | Product Owner | Accepted |
| D-004 | Candidate ADRs #1–#4 (Authentication / Users model) | Internal / Future | Technical Lead | To be drafted; must satisfy this BRD as a constraint |
| D-005 | Candidate ADR #6 (connector connect/disconnect CRUD + UI copy) | Internal / Future | AI Delivery Agent | Build connector connect flow with ADR-0027 disclosure requirement |

---

## 14. Acceptance Criteria

- [ ] A new connector ADR cannot be approved unless it demonstrates that SocialEngage is not a party to, reseller of, or intermediary in the data-source relationship.
- [ ] No existing or proposed connector design pools, shares, or reuses a connecting party's credential across other connecting parties.
- [ ] No connector design includes billing, reselling, mark-up, or cost-fronting for a source's free or paid tier.
- [ ] Connector-selection documentation records that the source's published terms permit the automated, third-party API use the connector requires.
- [ ] The future connector connect-flow UI includes a plain disclosure that the connecting party is signing up with the provider directly, not through SocialEngage, and that SocialEngage is not an intermediary in billing or pricing.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Connecting party | The entity that obtains and holds a credential with a data source. Today, a tenant; potentially an individual user once the Users model is defined. |
| Connector | A technical integration component that authenticates, polls, and normalizes data from a data source, per ADR-0002. |
| Credential (OAuth token / API key) | The connecting party's own encrypted secret stored by SocialEngage on their behalf, not a SocialEngage-held or shared credential. |
| Data source | Any external platform, API, feed, or service from which SocialEngage ingests data, including social platforms, newswires, news APIs, and AI enrichment providers. |
| Technical intermediary | A role that provides the mechanism to connect to a source without becoming a party to the source's commercial or legal relationship. |

---

## 16. Appendices

### Reference documents

- `docs/adr/0027-connector-is-technical-intermediary-not-contracting-party.md` — source ADR (Accepted 2026-08-01).
- `docs/adr/0002-provider-connector-architecture.md` — connector contract as a purely technical mechanism.
- `docs/adr/0014-credential-storage-encryption.md` — encrypted, per-credential storage model.
- `docs/adr/0024-newswire-connector-direct-wire-rss-issuer-as-author.md` — direct-feed, no-aggregator precedent.
- `docs/adr/0026-rss-news-connector-gnews-api-publication-as-author.md` — per-tenant credential precedent.
- `docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md` — reinforces no system-wide credentials.
- `docs/project docs/Stakeholder-Register.md` — S-03 platform-provider posture (Keep Satisfied / compliance-by-construction).
- `docs/project docs/Business-Case-v6.0.md` §4/§9 — no revenue model or set budget ceiling.
- `docs/project docs/Project-Charter.md` — Must comply with each platform's Terms of Service; no scraping or unauthorized access.

### Related user stories

**No user story accompanies ADR-0027.** The ADR is a constraint already satisfied by the existing GNews (ADR-0026) and Newswire (ADR-0024) connectors; it introduces no new interface, stored field, or endpoint. This is a documented, named exception to the "one user story per ADR" convention. The downstream UI-disclosure requirement is captured as a constraint for future stories, notably the connector connect-flow work in Epic 6.

### Missing source material

- No dedicated `docs/product-research/feature-designs/<feature>.md` was identified for ADR-0027; the principle is drawn directly from the ADR and its precedent ADRs.
- No `docs/product-research/reports/*-deep-research.md` was found for this topic.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | — | 2026-08-19 |
| Product Owner | Menno | — | 2026-08-19 |
| Technical Lead | Menno | — | 2026-08-19 |
| Other Stakeholder | — | — | — |
