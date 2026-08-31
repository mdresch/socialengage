import {
  WatchlistAST,
  WatchlistClause,
  WatchlistClauseType,
  WatchlistOperator,
} from '../watchlists/ast';
import {
  getConnectorQueryTranslator,
  ConnectorQueryTranslator,
  NativeQuery,
  AstValidationResult,
} from './queryTranslation';

export { getConnectorQueryTranslator };
export type { ConnectorQueryTranslator, NativeQuery, AstValidationResult };

export interface ConnectorQueryCapabilities {
  platformId: string;
  supportedClauses: WatchlistClauseType[];
  supportedOperators: WatchlistOperator[];
  limits?: {
    maxLength?: number;
    maxClauses?: number;
  };
}

/**
 * Returns the query capabilities for a specified platform/connector.
 */
export function getConnectorQueryCapabilities(platformId: string): ConnectorQueryCapabilities | null {
  const translator = getConnectorQueryTranslator(platformId);
  if (!translator) return null;

  return {
    platformId: translator.platformId,
    supportedClauses: translator.supportedClauses,
    supportedOperators: translator.supportedOperators,
    limits: {
      maxLength: translator.maxQueryLength,
      maxClauses: translator.maxClauseCount,
    },
  };
}

/**
 * Validates a canonical WatchlistAST against a connector's query translator (ADR-0102 §3, ADR-0110).
 * Falls back to valid for unknown platforms so that connectors without a registered translator
 * continue to rely on post-fetch fallback matching.
 */
export function validateAstForConnector(
  ast: WatchlistAST,
  platformId: string
): AstValidationResult {
  const translator = getConnectorQueryTranslator(platformId);
  if (!translator) {
    // If no translator is registered, allow fallback in-process matching without error.
    return { valid: true };
  }

  return translator.validate(ast);
}
