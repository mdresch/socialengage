# FDD Writer — Batch Agent

## Purpose

Run the FDD Writer Agent for multiple ADR/BRD pairs in one pass.

Given either:
- a comma/newline-separated list of ADR/BRD numbers (e.g. `0001,0039,0075`), or
- the keyword `all`,

the batch agent:

1. Resolves the target ADR/BRD numbers.
2. Verifies that each ADR and matching BRD exist.
3. Runs the single FDD Writer pipeline for each number **serially** (one at a time) to avoid concurrent repo writes.
4. Writes each FDD to `docs/project docs/Functional-Design/FDD-00NN-<feature-name>.md`.
5. Reports which files were created, which were skipped, and any missing related sources.

## When to use

- When you need FDDs for several ADR/BRD pairs at once.
- When you want to backfill FDDs for every ADR that already has a BRD.
- Do **not** use for one-off FDDs — use the `fdd-writer` skill instead.

## Inputs

1. **Required:** a list of ADR/BRD numbers (e.g. `0001, 0039, 0075`) or the keyword `all`.
2. `docs/adr/00NN-*.md` — source ADRs.
3. `docs/project docs/Business-Requirements/BRD-00NN-*.md` — source BRDs.
4. `docs/project docs/FDD template.md` — the FDD structure.
5. `docs/product-research/feature-designs/*.md` and `docs/product-research/reports/*.md` — optional feature context.
6. `docs/user-stories/epic-*.md` — related implementation stories.

## Agent instructions

You are the FDD Writer — Batch Agent. Your job is to produce multiple FDDs in one run, one at a time.

### Step 1 — Resolve the batch list

1. Read the user's list from the task. If the user gave `all`, glob `docs/project docs/Business-Requirements/BRD-00*.md`, extract the number from each filename (e.g. `BRD-0039-...` -> `0039`), and sort the numbers.
2. Otherwise, parse the comma/newline/space-separated list into distinct numbers and sort them.
3. Remove any duplicates.

### Step 2 — Verify prerequisites for each number

For each number in order:

1. Glob the ADR: `docs/adr/00NN-*.md`. If missing, record the number as **skipped — no ADR** and continue to the next.
2. Glob the BRD: `docs/project docs/Business-Requirements/BRD-00NN-*.md`. If missing, record the number as **skipped — no BRD** and continue to the next.

### Step 3 — Produce each FDD

For each remaining number, in order, execute the FDD Writer pipeline:

1. Read the ADR and BRD.
2. Search `docs/product-research/feature-designs/*.md` and `docs/product-research/reports/*.md` for related feature context.
3. Search `docs/user-stories/epic-*.md` and `docs/user-stories/README.md` for related stories.
4. Read `docs/project docs/FDD template.md`.
5. Ensure `docs/project docs/Functional-Design/` exists.
6. Synthesize and write `FDD-00NN-<feature-name>.md` to that folder.
7. After writing, record the file path, a one-line summary, and any missing sources.

### Step 4 — Report results

After the last FDD is written, report a structured summary:

```
FDD Batch Summary

Created (N):
- docs/project docs/Functional-Design/FDD-0001-Two-Repository-Split.md
- ...

Skipped (N):
- 0050 — no BRD
- 0099 — no ADR
- ...

Missing related sources noted in FDDs:
- ADR-0001 — no dedicated feature-design file
- ...
```

## Output

- One Markdown FDD file per successful ADR/BRD pair in `docs/project docs/Functional-Design/`.
- A concise batch summary from the agent.

## Rules

- Process one ADR/BRD pair at a time. Do not parallelize.
- Do not modify source ADRs, BRDs, feature designs, user stories, or the FDD template.
- If the BRD does not exist for a number, skip it and do not try to write an FDD.
- If the FDD file already exists, overwrite it only if the new content is derived from the current ADR/BRD/stories; otherwise ask before overwriting.
- Keep the language design-oriented, not implementation-specific.

## Subagent invocation

Use `subagent_general` so the agent can create the output directory and write the FDD files.

```text
run_subagent({
  title: "FDD batch writer",
  profile: "subagent_general",
  task: "Run the FDD Writer — Batch Agent. Read D:\\Source\\socialengage\\.devin\\skills\\fdd-writer-batch\\SKILL.md and execute it for the list: <insert ADR/BRD numbers or 'all' here>. For each number, write a complete Functional Design Document into D:\\Source\\socialengage\\docs\\project docs\\Functional-Design\\ using D:\\Source\\socialengage\\docs\\project docs\\FDD template.md. Report the batch summary."
})
```
