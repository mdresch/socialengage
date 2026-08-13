# Component `SKILL.md` template

Copy this into `<repo>/.claude/skills/<component-slug>/SKILL.md` the first time a story touches a given component (per `docs/implementation-methodology.md` Step 4 / the `implement-story` skill's Step 5). Update it, don't duplicate it, on every subsequent story that touches the same component. This is a template file, not itself an invokable skill — it isn't placed under `.claude/skills/`.

---

```markdown
---
name: <component-slug>
description: <One line: what this component is and when an agent should read this before touching it. This is what makes the skill discoverable — be specific.>
---

# <Component name>

## What this is

<Two or three sentences: what this component does, where it sits in the pipeline (§2's data-flow diagram is a good reference point), and why it exists.>

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-00XX | <one-line summary> | X.Y |

<Add a row per ADR/story that shaped this component. If an ADR has a Pending supersession note or Amendment Log entry relevant to this component, name it explicitly here — don't make a future reader go find it.>

## Contracts that constrain this component

- `contracts/epic-N/story-X.Y.<slug>.contract.test.ts` — <one line: what behavior this locks down>

<List every contract file touching this component. This list is the actual safety net — anything not covered by a contract here is not guaranteed to survive a future change.>

## How to extend this safely

<Concrete, specific guidance for the next agent: what the safe extension points are (e.g., "implement `SocialConnector` and register it — see ADR-0002"), and what requires re-reading an ADR first rather than just coding (e.g., "changing anything about how `rawPayload` is stored requires checking ADR-0016 and ADR-0018's tiering rules first").>

## Load-bearing constraints — do not change casually

<The specific invariants this component depends on that aren't obvious from the code alone: e.g., "RequestGate state must be per-(tenantId, providerId) — see ADR-0003" or "ConnectorHealth must never be written to directly, only derived — see ADR-0009." If breaking one of these wouldn't fail a contract test today but would violate the ADR's actual intent, say so explicitly here.>

## Known gaps / deferred work

<Anything intentionally left undone for this component, with a pointer to why — e.g., "distributed RequestGate state (ADR-0020) not yet built; see its solo-project Amendment Log note in docs/implementation-plan.md Phase 4."

## Relations to other components

<Which other components this one calls into, and which call into it — the real dependency graph, not a conceptual one. Per docs/implementation-methodology.md's relationship-assertion convention (added 2026-08-13): every entry here describing a real call relationship must be backed by at least one contract asserting it at the real production call site, not only the isolated function. If a relationship predates that convention and isn't yet backed, say so explicitly here — "claimed, not yet verified by a real-call-site contract" — rather than letting the omission read as checked.>
```
