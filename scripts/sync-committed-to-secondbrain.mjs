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

// 2. Run export-to-obsidian to update 4-way traceability (ADR ↔ BRD ↔ FDD ↔ Story)
try {
  const exportScript = path.resolve(repoRoot, 'scripts', 'export-to-obsidian.mjs');
  if (fs.existsSync(exportScript)) {
    console.log(`   🔗 Updating 4-way traceability links...`);
    execSync(`node "${exportScript}" "${vaultRoot}"`, { cwd: repoRoot, stdio: 'inherit' });
  }
} catch (err) {
  console.warn(`[SecondBrainSync] export-to-obsidian warning: ${err.message}`);
}

// 3. Run compile-obsidian-telemetry to update project progress dashboard
try {
  const telemetryScript = path.resolve(repoRoot, 'project-progress-dashboard', 'scripts', 'compile-obsidian-telemetry.mjs');
  if (fs.existsSync(telemetryScript)) {
    console.log(`   📊 Updating project progress telemetry dashboard...`);
    execSync(`node "${telemetryScript}" "${vaultRoot}"`, { cwd: repoRoot, stdio: 'inherit' });
  }
} catch (err) {
  console.warn(`[SecondBrainSync] compile-obsidian-telemetry warning: ${err.message}`);
}

// 4. Run backfill-obsidian-frontmatter to stamp git commit hash & timestamp
try {
  const backfillScript = path.resolve(repoRoot, 'scripts', 'backfill-obsidian-frontmatter.mjs');
  if (fs.existsSync(backfillScript)) {
    console.log(`   🏷️  Stamping commit provenance (${hash.slice(0, 7)}) onto Second Brain notes...`);
    execSync(`node "${backfillScript}" "${vaultRoot}"`, { cwd: repoRoot, stdio: 'ignore' });
  }
} catch (err) {
  console.warn(`[SecondBrainSync] backfill-obsidian-frontmatter warning: ${err.message}`);
}

console.log(`✅ [SecondBrainSync] Second Brain synchronized successfully with commit ${hash.slice(0, 7)}!\n`);
