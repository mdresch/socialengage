import { getLatestCredentialId, readCredential } from '../credentials/credentialStore';
import { isConnectorActive } from '../connectors/connectorActivationStore';
import { acquireForAiModel, QueueTtlExceededError, QueueDepthExceededError } from '../connectors/requestGate';
import { ClassifiableError } from '../ingestion/errorClassification';
import { azureOpenAiConnector } from '../connectors/azureOpenAi/azureOpenAiConnector';
import { listSocialPosts, SocialPostSummary } from '../posts/socialPostStore';

const AI_OPTIONS = { maxKeyPhrases: 10, maxRelatedTopics: 10, maxSearchQueries: 5 };
const MAX_POSTS_TO_ANALYSE = 50;
const MAX_PAGES = 10;

export interface SpikeExplainRequest {
  spikeDate: string;
  context?: { filterSummary?: string };
  customPrompt?: string;
}

export interface SpikeExplainResult {
  narrative: string;
  postsAnalysed: number;
  generatedAt: string;
}

export class SpikeStorytellerError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

async function loadAiCredential(tenantId: string): Promise<string> {
  const active = await isConnectorActive(tenantId, azureOpenAiConnector.providerId, 'tenant');
  if (!active) {
    throw new SpikeStorytellerError(503, 'AI_UNAVAILABLE', 'No Azure OpenAI provider is active for this tenant.');
  }

  const credentialId = await getLatestCredentialId(tenantId, azureOpenAiConnector.providerId, 'tenant');
  if (!credentialId) {
    throw new SpikeStorytellerError(503, 'AI_UNAVAILABLE', 'No Azure OpenAI credential is available for this tenant.');
  }

  return readCredential(tenantId, credentialId);
}

/**
 * Pages listSocialPosts() for the tenant and returns posts whose publishedAt
 * falls within [spikeDate - 1 day, spikeDate + 1 day] inclusive, capped at
 * MAX_POSTS_TO_ANALYSE, newest-first. ADR-0062 Decision §6: the server
 * derives context posts internally, the client never marshalls them.
 */
async function fetchSpikeContextPosts(tenantId: string, spikeDate: string): Promise<SocialPostSummary[]> {
  const dayBefore = new Date(spikeDate + 'T00:00:00.000Z');
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const dayAfter = new Date(spikeDate + 'T00:00:00.000Z');
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  dayAfter.setUTCHours(23, 59, 59, 999);

  const collected: SocialPostSummary[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await listSocialPosts(tenantId, { cursor, limit: 100 });
    for (const post of result.posts) {
      if (!post.publishedAt) continue;
      const pubDate = new Date(post.publishedAt);
      if (pubDate >= dayBefore && pubDate <= dayAfter) {
        collected.push(post);
        if (collected.length >= MAX_POSTS_TO_ANALYSE) break;
      }
    }
    if (collected.length >= MAX_POSTS_TO_ANALYSE || !result.nextCursor) break;
    cursor = result.nextCursor;
  }

  // Sort newest-first by publishedAt
  collected.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });

  return collected.slice(0, MAX_POSTS_TO_ANALYSE);
}

function extractTitle(post: SocialPostSummary): string {
  const raw = post.rawPayload as Record<string, unknown> | null;
  if (raw && typeof raw.title === 'string') return raw.title;
  return '(untitled)';
}

function extractKeyPhrases(post: SocialPostSummary): string[] {
  const enrichment = post.enrichment as Record<string, unknown> | null;
  if (enrichment && Array.isArray(enrichment.keyPhrases)) {
    return enrichment.keyPhrases.filter((p): p is string => typeof p === 'string');
  }
  return [];
}

/**
 * Composes the prompt text passed to azureOpenAiConnector.research() as the
 * `text` parameter. Includes each context post's title, body (truncated), and
 * key phrases, capped to a reasonable length. When customPrompt is present, it
 * is folded in as a refinement of the analysis question — never replacing the
 * derived post context (ADR-0062 Decision §6, BRU-006).
 */
function composePrompt(posts: SocialPostSummary[], spikeDate: string, customPrompt?: string): string {
  const postSummaries = posts.map((post, i) => {
    const title = extractTitle(post);
    const body = (post.bodyMarkdown ?? '').slice(0, 500);
    const keyPhrases = extractKeyPhrases(post);
    const phrasesStr = keyPhrases.length > 0 ? ` | Key phrases: ${keyPhrases.join(', ')}` : '';
    return `[Post ${i + 1}] ${title}\n${body}${phrasesStr}`;
  });

  let prompt =
    `A volume spike was detected on ${spikeDate}. ` +
    `The following ${posts.length} post(s) were published within a ±1 day window around that date. ` +
    `Analyse what drove the spike and write a concise narrative explanation.\n\n` +
    postSummaries.join('\n\n');

  if (customPrompt && customPrompt.trim().length > 0) {
    prompt += `\n\nAdditional analysis instruction from the user: ${customPrompt.trim()}`;
  }

  return prompt;
}

/**
 * Story 8.8 (ADR-0062 Decision §6) — pure orchestration for the AI Spike
 * Storyteller. Pages GET /v1/posts internally (same tenant RLS context) for
 * a ±1 day window around spikeDate, composes a prompt from the posts'
 * title/bodyMarkdown/enrichment.keyPhrases, calls the existing
 * azureOpenAiConnector.research() (used as-is — no new public method), and
 * maps contextSummary → narrative. Stateless: no persistence, no stored
 * aggregation. Returns 503 AI_UNAVAILABLE when no credential is configured.
 */
export async function explainSpike(
  tenantId: string,
  request: SpikeExplainRequest
): Promise<SpikeExplainResult> {
  const { spikeDate, customPrompt } = request;

  if (typeof spikeDate !== 'string' || spikeDate.trim().length === 0) {
    throw new SpikeStorytellerError(400, 'BAD_REQUEST', 'spikeDate is required and cannot be empty');
  }

  const credential = await loadAiCredential(tenantId);

  const posts = await fetchSpikeContextPosts(tenantId, spikeDate);

  const promptText = composePrompt(posts, spikeDate, customPrompt);

  try {
    await acquireForAiModel(tenantId, azureOpenAiConnector, 'research');
  } catch (err) {
    if (err instanceof QueueTtlExceededError) {
      throw new SpikeStorytellerError(429, 'RATE_LIMITED', 'AI request queue TTL exceeded.');
    }
    if (err instanceof QueueDepthExceededError) {
      throw new SpikeStorytellerError(429, 'RATE_LIMITED', 'AI request queue depth exceeded.');
    }
    throw err;
  }

  let result;
  try {
    result = await azureOpenAiConnector.research!(promptText, [], AI_OPTIONS, credential);
  } catch (err) {
    if (err instanceof ClassifiableError) {
      const statusByKind: Record<string, number> = {
        rate_limit: 429,
        rate_limited: 429,
        queue_ttl_exceeded: 429,
        queue_depth_exceeded: 429,
        http_5xx: 502,
        network: 502,
      };
      const status = statusByKind[err.kind] ?? 502;
      throw new SpikeStorytellerError(status, err.kind, err.message);
    }
    throw err;
  }

  const narrative = result.contextSummary || result.comparison || '';
  if (!narrative) {
    throw new SpikeStorytellerError(502, 'AI_EMPTY_RESPONSE', 'Azure OpenAI returned no narrative content.');
  }

  return {
    narrative,
    postsAnalysed: posts.length,
    generatedAt: new Date().toISOString(),
  };
}
