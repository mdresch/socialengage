const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_CONTEXT_FILE = path.join(__dirname, `.jest-test-db-${process.pid}.json`);

/**
 * Drops only this specific test run's isolated database.
 * Leaves the shared test Postgres container running so other concurrent
 * autonomous agents remain completely unaffected.
 */
module.exports = async function globalTeardown() {
  if (!fs.existsSync(DB_CONTEXT_FILE)) return;

  let testDbName = '';
  try {
    const ctx = JSON.parse(fs.readFileSync(DB_CONTEXT_FILE, 'utf8'));
    testDbName = ctx.testDbName;
  } catch {
    return;
  }

  if (!testDbName || !testDbName.startsWith('test_run_')) return;

  try {
    const client = new Client({
      host: '127.0.0.1',
      port: 5434,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
    });
    await client.connect();

    // Short pause to allow Jest workers to gracefully finish socket closes
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Terminate any remaining connections to this test db
    await client.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = '${testDbName}' AND pid <> pg_backend_pid()
    `);

    // Drop test database
    await client.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    await client.end();
  } catch (err) {
    console.error(`Warning: Failed to drop test database ${testDbName}:`, err.message);
  } finally {
    try {
      fs.unlinkSync(DB_CONTEXT_FILE);
    } catch {
      // ignore
    }
  }
};
