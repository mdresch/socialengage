#!/usr/bin/env node
'use strict';

/**
 * Project Health Measurement Script
 * 
 * Generates a comprehensive health report for the Spark Capture project
 * by analyzing git history, implementation log, contract test results,
 * and other project artifacts.
 * 
 * Usage:
 *   node measure-project-health.cjs [--output FILE] [--format markdown|json]
 *   node measure-project-health.cjs --verify  # Verify only, no output
 *   node measure-project-health.cjs --ci      # CI mode (exit code on failures)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = process.cwd();

// Configuration
const CONFIG = {
  implementationLogPath: path.join(REPO_ROOT, 'docs', 'implementation-log.md'),
  implementationPlanPath: path.join(REPO_ROOT, 'docs', 'implementation-plan.md'),
  adrDir: path.join(REPO_ROOT, 'docs', 'adr'),
  userStoriesDir: path.join(REPO_ROOT, 'docs', 'user-stories'),
  contractsGlob: path.join(REPO_ROOT, 'social-listening-core', 'contracts', '**', '*.contract.test.ts'),
  coreDir: path.join(REPO_ROOT, 'social-listening-core'),
  adminDir: path.join(REPO_ROOT, 'social-listening-admin'),
};

/**
 * Execute a shell command and return output
 */
function sh(cmd, options = {}) {
  try {
    return execSync(cmd, { 
      cwd: options.cwd || REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
  } catch (e) {
    return e.stdout?.trim() || e.message;
  }
}

/**
 * Parse implementation log entries
 */
function parseImplementationLog(logPath) {
  if (!fs.existsSync(logPath)) {
    return { entries: [], count: 0 };
  }
  
  const content = fs.readFileSync(logPath, 'utf8');
  const entryBlocks = content.split(/^## \d{4}-\d{2}-\d{2}/m).slice(1);
  
  const entries = entryBlocks.map(block => {
    const field = (label) => {
      const m = block.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*[`"'`]([^`"'\n]+)[`"']`));
      if (m) return m[1].trim();
      const m2 = block.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\n]+)`));
      return m2 ? m2[1].trim() : null;
    };
    
    return {
      header: block.split('\n')[0].trim(),
      date: field('Date') || block.split('\n')[0].replace('## ', '').trim(),
      story: field('Story / ADR'),
      repo: field('Repo'),
      commit: field('Full commit'),
      contract: field('Contract'),
      skillMd: field('SKILL.md'),
      filesTouched: field('Files touched'),
      suiteStatus: field('Full suite at merge')
    };
  }).filter(e => e.story);
  
  return { entries, count: entries.length };
}

/**
 * Count ADRs by status
 */
function countADRs(adrDir) {
  if (!fs.existsSync(adrDir)) {
    return { total: 0, accepted: 0, proposed: 0, rejected: 0 };
  }
  
  const files = fs.readdirSync(adrDir).filter(f => f.endsWith('.md') && f.match(/^\d{4}-/));
  const counts = { total: files.length, accepted: 0, proposed: 0, rejected: 0 };
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(adrDir, file), 'utf8');
    if (content.includes('Status: Accepted') || content.includes('Accepted:')) {
      counts.accepted++;
    } else if (content.includes('Status: Proposed') || content.includes('Proposed:')) {
      counts.proposed++;
    } else if (content.includes('Status: Rejected') || content.includes('Rejected:')) {
      counts.rejected++;
    }
  });
  
  return counts;
}

/**
 * Count stories by epic
 */
function countStories(userStoriesDir) {
  if (!fs.existsSync(userStoriesDir)) {
    return { total: 0, epics: {} };
  }
  
  const files = fs.readdirSync(userStoriesDir).filter(f => f.endsWith('.md') && f !== 'README.md');
  const epics = {};
  let total = 0;
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(userStoriesDir, file), 'utf8');
    const storyMatches = content.match(/## \d+\.\d+/g) || [];
    const epicName = file.replace('.md', '');
    epics[epicName] = storyMatches.length;
    total += storyMatches.length;
  });
  
  return { total, epics };
}

/**
 * Run tests and get results
 */
function runTests() {
  try {
    const output = sh('cd social-listening-core && npm test -- --silent 2>&1', {
      cwd: REPO_ROOT
    });
    
    const passMatch = output.match(/Tests:\s+(\d+)\s+passed/);
    const failMatch = output.match(/Tests:\s+(\d+)\s+failed/);
    const totalMatch = output.match(/(\d+)\s+total/);
    
    return {
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0,
      total: totalMatch ? parseInt(totalMatch[1]) : 0,
      passRate: passMatch && totalMatch ? 
        Math.round((parseInt(passMatch[1]) / parseInt(totalMatch[1])) * 100) : 0
    };
  } catch (e) {
    return { passed: 0, failed: 0, total: 0, passRate: 0 };
  }
}

/**
 * Get git metrics
 */
function getGitMetrics() {
  try {
    const commitCount = sh('git rev-list --count HEAD');
    const authorCount = sh('git shortlog -s -n | wc -l').trim();
    const lastCommit = sh('git log -1 --pretty=format:"%h - %an, %ar : %s"');
    const branchCount = sh('git branch -a | wc -l').trim();
    
    return {
      commitCount: parseInt(commitCount) || 0,
      authorCount: parseInt(authorCount) || 0,
      lastCommit,
      branchCount: parseInt(branchCount) || 0
    };
  } catch (e) {
    return {
      commitCount: 0,
      authorCount: 0,
      lastCommit: 'Unknown',
      branchCount: 0
    };
  }
}

/**
 * Check file counts
 */
function getFileMetrics() {
  try {
    const coreFiles = sh('find social-listening-core/src -name "*.ts" | wc -l').trim();
    const adminFiles = sh('find social-listening-admin/src -name "*.ts*" | wc -l').trim();
    const contractFiles = sh('find social-listening-core/contracts -name "*.contract.test.ts" | wc -l').trim();
    const skillFiles = sh('find social-listening-core/.claude/skills -name "SKILL.md" | wc -l').trim();
    
    return {
      coreFiles: parseInt(coreFiles) || 0,
      adminFiles: parseInt(adminFiles) || 0,
      contractFiles: parseInt(contractFiles) || 0,
      skillFiles: parseInt(skillFiles) || 0
    };
  } catch (e) {
    return {
      coreFiles: 0,
      adminFiles: 0,
      contractFiles: 0,
      skillFiles: 0
    };
  }
}

/**
 * Calculate phase completion
 */
function calculatePhaseCompletion(planPath) {
  if (!fs.existsSync(planPath)) {
    return { phases: {}, total: 0, complete: 0 };
  }
  
  const content = fs.readFileSync(planPath, 'utf8');
  const phaseMatches = content.match(/^## Phase \d+/gm) || [];
  
  const phases = {};
  let completeCount = 0;
  
  phaseMatches.forEach(phaseHeader => {
    const phaseNum = phaseHeader.match(/Phase (\d+)/)[1];
    const phaseSection = content.substring(
      content.indexOf(phaseHeader),
      content.indexOf(phaseMatches.findIndex(p => p.includes(`Phase ${parseInt(phaseNum) + 1}`)) >= 0 
        ? content.indexOf(phaseMatches[phaseMatches.indexOf(phaseHeader) + 1])
        : content.length
    );
    
    // Check for completion indicators
    const isComplete = phaseSection.includes('✅ Complete') || 
                       phaseSection.includes('Complete') ||
                       !phaseSection.includes('⏳') && !phaseSection.includes('⚠️');
    
    phases[`Phase ${phaseNum}`] = isComplete;
    if (isComplete) completeCount++;
  });
  
  return {
    phases,
    total: Object.keys(phases).length,
    complete: completeCount,
    completionRate: Math.round((completeCount / Object.keys(phases).length) * 100)
  };
}

/**
 * Get Business Case milestone status
 */
function getMilestoneStatus() {
  try {
    const businessCasePath = path.join(REPO_ROOT, 'docs', 'project docs', 'Business-Case-v6.0.md');
    if (!fs.existsSync(businessCasePath)) {
      return { milestones: {}, total: 0, met: 0 };
    }
    
    const content = fs.readFileSync(businessCasePath, 'utf8');
    const milestoneSection = content.substring(
      content.indexOf('## 8.'),
      content.indexOf('## 9.')
    );
    
    // Count Met/Not Met
    const metCount = (milestoneSection.match(/\|\s*Met\s*\|/g) || []).length;
    const notMetCount = (milestoneSection.match(/\|\s*Not Met\s*\|/g) || []).length;
    
    return {
      total: metCount + notMetCount,
      met: metCount,
      notMet: notMetCount,
      completionRate: Math.round((metCount / (metCount + notMetCount)) * 100)
    };
  } catch (e) {
    return { milestones: {}, total: 0, met: 0 };
  }
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(metrics) {
  const lines = [];
  
  lines.push('# Project Health Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Project:** Spark Capture (Social Listening / Insights Subsystem)`);
  lines.push('');
  
  // Executive Summary
  lines.push('## 📊 Executive Summary');
  lines.push('');
  lines.push('| Category | Value | Status |');
  lines.push('|----------|-------|--------|');
  lines.push(`| **Overall Health Score** | ${metrics.healthScore}/10 | ${metrics.healthScore >= 8 ? '✅ Healthy' : metrics.healthScore >= 5 ? '⚠️ Needs Attention' : '❌ At Risk'} |`);
  lines.push('');
  
  // Progress Metrics
  lines.push('## 📈 Progress Metrics');
  lines.push('');
  lines.push('| Metric | Value | Target | Status |');
  lines.push('|--------|-------|--------|--------|');
  lines.push(`| Implementation Log Entries | ${metrics.implementationLog.count} | ≥26 | ${metrics.implementationLog.count >= 26 ? '✅' : '❌'} |`);
  lines.push(`| Stories Implemented | ${metrics.stories.total} | 26 | ${metrics.stories.total >= 26 ? '✅' : '❌'} |`);
  lines.push(`| ADRs Accepted | ${metrics.adrs.accepted} | 26 | ${metrics.adrs.accepted >= 26 ? '✅' : '❌'} |`);
  lines.push(`| Phases Complete | ${metrics.phaseCompletion.complete}/${metrics.phaseCompletion.total} | 6 | ${metrics.phaseCompletion.complete >= 1 ? '⚠️' : '❌'} |`);
  lines.push(`| Milestones Met | ${metrics.milestones.met}/${metrics.milestones.total} | 7 | ${metrics.milestones.met >= 2 ? '⚠️' : '❌'} |`);
  lines.push('');
  
  // Quality Metrics
  lines.push('## 🎯 Quality Metrics');
  lines.push('');
  lines.push('| Metric | Value | Target | Status |');
  lines.push('|--------|-------|--------|--------|');
  lines.push(`| Contract Pass Rate | ${metrics.tests.passRate}% | 100% | ${metrics.tests.passRate === 100 ? '✅' : '❌'} |`);
  lines.push(`| Tests Passing | ${metrics.tests.passed}/${metrics.tests.total} | All | ${metrics.tests.failed === 0 ? '✅' : '❌'} |`);
  lines.push(`| TypeScript Check | ${metrics.typeCheck.pass ? '✅ Pass' : '❌ Fail'} | Pass | ${metrics.typeCheck.pass ? '✅' : '❌'} |`);
  lines.push(`| Lint Check | ${metrics.lint.pass ? '✅ Pass' : '❌ Fail'} | Pass | ${metrics.lint.pass ? '✅' : '❌'} |`);
  lines.push('');
  
  // Code Metrics
  lines.push('## 💻 Code Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Core Source Files | ${metrics.files.coreFiles} |`);
  lines.push(`| Admin Source Files | ${metrics.files.adminFiles} |`);
  lines.push(`| Contract Test Files | ${metrics.files.contractFiles} |`);
  lines.push(`| Component SKILL.md Files | ${metrics.files.skillFiles} |`);
  lines.push('');
  
  // Git Metrics
  lines.push('## 🌱 Git Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Commits | ${metrics.git.commitCount} |`);
  lines.push(`| Contributors | ${metrics.git.authorCount} |`);
  lines.push(`| Branches | ${metrics.git.branchCount} |`);
  lines.push(`| Last Commit | ${metrics.git.lastCommit} |`);
  lines.push('');
  
  // Phase Breakdown
  lines.push('## 📋 Phase Completion Breakdown');
  lines.push('');
  lines.push('| Phase | Status |');
  lines.push('|-------|--------|');
  Object.entries(metrics.phaseCompletion.phases).forEach(([phase, isComplete]) => {
    lines.push(`| ${phase} | ${isComplete ? '✅ Complete' : '⏳ In Progress'} |`);
  });
  lines.push('');
  
  // ADR Status
  lines.push('## 🏗️ ADR Status');
  lines.push('');
  lines.push('| Status | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Accepted | ${metrics.adrs.accepted} |`);
  lines.push(`| Proposed | ${metrics.adrs.proposed} |`);
  lines.push(`| Rejected | ${metrics.adrs.rejected} |`);
  lines.push(`| **Total** | **${metrics.adrs.total}** |`);
  lines.push('');
  
  // Milestone Status
  if (metrics.milestones.total > 0) {
    lines.push('## 🎯 Business Case Milestone Status');
    lines.push('');
    lines.push(`**${metrics.milestones.met}/${metrics.milestones.total} milestones met (${metrics.milestones.completionRate}%)**`);
    lines.push('');
  }
  
  // Health Score Calculation
  lines.push('## 🔍 Health Score Calculation');
  lines.push('');
  lines.push('| Factor | Score | Weight | Contribution |');
  lines.push('|--------|-------|--------|--------------|');
  
  const factors = [
    { name: 'Contract Pass Rate', value: metrics.tests.passRate, weight: 0.25, max: 100 },
    { name: 'Implementation Progress', value: metrics.implementationLog.count, weight: 0.20, max: 26 },
    { name: 'ADR Completion', value: metrics.adrs.accepted, weight: 0.20, max: 26 },
    { name: 'Phase Completion', value: metrics.phaseCompletion.complete, weight: 0.15, max: 6 },
    { name: 'Code Quality Gates', value: (metrics.typeCheck.pass ? 1 : 0) + (metrics.lint.pass ? 1 : 0), weight: 0.10, max: 2 },
    { name: 'Milestone Achievement', value: metrics.milestones.met, weight: 0.10, max: 7 }
  ];
  
  factors.forEach(factor => {
    const normalized = Math.min(100, (factor.value / factor.max) * 100);
    const contribution = (normalized / 100) * factor.weight * 10;
    lines.push(`| ${factor.name} | ${Math.round(normalized)} | ${factor.weight * 100}% | ${contribution.toFixed(2)} |`);
  });
  
  lines.push(`| **Total** | | **100%** | **${metrics.healthScore}/10** |`);
  lines.push('');
  
  // Recommendations
  lines.push('## 💡 Recommendations');
  lines.push('');
  
  if (metrics.tests.passRate < 100) {
    lines.push('- ❌ **Critical:** Contract suite has failing tests. Run `npm test` to identify and fix failures.');
  }
  if (metrics.typeCheck.pass === false) {
    lines.push('- ⚠️ **Warning:** TypeScript compilation has errors. Run `npm run typecheck` to fix.');
  }
  if (metrics.lint.pass === false) {
    lines.push('- ⚠️ **Warning:** Linting errors found. Run `npx eslint . --ext .ts` to fix.');
  }
  if (metrics.implementationLog.count < 26) {
    lines.push(`- ⚠️ **Warning:** Expected 26 implementation log entries, found ${metrics.implementationLog.count}. Check for missing entries.`);
  }
  if (metrics.adrs.accepted < 26) {
    lines.push(`- ⚠️ **Warning:** Expected 26 accepted ADRs, found ${metrics.adrs.accepted}. Check ADR status.`);
  }
  
  if (metrics.tests.passRate === 100 && metrics.typeCheck.pass && metrics.lint.pass) {
    lines.push('- ✅ **All quality gates passing.** Ready for next phase.');
  }
  
  return lines.join('\n');
}

/**
 * Generate JSON report
 */
function generateJSONReport(metrics) {
  return JSON.stringify(metrics, null, 2);
}

/**
 * Calculate overall health score (0-10)
 */
function calculateHealthScore(metrics) {
  let score = 0;
  const weights = {
    contractPassRate: 0.25,
    implementationProgress: 0.20,
    adrCompletion: 0.20,
    phaseCompletion: 0.15,
    qualityGates: 0.10,
    milestoneAchievement: 0.10
  };
  
  // Contract Pass Rate (0-100% → 0-2.5 points)
  score += (metrics.tests.passRate / 100) * weights.contractPassRate * 10;
  
  // Implementation Progress (0-26 → 0-2.0 points)
  score += Math.min(1, metrics.implementationLog.count / 26) * weights.implementationProgress * 10;
  
  // ADR Completion (0-26 → 0-2.0 points)
  score += Math.min(1, metrics.adrs.accepted / 26) * weights.adrCompletion * 10;
  
  // Phase Completion (0-6 → 0-1.5 points)
  const phaseTotal = metrics.phaseCompletion.total || 6;
  score += Math.min(1, metrics.phaseCompletion.complete / phaseTotal) * weights.phaseCompletion * 10;
  
  // Quality Gates (0-2 → 0-1.0 points)
  const qualityScore = (metrics.typeCheck.pass ? 1 : 0) + (metrics.lint.pass ? 1 : 0);
  score += Math.min(1, qualityScore / 2) * weights.qualityGates * 10;
  
  // Milestone Achievement (0-7 → 0-1.0 points)
  const milestoneTotal = metrics.milestones.total || 7;
  score += Math.min(1, metrics.milestones.met / milestoneTotal) * weights.milestoneAchievement * 10;
  
  return Math.round(score * 10) / 10; // Round to 1 decimal
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const outputPath = args.find(a => a.startsWith('--output='))?.split('=')[1];
  const format = args.includes('--json') ? 'json' : 'markdown';
  const verifyOnly = args.includes('--verify');
  const ciMode = args.includes('--ci');
  
  // Gather all metrics
  const implementationLog = parseImplementationLog(CONFIG.implementationLogPath);
  const adrs = countADRs(CONFIG.adrDir);
  const stories = countStories(CONFIG.userStoriesDir);
  const tests = runTests();
  const git = getGitMetrics();
  const files = getFileMetrics();
  const phaseCompletion = calculatePhaseCompletion(CONFIG.implementationPlanPath);
  const milestones = getMilestoneStatus();
  
  // Check type check and lint
  const typeCheck = {
    pass: sh('cd social-listening-core && npm run typecheck 2>&1').trim().includes('Success') || 
          !sh('cd social-listening-core && npm run typecheck 2>&1').trim().includes('error')
  };
  
  const lint = {
    pass: sh('cd social-listening-core && npx eslint . --ext .ts 2>&1').trim() === ''
  };
  
  const metrics = {
    timestamp: new Date().toISOString(),
    healthScore: calculateHealthScore({
      tests,
      implementationLog,
      adrs,
      phaseCompletion,
      typeCheck,
      lint,
      milestones
    }),
    implementationLog,
    adrs,
    stories,
    tests,
    git,
    files,
    phaseCompletion,
    milestones,
    typeCheck,
    lint,
    verification: {
      implementationLog: implementationLog.count >= 26,
      adrTraceability: adrs.accepted >= 26,
      storyTraceability: stories.total >= 26,
      contractPassRate: tests.passRate === 100
    }
  };
  
  // Verify mode - just check and exit with code
  if (verifyOnly) {
    const allPass = Object.values(metrics.verification).every(v => v === true);
    if (!allPass) {
      console.error('❌ Verification failed:');
      Object.entries(metrics.verification).forEach(([key, value]) => {
        if (!value) console.error(`  - ${key}: FAILED`);
      });
      process.exit(1);
    }
    console.log('✅ All verifications passed');
    process.exit(0);
  }
  
  // CI mode - exit with error code if any verification fails
  if (ciMode) {
    const allPass = Object.values(metrics.verification).every(v => v === true);
    if (!allPass) {
      console.error('::error::Verification failed in CI mode');
      Object.entries(metrics.verification).forEach(([key, value]) => {
        if (!value) console.error(`::error::  - ${key}: FAILED`);
      });
      process.exit(1);
    }
  }
  
  // Generate and output report
  const report = format === 'json' ? generateJSONReport(metrics) : generateMarkdownReport(metrics);
  
  if (outputPath) {
    fs.writeFileSync(outputPath, report);
    console.log(`✅ Report written to: ${outputPath}`);
  } else {
    console.log(report);
  }
  
  // Exit with appropriate code based on health
  if (ciMode && metrics.healthScore < 5) {
    process.exit(1);
  }
}

// Run main
if (require.main === module) {
  main();
}

module.exports = {
  parseImplementationLog,
  countADRs,
  countStories,
  runTests,
  getGitMetrics,
  getFileMetrics,
  calculatePhaseCompletion,
  getMilestoneStatus,
  generateMarkdownReport,
  generateJSONReport,
  calculateHealthScore
};
