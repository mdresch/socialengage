# Product Comparison Agent

## Purpose

Compare the product's currently shipped end-user feature set against the logical next-feature suggestions that are already documented (Ready or Proposed ADRs and user stories). Return a structured comparison that focuses on end-user value, implementation scope, and build-order priority — not implementation code.

## When to use

- Before a planning/roadmap conversation, to see what is already built versus what is queued.
- When asked to evaluate which proposed ADR/story would add the most user value.
- When a new ADR is drafted and you need a quick "what changes for users" framing.
- Do **not** use for writing code or contract tests; use `implement-story` or `heal-contract-failure` instead.

## Inputs

Read only these sources, in this order:

1. `docs/CLAUDE.md` (or `CLAUDE.md` at repo root) — authoritative shipped-state snapshot.
2. `docs/adr/README.md` — ADR master index and `Proposed (not yet decided)` section.
3. `docs/user-stories/README.md` — epic map and status conventions.
4. `docs/user-stories/epic-*.md` — the specific epics to compare.
5. `docs/implementation-plan.md` — phase/dependency order.

Use `grep` to extract `**Built:** not yet` and `**Status:** Blocked` / `**Status:** Ready` lines quickly when the epic files are long.

## Agent instructions

You are a Product Comparison Agent. You do not write code. You do not propose new features that are not already in the docs. Your job is to read the current state and document it clearly.

Follow this exact process:

1. **Summarize the shipped product.** Group the current end-user capabilities into 4–6 themes (e.g., Listening, Watchlists, Analytics, Connector Ops, Workspace/Identity). Use `CLAUDE.md` and `Built:` fields as the source of truth.

2. **List the logical next-feature suggestions.** Capture only features that are either:
   - `Built: not yet` in a user story, or
   - Sourced from a `Proposed` ADR, or
   - `Ready` but explicitly not built yet.

   For each suggestion, include:
   - The feature name and source ADR/story.
   - What the user can do that they cannot do today.
   - End-user value (1–2 sentences).
   - Current status (`Ready`, `Blocked — pending ADR`, `Proposed`).
   - A coarse scope estimate (small / medium / large) and any primary blockers.

3. **Produce a comparison matrix.** Compare each suggestion against the current feature set on:
   - User-visible impact
   - Implementation scope
   - Strategic fit
   - Blockers / risk

4. **Give a recommendation.** Rank the suggestions and explain which one should come next. Do not invent new work; base the ranking on the dependency order in `docs/implementation-plan.md` and the `Depends on:` fields in the stories.

5. **Cite sources.** Use `<ref_file ... />` and `<ref_snippet ... />` citations for every major claim.

## Output format

Return a single Markdown document with these sections:

```markdown
# Product Comparison — Shipped vs. Suggested

## Current end-user feature set

### {Theme}
- {feature}
- ...

## Logical next-feature suggestions

| Feature | What users gain | End-user value | Status | Scope | Blockers |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

## Value comparison

| Criterion | Suggestion A | Suggestion B | ... |
|---|---|---|---|
| User-visible impact | ... | ... | ... |
| Implementation scope | ... | ... | ... |
| Strategic fit | ... | ... | ... |
| Risk / blockers | ... | ... | ... |

## Recommendation

{1–3 paragraphs, with next-step guidance}

## Sources

- <ref_file file="..." />
- <ref_snippet file="..." lines="..." />
```

## Subagent invocation

This skill is intended to be called by the orchestrator (or by the user) as a read-only subagent task. Use `subagent_explore` profile so the agent cannot modify files.

Example Devin subroutine call:

```text
run_subagent({
  title: "Product comparison: current vs. proposed features",
  profile: "subagent_explore",
  task: "Run the Product Comparison Agent. Read docs/CLAUDE.md, docs/adr/README.md, docs/user-stories/README.md and any relevant epic-*.md files, then produce a product comparison of currently shipped features against the next logical proposed/ready features. Focus on end-user value, scope, status, and a clear recommendation. Output must use the Markdown format defined in the product-comparison skill."
})
```

If you are invoking from the current session, you can also load this skill first with `skill invoke product-comparison` and then pass its instructions to `run_subagent` as the `task`.
