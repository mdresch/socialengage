# Business Requirements Document: Standard Pattern for Cross-Story References and Supersession Language

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Standard Pattern for Cross-Story References and Supersession Language — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent, on behalf of the Documentation Steward |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-19 | BRD Writer Agent | Initial BRD derived from ADR-0047 (Accepted 2026-08-11) |

---

## 2. Executive Summary

The SocialEngage project has accumulated a large corpus of architecture decision records (ADRs) and user stories that frequently reference one another and occasionally supersede earlier acceptance criteria (ACs). The intent of these references is correct, but the wording style is not uniform: some notes use relative dates ("later"), vague AC identifiers ("the relevant AC"), or unowned "to be decided" placeholders. This creates avoidable interpretation risk for reviewers and implementers, especially where historical transitions exist (for example, the Story 2.3 flat-failure threshold later superseded by Story 2.5's rate-relative rule).

This BRD establishes the business need for a single, project-wide pattern for cross-story references and supersession language. The pattern is a documentation-authoring convention that makes every cross-dependency note precise, dated, and owned; preserves original decision text as a historical record; and defers to the existing governance table in `docs/adr/README.md` for deciding which of the seven supersession categories applies.

The value is faster, more reliable reviews and fewer mis-implementations caused by ambiguous contract fragments. No implementation code or user stories are required; the pattern takes effect immediately for all future ADR and story authoring.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Standardize supersession and cross-dependency language across all ADRs and user stories | 100% of new cross-dependency notes written after ADR-0047 acceptance conform to the four-field pattern |
| 2 | Reduce the risk of implementing outdated or ambiguous contract fragments | Zero acceptance of new documents containing unowned TBDs or vague supersession references after the adoption date |
| 3 | Preserve the historical record of original decisions while keeping the live contract unambiguous | All superseded ACs retain original text with a properly formatted obsolete marker or a dated appendix; live contract is always the last dated appendix |

---

## 4. Scope

### 4.1 In Scope

- Authoring conventions for documenting superseded acceptance criteria in place.
- Required fields for every cross-dependency, Pending supersession, and Note on relation entry.
- Four required resolution forms for every known-conflict, open-question, or TBD note.
- The rule that the last dated appendix is the live contract.
- Preservation of original Decision and Consequences text as a historical record.
- Deference to the seven-row governance table in `docs/adr/README.md`.

### 4.2 Out of Scope

- Changes to `docs/adr/README.md`'s governance table categories.
- Introduction of a strict AC label convention (e.g., AC1/AC2 numbering in every story) — explicitly flagged as a separate ADR if ever pursued.
- A lint/check script to enforce this pattern — explicitly deferred until the series exceeds ~50 ADRs.
- Any implementation code, contract tests, or user-story work.

### 4.3 Assumptions

- All future ADR and story authors have access to the worked examples in ADR-0047 and `docs/user-stories/README.md`.
- The `docs/adr/README.md` governance table remains the authoritative reference for which of the seven supersession categories applies.
- All accepted ADRs and stories already carry a clear acceptance date.

### 4.4 Constraints

- The pattern must not create a second governance table; it only describes how to write entries governed by the existing one.
- Original Decision and Consequences text must not be edited in place; updates are appended as dated sections or markers.
- A single top-of-file "current contract" summary is not required, to avoid dual sources of truth.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Product Owner / Technical Lead) | ADR acceptance authority and project owner | High | Clear, enforceable conventions that reduce review overhead |
| Documentation Steward | Maintains corpus consistency and ADR/README hygiene | High | A single, unambiguous pattern and a way to audit conformance |
| ADR / Story Authors | Create and maintain ADRs and user stories | High | Concrete templates and worked examples to follow |
| Technical Reviewers | Review ADRs and stories before acceptance | High | Ability to reject documents that do not meet the precision standard |
| Implementers | Build against accepted stories and ADRs | Medium | Confidence that the cited contract fragment is the live one |

---

## 6. Current State (As-Is)

**Current process:**

The project uses terms such as "supersession," "superseded AC," and "known cross-story conflict" across multiple ADRs and stories. The underlying intent is consistent, but the concrete wording varies by author and by document. Some ACs carry obsolete markers, others do not. Some cross-dependency notes quote exact AC text, others use narrative references. Some notes distinguish acceptance and implementation dates, others conflate them.

**Pain points:**

- Reviewers must re-derive the expected wording pattern for each new document.
- Vague references like "the relevant AC" or "later" make it hard to know which contract fragment is live.
- Unowned TBDs can be accepted and then forgotten, leading to work against stale assumptions.
- When acceptance and implementation happen at different times, the missing implementation-status note can cause premature or delayed code changes.
- Without a clear live-contract rule, readers may be confused between original Decision text and appended supersession notes.

---

## 7. Future State (To-Be)

**New or improved process:**

