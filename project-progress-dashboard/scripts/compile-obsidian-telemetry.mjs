import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';

const repoRoot = 'C:\\Users\\MennoDrescher\\source\\repos\\socialengage';
const vaultRoot = 'C:\\Users\\MennoDrescher\\source\\repos\\Obsidian Brain';
const dataPath = path.join(repoRoot, 'project-progress-dashboard', 'src', 'lib', 'project-dashboard', 'data.ts');
const wikiProjectRoot = path.join(vaultRoot, 'wiki', 'Projects', 'SocialEngage');
const mocsRoot = path.join(vaultRoot, 'wiki', '_MOCs');
const outDir = path.join(wikiProjectRoot, '08 Project Telemetry Dashboard');

if (!fs.existsSync(dataPath)) {
  console.error('data.ts not found at', dataPath);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(mocsRoot, { recursive: true });

function extractData(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const vars = {};
  const re = /export\s+const\s+(\w+)\s*:\s*[^=]+=\s*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    let i = m.index + m[0].length;
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) continue;
    const first = text[i];
    if (first !== '[' && first !== '{') continue;
    const endChar = first === '[' ? ']' : '}';
    let depth = 1;
    let j = i + 1;
    let inString = false;
    let escaped = false;
    for (; j < text.length; j++) {
      const c = text[j];
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === first) depth++;
      else if (c === endChar) {
        depth--;
        if (depth === 0) break;
      }
    }
    const json = text.slice(i, j + 1);
    try {
      vars[name] = JSON.parse(json);
    } catch (e1) {
      try {
        vars[name] = eval('(' + json + ')');
      } catch (e2) {
        console.error(`  ⚠️ Could not parse ${name}: ${e2.message}`);
        continue;
      }
    }
    console.log(`  ✅ ${name}: ${Array.isArray(vars[name]) ? vars[name].length + ' items' : 'object'}`);
  }
  return vars;
}

const d = extractData(dataPath);
const syncedAt = new Date().toISOString();

function sanitizeAlias(t) {
  if (!t) return '';
  return t.replace(/[\[\]|]/g, '-').replace(/\n+/g, ' ').trim();
}

function cell(t) {
  if (t === null || t === undefined) return '';
  return String(t).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim();
}

function baseName(file) {
  if (!file) return '';
  return path.basename(file, '.md');
}

function adrLink(adr) {
  return `[[${baseName(adr.file)}|ADR-${adr.id}${adr.title ? ': ' + sanitizeAlias(adr.title) : ''}]]`;
}

function brdLink(brd) {
  return `[[${baseName(brd.file)}|BRD-${brd.id}${brd.title ? ': ' + sanitizeAlias(brd.title) : ''}]]`;
}

function fddLink(fdd) {
  return `[[${baseName(fdd.file)}|FDD-${fdd.id}${fdd.title ? ': ' + sanitizeAlias(fdd.title) : ''}]]`;
}

function epicLink(epic) {
  const title = sanitizeAlias(epic.title).replace(/#/g, '').replace(/\s+/g, ' ').trim();
  return `[[${baseName(epic.file)}|${title}]]`;
}

function cleanStoryId(id) {
  return String(id || '').replace(/\.+$/, '').trim();
}

function storyLink(story) {
  const id = cleanStoryId(story.storyId);
  const title = story.title ? `: ${sanitizeAlias(story.title)}` : '';
  return id ? `[[Story ${id}|Story ${id}${title}]]` : '';
}

function contractStoryLink(storyRef) {
  const id = cleanStoryId(storyRef);
  return id ? `[[Story ${id}|Story ${id}]]` : '';
}

const epicMap = {};
(d.EPICS_SUMMARY || []).forEach(e => {
  epicMap[e.id] = { ...e, base: baseName(e.file) };
});

const adrFileMap = {};
(d.ADR_LIST || []).forEach(adr => {
  adrFileMap[adr.id] = baseName(adr.file);
});

function linkAdrRefs(text) {
  if (!text) return '';
  let s = text.replace(/\[ADR-(\d{4})\]\([^)]+\)/g, (m, id) => `[[${adrFileMap[id] || ''}|ADR-${id}]]`);
  s = s.replace(/(?<!\|)ADR-(\d{4})\b/g, (m, id) => `[[${adrFileMap[id] || ''}|ADR-${id}]]`);
  return s;
}

