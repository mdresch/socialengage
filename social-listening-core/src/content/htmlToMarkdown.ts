// Explicit reference (not just tsconfig's own "include" glob): ts-node
// type-checks per-file, on demand, following only the reachable
// import/reference graph -- it never eagerly loads a stray ambient .d.ts
// the way `tsc`/ts-jest's own full-Program checks do. Without this, `ts-node
// src/http/server.ts` (Story 1.10's own real-process spawn) fails to
// resolve turndown-plugin-gfm's types even though `tsc --noEmit` and the
// Jest suite both see it fine.
/// <reference path="./turndown-plugin-gfm.d.ts" />
import TurndownService from 'turndown';
import sanitizeHtml from 'sanitize-html';
import { tables } from 'turndown-plugin-gfm';

/**
 * Story 3.10 (ADR-0053) — the shared HTML/plain-text-to-Markdown pipeline
 * every real connector's own ingestX() function calls to compute
 * social_posts.body_markdown once, at ingestion. Not owned by any one
 * connector — see .claude/skills/canonical-markdown-conversion/SKILL.md.
 *
 * turndown/sanitize-html/turndown-plugin-gfm versions pinned exactly (see
 * package.json) -- see ADR-0053 before bumping any of them; the
 * allowedTags/nonTextTags lists and table-conversion behavior below were
 * verified against these specific versions and a version bump could
 * silently change any library's own internal behavior even with our own
 * config unchanged.
 */

/**
 * ADR-0053 Decision §3 — a real, revisable implementation default, not a
 * durable ceiling. Bounds both untrusted-parser exposure (sanitize-html/
 * turndown never see more than this many characters) and per-post
 * enrichment cost. Applied before sanitization/conversion ever run.
 */
export const MAX_BODY_SOURCE_LENGTH = 100_000;

/**
 * ADR-0053 Decision §2 — bump whenever a pipeline change (a library
 * version bump, or a configuration change to ALLOWED_TAGS/the tracking-
 * parameter denylist/etc.) could plausibly alter output for real content.
 * Judged at implementer discretion, not mechanically triggered by every
 * dependency update. See .claude/skills/canonical-markdown-conversion/SKILL.md.
 */
export const BODY_MARKDOWN_VERSION = 1;

/**
 * ADR-0053 Decision §3 — copied verbatim from sanitize-html@2.17.6's own
 * current default allowedTags set, minus <img> (deliberately excluded:
 * body_markdown is text-oriented, not display-preserving, and this has
 * the useful side effect of excluding tracking pixels without needing any
 * pixel-specific heuristic). Pinned as a literal array, not inherited
 * implicitly from the library's own defaults, so a future sanitize-html
 * version bump can't silently widen or narrow what's permitted.
 */
const ALLOWED_TAGS = [
  'address', 'article', 'aside', 'footer', 'header', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup', 'main', 'nav',
  'section', 'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'hr', 'li', 'menu', 'ol', 'p', 'pre',
  'ul', 'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 'rb',
  'rp', 'rt', 'rtc', 'ruby', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
  'caption', 'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
];

/**
 * ADR-0053 Decision §3 — pinned explicitly for the same "no silent future
 * drift" reason as ALLOWED_TAGS above. This is what makes <script>/<style>
 * content fully discarded, not merely unwrapped -- both the tag and its
 * inner text are dropped together.
 */
const NON_TEXT_TAGS = ['script', 'style', 'textarea', 'option'];

/**
 * ADR-0053 Decision §3 — a fixed, named, revisable denylist, not an
 * unbounded or unspecified "clean the URL somehow." Stripped from every
 * <a href>'s own query string before the value is retained; the link
 * itself and any of its own legitimate query parameters are preserved.
 */
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'mc_cid', 'mc_eid',
];

/**
 * Removes only the named tracking parameters from an href's own query
 * string, working on the string directly (no WHATWG URL parse) so both
 * absolute and relative hrefs are handled identically -- exclusiveFilter
 * below is what decides whether a resulting bare href should drop its
 * wrapper, this function only ever strips parameters.
 */
function stripTrackingParams(href: string): string {
  const hashIndex = href.indexOf('#');
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const beforeHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = beforeHash.indexOf('?');
  if (queryIndex < 0) return href;

  const base = beforeHash.slice(0, queryIndex);
  const query = beforeHash.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  for (const param of TRACKING_PARAMS) params.delete(param);
  const remaining = params.toString();
  return remaining ? `${base}?${remaining}${hash}` : `${base}${hash}`;
}

/**
 * ADR-0053 Decision §3 — a real failure mode of stripping above: if a
 * URL's entire query string was tracking parameters, stripping leaves a
 * bare, dead-end domain (the email-marketing click-redirect case). "Bare"
 * means no path (or only "/"), no remaining query, no fragment. An href
 * that fails to parse as an absolute URL is treated conservatively (kept,
 * not excluded) -- this also covers a relative href reduced to only a
 * stripped tracking parameter, since the WHATWG URL constructor requires
 * a base to resolve a relative reference and throws without one.
 */
function isBareHref(href: string): boolean {
  try {
    const url = new URL(href);
    return (url.pathname === '' || url.pathname === '/') && url.search === '' && url.hash === '';
  } catch {
    return false;
  }
}

const turndownService = new TurndownService();
turndownService.use(tables);

function sanitizeSource(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    nonTextTags: NON_TEXT_TAGS,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.href ? { ...attribs, href: stripTrackingParams(attribs.href) } : attribs,
      }),
    },
    // Returning 'excludeTag' (not bare true) unwraps the tag while
    // preserving its inner text -- bare true would discard real prose
    // content over a merely-broken link (ADR-0053 Decision §3).
    exclusiveFilter: (frame) => {
      if (frame.tag !== 'a') return false;
      const href = frame.attribs.href;
      return href && isBareHref(href) ? 'excludeTag' : false;
    },
  });
}

/**
 * Converts a raw body string (HTML or already-plain text) to normalized
 * Markdown: truncate -> sanitize -> convert (ADR-0053 Decision §3). Safe
 * pass-through for already-plain text, with one honest caveat: Markdown-
 * significant characters (*, _, [, ], etc.) occurring naturally in plain
 * text get backslash-escaped -- correct, round-trip-safe Markdown
 * behavior, not a defect. Returns '' for empty/whitespace-only input;
 * callers are responsible for collapsing that to NULL before storage
 * (see .claude/skills/canonical-markdown-conversion/SKILL.md).
 */
export function htmlToMarkdown(raw: string): string {
  const truncated = raw.slice(0, MAX_BODY_SOURCE_LENGTH);
  const sanitized = sanitizeSource(truncated);
  return turndownService.turndown(sanitized);
}
