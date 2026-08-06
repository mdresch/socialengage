# Pending Documentation Steward Reviews

**Queued by:** `scripts/git-hooks/post-commit`, one entry per commit, automatically, non-blocking. **Reviewed by:** the Documentation Steward (`.claude/agents/documentation-steward.md`) whenever a Claude Code session is actively working in this repo and checks this file — not a live daemon, not guaranteed same-day. Append-only, same discipline as `docs/implementation-log.md`: a reviewed entry gets struck through with a dated resolution note (what drift was found, if any, and which files were corrected), never deleted.

**What "reviewed" means here:** the Documentation Steward may edit stale docs directly (`Edit`/`Write` tools, added 2026-08-06 specifically so it can propose real corrections, not just describe them) — but it never commits its own changes. A human commit (Menno's own, or Claude Code committing only when explicitly asked to) is the approval gate, the same "propose in the working tree, human commit confirms" pattern this project already uses for every other AI-role output. An entry here is only marked resolved once its proposed corrections have actually been committed, not merely drafted.

---
