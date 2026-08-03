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

Remaining Phase 1 gap, **partially closed by Story 1.5** (watchlist CRUD implemented below) — the remaining "also build, not storied" work (connector connect/disconnect endpoints, the admin UI) — see `docs/open-items-and-deferred-work.md` §A.

---

## 2026-08-01 — Story 1.5 — social-listening-core@1fb3e55

- **Full commit:** `1fb3e554607fb419a0ec20176d373117b16e7dd0`
- **Repo:** social-listening-core
- **Story / ADR:** 1.5 / **Phase 1 "also build, not storied" work** (see `docs/open-items-and-deferred-work.md` §A)
- **Contract:** social-listening-core/contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/watchlist-crud/SKILL.md (new)
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/open-items-and-deferred-work.md, social-listening-core/.claude/skills/watchlist-crud/SKILL.md, social-listening-core/migrations/0014_create_watchlists.sql, social-listening-core/contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts, social-listening-core/src/watchlists/watchlistStore.ts, social-listening-core/src/http/versions/v1/watchlistsRouter.ts, social-listening-core/src/http/versions/v1/router.ts
- **Full suite at merge:** PASS (132/132 — prior 117 + this story's 15)

**Phase 1's "also build, not storied" CRUD surface — closes a major gap in the end-to-end pipeline.** This is not an ADR-driven story (no architecturally significant decision to capture), but the CRUD surface that makes the watchlist matching mechanism (Stories 3.3, 3.6) actually usable: users can now create, read, update, and delete watchlists via REST endpoints. `watchlists` table follows the same RLS-isolated pattern as all other tenant-scoped tables (ADR-0015), with `tenant_id` UUID, `id` UUID primary key, and `tenant_isolation` policy. The schema supports all four match types (`keyword`, `hashtag`, `account`, `boolean`) from ADR-0006/ADR-0021, with `booleanQuery` carrying the full boolean syntax when `matchType` is `boolean`. Defaults: `isActive` true, `platformIds` empty array, `createdAt`/`updatedAt` auto-managed timestamps with trigger. Endpoints: `POST /v1/watchlists` (201), `GET /v1/watchlists` (with optional `matchType` filter), `PATCH /v1/watchlists/:id` (PATCH semantics), `DELETE /v1/watchlists/:id` (204). All enforce `X-Tenant-Id` header requirement and return 404 for cross-tenant access via RLS — proven by AC7's cross-tenant isolation test. This story's 15 contracts are the largest single-story test suite in the series so far, proving every CRUD path, filter, default, and error case.

---

## 2026-08-03 — Governance: ADR-0028 through ADR-0035 drafted and accepted — socialengage@fdad724

*New entry category, not a story or healing pass: a governance/ADR session with no code implementation, using this log's existing field set anyway (per this doc's own "Repo/Files touched, verified against git" discipline) rather than starting a second, unverified record elsewhere. Uses the pre-split `Repo: socialengage` convention Story 1.1's own entry established, since `social-listening-core`/`social-listening-admin` don't exist as separate repos yet — `check-implementation-log.cjs` will skip this entry once copied into either real repo, the same treatment Story 1.1 gets, since neither `REPO_NAME` will match `socialengage`.*

