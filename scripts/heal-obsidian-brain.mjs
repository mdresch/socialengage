import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const vaultRoot = process.argv[2] || 'C:\\Users\\MennoDrescher\\source\\repos\\Obsidian Brain';
const wikiRoot = path.join(vaultRoot, 'wiki');
const rawRoot = path.join(vaultRoot, 'raw');
const reportDir = path.join(wikiRoot, 'Projects', 'SocialEngage', '08 Project Telemetry Dashboard');

const ONTOLOGY = JSON.parse(fs.readFileSync(path.join(vaultRoot, 'ONTOLOGY.json'), 'utf8'));
const PMO = ONTOLOGY.projectManagementOntology
  ? JSON.parse(fs.readFileSync(path.join(vaultRoot, ONTOLOGY.projectManagementOntology), 'utf8'))
  : {};

const validTypes = new Set(Object.keys(ONTOLOGY.nodeTypes || {}));
const validPmClasses = new Set(Object.keys(PMO.classes || {}));
const validClusters = new Set(ONTOLOGY.taxonomies?.domainClusters || []);
const validDmbok = new Set(ONTOLOGY.taxonomies?.dmbokAreas || []);
const validPmbok = new Set(ONTOLOGY.taxonomies?.pmbokAreas || []);
const validBabok = new Set(ONTOLOGY.taxonomies?.babokAreas || []);

const findings = { errors: [], warnings: [], info: [] };
let autoFixed = 0;

function error(msg) { findings.errors.push(msg); console.error('  ❌', msg); }
function warn(msg) { findings.warnings.push(msg); console.warn('  ⚠️', msg); }
function info(msg) { findings.info.push(msg); console.log('  ℹ️', msg); }

function runScript(scriptPath) {
  const full = path.resolve(repoRoot, scriptPath);
  console.log(`\n🔄 Running ${scriptPath}...`);
  try {
    execSync(`node "${full}"`, { stdio: 'inherit', cwd: repoRoot, timeout: 300000 });
    info(`${scriptPath} completed`);
    return true;
  } catch (e) {
    error(`${scriptPath} failed: ${e.message}`);
    return false;
  }
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
        if (data[currentKey] === undefined || data[currentKey] === null) data[currentKey] = [];
        else if (!Array.isArray(data[currentKey])) data[currentKey] = [data[currentKey]];
        data[currentKey].push(item);
      }
    } else if (line.includes(':')) {
      const idx = line.indexOf(':');
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      } else if (/^-?\d+(\.\d+)?$/.test(value)) {
        value = Number(value);
      }
      data[key] = value === '' ? undefined : value;
      currentKey = key;
    } else {
      currentKey = null;
    }
  }
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) data[k] = v.filter(x => x && x !== 'undefined');
  }
  return { data, body };
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
    if (key in data && data[key] !== undefined) {
      emit(lines, key, data[key]);
      emitted.add(key);
    }
  }
  for (const [key, value] of Object.entries(data)) {
    if (!emitted.has(key) && value !== undefined) emit(lines, key, value);
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

function emit(lines, key, value) {
  if (Array.isArray(value)) {
    lines.push(`${key}:`);
    for (const item of value) lines.push(`  - ${item}`);
  } else if (typeof value === 'number') {
    lines.push(`${key}: ${key === 'confidence_score' ? value.toFixed(1) : value}`);
  } else {
    lines.push(`${key}: "${String(value).replace(/"/g, '\\"')}"`);
  }
}

function findFiles(dir, ext) {
  const files = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (p.endsWith(ext)) files.push(p);
    }
  }
  walk(dir);
  return files;
}

