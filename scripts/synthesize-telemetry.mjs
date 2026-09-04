#!/usr/bin/env node

/**
 * Telemetry Synthesis Engine (ADR-0122 / FDD-0122)
 *
 * Full pipeline with two modes:
 *
 *   --capture --epic <N> [--with-tests] [--vault <path>]
 *     Dumps raw telemetry from the git repo into the Second Brain vault's
 *     raw/ folder: git logs, filtered healing/fix commits, implementation-log
 *     excerpts, contract test file inventory, and (optionally) Jest JSON output.
 *     Produces a manifest.json describing the capture.
 *
 *   --compile --epic <N> [--vault <path>]
 *     Reads the latest capture from raw/, parses it, and generates:
 *       - docs/synthesis/Self-Learning-Synthesis-Epic-N.md (repo)
 *       - Sprint - Social Engage - Epic N/Outputs/Self-Learning-Synthesis-Epic-N.md (vault)
 *     Also prints actionable recommendations for environment-gotchas.md,
 *     ADR in-place annotations, and Lessons-Learned-Register.md updates.
 *
 *   (no args)  — legacy verification mode (original behavior)
 *
 * Default vault path: c:\Users\menno\Documents\Second Brain
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DEFAULT_VAULT = 'C:\\Users\\MennoDrescher\\source\\repos\\obsidian brain';

// ─── CLI parsing ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { mode: 'verify', epic: null, withTests: false, vault: DEFAULT_VAULT };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--capture') args.mode = 'capture';
    else if (a === '--compile') args.mode = 'compile';
    else if (a === '--epic') args.epic = argv[++i];
    else if (a === '--with-tests') args.withTests = true;
    else if (a === '--vault') args.vault = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  node synthesize-telemetry.mjs --capture --epic <N> [--with-tests] [--vault <path>]
  node synthesize-telemetry.mjs --compile --epic <N> [--vault <path>]
  node synthesize-telemetry.mjs                          (legacy verification)`);
      process.exit(0);
    }
  }
  return args;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function git(args, cwd = rootDir) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function write(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

// ─── CAPTURE MODE ──────────────────────────────────────────────────────────

function capture(args) {
  if (!args.epic) {
    console.error('❌ --capture requires --epic <N>');
    process.exit(1);
  }

  const epic = args.epic;
  const date = today();
  const captureDir = path.join(args.vault, 'raw', `synthesis-epic-${epic}-${date}`);
  const repoDir = path.join(captureDir, 'repo-telemetry');

  console.log(`\n🔍 [Capture] Epic ${epic} — ${date}`);
  console.log(`   Raw output: ${captureDir}\n`);

  // 1. Git log with stats (last 50 commits)
  console.log('   📊 Capturing git log...');
  const gitLogFull = git('log -n 50 --stat --format="%H|%an|%ai|%s"');
  write(path.join(repoDir, 'git-log.txt'), gitLogFull);

  // 2. Filtered healing/fix commits with full messages
  console.log('   🩹 Extracting healing & fix commits...');
  const healLog = git('log -n 100 --format="%H%n%s%n%b%n---" --grep="heal(" --grep="fix(" --all-match');
  write(path.join(repoDir, 'healing-commits.txt'), healLog || '(none found)');

  // 3. Feature commits for this epic
  console.log('   ✨ Extracting feature commits...');
  const featLog = git(`log -n 100 --format="%H|%ai|%s" --grep="Story ${epic}." --grep="feat(" --all-match`);
  write(path.join(repoDir, 'feature-commits.txt'), featLog || '(none found)');

  // 4. Implementation log excerpt (last 200 lines — covers recent stories)
  console.log('   📝 Extracting implementation log excerpt...');
  const implLogPath = path.join(rootDir, 'docs', 'implementation-log.md');
  if (fs.existsSync(implLogPath)) {
    const implLog = fs.readFileSync(implLogPath, 'utf8');
    const lines = implLog.split('\n');
    const excerpt = lines.slice(Math.max(0, lines.length - 200)).join('\n');
    write(path.join(repoDir, 'impl-log-excerpt.md'), excerpt);
  }

  // 5. Contract test file inventory
  console.log('   📋 Inventorying contract test files...');
  const testDirs = [
    path.join(rootDir, 'social-listening-admin', 'contracts'),
    path.join(rootDir, 'social-listening-core', 'contracts'),
  ];
  const testFiles = [];
  for (const dir of testDirs) {
    if (fs.existsSync(dir)) {
      walkDir(dir, (f) => {
        if (f.endsWith('.contract.test.ts')) {
          const rel = path.relative(rootDir, f);
          const stat = fs.statSync(f);
          testFiles.push({ file: rel, mtime: stat.mtime.toISOString(), size: stat.size });
        }
      });
    }
  }
  write(path.join(repoDir, 'contract-tests.json'), JSON.stringify(testFiles, null, 2));

  // 6. Environment gotchas snapshot
  console.log('   ⚠️  Snapshotting environment-gotchas.md...');
  const gotchasPath = path.join(rootDir, 'docs', 'environment-gotchas.md');
  if (fs.existsSync(gotchasPath)) {
    write(path.join(repoDir, 'environment-gotchas.md'), fs.readFileSync(gotchasPath, 'utf8'));
  }

  // 7. ADR inventory (which ADRs have Implementation Learnings sections)
  console.log('   📐 Scanning ADRs for existing Implementation Learnings sections...');
  const adrDir = path.join(rootDir, 'docs', 'adr');
  const adrStatus = [];
  if (fs.existsSync(adrDir)) {
    walkDir(adrDir, (f) => {
      if (f.endsWith('.md') && !f.endsWith('README.md')) {
        const content = fs.readFileSync(f, 'utf8');
        const hasLearnings = content.includes('## Implementation Learnings & Real-World Constraints');
        const name = path.basename(f, '.md');
        adrStatus.push({ adr: name, hasLearnings });
      }
    });
  }
  write(path.join(repoDir, 'adr-inventory.json'), JSON.stringify(adrStatus, null, 2));

  // 8. Optional: Jest JSON output
  if (args.withTests) {
    console.log('   🧪 Running Jest for JSON output (this may take a while)...');
    for (const repo of ['social-listening-admin', 'social-listening-core']) {
      const repoPath = path.join(rootDir, repo);
      if (fs.existsSync(repoPath)) {
        try {
          const jestOut = execSync(
            `npx jest --json --no-coverage --silent --testPathIgnorePatterns "story-6.1.nextjs" 2>&1`,
            { cwd: repoPath, encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
          );
          // Jest --json outputs a single JSON object (possibly with leading non-JSON lines)
          const jsonStart = jestOut.indexOf('{');
          if (jsonStart >= 0) {
            const jsonStr = jestEnd(jestOut, jsonStart);
            write(path.join(repoDir, `jest-${repo}.json`), jsonStr);
            console.log(`      ✅ ${repo}: Jest output captured`);
          }
        } catch (err) {
          console.log(`      ⚠️  ${repo}: Jest capture failed or timed out — skipping`);
        }
      }
    }
  }

  // 9. Manifest
  const manifest = {
    epic,
    date,
    capturedAt: new Date().toISOString(),
    repoRoot: rootDir,
    vaultPath: args.vault,
    captureDir,
    withTests: args.withTests,
    gitHead: git('rev-parse HEAD'),
    gitBranch: git('rev-parse --abbrev-ref HEAD'),
    files: [],
  };
  walkDir(captureDir, (f) => {
    manifest.files.push(path.relative(captureDir, f));
  });
  write(path.join(captureDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n✅ Capture complete: ${manifest.files.length} files in ${captureDir}`);
  console.log(`   Git HEAD: ${manifest.gitHead}`);
  console.log(`   Branch:   ${manifest.gitBranch}\n`);
}

// Extract a balanced JSON object from a string starting at a given index
function jestEnd(str, start) {
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth === 0) return str.slice(start, i + 1); }
  }
  return str.slice(start); // fallback
}

// ─── COMPILE MODE ──────────────────────────────────────────────────────────

function compile(args) {
  if (!args.epic) {
    console.error('❌ --compile requires --epic <N>');
    process.exit(1);
  }

  const epic = args.epic;
  const rawBase = path.join(args.vault, 'raw');

  // Find the latest capture for this epic
  if (!fs.existsSync(rawBase)) {
    console.error(`❌ No raw/ folder found at ${rawBase}`);
    process.exit(1);
  }
  const captures = fs.readdirSync(rawBase)
    .filter(d => d.startsWith(`synthesis-epic-${epic}-`))
    .sort()
    .reverse();
  if (captures.length === 0) {
    console.error(`❌ No captures found for Epic ${epic} in ${rawBase}`);
    console.error(`   Run --capture --epic ${epic} first.`);
    process.exit(1);
  }

  const captureDir = path.join(rawBase, captures[0]);
  const repoDir = path.join(captureDir, 'repo-telemetry');
  const manifestPath = path.join(captureDir, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ No manifest.json in ${captureDir}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`\n🔧 [Compile] Epic ${epic} — reading capture from ${captures[0]}`);
  console.log(`   Git HEAD: ${manifest.gitHead}`);
  console.log(`   Date:     ${manifest.date}\n`);

  // Parse captured data
  const telemetry = parseCapture(repoDir, manifest);

  // Generate synthesis artifact
  const synthesis = generateSynthesis(epic, manifest, telemetry);

  // Write to repo
  const repoOutDir = path.join(rootDir, 'docs', 'synthesis');
  const repoOutPath = path.join(repoOutDir, `Self-Learning-Synthesis-Epic-${epic}.md`);
  write(repoOutPath, synthesis);
  console.log(`   📄 Repo artifact:    ${repoOutPath}`);

  // Write to vault sprint outputs
  const sprintDir = path.join(args.vault, `Sprint - Social Engage - Epic ${epic}`, 'Outputs');
  const vaultOutPath = path.join(sprintDir, `Self-Learning-Synthesis-Epic-${epic}.md`);
  write(vaultOutPath, synthesis);
  console.log(`   📄 Vault artifact:   ${vaultOutPath}`);

  // Write to wiki 06 Synthesis & Lessons Learned with frontmatter
  const wikiDir = path.join(args.vault, 'wiki', 'Projects', 'SocialEngage', '06 Synthesis & Lessons Learned');
  const wikiOutPath = path.join(wikiDir, `Self-Learning-Synthesis-Epic-${epic}.md`);
  const now = new Date().toISOString();
  const entityId = crypto.createHash('md5').update(`Self-Learning-Synthesis-Epic-${epic}`).digest('hex');
  const wikiContent = `---
title: "Self-Learning-Synthesis-Epic-${epic}"
artifact_id: "Self-Learning-Synthesis-Epic-${epic}"
entity_id: "${entityId}"
version: "1.0.0"
source_document: "docs/synthesis/Self-Learning-Synthesis-Epic-${epic}.md"
created_at: "${manifest.capturedAt || now}"
modified_at: "${now}"
authority_level: 1
confidence_score: 1.0
type: "concept"
status: "Synced"
pm_class: "GovernanceArtifact"
pm_subclass: "KnowledgeMap"
pm_relationships:
  - influences
  - tracedTo
domain_cluster: "Self-Learning, Telemetry & Operations"
dmbok_category: "Data Governance"
pmbok_category: "Integration Management"
babok_category: "Solution Evaluation"
aliases:
  - "Self-Learning-Synthesis-Epic-${epic}"
  - "Self-Learning Synthesis: Epic ${epic}"
tags:
  - concept
  - synthesis
  - telemetry
  - self-learning
  - dmbok/data-governance
  - project/socialengage
---

${synthesis}
`;
  write(wikiOutPath, wikiContent);
  console.log(`   📄 Wiki artifact:    ${wikiOutPath}`);

  // Print actionable recommendations
  printRecommendations(telemetry, epic);

  console.log(`\n✅ Compile complete.\n`);
}

function parseCapture(repoDir, manifest) {
  const data = {
    healingCommits: [],
    featureCommits: [],
    gitLog: [],
    implLog: '',
    contractTests: [],
    gotchas: '',
    adrInventory: [],
    jestResults: {},
  };

  // Git log
  const gl = path.join(repoDir, 'git-log.txt');
  if (fs.existsSync(gl)) {
    data.gitLog = fs.readFileSync(gl, 'utf8')
      .split('\n').filter(Boolean)
      .map(line => {
        const [hash, author, date, ...subjectParts] = line.split('|');
        return { hash, author, date, subject: subjectParts.join('|') };
      });
  }

  // Healing commits
  const hc = path.join(repoDir, 'healing-commits.txt');
  if (fs.existsSync(hc)) {
    const raw = fs.readFileSync(hc, 'utf8');
    data.healingCommits = raw.split('\n---\n')
      .filter(block => block.trim())
      .map(block => {
        const lines = block.trim().split('\n');
        return { hash: lines[0]?.trim(), subject: lines[1]?.trim(), body: lines.slice(2).join('\n').trim() };
      })
      .filter(c => c.hash);
  }

  // Feature commits
  const fc = path.join(repoDir, 'feature-commits.txt');
  if (fs.existsSync(fc)) {
    data.featureCommits = fs.readFileSync(fc, 'utf8')
      .split('\n').filter(Boolean)
      .map(line => {
        const [hash, date, ...subjectParts] = line.split('|');
        return { hash, date, subject: subjectParts.join('|') };
      });
  }

  // Implementation log excerpt
  const il = path.join(repoDir, 'impl-log-excerpt.md');
  if (fs.existsSync(il)) {
    data.implLog = fs.readFileSync(il, 'utf8');
  }

  // Contract tests
  const ct = path.join(repoDir, 'contract-tests.json');
  if (fs.existsSync(ct)) {
    data.contractTests = JSON.parse(fs.readFileSync(ct, 'utf8'));
  }

  // Gotchas
  const g = path.join(repoDir, 'environment-gotchas.md');
  if (fs.existsSync(g)) {
    data.gotchas = fs.readFileSync(g, 'utf8');
  }

  // ADR inventory
  const ai = path.join(repoDir, 'adr-inventory.json');
  if (fs.existsSync(ai)) {
    data.adrInventory = JSON.parse(fs.readFileSync(ai, 'utf8'));
  }

  // Jest results (if captured)
  for (const repo of ['social-listening-admin', 'social-listening-core']) {
    const jp = path.join(repoDir, `jest-${repo}.json`);
    if (fs.existsSync(jp)) {
      try {
        data.jestResults[repo] = JSON.parse(fs.readFileSync(jp, 'utf8'));
      } catch { /* skip malformed */ }
    }
  }

  return data;
}

