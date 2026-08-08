---
name: heal-contract-failure
description: Use when a contract test, the accumulated contract suite, a lint/typecheck step, CI, or the enforce-contract-first hook is failing/blocking and needs to be resolved. Re-walks Intent, Contract, Skill, and Implementation in that fixed order for every failure — no classifying the failure and jumping to a shortcut patch. Invoke this instead of freelancing a repair.
---

# Heal Contract Failure

Full rationale lives in [`docs/implementation-methodology.md`](../../../docs/implementation-methodology.md)'s "On failure" section — read it if this is your first time. This file is the operational checklist.

**The one rule that overrides everything else in this skill:** fix the underlying thing, never the check. If you find yourself editing a contract test's assertions, a hook's logic, a lint rule, or a CI gate in order to make a failure go away — stop. That's not a repair; it's the hard-stop condition in Step 6.

**Do not classify the failure and jump to a patch.** Walk all five steps below, in order, every time — including when the cause looks obvious. "Obvious" is exactly the assumption that lets a stale Intent or a wrong Contract slide through while you patch the symptom one step later.

**Retry cap: 3 full walks of Steps 1–5 for this failure, then mandatory escalation — no 4th attempt.** Before starting, check whether a todo item already exists for this failure from an earlier attempt this session (search the todo list via the `manage_todo_list` tool); if so, this is attempt 2 or 3, not attempt 1. Log a fresh todo entry per attempt with title `Healing attempt N: <what's failing> — <hypothesis>` so the count and the reasoning are both visible. Attempt 2 or 3 must be informed by why the previous attempt's Step 5 failed — repeating the same Step 4 change with no new information is not a distinct attempt; treat it as a signal to escalate now rather than spend the remaining budget on a repeat.

## Steps — fixed order, no skipping

1. **Re-validate Intent.** Open the failing contract's Intent header comment. Re-read its Story in `docs/user-stories/epic-*.md` and its Source ADR in `docs/adr/` *fresh* — including any Amendment Log, Clarification, or Pending-supersession note added since this contract was written. Does the Intent block (scope, contract-to-encode, out-of-scope) still match what the story and ADR say right now? If not, that mismatch is very likely the actual root cause. Say so before continuing.
   
   **If the referenced Story file, ADR, or Implementation Log cannot be found:** stop immediately and report the missing file path to the user before proceeding. Do not assume default content or skip the read.

2. **Re-validate the Contract.** Re-read the failing contract test against the Acceptance Criteria you just re-fetched — not against what the test already asserts. Does it genuinely encode the story's *current* promises? If the contract itself looks wrong or stale: do not edit it yourself. That requires a dated note pointing to a specific ADR change, with the user's explicit sign-off — go to Step 6 instead.
   
   **If no contract exists yet:** this finding stays here — note it and proceed. (This means Step 1–3 will need to be completed before Step 4 can write code, per the sub-instruction in Step 4 below.)

3. **Re-validate the component `SKILL.md`.** Check it against [`docs/templates/component-skill-template.md`](../../../docs/templates/component-skill-template.md)'s required sections: governing ADRs/Stories, the contract files that constrain it, extension guidance, load-bearing constraints. Update it if stale — this one you're always allowed to fix directly.

4. **Re-validate and fix the implementation.** Proceed only if Steps 1–3 confirm a contract exists and the target is correct. Touch code to make the minimal change that satisfies that (now-confirmed) contract. No speculative generalization, no scope creep beyond what Step 1 reconfirmed.
   
   **If Step 2 found no contract exists yet:** this is the case where a hook blocked a write because no contract was authored before implementation was attempted. This is not a special case — it means the real work of Steps 1–3 must be completed now, in order, before any code can be safely written. Complete them now: finalize the Intent (Step 1), create/finalize the contract (Step 2), update/create the component SKILL.md (Step 3). Only then return to this step and write the implementation to match the (now-existing) contract.

5. **Validate.** Run the specific contract that was failing. Then run the full accumulated contract suite for the repo. Both must pass. If either still fails, this attempt is done and failed — see Step 6b before starting another. 
   
   **If the full-suite run fails a contract you weren't targeting** (from a different story or component), stop before touching it. This is a cross-component regression — do not mix its repair into the current attempt counter. Instead, apply the **Cross-Component Regression Protocol** below, then return to Step 5 to re-validate the full suite.

## Cross-Component Regression Protocol

When a contract from a different story or component fails after your changes, follow this separately (with its own attempt counter and stop condition) per `docs/implementation-methodology.md`'s "When the failing contract belongs to someone else's scope":

