import { URL_PATTERN } from './unicodeStyles';

export type CountingMethod = 'nfc-codepoints' | 'graphemes' | 'x-weighted' | 'mastodon';

const URL_WEIGHT = 23;

const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

export function countCharacters(text: string, method: CountingMethod = 'nfc-codepoints'): number {
  if (!text) return 0;
  const normalized = text.normalize('NFC');

  switch (method) {
    case 'graphemes':
      return countGraphemes(normalized);
    case 'x-weighted':
      return countXWeighted(normalized);
    case 'mastodon':
      return countMastodon(normalized);
    case 'nfc-codepoints':
    default:
      return Array.from(normalized).length;
  }
}

function countMastodon(normalized: string): number {
  const urlPattern = new RegExp(URL_PATTERN.source, 'gu');
  let count = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(normalized)) !== null) {
    count += Array.from(normalized.slice(lastIndex, match.index)).length;
    count += URL_WEIGHT;
    lastIndex = match.index + match[0].length;
  }

  count += Array.from(normalized.slice(lastIndex)).length;
  return count;
}

function countGraphemes(normalized: string): number {
  if (!graphemeSegmenter) {
    return Array.from(normalized).length;
  }

  let count = 0;
  for (const _segment of graphemeSegmenter.segment(normalized)) {
    count += 1;
  }
  return count;
}

function countXWeighted(normalized: string): number {
  const urlPattern = new RegExp(URL_PATTERN.source, 'gu');
  let weighted = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(normalized)) !== null) {
    weighted += weightOfRange(normalized.slice(lastIndex, match.index));
    weighted += URL_WEIGHT;
    lastIndex = match.index + match[0].length;
  }

  weighted += weightOfRange(normalized.slice(lastIndex));
  return weighted;
}

function weightOfRange(text: string): number {
  let total = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    total += isLightCodePoint(codePoint) ? 1 : 2;
  }
  return total;
}

function isLightCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0 && codePoint <= 4351) ||
    (codePoint >= 8192 && codePoint <= 8205) ||
    (codePoint >= 8208 && codePoint <= 8223) ||
    (codePoint >= 8242 && codePoint <= 8247)
  );
}
