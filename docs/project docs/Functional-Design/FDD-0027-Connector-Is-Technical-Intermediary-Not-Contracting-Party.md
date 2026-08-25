# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0027 Connector Architecture as Technical Intermediary Only — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (Claude) |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0027 is Accepted; a governance/policy constraint, not a build) |
| Related Documents | ADR-0027, BRD-0027, ADR-0002, ADR-0014, ADR-0024, ADR-0026, ADR-0028, `Stakeholder-Register.md` S-03/S-05, `Business-Case-v6.0.md` §4/§9, `Project-Charter.md` |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0027 (connector architecture is a technical intermediary only) and BRD-0027 into the functional design for a project-wide constraint: SocialEngage's connector architecture provides only the technical connection mechanism to a data source (OAuth handshake support, API-key validation, encrypted credential storage, poll/normalize) and never becomes a party to, reseller of, or intermediary in the connecting party's own commercial or legal relationship with that source. ADR-0027 is Accepted (2026-08-01, drafted, revised, and accepted the same day). Unlike most FDDs in this series, this design has no accompanying user story, no new interface, and no new stored field of its own — it is a durable governance constraint already satisfied by two existing connectors (Newswire, GNews) and binding on every future one. This FDD documents that constraint's functional shape: what it requires, where it applies, and how it is checked, not a new runtime capability.

### 2.2 Scope

