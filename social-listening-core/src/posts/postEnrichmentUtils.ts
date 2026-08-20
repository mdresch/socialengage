import { normalizeCountryCode, getCountryName } from '../connectors/geo/geoCountryUtils';

export interface UpdatePostEnrichmentInput {
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  keyPhrases?: string[];
  detectedLanguage?: string | null;
  geoCountry?: string | null;
  geoCountryName?: string | null;
  summary?: string | null;
}

export interface PostEnrichmentOverride {
  isOverridden: boolean;
  overriddenAt: string;
  overriddenByUserId: string;
  overriddenFields: string[];
  originalValues?: Record<string, unknown>;
  aiHistory?: Array<{
    generatedAt: string;
    model?: string;
    values: Record<string, unknown>;
  }>;
}

// Standard ISO 639-1 two-letter lowercase language codes
const ISO_639_1_RE = /^[a-z]{2}$/;

/**
 * Validates whether a given string is a valid ISO 639-1 2-letter language code.
 */
export function isValidLanguageCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  const trimmed = code.trim().toLowerCase();
  return ISO_639_1_RE.test(trimmed);
}

/**
 * Sanitizes an array of key phrases:
 * - Strips HTML tags
 * - Trims whitespace
 * - Discards empty strings
 * - Deduplicates case-insensitively while preserving first-seen casing
 * - Enforces max 50 items and max 200 chars per phrase
 */
export function sanitizeKeyPhrases(phrases: string[]): string[] {
  if (!Array.isArray(phrases)) return [];

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const raw of phrases) {
    if (typeof raw !== 'string') continue;
    // Strip HTML tags and trim
    const stripped = raw.replace(/<[^>]*>/g, '').trim();
    if (!stripped) continue;

    const lower = stripped.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      sanitized.push(stripped.slice(0, 200));
      if (sanitized.length >= 50) break;
    }
  }

  return sanitized;
}

/**
 * Default sentiment score assignment when sentiment is updated without sentimentScore.
 */
export function getDefaultSentimentScore(sentiment: 'positive' | 'neutral' | 'negative'): number {
  switch (sentiment) {
    case 'positive':
      return 0.8;
    case 'negative':
      return 0.2;
    case 'neutral':
    default:
      return 0.5;
  }
}
