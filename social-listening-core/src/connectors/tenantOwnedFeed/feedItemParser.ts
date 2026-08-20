/**
 * Minimal RSS 2.0 <item> and Atom <entry> extractor for the tenant-owned-
 * feed connector (ADR-0050) — this connector's own file, deliberately not
 * shared with the Newswire connector's own rssFeedParser.ts (which extracts
 * a wire-specific `<dc:contributor>` issuer field this connector has no use
 * for; Author here is the verified domain, fixed per activation, never
 * derived per item). Covers both RSS and Atom "via the same poll/parse
 * mechanism" per ADR-0050's own Context section. See
 * .claude/skills/tenant-owned-feed-connector/SKILL.md.
 *
 * Story 2.19 (ADR-0050's 2026-08-20 Amendment Log entry, resolving Open
 * Question 5's display-layer half) — also extracts a per-item byline when
 * the feed provides one (`author` below). This is display-only: it flows
 * into `rawPayload.author` (social-listening-admin's own already-existing
 * `extractAuthor()` precedence chain picks it up for free) but never
 * touches Author/authorId modeling — that stays the verified domain,
 * unchanged, per the header comment above.
 */
export interface ParsedFeedItem {
  /** RSS <guid> or Atom <id> — falls back to <link>/<link href> if absent. */
  id: string;
  link: string;
  title: string;
  /** Raw <pubDate> (RSS) or <updated>/<published> (Atom) text. */
  publishedAt: string;
  /** Story 3.10 (ADR-0053) — RSS <description>; null for an Atom item or an RSS item that omits it. */
  description: string | null;
  /** Story 3.10 (ADR-0053) — RSS <content:encoded>; the richer RSS body source, preferred over description when present. */
  contentEncoded: string | null;
  /** Story 3.10 (ADR-0053) — Atom <summary>; null for an RSS item or an Atom item that omits it. */
  summary: string | null;
  /** Story 3.10 (ADR-0053) — Atom <content>; the richer Atom body source, preferred over summary when present. */
  content: string | null;
  /**
   * Story 3.10 (ADR-0053) — the item's entire raw inner XML block,
   * verbatim. raw_payload-only: never read as a body_markdown source. See
   * .claude/skills/canonical-markdown-conversion/SKILL.md.
   */
  rawXml: string;
  /**
   * Story 2.19 — the item's own byline, best-effort, tried in priority
   * order (see `extractByline()`): RSS Dublin Core `<dc:creator>`, RSS
   * 2.0's own flat `<author>`, Atom's nested `<author><name>`. `null` when
   * the feed provides none of these — never fabricated.
   */
  author: string | null;
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

const ATOM_AUTHOR_RE = /<author(?:\s[^>]*)?>([\s\S]*?)<\/author>/i;
const ATOM_AUTHOR_NAME_RE = /<name(?:\s[^>]*)?>([\s\S]*?)<\/name>/i;

/**
 * Per-item byline, best-effort, tried in priority order: RSS's Dublin Core
 * `<dc:creator>` (the de facto standard most CMS platforms — WordPress and
 * similar — already emit per post), then RSS 2.0's own flat `<author>`
 * (spec says email, but real feeds often put a plain name there instead —
 * extracted as-is, not further parsed), then Atom's nested
 * `<author><name>`. Whichever resolves first wins — a given feed only ever
 * populates one of these shapes, the same "try each, take whichever
 * resolves" pattern this file's date/body extraction already uses.
 */
function extractByline(blockXml: string): string | null {
  const dcCreator = extractTag(blockXml, 'dc:creator');
  if (dcCreator) return dcCreator;

  const authorBlock = blockXml.match(ATOM_AUTHOR_RE)?.[1];
  if (!authorBlock) return null;
  const nameMatch = authorBlock.match(ATOM_AUTHOR_NAME_RE);
  const value = decodeXmlText(stripCdata(nameMatch ? nameMatch[1] : authorBlock));
  return value.length > 0 ? value : null;
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
    // Story 3.10 (ADR-0053): try every format's own tag name in one pass,
    // same "try each, take whichever resolves" shape as dateTags above —
    // a given block only ever populates one format's own fields, so no
    // per-format branching is needed here.
    const description = extractTag(block, 'description');
    const contentEncoded = extractTag(block, 'content:encoded');
    const summary = extractTag(block, 'summary');
    const content = extractTag(block, 'content');
    const author = extractByline(block);

    if (!title || !publishedAt || !(id || link)) continue;

    items.push({
      id: id ?? (link as string),
      link: link ?? (id as string),
      title,
      publishedAt,
      description,
      contentEncoded,
      summary,
      content,
      rawXml: block,
      author,
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
