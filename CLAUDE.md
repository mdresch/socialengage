# socialengage — Social Listening / Insights subsystem

Solo-developer, self-funded personal project. Rebuild of the discontinued Microsoft Social Engagement, starting with one subsystem (Social Listening / Insights) of a planned four. **Status: Phase 0 sealed — planning corpus complete, zero implementation code exists yet.** Tag `phase-0-baseline` marks that commit.

## Read these before doing anything else

1. [`docs/implementation-methodology.md`](docs/implementation-methodology.md) — **how** work gets done: contract-first TDD, component `SKILL.md`s, permanent regression suite, bounded self-healing, hash-anchored Implementation Log. This is not optional background reading — it's the process this repo enforces.
2. [`docs/implementation-plan.md`](docs/implementation-plan.md) — **what and when**: 6 phases, story-by-story, dependency-ordered. No calendar dates.
3. [`docs/adr/README.md`](docs/adr/README.md) — 25 ADRs (Accepted decisions + Proposed policy awaiting acceptance), plus the governance conventions for changing one.
4. [`docs/user-stories/README.md`](docs/user-stories/README.md) — 25 stories, one per ADR, grouped into 5 epics. Each carries its source ADR's status forward (Ready vs. Blocked).

## Mandatory workflow — do not freelance

- **Picking up any story:** invoke the `implement-story` skill. Do not write implementation code by hand outside it.
- **Anything failing** (a contract, the accumulated suite, lint, CI, or the `enforce-contract-first` hook blocking a write): invoke the `heal-contract-failure` skill. Do not patch it ad hoc.
- A `PreToolUse` hook (`.claude/hooks/enforce-contract-first.cjs`) mechanically blocks writes to `<repo>/src/**` before any contract test exists in that repo — this is enforced, not just documented. If it doesn't seem to be firing in a fresh session, run `/hooks` once to reload config.
- Both skills end by appending to [`docs/implementation-log.md`](docs/implementation-log.md) — commit hash, files touched, verified against git by `docs/templates/check-implementation-log.cjs`, not just asserted. It's currently empty; the first entry gets added by whichever skill closes the first story.

## Map

- `docs/project docs/` — design spec + business case/charter/stakeholder register (context, not process)
- `docs/adr/` — 25 ADRs
- `docs/user-stories/` — 25 stories, 5 epics
- `docs/implementation-plan.md`, `docs/implementation-methodology.md`, `docs/implementation-log.md`
- `docs/templates/` — CI workflow, pre-commit hook, traceability/log verification scripts — copy into `social-listening-core`/`social-listening-admin` when Phase 0 creates them (not created yet)
- `.claude/skills/implement-story/`, `.claude/skills/heal-contract-failure/` — the two mandatory skills
- `.claude/hooks/enforce-contract-first.cjs` + `.claude/settings.json` — the real-time enforcement hook

## Facts worth not re-deriving

- Two separate repos (`social-listening-core` backend, `social-listening-admin` Next.js UI) — ADR-0001. Neither exists on disk yet; they're expected as subdirectories of this workspace (see `enforce-contract-first.cjs`'s path assumptions).
- TypeScript/Node.js throughout, Azure-native (Postgres + RLS, Key Vault, Service Bus, Azure AI Language) — ADR-0016, ADR-0015, ADR-0014, spec §2.
- Multi-tenant with database-level isolation as a from-day-one property, not retrofitted — ADR-0015.
- Connector order decided: RSS/News first, then Reddit — spec §10, `implementation-plan.md` Phase 1.
- Solo project shapes several decisions directly — lightweight CI (no CODEOWNERS, no OpenAPI governance yet), and ADR-0020's distributed rate-limit gate is explicitly deferred until a second concurrent instance is ever actually run, not built speculatively.
