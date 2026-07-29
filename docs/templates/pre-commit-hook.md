# Pre-commit hook template

Install via [Husky](https://typicode.github.io/husky/) in each repo during Phase 0 (`npx husky init`, then replace the generated `.husky/pre-commit` with the script below). This is the commit-boundary backstop for the same rule the `enforce-contract-first` Claude Code hook checks in real time (`.claude/hooks/enforce-contract-first.cjs`) — it catches the case where code was written outside a Claude Code session, or where the real-time hook was bypassed.

Same limitation as the real-time hook, stated plainly: this checks *a* contract file is staged alongside `src/` changes in the same commit, not that it's *the right* contract for *this specific* change. That precision isn't achievable mechanically — see `docs/implementation-methodology.md`.

```sh
#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"

# Enforces: a commit touching src/ must also stage a contract test.
# Repo-wide check, not per-file — see docs/implementation-methodology.md.

STAGED=$(git diff --cached --name-only --diff-filter=ACM)

TOUCHES_SRC=$(echo "$STAGED" | grep -E '^src/' || true)
TOUCHES_CONTRACTS=$(echo "$STAGED" | grep -E '^contracts/.*\.contract\.test\.ts$' || true)

if [ -n "$TOUCHES_SRC" ] && [ -z "$TOUCHES_CONTRACTS" ]; then
  echo "Blocked: this commit touches src/ but no contracts/*.contract.test.ts file is staged."
  echo "Per docs/implementation-methodology.md, every story's implementation needs a"
  echo "contract test committed alongside it. If this really is a non-story change"
  echo "(e.g. a typo fix), commit with --no-verify and note why in the commit message."
  exit 1
fi

exit 0
```

Deliberately fails open on `--no-verify` — a solo-developer project needs an escape hatch for genuinely non-story commits (typo fixes, doc updates within the repo, config tweaks), not a hook that has to be fought with. The point is to catch the default case, not to make deviation impossible (see the discussion in `docs/implementation-plan.md` on why full mechanical enforcement isn't achievable when the same actor being constrained can also disable the constraint).
