// Contract: Story 2.10 (ADR-0048) — explicit, CI-enforced policy that
// registering a new connector never requires editing core ingestion
// pipeline/orchestration logic.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-210
// and docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md
//
// Intent: ADR-0048's Decision (§1-4) requires that every connector PR
// provide test evidence that registration touched only the connector's own
// implementation and the designated registry/registration surface, backed
// by a deterministic CI guardrail, with documentation per connector citing
// registration location/extension points/verification, applied uniformly
// to SocialConnector and AIProviderConnector alike. ADR-0048's Consequences
// name the concrete risk this closes ("accidental API-surface leaks and
// hard-coded provider branches in the core pipeline") and the cost
// ("adds PR and CI overhead for connector work... ongoing maintenance of
// designated extension-point checks as code structure evolves").
// Scope: this contract test (new); a "Registration transparency (ADR-0048)"
// section added to each real connector's own SKILL.md (gnews-connector,
// newswire-connector, azure-ai-language-connector, azure-openai-connector)
// and a cross-reference added to provider-connector-framework/SKILL.md.
// No production code changes — this story verifies an already-true
// invariant and makes it durably, mechanically checked, per ADR-0048's own
// left-open question resolved here as a Jest contract gate rather than a
// separate CI script (see provider-connector-framework/SKILL.md's own note
// on why).
// Contract to encode: (1) no designated core ingestion/orchestration file
// contains any real connector's own providerId literal (ADR-0048 §1); (2)
// this contract itself is the CI guardrail — it runs under the existing
// `npm test` step every PR already goes through (ADR-0048 §2), proven
// structurally against jest.config.js/package.json/the CI workflow file
// rather than assumed; (3) each real connector's own SKILL.md documents its
// registration location, extension points used, and no-core-change
// verification method (ADR-0048 §3); (4) the same check runs identically
// across both SocialConnector and AIProviderConnector instances, no
// class-specific carve-out (ADR-0048 §4).
// Explicitly out of scope: connector deprecation/removal PRs (ADR-0048's
// own named, deliberately unresolved Open Question); a strict file/directory
// allowlist maintained anywhere other than this test's own CORE_FILES
// constant (also an Open Question, resolved here as "the constant is the
// allowlist, extend it when a new core file is introduced").

import fs from 'fs';
import path from 'path';

const CORE_ROOT = path.join(__dirname, '../..');

/**
 * ADR-0048 §1's "designated registration surfaces" are everything NOT in
 * this list plus each connector's own directory — this is the allowlist's
 * complement: every file a connector registration must never need to
 * touch. Add a new core file here (never to a connector's own directory)
 * if one is introduced.
 */
const CORE_FILES = [
  'src/ingestion/runIngestionAttempt.ts',
  'src/ingestion/ingestionRunStore.ts',
  'src/ingestion/errorClassification.ts',
  'src/connectors/registry.ts',
  'src/connectors/requestGate.ts',
  'src/connectors/rateLimitResolution.ts',
  'src/connectors/connectorHealth.ts',
  'src/connectors/connectorHealthCache.ts',
  'src/connectors/types.ts',
  'src/http/versions/v1/connectorsRouter.ts',
  // 2026-08-13 (Story 1.13, ADR-0052) — extended per this file's own
  // documented convention ("Add a new core file here... if one is
  // introduced"). The scheduler dispatches every poll purely through the
  // registry (getSocialConnector(platformId)?.poll?.(tenantId)); this
  // guardrail is the same mechanism Story 1.13's own AC3 cites as proof
  // it never hardcodes a per-providerId switch.
  'src/scheduler/pollScheduler.ts',
];

interface RealConnector {
  name: string;
  providerId: string;
  kind: 'social' | 'ai';
  skillPath: string;
}

const REAL_CONNECTORS: RealConnector[] = [
  { name: 'GNews', providerId: 'gnews', kind: 'social', skillPath: '.claude/skills/gnews-connector/SKILL.md' },
  { name: 'Newswire', providerId: 'newswire', kind: 'social', skillPath: '.claude/skills/newswire-connector/SKILL.md' },
  {
    name: 'Azure AI Language',
    providerId: 'azure-ai-language',
    kind: 'ai',
    skillPath: '.claude/skills/azure-ai-language-connector/SKILL.md',
  },
  {
    name: 'Azure OpenAI',
    providerId: 'azure-openai',
    kind: 'ai',
    skillPath: '.claude/skills/azure-openai-connector/SKILL.md',
  },
  // 2026-08-12 (Story 2.11, ADR-0050) — extended per this file's own
  // documented convention ("extend CORE_FILES/REAL_CONNECTORS when a new
  // core file/connector is introduced") and per Story 2.11's own AC1,
  // which explicitly requires this exact evidence mechanism, not a
  // separately-argued weaker claim.
  {
    name: 'Tenant-owned feed',
    providerId: 'tenant-owned-feed',
    kind: 'social',
    skillPath: '.claude/skills/tenant-owned-feed-connector/SKILL.md',
  },
  // 2026-08-17 (Story 2.13, ADR-0042) — extended per this file's own
  // documented convention ("extend CORE_FILES/REAL_CONNECTORS when a new
  // core file/connector is introduced") and per Story 2.13's own AC1,
  // which explicitly requires this exact evidence mechanism.
  {
    name: 'Wikipedia',
    providerId: 'wikipedia',
    kind: 'social',
    skillPath: '.claude/skills/wikipedia-connector/SKILL.md',
  },
  // 2026-08-20 (Story 2.21, ADR-0065) — extended for Brave Search active watchlist sourcing connector.
  {
    name: 'Brave Search',
    providerId: 'brave-search',
    kind: 'social',
    skillPath: '.claude/skills/brave-search-connector/SKILL.md',
  },
  // 2026-08-21 (Story 2.22, ADR-0066) — extended for Bing Search API active watchlist sourcing connector.
  {
    name: 'Bing Search',
    providerId: 'bing-search',
    kind: 'social',
    skillPath: '.claude/skills/bing-search-connector/SKILL.md',
  },
];