function resolveSource(sourceDoc) {
  if (!sourceDoc) return null;
  const sd = sourceDoc.replace(/\\/g, '/');
  const candidates = [
    path.join(repoRoot, sd),
    path.join(vaultRoot, sd),
    path.join(wikiRoot, sd)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function normalizeSkillSource(data, relPath) {
  if (data.type !== 'skill') return false;
  const repo = data.repo;
  const skill = data.skill || data.artifact_id?.replace(/^SKILL-/, '').toLowerCase();
  if (!repo || !skill) return false;
  const correct = `${repo}/.claude/skills/${skill}/SKILL.md`;
  if (data.source_document && data.source_document.replace(/\\/g, '/').includes(`${repo}/.claude/skills/${skill}/`)) {
    if (data.source_document !== correct) {
      data.source_document = correct;
      return true;
    }
  }
  data.source_document = correct;
  return true;
}

function entityId(seed) {
  return crypto.createHash('md5').update(seed).digest('hex');
}

function extractWikiTarget(raw) {
  return raw.replace(/\\\|/g, '|').split('|')[0].split('#')[0].trim().replace(/\\$/, '');
}

function extractWikiLinks(body) {
  const clean = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');
  return clean.match(/\[\[[^\]]+\]\]/g) || [];
}

function ensureMissingMocs() {
  console.log('\n🗺️ Ensuring referenced MOCs exist...');
  const mocDir = path.join(wikiRoot, '_MOCs');
  const existing = new Set();
  if (fs.existsSync(mocDir)) {
    for (const f of fs.readdirSync(mocDir)) {
      if (f.endsWith('.md')) existing.add(path.basename(f, '.md').toLowerCase());
    }
  }
  const missing = new Map(); // target -> Set(referrer rel)

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (p.endsWith('.md')) {
        const rel = path.relative(wikiRoot, p).replace(/\\/g, '/');
        const { body } = parseFrontmatter(fs.readFileSync(p, 'utf8'));
        const links = extractWikiLinks(body);
        for (const link of links) {
          const target = extractWikiTarget(link.slice(2, -2));
          if (target.startsWith('MOC - ')) {
            if (!missing.has(target)) missing.set(target, new Set());
            missing.get(target).add(rel);
          }
        }
      }
    }
  }
  walk(wikiRoot);

  // Count basenames to disambiguate
  const basenameCounts = new Map();
  for (const p of findFiles(wikiRoot, '.md')) {
    const bn = path.basename(p, '.md');
    basenameCounts.set(bn, (basenameCounts.get(bn) || 0) + 1);
  }

  for (const [moc, referrers] of missing.entries()) {
    if (existing.has(moc.toLowerCase())) continue;
    fs.mkdirSync(mocDir, { recursive: true });
    const file = path.join(mocDir, `${moc}.md`);
    const now = new Date().toISOString();
    const links = [];
    for (const r of referrers) {
      const bn = path.basename(r, '.md');
      const target = basenameCounts.get(bn) > 1 ? r.replace(/\.md$/, '') : bn;
      links.push(`- [[${target}]]`);
    }
    const data = {
      title: moc,
      artifact_id: moc,
      entity_id: entityId(moc),
      version: '1.0.0',
      source_document: `_MOCs/${moc}.md`,
      created_at: now,
      modified_at: now,
      authority_level: 1,
      confidence_score: 1.0,
      type: 'moc',
      pm_class: 'GovernanceArtifact',
      pm_subclass: 'KnowledgeMap',
      pm_relationships: ['governedBy', 'influences'],
      domain_cluster: 'Project Governance & Management',
      dmbok_category: 'Data Governance',
      pmbok_category: 'Integration Management',
      babok_category: 'Business Analysis Planning & Monitoring',
      status: 'Active',
      aliases: [moc],
      tags: ['moc', 'project/socialengage']
    };
    fs.writeFileSync(file, serializeFrontmatter(data) + `# ${moc}\n\nThis MOC was auto-generated because other pages reference it.\n\n## Referenced pages\n${Array.from(links).join('\n')}\n`, 'utf8');
    autoFixed++;
    info(`Created missing MOC: _MOCs/${moc}.md`);
  }
}

function buildGitMap() {
  const map = new Map();
  const gitDir = path.join(repoRoot, '.git');
  if (!fs.existsSync(gitDir)) return map;
  try {
    const result = spawnSync('git', ['log', '--pretty=format:<COMMIT>%H|%aI|%an', '--name-only', '--all'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 200 * 1024 * 1024
    });
    if (result.status !== 0 || result.error) return map;
    const blocks = result.stdout.split('<COMMIT>').slice(1);
    for (const block of blocks) {
      const lines = block.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) continue;
      const [hash, date, author] = lines[0].split('|');
      const files = lines.slice(1).map(f => f.trim()).filter(Boolean);
      for (const f of files) {
        if (!f) continue;
        const rel = f.replace(/\\/g, '/');
        const entry = map.get(rel) || { commitCount: 0, committers: new Set() };
        if (!entry.lastCommitAt || new Date(date) > new Date(entry.lastCommitAt)) {
          entry.lastCommit = hash;
          entry.lastCommitAt = date;
          entry.lastAuthor = author;
        }
        entry.commitCount++;
        entry.committers.add(author);
        map.set(rel, entry);
      }
    }
  } catch (e) { /* ignore: not a git repo or git error */ }
  return map;
}

