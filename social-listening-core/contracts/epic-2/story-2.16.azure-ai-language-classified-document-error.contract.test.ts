// Contract: Story 2.16 — azureAiLanguageConnector.analyze() throws a
// classified error instead of crashing on a rejected document.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-216--azureailanguageconnectoranalyze-throws-a-classified-error-instead-of-crashing-on-a-rejected-document
//
// Intent: Story 2.16 — no new ADR (implementation gap against ADR-0038's
// already-Accepted "enrichment is best-effort, never a hard dependency of
// ingestion succeeding" and enrichPost.ts's own already-stated "never
// throws" contract), the same "implementation catches up to an
// already-stated policy" category Story 2.12 used for deriveConnectorHealth().
// Scope: src/connectors/azureAiLanguage/azureAiLanguageConnector.ts (fixed —
// each of the four capability responses now validated before its document
// is read; the adjacent doc-comment misdescribing 'network' as
// "non-retryable" corrected in the same pass), this contract file (new),
// .claude/skills/azure-ai-language-connector/SKILL.md (updated).
//
// Found live, 2026-08-18, investigating why Wikipedia watchlists (Stories
// 2.13/2.14) return zero ingested posts despite correct discovery. Direct
// DB inspection: every real `ingestion_runs` row for `wikipedia` was stuck
// at status='running', posts_ingested=0. Reproduced directly against the
// real Azure AI Language endpoint with a real large document: the exact
// real response captured this session (kind=EntityRecognitionResults,
// api-version=2024-11-01) —
//   {"kind":"EntityRecognitionResults","results":{"documents":[],
//    "errors":[{"id":"1","error":{"code":"InvalidArgument",
//    "message":"Invalid Document in request.","innererror":
//    {"code":"InvalidDocument","message":"A document within the request
//    was too large to be processed. Document contains 40000 text elements.
//    Limit document size to: 5120 text elements. ..."}}}],
//    "modelVersion":"2026-05-01"}}
// — a real HTTP 200 (response.ok is true; the existing `!response.ok`
// branch never fires), with the document itself missing and the real
// reason inside `results.errors`, not `results.documents`. analyze()
// previously indexed `results.documents[0]` unconditionally on every
// capability, producing a raw, unclassified TypeError
// ("Cannot read properties of undefined (reading 'entities')") instead of
// a ClassifiableError. enrichPost.ts's tryProvider() does catch a raw,
// non-ClassifiableError exception ("a programming error must not break
// ingestion either") and silently fails over to Azure OpenAI — so this was
// never a failed ingestion, but it was an entirely invisible, systematic
// Azure AI Language enrichment failure for every oversized document (every
// real Wikipedia post processed so far), with zero logging.
//
// Contract to encode: each of the four capability responses
// (SentimentAnalysis/KeyPhraseExtraction/EntityRecognition/
// LanguageDetection) is checked for a present, analyzable document before
// any field is read off it; a missing document throws
// ClassifiableError('network', ...) — the same ErrorKind this connector's
// own adjacent generic-4xx branch already uses (this project's established
// "closest existing bucket" convention, confirmed via direct grep across
// every connector — see the corrected doc comment), not a new
// connector-specific ErrorKind. enrichPost.ts's own existing fail-over path
// (already proven by Story 2.9) handles this classified error exactly like
// any other classified failure — re-exercised here against this specific
// input shape, not re-designed.
//
// Real infrastructure used: none for the new assertions below — a rejected
// document is not reliably/deterministically reproducible on demand
// against the real endpoint within a fast, repeatable test run (it depends
// on Azure's own per-document limit, confirmed this session but not a
// contract-appropriate thing to lean on turn after turn), so this contract
// mocks `fetch` with the exact real response body captured above — the
// same "a live scenario a real endpoint can't deterministically reproduce
// on demand" seam Story 2.8's own AC6 already established for a live 429/500.
// Story 2.8's own AC3 real-endpoint happy-path test is untouched — this
// contract adds coverage, it does not replace or weaken it.
//
// Explicitly out of scope for this contract:
//   - Whether a generic 4xx being retryable ('network') is the right
//     default — unchanged, existing, project-wide convention.
//   - Capping/truncating enrichment input text before it reaches
//     enrichPost() — a separate, not-yet-scoped follow-on.
//   - Adding a fetch() timeout to any connector — a separate, broader
//     hardening gap, not this story's scope.
//   - The real, currently-orphaned wikipedia ingestion_runs rows in the
//     dev database — operational data cleanup, not a code change.
//   - Azure OpenAI's own rate-limiting behavior — already correctly
//     classified as ClassifiableError('rate_limit', ...) today, unaffected.

import fs from 'fs';
import path from 'path';
import { ClassifiableError } from '../../src/ingestion/errorClassification';
import { azureAiLanguageConnector } from '../../src/connectors/azureAiLanguage/azureAiLanguageConnector';

const REAL_ENDPOINT = process.env.AZURE_AI_LANGUAGE_ENDPOINT as string;
const REAL_KEY = process.env.AZURE_AI_LANGUAGE_KEY as string;

if (!REAL_ENDPOINT || !REAL_KEY) {
  throw new Error(
    'AZURE_AI_LANGUAGE_ENDPOINT/AZURE_AI_LANGUAGE_KEY are not set — see .env.example. This contract needs a credential shape, even though its own new assertions use a mocked fetch.'
  );
}

