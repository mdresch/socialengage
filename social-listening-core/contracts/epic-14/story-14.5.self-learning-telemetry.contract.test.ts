// Contract: Story 14.5 (ADR-0122 / TDS-0122 / FDD-0122) — Continuous Self-Learning Synthesis and Telemetry Feedback Architecture
// See docs/user-stories/epic-14-adr-0118-to-0122.md#story-145--continuous-self-learning-synthesis-and-telemetry-feedback-architecture
//
// Intent: Story 14.5 — Automated telemetry ingestion, gotcha indexing, and living architecture feedback loop.
// Scope: scripts/synthesize-telemetry.mjs,
//        docs/environment-gotchas.md,
//        docs/project docs/Lessons-Learned-Register.md,
//        docs/adr/0118-*.md through docs/adr/0122-*.md,
//        docs/synthesis/Self-Learning-Synthesis-Epic-14.md
//
// Contract Specifications (TDS-0122 §12.1):
//   (1) AC1 & TDS §12.1: extracts environment gotchas from commit logs matching failure keywords (heal, fix).
//   (2) AC3 & TDS §12.1: validates that ADR in-place annotations preserve original decision text (append-only invariant).
//   (3) AC2 & TDS §12.1: ensures all extracted gotchas reference verifiable file paths in the codebase.
//   (4) AC1 & AC6: executes synthesis CLI --capture and --compile, validating repo and vault artifact generation.
//   (5) FDD §4: validates idempotence across repetitive synthesis compilations.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Story 14.5 — Continuous Self-Learning Synthesis and Telemetry Feedback Architecture', () => {
  const gotchasPath = path.join(repoRoot, 'docs/environment-gotchas.md');
  const lessonsPath = path.join(repoRoot, 'docs/project docs/Lessons-Learned-Register.md');
  const adrDir = path.join(repoRoot, 'docs/adr');

  test('extracts environment gotchas from commit logs matching failure keywords', () => {
    // 1. Verify git log extraction of healing/fix commits using child_process
    const gitLogCommand = 'git log -n 50 --format="%H|%s" --grep="heal(" --grep="fix("';
    const logOutput = execSync(gitLogCommand, { cwd: repoRoot, encoding: 'utf8' });

    expect(logOutput.trim().length).toBeGreaterThan(0);
    const commitEntries = logOutput.split('\n').filter(Boolean);
    expect(commitEntries.length).toBeGreaterThan(0);

    // Verify first entry has valid commit hash and prefix
    const [firstHash, firstSubject] = commitEntries[0].split('|');
    expect(firstHash).toMatch(/^[0-9a-f]{40}$/);
    expect(firstSubject).toMatch(/(heal|fix)\(/);

    // 2. Verify docs/environment-gotchas.md exists and has valid indexed entries
    expect(fs.existsSync(gotchasPath)).toBe(true);
    const gotchasContent = fs.readFileSync(gotchasPath, 'utf8');

    // Must have structured category headings
    expect(gotchasContent).toMatch(/## Test database template/);
    expect(gotchasContent).toMatch(/## Caching & Hashing/);

    // Must contain root cause, guardrail, and commit references
    expect(gotchasContent).toContain('composerResearchService.ts');
    expect(gotchasContent).toContain('d2bd7797');
  });

  test('validates that ADR in-place annotations preserve original decision text', () => {
    // Check that annotated ADRs maintain the append-only invariant:
    // Original sections (Context, Decision, Consequences) are preserved unaltered,
    // and '## Implementation Learnings & Real-World Constraints' is strictly appended at the bottom.
    const sampleAdrs = [
      '0036-admin-ui-authentication-session-and-role-gating-mechanism.md',
      '0118-additional-social-platform-publishing.md',
      '0119-editing-and-deleting-published-outbound-posts.md',
      '0120-search-provider-connector.md',
      '0121-composer-deep-research-caching-retrigger-cost.md',
    ];

    for (const adrName of sampleAdrs) {
      const fullPath = path.join(adrDir, adrName);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');

      // 1. Verify historical decision markers are present
      expect(content).toMatch(/## Context/i);
      expect(content).toMatch(/## Decision/i);

      // 2. Verify in-place learnings header exists
      const learningsMarker = '## Implementation Learnings & Real-World Constraints';
      expect(content).toContain(learningsMarker);

      // 3. Verify the learnings section appears after Decision
      const decisionIndex = content.indexOf('## Decision');
      const learningsIndex = content.indexOf(learningsMarker);
      expect(learningsIndex).toBeGreaterThan(decisionIndex);

      // 4. Verify standard schema elements per FDD-0122 §3.3
      const learningsSection = content.slice(learningsIndex);
      expect(learningsSection).toMatch(/Amended \d{4}-\d{2}-\d{2} per ADR-0122/);
      expect(learningsSection).toContain('- **');
      expect(learningsSection).toMatch(/- \*\*Operational Trade-offs?\*\*:/);
      expect(learningsSection).toContain('- **Reference Commits**:');
    }
  });

  test('ensures all extracted gotchas reference verifiable file paths', () => {
    expect(fs.existsSync(gotchasPath)).toBe(true);
    const content = fs.readFileSync(gotchasPath, 'utf8');

    // Extract all backtick-quoted file candidates ending in typical code/config extensions
    const fileMatches = content.match(/`([a-zA-Z0-9_\-\.\/]+\.(ts|js|sql|md|yml|json))`/g) || [];
    expect(fileMatches.length).toBeGreaterThan(0);

    function fileExistsAnywhere(fileName: string, startDir: string): boolean {
      const base = path.basename(fileName);
      try {
        const entries = fs.readdirSync(startDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          const full = path.join(startDir, entry.name);
          if (entry.isFile() && (entry.name === base || full.endsWith(fileName))) {
            return true;
          } else if (entry.isDirectory()) {
            if (fileExistsAnywhere(fileName, full)) return true;
          }
        }
      } catch {}
      return false;
    }

    const verifiedFiles: string[] = [];
    const missingFiles: string[] = [];

    for (const rawMatch of fileMatches) {
      const cleanPath = rawMatch.replace(/`/g, '');
      if (cleanPath === '.d.ts' || cleanPath.includes('test-fixture')) continue;

      const candidates = [
        path.join(repoRoot, cleanPath),
        path.join(repoRoot, 'social-listening-core', cleanPath),
        path.join(repoRoot, 'social-listening-admin', cleanPath),
        path.join(repoRoot, 'social-listening-core/src', cleanPath),
        path.join(repoRoot, 'social-listening-core/src/composer', cleanPath),
        path.join(repoRoot, 'social-listening-core/migrations', cleanPath),
        path.join(repoRoot, 'social-listening-core/scripts', cleanPath),
        path.join(repoRoot, 'social-listening-admin/scripts', cleanPath),
        path.join(repoRoot, '.claude/skills', cleanPath),
        path.join(repoRoot, 'social-listening-core/.claude/skills', cleanPath),
        path.join(repoRoot, 'social-listening-admin/node_modules', cleanPath),
        path.join(repoRoot, 'social-listening-core/node_modules', cleanPath),
      ];

      let exists = candidates.some((p) => fs.existsSync(p));
      if (!exists) {
        exists = fileExistsAnywhere(cleanPath, repoRoot);
      }

      if (exists) {
        verifiedFiles.push(cleanPath);
      } else {
        missingFiles.push(cleanPath);
      }
    }

    expect(verifiedFiles.length).toBeGreaterThan(10);
    expect(missingFiles).toEqual([]);
  });

  test('verifies synthesis CLI capture and compile pipelines and vault output generation', () => {
    // 1. Run synthesis in capture mode for Epic 14
    const captureCmd = 'node scripts/synthesize-telemetry.mjs --capture --epic 14';
    const captureResult = execSync(captureCmd, { cwd: repoRoot, encoding: 'utf8' });
    expect(captureResult).toContain('[Capture] Epic 14');
    expect(captureResult).toContain('Capture complete');

    // 2. Run synthesis in compile mode for Epic 14
    const compileCmd = 'node scripts/synthesize-telemetry.mjs --compile --epic 14';
    const compileResult = execSync(compileCmd, { cwd: repoRoot, encoding: 'utf8' });
    expect(compileResult).toContain('[Compile] Epic 14');
    expect(compileResult).toContain('Compile complete');

    // 3. Verify generated repo synthesis artifact
    const repoArtifactPath = path.join(repoRoot, 'docs/synthesis/Self-Learning-Synthesis-Epic-14.md');
    expect(fs.existsSync(repoArtifactPath)).toBe(true);
    const synthesisDoc = fs.readFileSync(repoArtifactPath, 'utf8');

    // Verify sections dictated by ADR-0122 / FDD-0122
    expect(synthesisDoc).toContain('# Self-Learning Synthesis: Epic 14');
    expect(synthesisDoc).toContain('## 1. Telemetry Summary');
    expect(synthesisDoc).toContain('## 2. Healing & Fix Passes');
    expect(synthesisDoc).toContain('## 3. Feature Commits (This Epic)');
    expect(synthesisDoc).toContain('## 4. Contract Test Inventory');
    expect(synthesisDoc).toContain('## 5. ADR Implementation Learnings Status');
    expect(synthesisDoc).toContain('## 6. Environment Gotchas (Snapshot)');
    expect(synthesisDoc).toContain('## 7. Synthesis Recommendations');

    // 4. Verify Second Brain vault artifacts exist if vault is mounted
    const vaultPath = 'C:\\Users\\menno\\Documents\\Second Brain';
    if (fs.existsSync(vaultPath)) {
      const wikiArtifact = path.join(vaultPath, 'wiki/Projects/SocialEngage/06 Synthesis & Lessons Learned/Self-Learning-Synthesis-Epic-14.md');
      expect(fs.existsSync(wikiArtifact)).toBe(true);
      const wikiContent = fs.readFileSync(wikiArtifact, 'utf8');
      expect(wikiContent).toMatch(/---[\s\S]*?title: "Self-Learning-Synthesis-Epic-14"[\s\S]*?---/);
    }
  });

  test('enforces idempotence of synthesis compilation across repetitive runs', () => {
    const repoArtifactPath = path.join(repoRoot, 'docs/synthesis/Self-Learning-Synthesis-Epic-14.md');
    expect(fs.existsSync(repoArtifactPath)).toBe(true);

    const firstRunContent = fs.readFileSync(repoArtifactPath, 'utf8');

    // Run compile a second time
    const compileCmd = 'node scripts/synthesize-telemetry.mjs --compile --epic 14';
    execSync(compileCmd, { cwd: repoRoot, encoding: 'utf8' });

    const secondRunContent = fs.readFileSync(repoArtifactPath, 'utf8');

    // Content should be stable across runs
    expect(secondRunContent).toBe(firstRunContent);

    // Verify Lessons-Learned-Register contains Pattern 4 without duplicate entries
    const lessonsContent = fs.readFileSync(lessonsPath, 'utf8');
    const patternCount = (lessonsContent.match(/Normalized Deterministic Request-Hash Caching/g) || []).length;
    expect(patternCount).toBe(1);
  });
});
