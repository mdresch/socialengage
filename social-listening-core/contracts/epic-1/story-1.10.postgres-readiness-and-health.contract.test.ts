// Contract: Story 1.10 (ADR-0016) — Postgres boot-time readiness check and a
// real, database-aware `/v1/health`.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-110--postgres-boot-time-readiness-check-and-a-real-v1health
//
// Intent: a misconfigured or unreachable database should be caught
// immediately at boot, not surfaced reactively on whichever request happens
// to touch the database first — and an already-running instance's
// `/v1/health` should reflect real, current Postgres connectivity rather
// than the unconditional `{status:'ok'}` placeholder Story 1.3/ADR-0017
// shipped.
// Scope: src/db/postgresReadiness.ts (new), src/http/server.ts (calls
// waitForPostgresReady() before .listen(), exits non-zero on failure),
// src/http/versions/v1/router.ts (GET /v1/health now calls
// checkPostgresConnectivity() on every request).
// Contract to encode: (1) checkPostgresConnectivity() resolves true against
// a real, reachable pool and false against a real, unreachable one, never
// throwing; (2) waitForPostgresReady() resolves quickly when reachable, and
// throws a clear, actionable error after exhausting a bounded number of
// retries — genuinely retrying with backoff, not failing on the first
// attempt — when never reachable; (3) GET /v1/health returns 200
// {status:'ok'} when Postgres answers and 503 {status:'unavailable'} when
// it doesn't, with no change to its public/unauthenticated boundary
// (Story 1.3's own AC1/AC3 already prove the happy-path shape and public
// reachability — not re-asserted here, only extended for the new 503 case);
// (4) the real `server.ts` entrypoint, spawned as a real process, exits
// non-zero with a Postgres-identifying stderr message when Postgres is
// unreachable at boot, and never starts listening; the same entrypoint,
// spawned against a real, reachable Postgres, does start listening and
// answers a real HTTP request.
// Explicitly out of scope: any Platform-Admin-facing surface for this
// signal (deliberately deferred per docs/design/README.md's own dated
// note); the exact retry count/backoff/timeout values (implementation
// defaults, not part of this contract).

import { Pool } from 'pg';
import type { Express } from 'express';
import { spawn, execSync, type ChildProcess } from 'child_process';
import path from 'path';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { getPool, closePool } from '../../src/db/pool';
import { checkPostgresConnectivity, waitForPostgresReady } from '../../src/db/postgresReadiness';

jest.setTimeout(30000);

const CORE_ROOT = path.join(__dirname, '../..');
const isWin = process.platform === 'win32';
const tsNodeBin = path.join(CORE_ROOT, 'node_modules', '.bin', isWin ? 'ts-node.cmd' : 'ts-node');

/**
 * `spawn(..., { shell: isWin })` is required on Windows to run a `.cmd`
 * shim at all (Story 6.1's own established precedent), but that means the
 * spawned PID is `cmd.exe`, not the real `ts-node`/`node` process — plain
 * `child.kill()` only kills that wrapper and leaves the actual server
 * process (and its bound port) orphaned. `taskkill /T` kills the whole
 * process tree instead. Found live: an earlier run of this exact suite
 * left a real, still-listening zombie server process behind under plain
 * `.kill()`, discovered via `Get-NetTCPConnection` still owning port 3998
 * well after the test process had exited.
 */
function killProcessTree(child: ChildProcess | undefined): void {
  if (!child || !child.pid) return;
  if (isWin) {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // Already exited — fine.
    }
  } else {
    child.kill();
  }
}

afterAll(async () => {
  await closePool();
});

describe('Story 1.10 — Postgres readiness check (unit-level, real connections)', () => {
  it('AC1: checkPostgresConnectivity() resolves true against the real, reachable test pool', async () => {
    const ok = await checkPostgresConnectivity(getPool());
    expect(ok).toBe(true);
  });

  it('AC1: checkPostgresConnectivity() resolves false (never throws) against a real, unreachable pool', async () => {
    const deadPool = new Pool({ host: '127.0.0.1', port: 1, database: 'nope', user: 'nope', password: 'nope' });
    try {
      const ok = await checkPostgresConnectivity(deadPool);
      expect(ok).toBe(false);
    } finally {
      await deadPool.end();
    }
  });

  it('AC2: waitForPostgresReady() resolves without exhausting retries when Postgres is reachable', async () => {
    await expect(waitForPostgresReady(getPool(), { retries: 5, backoffMs: 500 })).resolves.toBeUndefined();
  });

  it('AC3: waitForPostgresReady() genuinely retries with backoff, then throws a clear, actionable error after exhausting retries against an unreachable Postgres', async () => {
    const deadPool = new Pool({ host: '127.0.0.1', port: 1, database: 'nope', user: 'nope', password: 'nope' });
    const retries = 3;
    const backoffMs = 100;
    const start = Date.now();
    try {
      await expect(waitForPostgresReady(deadPool, { retries, backoffMs, attemptTimeoutMs: 1000 })).rejects.toThrow(
        /postgres/i
      );
      const elapsed = Date.now() - start;
      // (retries - 1) backoff waits happened between attempts — proves this
      // actually retried rather than failing once and giving up.
      expect(elapsed).toBeGreaterThanOrEqual((retries - 1) * backoffMs);
    } finally {
      await deadPool.end();
    }
  });
});

describe('Story 1.10 — GET /v1/health is database-aware', () => {
  it('AC4: returns 200 {status: "ok"} when Postgres is reachable', async () => {
    const app = createApp();
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('AC4: returns 503 {status: "unavailable"} when Postgres is unreachable, still with no auth required', async () => {
    const originalPort = process.env.PGPORT;
    process.env.PGPORT = '1'; // nothing listens here — a real, fast connection failure
    let brokenApp: Express;
    let closeBrokenPool: () => Promise<void>;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const appModule = require('../../src/http/app');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const poolModule = require('../../src/db/pool');
      brokenApp = appModule.createApp();
      closeBrokenPool = poolModule.closePool;
    });
    try {
      const res = await request(brokenApp!).get('/v1/health');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: 'unavailable' });
    } finally {
      process.env.PGPORT = originalPort;
      await closeBrokenPool!();
    }
  });
});

describe('Story 1.10 — the real server.ts entrypoint, spawned as a real process', () => {
  let serverProcess: ChildProcess | undefined;

  afterEach(() => {
    killProcessTree(serverProcess);
    serverProcess = undefined;
  });

  it('AC1/AC2: refuses to start, exits non-zero, and logs a Postgres-identifying error when Postgres is unreachable at boot', async () => {
    const exitInfo = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
      let stderr = '';
      const child = spawn(tsNodeBin, ['src/http/server.ts'], {
        cwd: CORE_ROOT,
        env: { ...process.env, PORT: '3999', PGPORT: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWin,
      });
      serverProcess = child;
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('exit', (code) => resolve({ code, stderr }));
    });

    expect(exitInfo.code).not.toBe(0);
    expect(exitInfo.stderr.toLowerCase()).toContain('postgres');
  }, 25000);

  it('AC1: starts listening and answers a real request when Postgres is reachable at boot', async () => {
    const port = 3998;
    const child = spawn(tsNodeBin, ['src/http/server.ts'], {
      cwd: CORE_ROOT,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
    });
    serverProcess = child;

    const deadline = Date.now() + 20000;
    let response: Response | undefined;
    while (Date.now() < deadline) {
      try {
        response = await fetch(`http://localhost:${port}/v1/health`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    expect(response).toBeDefined();
    expect(response!.status).toBe(200);
  }, 25000);
});
