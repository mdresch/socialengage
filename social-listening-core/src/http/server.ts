import 'dotenv/config';
import { createApp } from './app';
import { getPool } from '../db/pool';
import { waitForPostgresReady } from '../db/postgresReadiness';
import { bootstrapConnectors } from '../connectors/bootstrapConnectors';
import { startPollScheduler, isSchedulerEnabled } from '../scheduler/pollScheduler';
import { startPlatformMetricsWorker, isPlatformMetricsWorkerEnabled } from '../platform/platformMetricsWorker';

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

  // Story 1.13 (ADR-0052 Decision §3): must run before the scheduler's
  // first tick and before the HTTP listener starts accepting traffic —
  // otherwise listSocialConnectors() returns [] and the scheduler silently
  // does nothing. Deliberately never called from createApp() — see
  // .claude/skills/live-ingestion-polling-scheduler/SKILL.md.
  bootstrapConnectors();

  if (isSchedulerEnabled()) {
    startPollScheduler();
  }

  // Story 13.8 (ADR-0114): start the hourly platform metrics worker.
  if (isPlatformMetricsWorkerEnabled()) {
    startPlatformMetricsWorker();
  }

  createApp().listen(port, () => {
    console.log(`social-listening-core listening on :${port}`);
  });
}

main();
