#!/usr/bin/env node

/**
 * Open Questions Sync & Governance Engine
 *
 * Enforces the ADR Open Questions standard (docs/adr/README.md):
 * 1. Scans all docs/adr/*.md files directly as the Single Source of Truth.
 * 2. Parses Open Questions, IDs ([Q-XXXX-N]), checkbox states, and resolutions.
 * 3. Validates that resolutions cite an anchored Story/contract, ADR, or Sponsor decision.
 * 4. Syncs the live questions into data.ts (OPEN_QUESTIONS_LIST) and Project Progress Dashboard.
 *
 * Modes:
 *   node scripts/sync-open-questions.mjs --audit      (Audit conformity without writing)
 *   node scripts/sync-open-questions.mjs --sync       (Sync ADRs -> data.ts)
 *   node scripts/sync-open-questions.mjs --normalize  (Normalize markdown formatting in docs/adr/)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const adrDir = path.join(repoRoot, 'docs', 'adr');
const dataPath = path.join(repoRoot, 'project-progress-dashboard', 'src', 'lib', 'project-dashboard', 'data.ts');

const args = process.argv.slice(2);
const mode = args.includes('--sync') ? 'sync' : (args.includes('--normalize') ? 'normalize' : 'audit');

console.log(`🔮 SocialEngage Open Questions Sync & Governance (${mode.toUpperCase()} mode)`);

const adrFiles = fs.readdirSync(adrDir)
  .filter(f => f.endsWith('.md') && f !== 'README.md')
  .sort();

const parsedQuestions = [];
const nonConforming = [];
const unanchored = [];

for (const f of adrFiles) {
  const fullPath = path.join(adrDir, f);
  const content = fs.readFileSync(fullPath, 'utf8');

  // Match ADR ID from filename
  const idMatch = f.match(/^(\d{4})/);
  if (!idMatch) continue;
  const adrId = idMatch[1];

  // Match ADR title from first line
  const titleMatch = content.match(/^#\s*ADR-\d+:\s*(.*)/m) || content.match(/^#\s*(.*)/m);
  const adrTitle = titleMatch ? titleMatch[1].trim() : f;

  // Find Open Questions section
  const sectionMatch = content.match(/##\s*Open Questions?[^\n]*\n([\s\S]*?)(?=\n##\s+|$)/i);
  if (!sectionMatch) continue;

  const sectionContent = sectionMatch[1];
  const lines = sectionContent.split('\n');

  let currentQuestion = null;
  let qIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('<!--') || rawLine.endsWith('-->') || rawLine.startsWith('|')) {
      continue;
    }

    // Match list item start: "- ", "* ", "1. ", or "- [ ] "
    const itemMatch = rawLine.match(/^([-*]|\d+\.)\s+(\[([ x\-])\]\s+)?(.*)/);
    if (itemMatch) {
      if (currentQuestion) {
        parsedQuestions.push(currentQuestion);
      }
      qIndex++;
      const checkState = itemMatch[3]; // ' ', 'x', '-', or undefined
      let rest = itemMatch[4].trim();

      // Check for canonical ID [Q-XXXX-N]
      const idTagMatch = rest.match(/^(?:~~|\*\*)*\[(Q-\d{4}-\d+)\](?:~~|\*\*)*\s*(.*)/);
      let canonicalId = `Q-${adrId}-${qIndex}`;
      if (idTagMatch) {
        canonicalId = idTagMatch[1];
        rest = idTagMatch[2].trim();
      } else {
        nonConforming.push({ file: f, line: rawLine, issue: `Missing canonical ID [Q-${adrId}-${qIndex}]` });
      }

      // Determine status & resolution
      let status = 'OPEN';
      let resolutionNote = '';

      const isResolved = checkState === 'x' || /~~.*~~.*(resolved|decided)/i.test(rest) || /—\s*\*\*resolved/i.test(rest);
      const isSuperseded = checkState === '-' || /~~.*~~.*superseded/i.test(rest) || /—\s*\*\*superseded/i.test(rest);

      if (isResolved || isSuperseded) {
        status = isSuperseded ? 'SUPERSEDED' : 'RESOLVED';
        const boldMatch = rest.match(/\*\*(Resolved[^*]*|Superseded[^*]*)\*\*[:\s—]*(.*)/i);
        const dashMatch = rest.match(/—\s*(.*)/);
        const afterStrike = rest.match(/~~[\s\S]*?~~(?:\s*\*\*)?[\s—:]*(.*)/);

        if (boldMatch) {
          resolutionNote = `${boldMatch[1]}: ${boldMatch[2]}`.trim();
        } else if (dashMatch && dashMatch[1].trim()) {
          resolutionNote = dashMatch[1].trim();
        } else if (afterStrike && afterStrike[1].trim()) {
          resolutionNote = afterStrike[1].trim();
        } else {
          resolutionNote = status === 'RESOLVED' ? 'Resolved' : 'Superseded';
        }

        // Check anchored criteria
        const checkTarget = (resolutionNote && resolutionNote !== 'Resolved' && resolutionNote !== 'Superseded')
          ? resolutionNote
          : rest;
        const isAnchored = /Story\s+(?:#\d+|\d+\.\d+|[A-Z0-9-]+)|contracts?\/|ADR-\d{4}|Menno|Sponsor|Acceptance|Decision\s*§\d+|\d{4}-\d{2}-\d{2}/i.test(checkTarget);
        if (!isAnchored) {
          unanchored.push({ id: canonicalId, file: f, note: checkTarget });
        }
      }

      currentQuestion = {
        id: canonicalId,
        adrId,
        adrTitle,
        adrFile: f,
        cluster: 'Platform Architecture',
        question: rest,
        status,
        resolutionNote: resolutionNote.slice(0, 300),
        category: 'Architecture & Governance'
      };
    } else if (currentQuestion && rawLine) {
      // Continuation line
      currentQuestion.question += ' ' + rawLine;
    }
  }

  if (currentQuestion) {
    parsedQuestions.push(currentQuestion);
  }
}

console.log(`\n📊 Parsed ${parsedQuestions.length} Open Questions across ${adrFiles.length} ADRs.`);
const counts = {
  OPEN: parsedQuestions.filter(q => q.status === 'OPEN').length,
  RESOLVED: parsedQuestions.filter(q => q.status === 'RESOLVED').length,
  SUPERSEDED: parsedQuestions.filter(q => q.status === 'SUPERSEDED').length,
};
console.log(`   • OPEN:       ${counts.OPEN}`);
console.log(`   • RESOLVED:   ${counts.RESOLVED}`);
console.log(`   • SUPERSEDED: ${counts.SUPERSEDED}`);

if (nonConforming.length > 0) {
  console.log(`\n⚠️ ${nonConforming.length} non-conforming lines found without canonical [Q-XXXX-N] IDs.`);
  if (mode === 'audit') {
    console.log('   Sample:', nonConforming.slice(0, 5).map(n => `\n     [${n.file}] ${n.issue}`));
  }
}

if (unanchored.length > 0) {
  console.log(`\n⚠️ ${unanchored.length} resolved/superseded questions lack a verified anchor (Story, ADR, or Sponsor decision).`);
  if (mode === 'audit') {
    console.log('   Sample:', unanchored.slice(0, 3).map(u => `\n     [${u.id} in ${u.file}] ${u.note}`));
  }
}

// Perform --sync if requested
if (mode === 'sync' && fs.existsSync(dataPath)) {
  console.log(`\n🔄 Syncing ${parsedQuestions.length} questions into data.ts...`);
  let dataContent = fs.readFileSync(dataPath, 'utf8');
  const listMatch = dataContent.match(/export const OPEN_QUESTIONS_LIST[^\=]*\=\s*\[[\s\S]*?\n\];/);
  if (listMatch) {
    const formatted = 'export const OPEN_QUESTIONS_LIST: OpenQuestion[] = ' + JSON.stringify(parsedQuestions, null, 2) + ';';
    dataContent = dataContent.replace(listMatch[0], formatted);
    fs.writeFileSync(dataPath, dataContent, 'utf8');
    console.log('✅ Synchronized OPEN_QUESTIONS_LIST in data.ts.');
  } else {
    console.error('❌ Could not locate OPEN_QUESTIONS_LIST in data.ts');
    process.exit(1);
  }
}

// Perform --normalize if requested
if (mode === 'normalize') {
  console.log(`\n🛠️ Normalizing markdown formatting in docs/adr/...`);
  let normalizedCount = 0;
  for (const f of adrFiles) {
    const fullPath = path.join(adrDir, f);
    let content = fs.readFileSync(fullPath, 'utf8');
    const idMatch = f.match(/^(\d{4})/);
    if (!idMatch) continue;
    const adrId = idMatch[1];

    const sectionRegex = /##\s*Open Questions?[^\n]*\n([\s\S]*?)(?=\n##\s+|$)/i;
    const match = content.match(sectionRegex);
    if (!match) continue;

    const oldSection = match[1];
    const lines = oldSection.split('\n');
    let qIndex = 0;
    const newLines = [];
    let changed = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const itemMatch = trimmed.match(/^([-*]|\d+\.)\s+(\[([ x\-])\]\s+)?(.*)/);
      if (itemMatch && !trimmed.startsWith('<!--') && !trimmed.startsWith('|')) {
        qIndex++;
        const check = itemMatch[3] || ' ';
        let rest = itemMatch[4];
        const idRegex = /^(\*\*\[(Q-\d{4}-\d+)\]\*\*|\[(Q-\d{4}-\d+)\])\s*/;
        const currentIdMatch = rest.match(idRegex);
        
        let canonicalId = `Q-${adrId}-${qIndex}`;
        if (currentIdMatch) {
          canonicalId = currentIdMatch[2] || currentIdMatch[3];
          rest = rest.replace(idRegex, '');
        }

        const isResolved = check === 'x' || /~~.*~~.*(resolved|decided)/i.test(rest) || /—\s*\*\*resolved/i.test(rest);
        const isSuperseded = check === '-' || /~~.*~~.*superseded/i.test(rest) || /—\s*\*\*superseded/i.test(rest);
        const marker = isResolved ? '[x]' : (isSuperseded ? '[-]' : '[ ]');

        const normalizedLine = `- ${marker} **[${canonicalId}]** ${rest}`;
        newLines.push(normalizedLine);
        if (normalizedLine !== line) changed = true;
      } else {
        newLines.push(line);
      }
    }

    if (changed) {
      const newHeader = '## Open Questions\n';
      const replacement = newHeader + newLines.join('\n');
      content = content.replace(match[0], replacement);
      fs.writeFileSync(fullPath, content, 'utf8');
      normalizedCount++;
    }
  }
  console.log(`✅ Normalized Open Questions syntax in ${normalizedCount} ADR files.`);
}

console.log('\n🏁 Open Questions Governance run complete.');
