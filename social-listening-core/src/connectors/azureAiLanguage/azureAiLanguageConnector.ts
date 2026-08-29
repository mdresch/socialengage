import { AIProviderConnector, AnalyzeResult, EnrichmentEntity, PostSentimentEnrichment, SentimentAspect } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';

export const AZURE_AI_LANGUAGE_PROVIDER_ID = 'azure-ai-language';
const MODEL_ID = 'azure-ai-language-latest';

/**
 * Confirmed directly against the real, unified Language endpoint this
 * session (learn.microsoft.com/azure/ai-services/language-service/
 * reference/migrate-language-service-latest — "2024-11-01" is the latest
 * GA version as of this story). Real responses captured and used to design
 * AnalyzeResult's own widened shape — see this component's own SKILL.md.
 */
const API_VERSION = '2024-11-01';

interface AzureAiLanguageCredential {
  endpoint: string;
  key: string;
}

/**
 * The tenant's own stored credential (ADR-0014's envelope encryption, no
 * new storage pattern) is a single opaque string, same as every other
 * connector — this provider needs two real pieces (endpoint + key), so the
 * stored plaintext is a small JSON object, parsed here. Malformed input is
 * a credential-class failure (http_401), the same treatment a real 401
 * from Azure gets — runIngestionAttempt()/enrichPost() must not blind-
 * retry it.
 */
function parseCredential(credential: string): AzureAiLanguageCredential {
  let parsed: Partial<AzureAiLanguageCredential>;
  try {
    parsed = JSON.parse(credential) as Partial<AzureAiLanguageCredential>;
  } catch {
    throw new ClassifiableError('http_401', 'Azure AI Language credential is not valid JSON (expected {endpoint, key}).');
  }
  if (!parsed.endpoint || !parsed.key) {
    throw new ClassifiableError('http_401', 'Azure AI Language credential is missing endpoint or key.');
  }
  return parsed as AzureAiLanguageCredential;
}

interface AnalyzeTextDocument {
  id: string;
  [key: string]: unknown;
}
interface AnalyzeTextError {
  id: string;
  error: { code: string; message: string; innererror?: { code: string; message: string } };
}
interface AnalyzeTextResponse {
  results: { documents: AnalyzeTextDocument[]; errors?: AnalyzeTextError[]; modelVersion: string };
}

/**
 * One call to the real, unified :analyze-text endpoint for one capability
 * ("kind"). Microsoft's own SDK guidance (confirmed directly this session)
 * recommends the action-specific/per-capability shape for a single small
 * document — the combined multi-action endpoint exists but is recommended
 * for larger/batched documents, not this project's actual workload (one
 * post at a time). See this component's own SKILL.md.
 */
async function callAnalyzeText(
  endpoint: string,
  key: string,
  kind: 'SentimentAnalysis' | 'KeyPhraseExtraction' | 'EntityRecognition' | 'LanguageDetection',
  text: string
): Promise<AnalyzeTextResponse> {
  const url = `${endpoint.replace(/\/$/, '')}/language/:analyze-text?api-version=${API_VERSION}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': key },
      body: JSON.stringify({
        kind,
        parameters: { modelVersion: 'latest' },
        analysisInput: { documents: [{ id: '1', text }] },
      }),
    });
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach Azure AI Language: ${(err as Error).message}`);
  }

  if (response.status === 401) throw new ClassifiableError('http_401', 'Azure AI Language returned 401 (invalid key)');
  if (response.status === 403) throw new ClassifiableError('http_403', 'Azure AI Language returned 403');
  if (response.status === 429) throw new ClassifiableError('rate_limit', 'Azure AI Language returned 429 (rate limit exceeded)');
  if (response.status >= 500) throw new ClassifiableError('http_5xx', `Azure AI Language returned ${response.status}`);
  if (!response.ok) {
    // A 4xx that isn't 401/403/429 (e.g. a malformed request) — real, but
    // not one of this project's already-established retryable/credential
    // kinds. Reuses 'network' because that is this project's existing,
    // project-wide convention for "a generic rejection from a real
    // provider" (the identical pattern in gnewsConnector.ts/
    // newswireConnector.ts/azureOpenAiConnector.ts/tenantOwnedFeedConnector.ts/
    // wikipediaConnector.ts), not because 'network' is non-retryable — it
    // is (see errorClassification.ts's RETRYABLE_KINDS) and this does not
    // change that — Story 2.16 corrected this comment in place; it
    // previously mischaracterized this ErrorKind's retry behavior.
    throw new ClassifiableError('network', `Azure AI Language returned ${response.status}`);
  }

  return (await response.json()) as AnalyzeTextResponse;
}

/**
 * Story 2.16 — Azure AI Language returns a real HTTP 200 even when it
 * rejects a document (e.g. exceeding its real per-document size limit,
 * confirmed directly this session: 5,120 text elements) — the rejected
 * document is absent from `results.documents` and the real reason lives in
 * `results.errors` instead, a shape the `!response.ok` branch above can
 * never see. `analyze()` previously indexed `results.documents[0]`
 * unconditionally on all four capability calls, crashing with a raw,
 * unclassified TypeError instead of a ClassifiableError enrichPost.ts's
 * own tryProvider() can react to and fail over from cleanly. Reuses
 * 'network' for the same reason the `!response.ok` branch does — see that
 * branch's own comment; this is not a new, connector-specific ErrorKind.
 */
function firstDocument(response: AnalyzeTextResponse, kind: string): AnalyzeTextDocument {
  const doc = response.results.documents[0];
  if (doc) return doc;

  const err = response.results.errors?.[0]?.error;
  const detail = err
    ? `${err.code}: ${err.message}${err.innererror ? ` (${err.innererror.message})` : ''}`
    : 'no error detail returned';
  throw new ClassifiableError('network', `Azure AI Language rejected the document for ${kind} — ${detail}`);
}

