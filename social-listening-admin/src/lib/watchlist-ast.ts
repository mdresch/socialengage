/**
 * Canonical WatchlistAST schema and query parsing utilities for social-listening-admin.
 * Corresponds to ADR-0102.
 */

export type ClauseType =
  | 'keyword'
  | 'phrase'
  | 'hashtag'
  | 'mention'
  | 'author'
  | 'source'
  | 'sentiment'
  | 'date'
  | 'nested';

export type DateOperator = '>=' | '<=' | '=' | '>' | '<';

export type WatchlistClause =
  | { type: 'keyword'; value: string }
  | { type: 'phrase'; value: string }
  | { type: 'hashtag'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'author'; value: string }
  | { type: 'source'; value: string }
  | { type: 'sentiment'; value: 'positive' | 'negative' | 'neutral' | string }
  | { type: 'date'; operator: DateOperator; value: string }
  | { type: 'nested'; operator: 'AND' | 'OR' | 'NOT'; clauses: WatchlistClause[] };

export interface WatchlistAST {
  operator: 'AND' | 'OR' | 'NOT';
  clauses: WatchlistClause[];
}

export interface ConnectorQueryCapabilities {
  platformId: string;
  supportedClauses: ClauseType[];
  supportedOperators: Array<'AND' | 'OR' | 'NOT'>;
  maxLength?: number;
  maxClauses?: number;
}

export interface AstWarning {
  platformId: string;
  clause: WatchlistClause;
  message: string;
}

/**
 * Validates an AST against one or more connector capabilities.
 */
export function validateAstAgainstCapabilities(
  ast: WatchlistAST,
  capabilitiesList: ConnectorQueryCapabilities[]
): AstWarning[] {
  const warnings: AstWarning[] = [];

  function checkClause(clause: WatchlistClause, caps: ConnectorQueryCapabilities) {
    if (!caps.supportedClauses.includes(clause.type)) {
      warnings.push({
        platformId: caps.platformId,
        clause,
        message: `Platform '${caps.platformId}' does not support clause type '${clause.type}'`,
      });
    }

    if (clause.type === 'nested') {
      if (!caps.supportedOperators.includes(clause.operator)) {
        warnings.push({
          platformId: caps.platformId,
          clause,
          message: `Platform '${caps.platformId}' does not support operator '${clause.operator}' in nested group`,
        });
      }
      for (const nestedClause of clause.clauses) {
        checkClause(nestedClause, caps);
      }
    }
  }

  for (const caps of capabilitiesList) {
    if (!caps.supportedOperators.includes(ast.operator)) {
      warnings.push({
        platformId: caps.platformId,
        clause: { type: 'keyword', value: '' },
        message: `Platform '${caps.platformId}' does not support root operator '${ast.operator}'`,
      });
    }

    for (const clause of ast.clauses) {
      checkClause(clause, caps);
    }
  }

  return warnings;
}

/**
 * Converts a canonical WatchlistAST to a text boolean query string.
 */
export function astToBooleanQuery(ast: WatchlistAST): string {
  function serializeClause(clause: WatchlistClause): string {
    switch (clause.type) {
      case 'keyword':
        return clause.value;
      case 'phrase':
        return `"${clause.value}"`;
      case 'hashtag':
        return `#${clause.value.replace(/^#/, '')}`;
      case 'mention':
        return `@${clause.value.replace(/^@/, '')}`;
      case 'author':
        return `from:${clause.value}`;
      case 'source':
        return `source:${clause.value}`;
      case 'sentiment':
        return `sentiment:${clause.value}`;
      case 'date':
        return `date:${clause.operator}${clause.value}`;
      case 'nested':
        return `(${serializeGroup(clause.operator, clause.clauses)})`;
    }
  }

  function serializeGroup(operator: 'AND' | 'OR' | 'NOT', clauses: WatchlistClause[]): string {
    if (clauses.length === 0) return '';
    if (operator === 'NOT') {
      return `NOT (${clauses.map(serializeClause).join(' OR ')})`;
    }
    return clauses.map(serializeClause).join(` ${operator} `);
  }

  return serializeGroup(ast.operator, ast.clauses);
}

/**
 * Parses a boolean query text into a WatchlistAST.
 */
export function parseBooleanQueryToAst(rawQuery: string): WatchlistAST {
  const query = (rawQuery || '').trim();
  if (!query) {
    return { operator: 'AND', clauses: [] };
  }

  const clauses: WatchlistClause[] = [];
  let rootOperator: 'AND' | 'OR' | 'NOT' = 'AND';

  if (query.toUpperCase().includes(' OR ') && !query.toUpperCase().includes(' AND ')) {
    rootOperator = 'OR';
  }

  // Tokenize considering quotes and parentheses
  const regex = /("[^"]+"|\([^)]+\)|[^\s()]+)/g;
  const tokens = query.match(regex) || [];

  let currentNot = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (!token) continue;

    const upper = token.toUpperCase();
    if (upper === 'AND') {
      continue;
    }
    if (upper === 'OR') {
      rootOperator = 'OR';
      continue;
    }
    if (upper === 'NOT') {
      currentNot = true;
      continue;
    }

    let clause: WatchlistClause | null = null;

    if (token.startsWith('"') && token.endsWith('"')) {
      clause = { type: 'phrase', value: token.slice(1, -1) };
    } else if (token.startsWith('#')) {
      clause = { type: 'hashtag', value: token.slice(1) };
    } else if (token.startsWith('@')) {
      clause = { type: 'mention', value: token.slice(1) };
    } else if (token.startsWith('from:')) {
      clause = { type: 'author', value: token.slice(5) };
    } else if (token.startsWith('source:')) {
      clause = { type: 'source', value: token.slice(7) };
    } else if (token.startsWith('sentiment:')) {
      clause = { type: 'sentiment', value: token.slice(10) };
    } else if (token.startsWith('date:')) {
      const dateVal = token.slice(5);
      const match = dateVal.match(/^(>=|<=|>|<|=)?(.*)$/);
      const op = (match?.[1] as DateOperator) || '>=';
      const val = match?.[2] || dateVal;
      clause = { type: 'date', operator: op, value: val };
    } else if (token.startsWith('(') && token.endsWith(')')) {
      const inner = token.slice(1, -1);
      const nestedAst = parseBooleanQueryToAst(inner);
      clause = {
        type: 'nested',
        operator: nestedAst.operator,
        clauses: nestedAst.clauses,
      };
    } else {
      clause = { type: 'keyword', value: token };
    }

    if (clause) {
      if (currentNot) {
        clauses.push({
          type: 'nested',
          operator: 'NOT',
          clauses: [clause],
        });
        currentNot = false;
      } else {
        clauses.push(clause);
      }
    }
  }

  return { operator: rootOperator, clauses };
}
