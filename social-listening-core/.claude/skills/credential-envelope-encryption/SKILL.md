---
name: credential-envelope-encryption
description: Envelope-encrypted platform credential storage (Azure Key Vault-backed) and the OAuth-vs-API-key decision table for social-listening-core. Read this before storing, reading, or adding a new platform's credential handling.
---

# Credential envelope encryption

## What this is

The mechanism that keeps tenant-supplied platform credentials (OAuth tokens, API keys) out of plaintext everywhere: a fresh per-credential data-encryption key (DEK) encrypts the value locally (AES-256-GCM, `src/credentials/envelopeEncryption.ts`), and the DEK itself is wrapped by a real Azure Key Vault key (`src/credentials/keyVaultProvider.ts`) before either the ciphertext or the wrapped DEK is persisted (`src/credentials/credentialStore.ts`, `platform_credentials` table). `src/credentials/platformAuth.ts` decides OAuth vs. API-key entry per platform. 

**Phase 1 "also build, not storied" work adds HTTP endpoints for credential management:** `POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect` in `src/http/versions/v1/connectorsRouter.ts`, enabling tenants to connect/disconnect platforms via the REST API.

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
- **Requires a real Azure Key Vault reachable via `DefaultAzureCredential`** — locally, that means `az login` already done (the credential chain includes `AzureCliCredential`); in a real deployment, Managed Identity satisfies the same chain instead. Dev/test vault: `social-listening-dev-kv` (resource group `social-listening-dev`, West Europe), overridable via `KEY_VAULT_URI`.
- **A real Azure OAuth flow against X/LinkedIn/YouTube/Meta is Phase 1+ work**, not this story's scope — this component only proves the storage/decision mechanism, not a live third-party OAuth integration (no connector exists yet to drive one).

## Load-bearing constraints — do not change casually

- **The DEK is generated fresh per credential and never persisted unwrapped.** Only `wrapped_dek` (Key Vault-wrapped) and `ciphertext`/`iv`/`auth_tag` (DEK-encrypted) are stored. If a future change ever persists a bare DEK "for convenience," it defeats the entire envelope-encryption guarantee ADR-0014 exists for.
- **`platform_credentials` must keep its RLS policy in sync with every other `tenant_id`-bearing table** — see `postgres-tenant-db`'s SKILL.md for why (superuser/table-owner RLS bypass, `NULLIF(..., '')` normalization). This table doesn't get special-cased.
- **Never log a credential value.** `storeCredential`/`readCredential` take/return the plaintext only as a function argument/return value — no `console.*` call anywhere in this module should ever receive it, checked directly by this story's own contract.

## Known gaps / deferred work

- **Phase 1 "also build, not storied" connect/disconnect endpoints now implemented** — `POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect` with `storeCredential()`/`deleteCredential()` in `credentialStore.ts`. Admin UI for these endpoints remains deferred.
- No real OAuth flow exists yet for any platform — `platformAuth.ts` only decides which UI/flow *would* be offered; Phase 1's connector work wires up an actual OAuth exchange when the first OAuth-capable platform is built (RSS/News, Phase 1's first connector, is API-key-only anyway).
- Key Vault throttling/outage isn't classified as a connector error type yet (ADR-0010) — deferred until a real connector actually depends on reading a credential mid-poll.
- Credential rotation/refresh (OAuth token refresh before expiry, ADR-0010's automatic-refresh-before-fail behavior) isn't implemented — this story only covers storage/retrieval, not lifecycle management.
- Test-run Key Vault keys are named `test-key-<uuid>` and deleted (soft-delete) in the contract test's `afterAll` — Azure Key Vault's 90-day soft-delete retention means they aren't purged immediately; periodic manual purge of the dev vault is a housekeeping task, not automated.
- Running the full contract suite in parallel workers sometimes prints Jest's "A worker process has failed to exit gracefully" warning — the Azure SDK's HTTP keep-alive connections take a moment longer to release than Jest's default parallel-worker teardown allows. Confirmed benign: the same run's exit code is `0` and `--runInBand` (single-process) shows no warning at all with identical results. Not something to chase or "fix" — it doesn't affect pass/fail or CI's green/red status.
