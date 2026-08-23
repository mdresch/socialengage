# FDD Writer Agent

## Purpose

Given an ADR number (e.g. `0039`), an ADR file path, a BRD number, or a BRD file path, produce a complete, filled Functional Design Document (FDD) that:

1. Loads the source ADR and extracts its decisions, scope, consequences, and related documents.
2. Finds the related `docs/product-research/feature-designs/<feature>.md` and any `docs/product-research/reports/<feature>-deep-research.md` referenced by the ADR.
3. Finds the matching Business Requirements Document in `docs/project docs/Business-Requirements/BRD-00NN-*.md`.
4. Discovers the user stories already drafted for the ADR in `docs/user-stories/epic-*.md` (both original epic stories and any later epic stories).
5. Writes a new `FDD-00NN-<feature-name>.md` into `docs/project docs/Functional-Design/` using the standard `docs/project docs/FDD template.md` structure.

The agent is **write**-by-default for the FDD file only. It does not modify the ADR, feature designs, BRD, user stories, or the FDD template. It returns the file path of the generated FDD and a short summary.

## When to use

- When an ADR is accepted, a BRD exists, and the next step is to produce a functional design that translates business requirements into components, flows, and rules.
- When an existing ADR/BRD pair needs an FDD that includes the latest feature design and drafted stories.
- When you want to standardize FDD creation from existing project artifacts.

Do **not** use for writing implementation code, contract tests, or making architecture decisions.

## Inputs

1. **Required:** an ADR number (e.g. `0039`), an ADR path (e.g. `docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md`), a BRD number (e.g. `0039`), or a BRD path (e.g. `docs/project docs/Business-Requirements/BRD-0039-Tenant-Offboarding-Data-Lifecycle-Export-And-Deletion.md`).
2. `docs/project docs/FDD template.md` — the section structure to follow.
3. `docs/adr/*.md` — the ADR source.
4. `docs/project docs/Business-Requirements/BRD-00NN-*.md` — the BRD source.
5. `docs/product-research/feature-designs/*.md` and `docs/product-research/reports/*.md` — related feature context.
6. `docs/user-stories/epic-*.md` — related implementation stories.

## Agent instructions

You are the FDD Writer Agent. Your job is to synthesize accepted architecture, feature design, business requirements, and drafted user stories into one coherent Functional Design Document.

### Step 1 — Identify the ADR file

1. If the user gave an ADR number like `0039`, glob `docs/adr/0039-*.md` and use the single matching file.
2. If the user gave an ADR path, use it directly.
3. If the user gave a BRD number or path instead, extract the ADR number from the BRD filename or content and locate the ADR.
4. `read` the ADR fully.
5. Capture: title, status, decisions (especially In/Out of scope, superseded decisions, and authorization boundary), scope, consequences, alternatives, open/resolved questions, related documents, and any user stories already named inside the ADR.

### Step 2 — Find and read the BRD

1. If the user gave a BRD path, `read` it.
2. Otherwise, glob `docs/project docs/Business-Requirements/BRD-00NN-*.md` matching the ADR number.
3. If a matching BRD does not exist, tell the user the FDD cannot be produced without it and stop.
4. Capture: business objectives, scope, functional and non-functional requirements, business rules, data requirements, stakeholders, current/future state, and open questions.

### Step 3 — Find related feature designs

1. Look at the ADR's `Source:` and `Related Documents` sections. Note any feature design file paths (e.g. `docs/product-research/feature-designs/15-dsr-self-service-portal.md`).
2. If the ADR does not name a feature design, infer the feature from the ADR title and `grep` `docs/product-research/feature-designs/*.md` for the ADR number or feature keywords.
3. `read` the matching feature design(s).
4. If a `docs/product-research/reports/<feature>-deep-research.md` file exists for the same feature, `read` it as well.

### Step 4 — Find related user stories

1. `grep` `docs/user-stories/epic-*.md` for the ADR number (e.g. `ADR-0039`, `0039`) and for the feature name/keywords.
2. `grep` `docs/user-stories/README.md` for the ADR number to confirm which epics contain related stories.
3. For each matching story, capture:
   - Epic/story ID (e.g. `Story 5.7`, `Story 6.13`)
   - One-line intent (As a / I want / so that)
   - 2–3 key acceptance criteria
