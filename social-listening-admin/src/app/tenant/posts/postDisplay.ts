/**
 * Story 6.11 — pure display-derivation helpers shared by /tenant/posts and
 * /tenant/posts/[id]. No JSX, no next/* imports (see this component's own
 * SKILL.md "Load-bearing constraints") — both pages render the data these
 * functions return however fits their own layout.
 */

export interface DisplayText {
  title: string;
  snippet: string | null;
}

/**
 * `rawPayload` is heterogeneous per connector (GNews: title+description;
 * Newswire/tenant-owned-feed: title+link) — this only ever looks for a
 * `title` field (optionally `description`), never branches on providerId,
 * so any current or future connector whose posts have a title "just works"
 * without a new case here. Anything without a recognizable title falls back
 * to the raw JSON rather than rendering nothing.
 */
export function extractDisplayText(rawPayload: unknown): DisplayText {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    if (typeof p.title === 'string') {
      return { title: p.title, snippet: typeof p.description === 'string' ? p.description : null };
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

export interface PostEnrichmentSummary {
  sentiment: string | null;
  entities: string[];
  keyPhrases: string[];
}

/**
 * `enrichment` mirrors core's AnalyzeResult shape on the wire
 * (social-listening-core/src/connectors/types.ts) but arrives here as
 * `unknown` — this is the one place that boundary gets read. Returns `null`
 * when there is nothing worth showing (matches AC3's "no enrichment section
 * rather than an empty/placeholder one").
 */
export function extractEnrichmentSummary(enrichment: unknown): PostEnrichmentSummary | null {
  if (!enrichment || typeof enrichment !== 'object') return null;
  const e = enrichment as Record<string, unknown>;

  const sentiment = typeof e.sentiment === 'string' ? e.sentiment : null;
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

  if (!sentiment && entities.length === 0 && keyPhrases.length === 0) return null;
  return { sentiment, entities, keyPhrases };
}
