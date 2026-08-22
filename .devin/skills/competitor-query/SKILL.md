# Competitor Feature Query Agent

## Purpose

Query the `docs/product-research/competitor-feature-matrix.json` file to find which products support which features, or which features a given product supports. Return concise, cited answers. Do not modify the matrix.

## When to use

- When the user asks something like:
  - "Which products have *feature X*?"
  - "Does *product Y* support *feature Z*?"
  - "Which tools support both *publishing* and a *unified social inbox*?"
  - "List the features of *product Y*."
  - "Which competitors are strongest at *boolean queries*?"
- Do not use for writing new ADRs, code, or contract tests.

## Inputs

- `docs/product-research/competitor-feature-matrix.json` (the canonical source)
- The user's natural-language query

## How to read the matrix

Each product has a `features` record with one value per feature:

- `yes` — supported as a core capability
- `limited` — partial support, add-on, or lighter than a leader
- `add-on` — available at extra cost or in a higher tier
- `no` — not supported
- `unknown` — not verified from the sources

The file also contains a pre-computed `feature_to_products` reverse index. Use it for feature-first queries.

## Agent instructions

1. Parse the user's query. Decide if it is:
   - **Feature-first** ("who has X?") — use `feature_to_products` and return the `yes`/`limited`/`add-on` buckets for that feature.
   - **Product-first** ("what does Y have?") — return the full `features` record for that product, grouped by support level.
   - **Combined** ("who has both X and Y?") — intersect the `yes` lists of each feature, then optionally include `limited`/`add-on` if the user asks for partial support.
   - **Comparison** ("compare X and Y on features") — build a side-by-side feature table.

2. Answer in plain language first, then support with a short table or list. Always cite the JSON file using `<ref_file ... />`.

3. Do not make up products, features, or support levels. If the query asks about something not in the matrix, say it is not covered.

## Output format

```markdown
{direct answer in 1–3 sentences}

**Products with *feature X* (core/strong support):** {list}
**Products with limited/add-on support:** {list}
**Not supported by:** {list}

Sources: <ref_file file="docs/product-research/competitor-feature-matrix.json" />
```

## Subagent invocation

Use `subagent_explore` so the agent cannot modify the repo. The `task` should contain the user's query and a reference to this skill.

Example:

```text
run_subagent({
  title: "Competitor feature query",
  profile: "subagent_explore",
  task: "Run the Competitor Feature Query Agent against docs/product-research/competitor-feature-matrix.json. Answer the question: 'Which products have both publishing_scheduling and a unified_social_inbox?' Return a concise, cited answer."
})
```
