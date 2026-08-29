import { AIProviderConnector, SocialConnector, SocialConnectorCapabilities } from './types';

const socialConnectors = new Map<string, SocialConnector>();
const aiProviderConnectors = new Map<string, AIProviderConnector>();

export function registerSocialConnector(connector: SocialConnector): void {
  socialConnectors.set(connector.providerId, connector);
}

export function registerAIProviderConnector(connector: AIProviderConnector): void {
  aiProviderConnectors.set(connector.providerId, connector);
}

export function getSocialConnector(providerId: string): SocialConnector | undefined {
  return socialConnectors.get(providerId);
}

export function getAIProviderConnector(providerId: string): AIProviderConnector | undefined {
  return aiProviderConnectors.get(providerId);
}

export function listSocialConnectors(): SocialConnector[] {
  return [...socialConnectors.values()];
}

export function listAIProviderConnectors(): AIProviderConnector[] {
  return [...aiProviderConnectors.values()];
}

/**
 * Story 12.1 (ADR-0101 §1–§6) — Resolve capability matrix for a connector.
 */
export function getConnectorCapabilities(providerId: string, tenantId?: string): SocialConnectorCapabilities {
  const connector = socialConnectors.get(providerId);
  if (connector?.getCapabilities) {
    return connector.getCapabilities(tenantId);
  }

  const sourceType: SocialConnectorCapabilities['sourceType'] = connector?.sourceType ?? 'social';

  const poll = connector?.poll
    ? { cadenceMs: connector.pollCadenceMs || 15 * 60 * 1000, supportsTimeWindow: true }
    : connector?.pollUser
    ? { cadenceMs: connector.pollCadenceMs || 30 * 60 * 1000, supportsTimeWindow: true }
    : Boolean(connector?.deliveryMode === 'poll');

  const capabilities: SocialConnectorCapabilities = {
    sourceType,
    poll,
  };

  if (connector?.count) {
    capabilities.count = { supportsExactCount: true };
  }

  if (connector?.publish) {
    capabilities.publish = {
      supportsScheduling: true,
      supportedAssetTypes: ['text', 'image', 'video'],
    };
  }

  if (connector?.reply) {
    capabilities.reply = true;
  }

  return capabilities;
}

export interface ConnectorCapabilitySummary {
  platformId: string;
  name: string;
  authMode: 'oauth' | 'api_key' | 'none';
  capabilities: SocialConnectorCapabilities;
}

/**
 * Story 12.1 (ADR-0101 §3) — List all registered connectors and their capabilities.
 */
export function listConnectorCapabilities(tenantId?: string): ConnectorCapabilitySummary[] {
  return listSocialConnectors().map((c) => ({
    platformId: c.providerId,
    name: c.providerId.charAt(0).toUpperCase() + c.providerId.slice(1).replace(/-/g, ' '),
    authMode: c.authMode,
    capabilities: getConnectorCapabilities(c.providerId, tenantId),
  }));
}

/** Test-only: isolates contract files that register connectors under colliding providerIds. */
export function __resetRegistryForTests(): void {
  socialConnectors.clear();
  aiProviderConnectors.clear();
}
