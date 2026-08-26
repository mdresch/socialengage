const path = require('path');
const dotenv = require('dotenv');
const { spawn } = require('child_process');

/**
 * Runs the given command (as separate argv entries, not a rejoined string —
 * see 2026-07-30 correction below) with the dev database's connection env
 * vars set — a plain Node script rather than shell `export`/`$env:` so the
 * same npm script works unmodified from bash or PowerShell. Mirrors
 * jest.global-setup.js's own "set env vars in JS, not the shell" pattern.
 * See docker-compose.dev.yml and README.md.
 *
 * 2026-07-30 correction: originally used execSync() on a re-joined
 * `argv.slice(2).join(' ')` string. Two real bugs, found while first wiring
 * this up: (1) joining argv back into one string and handing it to execSync
 * (which re-parses it through a shell) breaks any argument containing a
 * space or quote — argv had already been split once by the outer shell, so
 * rejoining-then-reparsing is lossy; (2) execSync blocks synchronously until
 * the child exits, which is the wrong model for a server that's meant to
 * keep running (`npm run dev`) — on Windows, going through execSync's shell
 * plus an `npx` middle-man left the actual long-running ts-node process
 * unreachable from the wrapper's own env in practice. spawn() with an argv
 * array (no rejoining) plus forwarding its exit code fixes both.
 *
 * 2026-08-10 healing (Story 1.4) — a real, discovered gap: this script
 * never loaded .env at all, only jest.global-setup.js did (test-only).
 * `npm run dev`'s real server never received ENTRA_*, GNEWS_API_KEY,
 * AZURE_*, or PORT from .env, only this file's own hardcoded Postgres
 * vars — found
 * while actually running `npm run dev` against the persistent dev database
 * for the first time. Loaded from this file's own directory's parent (the
 * repo root), not `process.cwd()` — deterministic regardless of the
 * caller's own working directory, the same principle the forced Postgres
 * vars below already establish. `WITH_DEV_ENV_DOTENV_PATH` is a test-only
 * override (story-1.4's own contract points it at a fixture .env) — never
 * set by any real npm script.
 */
dotenv.config({ path: process.env.WITH_DEV_ENV_DOTENV_PATH || path.join(__dirname, '..', '.env'), quiet: true });

// Forced, not `process.env.X || default` — the whole point of this wrapper
// is that `npm run dev`/`db:dev:migrate` deterministically point at the dev
// database no matter what's already in the caller's shell or .env. A `||`
// fallback here would mean a stray PGDATABASE/PGUSER/etc. already set
// globally (a real, easy-to-hit case for anyone with more than one Postgres
// project) silently overrides the dev target instead of the reverse —
// caught by story-1.4's own contract test asserting exactly this, now
// re-proven against a conflicting .env value too, not just a shell one.
//
// WITH_DEV_ENV_RESPECT_PG=1 opts out of the forced PG vars — used by
// cross-repo contract tests (e.g. Story 6.1) that spawn `npm run dev` with
// their own isolated test-DB clone on a different port, where the forced
// dev defaults would point at the wrong database.
const respectPg = process.env.WITH_DEV_ENV_RESPECT_PG === '1';
const pg = respectPg
  ? {
      PGHOST: process.env.PGHOST ?? 'localhost',
      PGPORT: process.env.PGPORT ?? '5435',
      PGDATABASE: process.env.PGDATABASE ?? 'social_listening_dev',
      PGUSER: process.env.PGUSER ?? 'postgres',
      PGPASSWORD: process.env.PGPASSWORD ?? 'postgres',
      APP_PGUSER: process.env.APP_PGUSER ?? 'app_user',
      APP_PGPASSWORD: process.env.APP_PGPASSWORD ?? 'app_user_password',
    }
  : {
      PGHOST: 'localhost',
      PGPORT: '5435',
      PGDATABASE: 'social_listening_dev',
      PGUSER: 'postgres',
      PGPASSWORD: 'postgres',
      APP_PGUSER: 'app_user',
      APP_PGPASSWORD: 'app_user_password',
    };
const env = {
  ...process.env,
  ...pg,
};

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node scripts/withDevEnv.js <command> [args...]');
  process.exit(1);
}

// Resolving a PATH-based command name (ts-node) needs a shell on Windows
// (.cmd shims) — but Node deprecates (DEP0190) shell:true combined with an
// args *array* (unescaped concatenation). The safe form is shell:true with
// one pre-joined string; args here are our own package.json-controlled
// values (project-relative file paths), not external input, so simple
// double-quoting is sufficient. POSIX needs no shell at all — spawn()
// already does its own PATH lookup for a bare command name.
const child =
  process.platform === 'win32'
    ? spawn([command, ...args.map((a) => `"${a}"`)].join(' '), { stdio: 'inherit', env, shell: true })
    : spawn(command, args, { stdio: 'inherit', env });

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
