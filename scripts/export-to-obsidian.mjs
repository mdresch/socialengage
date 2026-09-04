import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Target path defaults to user's local Obsidian Brain folder
const targetVaultPath = process.argv[2] || process.env.OBSIDIAN_VAULT || 'C:\\Users\\menno\\Documents\\Second Brain';

console.log('🧠 Obsidian Second Brain 4-Way Traceability Linker (ADR ↔ BRD ↔ FDD ↔ Story)');
console.log('Repo Root:    ', repoRoot);
console.log('Target Vault: ', targetVaultPath);

if (!fs.existsSync(targetVaultPath)) {
  fs.mkdirSync(targetVaultPath, { recursive: true });
}

const wikiProjectRoot = path.join(targetVaultPath, 'wiki', 'Projects', 'SocialEngage');
const rawFolder = path.join(targetVaultPath, 'raw');
const mocsFolder = path.join(targetVaultPath, 'wiki', '_MOCs');

let ONTOLOGY;
try {
  ONTOLOGY = JSON.parse(fs.readFileSync(path.join(targetVaultPath, 'ONTOLOGY.json'), 'utf8'));
  console.log('✅ Loaded ONTOLOGY.json');
  if (ONTOLOGY.projectManagementOntology) {
    const pmoPath = path.join(targetVaultPath, ONTOLOGY.projectManagementOntology);
    const pmo = JSON.parse(fs.readFileSync(pmoPath, 'utf8'));
    ONTOLOGY.projectManagementOntology = pmo;
    console.log('✅ Loaded PROJECT-MANAGEMENT-ONTOLOGY.json');
  }
} catch (e) {
  console.warn('⚠️ Could not load ONTOLOGY.json:', e.message);
}

function getPmMapping(type) {
  if (!ONTOLOGY || !ONTOLOGY.projectManagementOntology) return null;
  return ONTOLOGY.projectManagementOntology.nodeTypeToPmClass[(type || '').toLowerCase()] || null;
}

function sha256(input) {
  return createHash('sha256').update(String(input)).digest('hex');
}

function getEntityMetadata(node) {
  const sourceDoc = node.relPath || '';
  const fullPath = sourceDoc ? path.join(repoRoot, sourceDoc) : '';
  let createdAt = '';
  let modifiedAt = '';
  if (fullPath && fs.existsSync(fullPath)) {
    try {
      const stats = fs.statSync(fullPath);
      createdAt = (stats.birthtime || stats.ctime).toISOString();
      modifiedAt = stats.mtime.toISOString();
    } catch (e) {
      // leave empty if stat fails
    }
  }
  return {
    entity_id: sha256(`${node.id}::${sourceDoc}`).slice(0, 32),
    version: '1.0.0',
    source_document: sourceDoc.replace(/\\/g, '/'),
    created_at: createdAt,
    modified_at: modifiedAt,
    authority_level: 1,
    confidence_score: 1.0
  };
}

function validateNode(node) {
  if (!ONTOLOGY) return;
  const typeLower = (node.type || '').toLowerCase();
  if (!ONTOLOGY.nodeTypes[typeLower]) {
    console.warn(`  ⚠️ Node ${node.id} has unknown type "${node.type}" (expected one of ${Object.keys(ONTOLOGY.nodeTypes).join(', ')})`);
  }
  const dc = ONTOLOGY.taxonomies.domainClusters;
  if (!dc.includes(node.domainCluster)) {
    console.warn(`  ⚠️ Node ${node.id} has unknown domain_cluster "${node.domainCluster}"`);
  }
  const dm = ONTOLOGY.taxonomies.dmbokAreas;
  if (!dm.includes(node.dmbokCategory)) {
    console.warn(`  ⚠️ Node ${node.id} has unknown dmbok_category "${node.dmbokCategory}"`);
  }
  const pm = ONTOLOGY.taxonomies.pmbokAreas;
  if (!pm.includes(node.pmbokCategory)) {
    console.warn(`  ⚠️ Node ${node.id} has unknown pmbok_category "${node.pmbokCategory}"`);
  }
  const ba = ONTOLOGY.taxonomies.babokAreas;
  if (!ba.includes(node.babokCategory)) {
    console.warn(`  ⚠️ Node ${node.id} has unknown babok_category "${node.babokCategory}"`);
  }
}

