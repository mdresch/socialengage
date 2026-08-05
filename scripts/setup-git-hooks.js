#!/usr/bin/env node

/**
 * Setup Git Hooks for socialengage
 *
 * Installs every hook in scripts/git-hooks/ (see scripts/git-hooks/README.md):
 *   - pre-commit: enforces contract-first commits
 *   - post-commit: queues each commit for the Ideal Manager's own review
 *     (docs/management/pending-manager-reviews.md)
 *
 * Usage:
 *   node scripts/setup-git-hooks.js
 *
 * Or on Windows (PowerShell):
 *   node scripts\setup-git-hooks.js
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.cwd();
const HOOKS_DIR = path.join(REPO_ROOT, '.git', 'hooks');
const SOURCE_DIR = path.join(REPO_ROOT, 'scripts', 'git-hooks');
const HOOK_NAMES = ['pre-commit', 'post-commit'];

console.log('Setting up Git hooks for socialengage...\n');

if (!fs.existsSync(path.join(REPO_ROOT, '.git'))) {
  console.error('Error: This is not a Git repository.');
  process.exit(1);
}

if (!fs.existsSync(HOOKS_DIR)) {
  fs.mkdirSync(HOOKS_DIR, { recursive: true });
  console.log(`Created directory: ${HOOKS_DIR}`);
}

let anyFailed = false;

for (const hookName of HOOK_NAMES) {
  const hookSource = path.join(SOURCE_DIR, hookName);
  const hookTarget = path.join(HOOKS_DIR, hookName);

  if (!fs.existsSync(hookSource)) {
    console.error(`Error: Source hook not found at ${hookSource}`);
    anyFailed = true;
    continue;
  }

  try {
    try {
      const relativePath = path.relative(HOOKS_DIR, hookSource);
      if (fs.existsSync(hookTarget)) {
        fs.unlinkSync(hookTarget);
      }
      fs.symlinkSync(relativePath, hookTarget);
      console.log(`Created symlink: ${hookTarget} -> ${relativePath}`);
    } catch (e) {
      fs.copyFileSync(hookSource, hookTarget);
      console.log(`Copied: ${hookSource} -> ${hookTarget}`);
    }

    try {
      fs.chmodSync(hookTarget, 0o755);
      console.log(`Made executable: ${hookTarget}`);
    } catch (e) {
      console.log(`Note: Could not set executable permissions (Windows?): ${e.message}`);
    }
  } catch (err) {
    console.error(`Error installing ${hookName}: ${err.message}`);
    anyFailed = true;
  }
}

if (anyFailed) {
  process.exit(1);
}

console.log('\n✅ Git hooks installed successfully!\n');
console.log('pre-commit will block commits that touch src/ without a staged contract test.');
console.log('post-commit will queue every commit in docs/management/pending-manager-reviews.md');
console.log('for the Ideal Manager to review (non-blocking, no effect on the commit itself).');
console.log('\nTo bypass either hook (not recommended):');
console.log('  git commit --no-verify -m "Commit message"');
