-- Story 4.3 (ADR-0009): credentialStatus is read from the Credential entity
-- directly, not derived from IngestionRun history — platform_credentials
-- (Story 5.3) is that entity. Defaults to 'valid' since Story 5.3's existing
-- storeCredential() calls didn't set one.
ALTER TABLE platform_credentials
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'valid'
  CHECK (status IN ('valid', 'expiring_soon', 'expired', 'revoked'));
