/**
 * Minimal RSS 2.0 <item> extractor for the Newswire connector (ADR-0024). Not
 * a general-purpose XML parser — deliberately scoped to the handful of fields
 * both GlobeNewswire's and PR Newswire's public feeds reliably carry
 * (verified against live feed samples before this was written), tolerating
 * the two real differences observed between them: multi-line tag attributes
 * (GlobeNewswire's <guid isPermaLink="true">) and CDATA-wrapped values
 * (PR Newswire's <dc:contributor>, GlobeNewswire's <description>). See
 * .claude/skills/newswire-connector/SKILL.md.
 */
export interface ParsedRssItem {
  /** The item's own permalink/guid — used as NormalizedPost.externalId. */
  guid: string;
  link: string;
  title: string;
  /** Raw <pubDate> text (RFC-822-ish); both wires' formats parse via `new Date()`. */
  pubDate: string;
  /** <dc:contributor> — the issuing organization on both wires; null if a feed item omits it. */
  issuer: string | null;
  /**
   * Story 3.10 (ADR-0053) — the item's <description>, CDATA-stripped and
   * entity-decoded like every other extracted field; null if absent or
   * empty. Fallback body source when <content:encoded> is absent — see
   * .claude/skills/canonical-markdown-conversion/SKILL.md for the
   * precedence rule.
   */
  description: string | null;
  /** Story 3.10 (ADR-0053) — <content:encoded>; the richer body source, preferred over description when present. */
  contentEncoded: string | null;
  /**
   * Story 3.10 (ADR-0053) — the item's entire raw inner XML block,
   * verbatim. raw_payload-only: never read as a body_markdown source
   * (the precedence rule above is unchanged). Closes the "second finding"
   * raw_payload under-capture gap named in ADR-0053's own Context.
   */
  rawXml: string;
}

const ITEM_RE = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;

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

function extractTag(itemXml: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = itemXml.match(re);
  if (!match) return null;
  const value = decodeXmlText(stripCdata(match[1]));
  return value.length > 0 ? value : null;
}

/** Extracts every <item> in an RSS 2.0 document; skips an item missing a title, pubDate, or both guid and link. */
export function parseRssItems(xml: string): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  let match: RegExpExecArray | null;
  ITEM_RE.lastIndex = 0;
  while ((match = ITEM_RE.exec(xml)) !== null) {
    const block = match[1];
    const guid = extractTag(block, 'guid');
    const link = extractTag(block, 'link');
    const title = extractTag(block, 'title');
    const pubDate = extractTag(block, 'pubDate');
    const issuer = extractTag(block, 'dc:contributor');
    const description = extractTag(block, 'description');
    const contentEncoded = extractTag(block, 'content:encoded');

    if (!title || !pubDate || !(guid || link)) continue;

    items.push({
      guid: guid ?? (link as string),
      link: link ?? (guid as string),
      title,
      pubDate,
      issuer,
      description,
      contentEncoded,
      rawXml: block,
    });
  }
  return items;
}