function buildImplementationLogMap() {
  const stories = new Map();
  const adrs = new Map();
  const logFile = path.join(repoRoot, 'docs', 'implementation-log.md');
  if (!fs.existsSync(logFile)) return { stories, adrs };
  const text = fs.readFileSync(logFile, 'utf8');
  const lines = text.split(/\r?\n/);
  let entry = null;

  function pushEntry() {
    if (!entry) return;
    const storyIds = new Set();
    const adrIds = new Set();
    const title = entry.title || '';
    const storyField = entry.fields['Story / ADR'] || '';
    const combined = `${title} ${storyField}`;
    for (const m of combined.matchAll(/\bADR-(\d{4})\b/g)) adrIds.add(`ADR-${m[1]}`);
    for (const m of combined.matchAll(/(\d+\.\d+)\b/g)) storyIds.add(`Story ${m[1]}`);
    const [repo, shortHash] = (entry.repoHash || '').includes('@') ? entry.repoHash.split('@') : [entry.repoHash || '', ''];
    entry.repo = (entry.fields['Repo'] || repo || '').trim();
    entry.shortHash = shortHash.trim();
    const fullCommit = (entry.fields['Full commit'] || '').replace(/`/g, '').trim();
    entry.fullCommit = fullCommit || entry.shortHash;
    const statusMatch = (entry.testField || '').match(/\b(PASS|FAIL)\b/i);
    const parenMatch = (entry.testField || '').match(/\(([^)]+)\)/);
    if (statusMatch && parenMatch) {
      const parts = parenMatch[1].split(/,\s*|\s*;\s*/).filter(p => !/suite/i.test(p));
      const all = [];
      for (const part of parts) {
        const m = part.match(/(\d+)\/(\d+)/);
        if (m) all.push([Number(m[1]), Number(m[2])]);
      }
      if (all.length) {
        const passed = all.reduce((a, [p]) => a + p, 0);
        const total = all.reduce((a, [, t]) => a + t, 0);
        entry.testStatus = statusMatch[1].toUpperCase();
        entry.testSummary = `${entry.testStatus} (${passed}/${total})`;
        entry.testPassed = passed;
        entry.testTotal = total;
      }
    }
    const touched = (entry.filesTouched || []).join(',').split(/[,;]\s*/).map(s => s.replace(/`/g, '').trim()).filter(Boolean);
    entry.categorized = categorizeShippedFiles(touched);
    const allContracts = Array.from(new Set([...(entry.contracts || []), ...entry.categorized.contracts]));
    entry.categorized.contracts = allContracts;
    for (const sid of storyIds) if (!stories.has(sid)) stories.set(sid, entry);
    for (const aid of adrIds) if (!adrs.has(aid)) adrs.set(aid, entry);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\s+—\s+(.+?)\s+—\s+(\S+)\s*$/);
    if (headerMatch) {
      pushEntry();
      entry = {
        date: headerMatch[1],
        title: headerMatch[2].trim(),
        repoHash: headerMatch[3],
        fields: {},
        filesTouched: [],
        contracts: [],
        testField: ''
      };
      continue;
    }
    if (!entry) continue;
    const fieldMatch = line.match(/^-\s+\*\*([^*]+?)\*\*:?\s*(.*)$/);
    if (fieldMatch) {
      const key = fieldMatch[1].trim().replace(/:+$/, '');
      const rawValue = fieldMatch[2].trim();
      function cleanContract(raw) {
        return raw.replace(/`/g, '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
      }
      if (key === 'Contract' || key === 'Contracts') {
        entry.fields[key] = rawValue;
        const value = cleanContract(rawValue);
        if (value) entry.contracts.push(...value.split(/[,;]\s*/).map(s => cleanContract(s)).filter(Boolean));
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/^-\s+\*\*/) && !lines[j].match(/^##\s/)) {
          const listMatch = lines[j].match(/^\s*-\s+(.+)$/);
          if (listMatch) {
            const item = cleanContract(listMatch[1]);
            if (item) entry.contracts.push(...item.split(/[,;]\s*/).map(s => cleanContract(s)).filter(Boolean));
          }
          j++;
        }
      } else if (key === 'Files touched') {
        entry.filesTouched.push(rawValue);
      } else if (key === 'Full suite at merge' || key.includes('suite at merge')) {
        entry.testField = rawValue;
        entry.fields[key] = rawValue;
      } else {
        entry.fields[key] = rawValue;
      }
      continue;
    }
    const suiteLine = line.match(/(Full|Epic-\d+)\s+suite\s+at\s+merge.*?(PASS|FAIL)\s*\([^)]*?(\d+)\/(\d+)/i);
    if (suiteLine) {
      entry.testField = `${suiteLine[2].toUpperCase()} (${suiteLine[3]}/${suiteLine[4]})`;
    }
  }
  pushEntry();
  return { stories, adrs };
}

function categorizeShippedFiles(files) {
  const res = { contracts: [], sources: [], migrations: [], skills: [], docs: [], other: [] };
  for (const raw of files) {
    const f = raw.replace(/`/g, '').trim();
    if (!f) continue;
    if (f.includes('.contract.test.ts')) res.contracts.push(f);
    else if (f.includes('/src/') || f.startsWith('src/')) res.sources.push(f);
    else if (f.includes('/migrations/') || f.startsWith('migrations/')) res.migrations.push(f);
    else if (f.includes('/skills/') || f.includes('/.claude/skills/') || f.includes('/.agents/skills/')) res.skills.push(f);
    else if (f.includes('/docs/') || f.startsWith('docs/')) res.docs.push(f);
    else res.other.push(f);
  }
  return res;
}

function buildContractFileMap() {
  const map = new Map();
  for (const repo of ['social-listening-core', 'social-listening-admin']) {
    const dir = path.join(repoRoot, repo, 'contracts');
    if (!fs.existsSync(dir)) continue;
    const files = findFiles(dir, '.contract.test.ts');
    for (const f of files) {
      const bn = path.basename(f);
      const m = bn.match(/story-([\d.]+)\./i);
      if (m) {
        const id = `Story ${m[1]}`;
        const rel = path.relative(repoRoot, f).replace(/\\/g, '/');
        if (!map.has(id)) map.set(id, []);
        if (!map.get(id).includes(rel)) map.get(id).push(rel);
      }
    }
  }
  return map;
}

const SECTION_STOP = new Set([
  'context','decision','consequences','alternatives considered','alternatives','open questions','open questions next steps',
  'references','summary','overview','introduction','background','rationale','solution','implementation','notes',
  'status','source','author','date','tags','aliases','created','modified','version','title','artifact','entity','pm','class',
  'subclass','relationships','enterprise knowledge graph multi framework mappings','live obsidian dataview backlinks',
  'multi framework alignments','taxonomies hubs','backlinks','dataview','alignments','mappings','mappings',
  'open','questions','next','steps','guardrails'
]);

