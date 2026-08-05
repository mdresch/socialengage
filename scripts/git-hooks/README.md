# Git Hooks for socialengage

This directory contains git hooks used to enforce project discipline, particularly contract-first implementation.

## Pre-commit Hook

The `pre-commit` hook is the commit-boundary backstop for the same rule `.claude/hooks/enforce-contract-first.cjs` checks in real time (see `docs/templates/pre-commit-hook.md`): a commit touching `social-listening-core/src/` or `social-listening-admin/src/` must also stage a `*.contract.test.ts` file under that repo's `contracts/`. It catches code written outside a Claude Code session, or where the real-time hook was bypassed.

It's a repo-wide check, not per-file — it can confirm *a* contract is staged, not that it's *the right* contract for this specific change (see `docs/implementation-methodology.md`).

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

- `pre-commit` - The main hook script (POSIX shell)
- This README.md - Documentation

## Related Documentation

- [Pre-commit Hook Template](../../docs/templates/pre-commit-hook.md)
- [Implementation Methodology](../../docs/implementation-methodology.md)
