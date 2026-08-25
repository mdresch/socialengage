import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Cross-process, cross-worktree mutex for contracts that must own a real, fixed,
 * Entra-registered port (Story 6.1's `next dev -p 3000`). Git worktree isolation
 * gives each concurrent agent its own filesystem and branch, but a fixed port and
 * the real Entra redirect URI it's registered under are host-wide, not per-worktree —
 * two agents both validating anything in epic-6 (whose local suite includes Story
 * 6.1's contract) would otherwise race for the same port. Lives in `os.tmpdir()`,
 * not this repo, so it's visible across every worktree checkout on the machine.
 *
 * Deliberately a plain lock file, not a new dependency or daemon — this project's
 * standing preference (see docs/implementation-methodology.md's Amendment Log) is
 * against standing up new permanent infrastructure for a gap that a small, direct
 * fix already covers.
 */

interface LockContents {
  pid: number;
  acquiredAt: string;
}

function lockPath(name: string): string {
  return path.join(os.tmpdir(), `socialengage-${name}.lock`);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock(file: string): LockContents | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as LockContents;
  } catch {
    return null;
  }
}

/**
 * Blocks until this process holds the named lock. If the current holder's PID is
 * no longer alive, or the lock is older than `staleAfterMs` (a crashed agent that
 * never reached its `finally`), the stale lock is reclaimed rather than waited out —
 * this is the real safety net, since a hard `taskkill`/SIGKILL on the lock holder
 * skips any JS-level release-on-exit handler entirely.
 */
export async function acquireDevServerLock(
  name: string,
  opts: { maxWaitMs?: number; staleAfterMs?: number } = {}
): Promise<void> {
  const maxWaitMs = opts.maxWaitMs ?? 180_000;
  const staleAfterMs = opts.staleAfterMs ?? 10 * 60_000;
  const file = lockPath(name);
  const deadline = Date.now() + maxWaitMs;

  for (;;) {
    try {
      const fd = fs.openSync(file, 'wx');
      const contents: LockContents = { pid: process.pid, acquiredAt: new Date().toISOString() };
      fs.writeSync(fd, JSON.stringify(contents));
      fs.closeSync(fd);
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }

    const held = readLock(file);
    if (held) {
      const age = Date.now() - new Date(held.acquiredAt).getTime();
      if (!isPidAlive(held.pid) || age > staleAfterMs) {
        try {
          fs.unlinkSync(file);
        } catch {
          // another process already reclaimed it — loop and retry the open
        }
        continue;
      }
    }

    if (Date.now() > deadline) {
      throw new Error(
        `Timed out after ${maxWaitMs}ms waiting for dev-server lock "${name}" (held by pid ${held?.pid ?? 'unknown'}).`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
  }
}

/** No-op if this process doesn't hold the lock (already reclaimed as stale, or never acquired). */
export function releaseDevServerLock(name: string): void {
  const file = lockPath(name);
  const held = readLock(file);
  if (!held || held.pid !== process.pid) return;
  try {
    fs.unlinkSync(file);
  } catch {
    // already gone
  }
}