- **Full commit:** `fdad7248a574750eaaeed4e362bb2dd6c59d06b8`
- **Repo:** socialengage
- **Story / ADR:** ADR-0028–ADR-0035 (eight ADRs; six generate Stories 5.6–5.10 and 1.7, all now Ready; ADR-0027/0028/0035 are the series' three no-story exceptions per `docs/user-stories/README.md`'s "No-story ADR convention")
- **Contract:** none — no code changed; nothing for `check-implementation-log.cjs`'s file-list check to verify beyond existence of the commit and files below
- **SKILL.md:** none
- **Files touched:** docs/adr/0002-unified-provider-connector-pattern.md, docs/adr/0014-credential-storage-envelope-encryption-oauth-first.md, docs/adr/0027-connector-is-technical-intermediary-not-contracting-party.md, docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md, docs/adr/0029-authentication-mechanism-entra-external-id.md, docs/adr/0030-admin-tier-design-platform-admin-rls-exception.md, docs/adr/0031-tenants-table-shape.md, docs/adr/0032-users-table-shape-and-rls.md, docs/adr/0033-retire-x-tenant-id-header-placeholder.md, docs/adr/0034-connector-connect-disconnect-crud-ownership-tier-aware.md, docs/adr/0035-admin-ui-shape-one-app-role-gated.md, docs/adr/README.md, docs/design/README.md, docs/design/admin-ui-mockup-2026-08-03.html, docs/design/platform-admin-console-mockup-2026-08-03.html, docs/future-subsystems.md, docs/implementation-plan.md, docs/open-items-and-deferred-work.md, docs/project docs/Business-Case-v6.0.md, docs/project docs/Project Management Plans/Cost-Management-Plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, docs/user-stories/epic-5-security-isolation-and-messaging.md
- **Full suite at merge:** N/A — no code, no test suite affected
- **Session duration (approximate):** ~4h55m — proxy from the git commit-timestamp gap (`72fbe72` 10:15 → `fdad724` 15:09, same day), not a measured value. See `Cost-Management-Plan.md` §5.2.5 for the full caveat and the still-open hourly-rate decision — this is now that section's single source of truth for this session's own row, not duplicated there.