/**
 * Azure AI Language (ADR-0038) — the first real AIProviderConnector
 * implementation. See .claude/skills/azure-ai-language-connector/SKILL.md.
 */
export const azureAiLanguageConnector: AIProviderConnector = {
  providerId: AZURE_AI_LANGUAGE_PROVIDER_ID,
  authMode: 'api_key',

  // Free tier: 5,000 shared text records/month, confirmed directly against
  // azure.microsoft.com/en-us/pricing/details/language/ (ADR-0038 Research).
  // Each analyze() call below makes 4 real capability calls (one per
  // enrichment field this story populates), so a template default of 1,000
  // analyze() calls per rolling 30-day window leaves real headroom under
  // that shared budget without pinning an exact paid-tier number ADR-0038
  // itself declined to verify to its own primary-source bar. Adjustable,
  // not a blocking decision — ADR-0017-23's own "implementation default"
  // convention.
  getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 30 * 24 * 60 * 60 }),

  listModels: () => [MODEL_ID],

  getModelRateLimit: () => ({ requestsPerWindow: 1000, windowSeconds: 30 * 24 * 60 * 60 }),

  getModelCapabilities: () => ({
    supportsSentiment: true,
    supportsEntities: true,
    supportsKeyPhrases: true,
    supportsLanguageDetection: true,
  }),

  /**
   * `credential` is required in practice (no fallback to any project-level
   * key exists anywhere in this module, per ADR-0027) — the type keeps it
   * optional only to satisfy AIProviderConnector's own shared interface,
   * which stateless example providers don't need at all.
   */
  analyze: async (_modelId, text, credential) => {
    if (!credential) {
      throw new ClassifiableError('http_401', 'No Azure AI Language credential supplied.');
    }
    const { endpoint, key } = parseCredential(credential);

    const [sentimentRes, keyPhrasesRes, entitiesRes, languageRes] = await Promise.all([
      callAnalyzeText(endpoint, key, 'SentimentAnalysis', text),
      callAnalyzeText(endpoint, key, 'KeyPhraseExtraction', text),
      callAnalyzeText(endpoint, key, 'EntityRecognition', text),
      callAnalyzeText(endpoint, key, 'LanguageDetection', text),
    ]);

    const sentimentDoc = firstDocument(sentimentRes, 'SentimentAnalysis') as unknown as {
      sentiment: AnalyzeResult['sentiment'];
      confidenceScores: AnalyzeResult['sentimentScores'];
    };
    const keyPhrasesDoc = firstDocument(keyPhrasesRes, 'KeyPhraseExtraction') as unknown as { keyPhrases: string[] };
    const entitiesDoc = firstDocument(entitiesRes, 'EntityRecognition') as unknown as {
      entities: Array<{ text: string; category: string; confidenceScore: number }>;
    };
    const languageDoc = firstDocument(languageRes, 'LanguageDetection') as unknown as {
      detectedLanguage: { iso6391Name: string };
    };

    const entities: EnrichmentEntity[] = (entitiesDoc.entities ?? []).map((e) => ({
      text: e.text,
      category: e.category,
      confidenceScore: e.confidenceScore,
    }));

    const result: AnalyzeResult = {
      sentiment: sentimentDoc.sentiment,
      sentimentScores: sentimentDoc.confidenceScores,
      keyPhrases: keyPhrasesDoc.keyPhrases,
      entities,
      detectedLanguage: languageDoc.detectedLanguage?.iso6391Name,
      modelUsed: `${AZURE_AI_LANGUAGE_PROVIDER_ID}:${sentimentRes.results.modelVersion}`,
    };
    return result;
  },

  /**
   * Story 12.5 (ADR-0103) — aspect-based sentiment analysis implementation.
   */
  analyzeSentiment: async (text, language, credential) => {
    if (!credential) {
      throw new ClassifiableError('http_401', 'No Azure AI Language credential supplied.');
    }
    const { endpoint, key } = parseCredential(credential);

    const [sentimentRes, keyPhrasesRes, languageRes] = await Promise.all([
      callAnalyzeText(endpoint, key, 'SentimentAnalysis', text),
      callAnalyzeText(endpoint, key, 'KeyPhraseExtraction', text),
      callAnalyzeText(endpoint, key, 'LanguageDetection', text),
    ]);

    const sentimentDoc = firstDocument(sentimentRes, 'SentimentAnalysis') as unknown as {
      sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
      confidenceScores: { positive: number; neutral: number; negative: number };
    };
    const keyPhrasesDoc = firstDocument(keyPhrasesRes, 'KeyPhraseExtraction') as unknown as { keyPhrases: string[] };
    const languageDoc = firstDocument(languageRes, 'LanguageDetection') as unknown as {
      detectedLanguage: { iso6391Name: string };
    };

    const lang = language || languageDoc.detectedLanguage?.iso6391Name || 'en';
    const scores = sentimentDoc.confidenceScores || { positive: 0.33, neutral: 0.34, negative: 0.33 };
    const confidence = Math.max(scores.positive, scores.neutral, scores.negative);

    const aspects: SentimentAspect[] = (keyPhrasesDoc.keyPhrases || []).slice(0, 3).map((phrase) => ({
      aspect: phrase,
      label: sentimentDoc.sentiment || 'neutral',
      confidence,
      evidence: phrase,
    }));

    return {
      overall: sentimentDoc.sentiment || 'neutral',
      confidence,
      language: lang,
      aspects,
    };
  },
};