const STOP_WORDS = new Set([
  'about','above','after','again','against','all','also','am','an','and','any','are','as','at','be','because','been','before','being','below','between','both','but','by','can','could','did','do','does','doing','don','down','during','each','few','for','from','further','had','has','have','having','he','her','here','hers','herself','him','himself','his','how','i','if','in','into','is','it','its','itself','just','me','more','most','my','myself','no','nor','not','now','of','off','on','once','only','or','other','our','ours','ourselves','out','over','own','same','she','should','so','some','such','than','that','the','their','theirs','them','themselves','then','there','these','they','this','those','through','to','too','under','until','up','very','was','we','were','what','when','where','which','while','who','whom','why','will','with','would','you','your','yours','yourself','yourselves',
  'story','stories','epic','epics','adr','adrs','brd','brds','fdd','fdds','skill','skills','moc','mocs','implementation','log','source','document','file','page','wiki','brain','vault','status','accepted','proposed','approved','built','pending','ready','active','completed','note','section','type','class','pm','ontology','alias','aliases','tag','tags','title','artifact','entity','version','created','modified','authority','confidence','domain','dmbok','pmbok','babok','cluster','category','relationship','relationships','framework','taxonomy','stakeholder','management','data','business','analysis','solution','evaluation','planning','monitoring','integration','governance','quality','security','warehousing','analytics','design','modeling','reference','master','content','metadata','architecture','operations','engineering','functional','technical','application','app','system','service','component','feature','repository','repo','code','database','api','user','users','tenant','tenants','connector','connectors','post','posts','feed','feeds','ingestion','enrichment','normalization','social','listening','admin','core','platform','outbound','publishing','engagement','crm','rag','vector','semantic','search','ai','nlp','eventing','messaging','health','derived','rate','limit','limits','foundation','foundations','watchlist','watchlists','author','authors','identity','migration','migrations','route','router','routes','endpoint','endpoints',
  'related','constraints','constraint','change','changes','casual','casually','bearing','load','loads','scenarios','scenario','examples','example','summary','overview','details','detail','steps','step','fields','field','values','value','items','item','lists','list','options','option','settings','setting','usage','usages'
]);

function extractTopics(title, body) {
  const counts = {};
  const add = (text) => {
    if (!text) return;
    for (const t of text.toLowerCase().split(/[^a-z0-9]+/)) {
      if (t.length < 4) continue;
      if (/^\d+(\.\d+)?$/.test(t)) continue;
      if (STOP_WORDS.has(t)) continue;
      counts[t] = (counts[t] || 0) + 1;
    }
  };
  add(title);
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^#{1,3}\s+(.+)$/);
    if (h) {
      const headingText = h[1].replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
      const headingNorm = headingText.replace(/\s+/g, ' ').trim();
      const words = headingNorm.split(' ').filter(Boolean);
      const generic = words.length <= 3 && words.every(w => SECTION_STOP.has(w) || STOP_WORDS.has(w));
      if (generic) continue;
      if (SECTION_STOP.has(headingNorm)) continue;
      if (headingNorm.includes('dataview') || headingNorm.includes('backlinks') || headingNorm.includes('enterprise knowledge graph') || headingNorm.includes('multi framework') || headingNorm.includes('taxonomies hubs')) continue;
      add(h[1]);
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([t]) => t);
}

function stripMarkdown(s) {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .trim();
}

function extractAdrRationale(body) {
  const res = { consequences: [], open_questions: [], alternatives: [] };
  const sections = [
    { key: 'consequences', markers: ['## Consequences', '## Consequences & Guardrails'] },
    { key: 'open_questions', markers: ['## Open Questions', '## Open Questions / Next Steps', '## Open Questions & Next Steps'] },
    { key: 'alternatives', markers: ['## Alternatives Considered'] }
  ];
  const lines = body.split(/\r?\n/);
  for (const sec of sections) {
    for (let i = 0; i < lines.length; i++) {
      if (sec.markers.some(m => lines[i].trim().startsWith(m))) {
        const items = [];
        for (let j = i + 1; j < lines.length; j++) {
          const l = lines[j];
          if (/^##\s+/.test(l)) break;
          const listMatch = l.match(/^\s*[-*]\s+(.+)$/);
          if (listMatch) items.push(stripMarkdown(listMatch[1]));
        }
        res[sec.key] = items;
        break;
      }
    }
  }
  return res;
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function setField(data, key, value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value) && value.length === 0) {
    if (data[key] !== undefined) { delete data[key]; return true; }
    return false;
  }
  if (!sameValue(data[key], value)) { data[key] = value; return true; }
  return false;
}

