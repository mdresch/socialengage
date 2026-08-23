# Business Requirements Document (BRD)

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0027-connector-is-technical-intermediary-not-contracting-party.md, ../Business-Requirements/BRD-0027-Connector-Is-Technical-Intermediary-Not-Contracting-Party.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0027-connector-is-technical-intermediary-not-contracting-party.md and the business requirements in BRD-0027-Connector-Is-Technical-Intermediary-Not-Contracting-Party.md into functional design for **Connector Is Technical Intermediary Not Contracting Party**.
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

### 2.2 Scope
**In scope:**
- The project-wide principle that SocialEngage's connector architecture is a technical intermediary only.
- Application of the principle to all data sources: social platforms, newswires, general-news APIs, AI enrichment providers, and any future source.
- No pooling, no sharing, and no SocialEngage-held credentials across connecting parties.
- No contracting, negotiating, or accepting a source's terms on a connecting party's behalf.
- No billing, reselling, mark-up, or cost-fronting for any source tier, free or paid.
- Connector selection: build only sources whose published terms permit the automated, third-party API use the connector requires.
- Requirement for future connector connect-flow UI to make the direct-provider relationship unambiguous.

**Out of scope:**
- Resolving the tenant-vs-user connecting-party model (deferred to candidate ADRs #1–#4).  
- Designing the specific Admin UI copy or disclosure pattern for the connect flow (named as a follow-up for candidate ADR #6).  
- Reopening or re-verifying historical connector rejections (RTPR, NewsAPI.org, Currents API) against paid tiers.  
- Drafting a public-facing Terms of Use or customer-facing legal document.  
- Changing accepted ADR-0002, ADR-0014, ADR-0024, or ADR-0026 text; this BRD cites them as precedent.

## 3. Context and Background
`docs/adr/README.md`'s 2026-07-30 governance note lists seven candidate future ADRs, in dependency order, for the still-undrafted multi-tenant Admin/Tenant/User model, starting with "(1) authentication mechanism — blocks everything else." **This ADR is deliberately not that.** It does not decide whether the connecting party is a tenant or an individual user, does not decide the `tenants`/`users` table shape, and does not decide authentication. Those stay exactly as open as the governance note left them. What this ADR decides is narrower and already answerable now, independent of that sequencing: regardless of who "the connecting party" turns out to be once the Users model exists, SocialEngage's own role relative to a data source is fixed — technical intermediary only, never a contracting party. That makes this a *constraint* the future Authentication/Users ADRs (candidate ADRs #1–#4) must satisfy once drafted, not a decision that depends on them being resolved first.

The practice this ADR formalizes is not new — it is already present, connector-by-connector, in this project's own Accepted ADRs, just never stated as a project-wide rule:

- **ADR-0002** (`ProviderConnector`, sourced from Design Spec §3.1) defines the connector contract as a purely technical connection mechanism: `getAuthUrl`/`handleAuthCallback` for the OAuth handshake, `validateApiKey` for API-key validation, `poll`/`normalize` for data acquisition. Nothing in that contract represents, negotiates, or holds a commercial relationship with the source on anyone's behalf — it only executes one the connecting party already has.
- **ADR-0014** (credential storage) is explicit that OAuth tokens and API keys are stored, encrypted, per credential — "OAuth used wherever a platform supports it; API keys are the fallback" is a technical storage decision, not a contractual one. The credential being stored is the connecting party's own, not SocialEngage's.
- **ADR-0024** (Newswire connector) targets GlobeNewswire's and PR Newswire's public feeds "directly... no aggregator, no API key, no account" — SocialEngage inserts no commercial layer between the wire service and the tenant reading its feed.
- **ADR-0026** (RSS/News connector, GNews API) states this most explicitly of any ADR to date: *"Per-tenant credential, not a shared pool: each tenant registers their own free GNews API key... stored per ADR-0014's existing envelope-encrypted credential model. The 100-requests/day ceiling is therefore per-tenant, not a project-wide shared quota across every tenant this project ever onboards."* ADR-0026 also names GNews's free-tier non-commercial-use restriction as "a real, accepted constraint... the same 'compliance-by-construction... monitor for policy or pricing changes before they cause a failure' discipline `Stakeholder-Register.md` §4 already applies to every other platform provider (S-03)."

Three connectors' worth of Decision text already assumes this principle. None of them *state* it as a principle — each states it as an implementation default local to that one connector. That gap matters for a concrete reason: nothing currently on record would stop a future connector (or a future ADR resolving the Users-model questions) from proposing a pooled, SocialEngage-held credential "to reduce onboarding friction" without first having to argue against an explicit, written rule — because no such rule exists yet in writing, only three instances of a pattern.

`Stakeholder-Register.md` S-03 already frames every social platform provider as External, High Power ("can revoke access or reprice unilaterally"), Low Interest ("indifferent to this project specifically"), engaged via **Keep Satisfied — compliance-by-construction**: *"build every connector strictly against currently published API terms, monitor for policy or pricing changes before they cause a failure rather than after."* This ADR is the direct architectural consequence of that stakeholder posture: SocialEngage cannot credibly claim to build "strictly against currently published API terms" while also inserting itself as an unacknowledged party to those terms via a pooled credential or a resold access tier.

`Business-Case-v6.0.md` does not itself contain an explicit "we are not a reseller/intermediary" statement — checked directly against §4 (Financial Architecture), §9 (Strategic Recommendation), and the rest of the document; no such language exists there today. What §4 does establish, and what this ADR is consistent with rather than duplicates, is that this project has **no revenue model, no budget ceiling, and no capacity to absorb a third party's contractual or financial risk** ("no formal budget ceiling has been set at this stage," §4/§9) — a self-funded solo project has no basis to become a contracting intermediary for anyone else's API relationship even if it wanted to. This ADR is not sourced from the Business Case; it is compatible with it.
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

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Make SocialEngage's non-intermediary role explicit and durable across every current and future connector | All new connector ADRs cite ADR-0027 / this BRD as a governing constraint |
| 2 | Prevent SocialEngage from assuming data-source contractual, pricing, or liability risk | No connector design pools credentials, resells tiers, or bills connecting parties on a source's behalf |
| 3 | Preserve direct-source relationships for connecting parties | Each connecting party signs up and holds their own credential directly with the data source |
| 4 | Support clear UI copy and tenant-facing disclosure | Connector connect-flow copy states that the relationship is directly with the provider, not through SocialEngage |

---

**Positive consequences (from ADR):**
**Positive**
- Makes explicit and durable something two connectors (ADR-0024, ADR-0026) already do in practice but never stated as project policy — closes the gap before a future connector, or a future ADR resolving the Users-model questions, has occasion to depart from it without first having to argue against a written rule.
- Gives whoever eventually drafts candidate ADR #4 (`users` table shape) or candidate ADR #6 (connector connect/disconnect CRUD) a settled answer to "does SocialEngage ever hold or broker a data-source relationship on a user's behalf" before they have to improvise one under schedule pressure.
- Keeps SocialEngage's own legal/commercial exposure bounded to what ADR-0014's technical credential-storage model already covers — it never signs up for, resells, or subsidizes access to a third-party API on any connecting party's behalf — consistent with a self-funded solo project with no set budget ceiling (`Business-Case-v6.0.md` §4/§9) having no capacity to absorb a third party's contractual risk.
- Names a real, concrete follow-up rather than leaving it implicit: the eventual Admin UI's connector connect-flow (candidate ADR #6; `docs/open-items-and-deferred-work.md` §A lists `POST /connectors/:platformId/connect` as "also build, not storied," Phase 1) needs its own copy/UX design that makes it unambiguous to the connecting party that they are signing up with the data source directly, not through SocialEngage. **This is named here as a requirement for whoever builds that flow — the AI Delivery Agent or Menno — not designed or implemented by this ADR.**

**Negative**
- **Paid-only sources are viable candidates — the real constraint is narrower than this bullet previously stated.** A data source requiring a paid tier does not disqualify it from candidacy (see the corrected "Source eligibility" bullet above): the connecting party independently obtains and pays for whatever tier the connector needs, directly with the source, under the source's own terms and billing relationship. The actual, durable constraint is that SocialEngage itself never becomes an intermediary in that billing or pricing relationship — no invoicing, reselling, marking up, or absorbing a source's cost on the connecting party's behalf. **This reverses this ADR's own immediately-prior wording**, which read a paid-only source as excluded from candidacy entirely — see the Amendment Log for the full correction and why the free-tier requirement didn't survive. This correction does not reopen or re-verify whether any specific previously-rejected candidate (RTPR, NewsAPI.org, Currents API) would now be viable: those ADRs' own historical rejections stand as their own record (ADR-0024 Accepted; ADR-0026 under separate review), and whether their *paid* tiers would satisfy the terms-permit-the-integration requirement was never checked, since it wasn't the deciding factor under the rule in force at the time.
- Places real setup burden on the connecting party (independently signing up with GNews, Reddit, etc.) that a reseller/aggregator model would remove. This is a deliberate trade-off consistent with this project's own "own your data and access, don't recreate the black box" thesis (`Business-Case-v6.0.md` §1's root-cause analysis of the MSE "black box" criticism), but it is a genuine cost to the connecting party's onboarding experience, not a free simplification — worth naming plainly rather than treating as costless.
- Once the Users model is actually drafted (candidate ADRs #1–#4), this principle will need to be checked against whatever entity shape it lands on. If an individual user, not the tenant, ends up being the connecting party for some platforms, ADR-0014's current credential model (built around per-tenant storage) may need an explicit per-user extension to keep satisfying this ADR's "no pooling" requirement at the right granularity — flagged here as a future consideration for that ADR, not resolved by this one.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The connector architecture shall provide only technical connection, credential-storage, and data-acquisition mechanisms | Must | ADR-0002 contract (OAuth, API-key validation, poll/normalize) is used; no commercial terms are represented | Product Owner |
| BR-002 | Each connecting party shall hold their own direct credential with each data source | Must | Credentials are stored per-tenant (today) or per-user (when defined); no platform-wide credential exists | Product Owner |
| BR-003 | SocialEngage shall not sign up for, negotiate, or accept a data source's terms on a connecting party's behalf | Must | No connector design includes SocialEngage as the contractual party; TOS acceptance is performed by the connecting party | Product Owner |
| BR-004 | SocialEngage shall not invoice, resell, mark up, or absorb a data source's paid-tier cost | Must | No billing or pricing pass-through appears in connector design, admin UI, or business model | Product Owner |
| BR-005 | A connector shall be built only when the source's published terms permit the automated, third-party API use the connector requires | Must | Connector selection record includes a terms-permit-use check; paid-only sources are viable if the connecting party pays the source directly | Product Owner |
| BR-006 | The connector connect-flow UI shall disclose that the connecting party is signing up directly with the provider | Should | UI copy states the provider relationship is direct and that SocialEngage is not an intermediary in billing or pricing | Product Owner |

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

SocialEngage's connector architecture (ADR-0002) provides only the **technical connection mechanism** to a data source — OAuth flow support (`getAuthUrl`/`handleAuthCallback`), API-key validation (`validateApiKey`), encrypted credential storage (ADR-0014), and polling/normalization (`poll`/`normalize`). It never becomes a party to, reseller of, or intermediary in the actual commercial or legal relationship between a data source (a social platform, an AI enrichment provider, a newswire, a general-news API — `Stakeholder-Register.md` S-03/S-05) and whoever connects to it.

Whoever "the connecting party" is — today, a tenant, per the existing per-tenant credential pattern in ADR-0014/0024/0026; potentially, once the still-undrafted Users model exists (`docs/adr/README.md`'s 2026-07-30 governance note, candidate ADRs #1–#4), an individual user within a tenant — must independently sign up for, and hold, their own direct account or credential with the data source, under that source's own terms. Concretely:

- **No pooling or sharing.** SocialEngage never pools, aggregates, or shares one connecting party's credential across others. This is already true in practice for GNews (ADR-0026's "per-tenant credential, not a shared pool"); this ADR extends the same rule as a general requirement for every current and future connector, not a GNews-specific default.
- **No contracting on anyone's behalf.** SocialEngage is not itself a party to any data source's terms of service, developer agreement, or paid tier, and never signs up for, negotiates, or accepts a data source's terms on a connecting party's behalf. The connecting party's own acceptance of a source's terms — clicking through GNews's ToS, authorizing an OAuth grant on Reddit — is theirs, not SocialEngage's.
- **No assumed liability.** SocialEngage does not assume liability for a data source's own terms, pricing changes, rate-limit policy, or a connecting party's violation of that source's terms. Each connecting party is bound directly by, and responsible for compliance with, that source's own published terms — consistent with `Project-Charter.md`'s existing constraint ("Must comply with each platform's Terms of Service; no scraping or unauthorized access methods") and `Stakeholder-Register.md` S-03's compliance-by-construction posture, both of which already place the compliance burden on the connector's construction, not on SocialEngage absorbing a source's contractual risk.
- **Source eligibility, decided at connector-selection time — independent of the tenant-vs-user sequencing above.** SocialEngage will only build a connector for a data source when its own published terms actually permit the automated, third-party API use a connector requires — a connector is not built if operating it as designed would violate the source's own terms, at any tier. **A source requiring a paid tier to obtain that access is not disqualifying.** The connecting party — a tenant today, per the existing per-tenant credential pattern; potentially an individual user once the Users model exists — independently obtains and pays for whatever tier, free or paid, the connector needs, directly with the source, under that source's own terms and its own billing relationship. **SocialEngage never acts as an intermediary in billing or pricing for any tier, free or paid:** no invoicing the connecting party for a source's access, no reselling or marking up a source's paid tier, no pass-through pricing, and no absorbing or fronting a source's cost on the connecting party's behalf. This is not a new idea layered on top of the three bullets above — it is the same "no contracting on anyone's behalf" / "no assumed liability" logic already stated there for credential-holding, made explicit here for the case where money, not just a credential, changes hands. *(This corrects this ADR's own immediately-prior wording, which read a source's paid-only status as disqualifying and cited RTPR's, NewsAPI.org's, and Currents API's rejections as precedent for that — that framing was an overreach beyond this ADR's actual concern and has been reversed; see the Amendment Log for the full correction. That reversal does not reopen or re-verify ADR-0024's or ADR-0026's own historical rejections of those candidates, which remain each ADR's own record — whether their paid tiers would satisfy this bullet's terms-permit-the-integration requirement was never checked and is not asserted here.)*

**This principle governs regardless of how the tenant-vs-user question is eventually resolved.** It is a constraint the future Authentication/Users ADRs (candidate ADRs #1–#4) must be drafted to satisfy, not a decision that depends on their outcome. If the Users model eventually makes an individual user, not a tenant, the connecting party for some platforms, this Decision's requirement — independent sign-up, no pooling, no assumed liability — applies at whatever granularity "the connecting party" turns out to mean; only the storage/UX mechanics of *which entity* holds the credential are left open, not whether SocialEngage itself ever becomes a party.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Sponsor) | Project owner and decision authority | High | Clear, durable principle that protects the project from unacknowledged liability |
| Future Connector Authors | Designers of new data-source integrations | High | A written rule to evaluate against when proposing sources and auth models |
| AI Delivery Agent / Developers | Implementers of connector CRUD and connect flow | High | Guidance on permitted credential ownership and required UI disclosure |
| Tenant Administrators | Users who activate connectors | Medium | Clear understanding that they sign up and pay (if required) directly with the provider |
| Platform Providers (S-03) | External data-source vendors | Medium | Assurance that SocialEngage builds against their published API terms without reselling access |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 6.3 | epic-6-tenant-admin-ui.md | As Tenant-Admin or tenant user connecting a platform, I want a screen that lets me connect or disconnect a platform credential, tenant-wide or personal as my... | Lists the platforms with a real, shipped connector today (GNews/RSS-News, Newswire) with their current connection state, calling `GET`-equivalent state and `... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Provider credential (OAuth token, API key) | Per-tenant or per-user encrypted credential held by the connecting party, not SocialEngage | Data source and connecting party | Connecting party | High |
| Connector selection rationale | Terms-permit-use review recorded at connector-selection time | Connector ADR / BRD-0027 | Product Owner | Internal |
| Connect-flow disclosure copy | UI text stating direct provider relationship and no billing intermediation | Product / UX design | Product Owner | Internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | SocialEngage's connector architecture is a technical intermediary only and never becomes a party to, reseller of, or intermediary in a data-source relationship. |
| BRU-002 | One connecting party's credential may not be pooled, aggregated, or shared with another connecting party. |
| BRU-003 | SocialEngage does not assume liability for a data source's terms, pricing, rate limits, or a connecting party's violation of those terms. |
| BRU-004 | A connector may only be built for a data source whose published terms permit the automated, third-party API use the connector requires. |
| BRU-005 | If a source requires a paid tier, the connecting party must obtain and pay for that tier directly with the source; SocialEngage does not intermediate billing or pricing. |
| BRU-006 | Future connector connect-flow UI must make it unambiguous that the connecting party is creating their own account/credential directly with the provider. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0002 connector contract (technical only) | Internal / Precedent | Product Owner | Accepted |
| D-002 | ADR-0014 encrypted credential storage | Internal / Precedent | Technical Lead | Accepted |
| D-003 | ADR-0024 and ADR-0026 per-connector practice | Internal / Precedent | Product Owner | Accepted |
| D-004 | Candidate ADRs #1–#4 (Authentication / Users model) | Internal / Future | Technical Lead | To be drafted; must satisfy this BRD as a constraint |
| D-005 | Candidate ADR #6 (connector connect/disconnect CRUD + UI copy) | Internal / Future | AI Delivery Agent | Build connector connect flow with ADR-0027 disclosure requirement |

---

- The existing per-tenant credential pattern (ADR-0014 / ADR-0026) remains the default until a Users model is defined.  
- A self-funded, solo-project posture means SocialEngage has no budget or organizational capacity to absorb third-party contractual risk.  
- Data-source terms are public, current, and reviewable at connector-selection time.

**The durable decision — this is what would need superseding, not just amending:**

SocialEngage's connector architecture (ADR-0002) provides only the **technical connection mechanism** to a data source — OAuth flow support (`getAuthUrl`/`handleAuthCallback`), API-key validation (`validateApiKey`), encrypted credential storage (ADR-0014), and polling/normalization (`poll`/`normalize`). It never becomes a party to, reseller of, or intermediary in the actual commercial or legal relationship between a data source (a social platform, an AI enrichment provider, a newswire, a general-news API — `Stakeholder-Register.md` S-03/S-05) and whoever connects to it.

Whoever "the connecting party" is — today, a tenant, per the existing per-tenant credential pattern in ADR-0014/0024/0026; potentially, once the still-undrafted Users model exists (`docs/adr/README.md`'s 2026-07-30 governance note, candidate ADRs #1–#4), an individual user within a tenant — must independently sign up for, and hold, their own direct account or credential with the data source, under that source's own terms. Concretely:

- **No pooling or sharing.** SocialEngage never pools, aggregates, or shares one connecting party's credential across others. This is already true in practice for GNews (ADR-0026's "per-tenant credential, not a shared pool"); this ADR extends the same rule as a general requirement for every current and future connector, not a GNews-specific default.
- **No contracting on anyone's behalf.** SocialEngage is not itself a party to any data source's terms of service, developer agreement, or paid tier, and never signs up for, negotiates, or accepts a data source's terms on a connecting party's behalf. The connecting party's own acceptance of a source's terms — clicking through GNews's ToS, authorizing an OAuth grant on Reddit — is theirs, not SocialEngage's.
- **No assumed liability.** SocialEngage does not assume liability for a data source's own terms, pricing changes, rate-limit policy, or a connecting party's violation of that source's terms. Each connecting party is bound directly by, and responsible for compliance with, that source's own published terms — consistent with `Project-Charter.md`'s existing constraint ("Must comply with each platform's Terms of Service; no scraping or unauthorized access methods") and `Stakeholder-Register.md` S-03's compliance-by-construction posture, both of which already place the compliance burden on the connector's construction, not on SocialEngage absorbing a source's contractual risk.
- **Source eligibility, decided at connector-selection time — independent of the tenant-vs-user sequencing above.** SocialEngage will only build a connector for a data source when its own published terms actually permit the automated, third-party API use a connector requires — a connector is not built if operating it as designed would violate the source's own terms, at any tier. **A source requiring a paid tier to obtain that access is not disqualifying.** The connecting party — a tenant today, per the existing per-tenant credential pattern; potentially an individual user once the Users model exists — independently obtains and pays for whatever tier, free or paid, the connector needs, directly with the source, under that source's own terms and its own billing relationship. **SocialEngage never acts as an intermediary in billing or pricing for any tier, free or paid:** no invoicing the connecting party for a source's access, no reselling or marking up a source's paid tier, no pass-through pricing, and no absorbing or fronting a source's cost on the connecting party's behalf. This is not a new idea layered on top of the three bullets above — it is the same "no contracting on anyone's behalf" / "no assumed liability" logic already stated there for credential-holding, made explicit here for the case where money, not just a credential, changes hands. *(This corrects this ADR's own immediately-prior wording, which read a source's paid-only status as disqualifying and cited RTPR's, NewsAPI.org's, and Currents API's rejections as precedent for that — that framing was an overreach beyond this ADR's actual concern and has been reversed; see the Amendment Log for the full correction. That reversal does not reopen or re-verify ADR-0024's or ADR-0026's own historical rejections of those candidates, which remain each ADR's own record — whether their paid tiers would satisfy this bullet's terms-permit-the-integration requirement was never checked and is not asserted here.)*

**This principle governs regardless of how the tenant-vs-user question is eventually resolved.** It is a constraint the future Authentication/Users ADRs (candidate ADRs #1–#4) must be drafted to satisfy, not a decision that depends on their outcome. If the Users model eventually makes an individual user, not a tenant, the connecting party for some platforms, this Decision's requirement — independent sign-up, no pooling, no assumed liability — applies at whatever granularity "the connecting party" turns out to mean; only the storage/UX mechanics of *which entity* holds the credential are left open, not whether SocialEngage itself ever becomes a party.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Connector-selection decisions are documented and reviewable | Compliance | Must | Each connector ADR references ADR-0027 / this BRD and records the terms-permit-use rationale |
| NFR-002 | The no-intermediary principle remains stable across tenant and user model changes | Maintainability | Must | Future Authentication/Users ADRs explicitly satisfy this constraint |

---

## 11. Error Handling and Exceptions
**Positive**
- Makes explicit and durable something two connectors (ADR-0024, ADR-0026) already do in practice but never stated as project policy — closes the gap before a future connector, or a future ADR resolving the Users-model questions, has occasion to depart from it without first having to argue against a written rule.
- Gives whoever eventually drafts candidate ADR #4 (`users` table shape) or candidate ADR #6 (connector connect/disconnect CRUD) a settled answer to "does SocialEngage ever hold or broker a data-source relationship on a user's behalf" before they have to improvise one under schedule pressure.
- Keeps SocialEngage's own legal/commercial exposure bounded to what ADR-0014's technical credential-storage model already covers — it never signs up for, resells, or subsidizes access to a third-party API on any connecting party's behalf — consistent with a self-funded solo project with no set budget ceiling (`Business-Case-v6.0.md` §4/§9) having no capacity to absorb a third party's contractual risk.
- Names a real, concrete follow-up rather than leaving it implicit: the eventual Admin UI's connector connect-flow (candidate ADR #6; `docs/open-items-and-deferred-work.md` §A lists `POST /connectors/:platformId/connect` as "also build, not storied," Phase 1) needs its own copy/UX design that makes it unambiguous to the connecting party that they are signing up with the data source directly, not through SocialEngage. **This is named here as a requirement for whoever builds that flow — the AI Delivery Agent or Menno — not designed or implemented by this ADR.**

**Negative**
- **Paid-only sources are viable candidates — the real constraint is narrower than this bullet previously stated.** A data source requiring a paid tier does not disqualify it from candidacy (see the corrected "Source eligibility" bullet above): the connecting party independently obtains and pays for whatever tier the connector needs, directly with the source, under the source's own terms and billing relationship. The actual, durable constraint is that SocialEngage itself never becomes an intermediary in that billing or pricing relationship — no invoicing, reselling, marking up, or absorbing a source's cost on the connecting party's behalf. **This reverses this ADR's own immediately-prior wording**, which read a paid-only source as excluded from candidacy entirely — see the Amendment Log for the full correction and why the free-tier requirement didn't survive. This correction does not reopen or re-verify whether any specific previously-rejected candidate (RTPR, NewsAPI.org, Currents API) would now be viable: those ADRs' own historical rejections stand as their own record (ADR-0024 Accepted; ADR-0026 under separate review), and whether their *paid* tiers would satisfy the terms-permit-the-integration requirement was never checked, since it wasn't the deciding factor under the rule in force at the time.
- Places real setup burden on the connecting party (independently signing up with GNews, Reddit, etc.) that a reseller/aggregator model would remove. This is a deliberate trade-off consistent with this project's own "own your data and access, don't recreate the black box" thesis (`Business-Case-v6.0.md` §1's root-cause analysis of the MSE "black box" criticism), but it is a genuine cost to the connecting party's onboarding experience, not a free simplification — worth naming plainly rather than treating as costless.
- Once the Users model is actually drafted (candidate ADRs #1–#4), this principle will need to be checked against whatever entity shape it lands on. If an individual user, not the tenant, ends up being the connecting party for some platforms, ADR-0014's current credential model (built around per-tenant storage) may need an explicit per-user extension to keep satisfying this ADR's "no pooling" requirement at the right granularity — flagged here as a future consideration for that ADR, not resolved by this one.

## 12. Assumptions and Dependencies
- The existing per-tenant credential pattern (ADR-0014 / ADR-0026) remains the default until a Users model is defined.  
- A self-funded, solo-project posture means SocialEngage has no budget or organizational capacity to absorb third-party contractual risk.  
- Data-source terms are public, current, and reviewable at connector-selection time.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Future connector author proposes pooled or platform-held credentials to reduce onboarding friction | Medium | High | Enforce this BRD/ADR-0027 as a mandatory review gate and require explicit supersession if ever changed | Product Owner |
| R-002 | Paid-tier sources create pressure to bill or resell through SocialEngage | Low | High | Reiterate BRU-005 in connector selection and business-model discussions; reject any design with pass-through pricing | Product Owner |
| R-003 | Connecting parties misunderstand SocialEngage's role and expect support or liability for source terms | Medium | Medium | Implement connect-flow disclosure and support documentation that directs source-TOS questions to the provider | Product Owner |
| R-004 | Users model reopens the credential-granularity question | Medium | Medium | When ADR-0014 is extended, explicitly preserve the no-pooling rule at the new per-user granularity | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0027-connector-is-technical-intermediary-not-contracting-party.md`
- BRD: `../Business-Requirements/BRD-0027-Connector-Is-Technical-Intermediary-Not-Contracting-Party.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/*-deep-research.md``
- User stories: see extracted stories above