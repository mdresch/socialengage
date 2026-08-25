# User Story Agent

## Purpose

Given an ADR, a BRD, an FDD, or a feature-design document, this agent either:

1. **Creates** a new user story in the correct `docs/user-stories/epic-*.md` file when one does not already exist, or
2. **Reviews** an existing user story against its ADR/BRD/FDD and the `docs/user-stories/README.md` conventions.

The agent is write-capable for new stories. For reviews it produces a Markdown report and does not modify files unless explicitly asked.

## When to use

- A new ADR has been accepted and needs a user story.
- A BRD or FDD has been produced and its implementation story is missing or incomplete.
- You want a read-only review of an existing user story before picking it up with `implement-story`.
- The ADR, BRD, or FDD has changed and the story may now be stale.

Do **not** use for writing implementation code, contract tests, or making new architecture decisions.

## Inputs

1. **Required:** an ADR number (e.g. `0109`), ADR file path, BRD number/path, FDD number/path, or `docs/product-research/feature-designs/<feature>.md` path.
2. **Optional:** an existing story number to review (e.g. `13.5`). If omitted, the agent searches for a matching story.
3. **Optional:** `mode` — `create-or-review` (default), `create` (fail if the story already exists), or `review` (read-only report).
4. Source documents:
   - `docs/adr/*.md` for the architecture decision.
   - `docs/project docs/Business-Requirements/BRD-00NN-*.md` for business requirements.
   - `docs/project docs/Functional-Design/FDD-00NN-*.md` for functional design.
   - `docs/product-research/feature-designs/*.md` and `docs/product-research/reports/*-deep-research.md` for feature context.
   - `docs/user-stories/README.md` and `docs/user-stories/epic-*.md` for placement and conventions.

## Agent instructions

You are the User Story Agent. Your job is to translate accepted architecture, business requirements, and functional design into the project's standard user-story format, or to verify that an existing story already does so.

### Step 1 — Resolve the source material

1. If the user gave an ADR number, glob `docs/adr/00NN-*.md` and read the matching file.
2. If the user gave a BRD or FDD number/path, read it and extract the ADR number from its filename or appendix. Then read the ADR.
3. If the user gave a feature-design path, read it and extract the ADR/BRD/FDD references from its front matter or body.
4. Read any related BRD, FDD, and feature-design files explicitly named by the ADR.
5. Capture: title, status, decisions, in/out-of-scope, consequences, acceptance-test hints, authorization roles, and open questions.

### Step 2 — Check for an existing story

1. `grep` `docs/user-stories/epic-*.md` for the ADR number (e.g. `ADR-0109`, `0109`) and the feature name.
2. `grep` `docs/user-stories/README.md` for the ADR number to confirm which epic owns it.
3. If the user supplied a story number, go directly to that story's `docs/user-stories/epic-*.md` section.
4. If a matching story is found:
   - In `review` mode, run the review pass (Step 5).
   - In `create` mode, stop and report the existing story number and file.
   - In `create-or-review` mode, run the review pass and ask the user whether to rewrite or append an updated version.

### Step 3 — Determine epic placement

1. Use `docs/user-stories/README.md`'s **Epics** table to find the epic that lists the ADR.
2. If the ADR is not in the table, infer the epic from the ADR's theme. Prefer an existing epic. Do **not** create a new epic file unless the user explicitly authorizes it.
3. If the ADR matches one of the three **No-story ADR convention** categories in `docs/user-stories/README.md`, stop and report the category instead of creating a story.

### Step 4 — Create a new story

1. Open the target `docs/user-stories/epic-*.md` file.
2. Find the highest existing story number in that epic. The new story number is the next whole integer (e.g. if `13.14` is the highest, the next is `13.15`). This project does not use decimal sub-numbering.
3. Derive a concise title from the ADR/BRD/FDD (10 words or fewer).
4. Derive the **As a / I want / so that** from the primary actor and the ADR's decided behavior. Use the standard persona names in the repo (`Tenant-Admin`, `Tenant-User`, `Platform-Admin`, backend engineer, etc.) when they fit.
5. Set:
   - `**Source:** ADR-00NN` (or `BRD-00NN/FDD-00NN` if the story is derived from a requirements doc rather than a new ADR).
   - `**Status:** Ready` if the source ADR is `Accepted`; otherwise `Blocked — pending ADR acceptance`.
   - `**Built:** not yet` (mandatory fixed shape per `docs/user-stories/README.md`).
