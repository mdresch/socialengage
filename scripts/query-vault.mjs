import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const defaultVaultPath = 'C:\\Users\\MennoDrescher\\source\\repos\\Obsidian Brain';
const args = process.argv.slice(2);
const command = args[0] || '--help';
let param = args[1] || '';
let vaultPath = defaultVaultPath;

// If second arg is a path
if (param && (param.includes('\\') || param.includes('/'))) {
  vaultPath = param;
  param = '';
}

console.log('📊 Second Brain Knowledge Query & Report Generator');
console.log('Vault Root: ', vaultPath);

function loadVaultFiles() {
  const files = [];
  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        scan(full);
      } else if (f.endsWith('.md')) {
        const content = fs.readFileSync(full, 'utf8');
        files.push({ name: f, fullPath: full, content });
      }
    });
  }
  scan(path.join(vaultPath, 'wiki'));
  return files;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const meta = {};
  const lines = match[1].split('\n');
  lines.forEach(l => {
    const parts = l.split(':');
    if (parts.length >= 2) {
      const k = parts[0].trim();
      const v = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
      meta[k] = v;
    }
  });
  return meta;
}

const allFiles = loadVaultFiles();
const parsedNotes = allFiles.map(f => ({
  ...f,
  meta: parseFrontmatter(f.content),
}));

switch (command) {
  case '--dmbok':
  case 'dmbok': {
    console.log('\n☸️ DAMA-DMBOK Knowledge Areas Report\n');
    const grouped = {};
    parsedNotes.forEach(n => {
      const cat = n.meta.dmbok_category || 'Uncategorized';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(n);
    });

    Object.entries(grouped).sort().forEach(([cat, notes]) => {
      console.log(`📌 ${cat.toUpperCase()} (${notes.length} artifacts)`);
      notes.slice(0, 5).forEach(note => {
        console.log(`   • ${note.meta.artifact_id || note.name.replace('.md', '')}: ${note.meta.title || ''}`);
      });
      if (notes.length > 5) console.log(`   ... and ${notes.length - 5} more`);
      console.log('');
    });
    break;
  }

  case '--pmbok':
  case 'pmbok': {
    console.log('\n📊 PMI-PMBOK Knowledge Areas Report\n');
    const grouped = {};
    parsedNotes.forEach(n => {
      const cat = n.meta.pmbok_category || 'Uncategorized';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(n);
    });

    Object.entries(grouped).sort().forEach(([cat, notes]) => {
      console.log(`📌 ${cat.toUpperCase()} (${notes.length} artifacts)`);
      notes.slice(0, 4).forEach(note => {
        console.log(`   • ${note.meta.artifact_id || note.name.replace('.md', '')}: ${note.meta.domain_cluster || ''}`);
      });
      if (notes.length > 4) console.log(`   ... and ${notes.length - 4} more`);
      console.log('');
    });
    break;
  }

  case '--babok':
  case 'babok': {
    console.log('\n📐 IIBA-BABOK Knowledge Areas Report\n');
    const grouped = {};
    parsedNotes.forEach(n => {
      const cat = n.meta.babok_category || 'Uncategorized';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(n);
    });

    Object.entries(grouped).sort().forEach(([cat, notes]) => {
      console.log(`📌 ${cat.toUpperCase()} (${notes.length} artifacts)`);
      notes.slice(0, 4).forEach(note => {
        console.log(`   • ${note.meta.artifact_id || note.name.replace('.md', '')}`);
      });
      if (notes.length > 4) console.log(`   ... and ${notes.length - 4} more`);
      console.log('');
    });
    break;
  }

  case '--blast-radius':
  case 'blast-radius': {
    const targetId = param || 'ADR-0028';
    console.log(`\n💥 Blast Radius & Dependency Impact for ${targetId}:\n`);
    const referencing = parsedNotes.filter(n => n.content.includes(targetId) && !n.name.includes(targetId));
    console.log(`Found ${referencing.length} downstream connected documents:\n`);
    referencing.forEach(r => {
      console.log(`   • [${r.meta.type || 'Doc'}] ${r.meta.artifact_id || r.name.replace('.md', '')} → ${r.meta.domain_cluster || ''}`);
    });
    break;
  }

  case '--pending':
  case 'pending': {
    console.log('\n⏳ Pending / Unbuilt Requirements Backlog:\n');
    const pending = parsedNotes.filter(n => n.meta.type === 'brd' && n.meta.rtm_coverage_status && !n.meta.rtm_coverage_status.includes('100%'));
    console.log(`Total Pending BRDs: ${pending.length}\n`);
    pending.forEach(p => {
      console.log(`   • ${p.meta.artifact_id}: ${p.meta.title} (${p.meta.domain_cluster})`);
    });
    break;
  }

  case '--rtm':
  case 'rtm': {
    console.log('\n🎯 Requirements Traceability Matrix Summary:\n');
    const brds = parsedNotes.filter(n => n.meta.type === 'brd');
    console.log(`Total Evaluated BRDs: ${brds.length}\n`);
    brds.slice(0, 15).forEach(b => {
      console.log(`   • ${b.meta.artifact_id.padEnd(10)} | ${b.meta.rtm_coverage_status || 'Mapped'}`);
    });
    console.log(`\n   (View full interactive matrix in Obsidian at wiki/_MOCs/MOC - Complete Traceability Matrix (ADR - BRD - FDD - Story).md)`);
    break;
  }

  default: {
    console.log(`
Available Commands:
  node scripts/query-vault.mjs --dmbok          Generate DAMA-DMBOK classification report
  node scripts/query-vault.mjs --pmbok          Generate PMI-PMBOK classification report
  node scripts/query-vault.mjs --babok          Generate IIBA-BABOK classification report
  node scripts/query-vault.mjs --blast-radius <ID>  Analyze change impact of an ADR (e.g. ADR-0028)
  node scripts/query-vault.mjs --pending        List all unbuilt/backlog requirements
  node scripts/query-vault.mjs --rtm            Show high-level Requirements Traceability status
`);
    break;
  }
}
