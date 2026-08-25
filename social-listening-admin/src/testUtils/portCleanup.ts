import { execSync } from 'child_process';

/**
 * `taskkill /PID <pid> /T /F` on the immediate child of a `spawn(..., { shell: true })`
 * chain (npm -> npm -> node, on Windows) does not reliably reap the whole tree —
 * confirmed directly (2026-08-24): a Story 6.1 run reported all ACs passing, yet
 * ports 3000/3001 were still held by live processes afterward. That's dangerous
 * specifically because of devServerLock: the lock is released as soon as `afterAll`
 * finishes, and a second agent that then acquires it will hit EADDRINUSE anyway if
 * the port didn't actually free up — the lock would be lying about what it guards.
 * This polls for the port to actually clear and, failing that, kills whichever
 * process is really holding the socket directly rather than trusting the PID this
 * file spawned it under.
 */
export async function ensurePortsFree(ports: number[], timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const holders = findListeningPids(ports);
    if (holders.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const holders = findListeningPids(ports);
  if (holders.length === 0) return;

  for (const pid of holders) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'pipe' });
      } else {
        execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
      }
    } catch {
      // already gone between the check and the kill
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
  const stillHeld = findListeningPids(ports);
  if (stillHeld.length > 0) {
    console.error(
      `WARNING: ports ${ports.join(', ')} still held by pid(s) ${stillHeld.join(', ')} after cleanup — ` +
        `releasing the dev-server lock anyway (holding it forever would just trade one failure mode for another), ` +
        `but the next run may hit EADDRINUSE. Investigate the leftover process manually.`
    );
  }
}

function findListeningPids(ports: number[]): number[] {
  try {
    if (process.platform === 'win32') {
      const portList = ports.join(',');
      const out = execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${portList} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`,
        { stdio: 'pipe' }
      ).toString();
      return [...new Set(out.split(/\s+/).filter(Boolean).map(Number).filter((n) => n > 0))];
    }
    const out = execSync(`lsof -ti ${ports.map((p) => `:${p}`).join(' ')}`, { stdio: 'pipe' }).toString();
    return [...new Set(out.split(/\s+/).filter(Boolean).map(Number).filter((n) => n > 0))];
  } catch {
    // no matches (lsof/PowerShell both exit non-zero on empty results) — port is free
    return [];
  }
}