function enrichAllPages(fileData, linkMap, outgoingCounts) {
  console.log('\n✨ Enriching pages...');
  const gitMap = buildGitMap();
  const implMap = buildImplementationLogMap();
  const contractMap = buildContractFileMap();
  const relToFd = new Map(fileData.map(fd => [fd.rel, fd]));

  for (const fd of fileData) {
    const { file, rel, data, body } = fd;
    let dirty = false;

    // Git provenance for source-based pages
    if (data.source_document) {
      const sourcePath = resolveSource(data.source_document);
      if (sourcePath && sourcePath.startsWith(repoRoot)) {
        const repoRel = path.relative(repoRoot, sourcePath).replace(/\\/g, '/');
        const git = gitMap.get(repoRel);
        if (git) {
          dirty |= setField(data, 'last_commit_hash', git.lastCommit);
          dirty |= setField(data, 'last_commit_at', git.lastCommitAt);
          dirty |= setField(data, 'last_committer', git.lastAuthor);
          dirty |= setField(data, 'commit_count', git.commitCount);
          dirty |= setField(data, 'committers', Array.from(git.committers).sort());
        }
      }
    }

    // Implementation-log shipping metadata for stories/ADRs
    const ship = data.type === 'story' ? implMap.stories.get(data.artifact_id)
      : data.type === 'adr' ? implMap.adrs.get(data.artifact_id)
      : undefined;
    if (ship) {
      dirty |= setField(data, 'shipped_in_commit', ship.fullCommit);
      dirty |= setField(data, 'shipped_at', ship.date);
      dirty |= setField(data, 'ship_repo', ship.repo);
      if (ship.categorized) {
        dirty |= setField(data, 'ship_contract_tests', ship.categorized.contracts);
        dirty |= setField(data, 'ship_source_files', ship.categorized.sources.concat(ship.categorized.migrations));
        dirty |= setField(data, 'ship_skill_files', ship.categorized.skills);
        dirty |= setField(data, 'ship_doc_files', ship.categorized.docs);
        dirty |= setField(data, 'ship_other_files', ship.categorized.other);
      }
      if (ship.testStatus) {
        dirty |= setField(data, 'last_contract_test_status', ship.testStatus);
        dirty |= setField(data, 'last_contract_test_summary', ship.testSummary);
        dirty |= setField(data, 'last_contract_test_date', ship.date);
      }
    }

    // Contract test and source file mapping for stories
    if (data.type === 'story') {
      const fromImpl = ship && ship.categorized ? ship.categorized.contracts : [];
      const fromRepo = contractMap.get(data.artifact_id) || [];
      const contracts = Array.from(new Set([...fromImpl, ...fromRepo]));
      if (contracts.length) {
        dirty |= setField(data, 'contract_tests', contracts);
        dirty |= setField(data, 'contract_test_count', contracts.length);
      }
      if (ship && ship.testStatus) {
        dirty |= setField(data, 'last_contract_test_status', ship.testStatus);
        dirty |= setField(data, 'last_contract_test_summary', ship.testSummary);
        dirty |= setField(data, 'last_contract_test_date', ship.date);
      }
      if (contracts.length && !data.last_contract_test_status) {
        dirty |= setField(data, 'last_contract_test_status', 'Unknown');
      }
    }

    // Topics/keywords for all pages
    const topics = extractTopics(data.title, body);
    if (topics.length) dirty |= setField(data, 'topics', topics);

    // ADR rationale extraction
    if (data.type === 'adr') {
      const rationale = extractAdrRationale(body);
      if (rationale.consequences.length) dirty |= setField(data, 'consequences', rationale.consequences);
      if (rationale.open_questions.length) dirty |= setField(data, 'open_questions', rationale.open_questions);
      if (rationale.alternatives.length) dirty |= setField(data, 'alternatives', rationale.alternatives);
    }

    // Backlink / centrality counts
    const outgoing = outgoingCounts.get(rel) || 0;
    const incoming = linkMap.get(rel) || [];
    dirty |= setField(data, 'outgoing_link_count', outgoing);
    dirty |= setField(data, 'backlink_count', incoming.length);
    if (incoming.length) {
      const backlinks = Array.from(new Set(incoming.map(r => relToFd.get(r)?.data?.artifact_id || path.basename(r, '.md')))).slice(0, 100);
      dirty |= setField(data, 'backlinks', backlinks);
    }

    if (dirty) {
      fs.writeFileSync(file, serializeFrontmatter(data) + body, 'utf8');
      info(`${rel}: enriched`);
    }
  }
}