Eight ADRs drafted (ADR-0028's own batch, then ADR-0029–ADR-0035 as a second, sequenced seven-ADR batch closing `docs/adr/README.md`'s 2026-07-30 multi-tenant governance note in full) and reviewed/accepted by Menno across a series of exchanges, several revised in place first (ADR-0030's break-glass mechanism, ADR-0031's sign-up domain capture, ADR-0032's `access_ends_at`), two with their own flagged questions confirmed directly rather than waved through (ADR-0034's Tenant-Admin revocation reading, ADR-0035's rule-of-three no-story-convention decision). Sequenced into a new Phase 4.5 in `docs/implementation-plan.md`; two UI design references added under `docs/design/` (explicitly non-Next.js, flagged as such). See `docs/adr/README.md`'s footnotes 10–11 and each ADR's own Amendment Log for the full drafting/revision record this one-paragraph summary can't carry.

---

## 2026-08-03 — Healing: extend Story 1.6's Jest timeout for real Key Vault calls — socialengage@438d93e

- **Full commit:** `438d93e2a72773382dd38a91e79d82185f469ea4`
- **Repo:** socialengage (pre-split convention, per Story 1.1's own entry — this commit touches only `social-listening-core/contracts/...`, no separate repo exists yet)
- **Story / ADR:** 1.6 (Phase 1 "also build, not storied" work, no ADR) — the contract healed
- **Contract:** social-listening-core/contracts/epic-1/story-1.6.connector-connect-disconnect.contract.test.ts
- **SKILL.md:** none touched (no component-behavior change, only a test timeout)
- **Files touched:** social-listening-core/contracts/epic-1/story-1.6.connector-connect-disconnect.contract.test.ts
- **Full suite at merge:** PASS (147/147)

Surfaced while validating Story 5.6's own full-suite run (see the next entry), not caused by it. Story 1.6's contract performs the same real, cold Azure Key Vault RSA key create/delete Story 5.3 already does, but never set Story 5.3's own `jest.setTimeout(30000)` — it silently relied on Jest's 5000ms default, which the `afterAll` cleanup's `beginDeleteKey` call intermittently exceeded. Reproduced directly (one run: 7/8 passed, only the cleanup hook timed out), fixed by matching Story 5.3's existing precedent exactly — no assertion changed, per `heal-contract-failure`'s own "fix the underlying thing, never the check" rule.

**A second, separate issue investigated in the same pass, requiring no code fix:** the same full-suite run also failed Story 5.2 and Story 5.5 (real Azure Service Bus `RestError`/`UnauthorizedRequestError` on `adminClient.createSubscription(...)`). Root cause, confirmed via a direct diagnostic script against the real namespace: this session's own `az login --tenant <ciam-tenant-id>` (unrelated infrastructure work, provisioning a real Entra External ID tenant for Story 5.6) had switched the Azure CLI's active account context away from the original subscription that the real `social-listening-dev` Service Bus namespace lives in — `DefaultAzureCredential`'s CLI-credential fallback picked up the wrong tenant. Fixed by `az account set --subscription "Azure Free subscription"`, confirmed by the diagnostic script succeeding again and both stories' contracts passing cleanly on re-run. No file changes were needed or made for this half — an environmental/session-state issue, not a code regression.

---

## 2026-08-03 — Story 5.6 — socialengage@caa4c57

- **Full commit:** `caa4c57de5689435fb2e6603d9404b8559806647`
- **Repo:** socialengage (pre-split convention, per Story 1.1's own entry — this commit touches only `social-listening-core/**` plus one docs file, no separate repo exists yet)
- **Story / ADR:** 5.6 / ADR-0029
- **Contract:** social-listening-core/contracts/epic-5/story-5.6.entra-authentication.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/entra-authentication/SKILL.md (new)
- **Files touched:** docs/implementation-plan.md, social-listening-core/.claude/skills/entra-authentication/SKILL.md, social-listening-core/.env.example, social-listening-core/contracts/epic-5/story-5.6.entra-authentication.contract.test.ts, social-listening-core/package-lock.json, social-listening-core/package.json, social-listening-core/src/http/auth/entraAuthMiddleware.ts
- **Full suite at merge:** PASS (147/147)

**First story built against a genuinely provisioned, real Microsoft Entra External ID tenant, not a mock** — `getsocialengage.onmicrosoft.com` (Tenant ID `68ae3657-76be-49c7-b8df-3824ab1ba6de`), provisioned this same session specifically for this story after an initial raw-ARM-API attempt (`socialengage`, then `getsocialengage` after a global name collision) failed with no diagnosable error; the Microsoft Entra admin center's own guided tenant-creation wizard succeeded where the raw `Microsoft.AzureActiveDirectory/ciamDirectories` ARM PUT did not. `createEntraAuthMiddleware()` validates a bearer token's signature and issuer via standard OIDC/JWT verification (`jose`'s `createRemoteJWKSet`/`jwtVerify`) against the tenant's real JWKS endpoint — no Entra SDK or Graph API call on the request-authorization path, per ADR-0029 §2's Decision-level requirement, checked structurally by this story's own contract (AC2). `sub` is extracted as an opaque string onto `req.auth.sub`; the middleware is **not mounted on any real route** — that, and retiring `X-Tenant-Id`, is Story 5.10's own scope, kept out of this one per the dependency-ordered build already laid out in `docs/implementation-plan.md`'s Phase 4.5.

Two app registrations were created inside the real tenant to prove this for real: `social-listening-core` (the API resource, with an `Api.Access` application-type app role) and `social-listening-core-test-client` (a test-only client-credentials caller, admin-consented against that role) — a genuine, live access token is minted fresh in the contract's own `beforeAll` via a real `client_credentials` grant, not a cached fixture. This also produced one real, partial finding on ADR-0029's own `oid`-vs-`sub` Open Question: `oid` **is** present and equals `sub` for this client-credentials (app-only) token — but ADR-0029's actual question concerned interactive **user sign-in** ID tokens specifically, which follow different claim rules and remain unverified; logged as such in the SKILL.md's own "Known gaps" rather than conflated with this finding.

**A real regression was caught and fixed via `heal-contract-failure` during this story's own full-suite validation, not silently absorbed:** provisioning the real tenant required `az login --tenant <ciam-tenant-id>`, which switched the Azure CLI's active account context away from the original subscription the real `social-listening-dev` Service Bus namespace lives in, breaking `DefaultAzureCredential` for Stories 5.2/5.5's real Service Bus calls (`UnauthorizedRequestError`, confirmed via a direct diagnostic script, not guessed). Fixed by restoring the correct CLI context — no code change needed for those two. A second, genuinely pre-existing and unrelated issue (Story 1.6's contract missing a `jest.setTimeout` override for real Key Vault calls, unlike Story 5.3's identical-pattern precedent) was found in the same pass and fixed on its own, separately-scoped commit. See `docs/implementation-log.md`'s own immediately-preceding Healing entry for the full account.

---

## 2026-08-03 — Story 5.7 — social-listening-core@3378e00

- **Full commit:** `3378e00205979e058259cae5079aac6449d07f66`
- **Repo:** social-listening-core (this commit touches only `social-listening-core/**` plus `docs/**`, no separate repo exists yet — pre-split convention per Story 1.1's own entry)
- **Story / ADR:** 5.7 / ADR-0030
- **Contract:** social-listening-core/contracts/epic-5/story-5.7.platform-admin-rls-bypass.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/platform-admin-access/SKILL.md (new)
- **Files touched:** docs/adr/0030-admin-tier-design-platform-admin-rls-exception.md, docs/implementation-plan.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/.env.example, social-listening-core/contracts/epic-5/story-5.7.platform-admin-rls-bypass.contract.test.ts, social-listening-core/jest.global-setup.js, social-listening-core/migrations/0015_create_platform_admin_role_and_audit_log.sql, social-listening-core/migrations/0016_create_platform_admin_break_glass_requests.sql, social-listening-core/src/admin/breakGlassCredentialReset.ts, social-listening-core/src/admin/platformAdminAuditLog.ts, social-listening-core/src/db/platformAdminPool.ts
- **Full suite at merge:** PASS (159/159 — prior 147 + this story's 12)

**Second story in Phase 4.5 — proves ADR-0030's central boundary empirically, not just by grant absence.** `platform_admin_role` (`BYPASSRLS`, migration `0015`) is confirmed to have zero grants on every tenant-content table that exists today (`users`, `watchlists`, `social_posts`, `platform_credentials`, `authors`, `ingestion_runs`, `author_topic_signals`) — a live `information_schema.table_privileges` check, not an assumption from the migration's own contents. Every write through the role goes through `logPlatformAdminAction()` to `platform_admin_audit_log`; an ordinary `withTenant()` write is confirmed to run as `app_user`, never this role.

The break-glass mechanism (ADR-0030 §3) is the story's harder half, and was shaped by two real constraints discovered during implementation, not assumed up front. First, Menno's own direct instruction split what the ADR described into an explicit two-phase workflow — a request is recorded with no Entra action at all, then a Platform Admin separately and explicitly picks it up for execution — never a single automated call, and extended its scope from "password reset only" to also issuing a real Temporary Access Pass in the same JIT window, since a password reset alone cannot recover a Tenant-Admin who has also lost their MFA device. Second, a genuine Microsoft Graph API constraint, confirmed directly against the real tenant rather than assumed from documentation: a principal cannot remove its own directory role assignment, so a single self-elevating identity cannot de-elevate itself after acting — this is why the mechanism uses two separate app registrations (an "elevator," holding only `RoleManagement.ReadWrite.Directory`, which grants and revokes both "User Administrator" and "Authentication Administrator" together on the second identity; a "resetter," holding only `User-PasswordProfile.ReadWrite.All` + `UserAuthMethod-TAP.ReadWrite.All` and never `RoleManagement.ReadWrite.Directory`, so it cannot request its own elevation). The contract's own AC (see the contract file) executes this for real against the live `getsocialengage` tenant: a genuine password reset, a genuine TAP issuance, confirmed de-elevation of both JIT roles afterward, confirmation the TAP code never reaches the audit log, and rejection of re-executing an already-executed request. Real, observed Entra directory-role-assignment replication lag (~15s) required retry/poll logic rather than a single immediate read or delete, matching the same class of eventual-consistency issue Story 5.2 hit against Service Bus RBAC.

**Known, named gaps, not silently deferred** — see the SKILL.md's own "Known gaps" section: the `tenants`-table grant is explicitly Story 5.8's job; resolving a tenant name to its actual Entra Tenant-Admin user is Story 5.9's job; no notification channel exists for delivering the TAP code to the real Tenant-Admin (ADR-0030's own Open Question); a tenant with zero reachable Tenant-Admins has no recovery path under this mechanism; the audit-log schema is a first cut, not final.

---

## 2026-08-03 — Story 5.8 — social-listening-core@e6de8df

- **Full commit:** `e6de8dfa2f5656d1f6b77b81dbf873772b2e90b3`
- **Repo:** social-listening-core (this commit touches only `social-listening-core/**` plus `docs/implementation-plan.md`, no separate repo exists yet — pre-split convention per Story 1.1's own entry)
- **Story / ADR:** 5.8 / ADR-0031
- **Contract:** social-listening-core/contracts/epic-5/story-5.8.tenants-table-rls.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/tenants/SKILL.md (new); social-listening-core/.claude/skills/platform-admin-access/SKILL.md (updated, not new)
- **Files touched:** docs/implementation-plan.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/.claude/skills/tenants/SKILL.md, social-listening-core/contracts/epic-5/story-5.8.tenants-table-rls.contract.test.ts, social-listening-core/migrations/0017_create_tenants.sql, social-listening-core/src/tenants/tenantStore.ts
- **Full suite at merge:** PASS (169/169 — prior 159 + this story's 10, 33/33 suites)

**Third story in Phase 4.5 — the first table this project has ever shaped around "this row IS the tenant" rather than a `tenant_id` reference to one.** `tenants` (migration `0017`) has no `tenant_id` column at all; its RLS policy is scoped by `id` directly (ADR-0031 §2's own explicit rejection of a redundant self-referencing `tenant_id = id` column). It's also `platform_admin_role`'s first real grant since Story 5.7 provisioned the role with zero grants anywhere — `SELECT, INSERT`, plus a **column-scoped** `UPDATE (status, license_seat_count)`, narrower than `platform-admin-access/SKILL.md`'s original "add GRANT SELECT, INSERT, UPDATE" sketch. That narrowing wasn't optional: AC3 required `platform_admin_role` to be DB-level denied from writing `active_seat_count`, and Postgres's column-level `GRANT` is the direct, provable way to enforce that rather than trusting application code alone — proven in the contract via a raw `UPDATE` attempt that fails with `permission denied`, the same empirical-proof style Story 5.7 used for its own zero-grants claim.

ADR-0031 §3 named a real, unresolved seat-count race condition as its own Open Question and suggested its own fix without designing it in detail: "an atomic `UPDATE ... WHERE active_seat_count < license_seat_count RETURNING ...`" rather than a `SELECT` followed by a separate `UPDATE`. `incrementActiveSeatCount()`/`decrementActiveSeatCount()` implement exactly that — a single statement, so Postgres's own row-level locking within the statement closes the race, not application-level coordination. Both functions run through `withTenant()` as `app_user`, never `platform_admin_role` — proven directly (AC4) — and are **not yet wired into a real user-invitation flow**, since no `users` table exists (Story 5.9's own job); this story proves the seat-count primitive correct in isolation against `tenants` alone, the same "prove the mechanism, not the whole pipeline" pattern used since Story 4.1's `author_topic_signals`.

`domain` (ADR-0031 §5, added at the ADR's own review) is nullable with a partial unique index (`WHERE domain IS NOT NULL`) enforcing uniqueness only when set — proven for both the null-collision-free case and the duplicate-non-null-rejection case. Its public-email-provider exclusion mechanism and the sign-up "rerouting" UX itself are both explicitly out of this story's scope, per the story's own added Acceptance Criteria note and ADR-0031's own Open Questions — deferred to whoever builds candidate ADR #4's sign-up/invite-flow story.

---

## 2026-08-03 — Story 5.9 — social-listening-core@b0839ed

- **Full commit:** `b0839eda9624a6563779255bf4efc67ff33780d0`
- **Repo:** social-listening-core (this commit touches only `social-listening-core/**` plus `docs/implementation-plan.md`, no separate repo exists yet — pre-split convention per Story 1.1's own entry)
- **Story / ADR:** 5.9 / ADR-0032
- **Contract:** social-listening-core/contracts/epic-5/story-5.9.users-table-identity-resolution.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/identity-resolution/SKILL.md (new); social-listening-core/.claude/skills/platform-admin-access/SKILL.md (updated, not new)
- **Files touched:** docs/implementation-plan.md, social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/contracts/epic-5/story-5.9.users-table-identity-resolution.contract.test.ts, social-listening-core/jest.global-setup.js, social-listening-core/migrations/0018_create_users_and_platform_admins.sql, social-listening-core/src/db/identityResolverPool.ts, social-listening-core/src/identity/identityResolution.ts
- **Full suite at merge:** PASS (180/180 — prior 169 + this story's 11, 34/34 suites)

**Fourth story in Phase 4.5 — closes `Stakeholder-Register.md` S-08's own named gap ("candidate ADRs #1–#4 must exist first"), the last of the four.** `users` is tenant-scoped with RLS identical in shape to every other table (ADR-0032 §2, no special-casing). `platform_admins` is deliberately not a `users` row (§3) — RLS enabled and forced with zero `CREATE POLICY` statements, which fails closed to every role without `BYPASSRLS`, while `app_user` still gets a real `SELECT` grant so a query against it doesn't error, it just always returns zero rows — proven directly (AC6), not assumed from the migration's own contents. `identity_resolver_role` is a fourth Postgres role, deliberately narrower than `platform_admin_role`'s own: `BYPASSRLS`, column-scoped `SELECT`-only on specific columns of both tables, no write grant at all (§5) — proven via three separate raw-write attempts (INSERT/UPDATE/DELETE) all failing `permission denied`, plus a fourth proof that even a non-granted column (`display_name`) is unreadable.

**A real design tension in ADR-0032 was found and resolved during implementation, not silently worked around:** §5 states the resolver role has "never any write grant," but §6 requires linking `external_subject`/`status` at first sign-in — a write. Resolved the way AC3 itself points to (no bypass role used for anything beyond the initial lookup): `resolveIdentity()` has the resolver role perform only the initial *read* — by `sub` first, then by `email` for an unlinked `invited` row if `sub` matches nothing. Once that read reveals which tenant the invited row belongs to, the actual link write (`external_subject`, `status = 'active'`, `activated_at`) runs through the *ordinary* `withTenant(tenantId, ...)` `app_user` path — the same path every other tenant-scoped write in this codebase already uses, proven directly by checking `current_user` immediately after. This preserves ADR-0032 §5's "no write grant at all" literally while still satisfying §6's linking requirement.

`access_ends_at` (§9, added at ADR-0032's own review) drives "currently active" resolution directly — `status = 'active' AND (access_ends_at IS NULL OR access_ends_at > now())` — proven for all three transitions the story's own Acceptance Criteria note requires: a past timestamp resolves as not-active, a future one still resolves as active, and clearing it back to `NULL` restores active resolution. Auditing `access_ends_at` writes is explicitly out of scope (ADR-0032's own deferral to whichever future work resolves ADR-0030 §5/ADR-0031's shared audit-log question).

**Known, named gaps, not silently deferred** — see the SKILL.md's own "Known gaps" section: not mounted on any real HTTP route yet (Story 5.10's job); no real `platform_admins` provisioning flow (not designed by ADR-0032); `access_ends_at` writes aren't audited; Tenant Reader/Tenant Business Analyst have no separate `role` value (ADR-0032 §4's deliberate v1 deferral); `createInvitedUser()` does not itself call `tenantStore.ts`'s seat-count functions — this story's own ACs test `access_ends_at` and linking, not seat consumption, so wiring seat reservation into a real invite/onboarding flow is left for whoever builds that flow.

---

## 2026-08-03 — Story 5.10 — social-listening-core@3580687

- **Full commit:** `358068770add65f29a756375c56ed3a9c72588a2`
- **Repo:** social-listening-core (this commit touches only `social-listening-core/**` plus `docs/implementation-plan.md`, no separate repo exists yet — pre-split convention per Story 1.1's own entry)
- **Story / ADR:** 5.10 / ADR-0033
- **Contract:** social-listening-core/contracts/epic-5/story-5.10.retire-x-tenant-id.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/tenant-auth-middleware/SKILL.md (new); social-listening-core/.claude/skills/entra-authentication/SKILL.md, social-listening-core/.claude/skills/http-api-versioning/SKILL.md, social-listening-core/.claude/skills/identity-resolution/SKILL.md (all updated, not new)
- **Files touched:** docs/implementation-plan.md, social-listening-core/.claude/skills/entra-authentication/SKILL.md, social-listening-core/.claude/skills/http-api-versioning/SKILL.md, social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/.claude/skills/tenant-auth-middleware/SKILL.md, social-listening-core/contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts, social-listening-core/contracts/epic-1/story-1.6.connector-connect-disconnect.contract.test.ts, social-listening-core/contracts/epic-3/story-3.4.cursor-pagination.contract.test.ts, social-listening-core/contracts/epic-4/story-4.1.author-topic-signals.contract.test.ts, social-listening-core/contracts/epic-4/story-4.4.derived-data-caching-and-refresh.contract.test.ts, social-listening-core/contracts/epic-5/story-5.1.thin-events.contract.test.ts, social-listening-core/contracts/epic-5/story-5.10.retire-x-tenant-id.contract.test.ts, social-listening-core/src/http/app.ts, social-listening-core/src/http/auth/entraAuthMiddleware.ts, social-listening-core/src/http/auth/requestIdentity.ts, social-listening-core/src/http/auth/requireTenantUser.ts, social-listening-core/src/http/auth/tenantAuthMiddleware.ts, social-listening-core/src/http/auth/testAuthBypassMiddleware.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts, social-listening-core/src/http/versions/v1/postsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/topicsRouter.ts, social-listening-core/src/http/versions/v1/watchlistsRouter.ts, social-listening-core/src/testUtils/testIdentityHeader.ts
- **Full suite at merge:** PASS (186/186 — prior 180 + this story's 6, 35/35 suites)

**Fifth and last dependency-chain story in Phase 4.5 — `X-Tenant-Id` no longer has any trust role anywhere in this codebase, closing `Business-Case-v6.0.md` Risk R-04 for real.** `createTenantAuthMiddleware()` composes Story 5.6's token verification (unchanged) and Story 5.9's `resolveIdentity()` (unchanged) into ADR-0033 §1's "one seam," threaded by `app.ts` into `createV1Router()` — a factory (was a static export), so the middleware can be mounted ahead of each substantive `/v1` sub-router while `/v1/health` stays deliberately public. Every route handler that used to read `req.header('X-Tenant-Id')` now reads `req.identity` via a shared `requireTenantUser()` helper (403 for a non-tenant-user identity, e.g. Platform Admin, on these tenant-content routes — a necessary behavior beyond the literal AC list, flagged rather than silently added, since `req.identity` can now structurally be either shape). No downstream store function's signature changed (AC3, ADR-0033 §2) — proven both structurally (no store file touched) and by the reworked tests' own business-logic assertions continuing to pass unmodified. A stray `X-Tenant-Id` header is fully inert — proven directly (AC2): a request supplying one tenant via the real identity mechanism and a different tenant via `X-Tenant-Id` returns only the real tenant's data.

**Test-harness mechanism decided with Menno's explicit sign-off, per ADR-0033's own flagged Open Question asking for exactly that before implementation:** a test-only auth bypass (`testAuthBypassMiddleware`), strictly gated to `NODE_ENV === 'test'` (Jest's own default), reading a JSON-encoded identity from a new `X-Test-Identity` header — chosen over locally-minted test JWTs because `resolveIdentity()` would additionally need a matching `users`/`platform_admins` row minted per test, real DB fixture setup for every affected test, not just a header swap. The six existing router-level contract tests that established tenant context via `X-Tenant-Id` (Stories 1.5, 1.6, 3.4, 4.1, 4.4, 5.1) were all reworked in this same commit — a real but far smaller set than ADR-0033's own conservative "~130+" estimate, since most of this project's suite calls store functions directly rather than through HTTP. Two of those files' AC8-11/AC1/AC5 tests ("missing `X-Tenant-Id` → 400") were rewritten to "missing Authorization/X-Test-Identity → 401" — a genuine behavior change, not just a mechanism swap, since rejection now happens once in the auth middleware rather than per-route — logged here with the dated in-file notes this project's "don't silently rewrite a passing contract" convention requires.

**A real regression was caught and fixed via `heal-contract-failure` during this story's own full-suite validation, folded into this same commit rather than logged separately** (nothing of Story 5.10 had been committed yet at the time it was caught, so there was no separate prior commit to "heal" against): the first implementation mounted the new auth middleware once, at the very top of the whole `/v1` router (`app.use('/v1', authMiddleware, v1Router)`), which broke Story 1.3's own contract requiring `/v1/health` to stay reachable with no credentials at all. Fixed by converting the static `v1Router` export into a `createV1Router(authMiddleware)` factory that mounts the middleware per-protected-sub-router instead, leaving `/health` exempt — zero changes to Story 1.3's own contract or any file it owns.

**A self-inflicted staging mistake, caught and corrected before this entry was written, not left in history unremarked:** the first attempt at this story's commit accidentally included only `docs/implementation-plan.md` (a failed multi-path `git add` invocation silently aborted before staging the rest) — caught immediately via `git show --stat`/`git diff-tree` verification against the actual intended file list, and corrected with `git commit --amend` before this log entry was ever written, since nothing had been pushed and nothing depended on the incomplete commit. The commit hash above is the corrected, complete one.

---

## 2026-08-01 (logged retroactively, 2026-08-03) — Story 1.6 — socialengage@58a9ebe

*Retroactive entry, per ADR-0034's own Context section, which found and flagged this exact gap this session: real code and a passing contract existed on disk for "Story 1.6" (Phase 1 "also build, not storied" connector connect/disconnect work), but `docs/implementation-log.md` had no corresponding entry at all — checked directly against `git log`, not assumed. ADR-0034 explicitly left closing this gap to "whoever picks this up" rather than closing it itself. Closed here, ahead of Story 1.7's own entry below, which supersedes this story's authorization/schema shape. Commit date (2026-08-01) taken from `git log`; log date is today, when the gap was actually closed — both stated, not conflated.*

- **Full commit:** `58a9ebe8b2bd72ae6e197a2226f44e415e17c146`
- **Repo:** socialengage (pre-split convention per Story 1.1's own entry — this commit touches only `social-listening-core/**` plus `docs/implementation-plan.md`, no separate repo exists yet)
- **Story / ADR:** 1.6 / — (Phase 1 "also build, not storied" work, no ADR of its own — see ADR-0034 §4.6 for why a story number was only formally assigned retroactively, alongside Story 1.7, at ADR-0034's own drafting)
- **Contract:** social-listening-core/contracts/epic-1/story-1.6.connector-connect-disconnect.contract.test.ts (8 assertions, AC0–AC7)
- **SKILL.md:** social-listening-core/.claude/skills/credential-envelope-encryption/SKILL.md (updated, not new)
- **Files touched:** docs/implementation-plan.md, social-listening-core/.claude/skills/credential-envelope-encryption/SKILL.md, social-listening-core/contracts/epic-1/story-1.6.connector-connect-disconnect.contract.test.ts, social-listening-core/src/credentials/credentialStore.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- **Full suite at merge:** not independently re-verified retroactively — trusted from the commit's own contents and this project's later full-suite runs (e.g. Story 5.6's own session), which included this contract passing alongside everything else, per `docs/implementation-log.md`'s own entries for those later stories

`POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect` — Phase 1's minimal connector CRUD, built against the `X-Tenant-Id` placeholder (pre-dating any real authentication or `users`/ownership-tier model) with no role or ownership check of any kind, exactly as `Business-Case-v6.0.md` §6's own dependency matrix anticipated ("could theoretically be built against the placeholder... not recommended," built anyway). **Fully superseded by Story 1.7 (ADR-0034, this same session) — see that entry below for the ownership-tier rework this story's own shape made necessary.** Logged here, retroactively, so the record of what actually shipped and when is complete before its own supersession is logged immediately after it — not skipped in favor of only logging the replacement.
