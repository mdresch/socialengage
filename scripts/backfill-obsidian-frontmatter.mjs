import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';

const vaultRoot = 'C:\\Users\\MennoDrescher\\source\\repos\\Obsidian Brain';
const wikiRoot = path.join(vaultRoot, 'wiki');

const ONTOLOGY = JSON.parse(fs.readFileSync(path.join(vaultRoot, 'ONTOLOGY.json'), 'utf8'));
const pmoPath = ONTOLOGY.projectManagementOntology
  ? path.join(vaultRoot, ONTOLOGY.projectManagementOntology)
  : null;
const PMO = pmoPath ? JSON.parse(fs.readFileSync(pmoPath, 'utf8')) : {};

function sha256(input) {
  return createHash('sha256').update(String(input)).digest('hex');
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { data: {}, body: text };
  const end = text.indexOf('\n---\n');
  if (end === -1) return { data: {}, body: text };
  const fmText = text.slice(4, end);
  const body = text.slice(end + 5);
  const data = {};
  let currentKey = null;
  for (const line of fmText.split('\n')) {
    const listMatch = line.match(/^  - (.*)$/);
    if (listMatch) {
      const item = listMatch[1].trim();
      if (currentKey) {
        if (data[currentKey] === undefined || data[currentKey] === null) {
          data[currentKey] = [];
        } else if (!Array.isArray(data[currentKey])) {
          data[currentKey] = [data[currentKey]];
        }
        data[currentKey].push(item);
      }
    } else if (line.includes(':')) {
      const idx = line.indexOf(':');
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      data[key] = value === '' ? undefined : value;
      currentKey = key;
    } else {
      currentKey = null;
    }
  }
  return { data, body };
}

function appendKey(lines, key, value) {
  if (Array.isArray(value)) {
    lines.push(`${key}:`);
    for (const item of value) lines.push(`  - ${item}`);
  } else if (typeof value === 'number') {
    lines.push(`${key}: ${key === 'confidence_score' ? value.toFixed(1) : value}`);
  } else {
    lines.push(`${key}: "${String(value).replace(/"/g, '\\"')}"`);
  }
}

