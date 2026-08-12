import { createApp } from './app';
import { getPool } from '../db/pool';
import { waitForPostgresReady } from '../db/postgresReadiness';

const port = Number(process.env.PORT ?? 3000);

/**
 * Story 1.10 (ADR-0016): refuse to start if Postgres isn't reachable,
 * rather than discovering it reactively on whichever request happens to
 * touch the database first. See .claude/skills/postgres-tenant-db/SKILL.md.
 */
async function main(): Promise<void> {
  try {
    await waitForPostgresReady(getPool());
  } catch (err) {
    console.error(`social-listening-core failed to start: ${(err as Error).message}`);
    process.exit(1);
  }

  createApp().listen(port, () => {
    console.log(`social-listening-core listening on :${port}`);
  });
}

main();
