import { AIProviderConnector, AnalyzeResult, EnrichmentEntity } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';

export const AZURE_OPENAI_PROVIDER_ID = 'azure-openai';

/**
 * Confirmed directly against Microsoft Learn this session
 * (learn.microsoft.com/azure/foundry/openai/how-to/structured-outputs) —
 * API version 2024-08-01-preview is the first to support structured
 * outputs; this is a later, stable version that also supports it.
 */
const API_VERSION = '2024-10-21';

interface AzureOpenAiCredential {
  endpoint: string;
  key: string;
  /** The Azure OpenAI *deployment name* (not the underlying model name) — Azure OpenAI addresses models by deployment, not model id, in its URL path. */
  deployment: string;
}

/**
 * Same JSON-string-inside-one-opaque-credential pattern Azure AI Language
 * (Story 2.8) already established for a multi-part credential — no new
 * storage pattern (ADR-0014). A missing/malformed credential is a
 * credential-class failure (http_401), the same treatment a real 401 gets.
 */
function parseCredential(credential: string): AzureOpenAiCredential {
  let parsed: Partial<AzureOpenAiCredential>;
  try {
    parsed = JSON.parse(credential) as Partial<AzureOpenAiCredential>;
  } catch {
    throw new ClassifiableError('http_401', 'Azure OpenAI credential is not valid JSON (expected {endpoint, key, deployment}).');
  }
  if (!parsed.endpoint || !parsed.key || !parsed.deployment) {
    throw new ClassifiableError('http_401', 'Azure OpenAI credential is missing endpoint, key, or deployment.');
  }
  return parsed as AzureOpenAiCredential;
}

/**
 * A single JSON Schema returning all four enrichment fields at once —
 * realizing the single-call efficiency argument ADR-0038 Decision §2 named
 * as the reason an LLM-based second provider was wanted, in contrast to
 * Azure AI Language's four separate per-capability calls (Story 2.8).
 * Shape matches Azure OpenAI's documented structured-output subset:
 * `additionalProperties: false` and every property listed under
 * `required` (learn.microsoft.com/azure/ai-foundry/openai/how-to/
 * structured-outputs — "Supported schemas and limitations").
 */
const ENRICHMENT_SCHEMA = {
  type: 'object',
  properties: {
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'mixed'] },
    sentimentScores: {
      type: 'object',
      properties: {
        positive: { type: 'number' },
        neutral: { type: 'number' },
        negative: { type: 'number' },
      },
      required: ['positive', 'neutral', 'negative'],
      additionalProperties: false,
    },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          // Constrained to Azure AI Language's own real, documented
          // top-level NER category taxonomy (learn.microsoft.com/azure/
          // ai-services/language-service/named-entity-recognition/
          // concepts/named-entity-categories, fetched this session) —
          // deliberate, not left free-form: an unconstrained category
          // string would let this provider invent its own vocabulary
          // (e.g. "Company" vs Azure AI Language's real "Organization"),
          // which would undermine genuine cross-provider comparability,
          // the entire point of Story 2.9's swappability proof.
          category: {
            type: 'string',
            enum: [
              'Person',
              'PersonType',
              'Location',
              'Organization',
              'Event',
              'Product',
              'Skill',
              'Address',
              'PhoneNumber',
              'Email',
              'URL',
              'IP',
              'DateTime',
              'Quantity',
            ],
          },
          confidenceScore: { type: 'number' },
        },
        required: ['text', 'category', 'confidenceScore'],
        additionalProperties: false,
      },
    },
    keyPhrases: { type: 'array', items: { type: 'string' } },
    detectedLanguage: { type: 'string' },
    // Self-reported, post-self-review confidence in the *whole* answer —
    // deliberately a distinct field from entities[].confidenceScore, which
    // is per-entity. Named `overallConfidence` (not `confidenceScore`) so
    // it's never confused with Azure AI Language's own calibrated-
    // classifier probabilities — this is the model's own self-assessment,
    // not a statistically calibrated score. See AnalyzeResult's own doc
    // comment (types.ts) and ADR-0038's own Open Questions section, which
    // named exactly this fitness-for-purpose question before this field
    // existed to answer it.
    overallConfidence: { type: 'number' },
  },
  required: ['sentiment', 'sentimentScores', 'entities', 'keyPhrases', 'detectedLanguage', 'overallConfidence'],
  additionalProperties: false,
} as const;

interface ChatCompletionsResponse {
  model: string;
  choices: Array<{ message: { content: string } }>;
}

interface StructuredEnrichment {
  sentiment: AnalyzeResult['sentiment'];
  sentimentScores: AnalyzeResult['sentimentScores'];
  entities: Array<{ text: string; category: string; confidenceScore: number }>;
  keyPhrases: string[];
  detectedLanguage: string;
  overallConfidence: number;
}

