# ADR-0047: Standard pattern for cross-story references and supersession language

**Status:** Proposed — drafted 2026-08-08 from backlog input provided by Menno; pending review and acceptance.
**Source:** Backlog proposal: "Standard Pattern for Cross-Story References and Supersession Language" (focused on Epic 2 cross-story dependency clarity: Stories 2.3, 2.4, 2.5; ADR-0010, ADR-0020, ADR-0023).

## Context

The current corpus uses terms such as "supersession," "superseded AC," and "known cross-story conflict" across several stories and ADR notes. This is correct in intent, but the wording style is not always uniform, and different documents sometimes apply different levels of precision about what changed, when it changed, and which contract is currently live.

This creates avoidable interpretation risk for implementation and review, especially in areas with real historical transitions (for example, the Story 2.3 flat threshold language later superseded by Story 2.5's rate-relative rule, and the interaction between ADR-0010, ADR-0023, and queue/gate behavior around ADR-0020).

The project already has strong historical-record conventions in [docs/adr/README.md](README.md), but it does not yet define one explicit, reusable authoring pattern for cross-story supersession notes inside story files and linked ADR references.

## Decision

Adopt a standard authoring pattern for all future cross-story references and supersession language in story files and ADR notes:

1. **Mark superseded acceptance criteria as obsolete in place.**
   The original acceptance criterion text remains (historical record preserved), but it must carry an explicit obsolete marker and a direct pointer to the replacing story/ADR.

2. **Name exact references and dates.**
   Any cross-dependency note must include:
   - exact AC identifier or quoted AC text fragment,
   - superseding ADR/story identifier,
   - decision date (acceptance date),
   - implementation-status note when acceptance and implementation happened at different times.

3. **Resolve every known-conflict note to a concrete path.**
   A known-conflict note must always state one of:
   - resolved by accepted superseding ADR/story,
   - deferred to a named future story,
   - intentionally retained as obsolete historical behavior.
   Ambiguous "to be decided" conflict notes are not allowed without a named owner artifact.

4. **State the live contract explicitly.**
   Where historical and live rules coexist in one document, include one explicit sentence naming the currently enforceable contract so implementers do not infer from older phrasing.

5. **Preserve historical text; append clarifications.**
   This ADR does not permit rewriting prior decision history. Clarifications and supersession updates are appended using the existing governance style already documented in [docs/adr/README.md](README.md).

## Consequences

**Positive**
- Improves traceability between story ACs and superseding ADR/story decisions.
- Reduces accidental implementation against outdated contract fragments.
- Makes review outcomes less ambiguous when acceptance and implementation are separated in time.
- Improves onboarding clarity for contributors and downstream integrators.

**Negative**
- Slightly increases authoring overhead for story and ADR maintenance.
- Requires disciplined updates whenever supersession occurs.

## Scope and applicability

This pattern applies project-wide, and is immediately relevant to Epic 2 materials that currently reference supersession logic (notably Stories 2.3, 2.4, 2.5 and their linked ADRs).

## Open questions for decision

- Whether to introduce a strict AC label convention (for example, AC1/AC2 numbering in every story) to make cross-document references even more precise.
- Whether to add a lightweight lint/check script that flags unresolved "known conflict" notes without a named resolution artifact.

## Amendment Log

- 2026-08-08 — Initial proposal drafted from backlog input; left Proposed pending acceptance.
