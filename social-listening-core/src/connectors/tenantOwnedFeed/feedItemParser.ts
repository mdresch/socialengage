/**
 * Minimal RSS 2.0 <item> and Atom <entry> extractor for the tenant-owned-
 * feed connector (ADR-0050) — this connector's own file, deliberately not
 * shared with the Newswire connector's own rssFeedParser.ts (which extracts
 * a wire-specific `<dc:contributor>` issuer field this connector has no use
 * for; Author here is the verified domain, fixed per activation, never
 * derived per item). Covers both RSS and Atom "via the same poll/parse
 * mechanism" per ADR-0050's own Context section. See
 * .claude/skills/tenant-owned-feed-connector/SKILL.md.
 */
export interface ParsedFeedItem {
  /** RSS <guid> or Atom <id> — falls back to <link>/<link href> if absent. */
  id: string;
  link: string;
  title: string;
  /** Raw <pubDate> (RSS) or <updated>/<published> (Atom) text. */
  publishedAt: string;
}

const ITEM_RE = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
const ENTRY_RE = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
const LINK_HREF_RE = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXmlText(raw: string): string {
  return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, entity: string) => {
    if (entity[0] === '#') {
      const codePoint =
        entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? whole : String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[entity] ?? whole;
  });
}

function stripCdata(raw: string): string {
  const match = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return (match ? match[1] : raw).trim();
}

function extractTag(blockXml: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = blockXml.match(re);
  if (!match) return null;
  const value = decodeXmlText(stripCdata(match[1]));
  return value.length > 0 ? value : null;
}

/** RSS <link>text</link> or Atom <link href="..."/> — tries both shapes. */
function extractLink(blockXml: string): string | null {
  return extractTag(blockXml, 'link') ?? blockXml.match(LINK_HREF_RE)?.[1] ?? null;
}

function parseBlocks(xml: string, pattern: RegExp, idTag: string, dateTags: string[]): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(xml)) !== null) {
    const block = match[1];
    const id = extractTag(block, idTag);
    const link = extractLink(block);
    const title = extractTag(block, 'title');
    const publishedAt = dateTags.map((tag) => extractTag(block, tag)).find((v) => v !== null) ?? null;

    if (!title || !publishedAt || !(id || link)) continue;

    items.push({
      id: id ?? (link as string),
      link: link ?? (id as string),
      title,
      publishedAt,
    });
  }
  return items;
}

/** Extracts every item from an RSS 2.0 or Atom feed document. */
export function parseFeedItems(xml: string): ParsedFeedItem[] {
  const rssItems = parseBlocks(xml, ITEM_RE, 'guid', ['pubDate']);
  if (rssItems.length > 0) return rssItems;
  return parseBlocks(xml, ENTRY_RE, 'id', ['updated', 'published']);
}
