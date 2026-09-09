import type { RAGConnector } from './types';
import { PgvectorRAGConnector } from './pgvectorConnector';

const connectors = new Map<string, RAGConnector>();

// Register default pgvector connector
const defaultPgvector = new PgvectorRAGConnector();
connectors.set('pgvector', defaultPgvector);

/**
 * Story 9.7 (ADR-0081 §11) — Registry for RAGConnector instances.
 * Separate from ProviderConnector registry.
 */
export function getRagConnector(providerId = 'pgvector'): RAGConnector {
  const connector = connectors.get(providerId);
  if (!connector) {
    throw new Error(`RAGConnector provider "${providerId}" is not registered`);
  }
  return connector;
}

export function registerRagConnector(providerId: string, connector: RAGConnector): void {
  connectors.set(providerId, connector);
}

export function resetRagConnectorRegistry(): void {
  connectors.clear();
  connectors.set('pgvector', new PgvectorRAGConnector());
}
