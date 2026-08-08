# ADR-0048: Explicit policy for "no core pipeline change" verification when registering new connectors

**Status:** Proposed — drafted 2026-08-08 from backlog input; pending review and acceptance.
**Source:** Story 2.1 core extensibility contract, Story 2.8 follow-up direction, and downstream connector stories that depend on the same invariants.

## Context

This project repeatedly states a core architecture promise: adding or swapping a connector (social or AI) must not require editing core ingestion pipeline/orchestration logic.

Today that promise is asserted in story language and validated by selective story-level tests, but there is no explicit project policy defining mandatory verification evidence for every connector addition. That leaves a gap where accidental coupling, hard-coded provider branching, or undocumented extension-point bypass can creep into the core path over time.

## Decision

Adopt an explicit, enforceable verification policy for every new connector registration PR:

1. **Mandatory evidence of no core-path edits for registration.**
   Every connector PR must provide test evidence that connector registration required changes only in:
   - the connector implementation itself, and
   - the designated connector registry/registration surface.
   Any edit to core ingestion orchestration for registration purposes fails policy unless accompanied by a separately approved ADR superseding this rule.

2. **Automation guardrail in CI.**
   CI must include an automated check that fails when connector-registration behavior is implemented outside designated extension points.
   The check may be implemented as a focused diff policy, a path-based guard, or an equivalent contract test gate, but it must be deterministic and run on every connector PR.

3. **Required registration traceability note.**
   Documentation for each connector must explicitly cite:
   - where registration occurs,
   - which extension points are used,
   - and how no-core-change verification was satisfied in that PR.

4. **Applies equally to social and AI connector types.**
   The policy is connector-class agnostic and covers `SocialConnector` and `AIProviderConnector` additions/removals/swaps.

## Consequences

**Positive**
- Prevents accidental API-surface leaks and hard-coded provider branches in the core pipeline.
- Makes an architectural promise continuously testable, not only narratively asserted.
- Reduces long-term connector tech-debt and preserves clean extension boundaries.

**Negative**
- Adds PR and CI overhead for connector work.
- Requires ongoing maintenance of designated extension-point checks as code structure evolves.

## Supports

- Story 2.1 (connector abstraction and extensibility contract)
- Story 2.8 and Story 2.9 follow-up swappability validation direction
- All downstream connector stories that rely on no-core-path registration changes

## Open questions for decision

- Whether to enforce this with a dedicated CI script in the repository or as a test-level contract gate inside `social-listening-core`.
- Whether to define a strict allowlist of files/directories as extension points, and where that allowlist is maintained.
- Whether this policy should also apply to connector deprecation/removal PRs with the same strictness.

## Amendment Log

- 2026-08-08 — Initial proposal drafted from backlog input; left Proposed pending acceptance.
