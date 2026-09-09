---
name: implement-story
description: Use when picking up any User Story from docs/user-stories/ to implement in social-listening-core or social-listening-admin. Enforces worktree isolation, minimal scope, up-front intent from ADR/BRD/FDD/Story specs, contract-first test authoring, component SKILL.md updates, template DB test validation, append-only logging, dashboard sync, and clean worktree merging.
---

# Implement Story

Full rationale lives in [`docs/implementation-methodology.md`](../../../docs/implementation-methodology.md) — read it once if this is your first time using this skill. This file is the operational checklist; that file is the "why."

**Args:** the story number, e.g. `9.5`. If not given, ask which story before proceeding — do not guess.

## Steps (do these in order; do not skip or reorder)

0. **Provision an isolated Git Worktree (Multi-Agent Concurrency).**
   Before touching any files or branches, ensure filesystem isolation so concurrent agents do not collide:
   ```bash
   git worktree add ../socialengage-story-<X.Y> -b feat/story-<X.Y> main
   cd ../socialengage-story-<X.Y>
   ```
   All subsequent steps execute inside this isolated worktree directory.

1. **Locate and read the specification pyramid.**
   - **User Story:** Find it in `docs/user-stories/epic-*.md` by number. Check its **Status** — if it says `Blocked — pending ADR-XXXX acceptance`, stop and tell the user; do not implement a story whose source ADR is not Accepted. Confirm the status is `Ready`.
   - **Source ADR:** Read `docs/adr/00XX-*.md` in full, including architectural decisions, DB schemas, system invariants, and Amendment Logs.
   - **Business Requirements (BRD):** Read `docs/project docs/Business-Requirements/BRD-00XX-*.md` for business rules (`BRU-xxx`), permissions, and stakeholder objectives.
   - **Functional Design (FDD):** Read `docs/project docs/Functional-Design/FDD-00XX-*.md` for TypeScript Request/Response interfaces, bundled queries, error handling, and role gating.
   - *Hierarchy rule:* ADR > BRD/FDD > Story. If a BRD or FDD contradicts the ADR, stop and surface the conflict to the user before proceeding.

2. **Scope.** List the exact minimal files this story's Acceptance Criteria require touching. Anything outside this set is out of scope. If implementation reveals a genuine need to touch files outside this list, stop and surface it as a separate follow-up item.

3. **State intent.** Before writing any test or code:
   - Add a `TodoWrite` entry: `Implement Story <X.Y>: <title>`.
   - Draft the Intent block (Story, ADR, BRD/FDD, Scope, Contract to encode, Out of scope) per `docs/implementation-methodology.md` §2. This becomes the header comment of the contract test file.

4. **Write the contract test first (RED phase).**
   Create `<repo>/contracts/epic-<N>/story-<X.Y>.<slug>.contract.test.ts` with one test per Acceptance Criterion ($AC_0 \dots AC_n$) and the Intent block as its header comment.
   - If the story introduces a call relationship with another component, include an assertion that exercises the real production call site (live route handler, event dispatcher, or scheduler tick), not just an isolated function in isolation.
   - Run the contract test — it must fail at this stage because the production code does not exist yet.

5. **Write or update the component's `SKILL.md`.**
   Update `<repo>/.Codex/skills/<component-slug>/SKILL.md` using [`docs/templates/component-skill-template.md`](../../../docs/templates/component-skill-template.md).
   - Document governing ADRs, Story references, contract test paths, load-bearing constraints, and real call-site relationships.

6. **Implement (GREEN phase).**
   Write the minimal code in `<repo>/src/**` to turn the contract green. Avoid speculative generalization, untested code paths, or unrequested refactorings.

7. **Validate.**
   - **7a.** Run the new contract test. It runs against an instant, isolated Postgres database cloned via PostgreSQL native template engine on port `5434` (`social_listening_template`):
     ```bash
     npm test <path-to-contract>
     ```
   - **7b.** Run the epic contract suite: `npm test contracts/epic-<N>`.
   - **7c.** If shared files outside the epic were modified, run the full accumulated test suite: `npm run test:contracts`.
   - If anything fails, stop and invoke the **`heal-contract-failure`** skill.

8. **Update traceability.**
   Confirm and update the story status and references in `docs/user-stories/README.md`, `docs/adr/README.md`, and `docs/implementation-plan.md`. If the story entry in its epic file does not have a `**Built:**` field, set it to `**Built:** not yet`.

9. **Commit story implementation.**
   Stage and commit the contract test, implementation code, component `SKILL.md`, and traceability updates:
   ```bash
   git commit -m "feat(<scope>): implement Story <X.Y> — <title> (ADR-<NNNN>)"
   ```

10. **Log completion & synchronize dashboard telemetry.**
    - Run `git rev-parse HEAD` to capture the commit hash.
    - Append the completion record to [`docs/implementation-log.md`](../../../docs/implementation-log.md).
    - Update the story file's `**Built:** not yet` to `**Built:** YYYY-MM-DD — <repo>@<short-hash>`.
    - Run `npm run sync` in `project-progress-dashboard/` to refresh the dashboard telemetry.

11. **Merge Worktree into Main & Teardown Worktree.**
    Merge the verified branch back into `main` and remove the isolated worktree:
    ```bash
    git checkout main
    git merge feat/story-<X.Y>
    cd ../socialengage
    git worktree remove ../socialengage-story-<X.Y>
    git branch -d feat/story-<X.Y>
    ```

12. **Report back concisely:** Story number, files modified, contract test added, test suite result, `SKILL.md` updated, commit hash, and Implementation Log entry.

## Hard rules, not preferences

- Never write implementation code before its contract test exists and fails for missing behavior.
- Never touch a file outside the Step 2 scope list without explicitly flagging it first.
- Never delete or silently weaken a passing contract from an earlier story.
- Never start work on a `Blocked` story whose source ADR is not Accepted.
- Never report a story as done without an Implementation Log entry and a verified commit hash.
- Never edit or rewrite prior Implementation Log entries. Append only.
