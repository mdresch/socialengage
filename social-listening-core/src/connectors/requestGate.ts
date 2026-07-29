import { AIProviderConnector, ProviderConnector, RateLimitConfig } from './types';
import { resolveRateLimitConfig } from './rateLimitResolution';

interface GateState {
  remaining: number;
  windowResetAt: number;
}

const state = new Map<string, GateState>();
/** Serializes acquisitions per key so a shared bucket's state is never raced. */
const keyLocks = new Map<string, Promise<unknown>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = keyLocks.get(key) ?? Promise.resolve();
  const run = prior.then(fn, fn);
  keyLocks.set(
    key,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

async function acquireOnce(key: string, config: RateLimitConfig): Promise<void> {
  const nowMs = Date.now();
  let s = state.get(key);
  if (!s || nowMs >= s.windowResetAt) {
    s = { remaining: config.requestsPerWindow, windowResetAt: nowMs + config.windowSeconds * 1000 };
    state.set(key, s);
  }

  if (s.remaining > 0) {
    s.remaining -= 1;
    return;
  }

  // Exhausted this window: queue and retry after reset (ADR-0003) — never
  // reject/drop. See .claude/skills/provider-connector-framework/SKILL.md.
  const waitMs = Math.max(0, s.windowResetAt - nowMs);
  await sleep(waitMs);
  return acquireOnce(key, config);
}

/** Gates a request under an arbitrary key (tenantId:providerId, or +modelId for AI). */
export async function acquire(key: string, config: RateLimitConfig): Promise<void> {
  return withKeyLock(key, () => acquireOnce(key, config));
}

export function socialConnectorKey(tenantId: string, connector: ProviderConnector): string {
  return `${tenantId}:${connector.providerId}`;
}

export function aiModelKey(tenantId: string, connector: AIProviderConnector, modelId: string): string {
  return `${tenantId}:${connector.providerId}:${modelId}`;
}

/** Gates per (tenantId, providerId) (ADR-0003), live headers taking priority over static config. */
export async function acquireForProvider(
  tenantId: string,
  connector: ProviderConnector,
  liveHeaders?: Record<string, string>
): Promise<void> {
  const key = socialConnectorKey(tenantId, connector);
  const config = resolveRateLimitConfig(connector, liveHeaders);
  return acquire(key, config);
}

/** Gates per (tenantId, providerId, modelId) — AI enrichment is one level more granular than social connectors. */
export async function acquireForAiModel(
  tenantId: string,
  connector: AIProviderConnector,
  modelId: string,
  liveHeaders?: Record<string, string>
): Promise<void> {
  const key = aiModelKey(tenantId, connector, modelId);
  const declared = connector.getModelRateLimit(modelId);
  const live = liveHeaders && connector.parseRateLimitHeaders
    ? connector.parseRateLimitHeaders(liveHeaders)
    : undefined;
  return acquire(key, { ...declared, ...live });
}

/** Test-only: isolates contract tests that would otherwise share gate state by key collision. */
export function __resetGateForTests(): void {
  state.clear();
  keyLocks.clear();
}
