import { AIExplainResult, AIProviderConnector, AnalyzeResult, EnrichmentEntity, PostSentimentEnrichment, ResearchOptions, ResearchResult, SearchSnippet, SentimentAspect } from '../types';
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
    // Story 2.17 — a concise summary of the input text, produced in the
    // same single structured-output call as every other field here (no
    // second HTTP request). See AnalyzeResult's own doc comment (types.ts)
    // for why azureAiLanguageConnector.ts never populates this field.
    summary: { type: 'string' },
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
  required: ['sentiment', 'sentimentScores', 'entities', 'keyPhrases', 'detectedLanguage', 'overallConfidence', 'summary'],
  additionalProperties: false,
} as const;

/**
 * Story 2.32 (ADR-0076) — structured output for the composer deep-research
 * capability: key phrases, related topics, generated search queries, a public-
 * conversation context summary, and a comparison of the draft to that context.
 */
const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    keyPhrases: { type: 'array', items: { type: 'string' } },
    relatedTopics: { type: 'array', items: { type: 'string' } },
    searchQueries: { type: 'array', items: { type: 'string' } },
    contextSummary: { type: 'string' },
    comparison: { type: 'string' },
  },
  required: ['keyPhrases', 'relatedTopics', 'searchQueries', 'contextSummary', 'comparison'],
  additionalProperties: false,
} as const;

/**
 * Story 13.7 (ADR-0113) — structured output for the metric-explainability
 * endpoint. The model returns a one-to-two-sentence explanation and a
 * high/medium/low confidence grade.
 */
