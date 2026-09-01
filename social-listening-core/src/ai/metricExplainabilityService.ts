import { randomUUID } from 'crypto';
import { getPool } from '../db/pool';
import { withTenant } from '../db/withTenant';
import { getLatestCredentialId, readCredential } from '../credentials/credentialStore';
import { isConnectorActive } from '../connectors/connectorActivationStore';
import { acquireForAiModel, QueueTtlExceededError, QueueDepthExceededError } from '../connectors/requestGate';
import { azureOpenAiConnector } from '../connectors/azureOpenAi/azureOpenAiConnector';
import { logPlatformAdminAction } from '../admin/platformAdminAuditLog';
import {
  METRIC_EXPLAIN_PROMPT_VERSION,
  METRIC_EXPLAIN_SEED,
  renderMetricExplainPrompt,
  getMetricExplainTtlSeconds,
} from './prompts/metricExplainPromptV1';
import {
  buildMetricExplanationCacheKey,
  getCachedMetricExplanation,
  storeMetricExplanationCache,
} from './metricExplanationCache';

export const ALLOWED_METRIC_KEYS: Record<string, string> = {
  'volume-spike': 'Volume Spike',
  'sentiment-share': 'Sentiment Share',
  'platform-mix': 'Platform Mix',
  'sentiment-negative-weekly': 'Negative Sentiment Weekly',
  'sentiment-positive-weekly': 'Positive Sentiment Weekly',
  'total-mentions': 'Total Mentions',
  'reach-estimate': 'Estimated Reach',
  'crisis-alert-radar': 'Crisis Alert Level',
  'top-authors-velocity': 'Top Authors Post Velocity',
};

export interface MetricExplainContext {
  widgetId?: string;
  watchlistId?: string;
  timeRange: { start: string; end: string };
  previousValue?: number | string;
  denominator?: number;
}

export interface MetricExplainRequest {
  metricKey: string;
  value: number | string;
  context: MetricExplainContext;
  locale?: string;
  noCache?: boolean;
}

export interface MetricExplainResponse {
  explanation: string | null;
  confidence: 'high' | 'medium' | 'low';
  generationId: string;
  promptVersion: number;
  cacheHit: boolean;
  fallbackReason?: 'content_filtered' | 'insufficient_data' | 'rate_limited' | 'model_error' | 'disabled';
}

export class MetricExplainError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

// In-memory rate limiting & concurrency trackers
const userRateLimits = new Map<string, number[]>(); // userId -> timestamps
const tenantInFlight = new Map<string, number>(); // tenantId -> current count

const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_CONCURRENT_PER_TENANT = 5;

/** Rate limiter per user (20 req/min). */
function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - 60000;
  let timestamps = userRateLimits.get(userId) || [];
  timestamps = timestamps.filter((t) => t > windowStart);
  if (timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    userRateLimits.set(userId, timestamps);
    return false;
  }
  timestamps.push(now);
  userRateLimits.set(userId, timestamps);
  return true;
}

/** Determines confidence deterministically based on data completeness. */
export function deriveConfidence(
  value: number | string,
  context: MetricExplainContext
): 'high' | 'medium' | 'low' {
  const hasValue = value !== undefined && value !== null && value !== '';
  const hasTimeRange = Boolean(context.timeRange?.start && context.timeRange?.end);
  const hasPrevious =
    context.previousValue !== undefined && context.previousValue !== null && context.previousValue !== '';
  const dataPoints = context.denominator;
  const hasDataPoints = typeof dataPoints === 'number' && dataPoints >= 30;
  const hasMediumData = dataPoints === undefined || (typeof dataPoints === 'number' && dataPoints >= 10);

  const hasClearChange = (() => {
    if (!hasPrevious) return false;
    if (typeof value === 'number' && typeof context.previousValue === 'number') {
      return Math.abs(value - context.previousValue) > 0;
    }
    return value !== context.previousValue;
  })();

  if (hasValue && hasTimeRange && hasPrevious && hasDataPoints && hasClearChange) {
    return 'high';
  }
  if (hasValue && hasTimeRange && hasMediumData) {
    return 'medium';
  }
  return 'low';
}

