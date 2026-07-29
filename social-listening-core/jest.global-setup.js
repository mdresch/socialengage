const { execSync } = require('child_process');

/**
 * Brings up the ephemeral test Postgres container and applies migrations
 * before the contract suite runs. Requires Docker to be running locally.
 * Env vars set here propagate to Jest's test-file workers (Jest forks them
 * after globalSetup completes) — see .claude/skills/postgres-tenant-db/SKILL.md.
 */
module.exports = async function globalSetup() {
  process.env.PGHOST = process.env.PGHOST || 'localhost';
  process.env.PGPORT = '5434';
  process.env.PGDATABASE = process.env.PGDATABASE || 'social_listening_test';
  process.env.PGUSER = process.env.PGUSER || 'postgres';
  process.env.PGPASSWORD = process.env.PGPASSWORD || 'postgres';
  process.env.APP_PGUSER = process.env.APP_PGUSER || 'app_user';
  process.env.APP_PGPASSWORD = process.env.APP_PGPASSWORD || 'app_user_password';

  execSync('docker compose -f docker-compose.test.yml up -d --wait', {
    cwd: __dirname,
    stdio: 'inherit',
  });
  execSync('npx ts-node src/db/migrate.ts', {
    cwd: __dirname,
    stdio: 'inherit',
  });
};