Every future ADR, story, and cross-dependency note is authored using a single, project-wide pattern. When an AC's underlying decision is superseded, the original text is preserved and marked with a standardized obsolete parenthetical containing the original behavior, the supersession date, the superseding artifact, and a pointer. Every cross-dependency note includes the exact AC identifier or quoted fragment, the superseding ADR/story by number, the acceptance date, and an implementation-status note when the dates differ. Every known-conflict or TBD note resolves to a named owner. The last dated appendix in a document is treated as the live contract, while the original Decision text remains the historical record.

**Expected capabilities:**

- Contributors can write and review supersession notes from a single reference pattern.
- Reviewers can quickly verify that every cross-dependency note contains the four required fields.
- The project can confidently preserve old contract text without it being mistaken for the live rule.
- Unowned TBDs are caught at review and converted to one of the four named-resolution forms.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | When an AC's underlying decision is superseded, the original AC text must be preserved and an obsolete marker of the form `(originally ...; superseded YYYY-MM-DD by <Story X.Y / ADR-NNNN>'s <specific rule> — see <pointer>)` must be added in place | Must | Review of any newly accepted superseded AC shows the exact parenthetical pattern with original behavior, date, superseding artifact, and pointer | ADR / Story Authors |
| BR-002 | Every cross-dependency note must name an exact AC identifier or quote a literal AC text fragment; vague references such as "the relevant AC" are not permitted | Must | All new cross-dependency notes cite `AC#` or a quoted fragment | ADR / Story Authors |
| BR-003 | Every cross-dependency note must name the superseding ADR or story by number (e.g., `ADR-0023`, `Story 2.5`) | Must | Every note contains a numeric artifact identifier | ADR / Story Authors |
| BR-004 | Every cross-dependency note must include the acceptance date in `YYYY-MM-DD` format | Must | No relative dates such as "later" or "recently" remain in new notes | ADR / Story Authors |
| BR-005 | Cross-dependency notes must include an implementation-status note whenever acceptance and implementation occurred on different dates | Should | Notes separate acceptance date from implementation date where applicable | ADR / Story Authors |
| BR-006 | Every known conflict, open question, or TBD note must resolve to one of four named forms: resolved by a named ADR/story, deferred to a named future story, deferred to a named future ADR, or intentionally retained as obsolete historical behavior | Must | Zero unowned TBDs in newly accepted documents | Reviewers |
| BR-007 | In any ADR or story with appended Clarifications, Supersession updates, or Notes on relation, the last dated appendix must be treated as the live contract | Must | Original Decision text is never rewritten; the most recent dated appendix is the authoritative rule | ADR / Story Authors |
| BR-008 | Original Decision and Consequences text must remain unedited and treated as a historical record | Must | No accepted ADR has its original Decision text overwritten to match a later supersession | Documentation Steward |
| BR-009 | When an underlying adjustable parameter changes without a decision change, the change is recorded only in the parent ADR's Amendment Log; no in-place obsolete marker is added | Must | Parameter-tweak changes have an Amendment Log entry and no AC-level obsolete marker | ADR / Story Authors |
| BR-010 | For implicit-requirement clarifications, the parent ADR receives a new dated Clarification section; dependent story ACs are unchanged unless the clarification rewrites the AC's intent | Must | New Clarification sections are dated and appended; dependent ACs only change when intent changes | ADR / Story Authors |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All new ADRs and user stories created after ADR-0047 acceptance must follow this pattern | Compliance | Must | 100% of new documents with superseded ACs or cross-dependency notes pass a conformance review |
| NFR-002 | The pattern must not require a second governance document or change `docs/adr/README.md`'s table | Maintainability | Must | No changes to the seven-row governance table categories are introduced by this BRD |
| NFR-003 | Existing documents may be back-fixed as they are reviewed; no blanket rewrite of historical records is required | Maintainability | Should | Back-fixes are logged as dated clarifications or supersession updates without overwriting original text |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Bare "to be decided," "TBD," or "needs further discussion" notes with no concrete owner are not acceptable in any accepted document. |
| BRU-002 | Parameter tweaks are documented in the parent ADR's Amendment Log only; adding in-place obsolete markers to parameter changes is prohibited. |
| BRU-003 | If any wording in this pattern conflicts with `docs/adr/README.md`'s seven-row governance table, the README table wins and the relevant ADR is amended. |
| BRU-004 | Superseded AC text must not be deleted; it must be marked in place or struck through, with the new rule written immediately after the marker when still applicable. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| ADR markdown files | Architecture decision records containing Decision, Consequences, and appendix sections | `docs/adr/*.md` | ADR Author / Documentation Steward | Project governance record |
| User story markdown files | Epic-level story files containing ACs and cross-dependency notes | `docs/user-stories/epic-*.md` | Story Author / Product Owner | Project specification record |
| Amendment Log | Dated record of changes made to an ADR after acceptance | Within each ADR file | ADR Author / Documentation Steward | Project governance record |
| Obsolete markers | In-place parentheticals noting superseded ACs | Within affected story/ADR files | Story/ADR Author | Project specification record |
| Cross-dependency notes | References between stories, ADRs, and future work | Within affected story/ADR files | Story/ADR Author | Project specification record |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Cross-dependency note conformance | Track whether new notes include the four required fields and the four resolution forms | Documentation Steward / Reviewers | Per ADR / story review |
| Unowned TBD count | Measure remaining bare TBDs in accepted documents | Documentation Steward / Product Owner | Monthly |
| Superseded AC marker compliance | Verify that superseded ACs use the exact parenthetical pattern | Reviewers | Per ADR / story review |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Slight increase in authoring overhead for every cross-dependency note | High | Low | Provide worked examples from ADR-0047 and `docs/user-stories/README.md`; make the pattern checkable by reviewers | Documentation Steward |
| R-002 | Existing unowned TBDs in older ADRs surface during review and require back-fixing | Medium | Medium | Back-fix incrementally during normal review; do not rewrite original Decision text; log changes as dated clarifications | Documentation Steward |
| R-003 | A future contributor misinterprets this pattern as a new governance table, conflicting with `docs/adr/README.md` | Low | High | Explicitly state in every reference that the README table is the authority and this pattern only describes how to write entries | Documentation Steward |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `docs/adr/README.md` — the seven-row governance table that defines which supersession category applies | Internal | Documentation Steward | Already accepted and maintained |
| D-002 | `docs/user-stories/README.md` — contains the canonical "Known cross-story conflict — resolved, 2026-07-30" worked example | Internal | Documentation Steward | Already present |
| D-003 | Author and reviewer training on the new pattern | Internal | Product Owner / Documentation Steward | 2026-08-26 |
| D-004 | No product-research feature design or deep-research brief exists for this meta-ADR | N/A | N/A | N/A; not required because this is a documentation-authoring convention |

