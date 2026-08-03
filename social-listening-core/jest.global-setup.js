const { execSync } = require('child_process');
require('dotenv').config();

/**
 * Brings up the ephemeral test Postgres container and applies migrations
 * before the contract suite runs. Requires Docker to be running locally.
 * Env vars set here propagate to Jest's test-file workers (Jest forks them
 * after globalSetup completes) — see .claude/skills/postgres-tenant-db/SKILL.md.
 *
 * The dotenv load above reads a local, gitignored .env (see .env.example)
 * into process.env before this function runs — same "set env vars in JS, not
 * the shell" convention scripts/withDevEnv.js already established (Story 1.4),
 * chosen here specifically because a real per-tenant credential (GNEWS_API_KEY,
 * Story 2.7) is the first thing a contract test in this repo needs that isn't
 * a fixed local-dev default — an OS-level environment variable set via System
 * Properties doesn't propagate to already-running shells/terminals until they
 * restart, which a file read at process start avoids entirely. dotenv.config()
 * never overrides a variable already set in the real environment, so this is
 * additive only.
 */
module.exports = async function globalSetup() {
  process.env.PGHOST = process.env.PGHOST || 'localhost';
  process.env.PGPORT = '5434';
  process.env.PGDATABASE = process.env.PGDATABASE || 'social_listening_test';
  process.env.PGUSER = process.env.PGUSER || 'postgres';
  process.env.PGPASSWORD = process.env.PGPASSWORD || 'postgres';
  process.env.APP_PGUSER = process.env.APP_PGUSER || 'app_user';
  process.env.APP_PGPASSWORD = process.env.APP_PGPASSWORD || 'app_user_password';
  process.env.PLATFORM_ADMIN_PGUSER = process.env.PLATFORM_ADMIN_PGUSER || 'platform_admin_role';
  process.env.PLATFORM_ADMIN_PGPASSWORD =
    process.env.PLATFORM_ADMIN_PGPASSWORD || 'platform_admin_role_password';

  execSync('docker compose -f docker-compose.test.yml up -d --wait', {
    cwd: __dirname,
    stdio: 'inherit',
  });
  execSync('npx ts-node src/db/migrate.ts', {
    cwd: __dirname,
    stdio: 'inherit',
  });
};
