export type MentionSegment = { kind: 'text'; text: string } | { kind: 'mention'; name: string };

const MENTION_TOKEN_SOURCE = String.raw`@\[([^\][\n]+)\]`;

function createMentionTokenPattern(): RegExp {
  return new RegExp(MENTION_TOKEN_SOURCE, 'g');
}

export function hasMentionTokens(text: string): boolean {
  return parseMentionSegments(text).some((segment) => segment.kind === 'mention');
}

export function parseMentionSegments(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  const pattern = createMentionTokenPattern();
  let consumedIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (!name) continue;

    if (match.index > consumedIndex) {
      segments.push({ kind: 'text', text: text.slice(consumedIndex, match.index) });
    }

    segments.push({ kind: 'mention', name });
    consumedIndex = match.index + match[0].length;
  }

  if (consumedIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(consumedIndex) });
  }

  return segments;
}

export function flattenMentionTokens(text: string, options: { collapseSpaces?: boolean } = {}): string {
  const collapseSpaces = options.collapseSpaces ?? false;
  return text.replace(createMentionTokenPattern(), (token, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return token;
    return `@${collapseSpaces ? trimmed.replace(/\s+/g, '') : trimmed}`;
  });
}

export function transformAroundMentionTokens(text: string, transform: (chunk: string) => string): string {
  const pattern = createMentionTokenPattern();
  let output = '';
  let consumedIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (!match[1].trim()) continue;

    output += transform(text.slice(consumedIndex, match.index)) + match[0];
    consumedIndex = match.index + match[0].length;
  }

  return output + transform(text.slice(consumedIndex));
}