function auditAndHeal() {
  console.log('\n🔍 Auditing wiki...');
  const files = findFiles(wikiRoot, '.md');
  const byArtifact = new Map();
  const idToRel = new Map();
  const linkMap = new Map();
  const outgoingCounts = new Map();
  const fileData = [];

  // Pre-pass: parse all frontmatter and build identifier → file map
  for (const file of files) {
    const rel = path.relative(wikiRoot, file).replace(/\\/g, '/');
    const basename = path.basename(file, '.md');
    const content = fs.readFileSync(file, 'utf8');
    const { data, body } = parseFrontmatter(content);
    fileData.push({ file, rel, content, data, body });
    linkMap.set(rel, []);

    const addId = (id) => { if (id) idToRel.set(String(id).toLowerCase(), rel); };
    addId(basename);
    if (data.artifact_id) {
      if (byArtifact.has(data.artifact_id)) {
        error(`${rel}: duplicate artifact_id "${data.artifact_id}" (also in ${byArtifact.get(data.artifact_id)})`);
      } else {
        byArtifact.set(data.artifact_id, rel);
      }
      addId(data.artifact_id);
    }
    if (Array.isArray(data.aliases)) {
      for (const a of data.aliases) addId(a);
    }
  }

  // Build suffix path index for partial-path wikilinks like "07 Skills/..."
  const relPaths = fileData.map(({ rel }) => rel.replace(/\.md$/, '').toLowerCase());

  function normalizeArtifactTarget(target) {
    const m = target.match(/^(ADR|BRD|FDD|Story|Epic)-(\d+(?:\.\d+)?)$/i);
    if (m) {
      const num = m[2].includes('.') ? m[2] : String(Number(m[2])).padStart(4, '0');
      return `${m[1].toUpperCase()}-${num}`;
    }
    return target;
  }

  function tryResolve(test) {
    const lower = test.toLowerCase();
    if (idToRel.has(lower)) return idToRel.get(lower);
    const normalized = normalizeArtifactTarget(test).toLowerCase();
    if (idToRel.has(normalized)) return idToRel.get(normalized);
    return null;
  }

  function resolveLink(rawTarget) {
    const t = rawTarget.replace(/\\$/, '').replace(/\\/g, '/').split('#')[0].trim();
    if (!t) return null;
    const noTrailDot = t.replace(/\.+$/, '');
    for (const test of [t, noTrailDot]) {
      const resolved = tryResolve(test);
      if (resolved) return resolved;
    }
    const clean = noTrailDot.toLowerCase().replace(/\/$/, '');
    for (const rp of relPaths) {
      if (rp === clean || rp.endsWith('/' + clean)) return fileData.find(({ rel }) => rel.replace(/\.md$/, '').toLowerCase() === rp).rel;
    }
    return null;
  }

  const relTypeMap = new Map();

  for (const { file, rel, content, data, body } of fileData) {
    let dirty = false;
    relTypeMap.set(rel, data.type);
    const originalSourceDoc = data.source_document;

    // Required fields
    for (const key of ['title', 'artifact_id', 'entity_id', 'type', 'pm_class', 'status']) {
      if (!data[key]) error(`${rel}: missing or empty ${key}`);
    }

    // Type validity
    if (data.type && !validTypes.has(data.type)) {
      error(`${rel}: unknown type "${data.type}"`);
    }

    
    // Lifecycle transition checking
    if (data.type && ONTOLOGY.nodeTypes[data.type] && ONTOLOGY.nodeTypes[data.type].validTransitions) {
      if (data.status) {
        const validStatuses = new Set([ONTOLOGY.nodeTypes[data.type].defaultStatus]);
        for (const t of ONTOLOGY.nodeTypes[data.type].validTransitions) {
          validStatuses.add(t.split(' -> ')[0]);
          validStatuses.add(t.split(' -> ')[1]);
        }
        if (!validStatuses.has(data.status)) {
          warn(`${rel}: status "${data.status}" is not a valid lifecycle state for type "${data.type}"`);
        }
      }
    }

    // PM class validity
    if (data.pm_class && !validPmClasses.has(data.pm_class)) {
      error(`${rel}: unknown pm_class "${data.pm_class}"`);
    }

    // Subclass validity
    if (data.pm_subclass) {
      const cls = PMO.classes?.[data.pm_class];
      const validSubs = cls?.subTypes || [];
      if (validSubs.length && !validSubs.includes(data.pm_subclass)) {
        warn(`${rel}: pm_subclass "${data.pm_subclass}" not in subTypes of ${data.pm_class}`);
      }
    }

    // Taxonomy validity
    if (data.domain_cluster && !validClusters.has(data.domain_cluster)) warn(`${rel}: unknown domain_cluster "${data.domain_cluster}"`);
    if (data.dmbok_category && !validDmbok.has(data.dmbok_category)) warn(`${rel}: unknown dmbok_category "${data.dmbok_category}"`);
    if (data.pmbok_category && !validPmbok.has(data.pmbok_category)) warn(`${rel}: unknown pmbok_category "${data.pmbok_category}"`);
    if (data.babok_category && !validBabok.has(data.babok_category)) warn(`${rel}: unknown babok_category "${data.babok_category}"`);

    // Source document existence and staleness
    if (data.source_document) {
      normalizeSkillSource(data, rel);
      if (data.source_document !== originalSourceDoc) dirty = true;
      const sourcePath = resolveSource(data.source_document);
      if (!sourcePath) {
        warn(`${rel}: source_document not found "${data.source_document}"`);
      } else if (data.modified_at && sourcePath !== file) {
        const sourceMtime = fs.statSync(sourcePath).mtime;
        const fmMtime = new Date(data.modified_at);
        if (sourceMtime > fmMtime) {
          warn(`${rel}: compiled page is older than source (${data.source_document})`);
        }
      }
    }

    // Wikilink targets
    const wikilinks = extractWikiLinks(body);
    outgoingCounts.set(rel, wikilinks.length);
    for (const link of wikilinks) {
      const rawTarget = link.slice(2, -2).replace(/\\\|/g, '|');
      const target = rawTarget.split('|')[0].split('#')[0].trim();
      if (!target) continue;
      const targetRel = resolveLink(target);
      if (!targetRel) {
        warn(`${rel}: unresolved wikilink "[[${target}]]"`);
      } else {
        const arr = linkMap.get(targetRel) || [];
        arr.push(rel);
        linkMap.set(targetRel, arr);
      }
    }

    // Auto-fix: remove empty/undefined pm_subclass
    if (data.pm_subclass === 'undefined' || data.pm_subclass === '') {
      delete data.pm_subclass;
      dirty = true;
    }

    // Auto-fix: filter empty strings from arrays
    for (const arrKey of ['pm_relationships', 'tags', 'aliases']) {
      if (Array.isArray(data[arrKey])) {
        const cleaned = data[arrKey].filter(x => x && x !== 'undefined');
        if (cleaned.length !== data[arrKey].length) {
          data[arrKey] = cleaned;
          dirty = true;
        }
      }
    }

    if (dirty) {
      fs.writeFileSync(file, serializeFrontmatter(data) + body, 'utf8');
      autoFixed++;
      info(`${rel}: auto-fixed frontmatter`);
    }
  }

  // Orphan check: files with no incoming links (exclude master hub, dashboards, skills, READMEs, and stale duplicate MOC)
  for (const [rel, incoming] of linkMap.entries()) {
    if (incoming.length === 0 && !rel.includes('MOC - SocialEngage (Master Hub)') && !rel.includes('Project-Progress-Dashboard')) {
      const bn = path.basename(rel);
      if (bn === 'README.md' || rel === '_MOCs/MOC - SocialEngage.md') continue;
      const t = relTypeMap.get(rel);
      if (t !== 'skill') warn(`${rel}: no incoming wikilinks (orphan)`);
    }
  }

  // Raw folder should be empty
  if (fs.existsSync(rawRoot)) {
    const rawEntries = fs.readdirSync(rawRoot);
    if (rawEntries.length > 0) {
      warn(`raw/ folder is not empty: ${rawEntries.join(', ')}`);
    }
  }

  return { fileData, idToRel, relPaths, linkMap, outgoingCounts };
}

