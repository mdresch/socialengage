---
name: implement-story
description: Use when picking up any User Story from docs/user-stories/ to implement in social-listening-core or social-listening-admin. Enforces minimal scope, an up-front intent statement, a Jest contract written before code, a component SKILL.md, and a permanent regression-suite entry — the project's mandatory implementation loop, not a suggestion.
---

# Implement Story

Full rationale lives in [`docs/implementation-methodology.md`](../../../docs/implementation-methodology.md) — read it once if this is your first time using this skill. This file is the operational checklist; that file is the "why."

**Args:** the story number, e.g. `2.1`. If not given, ask which story before proceeding — do not guess.

## Steps (do these in order; do not skip or reorder)

1. **Locate and read the story.** Find it in `docs/user-stories/epic-*.md` by number. Note its **Status** — if it says `Blocked — pending ADR-XXXX acceptance`, stop and tell the user; do not implement a story whose source ADR isn't Accepted. Read its Source ADR in full (`docs/adr/000X-*.md`), including any Amendment Log, Clarification, or Pending supersession note — those are load-bearing, not footnotes. If the Source ADR file cannot be located or contains no recognizable status field, stop and tell the user before proceeding.

2. **Scope.** List the exact files this story's Acceptance Criteria require touching. Nothing else. If you discover mid-implementation that something outside this list genuinely needs to change, stop, surface it to the user as a separate scoped item, and don't fold it in silently.

3. **State intent.** Before writing any test or code:
   - Add a `TodoWrite` entry: `Implement Story <X.Y>: <title>`.
   - Draft the Intent block (story, ADR, scope, contract-to-encode, explicitly-out-of-scope) per `docs/implementation-methodology.md` §2. This becomes the header comment of the contract test file in the next step — write it once, reuse it.

4. **Write the contract test first**, in `<repo>/contracts/epic-<N>/story-<X.Y>.<slug>.contract.test.ts`, one test per Acceptance Criterion; multiple assertions within a single test are allowed only when they test the same atomic behavior, with the Intent block as its header comment. If a file at that path already exists and belongs to a different story, stop and surface the naming conflict to the user before creating or overwriting any file. It should fail at this point — no implementation exists yet. That failure is expected and correct.

5. **Write or update the component's `SKILL.md`** at `<repo>/.claude/skills/<component-slug>/SKILL.md`, using [`docs/templates/component-skill-template.md`](../../../docs/templates/component-skill-template.md). If a `SKILL.md` for this component already exists (from a prior story), update it — don't create a duplicate. List this story's new contract file in it.

6. **Implement.** Write the minimal code to make the new contract pass. No speculative generalization, no untested branches, no drive-by refactors outside the Step 2 scope list.

7. **Validate.**
   - **7a.** Run the new contract and confirm it passes.
   - **7b.** Run the full accumulated contract suite for the repo (every `contracts/**/*.contract.test.ts` file, not just the new one). If anything fails — the new contract, an old one, lint, or typecheck — stop and invoke the **`heal-contract-failure`** skill rather than repairing it ad hoc here. Wait for explicit user confirmation before proceeding to Step 8.

8. **Update traceability.** Confirm — and correct if stale — the story's status/references in `docs/user-stories/README.md`, `docs/adr/README.md`, and `docs/implementation-plan.md`'s traceability table. A story isn't done if these three go stale. If this story's own entry in its epic file doesn't yet have a `**Built:**` field (`docs/user-stories/README.md`'s "Built convention," added 2026-08-13 — forward-only, so an untouched older story may genuinely lack one), add it now reading `**Built:** not yet` — Step 10 below finalizes it with the real date and commit hash once one exists. Don't guess the hash here; there isn't one yet.

9. **Commit.** Stage and commit the contract test, implementation, `SKILL.md`, and traceability updates together as one commit. Use a regular commit — not an interactive rebase, not a squash-in-progress — since the next step needs this exact commit's hash to stay valid through merge (see `docs/implementation-log.md`'s merge-strategy note).

10. **Log it.** Run `git rev-parse HEAD` and `git show --stat --format= HEAD` to get the commit hash and the actual file list git recorded. Append an entry to `docs/implementation-log.md` (in the docs repo checkout) using the exact field format that file specifies — commit hash, repo, story/ADR, contract, `SKILL.md`, files touched (from git's own output, not from memory of what you intended to touch), full suite result. This is an append, never an edit to an existing entry. Using this same commit hash, update the story's `**Built:** not yet` field (set in Step 8) to `**Built:** YYYY-MM-DD — <repo>@<short-hash>` — the same hash just used for the log entry, so the two can never disagree. This edit lands in the same follow-up commit as the log entry, per this project's established two-commit pattern (implementation commit, then a separate traceability/log commit).

11. **Report back concisely**: which story, which files touched, which contract file was added, whether the full suite passed, which `SKILL.md` was created/updated, and the commit hash + Implementation Log entry. Don't narrate the whole loop — just the outcome and any deviations from it.

## Hard rules, not preferences

- Never write implementation code before its contract test exists and fails for the right reason (missing behavior, not a typo).
- Never touch a file outside the Step 2 scope list without explicitly flagging it first.
- Never delete or silently rewrite a passing contract from an earlier story — see `docs/implementation-methodology.md`'s "Regression, not rewrite" convention. Changing one requires a dated note pointing to the ADR change that justifies it.
- Never mark a Blocked story's work as started.
- Never report a story as done without an Implementation Log entry that names the real commit hash — "I finished it" is not the same claim as "here's the commit, verify it yourself."
- Never edit or remove an existing Implementation Log entry, including your own from earlier in the same session. Append only.
