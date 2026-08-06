#!/usr/bin/env node

// Invokes a real, portal-created Microsoft Foundry Prompt Agent (Foundry Agent Service) —
// an agent whose instructions/model/tools were authored and versioned in the Foundry portal
// itself, referenced here by name + version, NOT by pasting a charter's Prompt block into a
// request. This is a genuinely different pattern from every other script in this folder
// (Mistral's separately-configured hosted agent by agent_id; Gemini/Ollama sending the
// charter's system instructions fresh on every call) — here, Foundry owns the agent
// definition entirely; this script's only job is to start a conversation and ask that named
// agent to respond. Built directly from Menno's own real, working Foundry-portal-generated
// sample code (2026-08-06, "ProductMarketFitReviewer" v2) — not from generic documentation,
// which (checked directly, Microsoft Learn) describes an older "classic"/deprecated
// Threads+Runs REST flow with API-key-shaped auth that does NOT match how a current Foundry
// Prompt Agent is actually invoked.
//
// Auth: Microsoft Entra ID via DefaultAzureCredential (@azure/identity) — NOT an API key.
// Locally, this means `az login` once; DefaultAzureCredential picks up that cached session
// automatically. No AZURE_..._API_KEY var exists for this script, unlike the raw-model
// endpoints Gemini/Mistral use — this is a real, different credential shape, not an oversight.
//
// Request shape, empirically verified end-to-end 2026-08-06 (real API calls, real agent, real
// response — not assumed from the portal's own generated sample, which turned out to itself be
// stale): the portal's own "Code" tab generates { agent: { name, version, type:
// "agent_reference" } }, which the live API actually rejects with "The 'agent' property is
// deprecated. Use 'agent_reference' instead." The corrected, working shape is
// { agent_reference: { type: "agent_reference", name, version } } — type lives INSIDE
// agent_reference, not as a sibling of it. Also confirmed directly: version: "latest" is NOT
// accepted (404 "... with version latest not found") — bump AGENT_VERSION by hand each time you
// publish a new version of the agent in the portal; there is no floating-latest alias.
// response.output_text is a real, confirmed field on a successful response.
//
// Currently assigned Foundry Prompt Agent roles (docs/project docs/Stakeholder-Register.md):
//   product-market — S-14, Product & Market-Fit Reviewer (docs/ai-roles/product-market-reviewer.md) —
//                    added 2026-08-06 as a second backend alongside Mistral, specifically
//                    because Mistral has a real, recurring capacity/usage-limit constraint
//                    under load (see that charter's own "Assigned model" note). Does NOT
//                    retire the Mistral path — both remain available.
// legal-compliance is NOT wired here yet: that role has a provisioned Azure AI Foundry model
// deployment (gpt-5.2, Sweden Central) but no portal-created Prompt Agent object of its own —
// add its own AGENT_NAME/AGENT_VERSION here once one actually exists, not speculatively ahead
// of time.
//
// Setup:
//   1. az login  (once; DefaultAzureCredential reuses this session)
//   2. Create/edit the Prompt Agent in the Foundry portal (https://ai.azure.com) using the
//      role's own charter "Prompt block" as its instructions, note its exact name + version.
//   3. Copy docs/ai-roles/.env.example to docs/ai-roles/.env and fill in
//      AZURE_AI_FOUNDRY_<ROLE>_PROJECT_ENDPOINT / _AGENT_NAME / _AGENT_VERSION.
//
// Usage:
//   node docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs <path-to-material-file> --role product-market
//   git diff | node docs/ai-roles/scripts/invoke-azure-foundry-agent.mjs - --role product-market --register
//     Attaches that role's own register file's current content as extra context (so the
//     reviewer doesn't repeat an already-logged finding), then appends a dated entry with the
//     response to that same register file — mirroring invoke-gemini-agent.mjs's own --register
//     flag. Only product-market has a register configured today
//     (docs/product/product-market-register.md).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DefaultAzureCredential } from '@azure/identity';
import { AIProjectClient } from '@azure/ai-projects';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// role slug -> [env var prefix, register file path relative to this script's dir (or null — no register yet)]
const ROLES = {
  'product-market': [
    'AZURE_AI_FOUNDRY_PRODUCT_MARKET_FIT',
    path.join('..', '..', 'product', 'product-market-register.md'),
  ],
};