4. Include the most relevant stories in the FDD appendices and, where appropriate, in the scope/dependencies sections.

### Step 5 — Load the FDD template

1. `read` `docs/project docs/FDD template.md`.
2. Keep the section structure and table formats.
3. Replace every placeholder with real content derived from the ADR, BRD, feature design, and stories.

### Step 6 — Synthesize and write the FDD

1. Choose a clean file name from the ADR/BRD title, e.g. `FDD-0039-Tenant-Offboarding-Data-Lifecycle-Export-And-Deletion.md`.
2. Create `docs/project docs/Functional-Design/` if it does not exist.
3. Write the FDD to `docs/project docs/Functional-Design/<file-name>.md`.
4. Fill each section:

| FDD Section | Source material |
|---|---|
| 1. Document Control | Use ADR/BRD status, today's date, and author/approver placeholders. |
| 2. Purpose and Scope | Combine the ADR context with the BRD in/out-of-scope and feature design scope. |
| 3. Context and Background | Summarize the ADR context, BRD current state, and the problem being solved. |
| 4. Goals and Objectives | Pull from BRD business objectives and ADR positive consequences. |
| 5. Functional Requirements | Turn BRD functional requirements into detailed functional capabilities with inputs, processing, outputs, and error handling. Add feature design details where available. |
| 6. User Interaction and Workflows | Use the BRD user flow, feature design, and the related user stories (actors, use cases, acceptance criteria). |
| 7. Data Requirements | List tables, entities, attributes, and validation rules from the BRD data requirements and the ADR's technical decisions. |
| 8. Business Rules and Logic | Extract authorization, validation, lifecycle, and ordering rules from the BRD business rules and the ADR. |
| 9. Interfaces and Integrations | Map the feature to existing components, APIs, and downstream systems named in the ADR/BRD (e.g. Key Vault, Blob Storage, Postgres, Service Bus). |
| 10. Non-Functional Considerations | Pull from the BRD non-functional requirements and ADR consequences (performance, security, reliability, scalability, audit, accessibility). |
| 11. Error Handling and Exceptions | Translate BRD error scenarios and ADR constraints into user-facing and system-facing error handling. |
| 12. Assumptions and Dependencies | Use the BRD assumptions/dependencies and the ADR related documents/constraints. |
| 13. Open Questions | Carry over unresolved questions from the BRD and ADR. |
| 14. Appendix | Link to the ADR, BRD, feature design, deep-research brief, and related user stories. |

### Step 7 — Validate and report

1. Re-read the generated FDD for consistency and correctness.
2. Verify that the file is in `docs/project docs/Functional-Design/`.
3. Report the file path and a one-paragraph summary of the feature to the user.
4. Ask whether the user wants the file committed.

## Output

- A single Markdown file: `docs/project docs/Functional-Design/FDD-00NN-<feature-name>.md`
- A short summary from the agent.

## Rules

- Do not modify source ADRs, feature designs, BRDs, user stories, or the FDD template.
- Do not write implementation code or contract tests.
- If the ADR is `Proposed` rather than `Accepted`, include a note in the FDD that it is a draft for review and may change.
- If a related feature design or story cannot be found, explicitly note the missing source in the FDD appendices and report it to the user.
- If a matching BRD cannot be found, stop and ask the user to provide the BRD path or run the BRD Writer Agent first.
- Keep the language design-oriented: describe what the system must do, the data it uses, the rules it enforces, and the interfaces it exposes. Avoid implementation specifics such as file names, exact code, or schema migrations unless they are necessary to express a functional requirement.

## Subagent invocation

Use `subagent_general` so the agent can create the output directory and write the FDD file.

```text
run_subagent({
  title: "FDD writer: <ADR or BRD number>",
  profile: "subagent_general",
  task: "Run the FDD Writer Agent. Target: ADR-0039 / BRD-0039 (or the user's input). Read docs/adr/<NNN>-<adr>.md, docs/project docs/Business-Requirements/BRD-<NNN>-<feature>.md, docs/product-research/feature-designs/<feature>.md, and docs/user-stories/epic-*.md, then write a complete Functional Design Document into docs/project docs/Functional-Design/FDD-<NNN>-<feature>.md using docs/project docs/FDD template.md. Report the generated file path and a short summary."
})
```