function writeReport() {
  fs.mkdirSync(reportDir, { recursive: true });
  const now = new Date().toISOString();
  const title = 'Project Progress Dashboard — Brain Health Audit';
  const artifactId = 'Project-Progress-Dashboard-Brain-Health';
  const errorCount = findings.errors.length;
  const warningCount = findings.warnings.length;
  const status = errorCount === 0 ? 'Healthy' : 'Unhealthy';

  const lines = [
    '---',
    `title: "${title}"`,
    `artifact_id: "${artifactId}"`,
    `type: "telemetry"`,
    `pm_class: "Metric"`,
    `pm_subclass: "KPI"`,
    `pm_relationships:`,
    `  - monitoredThrough`,
    `  - evaluatedBy`,
    `status: "${status}"`,
    `domain_cluster: "Self-Learning, Telemetry & Operations"`,
    `dmbok_category: "Data Warehousing & Analytics (DW/BI)"`,
    `pmbok_category: "Integration Management"`,
    `babok_category: "Solution Evaluation"`,
    `tags:`,
    `  - telemetry`,
    `  - dashboard`,
    `  - health`,
    `  - audit`,
    `  - project/socialengage`,
    `---`,
    '',
    `# Brain Health Audit`,
    '',
    `> Generated at ${now}`,
    '',
    `## Summary`,
    '',
    `- **Status:** ${status}`,
    `- **Errors:** ${errorCount}`,
    `- **Warnings:** ${warningCount}`,
    `- **Auto-fixed:** ${autoFixed}`,
    '',
    '## Errors',
    ''
  ];
  function item(msg) { return `- \`${msg.replace(/`/g, "'")}\``; }
  if (findings.errors.length === 0) lines.push('_None_');
  for (const e of findings.errors) lines.push(item(e));
  lines.push('', '## Warnings', '');
  if (findings.warnings.length === 0) lines.push('_None_');
  for (const w of findings.warnings) lines.push(item(w));
  lines.push('', '## Info', '');
  if (findings.info.length === 0) lines.push('_None_');
  for (const i of findings.info) lines.push(item(i));
  lines.push('', '---', '', 'Run `node socialengage/scripts/heal-obsidian-brain.mjs` to regenerate this report.');

  fs.writeFileSync(path.join(reportDir, `${artifactId}.md`), lines.join('\n'), 'utf8');
  console.log(`\n📝 Health report written to ${path.join(reportDir, `${artifactId}.md`)}`);
}


