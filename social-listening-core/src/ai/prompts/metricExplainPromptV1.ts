/**
 * Story 13.7 (ADR-0113): versioned prompt template v1 for POST /v1/explain.
 *
 * The prompt is a fixed, versioned string. A change to the template text, output
 * instructions, or confidence rules must bump PROMPT_VERSION and update the
 * corresponding cache-key component so existing cached entries are naturally
 * invalidated.
 */

export const METRIC_EXPLAIN_PROMPT_VERSION = 1;

/**
 * Fixed seed per prompt version. Passed to the Azure OpenAI chat/completions
 * API alongside temperature=0 so identical inputs produce materially the same
 * output for the lifetime of the cached entry.
 */
export const METRIC_EXPLAIN_SEED = 1000000 + METRIC_EXPLAIN_PROMPT_VERSION;

/** Default cache TTL in seconds. */
export const METRIC_EXPLAIN_DEFAULT_TTL_SECONDS = 300;

/** Optional per-metric TTL overrides. A missing metric falls back to the default. */
export const METRIC_EXPLAIN_TTL_OVERRIDES: Record<string, number> = {
  // v1 uses the 5-minute default for every metric. Add overrides here when a
  // metric is volatile enough to warrant a shorter TTL.
};

export interface MetricExplainPromptVars {
  metricName: string;
  value: number | string;
  previousValue?: number | string;
  start: string;
  end: string;
  context: string;
}

const METRIC_EXPLAIN_PROMPT_TEMPLATE = `You are a concise data analyst explaining a dashboard metric to a non-technical user.

Metric: {metricName}
Current value: {value}
Previous value: {previousValue}
Time range: {start} to {end}
Context: {context}

Explain in one to two sentences why this metric matters and what may have caused the current value.
Do not speculate beyond the data. Do not mention internal systems. Use the metric name and time range in your answer.
Confidence: high if the data is complete and the change is clear; medium if the data is partial; low if the data is too sparse to draw a conclusion.`;

/**
 * Renders the v1 prompt by replacing the fixed placeholders. Missing values
 * are replaced with a stable sentinel so the prompt shape does not change
 * between calls.
 */
export function renderMetricExplainPrompt(vars: MetricExplainPromptVars): string {
  return METRIC_EXPLAIN_PROMPT_TEMPLATE
    .replace(/{metricName}/g, vars.metricName)
    .replace(/{value}/g, String(vars.value))
    .replace(/{previousValue}/g, vars.previousValue !== undefined ? String(vars.previousValue) : 'not available')
    .replace(/{start}/g, vars.start)
    .replace(/{end}/g, vars.end)
    .replace(/{context}/g, vars.context || 'none');
}

/**
 * Structured output schema the model must return. Matches the response shape
 * consumed by MetricExplainabilityService.
 */
export const METRIC_EXPLAIN_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    explanation: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['explanation', 'confidence'],
  additionalProperties: false,
} as const;

/**
 * Returns the effective TTL for a metric. Falls back to the default when no
 * override is configured.
 */
export function getMetricExplainTtlSeconds(metricKey: string): number {
  return METRIC_EXPLAIN_TTL_OVERRIDES[metricKey] ?? METRIC_EXPLAIN_DEFAULT_TTL_SECONDS;
}
