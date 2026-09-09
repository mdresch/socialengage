export type AstNodeType = 'AND' | 'OR' | 'NOT' | 'TERM' | 'HASHTAG' | 'ACCOUNT';

export type AstNode =
  | { type: 'AND'; left: AstNode; right: AstNode }
  | { type: 'OR'; left: AstNode; right: AstNode }
  | { type: 'NOT'; operand: AstNode }
  | { type: 'TERM'; value: string }
  | { type: 'HASHTAG'; value: string }
  | { type: 'ACCOUNT'; value: string };

/* =========================================================================
 * Canonical WatchlistAST (ADR-0102)
 * ========================================================================= */

export type WatchlistClauseType =
  | 'keyword'
  | 'phrase'
  | 'hashtag'
  | 'mention'
  | 'author'
  | 'source'
  | 'sentiment'
  | 'date'
  | 'nested';

export type WatchlistOperator = 'AND' | 'OR' | 'NOT';

export interface WatchlistKeywordClause {
  type: 'keyword';
  value: string;
}

export interface WatchlistPhraseClause {
  type: 'phrase';
  value: string;
}

export interface WatchlistHashtagClause {
  type: 'hashtag';
  value: string;
}

export interface WatchlistMentionClause {
  type: 'mention';
  value: string;
}

export interface WatchlistAuthorClause {
  type: 'author';
  value: string;
}

export interface WatchlistSourceClause {
  type: 'source';
  value: string;
}

export interface WatchlistSentimentClause {
  type: 'sentiment';
  value: 'positive' | 'negative' | 'neutral' | string;
}

export interface WatchlistDateClause {
  type: 'date';
  operator: '>=' | '<=' | '=' | '>' | '<';
  value: string;
}

export interface WatchlistNestedClause {
  type: 'nested';
  operator: WatchlistOperator;
  clauses: WatchlistClause[];
}

export type WatchlistClause =
  | WatchlistKeywordClause
  | WatchlistPhraseClause
  | WatchlistHashtagClause
  | WatchlistMentionClause
  | WatchlistAuthorClause
  | WatchlistSourceClause
  | WatchlistSentimentClause
  | WatchlistDateClause
  | WatchlistNestedClause;

export interface WatchlistAST {
  operator: WatchlistOperator;
  clauses: WatchlistClause[];
}

const VALID_CLAUSE_TYPES = new Set<WatchlistClauseType>([
  'keyword',
  'phrase',
  'hashtag',
  'mention',
  'author',
  'source',
  'sentiment',
  'date',
  'nested',
]);

const VALID_OPERATORS = new Set<WatchlistOperator>(['AND', 'OR', 'NOT']);

/**
 * Validates the structure and types of a WatchlistAST object.
 */
export function validateWatchlistAst(ast: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!ast || typeof ast !== 'object') {
    return { valid: false, errors: ['AST must be a non-null object.'] };
  }

  if (!VALID_OPERATORS.has(ast.operator)) {
    errors.push(`Invalid operator '${ast.operator}'. Must be AND, OR, or NOT.`);
  }

  if (!Array.isArray(ast.clauses)) {
    errors.push('AST clauses must be an array.');
    return { valid: false, errors };
  }

  function validateClause(clause: any, path: string): void {
    if (!clause || typeof clause !== 'object') {
      errors.push(`Clause at ${path} must be an object.`);
      return;
    }

    if (!VALID_CLAUSE_TYPES.has(clause.type)) {
      errors.push(`Invalid clause type '${clause.type}' at ${path}.`);
      return;
    }

    if (clause.type === 'nested') {
      if (!VALID_OPERATORS.has(clause.operator)) {
        errors.push(`Invalid nested operator '${clause.operator}' at ${path}.`);
      }
      if (!Array.isArray(clause.clauses)) {
        errors.push(`Nested clauses at ${path} must be an array.`);
      } else {
        clause.clauses.forEach((c: any, i: number) => validateClause(c, `${path}.clauses[${i}]`));
      }
    } else if (clause.type === 'date') {
      if (typeof clause.value !== 'string' || !clause.value) {
        errors.push(`Date clause at ${path} requires a non-empty string value.`);
      }
      if (!['>=', '<=', '=', '>', '<'].includes(clause.operator)) {
        errors.push(`Date clause at ${path} has invalid operator '${clause.operator}'.`);
      }
    } else {
      if (typeof clause.value !== 'string' || !clause.value) {
        errors.push(`Clause of type '${clause.type}' at ${path} requires a non-empty string value.`);
      }
    }
  }

  ast.clauses.forEach((clause: any, index: number) => validateClause(clause, `clauses[${index}]`));

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Converts a legacy boolean query text string into a canonical WatchlistAST (ADR-0102 §4).
 */
