const { execSync } = require('child_process');

/** Tears down the ephemeral test Postgres container after the suite finishes. */
module.exports = async function globalTeardown() {
  execSync('docker compose -f docker-compose.test.yml down -v', {
    cwd: __dirname,
    stdio: 'inherit',
  });
};
