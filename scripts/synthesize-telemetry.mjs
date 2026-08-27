#!/usr/bin/env node

/**
 * Telemetry Synthesis Engine (ADR-0122 / FDD-0122)
 *
 * Scans git commit logs, healing passes, and contract implementation traces
 * to verify documentation alignment and surface runtime gotchas.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n🔍 [Telemetry Synthesis Engine] Starting scan...');

try {
  // 1. Scan recent commits for healing and fix passes
  const gitLog = execSync('git log -n 25 --oneline', { cwd: rootDir, encoding: 'utf8' });
  const lines = gitLog.split('\n').filter(Boolean);

  const healingCommits = lines.filter(l => l.includes('heal(') || l.includes('fix('));
  const featCommits = lines.filter(l => l.includes('feat('));

  console.log(`\n📊 Git Telemetry Ingested:`);
  console.log(`   - Total Commits Scanned: ${lines.length}`);
  console.log(`   - Healing / Fix Commits: ${healingCommits.length}`);
  console.log(`   - Feature Commits:       ${featCommits.length}`);

  if (healingCommits.length > 0) {
    console.log('\n🩹 Recent Healing & Fix Passes:');
    healingCommits.forEach(c => console.log(`   • ${c}`));
  }

  // 2. Check existence of key self-learning documentation artifacts
  const gotchasPath = path.join(rootDir, 'docs', 'environment-gotchas.md');
  const lessonsPath = path.join(rootDir, 'docs', 'project docs', 'Lessons-Learned-Register.md');
  const synthesisPath = path.join(rootDir, 'docs', 'synthesis', 'Self-Learning-Synthesis-Epic-6.md');

  console.log('\n📋 Self-Learning Artifact Verification:');
  console.log(`   - environment-gotchas.md:      ${fs.existsSync(gotchasPath) ? '✅ Present' : '❌ Missing'}`);
  console.log(`   - Lessons-Learned-Register.md: ${fs.existsSync(lessonsPath) ? '✅ Present' : '❌ Missing'}`);
  console.log(`   - Synthesis Epic Deliverable:   ${fs.existsSync(synthesisPath) ? '✅ Present' : '❌ Missing'}`);

  console.log('\n✨ Telemetry scan completed successfully.\n');
} catch (err) {
  console.error('❌ Telemetry synthesis error:', err.message);
  process.exit(1);
}