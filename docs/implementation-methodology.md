# Implementation Methodology

How any deliverable actually gets built, so every agent — regardless of session, regardless of which story, regardless of whether it's this Claude Code instance or a future one with no memory of this conversation — produces work that stays traceable to its ADR, minimally scoped, contract-verified, and permanently regression-guarded.

This sits *below* [`implementation-plan.md`](implementation-plan.md) (which says **what** and **when**) and *above* actual code (the **how**, made mechanical here rather than re-decided by judgment every time). It's operationalized as a Claude Code skill — see [`.claude/skills/implement-story/SKILL.md`](../.claude/skills/implement-story/SKILL.md) — so picking up any story invokes this process automatically rather than depending on an agent having read this document first.

## Why this exists

Every artifact in this project so far (the [ADRs](adr/README.md), the [user stories](user-stories/README.md), the [phased plan](implementation-plan.md)) exists because context resets between sessions and this is a solo-developer project with no team memory to fall back on. This document is the same discipline applied one level down: to the actual code, not just the documents describing it. Without it, "traceable to an ADR" stops being true the moment implementation starts making its own undocumented judgment calls.

## The loop — mandatory, in order, for every story

### 0. Worktree provisioning (Multi-Agent Isolation)

Before touching code or branches, provision an isolated Git worktree:
```bash
git worktree add ../socialengage-story-<X.Y> -b feat/story-<X.Y> main
cd ../socialengage-story-<X.Y>
```
This guarantees complete filesystem and branch isolation so parallel autonomous agents running on the same host machine never overwrite each other's work-in-progress code or dirty the working tree.

### 1. Ingest the specification pyramid & check scope

Before touching anything, read the 4-tier specification pyramid:
- **User Story (`docs/user-stories/`):** Confirm status is **`Status: Ready`** (never implement a `Blocked` story). Note Acceptance Criteria ($AC_0 \dots AC_n$).
- **Source ADR (`docs/adr/`):** Read architectural decisions, schema invariants, and Amendment Logs in full.
- **Business Requirements (`docs/project docs/Business-Requirements/`):** Check business rules (`BRU-xxx`), permissions, and stakeholder success metrics.
- **Functional Design (`docs/project docs/Functional-Design/`):** Check TypeScript request/response schemas, bundled queries, error codes, and role gating.

*Hierarchy rule:* ADR > BRD/FDD > User Story. Enumerate the smallest set of files/modules required. Anything outside that set is strictly out of scope.

### 2. State intent

Before writing the contract test, write a short Intent block — as a `TodoWrite` entry and as the header comment of the contract test file itself:

```
Intent: Story <X.Y> — <title> (ADR-<NNNN>)
Scope: touches <file list>
Contract to encode: <paraphrase of the specific Acceptance Criteria being tested>
Explicitly out of scope: <anything adjacent that will NOT be touched this pass>
```

This is the checkpoint where scope creep gets caught before any code exists, not after a diff needs untangling.

### 3. Write the contract (Jest, before implementation — RED)

Translate the story's Acceptance Criteria and FDD contracts into executable Jest tests — **contracts**, not implementation tests: they assert observable behavior the story promises, not internal structure. One test per Acceptance Criterion, tagged back to its story and ADR in a header comment:

```ts
// Contract: Story 3.4 (ADR-0011) — cursor-based pagination for GET /posts
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-34
describe('GET /posts pagination contract', () => {
  it('accepts a cursor query parameter and returns a next-page cursor', () => { /* ... */ });
  it('produces no duplicate or skipped posts when paged during concurrent inserts', () => { /* ... */ });
});
```

Contracts live in `<repo>/contracts/epic-<N>/story-<X.Y>.<slug>.contract.test.ts`.

**Relationship assertions.** If this story gives the component a new real call relationship with another component, at least one contract assertion must exercise it at the *real* call site (live scheduler tick, real event dispatcher, or route handler), not only in isolation.

### 4. Derive or update the Component Skill file

