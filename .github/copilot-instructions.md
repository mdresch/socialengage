# Copilot instructions for SocialEngage

This repository is a multi-repo workspace for the SocialEngage Social Listening / Insights subsystem.

## Primary references

- [docs/implementation-methodology.md](../docs/implementation-methodology.md) — required workflow for story work and repair work
- [docs/implementation-plan.md](../docs/implementation-plan.md) — current phased roadmap and story sequencing
- [docs/adr/README.md](../docs/adr/README.md) — architectural decisions that constrain implementation
- [docs/user-stories/README.md](../docs/user-stories/README.md) — acceptance criteria for the current backlog

## Expectations for agents

- Work in the correct repo: backend work in [social-listening-core](../social-listening-core), frontend work in [social-listening-admin](../social-listening-admin).
- Prefer the smallest implementation that satisfies the current contract or request.
- Do not silently change behavior that is governed by an ADR or an existing contract.
- When a task is a story implementation, follow the contract-first workflow from [docs/implementation-methodology.md](../docs/implementation-methodology.md) rather than patching code directly.
- Keep documentation and implementation-log updates aligned with the actual work; do not rewrite historical entries.
