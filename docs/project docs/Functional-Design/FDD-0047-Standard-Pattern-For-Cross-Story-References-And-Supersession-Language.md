# Business Requirements Document: Standard Pattern for Cross-Story References and Supersession Language

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document: Standard Pattern for Cross-Story References and Supersession Language |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md, ../Business-Requirements/BRD-0047-Standard-Pattern-For-Cross-Story-References-And-Supersession-Language.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0047-standard-pattern-for-cross-story-references-and-supersession-language.md and the business requirements in BRD-0047-Standard-Pattern-For-Cross-Story-References-And-Supersession-Language.md into functional design for **Standard Pattern For Cross Story References And Supersession Language**.
The SocialEngage project has accumulated a large corpus of architecture decision records (ADRs) and user stories that frequently reference one another and occasionally supersede earlier acceptance criteria (ACs). The intent of these references is correct, but the wording style is not uniform: some notes use relative dates ("later"), vague AC identifiers ("the relevant AC"), or unowned "to be decided" placeholders. This creates avoidable interpretation risk for reviewers and implementers, especially where historical transitions exist (for example, the Story 2.3 flat-failure threshold later superseded by Story 2.5's rate-relative rule).

This BRD establishes the business need for a single, project-wide pattern for cross-story references and supersession language. The pattern is a documentation-authoring convention that makes every cross-dependency note precise, dated, and owned; preserves original decision text as a historical record; and defers to the existing governance table in `docs/adr/README.md` for deciding which of the seven supersession categories applies.

The value is faster, more reliable reviews and fewer mis-implementations caused by ambiguous contract fragments. No implementation code or user stories are required; the pattern takes effect immediately for all future ADR and story authoring.

---

### 2.2 Scope
**In scope:**
- Authoring conventions for documenting superseded acceptance criteria in place.
- Required fields for every cross-dependency, Pending supersession, and Note on relation entry.
- Four required resolution forms for every known-conflict, open-question, or TBD note.
- The rule that the last dated appendix is the live contract.
- Preservation of original Decision and Consequences text as a historical record.
- Deference to the seven-row governance table in `docs/adr/README.md`.

**Out of scope:**
- Changes to `docs/adr/README.md`'s governance table categories.
- Introduction of a strict AC label convention (e.g., AC1/AC2 numbering in every story) — explicitly flagged as a separate ADR if ever pursued.
- A lint/check script to enforce this pattern — explicitly deferred until the series exceeds ~50 ADRs.
- Any implementation code, contract tests, or user-story work.

## 3. Context and Background
The current corpus uses terms such as "supersession," "superseded AC," and "known cross-story conflict" across several stories and ADR notes. This is correct in intent, but the wording style is not always uniform, and different documents sometimes apply different levels of precision about what changed, when it changed, and which contract is currently live.

This creates avoidable interpretation risk for implementation and review, especially in areas with real historical transitions (for example, the Story 2.3 flat threshold language later superseded by Story 2.5's rate-relative rule, and the interaction between ADR-0010, ADR-0023, and queue/gate behavior around ADR-0020).

The project already has strong historical-record conventions in [`docs/adr/README.md`'s `## Conventions for changing an existing ADR` table](README.md) — seven explicit categories covering Decision changes, parameter tweaks, implicit-requirement clarifications, and forward/back supersession pointers. This ADR does **not** replace that table. It codifies the working pattern for *how* a story or ADR author should write the resulting entry in any of those seven categories, so the table's intent is applied uniformly in concrete prose rather than re-derived per-document.
The SocialEngage project has accumulated a large corpus of architecture decision records (ADRs) and user stories that frequently reference one another and occasionally supersede earlier acceptance criteria (ACs). The intent of these references is correct, but the wording style is not uniform: some notes use relative dates ("later"), vague AC identifiers ("the relevant AC"), or unowned "to be decided" placeholders. This creates avoidable interpretation risk for reviewers and implementers, especially where historical transitions exist (for example, the Story 2.3 flat-failure threshold later superseded by Story 2.5's rate-relative rule).

This BRD establishes the business need for a single, project-wide pattern for cross-story references and supersession language. The pattern is a documentation-authoring convention that makes every cross-dependency note precise, dated, and owned; preserves original decision text as a historical record; and defers to the existing governance table in `docs/adr/README.md` for deciding which of the seven supersession categories applies.

The value is faster, more reliable reviews and fewer mis-implementations caused by ambiguous contract fragments. No implementation code or user stories are required; the pattern takes effect immediately for all future ADR and story authoring.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Standardize supersession and cross-dependency language across all ADRs and user stories | 100% of new cross-dependency notes written after ADR-0047 acceptance conform to the four-field pattern |
| 2 | Reduce the risk of implementing outdated or ambiguous contract fragments | Zero acceptance of new documents containing unowned TBDs or vague supersession references after the adoption date |
| 3 | Preserve the historical record of original decisions while keeping the live contract unambiguous | All superseded ACs retain original text with a properly formatted obsolete marker or a dated appendix; live contract is always the last dated appendix |

---

**Positive consequences (from ADR):**
**Positive**
- Codifies a writing pattern already partially in practice across the series (Story 2.3 AC4, ADR-0009/0010 Pending supersession notes, ADR-0024/0026 Note on relation to ADR-0027, `docs/user-stories/README.md`'s "Known cross-story conflict" entry) so future contributors don't re-derive it per-document.
- Reduces accidental implementation against outdated contract fragments by requiring exact identifiers, dates, and implementation-status distinctions in every cross-dependency note.
- Prevents the "second governance document" risk by explicitly deferring to `docs/adr/README.md`'s seven-row table as the authority for which category applies.
- Eliminates the "unowned TBD" failure mode by requiring one of four named resolution forms for every known-conflict note (§3).
- Makes review outcomes less ambiguous when acceptance and implementation are separated in time (§2's implementation-status note).

**Negative**
- Slightly increases authoring overhead for story and ADR maintenance — every cross-dependency note now needs the four §2 fields plus, where applicable, a §3 resolution form.
- Requires disciplined updates whenever supersession occurs — a §1 in-place AC marker must be added at acceptance time, not "later when someone notices."
- §3's strict no-unowned-TBDs rule means a few existing "needs further discussion" notes scattered through older ADRs may surface during review and require back-fixing. Named explicitly as a consequence, not silently.

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Product Owner / Technical Lead) | ADR acceptance authority and project owner | High | Clear, enforceable conventions that reduce review overhead |
| Documentation Steward | Maintains corpus consistency and ADR/README hygiene | High | A single, unambiguous pattern and a way to audit conformance |
| ADR / Story Authors | Create and maintain ADRs and user stories | High | Concrete templates and worked examples to follow |
| Technical Reviewers | Review ADRs and stories before acceptance | High | Ability to reject documents that do not meet the precision standard |
| Implementers | Build against accepted stories and ADRs | Medium | Confidence that the cited contract fragment is the live one |

---

### 6.2 User Stories
No related user stories found.

## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| ADR markdown files | Architecture decision records containing Decision, Consequences, and appendix sections | `docs/adr/*.md` | ADR Author / Documentation Steward | Project governance record |
| User story markdown files | Epic-level story files containing ACs and cross-dependency notes | `docs/user-stories/epic-*.md` | Story Author / Product Owner | Project specification record |
| Amendment Log | Dated record of changes made to an ADR after acceptance | Within each ADR file | ADR Author / Documentation Steward | Project governance record |
| Obsolete markers | In-place parentheticals noting superseded ACs | Within affected story/ADR files | Story/ADR Author | Project specification record |
| Cross-dependency notes | References between stories, ADRs, and future work | Within affected story/ADR files | Story/ADR Author | Project specification record |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Bare "to be decided," "TBD," or "needs further discussion" notes with no concrete owner are not acceptable in any accepted document. |
| BRU-002 | Parameter tweaks are documented in the parent ADR's Amendment Log only; adding in-place obsolete markers to parameter changes is prohibited. |
| BRU-003 | If any wording in this pattern conflicts with `docs/adr/README.md`'s seven-row governance table, the README table wins and the relevant ADR is amended. |
| BRU-004 | Superseded AC text must not be deleted; it must be marked in place or struck through, with the new rule written immediately after the marker when still applicable. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `docs/adr/README.md` — the seven-row governance table that defines which supersession category applies | Internal | Documentation Steward | Already accepted and maintained |
| D-002 | `docs/user-stories/README.md` — contains the canonical "Known cross-story conflict — resolved, 2026-07-30" worked example | Internal | Documentation Steward | Already present |
| D-003 | Author and reviewer training on the new pattern | Internal | Product Owner / Documentation Steward | 2026-08-26 |
| D-004 | No product-research feature design or deep-research brief exists for this meta-ADR | N/A | N/A | N/A; not required because this is a documentation-authoring convention |

---

- All future ADR and story authors have access to the worked examples in ADR-0047 and `docs/user-stories/README.md`.
- The `docs/adr/README.md` governance table remains the authoritative reference for which of the seven supersession categories applies.
- All accepted ADRs and stories already carry a clear acceptance date.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All new ADRs and user stories created after ADR-0047 acceptance must follow this pattern | Compliance | Must | 100% of new documents with superseded ACs or cross-dependency notes pass a conformance review |
| NFR-002 | The pattern must not require a second governance document or change `docs/adr/README.md`'s table | Maintainability | Must | No changes to the seven-row governance table categories are introduced by this BRD |
| NFR-003 | Existing documents may be back-fixed as they are reviewed; no blanket rewrite of historical records is required | Maintainability | Should | Back-fixes are logged as dated clarifications or supersession updates without overwriting original text |

---

## 11. Error Handling and Exceptions
**Positive**
- Codifies a writing pattern already partially in practice across the series (Story 2.3 AC4, ADR-0009/0010 Pending supersession notes, ADR-0024/0026 Note on relation to ADR-0027, `docs/user-stories/README.md`'s "Known cross-story conflict" entry) so future contributors don't re-derive it per-document.
- Reduces accidental implementation against outdated contract fragments by requiring exact identifiers, dates, and implementation-status distinctions in every cross-dependency note.
- Prevents the "second governance document" risk by explicitly deferring to `docs/adr/README.md`'s seven-row table as the authority for which category applies.
- Eliminates the "unowned TBD" failure mode by requiring one of four named resolution forms for every known-conflict note (§3).
- Makes review outcomes less ambiguous when acceptance and implementation are separated in time (§2's implementation-status note).

**Negative**
- Slightly increases authoring overhead for story and ADR maintenance — every cross-dependency note now needs the four §2 fields plus, where applicable, a §3 resolution form.
- Requires disciplined updates whenever supersession occurs — a §1 in-place AC marker must be added at acceptance time, not "later when someone notices."
- §3's strict no-unowned-TBDs rule means a few existing "needs further discussion" notes scattered through older ADRs may surface during review and require back-fixing. Named explicitly as a consequence, not silently.

## 12. Assumptions and Dependencies
- All future ADR and story authors have access to the worked examples in ADR-0047 and `docs/user-stories/README.md`.
- The `docs/adr/README.md` governance table remains the authoritative reference for which of the seven supersession categories applies.
- All accepted ADRs and stories already carry a clear acceptance date.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Slight increase in authoring overhead for every cross-dependency note | High | Low | Provide worked examples from ADR-0047 and `docs/user-stories/README.md`; make the pattern checkable by reviewers | Documentation Steward |
| R-002 | Existing unowned TBDs in older ADRs surface during review and require back-fixing | Medium | Medium | Back-fix incrementally during normal review; do not rewrite original Decision text; log changes as dated clarifications | Documentation Steward |
| R-003 | A future contributor misinterprets this pattern as a new governance table, conflicting with `docs/adr/README.md` | Low | High | Explicitly state in every reference that the README table is the authority and this pattern only describes how to write entries | Documentation Steward |

---

## 14. Appendix
- ADR: `../../adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md`
- BRD: `../Business-Requirements/BRD-0047-Standard-Pattern-For-Cross-Story-References-And-Supersession-Language.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: _No related user stories found._