[
  rawFolder,
  mocsFolder,
  path.join(wikiProjectRoot, '01 Architecture Decisions (ADR)'),
  path.join(wikiProjectRoot, '02 Business Requirements (BRD)'),
  path.join(wikiProjectRoot, '03 Functional Design (FDD)'),
  path.join(wikiProjectRoot, '04 User Stories & Epics'),
  path.join(wikiProjectRoot, '05 Project Governance & Plans'),
  path.join(wikiProjectRoot, '06 Synthesis & Lessons Learned'),
].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

// --- 1. Domain Classification Taxonomy Engine ---
function classifyDomain(idNum, title, content = '') {
  const clusterMatch = content.match(/\|\s*Domain Cluster\s*\|\s*([^|]+)\|/i) || content.match(/\|\s*Cluster\s*\|\s*([^|]+)\|/i);
  if (clusterMatch) {
    const raw = clusterMatch[1].trim();
    if (raw && !raw.includes('---')) return raw;
  }
  
  if ([81, 82, 83, 84, 85].includes(idNum) || /rag|vector|embedding|semantic search|ask-ai/i.test(title)) {
    return 'RAG & Vector Semantic Search';
  }
  if ([72, 73, 75, 86, 95, 98, 99, 100, 115, 117, 119].includes(idNum) || /polypost|composer|publish|crm|outbound|prospecting|mention/i.test(title)) {
    return 'Outbound Publishing, Engagement & CRM';
  }
  if ([14, 15, 28, 29, 30, 31, 32, 33, 34, 37, 40, 41, 92, 93, 94, 107].includes(idNum) || /auth|entra|rls|tenant|role|security|dsr|takedown|compliance|audit/i.test(title)) {
    return 'Security, Identity & Multi-Tenancy';
  }
  if ([2, 3, 6, 10, 20, 23, 24, 26, 42, 50, 51, 52, 57, 59, 60, 61, 65, 66, 67, 68, 69, 70, 109, 110, 118, 120].includes(idNum) || /connector|rate limit|ingestion|poll|feed|facebook|instagram|linkedin|brave|bing|rss|gnews|newswire|wikipedia/i.test(title)) {
    return 'Ingestion, Connectors & Rate Limits';
  }
  if ([4, 5, 11, 18, 21, 39, 43, 44, 49, 53, 63, 64, 74, 87, 90, 111].includes(idNum) || /storage|archival|database|schema|post|author|watchlist|retention|export|geospatial/i.test(title)) {
    return 'Data Model, Storage & Archival';
  }
  if ([7, 8, 9, 22, 54, 55, 56, 62, 77, 78, 79, 88, 89, 97, 105, 113, 114].includes(idNum) || /analytics|dashboard|health|sentiment|metric|spike|overview|charting|crisis|trajectory/i.test(title)) {
    return 'Derived Data, Health & Analytics';
  }
  if ([38, 71, 76, 103, 104, 108, 116, 121].includes(idNum) || /enrichment|azure ai|openai|llm|deep research|nlp|entity|key phrase|sentiment/i.test(title)) {
    return 'AI, NLP & Semantic Enrichment';
  }
  if ([12, 13, 19, 58, 91, 96].includes(idNum) || /event|service bus|subscription|alert|digest/i.test(title)) {
    return 'Eventing & Messaging Architecture';
  }
  if ([47, 80, 112, 122].includes(idNum) || /synthesis|telemetry|lesson|learning|convention|checklist/i.test(title)) {
    return 'Self-Learning, Telemetry & Operations';
  }
  return 'Platform Architecture & Foundations';
}