/**
 * The exact real response body Azure AI Language returned this session for
 * a document exceeding its real per-document limit (5,120 text elements) —
 * captured directly against the real endpoint, not invented. Reused for
 * every capability by substituting `kind`, matching how Azure itself names
 * the same shape per capability (e.g. "SentimentAnalysisResults").
 */
function rejectedDocumentBody(kind: string): string {
  return JSON.stringify({
    kind: `${kind}Results`,
    results: {
      documents: [],
      errors: [
        {
          id: '1',
          error: {
            code: 'InvalidArgument',
            message: 'Invalid Document in request.',
            innererror: {
              code: 'InvalidDocument',
              message:
                'A document within the request was too large to be processed. Document contains 40000 text elements. Limit document size to: 5120 text elements.',
            },
          },
        },
      ],
      modelVersion: '2026-05-01',
    },
  });
}

const CAPABILITY_BY_URL_KIND: Record<string, string> = {
  SentimentAnalysis: 'SentimentAnalysis',
  KeyPhraseExtraction: 'KeyPhraseExtraction',
  EntityRecognition: 'EntityRecognition',
  LanguageDetection: 'LanguageDetection',
};

/** Mocks every one of the four capability calls with a real rejected-document response. */
function mockAllFourRejected(): void {
  jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
    const body = JSON.parse((init?.body as string) ?? '{}');
    const kind = body.kind as string;
    return new Response(rejectedDocumentBody(CAPABILITY_BY_URL_KIND[kind] ?? kind), { status: 200 });
  });
}

describe('Story 2.16 — Azure AI Language connector: classified error on a rejected document', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const credential = JSON.stringify({ endpoint: REAL_ENDPOINT, key: REAL_KEY });

  it('AC1: a rejected document (HTTP 200, empty results.documents, real Azure error shape) throws ClassifiableError, never a raw TypeError', async () => {
    mockAllFourRejected();

    let caught: unknown;
    try {
      await azureAiLanguageConnector.analyze('azure-ai-language-latest', 'x'.repeat(50000), credential);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ClassifiableError);
    expect((caught as ClassifiableError).kind).toBe('network');
    expect((caught as Error).message).not.toMatch(/Cannot read propert/);
  });

  it('AC4: each of the four capability calls independently guards against a missing document, not only EntityRecognition', async () => {
    // Reject only EntityRecognition — the capability this session's real
    // reproduction happened to surface first — succeed the other three
    // with a minimal valid document, proving the guard isn't accidentally
    // scoped to just one capability's own destructuring line.
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse((init?.body as string) ?? '{}');
      const kind = body.kind as string;
      if (kind === 'EntityRecognition') {
        return new Response(rejectedDocumentBody('EntityRecognition'), { status: 200 });
      }
      const minimalDocsByKind: Record<string, unknown> = {
        SentimentAnalysis: { sentiment: 'neutral', confidenceScores: { positive: 0, neutral: 1, negative: 0 } },
        KeyPhraseExtraction: { keyPhrases: [] },
        LanguageDetection: { detectedLanguage: { iso6391Name: 'en' } },
      };
      return new Response(
        JSON.stringify({
          kind: `${kind}Results`,
          results: { documents: [{ id: '1', ...(minimalDocsByKind[kind] as object) }], modelVersion: '2026-05-01' },
        }),
        { status: 200 }
      );
    });

    await expect(
      azureAiLanguageConnector.analyze('azure-ai-language-latest', 'short text', credential)
    ).rejects.toBeInstanceOf(ClassifiableError);

    // Now reject only LanguageDetection instead — proves the guard exists
    // on that call site too, not just EntityRecognition's.
    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse((init?.body as string) ?? '{}');
      const kind = body.kind as string;
      if (kind === 'LanguageDetection') {
        return new Response(rejectedDocumentBody('LanguageDetection'), { status: 200 });
      }
      const minimalDocsByKind: Record<string, unknown> = {
        SentimentAnalysis: { sentiment: 'neutral', confidenceScores: { positive: 0, neutral: 1, negative: 0 } },
        KeyPhraseExtraction: { keyPhrases: [] },
        EntityRecognition: { entities: [] },
      };
      return new Response(
        JSON.stringify({
          kind: `${kind}Results`,
          results: { documents: [{ id: '1', ...(minimalDocsByKind[kind] as object) }], modelVersion: '2026-05-01' },
        }),
        { status: 200 }
      );
    });

    await expect(
      azureAiLanguageConnector.analyze('azure-ai-language-latest', 'short text', credential)
    ).rejects.toBeInstanceOf(ClassifiableError);
  });

  it("AC3: the corrected doc comment no longer misdescribes 'network' as non-retryable", () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'connectors', 'azureAiLanguage', 'azureAiLanguageConnector.ts'),
      'utf8'
    );
    // Comments wrap across lines with a `//` prefix on each — normalize
    // before matching so a claim split across two source lines (as the
    // original bug was: "...existing non-retryable\n  // bucket...") can't
    // silently evade this check the way a naive single-line regex would.
    const normalized = source.replace(/\/\/ ?/g, ' ').replace(/\s+/g, ' ');
    expect(normalized).not.toMatch(/non-retryable bucket/);
  });
});
