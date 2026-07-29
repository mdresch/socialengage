// Contract: Story 1.1 (ADR-0001) — social-listening-admin talks to social-listening-core
// only through its REST API, never directly to the database or via in-process code.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-11--core-rest-api-access-for-the-admin-ui
//
// Intent: Story 1.1 — Core REST API access for the admin UI (ADR-0001)
// Scope: social-listening-admin/package.json, social-listening-admin/src/lib/core-client.ts
// Contract to encode:
//   (1) admin's dependency manifest carries no Postgres driver or DB connection string
//   (2) admin has no in-process/shared code path into social-listening-core; its only
//       sanctioned path to core is a REST/fetch-based client module
//   (3) admin is an independently versioned/buildable npm package, not coupled to core
//       via a shared workspace root
// Explicitly out of scope: actual admin UI screens/features (Phase 1),
// social-listening-core's REST endpoints/routes (Story 1.3 and Phase 1 stories), Postgres
// provisioning (Story 1.2), Next.js scaffolding (deferred to the first story that needs an
// actual page).

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const CORE_ROOT = path.resolve(ADMIN_ROOT, '..', 'social-listening-core');

function readPackageJson(root: string) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

describe('Story 1.1 — social-listening-admin REST-only boundary contract', () => {
  const pkg = readPackageJson(ADMIN_ROOT);

  it('AC1: carries no Postgres (or other DB) driver in its dependency manifest', () => {
    const forbidden = [
      'pg', 'pg-native', 'postgres', 'pg-promise', 'typeorm', 'sequelize',
      'knex', 'mysql', 'mysql2', 'sqlite3', 'mongodb', 'mongoose',
    ];
    const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(forbidden.filter((name) => name in declared)).toEqual([]);
  });

  it('AC1: carries no committed database connection string', () => {
    const connectionStringPattern = /postgres(ql)?:\/\/|DATABASE_URL\s*=/i;
    const candidateFiles = ['package.json', '.env', '.env.local', '.env.production']
      .map((f) => path.join(ADMIN_ROOT, f))
      .filter((f) => fs.existsSync(f));

    for (const file of candidateFiles) {
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(connectionStringPattern);
    }
  });

  it('AC2: has no local/file dependency on social-listening-core', () => {
    const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const coupled = Object.entries(declared).some(([name, version]) =>
      `${name}@${version}`.includes('social-listening-core')
    );
    expect(coupled).toBe(false);
  });

  it('AC2: no admin source file imports social-listening-core directly', () => {
    // Matches an actual import/require of core's source, not mere mentions of the
    // repo name in a comment (e.g. this contract's own header, or SKILL.md prose).
    const importPattern = /(from\s+['"].*social-listening-core|require\(\s*['"].*social-listening-core)/;
    const offenders = listSourceFiles(path.join(ADMIN_ROOT, 'src')).filter((file) =>
      importPattern.test(fs.readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('AC2: exposes a single REST-based client module as the sanctioned path to core', () => {
    const clientPath = path.join(ADMIN_ROOT, 'src', 'lib', 'core-client.ts');
    expect(fs.existsSync(clientPath)).toBe(true);

    const content = fs.readFileSync(clientPath, 'utf8');
    expect(content).toMatch(/fetch\(/);

    const forbidden = ['pg', 'pg-native', 'postgres', 'mysql', 'mongodb'];
    for (const name of forbidden) {
      expect(content).not.toMatch(new RegExp(`from ['"]${name}['"]`));
    }
  });

  it('AC3: is an independently versioned package, not tied to core by a shared workspace root', () => {
    expect(typeof pkg.name).toBe('string');
    expect(typeof pkg.version).toBe('string');
    expect(pkg.name).not.toBe(readPackageJson(CORE_ROOT).name);

    const parentPackageJson = path.resolve(ADMIN_ROOT, '..', 'package.json');
    expect(fs.existsSync(parentPackageJson)).toBe(false);
  });
});
