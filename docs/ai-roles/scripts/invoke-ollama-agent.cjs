#!/usr/bin/env node
'use strict';

// Invokes the Data Privacy & Sovereignty Reviewer via Ollama's LOCAL REST API
// (docs/ai-roles/data-privacy-sovereignty-reviewer.md). No hosted "agent" object exists on
// Ollama's side the way Mistral's Agent Builder provides one — this script reads the
// charter's "Prompt block" directly from that markdown file on every run and sends it as
// a system message, so the two can never silently drift out of sync the way a
// separately-configured hosted agent could.
//
// HARD RULE, not a preference: never point this script at a `:cloud`-suffixed model
// (e.g. `minimax-m3:cloud`, `qwen3.5:cloud`, `glm-5:cloud` — check `ollama list`: a
// `:cloud` model shows no local SIZE because Ollama proxies it to a hosted backend).
// Doing so would silently send material to a third party, defeating the entire reason
// this role is chartered to run locally in the first place (see that charter's own
// "Why this role runs locally, specifically"). This script refuses to run against a
// model name containing ":cloud" — see the check below.
//
// Requires: Ollama installed and running locally (`ollama serve`, usually automatic),
// and the target model pulled (`ollama pull llama3.1:8b` or similar). No API key, no .env.
//
// Usage:
//   node docs/ai-roles/scripts/invoke-ollama-agent.cjs <path-to-material-file>
//   git diff | node docs/ai-roles/scripts/invoke-ollama-agent.cjs -
//   node docs/ai-roles/scripts/invoke-ollama-agent.cjs some.md --model qwen3:8b

const fs = require('fs');
const path = require('path');

const CHARTER_PATH = path.join(__dirname, '..', 'data-privacy-sovereignty-reviewer.md');
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
// Menno's preferred model, and — as of 2026-07-31 — the only one confirmed to actually load
// in this environment: qwen2.5:3b (~1.3GB buffer) and llama3.1:8b (~3.4GB buffer) both failed
// with CPU_REPACK allocation errors, suggesting tight available memory generally right now,
// not a model-size-specific problem. Override with --model once more headroom is available.
const DEFAULT_MODEL = 'qwen2.5:0.5b';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const MODEL = argValue('--model') || process.env.OLLAMA_PRIVACY_REVIEWER_MODEL || DEFAULT_MODEL;
const inputArg = process.argv[2];

if (!inputArg || inputArg.startsWith('--')) {
  fail('Usage: node invoke-ollama-agent.cjs <path-to-material-file | -> [--model name]');
}
if (MODEL.includes(':cloud')) {
  fail(
    `Refusing to run: "${MODEL}" is a :cloud model (proxied to a hosted backend by Ollama, ` +
      'not run on this machine). The Data Privacy & Sovereignty Reviewer must stay on a genuinely ' +
      'local model. Run `ollama list` and pick one that shows a real SIZE, e.g. llama3.1:8b.'
  );
}

// Extract the charter's "Prompt block" section directly from the markdown file, so this
// script and the checked-in charter can never quietly diverge.
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
  const systemPrompt = extractPromptBlock();
  const material = readInput();

  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: material },
      ],
    }),
  });

  if (!res.ok) {
    fail(
      `Ollama API error ${res.status}: ${await res.text()}\n` +
        `(Is Ollama running? Is "${MODEL}" pulled — try: ollama pull ${MODEL})`
    );
  }

  const data = await res.json();
  console.log(data.message ? data.message.content : JSON.stringify(data, null, 2));
}

main().catch((err) => fail(String(err && err.stack ? err.stack : err)));
