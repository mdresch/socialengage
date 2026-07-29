import { AIProviderConnector } from '../types';

/**
 * Minimal reference AIProviderConnector proving the framework generalizes to AI
 * providers using the same registration mechanism as social connectors — not a
 * real integration. See .claude/skills/provider-connector-framework/SKILL.md.
 */
export const exampleAiProviderX: AIProviderConnector = {
  providerId: 'example-ai-x',
  authMode: 'api_key',

  getRateLimitConfig: () => ({ requestsPerWindow: 30, windowSeconds: 60 }),

  listModels: () => ['example-model-1'],

  getModelRateLimit: () => ({ requestsPerWindow: 30, windowSeconds: 60 }),

  getModelCapabilities: () => ({
    supportsSentiment: true,
    supportsEntities: true,
    supportsKeyPhrases: false,
    supportsLanguageDetection: true,
  }),

  analyze: async (_modelId, text) => ({
    sentiment: text.length > 0 ? 'neutral' : undefined,
    detectedLanguage: 'en',
  }),
};
