# ADR-0014: Envelope-encrypted credential storage via Azure Key Vault, OAuth preferred with API-key fallback

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §8 "Security & Multi-Tenancy — Credential storage"

## Context

The system connects to platforms using each tenant's own credentials (§1) — OAuth tokens where supported, API keys where not (e.g., some RSS/newswire providers, per §8). These credentials are highly sensitive: a leak would let an attacker act as the tenant on the connected platform, potentially across every tenant in the system if storage isn't isolated per credential.

## Decision

- Encrypt OAuth tokens and API keys at rest using envelope encryption backed by Azure Key Vault.
- Use OAuth wherever a platform supports it; fall back to API keys only for platforms without OAuth support.

## Consequences

**Positive**
- Envelope encryption (data encrypted with a data key, which is itself encrypted by a key-encryption key held in Key Vault) means a database compromise alone doesn't expose credentials in plaintext — the attacker would also need Key Vault access, raising the bar significantly.
- Preferring OAuth means most credentials are scoped, revocable by the tenant at the platform level, and short-lived with refresh (tying directly into the automatic-refresh-before-fail behavior in ADR-0010) — properties long-lived API keys don't have.
- Being Azure-native (Key Vault) keeps credential security aligned with the rest of the stack's Azure-native posture (§2), avoiding a bespoke KMS integration.

**Negative**
- API-key-based platforms don't get the scoping/revocability/short-lifetime benefits OAuth provides; a leaked API key is valid until the tenant manually rotates it, and the system has no automatic-refresh safety net for that credential type.
- Envelope encryption adds an operational dependency on Key Vault availability for every credential read (e.g., before each poll or webhook registration); Key Vault throttling or an outage becomes a potential ingestion-blocking failure mode that connector error handling (ADR-0010) needs to classify correctly (almost certainly retryable).

## Alternatives Considered

- **Application-level encryption with a key stored in application config/environment** — avoids the Key Vault dependency, but a single static key protecting all tenants' credentials is a much weaker boundary than envelope encryption with Key Vault-managed key-encryption keys, and complicates key rotation.
- **Require OAuth only, refuse to support API-key platforms** — stronger uniform security posture, but would exclude legitimate platforms (some RSS/newswire providers) that don't offer OAuth at all, contradicting the goal of supporting "multiple social/web platforms."

## Note on relation to ADR-0028 (2026-08-03)

**ADR-0028** (Proposed, not yet accepted) adds an organizational layer this ADR was always silent on and never assumed: *who* is authorized to create a credential, at each of three ownership scopes (system-wide, tenant-wide, user-bound), before that credential reaches the encryption/storage mechanism this ADR governs. This is not the governance-table's fifth-row case (a formalization of something this ADR's Decision text already assumed) — this ADR never addressed organizational creation authority at all, so there is nothing here for ADR-0028 to be making explicit. This note is a plain wayfinding pointer, not a correction: **this ADR's own Decision and Consequences are unaffected**, and remain the record of *how* a credential is stored and *which* auth mechanism is preferred, regardless of who was authorized to create it. Once ADR-0028 is accepted, a credential this ADR's model stores should be understood as having already passed ADR-0028's creation-authority check upstream of storage.

**Accepted 2026-08-03, same day as this note.** The condition above is now met: every credential this ADR's model stores should be understood as having already passed ADR-0028's creation-authority check upstream of storage.
