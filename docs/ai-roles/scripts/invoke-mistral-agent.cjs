#!/usr/bin/env node
'use strict';

// Invokes a Mistral-hosted agent via Mistral's Conversations API, for whichever of this
// project's AI roles is currently assigned to Mistral. The agent's persona/instructions live
// on Mistral's side (Agent Builder), configured from that role's charter file's "Prompt
// block" — this script only sends the material under review as a user message and prints
// the response. It does not touch this repo's implement-story / heal-contract-failure
// enforcement in any way; it is a standalone review-triage tool.
//
// Currently assigned Mistral-hosted roles (docs/project docs/Stakeholder-Register.md):
//   pragmatism      — S-15, Engineering Pragmatism Reviewer (docs/ai-roles/engineering-pragmatism-reviewer.md)
//   product-market  — S-14, Product & Market-Fit Reviewer (docs/ai-roles/product-market-reviewer.md)
// Two is the current count, not a projected one — a third role reassigned to Mistral gets its
// own --role entry added here when it's real, not speculatively ahead of time.
//
// Setup: copy docs/ai-roles/.env.example to docs/ai-roles/.env and fill in real values.
// .env is gitignored at the repo root — never commit it.
//
// Usage:
//   node docs/ai-roles/scripts/invoke-mistral-agent.cjs <path-to-material-file>                      (defaults to --role pragmatism)
//   node docs/ai-roles/scripts/invoke-mistral-agent.cjs <path-to-material-file> --role product-market
//   git diff | node docs/ai-roles/scripts/invoke-mistral-agent.cjs - --role pragmatism
//   node docs/ai-roles/scripts/invoke-mistral-agent.cjs some.md --agent-id ag_...  (bypasses --role entirely)

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');
if (fs.existsSync(ENV_PATH)) {
  process.loadEnvFile(ENV_PATH);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// role slug -> [charter file, env var prefix]
const ROLES = {
  pragmatism: ['engineering-pragmatism-reviewer.md', 'MISTRAL_ENGINEERING_PRAGMATISM'],
  'product-market': ['product-market-reviewer.md', 'MISTRAL_PRODUCT_MARKET_FIT'],
};

const ROLE = argValue('--role') || 'pragmatism';
if (!ROLES[ROLE]) {
  fail(`Unknown --role "${ROLE}". Known roles: ${Object.keys(ROLES).join(', ')}`);
}
const [CHARTER_FILE, ENV_PREFIX] = ROLES[ROLE];

const API_KEY = process.env.MISTRAL_API_KEY;
const AGENT_ID = argValue('--agent-id') || process.env[`${ENV_PREFIX}_AGENT_ID`];
const AGENT_VERSION = Number(argValue('--agent-version') || process.env[`${ENV_PREFIX}_AGENT_VERSION`] || 1);
const inputArg = process.argv[2];

if (!inputArg || inputArg.startsWith('--')) {
  fail(
    'Usage: node invoke-mistral-agent.cjs <path-to-material-file | -> [--role pragmatism|product-market] [--agent-id ag_...] [--agent-version N]'
  );
}
if (!API_KEY) {
  fail('Missing MISTRAL_API_KEY. Copy docs/ai-roles/.env.example to docs/ai-roles/.env and fill in your key.');
}
if (!AGENT_ID) {
  fail(
    `Missing agent id for role "${ROLE}". Set ${ENV_PREFIX}_AGENT_ID in docs/ai-roles/.env ` +
      `(configure that Mistral agent using docs/ai-roles/${CHARTER_FILE}'s Prompt block as its ` +
      'system instructions first), or pass --agent-id directly.'
  );
}

function readInput() {
  if (inputArg === '-') {
    return fs.readFileSync(0, 'utf8'); // stdin, e.g. `git diff | node ... -`
  }
  return fs.readFileSync(inputArg, 'utf8');
}

async function main() {
  const material = readInput();

  const res = await fetch('https://api.mistral.ai/v1/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      agent_id: AGENT_ID,
      agent_version: AGENT_VERSION,
      inputs: [{ role: 'user', content: material }],
    }),
  });

  if (!res.ok) {
    fail(`Mistral API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => fail(String(err && err.stack ? err.stack : err)));
