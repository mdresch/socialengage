import { AIProviderConnector, AnalyzeResult, EnrichmentEntity } from '../types';
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
interface AnalyzeTextResponse {
  results: { documents: AnalyzeTextDocument[]; modelVersion: string };
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
    // kinds; classified as 'network' as the closest existing non-retryable
    // bucket rather than inventing a new ErrorKind for a single connector.
    throw new ClassifiableError('network', `Azure AI Language returned ${response.status}`);
  }

  return (await response.json()) as AnalyzeTextResponse;
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

    const sentimentDoc = sentimentRes.results.documents[0] as unknown as {
      sentiment: AnalyzeResult['sentiment'];
      confidenceScores: AnalyzeResult['sentimentScores'];
    };
    const keyPhrasesDoc = keyPhrasesRes.results.documents[0] as unknown as { keyPhrases: string[] };
    const entitiesDoc = entitiesRes.results.documents[0] as unknown as {
      entities: Array<{ text: string; category: string; confidenceScore: number }>;
    };
    const languageDoc = languageRes.results.documents[0] as unknown as {
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
};