const ONTOLOGY = JSON.parse(fs.readFileSync(path.join(vaultRoot, 'ONTOLOGY.json'), 'utf8'));
if (ONTOLOGY.projectManagementOntology) {
  const pmoPath = path.join(vaultRoot, ONTOLOGY.projectManagementOntology);
  const pmo = JSON.parse(fs.readFileSync(pmoPath, 'utf8'));
  ONTOLOGY.projectManagementOntology = pmo;
  console.log('✅ Loaded PROJECT-MANAGEMENT-ONTOLOGY.json');
}

function getPmMapping(type) {
  if (!ONTOLOGY.projectManagementOntology) return null;
  return ONTOLOGY.projectManagementOntology.nodeTypeToPmClass[type] || null;
}

function sha256(input) {
  return createHash('sha256').update(String(input)).digest('hex');
}

function getEntityMetadata(artifactId) {
  const sourceDoc = 'project-progress-dashboard/src/lib/project-dashboard/data.ts';
  const fullPath = path.join(repoRoot, sourceDoc);
  let createdAt = '';
  let modifiedAt = '';
  if (fs.existsSync(fullPath)) {
    try {
      const stats = fs.statSync(fullPath);
      createdAt = (stats.birthtime || stats.ctime).toISOString();
      modifiedAt = stats.mtime.toISOString();
    } catch (e) {
      // leave empty
    }
  }
  return {
    entity_id: sha256(`${artifactId}::${sourceDoc}`).slice(0, 32),
    version: '1.0.0',
    source_document: sourceDoc,
    created_at: createdAt,
    modified_at: modifiedAt,
    authority_level: 1,
    confidence_score: 1.0
  };
}

function frontmatter({ type, title, artifactId, extraTags = [] }) {
  const nt = ONTOLOGY.nodeTypes[type] || ONTOLOGY.nodeTypes.telemetry;
  const baseTags = [...(nt.tags || []), ONTOLOGY.conventions.projectRoot, ...extraTags];
  const uniqueTags = [...new Set(baseTags)];
  const dc = ONTOLOGY.taxonomies.domainClusters.find(c => /Telemetry/i.test(c)) || ONTOLOGY.taxonomies.domainClusters[ONTOLOGY.taxonomies.domainClusters.length - 1];
  const dm = ONTOLOGY.taxonomies.dmbokAreas.find(c => /Analytics/i.test(c)) || 'Data Governance';
  const pm = ONTOLOGY.taxonomies.pmbokAreas[ONTOLOGY.taxonomies.pmbokAreas.length - 1];
  const ba = ONTOLOGY.taxonomies.babokAreas.find(c => /Solution Evaluation/i.test(c)) || ONTOLOGY.taxonomies.babokAreas[0];
  const pmMap = getPmMapping(type) || {};
  const pmRelLines = (pmMap.pmRelationships || []).map(r => `  - ${r}`);
  const gem = getEntityMetadata(artifactId);
  return [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `artifact_id: "${artifactId}"`,
    `entity_id: "${gem.entity_id}"`,
    `version: "${gem.version}"`,
    `source_document: "${gem.source_document}"`,
    `created_at: "${gem.created_at}"`,
    `modified_at: "${gem.modified_at}"`,
    `authority_level: ${gem.authority_level}`,
    `confidence_score: ${gem.confidence_score.toFixed(1)}`,
    `type: "${type}"`,
    `pm_class: "${pmMap.pmClass || ''}"`,
    `pm_subclass: "${pmMap.pmSubClass || ''}"`,
    'pm_relationships:',
    ...pmRelLines,
    `status: "${nt.defaultStatus || 'Synced'}"`,
    `domain_cluster: "${dc}"`,
    `dmbok_category: "${dm}"`,
    `pmbok_category: "${pm}"`,
    `babok_category: "${ba}"`,
    'tags:',
    ...uniqueTags.map(t => `  - ${t}`),
    '---'
  ];
}

