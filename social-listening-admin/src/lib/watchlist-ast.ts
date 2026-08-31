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
  /** Legacy top-level limits (kept for Story 12.4 compatibility). */
  maxLength?: number;
  maxClauses?: number;
  /** Normalized `limits` object returned by `GET /v1/connectors/:platformId/query-capabilities`. */
  limits?: {
    maxLength?: number;
    maxClauses?: number;
  };
}

export interface AstWarning {
  platformId: string;
  clause: WatchlistClause;
  message: string;
}

export interface AstError {
  platformId: string;
  code: 'TOO_MANY_CLAUSES' | 'QUERY_TOO_LONG';
  message: string;
}

function clauseCountLimit(caps: ConnectorQueryCapabilities): number | undefined {
  return caps.maxClauses ?? caps.limits?.maxClauses;
}

function queryLengthLimit(caps: ConnectorQueryCapabilities): number | undefined {
  return caps.maxLength ?? caps.limits?.maxLength;
}

/**
 * Counts every clause node in an AST, including nested children.
 */
export function countClauses(ast: WatchlistAST): number {
  let count = 0;
  function walk(clauses: WatchlistClause[]) {
    for (const clause of clauses) {
      count++;
      if (clause.type === 'nested') {
        walk(clause.clauses);
      }
    }
  }
  walk(ast.clauses);
  return count;
}

/**
 * Returns a map of clause path -> per-platform warnings.
 * Paths are: 'root.operator', 'root.clauses.0', 'root.clauses.0.clauses.1', ...
 */
export function getWarningsByClausePath(
  ast: WatchlistAST,
  capabilitiesList: ConnectorQueryCapabilities[]
): Record<string, AstWarning[]> {
  const map: Record<string, AstWarning[]> = {};

  function add(path: string, warning: AstWarning) {
    const list = (map[path] ??= []);
    list.push(warning);
  }

  for (const caps of capabilitiesList) {
    if (!caps.supportedOperators.includes(ast.operator)) {
      add('root.operator', {
        platformId: caps.platformId,
        clause: { type: 'keyword', value: '' },
        message: `Platform '${caps.platformId}' does not support root operator '${ast.operator}'. This clause will run as fallback matching.`,
      });
    }
  }

  function walk(clauses: WatchlistClause[], pathPrefix: string) {
    clauses.forEach((clause, index) => {
      const path = `${pathPrefix}.clauses.${index}`;
      for (const caps of capabilitiesList) {
        if (!caps.supportedClauses.includes(clause.type)) {
          add(path, {
            platformId: caps.platformId,
            clause,
            message: `Platform '${caps.platformId}' does not support clause type '${clause.type}'. This clause will run as fallback matching.`,
          });
        }

        if (clause.type === 'nested') {
          if (!caps.supportedOperators.includes(clause.operator)) {
            add(path, {
              platformId: caps.platformId,
              clause,
              message: `Platform '${caps.platformId}' does not support operator '${clause.operator}' in nested group. This clause will run as fallback matching.`,
            });
          }
          walk(clause.clauses, path);
        }
      }
    });
  }

  walk(ast.clauses, 'root');
  return map;
}

/**
 * Validates an AST against connector query-length and clause-count limits.
 * Returns errors that should block saving (actual 422-style errors).
 */
export function validateAstQueryLimits(
  ast: WatchlistAST,
  capabilitiesList: ConnectorQueryCapabilities[]
): AstError[] {
  const errors: AstError[] = [];
  const totalClauses = countClauses(ast);
  const query = astToBooleanQuery(ast);

  for (const caps of capabilitiesList) {
    const maxClauses = clauseCountLimit(caps);
    if (typeof maxClauses === 'number' && totalClauses > maxClauses) {
      errors.push({
        platformId: caps.platformId,
        code: 'TOO_MANY_CLAUSES',
        message: `Platform '${caps.platformId}' supports at most ${maxClauses} clauses (got ${totalClauses}).`,
      });
    }

    const maxLength = queryLengthLimit(caps);
    if (typeof maxLength === 'number' && query.length > maxLength) {
      errors.push({
        platformId: caps.platformId,
        code: 'QUERY_TOO_LONG',
        message: `Platform '${caps.platformId}' query must not exceed ${maxLength} characters (got ${query.length}).`,
      });
    }
  }

  return errors;
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
