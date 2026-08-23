// Contract: Story 2.32 (ADR-0076, BRD-0076, FDD-0076) — Azure OpenAI `research?()` capability
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-232--azure-openai-research-capability
//
// Intent: Story 2.32 — Azure OpenAI `research?()` capability (ADR-0076)
// Scope: src/connectors/types.ts, src/connectors/azureOpenAi/azureOpenAiConnector.ts,
//        .claude/skills/azure-openai-connector/SKILL.md,
//        .claude/skills/provider-connector-framework/SKILL.md
// Contract to encode: (1) AIProviderConnector interface gains an optional research?() method
// with the Story 2.32 signature; (2) azureOpenAiConnector implements research() and returns
// a structured result with keyPhrases, relatedTopics, searchQueries, contextSummary, and comparison;
// (3) azureAiLanguageConnector does not implement research(); (4) a missing or invalid Azure OpenAI
// credential throws the same ClassifiableError (http_401) path as analyze();
// (5) the call is a single chat/completions request with a JSON schema response format
// and the model is instructed to extract from the input text and synthesize from searchSnippets.
// Explicitly out of scope: streaming; multi-turn; other AI providers; media or image analysis.

import { azureOpenAiConnector } from '../../src/connectors/azureOpenAi/azureOpenAiConnector';
import { azureAiLanguageConnector } from '../../src/connectors/azureAiLanguage/azureAiLanguageConnector';
import { ClassifiableError } from '../../src/ingestion/errorClassification';

afterEach(() => {
  jest.restoreAllMocks();
});

const credential = JSON.stringify({
  endpoint: 'https://example.openai.azure.com',
  key: 'test-key',
  deployment: 'gpt-5-mini',
});

const searchSnippets = [
  { title: 'Source 1', url: 'https://example.com/1', snippet: 'Snippet one', provider: 'brave-search' },
];

const options = { maxKeyPhrases: 5, maxRelatedTopics: 4, maxSearchQueries: 3 };

function mockResponse(status: number, body: unknown): Response {
  const ok = status >= 200 && status < 300;
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => bodyText,
    headers: new Headers(),
  } as unknown as Response;
}

describe('Story 2.32 — Azure OpenAI research capability', () => {
  it('AC1/2: azureOpenAiConnector.research returns the structured research shape', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(200, {
        model: 'gpt-5-mini',
        choices: [
          {
            message: {
              content: JSON.stringify({
                keyPhrases: ['SocialEngage'],
                relatedTopics: ['social listening'],
                searchQueries: ['SocialEngage news'],
                contextSummary: 'Current public conversation highlights...',
                comparison: 'The draft is well-aligned...',
              }),
            },
          },
        ],
      })
    );

    const result = await azureOpenAiConnector.research!(
      'We are launching SocialEngage for social listening.',
      searchSnippets,
      options,
      credential
    );

    expect(result.keyPhrases).toEqual(['SocialEngage']);
    expect(result.relatedTopics).toEqual(['social listening']);
    expect(result.searchQueries).toEqual(['SocialEngage news']);
    expect(result.contextSummary).toBe('Current public conversation highlights...');
    expect(result.comparison).toBe('The draft is well-aligned...');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, { method?: string; headers?: Record<string, string>; body?: string }];
    expect(url).toMatch(/\/openai\/deployments\/gpt-5-mini\/chat\/completions/);
    expect(init.method).toBe('POST');
    expect(init.headers?.['api-key']).toBe('test-key');

    const sent = JSON.parse(init.body ?? '{}');
    expect(sent.response_format?.type).toBe('json_schema');
    expect(sent.messages).toHaveLength(2);
    expect(sent.messages[0].role).toBe('system');
    expect(sent.messages[1].role).toBe('user');
    expect(sent.messages[1].content).toContain('We are launching SocialEngage for social listening.');
    expect(sent.messages[1].content).toContain('Snippet one');
  });

  it('AC3: azureAiLanguageConnector does not implement research', () => {
    expect(azureAiLanguageConnector.research).toBeUndefined();
  });

  it('AC6: missing Azure OpenAI credential throws http_401 ClassifiableError (same as analyze)', async () => {
    await expect(
      azureOpenAiConnector.research!('text', searchSnippets, options, undefined)
    ).rejects.toBeInstanceOf(ClassifiableError);

    try {
      await azureOpenAiConnector.research!('text', searchSnippets, options, undefined);
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifiableError);
      expect((err as ClassifiableError).kind).toBe('http_401');
    }
  });
});