**In scope:**
- The general, project-wide principle: no pooling/sharing of a connecting party's credential; no contracting on anyone's behalf; no assumed liability for a source's terms; source eligibility decided at connector-selection time (a paid-only source is not disqualifying, but SocialEngage never intermediates billing/pricing for any tier).
- Application to every data source: social platforms, newswires, general-news APIs, AI enrichment providers, and any future source.
- The requirement that a future connector connect-flow UI unambiguously discloses the direct-provider relationship.
- The constraint this principle places on the still-undrafted Users model (candidate ADRs #1–#4) — it must be satisfied regardless of how tenant-vs-user is eventually resolved.

**Out of scope:**
- Resolving the tenant-vs-user connecting-party model itself (deferred to candidate ADRs #1–#4).
- Designing the specific Admin UI copy/disclosure pattern for the connect flow (named as a requirement for whoever builds candidate ADR #6, not designed here).
- Reopening or re-verifying historical connector rejections (RTPR, NewsAPI.org, Currents API) against paid tiers.
- Drafting a public-facing Terms of Use or other customer-facing legal document.
- Editing ADR-0002, ADR-0014, ADR-0024, or ADR-0026's own Decision text — this ADR cites them as precedent via forward-pointer notes, per the series' governance convention.

### 2.3 Target Audience

Future connector authors (human or AI persona), whoever drafts the Users model or Admin UI connect-flow, product owner reviewing connector-selection decisions, Menno as Sponsor.

---

## 3. Context and Background

`docs/adr/README.md`'s 2026-07-30 governance note lists seven candidate future ADRs for the still-undrafted multi-tenant Admin/Tenant/User model. This ADR is deliberately not one of them — it does not decide who the connecting party is, does not decide table shapes, and does not decide authentication. What it decides is narrower and answerable now, independent of that sequencing: regardless of who the connecting party turns out to be, SocialEngage's own role relative to a data source is fixed — technical intermediary only, never a contracting party.

The practice being formalized is not new — it was already present, connector-by-connector, without ever being stated as a project-wide rule: ADR-0002's connector contract is purely technical (no representation of a commercial relationship on anyone's behalf); ADR-0014 stores the connecting party's own credential, not SocialEngage's; ADR-0024 (Newswire) targets public feeds directly with no commercial layer inserted; ADR-0026 (GNews) states the pattern most explicitly ("per-tenant credential, not a shared pool"). Three connectors' worth of Decision text already assumed this principle without ever stating it generally — a gap that mattered because nothing on record would have stopped a future connector from proposing a pooled, SocialEngage-held credential "to reduce onboarding friction" without first having to argue against a written rule.

`Stakeholder-Register.md` S-03 already frames every social platform provider as External/High Power/Low Interest, engaged via "Keep Satisfied — compliance-by-construction": build every connector strictly against currently published API terms, monitor for policy/pricing changes before they cause a failure. This ADR is the direct architectural consequence of that posture — SocialEngage cannot credibly claim compliance-by-construction while also inserting itself as an unacknowledged party via a pooled credential or resold access tier. `Business-Case-v6.0.md` §4/§9 establishes the project has no revenue model, no set budget ceiling, and no capacity to absorb a third party's contractual or financial risk — this ADR is compatible with, though not sourced from, that framing.

**The Decision went through a same-day reversal, both parts now part of the accepted text:** an intermediate revision added a "free/no-cost-path required" eligibility criterion (a paid-only source disqualified entirely), grounded in ADR-0024's RTPR rejection and ADR-0026's NewsAPI.org/Currents API rejections. Menno's clarification reversed this the same day: a paid-only source is *not* disqualifying — the connecting party independently obtains and pays for whatever tier is needed, directly with the source; SocialEngage's actual, durable concern is narrower — never being the billing/pricing intermediary, not that money never changes hands at all. This reversal does not reopen ADR-0024's or ADR-0026's own historical rejections, which remain each ADR's own record.

Source requirements: BRD-0027 §§6–7. No user story exists for this ADR — a documented, named exception to the "one user story per ADR" convention (no new interface, stored field, or endpoint is introduced; the principle is already satisfied by existing connectors without any code change).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Make the non-intermediary role explicit and durable across every current and future connector | Every new connector ADR cites ADR-0027/this FDD as a governing constraint |
| G2 | Prevent SocialEngage from assuming data-source contractual, pricing, or liability risk | No connector design pools credentials, resells tiers, or bills connecting parties on a source's behalf |
| G3 | Preserve direct-source relationships for connecting parties | Each connecting party signs up and holds their own credential directly with the data source |
| G4 | Support clear UI disclosure once built | Future connect-flow copy states the relationship is direct, not through SocialEngage |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Technical-Only Connector Contract

- **Description:** The connector architecture (ADR-0002) executes only the technical connection mechanism — OAuth flow support, API-key validation, encrypted credential storage (ADR-0014), polling/normalization — and represents no commercial relationship on anyone's behalf.
- **Triggers:** Every connector implementation, existing or future.
- **Inputs:** The connecting party's own credential (OAuth token or API key), already obtained directly from the data source.
- **Processing:** The connector stores and uses the credential purely as a technical mechanism to execute a relationship the connecting party already holds — it never represents, negotiates, or holds that relationship itself.
- **Outputs:** A working technical connection with no commercial/legal relationship implied on SocialEngage's part.
- **Error handling:** N/A — this is a design constraint checked at connector-review time, not a runtime condition.
- **Edge cases:** A future connector proposing a system-wide or pooled credential fails this constraint at design-review time, before implementation.

### 5.2 Feature / Capability: No Pooling or Sharing of Credentials

- **Description:** SocialEngage never pools, aggregates, or shares one connecting party's credential across others.
- **Triggers:** Every connector's credential-storage design.
- **Inputs:** Per-connecting-party credentials (per-tenant today; potentially per-user once the Users model exists).
- **Processing:** Each credential is stored and scoped to exactly one connecting party (already true in practice for GNews's "per-tenant credential, not a shared pool"); this ADR extends the rule as a general requirement for every current and future connector, not a GNews-specific default.
- **Outputs:** No SocialEngage-held or cross-party-shared credential ever exists.
- **Error handling:** N/A — a design-time constraint.
- **Edge cases:** If the Users model eventually makes an individual user, not the tenant, the connecting party for some platforms, ADR-0014's credential model may need an explicit per-user extension to keep satisfying this rule at the right granularity — flagged as a future consideration, not resolved here.

### 5.3 Feature / Capability: No Contracting on Anyone's Behalf, No Assumed Liability

- **Description:** SocialEngage is not itself a party to any data source's terms of service, developer agreement, or paid tier, and never signs up for, negotiates, or accepts a source's terms on a connecting party's behalf; it does not assume liability for a source's terms, pricing changes, rate-limit policy, or a connecting party's violation of those terms.
- **Triggers:** Every connector's design and every connecting party's onboarding.
- **Inputs:** The data source's own published terms; the connecting party's own act of acceptance (clicking through a ToS, authorizing an OAuth grant).
- **Processing:** The connecting party's acceptance of a source's terms is theirs, not SocialEngage's — consistent with `Project-Charter.md`'s existing constraint ("must comply with each platform's Terms of Service; no scraping or unauthorized access") and `Stakeholder-Register.md` S-03's compliance-by-construction posture, both of which already place the compliance burden on the connector's construction, not on SocialEngage absorbing a source's contractual risk.
- **Outputs:** A connector that functions correctly under the source's terms, with SocialEngage bearing no contractual exposure to that source.
- **Error handling:** N/A — a design-time and operational-posture constraint, not a runtime error path.
- **Edge cases:** A connecting party violating a source's terms (e.g. over-polling) is that party's own compliance failure, not one SocialEngage absorbs — though SocialEngage's own conservative default rate limits (e.g. ADR-0024's Newswire cadence) are designed to reduce the likelihood of this happening by construction.

### 5.4 Feature / Capability: Source-Eligibility Review at Connector-Selection Time

- **Description:** SocialEngage will only build a connector for a data source whose own published terms actually permit the automated, third-party API use a connector requires — checked at connector-selection time, independent of the tenant-vs-user sequencing.
- **Triggers:** Evaluation of a candidate data source before a connector ADR is drafted.
- **Inputs:** The source's published terms of service/API documentation.
- **Processing:** A source requiring a paid tier is not disqualifying — the connecting party independently obtains and pays for whatever tier the connector needs, directly with the source, under that source's own billing relationship. SocialEngage never acts as an intermediary in billing or pricing for any tier, free or paid: no invoicing, no reselling/marking up, no pass-through pricing, no absorbing or fronting a source's cost.
- **Outputs:** A connector-selection decision (built or not built) with a recorded terms-permit-use rationale.
- **Error handling:** N/A — a review-gate process, not a runtime behavior.
- **Edge cases:** A source's paid-tier signup mechanism (e.g. a credit-card-gated trial that auto-bills unless cancelled) may still be a legitimate, separate concern to weigh at selection time (as it was for RTPR in ADR-0024) — this is not restated as a rule by this ADR and must not be conflated with the reversed free-tier requirement; it is carried forward as an explicitly named, still-open consideration for future candidate evaluation.

### 5.5 Feature / Capability: Connect-Flow Disclosure Requirement (Named, Not Designed Here)

- **Description:** A future requirement — not designed or implemented by this ADR — that the Admin UI's connector connect-flow make it unambiguous to the connecting party that they are signing up with the data source directly, not through SocialEngage.
- **Triggers:** Whoever eventually builds the connector connect/disconnect CRUD flow (candidate ADR #6).
- **Inputs:** N/A at this ADR's level — the exact copy/UX design is deferred.
- **Processing:** Named here as a requirement for that future work: disclosure that the relationship is direct, and that SocialEngage is not an intermediary in billing or pricing.
- **Outputs:** N/A at this ADR's level.
- **Error handling:** N/A.
- **Edge cases:** N/A — this is a forward-pointer requirement, not a built capability.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Future Connector Authors (human or AI persona) | Evaluate and design new connectors against this constraint |
| AI Delivery Agent / Developers | Implement connector CRUD and connect-flow UI under this constraint |
| Tenant Administrators | Connecting parties who sign up and, if required, pay directly with the provider |
| Platform Providers (`Stakeholder-Register.md` S-03) | External data sources whose terms govern the connecting party's use |
| Menno (Sponsor) | Decision authority on scope, acceptance, and any future supersession |

### 6.2 User Stories / Use Cases

No user story accompanies ADR-0027 — a documented, named exception to the project's "one user story per ADR" convention, since this ADR introduces no new interface, stored field, or endpoint; it is a constraint already satisfied by the existing GNews (ADR-0026) and Newswire (ADR-0024) connectors. The downstream UI-disclosure requirement (5.5) is captured as a constraint for future stories, notably the connector connect-flow work in Epic 6, rather than as a story of its own here.

### 6.3 Workflow Diagrams / Steps

**Connector-selection review (applies to every future connector):**
1. A candidate data source is identified.
2. Its published terms are checked directly against the automated, third-party API use the connector would require (5.4).
3. If terms permit the use (at any tier, free or paid) → candidacy proceeds; a paid-only source is not disqualifying on its own.
4. If terms do not permit the use, or no self-serve path exists at all → the source is not built as a connector.
5. The connector's design is checked against 5.1–5.3 (technical-only contract, no pooling, no contracting/liability) before the connector ADR is drafted.

**Future connect-flow (named requirement, not built by this ADR):**
1. Connecting party initiates connect for a given connector.
2. UI discloses the relationship is direct with the provider, not through SocialEngage.
3. Connecting party independently signs up/authenticates/pays with the provider.
4. SocialEngage stores only the resulting credential, per-connecting-party, never pooled.

---

## 7. Data Requirements

### 7.1 Data Inputs

- The data source's own published terms of service/API documentation (reviewed at connector-selection time).
- The connecting party's own credential, obtained independently.

### 7.2 Data Outputs

- A connector-selection rationale (terms-permit-use review), recorded per connector ADR.
- No new stored data type is introduced by this ADR itself — it constrains how existing credential storage (ADR-0014) may be used, not its schema.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| Provider credential (OAuth token / API key, existing ADR-0014 schema) | Per-connecting-party, encrypted | Constrained by this ADR to remain per-connecting-party — never pooled, never SocialEngage-held |
| Connector-selection rationale (documentation artifact, not a stored table) | Source name, terms-permit-use finding, free/paid-tier note | Recorded in the connector's own ADR, not a database entity |
| Connect-flow disclosure copy (future UI content, not yet built) | Disclosure text stating direct-provider relationship and no billing intermediation | To be implemented by candidate ADR #6's connect-flow work |

### 7.4 Validation Rules

- No credential may be stored at a platform/SocialEngage-wide level, for any connector, present or future.
- A connector may only be built for a source whose published terms permit the automated, third-party use required — recorded as part of that connector's own selection rationale.
- No connector design may include billing, reselling, mark-up, or cost-fronting for a source's tier, free or paid.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | SocialEngage's connector architecture is a technical intermediary only and never becomes a party to, reseller of, or intermediary in a data-source relationship. | All connectors (5.1) |
| BR2 | One connecting party's credential may not be pooled, aggregated, or shared with another connecting party. | Credential storage (5.2) |
| BR3 | SocialEngage does not assume liability for a data source's terms, pricing, rate limits, or a connecting party's violation of those terms. | Liability (5.3) |
| BR4 | A connector may only be built for a data source whose published terms permit the automated, third-party API use the connector requires. | Selection review (5.4) |
| BR5 | If a source requires a paid tier, the connecting party must obtain and pay for that tier directly with the source; SocialEngage does not intermediate billing or pricing. | Selection review (5.4) |
| BR6 | Future connector connect-flow UI must make it unambiguous that the connecting party is creating their own account/credential directly with the provider. | Disclosure (5.5) |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Connector ADRs (existing and future) | Governing | Must cite and satisfy this constraint | ADR document convention |
| ADR-0002 (`SocialConnector` contract) | Governing | Technical-only shape this ADR constrains the use of | Design constraint |
| ADR-0014 (credential storage) | Governing | Per-credential encryption model this ADR constrains to per-connecting-party scope | Design constraint |
| Future Admin UI connect-flow (candidate ADR #6) | Downstream | Must implement the disclosure requirement (5.5) | UI copy/UX (not yet built) |
| Future Users-model ADRs (candidate ADRs #1–#4) | Downstream | Must be drafted to satisfy this constraint regardless of tenant-vs-user resolution | ADR design constraint |

---

## 10. Non-Functional Considerations

- **Compliance:** Every connector-selection decision should record a terms-permit-use rationale, reviewable per BRD-0027 NFR-001.
- **Legal/commercial exposure:** Bounded to what ADR-0014's technical credential-storage model already covers — SocialEngage never signs up for, resells, or subsidizes access to a third-party API on any connecting party's behalf, consistent with a self-funded solo project with no set budget ceiling.
- **Onboarding cost:** A real, named trade-off — independent sign-up per connecting party is a genuine onboarding cost compared to a reseller/aggregator model, accepted deliberately in line with the project's "own your data and access, don't recreate the black box" thesis.
- **Stability across model changes:** This principle must remain stable regardless of how the tenant-vs-user connecting-party question is eventually resolved (NFR-002) — future Authentication/Users ADRs must be drafted to satisfy it, not the reverse.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| A future connector proposal includes a pooled/platform-held credential | N/A (design-review rejection) | Proposal fails review against this constraint before implementation begins |
| A candidate data source's terms do not permit automated third-party use at any tier | N/A (not built) | Source is not selected as a connector candidate |
| A candidate source requires a paid tier | N/A | Not disqualifying — connecting party obtains/pays directly; SocialEngage still does not intermediate billing |
| A connecting party violates a source's own terms (e.g. over-polling) | N/A (source-side enforcement) | That party's own compliance responsibility; SocialEngage does not absorb liability |
| Future connect-flow UI omits the direct-relationship disclosure | N/A (build-review finding) | Flagged as a requirement not yet satisfied when candidate ADR #6's UI work is reviewed |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- The existing per-tenant credential pattern (ADR-0014/ADR-0026) remains the default until a Users model is defined.
- A self-funded, solo-project posture means SocialEngage has no budget or organizational capacity to absorb third-party contractual risk.
- Data-source terms are public, current, and reviewable at connector-selection time.

**Dependencies:**
- ADR-0002 (connector contract, technical only) — Accepted; this ADR constrains its use, does not edit it.
- ADR-0014 (encrypted credential storage) — Accepted; this ADR constrains its scope (per-connecting-party, never pooled).
- ADR-0024, ADR-0026 (Newswire, GNews) — Accepted; both already satisfy this principle in practice, cited as precedent.
- ADR-0028 (credential creation authority scoped by ownership tier) — Accepted 2026-08-03; formalizes, as a related but distinct principle, that SocialEngage never creates a system-wide credential at creation time, not merely never shares one after the fact. Confirmed the same day: no change follows to this ADR's own Decision or Consequences.
- Candidate ADRs #1–#4 (Authentication/Users model) — to be drafted; must satisfy this ADR as a constraint.
- Candidate ADR #6 (connector connect/disconnect CRUD + UI copy) — to be drafted; must implement the disclosure requirement (5.5).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should this principle also be reflected in a future tenant-facing document (Terms of Use, onboarding copy)? | Product Owner | Out of this ADR's own scope; worth naming as a Phase 5 production-readiness follow-up |
| Q2 | What are the exact mechanics of "whoever connects" once the Users model exists (per-tenant vs. per-user credential storage)? | Technical Lead | Deliberately left to candidate ADRs #1–#4 |
| Q3 | Does the Admin UI's connect-flow need a specific, standard disclosure pattern across every connector? | Whoever builds candidate ADR #6 | Named as a requirement here; exact design is a follow-up |
| Q4 | Does a source's paid-tier signup *mechanism* itself (e.g. a credit-card-gated auto-billing trial) warrant its own explicit future evaluation criterion? | Product Owner | Legitimate, still-open consideration; not restated as a rule by this ADR, not conflated with the reversed free-tier requirement |

---

## 14. Appendix

**Glossary:** see BRD-0027 §15 for connecting party, connector, credential, data source, and technical intermediary definitions.

**Reference links:**
- [ADR-0027: Connector architecture is a technical intermediary only](../../adr/0027-connector-is-technical-intermediary-not-contracting-party.md)
- [BRD-0027](../Business-Requirements/BRD-0027-Connector-Is-Technical-Intermediary-Not-Contracting-Party.md)
- [ADR-0002, ADR-0014, ADR-0024, ADR-0026, ADR-0028] (referenced; not independently re-verified in this pass)
- `docs/project docs/Stakeholder-Register.md` §S-03/S-05
- `docs/project docs/Business-Case-v6.0.md` §4/§9
- `docs/project docs/Project-Charter.md`

**Missing sources:** No `docs/product-research/feature-designs/<feature>.md` or deep-research report exists for this ADR — it originates a principle stated directly by Menno during the session, elevating practice already present in ADR-0014/0024/0026, as BRD-0027's own Appendix confirms. No user story accompanies this ADR — a documented, named exception (see §6.2 above).

**Revision history:**

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer (Claude) | Full regeneration: correct H1, real per-capability Section 5 breakdown (framed as governance/policy capabilities, since this ADR introduces no runtime feature), real Section 7.3 data model, replacing the prior defective BRD-shaped draft |
