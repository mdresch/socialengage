import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import { acquireForAiModel, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError, isRetryable } from '../../ingestion/errorClassification';
import { azureAiLanguageConnector, AZURE_AI_LANGUAGE_PROVIDER_ID } from './azureAiLanguageConnector';
import { AnalyzeResult } from '../types';

const MODEL_ID = azureAiLanguageConnector.listModels()[0];
const MAX_ENRICHMENT_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * acquireForAiModel() has no ingestion-domain knowledge of its own (see
 * .claude/skills/provider-connector-framework/SKILL.md) — reclassifying its
 * queue-exhaustion errors into a ClassifiableError is this connector's own
 * job, the same pattern gnewsConnector.ts/newswireConnector.ts's own
 * gatedAcquire() already establishes.
 */
async function gatedAcquire(tenantId: string): Promise<void> {
  try {
    await acquireForAiModel(tenantId, azureAiLanguageConnector, MODEL_ID);
  } catch (err) {
    if (err instanceof QueueTtlExceededError || err instanceof QueueDepthExceededError) {
      throw new ClassifiableError('queue_ttl_exceeded', err.message);
    }
    throw err;
  }
}

/**
 * Story 2.8 (ADR-0038) — best-effort enrichment for one post's text, the
 * one function GNews's and Newswire's own ingest functions both call ahead
 * of insertSocialPost(). Never throws: a missing credential (AC5), a
 * non-retryable failure, or a retryable failure that exhausts its own
 * small retry budget (AC6) all resolve to `undefined` — enrichment is
 * additive to the ingestion pipeline, never a hard dependency of a post's
 * own ingestion succeeding. See
 * .claude/skills/azure-ai-language-connector/SKILL.md.
 */
export async function enrichPost(tenantId: string, text: string): Promise<AnalyzeResult | undefined> {
  const credentialId = await getLatestCredentialId(tenantId, AZURE_AI_LANGUAGE_PROVIDER_ID, 'tenant');
  if (!credentialId) return undefined;

  const credential = await readCredential(tenantId, credentialId);

  for (let attempt = 1; attempt <= MAX_ENRICHMENT_ATTEMPTS; attempt += 1) {
    try {
      await gatedAcquire(tenantId);
      return await azureAiLanguageConnector.analyze(MODEL_ID, text, credential);
    } catch (err) {
      if (!(err instanceof ClassifiableError)) {
        return undefined; // a programming error must not break ingestion either
      }
      if (!isRetryable(err.kind) || attempt === MAX_ENRICHMENT_ATTEMPTS) {
        return undefined;
      }
      await sleep(Math.min(1000 * 2 ** attempt, 5000));
    }
  }
  return undefined;
}
