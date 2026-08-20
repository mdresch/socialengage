/**
 * Story 6.11 — pure display-derivation helpers shared by /tenant/posts and
 * /tenant/posts/[id]. No JSX, no next/* imports (see this component's own
 * SKILL.md "Load-bearing constraints") — both pages render the data these
 * functions return however fits their own layout.
 */

import type { SocialPostSummary } from '@/lib/core-client';

export interface DisplayText {
  title: string;
  snippet: string | null;
}

/** Extracts `url` (or `link`) from rawPayload, best-effort. */
export function extractUrl(rawPayload: unknown): string | null {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    if (typeof p.url === 'string') return p.url;
    if (typeof p.link === 'string') return p.link;
  }
  return null;
}

/** Extracts `author` (or `source.name`) from rawPayload, best-effort. */
export function extractAuthor(rawPayload: unknown): string | null {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    if (typeof p.author === 'string') return p.author;
    if (p.source && typeof p.source === 'object') {
      const src = p.source as Record<string, unknown>;
      if (typeof src.name === 'string') return src.name;
    }
  }
  return null;
}

/**
 * `rawPayload` is heterogeneous per connector (GNews: title+description;
 * Newswire/tenant-owned-feed: title+link) — this only ever looks for a
 * `title` field (optionally `description`), never branches on providerId,
 * so any current or future connector whose posts have a title "just works"
 * without a new case here. Anything without a recognizable title falls back
 * to the raw JSON rather than rendering nothing.
 *
 * Found live 2026-08-18 (real, confirmed regression, not previously caught
 * by any contract): Facebook (Story 2.15/ADR-0059, shipped after this
 * function was written) has no `title` field at all — its own posts carry
 * `message` (the Page post's own text). Every real Facebook post in the
 * feed was silently falling all the way through to the raw-JSON fallback
 * — a genuinely new *shape* per this doc's own "how to extend this safely"
 * rule, not the "no recognizable title, degrade honestly" case the
 * fallback exists for. `permalink_url` (Facebook's own post URL) covers
 * the media-only-post edge case where `message` is empty/absent.
 */
export function extractDisplayText(rawPayload: unknown): DisplayText {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    if (typeof p.title === 'string') {
      return { title: p.title, snippet: typeof p.description === 'string' ? p.description : null };
    }
    if (typeof p.message === 'string' && p.message.length > 0) {
      return { title: p.message, snippet: null };
    }
    if (typeof p.permalink_url === 'string') {
      return { title: p.permalink_url, snippet: null };
    }
  }
  return { title: JSON.stringify(rawPayload), snippet: null };
}

export function extractProviderBadge(rawPayload: unknown): string {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    if (typeof p.providerId === 'string') return p.providerId;
  }
  return 'unknown';
}

export interface SentimentScores {
  positive: number;
  neutral: number;
  negative: number;
}

export interface PostEnrichmentSummary {
  sentiment: string | null;
  sentimentScores: SentimentScores | null;
  entities: string[];
  keyPhrases: string[];
  modelUsed: string | null;
  /** ISO 639-1 code (e.g. "en"), read from enrichment.detectedLanguage — Story 8.5 (ADR-0055). Both real AIProviderConnectors already compute and persist this on every enrichment; this is the first place it's surfaced. */
  language: string | null;
  /** A concise, LLM-generated executive summary — read from enrichment.summary (social-listening-core's own AnalyzeResult.summary, Story 2.17). Populated only when Azure OpenAI (not Azure AI Language) did the enrichment; null otherwise, never a fabricated fallback. This admin UI never surfaced it until now. */
  summary: string | null;
}

/**
 * `enrichment` mirrors core's AnalyzeResult shape on the wire
 * (social-listening-core/src/connectors/types.ts) but arrives here as
 * `unknown` — this is the one place that boundary gets read. Returns `null`
 * when there is nothing worth showing (matches AC3's "no enrichment section
 * rather than an empty/placeholder one"). `modelUsed` (e.g.
 * "azure-ai-language:2025-01-01" or "azure-openai:2025-08-07") is the one
 * field that answers "which of the two active AI providers actually
 * enriched this specific post" — enrichPost.ts's own PROVIDERS order
 * decides that at enrichment time, per-post, so this is the only place a
 * viewer can see the real answer after the fact.
 */
export function extractEnrichmentSummary(enrichment: unknown): PostEnrichmentSummary | null {
  if (!enrichment || typeof enrichment !== 'object') return null;
  const e = enrichment as Record<string, unknown>;

  const sentiment = typeof e.sentiment === 'string' ? e.sentiment : null;

  let sentimentScores: SentimentScores | null = null;
  if (e.sentimentScores && typeof e.sentimentScores === 'object') {
    const sc = e.sentimentScores as Record<string, unknown>;
    if (typeof sc.positive === 'number' && typeof sc.neutral === 'number' && typeof sc.negative === 'number') {
      sentimentScores = { positive: sc.positive, neutral: sc.neutral, negative: sc.negative };
    }
  }

  const entities = Array.isArray(e.entities)
    ? e.entities
        .map((entity) =>
          entity && typeof entity === 'object' && typeof (entity as Record<string, unknown>).text === 'string'
            ? ((entity as Record<string, unknown>).text as string)
            : null
        )
        .filter((text): text is string => text !== null)
    : [];
  const keyPhrases = Array.isArray(e.keyPhrases) ? e.keyPhrases.filter((k): k is string => typeof k === 'string') : [];
  const modelUsed = typeof e.modelUsed === 'string' ? e.modelUsed : null;
  const language = typeof e.detectedLanguage === 'string' ? e.detectedLanguage : null;
  const summary = typeof e.summary === 'string' ? e.summary : null;

  if (!sentiment && entities.length === 0 && keyPhrases.length === 0 && !modelUsed) return null;
  return { sentiment, sentimentScores, entities, keyPhrases, modelUsed, language, summary };
}

/**
 * 2026-08-19 — moved here from PostsFeedClient.tsx (its original home) so the
 * Analytics Overview tab's own post-detail drawer, a second, sibling call
 * site, can derive the identical shape without importing a Client Component
 * module. Belongs here regardless of caller count: built entirely from this
 * file's own extract*() functions, matching this file's "pure
 * display-derivation helpers" purpose exactly.
 */
export interface FlatPost {
  id: string;
  createdAt: string;
  publishedAt: string | null;
  rawPayload: unknown;
  enrichment: unknown;
  bodyMarkdown: string | null;
  // derived
  title: string;
  snippet: string | null;
  provider: string;
  url: string | null;
  author: string | null;
  enrichmentSummary: PostEnrichmentSummary | null;
}

export function flattenPost(post: SocialPostSummary): FlatPost {
  const { title, snippet } = extractDisplayText(post.rawPayload);
  return {
    ...post,
    title,
    snippet,
    provider: extractProviderBadge(post.rawPayload),
    url: extractUrl(post.rawPayload),
    author: extractAuthor(post.rawPayload),
    enrichmentSummary: post.enrichment ? extractEnrichmentSummary(post.enrichment) : null,
  };
}
