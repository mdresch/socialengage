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
//   git diff | node docs/ai-roles/scripts/invoke-mistral-agent.cjs - --role product-market --register
//     Attaches that role's own register file's current content as extra context (so the
//     reviewer doesn't repeat an already-logged finding), then appends a dated entry with the
//     response to that same register file — mirroring invoke-gemini-agent.mjs's own --register
//     flag. Only product-market has a register configured today
//     (docs/product/product-market-register.md); pragmatism does not yet — passing --register
//     with --role pragmatism fails clearly rather than silently no-op'ing.
//
// A caveat, stated honestly rather than assumed away: the text-extraction path used for
// --register's appended entry (extractResponseText(), below) has not yet been empirically
// verified against a real Mistral Conversations API response in this repo — no prior use of
// this script has extracted anything from the response, only printed the raw JSON. It tries
// several plausible response shapes and falls back to the raw JSON (clearly labeled) if none
// match, logging to stderr which path was used, specifically so the first real --register run
// makes it obvious whether the extraction worked rather than silently producing garbage.

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

// role slug -> [charter file, env var prefix, register file path relative to docs/ai-roles/scripts/ (or null — no register yet)]
const ROLES = {
  pragmatism: ['engineering-pragmatism-reviewer.md', 'MISTRAL_ENGINEERING_PRAGMATISM', null],
  'product-market': [
    'product-market-reviewer.md',
    'MISTRAL_PRODUCT_MARKET_FIT',
    path.join('..', '..', 'product', 'product-market-register.md'),
  ],
};

const ROLE = argValue('--role') || 'pragmatism';
if (!ROLES[ROLE]) {
  fail(`Unknown --role "${ROLE}". Known roles: ${Object.keys(ROLES).join(', ')}`);
}
const [CHARTER_FILE, ENV_PREFIX, REGISTER_RELATIVE_PATH] = ROLES[ROLE];
const REGISTER_PATH = REGISTER_RELATIVE_PATH ? path.join(__dirname, REGISTER_RELATIVE_PATH) : null;
const USE_REGISTER = process.argv.includes('--register');
if (USE_REGISTER && !REGISTER_PATH) {
  fail(`--register given but role "${ROLE}" has no register file configured yet.`);
}
if (USE_REGISTER && !fs.existsSync(REGISTER_PATH)) {
  fail(`--register given but ${REGISTER_PATH} does not exist.`);
}

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Best-effort text extraction from a Mistral Conversations API response —
 * NOT yet empirically verified against a real response in this repo (see
 * the file-header caveat). Tries a few plausible shapes, in order, and
 * falls back to the labeled raw JSON if none match, so a mismatch is
 * visible in the register rather than silently producing garbage.
 */
function extractResponseText(data) {
  const candidates = [
    () => data.outputs?.find((o) => typeof o.content === 'string')?.content,
    () => data.outputs?.[0]?.content,
    () => data.choices?.[0]?.message?.content,
    () => (typeof data.output_text === 'string' ? data.output_text : undefined),
  ];
  for (const candidate of candidates) {
    const value = candidate();
    if (typeof value === 'string' && value.trim().length > 0) {
      console.error('[extractResponseText: matched a known shape]');
      return value;
    }
  }
  console.error('[extractResponseText: no known shape matched — falling back to raw JSON]');
  return `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

async function main() {
  const material = readInput();

  let userContent = material;
  if (USE_REGISTER) {
    const existingRegister = fs.readFileSync(REGISTER_PATH, 'utf8');
    userContent =
      `## Existing Register (context only — do not repeat findings already logged here; ` +
      `if the material below shows a previously logged finding is now resolved, say so ` +
      `explicitly, don't just silently omit it)\n\n${existingRegister}\n\n---\n\n` +
      `## Material under review\n\n${material}`;
  }

  const res = await fetch('https://api.mistral.ai/v1/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      agent_id: AGENT_ID,
      agent_version: AGENT_VERSION,
      inputs: [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    fail(`Mistral API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  if (USE_REGISTER) {
    const materialLabel = inputArg === '-' ? 'stdin (e.g. git diff)' : inputArg;
    const text = extractResponseText(data);
    const entry = `\n## ${todayIso()} — reviewed ${materialLabel}\n\n${text}\n\n---\n`;
    fs.appendFileSync(REGISTER_PATH, entry, 'utf8');
    console.error(`\n[appended to ${REGISTER_PATH}]`);
  }
}

main().catch((err) => fail(String(err && err.stack ? err.stack : err)));
