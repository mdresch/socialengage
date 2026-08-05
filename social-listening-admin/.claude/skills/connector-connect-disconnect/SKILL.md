# Connector connect/disconnect flow

## Story
Story 6.3 — Connector connect/disconnect flow

## Intent
Provide a tenant-facing screen for connecting and disconnecting supported platforms without relying on ad hoc API calls or client-only state.

## Governing decisions
- ADR-0034: ownership-tier-aware connector connect/disconnect behavior.
- ADR-0027: the UI must disclose that the caller is signing up directly with the provider, not through SocialEngage.

## Notes
- The screen is tenant-facing and should surface GNews and Newswire as the currently shipped connectors.
- The UI should include a plain-language disclosure that the caller is creating their own account or API key directly with the provider under that provider's own terms.
- Real backend enforcement remains in social-listening-core.
