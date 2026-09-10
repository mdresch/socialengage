import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const vaultRoot = process.argv[2] || process.env.OBSIDIAN_VAULT || 'C:\\Users\\menno\\Documents\\Second Brain';

if (!fs.existsSync(vaultRoot)) {
  console.warn(`[SecondBrainSync] Vault root not found at "${vaultRoot}". Skipping sync.`);
  process.exit(0);
}

console.log(`\n🧠 [SecondBrainSync] Synchronizing committed changes to Second Brain...`);
console.log(`   Repo:  ${repoRoot}`);
console.log(`   Vault: ${vaultRoot}`);

let hash = '';
let subject = '';
let committedFiles = [];

try {
  hash = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  subject = execSync('git log -1 --format=%s', { cwd: repoRoot, encoding: 'utf8' }).trim();
  const rawDiff = execSync('git diff-tree --no-commit-id --name-only -r HEAD', { cwd: repoRoot, encoding: 'utf8' });
  committedFiles = rawDiff.split(/\r?\n/).map(f => f.trim()).filter(Boolean);
  console.log(`   Commit: ${hash.slice(0, 7)} — "${subject}" (${committedFiles.length} files)`);
} catch (err) {
  console.warn(`[SecondBrainSync] Warning: Unable to inspect git HEAD: ${err.message}`);
}

// 1. Mirror committed walkthroughs and implementation plans
const walkthroughsDir = path.join(vaultRoot, 'wiki', 'Projects', 'SocialEngage', '06.5 Implementation Walkthroughs');
const plansDir = path.join(vaultRoot, 'wiki', 'Projects', 'SocialEngage', '04.5 Implementation Plans');

if (!fs.existsSync(walkthroughsDir)) fs.mkdirSync(walkthroughsDir, { recursive: true });
if (!fs.existsSync(plansDir)) fs.mkdirSync(plansDir, { recursive: true });

for (const file of committedFiles) {
  const fullSource = path.resolve(repoRoot, file);
  if (!fs.existsSync(fullSource)) continue;

  if (file.startsWith('docs/walkthroughs/') && file.endsWith('.md')) {
    const dest = path.join(walkthroughsDir, path.basename(file));
    fs.copyFileSync(fullSource, dest);
    console.log(`   📄 Mirrored walkthrough: ${path.basename(file)} -> 06.5 Implementation Walkthroughs`);
  } else if ((file.startsWith('docs/implementation-plans/') || file.includes('Plan-Story-')) && file.endsWith('.md')) {
    const dest = path.join(plansDir, path.basename(file));
    fs.copyFileSync(fullSource, dest);
    console.log(`   📋 Mirrored implementation plan: ${path.basename(file)} -> 04.5 Implementation Plans`);
  }
}

// 2. Run the full heal-obsidian-brain orchestrator: export-to-obsidian (4-way
//    traceability), compile-obsidian-telemetry, backfill-obsidian-frontmatter,
//    THEN enrichAllPages — all in one pass.
//
//    Steps 2-4 used to call export-to-obsidian.mjs, compile-obsidian-telemetry.mjs
//    and backfill-obsidian-frontmatter.mjs directly. export-to-obsidian.mjs fully
//    rewrites each page's frontmatter from the monorepo source, which does not
//    include the ship_/last_commit_/backlink/consequences/alternatives fields —
//    those are only restored by heal-obsidian-brain.mjs's own enrichAllPages()
//    step, which ran *after* this script in a separate pass, or not at all if this
//    script's own steps failed silently. Calling only export+backfill left the
//    vault mid-pipeline after every commit: exported and backfilled, never
//    re-enriched, silently stripping tens of thousands of lines of provenance
//    data until someone ran the full heal script by hand. See the commit that
//    introduced this fix for the incident (a real ~35k-line vault regression
//    that got pushed to origin before being caught).
try {
  const healScript = path.resolve(repoRoot, 'scripts', 'heal-obsidian-brain.mjs');
  if (fs.existsSync(healScript)) {
    console.log(`   🧠 Running full heal-obsidian-brain (export, telemetry, backfill, enrich)...`);
    execSync(`node "${healScript}" "${vaultRoot}"`, { cwd: repoRoot, stdio: 'inherit' });
  }
} catch (err) {
  // heal-obsidian-brain.mjs exits 1 when its own audit still finds outstanding
  // errors (e.g. a genuinely new ontology gap) — non-fatal here since the export/
  // backfill/enrich steps still ran and wrote their output before the audit ran.
  console.warn(`[SecondBrainSync] heal-obsidian-brain warning: ${err.message}`);
}

console.log(`✅ [SecondBrainSync] Second Brain synchronized successfully with commit ${hash.slice(0, 7)}!\n`);
