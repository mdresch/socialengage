export type AstNodeType = 'AND' | 'OR' | 'NOT' | 'TERM' | 'HASHTAG' | 'ACCOUNT';

export type AstNode =
  | { type: 'AND'; left: AstNode; right: AstNode }
  | { type: 'OR'; left: AstNode; right: AstNode }
  | { type: 'NOT'; operand: AstNode }
  | { type: 'TERM'; value: string }
  | { type: 'HASHTAG'; value: string }
  | { type: 'ACCOUNT'; value: string };

const KEYWORDS = new Set(['AND', 'OR', 'NOT']);

function tokenize(query: string): string[] {
  // Parens always split as their own tokens; everything else splits on
  // whitespace. No quoted-phrase support (ADR-0021's v1 node types don't
  // name one) — a single word is a single token.
  return query
    .replace(/([()])/g, ' $1 ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function tokenToLeaf(token: string): AstNode {
  if (token.startsWith('#')) {
    return { type: 'HASHTAG', value: token.slice(1) };
  }
  if (token.startsWith('@')) {
    return { type: 'ACCOUNT', value: token.slice(1) };
  }
  return { type: 'TERM', value: token };
}

/**
 * Recursive-descent parser for ADR-0021's canonical boolean-query AST.
 * Precedence, tightest to loosest: NOT, implicit-adjacency/explicit AND, OR.
 * `#word`/`@word` tokens are HASHTAG/ACCOUNT leaves; anything else is TERM.
 * See .claude/skills/watchlist-matching/SKILL.md.
 */
export function parseBooleanQuery(query: string): AstNode {
  const tokens = tokenize(query);
  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }

  function isKeyword(token: string | undefined, keyword: string): boolean {
    return token !== undefined && token.toUpperCase() === keyword;
  }

  function parseOr(): AstNode {
    let node = parseAnd();
    while (isKeyword(peek(), 'OR')) {
      pos += 1;
      node = { type: 'OR', left: node, right: parseAnd() };
    }
    return node;
  }

  function parseAnd(): AstNode {
    let node = parseNot();
    for (;;) {
      const token = peek();
      if (token === undefined || isKeyword(token, 'OR') || token === ')') break;
      if (isKeyword(token, 'AND')) pos += 1; // explicit AND — consume and continue
      node = { type: 'AND', left: node, right: parseNot() };
    }
    return node;
  }

  function parseNot(): AstNode {
    if (isKeyword(peek(), 'NOT')) {
      pos += 1;
      return { type: 'NOT', operand: parseNot() };
    }
    return parseAtom();
  }

  function parseAtom(): AstNode {
    const token = peek();
    if (token === undefined) {
      throw new Error('Unexpected end of query.');
    }
    if (token === '(') {
      pos += 1;
      const node = parseOr();
      if (peek() !== ')') {
        throw new Error(`Expected ')' at position ${pos}.`);
      }
      pos += 1;
      return node;
    }
    if (token === ')') {
      throw new Error(`Unexpected ')' at position ${pos}.`);
    }
    pos += 1;
    return tokenToLeaf(token);
  }

  const ast = parseOr();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token '${tokens[pos]}' at position ${pos}.`);
  }
  return ast;
}

/** The distinct node types present in a parsed AST — what a connector's declared `supportedQueryFeatures` is checked against. */
export function collectNodeTypes(ast: AstNode): Set<AstNodeType> {
  const types = new Set<AstNodeType>();
  function visit(node: AstNode): void {
    types.add(node.type);
    if (node.type === 'AND' || node.type === 'OR') {
      visit(node.left);
      visit(node.right);
    } else if (node.type === 'NOT') {
      visit(node.operand);
    }
  }
  visit(ast);
  return types;
}
