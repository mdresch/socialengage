#!/usr/bin/env node
'use strict';

/**
 * PreToolUse guard for Write|Edit.
 *
 * Coarse, mechanical version of docs/implementation-methodology.md's "contract
 * before code" rule: blocks writes under <repo>/src/** for the guarded repos
 * unless that repo's contracts/ directory already contains at least one
 * *.contract.test.ts file. Does NOT verify the contract matches the specific
 * change being made — that precision isn't achievable from a file-existence
 * check alone. See docs/implementation-plan.md's "enforceable half" discussion.
 */

const fs = require('fs');

const GUARDED_REPOS = ['social-listening-core', 'social-listening-admin'];

function allow() {
  process.stdout.write(JSON.stringify({}));
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      systemMessage: reason,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
}

function hasAnyContract(contractsDir) {
  if (!fs.existsSync(contractsDir)) return false;
  try {
    const entries = fs.readdirSync(contractsDir, { recursive: true });
    return entries.some((entry) => String(entry).endsWith('.contract.test.ts'));
  } catch {
    return false;
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input || '{}');
  } catch {
    // Malformed/empty stdin: fail open, don't block on a hook bug.
    allow();
    return;
  }

  const toolName = payload.tool_name;
  const filePath = payload.tool_input && payload.tool_input.file_path;

  if ((toolName !== 'Write' && toolName !== 'Edit') || !filePath) {
    allow();
    return;
  }

  const normalized = String(filePath).replace(/\\/g, '/');

  const repoMatch = GUARDED_REPOS.find((repo) =>
    normalized.lastIndexOf(`${repo}/src/`) !== -1
  );

  if (!repoMatch) {
    allow();
    return;
  }

  const idx = normalized.lastIndexOf(`${repoMatch}/src/`);
  const repoRoot = normalized.slice(0, idx + repoMatch.length);
  const contractsDir = `${repoRoot}/contracts`;

  if (hasAnyContract(contractsDir)) {
    allow();
    return;
  }

  deny(
    `Blocked: writing to ${repoMatch}/src/ before any contract test exists in ` +
      `${repoMatch}/contracts/. Per docs/implementation-methodology.md, write a Jest ` +
      `contract (*.contract.test.ts) first, then implement — use the implement-story ` +
      `skill rather than writing implementation code directly. ` +
      `(This check is repo-wide, not per-story: any existing contract unblocks any ` +
      `src write in that repo. It cannot verify the contract matches this specific ` +
      `change — that's a review responsibility, not a mechanical one.)`
  );
});
