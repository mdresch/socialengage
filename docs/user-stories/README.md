# User Stories — Social Listening / Insights Subsystem

One user story per ADR (23 total), grouped into 5 epics that mirror the thematic grouping already used in [`docs/adr/README.md`](../adr/README.md)'s Master Index. Each story cites its source ADR and carries that ADR's status forward.

Picking a story up to build it follows [`docs/implementation-methodology.md`](../implementation-methodology.md) — a Jest contract written from its Acceptance Criteria before any implementation code, a component `SKILL.md` kept current, and permanent regression coverage. Invoke the `implement-story` skill rather than implementing ad hoc.

## Status convention

A story sourced from an **Accepted** ADR is **Ready** — the decision is settled, the story can be picked up. As of 2026-07-29 this includes ADR-0017 and ADR-0019, accepted ahead of their natural implementation phase (see `docs/implementation-plan.md`'s Phase 0) — so "Ready" no longer means strictly 0001–0016; check each story's own Status line rather than assuming by ADR number.

A story sourced from a **Proposed** ADR (0018, 0020–0023) is **Blocked — pending ADR acceptance**. Writing the story doesn't imply the decision is made; it means the story is *drafted and waiting*. Don't schedule a Blocked story into a sprint until its source ADR's status changes to Accepted. Three stories in this set (2.3, 4.3, and 2.5) cross-reference each other because two Accepted ADRs' current behavior (0009's derivation logic and 0010's auto-disable policy, both using a flat "≥10 failures/hour" rule) would be superseded by a Proposed ADR (0023's proportional rule) if it's accepted — implementing 2.3/4.3 today is correct as written, but shouldn't be considered final if 2.5 later gets accepted.

## Epics

| Epic | Theme | ADRs |
|---|---|---|
| [1](epic-1-repository-and-api-foundation.md) | Repository & API Foundation | 0001, 0016, 0017 |
| [2](epic-2-ingestion-connectors-and-rate-limits.md) | Ingestion, Connectors & Rate Limits | 0002, 0003, 0010, 0020, 0023 |
| [3](epic-3-data-model-storage-and-archival.md) | Data Model, Storage & Archival | 0004, 0005, 0006, 0011, 0018, 0021 |
| [4](epic-4-derived-data-analytics-and-health.md) | Derived Data, Analytics & Health | 0007, 0008, 0009, 0022 |
| [5](epic-5-security-isolation-and-messaging.md) | Security, Isolation & Messaging | 0012, 0013, 0014, 0015, 0019 |

## Known cross-story conflict (flagged, not resolved)

Story 2.3 (ADR-0010's error/auto-disable policy) and Story 4.3 (ADR-0009's derived `ConnectorHealth`) both use the flat "≥10 failures/hour" rule, and Story 2.5 (ADR-0023's proportional, rate-relative threshold) would replace that exact rule. All three describe the same mechanism differently. 2.3 and 4.3 are Ready because ADR-0009/0010 are Accepted; 2.5 is Blocked because ADR-0023 is Proposed. If ADR-0023 is later accepted, both 2.3's and 4.3's acceptance criteria need updating to match — this set doesn't silently resolve that for you.