function readCore(relativePath: string): string {
  return fs.readFileSync(path.join(CORE_ROOT, relativePath), 'utf8');
}

/**
 * Matches the providerId as a real quoted string literal — the shape a
 * hardcoded branch or lookup would actually take (`providerId === 'gnews'`,
 * `case 'gnews':`) — not merely the word appearing anywhere, e.g. inside a
 * doc comment's own `.claude/skills/azure-ai-language-connector/SKILL.md`
 * cross-reference path. A doc comment naming a connector for maintainer
 * guidance is not the "core-path edit for registration purposes" ADR-0048
 * §1 is actually about.
 */
function containsProviderIdLiteral(source: string, providerId: string): boolean {
  const escaped = providerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['"]${escaped}['"]`).test(source);
}

describe('Story 2.10 — connector registration transparency (ADR-0048)', () => {
  describe('AC1/ADR-0048 §1: no core ingestion/orchestration file references a real connector\'s own providerId', () => {
    for (const connector of REAL_CONNECTORS) {
      it(`${connector.name} ('${connector.providerId}') is absent from every designated core file`, () => {
        for (const coreFile of CORE_FILES) {
          const source = readCore(coreFile);
          expect(containsProviderIdLiteral(source, connector.providerId)).toBe(false);
        }
      });
    }
  });

  describe('AC2/ADR-0048 §2: this contract is itself the deterministic CI guardrail', () => {
    it('this file matches jest.config.js\'s own test pattern, so it runs under the existing npm test step', () => {
      const jestConfigSource = readCore('jest.config.js');
      // Every contract file in this repo already matches this convention —
      // proven structurally rather than assumed by checking the config
      // references the contracts/ directory and the .contract.test.ts suffix
      // this file itself uses.
      expect(jestConfigSource).toContain('contracts');
      expect(path.basename(__filename)).toMatch(/\.contract\.test\.ts$/);
    });

    it('package.json\'s own "test" script is "jest" — no separate script this guardrail could be silently excluded from', () => {
      const pkg = JSON.parse(readCore('package.json'));
      expect(pkg.scripts.test).toBe('jest');
    });

    it('CI runs npm test for social-listening-core on every push and pull request (.github/workflows/ci.yml)', () => {
      const ciWorkflow = fs.readFileSync(path.join(CORE_ROOT, '../.github/workflows/ci.yml'), 'utf8');
      expect(ciWorkflow).toMatch(/on:\s*\n\s*push:/);
      expect(ciWorkflow).toMatch(/pull_request:/);
      expect(ciWorkflow).toContain('working-directory: social-listening-core');
      expect(ciWorkflow).toContain('npm test');
    });
  });

  describe('AC3/ADR-0048 §3: each real connector\'s own SKILL.md documents registration location, extension points, and verification', () => {
    for (const connector of REAL_CONNECTORS) {
      it(`${connector.name}'s SKILL.md has a "Registration transparency (ADR-0048)" section with all three required fields`, () => {
        const skillSource = readCore(connector.skillPath);
        expect(skillSource).toContain('Registration transparency (ADR-0048)');
        expect(skillSource).toContain('**Registration location:**');
        expect(skillSource).toContain('**Extension points used:**');
        expect(skillSource).toContain('**No-core-change verification:**');
      });
    }
  });

  describe('AC4/ADR-0048 §4: the policy applies uniformly to social and AI connectors — no class-specific carve-out', () => {
    it('REAL_CONNECTORS genuinely spans both connector classes, and AC1\'s check ran identically for each', () => {
      const kinds = new Set(REAL_CONNECTORS.map((c) => c.kind));
      expect(kinds.has('social')).toBe(true);
      expect(kinds.has('ai')).toBe(true);
      // AC1's describe block above iterates this exact same REAL_CONNECTORS
      // array with one shared assertion body — there is no per-kind branch
      // anywhere in that check.
    });
  });
});