const ROLE = argValue('--role');
if (!ROLE || !ROLES[ROLE]) {
  fail(
    `Missing or unknown --role "${ROLE}". Known roles: ${Object.keys(ROLES).join(', ')}. ` +
      'Usage: node invoke-azure-foundry-agent.mjs <path-to-material-file | -> --role product-market [--register]'
  );
}
const [ENV_PREFIX, REGISTER_RELATIVE_PATH] = ROLES[ROLE];
const REGISTER_PATH = REGISTER_RELATIVE_PATH ? path.join(__dirname, REGISTER_RELATIVE_PATH) : null;
const USE_REGISTER = process.argv.includes('--register');
if (USE_REGISTER && !REGISTER_PATH) {
  fail(`--register given but role "${ROLE}" has no register file configured yet.`);
}
if (USE_REGISTER && !fs.existsSync(REGISTER_PATH)) {
  fail(`--register given but ${REGISTER_PATH} does not exist.`);
}

const PROJECT_ENDPOINT = process.env[`${ENV_PREFIX}_PROJECT_ENDPOINT`];
const AGENT_NAME = process.env[`${ENV_PREFIX}_AGENT_NAME`];
const AGENT_VERSION = process.env[`${ENV_PREFIX}_AGENT_VERSION`];
const inputArg = process.argv[2];

if (!inputArg || inputArg.startsWith('--')) {
  fail('Usage: node invoke-azure-foundry-agent.mjs <path-to-material-file | -> --role product-market [--register]');
}
if (!PROJECT_ENDPOINT || !AGENT_NAME || !AGENT_VERSION) {
  fail(
    `Missing ${ENV_PREFIX}_PROJECT_ENDPOINT / ${ENV_PREFIX}_AGENT_NAME / ${ENV_PREFIX}_AGENT_VERSION. ` +
      'Copy docs/ai-roles/.env.example to docs/ai-roles/.env and fill in the real values from ' +
      "the Foundry portal's own \"Code\" sample for this agent (https://ai.azure.com)."
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

async function main() {
  const material = readInput();

  let content = material;
  if (USE_REGISTER) {
    const existingRegister = fs.readFileSync(REGISTER_PATH, 'utf8');
    content =
      `## Existing Register (context only — do not repeat findings already logged here; ` +
      `if the material below shows a previously logged finding is now resolved, say so ` +
      `explicitly, don't just silently omit it)\n\n${existingRegister}\n\n---\n\n` +
      `## Material under review\n\n${material}`;
  }

  const projectClient = new AIProjectClient(PROJECT_ENDPOINT, new DefaultAzureCredential());
  const openAIClient = projectClient.getOpenAIClient();

  const conversation = await openAIClient.conversations.create({
    items: [{ type: 'message', role: 'user', content }],
  });

  const response = await openAIClient.responses.create(
    { conversation: conversation.id },
    { body: { agent_reference: { type: 'agent_reference', name: AGENT_NAME, version: AGENT_VERSION } } }
  );

  console.log(response.output_text);

  if (USE_REGISTER) {
    const materialLabel = inputArg === '-' ? 'stdin (e.g. git diff)' : inputArg;
    const entry = `\n## ${todayIso()} — reviewed ${materialLabel}\n\n${response.output_text}\n\n---\n`;
    fs.appendFileSync(REGISTER_PATH, entry, 'utf8');
    console.error(`\n[appended to ${REGISTER_PATH}]`);
  }
}

main().catch((err) => fail(String(err && err.stack ? err.stack : err)));
