# CI workflow template

Copy to `<repo>/.github/workflows/contract-suite.yml` during Phase 0, for both `social-listening-core` and `social-listening-admin`. This is the real enforcement backstop — a required status check on branch protection (set that up manually in GitHub repo settings once the repo exists; it can't be configured from a file) means a PR literally cannot merge without the full accumulated contract suite passing, regardless of what any local hook did or didn't catch.

```yaml
name: Contract Suite

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - name: Full contract suite (permanent regression gate)
        run: npx jest contracts --ci
      - name: Contract traceability check
        run: node scripts/check-contract-traceability.cjs

      # --- Implementation Log verification (needs the docs repo too) ---
      # Assumes the docs repo (this one — the one containing
      # docs/implementation-log.md) has been pushed to its own GitHub
      # remote by Phase 0. Fill in <owner>/socialengage below once that's
      # real; this whole block is inert (checkout will fail) until then.
      - name: Check out docs repo
        uses: actions/checkout@v4
        with:
          repository: <owner>/socialengage
          path: docs-repo
          fetch-depth: 0 # full history — the append-only check diffs against origin/main
      - name: Implementation log verification
        env:
          IMPL_LOG_PATH: ${{ github.workspace }}/docs-repo/docs/implementation-log.md
          DOCS_REPO_PATH: ${{ github.workspace }}/docs-repo
          IMPL_LOG_BASE_REF: origin/main
        run: node scripts/check-implementation-log.cjs
```

`scripts/check-contract-traceability.cjs` is [`docs/templates/check-contract-traceability.cjs`](check-contract-traceability.cjs) — copy it in as-is. It verifies naming convention and that every contract is referenced by a component `SKILL.md`; it does not and cannot verify a contract's *semantic* correctness against its story's Acceptance Criteria.

`scripts/check-implementation-log.cjs` is [`docs/templates/check-implementation-log.cjs`](check-implementation-log.cjs) — copy it in as-is. It independently recomputes each log entry's commit-hash existence and file list from git (not from what the entry claims) and verifies the log file itself was only ever appended to, never edited. Verified against a real synthetic git repo before being written into this template — correct hash-existence syntax (`git cat-file -e`, without the `^{commit}` peel suffix, which `execSync`'s default Windows shell mangles), correct file-list extraction (`git diff-tree --no-commit-id --name-only -r`, not `git show --stat` — the latter's path column truncates long paths to fit terminal width, reproduced in practice on Story 1.1's first real commit even at a plain 80-column non-tty default; see `docs/implementation-methodology.md`'s Amendment Log), and correct append-only diffing, all confirmed with real commits, not just reasoned about.

**Once this is wired to branch protection as a required check**, this is the one part of the whole methodology that's genuinely non-negotiable, not just followed by convention: GitHub itself, not an agent's judgment, decides whether the merge is allowed.

**If this goes red**, don't fix it ad hoc — invoke the `heal-contract-failure` skill. It re-walks Intent, Contract, `SKILL.md`, and Implementation in that fixed order and enforces that the repair restores correct behavior rather than weakening whichever check caught the problem (a real risk here, since the same agent fixing the failure typically has edit access to the contracts, the lint config, and this workflow file too). See `docs/implementation-methodology.md`'s "On failure" section.
