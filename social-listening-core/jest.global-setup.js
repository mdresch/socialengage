const { execSync } = require('child_process');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_CONTEXT_FILE = path.join(__dirname, `.jest-test-db-${process.pid}.json`);

/**
 * Ensures the shared test Postgres container is running, validates/updates
 * the template database (`social_listening_template`), and clones a fast,
 * physically-isolated database for this test session in < 50ms.
 */
module.exports = async function globalSetup() {
  // 127.0.0.1, not 'localhost' — on this project's Windows dev machines, Node
  // resolves 'localhost' to the IPv6 loopback (::1) first, but Docker
  // Desktop only publishes this port on IPv4. `client.connect()` below has no
  // connectionTimeoutMillis, so hitting ::1 doesn't fail fast, it hangs
  // indefinitely — every test run, not just this one. See
  // docs/environment-gotchas.md.
  process.env.PGHOST = '127.0.0.1';
  process.env.PGPORT = '5434';
  process.env.PGUSER = 'postgres';
  process.env.PGPASSWORD = 'postgres';
  process.env.APP_PGUSER = process.env.APP_PGUSER || 'app_user';
  process.env.APP_PGPASSWORD = process.env.APP_PGPASSWORD || 'app_user_password';
  process.env.PLATFORM_ADMIN_PGUSER = process.env.PLATFORM_ADMIN_PGUSER || 'platform_admin_role';
  process.env.PLATFORM_ADMIN_PGPASSWORD =
    process.env.PLATFORM_ADMIN_PGPASSWORD || 'platform_admin_role_password';
  process.env.IDENTITY_RESOLVER_PGUSER = process.env.IDENTITY_RESOLVER_PGUSER || 'identity_resolver_role';
  process.env.IDENTITY_RESOLVER_PGPASSWORD =
    process.env.IDENTITY_RESOLVER_PGPASSWORD || 'identity_resolver_role_password';

  // 1. Ensure Docker container is running idempotently
  let containerRunning = false;
  try {
    const client = new Client({
      host: '127.0.0.1',
      port: 5434,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
      connectionTimeoutMillis: 1500,
    });
    await client.connect();
    await client.end();
    containerRunning = true;
  } catch {
    containerRunning = false;
  }

  if (!containerRunning) {
    console.log('📦 Starting shared test Postgres container (social-listening-core-test on port 5434)...');
    execSync('docker compose -f docker-compose.test.yml up -d --wait', {
      cwd: __dirname,
      stdio: 'inherit',
    });
  }

  const maintClient = new Client({
    host: '127.0.0.1',
    port: 5434,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  });
  await maintClient.connect();

  try {
    // 2. Check if template database exists
    const tplCheck = await maintClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'social_listening_template'"
    );

    if (tplCheck.rows.length === 0) {
      // pg_cron's background worker is pinned to social_listening_test via
      // docker-compose.test.yml's cron.database_name GUC. CREATE EXTENSION
      // pg_cron (migration 0013) only succeeds in that specific database, so
      // we migrate social_listening_test first, then clone it into the
      // template — this gives the template (and every test_run_* clone) the
      // cron schema with its cron.job foreign table. Without this, Story 4.4's
      // AC5a contract fails with "relation cron.job does not exist" in every
      // cloned test DB.
      console.log('🔨 Migrating social_listening_test and creating template from it...');
      execSync('npx ts-node src/db/migrate.ts', {
        cwd: __dirname,
        stdio: 'inherit',
        env: {
          ...process.env,
          PGDATABASE: 'social_listening_test',
        },
      });

      // Terminate the pg_cron bg worker (and any other connections) so
      // social_listening_test can be used as a CREATE DATABASE TEMPLATE source
      await maintClient.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = 'social_listening_test' AND pid <> pg_backend_pid()
      `);
      await maintClient.query('CREATE DATABASE social_listening_template TEMPLATE social_listening_test');

      // Mark as template and disallow direct connections
      await maintClient.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = 'social_listening_template' AND pid <> pg_backend_pid()
      `);
      await maintClient.query('ALTER DATABASE social_listening_template WITH is_template = true allow_connections = false');
    } else {
      // Template exists — re-migrate to pick up any newly-added migration files
      // (e.g. 0043_add_tenants_onboarding_checklist.sql added after the template
      // was first created). pg_cron's CREATE EXTENSION will silently skip via
      // its EXCEPTION block since cron.database_name points at
      // social_listening_test, not the template — but the cron schema and
      // cron.job foreign table are already present from the original creation,
      // so this is fine.
      await maintClient.query('ALTER DATABASE social_listening_template WITH is_template = false allow_connections = true');
      try {
        execSync('npx ts-node src/db/migrate.ts', {
          cwd: __dirname,
          stdio: 'inherit',
          env: {
            ...process.env,
            PGDATABASE: 'social_listening_template',
          },
        });
      } finally {
        await maintClient.query(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = 'social_listening_template' AND pid <> pg_backend_pid()
        `).catch(() => {});
        await maintClient.query('ALTER DATABASE social_listening_template WITH is_template = true allow_connections = false');
      }
    }

    // 3. Cleanup only old orphaned test databases (older than 1 hour)
    const oldDbs = await maintClient.query(`
      SELECT datname FROM pg_database 
      WHERE datname LIKE 'test_run_%'
    `);
    const now = Date.now();
    for (const row of oldDbs.rows) {
      const parts = row.datname.split('_');
      // Format: test_run_<timestamp>_<pid>_<random>
      const ts = Number(parts[2]);
      if (ts && (now - ts > 3600000)) {
        try {
          await maintClient.query(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = '${row.datname}' AND pid <> pg_backend_pid()
          `);
          await maintClient.query(`DROP DATABASE IF EXISTS "${row.datname}"`);
        } catch {
          // ignore if in use by another concurrent test
        }
      }
    }

    // 4. Create unique clone for this Jest run with concurrency retry
    const testDbName = `test_run_${Date.now()}_${process.pid}_${Math.floor(Math.random() * 10000)}`;
    let cloned = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        await maintClient.query(`CREATE DATABASE "${testDbName}" TEMPLATE social_listening_template`);
        cloned = true;
        break;
      } catch (err) {
        if (err.message && err.message.includes('being accessed by other users')) {
          await maintClient.query(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = 'social_listening_template' AND pid <> pg_backend_pid()
          `).catch(() => {});
          await new Promise((r) => setTimeout(r, 100 + Math.random() * 150));
        } else {
          throw err;
        }
      }
    }
    if (!cloned) {
      await maintClient.query(`CREATE DATABASE "${testDbName}" TEMPLATE social_listening_template`);
    }

    // 6. Set environment variable and save context
    process.env.PGDATABASE = testDbName;
    fs.writeFileSync(
      DB_CONTEXT_FILE,
      JSON.stringify({ testDbName, createdAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } finally {
    await maintClient.end();
  }
};
