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

/**
 * Extracts `url` (or `link`) from rawPayload, best-effort.
 *
 * Found live 2026-08-20 (same shape as the `extractAuthor()` Newswire gap
 * below): Facebook posts carry their real permalink as `permalink_url`
 * (`extractDisplayText()` already reads it as a title fallback), but this
 * function never did — every real Facebook post's "Open original" /
 * "view on Facebook" link (`PostsFeedClient.tsx`'s Slideover footer,
 * `OverviewTab.tsx`'s detail panel) silently rendered nothing.
 */
export function extractUrl(rawPayload: unknown): string | null {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    if (typeof p.url === 'string') return p.url;
    if (typeof p.link === 'string') return p.link;
    if (typeof p.permalink_url === 'string') return p.permalink_url;
    if (typeof p.permalink === 'string') return p.permalink;
    if (typeof p.postUrl === 'string') return p.postUrl;
    if (typeof p.videoId === 'string' && p.videoId.length > 0) {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(p.videoId)}`;
    }
  }
  return null;
}

/**
 * Extracts `author` (or `source.name` / `username` / `channelTitle`) from rawPayload, best-effort.
 */
export function extractAuthor(rawPayload: unknown): string | null {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    if (typeof p.author === 'string' && p.author !== 'Facebook Page') return p.author;
    if (typeof p.authorName === 'string' && p.authorName !== 'Facebook Page') return p.authorName;
    if (typeof p.authorDisplayName === 'string') return p.authorDisplayName;
    if (typeof p.channelTitle === 'string') return p.channelTitle;
    if (p.from && typeof p.from === 'object') {
      const from = p.from as Record<string, unknown>;
      if (typeof from.name === 'string' && from.name !== 'Facebook Page') return from.name;
    }
    if (typeof p.memberName === 'string') return p.memberName;
    if (typeof p.username === 'string') return p.username;
    if (typeof p.issuer === 'string') return p.issuer;
    if (typeof p.pageName === 'string' && p.pageName !== 'Facebook Page') return p.pageName;
    if (p.source && typeof p.source === 'object') {
      const src = p.source as Record<string, unknown>;
      if (typeof src.name === 'string') return src.name;
    }
  }
  return null;
}

/**
 * `rawPayload` is heterogeneous per connector (GNews: title+description;
 * Newswire/tenant-owned-feed: title+link; Facebook: message; Instagram: caption; LinkedIn: commentary; YouTube: title/description or text/comment).
 */
export function extractDisplayText(rawPayload: unknown): DisplayText {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    if (typeof p.title === 'string' && p.title.length > 0) {
      return { title: p.title, snippet: typeof p.description === 'string' ? p.description : null };
    }
    if (typeof p.text === 'string' && p.text.length > 0) {
      return { title: p.text, snippet: typeof p.description === 'string' ? p.description : null };
    }
    if (typeof p.textDisplay === 'string' && p.textDisplay.length > 0) {
      return { title: p.textDisplay, snippet: null };
    }
    if (typeof p.textOriginal === 'string' && p.textOriginal.length > 0) {
      return { title: p.textOriginal, snippet: null };
    }
    if (typeof p.commentary === 'string' && p.commentary.length > 0) {
      return { title: p.commentary, snippet: null };
    }
    if (typeof p.caption === 'string' && p.caption.length > 0) {
      return { title: p.caption, snippet: null };
    }
    if (typeof p.message === 'string' && p.message.length > 0) {
      return { title: p.message, snippet: null };
    }
    if (typeof p.permalink_url === 'string') {
      return { title: p.permalink_url, snippet: null };
    }
    if (typeof p.permalink === 'string') {
      return { title: p.permalink, snippet: null };
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

export interface PostEnrichmentOverrideSummary {
  isOverridden: boolean;
  overriddenAt: string | null;
  overriddenByUserId: string | null;
  overriddenFields: string[];
  originalValues?: Record<string, unknown>;
}

export interface PostEnrichmentNamedEntity {
  text: string;
  category: string | null;
}

export interface PostEnrichmentSummary {
  sentiment: string | null;
  sentimentScores: SentimentScores | null;
  entities: string[];
  namedEntities?: PostEnrichmentNamedEntity[];
  keyPhrases: string[];
  modelUsed: string | null;
  /** ISO 639-1 code (e.g. "en"), read from enrichment.detectedLanguage — Story 8.5 (ADR-0055). Both real AIProviderConnectors already compute and persist this on every enrichment; this is the first place it's surfaced. */
  language: string | null;
  /** A concise, LLM-generated executive summary — read from enrichment.summary (social-listening-core's own AnalyzeResult.summary, Story 2.17). Populated only when Azure OpenAI (not Azure AI Language) did the enrichment; null otherwise, never a fabricated fallback. This admin UI never surfaced it until now. */
  summary: string | null;
  /** ISO 3166-1 alpha-2 country code (e.g. "US"), read from enrichment.geoCountry — Story 8.10 (ADR-0064). */
  geoCountry: string | null;
  geoCountryName: string | null;
  geoRegion: string | null;
  geoSource: 'post' | 'source' | 'inferred' | 'unknown' | null;
  geoConfidence: 'high' | 'medium' | 'low' | null;
  /** Human-in-the-loop override audit history — Story 6.31 (ADR-0071). */
  override?: PostEnrichmentOverrideSummary | null;
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

  const namedEntities: PostEnrichmentNamedEntity[] = [];
  const entities: string[] = [];

  if (Array.isArray(e.entities)) {
    for (const item of e.entities) {
      if (typeof item === 'string') {
        entities.push(item);
        namedEntities.push({ text: item, category: null });
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (typeof obj.text === 'string') {
          entities.push(obj.text);
          namedEntities.push({
            text: obj.text,
            category: typeof obj.category === 'string' ? obj.category : null,
          });
        }
      }
    }
  }

  const keyPhrases = Array.isArray(e.keyPhrases) ? e.keyPhrases.filter((k): k is string => typeof k === 'string') : [];
  const modelUsed = typeof e.modelUsed === 'string' ? e.modelUsed : null;
  const language = typeof e.detectedLanguage === 'string' ? e.detectedLanguage : null;
  const summary = typeof e.summary === 'string' ? e.summary : null;

  const geoCountry = typeof e.geoCountry === 'string' ? e.geoCountry : null;
  const geoCountryName = typeof e.geoCountryName === 'string' ? e.geoCountryName : null;
  const geoRegion = typeof e.geoRegion === 'string' ? e.geoRegion : null;
  const geoSource =
    e.geoSource === 'post' || e.geoSource === 'source' || e.geoSource === 'inferred' || e.geoSource === 'unknown'
      ? e.geoSource
      : null;
  const geoConfidence =
    e.geoConfidence === 'high' || e.geoConfidence === 'medium' || e.geoConfidence === 'low'
      ? e.geoConfidence
      : null;

  let override: PostEnrichmentOverrideSummary | null = null;
  if (e.override && typeof e.override === 'object') {
    const o = e.override as Record<string, unknown>;
    override = {
      isOverridden: o.isOverridden === true,
      overriddenAt: typeof o.overriddenAt === 'string' ? o.overriddenAt : null,
      overriddenByUserId: typeof o.overriddenByUserId === 'string' ? o.overriddenByUserId : null,
      overriddenFields: Array.isArray(o.overriddenFields)
        ? o.overriddenFields.filter((f): f is string => typeof f === 'string')
        : [],
      originalValues:
        o.originalValues && typeof o.originalValues === 'object'
          ? (o.originalValues as Record<string, unknown>)
          : undefined,
    };
  }

  if (!sentiment && entities.length === 0 && keyPhrases.length === 0 && !modelUsed && !geoCountry && !override) return null;
  return {
    sentiment,
    sentimentScores,
    entities,
    namedEntities,
    keyPhrases,
    modelUsed,
    language,
    summary,
    geoCountry,
    geoCountryName,
    geoRegion,
    geoSource,
    geoConfidence,
    override,
  };
}

export interface FacebookPageContext {
  pageId: string | null;
  pageName: string | null;
  author: string | null;
  isPageAuthor: boolean;
}

function extractFacebookPageFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('facebook.com')) return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      const first = parts[0];
      const excluded = ['posts', 'permalink.php', 'photo.php', 'story.php', 'groups', 'watch', 'events', 'media', 'sharer', 'dialog'];
      if (!excluded.includes(first) && !first.startsWith('profile.php')) {
        if (first === 'pages' && parts.length > 1) {
          return parts[1] !== 'category' ? decodeURIComponent(parts[1]) : (parts[2] ? decodeURIComponent(parts[2]) : null);
        }
        return decodeURIComponent(first);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Story 6.33 (ADR-0067) — extracts Facebook Page context and detects
 * whether post author is distinct from the hosting Page entity.
 */
export function extractFacebookPageContext(
  rawPayload: unknown,
  facebookPages?: { pageId: string; pageName: string }[]
): FacebookPageContext | null {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    const page = p.page && typeof p.page === 'object' ? (p.page as Record<string, unknown>) : null;

    // Parse pageId from post ID (e.g. "123456789_987654321") or externalId ("facebook:123456789_987654321")
    const idStr = typeof p.externalId === 'string' ? p.externalId.replace(/^facebook:/, '') : (typeof p.id === 'string' ? p.id : '');
    const idParts = idStr.split('_');
    const extractedPageIdFromPostId = idParts.length >= 2 && /^\d+$/.test(idParts[0]) ? idParts[0] : null;

    const pageId =
      typeof p.pageId === 'string'
        ? p.pageId
        : typeof p.page_id === 'string'
        ? p.page_id
        : page && typeof page.id === 'string'
        ? (page.id as string)
        : extractedPageIdFromPostId;

    const matchedFbPage = facebookPages && pageId ? facebookPages.find((fp) => fp.pageId === pageId) : undefined;
    const singleFbPage = facebookPages && facebookPages.length === 1 ? facebookPages[0] : undefined;

    const rawPageName =
      typeof p.pageName === 'string' && p.pageName !== 'Facebook Page' && p.pageName.trim().length > 0
        ? p.pageName
        : typeof p.page_name === 'string' && p.page_name !== 'Facebook Page' && p.page_name.trim().length > 0
        ? p.page_name
        : page && typeof page.name === 'string' && page.name !== 'Facebook Page'
        ? (page.name as string)
        : null;

    const urlPageName = extractFacebookPageFromUrl(extractUrl(rawPayload));
    const author = extractAuthor(rawPayload);
    const isFacebook = p.providerId === 'facebook' || p.provider === 'facebook' || pageId !== null || rawPageName !== null;

    if (pageId || rawPageName || isFacebook) {
      const resolvedPageName =
        matchedFbPage?.pageName ||
        rawPageName ||
        singleFbPage?.pageName ||
        urlPageName ||
        (isFacebook && author && author !== 'Facebook Page' ? author : null) ||
        (pageId ? `Facebook Page (${pageId})` : 'Facebook Page');

      return {
        pageId: pageId || matchedFbPage?.pageId || singleFbPage?.pageId || null,
        pageName: resolvedPageName,
        author,
        isPageAuthor: author === resolvedPageName || !author,
      };
    }
  }
  return null;
}

export interface InstagramMediaChild {
  id: string;
  mediaType: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
}

export interface InstagramContext {
  igUserId: string | null;
  username: string | null;
  pageId: string | null;
  pageName: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  children: InstagramMediaChild[];
  childrenTruncated: boolean;
}

/**
 * Story 6.34 (ADR-0068) — extracts Instagram Business context and carousel items.
 */
export function extractInstagramContext(rawPayload: unknown): InstagramContext | null {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    const igUserId = typeof p.igUserId === 'string' ? p.igUserId : null;
    const username = typeof p.username === 'string' ? p.username : null;
    if (igUserId || username || p.providerId === 'instagram') {
      const pageId = typeof p.pageId === 'string' ? p.pageId : null;
      const pageName = typeof p.pageName === 'string' ? p.pageName : null;
      const mediaType = typeof p.mediaType === 'string' ? p.mediaType : null;
      const mediaUrl = typeof p.mediaUrl === 'string' ? p.mediaUrl : null;
      const thumbnailUrl = typeof p.thumbnailUrl === 'string' ? p.thumbnailUrl : null;
      const permalink = typeof p.permalink === 'string' ? p.permalink : null;
      const likeCount = typeof p.likeCount === 'number' ? p.likeCount : null;
      const commentsCount = typeof p.commentsCount === 'number' ? p.commentsCount : null;
      const children = Array.isArray(p.children) ? (p.children as InstagramMediaChild[]) : [];
      const childrenTruncated = p.childrenTruncated === true;
      return {
        igUserId,
        username,
        pageId,
        pageName,
        mediaType,
        mediaUrl,
        thumbnailUrl,
        permalink,
        likeCount,
        commentsCount,
        children,
        childrenTruncated,
      };
    }
  }
  return null;
}

/**
 * Story 6.35 — LinkedIn post and author metadata context.
 */
export interface LinkedInContext {
  authorName?: string;
  memberId?: string;
  authorUrn?: string;
  reactionsCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  permalink?: string;
}

export function extractLinkedInContext(rawPayload: unknown): LinkedInContext | null {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    if (p.providerId === 'linkedin' || typeof p.authorUrn === 'string' || typeof p.memberId === 'string') {
      const authorName = typeof p.authorName === 'string' ? p.authorName : (typeof p.memberName === 'string' ? p.memberName : undefined);
      const memberId = typeof p.memberId === 'string' ? p.memberId : (typeof p.authorExternalId === 'string' ? p.authorExternalId.replace(/^linkedin:/, '') : undefined);
      const authorUrn = typeof p.authorUrn === 'string' ? p.authorUrn : (memberId ? `urn:li:person:${memberId}` : undefined);
      const reactionsCount = typeof p.reactionsCount === 'number' ? p.reactionsCount : (typeof p.likeCount === 'number' ? p.likeCount : undefined);
      const commentsCount = typeof p.commentsCount === 'number' ? p.commentsCount : undefined;
      const sharesCount = typeof p.sharesCount === 'number' ? p.sharesCount : (typeof p.repostsCount === 'number' ? p.repostsCount : undefined);
      const permalink = typeof p.permalink === 'string' ? p.permalink : (typeof p.url === 'string' ? p.url : undefined);

      return {
        authorName,
        memberId,
        authorUrn,
        reactionsCount,
        commentsCount,
        sharesCount,
        permalink,
      };
    }
  }
  return null;
}

/**
 * Extracts matched or discovering watchlistId from rawPayload.
 */
export function extractWatchlistId(rawPayload: unknown): string | null {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    if (typeof p.watchlistId === 'string') return p.watchlistId;
    if (typeof p.discoveringWatchlistId === 'string') return p.discoveringWatchlistId;
    if (typeof p.matchedWatchlistId === 'string') return p.matchedWatchlistId;
    if (typeof p.watchlist_id === 'string') return p.watchlist_id;
    if (typeof p.discovering_watchlist_id === 'string') return p.discovering_watchlist_id;
  }
  return null;
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
  pageName: string | null;
  pageId: string | null;
  watchlistId: string | null;
  watchlistName?: string | null;
  instagramContext: InstagramContext | null;
  linkedinContext: LinkedInContext | null;
  enrichmentSummary: PostEnrichmentSummary | null;
}

export function flattenPost(
  post: SocialPostSummary,
  watchlists?: { id: string; name?: string; terms?: string[] | null; platformIds?: string[] }[],
  facebookPages?: { pageId: string; pageName: string }[]
): FlatPost {
  const { title, snippet } = extractDisplayText(post.rawPayload);
  const fbContext = extractFacebookPageContext(post.rawPayload, facebookPages);
  const igContext = extractInstagramContext(post.rawPayload);
  const liContext = extractLinkedInContext(post.rawPayload);
  const provider = extractProviderBadge(post.rawPayload);

  let watchlistId = extractWatchlistId(post.rawPayload);
  let matchedWatchlist = watchlists && watchlistId ? watchlists.find((w) => w.id === watchlistId) : undefined;

  // Fallback: If watchlistId wasn't explicitly saved in rawPayload (e.g. older Wikipedia re-polls), resolve from watchlists
  if (!matchedWatchlist && watchlists && watchlists.length > 0) {
    const textToMatch = `${title} ${snippet || ''} ${post.bodyMarkdown || ''}`.toLowerCase();
    const termMatch = watchlists.find((w) => {
      const targetsPlatform = !w.platformIds || w.platformIds.length === 0 || w.platformIds.includes(provider);
      return targetsPlatform && (w.terms || []).some((term) => term && textToMatch.includes(term.toLowerCase()));
    });

    if (termMatch) {
      matchedWatchlist = termMatch;
      watchlistId = termMatch.id;
    } else if (provider === 'wikipedia') {
      const wikiWatchlist = watchlists.find((w) => w.platformIds?.includes('wikipedia'));
      if (wikiWatchlist) {
        matchedWatchlist = wikiWatchlist;
        watchlistId = wikiWatchlist.id;
      }
    }
  }

  return {
    ...post,
    bodyMarkdown: post.bodyMarkdown ?? null,
    title,
    snippet,
    provider,
    url: extractUrl(post.rawPayload),
    author: extractAuthor(post.rawPayload),
    pageName: fbContext?.pageName ?? igContext?.pageName ?? null,
    pageId: fbContext?.pageId ?? igContext?.pageId ?? null,
    watchlistId,
    watchlistName: matchedWatchlist?.name ?? null,
    instagramContext: igContext,
    linkedinContext: liContext,
    enrichmentSummary: post.enrichment ? extractEnrichmentSummary(post.enrichment) : null,
  };
}
