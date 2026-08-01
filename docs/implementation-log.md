# Implementation Log

**Append-only. Never edit or remove an existing entry — corrections get a new dated entry that references the one being corrected.** This is the same convention as every other "don't rewrite history" rule in this doc series (ADR Amendment Logs, Clarifications, Pending-supersession notes), applied to actual code delivery instead of decisions.

This is the record that closes the loop `docs/adr/README.md`'s decisions and `docs/user-stories/README.md`'s stories don't close on their own: not just "this story is marked Done," but *which exact commit, in which repo, touching which exact files* did it — verifiable against git's own tamper-evident commit hash, not just trusted prose. See `docs/implementation-methodology.md`'s Conventions section and [`docs/templates/check-implementation-log.cjs`](templates/check-implementation-log.cjs), which independently recomputes each entry's file list from git and fails CI on a mismatch.

One entry per completed story or healing pass, added by the `implement-story` / `heal-contract-failure` skills as their final step, using this exact field set (the verification script parses on these bold labels):

```markdown
## YYYY-MM-DD — Story X.Y — <repo>@<short-hash>

- **Full commit:** `<full 40-character SHA>`
- **Repo:** social-listening-core | social-listening-admin
- **Story / ADR:** X.Y / ADR-00NN
- **Contract:** contracts/epic-N/story-X.Y.<slug>.contract.test.ts
- **SKILL.md:** .claude/skills/<component-slug>/SKILL.md
- **Files touched:** file1, file2, file3, ...
- **Full suite at merge:** PASS (N/N)
```

For a healing pass (no story number, or fixing a cross-component regression per that section of the methodology doc), use `## YYYY-MM-DD — Healing: <one-line description> — <repo>@<short-hash>` with the same field set, `Story / ADR` naming whichever story/ADR the healed contract belongs to.

**Merge strategy note:** use regular or fast-forward merges, not squash — the commit hash recorded here is written *before* merge (it's the PR branch's tip commit), and squashing would replace it with a different hash on `main`, silently invalidating the entry. See `docs/templates/ci-workflow.md`.

---

## 2026-07-29 — Story 1.1 — socialengage@8fa7a66

*Pre-split convention: `social-listening-core` and `social-listening-admin` don't yet exist as separate git repositories — per `CLAUDE.md`, they're subdirectories of this single `socialengage` workspace repo until the actual repo split happens. This commit necessarily touches both directories atomically, so `Repo` below names both rather than the single value the template above otherwise expects, and `Files touched` is the commit's true, undivided file list. `docs/templates/check-implementation-log.cjs`, once copied into either repo, filters entries by exact `Repo` match against its own directory name — a combined value like this one won't match either, so it will be silently skipped by that check until the real split happens, not falsely failed. Future Phase 0 commits that touch both scaffolds at once should follow this same convention.*

- **Full commit:** `8fa7a662a16c9eaff3522fb18bb12827911d524f`
- **Repo:** social-listening-core + social-listening-admin (pre-split, single workspace repo — see note above)
- **Story / ADR:** 1.1 / ADR-0001
- **Contract:** social-listening-core/contracts/epic-1/story-1.1.independent-repo-scaffold.contract.test.ts; social-listening-admin/contracts/epic-1/story-1.1.rest-only-boundary.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/repo-scaffold/SKILL.md; social-listening-admin/.claude/skills/core-api-client/SKILL.md
- **Files touched:** social-listening-admin/.claude/skills/core-api-client/SKILL.md, social-listening-admin/.gitignore, social-listening-admin/contracts/epic-1/story-1.1.rest-only-boundary.contract.test.ts, social-listening-admin/jest.config.js, social-listening-admin/package-lock.json, social-listening-admin/package.json, social-listening-admin/src/lib/core-client.ts, social-listening-admin/tsconfig.json, social-listening-core/.claude/skills/repo-scaffold/SKILL.md, social-listening-core/.gitignore, social-listening-core/contracts/epic-1/story-1.1.independent-repo-scaffold.contract.test.ts, social-listening-core/jest.config.js, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/tsconfig.json
- **Full suite at merge:** PASS (core 3/3, admin 6/6)

---

## 2026-07-29 — Story 1.2 + 5.4 — social-listening-core@bce8cfc

*Single-repo commit this time (every file is under `social-listening-core/`), but the same pre-split caveat from the Story 1.1 entry above still applies: paths below are workspace-relative (with the `social-listening-core/` prefix) because this directory has no separate git repository of its own yet — see that entry's note for the full explanation.*

