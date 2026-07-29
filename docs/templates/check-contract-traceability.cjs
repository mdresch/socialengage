#!/usr/bin/env node
'use strict';

/**
 * CI traceability gate — copy to <repo>/scripts/check-contract-traceability.cjs
 * during Phase 0 and run from the repo root (see docs/templates/ci-workflow.md).
 *
 * Every contracts/**\/*.contract.test.ts file must:
 *   1. Follow the story-<epic>.<num>.<slug>.contract.test.ts naming convention
 *      (docs/implementation-methodology.md's "Conventions" section).
 *   2. Name a story that actually exists in ../docs/user-stories/.
 *   3. Be referenced by at least one component .claude/skills/*\/SKILL.md.
 *
 * This checks naming and cross-referencing, not semantic correctness — it
 * cannot verify a contract actually tests what its story's Acceptance
 * Criteria promise. That's a review responsibility, not a mechanical one.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.cwd();
const CONTRACTS_DIR = path.join(REPO_ROOT, 'contracts');
const SKILLS_DIR = path.join(REPO_ROOT, '.claude', 'skills');
const DOCS_STORIES_DIR = path.join(REPO_ROOT, '..', 'docs', 'user-stories');

function walk(dir, filterFn, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filterFn, acc);
    else if (filterFn(entry.name)) acc.push(full);
  }
  return acc;
}

const contractFiles = walk(CONTRACTS_DIR, (n) => n.endsWith('.contract.test.ts'));
const skillFiles = walk(SKILLS_DIR, (n) => n === 'SKILL.md');
const skillContents = skillFiles.map((f) => fs.readFileSync(f, 'utf8'));

let storyText = '';
if (fs.existsSync(DOCS_STORIES_DIR)) {
  for (const f of fs.readdirSync(DOCS_STORIES_DIR)) {
    if (f.endsWith('.md')) {
      storyText += fs.readFileSync(path.join(DOCS_STORIES_DIR, f), 'utf8');
    }
  }
}

let failed = false;

for (const file of contractFiles) {
  const base = path.basename(file);
  const match = base.match(/^story-(\d+\.\d+)\./);

  if (!match) {
    console.error(`FAIL: ${base} doesn't follow story-X.Y.<slug>.contract.test.ts naming.`);
    failed = true;
    continue;
  }

  const storyNum = match[1];

  if (storyText && !storyText.includes(`Story ${storyNum}`)) {
    console.error(`FAIL: ${base} claims Story ${storyNum}, not found in docs/user-stories/.`);
    failed = true;
  }

  const referenced = skillContents.some((content) => content.includes(base));
  if (!referenced) {
    console.error(`FAIL: ${base} isn't referenced by any component SKILL.md.`);
    failed = true;
  }
}

if (failed) {
  console.error(`\nTraceability check failed (${contractFiles.length} contract file(s) checked).`);
  console.error('See docs/implementation-methodology.md.');
  process.exit(1);
}

console.log(`Traceability OK: ${contractFiles.length} contract file(s) checked.`);
