import { AIProviderConnector, ProviderConnector, RateLimitConfig, SocialConnector } from './types';
import { resolveRateLimitConfig } from './rateLimitResolution';

interface GateState {
  remaining: number;
  windowResetAt: number;
}

const state = new Map<string, GateState>();
/** Serializes acquisitions per key so a shared bucket's state is never raced. */
const keyLocks = new Map<string, Promise<unknown>>();

/** Story 2.4 (ADR-0020) — real-world defaults; overridable per call for tests. */
const DEFAULT_QUEUE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_QUEUE_DEPTH = 1000;

/** Requests currently queued (waiting or actively acquiring) per key — Story 2.4's depth ceiling. */
const queueDepth = new Map<string, number>();

/**
 * A request that could not be dispatched within its queue TTL — abandoned,
 * not delivered stale (ADR-0020). The caller (a connector's attempt(), the
 * same way it already throws ClassifiableError for platform failures) is
 * responsible for reclassifying this into a ClassifiableError so
 * runIngestionAttempt() records it via the owning IngestionRun — RequestGate
 * itself has no ingestion-domain knowledge. See
 * .claude/skills/provider-connector-framework/SKILL.md.
 */
export class QueueTtlExceededError extends Error {
  constructor(
    public readonly key: string,
    public readonly ttlMs: number
  ) {
    super(`Rate-limit queue wait for '${key}' exceeded its TTL (${ttlMs}ms); request abandoned.`);
    this.name = 'QueueTtlExceededError';
  }
}

/** A request rejected outright because its key's queue was already at its depth ceiling (ADR-0020) — never queued at all. */
export class QueueDepthExceededError extends Error {
  constructor(
    public readonly key: string,
    public readonly maxDepth: number
  ) {
    super(`Rate-limit queue for '${key}' is at its depth ceiling (${maxDepth}); request rejected.`);
    this.name = 'QueueDepthExceededError';
  }
}

export interface AcquireOptions {
  /** Overrides DEFAULT_QUEUE_TTL_MS — test-only in practice; real callers get ADR-0020's 6h default. */
  queueTtlMs?: number;
  /** Overrides DEFAULT_MAX_QUEUE_DEPTH — test-only in practice; real callers get ADR-0020's 1,000 default. */
  maxQueueDepth?: number;
}

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

async function acquireOnce(key: string, config: RateLimitConfig, enqueuedAt: number, ttlMs: number): Promise<void> {
  const elapsedMs = Date.now() - enqueuedAt;
  if (elapsedMs >= ttlMs) {
    throw new QueueTtlExceededError(key, ttlMs);
  }

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
  // reject/drop for exceeding the *rate*. Sleep only up to the remaining TTL
  // budget, not the full time-to-reset, so a TTL shorter than the reset
  // window is actually checked promptly rather than only after an
  // arbitrarily long single sleep completes.
  // See .claude/skills/provider-connector-framework/SKILL.md.
  const waitMs = Math.max(0, s.windowResetAt - nowMs);
  const remainingTtlMs = ttlMs - elapsedMs;
  await sleep(Math.min(waitMs, remainingTtlMs));
  return acquireOnce(key, config, enqueuedAt, ttlMs);
}

/**
 * Gates a request under an arbitrary key (tenantId:providerId, or +modelId
 * for AI). Bounded (Story 2.4, ADR-0020): rejects immediately with
 * QueueDepthExceededError once the key's queue is at its depth ceiling, and
 * abandons (QueueTtlExceededError) a wait that exceeds its TTL rather than
 * waiting forever.
 */