- **Full commit:** `bce8cfc7d3733b8ae91ca5cb270b6e8991d81da7`
- **Repo:** social-listening-core
- **Story / ADR:** 1.2 / ADR-0016; 5.4 / ADR-0015
- **Contract:** social-listening-core/contracts/epic-1/story-1.2.postgres-jsonb.contract.test.ts; social-listening-core/contracts/epic-5/story-5.4.tenant-isolation-rls.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md
- **Files touched:** social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/README.md, social-listening-core/contracts/epic-1/story-1.2.postgres-jsonb.contract.test.ts, social-listening-core/contracts/epic-5/story-5.4.tenant-isolation-rls.contract.test.ts, social-listening-core/docker-compose.test.yml, social-listening-core/jest.config.js, social-listening-core/jest.global-setup.js, social-listening-core/jest.global-teardown.js, social-listening-core/migrations/0001_create_social_posts.sql, social-listening-core/migrations/0002_enable_rls_social_posts.sql, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/src/db/migrate.ts, social-listening-core/src/db/pool.ts, social-listening-core/src/db/withTenant.ts
- **Full suite at merge:** PASS (9/9 — Story 1.1's 3 + Story 1.2's 3 + Story 5.4's 3)

---

## 2026-07-29 — Story 1.3 — social-listening-core@1ebc971

*Cross-repo commit again (touches both `social-listening-core/` and `social-listening-admin/`) — same pre-split convention as the Story 1.1 entry above: `Files touched` is the commit's true, undivided file list, workspace-relative paths.*

- **Full commit:** `1ebc971b749d129520898ea087697c918f00b5ae`
- **Repo:** social-listening-core + social-listening-admin (pre-split, single workspace repo — see Story 1.1 entry's note)
- **Story / ADR:** 1.3 / ADR-0017
- **Contract:** social-listening-core/contracts/epic-1/story-1.3.api-versioning.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/http-api-versioning/SKILL.md; social-listening-admin/.claude/skills/core-api-client/SKILL.md (updated, not new)
- **Files touched:** social-listening-admin/.claude/skills/core-api-client/SKILL.md, social-listening-admin/src/lib/core-client.ts, social-listening-core/.claude/skills/http-api-versioning/SKILL.md, social-listening-core/contracts/epic-1/story-1.3.api-versioning.contract.test.ts, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/src/http/app.ts, social-listening-core/src/http/deprecation.ts, social-listening-core/src/http/server.ts, social-listening-core/src/http/versions/v1/router.ts
- **Full suite at merge:** PASS (core 14/14 — Stories 1.1+1.2+5.4+1.3; admin 6/6)

---

## 2026-07-29 — Story 5.3 — social-listening-core@133b0cb

- **Full commit:** `133b0cb4b323829378c873ff9241ec6609d9c3df`
- **Repo:** social-listening-core
- **Story / ADR:** 5.3 / ADR-0014
- **Contract:** social-listening-core/contracts/epic-5/story-5.3.credential-envelope-encryption.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/credential-envelope-encryption/SKILL.md
- **Files touched:** social-listening-core/.claude/skills/credential-envelope-encryption/SKILL.md, social-listening-core/contracts/epic-5/story-5.3.credential-envelope-encryption.contract.test.ts, social-listening-core/migrations/0003_create_platform_credentials.sql, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/src/credentials/credentialStore.ts, social-listening-core/src/credentials/envelopeEncryption.ts, social-listening-core/src/credentials/keyVaultProvider.ts, social-listening-core/src/credentials/platformAuth.ts
- **Full suite at merge:** PASS (18/18 — Stories 1.1+1.2+5.4+1.3+5.3), verified against a real Azure Key Vault (social-listening-dev-kv, resource group social-listening-dev), not a mock

**Phase 0 complete as of this entry** — all 5 of its stories (1.1, 1.2, 1.3, 5.3, 5.4) now have a passing contract and a logged commit.

---

## 2026-07-29 — Story 2.1 — social-listening-core@7604c25

- **Full commit:** `7604c256e01d76a731c90248b036da1eb142e3e7`
- **Repo:** social-listening-core
- **Story / ADR:** 2.1 / ADR-0002
- **Contract:** social-listening-core/contracts/epic-2/story-2.1.provider-connector-framework.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/provider-connector-framework/SKILL.md
- **Files touched:** social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.1.provider-connector-framework.contract.test.ts, social-listening-core/src/connectors/examples/exampleAiProviderX.ts, social-listening-core/src/connectors/examples/exampleAiProviderY.ts, social-listening-core/src/connectors/examples/examplePollConnector.ts, social-listening-core/src/connectors/examples/examplePushConnector.ts, social-listening-core/src/connectors/rateLimitResolution.ts, social-listening-core/src/connectors/registry.ts, social-listening-core/src/connectors/types.ts
- **Full suite at merge:** PASS (25/25 — Phase 0's 18 + this story's 7)

**First Phase 1 story.** Goal per `docs/implementation-plan.md`: the smallest real slice — one platform, one tenant, one watchlist, posts flowing into a queryable API, with visible health status.

---

## 2026-07-29 — Story 3.1 + 3.2 — social-listening-core@34264e6

- **Full commit:** `34264e6f1fb9e850bee1632e0668d803f9939451`
- **Repo:** social-listening-core
- **Story / ADR:** 3.1 / ADR-0004; 3.2 / ADR-0005
- **Contract:** social-listening-core/contracts/epic-3/story-3.1.author-normalization.contract.test.ts; social-listening-core/contracts/epic-3/story-3.2.ingestion-run-audit-anchor.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/social-post-lineage/SKILL.md
- **Files touched:** social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-3/story-3.1.author-normalization.contract.test.ts, social-listening-core/contracts/epic-3/story-3.2.ingestion-run-audit-anchor.contract.test.ts, social-listening-core/migrations/0004_create_authors.sql, social-listening-core/migrations/0005_create_ingestion_runs.sql, social-listening-core/src/authors/authorStore.ts, social-listening-core/src/ingestion/ingestionRunStore.ts, social-listening-core/src/posts/socialPostStore.ts
- **Full suite at merge:** PASS (31/31 — prior 25 + this pair's 6)

---

## 2026-07-29 — Story 3.4 — social-listening-core@a5399d5

- **Full commit:** `a5399d53d6eb104353693a61e40d7eabe30eabb8`
- **Repo:** social-listening-core
- **Story / ADR:** 3.4 / ADR-0011
- **Contract:** social-listening-core/contracts/epic-3/story-3.4.cursor-pagination.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/posts-api/SKILL.md
- **Files touched:** social-listening-core/.claude/skills/posts-api/SKILL.md, social-listening-core/contracts/epic-3/story-3.4.cursor-pagination.contract.test.ts, social-listening-core/migrations/0006_add_social_posts_pagination_index.sql, social-listening-core/src/http/versions/v1/postsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/posts/cursor.ts, social-listening-core/src/posts/socialPostStore.ts
- **Full suite at merge:** PASS (35/35 — prior 31 + this story's 4)

**Bug caught by the contract before shipping:** initial implementation ordered by `created_at`; `pg`'s millisecond-precision `Date` conversion vs. Postgres's microsecond `TIMESTAMPTZ` caused genuine duplicate rows across pages for same-millisecond inserts. Fixed by switching to a monotonic `seq` identity column — see the commit message and `posts-api`'s SKILL.md for the full explanation.

---

## 2026-07-29 — Story 2.2 — social-listening-core@00322f2

- **Full commit:** `00322f2f3d1eb241a0e504fc9dbd90d589914b92`
- **Repo:** social-listening-core
- **Story / ADR:** 2.2 / ADR-0003
- **Contract:** social-listening-core/contracts/epic-2/story-2.2.per-tenant-rate-limiting.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/provider-connector-framework/SKILL.md (updated, not new)
- **Files touched:** social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.2.per-tenant-rate-limiting.contract.test.ts, social-listening-core/src/connectors/requestGate.ts
- **Full suite at merge:** PASS (39/39 — prior 35 + this story's 4)

---

## 2026-07-29 — Story 2.3 + 4.3 — social-listening-core@10e7c43

- **Full commit:** `10e7c43b324ee9b36867cfff113c0c26e96c3a21`
- **Repo:** social-listening-core
- **Story / ADR:** 2.3 / ADR-0010; 4.3 / ADR-0009
- **Contract:** social-listening-core/contracts/epic-2/story-2.3.error-handling-auto-disable.contract.test.ts; social-listening-core/contracts/epic-4/story-4.3.derived-connector-health.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md
- **Files touched:** social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/contracts/epic-2/story-2.3.error-handling-auto-disable.contract.test.ts, social-listening-core/contracts/epic-4/story-4.3.derived-connector-health.contract.test.ts, social-listening-core/migrations/0007_add_platform_credentials_status.sql, social-listening-core/src/connectors/connectorHealth.ts, social-listening-core/src/ingestion/errorClassification.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts
- **Full suite at merge:** PASS (51/51 — prior 39 + this pair's 12)

---

## 2026-07-29 — Story 3.3 — social-listening-core@f3254d9

- **Full commit:** `f3254d93c176c818a98fdb51e2402922ff0be9b7`
- **Repo:** social-listening-core
- **Story / ADR:** 3.3 / ADR-0006
- **Contract:** social-listening-core/contracts/epic-3/story-3.3.watchlist-matching.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/watchlist-matching/SKILL.md (new); social-listening-core/.claude/skills/provider-connector-framework/SKILL.md (updated)
- **Files touched:** social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/.claude/skills/watchlist-matching/SKILL.md, social-listening-core/contracts/epic-3/story-3.3.watchlist-matching.contract.test.ts, social-listening-core/src/connectors/examples/exampleNativeFilterConnector.ts, social-listening-core/src/connectors/types.ts, social-listening-core/src/watchlists/dispatch.ts, social-listening-core/src/watchlists/matcher.ts, social-listening-core/src/watchlists/types.ts
- **Full suite at merge:** PASS (54/54 — prior 51 + this story's 3)

**Phase 1's storied work is now complete** — all 8 Phase 1 stories (2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.3) have a passing contract and a logged commit. Remaining Phase 1 scope is explicitly "also build, not storied": the real RSS/News connector implementation, watchlist/connector CRUD REST endpoints, and the admin UI's connect/watchlist/status screens.

---

## 2026-07-29 — Healing pass: Stories 3.2 + 4.3 — social-listening-core@af35e90

- **Full commit:** `af35e909d0716e47d1d9f87ec8f88821204e3d3b`
- **Repo:** social-listening-core
- **Story / ADR:** 3.2 / ADR-0005; 4.3 / ADR-0009
- **Contract:** social-listening-core/contracts/epic-3/story-3.2.ingestion-run-retryable-field.contract.test.ts; social-listening-core/contracts/epic-4/story-4.3.health-derivation-index.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/social-post-lineage/SKILL.md (updated, not new); social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md (updated, not new)
- **Files touched:** social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-3/story-3.2.ingestion-run-retryable-field.contract.test.ts, social-listening-core/contracts/epic-4/story-4.3.health-derivation-index.contract.test.ts, social-listening-core/migrations/0008_add_ingestion_runs_retryable_and_index.sql, social-listening-core/src/ingestion/ingestionRunStore.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts
- **Full suite at merge:** PASS (59/59 — prior 54 + this pass's 5)

**heal-contract-failure, not implement-story:** a full ADR/story consistency audit found `ingestion_runs.retryable` (named in ADR-0005's Decision, deferred at Story 3.2's original shipping to "Story 2.3," which shipped without it) and the `(tenant_id, platform_id, started_at)` index ADR-0009's own Negative consequences names as needed — both gaps in already-logged stories, not new scope. Steps 1–4 re-validated clean (Intent still matches both ADRs, both contracts genuinely encode them, both SKILL.mds already comply with the template); only the commit + this log entry were outstanding, deferred by earlier Jest OOM crashes now resolved by capping workers (`--runInBand --workerIdleMemoryLimit=256MB`).

---

## 2026-07-30 — Story 4.1 — social-listening-core@16d6fea

- **Full commit:** `16d6fea75850658facc10b97f962210cdb107d31`
- **Repo:** social-listening-core
- **Story / ADR:** 4.1 / ADR-0007
- **Contract:** social-listening-core/contracts/epic-4/story-4.1.author-topic-signals.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/author-topic-signals/SKILL.md (new)
- **Files touched:** social-listening-core/.claude/skills/author-topic-signals/SKILL.md, social-listening-core/contracts/epic-4/story-4.1.author-topic-signals.contract.test.ts, social-listening-core/migrations/0009_create_author_topic_signals.sql, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/topicsRouter.ts, social-listening-core/src/topics/authorTopicSignalStore.ts
- **Full suite at merge:** PASS (63/63 — prior 59 + this story's 4)

**First Phase 2 story — Phase 1's storied work (8 stories) plus this session's healing pass are all that came before it.** `author_topic_signals` is a plain table for now, not yet ADR-0007's literal "materialized view": nothing populates it from real posts yet, since that needs `enrichment.entities`/`keyPhrases`/`sentiment`/`engagementMetrics` on `social_posts` (Story 4.2, ADR-0008, not built) and the scheduled refresh job (Story 4.4, ADR-0022, Phase-4-scheduled). This story's contract proves the schema and the `GET /v1/topics/:topic/authors` read path are correct given rows inserted directly, the same "prove the derivation, not the whole pipeline" pattern Story 4.3 used for `ConnectorHealth`. One unrelated flake surfaced mid-session: Story 5.3's credential-envelope-encryption contract timed out once against the live Azure Key Vault during a full-suite run, then passed clean in isolation and again in a subsequent full-suite run — attributed to transient Key Vault network latency, not this story's changes (no credential/Key Vault code was touched), per the methodology's "foreign contract regression" attribution step.

---

## 2026-07-30 — Story 4.2 — social-listening-core@ec66c3b

- **Full commit:** `ec66c3ba542fcfd5104cf2f88d0276bcd3ed43c4`
- **Repo:** social-listening-core
- **Story / ADR:** 4.2 / ADR-0008
- **Contract:** social-listening-core/contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/social-post-enrichment/SKILL.md (new); social-listening-core/.claude/skills/posts-api/SKILL.md (updated)
- **Files touched:** social-listening-core/.claude/skills/posts-api/SKILL.md, social-listening-core/.claude/skills/social-post-enrichment/SKILL.md, social-listening-core/contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts, social-listening-core/migrations/0010_add_social_posts_enrichment_fields.sql, social-listening-core/src/posts/socialPostStore.ts
- **Full suite at merge:** PASS (66/66 — prior 63 + this story's 3)

**Phase 2's storied work is now complete** — both 4.1 and 4.2 have a passing contract and a logged commit. `social_posts.published_at`/`enrichment` are the first columns this repo has added for ADR-0008, which itself assumed they already existed; nothing else in the codebase had added them yet, so this story owned adding them, not just verifying them, despite `docs/implementation-plan.md` describing 4.2 as "largely a verification, not new build." Remaining Phase 2 scope is explicitly "also build, not storied": the real `AIProviderConnector` implementation and wiring enrichment into the ingestion pipeline after normalization — neither built here. A second instance of the same live-Azure-Key-Vault flake from Story 4.1's session recurred mid-run (a `DefaultAzureCredential` chain failure this time, not a timeout), again clearing on immediate retry (17/17, 66/66) — same attribution: unrelated foreign contract, no credential/Key Vault code touched by this story.

---

## 2026-07-30 — Story 5.1 — social-listening-core@1e4e7d2

- **Full commit:** `1e4e7d2615d689908e9f1551194da804df325844`
- **Repo:** social-listening-core
- **Story / ADR:** 5.1 / ADR-0012
- **Contract:** social-listening-core/contracts/epic-5/story-5.1.thin-events.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/ingestion-events/SKILL.md (new); social-listening-core/.claude/skills/posts-api/SKILL.md (updated)
- **Files touched:** social-listening-core/.claude/skills/ingestion-events/SKILL.md, social-listening-core/.claude/skills/posts-api/SKILL.md, social-listening-core/contracts/epic-5/story-5.1.thin-events.contract.test.ts, social-listening-core/src/events/connectorHealthChangedEvent.ts, social-listening-core/src/events/socialPostIngestedEvent.ts, social-listening-core/src/http/versions/v1/postsRouter.ts, social-listening-core/src/posts/socialPostStore.ts
- **Full suite at merge:** PASS (70/70 — prior 66 + this story's 4)

**First Phase 3 story.** No Azure Service Bus namespace is provisioned for this project yet (confirmed with the user 2026-07-30) — unlike Story 5.3's real live Key Vault, there's nothing to point a publisher at. Scoped accordingly: `buildSocialPostIngestedEvent()`/`buildConnectorHealthChangedEvent()` are pure functions proving payload shape only, and `GET /v1/posts/:id` (genuinely needs nothing from Service Bus) covers ADR-0012's REST-fetch-on-demand half. **Stories 5.2 and 5.5 are explicitly held** — both have an Acceptance Criterion (cross-tenant SQL-filter delivery; `schemaVersion`-based subscription filtering) provable only against a real namespace, matching this repo's real-infrastructure-over-mocks convention (same reasoning as Story 5.3) — blocked on infrastructure being provisioned, not on ADR acceptance (ADR-0012/0013/0019 are all Accepted). Detailed `az cli` provisioning instructions (Standard-tier namespace, one topic, `Azure Service Bus Data Owner` role assignment) were given to the user to run themselves; the assisting session's Azure MCP tooling was unavailable (server not connected) to provision it directly.

---

## 2026-07-30 — Story 5.2 — social-listening-core@e2dd7d7

- **Full commit:** `e2dd7d7f96131812c9445405c0ce1c0538ab92df`
- **Repo:** social-listening-core
- **Story / ADR:** 5.2 / ADR-0013
- **Contract:** social-listening-core/contracts/epic-5/story-5.2.per-tenant-event-filtering.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/ingestion-events/SKILL.md (updated, not new)
- **Files touched:** social-listening-core/.claude/skills/ingestion-events/SKILL.md, social-listening-core/contracts/epic-5/story-5.2.per-tenant-event-filtering.contract.test.ts, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/src/events/serviceBusPublisher.ts
- **Full suite at merge:** PASS (73/73 — prior 70 + this story's 3)

**The infrastructure gap Story 5.1 flagged is now closed** — the user provisioned a real Standard-tier `social-listening-dev` Service Bus namespace with a `social-listening-events` topic mid-session. Getting to a genuine pass took real troubleshooting, all environmental, none of it a code defect: (1) a full local network outage (`az login` itself couldn't reach `login.microsoftonline.com`) that a machine reboot resolved; (2) the `Azure Service Bus Data Owner` role assignment command needed a PowerShell-compatible single-line form (the original had bash-style trailing-backslash continuations, which PowerShell doesn't interpret the same way) and a resource-group lookup via `az servicebus namespace list` since `namespace show` requires one; (3) once the role assignment was actually applied, one AC (of three) still timed out on its first post-grant run while the other two passed — attributed to Azure RBAC's normal eventual-consistency propagation window, not a bug, since the failing AC and a passing one ran the identical code path seconds apart with only the tenant ID differing; a clean retry a few minutes later passed all three. **`schemaVersion` (Story 5.5, ADR-0019) remains deliberately not built** — same namespace now technically unblocks it, but it's out of this story's scope on its own terms.

---

## 2026-07-30 — Story 5.5 — social-listening-core@914dfce

- **Full commit:** `914dfce724a3c968ef817b522814edd1ec0d5579`
- **Repo:** social-listening-core
- **Story / ADR:** 5.5 / ADR-0019
- **Contract:** social-listening-core/contracts/epic-5/story-5.5.event-schema-versioning.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/ingestion-events/SKILL.md (updated, not new)
- **Files touched:** social-listening-core/.claude/skills/ingestion-events/SKILL.md, social-listening-core/contracts/epic-5/story-5.5.event-schema-versioning.contract.test.ts, social-listening-core/src/events/serviceBusPublisher.ts
- **Full suite at merge:** PASS (77/77 — prior 73 + this story's 4)

**Phase 3's storied work is now complete** — 5.1, 5.2, and 5.5 all have a passing contract and a logged commit, closing out the infrastructure gap this whole phase turned on. `publishEvent()` gained an optional `{ schemaVersion }` (defaulting to 1) set as an application property alongside `tenantId`, proven against the real namespace this session finished setting up for Story 5.2 — no further troubleshooting needed this time, clean run. No real coordinated-cutover dual-publish exists (ADR-0019 itself treats that as an open decision-level question, not an implementation default, and there's no real breaking change to a shipped event type happening to dual-publish); the mechanism (`publishEvent(..., { schemaVersion })`) is what a future one would use. Remaining Phase 3 scope is explicitly not-yet-storied: nothing in the ingestion pipeline actually calls `publishEvent()` on a real `IngestionRun`/`ConnectorHealth` state change yet.

---

## 2026-07-30 — Story 3.6 — social-listening-core@5c375ec

- **Full commit:** `5c375ece1ee610ee266cc03717f8e40c9ae3edd3`
- **Repo:** social-listening-core
- **Story / ADR:** 3.6 / ADR-0021
- **Contract:** social-listening-core/contracts/epic-3/story-3.6.watchlist-boolean-ast.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/watchlist-matching/SKILL.md (updated, not new)
- **Files touched:** docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/watchlist-matching/SKILL.md, social-listening-core/contracts/epic-3/story-3.6.watchlist-boolean-ast.contract.test.ts, social-listening-core/src/connectors/types.ts, social-listening-core/src/watchlists/ast.ts, social-listening-core/src/watchlists/dispatch.ts, social-listening-core/src/watchlists/matcher.ts
- **Full suite at merge:** PASS (81/81 — prior 77 + this story's 4)

**First Phase 4 story.** No external infrastructure needed (unlike Phase 3's Service Bus dependency) — a self-contained recursive-descent parser plus dispatch/matcher extensions. `WatchlistTerms` (Story 3.3's OR-only terms) and the new AST are deliberately two independent, parallel matching modes, not a unification — changing `WatchlistTerms` itself would have broken Story 3.3's passing contract without an ADR calling for it. `SocialConnector.supportedQueryFeatures` defaults to "supports none" when omitted, consistent with ADR-0021's "not silently absorbed" requirement. The connector/watchlist status view Story 3.6's AC2 references doesn't exist yet (no connector or watchlist REST endpoints exist in this repo at all) — `resolveWatchlistAstDispatch()`'s `unsupportedNodeTypes` field is proven correct at the data level as the signal such a view would surface, following the same "prove the mechanism, not the whole pipeline" pattern this session has used since Story 4.1. Story 3.3's AC3 traceability note (which forward-referenced this story) was updated to reflect it's now shipped, as an independent parallel guarantee rather than a replacement.

---

## 2026-07-30 — Story 2.4 (queue-bound half) — social-listening-core@6a21c8b

- **Full commit:** `6a21c8b0aca3e538b18b0e65b73afceb652f9c34`
- **Repo:** social-listening-core
- **Story / ADR:** 2.4 / ADR-0020
- **Contract:** social-listening-core/contracts/epic-2/story-2.4.bounded-queues-and-dead-lettering.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/provider-connector-framework/SKILL.md (updated, not new); social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md (updated, not new)
- **Files touched:** docs/implementation-plan.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.4.bounded-queues-and-dead-lettering.contract.test.ts, social-listening-core/src/connectors/requestGate.ts, social-listening-core/src/ingestion/errorClassification.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts
- **Full suite at merge:** PASS (85/85 — prior 81 + this story's 4)

**Only the queue-bound/dead-letter half of this story was built, deliberately** — the distributed (Redis-backed) `RequestGate` state half stays deferred per ADR-0020's own 2026-07-29 Amendment Log entry and `docs/implementation-plan.md`'s Phase 4 solo-project note, both explicit that it's only load-bearing once a second concurrent `social-listening-core` instance actually runs. A real timing bug surfaced and was fixed during test-writing, not left as a workaround: sleeping for the full window-reset duration before ever re-checking TTL would make a short test TTL unreachable if the reset wait was much longer (a real correctness gap in the original one-shot-sleep design, not just a test-speed problem) — fixed by sleeping in TTL-bounded increments (`Math.min(waitMs, remainingTtlMs)`) so abandonment is always checked promptly regardless of how far off the actual window reset is. `runIngestionAttempt.ts`'s existing `maxRetries` default (3, meaning 4 total attempts) was deliberately left unchanged — ADR-0020's "3 consecutive execution failures" dead-letter default is treated as ADR-0020's own number for its own concept, proven directly in this story's own test via an explicit `maxRetries: 2` override, not by silently redefining Story 2.3's already-shipped default to match. `docs/implementation-plan.md`'s Phase 4 solo-project note on Story 2.4 was updated to reflect the split (queue-bound half shipped, distributed-gate half still deferred).

---

## 2026-07-30 — Story 2.5 — social-listening-core@fc4245c

- **Full commit:** `fc4245c0f760179f5ec0ce1ca07b7245e8686dbe`
- **Repo:** social-listening-core
- **Story / ADR:** 2.5 / ADR-0023 (also edits Stories 2.3 / ADR-0010 and 4.3 / ADR-0009's contracts, per ADR-0023's explicit partial supersession)
- **Contract:** social-listening-core/contracts/epic-2/story-2.5.proportional-failure-threshold.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md (updated, not new)
- **Files touched:** docs/adr/0009-connector-health-derived-not-stored.md, docs/adr/0010-error-handling-and-auto-disable-policy.md, docs/adr/README.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, docs/user-stories/epic-4-derived-data-analytics-and-health.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/contracts/epic-2/story-2.3.error-handling-auto-disable.contract.test.ts, social-listening-core/contracts/epic-2/story-2.5.proportional-failure-threshold.contract.test.ts, social-listening-core/contracts/epic-4/story-4.3.derived-connector-health.contract.test.ts, social-listening-core/src/connectors/connectorHealth.ts
- **Full suite at merge:** PASS (89/89 — prior 85 + this story's 4)

**The most delicate story in this session — deliberately paused for the user's explicit sign-off before touching any already-shipped contract**, per the methodology's rule that a stale-relative-to-an-ADR contract can only be edited with a dated note and explicit go-ahead, never a decision this process makes on its own. Before asking, the actual blast radius was traced precisely: Story 4.3's contract needed zero assertion changes (its 10-pure-failures fixture clears the new rate rule too, just for a different reason); only one assertion in Story 2.3's AC4 ("9 failures still allowed, 10th disables") was fundamentally incompatible with any rate-based rule that can trigger before a flat count of exactly 10. User approved the traced plan before any edit was made. `deriveConnectorHealth()`'s `failing` rule is now ADR-0023's `(rate>=50% AND attempts>=5) OR consecutiveFailures>=20` — reusing the `consecutiveFailures` counter the function already computed, no new tracking needed for the ceiling half. `docs/adr/0009`'s and `0010`'s "Supersession update" notes (written when ADR-0023 was accepted, this session) each got a short dated follow-up confirming the healing they anticipated is now done — appended, not edited, per the series' own convention. All forward-references across `docs/adr/README.md` and both epic user-story files reading "once Story 2.5 is actually built" were updated to reflect that it now has been.

---

## 2026-07-30 — Story 3.5 — social-listening-core@f4bd93c

- **Full commit:** `f4bd93c1a83263fc66d0c1720d707065246000fe`
- **Repo:** social-listening-core
- **Story / ADR:** 3.5 / ADR-0018
- **Contract:** social-listening-core/contracts/epic-3/story-3.5.tiered-retention-and-archival.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/data-retention-and-archival/SKILL.md (new); social-listening-core/.claude/skills/social-post-lineage/SKILL.md (updated); social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md (updated)
- **Files touched:** docs/adr/0018-data-retention-and-archival-policy.md, social-listening-core/.claude/skills/data-retention-and-archival/SKILL.md, social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-3/story-3.5.tiered-retention-and-archival.contract.test.ts, social-listening-core/migrations/0011_partition_ingestion_runs.sql, social-listening-core/migrations/0012_partition_social_posts.sql, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/src/archival/blobArchiveClient.ts, social-listening-core/src/archival/ingestionRunArchival.ts, social-listening-core/src/archival/retentionConfig.ts, social-listening-core/src/archival/socialPostArchival.ts, social-listening-core/src/db/adminPool.ts, social-listening-core/src/posts/socialPostStore.ts
- **Full suite at merge:** PASS (95/95 — prior 89 + this story's 6)

**The largest single build of this session** — two live tables converted to genuine monthly-partitioned tables with composite primary keys, two different archival mechanisms, and a third real Azure dependency (Blob Storage, alongside Key Vault and Service Bus) fully provisioned mid-session. Two real architectural walls were hit and resolved with the user's explicit sign-off, not worked around silently: (1) `ingestion_runs`' partitioned primary key forced a composite FK design from `social_posts`, requiring a new `acquisition_started_at` denormalized column (user chose this over dropping the FK, at that point); (2) once building `ingestionRunArchival.ts`, Postgres was found to flatly refuse `DETACH PARTITION` while any row elsewhere holds a live FK into the partition being detached — meaning the composite FK from choice (1) is fundamentally incompatible with the whole-row archival the user separately chose for `ingestion_runs`. Both walls were surfaced as explicit decisions with the concrete Postgres error in hand, not guessed past. Final design: FK dropped, `acquisition_started_at` kept as a populated but application-enforced-only column. `social_posts` is partitioned by `created_at`, not `publishedAt` (nullable, can't be a partition key) — a third, smaller deviation decided directly (a Postgres-required Clarification, not a policy branch) and logged in ADR-0018's own Amendment Log alongside the FK change. A genuine flake was also chased down mid-session: an interrupted background test run left a Docker container/volume undropped, causing a subsequent run to silently reuse stale state ("No pending migrations" when fresh ones were expected) and produce a one-off false failure on the `ingestion_runs` archival test — resolved by clearing the leftover container, not by patching the test; confirmed clean on a properly isolated rerun (95/95). Test-created archive blobs are cleaned up after each run (`__deleteArchiveBlobForTests`), matching Key Vault's and Service Bus's contracts' own test-fixture hygiene, per the user's explicit request mid-session.

---

## 2026-07-30 — Story 4.4 — social-listening-core@56385ba

- **Full commit:** `56385ba4556dc9e52ce44f26bfa0a18d95b505ab`
- **Repo:** social-listening-core
- **Story / ADR:** 4.4 / ADR-0022
- **Contract:** social-listening-core/contracts/epic-4/story-4.4.derived-data-caching-and-refresh.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/derived-data-caching-and-refresh/SKILL.md (new); social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md (updated); social-listening-core/.claude/skills/author-topic-signals/SKILL.md (updated); social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md (updated)
- **Files touched:** social-listening-core/.claude/skills/author-topic-signals/SKILL.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/.claude/skills/derived-data-caching-and-refresh/SKILL.md, social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/contracts/epic-4/story-4.4.derived-data-caching-and-refresh.contract.test.ts, social-listening-core/docker-compose.test.yml, social-listening-core/docker/test-postgres/Dockerfile, social-listening-core/migrations/0013_enable_pg_cron_and_refresh_author_topic_signals.sql, social-listening-core/src/connectors/connectorHealthCache.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts, social-listening-core/src/http/versions/v1/router.ts
- **Full suite at merge:** PASS (102/102 — prior 95 + this story's 7)

**Last of Phase 4's five stories — Phase 4 is now storied-complete.** `ConnectorHealthCache` is a TTL-bound in-process `Map` in front of `deriveConnectorHealth()`, serving a new `GET /v1/connectors/:platformId`; its constructor takes `ttlMs` explicitly so the contract could prove stability-within-TTL and recompute-on-expiry without waiting a real 60 seconds. Proving AC5 (hourly `AuthorTopicSignal` refresh) against real infrastructure, not a mock, required the shared *test* Postgres image itself to change: `pg_cron` has no Alpine package, so `docker-compose.test.yml` now builds a custom image (`docker/test-postgres/Dockerfile`, `postgres:17` + `apt install postgresql-17-cron`) with `shared_preload_libraries`/`cron.database_name` set via a `command:` override — a one-time, bounded infra change affecting the whole suite's Postgres, not just this story's own test, flagged in the report rather than asked about up front since ADR-0022 had already accepted `pg_cron` as the implementation default. `refresh_author_topic_signals()` (migration `0013`) is a real, if partial, aggregation from `social_posts` — `mentionCount`/`firstMentionAt`/`lastMentionAt`/`activeMonthsCount` computed for real via `jsonb_array_elements_text(enrichment -> 'entities')` (reusing Story 4.2's exact unnesting pattern), while `avgEngagement`/`sentimentBreakdown` stay unpopulated since `social_posts` has no `engagementMetrics`/`sentiment` source column yet. The scheduled job runs as the migration's admin/superuser role, which `.claude/skills/postgres-tenant-db/SKILL.md`'s own Known gaps had flagged as the still-missing sanctioned cross-tenant-batch-job bypass — now resolved for this one real case, documented there for future jobs to follow the same pattern. Two self-inflicted test bugs were caught and fixed before this ever reached heal-contract-failure territory (same-session, never-shipped, so not a regression): AC2's Redis-absence check initially matched its own explanatory comment (the same self-matching-regex class of bug Story 4.1's AC3 hit), fixed by matching real import syntax only; AC1's original 50ms TTL was flaky against 20 sequential real-Postgres round trips, fixed by widening to a still-fast-but-safe 3s TTL/sleep.

---

## 2026-07-30 — Story 2.6 — social-listening-core@0169143

- **Full commit:** `0169143f0f1664d3f4b6cd79ea639ce60732db28`
- **Repo:** social-listening-core
- **Story / ADR:** 2.6 / ADR-0024
- **Contract:** social-listening-core/contracts/epic-2/story-2.6.newswire-connector.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/newswire-connector/SKILL.md (new); social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md (updated); social-listening-core/.claude/skills/provider-connector-framework/SKILL.md (updated); social-listening-core/.claude/skills/social-post-lineage/SKILL.md (updated)
- **Files touched:** social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-2/story-2.6.newswire-connector.contract.test.ts, social-listening-core/src/connectors/newswire/newswireConnector.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/newswire/rssFeedParser.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts, social-listening-core/src/posts/socialPostStore.ts
- **Full suite at merge:** PASS (107/107 — prior 102 + this story's 5; `--runInBand` — the default parallel run shows pre-existing cross-worker interference against the real Azure Service Bus tests (Stories 5.2/5.5) plus a worker OOM crash on Story 4.4, both reproduced on the pre-Story-2.6 tree too and unrelated to this change)

**The first real, non-`examples/`-fixture connector in this repo, and the first proven against genuinely live external feeds rather than a synthetic fixture** — ADR-0024's own explicit bar. `rssFeedParser.ts` is a deliberately narrow, dependency-free RSS 2.0 `<item>` extractor (not a general XML parser), written and shaped against real captured GlobeNewswire/PR Newswire feed samples fetched before any code existed, tolerating the two real differences observed between the wires (GlobeNewswire's multi-line `<guid isPermaLink="true">` attribute; PR Newswire's CDATA-wrapped `<dc:contributor>` vs. GlobeNewswire's plain-text one). `dc:contributor` — present on every sampled item from both wires — is the issuer field ADR-0024's Author-as-organization modeling needed; global `fetch`/`Response` typed fine under the existing `lib: ["ES2022"]` + `@types/node@26` setup, so no new dependency was added for either HTTP or XML.

Closing the actual "connective tissue" gap several earlier stories' SKILL.mds had flagged as open required two small, additive changes to shared code, surfaced explicitly rather than folded in silently: (1) `runIngestionAttempt()`'s `attempt` callback gained a `runId: string` parameter — there was previously no way for a real connector to obtain the just-opened `IngestionRun`'s id from inside its own `attempt()` closure to satisfy `insertSocialPost()`'s required `acquisitionId`; every existing zero-arg `attempt` callback across Stories 2.3–2.5's contracts remains valid under structural typing, re-verified by the full-suite run below. (2) `pollNewswireFeeds()`'s gate call reclassifies `QueueTtlExceededError`/`QueueDepthExceededError` into `ClassifiableError`, per the pattern `connector-health-and-error-handling`'s own SKILL.md already prescribed as "the connector's job" — not independently exercised by this story's own contract (the default 6h/1,000 queue bounds never actually trip for a single low-volume connector's test run; Story 2.4's contract already proves the reclassification pattern in the abstract).

No `social_posts.external_id`/`platform_id` column exists, so re-poll dedup (`findSocialPostByExternalId()`, new in `socialPostStore.ts`) queries `raw_payload->>'providerId'`/`raw_payload->>'externalId'` directly rather than adding a column speculatively for one connector — proven via two real, live consecutive poll cycles against the same feed (AC4), not a mock clock. Cross-wire de-duplication (ADR-0024 leaves this open) is this story's own deliberate choice: v1 does not attempt it, proven via a controlled synthetic fixture (AC5) rather than waiting on a live cross-wire coincidental republish, which isn't something a test can force deterministically. Three SKILL.mds whose "no real connector exists/is wired yet" claims this story makes stale (`provider-connector-framework`, `connector-health-and-error-handling`, `social-post-lineage`) were corrected in the same commit rather than left to rot.

---

## 2026-07-30 — Story 1.4 — social-listening-core@5f43ca9

- **Full commit:** `5f43ca9d23c0e9b88bc15bcefcadeeb0f418c0e9`
- **Repo:** social-listening-core
- **Story / ADR:** 1.4 / ADR-0025
- **Contract:** social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md (updated, not new)
- **Files touched:** CLAUDE.md, docs/adr/0025-persistent-local-dev-database-separate-from-test-database.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/README.md, social-listening-core/contracts/epic-1/story-1.4-fixtures/printEnvAndArgv.js, social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts, social-listening-core/docker-compose.dev.yml, social-listening-core/package.json, social-listening-core/scripts/withDevEnv.js
- **Full suite at merge:** PASS (113/113 — prior 107 + this story's 6)

**A deliberate exception to this series' own "23 ADRs, architecturally significant only" scope** — ADR-0025's own Acceptance note says so directly: `docs/implementation-plan.md`'s Phase 0 already pre-classified "local dev environment" as "also build, not storied," the same bucket this repo's testing-strategy/CI details sit in. Captured as ADR-0025/Story 1.4 anyway, by explicit user decision, because the friction it fixes was hit in practice (a concurrent `npm test` run's `globalTeardown` wiped a running demo server's data out from under it — see Story 2.6's own entry above for the demo that surfaced it) and because building the fix surfaced two real, non-obvious bugs worth a durable record rather than a silent patch. `docker-compose.dev.yml` reuses the exact same custom `pg_cron` Postgres image Story 4.4 built, on its own port/container/network/named-volume, so `npm test` and `npm run dev` can never collide — verified in practice, not just argued (a live `npm test` run against a concurrently-running dev server left the dev database and server untouched). `scripts/withDevEnv.js` replaced shell `export`/`$env:` with a cross-platform Node wrapper; its first version used `execSync()` on a rejoined `argv.slice(2).join(' ')` string, which both corrupted multi-word arguments (already-shell-split argv re-joined then re-parsed through a second shell) and didn't reliably keep a long-running server's env correct on Windows — fixed by rewriting around `spawn()` with an argv array, before this ADR was even first drafted. Writing this story's own contract test then caught a *second* bug: `PGDATABASE`/`PGUSER`/`PGPASSWORD`/`APP_PGUSER`/`APP_PGPASSWORD` all fell back to whatever the caller's shell already had set (`process.env.X || default`), unlike `PGPORT` (already correctly forced) — meaning a stray value already set globally would silently override the intended dev target instead of the reverse, defeating the whole point of the wrapper. Fixed by forcing all six values unconditionally; logged in ADR-0025's Amendment Log as a second, dated entry rather than folded in silently.

---

## 2026-08-01 — Story 2.7 — social-listening-core@8e3a54d

- **Full commit:** `8e3a54dd5128cdab26834d3a26d66639b14051f7`
- **Repo:** social-listening-core
- **Story / ADR:** 2.7 / ADR-0026
- **Contract:** social-listening-core/contracts/epic-2/story-2.7.gnews-connector.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/gnews-connector/SKILL.md (new)
- **Files touched:** docs/implementation-plan.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.env.example, social-listening-core/contracts/epic-2/story-2.7.gnews-connector.contract.test.ts, social-listening-core/jest.global-setup.js, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/src/connectors/gnews/gnewsConnector.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/credentials/credentialStore.ts
- **Full suite at merge:** PASS (117/117 — prior 113 + this story's 4)

**Closes Phase 1's own longest-standing gap — the actual RSS/News connector implementation, unbuilt since Phase 0 even after Story 2.6 (a later, Phase-4 connector) shipped ahead of it.** The second real, non-`examples/`-fixture connector in this repo, and the first to authenticate with a real per-tenant credential — `authMode: 'api_key'`, proving that auth mode for real where Newswire (`authMode: 'none'`) couldn't. `Author` resolves to the article's source publication, the same scoped exception to ADR-0004's per-account assumption Newswire needed, now confirmed as a real recurring pattern rather than a one-off (see ADR-0004's own 2026-07-31 Supersession update, which applies this project's "rule of three" rather than generalizing off two instances). `supportedQueryFeatures` is declared as `['AND', 'OR', 'NOT', 'TERM']` — GNews's real native query capability, richer than Newswire's empty declaration.

`dotenv` was added to `social-listening-core` for local dev credentials — a genuinely new problem this story hit that no prior story did: setting `GNEWS_API_KEY` as a Windows user-level environment variable didn't propagate to already-running terminal/IDE sessions, only to freshly-started ones. A `.env` (gitignored) loaded at process start in `jest.global-setup.js` sidesteps that entirely; `.env.example` documents the one variable it currently holds.

**Two real issues found and fixed via `heal-contract-failure`, not worked around:** (1) the initial contract run failed a `beforeAll` hook (Key Vault key provisioning) at a 60s timeout, even though a standalone script proved the same Key Vault call completes in ~5s — traced to an unconstrained Node heap causing GC-driven slowdown severe enough to stall the event loop past the timeout under this story's larger, first-compiled dependency graph; `NODE_OPTIONS=--max-old-space-size=256` resolved it completely (confirmed: Story 5.3's own existing Key Vault contract ran clean and fast throughout, ruling out an environmental/Azure-side cause). (2) A real logic bug in the AC3 fixture, not a flaky test: an "implausible term" query dispatches to **native** mode for GNews (since GNews declares `TERM` support, unlike Newswire's empty declaration), and native mode never filters by design — trusting the connector's own real query already did — so it could never have returned zero matches regardless of the term. Fixed by testing fallback-genuinely-filters with a `HASHTAG` query instead (GNews has no hashtag equivalent, so it always falls back) against a controlled fixture, since real article titles never literally contain `#hashtag` text for a live-content proof to distinguish "filters correctly" from "silently passes through." Separately, a real GNews 429 (transient burst limit, not quota exhaustion — confirmed via the account dashboard at 5 of 100 daily requests used, and an identical manual call succeeding moments later) surfaced because AC3's direct `fetchGNewsSearch()` call — needed for raw article fixtures — bypasses the retry-with-backoff every real poll cycle gets through `runIngestionAttempt()`; given its own small retry helper in the test file rather than changing production code, which already handles this correctly for every other AC.

Remaining Phase 1 gap, unchanged by this story: the "also build, not storied" work (watchlist CRUD, connector connect/disconnect endpoints, the admin UI) — see `docs/open-items-and-deferred-work.md` §A.
