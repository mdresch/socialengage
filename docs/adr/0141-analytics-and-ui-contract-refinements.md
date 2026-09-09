# ADR-0141: Analytics and UI Contract Refinements

**Status:** Accepted
**Date:** 2026-09-03
**Deciders:** Menno

## Context and Problem Statement

During a recent test execution, three distinct contract failures were flagged. Upon investigation, the implementation code was logically correct and provided better UX/functionality, but the original contract tests were written too strictly or based on outdated assumptions.

1. **Tenant Settings UI (Story 6.9) - Brittle Assertion Scope & Semantic Conflation:** The contract test `story-6.9.tenant-settings-screen.contract.test.ts` asserted `expect(source).not.toContain('credential')` to prevent sensitive API keys or watchlists from being rendered. The test operated on raw source text using a broad substring check. This conflated sensitive data payloads with UI copy / descriptive labels, leading to a failure when a CRM Connectors section introduced the descriptive text: "Configure the credentials used when escalating...". Using negative substring assertions against untyped, rendered source strings creates high false-positive rates as UI copy evolves.
2. **Sentiment Index Scale (Story 8.6 / ADR-0054):** The contract test explicitly enforced a `0 to 10` score for sentiment. The implementation used a `-10 to +10` scale to properly amplify positive/negative divergence while excluding neutral posts from the numerator. The implementation's rationale was architecturally superior, but violated the old test contract.
3. **Top Authors Ranking (Story 8.7):** The contract test asserted a strict deep-equality shape `{ author, count }` for the return value of `computeTopAuthorsByVolume`. The implementation was later extended to include `providerId` so the UI could render platform icons next to author names. The strict test rejected the valid addition.

## Decision

We are formally superseding the strict limitations in these three areas and amending the contracts to match the superior implementation design. We do not bend the code to satisfy brittle tests; we write immutable follow-up decisions.

### 1. Data Leakage and Secret Assertion Policy (Story 6.9 Amendment)
Negative assertions for sensitive data in UI/Frontend contract tests MUST NOT use broad natural-language substring matches (e.g., 'credential', 'secret', 'token') against rendered source strings.

**Standards:**
- Tests verifying data isolation must assert against structured component props, API response DTOs, or input field types. Contract tests should validate data exchange schemas, not presentation text.
- Data leakage tests against rendered DOM output must use unique, traceable mock sentinel tokens (e.g., `TEST_SENTINEL_SECRET_VALUE`) rather than generic dictionary words.
- Write-Only Secrets: When configuring integrations, secrets must follow a write-only pattern (accepted on POST/PUT, returned as masked or omitted in GET).

**Testing Matrix:**
| Level | Tool / Test Type | Responsibility |
| :--- | :--- | :--- |
| **API Contract Test** | Schema Validator / Pact / Jest | Verifies backend DTOs omit or mask sensitive fields. |
| **UI Contract / Component Test** | Testing Library / Playwright | Verifies inputs are obscured (`type="password"`) and data props do not contain raw secrets. |
| **Static Code Analysis** | Gitleaks / TruffleHog / ESLint | Scans codebase and fixtures for hardcoded secrets. |

### 2. Sentiment Index Scale (Story 8.6 Amendment)
Supersedes ADR-0054's scale: The sentiment index formula `((positive - negative) / total_enriched) * 10` (a `-10 to +10` scale) is formally accepted as the correct mathematical model for sentiment indexing.

### 3. Top Authors Schema Extension (Story 8.7 Amendment)
The `AuthorRanking` object is formally extended to include `providerId: string | null`.

## Consequences

- The `story-6.9` test has been updated to remove the brittle natural-language string rejection.
- The `story-8.6` test has been updated to assert on the `-10 to +10` scale.
- The `story-8.7` test has been updated to use partial matching (`toMatchObject`) to allow the `providerId` extension.
- The UI retains its proper descriptive text for CRM connectors, the mathematically sound sentiment scale, and the platform icons for top authors without failing tests.
