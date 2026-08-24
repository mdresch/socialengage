# SocialEngage workspace guidance

This workspace contains the primary applications:

- [social-listening-core](social-listening-core) for the backend and API
- [social-listening-admin](social-listening-admin) for the Next.js admin UI
- [project-progress-dashboard](project-progress-dashboard) for the standalone Next.js project progress dashboard

## Start here

Before changing behavior, read the project guidance in:
- [docs/implementation-methodology.md](docs/implementation-methodology.md) for the required contract-first workflow
- [docs/implementation-plan.md](docs/implementation-plan.md) for the current phase and story order
- [docs/adr/README.md](docs/adr/README.md) and [docs/user-stories/README.md](docs/user-stories/README.md) for the governing decisions and acceptance criteria

## Working conventions

- Prefer the smallest change that satisfies the current story or repair request.
- For story work, follow the contract-first loop described in [docs/implementation-methodology.md](docs/implementation-methodology.md): intent, contract, skill update, implementation, validation.
- Keep contracts in the repo-local contract folders and update the relevant component skill file in [.claude/skills](.claude/skills) when behavior changes.
- Treat [docs/implementation-log.md](docs/implementation-log.md) as an append-only record; do not rewrite prior entries.

## Repo boundaries

- Backend changes belong in [social-listening-core](social-listening-core).
- Frontend changes belong in [social-listening-admin](social-listening-admin).
- The admin UI talks to the core API; it should not bypass that boundary or access the database directly.
- When a story requires coordinated changes in both repos, implement and validate the backend contract first, then implement the frontend against that contract in a separate step.

## Common commands

- Backend: run the scripts from [social-listening-core/package.json](social-listening-core/package.json)
- Admin UI: run the scripts from [social-listening-admin/package.json](social-listening-admin/package.json)

See [social-listening-core/package.json](social-listening-core/package.json) and [social-listening-admin/package.json](social-listening-admin/package.json) for the exact local setup and test commands.
