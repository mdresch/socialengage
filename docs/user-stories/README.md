# User Stories — Social Listening / Insights Subsystem

One user story per ADR (26 stories total — the original 23, plus Story 2.6 / ADR-0024 and Story 1.4 / ADR-0025 (both accepted 2026-07-30), and Story 2.7 / ADR-0026 (drafted 2026-07-31, accepted later the same day)), grouped into 5 epics that mirror the thematic grouping already used in [`docs/adr/README.md`](../adr/README.md)'s Master Index. Each story cites its source ADR and carries that ADR's status forward. **27 ADRs now exist** (see the Exception note immediately below) — ADR-0027 is the one without a story.

**Exception, 2026-08-01: ADR-0027 has no story.** ADR-0027 (connector architecture is a technical intermediary only, never a contracting party — drafted and Accepted 2026-08-01, same day) is the first ADR in this series that does not generate a user story: it introduces no interface, stored field, endpoint, or provider selection, only a constraint already satisfied by the connectors that exist today (ADR-0024, ADR-0026) without any code change. The "one user story per ADR" convention above still holds for ADRs 0001–0026; ADR-0027 is a named, flagged departure from it, not a silent gap — see ADR-0027's own "A note on this ADR's own place in the series' conventions" section and `docs/adr/README.md`'s footnote 9. At acceptance, Menno's own call was to leave this as a documented, named exception rather than write a permanent "non-story ADR" convention — one instance isn't enough to generalize from.

Picking a story up to build it follows [`docs/implementation-methodology.md`](../implementation-methodology.md) — a Jest contract written from its Acceptance Criteria before any implementation code, a component `SKILL.md` kept current, and permanent regression coverage. Invoke the `implement-story` skill rather than implementing ad hoc.

## Status convention

A story sourced from an **Accepted** ADR is **Ready** — the decision is settled, the story can be picked up. **As of 2026-07-30, all 25 of the then-existing ADRs in this series were Accepted, so every story was Ready** — check each story's own Status line for the acceptance-date parenthetical and any scheduling note (e.g. Story 3.5 is Ready but scheduled for Phase 4, since storage volume rather than correctness is the driver). ADR-0017/0019 were accepted ahead of their natural implementation phase (see `docs/implementation-plan.md`'s Phase 0); ADR-0018 and ADR-0020–0023 were accepted on their normal schedule, each with its implementation-default open questions resolved at acceptance (see each ADR's own "Acceptance note"). **ADR-0024 (Story 2.6) and ADR-0025 (Story 1.4) are genuine 24th/25th additions, outside the original 23-ADR scope** — both drafted and accepted the same day they were written (2026-07-30), see each one's own Acceptance note and `docs/adr/README.md`'s footnotes 6/7. Unlike every other ADR in this series, ADR-0025's own subject is dev tooling, not production architecture — a deliberate, named exception to this project's usual "architecturally significant only" bar, not a lowering of it (see ADR-0025's Acceptance note).

**Historical note, 2026-07-31 — Story 2.7 was briefly Blocked again.** Unlike ADR-0024/0025, ADR-0026 was drafted by the AI Business & Requirements Analyst persona, which does not hold ADR-acceptance authority under its own charter — it was deliberately left Proposed for Menno's review rather than self-accepted the same day, the first time this series' otherwise-unbroken "drafted and accepted same day" pattern (footnotes 6/7) hadn't applied. Menno reviewed and accepted ADR-0026 later the same day (2026-07-31); Story 2.7 is now Ready. **All 26 of 26 stories are Ready as of 2026-07-31.**

**Historical note — the "Blocked" status this section used to describe:** stories sourced from a still-Proposed ADR were **Blocked — pending ADR acceptance** from 2026-07-28 until 2026-07-30, and again briefly for Story 2.7 alone between drafting and Menno's review on 2026-07-31 — a real re-occurrence, not a stale description of a past state only. The **known cross-story conflict** that motivated calling this out explicitly is now resolved at the ADR level, not just theoretical — see below.

## Known cross-story conflict — resolved, 2026-07-30

Story 2.3 (ADR-0010's error/auto-disable policy) and Story 4.3 (ADR-0009's derived `ConnectorHealth`) were both built and shipped against the flat "≥10 failures/hour" rule, before ADR-0023 (Story 2.5's proportional, rate-relative threshold) was accepted. **Story 2.5 has now been implemented (2026-07-30)** — `connectorHealth.ts`'s `failing` derivation is the rate-relative rule (≥50% of ≥5 attempts, or ≥20 consecutive failures), per ADR-0009's and ADR-0010's "Supersession update" notes.

This did **not** silently rewrite Stories 2.3/4.3's contracts. Story 4.3's assertions needed no changes at all — its 10-pure-failures fixture still clears the new rule, just for a different underlying reason. Story 2.3's AC4 had exactly one assertion that couldn't survive under any rate-based rule ("9 failures still allowed" — the new rule already flags `failing` well before 9 pure failures) and was rewritten with new numbers to prove the same thing (auto-disable wiring + visible reason), under Story 2.5's own implementation, with a dated note in that file — not decided by the healing/editing pass on its own. See both files' own 2026-07-30 dated notes for the specifics.

## Epics

| Epic | Theme | ADRs |
|---|---|---|
| [1](epic-1-repository-and-api-foundation.md) | Repository & API Foundation | 0001, 0016, 0017, 0025 |
| [2](epic-2-ingestion-connectors-and-rate-limits.md) | Ingestion, Connectors & Rate Limits | 0002, 0003, 0010, 0020, 0023, 0024, 0026 |
| [3](epic-3-data-model-storage-and-archival.md) | Data Model, Storage & Archival | 0004, 0005, 0006, 0011, 0018, 0021 |
| [4](epic-4-derived-data-analytics-and-health.md) | Derived Data, Analytics & Health | 0007, 0008, 0009, 0022 |
| [5](epic-5-security-isolation-and-messaging.md) | Security, Isolation & Messaging | 0012, 0013, 0014, 0015, 0019 |