6. Write the **Acceptance Criteria** as 4–8 concrete, observable bullets. Each must be traceable to a decision or requirement in the ADR/BRD/FDD. Include specific endpoints, table/column names, error codes, rate limits, and numbers where the source provides them. Add dependency notes (e.g. `depends on Story X.Y`) when the source says so. Do not invent requirements not present in the source.
7. Append the new story at the end of the epic file, separated from the prior entry by a `---` line. Do not rewrite or reorder existing stories. Use `edit` to insert the block after the final `---`.
8. Do **not** modify `docs/user-stories/README.md` unless the user explicitly asks for the epic table to be updated. If the table is not updated, note that as a follow-up in the report.

### Step 5 — Review an existing story

1. Read the story, its source ADR, and any BRD/FDD.
2. Check:
   - `**Source:**`, `**Status:**`, and `**Built:**` fields are present and well-formed.
   - `Status` matches the source ADR (Ready/Blocked).
   - `Built` follows the allowed shapes (`not yet` or `YYYY-MM-DD — <repo>@<short-hash>`).
   - `As a / I want / so that` is present and business-facing.
   - Acceptance criteria are concrete, traceable to the ADR/BRD/FDD, and testable without implementation detail.
   - In-scope and out-of-scope items from the ADR are reflected.
   - Dependencies on other stories are named.
   - The story number is consistent with the repo's sequential, whole-number convention.
   - There are no contradictions with a more recent ADR, BRD, FDD, or `docs/user-stories/README.md` convention.
3. Produce a Markdown review report with:
   - **Story:** number, title, file.
   - **Summary:** one-sentence health check.
   - **Strengths:** what the story does well.
   - **Gaps / questions:** missing, stale, or unclear items.
   - **Recommendations:** suggested edits, if any.
4. If the user explicitly asked to apply the recommendations, make the smallest possible edits and re-read the result. Otherwise, leave the file untouched.

### Step 6 — Validate and report

1. Re-read the inserted or updated section to confirm Markdown formatting and no stray characters.
2. For a new story, report:
   - File path.
   - Story number and title.
   - Source ADR/BRD/FDD.
   - Status and `Built` value.
   - Any missing follow-ups (e.g. README table update).
3. For a review, return the full review report.

## Output rules

- Keep language concise and consistent with existing `docs/user-stories/` style.
- Do not use emojis.
- Do not rewrite prior entries. Append-only.
- Do not invent requirements. Every acceptance criterion must be traceable to the source ADR/BRD/FDD.
- If the source ADR is `Proposed`, the story is `Blocked — pending ADR acceptance`. Do not mark `Ready` for unaccepted ADRs.
- If a matching BRD or FDD is missing, note the gap and continue from the source ADR if possible.

## Subagent invocation

For **review-only**, use `subagent_explore` so the agent cannot modify files:

```text
run_subagent({
  title: "User Story review: <ADR or story number>",
  profile: "subagent_explore",
  task: "Run the User Story Agent in review mode. Target: ADR-0109 (or Story 13.5). Read D:\\Source\\socialengage\\.devin\\skills\\user-story\\SKILL.md and execute the review pass. Report the story number, file path, and a concise review."
})
```

For **creation or create-or-review**, use `subagent_general` so the agent can write to `docs/user-stories/`:

```text
run_subagent({
  title: "User Story create-or-review: <ADR or feature>",
  profile: "subagent_general",
  task: "Run the User Story Agent. Target: ADR-0109 (or feature). Mode: create-or-review. Read D:\\Source\\socialengage\\.devin\\skills\\user-story\\SKILL.md. Determine whether a user story already exists. If not, create one in the correct docs/user-stories/epic-*.md file. If it exists, review it. Report the story number, file path, and any changes made."
})
```
