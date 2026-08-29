import {
  WatchlistAST,
  WatchlistClause,
  WatchlistClauseType,
  WatchlistOperator,
} from '../watchlists/ast';

export interface ConnectorQueryCapabilities {
  platformId: string;
  supportedClauses: WatchlistClauseType[];
  supportedOperators: WatchlistOperator[];
  limits?: {
    maxLength?: number;
    maxClauses?: number;
  };
}

const DEFAULT_PLATFORM_QUERY_CAPABILITIES: Record<string, Omit<ConnectorQueryCapabilities, 'platformId'>> = {
  gnews: {
    supportedClauses: ['keyword', 'phrase', 'source', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    limits: { maxLength: 500, maxClauses: 20 },
  },
  newswire: {
    supportedClauses: ['keyword', 'phrase', 'author', 'source', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    limits: { maxLength: 500, maxClauses: 25 },
  },
  'brave-search': {
    supportedClauses: ['keyword', 'phrase', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    limits: { maxLength: 400, maxClauses: 15 },
  },
  'bing-search': {
    supportedClauses: ['keyword', 'phrase', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    limits: { maxLength: 400, maxClauses: 15 },
  },
  facebook: {
    supportedClauses: ['keyword', 'phrase', 'mention', 'author', 'nested'],
    supportedOperators: ['AND', 'OR'],
    limits: { maxLength: 300, maxClauses: 10 },
  },
  instagram: {
    supportedClauses: ['keyword', 'hashtag', 'mention', 'author'],
    supportedOperators: ['AND', 'OR'],
    limits: { maxLength: 200, maxClauses: 10 },
  },
  linkedin: {
    supportedClauses: ['keyword', 'phrase', 'hashtag', 'mention', 'author', 'nested'],
    supportedOperators: ['AND', 'OR'],
    limits: { maxLength: 300, maxClauses: 10 },
  },
  youtube: {
    supportedClauses: ['keyword', 'phrase', 'hashtag', 'author', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    limits: { maxLength: 500, maxClauses: 20 },
  },
  wikipedia: {
    supportedClauses: ['keyword', 'phrase', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    limits: { maxLength: 500, maxClauses: 20 },
  },
  'tenant-owned-feed': {
    supportedClauses: ['keyword', 'phrase', 'author', 'date', 'nested'],
    supportedOperators: ['AND', 'OR', 'NOT'],
    limits: { maxLength: 500, maxClauses: 20 },
  },
};

/**
 * Returns the query capabilities for a specified platform/connector.
 */
export function getConnectorQueryCapabilities(platformId: string): ConnectorQueryCapabilities | null {
  const normId = platformId.toLowerCase().trim();
  const caps = DEFAULT_PLATFORM_QUERY_CAPABILITIES[normId];
  if (!caps) return null;

  return {
    platformId: normId,
    ...caps,
  };
}

export interface AstValidationResult {
  valid: boolean;
  code?: 'UNSUPPORTED_QUERY_CLAUSE' | 'QUERY_TOO_LONG' | 'TOO_MANY_CLAUSES';
  offendingClause?: WatchlistClause;
  reason?: string;
  warnings?: string[];
}

/**
 * Validates a canonical WatchlistAST against a connector's query capabilities (ADR-0102 §3).
 */
export function validateAstForConnector(
  ast: WatchlistAST,
  platformId: string
): AstValidationResult {
  const caps = getConnectorQueryCapabilities(platformId);
  if (!caps) {
    // If platform capabilities are not registered, allow fallback in-process matching without error
    return { valid: true };
  }

  const supportedClauseSet = new Set<WatchlistClauseType>(caps.supportedClauses);
  const supportedOperatorSet = new Set<WatchlistOperator>(caps.supportedOperators);

  if (!supportedOperatorSet.has(ast.operator)) {
    return {
      valid: false,
      code: 'UNSUPPORTED_QUERY_CLAUSE',
      reason: `Platform '${platformId}' does not support root operator '${ast.operator}'.`,
    };
  }

  let totalClauses = 0;

  function checkClause(clause: WatchlistClause): AstValidationResult | null {
    totalClauses += 1;

    if (!supportedClauseSet.has(clause.type)) {
      return {
        valid: false,
        code: 'UNSUPPORTED_QUERY_CLAUSE',
        offendingClause: clause,
        reason: `Platform '${platformId}' does not support clause type '${clause.type}'.`,
      };
    }

    if (clause.type === 'nested') {
      if (!supportedOperatorSet.has(clause.operator)) {
        return {
          valid: false,
          code: 'UNSUPPORTED_QUERY_CLAUSE',
          offendingClause: clause,
          reason: `Platform '${platformId}' does not support nested operator '${clause.operator}'.`,
        };
      }
      for (const subClause of clause.clauses) {
        const res = checkClause(subClause);
        if (res) return res;
      }
    }

    return null;
  }

  for (const clause of ast.clauses) {
    const res = checkClause(clause);
    if (res) return res;
  }

  if (caps.limits?.maxClauses && totalClauses > caps.limits.maxClauses) {
    return {
      valid: false,
      code: 'TOO_MANY_CLAUSES',
      reason: `Query exceeds maximum clause limit of ${caps.limits.maxClauses} for platform '${platformId}'.`,
    };
  }

  return { valid: true };
}