// --- 2. DAMA-DMBOK 11 Knowledge Areas Engine ---
function classifyDmbok(idNum, title, content = '') {
  if ([17, 19, 27, 47, 80, 112, 122].includes(idNum) || /governance|charter|synthesis|methodology|steward|policy|convention/i.test(title)) {
    return 'Data Governance';
  }
  if ([14, 15, 28, 29, 30, 32, 33, 34, 36, 37, 40, 41, 83, 92, 93, 94, 107].includes(idNum) || /security|encryption|key vault|rls|auth|entra|bypassrls|dsr|takedown|compliance/i.test(title)) {
    return 'Data Security';
  }
  if ([55, 64, 108, 117].includes(idNum) || /country code|language code|iso|master data|reference|influencer/i.test(title)) {
    return 'Reference & Master Data';
  }
  if ([53, 72, 74, 90, 115].includes(idNum) || /markdown|polypost|content|document|docx|draft|media/i.test(title)) {
    return 'Document & Content Management';
  }
  if ([8, 54, 62, 78, 87, 88, 89, 97, 105, 114].includes(idNum) || /analytics|dashboard|overview|sentiment split|volume history|dw|bi|daily count|query allowlist/i.test(title)) {
    return 'Data Warehousing & Analytics (DW/BI)';
  }
  if ([9, 70, 71, 79, 91].includes(idNum) || /quality|derived health|hanging run|watchdog|crisis|alert rule|enrichment override|reconciliation/i.test(title)) {
    return 'Data Quality Management';
  }
  if ([7, 22, 76, 82, 113, 116, 121].includes(idNum) || /metadata|chunking|embedding|deep research|topic signal|caching|drift/i.test(title)) {
    return 'Metadata Management';
  }
  if ([4, 5, 21, 31, 44, 49, 51, 57, 60, 63, 86].includes(idNum) || /schema|normalization|author model|junction|ast|modeling|design/i.test(title)) {
    return 'Data Modeling & Design';
  }
  if ([16, 18, 25, 39, 43, 52, 61, 111].includes(idNum) || /postgres|engine|storage|retention|archival|purge|deletion|scheduler|database/i.test(title)) {
    return 'Data Storage & Operations';
  }
  if ([1, 2, 35, 48, 101, 106].includes(idNum) || /architecture|repo split|connector contract|providerconnector|blueprint/i.test(title)) {
    return 'Data Architecture';
  }
  return 'Data Integration & Interoperability';
}

// --- 3. PMI-PMBOK Knowledge Areas Engine ---
function classifyPmbok(idNum, title, content = '', type = 'ADR') {
  if (type === 'Epic' || type === 'BRD' || type === 'FDD') {
    return 'Scope Management';
  }
  if ([3, 10, 20, 23, 70, 79, 91].includes(idNum) || /gotchas|risk|rate limit|dead-letter|hanging|crisis|auto-disable|failure/i.test(title)) {
    return 'Risk Management';
  }
  if ([9, 22, 71, 109, 113, 116].includes(idNum) || /quality|testing|health|validation|healing|audit/i.test(title)) {
    return 'Quality Management';
  }
  if ([29, 30, 31, 32, 35, 36, 37, 41, 60, 95, 96].includes(idNum) || /stakeholder|admin ui|tenant user|platform admin|persona|role/i.test(title)) {
    return 'Stakeholder Management';
  }
  if ([12, 13, 19, 58, 96].includes(idNum) || /communication|message|event|service bus|digest|notification/i.test(title)) {
    return 'Communications Management';
  }
  if ([52, 61, 98].includes(idNum) || /schedule|cadence|poll|timeline|milestone|timer/i.test(title)) {
    return 'Schedule & Delivery Management';
  }
  if ([14, 28, 65, 66, 76].includes(idNum) || /cost|procurement|billing|quota|credential|tier|vendor/i.test(title)) {
    return 'Cost & Procurement Management';
  }
  return 'Integration Management';
}

// --- 4. IIBA-BABOK Knowledge Areas Engine ---
function classifyBabok(idNum, title, content = '', type = 'ADR') {
  if (type === 'FDD' || [4, 5, 21, 31, 44, 49, 51, 57, 60, 63, 81, 82, 83, 84, 85].includes(idNum) || /design|schema|radd|ast|model|vector|rag/i.test(title)) {
    return 'Requirements Analysis & Design Definition (RADD)';
  }
  if (type === 'BRD' || [17, 19, 44, 47, 80, 112].includes(idNum) || /lifecycle|traceability|supersession|brd|versioning/i.test(title)) {
    return 'Requirements Life Cycle Management';
  }
  if (/business-case|ideation|charter/i.test(title) || [8, 27, 38, 72, 101].includes(idNum)) {
    return 'Strategy Analysis';
  }
  if ([54, 62, 78, 87, 88, 89, 97, 105, 114, 122].includes(idNum) || /analytics|evaluation|metric|dashboard|synthesis|telemetry/i.test(title)) {
    return 'Solution Evaluation';
  }
  if ([37, 65, 66, 71, 76, 92, 93].includes(idNum) || /elicit|collaboration|feedback|drawer|signup|research/i.test(title)) {
    return 'Elicitation & Collaboration';
  }
  return 'Business Analysis Planning & Monitoring';
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function convertToWikilinks(markdown) {
  return markdown
    .replace(/\[ADR-(\d+)\]\([^)]+\)/gi, '[[ADR-$1]]')
    .replace(/\[BRD-(\d+)\]\([^)]+\)/gi, '[[BRD-$1]]')
    .replace(/\[FDD-(\d+)\]\([^)]+\)/gi, '[[FDD-$1]]')
    .replace(/\[Epic\s*(\d+)\]\([^)]+\)/gi, '[[Epic $1]]')
    .replace(/\[Story\s*([\d\.]+)\]\([^)]+\)/gi, '[[Story $1]]');
}