function generateSynthesis(epic, manifest, t) {
  const epicName = epicNames[epic] || `Epic ${epic}`;
  const lines = [];

  lines.push(`# Self-Learning Synthesis: Epic ${epic} (${epicName})`);
  lines.push('');
  lines.push(`**Compiled Date:** ${manifest.date}`);
  lines.push(`**Source Capture:** \`raw/${path.basename(manifest.captureDir)}/\``);
  lines.push(`**Git HEAD:** \`${manifest.gitHead}\``);
  lines.push(`**Branch:** \`${manifest.gitBranch}\``);
  lines.push(`**Governing Architecture:** ADR-0122 / FDD-0122 / Story 14.5`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. Telemetry Summary
  lines.push('## 1. Telemetry Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Git commits scanned | ${t.gitLog.length} |`);
  lines.push(`| Healing / fix commits | ${t.healingCommits.length} |`);
  lines.push(`| Feature commits (this epic) | ${t.featureCommits.length} |`);
  lines.push(`| Contract test files | ${t.contractTests.length} |`);
  const adrsWithLearnings = t.adrInventory.filter(a => a.hasLearnings).length;
  lines.push(`| ADRs with Implementation Learnings | ${adrsWithLearnings}/${t.adrInventory.length} |`);
  for (const [repo, result] of Object.entries(t.jestResults)) {
    if (result?.numTotalTests) {
      lines.push(`| Jest: ${repo} — suites | ${result.numPassedTestSuites}/${result.numTotalTestSuites} passed |`);
      lines.push(`| Jest: ${repo} — tests | ${result.numPassedTests}/${result.numTotalTests} passed |`);
    }
  }
  lines.push('');

  // 2. Healing & Fix Passes
  if (t.healingCommits.length > 0) {
    lines.push('## 2. Healing & Fix Passes');
    lines.push('');
    lines.push('| Commit | Subject |');
    lines.push('|--------|---------|');
    for (const c of t.healingCommits) {
      lines.push(`| \`${c.hash}\` | ${c.subject} |`);
    }
    lines.push('');
  }

  // 3. Feature Commits
  if (t.featureCommits.length > 0) {
    lines.push('## 3. Feature Commits (This Epic)');
    lines.push('');
    lines.push('| Commit | Date | Subject |');
    lines.push('|--------|------|---------|');
    for (const c of t.featureCommits) {
      lines.push(`| \`${c.hash}\` | ${c.date} | ${c.subject} |`);
    }
    lines.push('');
  }

  // 4. Contract Test Inventory
  if (t.contractTests.length > 0) {
    lines.push('## 4. Contract Test Inventory');
    lines.push('');
    lines.push(`Total: ${t.contractTests.length} contract test files.`);
    lines.push('');
    // Group by directory
    const groups = {};
    for (const f of t.contractTests) {
      const dir = path.dirname(f.file).split(path.sep).slice(0, 2).join('/');
      groups[dir] = groups[dir] || [];
      groups[dir].push(f);
    }
    for (const [dir, files] of Object.entries(groups).sort()) {
      lines.push(`### ${dir} (${files.length} files)`);
      lines.push('');
      for (const f of files) {
        lines.push(`- \`${path.basename(f.file)}\` (modified ${f.mtime.slice(0, 10)})`);
      }
      lines.push('');
    }
  }

  // 5. ADR Annotation Status
  if (t.adrInventory.length > 0) {
    lines.push('## 5. ADR Implementation Learnings Status');
    lines.push('');
    const annotated = t.adrInventory.filter(a => a.hasLearnings);
    const unannotated = t.adrInventory.filter(a => !a.hasLearnings);
    lines.push(`**Annotated (${annotated.length}):**`);
    for (const a of annotated) {
      lines.push(`- ${a.adr}`);
    }
    lines.push('');
    lines.push(`**Not yet annotated (${unannotated.length}):** _Not all ADRs need annotations — only those whose upfront assumptions were refined by implementation._`);
    lines.push('');
  }

  // 6. Environment Gotchas Snapshot
  if (t.gotchas) {
    lines.push('## 6. Environment Gotchas (Snapshot)');
    lines.push('');
    const sections = t.gotchas.split(/^## /m).filter(s => s.trim() && !s.startsWith('#'));
    lines.push(`Current gotchas file has ${sections.length} sections:`);
    lines.push('');
    for (const s of sections) {
      const title = s.split('\n')[0].trim();
      lines.push(`- ${title}`);
    }
    lines.push('');
  }

  // 7. Recommendations
  lines.push('## 7. Synthesis Recommendations');
  lines.push('');
  lines.push('The following are surfaced from the captured telemetry for manual review:');
  lines.push('');

  // Recommend gotcha updates from healing commits
  if (t.healingCommits.length > 0) {
    lines.push('### Environment Gotchas to Verify');
    lines.push('');
    for (const c of t.healingCommits) {
      lines.push(`- **\`${c.hash}\`** — ${c.subject}: verify this is indexed in \`docs/environment-gotchas.md\`. If not, add an entry with root cause and permanent guardrail.`);
    }
    lines.push('');
  }

  // Recommend ADR annotations from feature commits
  const storyRefs = new Set();
  for (const c of t.featureCommits) {
    const match = c.subject?.match(/Story (\d+\.\d+)/);
    if (match) storyRefs.add(match[1]);
  }
  if (storyRefs.size > 0) {
    lines.push('### ADR In-Place Annotations to Verify');
    lines.push('');
    lines.push(`Feature commits reference stories: ${[...storyRefs].join(', ')}.`);
    lines.push('Verify that any ADR whose assumptions were refined by these stories carries a `## Implementation Learnings & Real-World Constraints` section with commit references.');
    lines.push('');
  }

  // Recommend Lessons-Learned patterns
  lines.push('### Lessons-Learned-Register Patterns');
  lines.push('');
  lines.push('Check whether any new cross-cutting architectural patterns emerged from this epic\'s implementation that should be added to the `Reusable Architectural & System Patterns` section.');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('*Generated by `scripts/synthesize-telemetry.mjs --compile` per ADR-0122.*');

  return lines.join('\n');
}

const epicNames = {
  '1': 'Core Backend & Infrastructure',
  '2': 'Connectors & Ingestion',
  '3': 'API & Data Services',
  '4': 'Scheduling & Health',
  '5': 'Identity & Auth',
  '6': 'Tenant Admin UI',
  '7': 'Platform Admin UI',
  '8': 'Analytics Dashboard',
  '9': 'Onboarding & Watchlists',
  '10': 'Analytics, Operations, and Trust',
  '11': 'Topic Evolution & Real-Time Intelligence',
  '12': 'Foundation Depth and AI Refinements',
  '13': 'Sub-Decisions, v2 Features, and Closing Loops',
  '14': 'Continuous Self-Learning Synthesis & Feedback',
};

function printRecommendations(t, epic) {
  console.log('\n   📋 Actionable Recommendations:');
  console.log('   ────────────────────────────────');

  if (t.healingCommits.length > 0) {
    console.log(`\n   ⚠️  Environment Gotchas — verify these healing commits are indexed:`);
    for (const c of t.healingCommits) {
      console.log(`      • ${c.hash} — ${c.subject}`);
    }
  }

  const storyRefs = new Set();
  for (const c of t.featureCommits) {
    const match = c.subject?.match(/Story (\d+\.\d+)/);
    if (match) storyRefs.add(match[1]);
  }
  if (storyRefs.size > 0) {
    console.log(`\n   📐 ADR Annotations — verify stories ${[...storyRefs].join(', ')} have ADR annotations if needed`);
  }

  const unannotated = t.adrInventory.filter(a => !a.hasLearnings);
  if (unannotated.length > 0) {
    console.log(`\n   📝 ${unannotated.length} ADRs without Implementation Learnings (not all need them)`);
  }

  console.log(`\n   💡 Check for new cross-cutting patterns for Lessons-Learned-Register.md`);
}

// ─── LEGACY VERIFY MODE ────────────────────────────────────────────────────

function verify() {
  console.log('\n🔍 [Telemetry Synthesis Engine] Starting scan...');

  try {
    const gitLog = git('log -n 25 --oneline');
    const lines = gitLog.split('\n').filter(Boolean);

    const healingCommits = lines.filter(l => l.includes('heal(') || l.includes('fix('));
    const featCommits = lines.filter(l => l.includes('feat('));

    console.log(`\n📊 Git Telemetry Ingested:`);
    console.log(`   - Total Commits Scanned: ${lines.length}`);
    console.log(`   - Healing / Fix Commits: ${healingCommits.length}`);
    console.log(`   - Feature Commits:       ${featCommits.length}`);

    if (healingCommits.length > 0) {
      console.log('\n🩹 Recent Healing & Fix Passes:');
      healingCommits.forEach(c => console.log(`   • ${c}`));
    }

    const gotchasPath = path.join(rootDir, 'docs', 'environment-gotchas.md');
    const lessonsPath = path.join(rootDir, 'docs', 'project docs', 'Lessons-Learned-Register.md');
    const synthesisDir = path.join(rootDir, 'docs', 'synthesis');

    console.log('\n📋 Self-Learning Artifact Verification:');
    console.log(`   - environment-gotchas.md:      ${fs.existsSync(gotchasPath) ? '✅ Present' : '❌ Missing'}`);
    console.log(`   - Lessons-Learned-Register.md: ${fs.existsSync(lessonsPath) ? '✅ Present' : '❌ Missing'}`);
    console.log(`   - Synthesis artifacts dir:      ${fs.existsSync(synthesisDir) ? '✅ Present' : '❌ Missing'}`);
    if (fs.existsSync(synthesisDir)) {
      const artifacts = fs.readdirSync(synthesisDir).filter(f => f.endsWith('.md'));
      for (const a of artifacts) {
        console.log(`     • ${a}`);
      }
    }

    console.log('\n💡 For full pipeline: use --capture --epic <N> then --compile --epic <N>');
    console.log('   See --help for details.\n');
  } catch (err) {
    console.error('❌ Telemetry synthesis error:', err.message);
    process.exit(1);
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function walkDir(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, fn);
    else fn(full);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv);
switch (args.mode) {
  case 'capture': capture(args); break;
  case 'compile': compile(args); break;
  default: verify(); break;
}
