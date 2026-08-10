// Fixture for story-1.4.persistent-local-dev-database.contract.test.ts — not a
// test itself (no *.contract.test.ts suffix, so Jest never collects it).
// Prints exactly what scripts/withDevEnv.js's child process actually received,
// as JSON on stdout, so the contract can assert on it precisely.
console.log(
  JSON.stringify({
    argv: process.argv.slice(2),
    PGPORT: process.env.PGPORT,
    PGDATABASE: process.env.PGDATABASE,
    APP_PGUSER: process.env.APP_PGUSER,
    TEST_ENV_MARKER: process.env.TEST_ENV_MARKER,
  })
);
