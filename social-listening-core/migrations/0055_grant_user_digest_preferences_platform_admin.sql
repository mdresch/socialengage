-- Story 11.3 (ADR-0096): Grant user_digest_preferences to platform_admin_role

GRANT SELECT, INSERT, UPDATE, DELETE ON user_digest_preferences TO platform_admin_role;
