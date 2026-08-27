import { randomUUID } from 'crypto';
import { getPool } from '../db/pool';
import { withTenant } from '../db/withTenant';
import { getLatestCredentialId, readCredential } from '../credentials/credentialStore';
import { isConnectorActive } from '../connectors/connectorActivationStore';
import { acquireForAiModel, QueueTtlExceededError, QueueDepthExceededError } from '../connectors/requestGate';
import { azureOpenAiConnector } from '../connectors/azureOpenAi/azureOpenAiConnector';

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
}

export interface MetricExplainResponse {
  explanation: string | null;
  confidence: 'high' | 'medium' | 'low';
  generationId: string;
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

// In-process 5-minute cache
interface CacheEntry {
  data: MetricExplainResponse;
  expiresAt: number;
}
const explanationCache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_CONCURRENT_PER_TENANT = 5;

/** Cleans expired cache entries periodically. */
function pruneExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of explanationCache.entries()) {
    if (entry.expiresAt <= now) {
      explanationCache.delete(key);
    }
  }
}

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

/** Determines confidence deterministically based on context completeness. */
export function deriveConfidence(
  value: number | string,
  context: MetricExplainContext
): 'high' | 'medium' | 'low' {
  const hasValue = value !== undefined && value !== null && value !== '';
  const hasTimeRange = Boolean(context.timeRange?.start && context.timeRange?.end);
  const hasPrevious = context.previousValue !== undefined && context.previousValue !== null && context.previousValue !== '';
  const denominatorValid = context.denominator === undefined || context.denominator >= 100;

  if (hasValue && hasTimeRange && hasPrevious && denominatorValid) {
    return 'high';
  }
  if (hasValue && hasTimeRange) {
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

/**
 * Validates input and executes the metric explanation.
 */
export async function explainMetric(
  tenantId: string,
  userId: string,
  request: MetricExplainRequest
): Promise<MetricExplainResponse> {
  const { metricKey, value, context, locale = 'en' } = request;

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
    throw new MetricExplainError(400, 'BAD_REQUEST', 'String values must match /^[a-z0-9-]+$/.');
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
      throw new MetricExplainError(400, 'BAD_REQUEST', 'context.previousValue string must match /^[a-z0-9-]+$/.');
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

  // 5. Check in-process cache
  pruneExpiredCache();
  const cacheKey = `${tenantId}:${metricKey}:${value}:${context.previousValue ?? ''}:${context.denominator ?? ''}:${context.timeRange.start}:${context.timeRange.end}:${locale}`;
  const cached = explanationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
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
  const confidence = deriveConfidence(value, context);

  try {
    // Generate explanation
    let explanationText: string | null = null;
    let fallbackReason: MetricExplainResponse['fallbackReason'];

    // Check if Azure OpenAI is active for real generation
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
        await acquireForAiModel(tenantId, azureOpenAiConnector, 'research');

        const prompt = JSON.stringify({
          task: 'Explain the following metric in 1-2 plain-language sentences without speculation.',
          metricName,
          value,
          previousValue: context.previousValue,
          denominator: context.denominator,
          timeRange: context.timeRange,
          locale,
        });

        const aiRes = await azureOpenAiConnector.research!(
          prompt,
          [],
          { maxKeyPhrases: 3, maxRelatedTopics: 3, maxSearchQueries: 1 },
          credential
        );
        explanationText = aiRes.contextSummary || aiRes.comparison || null;
      }
    }

    // Fallback template-based explanation if AI connector is not configured or in test mode
    if (!explanationText) {
      if (context.previousValue !== undefined) {
        const prev = context.previousValue;
        if (typeof value === 'number' && typeof prev === 'number') {
          const diff = value - prev;
          const dir = diff >= 0 ? 'increased' : 'decreased';
          const pct = prev > 0 ? Math.abs(Math.round((diff / prev) * 100)) : 0;
          explanationText = `${metricName} is currently ${value}, which ${dir} by ${pct}% compared to the prior period (${prev}).`;
        } else {
          explanationText = `${metricName} is currently ${value}, compared to ${prev} in the prior period.`;
        }
      } else {
        explanationText = `${metricName} recorded a current value of ${value} for the selected time window.`;
      }
    }

    const response: MetricExplainResponse = {
      explanation: explanationText,
      confidence,
      generationId,
      fallbackReason,
    };

    // Store in cache
    explanationCache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return response;
  } finally {
    const remaining = Math.max(0, (tenantInFlight.get(tenantId) || 1) - 1);
    tenantInFlight.set(tenantId, remaining);
  }
}
