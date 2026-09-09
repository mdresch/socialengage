-- Story 13.13 (ADR-0117): add author-facing columns to prospecting_list_entries
-- so CSV export and CRM payloads can be built from the entry row without
-- leaking platform-stored phone/email or connector secrets.

ALTER TABLE prospecting_list_entries
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS public_url TEXT;
