# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0047 Standard Pattern for Cross-Story References and Supersession Language — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | AI Delivery Agent (FDD synthesis pass) |
| Reviewer(s) | Menno (Product Owner / Technical Lead), Documentation Steward |
| Status | Approved (ADR-0047 Accepted 2026-08-11; no-story, documentation-authoring convention, effective immediately) |
| Related Documents | ADR-0047, BRD-0047, `docs/adr/README.md` (governance table), `docs/user-stories/README.md` |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0047's decision and BRD-0047's business requirements into the functional design of a documentation-authoring convention: a standard, precise, dated, and owned pattern for writing supersession markers, cross-dependency notes, and known-conflict/TBD resolutions across every ADR and user story in this project. ADR-0047 is a no-story, meta-decision ADR (the same category as ADR-0027/ADR-0041) — it requires no code, no contract, and no implementation; it takes effect immediately as the working pattern for future authoring. This FDD documents that pattern as a functional specification of an authoring/review process, not a software feature.

### 2.2 Scope

- **In scope:** the exact wording pattern for in-place obsolete AC markers; the four required fields for any cross-dependency note; the four valid resolution forms for any known-conflict/TBD note; the "last dated appendix is the live contract" rule; the "preserve historical text, append clarifications" rule; explicit deference to `docs/adr/README.md`'s seven-row governance table.
- **Out of scope:** changes to `docs/adr/README.md`'s governance-table categories themselves; a strict AC-numbering convention (flagged as a separate future ADR if pursued); a lint/consistency script enforcing this pattern (explicitly deferred, named as "likely useful once the series exceeds ~50 ADRs" — a threshold now reached but still not acted on at this ADR's acceptance); any implementation code or contract tests.

### 2.3 Target Audience

Any ADR or user-story author (human or AI persona) writing a supersession marker, a Pending supersession note, a Note on relation, or a cross-story/cross-ADR dependency reference; reviewers checking such notes for conformance before acceptance; the Documentation Steward auditing corpus-wide consistency.

---

## 3. Context and Background

The project's ADR/story corpus already used terms like "supersession," "superseded AC," and "known cross-story conflict" correctly in intent, but with inconsistent precision: some notes quoted exact AC text, others used vague references like "the relevant AC"; some distinguished acceptance date from implementation date, others didn't; some known-conflict notes resolved to a named owner, others were bare, unowned "TBD"s. This created real interpretation risk, most concretely in the Story 2.3 flat-failure-threshold-later-superseded-by-Story-2.5's-rate-relative-rule transition, and in the ADR-0009/ADR-0010/ADR-0020/ADR-0023 queue/gate-behavior interactions.

`docs/adr/README.md`'s existing seven-row "Conventions for changing an existing ADR" table already governs **which** of seven categories (Decision change, parameter tweak, implicit-requirement clarification, forward/back supersession pointer, Note on relation, etc.) applies to a given change. ADR-0047 does not replace, extend, or override that table — it codifies **how** an author writes the resulting entry once the applicable category is identified, so the table's intent is applied uniformly in concrete prose rather than re-derived per document. A first draft of this ADR risked duplicating the README's table as a second governance document; it was revised in place before acceptance to explicitly defer to the README table as sole authority for category selection.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Standardize supersession and cross-dependency wording project-wide | All new cross-dependency notes conform to the four-field pattern |
| G2 | Eliminate unowned TBDs as a failure mode | Every known-conflict/open-question/TBD note resolves to one of four named forms |
| G3 | Make the live contract unambiguous when historical and current text diverge | The last dated appendix is always the live contract; no separate "current contract" sentence is introduced |
| G4 | Preserve historical accuracy | Original Decision/Consequences text and original AC text are never rewritten in place; changes are appended |
| G5 | Avoid creating a second governance document | This pattern explicitly defers to `docs/adr/README.md`'s seven-row table for category selection |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: In-Place Obsolete AC Marker (for a genuine Decision change)

