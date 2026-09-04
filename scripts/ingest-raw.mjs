import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const vaultRoot = process.argv[2] || 'C:\\Users\\MennoDrescher\\source\\repos\\Obsidian Brain';
const rawRoot = path.join(vaultRoot, 'raw');
const destRoot = path.join(vaultRoot, 'wiki', 'Projects', 'SocialEngage', '06 Synthesis & Lessons Learned');

console.log('?? AI Agent Raw Ingestion Pipeline');

if (!fs.existsSync(rawRoot)) {
  fs.mkdirSync(rawRoot, { recursive: true });
}
if (!fs.existsSync(destRoot)) {
  fs.mkdirSync(destRoot, { recursive: true });
}

// Looks for .md, .txt, .markdown files in raw/, processes them into structured 'lesson_learned' nodes.
const files = fs.readdirSync(rawRoot).filter(f => /\.(md|txt|markdown)$/i.test(f));

if (files.length === 0) {
  console.log('  ℹ️ No raw files to ingest.');
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

