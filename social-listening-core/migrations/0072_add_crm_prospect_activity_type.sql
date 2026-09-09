-- Story 13.13 (ADR-0117): widen outbound_activities to support the
-- `crm_prospect` activity type for prospecting-list CRM handoff.

ALTER TABLE outbound_activities
  DROP CONSTRAINT IF EXISTS outbound_activities_activity_type_check;

ALTER TABLE outbound_activities
  ADD CONSTRAINT outbound_activities_activity_type_check
    CHECK (activity_type IN ('reply', 'post', 'crm_handoff', 'crm_prospect'));
