#!/usr/bin/env node
'use strict';

/**
 * CI gate for docs/implementation-log.md — copy to
 * <repo>/scripts/check-implementation-log.cjs during Phase 0, run from
 * that repo's root (see docs/templates/ci-workflow.md).
 *
 * Verifies, independent of anyone's say-so:
 *   1. Every entry whose Repo matches the current repo names a commit
 *      that actually exists here.
 *   2. That commit's actual file list (from git, not memory) matches the
 *      entry's claimed "Files touched" list, set-for-set.
 *   3. docs/implementation-log.md was only ever appended to since
 *      IMPL_LOG_BASE_REF (default origin/main) — no prior line edited or
 *      removed.
 *
 * Cannot verify semantic correctness — only that the claims are real.
 * See docs/implementation-methodology.md.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.cwd();
const REPO_NAME = path.basename(REPO_ROOT);
const LOG_PATH =
  process.env.IMPL_LOG_PATH || path.join(REPO_ROOT, '..', 'docs', 'implementation-log.md');
const BASE_REF = process.env.IMPL_LOG_BASE_REF || 'origin/main';

function sh(cmd, cwd) {
  return execSync(cmd, { cwd: cwd || REPO_ROOT, encoding: 'utf8' }).trim();
}

function parseEntries(text) {
  const blocks = text.split(/^## /m).slice(1);
  return blocks.map((block) => {
    const field = (label) => {
      const m = block.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*\`?([^\`\n]+)\`?`));
      return m ? m[1].trim() : null;
    };
    const filesRaw = field('Files touched');
    return {
      header: block.split('\n')[0].trim(),
      commit: field('Full commit'),
      repo: field('Repo'),
      files: filesRaw
        ? filesRaw
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean)
        : [],
    };
  });
}

let failed = false;

// --- 1 & 2: hash existence + file-list match, for entries in this repo ---
if (fs.existsSync(LOG_PATH)) {
  const entries = parseEntries(fs.readFileSync(LOG_PATH, 'utf8'));
  const mine = entries.filter((e) => e.repo === REPO_NAME);

  for (const entry of mine) {
    if (!entry.commit) {
      console.error(`FAIL: entry "${entry.header}" has no parseable commit hash.`);
      failed = true;
      continue;
    }

    try {
      // Plain existence check (no `^{commit}` peel syntax): execSync runs
      // through cmd.exe on Windows by default, which treats `^` as its own
      // escape character and silently eats it, corrupting the revision.
      sh(`git cat-file -e ${entry.commit}`);
    } catch {
      console.error(
        `FAIL: entry "${entry.header}" claims commit ${entry.commit}, which doesn't exist in ${REPO_NAME}.`
      );
      failed = true;
      continue;
    }

    let actualFiles;
    try {
      actualFiles = sh(`git show --stat --format= ${entry.commit}`)
        .split('\n')
        .filter((l) => l.includes(' | ')) // excludes the trailing "N files changed, ..." summary line
        .map((l) => l.split('|')[0].trim())
        .filter(Boolean);
    } catch {
      console.error(`FAIL: could not read file list for commit ${entry.commit}.`);
      failed = true;
      continue;
    }

    const claimed = new Set(entry.files);
    const actual = new Set(actualFiles);
    const missing = [...claimed].filter((f) => !actual.has(f));
    const extra = [...actual].filter((f) => !claimed.has(f));

    if (missing.length || extra.length) {
      console.error(`FAIL: entry "${entry.header}" file list doesn't match commit ${entry.commit}.`);
      if (missing.length) console.error(`  claimed but not in commit: ${missing.join(', ')}`);
      if (extra.length) console.error(`  in commit but not claimed: ${extra.join(', ')}`);
      failed = true;
    }
  }

  console.log(
    `Checked ${mine.length} implementation-log entr${mine.length === 1 ? 'y' : 'ies'} for ${REPO_NAME}.`
  );
} else {
  console.log(`No implementation log found at ${LOG_PATH} — skipping hash/file checks.`);
}

// --- 3: append-only check on the log file itself ---
const docsRepoDir = process.env.DOCS_REPO_PATH || path.dirname(LOG_PATH);
try {
  const relPath = path.relative(docsRepoDir, LOG_PATH) || 'implementation-log.md';
  const diff = sh(`git diff ${BASE_REF} -- ${JSON.stringify(relPath)}`, docsRepoDir);
  const removedLines = diff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'));

  if (removedLines.length > 0) {
    console.error(
      `FAIL: implementation-log.md has ${removedLines.length} removed/modified line(s) since ${BASE_REF} — append-only violation.`
    );
    removedLines.forEach((l) => console.error(`  ${l}`));
    failed = true;
  } else {
    console.log(`Append-only check OK against ${BASE_REF}.`);
  }
} catch (err) {
  console.log(
    `Append-only check skipped (not a git checkout of the docs repo here, or ${BASE_REF} unavailable): ${
      String(err.message || err).split('\n')[0]
    }`
  );
}

if (failed) {
  console.error('\nImplementation log verification failed.');
  process.exit(1);
}
console.log('Implementation log verification OK.');
