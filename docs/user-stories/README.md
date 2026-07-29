# User Stories — Social Listening / Insights Subsystem

One user story per ADR (23 total), grouped into 5 epics that mirror the thematic grouping already used in [`docs/adr/README.md`](../adr/README.md)'s Master Index. Each story cites its source ADR and carries that ADR's status forward.

Picking a story up to build it follows [`docs/implementation-methodology.md`](../implementation-methodology.md) — a Jest contract written from its Acceptance Criteria before any implementation code, a component `SKILL.md` kept current, and permanent regression coverage. Invoke the `implement-story` skill rather than implementing ad hoc.

## Status convention

A story sourced from an **Accepted** ADR is **Ready** — the decision is settled, the story can be picked up. **As of 2026-07-29, all 23 ADRs in this series are Accepted, so every story is Ready** — check each story's own Status line for the acceptance-date parenthetical and any scheduling note (e.g. Story 3.5 is Ready but scheduled for Phase 4, since storage volume rather than correctness is the driver). ADR-0017/0019 were accepted ahead of their natural implementation phase (see `docs/implementation-plan.md`'s Phase 0); ADR-0018 and ADR-0020–0023 were accepted on their normal schedule, each with its implementation-default open questions resolved at acceptance (see each ADR's own "Acceptance note").

**Historical note — the "Blocked" status this section used to describe:** stories sourced from a still-Proposed ADR were **Blocked — pending ADR acceptance** until their source ADR was accepted; none remain in that state now. The **known cross-story conflict** that motivated calling this out explicitly is now resolved at the ADR level, not just theoretical — see below.

## Known cross-story conflict — resolved at the ADR level, not yet at the code level

Story 2.3 (ADR-0010's error/auto-disable policy) and Story 4.3 (ADR-0009's derived `ConnectorHealth`) were both built and shipped against the flat "≥10 failures/hour" rule, before ADR-0023 (Story 2.5's proportional, rate-relative threshold) was accepted. **ADR-0023 is now Accepted (2026-07-29)** and, per its own "Relationship to existing ADRs" note, partially supersedes that flat rule in both ADR-0009 and ADR-0010 (see each ADR's "Supersession update" note) — Story 2.5 is now Ready, not Blocked.

This does **not** silently change Stories 2.3/4.3's already-shipped code or contracts: they stay exactly as built, using the flat rule, until Story 2.5 is actually picked up and implemented — at which point healing 2.3/4.3's implementation to the new rule is part of that story's own scope (via the `heal-contract-failure` skill, since it touches already-passing contracts), not a side effect of this documentation update. Both stories' own italic notes point here.

## Epics

| Epic | Theme | ADRs |
|---|---|---|
| [1](epic-1-repository-and-api-foundation.md) | Repository & API Foundation | 0001, 0016, 0017 |
| [2](epic-2-ingestion-connectors-and-rate-limits.md) | Ingestion, Connectors & Rate Limits | 0002, 0003, 0010, 0020, 0023 |
| [3](epic-3-data-model-storage-and-archival.md) | Data Model, Storage & Archival | 0004, 0005, 0006, 0011, 0018, 0021 |
| [4](epic-4-derived-data-analytics-and-health.md) | Derived Data, Analytics & Health | 0007, 0008, 0009, 0022 |
| [5](epic-5-security-isolation-and-messaging.md) | Security, Isolation & Messaging | 0012, 0013, 0014, 0015, 0019 |