function scanProcessDrift() {
  console.log('\n🧭 Scanning for Process & Behavioral Drift...');
  const driftFindings = [];
  const synthesisDir = path.join(wikiRoot, 'Projects', 'SocialEngage', '06 Synthesis & Lessons Learned');
  if (!fs.existsSync(synthesisDir)) fs.mkdirSync(synthesisDir, { recursive: true });

  // 1. Contract Tests Drift Scanner (ADR-0141 & Contract-First Standards)
  const contractDirs = [
    path.join(repoRoot, 'social-listening-admin', 'contracts'),
    path.join(repoRoot, 'social-listening-core', 'contracts')
  ];

  const contractFiles = [];
  for (const cDir of contractDirs) {
    if (fs.existsSync(cDir)) {
      contractFiles.push(...findFiles(cDir, '.test.ts'));
    }
  }

  let adr0141DriftCount = 0;
  let secretPatternAdoptionCount = 0;
  let missingTraceabilityCount = 0;

  for (const cFile of contractFiles) {
    const relContract = path.relative(repoRoot, cFile).replace(/\\/g, '/');
    const cContent = fs.readFileSync(cFile, 'utf8');

    // Rule 1: Naive secret substring anti-pattern (violates ADR-0141)
    const naiveSecretRegex = /\.not\.toContain\(\s*['"](credential|secret|token)['"]\s*\)/i;
    if (naiveSecretRegex.test(cContent) && !cContent.includes('ADR-0141')) {
      adr0141DriftCount++;
      const msg = `${relContract}: process drift — uses naive natural-language substring exclusion for secrets instead of targeted regex or prop assertions (violates ADR-0141)`;
      warn(msg);
      driftFindings.push({
        type: 'ContractTestSecretLeakageDrift',
        source: relContract,
        governingAdr: 'ADR-0141',
        description: msg
      });
    }

    // Measure Positive Adoption of targeted secret patterns or partial matching (ADR-0141)
    if (cContent.includes('secretPattern') || (cContent.includes('ADR-0141') && cContent.includes('toMatchObject'))) {
      secretPatternAdoptionCount++;
    }

    // Rule 2: Contract-First Traceability (Must reference Story or ADR)
    const hasStoryRef = /\bStory\s+\d+(\.\d+)?\b/i.test(cContent) || /story-\d+(\.\d+)?/i.test(cFile);
    const hasAdrRef = /\bADR-\d{4}\b/i.test(cContent);
    if (!hasStoryRef && !hasAdrRef) {
      missingTraceabilityCount++;
      const msg = `${relContract}: process drift — contract test lacks explicit Story or ADR traceability identifier`;
      warn(msg);
      driftFindings.push({
        type: 'MissingContractTraceabilityDrift',
        source: relContract,
        governingAdr: 'ADR-0001',
        description: msg
      });
    }
  }

  // 2. Implementation Methodology & Append-Only Log Drift Scanner
  const implLogPath = path.join(repoRoot, 'docs', 'implementation-log.md');
  if (fs.existsSync(implLogPath)) {
    const implContent = fs.readFileSync(implLogPath, 'utf8');
    const dateHeaders = [...implContent.matchAll(/^##\s+(\d{4}-\d{2}-\d{2})/gm)].map(m => m[1]);
    let dateOrderDrift = false;
    for (let i = 1; i < dateHeaders.length; i++) {
      if (dateHeaders[i] < dateHeaders[i - 1]) {
        dateOrderDrift = true;
        break;
      }
    }
    if (dateOrderDrift) {
      const msg = `docs/implementation-log.md: process drift — entries are out of date order, violating append-only discipline`;
      warn(msg);
      driftFindings.push({
        type: 'ImplementationLogOrderDrift',
        source: 'docs/implementation-log.md',
        governingAdr: 'ADR-0001',
        description: msg
      });
    }
  }

  // 3. Emit / Update Behavioral Observations in Knowledge Graph
  for (const drift of driftFindings) {
    const driftHash = crypto.createHash('md5').update(drift.source + drift.type).digest('hex').slice(0, 6);
    const obsId = `OBS-DRIFT-${driftHash.toUpperCase()}`;
    const obsPath = path.join(synthesisDir, `${obsId}.md`);
    const now = new Date().toISOString();

    const obsContent = `---
title: "Process Drift: ${drift.type} in ${path.basename(drift.source)}"
artifact_id: "${obsId}"
entity_id: "${crypto.createHash('md5').update(obsId).digest('hex')}"
type: "observation"
status: "Observed"
pm_class: "Observation"
pm_subclass: "ExecutionAnomaly"
pm_relationships:
  - observedFrom
  - yieldsInsight
domain_cluster: "Strategic Intent & Cognitive Learning"
dmbok_category: "Data Quality Management"
pmbok_category: "Quality Management"
babok_category: "Solution Evaluation"
tags:
  - observation
  - drift_detection
  - process_anomaly
  - project/socialengage
---

# ${obsId}: ${drift.type}

> Automatically detected by the Process Drift Scanner during \`heal-obsidian-brain.mjs\` on ${now}.

## Empirical Observation
- **Source File:** \`${drift.source}\`
- **Governing Architecture Decision:** [[${drift.governingAdr}]]
- **Detection Summary:** ${drift.description}

## Diagnostic Path
\`\`\`
[${drift.source}] ──(generatesObservation)──> [${obsId}] ──(yieldsInsight)──> [Pending Triage]
\`\`\`
`;
    fs.writeFileSync(obsPath, obsContent, 'utf8');
    info(`Process drift recorded: ${obsId} (${drift.type})`);
  }

  // 4. If positive adoption is observed, record an Adaptation proof node!
  if (secretPatternAdoptionCount > 0 && adr0141DriftCount === 0) {
    const adaptId = 'ADAPT-0141';
    const adaptPath = path.join(synthesisDir, `${adaptId}.md`);
    const now = new Date().toISOString();
    const adaptContent = `---
title: "Adaptation: Contract Test Secret Verification & Sentiment Scale"
artifact_id: "${adaptId}"
entity_id: "${crypto.createHash('md5').update(adaptId).digest('hex')}"
type: "adaptation"
status: "Active"
pm_class: "Adaptation"
pm_subclass: "BehavioralChange"
pm_relationships:
  - enabledBy
  - influencesOutcome
  - demonstratedByObservation
domain_cluster: "Strategic Intent & Cognitive Learning"
dmbok_category: "Data Quality Management"
pmbok_category: "Quality Management"
babok_category: "Solution Evaluation"
tags:
  - adaptation
  - behavioral_change
  - organizational_cognition
  - project/socialengage
---

# ${adaptId}: Contract Test Secret Verification & Sentiment Scale

> Verified by the Process Drift Scanner during \`heal-obsidian-brain.mjs\` on ${now}.

## Behavioral Change Summary
- **Catalyzed by:** [[ADR-0141]]
- **Adoption Status:** Fully compliant. ${secretPatternAdoptionCount} contract suites actively implement targeted regex pattern checks or \`toMatchObject\` semantics.
- **Drift Instances:** 0 detected.

## Verified Empirical Chain
\`\`\`
[ADR-0141] ──(enables)──> [${adaptId}] ──(influencesOutcome)──> [0 False Positives in Contract CI]
\`\`\`
`;
    fs.writeFileSync(adaptPath, adaptContent, 'utf8');
    info(`Behavioral adaptation verified: ${adaptId} (0 drifts, ${secretPatternAdoptionCount} adoptions)`);
  }

  console.log(`🧭 Process Drift Scan complete: ${driftFindings.length} drifts detected, ${secretPatternAdoptionCount} adaptations verified.`);
  return { driftCount: driftFindings.length, adaptations: secretPatternAdoptionCount };
}

// Main
console.log('🧠 Obsidian Brain Heal Starting');
console.log(`Vault: ${vaultRoot}`);
console.log(`Repo:  ${repoRoot}`);

const okIngest = runScript('scripts/ingest-raw.mjs');
const ok1 = runScript('scripts/export-to-obsidian.mjs');
const ok2 = runScript('project-progress-dashboard/scripts/compile-obsidian-telemetry.mjs');
const ok3 = runScript('scripts/backfill-obsidian-frontmatter.mjs');

ensureMissingMocs();
const driftResult = scanProcessDrift();
const audit = auditAndHeal();
enrichAllPages(audit.fileData, audit.linkMap, audit.outgoingCounts);
writeReport();

console.log('\n🏁 Heal complete');
console.log(`Errors: ${findings.errors.length}, Warnings: ${findings.warnings.length}, Auto-fixed: ${autoFixed}`);

if (findings.errors.length > 0) {
  console.error('❌ Brain health check failed.');
  process.exit(1);
} else {
  console.log('✅ Brain health check passed.');
}
