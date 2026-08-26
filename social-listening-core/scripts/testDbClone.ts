import { execSync } from 'child_process';
import { Client } from 'pg';

/**
 * CLI: `ts-node scripts/testDbClone.ts create <name>` / `... drop <name>`.
 *
 * Exposes jest.global-setup.js's own isolated-clone-per-run mechanism (56aec12)
 * as a standalone script, so a test harness outside this repo — social-listening-admin's
 * Story 6.1 contract, which spawns a real social-listening-core dev server as a test
 * dependency — can get its own isolated database without importing `pg` itself or
 * connecting to Postgres directly. ADR-0001/AGENTS.md's "admin never accesses the
 * database directly" boundary is about the shipped application, not this test-harness
 * orchestration (which already shells into this repo's own scripts, e.g.
 * ensureContractTestIdentity.ts); this keeps the one place that actually holds a `pg.Client`
 * inside social-listening-core rather than adding that dependency to social-listening-admin.
 */

const PG_CONNECTION = {
  host: 'localhost',
  port: 5434,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
};

/**
 * Mirrors jest.global-setup.js's own steps 1–2: brings the shared test Postgres
 * container up and ensures `social_listening_template` exists, idempotently.
 * Needed here because this script can run standalone from a caller (e.g.
 * social-listening-admin's own contract, which spawns a real core dev server as
 * a test dependency) whose own jest.global-setup.js never ran core's — nothing
 * else would have brought the container up first.
 */
async function ensureReady(): Promise<void> {
  let containerRunning = false;
  try {
    const probe = new Client({ ...PG_CONNECTION, connectionTimeoutMillis: 1500 });
    await probe.connect();
    await probe.end();
    containerRunning = true;
  } catch {
    containerRunning = false;
  }

  if (!containerRunning) {
    execSync('docker compose -f docker-compose.test.yml up -d --wait', { stdio: 'inherit' });
  }

  // docker compose's own --wait healthcheck passing doesn't guarantee the socket is
  // immediately stable for a fresh client handshake on first boot (observed directly:
  // a client connecting right after "Healthy" can still get ECONNRESET) — short
  // retry rather than failing the whole run on a startup race. A fresh Client per
  // attempt: pg's Client isn't safely reusable after a failed connect().
  let client: Client | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = new Client(PG_CONNECTION);
    try {
      await candidate.connect();
      client = candidate;
      break;
    } catch {
      await candidate.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  if (!client) {
    client = new Client(PG_CONNECTION);
    await client.connect();
  }
  try {
    const tplCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'social_listening_template'");
    if (tplCheck.rows.length === 0) {
      // pg_cron's bg worker is pinned to social_listening_test (see
      // docker-compose.test.yml's cron.database_name GUC). CREATE EXTENSION
      // pg_cron only succeeds there, so migrate it first and clone the
      // template from it — gives the template (and every test_run_* clone)
      // the cron schema with cron.job. See jest.global-setup.js for the
      // full rationale.
      execSync('npx ts-node src/db/migrate.ts', {
        stdio: 'inherit',
        env: {
          ...process.env,
          PGHOST: PG_CONNECTION.host,
          PGPORT: String(PG_CONNECTION.port),
          PGUSER: PG_CONNECTION.user,
          PGPASSWORD: PG_CONNECTION.password,
          PGDATABASE: 'social_listening_test',
        },
      });
      await client
        .query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'social_listening_test' AND pid <> pg_backend_pid()`
        )
        .catch(() => {});
      await client.query('CREATE DATABASE social_listening_template TEMPLATE social_listening_test');
      await client
        .query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'social_listening_template' AND pid <> pg_backend_pid()`
        )
        .catch(() => {});
      await client.query('ALTER DATABASE social_listening_template WITH is_template = true allow_connections = false');
    } else {
      // Template exists — re-migrate to pick up newly-added migration files
      await client.query('ALTER DATABASE social_listening_template WITH is_template = false allow_connections = true');
      try {
        execSync('npx ts-node src/db/migrate.ts', {
          stdio: 'inherit',
          env: {
            ...process.env,
            PGHOST: PG_CONNECTION.host,
            PGPORT: String(PG_CONNECTION.port),
            PGUSER: PG_CONNECTION.user,
            PGPASSWORD: PG_CONNECTION.password,
            PGDATABASE: 'social_listening_template',
          },
        });
      } finally {
        await client
          .query(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'social_listening_template' AND pid <> pg_backend_pid()`
          )
          .catch(() => {});
        await client.query('ALTER DATABASE social_listening_template WITH is_template = true allow_connections = false');
      }
    }
  } finally {
    await client.end();
  }
}

async function createClone(name: string): Promise<void> {
  await ensureReady();
  const client = new Client(PG_CONNECTION);
  await client.connect();
  try {
    let cloned = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        await client.query(`CREATE DATABASE "${name}" TEMPLATE social_listening_template`);
        cloned = true;
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('being accessed by other users')) {
          await client
            .query(
              `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'social_listening_template' AND pid <> pg_backend_pid()`
            )
            .catch(() => {});
          await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 150));
        } else {
          throw err;
        }
      }
    }
    if (!cloned) {
      await client.query(`CREATE DATABASE "${name}" TEMPLATE social_listening_template`);
    }
  } finally {
    await client.end();
  }
}

async function dropClone(name: string): Promise<void> {
  if (!name.startsWith('test_run_')) {
    throw new Error(`Refusing to drop "${name}" — only test_run_* databases are droppable by this script.`);
  }
  const client = new Client(PG_CONNECTION);
  await client.connect();
  try {
    await client
      .query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${name}' AND pid <> pg_backend_pid()`)
      .catch(() => {});
    await client.query(`DROP DATABASE IF EXISTS "${name}"`);
  } finally {
    await client.end();
  }
}

async function main() {
  const [action, name] = process.argv.slice(2);
  if (!action || !name || !['create', 'drop'].includes(action)) {
    console.error('Usage: ts-node scripts/testDbClone.ts <create|drop> <database-name>');
    process.exit(1);
  }
  if (action === 'create') {
    await createClone(name);
  } else {
    await dropClone(name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
