import { AIProviderConnector } from '../types';

/**
 * Second minimal reference AIProviderConnector — deliberately has per-model rate
 * limits that differ within the same provider, proving getModelRateLimit(modelId)
 * is genuinely per-model, not per-provider (ADR-0002's one exception to the shared
 * contract). See .claude/skills/provider-connector-framework/SKILL.md.
 */
export const exampleAiProviderY: AIProviderConnector = {
  providerId: 'example-ai-y',
  authMode: 'oauth',

  getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 60 }),

  listModels: () => ['example-model-2', 'example-model-3'],

  getModelRateLimit: (modelId) => ({
    requestsPerWindow: modelId === 'example-model-2' ? 10 : 5,
    windowSeconds: 60,
  }),

  getModelCapabilities: () => ({
    supportsSentiment: false,
    supportsEntities: true,
    supportsKeyPhrases: true,
    supportsLanguageDetection: false,
  }),

  analyze: async (_modelId, text) => ({
    entities: text
      .split(' ')
      .slice(0, 3)
      .map((word) => ({ text: word, category: 'Other', confidenceScore: 0.5 })),
    keyPhrases: [text.slice(0, 10)],
  }),
};