- **Attribute first.** Check whether it traces to a change made in *this* session — the far more common case — by comparing what you just modified against what the foreign contract exercises (a shared type, a shared utility, a common pipeline stage). Don't assume; if there's no plausible link, stop and ask rather than guess.
- **Default remedy: narrow the new change, not the foreign component.** The foreign contract was already passing and is presumed correct, same as an Accepted ADR — fix it by adjusting what you just changed, back in the current story's own files. Do not touch the foreign component's implementation, and never its contract.
- **Give it its own Intent and its own attempt counter** — create a separate todo `Healing attempt N: regression in <foreign story/contract> caused by <this story>'s change` — separate from the original story's counter. A struggling fix here should never look like the original story just needs "one more try."
- **If the real fix genuinely requires changing the foreign component too** (a shared interface both must adapt to): that's a scope expansion into another story's territory. Stop and surface it to the user as a named decision, per Step 2's rule. Never decide this yourself just because it seems like the obvious fix.
- **When the foreign regression is resolved**, return to Step 5 and re-run the full suite to confirm both the original and the regression contracts now pass.

## Hard Stop Conditions

6a. **Hard stop — cheating, checked at every step above, not just here:** if getting to green at any point would mean weakening, skipping, deleting, or bypassing a contract's assertions, a hook, a lint rule, or a CI gate — stop right there. Do not finish the sequence by force.

6b. **Hard stop — attempt cap:** if Step 5 just failed for the 3rd time on this failure, stop. Do not start a 4th walk regardless of how promising the next idea seems.

Either 6a or 6b means: report to the user exactly what's blocking a safe repair (6a) or what was tried across all attempts and why none converged (6b), and what decision or input you need from them. Do not proceed to Step 7's commit/log — there's nothing legitimate to log.

7. **Commit and log — only on a genuine pass, never after a 6a/6b stop.** Stage and commit the fix (and, if this was a 5b cross-component regression, note in the commit message which story's change caused it and which story's contract it restored). Run `git rev-parse HEAD` and `git show --stat --format= HEAD`, then append an entry to `docs/implementation-log.md` using its exact field format — commit hash, repo, the story/ADR whose contract was healed, files touched (from git's output, not memory), full suite result. Append only, per that file's own rule — never edit a prior entry, including one from an earlier attempt in this same session.

8. **Report back.** State: which step(s) actually needed a fix and which didn't, what changed (file list), the commit hash and Implementation Log entry, and confirmation the full suite passes. For a Step 6a/6b stop, state plainly that no repair was completed, no commit was made, which stop condition applied, and — for 6b — a summary of all attempts tried. Never present a forced, partial, or non-converged fix as resolved, and never log a commit that doesn't exist.

## Definition of "healed" — all of these, not just the check that was red

1. Steps 1–5 were actually walked, in order, this pass.
2. The originally failing check now passes.
3. The full accumulated contract suite still passes.
4. Nothing was weakened, skipped, `.skip`/`.todo`-marked, deleted, or bypassed (`--no-verify` etc.) to get here.
5. Any file touched outside the original story's scope is explicitly flagged, not silent.
6. `SKILL.md` and the traceability tables are accurate afterward.
7. A commit exists and an Implementation Log entry references its real hash and actual files touched.

## Hard rules, not preferences

- Never classify a failure and skip straight to a step-4-only patch. Walk 1 through 5.
- Never edit a contract test's assertions, a hook's matching logic, a lint rule, or a CI gate as a way to resolve a failure.
- Never use `--no-verify`, `.skip`, `.todo`, or a CI workflow edit to make a red check green.
- Never expand scope silently while repairing.
- Never attempt a 4th full walk of Steps 1–5 for the same failure. 3 fails means stop and escalate, not "one more try."
- Never repeat an identical Step 4 change across attempts without new information from the prior attempt's Step 5 failure — that's not a distinct attempt, it's a wasted one.
- If a genuine behavior change seems warranted (Step 2), that goes to the user with an ADR reference — never a decision this skill makes on its own.
- Never "fix" a foreign contract's regression by changing the foreign component instead of the change that broke it. A previously-passing contract is presumed correct; the burden is on the new change.
- Never let a cross-component regression's fix attempts share an attempt counter with the original story's — they're different failures, budget them separately.
- Never commit or log anything after a 6a/6b stop — those end in a report, not a partial commit.
- Never edit or remove an existing Implementation Log entry. Append only.
