-- Story 12.13 (ADR-0107): Update watchlists RLS to allow reading watchlists shared with the user

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
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );
