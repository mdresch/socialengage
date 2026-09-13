# Git Hooks for socialengage

This directory contains git hooks used to enforce project discipline, particularly contract-first implementation. It also contains `post-commit`, which queues every commit for three independent reviews (Ideal Manager, Documentation Steward, Learning & Development Writer) — see that hook's own source comments for the full account; this README's own "Files" section below was never updated to mention it and is corrected here, not rewritten.

## Automatic installation via SessionStart (added 2026-08-18)

Manually running `node scripts/setup-git-hooks.js` after cloning is easy to forget — and a fresh clone with neither hook installed looks identical, from the review-queue files alone, to one where nothing is actually pending review (an Ideal Manager register finding, 2026-08-18: "the queue is empty" can't be trusted without an independent git-log cross-check). `.claude/hooks/verify-git-hooks-installed.cjs`, wired as a `SessionStart` hook in `.claude/settings.json`, checks at the start of every Claude Code session whether both `.git/hooks/pre-commit` and `.git/hooks/post-commit` exist and, if either is missing, runs this same installer automatically. Non-blocking — it never prevents a session from starting, even if the install itself fails (matching `enforce-contract-first.cjs`'s own "fail open, don't block on a hook bug" posture). This does not replace running the installer yourself outside a Claude Code session (e.g. a fresh clone opened in a plain editor/terminal) — see Manual/Automatic Setup below for that path.

## Pre-commit Hook

The `pre-commit` hook is the commit-boundary backstop for the same rule `.claude/hooks/enforce-contract-first.cjs` checks in real time (see `docs/templates/pre-commit-hook.md`): a commit touching `social-listening-core/src/` or `social-listening-admin/src/` must also stage a `*.contract.test.ts` file under that repo's `contracts/`. It catches code written outside a Claude Code session, or where the real-time hook was bypassed.

It's a repo-wide check, not per-file — it can confirm *a* contract is staged, not that it's *the right* contract for this specific change (see `docs/implementation-methodology.md`).

### Pending commit-hash backfill (added 2026-09-09)

The same `pre-commit` hook also resolves `docs/implementation-log.md`/story-file `Built:` lines still reading a literal `pending` commit hash — the placeholder `implement-story`/`heal-contract-failure` write when the log entry has to be committed in the same commit as the implementation, before that commit's own hash exists (`docs/implementation-methodology.md` §7). On every subsequent commit, before it's created, the hook checks whether `HEAD`'s own diff (versus `HEAD~1`) introduced a `pending` marker and, if so, replaces it with `HEAD`'s now-known hash, staging the fix so it rides along in the commit about to be made — no dedicated commit just for the hash. It never touches a `pending` marker introduced further back than the immediate parent (a sign the invariant broke somewhere), and never fails the commit if this step itself errors.

## Installation

### Automatic Setup

Run the setup script from the project root:

```bash
# Using bash
node scripts/setup-git-hooks.js

# Using Windows PowerShell
node scripts\setup-git-hooks.js
```

This will:
- Copy the pre-commit hook to `.git/hooks/pre-commit`
- Make it executable
- Output installation status

### Manual Setup

Alternatively, you can install the hook manually:

```bash
# Copy the hook
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit

# Make it executable (Unix/Linux/Mac)
chmod +x .git/hooks/pre-commit
```

On Windows, the hook runs via Git Bash's `sh` (bundled with Git for Windows), so no explicit execute bit is required — copying the file is enough.

## When the Hook Runs

The hook runs on **every git commit**. It only blocks the commit when both are true:
- staged changes include a path under `social-listening-core/src/` or `social-listening-admin/src/`
- no staged path under that same repo's `contracts/` matches `*.contract.test.ts`

Any other commit (docs-only, config-only, a contract-only commit, etc.) passes through silently.

### Bypassing the Hook

To bypass the hook for a genuinely non-story change (e.g. a typo fix):

```bash
git commit --no-verify -m "Your commit message"
```

Note why in the commit message — see `docs/templates/pre-commit-hook.md`.

## Requirements

- A POSIX shell (`sh`) - present via Git Bash on Windows, native elsewhere
- The hook must be executable (on Unix-like systems); `setup-git-hooks.js` handles this

## Troubleshooting

### Hook doesn't run

1. Check that the file is in `.git/hooks/pre-commit`
2. Check that it's executable: `ls -la .git/hooks/pre-commit`
3. Check the shebang line is correct: `head -1 .git/hooks/pre-commit`
4. Try running it manually: `sh .git/hooks/pre-commit`

## Files

- `pre-commit` - The main hook script (POSIX shell): contract-first backstop plus the pending-commit-hash backfill described above
- `post-commit` - Queues each commit for three independent reviews (Ideal Manager, Documentation Steward, Learning & Development Writer) and, when the commit subject references a Story X.Y, runs the ADR-0122 telemetry capture + compile pipeline in the background
- This README.md - Documentation

## Related Documentation

- [Pre-commit Hook Template](../../docs/templates/pre-commit-hook.md)
- [Implementation Methodology](../../docs/implementation-methodology.md)