/** Checks whether explanations are enabled for the tenant under RLS context. */
export async function isExplanationsEnabledForTenant(tenantId: string): Promise<boolean> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ explanations_enabled: boolean }>(
      `SELECT explanations_enabled FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (rows.length === 0) return true; // default true if row not found yet in test
    return rows[0].explanations_enabled ?? true;
  });
}

/** Builds the user-facing context line that is inserted into the prompt. */
async function buildPromptContextString(
  tenantId: string,
  context: MetricExplainContext,
  locale: string
): Promise<string> {
  const parts: string[] = [];

  if (context.previousValue !== undefined) {
    parts.push(`previous value: ${context.previousValue}`);
  }
  if (context.denominator !== undefined) {
    parts.push(`denominator: ${context.denominator}`);
  }

  if (context.watchlistId) {
    const name = await getWatchlistName(tenantId, context.watchlistId);
    if (name) {
      parts.push(`watchlist: "${name}"`);
    }
  }

  if (locale && locale !== 'en') {
    parts.push(`locale: ${locale}`);
  }

  return parts.join('; ') || 'none';
}

/** Best-effort watchlist name resolution — never leaks the raw internal id to the prompt. */
async function getWatchlistName(tenantId: string, watchlistId: string): Promise<string | undefined> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ name: string }>(
      `SELECT name FROM watchlists WHERE id = $1`,
      [watchlistId]
    );
    return rows.length > 0 ? rows[0].name : undefined;
  });
}

/** Builds the filters object that participates in the SHA-256 cache key. */
function buildCacheFilters(request: MetricExplainRequest): Record<string, unknown> {
  const { context, locale } = request;
  return {
    previousValue: context.previousValue,
    denominator: context.denominator,
    watchlistId: context.watchlistId,
    widgetId: context.widgetId,
    locale: locale ?? 'en',
  };
}

/** Builds a fallback explanation when no AI provider is configured or the model fails. */
function buildFallbackExplanation(
  metricName: string,
  value: number | string,
  context: MetricExplainContext
): string {
  const start = context.timeRange.start;
  const end = context.timeRange.end;

  if (context.previousValue !== undefined) {
    const prev = context.previousValue;
    if (typeof value === 'number' && typeof prev === 'number') {
      const diff = value - prev;
      const dir = diff >= 0 ? 'increased' : 'decreased';
      const pct = prev > 0 ? Math.abs(Math.round((diff / prev) * 100)) : 0;
      return `${metricName} is currently ${value}, which ${dir} by ${pct}% compared to the prior period (${prev}) for the selected time window (${start} to ${end}).`;
    }
    return `${metricName} is currently ${value}, compared to ${prev} in the prior period for the selected time window (${start} to ${end}).`;
  }

  return `${metricName} recorded a current value of ${value} for the selected time window (${start} to ${end}).`;
}

/** Logs every explain call to platform_admin_audit_log with metricKey and cache_hit. */
async function logMetricExplainCall(
  tenantId: string,
  userId: string,
  metricKey: string,
  cacheHit: boolean,
  promptVersion: number,
  generationId: string
): Promise<void> {
  await logPlatformAdminAction(
    {
      actorIdentity: userId,
      operation: 'metric_explain',
      targetTenantId: tenantId,
      detail: {
        metricKey,
        cacheHit,
        promptVersion,
        generationId,
      },
    },
    getPool()
  );
}

/**
 * Validates input and executes the metric explanation.
 */
export async function explainMetric(
  tenantId: string,
  userId: string,
  request: MetricExplainRequest
): Promise<MetricExplainResponse> {
  const { metricKey, value, context, locale = 'en', noCache = false } = request;

  // 1. Metric key allowlist validation
  const metricName = ALLOWED_METRIC_KEYS[metricKey];
  if (!metricName) {
    throw new MetricExplainError(400, 'UNKNOWN_METRIC_KEY', `Metric key '${metricKey}' is not in the allowlist.`);
  }

  // 2. Value validation
  if (value === undefined || value === null) {
    throw new MetricExplainError(400, 'BAD_REQUEST', 'value is required.');
  }
  if (typeof value === 'string' && !/^[a-z0-9-]+$/i.test(value)) {
    throw new MetricExplainError(400, 'BAD_REQUEST', 'String values must match /^[a-z0-9-]+$/. ');
  }

  // 3. Context validation
  if (!context || typeof context !== 'object') {
    throw new MetricExplainError(400, 'BAD_REQUEST', 'context object is required.');
  }
  if (!context.timeRange || !context.timeRange.start || !context.timeRange.end) {
    throw new MetricExplainError(400, 'BAD_REQUEST', 'context.timeRange with start and end is required.');
  }
  if (context.previousValue !== undefined && typeof context.previousValue === 'string') {
    if (!/^[a-z0-9-]+$/i.test(context.previousValue)) {
      throw new MetricExplainError(400, 'BAD_REQUEST', 'context.previousValue string must match /^[a-z0-9-]+$/. ');
    }
  }
  if (context.denominator !== undefined && (typeof context.denominator !== 'number' || context.denominator < 1)) {
    throw new MetricExplainError(400, 'BAD_REQUEST', 'context.denominator must be a number >= 1 if supplied.');
  }

  // 4. Check tenant explanations kill switch
  const enabled = await isExplanationsEnabledForTenant(tenantId);
  if (!enabled) {
    throw new MetricExplainError(403, 'EXPLAINABILITY_DISABLED', 'Explainability is disabled for this tenant.');
  }

  // 5. Build cache key and check cache (unless no-cache requested)
  const promptContext = await buildPromptContextString(tenantId, context, locale);
  const cacheFilters = buildCacheFilters(request);
  const cacheKey = buildMetricExplanationCacheKey({
    tenantId,
    metricKey,
    value,
    timeRange: context.timeRange,
    filters: cacheFilters,
    promptVersion: METRIC_EXPLAIN_PROMPT_VERSION,
  });

  if (!noCache) {
    const cached = await getCachedMetricExplanation(tenantId, cacheKey);
    if (cached) {
      const response: MetricExplainResponse = {
        explanation: cached.explanation,
        confidence: cached.confidence,
        generationId: cached.generationId,
        promptVersion: cached.promptVersion,
        cacheHit: true,
      };
      await logMetricExplainCall(
        tenantId,
        userId,
        metricKey,
        true,
        METRIC_EXPLAIN_PROMPT_VERSION,
        cached.generationId
      );
      return response;
    }
  }

  // 6. User token bucket rate limit
  if (!checkUserRateLimit(userId)) {
    throw new MetricExplainError(429, 'TOO_MANY_REQUESTS', 'Rate limit exceeded: max 20 explanation requests per minute per user.');
  }

  // 7. Tenant concurrency limit
  const currentInFlight = tenantInFlight.get(tenantId) || 0;
  if (currentInFlight >= MAX_CONCURRENT_PER_TENANT) {
    throw new MetricExplainError(429, 'TOO_MANY_REQUESTS', 'Concurrency limit exceeded: max 5 in-flight explanations per tenant.');
  }
  tenantInFlight.set(tenantId, currentInFlight + 1);

  const generationId = randomUUID();
  let fallbackReason: MetricExplainResponse['fallbackReason'];
  let explanationText: string | null = null;
  let modelConfidence: 'high' | 'medium' | 'low' | undefined;

  try {
    const prompt = renderMetricExplainPrompt({
      metricName,
      value,
      previousValue: context.previousValue,
      start: context.timeRange.start,
      end: context.timeRange.end,
      context: promptContext,
    });

    // 8. Generate with Azure OpenAI when active
    let isAiActive = false;
    try {
      isAiActive = await isConnectorActive(tenantId, azureOpenAiConnector.providerId, 'tenant');
    } catch {
      isAiActive = false;
    }

    if (isAiActive) {
      const credentialId = await getLatestCredentialId(tenantId, azureOpenAiConnector.providerId, 'tenant');
      if (credentialId) {
        const credential = await readCredential(tenantId, credentialId);
        await acquireForAiModel(tenantId, azureOpenAiConnector, 'explain');

        if (azureOpenAiConnector.explain) {
          const aiRes = await azureOpenAiConnector.explain(prompt, credential, {
            seed: METRIC_EXPLAIN_SEED,
            promptVersion: METRIC_EXPLAIN_PROMPT_VERSION,
          });

          if (
            aiRes.explanation &&
            typeof aiRes.explanation === 'string' &&
            aiRes.explanation.trim().length > 0 &&
            ['high', 'medium', 'low'].includes(aiRes.confidence)
          ) {
            explanationText = aiRes.explanation.trim();
            modelConfidence = aiRes.confidence;
          } else {
            fallbackReason = 'model_error';
          }
        } else {
          fallbackReason = 'model_error';
        }
      } else {
        fallbackReason = 'insufficient_data';
      }
    }

    // 9. Fallback template-based explanation if AI is not configured or failed
    if (!explanationText) {
      if (!fallbackReason) {
        fallbackReason = 'insufficient_data';
      }
      explanationText = buildFallbackExplanation(metricName, value, context);
    }

    const confidence = modelConfidence ?? deriveConfidence(value, context);

    const response: MetricExplainResponse = {
      explanation: explanationText,
      confidence,
      generationId,
      promptVersion: METRIC_EXPLAIN_PROMPT_VERSION,
      cacheHit: false,
      fallbackReason,
    };

    // 10. Store in cache unless no-cache requested
    if (!noCache) {
      await storeMetricExplanationCache({
        tenantId,
        cacheKeyHash: cacheKey,
        metricKey,
        value,
        promptVersion: METRIC_EXPLAIN_PROMPT_VERSION,
        response,
        ttlSeconds: getMetricExplainTtlSeconds(metricKey),
      });
    }

    await logMetricExplainCall(tenantId, userId, metricKey, false, METRIC_EXPLAIN_PROMPT_VERSION, generationId);
    return response;
  } catch (err) {
    if (err instanceof QueueTtlExceededError || err instanceof QueueDepthExceededError) {
      throw new MetricExplainError(429, 'TOO_MANY_REQUESTS', 'AI request queue limit exceeded.');
    }
    if (err instanceof MetricExplainError) {
      throw err;
    }
    fallbackReason = 'model_error';
    const confidence = deriveConfidence(value, context);
    const response: MetricExplainResponse = {
      explanation: buildFallbackExplanation(metricName, value, context),
      confidence,
      generationId,
      promptVersion: METRIC_EXPLAIN_PROMPT_VERSION,
      cacheHit: false,
      fallbackReason,
    };
    if (!noCache) {
      await storeMetricExplanationCache({
        tenantId,
        cacheKeyHash: cacheKey,
        metricKey,
        value,
        promptVersion: METRIC_EXPLAIN_PROMPT_VERSION,
        response,
        ttlSeconds: getMetricExplainTtlSeconds(metricKey),
      });
    }
    await logMetricExplainCall(tenantId, userId, metricKey, false, METRIC_EXPLAIN_PROMPT_VERSION, generationId);
    return response;
  } finally {
    const remaining = Math.max(0, (tenantInFlight.get(tenantId) || 1) - 1);
    tenantInFlight.set(tenantId, remaining);
  }
}