function serializeFrontmatter(data) {
  const lines = ['---'];
  const knownOrder = [
    'title', 'artifact_id', 'entity_id', 'version', 'source_document', 'created_at', 'modified_at',
    'authority_level', 'confidence_score', 'type', 'pm_class', 'pm_subclass', 'pm_relationships',
    'domain_cluster', 'dmbok_category', 'pmbok_category', 'babok_category', 'status', 'aliases', 'tags'
  ];
  const emitted = new Set();
  for (const key of knownOrder) {
    if (key in data) {
      appendKey(lines, key, data[key]);
      emitted.add(key);
    }
  }
  for (const [key, value] of Object.entries(data)) {
    if (!emitted.has(key)) appendKey(lines, key, value);
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

function sentenceCase(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function inferType(relPath, data) {
  if (data.type) return data.type;
  const p = relPath.replace(/\\/g, '/');
  if (p.includes('/07 Skills/')) return 'skill';
  if (p.startsWith('_MOCs/')) return 'moc';
  if (p.includes('/06 Synthesis & Lessons Learned/')) return 'concept';
  if (p.endsWith('/README.md')) {
    if (p.includes('/01 Architecture Decisions (ADR)/')) return 'concept';
    if (p.includes('/04 User Stories & Epics/')) return 'concept';
  }
  return 'concept';
}

function inferDefaults(relPath, type) {
  const p = relPath.replace(/\\/g, '/');
  if (type === 'skill') {
    return { domain_cluster: 'Self-Learning, Telemetry & Operations', dmbok_category: 'Metadata Management', pmbok_category: 'Integration Management', babok_category: 'Business Analysis Planning & Monitoring', status: 'Active' };
  }
  if (type === 'moc') {
    return { domain_cluster: 'Project Governance & Management', dmbok_category: 'Data Governance', pmbok_category: 'Integration Management', babok_category: 'Business Analysis Planning & Monitoring', status: 'Active' };
  }
  if (p.includes('/06 Synthesis & Lessons Learned/')) {
    return { domain_cluster: 'Self-Learning, Telemetry & Operations', dmbok_category: 'Data Governance', pmbok_category: 'Integration Management', babok_category: 'Solution Evaluation', status: 'Synced' };
  }
  if (p.includes('/01 Architecture Decisions (ADR)/')) {
    return { domain_cluster: 'Platform Architecture & Foundations', dmbok_category: 'Data Architecture', pmbok_category: 'Integration Management', babok_category: 'Business Analysis Planning & Monitoring', status: 'Active' };
  }
  if (p.includes('/04 User Stories & Epics/')) {
    return { domain_cluster: 'Delivery & User Stories', dmbok_category: 'Data Governance', pmbok_category: 'Scope Management', babok_category: 'Requirements Life Cycle Management', status: 'Active' };
  }
  return { domain_cluster: 'Project Governance & Management', dmbok_category: 'Data Governance', pmbok_category: 'Integration Management', babok_category: 'Business Analysis Planning & Monitoring', status: 'Active' };
}

function getPmClass(type) {
  const map = (PMO.nodeTypeToPmClass || {})[type];
  if (map) return map;
  if (type === 'synthesis-telemetry') {
    return { pmClass: 'GovernanceArtifact', pmSubClass: 'SynthesisReport', pmRelationships: ['monitoredThrough', 'influences'] };
  }
  return { pmClass: 'GovernanceArtifact', pmSubClass: 'KnowledgeMap', pmRelationships: ['influences', 'tracedTo'] };
}

function needsRefresh(data) {
  if (!data.entity_id || !data.pm_class) return true;
  if (data.pm_subclass === 'undefined') return true;
  const arrays = [data.pm_relationships, data.tags, data.aliases].filter(Array.isArray);
  return arrays.some(arr => arr.some(item => !item || item === 'undefined'));
}

function backfillFile(filePath) {
  const relPath = path.relative(wikiRoot, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const { data, body } = parseFrontmatter(content);
  if (data.entity_id && !needsRefresh(data)) return false;

  const stats = fs.statSync(filePath);
  const createdAt = (stats.birthtime || stats.ctime).toISOString();
  const modifiedAt = stats.mtime.toISOString();

  const type = inferType(relPath, data);
  const defaults = inferDefaults(relPath, type);
  const title = data.title || sentenceCase(data.skill || path.basename(filePath, '.md'));
  const artifactId = data.artifact_id || data.artifactId || path.basename(filePath, '.md');
  const sourceDoc = (data.source_path || relPath).replace(/\\/g, '/');
  const pm = getPmClass(type);

  const newData = { ...data };
  newData.title = title;
  newData.artifact_id = artifactId;
  newData.entity_id = sha256(`${artifactId}::${sourceDoc}`).slice(0, 32);
  newData.version = data.version || '1.0.0';
  newData.source_document = sourceDoc;
  newData.created_at = createdAt;
  newData.modified_at = modifiedAt;
  newData.authority_level = Number(data.authority_level || 1);
  newData.confidence_score = Number(data.confidence_score ?? 1.0);
  newData.type = type;
  newData.pm_class = data.pm_class || pm.pmClass;
  const pmSubClass = (data.pm_subclass && data.pm_subclass !== 'undefined') ? data.pm_subclass : pm.pmSubClass;
  if (pmSubClass) newData.pm_subclass = pmSubClass;
  else delete newData.pm_subclass;
  newData.pm_relationships = (Array.isArray(data.pm_relationships) ? data.pm_relationships : (pm.pmRelationships || [])).filter(x => x && x !== 'undefined');
  newData.domain_cluster = data.domain_cluster || defaults.domain_cluster;
  newData.dmbok_category = data.dmbok_category || defaults.dmbok_category;
  newData.pmbok_category = data.pmbok_category || defaults.pmbok_category;
  newData.babok_category = data.babok_category || defaults.babok_category;
  newData.status = data.status || defaults.status;

  const baseTags = (ONTOLOGY.nodeTypes[type]?.tags) || (ONTOLOGY.nodeTypes.concept?.tags) || [];
  const existingTags = Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []);
  const allTags = [...new Set([...baseTags, ...existingTags, 'project/socialengage'])].filter(x => x && x !== 'undefined');
  newData.tags = allTags;

  const aliases = Array.isArray(data.aliases) ? data.aliases : (data.aliases ? [data.aliases] : []);
  const aliasSet = new Set([artifactId, title, ...aliases]);
  newData.aliases = [...aliasSet].filter(x => x && x !== 'undefined');

  fs.writeFileSync(filePath, serializeFrontmatter(newData) + body, 'utf8');
  return true;
}

let updated = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.md') && backfillFile(p)) updated++;
  }
}
walk(wikiRoot);
console.log(`✅ Backfilled ${updated} stale wiki pages with current ontology frontmatter.`);
