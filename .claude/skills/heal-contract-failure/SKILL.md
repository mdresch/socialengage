---
name: heal-contract-failure
description: Use when a contract test, the accumulated contract suite, a lint/typecheck step, CI, or the enforce-contract-first hook is failing/blocking and needs to be resolved — or when resuming a story a prior session left mid-implementation, uncommitted, because that session ended (e.g. a usage-quota cutoff) before Step 9's commit. Re-walks Intent (ADR/BRD/FDD/Story), Contract, Skill, and Implementation in that fixed order for every failure — no classifying the failure and jumping to a shortcut patch.
---

# Heal Contract Failure

Full rationale lives in [`docs/implementation-methodology.md`](../../../docs/implementation-methodology.md)'s "On failure" and "Resuming a story interrupted before commit" sections — read it if this is your first time. This file is the operational checklist.

**Resuming interrupted work is the same entry point as a red check, not a different one.** If you're picking up a story that has uncommitted changes on disk from a prior session but no failing check triggered this pass, don't assume that state is correct just because nothing turned red — a session ending mid-story (a usage-quota cutoff is the concrete case this project actually hits) leaves state exactly as unverified as a red check does. Start at Step 1 below the same way, then walk 2–5 before ever touching Step 7's commit.

**The one rule that overrides everything else in this skill:** fix the underlying thing, never the check. If you find yourself editing a contract test's assertions, a hook's logic, a lint rule, or a CI gate in order to make a failure go away — stop. That's not a repair; it's the hard-stop condition in Step 6.

**Do not classify the failure and jump to a patch.** Walk all five steps below, in order, every time — including when the cause looks obvious. "Obvious" is exactly the assumption that lets a stale Intent or a wrong Contract slide through while you patch the symptom one step later.

**Retry cap: 3 full walks of Steps 1–5 for this failure, then mandatory escalation — no 4th attempt.** Before starting, check whether a todo item already exists for this failure from an earlier attempt this session; if so, this is attempt 2 or 3, not attempt 1. Log a fresh todo entry per attempt with title `Healing attempt N: <what's failing> — <hypothesis>`.

## Steps — fixed order, no skipping

0. **Before Step 1, if the failure smells environmental** (times out only sometimes, only fails under the full suite / parallel run, only started after touching auth/Azure CLI/a dependency version) — check [`docs/environment-gotchas.md`](../../../docs/environment-gotchas.md) first. If this failure turns out to be a *new* environmental root cause, add it there once healed.

1. **Re-validate Intent against the 4-tier Specification Pyramid.**
   - Open the failing contract's Intent header comment.
   - **Source ADR:** Re-read its Source ADR in `docs/adr/00XX-*.md` *fresh* — including architectural invariants, schema rules, and Amendment Logs.
   - **Business Requirements (BRD):** Re-read `docs/project docs/Business-Requirements/BRD-00XX-*.md` for business rules (`BRU-xxx`) and role access.
   - **Functional Design (FDD):** Re-read `docs/project docs/Functional-Design/FDD-00XX-*.md` for TypeScript Request/Response schemas, error payloads, and edge cases.
   - **User Story:** Re-read the story in `docs/user-stories/epic-*.md` for Acceptance Criteria ($AC_0 \dots AC_n$).
   - *Hierarchy:* ADR > BRD/FDD > Story. If the Intent block drifted from these specifications, that mismatch is the root cause. Surface it before touching code.

2. **Re-validate the Contract.** Re-read the failing contract test against the Acceptance Criteria and FDD schemas you just re-fetched — not against what the test already asserts. Does it genuinely encode the story's *current* promises? If the contract itself looks wrong or stale: do not edit it unilaterally. That requires a dated note pointing to a specific ADR change, with the user's explicit sign-off — go to Step 6 instead.

3. **Re-validate the component `SKILL.md`.** Check it against [`docs/templates/component-skill-template.md`](../../../docs/templates/component-skill-template.md)'s required sections: governing ADRs/Stories, the contract files that constrain it, extension guidance, load-bearing constraints, and real call-site relationships. Update it if stale.

4. **Re-validate and fix the implementation.** Proceed only if Steps 1–3 confirm a contract exists and the target is correct. Make the minimal code change in `<repo>/src/**` that satisfies that contract. Avoid speculative generalization or scope expansion.

5. **Validate with Isolated Postgres Template Database Cloning.**
   Run the specific contract that was failing:
   ```bash
   npm test <path-to-contract>
   ```
   (Uses the $< 30\text{ ms}$ native Postgres Template DB clone on port `5434`).
   - Run the epic contract suite: `npm test contracts/epic-<N>`.
   - Run the full accumulated suite if shared files outside the epic were modified.
   - If a contract outside this story fails, follow the **Cross-Component Regression Protocol** below.

## Cross-Component Regression Protocol

When a contract from a different story or component fails after your changes:
- **Attribute first.** Compare what you just modified against what the foreign contract exercises.
- **Default remedy: narrow the new change, not the foreign component.** The foreign contract was already passing and is presumed correct — adjust the current story's code. Do not weaken the foreign contract.
- **Separate attempt budget:** Create a separate todo `Healing attempt N: regression in <foreign contract> caused by <this story>`.
- **When resolved**, re-run the full contract suite.

## Hard Stop Conditions

6a. **Hard stop — cheating:** if getting to green at any point would mean weakening, skipping, deleting, or bypassing a contract's assertions, a hook, a lint rule, or a CI gate — stop right there. Do not finish the sequence by force.

6b. **Hard stop — attempt cap:** if Step 5 just failed for the 3rd time on this failure, stop. Do not start a 4th walk regardless of how promising the next idea seems.

7. **Commit and log — only on a genuine pass, never after a 6a/6b stop.**
   One commit, not two (`docs/implementation-methodology.md` §7 / its 2026-09-09 Amendment Log entry): run `npm run sync` first, append the `docs/implementation-log.md` entry with `— commit pending` / `` **Full commit:** `pending` `` (the real hash isn't known until this commit exists), then stage and commit the fix, the log entry, and the dashboard-sync output together. Run `git rev-parse HEAD` afterward for your own Step 9 report — `scripts/git-hooks/pre-commit` backfills the `pending` placeholder into whichever commit runs next; don't create a follow-up commit just for the hash.

8. **Merge & Teardown (if in a Git Worktree).**
   If running in an isolated worktree (`feat/story-X.Y`), merge cleanly into `main` and remove the worktree.

9. **Report back concisely.** State which steps needed repair, files changed, commit hash, Implementation Log entry, and test suite result.
