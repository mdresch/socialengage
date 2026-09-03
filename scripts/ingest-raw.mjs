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

// Simple mock logic for AI ingestion:
// Looks for .md files in raw/, processes them into structured 'lesson_learned' nodes.
const files = fs.readdirSync(rawRoot).filter(f => f.endsWith('.md'));

if (files.length === 0) {
  console.log('  ?? No raw files to ingest.');
  process.exit(0);
}

let ingestedCount = 0;

for (const file of files) {
  const rawPath = path.join(rawRoot, file);
  const content = fs.readFileSync(rawPath, 'utf8');
  
  // Fake AI Processing: Extract title, generate artifact ID.
  const titleMatch = content.match(/^#\s+(.+)$/m) || [null, file.replace('.md', '')];
  const title = titleMatch[1].trim();
  const artifactId = `Lesson-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  const now = new Date().toISOString();

  const compiledContent = `---
title: "${title}"
artifact_id: "${artifactId}"
type: "lesson_learned"
status: "Active"
tags:
  - lesson_learned
  - insight
pm_class: "GovernanceArtifact"
pm_subclass: "KnowledgeAsset"
created_at: "${now}"
modified_at: "${now}"
---

${content}
`;

  const destPath = path.join(destRoot, `${artifactId}.md`);
  fs.writeFileSync(destPath, compiledContent, 'utf8');
  
  // Remove the raw file after successful ingest
  fs.unlinkSync(rawPath);
  console.log(`  ?? Ingested ${file} -> ${artifactId}.md`);
  ingestedCount++;
}

console.log(`\n?? Successfully ingested ${ingestedCount} raw artifacts into the Knowledge Graph.`);
process.exit(0);

