import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const vaultRoot = process.argv[2] || 'C:\\Users\\MennoDrescher\\source\\repos\\obsidian brain';
const rawRoot = path.join(vaultRoot, 'raw');
const destRoot = path.join(vaultRoot, 'wiki', 'Projects', 'SocialEngage', '06 Synthesis & Lessons Learned');

console.log('🤖 AI Agent Raw Ingestion Pipeline');

if (!fs.existsSync(rawRoot)) {
  fs.mkdirSync(rawRoot, { recursive: true });
}
if (!fs.existsSync(destRoot)) {
  fs.mkdirSync(destRoot, { recursive: true });
}

// 1. Process telemetry capture directories in raw/ (e.g. synthesis-epic-3-2026-09-01)
const rawEntries = fs.readdirSync(rawRoot, { withFileTypes: true });
const synthesisDirs = rawEntries
  .filter(e => e.isDirectory() && e.name.startsWith('synthesis-epic-'))
  .map(e => e.name);

if (synthesisDirs.length > 0) {
  console.log(`\n🔍 Found ${synthesisDirs.length} raw synthesis telemetry capture directory(ies) in raw/`);
  
  // Group unique epics
  const epicsToCompile = new Set();
  for (const dir of synthesisDirs) {
    const match = dir.match(/synthesis-epic-(\d+)-/);
    if (match) {
      epicsToCompile.add(match[1]);
    }
  }

  for (const epic of epicsToCompile) {
    console.log(`  ⚙️ Compiling telemetry for Epic ${epic}...`);
    try {
      execSync(`node "${path.join(__dirname, 'synthesize-telemetry.mjs')}" --compile --epic ${epic} --vault "${vaultRoot}"`, {
        stdio: 'inherit',
        cwd: repoRoot
      });
    } catch (err) {
      console.error(`  ❌ Failed to compile telemetry for Epic ${epic}:`, err.message);
    }
  }

  // Clean processed capture directories
  for (const dir of synthesisDirs) {
    const fullPath = path.join(rawRoot, dir);
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`  🗑️ Ingested & cleaned raw capture directory: ${dir}`);
  }
}

// 2. Process standalone files in raw/ (.md, .txt, .markdown)
const files = fs.readdirSync(rawRoot).filter(f => {
  const p = path.join(rawRoot, f);
  return fs.statSync(p).isFile() && /\.(md|txt|markdown)$/i.test(f);
});

if (files.length === 0 && synthesisDirs.length === 0) {
  console.log('  ℹ️ No raw files or directories to ingest.');
  process.exit(0);
}

let ingestedCount = 0;

for (const file of files) {
  const rawPath = path.join(rawRoot, file);
  let content = fs.readFileSync(rawPath, 'utf8');
  
  // Intelligent title & metadata extraction
  let title = file.replace(/\.(md|txt|markdown)$/i, '');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else if (/contract test|credential|adr|secret/i.test(content)) {
    title = 'Root Cause Analysis: Contract Test Secret Verification & Anti-Patterns';
  } else {
    title = title.split(/[_\-\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Format headings if plain numbered sections (e.g. "1. Root Cause Analysis" -> "## 1. Root Cause Analysis")
  content = content.replace(/^([0-9]+\.\s+[A-Za-z].+)$/gm, '## $1');

  // Next available or random ID
  const artifactId = `Lesson-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  let traceabilityHeader = '';
  if (/ADR-0141|credential|secret leakage/i.test(content)) {
    traceabilityHeader = `
## Context & Traceability
- **Governing Architecture Decision:** [[ADR-0141]]
- **Empirical Adaptation:** [[ADAPT-0141]]
- **Institutional Capability:** [[CAP-0141]]
- **Target Suite:** [[Story 6.9]] (\`tenant-settings-screen.contract.test.ts\`)

---
`;
  }

  const compiledContent = `---
title: "${title}"
artifact_id: "${artifactId}"
type: "lesson_learned"
status: "Active"
pm_class: "GovernanceArtifact"
pm_subclass: "KnowledgeAsset"
pm_relationships:
  - crystallizesLesson
  - triggersGovernanceChange
domain_cluster: "Strategic Intent & Cognitive Learning"
dmbok_category: "Data Quality Management"
pmbok_category: "Quality Management"
babok_category: "Solution Evaluation"
tags:
  - lesson_learned
  - insight
  - root_cause_analysis
  - contract_testing
  - project/socialengage
created_at: "${now}"
modified_at: "${now}"
---

# ${title}

> Ingested from raw input \`${file}\` via AI Raw Ingestion Pipeline on ${now}.
${traceabilityHeader}
${content}
`;

  const destPath = path.join(destRoot, `${artifactId}.md`);
  fs.writeFileSync(destPath, compiledContent, 'utf8');
  
  // Remove the raw file after successful ingest
  fs.unlinkSync(rawPath);
  console.log(`  ✅ Ingested ${file} -> ${artifactId}.md (${title})`);
  ingestedCount++;
}

console.log(`\n🎉 Successfully ingested ${ingestedCount} raw artifact(s) into the Knowledge Graph.`);
process.exit(0);

