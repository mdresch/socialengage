import { AIProviderConnector, SocialConnector } from './types';

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

/** Test-only: isolates contract files that register connectors under colliding providerIds. */
export function __resetRegistryForTests(): void {
  socialConnectors.clear();
  aiProviderConnectors.clear();
}