export async function acquire(key: string, config: RateLimitConfig, options: AcquireOptions = {}): Promise<void> {
  const maxQueueDepth = options.maxQueueDepth ?? DEFAULT_MAX_QUEUE_DEPTH;
  const depth = queueDepth.get(key) ?? 0;
  if (depth >= maxQueueDepth) {
    throw new QueueDepthExceededError(key, maxQueueDepth);
  }

  queueDepth.set(key, depth + 1);
  const enqueuedAt = Date.now();
  const ttlMs = options.queueTtlMs ?? DEFAULT_QUEUE_TTL_MS;
  try {
    return await withKeyLock(key, () => acquireOnce(key, config, enqueuedAt, ttlMs));
  } finally {
    queueDepth.set(key, Math.max(0, (queueDepth.get(key) ?? 1) - 1));
  }
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

export function outboundKey(tenantId: string, connector: ProviderConnector): string {
  return `${tenantId}:${connector.providerId}:outbound`;
}

/** Gates per (tenantId, providerId, 'outbound') — separate from ingestion polls (ADR-0073). */
export async function acquireForOutbound(tenantId: string, connector: SocialConnector): Promise<void> {
  const key = outboundKey(tenantId, connector);
  const config = connector.getOutboundRateLimitConfig?.() ?? connector.getRateLimitConfig();
  return acquire(key, config);
}

export function outboundPostKey(tenantId: string, connector: ProviderConnector): string {
  return `${tenantId}:${connector.providerId}:outbound_post`;
}

/** Gates per (tenantId, providerId, 'outbound_post') — separate from replies and from ingestion (ADR-0075). */
export async function acquireForOutboundPost(tenantId: string, connector: SocialConnector): Promise<void> {
  const key = outboundPostKey(tenantId, connector);
  const config = connector.getOutboundRateLimitConfig?.() ?? connector.getRateLimitConfig();
  return acquire(key, config);
}

export function searchKey(tenantId: string, connector: { providerId: string }): string {
  return `${tenantId}:${connector.providerId}:search`;
}

/**
 * Story 14.3 (ADR-0120 §4) — Gates per (tenantId, providerId, 'search'),
 * separate from ingestion, outbound, and research gates.
 */
export async function acquireForSearch(
  tenantId: string,
  connector: {
    providerId: string;
    getSearchRateLimitConfig?(): RateLimitConfig;
    getRateLimitConfig?(): RateLimitConfig;
  }
): Promise<void> {
  const key = searchKey(tenantId, connector);
  const config =
    connector.getSearchRateLimitConfig?.() ??
    connector.getRateLimitConfig?.() ?? {
      requestsPerWindow: 2000,
      windowSeconds: 30 * 86400,
    };
  return acquire(key, config);
}


/** Test-only: isolates contract tests that would otherwise share gate state by key collision. */
export function __resetGateForTests(): void {
  state.clear();
  keyLocks.clear();
  queueDepth.clear();
}

/**
 * Story 9.1 (ADR-0077 §5) — a non-consuming read of a key's remaining
 * rate-limit budget, used by the preview controller's `quota_risk`
 * pre-check. Unlike `acquire()`, it never decrements `remaining` and never
 * queues: it reports the current window state so the controller can decide
 * whether a preview call would consume too much of the remaining budget
 * before spending any of it. Returns `remaining: 0` for a key with no
 * prior acquisitions in this window only when the config itself is zero;
 * otherwise a fresh window is reported at its full `requestsPerWindow`.
 */
export function checkAvailability(key: string, config: RateLimitConfig): { remaining: number } {
  const nowMs = Date.now();
  let s = state.get(key);
  if (!s || nowMs >= s.windowResetAt) {
    return { remaining: config.requestsPerWindow };
  }
  return { remaining: s.remaining };
}

/**
 * Story 9.1 (ADR-0077 §5) — the per-(tenantId, providerId) convenience
 * wrapper around `checkAvailability`, mirroring `acquireForProvider()`'s
 * keying. The preview controller calls this before executing a connector's
 * `count?()` / `sample?()` to raise the `quota_risk` warning when the
 * preview would consume more than 80% of the remaining budget.
 */
export function checkProviderAvailability(
  tenantId: string,
  connector: ProviderConnector
): { remaining: number } {
  const key = socialConnectorKey(tenantId, connector);
  const config = resolveRateLimitConfig(connector);
  return checkAvailability(key, config);
}