- **Description:** Marks an acceptance criterion whose underlying Decision has been superseded, while preserving the original text as a historical record.
- **Triggers:** A parent ADR's Decision (not merely an adjustable parameter) changes in a way that supersedes a previously-written AC in a dependent story.
- **Inputs:** The original AC text; the supersession date; the superseding artifact (ADR/story number); a pointer to where the new rule lives.
- **Processing:** The original AC text remains as written. A parenthetical obsolete marker is added in the exact form: `(originally ...; superseded YYYY-MM-DD by <Story X.Y / ADR-NNNN>'s <specific rule> — see <pointer>)`. If the new rule is still applicable to the same scenario, the AC is rewritten with the new numbers/text immediately after the marker. If the AC no longer applies at all, it is struck through but kept in place, never deleted.
- **Outputs:** A dependent story's AC that carries both its original historical text and a precise, dated pointer to the currently-live rule.
- **Error handling:** A marker using different wording (e.g., "this no longer applies, see ADR-0023," with no date or specific rule named) is non-conforming and must be corrected before acceptance.
- **Edge cases:** Story 2.3's AC4 is the canonical worked example: `"(originally the flat ≥10/hour placeholder; superseded 2026-07-30 by Story 2.5's rate-relative rule — see that story below)"`.

### 5.2 Feature / Capability: Parameter-Tweak and Implicit-Clarification Handling (no in-place marker)

