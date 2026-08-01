#!/usr/bin/env node

// Invokes the Security & Architecture Reviewer via the Gemini API (@google/genai SDK), using
// the classic `models.generateContent` method rather than the newer `interactions.create()`
// Agents/Interactions surface — that surface returned a "prepayment credits are depleted"
// billing error on one real API key and an opaque 400 on a second, different-billing-structure
// key, while generateContent is the long-established, more universally available endpoint.
// No persistent hosted agent object exists here (unlike Mistral's Agent Builder) — this script
// reads the charter's "Prompt block" fresh from the .md file on every run and passes it as
// systemInstruction, so the script and the checked-in charter can never drift apart.
//
// Requires: `npm install` run once in docs/ai-roles/ (installs @google/genai — see
// docs/ai-roles/package.json). Setup: copy docs/ai-roles/.env.example to docs/ai-roles/.env
// and fill in GEMINI_API_KEY. .env is gitignored — never commit it.
//
// Usage:
//   node docs/ai-roles/scripts/invoke-gemini-agent.mjs <path-to-material-file>
//   git diff | node docs/ai-roles/scripts/invoke-gemini-agent.mjs -
//   node docs/ai-roles/scripts/invoke-gemini-agent.mjs some.md --model gemini-3-flash
//   node docs/ai-roles/scripts/invoke-gemini-agent.mjs some.md --search   (adds the google_search tool — separate quota, see docs/ai-roles/README.md)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARTER_PATH = path.join(__dirname, '..', 'security-architecture-reviewer.md');
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

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = argValue('--model') || process.env.GEMINI_SECURITY_REVIEWER_MODEL || 'gemini-3.5-flash';
const USE_SEARCH = process.argv.includes('--search');
const inputArg = process.argv[2];

if (!inputArg || inputArg.startsWith('--')) {
  fail('Usage: node invoke-gemini-agent.mjs <path-to-material-file | -> [--model gemini-3-flash] [--search]');
}
if (!API_KEY) {
  fail('Missing GEMINI_API_KEY. Copy docs/ai-roles/.env.example to docs/ai-roles/.env and fill in your key.');
}

// Extract the charter's "Prompt block" section directly from the markdown file — same
// extraction convention as invoke-ollama-agent.cjs.
function extractPromptBlock() {
  const text = fs.readFileSync(CHARTER_PATH, 'utf8');
  const startMarker = '## Prompt block';
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) {
    fail(`Could not find "${startMarker}" in ${CHARTER_PATH} — has the charter's structure changed?`);
  }
  const afterHeading = text.indexOf('\n', startIdx) + 1;
  const nextHeadingIdx = text.indexOf('\n## ', afterHeading);
  const block = (nextHeadingIdx === -1 ? text.slice(afterHeading) : text.slice(afterHeading, nextHeadingIdx)).trim();
  if (!block) {
    fail(`"${startMarker}" section in ${CHARTER_PATH} is empty.`);
  }
  return block;
}

function readInput() {
  if (inputArg === '-') {
    return fs.readFileSync(0, 'utf8'); // stdin, e.g. `git diff | node ... -`
  }
  return fs.readFileSync(inputArg, 'utf8');
}

async function main() {
  const systemInstruction = extractPromptBlock();
  const material = readInput();
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: material,
    config: {
      systemInstruction,
      ...(USE_SEARCH ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });

  console.log(response.text ?? JSON.stringify(response, null, 2));
}

main().catch((err) => fail(String(err && err.stack ? err.stack : err)));