async function callChatCompletions(
  endpoint: string,
  key: string,
  deployment: string,
  text: string
): Promise<ChatCompletionsResponse> {
  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${API_VERSION}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              'Extract sentiment, per-class sentiment scores, named entities, key phrases, and the detected ISO 639-1 language code from the given social/news post text. ' +
              'Before finalizing your answer, review it yourself: check that every entity actually appears in the text with the correct category from the allowed list, that sentimentScores are internally consistent with the chosen sentiment label, and that no key phrase or entity was fabricated or missed. ' +
              'Silently correct anything you find wrong during this review, then respond only via the provided JSON schema with the corrected, final result. ' +
              "Also report overallConfidence: your own honest confidence (0.0-1.0) in this final, corrected answer as a whole — 1.0 only if the text was clear and your extraction is unambiguous, lower if the text was short, ambiguous, sarcastic, or you had to guess on any field. Do not default to a high number; this score is used to decide whether to trust or discard your answer.",
          },
          { role: 'user', content: text },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'post_enrichment', strict: true, schema: ENRICHMENT_SCHEMA },
        },
      }),
    });
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach Azure OpenAI: ${(err as Error).message}`);
  }

  if (response.status === 401) throw new ClassifiableError('http_401', 'Azure OpenAI returned 401 (invalid key)');
  if (response.status === 403) throw new ClassifiableError('http_403', 'Azure OpenAI returned 403');
  if (response.status === 429) throw new ClassifiableError('rate_limit', 'Azure OpenAI returned 429 (rate limit exceeded)');
  if (response.status >= 500) throw new ClassifiableError('http_5xx', `Azure OpenAI returned ${response.status}`);
  if (!response.ok) {
    throw new ClassifiableError('network', `Azure OpenAI returned ${response.status}`);
  }

  return (await response.json()) as ChatCompletionsResponse;
}

/**
 * Azure OpenAI Service (Story 2.9, ADR-0038 §2/Amendment Log 2026-08-10) —
 * the second real AIProviderConnector, proving AIProviderConnector
 * swappability by real execution. See
 * .claude/skills/azure-openai-connector/SKILL.md.
 */
export const azureOpenAiConnector: AIProviderConnector = {
  providerId: AZURE_OPENAI_PROVIDER_ID,
  authMode: 'api_key',

  // Template default (ADR-0017-23 convention) — a single real HTTP call per
  // analyze() invocation (in contrast to Azure AI Language's four), so this
  // is deliberately a smaller number than azureAiLanguageConnector's own
  // 1,000/30-day default, not a scaled-up one; adjust once real per-tenant
  // volume and Azure OpenAI's own token-based rate limits (not request-
  // count-based) are reconciled — a genuine, named simplification, not
  // Azure OpenAI's real enforcement mechanism.
  getRateLimitConfig: () => ({ requestsPerWindow: 500, windowSeconds: 30 * 24 * 60 * 60 }),

  // listModels() returns the deployment name resolved from each call's own
  // credential at analyze() time — a real Azure OpenAI resource's actual
  // deployment name is tenant-credential-specific, not a fixed constant the
  // way Azure AI Language's single model id is. This placeholder id is used
  // only where a caller needs *a* model id before a credential is known
  // (e.g. requestGate's own per-model keying) — analyze() itself always
  // resolves the real deployment name from the supplied credential.
  listModels: () => ['azure-openai-deployment'],

  getModelRateLimit: () => ({ requestsPerWindow: 500, windowSeconds: 30 * 24 * 60 * 60 }),

  getModelCapabilities: () => ({
    supportsSentiment: true,
    supportsEntities: true,
    supportsKeyPhrases: true,
    supportsLanguageDetection: true,
  }),

  /**
   * `credential` is required in practice (no fallback to any project-level
   * key exists anywhere in this module, per ADR-0027) — the type keeps it
   * optional only to satisfy AIProviderConnector's own shared interface.
   */
  analyze: async (_modelId, text, credential) => {
    if (!credential) {
      throw new ClassifiableError('http_401', 'No Azure OpenAI credential supplied.');
    }
    const { endpoint, key, deployment } = parseCredential(credential);

    const response = await callChatCompletions(endpoint, key, deployment, text);
    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new ClassifiableError('network', 'Azure OpenAI returned no structured-output content.');
    }

    const structured = JSON.parse(content) as StructuredEnrichment;
    const entities: EnrichmentEntity[] = structured.entities.map((e) => ({
      text: e.text,
      category: e.category,
      confidenceScore: e.confidenceScore,
    }));

    const result: AnalyzeResult = {
      sentiment: structured.sentiment,
      sentimentScores: structured.sentimentScores,
      entities,
      keyPhrases: structured.keyPhrases,
      detectedLanguage: structured.detectedLanguage,
      overallConfidence: structured.overallConfidence,
      modelUsed: `${AZURE_OPENAI_PROVIDER_ID}:${deployment}`,
    };
    return result;
  },
};