- **Description:** Distinguishes two cases that must NOT receive an in-place obsolete marker, to avoid cluttering the historical record without information value.
- **Triggers:** (a) An adjustable parameter changes without the underlying Decision changing (e.g., ADR-0017's deprecation window shortening from 6 months to 90 days); (b) an implicit requirement already logically required by a Decision is made explicit (a Clarification, README row 4).
- **Inputs:** The nature of the change (parameter vs. clarification vs. genuine Decision change) — determined by `docs/adr/README.md`'s seven-row table, not by this ADR.
- **Processing:** For a parameter tweak: record the change only in the parent ADR's own Amendment Log; no in-place AC marker anywhere. For an implicit-requirement clarification: add a new dated Clarification section to the parent ADR; leave dependent story AC text untouched unless the clarification actually rewrites the AC's intent.
- **Outputs:** A parent ADR's Amendment Log entry (parameter tweak) or dated Clarification section (implicit requirement), with no unnecessary AC-level churn.
- **Error handling:** Adding an in-place obsolete marker to a parameter-tweak change is a non-conformance to be corrected in review.
- **Edge cases:** Determining whether a given change is "genuinely a Decision change" vs. "a parameter tweak" vs. "an implicit clarification" is itself governed by the README's seven-row table, not by this feature — this feature only specifies what to write once that determination is made.

### 5.3 Feature / Capability: Cross-Dependency Note — Four Required Fields

- **Description:** Specifies the minimum precision every cross-dependency note (Pending supersession note, Supersession update, Note on relation to ADR-XXXX, or in-place AC marker) must carry.
- **Triggers:** Authoring any note that references another ADR or story as superseding, related to, or resolving the current document.
- **Inputs:** The AC or text fragment being referenced; the superseding/related artifact; its acceptance date; its implementation date (if different).
- **Processing:** The note must include: (1) an exact AC identifier or a literal quote of the referenced fragment — never a vague "the relevant AC"; (2) the superseding ADR/story identified by number (e.g., "ADR-0023," "Story 2.5") — never a bare narrative reference; (3) the decision (acceptance) date in `YYYY-MM-DD` format — never a relative "later"; (4) an implementation-status note whenever the acceptance date and the implementation date differ, per `docs/adr/README.md` row 6's own rule that shipped code changes are never assumed automatic.
- **Outputs:** A precisely dated, unambiguous cross-dependency note that a reviewer or implementer can act on without re-deriving context.
- **Error handling:** A note missing any of the four fields is non-conforming and must be corrected before the parent document is accepted.
- **Edge cases:** The canonical worked example is `docs/user-stories/README.md`'s "Known cross-story conflict — resolved, 2026-07-30" entry, which explicitly distinguishes the 2026-07-29 acceptance date from the 2026-07-30 implementation date and names both affected stories (Story 2.3/ADR-0010, Story 4.3/ADR-0009).

### 5.4 Feature / Capability: Named-Owner Resolution for Known Conflicts / TBDs

- **Description:** Forbids unowned "to be decided" notes and requires every known-conflict/open-question/TBD note to resolve to one of four concrete forms.
- **Triggers:** Authoring or reviewing a note that flags a known conflict, open question, or pending decision.
- **Inputs:** The nature of the resolution — already resolved, deferred to a specific future artifact, or a deliberate retained-as-obsolete choice.
- **Processing:** The note must state exactly one of: (1) **Resolved by** a named, accepted superseding ADR/story with its acceptance date; (2) **Deferred to** a named future story (which must then actually be drafted, or the note becomes a stale TBD); (3) **Deferred to** a named future ADR (which must actually be drafted before the referencing document ships, or the note is upgraded to a Pending supersession note per README row 5); (4) **Intentionally retained** as obsolete historical behavior — a deliberate, named design choice to keep old wording visible.
- **Outputs:** Every known-conflict note in an accepted document has a concrete, checkable owner.
- **Error handling:** A bare "TBD," "to be decided," or "needs further discussion" with no concrete owner is not acceptable; a reviewer encountering one must require it be converted to one of the four forms before acceptance.
- **Edge cases:** A "deferred to" reference that never materializes (the named future story/ADR is never actually drafted) is a real, named failure mode this rule exists to surface at review time, not eliminate structurally.

### 5.5 Feature / Capability: Live-Contract Determination — Last Dated Appendix

- **Description:** Establishes that where historical Decision text and a later appended note diverge, the last dated appendix (Clarification / Supersession update / Note on relation / in-place AC marker) is the live, currently-enforceable contract — never a separate top-of-file "current contract" sentence.
- **Triggers:** A reader or reviewer needs to determine what is currently enforceable in a document carrying one or more dated appendices.
- **Inputs:** The document's full history of appended dated sections, in chronological order.
- **Processing:** The most recent (last) dated appendix is authoritative. The original Decision text above it is preserved unedited as historical record and is never rewritten to match. No separate summary sentence is added at the top of the file, to avoid creating two competing sources of truth.
- **Outputs:** An unambiguous, single-source determination of "what's live right now" for any document with appended history.
- **Error handling:** N/A — this is an interpretation rule, not a runtime behavior; non-conformance would be a document that adds a competing top-of-file "current contract" sentence, which this rule forbids.
- **Edge cases:** The canonical worked example is ADR-0023, whose Acceptance note ("Story 2.5 has now been implemented (2026-07-30)...") is simultaneously the last dated appendix and the live contract, with no separate restatement anywhere else in the file.

### 5.6 Feature / Capability: Preserve Historical Text, Append Rather Than Rewrite

- **Description:** Restates, as a working-pattern commitment, the same rule already embodied in `docs/adr/README.md`'s "common thread": original Decision and Consequences text is never rewritten in place.
- **Triggers:** Any future change to an already-Accepted ADR or already-written story AC.
- **Inputs:** The nature of the change, per the README's seven-row table.
- **Processing:** Clarifications and supersession updates are always appended as new, dated sections (Clarification, Supersession update, Note on relation to ADR-XXXX, or an in-place AC marker per §5.1) — never as an edit to the original Decision/Consequences/AC text itself.
- **Outputs:** A document whose full history remains readable and auditable, with no silently-rewritten past decisions.
- **Error handling:** An edit that overwrites original Decision text (rather than appending a dated section) is a governance violation, not merely a style deviation.
- **Edge cases:** None beyond what the README's own governance table already covers — this feature exists so authors have a single place to check "am I allowed to edit this?" without re-deriving the answer from the README each time.

### 5.7 Feature / Capability: Deference to `docs/adr/README.md`'s Governance Table

- **Description:** Makes explicit that ADR-0047 does not extend, narrow, or override the README's seven-row table, which remains the sole authority for *which* supersession category applies to a given change.
- **Triggers:** Any apparent tension between this ADR's prose and the README's table.
- **Inputs:** The specific wording in question.
- **Processing:** Where tension exists, the README's table wins; ADR-0047 is amended via its own Amendment Log to match, not the other way around.
- **Outputs:** No competing governance document is ever created.
- **Error handling:** N/A — a structural precedence rule.
- **Edge cases:** If a proposed change doesn't fit any of the README's seven rows, that is itself a signal that a new row may belong in the README's table (a governance change) — not something to resolve inside this ADR's prose.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| ADR / Story Author (human or AI persona) | Writes supersession markers, cross-dependency notes, and conflict-resolution notes following this pattern |
| Technical Reviewer | Checks conformance before accepting a document; rejects non-conforming notes |
| Documentation Steward | Audits corpus-wide consistency; back-fixes older, non-conforming notes as they're reviewed |
| Menno (Product Owner / Technical Lead) | ADR acceptance authority |

### 6.2 User Stories / Use Cases

No user story exists for ADR-0047 — it is a deliberate no-story, meta-decision ADR, the same category as ADR-0027/ADR-0041, taking effect immediately as an authoring convention rather than through implementation work.

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| (no-story; authoring convention) | ADR/Story author | ...write cross-dependency notes using one consistent, precise pattern | ...reviewers and implementers never have to guess which contract fragment is live | Notes conform to §5.3's four fields, §5.4's four resolution forms, and §5.5's live-contract rule |

### 6.3 Workflow Diagrams / Steps

**Workflow: authoring a supersession note**

1. Author identifies that a change affects a prior ADR's Decision, a dependent story's AC, or both.
2. Author consults `docs/adr/README.md`'s seven-row table to determine which category applies (Decision change / parameter tweak / implicit clarification / forward-back pointer / Note on relation / etc.).
3. Based on the category:
   - Decision change superseding a dependent AC → author adds the in-place obsolete marker (§5.1) to the AC, using the exact wording pattern.
   - Parameter tweak → author records the change only in the parent ADR's Amendment Log (§5.2), no AC marker.
   - Implicit-requirement clarification → author adds a new dated Clarification section to the parent ADR (§5.2), leaving dependent AC text untouched unless intent changed.
4. Author writes any cross-dependency note (Pending supersession, Supersession update, Note on relation) with all four required fields (§5.3): exact identifier/quote, superseding artifact number, acceptance date, implementation-status note if dates differ.
5. If the note describes a known conflict or open question rather than a resolved supersession, author resolves it to one of the four named forms (§5.4) — never a bare TBD.
6. Reviewer checks the document against this pattern before acceptance; any non-conforming note (missing field, unowned TBD, wrong marker wording) is flagged and must be corrected before the document is accepted.
7. Once accepted, the document's last dated appendix (if any exist) is treated by every future reader as the live contract (§5.5); original text is never rewritten (§5.6).

---

## 7. Data Requirements

### 7.1 Data Inputs

Existing ADR markdown files (`docs/adr/*.md`); existing user-story markdown files (`docs/user-stories/epic-*.md`); the acceptance and implementation dates of referenced artifacts; `docs/adr/README.md`'s seven-row governance table.

### 7.2 Data Outputs

Updated ADR/story files carrying conformant obsolete markers, cross-dependency notes, dated Clarification/Supersession-update/Note-on-relation sections, and named-owner resolutions for known conflicts.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| ADR file (`docs/adr/NNNN-*.md`) | Decision text (immutable once Accepted); Consequences; Amendment Log; zero or more dated appendices (Clarification / Supersession update / Note on relation) | May reference and be referenced by other ADRs and stories; governed by `docs/adr/README.md`'s seven-row table |
| User story file / AC (`docs/user-stories/epic-*.md`) | Original AC text (immutable); zero or more in-place obsolete markers | Superseded by a later ADR/story per §5.1's marker pattern |
| Cross-dependency note | Four required fields: AC identifier/quote, superseding artifact number, acceptance date, implementation-status note (if applicable) | Embedded within an ADR or story file, pointing to another ADR/story |
| Known-conflict / TBD note | One of four resolution forms: resolved-by, deferred-to-story, deferred-to-ADR, intentionally-retained | Embedded within an ADR or story file |
| `docs/adr/README.md` governance table (not modified by this ADR) | Seven rows, each defining a category of ADR change and its required treatment | The sole authority for which category applies to a given change; this ADR only prescribes wording within a category |

### 7.4 Validation Rules

- An in-place obsolete marker must match the exact form: `(originally ...; superseded YYYY-MM-DD by <Story X.Y / ADR-NNNN>'s <specific rule> — see <pointer>)`.
- A cross-dependency note is incomplete (non-conforming) if it lacks any of: exact identifier/quote, numbered superseding artifact, `YYYY-MM-DD` acceptance date, or (when applicable) an implementation-status note.
- A known-conflict/TBD note is non-conforming if it does not resolve to exactly one of the four named forms.
- Original Decision/Consequences/AC text must never be edited in place to reflect a later change — only appended to.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A genuine Decision-change supersession requires an in-place obsolete marker on the affected AC, in the exact prescribed wording | ADR/story authors |
| BR2 | A parameter-tweak change is recorded only in the parent ADR's Amendment Log; no in-place AC marker is added | ADR/story authors |
| BR3 | An implicit-requirement clarification is recorded as a new dated Clarification section in the parent ADR; dependent AC text is unchanged unless intent changed | ADR/story authors |
| BR4 | Every cross-dependency note must include all four required fields (identifier/quote, artifact number, acceptance date, implementation-status note if applicable) | ADR/story authors, reviewers |
| BR5 | Every known-conflict/TBD note must resolve to one of the four named forms; a bare, unowned TBD is not acceptable in any accepted document | ADR/story authors, reviewers |
| BR6 | The last dated appendix in a document is the live contract; no separate top-of-file "current contract" sentence is added | Document readers, authors |
| BR7 | Original Decision/Consequences/AC text is never rewritten in place; changes are always appended as dated sections or in-place markers | ADR/story authors |
| BR8 | Where this ADR's prose conflicts with `docs/adr/README.md`'s seven-row table, the README wins and this ADR is amended to match | Governance precedence |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `docs/adr/README.md` | Governs | Sole authority for which of seven supersession categories applies | Markdown governance table |
| `docs/adr/*.md` (all ADR files) | Consumes/produces | Every future Decision-change, parameter-tweak, or clarification note follows this pattern | Markdown |
| `docs/user-stories/epic-*.md` (all story files) | Consumes/produces | Every future in-place AC obsolete marker follows this pattern | Markdown |
| `docs/user-stories/README.md` | Reference | Houses the canonical "Known cross-story conflict" worked example | Markdown |
| Documentation Steward review process | Consumes | Applies this pattern as a conformance checklist during corpus audits | Human/AI review process |

---

## 10. Non-Functional Considerations

- **Performance:** N/A — a documentation-authoring convention, not a runtime system.
- **Security / access control:** N/A.
- **Scalability:** Named directly in the ADR's own Open Questions — a lint/consistency script to mechanically flag unowned TBDs, incomplete cross-dependency notes, and non-conforming markers was judged "likely useful once the series exceeds ~50 ADRs." That threshold has since been reached but the script remains explicitly deferred, not built, at this ADR's acceptance.
- **Reliability / availability:** N/A.
- **Audit and logging:** Every change under this pattern is itself a dated, auditable Amendment Log entry or dated appendix — the pattern is self-documenting by construction.
- **Accessibility:** N/A.
- **Localization / internationalization:** N/A.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| A cross-dependency note uses a vague reference ("the relevant AC") instead of an exact identifier/quote | (Review-time finding, not a runtime error) | Reviewer rejects/requests correction before acceptance |
| A known-conflict note is a bare, unowned "TBD" | (Review-time finding) | Reviewer requires conversion to one of the four named resolution forms before acceptance |
| A supersession marker omits the date or superseding artifact number | (Review-time finding) | Reviewer requires the exact §5.1 wording pattern before acceptance |
| A document adds a separate top-of-file "current contract" sentence alongside dated appendices | (Review-time finding) | Non-conforming; the last dated appendix alone is the live contract, per §5.5 |
| Original Decision text is edited in place rather than appended to | (Review-time / governance finding) | Violates BR7; must be reverted and re-done as an appended dated section |

---

## 12. Assumptions and Dependencies

- All future ADR and story authors have access to the worked examples in ADR-0047 and `docs/user-stories/README.md`.
- `docs/adr/README.md`'s governance table remains the authoritative reference for which of the seven supersession categories applies.
- All accepted ADRs and stories already carry a clear acceptance date to build cross-dependency notes from.
- Depends on: `docs/adr/README.md` (governance table, already accepted/maintained), `docs/user-stories/README.md` (canonical worked example, already present).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should a strict AC-numbering convention (e.g., AC1/AC2 in every story) be introduced for even more precise cross-referencing? | Whoever pursues it | Deliberately not decided here — would require its own ADR, since it changes the metadata convention of every existing story file (an ADR-0017-governed breaking-change-to-record-format case) |
| Q2 | Should a lightweight lint/consistency script be built to mechanically flag unowned TBDs, incomplete cross-dependency notes, and non-conforming obsolete markers? | Engineering / Documentation Steward | Explicitly deferred; the ADR's own named "~50 ADRs" threshold has been reached but the script remains unbuilt at acceptance and is not decided by this FDD either |

---

## 14. Appendix

### Glossary

See BRD-0047 Section 15 for the full glossary (Supersession, Superseded AC, Obsolete marker, Cross-dependency note, Live contract, Unowned TBD, Acceptance date, Implementation date, Amendment Log, Historical record).

### Reference Links

- **ADR-0047:** `docs/adr/0047-standard-pattern-for-cross-story-references-and-supersession-language.md`
- **BRD-0047:** `docs/project docs/Business-Requirements/BRD-0047-Standard-Pattern-For-Cross-Story-References-And-Supersession-Language.md`
- **Governance authority:** `docs/adr/README.md` — "Conventions for changing an existing ADR" (seven-row table)
- **Canonical worked example:** `docs/user-stories/README.md` — "Known cross-story conflict — resolved, 2026-07-30"
- **Representative worked examples cited by the ADR:** Story 2.3/Story 2.5 (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`); ADR-0009/ADR-0010 (Pending supersession notes); ADR-0020 (deferred build-when-needed precedent); ADR-0023 (last-dated-appendix-as-live-contract example); ADR-0024/ADR-0026 (Note on relation to ADR-0027)

### Missing / Not Applicable Sources

- No `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file exists for ADR-0047 — it is a documentation-authoring convention, not a product feature, so neither is expected.
- No user story exists for ADR-0047; it is a deliberate no-story, meta-decision ADR.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | AI Delivery Agent | Regenerated as a genuine functional-design synthesis from ADR-0047 and BRD-0047, replacing a prior defective draft that duplicated the BRD's flat requirements table. |