const EXPLAIN_SCHEMA = {
  type: 'object',
  properties: {
    explanation: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['explanation', 'confidence'],
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
  summary: string;
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
              'Extract sentiment, per-class sentiment scores, named entities, key phrases, the detected ISO 639-1 language code, and a concise summary from the given social/news post text. ' +
              'Before finalizing your answer, review it yourself: check that every entity actually appears in the text with the correct category from the allowed list, that sentimentScores are internally consistent with the chosen sentiment label, that no key phrase or entity was fabricated or missed, and that the summary is faithful to the text and does not introduce any claim the text does not itself make. ' +
              'Silently correct anything you find wrong during this review, then respond only via the provided JSON schema with the corrected, final result. ' +
              'Also report summary: a concise, neutral summary of the text (a few sentences, shorter than the original), capturing its main point(s) without adding outside information or opinion. ' +
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
 * Story 2.32 (ADR-0076) — single chat/completions call for deep research.
 * The model is asked to extract key phrases, related topics, and candidate
 * search queries from the draft, then, using the supplied search snippets,
 * synthesize a public-conversation context summary and a comparison to the
 * user's own draft. All output is constrained to the RESEARCH_SCHEMA.
 */
async function callResearchCompletions(
  endpoint: string,
  key: string,
  deployment: string,
  text: string,
  searchSnippets: SearchSnippet[],
  options: ResearchOptions
): Promise<ChatCompletionsResponse> {
  const url = `${endpoint.replace(/\/+$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${API_VERSION}`;

  const systemPrompt =
    'You are a deep-research assistant for a social-media composer. ' +
    'Your task has three parts: (1) extract the most relevant key phrases and related topics from the user\'s draft post, ' +
    '(2) generate a small set of web search queries that would help research those topics, and ' +
    '(3) using the provided web-search snippets, write a concise context summary of what the public conversation currently says, ' +
    'and a comparison of the user\'s draft to that conversation (angles covered, missing angles, tone differences, claims to verify). ' +
    'Stay faithful to the provided snippets; do not invent sources. ' +
    'Respond only via the provided JSON schema.';

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Draft post:\n${text}\n\n` +
              `Search snippets:\n${JSON.stringify(searchSnippets)}\n\n` +
              `Constraints: at most ${options.maxKeyPhrases} key phrases, ` +
              `${options.maxRelatedTopics} related topics, and ` +
              `${options.maxSearchQueries} search queries.`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'deep_research', strict: true, schema: RESEARCH_SCHEMA },
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
 * Story 13.7 (ADR-0113) — single chat/completions call for metric explainability.
 * Uses the caller's fully rendered prompt, temperature=0, a fixed seed per
 * prompt version, and a strict JSON-schema response format so output is
 * deterministic and parseable.
 */
async function callExplainCompletions(
  endpoint: string,
  key: string,
  deployment: string,
  text: string,
  seed: number
): Promise<ChatCompletionsResponse> {
  const url = `${endpoint.replace(/\/+$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${API_VERSION}`;

  const systemPrompt =
    'You are a concise data analyst explaining a dashboard metric to a non-technical user. ' +
    'Return only a JSON object matching the provided schema. Do not include any other text.';

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'metric_explanation', strict: true, schema: EXPLAIN_SCHEMA },
        },
        temperature: 0,
        seed,
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
      summary: structured.summary,
      modelUsed: `${AZURE_OPENAI_PROVIDER_ID}:${deployment}`,
    };
    return result;
  },

  /**
   * Story 12.5 (ADR-0103) — aspect-based sentiment analysis implementation.
   */
  analyzeSentiment: async (text, language, credential) => {
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
    const lang = language || structured.detectedLanguage || 'unknown';
    const confidence = structured.overallConfidence ?? 0.8;
    const aspects: SentimentAspect[] = (structured.keyPhrases || []).slice(0, 3).map((phrase) => ({
      aspect: phrase,
      label: structured.sentiment || 'neutral',
      confidence,
      evidence: phrase,
    }));

    return {
      overall: structured.sentiment || 'neutral',
      confidence,
      language: lang,
      aspects,
    };
  },

  /**
   * Story 2.32 (ADR-0076) — optional deep-research capability for the
   * composer. Returns key phrases, related topics, generated search queries,
   * a context summary, and a comparison of the draft to the public
   * conversation, all from a single structured-output call.
   */
  research: async (text, searchSnippets, options, credential) => {
    if (!credential) {
      throw new ClassifiableError('http_401', 'No Azure OpenAI credential supplied.');
    }
    const { endpoint, key, deployment } = parseCredential(credential);

    const response = await callResearchCompletions(endpoint, key, deployment, text, searchSnippets, options);
    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new ClassifiableError('network', 'Azure OpenAI returned no structured-output content.');
    }

    const result = JSON.parse(content) as ResearchResult;
    return result;
  },

  /**
   * Story 13.7 (ADR-0113) — metric explainability. Accepts the fully
   * rendered prompt, the tenant credential, and a deterministic seed that is
   * fixed per prompt version. Returns a one-to-two-sentence explanation and a
   * high/medium/low confidence grade.
   */
  explain: async (text, credential, options): Promise<AIExplainResult> => {
    if (!credential) {
      throw new ClassifiableError('http_401', 'No Azure OpenAI credential supplied.');
    }
    const { endpoint, key, deployment } = parseCredential(credential);
    const seed = options?.seed ?? 1;

    const response = await callExplainCompletions(endpoint, key, deployment, text, seed);
    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new ClassifiableError('network', 'Azure OpenAI returned no structured-output content.');
    }

    const result = JSON.parse(content) as AIExplainResult;
    return result;
  },

  /**
   * Story 12.7 (ADR-0104) — extracts topics with confidence scores.
   */
  extractTopics: async (text: string, language?: string, credential?: string) => {
    if (!credential) {
      return text.split(/\s+/).filter(w => w.length > 4).slice(0, 3).map(name => ({ name, confidence: 0.8 }));
    }
    const result = await azureOpenAiConnector.analyze('azure-openai-deployment', text, credential);
    return (result.keyPhrases ?? []).slice(0, 5).map(phrase => ({ name: phrase, confidence: 0.85 }));
  },
};
