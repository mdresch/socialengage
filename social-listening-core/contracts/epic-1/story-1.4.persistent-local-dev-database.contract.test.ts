// Contract: Story 1.4 (ADR-0025) — persistent local dev database, kept
// separate from Jest's ephemeral test database.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-14--persistent-local-dev-database-separate-from-the-ephemeral-test-database
//
// Intent: Story 1.4 — Persistent local dev database (ADR-0025)
// Scope: docker-compose.dev.yml, docker-compose.test.yml (read-only comparison
// target), package.json (db:dev:*/dev scripts), scripts/withDevEnv.js
// Contract to encode: (1) docker-compose.dev.yml declares its own compose
// project name, host port, database name, and a named volume — all distinct
// from docker-compose.test.yml's, and the test file has no such volume at
// all (matching its ephemeral, always-fresh purpose); (2) package.json's
// db:dev:down does not pass -v (data survives) while the separately-named
// db:dev:reset does; (3) scripts/withDevEnv.js sets the dev database's
// connection env vars on its child process regardless of what the parent
// shell's own environment already has, and preserves a multi-word argument
// intact rather than corrupting it — a direct regression guard for the
// rejoined-argv/execSync bug found and fixed while first building this (see
// ADR-0025's Decision and the script's own header comment).
// Explicitly out of scope: actually running both compose projects
// concurrently inside this contract suite to re-prove they don't collide —
// verified manually in practice per ADR-0025's own Amendment Log (a full
// `npm test` run against a live `npm run dev`), not re-proven here as an
// automated Docker-in-Docker test, consistent with this ADR's own
// dev-tooling-not-production-architecture framing; the Postgres image build
// / pg_cron extension both compose files share (already covered by Story
// 4.4's own contract); social-listening-core's actual server behavior once
// running (every other contract in this repo already covers that).

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const CORE_ROOT = path.resolve(__dirname, '..', '..');

function readCoreFile(relPath: string): string {
  return fs.readFileSync(path.join(CORE_ROOT, relPath), 'utf8');
}

function readPackageJson(): { scripts: Record<string, string> } {
  return JSON.parse(readCoreFile('package.json'));
}

describe('Story 1.4 — persistent local dev database contract', () => {
  const devCompose = readCoreFile('docker-compose.dev.yml');
  const testCompose = readCoreFile('docker-compose.test.yml');
  const pkg = readPackageJson();

  it('AC1: docker-compose.dev.yml declares its own project name, port, and database name — all distinct from docker-compose.test.yml', () => {
    const devName = devCompose.match(/^name:\s*(\S+)/m)?.[1];
    const testName = testCompose.match(/^name:\s*(\S+)/m)?.[1];
    expect(devName).toBeDefined();
    expect(testName).toBeDefined();
    expect(devName).not.toBe(testName);

    const devPort = devCompose.match(/-\s*"(\d+):5432"/)?.[1];
    const testPort = testCompose.match(/-\s*"(\d+):5432"/)?.[1];
    expect(devPort).toBeDefined();
    expect(testPort).toBeDefined();
    expect(devPort).not.toBe(testPort);

    expect(devCompose).toMatch(/POSTGRES_DB:\s*social_listening_dev/);
    expect(testCompose).toMatch(/POSTGRES_DB:\s*social_listening_test/);
  });

  it('AC1/AC2: the dev database has a named volume for persistence; the test database has none (ephemeral by design)', () => {
    expect(devCompose).toMatch(/volumes:\s*\n\s+-\s+dev-pgdata:\/var\/lib\/postgresql\/data/);
    expect(devCompose).toMatch(/^volumes:\s*\n\s+dev-pgdata:\s*$/m);
    expect(testCompose).not.toMatch(/^volumes:/m);
  });

  it('AC2: db:dev:down does not delete data; only the separately-named db:dev:reset does', () => {
    expect(pkg.scripts['db:dev:down']).toBe('docker compose -f docker-compose.dev.yml down');
    expect(pkg.scripts['db:dev:down']).not.toMatch(/-v\b/);
    expect(pkg.scripts['db:dev:reset']).toBe('docker compose -f docker-compose.dev.yml down -v');
  });

  it('AC4: npm run dev and db:dev:migrate both go through scripts/withDevEnv.js — no manual env export required', () => {
    expect(pkg.scripts['dev']).toBe('node scripts/withDevEnv.js ts-node src/http/server.ts');
    expect(pkg.scripts['db:dev:migrate']).toBe('node scripts/withDevEnv.js ts-node src/db/migrate.ts');
  });

  it("AC4: scripts/withDevEnv.js overrides the dev DB's connection env vars regardless of the parent's own environment", () => {
    const fixture = path.join(__dirname, 'story-1.4-fixtures', 'printEnvAndArgv.js');
    const result = spawnSync('node', [path.join(CORE_ROOT, 'scripts', 'withDevEnv.js'), 'node', fixture], {
      cwd: CORE_ROOT,
      encoding: 'utf8',
      env: { ...process.env, PGPORT: '9999', PGDATABASE: 'should_be_overridden' },
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout.trim());
    expect(output.PGPORT).toBe('5435');
    expect(output.PGDATABASE).toBe('social_listening_dev');
    expect(output.APP_PGUSER).toBe('app_user');
  });

  it('AC4: scripts/withDevEnv.js preserves a multi-word argument intact — the exact case the original execSync/rejoined-argv version corrupted', () => {
    const fixture = path.join(__dirname, 'story-1.4-fixtures', 'printEnvAndArgv.js');
    const result = spawnSync(
      'node',
      [path.join(CORE_ROOT, 'scripts', 'withDevEnv.js'), 'node', fixture, 'hello world', 'second-arg'],
      { cwd: CORE_ROOT, encoding: 'utf8' }
    );

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout.trim());
    expect(output.argv).toEqual(['hello world', 'second-arg']);
  });
});
