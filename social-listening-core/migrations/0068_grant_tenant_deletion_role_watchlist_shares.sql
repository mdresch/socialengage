-- Story 3.8 (ADR-0043) + Story 12.13 (ADR-0107): hard-delete needs to
-- traverse the watchlist_shares table introduced for multi-user workspace
-- sharing. watchlists' RLS USING expression now references watchlist_shares
-- (migration 0061/0062), so tenant_deletion_role must both have privileges on
-- watchlist_shares and be exempt from the ownership clause in the watchlists
-- policy during the final irreversible deletion pass. The current_user check
-- keeps tenant_deletion_role's deliberate non-BYPASSRLS posture intact: it
-- still cannot see any row unless the session's app.tenant_id is set, and the
-- deletion code still runs only inside executeTenantDeletion().

GRANT SELECT, DELETE ON watchlist_shares TO tenant_deletion_role;

DROP POLICY IF EXISTS tenant_isolation ON watchlists;
CREATE POLICY tenant_isolation ON watchlists
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (
      user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      OR EXISTS (
        SELECT 1 FROM watchlist_shares ws
        WHERE ws.watchlist_id = watchlists.id
          AND ws.shared_with_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
      OR current_user = 'tenant_deletion_role'
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );
