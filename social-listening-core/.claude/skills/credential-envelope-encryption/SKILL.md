---
name: credential-envelope-encryption
description: Envelope-encrypted platform credential storage (Azure Key Vault-backed) and the OAuth-vs-API-key decision table for social-listening-core. Read this before storing, reading, or adding a new platform's credential handling.
---

# Credential envelope encryption

## What this is

The mechanism that keeps tenant-supplied platform credentials (OAuth tokens, API keys) out of plaintext everywhere: a fresh per-credential data-encryption key (DEK) encrypts the value locally (AES-256-GCM, `src/credentials/envelopeEncryption.ts`), and the DEK itself is wrapped by a real Azure Key Vault key (`src/credentials/keyVaultProvider.ts`) before either the ciphertext or the wrapped DEK is persisted (`src/credentials/credentialStore.ts`, `platform_credentials` table). `src/credentials/platformAuth.ts` decides OAuth vs. API-key entry per platform. 

**The HTTP endpoints for credential management** (`POST`/`DELETE /v1/connectors/:platformId/connect|disconnect`) are a separate component now — see `.claude/skills/connector-connect-disconnect/SKILL.md` (Story 1.7, ADR-0034) for their ownership-tier authorization. This component owns the storage/encryption mechanism those endpoints call into (`storeCredential`/`deleteCredential`/`getLatestCredentialId`/`readCredential`), not the authorization logic in front of them.

It exists so ADR-0014's guarantee — a database compromise alone can't expose credentials — is a property that's actually tested against a real Key Vault, not just asserted in a design doc.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0014 | Envelope-encrypted credential storage via Azure Key Vault; OAuth preferred, API-key fallback for platforms without OAuth | 5.3 |
| ADR-0015 | `platform_credentials` carries `tenant_id`, so it's also subject to Story 5.4's RLS requirement | 5.4 (cross-cutting) |

## Contracts that constrain this component

- `contracts/epic-5/story-5.3.credential-envelope-encryption.contract.test.ts` — a stored credential's row never contains the plaintext anywhere, and `storeCredential()` never logs it; OAuth-supporting platforms (`x`, `linkedin`, `youtube`, `meta`) are offered OAuth, everything else gets API-key entry only; disabling the Key Vault key used to wrap a credential's DEK renders that credential unreadable.
- Also exercised by (not owned by) `contracts/epic-5/story-5.4.tenant-isolation-rls.contract.test.ts`'s schema-wide RLS check, since `platform_credentials` carries `tenant_id`.

## How to extend this safely

- **Adding a new platform:** add its identifier to `platformAuth.ts`'s `OAUTH_SUPPORTED_PLATFORMS` set only if it genuinely supports OAuth — everything else defaults to `api_key` automatically (the function's fallback branch, not a per-platform opt-out).
- **Storing/reading a credential:** always go through `storeCredential`/`readCredential` — never write to `platform_credentials` directly, and never call `wrapDek`/`unwrapDek`/`encryptWithDek`/`decryptWithDek` individually from outside this module.
- **Requires a real Azure Key Vault reachable via `DefaultAzureCredential`** — locally, that means `az login` already done (the credential chain includes `AzureCliCredential`); in a real deployment, Managed Identity satisfies the same chain instead. Dev/test vault (2026-08-17 infrastructure migration, `docs/infrastructure-setup.md`): `sociallistening-kv` (resource group `rg-social-listening`, subscription `MCPP`, West Europe), overridable via `KEY_VAULT_URI`. The wrapping key itself is a separate, real RSA-2048 Key Vault key (`platform-credentials-dek-wrap`), overridable via `KEY_VAULT_KEY_ID` — **this env var must genuinely be set for any real (non-test) `POST /connect` to succeed** (Story 1.7 AC9); every contract test in this repo creates and uses its own ephemeral test key instead, so the accumulated suite alone never proved this.
- **A real Azure OAuth flow against X/LinkedIn/YouTube/Meta is Phase 1+ work**, not this story's scope — this component only proves the storage/decision mechanism, not a live third-party OAuth integration (no connector exists yet to drive one).

## Load-bearing constraints — do not change casually

- **Never let a route fall back to a placeholder/literal string for `keyVaultKeyId`.** `connectorsRouter.ts`'s `POST /connect` used to default to the literal `'placeholder-key-id'` when `KEY_VAULT_KEY_ID` was unset — not a valid `CryptographyClient` key identifier, so it silently broke every real (non-test) credential-store call rather than failing clearly. Fixed 2026-08-17 (Story 1.7 AC9, found live) to fail fast with a clear 500 instead — this is a general rule, not just that one call site: an unconfigured Key Vault key must be a loud, immediate configuration error, never a silent attempt with a garbage value.
- **The DEK is generated fresh per credential and never persisted unwrapped.** Only `wrapped_dek` (Key Vault-wrapped) and `ciphertext`/`iv`/`auth_tag` (DEK-encrypted) are stored. If a future change ever persists a bare DEK "for convenience," it defeats the entire envelope-encryption guarantee ADR-0014 exists for.
- **`platform_credentials` must keep its RLS policy in sync with every other `tenant_id`-bearing table** — see `postgres-tenant-db`'s SKILL.md for why (superuser/table-owner RLS bypass, `NULLIF(..., '')` normalization). This table doesn't get special-cased.
- **Never log a credential value.** `storeCredential`/`readCredential` take/return the plaintext only as a function argument/return value — no `console.*` call anywhere in this module should ever receive it, checked directly by this story's own contract.

## Known gaps / deferred work

- **Connect/disconnect endpoints and their ownership-tier authorization now live in `.claude/skills/connector-connect-disconnect/SKILL.md`** (Story 1.7, ADR-0034) — this bullet corrected, not deleted, per this doc series' "don't rewrite history" convention. `storeCredential()`'s `ownerType`/`userId` params (optional, default `'tenant'`/`undefined`) and `deleteCredential()`/`getLatestCredentialId()`'s now-required `ownerType` param are this module's own concrete contribution to that story. Admin UI for these endpoints remains deferred.
- No real OAuth flow exists yet for any platform — `platformAuth.ts` only decides which UI/flow *would* be offered; Phase 1's connector work wires up an actual OAuth exchange when the first OAuth-capable platform is built (RSS/News, Phase 1's first connector, is API-key-only anyway).
- Key Vault throttling/outage isn't classified as a connector error type yet (ADR-0010) — deferred until a real connector actually depends on reading a credential mid-poll.
- Credential rotation/refresh (OAuth token refresh before expiry, ADR-0010's automatic-refresh-before-fail behavior) isn't implemented — this story only covers storage/retrieval, not lifecycle management.
- Test-run Key Vault keys are named `test-key-<uuid>` and deleted (soft-delete) in the contract test's `afterAll` — Azure Key Vault's 90-day soft-delete retention means they aren't purged immediately; periodic manual purge of the dev vault is a housekeeping task, not automated.
- Running the full contract suite in parallel workers sometimes prints Jest's "A worker process has failed to exit gracefully" warning — the Azure SDK's HTTP keep-alive connections take a moment longer to release than Jest's default parallel-worker teardown allows. Confirmed benign: the same run's exit code is `0` and `--runInBand` (single-process) shows no warning at all with identical results. Not something to chase or "fix" — it doesn't affect pass/fail or CI's green/red status.
- **`jest.setTimeout` across every real-Key-Vault contract file has crept upward over this project's life (5000ms default → 30000ms → 60000ms as of 2026-08-03) and should keep being treated as a real-network tolerance, not a fixed constant.** Story 5.3's own AC3 (a previously stable, unrelated-to-Story-1.7 test) timed out at 30000ms during Story 1.7's own full-suite validation — real Key Vault latency under this session's cumulative load, confirmed via `heal-contract-failure`, no logic bug. If a future session hits this again, bump the specific file's timeout (matching this precedent) before suspecting a code regression — this has now happened twice (Story 1.6's original fix, then this one) for the identical reason.