---

## 14. Acceptance Criteria

- Every newly accepted document that supersedes an AC uses the exact in-place obsolete marker pattern mandated by ADR-0047.
- Every cross-dependency note in newly accepted documents names the exact AC identifier or quoted fragment, the superseding ADR/story by number, and the acceptance date.
- Every cross-dependency note in newly accepted documents with different acceptance and implementation dates includes an implementation-status note.
- No newly accepted document contains an unowned TBD; every known conflict resolves to one of the four named forms.
- In any document with one or more dated appendices, the last dated appendix is the live contract and the original Decision text is preserved as the historical record.
- `docs/adr/README.md`'s seven-row governance table remains the authoritative reference for which supersession category applies; this BRD and ADR-0047 do not introduce a competing table.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Supersession | The replacement of an earlier decision, acceptance criterion, or contract fragment by a later one. |
| Superseded AC | An acceptance criterion whose underlying decision has been replaced by a later ADR or story. |
| Obsolete marker | A parenthetical note added to a superseded AC in place, recording the original text, supersession date, superseding artifact, and pointer. |
| Cross-dependency note | Any reference within or between ADRs and stories that describes a supersession, pending supersession, relation, or conflict. |
| Live contract | The currently enforceable rule in an ADR or story, defined as the last dated appendix. |
| Unowned TBD | A bare "to be decided" or "needs further discussion" note with no named ADR, story, or deliberate obsolete-retention owner. |
| Acceptance date | The date on which an ADR or story was formally accepted. |
| Implementation date | The date on which the code or behavior described by an accepted ADR or story was actually built or shipped. |
| Amendment Log | A dated record of changes made to an ADR after its initial acceptance. |
| Historical record | The original Decision and Consequences text in an ADR, preserved unchanged as the record of what was decided at the time. |

---

## 16. Appendices

### Appendix A: Source ADR

- `docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md`

### Appendix B: Governance and example references cited by the ADR

- `docs/adr/README.md` — Conventions for changing an existing ADR (seven-row governance table)
- `docs/user-stories/README.md` — "Known cross-story conflict — resolved, 2026-07-30" worked example
- `docs/open-decisions.md` — project backlog source

### Appendix C: Representative stories and ADRs used as worked examples

- `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` — Story 2.3 (flat-failure threshold), Story 2.5 (rate-relative rule)
- `docs/adr/0009-queue-and-gate-retry-behavior.md` and `docs/adr/0010-retryable-failure-criteria.md` — Pending supersession notes
- `docs/adr/0020-distributed-rate-limit-gate.md` — deferred precedent for build-when-needed
- `docs/adr/0023-connector-health-rate-relative-rule.md` — last dated appendix as live contract
- `docs/adr/0024-newswire-author-normalization.md` and `docs/adr/0026-gnews-author-normalization.md` — Note on relation to ADR-0027

### Appendix D: Missing supporting materials

- No `docs/product-research/feature-designs/<feature>.md` file was found for this meta-ADR because ADR-0047 is a documentation-authoring convention, not a product feature.
- No `docs/product-research/reports/<feature>-deep-research.md` file was found for the same reason.
- No user story was drafted for ADR-0047; it is a deliberate no-story ADR, consistent with the precedent for meta-decisions.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Other Stakeholder | Documentation Steward | | 2026-08-19 |