Once the contract exists — even failing, pre-implementation — write or update `.claude/skills/<component>/SKILL.md` for the component the story lives in. See [`docs/templates/component-skill-template.md`](templates/component-skill-template.md). It must state: governing ADRs/Stories, contract files, extension guidance, load-bearing constraints, and real call-site relationships.

### 5. Implement (GREEN)

Write the minimal code in `<repo>/src/**` that makes the contract pass. Nothing more — no speculative generalization, no untested paths, no bundled refactors.

### 6. Validate (Postgres Template Database Cloning)

Run the new contract; it executes against an instant, physically isolated database clone on port `5434` (`CREATE DATABASE test_run_<pid> TEMPLATE social_listening_template` in $< 30\text{ ms}$):
- Run the story contract: `npm test <contract-path>`.
- Run the epic contract suite: `npm test contracts/epic-<N>`.
- Run the full accumulated suite if shared files outside the epic were modified: `npm run test:contracts`.
- If anything fails, invoke the **`heal-contract-failure`** skill.

### 7. Commit & log permanently — one commit, not two

The Implementation Log entry and the story's `**Built:**` line are written and committed **in the same commit** as the implementation itself — not as a second, hash-only commit afterward. Since that commit's own hash isn't knowable until after it exists, both fields are written with the literal placeholder `pending` in place of the hash at commit time:

1. Run `npm run sync` in `project-progress-dashboard/` first, so its output lands in the same commit rather than a follow-up one.
2. Update the story file: `**Built:** YYYY-MM-DD — <repo>@pending`.
3. Append the entry to `docs/implementation-log.md`, with `— commit pending` in the header and `` **Full commit:** `pending` `` in the body (every other field — story/ADR, contract, `SKILL.md`, files touched, suite result — filled in normally, including the log entry and Built-line edits themselves in "files touched", since they're part of this same commit).
4. Stage and commit implementation, contract, `SKILL.md`, traceability updates, dashboard sync output, and the log entry/Built-line together, in one commit:
   ```bash
   git commit -m "feat(<scope>): implement Story <X.Y> — <title> (ADR-<NNNN>)"
   ```
5. Run `git rev-parse HEAD` to get the real hash for your own end-of-turn report to the user — but don't create a follow-up commit just to write it down. `scripts/git-hooks/pre-commit` backfills any still-`pending` placeholder HEAD's own commit introduced, using HEAD's now-known hash, into whichever commit runs next (the merge-back below, the next story, or anything else) — bundled into that commit's own diff at zero extra commit cost, not a dedicated commit of its own. See that script and `docs/implementation-log.md`'s own format note.

### 8. Merge Worktree into Main & Teardown

Merge the feature branch cleanly into `main` and remove the temporary worktree:
```bash
git checkout main
git merge feat/story-<X.Y>
cd ../socialengage
git worktree remove ../socialengage-story-<X.Y>
git branch -d feat/story-<X.Y>
```

## What's mechanically enforced vs. what's followed by discipline

Not every step above can be verified by tooling — only file existence and suite-pass/fail can. Three concrete enforcement layers exist for the parts that can be:

1. **`.claude/hooks/enforce-contract-first.cjs`**, wired via a `PreToolUse` hook in `.claude/settings.json`. Blocks a `Write`/`Edit` to `<repo>/src/**` in real time, this session, unless that repo's `contracts/` already has at least one `*.contract.test.ts` file. Coarse (repo-wide, not per-story) and only checks existence, not relevance.
2. **A pre-commit hook** (template: [`docs/templates/pre-commit-hook.md`](templates/pre-commit-hook.md), installed via Husky once a repo exists). Same rule, checked at the git commit boundary instead of the tool-call boundary — catches work done outside a Claude Code session or where the real-time hook was bypassed. Has an explicit `--no-verify` escape hatch, by design, for genuinely non-story commits.
3. **CI + branch protection** (template: [`docs/templates/ci-workflow.md`](templates/ci-workflow.md)). Runs the full accumulated contract suite and a naming/cross-reference traceability check (template: [`docs/templates/check-contract-traceability.cjs`](templates/check-contract-traceability.cjs)) on every PR. Once wired to a required status check, this is the one layer that isn't advisory — GitHub, not an agent, decides whether the merge is allowed.

None of these can verify that a contract is *semantically* correct — only that one exists, is named correctly, and passes. Whether the contract actually encodes its story's Acceptance Criteria is a review responsibility that stays a review responsibility; no amount of tooling here changes that. See `docs/implementation-plan.md`'s discussion of why full mechanical enforcement isn't achievable when the same actor being constrained can also edit the constraint.

## On failure: self-healing, with a hard boundary

When a hook blocks a write, a pre-commit check fails, or CI goes red, the agent fixes it — but "fix" has exactly one legitimate meaning here: **make the underlying thing true, not make the check stop saying it's false.** Those are different operations, and the second one is the exact failure mode the three enforcement layers above exist to prevent — an agent with edit access to `src/`, `contracts/`, `.claude/hooks/`, and CI config all at once could otherwise "heal" any red check by weakening whichever file is easiest to weaken. This section exists to rule that out, not leave it to judgment in the moment.

### No classify-and-shortcut. Re-walk the whole chain, in order, every time.

An earlier version of this section had the agent classify the failure first (naming issue vs. regression vs. lint vs. ...) and jump straight to a matching narrow patch. That's a weaker guard than it looks: classification is itself a judgment call, made under the same pressure to get to green, and "I'm confident this is just an implementation bug" is exactly the kind of assumption that lets a deeper problem (a stale Intent, a contract that no longer matches its story, a `SKILL.md` nobody updated) slide through unexamined.

So instead: **healing re-walks the same five artifacts `implement-story` builds, in the same order, every single time — no skipping a step because the cause "obviously" lies later in the chain.**

1. **Re-validate Intent.** Re-open the failing contract's Intent header comment. Re-read the story and its Source ADR *fresh* — including any Amendment Log, Clarification, or Pending-supersession entries added since this contract was written; don't rely on what you remember from when it was first implemented. Confirm the Intent block (scope, contract-to-encode, out-of-scope) still matches what the story and ADR currently say. If they've diverged, that divergence is very likely the actual root cause — say so before touching anything else.

2. **Re-validate the Contract.** Re-read the failing contract test against the Acceptance Criteria you just re-fetched in Step 1 — not against what the test happens to assert already. Does it genuinely encode the story's current promises, criterion for criterion? If the contract itself is wrong or stale, it cannot be edited to make the failure disappear — per "Regression, not rewrite" below, that requires a dated note and an explicit ADR reference, with the user's sign-off, not a unilateral edit. Stop here and surface it if this is what you find.

3. **Re-validate the component `SKILL.md`.** Confirm it still lists the correct governing ADRs/Stories, the contract files that constrain this component, valid extension guidance, and accurate load-bearing constraints. Update it if it's drifted — this one's always fine to fix directly; it's documentation, not a behavior guarantee.

4. **Re-validate and, only now, fix the implementation.** Steps 1–3 confirm the target is correct before any code changes — implementation is fixed *last* among the diagnostic steps, not first. Make the minimal change needed to satisfy the now-confirmed-correct contract. No speculative generalization, no scope creep beyond what Step 1 just reconfirmed.

5. **Validate.** Run the specific contract that was failing, then this story's own epic's contract suite — or the full accumulated suite instead, per Step 6's shared-file carve-out above, if the fix touched anything outside that epic. Both must pass. CI's own unconditional full-suite run on every push/PR is the real backstop regardless of which scope ran here.

A hook blocking a write (the old "F5") isn't a separate case needing different handling — it's just this same sequence, entered at step 4 before steps 1–3 were actually done. Going back and doing 1–3 properly *is* the fix. A naming/traceability failure or a lint error isn't separate either — it surfaces naturally at whichever step (2, 3, or 4) it actually lives in, once you walk the sequence instead of guessing.

**Hard stop, applies at any step:** if getting to green would require weakening, skipping, deleting, or bypassing anything — a contract's assertions, a hook, a lint rule, a CI gate — stop at that step and escalate to the user instead of finishing the sequence by force.

### When the failing contract belongs to someone else's scope

Step 5 says "run the full accumulated suite" whenever the shared-file carve-out applies, not just the new contract — and sometimes that surfaces a previously-passing contract, belonging to a different story and component entirely, now failing. The current story's own scope (Step 2/Step 1 above) never included that component. This is exactly the case the full-suite rule exists to catch, not an exception to carve out of it — but it needs its own handling, because walking Steps 1–3 *for the foreign contract's story* won't find anything wrong: that story's Intent, Contract, and `SKILL.md` are all still correct. The problem isn't there. It's in what the current story's implementation just changed.

**2026-08-19 note:** since the shared-file carve-out (Step 6/Step 5 above) means a plain, same-epic change no longer always runs the full suite locally, a genuine cross-epic regression from a change that *should* have tripped the carve-out (an under-declared or stale `SKILL.md` relationship, most likely) may now surface first in CI's own full run after a push, rather than locally before commit. That's an accepted trade-off of the split, not a silently-introduced gap — CI still catches it unconditionally before `main` is trusted, just later in the loop than before. If this happens, treat it exactly as this section already describes, entered from CI's failure instead of a local one, and treat the stale/missing `SKILL.md` relationship that let it slip past the carve-out as its own finding worth fixing (Step 3 of the healing walk), not just the symptom.

**Attribute before touching anything.** Check what the current session actually modified (diff against the state before this story's Step 4) against what the foreign contract exercises — a shared type, a shared utility, a common pipeline stage. If there's no plausible connection, don't assume; that's grounds to stop and ask, the same as any other ambiguity in this document, not to guess at a fix.

**Default remedy: adjust the new change, not the validated component.** A previously-passing contract is presumed correct, the same way an Accepted ADR is — the burden of proof is on the change that just broke it, not on the thing that was already working (this is the same "Regression, not rewrite" principle applied one level down). So the fix normally happens back in the *current* story's own files: narrow whatever was widened, restore whatever compatibility was dropped — not in the foreign component's implementation or, especially, its contract.

**This is its own scoped healing target, not a silent extension of the current one.** Even though the fix usually lands back in the current story's files, treat "Story X's change broke Story Y's contract" as a distinct Intent: state it explicitly (`Intent: fixing regression — Story X's implementation broke Story Y's contract (file, story, ADR); scope: <the specific change being narrowed>`), log it, and surface it to the user. The original story isn't done until the *full* suite is green, including this — but "the full suite is green" and "the original story's diff quietly grew to include unexplained changes" are not the same outcome, and only the first one is acceptable.

**The rare exception — the new story genuinely needs the foreign component to change too:** sometimes the shared thing that broke a foreign contract needed to change on purpose (a shared interface both components must adapt to). That's not a bug to patch quietly — it's a scope expansion into another story's territory, and per Step 2's existing rule, that goes to the user as an explicit, named decision before any of that component's contract or implementation is touched. Never something resolved unilaterally just because the fix "obviously" requires it.

**Track it as a separate attempt budget.** The original story's contract and the foreign one's regression are different failures with potentially different root causes — give each its own attempt counter (Bounded retries, below) rather than letting fixes for one eat into the budget for the other, or letting a struggling fix to the foreign contract quietly look like the original story just needs "one more try."

### Bounded retries — a second, independent stop condition

"Never weaken a check" stops one failure mode: healing that cheats. It doesn't stop the other one: healing that keeps trying in good faith and never converges. Nothing about walking Steps 1–5 correctly guarantees the *n*th walk succeeds — an agent can genuinely re-validate Intent, Contract, and `SKILL.md`, make a real attempt at Step 4, fail Step 5, and repeat that indefinitely without ever weakening anything. That's not a violation of the hard stop above, but it's still not progress, and left unbounded it burns time and — this being a solo, self-funded project — real money, while looking like "still working on it" rather than "stuck."

**Cap: 3 full walks of Steps 1–5 per failure.** On the 3rd validate failure, stop — do not attempt a 4th — and escalate with a full account of what was tried. This is a starting default, not a derived number, the same way ADR-0020's queue TTL and ADR-0023's attempt floor were starting defaults: adjust it once there's real experience with how often 3 turns out to be too few or too many.

Two rules make the cap meaningful rather than just a counter:

- **Each attempt must differ from the last.** Re-walking Steps 1–3 should surface *why* the previous attempt failed — if attempt 2 is about to repeat attempt 1's Step 4 change with no new information from attempt 1's Step 5 failure, that's a signal to escalate early rather than spend the remaining budget on a repeat.
- **Log each attempt as it happens** (a `TodoWrite` entry per attempt: hypothesis, what changed, why Step 5 failed) — the eventual escalation, whether at attempt 3 or earlier, must be able to show what was actually tried, not just report "couldn't fix it."

### Definition of "healed"

A repair is only complete when **all** of the following hold — not just "the one check I was looking at now passes":

1. Steps 1–5 above were actually walked, in order, this pass — not shortcut because the cause seemed obvious.
2. The originally failing check now passes.
3. The *full* accumulated contract suite still passes — a repair that fixes one thing and breaks another isn't done.
4. No contract, lint rule, hook, or CI gate was weakened, skipped, `.skip`/`.todo`-marked, deleted, or bypassed (`--no-verify` etc.) to get here.
5. Any file touched outside the original story's declared scope is explicitly flagged, not silent.
6. `SKILL.md` and the traceability tables are accurate afterward.

If a repair can't satisfy all six, it isn't a repair — stop and escalate rather than force it.

## Resuming a story interrupted before commit

A session can end before Step 9 (commit) for a reason that has nothing to do with a check going red — running out of usage budget mid-Step-5 or mid-Step-6 is the concrete case that surfaced this, given this project's own solo/self-funded, quota-bound reality. That isn't a separate case needing its own recovery convention. Uncommitted mid-story state on disk is no more trustworthy than a red check — the only way to know whether it's still correct is the same re-walk the healing loop already performs, entered at Step 1 rather than assumed correct just because "it was in progress, not broken." Treat it exactly as `heal-contract-failure`'s Step 1 would: re-open the story and its Source ADR fresh, confirm the Intent block still matches what they currently say, then walk Steps 2–5 in order before ever touching commit — the same discipline "On failure" already establishes above, now entered from a session boundary instead of a failing check. This needs no new mechanism, only recognizing that "story interrupted before commit" is a member of the category `heal-contract-failure` was already built for, not a gap sitting next to it.

## Definition of done

A story is done only when: its contract exists and passes; the full accumulated contract suite still passes; its component's `SKILL.md` is current; the traceability tables in `docs/adr/README.md`, `docs/user-stories/README.md`, and `docs/implementation-plan.md` still accurately reflect its status; and a matching entry exists in `docs/implementation-log.md`, referencing the actual commit hash, verifiable against git rather than just asserted. A story that passes its own contract but leaves any of the other four stale is not done — it's just not-yet-caught drift. The entry's hash may legitimately read `pending` for a short window (until the next commit, whatever it is, triggers `scripts/git-hooks/pre-commit`'s automatic backfill — see Step 7 and the 2026-09-09 Amendment Log entry) — that isn't the "not-yet-caught drift" this line warns about, since it's a self-resolving, mechanically-verifiable state, not an unrecorded claim.

## Conventions

- **Contract test location:** `<repo>/contracts/epic-<N>/story-<X.Y>.<slug>.contract.test.ts`
- **Skill location:** `<repo>/.claude/skills/<component-slug>/SKILL.md` — one per architecturally meaningful component (a connector, the `RequestGate`, the enrichment pipeline, etc.), not one per story; several stories about the same component update the same `SKILL.md` over time.
- **Traceability:** every contract test's header comment names its Story and ADR; every `SKILL.md` lists every contract file that constrains it.
- **Regression, not rewrite:** a passing contract only changes via a dated note pointing to the ADR change that justifies it — never a silent edit.
- **Implementation Log:** `docs/implementation-log.md`, one entry per completed story or healing pass, appended (never edited) by whichever skill closes it, naming the commit hash, repo, story/ADR, contract, `SKILL.md`, and files touched — see that file for the exact format. `docs/templates/check-implementation-log.cjs` verifies each entry's claimed files against what the commit actually touched, and that the file itself was only ever appended to, never rewritten. This is the record that ties a documented decision to the literal git commit that satisfied it, checkable independently of anyone's say-so.

## Deferred findings — not acted on unless hit in practice

An external review (Gemini, 2026-07-30) of `enforce-contract-first.cjs` and `heal-contract-failure` surfaced real, technically sound findings. None are acted on here — per the same discipline that deferred ADR-0020's distributed gate and the connector capability registry (build for the problem you have, not the one you can imagine), these wait for actual practical evidence before any code changes. If one of these is ever actually hit during Phase 1+ work, fixing it is itself a methodology amendment — log it here, dated, same as everywhere else in this document, rather than editing this list silently.

- **Hardcoded repo names in the guard script's path matching** (`GUARDED_REPOS = ['social-listening-core', 'social-listening-admin']`). Brittle if either repo is renamed, restructured, or if a Claude Code session ever runs rooted directly inside one repo rather than in this parent workspace (where the repo name would still appear as a path segment, but a different topology might not). The failure mode is silent fail-open — the guard simply stops matching rather than erroring. Watch for: the guard not firing when it should, after any repo rename or workspace restructure.
- **`fs.readdirSync(contractsDir, { recursive: true })` in `hasAnyContract`** collects the full directory tree into memory rather than short-circuiting on the first match. Immaterial at current scale (a handful of contract files); a real cost only if `contracts/` grows into the thousands of files. Watch for: the hook's `PreToolUse` timeout (10s) actually being hit.
- **`heal-contract-failure` Step 2/6a escalations don't require a proposed diff.** For a genuinely trivial contract fix (a field-name typo), the current escalation just reports "the contract looks wrong" rather than proposing the specific fix for a fast human yes/no. Not changed now because it's a UX efficiency question, not a correctness gap — the hard-stop-and-escalate behavior itself is working as designed. Watch for: escalations that take multiple round-trips to resolve because the report wasn't specific enough to act on immediately.

The repo-wide (not per-story) coarseness of the contract check itself is a separate, already-accepted trade-off — documented in the script's own header comment and not something this list treats as open.

## Amendment Log

Adjustable details of this methodology's own tooling, changed after being hit in practice rather than reasoned about in the abstract — same convention as an ADR's Amendment Log, one level down from decisions to the process enforcing them.

- **2026-07-29 — `check-implementation-log.cjs`'s file-list extraction switched from `git show --stat` to `git diff-tree --no-commit-id --name-only -r`.** Hit in practice during Story 1.1's first real commit (`docs/implementation-log.md`'s `8fa7a66` entry): `git show --stat --format=`'s path column truncates long paths to fit terminal width — e.g. `social-listening-admin/.claude/skills/core-api-client/SKILL.md` rendered as `.../.claude/skills/core-api-client/SKILL.md`, silently dropping the repo-name prefix. This reproduced even at a plain, non-tty 80-column default, so it wasn't a one-off tty-width fluke; a real commit with real nested paths (contract files under `contracts/epic-N/`, `SKILL.md`s under `.claude/skills/<slug>/`) hits it routinely, not on some rare long-path edge case. Left uncorrected, it would have made the verification script falsely report "files in the commit but not claimed" for every entry with a nested path, the first time it actually ran in CI. `git diff-tree --no-commit-id --name-only -r <commit>` returns the full, untruncated path list directly and has no trailing summary line to filter out either, so the fix also drops the old `.filter((l) => l.includes(' | '))` workaround entirely rather than patching around the truncation. `docs/templates/check-implementation-log.cjs` and its description in `docs/templates/ci-workflow.md` are updated accordingly; `docs/implementation-log.md` entries should always use full, untruncated repo-relative paths in their `Files touched` field (this was already true of the Story 1.1 entry, which was written from `git diff-tree` output directly — the bug was only ever in the *verification* script, not in how entries have been authored).
- **2026-08-13 — Contracts must back a component's declared relationships at the real call site, not just prove the function in isolation; no new test-suite layer.** Raised by Menno directly, prompted by the same retrospective that found `publishEvent()` fully contract-passing with zero real call sites in the live ingestion path — a component whose `SKILL.md` "Relations to other components" section names a real caller/callee, but where nothing ever verified that relationship actually holds at runtime. The instinct to build a dedicated "dependency/QA test suite" alongside contracts was deliberately not taken — this project has held a consistent line (ADR-0020's own precedent) against standing up new permanent infrastructure for a gap found once, and a second test-suite category would double what every story has to produce for uncertain benefit. Instead, the existing single-layer contract convention absorbs this: Step 3 now requires that a story introducing or changing a real call relationship include at least one contract assertion exercising it at the actual production call site (a live scheduler tick, a real `ingestX()` function), not only the isolated function, and Step 4 ties this back to `SKILL.md`'s "Relations to other components" section as the place that relationship gets declared. Applies forward only, from whichever story first introduces or changes a relationship — deliberately no retroactive audit of the ~30 existing `SKILL.md` files' relationship claims (Menno's own explicit choice when asked), consistent with this project's "fix it when hit again" discipline rather than a preemptive sweep. `docs/templates/component-skill-template.md` gains a formal "Relations to other components" section reflecting this.
- **2026-08-13 — "resuming an interrupted story" folded into `heal-contract-failure`'s existing trigger conditions, given no new mechanism of its own.** Raised by Menno directly, during a retrospective review of this methodology prompted by his own real, recurring weekly usage-quota limits — a session ending mid-story before Step 9's commit is a concrete, recurring scenario for this project, not a hypothetical one. The insight: uncommitted mid-story state is exactly as unverified as a red check is, so the fix isn't a new "resume" convention — it's recognizing that re-entering at `heal-contract-failure` Step 1 (re-validate Intent against the current Story/ADR, then Contract, then SKILL.md, then Implementation, then Validate) already covers this correctly, because that loop never assumed the trigger was specifically a check going red, only that current state needs re-confirming against Intent before commit. See the new "Resuming a story interrupted before commit" section above; `.claude/skills/heal-contract-failure/SKILL.md`'s own trigger description and `CLAUDE.md`'s "Anything failing" line are updated to name this explicitly, so a future session recognizes "I'm resuming interrupted work" as this skill's job rather than a judgment call to reinvent.
- **2026-08-19 — Step 6/Step 5 validation split into an epic-scoped local default with a shared-file carve-out back to the full suite, CI left unconditionally full.** Raised by Menno directly, prompted by real, observed cost during Story 3.11's own healing pass this session: the full accumulated suite had grown to 72 suites / 582 tests and took long enough to require backgrounding past a 10-minute command timeout, for a change (a migration and a `socialPostStore.ts` fix) that only genuinely needed re-checking against its own epic. Previously, Step 6 (`implement-story`) and Step 5 (`heal-contract-failure`) both ran the *entire* accumulated suite after every single local validate, without exception — correct for safety, increasingly costly for iteration speed as the suite grows, exactly the kind of trade-off this project's own solo/self-funded, quota-bound reality has repeatedly forced elsewhere (see the two 2026-08-13 entries above). Resolved by keeping the full suite as the default *only* where it actually earns its cost: CI (`docs/templates/ci-workflow.md`) already ran on every push/PR before this change and is unchanged — it remains the one unconditional, non-negotiable full-suite gate. Locally, the new default is the touched story's own epic (`contracts/epic-<N>/`), with an explicit carve-out back to the full suite whenever the diff touches a file shared outside that epic — determined by checking the touched component's own `SKILL.md` "Relations to other components" section (already-existing infrastructure, not a new classification scheme) rather than inventing a fresh "is this file shared" heuristic; unsure defaults to running full, matching this project's general bias toward safety under ambiguity. Deliberately not solved by adding new hook/CI infrastructure (a pre-push hook, a second CI job) — the existing PR/push-to-main CI trigger already provides the "once per push" cadence Menno asked for, without inventing anything new, consistent with this project's standing preference against building infrastructure for a problem the existing pieces already cover once looked at closely. `implement-story`'s Step 7b and `heal-contract-failure`'s Step 5 are updated to match; the "When the failing contract belongs to someone else's scope" section gains a dated note on what changes about *when* a cross-epic regression is caught.
- **2026-08-24 — Story-level Git worktree isolation plus per-run Postgres template-database cloning, to allow concurrent agents in `social-listening-core` (`56aec12`).** `implement-story` and `heal-contract-failure` both gained a Step 0 that provisions an isolated `git worktree` per story (`../socialengage-story-<X.Y>` on branch `feat/story-<X.Y>`), so parallel passes on the same host no longer share a working tree or branch; the final step merges that branch back into `main` and tears the worktree down. `social-listening-core`'s `jest.global-setup.js`/`jest.global-teardown.js` were rewritten to match at the database layer: instead of every run connecting to one fixed `social_listening_test` database, the harness now builds a `social_listening_template` database once (migrated, then marked `is_template = true` / `allow_connections = false`), and clones a physically-isolated `test_run_<timestamp>_<pid>_<random>` database per Jest run via `CREATE DATABASE ... TEMPLATE` (retrying with backoff if two runs' clone attempts collide on the template), with teardown dropping that run's database plus any orphaned `test_run_%` database older than an hour. This resolves the fixed-container collision `CLAUDE.md`'s concurrency-safety line previously warned about, for `social-listening-core` only.

  Two things this change does not cover, caught during a 2026-08-24 review rather than reasoned about up front when the change was made: `social-listening-admin`'s own contract suite was not touched, so it still shares fixed state across runs and concurrent agents against it remain unsafe until its harness is brought up to the same pattern; and neither repo isolates the real, shared Azure resources (Key Vault, Service Bus, Blob Storage — ADR-0014/0015/0016/0029, never mocked) a contract run actually exercises, so two passes can still race there even within `social-listening-core` alone. `CLAUDE.md`'s concurrency-safety line is updated to name both remaining gaps explicitly rather than treating concurrency as solved.

- **2026-09-09 — Step 7's commit-and-log collapsed from two (or, with the dashboard-sync step counted separately, three) commits per story down to one, via a self-healing `pending` hash placeholder.** Raised by Menno directly, prompted by a plain observation of how many commits `git log` accumulates per story (`feat` → `docs(...): record ... build in implementation log` → `chore(telemetry): sync dashboard`, three separate commits for Story 17.1 and Story 17.2 alike). The Implementation Log's own hash-anchoring is genuinely load-bearing (`docs/implementation-log.md`'s whole value is that its commit citation is checkable against real git history, not asserted) — and a commit cannot contain its own hash before it exists, so the two-commit split looked structurally forced. It wasn't: the log entry and `Built:` line can be written and committed in the *same* commit as the implementation, with the literal placeholder `pending` standing in for the not-yet-known hash, and `scripts/git-hooks/pre-commit` now backfills that placeholder — using the now-fully-known hash of the commit that introduced it — into whichever commit runs *next* (the worktree merge-back, the next story, anything), rather than requiring a dedicated commit purely to record it. Correctness constraint: the hook only ever resolves a `pending` marker that `HEAD`'s own diff introduced (checked via `git diff --name-only HEAD~1 HEAD`), never blindly patching every `pending` string it finds — an orphaned placeholder from further back (a sign the invariant broke somewhere, e.g. hooks disabled for one commit) is left alone rather than mis-attributed to the wrong commit. The dashboard sync (`npm run sync`) is folded into the same single commit too, since its output is just working-tree file state, not something that needs the commit's own hash to run. `docs/implementation-log.md`'s own format note, `check-implementation-log.cjs` (treats `pending` as a recognized transient state rather than an equally-hard failure), and `implement-story`/`heal-contract-failure`'s own Step 9/commit-and-log steps are updated to match. Pre-existing entries already using `pending` as a manual, never-resolved placeholder (Story 3.13, Stories 2.23–2.25) predate this mechanism and are not retroactively fixed — the same "applies forward only" discipline as the 2026-08-13 call-site-relationship amendment above.