export function parseBooleanQueryToAst(query: string): WatchlistAST {
  const legacyAst = parseBooleanQuery(query);

  function convertNode(node: AstNode): { operator: WatchlistOperator; clauses: WatchlistClause[] } {
    if (node.type === 'AND' || node.type === 'OR') {
      const left = convertNode(node.left);
      const right = convertNode(node.right);

      const clauses: WatchlistClause[] = [];

      if (left.operator === node.type) {
        clauses.push(...left.clauses);
      } else if (left.clauses.length === 1) {
        clauses.push(left.clauses[0]);
      } else if (left.clauses.length > 1) {
        clauses.push({ type: 'nested', operator: left.operator, clauses: left.clauses });
      }

      if (right.operator === node.type) {
        clauses.push(...right.clauses);
      } else if (right.clauses.length === 1) {
        clauses.push(right.clauses[0]);
      } else if (right.clauses.length > 1) {
        clauses.push({ type: 'nested', operator: right.operator, clauses: right.clauses });
      }

      return { operator: node.type, clauses };
    }

    if (node.type === 'NOT') {
      const operand = convertNode(node.operand);
      return {
        operator: 'NOT',
        clauses:
          operand.clauses.length === 1
            ? operand.clauses
            : [{ type: 'nested', operator: operand.operator, clauses: operand.clauses }],
      };
    }

    if (node.type === 'HASHTAG') {
      return { operator: 'AND', clauses: [{ type: 'hashtag', value: node.value }] };
    }

    if (node.type === 'ACCOUNT') {
      return { operator: 'AND', clauses: [{ type: 'mention', value: node.value }] };
    }

    return { operator: 'AND', clauses: [{ type: 'keyword', value: node.value }] };
  }

  const result = convertNode(legacyAst);
  return {
    operator: result.operator,
    clauses: result.clauses,
  };
}

/**
 * Serializes a canonical WatchlistAST back to a human-readable query string.
 */
export function astToBooleanQuery(ast: WatchlistAST): string {
  function serializeClause(clause: WatchlistClause): string {
    switch (clause.type) {
      case 'keyword':
        return clause.value;
      case 'phrase':
        return `"${clause.value}"`;
      case 'hashtag':
        return `#${clause.value}`;
      case 'mention':
        return `@${clause.value}`;
      case 'author':
        return `from:${clause.value}`;
      case 'source':
        return `source:${clause.value}`;
      case 'sentiment':
        return `sentiment:${clause.value}`;
      case 'date':
        return `date:${clause.operator}${clause.value}`;
      case 'nested':
        return `(${clause.clauses.map(serializeClause).join(` ${clause.operator} `)})`;
    }
  }

  if (ast.operator === 'NOT') {
    return `NOT (${ast.clauses.map(serializeClause).join(' AND ')})`;
  }

  return ast.clauses.map(serializeClause).join(` ${ast.operator} `);
}

/* =========================================================================
 * Legacy Parser (ADR-0021)
 * ========================================================================= */

const KEYWORDS = new Set(['AND', 'OR', 'NOT']);

function tokenize(query: string): string[] {
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
