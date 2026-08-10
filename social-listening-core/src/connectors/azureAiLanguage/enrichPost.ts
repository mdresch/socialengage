import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import { acquireForAiModel, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError, isRetryable } from '../../ingestion/errorClassification';
import { azureAiLanguageConnector } from './azureAiLanguageConnector';
import { azureOpenAiConnector } from '../azureOpenAi/azureOpenAiConnector';
import { registerAIProviderConnector } from '../registry';
import { AIProviderConnector, AnalyzeResult } from '../types';

const MAX_ENRICHMENT_ATTEMPTS = 3;

/**
 * Story 2.9 (ADR-0038 §2) — both real AIProviderConnectors register into
 * the shared framework registry (ADR-0002) as a real side effect of this
 * module loading, proving "registered... alongside" (Story 2.9 AC1) for
 * real rather than only structurally via Story 2.1's own example fixtures.
 * enrichPost() itself still iterates the fixed PROVIDERS list below, not
 * registry.listAIProviderConnectors() — see this component's own SKILL.md
 * Load-bearing constraints for why.
 */
registerAIProviderConnector(azureAiLanguageConnector);
registerAIProviderConnector(azureOpenAiConnector);

/**
 * Story 2.9 — the ordered set of real AIProviderConnectors enrichPost()
 * tries. Adding a third provider is additive here (implement + append to
 * this list) — no other change to this function or to any connector's own
 * ingest function is required (Story 2.9 AC2).
 */
const PROVIDERS: AIProviderConnector[] = [azureAiLanguageConnector, azureOpenAiConnector];

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
async function gatedAcquire(tenantId: string, connector: AIProviderConnector, modelId: string): Promise<void> {
  try {
    await acquireForAiModel(tenantId, connector, modelId);
  } catch (err) {
    if (err instanceof QueueTtlExceededError || err instanceof QueueDepthExceededError) {
      throw new ClassifiableError('queue_ttl_exceeded', err.message);
    }
    throw err;
  }
}

/**
 * One provider's own attempt: resolves the tenant's own credential for
 * this specific provider (returning `undefined` immediately — a "skip" —
 * if the tenant hasn't connected it, Story 2.9 AC4), then retries a
 * retryable failure with backoff up to MAX_ENRICHMENT_ATTEMPTS before
 * giving up on this provider (also `undefined` — enrichPost() then moves
 * on to the next provider in PROVIDERS, Story 2.9's own "fails over").
 */
async function tryProvider(tenantId: string, connector: AIProviderConnector, text: string): Promise<AnalyzeResult | undefined> {
  const credentialId = await getLatestCredentialId(tenantId, connector.providerId, 'tenant');
  if (!credentialId) return undefined;

  const credential = await readCredential(tenantId, credentialId);
  const modelId = connector.listModels()[0];

  for (let attempt = 1; attempt <= MAX_ENRICHMENT_ATTEMPTS; attempt += 1) {
    try {
      await gatedAcquire(tenantId, connector, modelId);
      return await connector.analyze(modelId, text, credential);
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

/**
 * Story 2.8/2.9 (ADR-0038) — best-effort enrichment for one post's text,
 * the one function GNews's and Newswire's own ingest functions both call
 * ahead of insertSocialPost(). Tries each real AIProviderConnector in
 * PROVIDERS, in order, skipping any the tenant hasn't connected and
 * failing over to the next on an exhausted/non-retryable failure from one
 * the tenant *has* connected. Never throws: no connected provider, every
 * connected provider failing, or a programming error all resolve to
 * `undefined` — enrichment is additive to the pipeline, never a hard
 * dependency of a post's own ingestion succeeding. See
 * .claude/skills/azure-ai-language-connector/SKILL.md and
 * .claude/skills/azure-openai-connector/SKILL.md.
 */
export async function enrichPost(tenantId: string, text: string): Promise<AnalyzeResult | undefined> {
  for (const connector of PROVIDERS) {
    const result = await tryProvider(tenantId, connector, text);
    if (result !== undefined) return result;
  }
  return undefined;
}