// ----------------------------------------------------
// 4-WAY TRACEABILITY ENGINE (ADR ↔ BRD ↔ FDD ↔ Story)
// ----------------------------------------------------
const nodeMap = new Map();
const storyMap = new Map(); // storyId -> { storyId, title, epicId, sourceAdr, isBuilt, acList, file }
const tupleMap = new Map(); // padId -> { padId, idNum, adr, brd, fdd, stories: [] }

// PASS 1: PARSE USER STORIES & EXTRACT EXPLICIT "Source: ADR-XXXX"
const storiesSrcDir = path.join(repoRoot, 'docs', 'user-stories');
if (fs.existsSync(storiesSrcDir)) {
  fs.readdirSync(storiesSrcDir).forEach(f => {
    if (!f.endsWith('.md') || f === 'README.md') return;
    const content = fs.readFileSync(path.join(storiesSrcDir, f), 'utf8');
    const epicMatch = f.match(/epic-(\d+)/i);
    const epicId = epicMatch ? `Epic ${epicMatch[1]}` : 'Epic';

    const storyBlocks = content.split(/^## Story\s+/m);
    storyBlocks.forEach(block => {
      const match = block.match(/^([\d\.]+)\s*[-—:]?\s*([^\n\r]+)/);
      if (!match) return;
      const storyId = match[1];
      const title = match[2].trim();
      const isBuilt = block.includes('**Status:** Built') || block.includes('**Built:**');

      // Find Source ADR
      let sourceAdr = '';
      const srcMatch = block.match(/Source:\s*ADR-(\d+)/i) || block.match(/\bADR-(\d+)\b/i);
      if (srcMatch) {
        sourceAdr = `ADR-${srcMatch[1].padStart(4, '0')}`;
      }

      const storyObj = { storyId, title, epicId, sourceAdr, isBuilt, file: f, rawText: block };
      storyMap.set(storyId, storyObj);

      if (sourceAdr) {
        const padId = srcMatch[1].padStart(4, '0');
        if (!tupleMap.has(padId)) {
          tupleMap.set(padId, { padId, idNum: parseInt(padId, 10), stories: [] });
        }
        tupleMap.get(padId).stories.push(storyObj);
      }
    });
  });
}

// PASS 2: INGEST ADRs, BRDs, FDDs
function registerNode(node) {
  nodeMap.set(node.id, node);
  if (node.padId) {
    if (!tupleMap.has(node.padId)) {
      tupleMap.set(node.padId, { padId: node.padId, idNum: node.idNum, stories: [] });
    }
    const t = tupleMap.get(node.padId);
    if (node.type === 'ADR') t.adr = node;
    if (node.type === 'BRD') t.brd = node;
    if (node.type === 'FDD') t.fdd = node;
  }
}

// Ingest ADRs
const adrSrcDir = path.join(repoRoot, 'docs', 'adr');
if (fs.existsSync(adrSrcDir)) {
  fs.readdirSync(adrSrcDir).forEach(f => {
    if (!f.endsWith('.md') || f === 'README.md' || f === 'template.md') return;
    const content = fs.readFileSync(path.join(adrSrcDir, f), 'utf8');
    const idMatch = f.match(/^(\d+)/);
    const idNum = idMatch ? parseInt(idMatch[1], 10) : 0;
    const padId = idNum.toString().padStart(4, '0');
    const id = `ADR-${padId}`;

    const titleMatch = content.match(/^#\s*ADR-\d+\s*[-:—]?\s*(.*)/m) || content.match(/^#\s*(.*)/m);
    const title = titleMatch ? titleMatch[1].trim() : f;

    const statusMatch = content.match(/\*\*Status:\*\*\s*([^\n\r]+)/i) || content.match(/Status:\s*([^\n\r]+)/i);
    const status = (statusMatch && statusMatch[1].toLowerCase().includes('accepted')) ? 'Accepted' : 'Proposed';

    registerNode({
      id,
      type: 'ADR',
      title,
      padId,
      idNum,
      fileName: f,
      relPath: path.join('docs', 'adr', f),
      destFolder: path.join(wikiProjectRoot, '01 Architecture Decisions (ADR)'),
      domainCluster: classifyDomain(idNum, title, content),
      dmbokCategory: classifyDmbok(idNum, title, content),
      pmbokCategory: classifyPmbok(idNum, title, content, 'ADR'),
      babokCategory: classifyBabok(idNum, title, content, 'ADR'),
      status,
      rawContent: content,
      outgoingRefs: new Set(),
      incomingRefs: new Set(),
      upstreamDependencies: new Set(),
      downstreamDependents: new Set(),
      satisfyingStories: new Set(),
    });
  });
}

// Ingest BRDs
const brdSrcDir = path.join(repoRoot, 'docs', 'project docs', 'Business-Requirements');
if (fs.existsSync(brdSrcDir)) {
  fs.readdirSync(brdSrcDir).forEach(f => {
    if (!f.endsWith('.md')) return;
    const content = fs.readFileSync(path.join(brdSrcDir, f), 'utf8');
    const brdMatch = f.match(/BRD-(\d+)/i);
    const idNum = brdMatch ? parseInt(brdMatch[1], 10) : 0;
    const padId = idNum.toString().padStart(4, '0');
    const id = `BRD-${padId}`;

    const titleMatch = content.match(/^#\s*BRD-\d+\s*[-:—]?\s*(.*)/m) || content.match(/^#\s*(.*)/m);
    const title = titleMatch ? titleMatch[1].trim() : f;

    registerNode({
      id,
      type: 'BRD',
      title,
      padId,
      idNum,
      fileName: f,
      relPath: path.join('docs', 'project docs', 'Business-Requirements', f),
      destFolder: path.join(wikiProjectRoot, '02 Business Requirements (BRD)'),
      domainCluster: classifyDomain(idNum, title, content),
      dmbokCategory: classifyDmbok(idNum, title, content),
      pmbokCategory: classifyPmbok(idNum, title, content, 'BRD'),
      babokCategory: classifyBabok(idNum, title, content, 'BRD'),
      status: 'Approved',
      rawContent: content,
      outgoingRefs: new Set(),
      incomingRefs: new Set(),
      upstreamDependencies: new Set(),
      downstreamDependents: new Set(),
      satisfyingStories: new Set(),
    });
  });
}

// Ingest FDDs
const fddSrcDir = path.join(repoRoot, 'docs', 'project docs', 'Functional-Design');
if (fs.existsSync(fddSrcDir)) {
  fs.readdirSync(fddSrcDir).forEach(f => {
    if (!f.endsWith('.md')) return;
    const content = fs.readFileSync(path.join(fddSrcDir, f), 'utf8');
    const fddMatch = f.match(/FDD-(\d+)/i);
    const idNum = fddMatch ? parseInt(fddMatch[1], 10) : 0;
    const padId = idNum.toString().padStart(4, '0');
    const id = `FDD-${padId}`;

    const titleMatch = content.match(/^#\s*FDD-\d+\s*[-:—]?\s*(.*)/m) || content.match(/^#\s*(.*)/m);
    const title = titleMatch ? titleMatch[1].trim() : f;

    registerNode({
      id,
      type: 'FDD',
      title,
      padId,
      idNum,
      fileName: f,
      relPath: path.join('docs', 'project docs', 'Functional-Design', f),
      destFolder: path.join(wikiProjectRoot, '03 Functional Design (FDD)'),
      domainCluster: classifyDomain(idNum, title, content),
      dmbokCategory: classifyDmbok(idNum, title, content),
      pmbokCategory: classifyPmbok(idNum, title, content, 'FDD'),
      babokCategory: classifyBabok(idNum, title, content, 'FDD'),
      status: 'Ready',
      rawContent: content,
      outgoingRefs: new Set(),
      incomingRefs: new Set(),
      upstreamDependencies: new Set(),
      downstreamDependents: new Set(),
      satisfyingStories: new Set(),
    });
  });
}

// Ingest Epics
if (fs.existsSync(storiesSrcDir)) {
  fs.readdirSync(storiesSrcDir).forEach(f => {
    if (!f.endsWith('.md') || f === 'README.md') return;
    const content = fs.readFileSync(path.join(storiesSrcDir, f), 'utf8');
    const epicMatch = f.match(/epic-(\d+)/i);
    const epicNum = epicMatch ? epicMatch[1] : '';
    const id = `Epic-${epicNum}`;

    registerNode({
      id,
      type: 'Epic',
      title: f.replace(/\.md$/, ''),
      padId: epicNum.padStart(2, '0'),
      idNum: parseInt(epicNum, 10) || 0,
      fileName: f,
      relPath: path.join('docs', 'user-stories', f),
      destFolder: path.join(wikiProjectRoot, '04 User Stories & Epics'),
      domainCluster: 'Delivery & User Stories',
      dmbokCategory: 'Data Governance',
      pmbokCategory: 'Scope Management',
      babokCategory: 'Requirements Life Cycle Management',
      status: 'Active',
      rawContent: content,
      outgoingRefs: new Set(),
      incomingRefs: new Set(),
      upstreamDependencies: new Set(),
      downstreamDependents: new Set(),
      satisfyingStories: new Set(),
    });
  });
}

// Ingest Governance
const govFiles = [
  'docs/project docs/Project-Charter.md',
  'docs/project docs/Business-Case-v6.0.md',
  'docs/project docs/Stakeholder-Register.md',
  'docs/project docs/Lessons-Learned-Register.md',
  'docs/implementation-plan.md',
  'docs/implementation-methodology.md',
  'docs/environment-gotchas.md',
];
govFiles.forEach(relPath => {
  const fullPath = path.join(repoRoot, relPath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const baseName = path.basename(relPath, '.md');
    registerNode({
      id: baseName,
      type: 'Governance',
      title: baseName,
      padId: '',
      idNum: 0,
      fileName: path.basename(relPath),
      relPath,
      destFolder: path.join(wikiProjectRoot, '05 Project Governance & Plans'),
      domainCluster: 'Project Governance & Management',
      dmbokCategory: 'Data Governance',
      pmbokCategory: baseName.includes('Stakeholder') ? 'Stakeholder Management' : 'Integration Management',
      babokCategory: baseName.includes('Business-Case') ? 'Strategy Analysis' : 'Business Analysis Planning & Monitoring',
      status: 'Governing',
      rawContent: content,
      outgoingRefs: new Set(),
      incomingRefs: new Set(),
      upstreamDependencies: new Set(),
      downstreamDependents: new Set(),
      satisfyingStories: new Set(),
    });
  }
});

// PROMOTE STORIES: register each user story as a first-class node
console.log('🚀 Promoting User Stories from Epics to first-class nodes...');
storyMap.forEach((story, storyId) => {
  const epicNum = story.storyId.split('.')[0];
  registerNode({
    id: `Story ${story.storyId}`,
    type: 'Story',
    title: story.title,
    padId: story.sourceAdr ? (story.sourceAdr.match(/\d+/) || [''])[0].padStart(4, '0') : '',
    idNum: 0,
    fileName: `Story ${story.storyId}.md`,
    relPath: path.join('docs', 'user-stories', story.file),
    destFolder: path.join(wikiProjectRoot, '04 User Stories & Epics'),
    domainCluster: 'Delivery & User Stories',
    dmbokCategory: 'Data Governance',
    pmbokCategory: 'Scope Management',
    babokCategory: 'Requirements Life Cycle Management',
    status: story.isBuilt ? 'Built' : 'Ready',
    rawContent: `## ${story.storyId} — ${story.title}\n\n> Epic: [[Epic-${epicNum}]]\n> Source: ${story.sourceAdr ? `[[${story.sourceAdr}]]` : '—'}\n\n${story.rawText}`,
    outgoingRefs: new Set(),
    incomingRefs: new Set(),
    upstreamDependencies: new Set(),
    downstreamDependents: new Set(),
    satisfyingStories: new Set(),
  });
});

// PASS 3: INJECT 4-WAY TRACEABILITY CARDS & WRITE MARKDOWN
console.log('🔗 PASS 3: Generating 4-Way Traceability Links (ADR ↔ BRD ↔ FDD ↔ Story)...');

nodeMap.forEach(node => {
  validateNode(node);
  const slugCluster = slugify(node.domainCluster);
  const slugDmbok = slugify(node.dmbokCategory);
  const slugPmbok = slugify(node.pmbokCategory);
  const slugBabok = slugify(node.babokCategory);

  const t = tupleMap.get(node.padId) || { stories: [] };
  const linkedStories = t.stories || [];

  const adrLink = t.adr ? `[[${t.adr.id}|${t.adr.id}: ${t.adr.title}]]` : (node.padId ? `[[ADR-${node.padId}]]` : 'N/A');
  const brdLink = t.brd ? `[[${t.brd.id}|${t.brd.id}: ${t.brd.title}]]` : (node.padId ? `[[BRD-${node.padId}]]` : 'N/A');
  const fddLink = t.fdd ? `[[${t.fdd.id}|${t.fdd.id}: ${t.fdd.title}]]` : (node.padId ? `[[FDD-${node.padId}]]` : 'N/A');
  const storiesList = linkedStories.length > 0
    ? linkedStories.map(s => `[[Story ${s.storyId}]] (${s.isBuilt ? '✅ Built' : '⏳ Pending'})`).join(', ')
    : 'Implemented via Parent Epic';

  const typeTagUpper = node.type === 'Epic' ? 'Story' : node.type; // 'ADR', 'BRD', 'FDD', 'Story', 'Governance'
  const typeTagLower = node.type === 'Epic' ? 'story' : node.type.toLowerCase();

  const pm = getPmMapping(node.type) || {};
  const pmRelationshipsYaml = (pm.pmRelationships || []).map(r => `  - ${r}`).join('\n');
  const gem = getEntityMetadata(node);

  const frontmatter = `---
title: "${node.id}: ${node.title.replace(/"/g, '\\"')}"
artifact_id: "${node.id}"
entity_id: "${gem.entity_id}"
version: "${gem.version}"
source_document: "${gem.source_document.replace(/\\/g, '/').replace(/"/g, '\\"')}"
created_at: "${gem.created_at}"
modified_at: "${gem.modified_at}"
authority_level: ${gem.authority_level}
confidence_score: ${gem.confidence_score.toFixed(1)}
type: "${node.type.toLowerCase()}"
pm_class: "${pm.pmClass || ''}"
pm_subclass: "${pm.pmSubClass || ''}"
pm_relationships:
${pmRelationshipsYaml}
domain_cluster: "${node.domainCluster}"
dmbok_category: "${node.dmbokCategory}"
pmbok_category: "${node.pmbokCategory}"
babok_category: "${node.babokCategory}"
status: "${node.status}"
aliases:
  - "${node.id}"
  - "${node.id.replace('-', ' ')}"
  - "${node.title.replace(/"/g, '\\"')}"
tags:
  - ${typeTagUpper}
  - ${typeTagLower}
  - domain/${slugCluster}
  - dmbok/${slugDmbok}
  - pmbok/${slugPmbok}
  - babok/${slugBabok}
  - traceability/4-way-linked
  - project/socialengage
---

`;

  // Prominent Top-of-Page 4-Way Traceability Card
  const topTraceabilityCard = `
> [!NOTE] 🔗 **4-Way Traceability Quad (ADR ↔ BRD ↔ FDD ↔ Story)**
> - 🏛️ **Architecture Decision:** ${adrLink}
> - 📋 **Business Requirements:** ${brdLink}
> - 📐 **Functional Design:** ${fddLink}
> - 🎯 **User Stories & Delivery:** ${storiesList}

`;

  // Bottom Relationship & Graph Section
  const bottomSection = `

---

## 🔗 Enterprise Knowledge Graph & Multi-Framework Mappings

### 🧭 Multi-Framework Alignments
- **Domain Cluster:** [[MOC - ${node.domainCluster.replace(/[/\\?%*:|"<>]/g, '-')}|📁 ${node.domainCluster}]]
- **DAMA-DMBOK:** [[MOC - DMBOK - ${node.dmbokCategory.replace(/[/\\?%*:|"<>]/g, '-')}|☸️ ${node.dmbokCategory}]]
- **PMI-PMBOK:** [[MOC - PMBOK - ${node.pmbokCategory.replace(/[/\\?%*:|"<>]/g, '-')}|📊 ${node.pmbokCategory}]]
- **IIBA-BABOK:** [[MOC - BABOK - ${node.babokCategory.replace(/[/\\?%*:|"<>]/g, '-')}|📐 ${node.babokCategory}]]
- **Complete Traceability Matrix:** [[MOC - Complete Traceability Matrix (ADR - BRD - FDD - Story)|🎯 Master 4-Way Traceability Hub]]

### 🔍 Live Obsidian Dataview Backlinks
\`\`\`dataview
TABLE file.name as "Referencing Document", type as "Artifact Type", status as "Status"
FROM [[]] AND !outgoing([[]])
SORT file.name ASC
\`\`\`
`;

  const finalContent = frontmatter + topTraceabilityCard + convertToWikilinks(node.rawContent) + bottomSection;
  fs.writeFileSync(path.join(node.destFolder, node.fileName), finalContent, 'utf8');
});

// PASS 4: GENERATE COMPLETE 4-WAY TRACEABILITY MATRIX MOC
console.log('🎯 PASS 4: Generating Master 4-Way Traceability Hub...');

const sortedTuples = Array.from(tupleMap.values()).sort((a, b) => a.idNum - b.idNum);

const fullRtmMoc = `---
tags:
  - moc
  - traceability-matrix
  - master-rtm
  - project/socialengage
title: "Complete 4-Way Traceability Matrix (ADR ↔ BRD ↔ FDD ↔ Story)"
---

# 🎯 Complete 4-Way Traceability Matrix (ADR ↔ BRD ↔ FDD ↔ Story)

This Master Matrix establishes **100% bidirectional traceability** across the entire engineering lifecycle:
**Business Intent (BRD)** $\leftrightarrow$ **Architectural Choice (ADR)** $\leftrightarrow$ **System Design (FDD)** $\leftrightarrow$ **Delivery Contract (User Story)**.

\`\`\`mermaid
flowchart LR
    BRD["📋 BRD\n(Business Requirements)"] <--> ADR["🏛️ ADR\n(Architecture Decision)"]
    ADR <--> FDD["📐 FDD\n(Functional Design)"]
    FDD <--> Story["🎯 User Story\n(TDD Contract Suites)"]
\`\`\`

---

## 📋 Master Traceability Register (122 Feature Initiatives)

| ID | 🏛️ Architecture Decision (ADR) | 📋 Business Requirements (BRD) | 📐 Functional Design (FDD) | 🎯 User Stories & Delivery |
|---|---|---|---|---|
${sortedTuples.map(t => {
  const pad = t.padId;
  const adrName = t.adr ? `[[ADR-${pad}\\|ADR-${pad}]]` : `[[ADR-${pad}]]`;
  const brdName = t.brd ? `[[BRD-${pad}\\|BRD-${pad}]]` : `[[BRD-${pad}]]`;
  const fddName = t.fdd ? `[[FDD-${pad}\\|FDD-${pad}]]` : `[[FDD-${pad}]]`;
  const stories = t.stories.length > 0 
    ? t.stories.map(s => `[[Story ${s.storyId}]] (${s.isBuilt ? '✅ Built' : '⏳ Pending'})`).join('<br>')
    : `Mapped in Epic`;
  return `| **#${pad}** | ${adrName} | ${brdName} | ${fddName} | ${stories} |`;
}).join('\n')}

---

## 🔍 Dataview: Live Traceability Filter

\`\`\`dataview
TABLE domain_cluster as "Domain", dmbok_category as "DMBOK", pmbok_category as "PMBOK", babok_category as "BABOK"
FROM #traceability/4-way-linked
SORT file.name ASC
\`\`\`
`;

fs.writeFileSync(path.join(mocsFolder, 'MOC - Complete Traceability Matrix (ADR - BRD - FDD - Story).md'), fullRtmMoc, 'utf8');

console.log(`\n🎉 4-Way Traceability Linkage Complete! Exported all cross-linked documents into ${targetVaultPath}!\n`);