const metrics = d.CODEBASE_METRICS || {};
const coverage = d.MONOREPO_COVERAGE || {};
const totalStories = (d.STORIES_LIST || []).length;
const builtCount = (d.STORIES_LIST || []).filter(s => s.isBuilt).length;
const pendingCount = (d.STORIES_LIST || []).filter(s => !s.isBuilt && !s.isRetired && !s.isRelocated).length;
const retiredCount = (d.STORIES_LIST || []).filter(s => s.isRetired).length;
const relocatedCount = (d.STORIES_LIST || []).filter(s => s.isRelocated).length;
const acceptedAdrs = (d.ADR_LIST || []).filter(a => a.status === 'Accepted').length;
const proposedAdrs = (d.ADR_LIST || []).filter(a => a.status !== 'Accepted').length;

function writeFile(fileName, lines) {
  fs.writeFileSync(path.join(outDir, fileName), lines.join('\n'), 'utf8');
  console.log(`  📝 ${fileName}`);
}

function writeMoc(fileName, lines) {
  fs.writeFileSync(path.join(mocsRoot, fileName), lines.join('\n'), 'utf8');
  console.log(`  📝 _MOCs/${fileName}`);
}

// --- Executive Summary ---
{
  const lines = [
    ...frontmatter({ type: 'telemetry', title: 'Project Progress Dashboard — Executive Summary', artifactId: 'Project-Progress-Dashboard-Executive-Summary' }),
    '',
    '# 📊 Project Progress Dashboard — Executive Summary',
    '',
    `> Synchronized from \`project-progress-dashboard/scripts/sync-data.js\` at ${syncedAt}.`,
    '',
    '## Story Completion',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Total Stories | ${totalStories} |`,
    `| Built | ${builtCount} |`,
    `| Pending | ${pendingCount} |`,
    `| Retired | ${retiredCount} |`,
    `| Relocated | ${relocatedCount} |`,
    `| Completion Rate | ${totalStories > 0 ? ((builtCount / totalStories) * 100).toFixed(1) : 0}% |`,
    '',
    '## Epic Progress',
    '',
    '| Epic | Title | Total | Built | Pending | Progress |',
    '|---|---|---|---|---|---|'
  ];
  (d.EPICS_SUMMARY || []).forEach(e => {
    const progress = `${e.progressPct}%`;
    lines.push(`| ${epicLink(e)} | ${cell(e.title.replace(/#/g, '').trim())} | ${e.total} | ${e.built} | ${e.pending} | ${progress} |`);
  });
  lines.push('', '## ADR Status', '', '| Status | Count |', '|---|---|', `| Accepted | ${acceptedAdrs} |`, `| Proposed | ${proposedAdrs} |`, '');
  lines.push('## BRDs & FDDs', '', '| Type | Count |', '|---|---|', `| BRDs | ${(d.BRD_LIST || []).length} |`, `| FDDs | ${(d.FDD_LIST || []).length} |`, '');
  lines.push('## Open Questions', '', `Total open questions tracked: **${(d.OPEN_QUESTIONS_LIST || []).length}**`, '', '## Codebase Metrics', '', '| Metric | Value |', '|---|---|');
  Object.entries(metrics).forEach(([k, v]) => {
    lines.push(`| ${cell(k)} | ${cell(v)} |`);
  });
  lines.push('', '## Monorepo Contract Coverage', '', '| Package | Suites | Tests | Statements % | Branches % | Functions % | Lines % |', '|---|---|---|---|---|---|---|');
  (coverage.packages || []).forEach(p => {
    lines.push(`| ${cell(p.name)} | ${p.totalSuites} | ${p.totalTests} | ${p.statementsPct}% | ${p.branchesPct}% | ${p.functionsPct}% | ${p.linesPct}% |`);
  });
  lines.push('', `| **Overall** | ${coverage.totalSuites || ''} | ${coverage.totalTests || ''} | ${coverage.overallStatementsPct || ''}% | ${coverage.overallBranchesPct || ''}% | ${coverage.overallFunctionsPct || ''}% | ${coverage.overallLinesPct || ''}% |`);
  writeFile('Project-Progress-Dashboard-Executive-Summary.md', lines);
}

// --- ADRs ---
{
  const lines = [
    ...frontmatter({ type: 'telemetry', title: 'Project Progress Dashboard — ADR Decision Matrix', artifactId: 'Project-Progress-Dashboard-ADRs', extraTags: ['adr'] }),
    '',
    '# 🏛️ Project Progress Dashboard — ADR Decision Matrix',
    '',
    `Total ADRs: **${(d.ADR_LIST || []).length}** · Accepted: **${acceptedAdrs}** · Proposed: **${proposedAdrs}**`,
    '',
    '| ADR | Status | Domain Cluster | Referenced Stories |',
    '|---|---|---|---|'
  ];
  (d.ADR_LIST || []).sort((a, b) => a.num - b.num).forEach(adr => {
    const stories = (adr.storyRefs || []).map(s => {
      const clean = cleanStoryId(s);
      const epic = epicMap[`Epic ${clean.split('.')[0]}`]?.base;
      return epic ? `[[${epic}|Story ${clean}]]` : `Story ${clean}`;
    }).filter(Boolean).join(', ') || '—';
    lines.push(`| ${adrLink(adr)} | ${cell(adr.status)} | ${cell(adr.cluster)} | ${stories} |`);
  });
  writeFile('Project-Progress-Dashboard-ADRs.md', lines);
}

// --- BRDs ---
{
  const lines = [
    ...frontmatter({ type: 'telemetry', title: 'Project Progress Dashboard — BRD Directory', artifactId: 'Project-Progress-Dashboard-BRDs', extraTags: ['brd'] }),
    '',
    '# 📋 Project Progress Dashboard — BRD Directory',
    '',
    `Total BRDs: **${(d.BRD_LIST || []).length}**`,
    '',
    '| BRD | Pillar |',
    '|---|---|'
  ];
  (d.BRD_LIST || []).sort((a, b) => a.num - b.num).forEach(brd => {
    lines.push(`| ${brdLink(brd)} | ${cell(brd.pillar)} |`);
  });
  writeFile('Project-Progress-Dashboard-BRDs.md', lines);
}

// --- FDDs ---
{
  const lines = [
    ...frontmatter({ type: 'telemetry', title: 'Project Progress Dashboard — FDD Directory', artifactId: 'Project-Progress-Dashboard-FDDs', extraTags: ['fdd'] }),
    '',
    '# 📐 Project Progress Dashboard — FDD Directory',
    '',
    `Total FDDs: **${(d.FDD_LIST || []).length}**`,
    '',
    '| FDD | Status | Conformance |',
    '|---|---|---|'
  ];
  (d.FDD_LIST || []).sort((a, b) => a.num - b.num).forEach(fdd => {
    lines.push(`| ${fddLink(fdd)} | ${cell(fdd.status)} | ${cell(fdd.conformance)} |`);
  });
  writeFile('Project-Progress-Dashboard-FDDs.md', lines);
}

// --- Stories ---
{
  const lines = [
    ...frontmatter({ type: 'telemetry', title: 'Project Progress Dashboard — User Stories Explorer', artifactId: 'Project-Progress-Dashboard-Stories', extraTags: ['user-stories'] }),
    '',
    '# 🚀 Project Progress Dashboard — User Stories Explorer',
    '',
    `Total Stories: **${totalStories}** · Built: **${builtCount}** · Pending: **${pendingCount}**`,
    '',
    '| Story | Epic | Status | Built | Built / Roadmap Info |',
    '|---|---|---|---|---|'
  ];
  (d.STORIES_LIST || []).forEach(story => {
    const epic = epicMap[story.epicId];
    const builtIcon = story.isBuilt ? '✅' : (story.isRetired ? '📤' : (story.isRelocated ? '↪️' : '⏳'));
    const builtText = cell(story.builtInfo || '');
    lines.push(`| ${storyLink(story, epicMap)} | ${epic ? epicLink(epic) : cell(story.epicId)} | ${cell(story.status)} | ${builtIcon} | ${builtText} |`);
  });
  writeFile('Project-Progress-Dashboard-Stories.md', lines);
}

// --- Open Questions ---
{
  const lines = [
    ...frontmatter({ type: 'telemetry', title: 'Project Progress Dashboard — Open Questions', artifactId: 'Project-Progress-Dashboard-Open-Questions', extraTags: ['open-questions'] }),
    '',
    '# 🔮 Project Progress Dashboard — Open Questions',
    '',
    `Total Open Questions: **${(d.OPEN_QUESTIONS_LIST || []).length}**`,
    '',
    '| ADR | Question | Status | Category | Resolution Note |',
    '|---|---|---|---|---|'
  ];
  (d.OPEN_QUESTIONS_LIST || []).forEach(q => {
    const adrFile = baseName(q.adrFile);
    const qText = linkAdrRefs(String(q.question || '').replace(/\n/g, ' ').trim());
    const rText = linkAdrRefs(String(q.resolutionNote || '').replace(/\n/g, ' ').trim());
    lines.push(`| [[${adrFile}|ADR-${q.adrId}]] | ${qText} | ${cell(q.status)} | ${cell(q.category)} | ${rText} |`);
  });
  writeFile('Project-Progress-Dashboard-Open-Questions.md', lines);
}

// --- Contract Coverage ---
{
  const lines = [
    ...frontmatter({ type: 'telemetry', title: 'Project Progress Dashboard — Contract Coverage', artifactId: 'Project-Progress-Dashboard-Contract-Coverage', extraTags: ['contracts'] }),
    '',
    '# 🧪 Project Progress Dashboard — Contract Coverage',
    '',
    `Total Jest Contract Suites: **${(d.TEST_CONTRACTS_LIST || []).length}**`,
    '',
    '| Repo | Domain | Contract File | Story | Tests | LOC | Duration (ms) |',
    '|---|---|---|---|---|---|---|'
  ];
  (d.TEST_CONTRACTS_LIST || []).forEach(c => {
    const story = contractStoryLink(c.storyRef, epicMap);
    lines.push(`| ${cell(c.repo)} | ${cell(c.domain)} | \`${cell(c.filePath)}\` | ${story} | ${c.testCount} | ${c.loc} | ${c.durationMs} |`);
  });
  writeFile('Project-Progress-Dashboard-Contract-Coverage.md', lines);
}

// --- MOC ---
{
  const lines = [
    ...frontmatter({ type: 'moc', title: 'MOC — Project Progress Dashboard', artifactId: 'MOC - Project Progress Dashboard', extraTags: ['telemetry', 'dashboard'] }),
    '',
    '# 🎯 MOC — Project Progress Dashboard',
    '',
    `> Live telemetry snapshot from \`project-progress-dashboard/scripts/sync-data.js\`, synchronized at ${syncedAt}.`,
    '',
    '## Executive Snapshot',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| User Stories | ${totalStories} total · ${builtCount} built · ${pendingCount} pending |`,
    `| ADRs | ${(d.ADR_LIST || []).length} total · ${acceptedAdrs} accepted · ${proposedAdrs} proposed |`,
    `| BRDs | ${(d.BRD_LIST || []).length} |`,
    `| FDDs | ${(d.FDD_LIST || []).length} |`,
    `| Open Questions | ${(d.OPEN_QUESTIONS_LIST || []).length} |`,
    `| Contract Suites | ${(d.TEST_CONTRACTS_LIST || []).length} |`,
    `| Total LOC | ${metrics.totalLoc || '—'} |`,
    '',
    '## Telemetry Pages',
    '',
    '- [[Project-Progress-Dashboard-Executive-Summary|📊 Executive Summary]]',
    '- [[Project-Progress-Dashboard-ADRs|🏛️ ADR Decision Matrix]]',
    '- [[Project-Progress-Dashboard-BRDs|📋 BRD Directory]]',
    '- [[Project-Progress-Dashboard-FDDs|📐 FDD Directory]]',
    '- [[Project-Progress-Dashboard-Stories|🚀 User Stories Explorer]]',
    '- [[Project-Progress-Dashboard-Open-Questions|🔮 Open Questions]]',
    '- [[Project-Progress-Dashboard-Contract-Coverage|🧪 Contract Coverage]]',
    '',
    '## Obsidian Dataview Backlinks',
    '',
    '```dataview',
    'TABLE type as "Artifact Type", status as "Status", domain_cluster as "Domain"',
    'FROM #telemetry AND #project/socialengage',
    'SORT file.name ASC',
    '```'
  ];
  writeMoc('MOC - Project Progress Dashboard.md', lines);
}

console.log('\n✅ Dashboard telemetry compiled into Obsidian Brain.');
