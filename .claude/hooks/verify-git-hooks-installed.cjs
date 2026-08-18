#!/usr/bin/env node
'use strict';

/**
 * SessionStart guard — closes a real, named gap: scripts/setup-git-hooks.js
 * (the pre-commit contract-first backstop + post-commit review-queue hook)
 * only ever runs if someone remembers to run it by hand after cloning. A
 * fresh clone with no .git/hooks/pre-commit or post-commit installed looks
 * identical to one where nothing is pending review — an empty queue file
 * can't be distinguished from a hook that silently never ran (see the Ideal
 * Manager's 2026-08-18 register finding). This check runs once per session
 * start, verifies both hooks are actually present, and self-heals by
 * re-running the same installer a human would, rather than just warning.
 *
 * Deliberately non-blocking: this never denies session start, even on
 * failure — the same "fail open, don't block on a hook bug" posture
 * enforce-contract-first.cjs already uses for malformed input.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = process.cwd();
const HOOKS_DIR = path.join(REPO_ROOT, '.git', 'hooks');
const HOOK_NAMES = ['pre-commit', 'post-commit'];
const INSTALLER = path.join(REPO_ROOT, 'scripts', 'setup-git-hooks.js');

function bothInstalled() {
  return HOOK_NAMES.every((name) => fs.existsSync(path.join(HOOKS_DIR, name)));
}

function say(message) {
  process.stdout.write(JSON.stringify({ systemMessage: message }));
}

if (!fs.existsSync(path.join(REPO_ROOT, '.git')) || !fs.existsSync(INSTALLER)) {
  // Not a git repo, or run from somewhere the installer can't be found —
  // nothing this check can meaningfully verify. Fail open, silently.
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

if (bothInstalled()) {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

try {
  execFileSync('node', [INSTALLER], { cwd: REPO_ROOT, stdio: 'ignore' });
  if (bothInstalled()) {
    say(
      'Git hooks were missing (a fresh clone or a hook that never got installed) — ' +
        'ran scripts/setup-git-hooks.js automatically to install pre-commit ' +
        '(contract-first enforcement) and post-commit (review-queue) hooks.'
    );
  } else {
    say(
      'scripts/setup-git-hooks.js ran but one or both git hooks still ' +
        'aren’t present at .git/hooks/ — check its own output directly ' +
        '(node scripts/setup-git-hooks.js) rather than trusting this session silently.'
    );
  }
} catch (err) {
  say(
    `Could not auto-install git hooks (${err.message}) — run ` +
      '`node scripts/setup-git-hooks.js` manually before committing, or ' +
      'pre-commit/post-commit enforcement won’t be active this session.'
  );
}
process.exit(0);
