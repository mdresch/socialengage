# User Stories — Social Listening / Insights Subsystem

One user story per ADR (24 total — the original 23, plus Story 2.6 / ADR-0024, accepted 2026-07-30), grouped into 5 epics that mirror the thematic grouping already used in [`docs/adr/README.md`](../adr/README.md)'s Master Index. Each story cites its source ADR and carries that ADR's status forward.

Picking a story up to build it follows [`docs/implementation-methodology.md`](../implementation-methodology.md) — a Jest contract written from its Acceptance Criteria before any implementation code, a component `SKILL.md` kept current, and permanent regression coverage. Invoke the `implement-story` skill rather than implementing ad hoc.

## Status convention

A story sourced from an **Accepted** ADR is **Ready** — the decision is settled, the story can be picked up. **As of 2026-07-30, all 24 ADRs in this series are Accepted, so every story is Ready** — check each story's own Status line for the acceptance-date parenthetical and any scheduling note (e.g. Story 3.5 is Ready but scheduled for Phase 4, since storage volume rather than correctness is the driver). ADR-0017/0019 were accepted ahead of their natural implementation phase (see `docs/implementation-plan.md`'s Phase 0); ADR-0018 and ADR-0020–0023 were accepted on their normal schedule, each with its implementation-default open questions resolved at acceptance (see each ADR's own "Acceptance note"). **ADR-0024 (Story 2.6) is a genuine 24th addition, outside the original 23-ADR scope** — drafted and accepted the same day (2026-07-30), see its own Acceptance note and `docs/adr/README.md`'s footnote 6.

**Historical note — the "Blocked" status this section used to describe:** stories sourced from a still-Proposed ADR were **Blocked — pending ADR acceptance** until their source ADR was accepted; none remain in that state now. The **known cross-story conflict** that motivated calling this out explicitly is now resolved at the ADR level, not just theoretical — see below.

## Known cross-story conflict — resolved, 2026-07-30

Story 2.3 (ADR-0010's error/auto-disable policy) and Story 4.3 (ADR-0009's derived `ConnectorHealth`) were both built and shipped against the flat "≥10 failures/hour" rule, before ADR-0023 (Story 2.5's proportional, rate-relative threshold) was accepted. **Story 2.5 has now been implemented (2026-07-30)** — `connectorHealth.ts`'s `failing` derivation is the rate-relative rule (≥50% of ≥5 attempts, or ≥20 consecutive failures), per ADR-0009's and ADR-0010's "Supersession update" notes.

This did **not** silently rewrite Stories 2.3/4.3's contracts. Story 4.3's assertions needed no changes at all — its 10-pure-failures fixture still clears the new rule, just for a different underlying reason. Story 2.3's AC4 had exactly one assertion that couldn't survive under any rate-based rule ("9 failures still allowed" — the new rule already flags `failing` well before 9 pure failures) and was rewritten with new numbers to prove the same thing (auto-disable wiring + visible reason), under Story 2.5's own implementation, with a dated note in that file — not decided by the healing/editing pass on its own. See both files' own 2026-07-30 dated notes for the specifics.

## Epics

| Epic | Theme | ADRs |
|---|---|---|
| [1](epic-1-repository-and-api-foundation.md) | Repository & API Foundation | 0001, 0016, 0017 |
| [2](epic-2-ingestion-connectors-and-rate-limits.md) | Ingestion, Connectors & Rate Limits | 0002, 0003, 0010, 0020, 0023, 0024 |
| [3](epic-3-data-model-storage-and-archival.md) | Data Model, Storage & Archival | 0004, 0005, 0006, 0011, 0018, 0021 |
| [4](epic-4-derived-data-analytics-and-health.md) | Derived Data, Analytics & Health | 0007, 0008, 0009, 0022 |
| [5](epic-5-security-isolation-and-messaging.md) | Security, Isolation & Messaging | 0012, 0013, 0014, 0015, 0019 |
