-- Story 11.7 (ADR-0098): Ensure credential_id and post_id in outbound_activities are nullable

ALTER TABLE outbound_activities
  ALTER COLUMN credential_id DROP NOT NULL,
  ALTER COLUMN post_id DROP NOT NULL;
