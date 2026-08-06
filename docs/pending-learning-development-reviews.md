# Pending Learning & Development Reviews

**Queued by:** `scripts/git-hooks/post-commit`, one entry per commit, automatically, non-blocking. **Reviewed by:** the Learning & Development Writer (`.claude/agents/learning-development-writer.md`) whenever a Claude Code session is actively working in this repo and checks this file — not a live daemon, not guaranteed same-day. Append-only, same discipline as `docs/implementation-log.md`: a reviewed entry gets struck through with a dated resolution note (whether the commit shipped anything user-facing, and which manual(s) got updated, if any), never deleted.

**What "reviewed" means here:** the Writer may edit the three manuals under `docs/manuals/` directly (`Edit`/`Write` tools) — but it never commits its own changes. A human commit (Menno's own, or Claude Code committing only when explicitly asked to) is the approval gate, the same "propose in the working tree, human commit confirms" pattern this project already uses for every other AI-role output. An entry here is only marked resolved once any resulting manual edit has actually been committed, not merely drafted. Most commits will resolve with "no user-facing change — nothing to document" and that's a legitimate, reportable outcome, not a non-answer.

---
