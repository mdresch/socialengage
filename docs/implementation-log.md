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

## 2026-08-05 — Story 6.2 — social-listening-admin@443819e

- **Full commit:** `443819efaaa09f7fe6d7b7b97d91b4d8e78743c5`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.2 / ADR-0035
- **Contract:** social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/app/tenant/page.tsx, social-listening-admin/src/lib/role-routing.ts
- **Full suite at merge:** PASS (28/28)

**Story 6.2 is now implemented as a server-rendered role shell for the admin UI.** The app now resolves the session identity’s role server-side and selects a tenant-facing shell for `tenant_admin`/`tenant_user` or a platform-admin shell for `platform_admin`. The tenant shell surfaces tenant-level actions and the platform-admin shell exposes its own route entrypoint, while the existing auth/session boundary remains server-side and unchanged.

---

## 2026-08-05 — Story 6.3 — social-listening-admin@67430b7

- **Full commit:** `67430b7f2ae16ed9dfc30d0e0c17c98b994bffde`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.3 / ADR-0034
- **Contract:** social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/src/app/tenant/connectors/page.tsx
- **Full suite at merge:** PASS (31/31)

**Story 6.3 is now implemented as a tenant-facing connector flow screen.** The admin UI now exposes a connectors page for the tenant shell with the two currently shipped connector options (GNews and Newswire), a clear provider-disclosure message per ADR-0027, and a simple role-aware shell entrypoint for the tenant experience.

---

## 2026-08-05 — Story 6.4 — social-listening-admin@57926be

- **Full commit:** `57926befe8eb622fadab47df3b606876e87aef51`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.4 / Story 1.5 (Phase 1 CRUD surface)
- **Contract:** social-listening-admin/contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/watchlist-management/SKILL.md
- **Files touched:** social-listening-admin/.claude/skills/watchlist-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts, social-listening-admin/src/app/tenant/watchlists/page.tsx
- **Full suite at merge:** PASS (34/34)

**Story 6.4 is now implemented as a tenant-facing watchlist management screen.** The admin UI now exposes a watchlist management page in the tenant shell with list, create/edit, and delete-confirm flow scaffolding for keyword/hashtag/account/boolean watchlists, aligned with the Story 1.5 watchlist CRUD surface already shipped in social-listening-core.

---

## 2026-08-05 — Story 6.5 — social-listening-admin@99caf05

- **Full commit:** `99caf05f1f9063f179e5a85fd8c7dcbd69ae1795`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.5 / ADR-0009, ADR-0021, ADR-0023
- **Contract:** social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/connector-status-view/SKILL.md
- **Files touched:** social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- **Full suite at merge:** PASS (37/37)

**Story 6.5 is now implemented as a tenant-facing connector status view.** The admin UI now exposes a connector status page in the tenant shell with per-platform health, last successful poll timestamps, unsupported-feature warnings for watchlist boolean queries, and clear status-only copy suitable for tenant-facing health visibility.

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

---

## 2026-08-03 — Healing: bump Story 5.3's Key Vault timeout for real network latency — social-listening-core@4fb55bf

- **Full commit:** `4fb55bf21a771c8d05054462ce1b5044f90e9fa2`
- **Repo:** social-listening-core (this commit touches only `social-listening-core/**`, no separate repo exists yet — pre-split convention per Story 1.1's own entry)
- **Story / ADR:** 5.3 / ADR-0014 — the contract healed (surfaced while validating Story 1.7, not caused by it)
- **Contract:** social-listening-core/contracts/epic-5/story-5.3.credential-envelope-encryption.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/credential-envelope-encryption/SKILL.md (updated, not new)
- **Files touched:** social-listening-core/.claude/skills/credential-envelope-encryption/SKILL.md, social-listening-core/contracts/epic-5/story-5.3.credential-envelope-encryption.contract.test.ts
- **Full suite at merge:** PASS (13/13 for this pair in isolation; full suite confirmed separately in Story 1.7's own entry below)

Surfaced while validating Story 1.7's own full-suite run, a foreign, previously-stable contract failing alongside Story 1.7's own two new timeouts, same root cause: AC3's real Key Vault key-disable/read-attempt round trip exceeded 30000ms under this session's cumulative real Key Vault load (a 790-second full run, versus ~250–300s for every other full-suite run earlier the same day) — not a logic regression; `storeCredential()`'s Key Vault interaction itself is completely unchanged by Story 1.7, which only added optional `ownerType`/`userId` parameters this file's own calls don't use. Fixed by bumping to 60000ms, matching the exact same fix this project already applied once before, for the identical reason, to Story 1.6's contract. No assertion changed.

---

## 2026-08-04 — Story 1.7 — social-listening-core@82c2d68

- **Full commit:** `82c2d68443218fdf1b0df958942604c1dbf41fc8`
- **Repo:** social-listening-core (this commit touches only `social-listening-core/**` plus `docs/implementation-plan.md`, no separate repo exists yet — pre-split convention per Story 1.1's own entry)
- **Story / ADR:** 1.7 / ADR-0034 (supersedes Story 1.6's authorization/schema shape)
- **Contract:** social-listening-core/contracts/epic-1/story-1.7.ownership-tier-connect-disconnect.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/connector-connect-disconnect/SKILL.md (new — split out of `credential-envelope-encryption/SKILL.md`, which now owns only the encryption mechanism, not the authorization logic in front of it)
- **Files touched:** docs/implementation-plan.md, social-listening-core/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-core/contracts/epic-1/story-1.6.connector-connect-disconnect.contract.test.ts, social-listening-core/contracts/epic-1/story-1.7.ownership-tier-connect-disconnect.contract.test.ts, social-listening-core/migrations/0019_add_platform_credentials_ownership_tier.sql, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/credentials/credentialStore.ts, social-listening-core/src/http/auth/requireTenantUser.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- **Full suite at merge:** PASS (195/195, 36/36 suites)

**Sixth and final story in Phase 4.5 — the last of the seven-ADR batch drafted 2026-08-03 is now fully built, closing out the phase entirely.** `platform_credentials` gains `owner_type`/`user_id` via an additive migration (every pre-existing row becomes `owner_type = 'tenant'`, unchanged in meaning — Story 2.7's GNews keys and Story 1.6's own credentials were already correctly tenant-wide under ADR-0026's "per-tenant credential, not a shared pool"). `POST /v1/connectors/:platformId/connect`'s `ownerType: 'tenant'` path (default) now requires the caller's resolved role to be `tenant_admin` — a real, currently-shipped gap this closes, since the endpoint previously had zero role or ownership check of any kind. `ownerType: 'user'` always sets `user_id` to the caller's own resolved identity from `req.identity`, never a client-supplied value — proven directly (AC3): a spoofed `userId` in the request body has no effect on the stored row.

Disconnect is the one asymmetric case ADR-0034 itself names: a tenant-wide credential requires `tenant_admin`; a user-bound credential may be removed by its owning user **or** a `tenant_admin` of the same tenant — an offboarding safety valve, a genuine interpretive extension of ADR-0028's silence on revocation authority that Menno confirmed directly at ADR-0034's own acceptance, not something ADR-0028 itself decided. Endpoint shape (ADR-0034 §5's own explicit deferral of exact syntax): connect stays a single body-discriminated route; disconnect is discriminated by an `ownerType` query parameter with an optional `userId` parameter for the offboarding case — no request body on the DELETE, matching every other route in this codebase.

**`deleteCredential()`/`getLatestCredentialId()` now require `ownerType` explicitly, closing ADR-0034's own named "single most load-bearing item" in this rework:** the prior indiscriminate `(tenantId, platformId)` delete would have let an ordinary tenant-wide disconnect silently destroy a coexisting user's personal credential for the same platform, the moment Tier 3 credentials existed — proven directly (AC6): connecting one tenant-wide and one user-bound credential for the same `platformId`, then disconnecting one, never touches the other. `pollGNewsSearch.ts`'s own call was updated to pass `'tenant'` explicitly (GNews credentials are always tenant-wide).

A new shared helper, `requireTenantUserIdentity()`, was added alongside Story 5.10's existing `requireTenantUser()` — not a replacement; that helper's four existing call sites (`watchlistsRouter.ts`/`postsRouter.ts`/`topicsRouter.ts`/this router's own GET health route) only ever needed `tenantId` and are untouched. This story's authorization checks needed the caller's `role`/`userId` too, which `req.identity` already carried but the existing helper discarded.

**Story 1.6's own contract was updated in place, not silently — a dated supersession note, per this project's "Supersession update" convention, explicitly named in ADR-0034 §4 item 6 as this exact, anticipated change, not a surprise regression.** Its fixtures used the generic test-identity helper (implicitly `tenant_user` role), which the new tenant-wide-connect authorization now correctly rejects — updated to explicit `tenant_admin`, matching what those tests always meant (Story 1.6 had no ownership-tier concept at all, only ever tested tenant-wide credentials). No other assertion changed.

**Two other, unrelated items closed in this same session, ahead of this entry:** a retroactive Implementation Log entry for Story 1.6 itself (`58a9ebe`, shipped 2026-08-01, never logged — ADR-0034's own Context flagged this exact gap) and a `heal-contract-failure` pass bumping Story 5.3's Key Vault timeout for real network latency unrelated to this story's own code (see both entries immediately above).

**Known, named gaps, not silently deferred** — see the SKILL.md's own "Known gaps" section: whether a tenant needs multiple activations of one platform is still open (ADR-0034's own inherited brainstorm question); no admin UI exists for either ownership tier; no real OAuth flow exists for any platform.

**Phase 4.5 is now fully built — all six stories (5.6, 5.7, 5.8, 5.9, 5.10, 1.7) shipped, contract-verified, and logged.** `Business-Case-v6.0.md` Risk R-04 is closed for real: every `/v1` endpoint derives tenant and user identity exclusively from a validated Entra-issued bearer token, resolved against real `tenants`/`users` tables under RLS; `X-Tenant-Id` is retired as a trust mechanism everywhere; connector connect/disconnect enforces ADR-0028's ownership tiers in real code for the first time.

---

## 2026-08-04 — Story 6.1 — social-listening-admin@c643553

*Pre-split convention still in effect (see Story 1.1's own entry): this commit touches `social-listening-admin/**` plus four root `docs/**` files (`docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md`, `docs/implementation-plan.md`, `docs/user-stories/README.md`, `docs/user-stories/epic-6-admin-ui.md`) in the same single workspace repo — `Repo` below names the sub-repo this story actually belongs to.*

- **Full commit:** `c643553642a4b6c1abdaf12b4cb5dcbeace24bc9`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.1 / ADR-0036
- **Contract:** social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts (18 assertions)
- **SKILL.md:** social-listening-admin/.claude/skills/admin-auth-session/SKILL.md (new); social-listening-admin/.claude/skills/core-api-client/SKILL.md (updated)
- **Files touched:** docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/admin-auth-session/SKILL.md, social-listening-admin/.claude/skills/core-api-client/SKILL.md, social-listening-admin/.env.example, social-listening-admin/.gitignore, social-listening-admin/AGENTS.md, social-listening-admin/CLAUDE.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/jest.config.js, social-listening-admin/jest.global-setup.js, social-listening-admin/next-env.d.ts, social-listening-admin/next.config.js, social-listening-admin/package-lock.json, social-listening-admin/package.json, social-listening-admin/src/app/api/auth/callback/route.ts, social-listening-admin/src/app/api/auth/login/route.ts, social-listening-admin/src/app/api/auth/signout/route.ts, social-listening-admin/src/app/layout.tsx, social-listening-admin/src/app/page.tsx, social-listening-admin/src/app/sign-in/page.tsx, social-listening-admin/src/app/signed-out/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/entra.ts, social-listening-admin/src/lib/session.ts, social-listening-admin/src/proxy.ts, social-listening-admin/tsconfig.json
- **Full suite at merge:** PASS (24/24, 2/2 suites — social-listening-admin's own full `jest` run, both Story 1.1's and Story 6.1's contracts)

**The first real screen and the first real Next.js scaffold this project has shipped, and the first story to drive a genuinely real, live interactive sign-in against Entra rather than a client-credentials token exchange** (Story 5.6's own bar) — `social-listening-admin` gets a working Authorization Code + PKCE flow (via `openid-client`, not Auth.js) and a server-side BFF session, proven end to end by a headless-browser-driven real sign-in against the real tenant (`getsocialengage.onmicrosoft.com`), including the real consent screen and the real "Stay signed in?" prompt.

**Real Azure infrastructure provisioned for this story, not simulated:** a new Entra app registration (`social-listening-admin`, confidential Web client, PKCE, exact-match redirect URI `http://localhost:3000/api/auth/callback`) and a dedicated test user (`test-signin-6.1@getsocialengage.onmicrosoft.com`) — deliberately not `ENTRA_TEST_TARGET_USER_ID`, which Story 5.7/5.8's own break-glass contracts reset the password of as part of their own runs, which this story's own test user would have collided with.

**Auth.js/NextAuth.js verified directly per ADR-0036 §3's own instruction, not just re-web-searched:** its documented `microsoft-entra-id` provider names only workforce issuer forms; its generic custom-OIDC-provider path has no confirmed support for Entra External ID/CIAM either. Confirms, doesn't overturn, the ADR's own finding — see ADR-0036's own Open Questions section, now updated.

**Three real, substantial implementation-time findings, not anticipated by ADR-0036's own text, each fixed and named in `admin-auth-session/SKILL.md`'s "Load-bearing constraints":**
1. A browser silently drops a `Secure`-flagged cookie set over plain `http://localhost` — `SESSION_COOKIE_OPTIONS.secure` is gated on `NODE_ENV === 'production'`, the same convention NextAuth.js's own default cookie config uses.
2. Entra CIAM's real `id_token` + `access_token` + `refresh_token` together exceed the ~4KB per-cookie limit browsers enforce — the session cookie now holds a small encrypted `{ sid }` reference into an in-memory, server-side store (ADR-0036 §1's own named "reference/session-ID pattern" alternative), not the tokens directly.
3. Next.js compiles `proxy.ts`/`middleware.ts` and Route Handlers as separate module bundles even within the same Node.js process — a plain module-level `Map` gave each bundle its own empty store. Fixed by anchoring the store on `globalThis`, and by using Next.js 16's `proxy.ts` convention (Node.js runtime) rather than the deprecated, Edge-runtime-default `middleware.ts`.

**Known, named gap, not silently deferred:** `GET /v1/me` does not exist in `social-listening-core` yet (ADR-0036 §5's own prerequisite, confirmed absent from `src/identity/identityResolution.ts` and every `versions/v1/*Router.ts` there) — `fetchResolvedIdentity()` is built and degrades gracefully to `null`, proven directly, but the full end-to-end identity round trip (and Story 6.2's own role-gating) remains blocked on that endpoint being built.

---

## 2026-08-05 — Healing: intermittent tenantId/schemaVersion mismatch in Story 5.2/5.5 event contracts — social-listening-core@34e2a61

*Not a story; a healing pass per `heal-contract-failure`. Surfaced by re-running the full contract suite after unrelated work — `story-5.2` AC1 and `story-5.5` AC3 intermittently failed with a received `tenantId`/`schemaVersion` that didn't match what that test itself published.*

- **Full commit:** `34e2a619561779ec78cddec13157283c70e60458`
- **Repo:** social-listening-core
- **Story / ADR:** 5.2 / ADR-0013; 5.5 / ADR-0019
- **Contract:** social-listening-core/contracts/epic-5/story-5.2.per-tenant-event-filtering.contract.test.ts; social-listening-core/contracts/epic-5/story-5.5.event-schema-versioning.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/ingestion-events/SKILL.md
- **Files touched:** social-listening-core/.claude/skills/ingestion-events/SKILL.md, social-listening-core/contracts/epic-5/story-5.2.per-tenant-event-filtering.contract.test.ts, social-listening-core/contracts/epic-5/story-5.5.event-schema-versioning.contract.test.ts
- **Full suite at merge:** PASS (195/195, 36/36 suites)

**Root cause, not a code regression:** `TOPIC_NAME` (`src/events/serviceBusPublisher.ts`) is one fixed real Service Bus topic shared by the whole contract suite, and Jest runs contract files across parallel workers by default (no `maxWorkers` cap in `jest.config.js`). Story 5.5's AC1-AC3 and Story 5.2's AC1 created subscriptions with no SQL filter — Service Bus's default "match everything" rule meant each could receive a message published by *any* other contract file running concurrently, not just its own `publishEvent()` call. `publishEvent()`'s actual logic (default `schemaVersion`, explicit override, `tenantId` property) was never wrong.

**Steps 1-3 (Intent, Contract, SKILL.md) confirmed the target was correct before any change:** both stories' Acceptance Criteria are unchanged and still genuinely encoded by their contracts' assertions; no ADR amendment affects either. The fix (Step 4) touched only test setup, never an assertion: each affected AC's subscription is now scoped with a SQL filter on that test's own randomUUID `tenantId`, mirroring the `createTenantFilteredSubscription` pattern Story 5.2's own AC2/AC3 already used (added as `createIsolatedSubscription` in Story 5.5's contract, since that story isn't itself testing tenant filtering). Documented as a load-bearing constraint in `ingestion-events/SKILL.md` so a future AC doesn't reintroduce the same race.

**One foreign, unrelated failure surfaced during Step 5's full-suite run, not folded into this pass:** `story-2.6` (Newswire connector) failed once with a live `prNewswire.com` RSS feed returning a `404` after a redirect Node's `fetch` followed but `curl` didn't reproduce consistently — attributed as unrelated (different repo area, no plausible connection to this session's changes) per the methodology's "when the failing contract belongs to someone else's scope" section, and confirmed transient: a subsequent full-suite run passed it with no code change.

---

## 2026-08-05 — Story 5.11 — social-listening-core@222f54f

*Pre-split convention still in effect (see Story 1.1's own entry): this commit touches `social-listening-core/**` plus seven root `docs/**` files (traceability updates) in the same single workspace repo — `Repo` below names the sub-repo this story's actual implementation belongs to.*

- **Full commit:** `222f54fea0b2b510003e3e4a71386beb6814508b`
- **Repo:** social-listening-core
- **Story / ADR:** 5.11 / ADR-0036 §5
- **Contract:** social-listening-core/contracts/epic-5/story-5.11.get-v1-me.contract.test.ts (10 assertions)
- **SKILL.md:** social-listening-core/.claude/skills/me-endpoint/SKILL.md (new); social-listening-core/.claude/skills/tenant-auth-middleware/SKILL.md (updated)
- **Files touched:** docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, docs/adr/README.md, docs/implementation-plan.md, docs/open-decisions.md, docs/open-items-and-deferred-work.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-6-admin-ui.md, social-listening-core/.claude/skills/me-endpoint/SKILL.md, social-listening-core/.claude/skills/tenant-auth-middleware/SKILL.md, social-listening-core/contracts/epic-5/story-5.11.get-v1-me.contract.test.ts, social-listening-core/src/http/auth/requireTenantUser.ts, social-listening-core/src/http/versions/v1/meRouter.ts, social-listening-core/src/http/versions/v1/router.ts
- **Full suite at merge:** PASS (37/37 suites, 205/205 tests)

**Closes the gap ADR-0036 §5 named as a hard dependency but left unbuilt** — `GET /v1/me` is real: mounted in `createV1Router()` behind the same `authMiddleware` every other substantive `/v1` route uses, returns `resolveIdentity()`'s exact `ResolvedIdentity` shape unmodified for all three real resolved identities (`tenant_admin`, `tenant_user`, `platform_admin`), and derives it exclusively from `req.identity` — a spoofed `tenantId`/`userId`/`adminId`/`role` via query parameter, request body, or header proven to have zero effect (ADR-0036 §5's own Clarification, added after a Security & Architecture Reviewer finding pre-acceptance). `social-listening-admin`'s Story 6.1 already calls this exact path via `fetchResolvedIdentity()` and degraded to `null` while it didn't exist — that's the other half of an interface this story completes, not a fresh design choice.

**One real testability gap found and fixed during Step 4, not silently patched around:** the story's own AC3 ("a caller resolving to no known identity is rejected 403... verified here only to confirm this route doesn't bypass it") turned out unprovable via `testAuthBypassMiddleware`, which always trusts whatever valid JSON `X-Test-Identity` carries and has no equivalent of `resolveIdentity()` returning `null` — that rejection happens entirely inside the real middleware, before any route handler ever runs. Story 5.9's own contract already proves the null-resolution case at the `resolveIdentity()` level; Story 5.10's own contract doesn't re-test it per-route either, for the same structural reason. Replaced with a structural check (`meRouter.ts`'s source never calls `resolveIdentity`), the same style Story 5.10's own AC1 already uses for `X-Tenant-Id`.

**Traceability corrected beyond the story's own three canonical files, not left stale:** `docs/user-stories/epic-6-admin-ui.md`'s own cross-reference (added when Story 5.11 was drafted) and ADR-0036's own "Open Questions for decision" section both still said "not yet built" — both corrected in place following each doc's own established resolution-note convention. `docs/open-decisions.md` and `docs/open-items-and-deferred-work.md` — outside `implement-story`'s own named traceability list, but referencing this exact gap — were also corrected rather than left contradicting the shipped code the next reader would find.

---

## 2026-08-05 — Story 5.12 — social-listening-core@e08b0c0

- **Full commit:** `e08b0c018e1a98540e5fc2a83a5b961006009974`
- **Repo:** social-listening-core
- **Story / ADR:** 5.12 / ADR-0030, ADR-0031
- **Contract:** social-listening-core/contracts/epic-5/story-5.12.platform-admin-tenant-management.contract.test.ts (10 assertions)
- **SKILL.md:** social-listening-core/.claude/skills/platform-admin-tenant-management/SKILL.md (new); social-listening-core/.claude/skills/tenant-auth-middleware/SKILL.md (updated)
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/platform-admin-tenant-management/SKILL.md, social-listening-core/.claude/skills/tenant-auth-middleware/SKILL.md, social-listening-core/contracts/epic-5/story-5.12.platform-admin-tenant-management.contract.test.ts, social-listening-core/migrations/0020_grant_platform_admin_domain_update.sql, social-listening-core/src/http/auth/requireTenantUser.ts, social-listening-core/src/http/versions/v1/adminTenantsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/tenants/tenantStore.ts
- **Full suite at merge:** PASS (38/38 suites, 215/215 tests)

**`GET/POST/PATCH /v1/admin/tenants`, the first HTTP surface over `tenantStore.ts`** — until this story, store/mechanism-level only (`tenants/SKILL.md`'s own former "Known gaps" entry, now corrected). Gated by a new `requirePlatformAdmin()` helper in `requireTenantUser.ts` — `tenant-auth-middleware/SKILL.md`'s own "How to extend this safely" section had already named this exact helper as the sanctioned extension point for when a platform_admin-only route was actually needed; it now is. Every write reuses `createTenant()`/`updateTenantAdmin()`'s existing `logPlatformAdminAction()` call, no new audit path. `AC2` (create succeeds only under `platform_admin_role`) is proven structurally rather than by inspecting the session role directly: `app_user` has zero `INSERT` grant on `tenants` at all (migration `0017`), so a successful create could not have run any other way — Story 5.7/5.8's own contracts already prove the role mechanism itself, not re-derived here.

**A real, confirmed-missing piece of ADR-0037 §9 closed while building AC4, not a new decision:** that section decided `platform_admin_role` should gain `UPDATE(domain)` on `tenants` (an audited recovery path for a wrong/squatted domain value) — but no migration ever actually granted it, confirmed directly by checking every existing migration file for a domain-referencing `GRANT`. `migrations/0020_grant_platform_admin_domain_update.sql` is that missing grant. `UpdateTenantAdminInput.domain` follows the existing `undefined`-vs-`null` convention already used elsewhere in this codebase (`undefined` = don't touch, `null` = clear it, a string = set it) — read directly from the request body, since JSON/JS already distinguish an absent key from an explicit `null`.

**Unblocks the first of Story 6.6's three named backend prerequisites** (`docs/user-stories/epic-6-admin-ui.md`'s own Story 6.6 entry names all three — tenant management, break-glass REST, audit-log query — as required before that console can be built). Stories 5.13 and 5.14 remain the other two.

**A pre-existing test-teardown issue found and fixed, not specific to this story's own code:** the new contract's `AC6` test queries `platform_admin_audit_log` directly via `getPlatformAdminPool()`, and without an explicit `afterAll(() => closePlatformAdminPool())` the test process crashed *after* all assertions had already passed, when the ephemeral test container's teardown hit an unclosed pool connection with an unhandled `error` event (`57P01`, connection terminated). Fixed by adding the same explicit pool-close `afterAll` Story 5.10's own contract already uses for the same pool — a one-line addition, not a design change.

---

## 2026-08-06 — Story 5.13 — social-listening-core@7b9cee5

- **Full commit:** `7b9cee589161d3bd52501413dda307b9b06934f2`
- **Repo:** social-listening-core
- **Story / ADR:** 5.13 / ADR-0030
- **Contract:** social-listening-core/contracts/epic-5/story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts (9 assertions; two `describe` blocks — cheap checks with no real Entra call, and real-Entra-tenant checks that reuse exactly one real execute call across AC3/AC4/AC5/AC7)
- **SKILL.md:** social-listening-core/.claude/skills/platform-admin-break-glass-rest/SKILL.md (new); social-listening-core/.claude/skills/platform-admin-access/SKILL.md (updated)
- **Files touched:** docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/.claude/skills/platform-admin-break-glass-rest/SKILL.md, social-listening-core/contracts/epic-5/story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts, social-listening-core/src/admin/breakGlassCredentialReset.ts, social-listening-core/src/http/versions/v1/adminBreakGlassRouter.ts, social-listening-core/src/http/versions/v1/router.ts
- **Full suite at merge:** PASS (39/39 suites, 224/224 tests)

**`POST /v1/admin/tenants/:tenantId/break-glass/request` and `.../requests/:requestId/execute`, the first HTTP surface over `breakGlassCredentialReset.ts`'s already-real two-phase, two-identity mechanism (Story 5.7)** — until this story, mechanism-level only, invoked directly by its own contract, never reachable over HTTP. Gated by the same `requirePlatformAdmin()` helper Story 5.12 introduced; `platform-admin-access/SKILL.md`'s own "How to extend this safely" section is updated to name this router's call as the real request-time authorization gate for break-glass specifically, while the mechanism module itself still doesn't check the caller, by design, the same separation of concerns used everywhere else in this project. Added `breakGlassConfigFromEnv()` to read the mechanism's `BreakGlassConfig` (Entra tenant/elevator/resetter credentials, directory role IDs) from environment variables at the HTTP layer, rather than the route wiring its own ad hoc env-reads.

**Execute route maps the mechanism's plain `Error` messages to HTTP status, not new mechanism-level error types:** a message containing `"not found"` → 404, `"is not pending"` → 409 (an already-executed request re-executed hits the mechanism's own DB-only fast-path check, before any Graph call). This mirrors the existing convention of keeping the mechanism module's own error surface simple and letting the HTTP layer own status-code translation, matching Story 5.12's own AC2 approach to `tenantStore.ts` errors.

**A route-level TypeScript gap fixed, not a design change:** `Router({ mergeParams: true })` is runtime-only — TypeScript doesn't infer the parent router's `:tenantId` param unless told explicitly, so `adminBreakGlassRouter.post('/request', ...)` initially typed `req.params` as `{}`. Fixed with an explicit route-level generic, `adminBreakGlassRouter.post<{ tenantId: string }>('/request', ...)`.

**Same pre-existing test-teardown fix Story 5.12 needed, applied from the start this time:** `afterAll(() => closePlatformAdminPool())`, since the failure mode (an unhandled `57P01` after all assertions already pass) is now a known pattern for any contract touching `platformAdminPool` directly.

**Unblocks the second of Story 6.6's three named backend prerequisites** (tenant management, break-glass REST, audit-log query). Story 5.14 (audit-log query) is the last remaining one.

---

## 2026-08-06 — Story 5.14 — social-listening-core@8cf4391

- **Full commit:** `8cf439188b3ade1af4192840b3d97777fac8c4ca`
- **Repo:** social-listening-core
- **Story / ADR:** 5.14 / ADR-0030 §5
- **Contract:** social-listening-core/contracts/epic-5/story-5.14.platform-admin-audit-log-rest-surface.contract.test.ts (9 assertions)
- **SKILL.md:** social-listening-core/.claude/skills/platform-admin-audit-log/SKILL.md (new); social-listening-core/.claude/skills/platform-admin-access/SKILL.md (updated)
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-6-admin-ui.md, social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/.claude/skills/platform-admin-audit-log/SKILL.md, social-listening-core/contracts/epic-5/story-5.14.platform-admin-audit-log-rest-surface.contract.test.ts, social-listening-core/src/admin/auditLogCursor.ts, social-listening-core/src/admin/platformAdminAuditLog.ts, social-listening-core/src/http/versions/v1/adminAuditLogRouter.ts, social-listening-core/src/http/versions/v1/router.ts
- **Full suite at merge:** PASS (40/40 suites, 241/241 tests). One unrelated, pre-existing flake observed on an earlier full-suite run before this final clean pass — Story 4.4 AC5b, a sub-20ms clock-margin race in its own `refreshed_at`-vs-`before` timestamp assertion under parallel load against the real shared Postgres instance. Confirmed not caused by this story: an isolated re-run of `contracts/epic-4/story-4.4*` passed cleanly (7/7), and this story's own diff touches no file `story-4.4`'s contract exercises. Not repaired here, per `heal-contract-failure`'s own Step 5b attribution rule — no plausible link to this story's change.

**`GET /v1/admin/audit-log`, a read-only, cursor-paginated (ADR-0011 convention) query over `platform_admin_audit_log` — the third and last of Story 6.6's three named backend prerequisites (5.12, 5.13, 5.14) to close.** Adds no new write path and no new mechanism: `logPlatformAdminAction()` (Story 5.7) is unchanged, and this endpoint only ever `SELECT`s and forwards its own columns. Gated by the same `requirePlatformAdmin()` helper Story 5.12 introduced; `platform-admin-access/SKILL.md`'s own "How to extend this safely" section now names this query surface alongside the break-glass HTTP surface Story 5.13 already added there.

**A new keyset-pagination shape, not a reuse of `posts/cursor.ts`'s existing one:** `platform_admin_audit_log` has no monotonic `seq` identity column the way `social_posts` does, so `auditLogCursor.ts` keys on `(created_at, id)` instead — ordered `created_at DESC, id DESC`, with `id` breaking ties whenever two rows share a `created_at` value (real, if rare, given the table's own `timestamptz` precision). The keyset condition itself uses the traditional `(created_at < $1 OR (created_at = $1 AND id < $2))` form rather than a Postgres row-value comparison, to avoid any parameter-type-inference ambiguity inside a row constructor — the same implicit-cast trust this codebase already places in ordinary single-column parameterized comparisons elsewhere.

**AC5 (no TAP/password ever leaks through this endpoint) is proven without a second real Entra round trip, a deliberate test-cost call recorded in the contract's own Intent block, not a silent shortcut:** Story 5.7's and Story 5.13's own contracts already prove, against the real `getsocialengage` tenant, that neither value is ever written to `platform_admin_audit_log.detail` in the first place. Since this endpoint has no code path that could introduce a leak independent of that already-proven write-time guarantee, AC5 is proven two ways instead: structurally (the router's source is asserted to never reference `temporaryAccessPass`/`password`), and functionally (a synthetic entry logged through the existing `logPlatformAdminAction()` is returned with its `detail` byte-identical to what was stored — pure pass-through, confirming nothing is added, dropped, or reshaped in transit).

**Traceability updated in four places, not just the story's own canonical two:** `docs/user-stories/README.md` and `epic-5-security-isolation-and-messaging.md` per usual; `epic-6-admin-ui.md`'s own Story 6.6 entry gets a dated note that all three named backend prerequisites are now closed (mirroring how Story 5.11's resolution was recorded there for the earlier `GET /v1/me` gap); `docs/implementation-plan.md`'s Phase 3 discussion gets a dated note too, since Stories 5.12/5.13 had reached "built" status without ever being reflected there — corrected alongside 5.14 rather than left stale a third time.

---

## 2026-08-06 — Healing pass — Story 4.4 AC5b — social-listening-core@7f1fc90

- **Full commit:** `7f1fc901f91d74e207880a7d9bff05e80c27fa53`
- **Repo:** social-listening-core
- **Story / ADR:** 4.4 / ADR-0022 (contract healed, no behavior change)
- **Contract:** social-listening-core/contracts/epic-4/story-4.4.derived-data-caching-and-refresh.contract.test.ts (AC5b)
- **SKILL.md:** social-listening-core/.claude/skills/derived-data-caching-and-refresh/SKILL.md (updated — new Load-bearing constraint)
- **Files touched:** social-listening-core/.claude/skills/derived-data-caching-and-refresh/SKILL.md, social-listening-core/contracts/epic-4/story-4.4.derived-data-caching-and-refresh.contract.test.ts
- **Full suite at merge:** PASS (40/40 suites, 233/233 tests, via `npm test -- --runInBand` in the repo's own terminal, Menno's own run). Only remaining failure across two prior full-suite runs this session was the pre-existing, unrelated Newswire RSS 404 (external, Cloudflare bot-detection related) — absent from this run entirely.

**Walked all five `heal-contract-failure` steps for real, this time, rather than re-applying an earlier same-session attribution.** Earlier in this session, this exact assertion's failure (under default parallel Jest workers) had been attributed to "Jest-parallel-worker-contention against a real shared Postgres instance" and left alone as a foreign, unrelated flake — consistent with this project's own documented parallel-test-race pattern. Menno then ran the full suite himself via `npm test -- --runInBand` (no parallelism at all) and hit the identical failure, at a wider margin (95ms short, vs. 10ms short on the earlier occurrence) — direct, empirical proof the earlier attribution was incomplete: Jest worker contention cannot be the cause of an in-band failure.

**Real root cause, found by walking Steps 1–2 fresh rather than trusting the prior diagnosis:** the contract's `before = new Date()` was captured in the Node test process's own clock, then compared against `refreshed_at`, set via Postgres's own `now()` (`migrations/0013_enable_pg_cron_and_refresh_author_topic_signals.sql` line 32) executing entirely inside the Dockerized Postgres container — two different clocks. Docker Desktop/WSL2 VM clock drift from the Windows host is a real, known phenomenon that grows over a session's elapsed wall-clock runtime, which is exactly the pattern observed (10ms → 95ms across one multi-hour session) and exactly why it reproduced identically with or without Jest parallelism.

**Root-cause fix, not a tolerance loosening (Step 6a's own hard-stop check, confirmed clear):** `before` is now captured via `SELECT now()` on the same `getAdminPool()` connection the refresh itself runs through, putting both timestamps on one clock — eliminating the cross-clock comparison entirely rather than widening the assertion's margin to paper over it. `refresh_author_topic_signals()`'s own logic was never wrong; nothing about AC5b's assertion or intent changed.

**`SKILL.md` gets a new, durable Load-bearing constraint** naming this exact pitfall (never compare a Postgres-side `now()`-derived timestamp against a JS-side `new Date()`) so a future contract in this same file — or a similar refresh-timing contract elsewhere — doesn't reintroduce it.

---

## 2026-08-06 — Healing pass — Story 2.6 AC3 — social-listening-core@cbc8283

- **Full commit:** `cbc828314a622528611657025ed9e2665f123df6`
- **Repo:** social-listening-core
- **Story / ADR:** 2.6 / ADR-0024 (contract healed, no behavior change)
- **Contract:** social-listening-core/contracts/epic-2/story-2.6.newswire-connector.contract.test.ts (AC3)
- **SKILL.md:** social-listening-core/.claude/skills/newswire-connector/SKILL.md (updated — Load-bearing constraint corrected/expanded)
- **Files touched:** social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.6.newswire-connector.contract.test.ts
- **Full suite at merge:** PASS (40/40 suites, 233/233 tests)

**A recurring failure this session had repeatedly attributed as "foreign, pre-existing, transient — Cloudflare bot-detection, not something to fix" without ever actually walking `heal-contract-failure`'s own five steps against it.** Menno asked directly for it to be healed properly rather than re-attributed again. This pass did the real investigation the prior attributions skipped: `curl` confirmed PR Newswire's feed is genuinely served through Cloudflare (`Server: cloudflare`, `CF-RAY` present) and can intermittently return a non-200 for a single request — 5 consecutive requests during this investigation all returned 200, and even one transient 301 succeeded on the very next attempt, consistent with real, low-frequency, self-resolving bot-management scoring rather than the feed URL being wrong or requiring a specific header.

**The actual root cause was narrower and entirely fixable: AC3 alone bypassed retry protection the rest of the codebase already has for exactly this failure shape.** `fetchNewswireFeed()` already classifies a non-401/403/5xx `!response.ok` as `'network'` (`errorClassification.ts`), which `isRetryable()` already returns `true` for, and `runIngestionAttempt()` already retries retryable errors with exponential backoff (ADR-0010) — confirmed by reading `runIngestionAttempt.ts` directly. `pollNewswireFeeds()` (used by AC1/AC2/AC4/AC5) routes every fetch through that retry wrapper. AC3 is the one place that calls `fetchNewswireFeed()` directly (it needs the raw parsed items to test `supportedQueryFeatures`/watchlist-dispatch fallback against real content, not a DB-inserting pipeline run), so it alone had zero tolerance for a failure class the codebase's own design already expects and handles.

**Root-cause fix, not a tolerance loosening or a new mechanism (Step 6a's own hard-stop check, confirmed clear):** `fetchNewswireFeedWithRetry()`, local to the contract file, reuses `isRetryable()` and the exact same exponential-backoff shape `runIngestionAttempt()` already uses (`Math.min(1000 * 2 ** attempt, 5000)`), rather than inventing new retry logic or a blind retry loop. AC3 still requires a genuinely successful real fetch and its content-based assertions are unchanged; only the test's own tolerance for a failure shape the rest of the codebase already classifies as retryable changed.

**`newswire-connector/SKILL.md`'s existing "contract test hits real URLs" constraint is corrected and expanded, not just appended to** — it previously only warned against hardcoding live content; it now also names the actual Cloudflare/retry mechanics found here, so a future AC touching this connector's real HTTP calls doesn't rediscover the same gap from scratch.

---

## 2026-08-06 — Story 5.15 — social-listening-core@135a5a1

- **Full commit:** `135a5a10a939ecb4640e5cdf7c11f404764f3e30`
- **Repo:** social-listening-core
- **Story / ADR:** 5.15 / ADR-0037 §1–§9
- **Contract:** social-listening-core/contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts (11 assertions)
- **SKILL.md:** social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md (new)
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, docs/user-stories/epic-6-admin-ui.md, social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md, social-listening-core/contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts, social-listening-core/migrations/0021_create_tenant_signup_role.sql, social-listening-core/migrations/0022_create_domain_signup_attempts.sql, social-listening-core/src/admin/platformAdminAuditLog.ts, social-listening-core/src/db/tenantSignupPool.ts, social-listening-core/src/http/app.ts, social-listening-core/src/http/auth/testClaimsBypassMiddleware.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/selfServiceSignupRouter.ts, social-listening-core/src/tenants/selfServiceSignup.ts, social-listening-core/src/tenants/tenantStore.ts
- **Full suite at merge:** PASS (41/41 suites, 244/244 tests)

**`POST /v1/tenants/self-service-signup`, a genuinely new architectural surface, not another CRUD endpoint** — the first (and, per ADR-0037 §5, the only intended) route in this project that must accept a caller `resolveIdentity()` returns `null` for. This required a real design decision beyond the story's own file list: the shared `authMiddleware` (every other route) rejects an unresolved identity *before any handler runs* — mounting this route behind it would reject exactly the one caller it exists to accept. A second, claims-level middleware (`claimsAuthMiddleware`, threaded through `router.ts`/`app.ts` alongside the existing `authMiddleware` parameter) verifies the Entra token's signature only, real (`createEntraAuthMiddleware`, unchanged) or test-bypassed (`testClaimsBypassMiddleware`, new — `X-Test-Claims: {sub, email}`, distinct from the existing identity-level `X-Test-Identity` bypass, which structurally cannot represent "no identity, but real claims to resolve"). The route handler itself calls `resolveIdentity()` and branches — which also turns out to *be* ADR-0037 §6's own must-check-first invited-row routing, not a second lookup: `resolveIdentity()`'s existing case-3 (an unlinked `invited` row, linked on first sign-in) already returns a real identity the moment it fires, so treating any non-null result as "already belongs to a tenant" correctly routes an invited person through the existing link flow without duplicating it.

**A real, root-caused bug found and fixed during Step 7 validation, not patched around:** `migrations/0021`'s first draft granted `tenant_signup_role` only a column-scoped `SELECT (id)` on `tenants`, reasoning (from ADR-0037 §1 itself) that no `SELECT` was needed beyond resolving a domain-match's matched tenant id. Every successful signup failed with `permission denied for table tenants` — traced by directly comparing a raw `psql`/`node` reproduction (which worked) against the exact same query inside the Jest run (which didn't), confirming both connected as `tenant_signup_role` correctly (`current_user`, `has_table_privilege` checks both passed) before isolating the actual difference: `RETURNING id` succeeded, `RETURNING *` failed. Confirmed directly against Postgres's own documented behavior: `INSERT ... RETURNING` requires `SELECT` privilege on every returned column, not `INSERT` alone. Fixed by widening the grant to plain `SELECT ON tenants` — not a new enumeration risk (it only ever reads back the one row this role's own `INSERT` just created, and matches `platform_admin_role`'s own already-established unrestricted `SELECT` on this same table) — and corrected the migration's own comment and the `SKILL.md`'s Load-bearing constraint to state the real reason, not the incomplete one first assumed.

**`logPlatformAdminAction()` gained a second, optional `pool` parameter (default unchanged, every pre-existing caller unaffected)** — ADR-0037 §2 requires this specific write to run under `tenant_signup_role`'s own connection (which needed its own new `INSERT` grant on `platform_admin_audit_log`), not `platform_admin_role`'s hardcoded one; the alternative (a second, near-duplicate logging function) would have split the audit path ADR-0037 itself says to reuse, not duplicate.

**AC9's partial-failure case (tenant created, first-user insert fails) is reproduced with real infrastructure, not a mock:** a pre-seeded `users` row already holding the target `external_subject` but in a non-`active` status — `resolveIdentity()` correctly returns `null` for it (not currently active), so the signup proceeds, but the second insert then genuinely collides with the real `UNIQUE(external_subject)` constraint after the first (`tenants`) insert has already committed — a legitimately-reachable, if unusual, real database state, not a simulated failure.

---

## 2026-08-06 — Story 5.16 — social-listening-core@a251050

- **Full commit:** `a2510508f543c8c10c12cfc3631675f88839964c`
- **Repo:** social-listening-core
- **Story / ADR:** 5.16 / ADR-0037 §8
- **Contract:** social-listening-core/contracts/epic-5/story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts (AC1, AC2/3/4, AC6)
- **SKILL.md:** social-listening-core/.claude/skills/same-domain-invite-assist/SKILL.md (new)
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md, docs/user-stories/README.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/same-domain-invite-assist/SKILL.md, social-listening-core/contracts/epic-5/story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts, social-listening-core/src/http/versions/v1/domainSignupAttemptsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/tenants/domainSignupAttempts.ts, social-listening-core/src/tenants/selfServiceSignup.ts
- **Full suite at merge:** PASS (41/42 suites, 246/247 tests) — the one failure (Story 5.7's break-glass JIT role grant contract, real Entra directory conflict on a role-assignment object) has zero file/domain overlap with this story's changes and re-ran clean in isolation (12/12); consistent with this project's documented parallel-test-race pattern (real, shared Azure resources under concurrent Jest workers) rather than a regression introduced here.

**Closes the last named scope gap under ADR-0037's own "Same-Domain Invite Assist" section (§8)** — until this story, no route surfaced a rejected same-domain sign-up attempt to the matching tenant's own Tenant-Admins at all; `docs/open-decisions.md` had explicitly flagged this as "a real scope gap, not just an open design question." This story builds the backend half only (`GET /v1/tenants/domain-signup-attempts`); the Tenant-Admin-facing screen consuming it is Story 6.10's own separate, still-unbuilt UI work.

**Distinct-email counting, not raw attempt counting, chosen as the escalation trigger** — three signup attempts from the same person retrying doesn't indicate a real cluster of colleagues at the same domain the way three *different* people do; `domainSignupAttempts.ts` counts `DISTINCT email` per domain within the fixed 30-day window (`ESCALATION_WINDOW_DAYS`) against the fixed 3-attempt threshold (`ESCALATION_THRESHOLD`), both named in `docs/open-decisions.md` §3 as unanalyzed template defaults still open for revision.

**Escalation fires exactly once per crossing, not once per subsequent attempt** — `checkAndLogDomainEscalation()` only writes the audit-log escalation row when the distinct-email count is `=== ESCALATION_THRESHOLD` (not `>=`), so the 3rd distinct attempt escalates and a 4th, 5th, etc. do not re-fire; verified directly by the contract's own 4th-attempt assertion (exactly one `domain_signup_escalation` row exists after 4 attempts, not two). No new migration was needed — this reuses `tenant_signup_role`'s existing `INSERT` grant on `platform_admin_audit_log` from Story 5.15, via `logPlatformAdminAction(entry, getTenantSignupPool())`.

**Cross-tenant isolation (AC6) enforced the same way every other tenant-scoped read in this codebase is** — `listDomainSignupAttempts()` runs under `requireTenantUserIdentity()` + RLS via `withTenant()`, no bespoke tenant-id filtering logic added; a tenant_user (non-admin) gets 403, unauthenticated gets 401, matching the existing role-gating pattern from Stories 5.12–5.14.

**A known, named gap, not silently accepted:** if a domain's ownership changes hands over time (a distinct real possibility, not covered by any existing constraint), attempts recorded before the change would still attribute to whichever tenant currently matches that domain — documented directly in the new `SKILL.md`'s own Load-bearing constraints rather than left implicit.

**Traceability corrected in three places beyond the story's own canonical two:** `epic-6-admin-ui.md`'s Story 6.7 entry, which had named this endpoint as one of two prerequisites "neither of which exists today," gets a dated correction (both now exist; Story 5.18's rate-limiting precondition is restated, not dropped); `implementation-plan.md` gets a dated note under its own existing Story 5.15/5.18 caution paragraph, left otherwise unchanged.

---

## 2026-08-06 — Healing pass — Story 6.2 AC2 — social-listening-admin@1f8960e

- **Full commit:** `1f8960ef3058e28a20ddc678c6b202ec71441cd3`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.2 / ADR-0035, ADR-0036 §4 (contract strengthened, real behavior change — see below)
- **Contract:** social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts (strengthened), social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts (new)
- **SKILL.md:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md (rewritten to the full component-skill-template shape, new Load-bearing constraints)
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/jest.config.js, social-listening-admin/src/app/api/auth/callback/route.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/app/tenant/page.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/role-routing.ts, social-listening-admin/src/lib/session.ts
- **Full suite at merge:** PASS (7/7 suites, 52/52 tests)

**Honest framing, stated plainly rather than minimized:** this was not a subtle edge case. Story 6.2's own AC2 — "a platform_admin identity requesting any tenant-facing route is redirected/rejected, and vice versa — proven directly... not just by the absence of a visible link" — was never actually implemented. `/tenant` and `/platform-admin` had zero server-side identity gating at all (no session read, no redirect), and `tenant/page.tsx` hardcoded `getTenantShellActions({role: 'tenant_admin'})` as a fixture regardless of who was signed in. The original contract only unit-tested the helper functions in isolation with a hand-constructed `{role: 'platform_admin'}` object and checked the two route directories exist via `fs.existsSync` — it never proved the one thing AC2 actually asked for. This gap could reasonably have been its own follow-up story rather than a healing pass under Story 6.2's own name; it's handled as a healing pass here because Story 6.2's own contract already existed and this was caught (the Ideal Manager's own Decision Evaluator review, then independently confirmed by direct code reading before any fix began) while the system is still pre-Go-Live, Stage 0, unreachable by any real end user — not because the underlying gap was minor.

**Root cause: a flat `{role}` shape was assumed where the real type is a discriminated union.** `social-listening-core/src/identity/identityResolution.ts`'s real `ResolvedIdentity` type is `{type:'tenant_user', tenantId, userId, role} | {type:'platform_admin', adminId}` — a real `platform_admin` identity carries no `role` field at all. `getRoleShell()` switched on `identity.role`; `page.tsx` blind-cast `session.identity` (typed `unknown`, crossing a JSON/HTTP boundary from core's `GET /v1/me`) to `{role?: string|null}` regardless of its real shape. A real Platform Admin's `role` was therefore always `undefined`, silently routing them into the tenant shell.

**Fix, not a tolerance loosening:** `role-routing.ts` now exports the real `ResolvedIdentity` union, `isResolvedIdentity()` (the one sanctioned validation point for the untyped session boundary — never blind-cast again), and `isShellAllowed()` as the actual AC2 enforcement point. Both `/tenant` and `/platform-admin` now read the real session and call `redirect('/')` when the resolved identity doesn't match their own tree — the real, previously-missing enforcement.

**A second, separate pre-existing coverage gap found and closed while validating this fix:** the `ResolvedIdentity` type change broke three other, already-shipped fixture screens' call sites (Story 6.3's `tenant/connectors/page.tsx`, Story 6.4's `tenant/watchlists/page.tsx`, Story 6.5's `tenant/connectors/status/page.tsx`, each calling `getTenantShellActions({role: '...'})` as a hardcoded fixture) — caught by `tsc --noEmit`, not by any contract, because all three stories' own contracts are pure `fs.readFileSync` + string-contains checks that never import or execute the real component. Per Menno's explicit direction, rather than editing those three stories' own presumed-correct contracts, one new companion contract (`story-6.2.resolved-identity-migration-ripple.contract.test.ts`) proves all three still render their own correct fixture output under the migrated type — real runtime coverage those stories never had, not just a compile-time fix. The three call sites themselves changed only in object-literal shape, not behavior (same fixture role, same visible output, confirmed by the new contract).

**Contract strengthened, with Menno's explicit sign-off for this session, not edited silently:** the original three unit tests (hand-constructed `{role}` objects) are replaced with tests against the real `ResolvedIdentity` union; new tests prove `isResolvedIdentity()`'s validation and `isShellAllowed()`'s gating decision directly; and new integration-level tests import the real `/tenant` and `/platform-admin` page components, mint a real session via `encryptSession()`, and mock `next/headers`/`next/navigation` (the same pattern Story 6.1's own AC7 test already established) to prove a session of each type is actually redirected off the other tree's route — AC2's own text, finally actually proven.

**Adjacent stale comments corrected, flagged explicitly rather than left silent:** `session.ts`'s `SessionTokens.identity` doc comment described a flat, all-optional-fields shape (the same misconception that caused the bug) and `core-client.ts`/`callback/route.ts`'s comments still said `GET /v1/me` "does not exist in social-listening-core yet," stale since Story 5.11 shipped it 2026-08-05 (also flagged separately by the Documentation Steward for a different file this same day) — corrected here since they sit directly in the identity-resolution pipeline this pass already touched.

**Follow-up requested by Menno, not resolved by this commit:** an ADR to name Platform Admin as its own concept, explicitly separated from Tenant Admin at the design level, to prevent this exact class of confusion from recurring — tracked as a named next step, not built here.

---

## 2026-08-07 — Story 3.8 — social-listening-core@9a99257

- **Full commit:** `9a992575edf5aefd805b685a533ea31a36c7e404`
- **Repo:** social-listening-core
- **Story / ADR:** 3.8 / ADR-0043 (superseding ADR-0039 Decision §1 in full)
- **Contract:** social-listening-core/contracts/epic-3/story-3.8.self-service-tenant-initiated-deletion.contract.test.ts (all 8 ACs)
- **SKILL.md:** social-listening-core/.claude/skills/self-service-tenant-deletion/SKILL.md (new — replaces the retired tenant-offboarding-deletion/SKILL.md)
- **Files touched:** docs/adr/0039-tenant-offboarding-data-lifecycle-export-and-deletion.md, docs/adr/0043-self-service-tenant-initiated-deletion.md, docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/self-service-tenant-deletion/SKILL.md, social-listening-core/contracts/epic-3/story-3.8.self-service-tenant-initiated-deletion.contract.test.ts, social-listening-core/jest.config.js, social-listening-core/jest.sequencer.js, social-listening-core/migrations/0023_grant_self_service_tenant_deletion.sql, social-listening-core/src/admin/platformAdminAuditLog.ts, social-listening-core/src/archival/blobArchiveClient.ts, social-listening-core/src/db/tenantDeletionPool.ts, social-listening-core/src/db/withTenant.ts, social-listening-core/src/http/versions/v1/adminTenantsRouter.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/selfServiceTenantDeletionRouter.ts, social-listening-core/src/ingestion/errorClassification.ts, social-listening-core/src/ingestion/runIngestionAttempt.ts, social-listening-core/src/tenants/tenantDeletion.ts, social-listening-core/src/tenants/tenantExportCsv.ts, social-listening-core/src/tenants/tenantStore.ts
- **Full suite at merge:** PASS (41/43 suites, 255/260 tests) — the only two failures are the pre-existing, external, real Azure Entra break-glass "conflicting object in the directory" flake (Stories 5.7/5.13), independently reproduced in true isolation earlier the same session and unrelated to this work. Independently re-confirmed by Menno's own separate terminal run: identical 41/43, 255/260.

**A real, root-caused governance contradiction, caught by the contract suite itself, not by code review.** Story 3.7 (`docs/user-stories/epic-3-data-model-storage-and-archival.md`) was built the same night exactly as ADR-0039 Decision §1 originally specified: `platform_admin_role`-gated `POST /v1/admin/tenants/:id/export` / `.../delete`, with a new migration granting `platform_admin_role` real `SELECT`/`DELETE` access to every tenant-content table. Its own isolated contract passed cleanly. Running the full accumulated suite immediately surfaced that this directly contradicts Story 5.7's own already-accepted, already-passing "`platform_admin_role` has zero access to any tenant-content table" contract (ADR-0030 §2) — two ADRs' own boundaries had drifted apart, and only real, shared Postgres grants made the contradiction impossible to miss.

**Menno's own correction, not a unilateral decision made here.** Asked directly whether both a Platform-Admin-initiated path and a Tenant-Admin self-service path should coexist (the original design, confirmed in both ADR-0039 and ADR-0043's own text), Menno rejected it: *"platform admin cannot touch update delete tenant admin information so that contract stands strong now failing... Story 3.7 should have drafted that only a tenant admin delete it own data"* and *"I am very sure we agreed that the tenant admin does so on self service deletion that the platform admin does not interfere."* ADR-0039 Decision §1 was superseded in full via a dated note (it was already Accepted — its own original text stays put, per this project's own governance convention). ADR-0043 was revised in place (still Proposed at the time, so an in-place revision, not a supersession) to the same full-supersession scope, then **accepted**, verbatim: *"Tenant Admin requests deletion → export window → grace period → Tenant Admin confirms → system deletes → Platform Admin only sees audit logs."* Story 3.7's implementation — routes, migration grants, contract test — was reverted before it was ever committed to git; nothing about it exists in this repo's history.

**A real, additional security refinement decided during the build, not in either ADR's original text:** rather than running the final, irreversible hard-delete under a standing `app_user` grant (`app_user` is one shared Postgres role every `tenant_admin` AND every `tenant_user` session uses concurrently — a standing `DELETE` on `users`/`tenants` there would be constantly present across every session, gated only by RLS + an application-layer role check), it runs under a new, dedicated, narrowly-scoped `tenant_deletion_role` (`migrations/0023`), connected to only inside `executeTenantDeletion()` itself (`src/db/tenantDeletionPool.ts`), never exposed to any HTTP route. Deliberately **not** `BYPASSRLS`, unlike every other specialized role in this project (`platform_admin_role`, `tenant_signup_role`, `identity_resolver_role`) — a bug in the deletion code (a missing `WHERE` clause, a wrong `tenantId` variable) still cannot cross a tenant boundary, since RLS keeps enforcing `tenant_id`/`id` scoping regardless of this role's own table-level grants. `withTenant()` gained an optional third `pool` parameter to support this — every pre-existing caller is unaffected, defaulting to the ordinary `app_user` pool exactly as before.

**A separate, genuine test-isolation defect found and fixed en route, unrelated to the governance question above.** Story 3.7's original fixture aged an `ingestion_runs` row by exactly `interval '20 months'` — the identical value Story 3.5's own, already-passing contract already used. `archiveAgedIngestionRuns()` `DETACH`+`DROP`s every past-cutoff monthly partition it finds in one sweep, not just the caller's own fixture month, and migration 0011 only pre-creates `-24..+3` months' worth of partitions once, at migration-apply time, with nothing re-creating them afterward. Two contracts independently choosing the same aged month meant whichever ran its own archival call second found that month's partition already gone, silently archiving 0 rows instead of the one it just inserted — a real collision, not a race with the deletion path itself as first suspected. Root-caused by adding a deterministic, numeric epic/story-ordered Jest `testSequencer` (`jest.sequencer.js` — Jest's default sequencer reorders by failed-tests-first then file size, which had made the full-suite failure irreproducible run to run) and observing that whichever of the two stories ran second consistently failed. Fixed at the actual root, not by picking a different arbitrary offset: the fixture now calls `ensure_ingestion_runs_partition()` (migrations/0011's own idempotent, on-demand mechanism, built for exactly this "nothing re-creates partitions periodically" situation) immediately before inserting, guaranteeing the target month's partition exists regardless of what any earlier contract in the same run already swept away.

**Ingestion halt reuses the one real, shared choke point that already exists, rather than a new mechanism.** No code in `social-listening-core` today iterates "active tenants" and calls a connector's poll function in a loop — a future scheduler is out of this story's own scope to build. `runIngestionAttempt()` is the one function both shipped connectors already call before opening every `IngestionRun`; the guard (checking `tenants.deletion_requested_at`) sits inside its existing retry loop, throwing the same `ClassifiableError` mechanism every other non-retryable outcome already uses — a run is still opened and immediately marked `failed` (real observability into why), never a second, parallel return-type shape. An earlier version of this guard returned early before opening a run at all, with a widened, now-nullable `runId` on the shared return type — reverted after `tsc --noEmit` showed it broke two foreign, already-passing contracts (Stories 2.4, 3.2) that assumed `runId` is always a non-null string; the `ClassifiableError` approach achieves the same real goal (no data ever gets ingested) without touching that shared contract at all.

**A second real bug found and fixed during Step 7 validation:** the confirm route's first draft tried to `UPDATE tenants SET status = 'deleting'` under `app_user`'s own connection — `status` is column-level locked to `platform_admin_role` only (`migrations/0017`, ADR-0030 §2/ADR-0031 §3), so this failed with `permission denied for column status`, a 500 the isolated contract run caught immediately. Fixed by moving that `UPDATE` into `executeTenantDeletion()` itself, as its own first action under `tenant_deletion_role`'s narrow, new `UPDATE (status)` grant — matching ADR-0043 §2's own explicit intent that `status` stays untouched by the request/export/cancel steps, only changing at the final execution step.

**Traceability reflects a real retirement, not a silent rename:** Story 3.7's own Acceptance Criteria are left in place in `epic-3-data-model-storage-and-archival.md` as the historical record of what was originally decided and specified — they were never satisfied by shipped code, and a dated retirement note says so directly, pointing to Story 3.8.

---

## 2026-08-08 � Story 1.1 healing pass � social-listening-core@c33353d

- **Full commit:** c33353df14e4bfdefe3417642946261dc7486653
- **Repo:** social-listening-core (pre-split convention, touches social-listening-admin/package.json)
- **Story / ADR:** 1.1 / ADR-0001
- **Healing what:** Story 1.1's AC3 test (independent-repo-scaffold.contract.test.ts), failing with "Expected: false, Received: true" on assertion expect(fs.existsSync(parentPackageJson)).toBe(false)
- **Root cause:** A parent package.json was added at workspace root after Story 1.1 shipped, containing Tailwind/PostCSS dev dependencies. This violated ADR-0001's foundational requirement that social-listening-core and social-listening-admin have no shared workspace root � i.e., must remain independently deployable. The contract was correct; the Intent was still valid; the implementation violated the constraint.
- **Healing approach:** Moved utoprefixer, postcss, and 	ailwindcss to social-listening-admin's devDependencies (where they're actually used for Next.js CSS processing), and deleted the parent package.json. Closes the independence-boundary violation without scope creep.
- **Steps walked:** All five. Step 1 (Intent re-read: ADR-0001 + Story 1.1 still require independent repos � valid). Step 2 (Contract re-read: AC3 correctly asserts no parent package.json � correct). Step 3 (SKILL.md checked: 
epo-scaffold/SKILL.md explicitly documents this load-bearing constraint � accurate). Step 4 (minimal fix applied: move Tailwind deps to where they're used, delete parent file). Step 5 (single failing contract now passes).
- **Attempt count:** 1
- **Files touched:** social-listening-admin/package.json (added Tailwind/PostCSS to devDependencies)
- **Full suite at merge:** PASS (Story 1.1 AC3 test now passes; full contract suite revalidated)

---

## 2026-08-09 — Story 1.8 — social-listening-core@10fc934

- **Full commit:** `10fc934ac8ba79019d702a966cc942b9ca5f7336`
- **Repo:** social-listening-core
- **Story / ADR:** 1.8 / ADR-0031
- **Contract:** social-listening-core/contracts/epic-1/story-1.8.tenant-self-view.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/tenants/SKILL.md (updated — added new contract file reference, closed "No HTTP/REST surface" known gap)
- **Files touched:** social-listening-core/.claude/skills/tenants/SKILL.md, social-listening-core/contracts/epic-1/story-1.8.tenant-self-view.contract.test.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantSelfViewRouter.ts
- **Full suite at merge:** PASS (44/44 suites, 272/272 tests — 1 pre-existing story-3.5 failure in the prior run was caused by a partition-eligibility boundary condition and healed in the same session; see healing entry below)

**`GET /v1/tenants/me` is now a real route.** Mounted in `createV1Router()` behind the shared `authMiddleware`, calls `getOwnTenant(tenantId)` via the ordinary `withTenant()` / `app_user` path (ADR-0015), never `platform_admin_role`. `requireTenantUser()` gates it to tenant-user/tenant-admin identities only — Platform Admin receives `403` (ADR-0030 §2 zero-tenant-content boundary). Closes the gap `tenants/SKILL.md` had flagged as "No HTTP/REST surface exists for `tenants` yet" since Story 5.8. Contract covers: `401` for missing/invalid token (inherited from shared middleware), `403` for platform_admin, `200` with correct `{ id, name, status, licenseSeatCount, activeSeatCount, domain, createdAt }` shape for both `tenant_user` and `tenant_admin` identities, two-tenant isolation (caller sees only their own row), and `404`/`405` for non-existent/write methods at this path.

---

## 2026-08-09 — Healing: Story 3.5 archival partition eligibility boundary — social-listening-core@4de308e

- **Full commit:** `4de308ee4205d22c211d61c6c6ebdfe551be1af8`
- **Repo:** social-listening-core
- **Story / ADR:** 3.5 / ADR-0018
- **Contract:** social-listening-core/contracts/epic-3/story-3.5.tiered-retention-and-archival.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/data-retention-and-archival/SKILL.md (updated — added partition-eligibility boundary clarification to load-bearing constraints)
- **Files touched:** social-listening-core/src/archival/socialPostArchival.ts
- **Full suite at merge:** PASS (44/44 suites, 272/272 tests)

**Root cause:** `findEligiblePartitions()` used `monthEnd <= cutoff` as its eligibility condition, requiring the entire month to have elapsed before its partition was processed. Rows older than the retention window that landed in the boundary month (the month straddling the cutoff date) were silently skipped. Surfaced when the Docker test container's clock was 1 day ahead of local time, causing a 100-day-old test post to land in May 2026 (boundary month, not yet fully elapsed) rather than April 2026 (fully elapsed), exposing the edge case reproducibly. **Fix:** changed to `monthStart < cutoff` (any partition that started before the cutoff may contain aged rows) plus `AND created_at < $1` in the inner SELECT so rows still within the retention window are never archived even from a partially-aged partition. The durable decision (DETACH/ATTACH PARTITION mechanism, 90-day default, field-level tiering) is unchanged — this is a correction to the partition-selection algorithm. ADR-0018's Amendment Log and `data-retention-and-archival/SKILL.md`'s load-bearing constraints both updated in a follow-on commit (`75cc58d`).

---

## 2026-08-09 — Story 1.9 — social-listening-core@3badf2f

- **Full commit:** `3badf2f61c8da29a80af914be86525d7ea833efa`
- **Repo:** social-listening-core
- **Story / ADR:** 1.9 / ADR-0032
- **Contract:** contracts/epic-1/story-1.9.user-invite-offboard.contract.test.ts
- **SKILL.md:** .claude/skills/identity-resolution/SKILL.md
- **Files touched:** social-listening-core/contracts/epic-1/story-1.9.user-invite-offboard.contract.test.ts, social-listening-core/contracts/epic-5/story-5.9.users-table-identity-resolution.contract.test.ts, social-listening-core/migrations/0024_create_user_access_audit_log.sql, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts, social-listening-core/src/identity/identityResolution.ts, social-listening-core/.claude/skills/identity-resolution/SKILL.md
- **Full suite at merge:** PASS (45/45 suites, 295/295 tests)

**Story 1.9 ships the user invitation and offboarding REST surface for `social-listening-core`, closing the gap Story 5.9's own Acceptance Criteria assumed (`POST /v1/tenants/users` to create an invited user) but no story had built.** Three endpoints on `tenantUsersRouter`: `POST /v1/tenants/users` (invite, tenant_admin only, seat-ceiling check, no seat consumed at invite time), `GET /v1/tenants/users` (both roles, RLS-scoped, includes invited+active), and `PATCH /v1/tenants/users/:id` (set/clear `access_ends_at`, tenant_admin only, immediate decrement vs. future-dated no-op, reactivation re-increments subject to seat ceiling). All endpoints write to `user_access_audit_log` (migration 0024) via `setAccessEndsAt()`, with `actorUserId` now a required parameter — removing the `'system'` default that was invalid UUID syntax and fixing a regression in Story 5.9's three `setAccessEndsAt` call sites.

**Contract covers all 9 ACs (23 tests):** invite creates invited row with correct shape; 403/401/400 gates; seat ceiling 409; no seat increment at invite time; GET for both roles including invited rows; PATCH role gate (403/400/404); immediate offboard decrements seat, future-dated does not; reactivation re-increments and 409 at ceiling; two-tenant RLS isolation on all three endpoints; audit row written with correct `operation` and `new_value` for both set and clear.

## 2026-08-08 — Story 6.6 — socialengage@2b2d40b

- **Full commit:** `2b2d40bf77361a8854fbd0c7a2c98c3379aec269`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.6 / ADR-0030, ADR-0031, ADR-0035
- **Contract:** social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/platform-admin-console/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Full suite at merge:** PASS (8/8 suites, 58/58 tests)

**Platform Admin console UI is now real in `social-listening-admin`, built against already-shipped core surfaces from Stories 5.12, 5.13, and 5.14.** The route at `src/app/platform-admin/page.tsx` now renders concrete sections for tenant registry, tenant provisioning/update flow mapping, break-glass request/execute flow mapping, and audit-log visibility, while explicitly preserving ADR-0030's "no tenant-content data" boundary in copy.

**`core-client.ts` now has dedicated Platform-Admin endpoint helpers rather than ad hoc route calls** (`listAdminTenants`, `createAdminTenant`, `updateAdminTenant`, `requestBreakGlassReset`, `executeBreakGlassRequest`, `queryAdminAuditLog`) so future Epic 6 stories extend one sanctioned API surface.

**Contract-first sequence was followed and validated in full:** the new Story 6.6 contract initially failed against placeholder code, then passed after implementation (6/6), with the full accumulated `social-listening-admin` contracts green afterward (8/8, 58/58), and traceability notes updated in `docs/user-stories/epic-6-admin-ui.md`, `docs/user-stories/README.md`, and `docs/implementation-plan.md` in the same commit.

## 2026-08-09 — Story 6.7 — socialengage@2b44637

- **Full commit:** `2b4463747b872565c0d954004027450dd53b8c5b`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.7 / ADR-0037
- **Contract:** social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md, social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts, social-listening-admin/src/app/api/auth/callback/route.ts, social-listening-admin/src/app/api/auth/signup/route.ts, social-listening-admin/src/app/sign-up/already-have-account/page.tsx, social-listening-admin/src/app/sign-up/domain-taken/page.tsx, social-listening-admin/src/app/sign-up/error/page.tsx, social-listening-admin/src/app/sign-up/page.tsx, social-listening-admin/src/lib/core-client.ts, social-listening-admin/src/lib/signupFlow.ts, social-listening-admin/src/proxy.ts
- **Full suite at merge:** PASS (9/9 suites, 75/75 tests)

**Self-service tenant sign-up UI is now real in `social-listening-admin`, closing the last named gap in Story 6.7 — the backend endpoint it depends on (`POST /v1/tenants/self-service-signup`, Story 5.15) was already built 2026-08-06.** A new `/sign-up` entry point collects only the tenant name (never email/domain — both are Entra- and core-derived, per ADR-0037 §5's anti-spoofing requirement, unchanged from `GET /v1/me`'s own already-decided rule) and triggers Entra's sign-up dialog via the standard `prompt=create` authorization-request parameter — confirmed directly against Microsoft's own docs (`learn.microsoft.com/entra/msal/javascript/browser/prompt-behavior`: "Triggers a sign-up dialog allowing external users to create an account") rather than assumed, and confirmed that Entra External ID customer tenants support exactly one combined sign-up-and-sign-in user flow (`learn.microsoft.com/dynamics365/commerce/dev-itpro/set-up-external-entra-id`), so there is no separate sign-up-only flow to point at instead.

**Reuses Story 6.1's own BFF session mechanism end to end — no second, parallel auth mechanism introduced.** The existing OAuth-state cookie gained two optional, additive fields (`mode`, `tenantName`) that the shared `/api/auth/callback` route branches on; ordinary sign-in (where neither field is set) is unchanged, verified by the full suite's continued pass of Story 6.1's own real, live E2E sign-in test. The token-exchange → redirect decision itself lives in a new, independently unit-testable `signupFlow.ts`'s `completeSelfServiceSignup()`, which dispatches core's response: 201 → hydrates identity via `GET /v1/me` (only ever after a confirmed success, never before) and establishes the ordinary session, landing on `/`; a domain-match 409 → `/sign-up/domain-taken` (static, non-org-naming copy per ADR-0037 §3/§8d — nothing about the matched tenant is even in the redirect to leak); an already-belongs 409 → `/sign-up/already-have-account`; any other failure → an actionable `/sign-up/error` rather than a silent partial state (Story 6.7's own AC9).

**Real infrastructure used where actually provable, honestly scoped where not.** The signup route's own authorization-URL construction is proven against the real Entra External ID tenant (a real `client.discovery()` call, a real spawned `next dev` server, following Story 6.1's own precedent for this exact "importing a Route Handler that pulls in `openid-client`'s ESM breaks `ts-jest`" constraint) — the real redirect is inspected for `prompt=create` and a real PKCE challenge, not asserted from a mock. A full, real interactive self-service sign-up (completing a live email-OTP challenge against a brand-new mailbox, per ADR-0037 §8a) is not something this environment can drive end-to-end without real inbox access; `completeSelfServiceSignup()`'s own dispatch logic is instead proven at the unit level against a mocked `fetch`, the same seam Story 6.1's own AC7 test already established for `authenticatedCoreFetch()` — named honestly in the contract's own header and the component's own SKILL.md, not silently assumed covered.

**Explicitly not built by this story, named rather than silently skipped:** §8b/§8c (Same-Domain Invite Assist, Platform-Admin escalation visibility — Story 6.10, not yet built) and §7 (rate-limiting/abuse-prevention — Story 5.18, Ready but unbuilt); this endpoint remains unsafe for real, untrusted traffic regardless of this story's own completion, per ADR-0037 §7's own precondition.

**Contract-first sequence was followed and validated in full:** the new Story 6.7 contract initially failed against no implementation (16 of 17 failed — every assertion depending on code that didn't exist yet), then passed 17/17 after implementation, with the full accumulated `social-listening-admin` contracts green afterward (9/9 suites, 75/75 tests, including Story 6.1's own real live sign-in E2E — no regression), and traceability notes updated in `docs/user-stories/epic-6-admin-ui.md` and `docs/implementation-plan.md` in the same commit.

## 2026-08-10 — Healing: parallel-worker race between Story 6.1/6.7's spawned dev servers — social-listening-admin@832f7b3

- **Full commit:** `832f7b3eaadf1a2b6d1e7ebb4cd1e0e92883efe5`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.1 / ADR-0036, 6.7 / ADR-0037 (both contracts' own spawned-server test infrastructure, not either story's application code)
- **Contract:** social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts (both modified — no assertions weakened, only each spawn's own child-process env)
- **SKILL.md:** social-listening-admin/.claude/skills/admin-auth-session/SKILL.md, social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md
- **Files touched:** social-listening-admin/.claude/skills/admin-auth-session/SKILL.md, social-listening-admin/.claude/skills/self-service-signup-ui/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.7.self-service-signup.contract.test.ts, social-listening-admin/next.config.js
- **Full suite at merge:** PASS (10/10 suites, 89/89 tests) — confirmed reliable across two consecutive default-parallel runs after the fix, not just one.

**Discovered while validating Story 6.8: `npx jest contracts` intermittently failed one of Story 6.1's or Story 6.7's own real-`next-dev`-spawning contract tests with "Another next dev server is already running" / "did not become ready in time," even though the two listen on different ports (3000 vs. 3002).** Root-caused directly, not assumed — read `node_modules/next/dist/build/lockfile.js` and its call site in `node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js`: Next 16's dev-server lock file lives at `path.join(distDir, 'lock')`, keyed by project `distDir` (default `.next`), not by port, with only a 1-second total retry window before the losing process calls `process.exit(1)`. Two Jest workers each spawning `next dev` from the same project directory around the same time will race for that one lock file regardless of port. Confirmed the diagnosis (not just plausible) by reproducing a clean `--runInBand` run — 10/10 suites, 89/89 tests, no failures — proving the underlying application code was never the problem.

**Fix: each spawning contract sets its own `NEXT_DIST_DIR` in its child-process env** (`.next/test-story-6-1`, `.next/test-story-6-7` — both nested under the already-`.gitignore`d `.next/`), read by a small, opt-in-only addition to `next.config.js`. This gives each spawned server its own lock-file path, resolving the race at its actual root rather than forcing the whole suite to run serially (`--runInBand`) or weakening/deleting either contract's own assertions — both hard-stop conditions this skill explicitly forbids. Verified twice in a row under default parallel workers post-fix, and the full run got measurably faster (92s → ~36s), independently confirming real concurrency is now happening rather than accidentally-serialized luck.

## 2026-08-10 — Healing follow-up: regenerated next-env.d.ts/tsconfig.json — social-listening-admin@c89ee47

- **Full commit:** `c89ee47eadb4c3bffa66d1e19ac37da4dba5df13`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.1 / ADR-0036, 6.7 / ADR-0037 (same healing pass as `832f7b3` above — a mechanical, auto-generated side effect of it, not new work)
- **Contract:** none (no assertions changed; both affected files are Next.js's own auto-generated TypeScript config, "should not be edited" per `next-env.d.ts`'s own header)
- **SKILL.md:** none
- **Files touched:** social-listening-admin/next-env.d.ts, social-listening-admin/tsconfig.json
- **Full suite at merge:** PASS (unaffected — these files are typecheck/IDE support only, not exercised by Jest)

`next dev` regenerated both files after the prior commit's `NEXT_DIST_DIR`-scoped distDirs actually ran once each, appending `.next/test-story-6-1/...` and `.next/test-story-6-7/...` type-reference paths. Committed as-is rather than hand-edited, per Next's own convention for these two files.

## 2026-08-10 — Story 6.8 — social-listening-admin@6b7fc00

- **Full commit:** `6b7fc0022b3efc0f7861318033fdeb0ff0831ff1`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.8 / no new ADR (Phase 1/Phase 3 "also build, not storied," against Story 1.9's own real REST surface)
- **Contract:** social-listening-admin/contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/tenant-user-management/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/tenant-user-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts, social-listening-admin/src/app/api/tenant-users/[id]/route.ts, social-listening-admin/src/app/api/tenant-users/route.ts, social-listening-admin/src/app/tenant/users/AccessControl.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Full suite at merge:** PASS (10/10 suites, 89/89 tests)

**A new `/tenant/users` screen lists every user in the caller's tenant (email, role, status, `access_ends_at` shown as "active indefinitely" when `null`) against Story 1.9's already-built `GET /v1/tenants/users`, visible to both resolved tenant roles per that story's own Acceptance Criteria.** An invite form and a per-user access control are additionally rendered only for `identity.role === 'tenant_admin'` — UX convenience only, the same framing Story 6.3 already established; Story 1.9's own backend `403` remains the real boundary.

**This is the first Epic 6 screen with genuinely interactive Client Components, not static fixture data (Stories 6.3/6.4's own precedent).** `InviteUserForm.tsx` and `AccessControl.tsx` call same-origin Route Handler proxies (`/api/tenant-users`, `/api/tenant-users/:id`) rather than `core-client.ts` directly, since a Client Component cannot read the server-side session cookie `authenticatedCoreFetch()` needs — the Route Handlers are the thinnest possible glue, passing `core-client.ts`'s own status/body straight through unmodified, keeping `core-client.ts` itself the sole Bearer-attachment choke point (re-verified structurally, not just inherited). New `core-client.ts` functions: `listTenantUsers()`, `inviteTenantUser()`, `setUserAccessEndsAt()` — the latter two return a raw `{status, body}` outcome rather than throwing on a non-2xx, the same pattern Story 6.7's `selfServiceSignup()` already established, so the calling UI can react to a specific 409/403 rather than a collapsed generic error.

**`AccessControl`'s confirm step is a real two-click gate, checked structurally in the contract** (every first-click handler only sets pending UI state; none of them call the PATCH-triggering `apply()` directly) — its own confirm copy is what distinguishes an immediate offboard ("...immediately.") from a scheduled one ("...not immediately."), satisfying the story's own AC4 without a second UI mechanism (color, icon) to carry that distinction.

**Real infrastructure used at the seam that matters, honestly scoped where it doesn't need to be:** `core-client.ts`'s three new functions are proven against a real `encryptSession()`-minted session (the same `next/headers`-mocking pattern Story 6.1's own AC7 test established) with a mocked `fetch` beyond that boundary — this repo's Jest config has no jsdom/testing-library, so `InviteUserForm`/`AccessControl`'s actual click-through behavior is proven structurally (source content) rather than by rendering, the same constraint every other Epic 6 client-component story has worked within.

**Explicitly not built by this story, named rather than silently skipped:** the access-history view reading Story 5.17's `user_access_audit_log` — the story's own Acceptance Criteria name this as a natural companion, not required in this pass.

**Contract-first sequence was followed and validated in full, including a real cross-cutting healing pass discovered along the way (see the two entries directly above, `832f7b3`/`c89ee47`):** the new Story 6.8 contract initially failed against no implementation (13 of 14 failed), passed 14/14 after implementation, and the first full-suite validation attempt surfaced the pre-existing Story 6.1/6.7 dev-server race — healed separately, on its own commit and its own Implementation Log entry, before this story's own traceability/commit/log steps resumed. Final full suite: 10/10 suites, 89/89 tests, confirmed reliable across two consecutive parallel runs. Traceability updated in `docs/user-stories/epic-6-admin-ui.md` and `docs/implementation-plan.md` in the same commit.

## 2026-08-10 — Story 6.9 — social-listening-admin@9ec62fa

- **Full commit:** `9ec62fa80123edf68b5f28f3b3877c46f2e2f53a`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.9 / no new ADR (Phase 1/Phase 3 "also build, not storied," against Story 1.8's own real REST surface)
- **Contract:** social-listening-admin/contracts/epic-6/story-6.9.tenant-settings-screen.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/tenant-settings/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/tenant-settings/SKILL.md, social-listening-admin/contracts/epic-6/story-6.9.tenant-settings-screen.contract.test.ts, social-listening-admin/src/app/tenant/settings/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Full suite at merge:** PASS (11/11 suites, 99/99 tests)

**The simplest Epic 6 screen so far: a new `/tenant/settings` reads Story 1.8's already-built `GET /v1/tenants/me` (via a new `getMyTenant()` in `core-client.ts`, reusing the existing `AdminTenant` type from Story 6.6 rather than a second near-identical shape) and renders `name`/`status`/`domain`/`createdAt`, read-only — no form, no input, no edit affordance anywhere.** Seat counts render as "N of M seats used" rather than two bare numbers, per this story's own AC3. Gated only on `isShellAllowed(identity, 'tenant')` — deliberately no additional role check, so `tenant_admin` and `tenant_user` sessions see the identical screen (AC2), the one Epic 6 screen so far with no role-based content difference at all.

**Contract-first sequence was followed and validated in full:** the new Story 6.9 contract initially failed against no implementation (9 of 10 failed), passed 10/10 after implementation, with the full accumulated `social-listening-admin` contracts green afterward (11/11 suites, 99/99 tests, no regression). Traceability updated in `docs/user-stories/epic-6-admin-ui.md` and `docs/implementation-plan.md` in the same commit.

## 2026-08-10 — Story 6.10 — social-listening-admin@3661ce9

- **Full commit:** `3661ce90591765bf672b9278bb17fa9f61eb174a`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.10 / ADR-0037 §8b (no new ADR — already exhaustively decided the mechanism, only the screen was undesigned)
- **Contract:** social-listening-admin/contracts/epic-6/story-6.10.same-domain-invite-assist-view.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/same-domain-invite-assist/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-6-admin-ui.md, social-listening-admin/.claude/skills/same-domain-invite-assist/SKILL.md, social-listening-admin/contracts/epic-6/story-6.10.same-domain-invite-assist-view.contract.test.ts, social-listening-admin/src/app/tenant/invite-assist/page.tsx, social-listening-admin/src/app/tenant/users/InviteUserForm.tsx, social-listening-admin/src/app/tenant/users/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Full suite at merge:** PASS (12/12 suites, 112/112 tests)

**Epic 6 (Admin UI) is now fully built — every story 6.1 through 6.10.** A new `/tenant/invite-assist` screen reads Story 5.16's already-built `GET /v1/tenants/domain-signup-attempts` (via a new `listDomainSignupAttempts()` in `core-client.ts`, which deliberately takes no `tenantId` parameter — every bit of tenant scoping is the backend's own RLS), rendering one item per domain. Expand-on-demand uses a native `<details>`/`<summary>` element rather than a Client Component with a second fetch, since Story 5.16's own response already carries the full `emails` array inline — this keeps the entire screen a plain Server Component, no `'use client'` anywhere in this story. An escalated domain (the threshold already computed server-side) is marked with a distinct `⚠ Escalated` label ahead of the domain, not merely a bigger `distinctEmailCount` in the same spot, per this story's own AC2 and ADR-0037 §8b's explicit "not just a bigger number" framing.

**Also extends Story 6.8's own `tenant/users/page.tsx`/`InviteUserForm.tsx`, as required directly by this story's own AC3 text ("pre-fills Story 6.8's own invite-creation form with that email").** Each email in an expanded domain item links to `/tenant/users?inviteEmail=<email>`; the users page now reads that optional search param (Next 16's own `searchParams: Promise<...>` page prop) and passes it down as `InviteUserForm`'s new `initialEmail` prop, which only seeds `useState` — never auto-submits. Story 6.8's own contract was re-run and continues to pass unmodified.

**This screen's own role gate is a whole-page `redirect()` before any data fetch — deliberately not Story 6.8's own in-page-only invite-form gate**, per AC4's stricter "visible only to `tenant_admin` — 403/not rendered for `tenant_user`" requirement (Story 6.8's own users list, by contrast, a `tenant_user` can see, just without the invite form). Documented explicitly in this component's own SKILL.md so a future change doesn't "harmonize" the two patterns by mistake.

**Contract-first sequence was followed and validated in full:** the new Story 6.10 contract initially failed against no implementation (12 of 13 failed), passed 13/13 after implementation, with the full accumulated `social-listening-admin` contracts green afterward (12/12 suites, 112/112 tests, no regression — including Story 6.8's own contract, re-verified after this story's cross-file edit into its scope). Traceability updated in `docs/user-stories/epic-6-admin-ui.md` and `docs/implementation-plan.md` in the same commit.

## 2026-08-10 — Story 5.17 — social-listening-core@5fe1999

- **Full commit:** `5fe1999c67f0d55a3a851788602d86c423347ac1`
- **Repo:** social-listening-core
- **Story / ADR:** 5.17 / ADR-0032 §9 (no new ADR — resolves an already-named Open Question, the exact audit-read mechanism)
- **Contract:** social-listening-core/contracts/epic-5/story-5.17.access-history-read-endpoint.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/identity-resolution/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/identity-resolution/SKILL.md, social-listening-core/contracts/epic-5/story-5.17.access-history-read-endpoint.contract.test.ts, social-listening-core/src/http/versions/v1/tenantUsersRouter.ts, social-listening-core/src/identity/identityResolution.ts
- **Full suite at merge:** 297/302 (45/46 suites) — 5 pre-existing, unrelated failures, see below.

**A real, confirmed "already mostly built ahead of schedule" finding, not assumed:** Story 1.9 (built 2026-08-09/10, before this story) already had to create `user_access_audit_log` (migration `0024`) and wire `setAccessEndsAt()` to write one audit row per change, inside the same `withTenant()` transaction as the `users` update, to make its own `PATCH /v1/tenants/users/:id` work at all — confirmed directly by reading the migration's own header comment ("Story 5.17 was drafted to own this design; Story 1.9 is the first caller") and `src/db/withTenant.ts`'s real `BEGIN`/`COMMIT`/`ROLLBACK` wrapping. This story's own genuinely new work was therefore narrower than its Acceptance Criteria read in isolation: a new `listAccessHistory()` in `identityResolution.ts` and `GET /v1/tenants/users/:id/access-history` on `tenantUsersRouter.ts` (tenant_admin only), proving AC4 (the endpoint itself), AC3 from the read side (both a set and a subsequent clear visible, in order, the clear's own `newValue: null`), AC6 (cross-tenant isolation on this specific new endpoint — Story 1.9's own AC8 isolation test predates its existence), and AC5 (a structural check that `breakGlassCredentialReset.ts` never references `access_ends_at`/`user_access_audit_log` at all). AC2's "same transaction" requirement is `withTenant()`'s own pre-existing guarantee, not re-derived via a forced-failure test — named honestly as such in the contract's own header rather than faked.

**A real, honestly-corrected schema/AC naming drift, not silently patched over:** this story's own AC1 bullet (drafted 2026-08-05) names columns `user_id`/`changed_by`/`previous_value`/`changed_at`; what Story 1.9 actually shipped is `target_user_id`/`actor_user_id`/`old_value`/`occurred_at`, plus an `operation` column AC1 doesn't mention. Not re-migrated — those names are already load-bearing in Story 1.9's own passing contract and this module's own code, and the underlying principle AC1 cares about (every write auditable, tenant-scoped RLS, before/after values, who/when) is fully satisfied regardless of the literal names. Corrected via a dated note in `docs/user-stories/epic-5-security-isolation-and-messaging.md` rather than silently rewriting the AC text, per this project's own "don't rewrite history" convention. The new endpoint's own REST response uses ordinary camelCase equivalents of the real column names (`targetUserId`, `actorUserId`, `oldValue`, `newValue`, `occurredAt`).

**A real, pre-existing, unrelated failure surfaced during full-suite validation — investigated per the `heal-contract-failure` skill's own Cross-Component Regression Protocol, not silently ignored or silently worked around.** 5 tests in `contracts/epic-5/story-5.7.platform-admin-rls-bypass.contract.test.ts` fail with a real, live Microsoft Graph 409 ("concurrent requests being made to the tenant") from `executeBreakGlassRequest()`'s own Temporary Access Pass creation call. Attribution confirmed this story's own two touched files (`identityResolution.ts`, `tenantUsersRouter.ts`) share no code path with `breakGlassCredentialReset.ts`; the failure reproduces identically under `--runInBand` (ruling out a Jest-parallel-worker race, unlike the distinct Story 6.1/6.7 race healed earlier the same day in `social-listening-admin`); and this matches this same phase's own already-documented 2026-08-07 note (line 218, `docs/implementation-plan.md`) — 5 failures then too, same real external cause. **A genuine, plausible code-level fix was identified but deliberately not applied here** (out of this story's own scope, per Menno's own explicit direction this session): the TAP-creation Graph call has no retry/backoff, unlike `grantRoles()`/`revokeRoles()` in the same module, which already retry a different known-transient Graph error. Tracked as a separate, explicitly scoped follow-up healing pass for Story 5.7/5.13's own component, not folded into this commit. Traceability updated in `docs/user-stories/epic-5-security-isolation-and-messaging.md` and `docs/implementation-plan.md` in the same commit.

## 2026-08-10 — Healing: break-glass password-reset/TAP calls lacked retry on transient Graph 409s — social-listening-core@99b58c3

- **Full commit:** `99b58c31f8b129e85227336cc52bd0aa88b1bba3`
- **Repo:** social-listening-core
- **Story / ADR:** 5.7 / ADR-0030 (the follow-up named in this same file's own Story 5.17 entry directly above)
- **Contract:** contracts/epic-5/story-5.7.platform-admin-rls-bypass.contract.test.ts — re-run, not modified (no new AC, no new code path a contract didn't already exercise; this commit used `--no-verify` on the `enforce-contract-first` hook, with a note in the commit message itself explaining why, per that hook's own stated exception)
- **SKILL.md:** social-listening-core/.claude/skills/platform-admin-access/SKILL.md
- **Files touched:** social-listening-core/.claude/skills/platform-admin-access/SKILL.md, social-listening-core/src/admin/breakGlassCredentialReset.ts
- **Full suite at merge:** PASS (46/46 suites, 302/302 tests) — confirmed across two consecutive full runs, the second fully clean.

**Walked Steps 1–5 of `heal-contract-failure` per the mandatory workflow, explicitly authorized by Menno as its own follow-up pass after Story 5.17's own commit landed.** Step 1 (Intent) found no drift — Story 5.7's own contract already asserts `executeBreakGlassRequest()` "succeeds" against the real tenant; a real Graph 409 undermining that is exactly the kind of infrastructure fragility the existing AC's own intent doesn't tolerate, not a reason to weaken it. Step 3 (SKILL.md) surfaced a strong, direct precedent before any code was touched: `platform-admin-access/SKILL.md`'s own "Known gaps" section already documented an identical prior incident — `grantRoles()` missing retry-with-backoff for a *different* transient Graph conflict (400 "conflicting object," fixed 2026-08-07, "previously misclassified as pure environmental flakiness rather than root-caused"). This was the same class of bug in the two calls that fix never covered.

**Fix:** two new functions, `resetPasswordWithRetry()`/`createTemporaryAccessPassWithRetry()`, mirror `grantRoles()`/`revokeRoles()`'s own exponential-backoff retry shape exactly (up to 8 attempts, jittered backoff capped at 30s), gated on a new `isConcurrentTenantRequestError()` predicate (409 + "concurrent requests" in the body) kept deliberately separate from the existing `isConflictingObjectError()` (400 + "conflicting object") — two genuinely different Graph response shapes for two genuinely different root causes, not merged into one check.

**Validation went through one real, instructive extra round before landing clean.** The first post-fix full-suite run: Story 5.7's own contract passed 16/16 (the original 5 failures gone), but a *different* assertion in the same file ("leaves the resetter identity de-elevated after execution" — a live Entra directory-role read, already polling up to 30s) failed once. Investigated rather than assumed: this exact check had just passed cleanly moments earlier when Story 5.7's contract ran alone (16/16); the failure appeared only under the full suite's parallel load against the same shared, real Entra tenant — the same "real shared Azure resources, parallel contention" pattern this project has hit before, not a consequence of this fix (which never touches `revokeRoles()` or the de-elevation check). A second full-suite run confirmed this directly: 46/46 suites, 302/302 tests, fully clean, no reproduction.

**Traceability:** no story/ADR status changed (Story 5.7 was already Ready and built; this is a resilience fix to already-covered behavior, not a new Acceptance Criterion), so `docs/user-stories/README.md`/`docs/adr/README.md`/`docs/implementation-plan.md`'s traceability table needed no edit — consistent with this project's own "table tracks phase placement/build status, not incidental robustness fixes" convention already established for comparable entries.

## 2026-08-10 — Story 5.18 — social-listening-core@7a2466d

- **Full commit:** `7a2466d27958c1d36a5c02a116130eac1d9064eb`
- **Repo:** social-listening-core
- **Story / ADR:** 5.18 / ADR-0040 (Accepted 2026-08-06)
- **Contract:** social-listening-core/contracts/epic-5/story-5.18.signup-rate-limiting.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/open-decisions.md, docs/user-stories/epic-5-security-isolation-and-messaging.md, social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md, social-listening-core/contracts/epic-5/story-5.18.signup-rate-limiting.contract.test.ts, social-listening-core/src/http/versions/v1/selfServiceSignupRouter.ts, social-listening-core/src/tenants/signupRateLimit.ts
- **Full suite at merge:** PASS (47/47 suites, 309/309 tests)

**Closes ADR-0037 §7's own long-standing, twice-flagged precondition** (`docs/open-decisions.md` §1, this ADR's own Consequences note) — `POST /v1/tenants/self-service-signup` (Story 5.15) is now safe to expose to real, untrusted traffic for the first time. A new `signupRateLimit.ts` implements a dedicated, in-process, rolling-window attempt counter keyed by IP and by raw email-domain, deliberately structurally independent of `connectors/requestGate.ts` (ADR-0003/ADR-0020, which queues-and-waits for a resolved `(tenantId, providerId)` — a genuinely different shape for a genuinely different problem). Wired into `selfServiceSignupRouter.ts` ahead of any DB work, rejecting with `429` once either threshold (default 10/24h per IP, 5/24h per domain, both `SIGNUP_RATE_LIMIT_*` env-configurable per ADR-0040 §3's own template-default convention) is crossed. A `429` here writes no `domain_signup_attempts` row and never touches Story 5.16's own escalation logic — proven directly, a structurally distinct outcome from ADR-0037 §3's domain-match rejection.

**A real interpretive decision, named honestly rather than silently assumed — the same "don't rewrite history, add a dated note" treatment Story 5.17's own AC1/schema drift already used.** Story 5.18's own AC3 text says the domain-keyed limit reuses "the same `domain_signup_attempts` data Story 5.16 already reads," but ADR-0040 §2 itself unambiguously decides in-process storage, and that Postgres table (written only on an *already-rejected* domain-match, never for a denylisted/public-email domain) cannot literally *be* the in-process counter without contradicting §2. Resolved as directional, not literal — and confirmed the more protective reading in the process: keying on the **raw** domain, before `selfServiceSignup.ts`'s own denylist filtering, is the only thing that bounds repeated attempts against a denylisted domain like `gmail.com`, which `uq_tenants_domain` structurally cannot (stored `NULL`, never collides, ADR-0037 §4).

**Full-suite validation surfaced one real, unrelated flake, investigated rather than assumed away.** The first full run failed one test in `contracts/epic-2/story-2.6.newswire-connector.contract.test.ts` (a real, live RSS-wire fetch exceeding its 60s timeout under parallel load) — attribution confirmed no code overlap with this story's own two touched files, and re-running that file alone passed 5/5 in 12s. A second full run confirmed clean: 47/47 suites, 309/309 tests, no reproduction. Also confirmed, contrary to an initial concern raised before validation: Story 5.15's own contract (11 `POST /v1/tenants/self-service-signup` calls, 10 of them authenticated) sits exactly at, not over, the new default per-IP threshold — passed without modification, though the edge is now named explicitly in this component's own SKILL.md for whoever adds an 11th authenticated call there someday.

**Traceability:** `docs/user-stories/epic-5-security-isolation-and-messaging.md` and `docs/implementation-plan.md` updated in the same commit; `docs/open-decisions.md` §1's own ADR-0037 §7 entry struck through and resolved, with a pointer left for the documentation-steward's own next pass over `docs/project docs/Project Management Plans/Go-Live-Readiness-Definition.md` §5.3 (a PM-side doc outside this skill's own edit scope, named rather than silently left stale).

## 2026-08-10 — Story 2.8 — social-listening-core@f70b07d

- **Full commit:** `f70b07dacee68d618c2537c705e300a91a6d83a0`
- **Repo:** social-listening-core
- **Story / ADR:** 2.8 / ADR-0038 (Accepted 2026-08-06)
- **Contract:** social-listening-core/contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/.claude/skills/social-post-enrichment/SKILL.md, social-listening-core/contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts, social-listening-core/contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/azureAiLanguageConnector.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts, social-listening-core/src/connectors/examples/exampleAiProviderY.ts, social-listening-core/src/connectors/gnews/pollGNewsSearch.ts, social-listening-core/src/connectors/newswire/pollNewswireFeeds.ts, social-listening-core/src/connectors/types.ts
- **Full suite at merge:** PASS (48/48 suites, 319/319 tests, `--runInBand`)

**Closes Phase 2's own long-standing "first `AIProviderConnector` implementation" gap** (Story 2.1/ADR-0002 defined the interface; nothing implemented it against a real provider until now). `azureAiLanguageConnector.ts` calls the real, live Azure AI Language `:analyze-text` endpoint (sentiment, key phrases, entities, language detection — one call per capability, per Microsoft's own SDK guidance for a single small document, not the combined batch endpoint meant for larger workloads). `enrichPost.ts` is the one shared, best-effort hook — resolves the tenant's own stored credential, gates via the existing `acquireForAiModel()`, retries a retryable failure with backoff up to 3 attempts, and **never throws**: a missing credential, a non-retryable failure, or an exhausted retry budget all degrade to `undefined`, never a failed ingestion. Wired into both `pollGNewsSearch.ts` and `pollNewswireFeeds.ts` ahead of their own `insertSocialPost()` calls.

**A real, confirmed AC drift, corrected rather than silently built past.** AC3 claimed `analyze()` maps into `SocialPost.enrichment`'s "exact existing shape... no reshaping of the already-shipped type." Checked directly against the real, shipped code before writing any implementation: the only shipped, contract-tested shape was `entities: string[]` (Story 4.2's own fixture), and `AIProviderConnector.analyze()`'s return type (Story 2.1) had no `sentimentScores`, no per-entity `category`/`confidenceScore`, and no `modelUsed`. Real calls against the live Azure endpoint (captured via a scratch probe script, not assumed) confirmed entities are naturally `{text, category, confidenceScore}[]`. Widened `AnalyzeResult`/`enrichment.entities` accordingly (`src/connectors/types.ts`, additive — `analyze()`'s new `credential` parameter and every new `AnalyzeResult` field are optional, so neither example connector nor Story 2.1's own 2-arg call broke) with Menno's explicit sign-off after reviewing the real API research. Required one genuine, dated, explicitly-authorized edit to Story 4.2's own already-passing contract (`jsonb_array_elements_text` → `jsonb_array_elements` + `->>'text'`) — see that story's own file and `provider-connector-framework/SKILL.md`'s Load-bearing constraints for the full account. Checked and confirmed clean: Stories 3.5, 4.1, 4.4, and 5.1 also reference `entities` but only as untyped-JSONB filler for unrelated concerns (archival, caching, event payloads) — no other contract needed changing.

**Validation was blocked mid-session by a real, unrelated infrastructure event — a live Azure subscription move — diagnosed and resolved rather than worked around.** `social-listening-dev` (the shared dev environment every real-Azure contract in this repo runs against) moved from resource group `social-listening-dev`/subscription `Azure CBA ADPA` to `rg-socialengage-dev`/subscription `social-engage`, mid-session, at Menno's own initiative (unrelated to this story). The first post-move run of this story's own contract failed all 10 tests identically, in `beforeAll()`, before any Story 2.8 code executed — a real Key Vault `RestError: Caller is not authorized`. Diagnosed directly rather than assumed: confirmed the local `az` CLI login was still pointed at the old subscription (fixed by `az login`), then confirmed via `az role assignment list` that the real cause was deeper — Azure RBAC role assignments are bound to a resource's full ID, which encodes both subscription and resource-group name, so a role assignment scoped to a resource that changes *either* is orphaned, not carried over. This affected three resources, found incrementally as each was hit by the full-suite run, not all at once: Key Vault (`social-listening-dev-kv`, blocking this story's own contract directly), Service Bus (`social-listening-dev` namespace, blocking Stories 5.2/5.5), and Blob Storage (`sociallisteningdev`, blocking Stories 3.5/3.8's archival contracts). Each was re-granted directly at the moved resource's own scope (`Key Vault Administrator`, `Azure Service Bus Data Owner`, `Storage Blob Data Contributor`) via Azure Portal, after `az role assignment create` hit a reproducible `MissingSubscription` ARM quirk when scoped to these specific resource types (worked fine at resource-group scope) — not silently worked around by loosening scope or skipping the check.

**A real, separate, latent operational bug was surfaced as a side effect, named and deliberately not fixed here.** Once the Blob Storage gap was found, Stories 3.5 and 3.8's own partition-detach failures (`"relation ... is not a partition"`) turned out to share the same root cause, not a parallel-race as first suspected: `archiveAgedRawPayloads()`/`archiveAgedIngestionRuns()` (`social-listening-core/src/archival/*.ts`) detach a Postgres partition, then loop calling `uploadArchiveBlob()`, then reattach it — with no `try/finally`. When the blob upload throws (here, the RBAC gap; in production, any transient blob failure), the function exits with the partition **permanently detached** from its parent table, poisoning every subsequent test/operation touching that table for the life of the Postgres instance. Confirmed by re-running Story 3.5 alone and tracing the exact call sequence, not guessed. This is outside Story 2.8's own scope (archival/ADR-0018, not AI enrichment) and was not fixed in this commit — flagged here, and worth its own dedicated healing pass given the real production risk (a transient blob failure permanently orphaning a partition until manual intervention).

**Traceability:** `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` (Status line + dated AC3-drift correction note), `docs/user-stories/README.md`, and `docs/implementation-plan.md` all updated in the same commit.

## 2026-08-10 — Story 2.9 — social-listening-core@69310ba

- **Full commit:** `69310ba80ae4be83e51e5cf4f7c7f51063b3cbdd`
- **Repo:** social-listening-core
- **Story / ADR:** 2.9 / ADR-0038 §2 (Amendment Log, 2026-08-10 — Azure OpenAI Service selected over Claude in Microsoft Foundry)
- **Contract:** social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/azure-openai-connector/SKILL.md (new); social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md and .claude/skills/provider-connector-framework/SKILL.md (updated)
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts, social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts
- **Full suite at merge:** PASS (49/49 suites, 329/329 tests, `--runInBand`)

**Closes Phase 2's own "prove AIProviderConnector swappability by real execution" item and ADR-0038 §2's own named follow-up.** `azureOpenAiConnector.ts` calls the real, live Azure OpenAI Service `gpt-5-mini` deployment (`socialengage-openai`, `rg-socialengage-cognitive`, `swedencentral`) using GA structured/JSON-schema-constrained output (`response_format: json_schema`, `strict: true`) to return sentiment, sentimentScores, entities, keyPhrases, and detectedLanguage from a **single** real HTTP call — realizing the single-call efficiency argument ADR-0038 Decision §2 named as the actual reason an LLM-based second provider was wanted, in direct contrast to Azure AI Language's own four separate per-capability calls (Story 2.8). Entity `category` is constrained via JSON Schema `enum` to Azure AI Language's own real, documented top-level NER taxonomy (`Person`, `PersonType`, `Location`, `Organization`, `Event`, `Product`, `Skill`, `Address`, `PhoneNumber`, `Email`, `URL`, `IP`, `DateTime`, `Quantity`) rather than left free-form — a deliberate choice so the two providers' output is genuinely comparable, not just structurally identical.

**`enrichPost.ts` (Story 2.8) was rewritten to be provider-agnostic, not left hardcoded to Azure AI Language.** It now tries each real `AIProviderConnector` in a fixed, explicit `PROVIDERS` array (Azure AI Language first, per ADR-0038's own lower-risk-first sequencing, then Azure OpenAI), skipping any provider a given tenant hasn't connected (no stored credential) and failing over to the next on an exhausted/non-retryable failure from a provider the tenant *has* connected — realizing AC4's "fails over or skips according to configured behavior" with zero changes to `pollGNewsSearch.ts`'s or `pollNewswireFeeds.ts`'s own ingest functions (AC2, proven by a structural contract check). Both real connectors now also call `registerAIProviderConnector()` as a genuine production code path — the shared framework registry's first real (non-test-only) use; `enrichPost()` itself still iterates the local `PROVIDERS` array rather than `listAIProviderConnectors()`, a deliberate choice documented in this component's own SKILL.md to avoid coupling real gating logic to a mechanism (`__resetRegistryForTests()`) that exists solely for cross-contract-file test isolation.

**Two real, primary-source-grounded decisions were made earlier the same session and recorded in ADR-0038's own Amendment Log, not decided ad hoc mid-implementation:** Azure OpenAI Service was selected over Claude in Microsoft Foundry (Claude's Azure-hosted path doesn't support structured output — a real `400` by design per Anthropic's own docs — and a real invoice showed flagship-tier Claude testing costing materially more than Azure OpenAI's cheap tier); and `gpt-4o-mini` (the originally-selected model) was found `Deprecating` at actual deployment time, substituted with `gpt-5-mini` (the current GA cheap-tier model, confirmed via Microsoft Learn) — both dated, honest corrections, not silently built past.

**A real, deterministic `429` was found, diagnosed with temporary logging (not assumed transient), and root-caused before touching any application code.** The Azure OpenAI deployment's initial `--sku-capacity 1` (1,000 TPM, confirmed via Microsoft Learn's own quota documentation) was smaller than a single real `enrichPost()` call's own token usage (~1,481 tokens, confirmed via a real probe call) — reproduced identically on 3 consecutive full-file runs, ruled out as flakiness by an isolated single-test run passing cleanly, then confirmed via temporary diagnostic logging showing real `429` responses. Fixed by raising the deployment to `--sku-capacity 20` (20,000 TPM), not by weakening `enrichPost()`'s own retry/failover logic, which was already behaving correctly. `GlobalStandard` is pay-per-token, so raising this ceiling carries no pre-committed cost.

**Traceability:** `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` (Status line), `docs/user-stories/README.md`, and `docs/implementation-plan.md` (dated note plus a real, pre-existing gap fixed — Story 2.9 was missing from the Phase 2 traceability table row despite already being named in that phase's own prose) all updated in the same commit.

**2026-08-10, later the same day — small follow-up commit, same story, at Menno's direct request — `social-listening-core@292a22a`.** Files touched: `social-listening-core/.claude/skills/azure-openai-connector/SKILL.md`, `social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts`, `social-listening-core/src/connectors/azureOpenAi/azureOpenAiConnector.ts`, `social-listening-core/src/connectors/types.ts`. Added an explicit self-review instruction to `azureOpenAiConnector.ts`'s own system prompt (check every entity/category/sentiment for consistency, silently correct before responding — inside the existing single structured-output call, not a second real HTTP call) and a new `overallConfidence` field on `AnalyzeResult`: the model's own post-review confidence in its complete answer, deliberately kept distinct from `entities[].confidenceScore`/`sentimentScores` (Azure AI Language's real calibrated-classifier probabilities) — never populated by `azureAiLanguageConnector.ts`. A new assertion was added to Story 2.9's own existing contract (real call returns `overallConfidence` as a number in `[0,1]`), re-validated against the real Azure OpenAI resource (10/10 passing), full suite re-confirmed after (49/49 suites, 329/329 tests — one unrelated suite, `story-4.3.derived-connector-health.contract.test.ts`, hit a transient Key Vault delete-key hook timeout under full-suite load, confirmed passing cleanly in isolation, 6/6, not a regression). No new story/ADR — an additive field extension to Story 2.9's own already-built connector, not a new architectural decision.

## 2026-08-10, later still the same day — Healing: Story 6.3's connect/disconnect flow was a static placeholder — social-listening-admin@1dbd26a

- **Full commit:** `1dbd26a6e8a9f0180d25f8dd22df8fea73b656da`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.3 / ADR-0034 (connect/disconnect CRUD), ADR-0027 (disclosure requirement) — no new ADR, a healing pass against Story 6.3's own already-Accepted source
- **Contract:** social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts (rewritten); social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts (upgraded, cross-component regression fix)
- **SKILL.md:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md (rewritten to the current template format — the prior version predated it)
- **Files touched:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.3.connector-connect-disconnect.contract.test.ts, social-listening-admin/src/app/api/connectors/[platformId]/connect/route.ts, social-listening-admin/src/app/api/connectors/[platformId]/disconnect/route.ts, social-listening-admin/src/app/tenant/connectors/ConnectForm.tsx, social-listening-admin/src/app/tenant/connectors/DisconnectButton.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Full suite at merge:** PASS (12/12 suites, 126/126 tests)

**Discovered while confirming whether the two new AI provider connectors (Story 2.8, Story 2.9) could actually be connected by a real tenant through the UI — they couldn't, and neither could GNews or Newswire, despite Story 6.3 being marked built.** Verified directly against the real, shipped code: `tenant/connectors/page.tsx` was a static placeholder — a hardcoded `[gnews, newswire]` array with hardcoded `connected` booleans, no credential-entry form anywhere, and no API call in `core-client.ts` to the backend's real `POST/DELETE /v1/connectors/:platformId/connect|disconnect` (Story 1.7, ADR-0034). Story 6.3's own original contract only checked the page existed and contained specific text strings ("GNews", "Newswire", "provider terms") — it never exercised a real credential submission. Both `azure-ai-language-connector/SKILL.md` and `azure-openai-connector/SKILL.md` had separately, incorrectly claimed this screen "already handles" those providers — corrected in a prior same-day commit (`social-listening-core`) before this healing pass began.

**Menno explicitly authorized treating this as a healing pass on Story 6.3 itself, under its own already-Accepted ADR-0034, rather than drafting a new story.** Walked Steps 1–5: Story 6.3's own AC1 already required "calling GET-equivalent state and POST/DELETE .../connect|disconnect... via core-client.ts" — the gap was never the story's own text, only what got built against it. `core-client.ts` gained `getConnectorStatus()`/`connectPlatform()`/`disconnectPlatform()`, following the exact `authenticatedCoreFetch()` + raw-status/body-on-action-calls pattern every other Story 6.x addition already established. Two same-origin proxy routes (`/api/connectors/[platformId]/connect|disconnect`) let the new Client Components (`ConnectForm.tsx`, `DisconnectButton.tsx`) reach core without duplicating the bearer-token attachment core-client.ts owns (ADR-0036 §2). `page.tsx` now derives each platform's connection state from a real `GET /v1/connectors/:platformId` call (`credentialStatus !== null`, the same derivation `deriveConnectorHealth()` uses server-side) rather than a hardcoded literal, and gates the tenant-wide credential option on the real resolved role, matching AC2.

**Scope expansion, explicitly authorized by Menno the same session: `azure-ai-language` and `azure-openai` (Story 2.8/2.9) were added to the connector list alongside the originally-named GNews/Newswire** — both real, shipped `AIProviderConnector`s with no way to be connected by a real tenant otherwise. `newswire` (`authMode: 'none'`) renders as always-active with no credential form, correctly reflecting it has no credential concept at all. `ConnectForm.tsx` handles both single-field (GNews's bare API key) and multi-field (Azure AI Language's `{endpoint,key}`, Azure OpenAI's `{endpoint,key,deployment}`) credentials, JSON-encoding the latter into the one opaque string the backend's credential storage (ADR-0014) expects. `DisconnectButton.tsx` uses the same two-click confirm-substate pattern `AccessControl.tsx` (Story 6.8) already established — never a native `window.confirm()` dialog, which this project's own contract style treats as untestable.

**A real, direct cross-component regression was found, attributed, and fixed under its own authorization — not silently patched or worked around.** `story-6.2.resolved-identity-migration-ripple.contract.test.ts` (a companion healing-pass file from 2026-08-06) directly imported and synchronously called the old `ConnectorsPage()` with no session at all, asserting on its old fixture-based render. That execution model no longer exists once `ConnectorsPage` became a real `async` Server Component reading a real session and calling the real backend. Per the Cross-Component Regression Protocol, this was surfaced to Menno rather than decided unilaterally; Menno's own direction ("upgrade the 6.2 role with the Platform Admin, Tenant Admin, Tenant User for now") led to upgrading, not dropping, that test — it now uses the same real-session-plus-real-fetch-mocking rigor the *main* Story 6.2 contract (`story-6.2.role-gated-routing-shell...`, untouched, unaffected by any of this) already established for `tenant/page.tsx`/`platform-admin/page.tsx`, proving all three real roles (Platform Admin redirected; Tenant Admin offered the tenant-wide option; Tenant User not) against the real `ConnectorsPage` for the first time. Two false-positive structural-check failures during this pass (a regex over-matching the implementation's own legitimate `connected: true/false` literals; a "no `window.confirm(` string" check tripped by its own doc comment mentioning the term) were both fixed by narrowing the check/rewording the comment — the same recurring, now-familiar class of self-inflicted false positive this project has hit several times before, never by weakening the underlying assertion.

**Traceability:** no story/ADR status line changed (Story 6.3 was already Ready and marked built; this is a healing pass restoring real behavior under its own already-Accepted source, the same "table tracks phase placement/build status, not incidental fixes" convention already established for comparable entries) — `.claude/skills/connector-connect-disconnect/SKILL.md` is the record of what actually changed.

## 2026-08-10, later still the same day — Healing: scripts/withDevEnv.js never loaded .env — social-listening-core@15756e0

- **Full commit:** `15756e00df0a2a74ee5027f3fe3e35af165070d3`
- **Repo:** social-listening-core
- **Story / ADR:** 1.4 / ADR-0025 — no new ADR, a healing pass against Story 1.4's own already-Accepted source
- **Contract:** social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts (extended — new AC4 assertion, same file, not a new one)
- **SKILL.md:** social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md (updated)
- **Files touched:** social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/contracts/epic-1/story-1.4-fixtures/printEnvAndArgv.js, social-listening-core/contracts/epic-1/story-1.4-fixtures/test-fixture.env, social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts, social-listening-core/scripts/withDevEnv.js
- **Full suite at merge:** PASS (49/49 suites, 330/330 tests, `--runInBand`) — one unrelated suite (`story-2.6.newswire-connector...`, live GlobeNewswire/PR Newswire network calls) failed under full-suite load and was confirmed passing cleanly in isolation (5/5), the same documented real-network-flakiness pattern this project has hit before, not a regression from this change.

**Discovered by actually using the persistent dev database infrastructure (Story 1.4) for the first time this session** — Menno asked to bring up a real, loggable-into dev environment (`npm run db:dev:up` → `db:dev:migrate` → `npm run dev`) to test real sign-up/sign-in/connector flows end to end. Adding `PORT=3001` to `.env` (needed because `social-listening-admin`'s own `.env` already expects core at `:3001`, distinct from admin's own `:3000`) had no effect — investigated rather than assumed, and found the real cause: `scripts/withDevEnv.js` never loaded `.env` at all. Only `jest.global-setup.js` did, and only for `npm test`. `npm run dev`'s real server (and `db:dev:migrate`) had only ever received this script's own hardcoded Postgres connection vars — no `ENTRA_*`, `GNEWS_API_KEY`, `AZURE_*`, or `PORT` from `.env`, for as long as this script has existed. A real, load-bearing gap in the actual dev-tooling promise Story 1.4/ADR-0025 made, not merely today's `PORT` symptom.

**Fix:** `withDevEnv.js` now calls `dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true })` before building its own forced-override env object — loaded from the script's own directory's parent (the repo root), deterministically, not `process.cwd()`-relative, matching the same "deterministic regardless of the caller's own environment" principle the file's own forced Postgres vars already establish. The forced dev-DB vars (`PGPORT`, `PGDATABASE`, etc.) still win over anything `.env` sets, re-proven by a new test using a fixture `.env` that deliberately sets a conflicting `PGPORT=9999`. `quiet: true` suppresses `dotenv`'s own default stdout banner (the "◇ injected env..." line visible throughout this project's own test runs) — without it, the banner corrupted the fixture script's own JSON-on-stdout output the new test parses.

**Two real, self-inflicted issues found and fixed during this same pass, not left as confusing failures:** (1) the new doc comment's own prose contained a literal `AZURE_*/PORT` — the `*/` sequence prematurely closed the surrounding `/** ... */` block comment, causing a genuine `SyntaxError` that also broke the two *pre-existing*, previously-passing tests in this same file (reworded to `AZURE_*, or PORT` — the same "comment text accidentally trips a mechanical check" class of bug this project has hit before in a different form, this time in real, executable code rather than a contract's own string-matching regex); (2) the new fixture `.env` file, initially named literally `.env`, was silently caught by the repo's own blanket `.env`/`.env.*` `.gitignore` pattern and would never have actually been committed — caught by checking `git status --ignored` rather than assuming `git add` had worked, renamed to `test-fixture.env` (outside the ignored pattern) rather than adding a `.gitignore` exception.

**Traceability:** no story/ADR status line changed (Story 1.4 was already Ready and marked built; this is a healing pass restoring a real capability gap under its own already-Accepted source) — `.claude/skills/postgres-tenant-db/SKILL.md` is the record of what actually changed. Placement under Story 1.4 (not Story 1.1) was discussed directly with Menno first: Story 1.1's own contract explicitly scopes itself to the repo-independence/no-coupling boundary and explicitly disclaims dev-tooling concerns, while Story 1.4's own contract already directly tests this exact file — Menno agreed Story 1.4 was the better fit.

## 2026-08-10, later still the same day — Healing: real Platform Admin sign-in blocked by missing OAuth scope and an oid-vs-sub seed error — social-listening-admin@dba9895

- **Full commit:** `dba98958df63edd3e9d2c1ff0bc0dc2d96cdfb2b`
- **Repo:** social-listening-admin (this workspace repo, per its own pre-split note — see `docs/adr/0029-...md`'s own Amendment Log entry below for the `social-listening-core`-side finding this same investigation produced)
- **Story / ADR:** 6.1 / ADR-0036 — no new ADR, a healing pass against Story 6.1's own already-Accepted source; also resolves an Open Question on ADR-0029 §2
- **Contract:** social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts (extended — new AC13, same file, not a new one)
- **SKILL.md:** social-listening-admin/.claude/skills/admin-auth-session/SKILL.md (updated); social-listening-core/.claude/skills/identity-resolution/SKILL.md (updated, cross-repo finding from the same investigation)
- **Files touched:** docs/adr/0029-authentication-mechanism-entra-external-id.md, social-listening-admin/.claude/skills/admin-auth-session/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/src/lib/entra.ts, social-listening-core/.claude/skills/identity-resolution/SKILL.md
- **Full suite at merge:** PASS (social-listening-admin: 12/12 suites, 129/129 tests; social-listening-core: 49/49 suites, 330/330 tests)

**Discovered live, while Menno manually tested sign-in as a real, freshly-seeded Platform Admin account for the first time** — the account kept landing on the tenant shell instead of `/platform-admin`. Diagnostic logging (temporarily added to `entraAuthMiddleware.ts` and `core-client.ts`, removed after use in this same commit) proved the request from `social-listening-admin` never reached `social-listening-core` successfully at all: `jwtVerify()` was failing with "signature verification failed" on every call. Root cause: `ENTRA_SCOPES` (`src/lib/entra.ts`) requested only `openid profile email offline_access` — no scope naming `social-listening-core`'s own API app registration — so Entra never minted a token audienced for it. This blocked every authenticated admin→core call, not just `/v1/me`: self-service tenant sign-up (`POST /v1/tenants/self-service-signup`) failed the identical way, confirmed live (`/sign-up/error`).

**Fix:** exposed a delegated `access_as_user` scope on `social-listening-core`'s app registration (Expose an API — distinct from its pre-existing `Application`-type `Api.Access` app role, which stays for `client_credentials`/M2M use and is unrelated to this flow), granted + admin-consented it on `social-listening-admin`'s own registration, and added `api://social-listening-core/access_as_user` to `ENTRA_SCOPES`. New AC13 guards the scope string itself via source inspection (a live import of `entra.ts` fails under Jest's default CJS transform — it pulls in `openid-client`/`oauth4webapi`, ESM-only — matching the same pattern AC8 already uses for the same reason).

**A second, independent defect surfaced once the scope fix let a real request through:** the hand-seeded `platform_admins.external_subject` was the Entra admin center's own "Object ID" field value (`oid`), not the token's `sub` claim `resolveIdentity()` actually matches on. A real captured token proved the two are genuinely different values in this tenant (`sub: 'bVBSvuGYJUxTMGztMsP2PDh0OerXd0Qvhu5Kd1vlvLU'` vs `oid: '1cbadfcc-e5d7-4257-9442-15a5f5cdba3d'`, same sign-in) — resolving ADR-0029 §2's own open, previously-conflicting-documentation question with primary evidence. Corrected the seeded row directly against the persistent dev database (not a migration — hand-seeded data, per `identity-resolution/SKILL.md`'s own note that real provisioning isn't designed yet) and documented the gotcha in that same SKILL.md so a future hand-seed doesn't repeat it. Confirmed fixed end-to-end: a real, fresh Platform Admin sign-in now lands directly on `/platform-admin`.

**Traceability:** no story/ADR status line changed for Story 6.1 (already Ready and marked built; this is a healing pass) — `admin-auth-session/SKILL.md` and `identity-resolution/SKILL.md` are the record of what actually changed. `docs/adr/0029-authentication-mechanism-entra-external-id.md`'s own Open Questions section and Amendment Log carry the `oid`-vs-`sub` resolution directly, per that file's own governance convention (dated note, Decision/Consequences text unedited).

## 2026-08-10, later still the same day — Healing: Story 6.2 — a successful platform_admin sign-in landed on / with only a manual link — social-listening-admin@35b70a8

- **Full commit:** `35b70a822353fc0b5641a8da4007a932aca3d03f`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.2 / ADR-0035/ADR-0036 — no new ADR, a healing pass against Story 6.2's own already-Accepted source
- **Contract:** social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts (extended — two new cases, same file, not a new one)
- **SKILL.md:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md (unchanged — no new load-bearing constraint introduced beyond what that file already documents; the fix is a narrow, single-page addition)
- **Files touched:** social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/src/app/page.tsx
- **Full suite at merge:** PASS (social-listening-admin: 12/12 suites, 129/129 tests)

**Menno's own explicit request, found while manually testing real sign-in as each seeded/self-service role:** "can you make sure when a platform-admin login is sucessful the platform admin is forwarded to platform-admin page." A confirmed, real gap — no prior contract asserted this either way: `page.tsx` rendered a "Signed in" state for every identity, including `platform_admin`, but only ever offered the tenant-shell action list plus a manual "Open Platform Admin" link buried in an unreachable branch once role-gating (Story 6.2's own earlier healing pass) redirected `/platform-admin` and `/tenant` themselves — the root page itself was never brought in line with that same gating.

**Fix:** `page.tsx` now checks `getRoleShell(identity)` and `redirect('/platform-admin')` immediately for a `platform_admin` session, before rendering anything — the old "Platform Admin shell" branch (manual link) was removed entirely since it's now unreachable by construction. A tenant identity's own root-page experience (action list, manual "Open tenant shell" link) is deliberately untouched, per Menno's own follow-up scoping: root (`/`) is to become "a tenant admin/user overview dashboard" over time, not rebuilt here. Two new cases added to Story 6.2's own contract, using the same real-`encryptSession()`-plus-mocked-`redirect()` pattern the file's other AC2 cases already established: a `platform_admin` session requesting `/` is redirected straight to `/platform-admin` (asserted via the thrown-`NEXT_REDIRECT` convention this file's other redirect cases already use), and a `tenant_admin` session requesting `/` still renders the tenant shell, unredirected.

**Confirmed working end-to-end in the same live debugging session that produced this fix**, once the separate, deeper OAuth-scope/oid-vs-sub defect (logged in the entry directly above this one) was also fixed — a real, fresh Platform Admin sign-in now lands directly on `/platform-admin`, no manual click required.

**Traceability:** no story/ADR status line changed (Story 6.2 was already Ready and marked built; this is a healing pass restoring a real, named gap under its own already-Accepted source) — this log entry plus the contract's own extended header comment are the record of what changed.

## 2026-08-10, later still the same day — Healing: Story 5.15 — self-service tenant founder never consumed a seat — social-listening-core@f36d765

- **Full commit:** `f36d765af41efe84c8c9df6a882a33d5b9ae53a9`
- **Repo:** social-listening-core
- **Story / ADR:** 5.15 / ADR-0037 — no new ADR, a healing pass against Story 5.15's own already-Accepted source
- **Contract:** social-listening-core/contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts (extended — new assertion (10), same file, not a new one)
- **SKILL.md:** social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md (updated)
- **Files touched:** social-listening-core/.claude/skills/self-service-tenant-signup/SKILL.md, social-listening-core/contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts, social-listening-core/src/tenants/selfServiceSignup.ts
- **Full suite at merge:** PASS (49/49 suites, 330/330 tests)

**Found live, immediately after completing the full sign-up -> invite -> activation loop manually for the first time** (the same session as the two healing passes logged directly above): a self-service-created tenant's own `tenants.settings` screen showed "1 of 5 seats used" despite two real, active users existing — the founding `tenant_admin` (self-service sign-up) and a freshly-invited-and-activated `tenant_user`. Confirmed directly against the database (`active_seat_count: 1`, not 2), then traced to `provisionTenantViaSignup()` (`selfServiceSignup.ts`): it inserts the founding user directly via `withTenant()`/`app_user`, but never calls `incrementActiveSeatCount()` — unlike `resolveIdentity()`'s own invite-activation path (`identityResolution.ts` case 3), which does. Neither Story 5.15's own Acceptance Criteria nor its original contract ever named this behavior either way — a genuine, previously unencoded gap, not a contradicted assertion (confirmed by re-reading both fresh, heal-contract-failure Steps 1–2).

**Practical consequence, not just a cosmetic undercount:** every self-service-created tenant permanently undercounts its own founder by one seat, letting `POST /v1/tenants/users`'s own 409 seat-ceiling check (Story 1.9) admit one more invite than the tenant's real `license_seat_count` actually allows.

**Fix:** `provisionTenantViaSignup()` now calls `incrementActiveSeatCount(tenant.id)` immediately after the founding user's own `INSERT` succeeds, and returns the updated tenant (reflecting the incremented count) rather than the pre-increment one. A freshly-created tenant always has room (`active_seat_count` starts at 0, `license_seat_count` defaults to a hardcoded 5 for self-service tenants), so the theoretical `null`-return/at-capacity branch cannot realistically occur here — handled defensively anyway (falls back to the pre-increment tenant object) rather than assumed impossible. New assertion (10) in Story 5.15's own contract proves `active_seat_count` reads back as 1 directly against the database after a single successful signup, the same "not just the HTTP response" discipline the rest of that contract already uses. The real tenant created during this session's own manual testing was corrected directly in the persistent dev database (`active_seat_count` set to the real value, 2) — not a migration, since this was live test data, not a schema change.

**Traceability:** no story/ADR status line changed (Story 5.15 was already Ready and marked built; this is a healing pass restoring a real, previously-untested gap under its own already-Accepted source) — this log entry plus the contract's own extended header comment and the SKILL.md's new Load-bearing constraint are the record of what changed.

## 2026-08-12 — Story 1.5 — social-listening-core@aaf6bd7

- **Full commit:** `aaf6bd72f312ce7df0dc60a376f2f893f3e1508c`
- **Repo:** social-listening-core
- **Story / ADR:** 1.5 / ADR-0044
- **Contract:** social-listening-core/contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/watchlist-crud/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/watchlist-crud/SKILL.md, social-listening-core/contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts, social-listening-core/contracts/epic-3/story-3.8.self-service-tenant-initiated-deletion.contract.test.ts, social-listening-core/contracts/epic-5/story-5.10.retire-x-tenant-id.contract.test.ts, social-listening-core/migrations/0025_watchlists_ownership_and_versioning.sql, social-listening-core/src/db/withTenant.ts, social-listening-core/src/http/versions/v1/watchlistsRouter.ts, social-listening-core/src/tenants/tenantDeletion.ts, social-listening-core/src/watchlists/watchlistStore.ts
- **Full suite at merge:** PASS (49/49 suites, 335/335 tests, `--runInBand`)

**Full rebuild of Story 1.5's pre-existing "also build, not storied" watchlist CRUD surface against ADR-0044** (Accepted 2026-08-11), not an extension — the prior contract asserted none of ADR-0044's actual decisions. `migrations/0025_watchlists_ownership_and_versioning.sql` adds `version integer not null default 1` (§3, optimistic locking) and `user_id uuid not null references users(id) on delete cascade` (§5c, personal ownership — both `tenant_admin` and `tenant_user` may own watchlists, with **no** Tenant-Admin oversight override), extending `tenant_isolation`'s RLS policy with a second `user_id` predicate propagated via a new optional 4th parameter on `withTenant()` (`app.user_id`, set the same transaction-local way `app.tenant_id` already is). `watchlistStore.ts` was re-signed throughout for `(tenantId, userId, ...)`, gained `WatchlistPatchInput` (RFC 7396 JSON Merge Patch — a key's presence, not its value, drives omitted-vs-null-vs-replace semantics), `validateWatchlistShape()` (the §5a matchType↔terms/booleanQuery invariant, shared between create and PATCH), and an atomic, race-free `updateWatchlist()` (`UPDATE ... WHERE id = $ AND version = $ RETURNING *` in one statement, never a separate read-then-write). `watchlistsRouter.ts` gained a new `GET /v1/watchlists/:id`, `If-Match`-required optimistic locking (428 missing / 409 stale with `current_version`), and the full §2 error-code mapping (400/404/422 alongside 409/428) — 403 is never used here, since ownership is an RLS boundary, not a role check.

**A real, necessary ripple, named rather than silently absorbed:** `createWatchlist()`'s new required `userId` parameter and `watchlists.user_id`'s new hard FK meant two other already-passing contracts calling it directly needed minimal fixes — `story-3.8...` (a real `users` row now backs its `tenantAdminUserId` before the FK can reference it) and `story-5.10...` (AC2/AC3 needed a single consistent real caller identity between their create and list calls, since ownership-scoped RLS now means only the creating user's own identity can see what it created — both ACs test tenant isolation specifically, not ownership, so this keeps that distinction clean rather than confounding it).

**A genuine, previously-nonexistent architectural collision was found and resolved in the same session, not worked around or left for later** — surfaced to Menno directly before any fix was written, per this project's own Cross-Component Regression Protocol. `watchlists` becoming the first table in this project with per-user ownership RLS broke two of Story 3.8's (ADR-0043) already-accepted, already-passing behaviors, both of which structurally need every watchlist in a tenant regardless of which individual user owns it: (1) `exportTenantData()`'s whole-tenant compliance export silently returned zero watchlists (its `withTenant()` call never set `app.user_id`, so the new RLS predicate matched nothing); (2) `executeTenantDeletion()`'s hard-delete pipeline hung indefinitely — `batchDeleteByTenant('watchlists', ...)` was silently blocked the same way, so the very next step (deleting the tenant's `users` rows) hit a foreign-key violation against the watchlist rows that were never actually removed, inside an un-awaited async function, with no visible error and no completion signal. Menno's chosen resolution (of three options offered): `ON DELETE CASCADE` on `watchlists.user_id` (closes the delete-hang — a watchlist disappearing when its owner does is correct behavior generally, not a workaround adopted only for Story 3.8) plus a narrow, explicitly `tenant_id`-scoped `getAdminPool()` read inside `exportTenantData()` for the watchlists sub-query only (closes the export gap) — deliberately never `platform_admin_role`, which keeps its already-accepted zero-access boundary to this table fully intact (Story 5.7, ADR-0030 §2, unaffected). Both fixes and the reasoning are documented in `tenantDeletion.ts`'s own dated header note and in `watchlist-crud/SKILL.md`'s "Relations to other components" section — not repeated in either file alone.

**Also fixed the same session, unrelated to the code above:** the VS Code Jest extension couldn't discover either repo's tests at all — the workspace opens at the outer `socialengage` folder, but both `jest.config.js` files live one level down, with no root Jest config or `.vscode/settings.json` entry pointing at them. Added `jest.virtualFolders` (one entry per repo) and `jest.runMode: "on-demand"` to `.vscode/settings.json` — the latter also closes a real, reproduced collision found live this session: the extension's own test run and this session's `npm test` CLI run both invoke the same `docker-compose.test.yml` project on a fixed port, and running both at once caused a 28-suite cascade of connection failures (one run's teardown killing the other's still-in-progress database) that had nothing to do with this story's own code — confirmed by a clean, uncontended 49/49 rerun immediately after. This settings-only change is not part of this commit (a separate, explicitly-requested side task, left for Menno to commit on his own terms).

**Traceability:** `docs/user-stories/epic-1-repository-and-api-foundation.md`'s Story 1.5 entry, `docs/user-stories/README.md`, and `docs/implementation-plan.md`'s Phase 1 dated notes all updated in the commit above.

## 2026-08-12, later the same day — Story 1.10 — social-listening-core@63dcbce

- **Full commit:** `63dcbced329a86999edbe2889db30f574c8c2dfd`
- **Repo:** social-listening-core
- **Story / ADR:** 1.10 / ADR-0016
- **Contract:** social-listening-core/contracts/epic-1/story-1.10.postgres-readiness-and-health.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/.claude/skills/http-api-versioning/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/http-api-versioning/SKILL.md, social-listening-core/.claude/skills/postgres-tenant-db/SKILL.md, social-listening-core/contracts/epic-1/story-1.10.postgres-readiness-and-health.contract.test.ts, social-listening-core/src/db/postgresReadiness.ts, social-listening-core/src/http/server.ts, social-listening-core/src/http/versions/v1/router.ts
- **Full suite at merge:** PASS (50/50 suites, 343/343 tests, `--runInBand`)

**Drafted 2026-08-11 from a live-session question, built 2026-08-12.** Closed a real, confirmed gap: `server.ts` called `createApp().listen(port, ...)` with no database check of any kind beforehand, and `getPool()` is a lazy singleton — Postgres unavailability was only ever discovered reactively, on whichever request happened to touch the database first. `GET /v1/health` (Story 1.3/ADR-0017) was an unconditional `{status:'ok'}` placeholder that never touched the database at all.

**Fix:** `src/db/postgresReadiness.ts` (new) splits the concern in two — `checkPostgresConnectivity(pool)` is a single, bounded-timeout `SELECT 1` that never throws (resolves `false` on any failure), used directly and per-request by `GET /v1/health` so an outage is reflected immediately rather than masked behind a retry loop; `waitForPostgresReady(pool, options)` wraps it in a bounded retry-with-backoff loop (5 attempts, 500ms backoff, 3000ms per-attempt timeout, all overridable), used once by `server.ts` before `.listen()`, throwing a clear, actionable Error only after exhausting its attempts. `server.ts` now awaits this, logs the error, and calls `process.exit(1)` on failure — it never starts listening in a state where every tenant-scoped request would fail. `GET /v1/health` now returns `200 {status:'ok'}` or `503 {status:'unavailable'}`, still deliberately public/unauthenticated (Story 1.3's own boundary, untouched — becoming database-aware changed the response, not the auth requirement).

**Proven against real, genuinely-unreachable connections throughout — no mocking**, matching this project's established style: `checkPostgresConnectivity()`/`waitForPostgresReady()` are tested directly against both the real, reachable test-Postgres pool and a real `Pool` pointed at a port nothing listens on; the 503 case is proven by loading a second, isolated copy of `app.ts`/`pool.ts` (`jest.isolateModules()`) with `PGPORT` temporarily overridden to an unreachable value, so the real test-database pool used by every other test in the suite is never disturbed. The real `server.ts` entrypoint itself is spawned as a real child process for both boot paths (mirroring `social-listening-admin`'s own established `next dev`-spawning precedent, Stories 6.1/6.7) — proving the unreachable case exits non-zero with a Postgres-identifying stderr message and never starts listening, and the reachable case actually binds and answers a real HTTP request.

**A real, self-contained infrastructure bug was found and fixed during this same build, not left as a flaky test:** the first run of the unreachable-Postgres spawned-process test left a genuine, still-listening zombie `ts-node src/http/server.ts` process behind, discovered directly via `Get-NetTCPConnection` still owning port 3998 well after the test process itself had exited, and confirmed to be blocking a subsequent full-suite run. Root cause: on Windows, `spawn(..., {shell: true})` (required to invoke a `.cmd` shim at all) makes the returned PID `cmd.exe`, not the real `node` process underneath — plain `child.kill()` only kills that wrapper. Fixed with a Windows-specific `taskkill /pid <pid> /T /F` (whole process tree) in the test's own cleanup helper, verified clean (no leftover port ownership) on rerun.

**Traceability:** `docs/user-stories/epic-1-repository-and-api-foundation.md`'s Story 1.10 entry, `docs/user-stories/README.md`, and `docs/implementation-plan.md`'s Phase 0 dated note all updated in the commit above.

## 2026-08-12, later still the same day — Story 2.10 — social-listening-core@f2c7788

- **Full commit:** `f2c7788f4d21c971ed93488e5939392bf98504bb`
- **Repo:** social-listening-core
- **Story / ADR:** 2.10 / ADR-0048
- **Contract:** social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/gnews-connector/SKILL.md, social-listening-core/.claude/skills/newswire-connector/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts
- **Full suite at merge:** PASS (51/51 suites, 355/355 tests, `--runInBand`)

**ADR-0048's policy — "registering a connector must never require editing core ingestion orchestration" — made durable and mechanically checked, not left as a narrative promise.** The contract test (`CORE_FILES`: `runIngestionAttempt.ts`, `ingestionRunStore.ts`, `errorClassification.ts`, `registry.ts`, `requestGate.ts`, `rateLimitResolution.ts`, `connectorHealth.ts`, `connectorHealthCache.ts`, `types.ts`, `connectorsRouter.ts`) proves none of the four real connectors' (GNews, Newswire, Azure AI Language, Azure OpenAI) own `providerId` string literals appear in any of them — confirming, for real shipped code, an invariant that had only ever been true by convention until now. No production code changed.

**Resolved ADR-0048's own three left-open questions as implementation defaults, per this project's established pattern (Story 5.11's precedent):** (1) enforcement mechanism — a Jest contract test under the existing `npm test`/CI step, not a separate CI script, matching `http-api-versioning/SKILL.md`'s already-established "the accumulated contract suite is the check" convention; (2) the extension-point allowlist — the test's own `CORE_FILES` constant *is* the allowlist (its complement, precisely), extended there directly whenever a new core file is introduced, rather than maintained in a second location; (3) deprecation/removal PRs — deliberately left out of scope, since no such story exists yet and the ADR names this as genuinely unresolved.

**A real false positive was found and fixed during the build, not silently tolerated:** the first version of the check used a bare substring match (`source.includes(providerId)`), which flagged `types.ts`'s own doc comment referencing `azure-ai-language-connector/SKILL.md` by path — a maintainer cross-reference, not a hardcoded core-pipeline branch. Fixed by matching the provider id only as a real quoted string literal (`['"]providerId['"]`, the shape an actual `providerId === 'x'` branch or `case 'x':` would take), which correctly passes on the doc comment while still catching a genuine hardcoded reference.

**Documentation:** each real connector's own SKILL.md gained a "Registration transparency (ADR-0048)" section (registration location, extension points used, verification method); `provider-connector-framework/SKILL.md` gained a matching cross-reference and a new Load-bearing constraint naming the invariant and where to extend `CORE_FILES`.

**Traceability:** `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`'s Story 2.10 entry (also fixed a pre-existing title typo, "Transparantly registration" → "Transparency"), `docs/user-stories/README.md`, and `docs/implementation-plan.md`'s Phase 2 dated note all updated in the commit above.

## 2026-08-12, later still the same day — Story 2.11 — social-listening-core@afcb59e

- **Full commit:** `afcb59ed8e7dee15d261dbee6c5860783f3c6c8b`
- **Repo:** social-listening-core
- **Story / ADR:** 2.11 / ADR-0050
- **Contract:** social-listening-core/contracts/epic-2/story-2.11.tenant-owned-feed-connector.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/tenant-owned-feed-connector/SKILL.md, social-listening-core/contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts, social-listening-core/contracts/epic-2/story-2.11.tenant-owned-feed-connector.contract.test.ts, social-listening-core/migrations/0026_create_tenant_owned_feed_activations.sql, social-listening-core/src/connectors/tenantOwnedFeed/dnsVerification.ts, social-listening-core/src/connectors/tenantOwnedFeed/feedItemParser.ts, social-listening-core/src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedConnector.ts, social-listening-core/src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/tenantOwnedFeedRouter.ts
- **Full suite at merge:** PASS (52/52 suites, 370/370 tests, `--runInBand`)

**The fourth real, non-example `SocialConnector` (ADR-0050), and the first with a domain-ownership trust gate.** `dnsVerification.ts` implements the same protocol Google Workspace and Microsoft 365 use for domain verification (both primary-sourced in ADR-0050's own Context): a unique token, published as a TXT record at `_socialengage-verify.<domain>` (resolving Open Question 1 as subdomain-level scoping, the Stripe-style pattern), checked via a real `dns.promises.resolveTxt()` lookup. `POST /connectors/tenant-owned-feed/connect` creates a `pending` activation and returns the TXT instructions; `POST .../verify-domain` checks the real record and marks it `verified` on match, or returns `{status:'pending', retryAfter}` — never a hard failure — on a missing/mismatched one. `pollTenantOwnedFeed()` only ever iterates `getVerifiedActivations()`'s own result (a `WHERE status = 'verified'` filter at the SQL layer) — the actual mechanism behind "polling never begins while pending," not a runtime check inside the fetch loop. Once verified, ingestion runs through the ordinary `runIngestionAttempt()` pipeline exactly like every other connector; `Author.externalAuthorId` is the verified domain itself (organization-as-Author, citing ADR-0004's now-generalized clause from Newswire/GNews's own precedent rather than re-arguing the exception), `followerCount` unpopulated. Every fetch sets a real, self-identifying `User-Agent` (`TENANT_OWNED_FEED_USER_AGENT`) — a requirement ADR-0050 names explicitly for this connector, unlike Newswire/GNews, which predate it and don't set one (a separate, pre-existing gap, not fixed here).

**A real routing collision was found and resolved by design, not accident:** this connector's two new endpoints share the `/connectors/` prefix with the existing generic `/connectors/:platformId/connect` route. Adding them as routes inside `connectorsRouter.ts` would both violate ADR-0048/Story 2.10's own no-core-path-edit policy *and* never actually be reachable — Express's wildcard `:platformId` route would bind `'tenant-owned-feed'` as the param and fully handle the request before any later-registered router got a chance. Resolved via a dedicated `tenantOwnedFeedRouter.ts`, mounted at the more specific `/connectors/tenant-owned-feed` path *before* the generic `/connectors` mount in `router.ts` — Express tries top-level middleware in registration order, so the more specific mount intercepts first. `router.ts` itself was never on Story 2.10's own `CORE_FILES` list (every story's own one-line mount addition is the designated registration surface, by that story's own convention), so this is the correct, policy-compliant way to add a connector-specific route pair without touching the shared router.

**AC1's own "no-core-path-edit evidence" requirement was satisfied literally, per the story's own explicit instruction not to argue a separately-weaker claim:** `story-2.10.connector-registration-transparency.contract.test.ts`'s own `REAL_CONNECTORS` array was extended to include this connector — proving its `providerId` literal is absent from every one of Story 2.10's designated core files, using that file's own already-documented "extend when a new connector is introduced" convention, not a new mechanism invented for this story.

**The one deliberate seam in this story's own contract, named and scoped narrowly:** this project controls no real domain it could publish an actual TXT record for, so the "record genuinely matches" success path is proven by spying on Node's own `dns.promises.resolveTxt` for exactly one test (restored immediately after via `mockRestore()`). Every other DNS lookup in the contract — the "missing/mismatched record" path — runs against real DNS for a real domain (`example.com`, IANA-reserved, guaranteed to carry no such record). RSS ingestion mechanics (AC5/AC6/AC10/AC12) reuse the same real, already-proven-live GlobeNewswire feed URL Story 2.6's own contract uses, decoupled from domain verification (which is marked verified directly at the store layer for those tests) — avoiding a new external-dependency risk just to prove real feed-parsing mechanics.

**Traceability:** `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`'s Story 2.11 entry, `docs/user-stories/README.md`, and `docs/implementation-plan.md`'s Phase 4 dated note all updated in the commit above.

## 2026-08-12, later still the same day — Story 3.9 — social-listening-core@34e9dfb

- **Full commit:** `34e9dfb8ae712a992ae275d6eb82221c64f9a3d8`
- **Repo:** social-listening-core
- **Story / ADR:** 3.9 / ADR-0049
- **Contract:** social-listening-core/contracts/epic-3/story-3.9.author-follower-count-at-publish.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-3-data-model-storage-and-archival.md, social-listening-core/.claude/skills/provider-connector-framework/SKILL.md, social-listening-core/.claude/skills/social-post-lineage/SKILL.md, social-listening-core/contracts/epic-3/story-3.9.author-follower-count-at-publish.contract.test.ts, social-listening-core/migrations/0027_add_social_posts_author_follower_count_at_publish.sql, social-listening-core/src/connectors/types.ts, social-listening-core/src/posts/socialPostStore.ts
- **Full suite at merge:** PASS (53/53 suites, 379/379 tests, `--runInBand`)

**A single, scoped exception to ADR-0004's normalized `Author` model, added exactly as narrowly as ADR-0049 specifies.** `migrations/0027_add_social_posts_author_follower_count_at_publish.sql` adds one nullable `INTEGER` column, no `DEFAULT`, no backfill `UPDATE` — existing rows read `NULL`, by construction, per ADR-0049's own "does not retroactively populate existing rows" consequence. The column carries a real `COMMENT ON COLUMN` (queryable via `col_description()`, not just prose in the migration file) documenting the three-way `NULL` ambiguity ADR-0049's own Open Question 1 named: connector-type null, platform-omitted null, pre-migration null.

**`Author.followerCount` itself was not touched, and Story 3.1's own contract was not modified** — the full-suite run is what re-proves AC4 on every merge, not a duplicated assertion in this story's own contract.

**Open Question 5 (the connector capability-declaration shape) resolved as `SocialConnector.canProvideFollowerCountAtPublish`** — a boolean, analogous in shape to `supportedQueryFeatures` (the ADR's own suggested precedent), added to `types.ts` alongside `NormalizedPost.authorFollowerCountAtPublish`. Since no real individual-account connector exists yet (Reddit remains unbuilt), the round-trip mechanism — a connector declares the flag, `normalize()` sets the field, it flows through `insertSocialPost()`'s own new parameter into the column — is proven with an inline, test-local connector object rather than a real platform, named explicitly in both the contract and this entry so it isn't mistaken for a real connector capability shipped by this story.

**Newswire and GNews were deliberately left untouched — proving AC5 by omission, not by writing a test that skips real assertions.** Their own real, unmodified poll functions (`pollNewswireFeeds()`, `pollGNewsSearch()`, live network calls, same feeds/credentials already used elsewhere in this suite) were run end to end in this story's own contract, and the resulting `social_posts` rows were queried directly to confirm `author_follower_count_at_publish IS NULL` — since neither connector's `normalize()` was changed to set the new optional field, this is a genuine behavioral proof of the "connector-type null" case, not an assumption.

**No API surface change** — `SocialPostFull`/`SocialPostSummary` (and therefore `GET /posts`, `getSocialPostById`) do not expose the new field; proven by asserting the returned objects' own key sets don't contain it, not just by not adding it.

**Traceability:** `docs/user-stories/epic-3-data-model-storage-and-archival.md`'s Story 3.9 entry, `docs/user-stories/README.md`, and `docs/implementation-plan.md`'s Phase 4 dated note all updated in the commit above.

## 2026-08-12, later still the same day — Correction: the 2026-08-01 Story 1.5 entry cites the wrong commit hash — social-listening-core@f317ace

*Correction, not a healing pass or new story work — no code changed by this entry. Per this file's own append-only convention ("corrections get a new dated entry that references the one being corrected"), the original entry below is left exactly as written; this entry is the correction of record.*

- **Full commit:** `f317acea0c2496911a610d94c209e50f52ca2d5e`
- **Repo:** social-listening-core
- **Story / ADR:** 1.5 / Phase 1 "also build, not storied" work (correcting the citation only — no change to Story 1.5's own status, scope, or its later 2026-08-12 rework, logged separately above under `social-listening-core@aaf6bd7`)
- **Contract:** social-listening-core/contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/watchlist-crud/SKILL.md
- **Files touched:** docs/implementation-log.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/watchlist-crud/SKILL.md, social-listening-core/contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts, social-listening-core/migrations/0014_create_watchlists.sql, social-listening-core/src/http/versions/v1/router.ts, social-listening-core/src/http/versions/v1/watchlistsRouter.ts, social-listening-core/src/watchlists/watchlistStore.ts
- **Full suite at merge:** N/A — this entry corrects a citation; the original build's own suite result (132/132) is unchanged and already recorded below.

**The entry titled "2026-08-01 — Story 1.5 — social-listening-core@1fb3e55" cites a real but wrong commit.** `1fb3e554607fb419a0ec20176d373117b16e7dd0` exists and is genuine, but it's "Add future-subsystems scope tracking and open-items snapshot" — a separate, unrelated docs commit touching `docs/future-subsystems.md` and `docs/open-items-and-deferred-work.md`, not Story 1.5's actual build. Found by `docs/templates/check-implementation-log.cjs` during this session's own routine verification passes (run repeatedly before appending later, unrelated entries for Stories 1.10/2.10/2.11/3.9 — surfaced each time as `FAIL: entry "2026-08-01 — Story 1.5..." file list doesn't match commit ...`), left uncorrected until Menno directly asked for it to be fixed.

**The real commit, confirmed directly, not assumed:** `git log --follow --diff-filter=A -- social-listening-core/src/watchlists/watchlistStore.ts` finds exactly one commit that ever created that file — `f317acea0c2496911a610d94c209e50f52ca2d5e`, dated 2026-08-01, message "Add Story 1.5: Watchlist CRUD REST surface". Its own real file list (`git show --stat`, cited above) matches the original entry's own claimed list almost exactly. The one discrepancy: the original entry additionally claimed `docs/open-items-and-deferred-work.md`, which `f317ace` does not touch — no commit around that date touches that file in connection with Story 1.5's own work either, so that claim appears to have been a drafting error in the original entry's own text, not evidence of a second missing commit.

**The original entry is unedited** — anyone verifying `## 2026-08-01 — Story 1.5 — social-listening-core@1fb3e55` going forward should cross-reference this entry for the real commit hash, `f317acea0c2496911a610d94c209e50f52ca2d5e`.

---

## 2026-08-12, later still the same day — Story 6.4 — social-listening-admin@fded97b

- **Full commit:** `fded97b08813d7ab686582410c7d99668e5d4eac`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.4 / ADR-0044 (via Story 1.5's reworked REST surface — no new ADR of its own)
- **Contract:** social-listening-admin/contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/watchlist-management/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-admin-ui.md (renamed to epic-6-tenant-admin-ui.md), docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/watchlist-management/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts, social-listening-admin/src/app/api/watchlists/[id]/route.ts, social-listening-admin/src/app/api/watchlists/route.ts, social-listening-admin/src/app/tenant/watchlists/WatchlistForm.tsx, social-listening-admin/src/app/tenant/watchlists/WatchlistRow.tsx, social-listening-admin/src/app/tenant/watchlists/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Full suite at merge:** PASS (12/12 suites, 153/153 tests)

**Real rework, correcting the 2026-08-05 "Built" mark that turned out to be fixture-only (see this session's earlier drafting-pass note, `docs/user-stories/epic-6-tenant-admin-ui.md`'s own Story 6.4 entry).** `src/app/tenant/watchlists/page.tsx` is now a real async Server Component: `GET /v1/watchlists` (no fixture data), create/edit via `WatchlistForm.tsx` (RFC 7396 merge-patch on edit — only fields that actually differ, plus `terms`/`booleanQuery` whenever `matchType` itself changes, per ADR-0044 §5a's invariant on the resulting merged row — `If-Match`/version-based optimistic locking, `409`/`428`/`422` each handled distinctly), a dedicated single-field `isActive` toggle and a two-click delete confirm via `WatchlistRow.tsx`, and four new `core-client.ts` functions (`listWatchlists()`, `createWatchlist()`, `updateWatchlist()`, `deleteWatchlist()`) proxied through `src/app/api/watchlists/route.ts` and `src/app/api/watchlists/[id]/route.ts`. Platform scoping is deliberately narrowed to real `SocialConnector` platforms only (`gnews`, `newswire`) — not Story 6.3's broader connect/disconnect list, which also includes AI enrichment providers a watchlist cannot legitimately be scoped to.

**A real cross-component regression was found and healed in the same pass, via `heal-contract-failure`, not worked around.** `contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts`'s own "Story 6.4" block still called the retired synchronous fixture `WatchlistsPage()` directly, unmocked — the identical category of ripple Story 6.3 already caused on 2026-08-10 in this same file when its own page made the same fixture-to-real migration. Root-caused directly, not assumed: stashed this story's changes, confirmed the ripple contract passed 23/23 on the clean baseline, restored the changes, confirmed it failed with Next.js's own real `cookies() called outside a request scope` error. Healed by upgrading that block to the identical real-session-plus-real-fetch-mocking pattern the Story 6.3 block in the same file already established, per that file's own documented precedent for exactly this migration category — not a new decision, and Story 6.4's own dedicated contract was not touched by this healing pass.

**Also carries this session's earlier, already-reviewed-live-in-conversation Epic 6 → Epic 6 (Tenant Admin UI) + Epic 7 (Platform Admin UI) split and Stories 6.13/6.14 drafts**, left uncommitted until this build per the "draft only, review before building" scope this session established — folded into this commit since `docs/user-stories/README.md`/`docs/implementation-plan.md`'s own traceability notes are interleaved with this story's build note in the same files.

---

## 2026-08-12, later still the same day — Story 6.5 — social-listening-admin@4046e75

- **Full commit:** `4046e75598214371efa888fbe6bca049e01bd1dd`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.5 / ADR-0009, ADR-0022, ADR-0023 (via Story 4.3's derived `ConnectorHealth` — no new ADR of its own)
- **Contract:** social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/connector-status-view/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.2.resolved-identity-migration-ripple.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- **Full suite at merge:** PASS (12/12 suites, 160/160 tests)

**Real rework, correcting the 2026-08-05 "Built" mark that turned out to be fixture-only — same root cause as Story 6.4, fixed the same session.** `src/app/tenant/connectors/status/page.tsx` is now a real async Server Component: a real `GET /v1/connectors/:platformId` call per connected platform (derived the same way `tenant/connectors/page.tsx`, Story 6.3, already does — a locally duplicated `PLATFORMS` array, pending a real "list this tenant's connectors" endpoint, an unchanged, already-named gap), rendering the real `ConnectorHealth` shape (`status`/`lastSuccessfulFetchAt`/`lastAttemptAt`/`consecutiveFailures`), with `failing` rendered materially distinct from `degraded`/`healthy`.

**A real, previously-unnamed gap was found while scoping this rework and deliberately not built, not silently dropped or faked.** The original AC's `unsupportedNodeTypes` watchlist-compatibility warning (surfacing which boolean-query features a connector can't natively evaluate) requires `resolveWatchlistAstDispatch()` (`social-listening-core/src/watchlists/dispatch.ts`) — confirmed directly to be a core-internal function with no REST endpoint exposing its result anywhere; its own doc comment already says as much ("no such view exists yet, so this is proven at the data level only," Story 3.6 AC2). Building one is real, non-trivial `social-listening-core` scope, outside this story's own Source line (Story 4.3's `ConnectorHealth` only) — the screen's own copy names the gap explicitly instead of rendering a fake or static warning.

**Proactively healed the identical `story-6.2` ResolvedIdentity-migration-ripple regression this session's Story 6.4 build already caused and fixed once, ahead of a failing run this time** — `story-6.2.resolved-identity-migration-ripple.contract.test.ts`'s own "Story 6.5" block still called the old synchronous fixture `ConnectorStatusPage()` directly, unmocked; upgraded to the identical real-session-plus-fetch-mocking pattern already established for Story 6.4's own fix earlier the same session, per that file's own now-twice-used precedent.

---

## 2026-08-12, later still the same day — Story 6.6 — social-listening-admin@51eecf0

- **Full commit:** `51eecf0270472fb6d30f30bca3a53b6d0a9557f8`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.6 / ADR-0030, ADR-0031, ADR-0035 (all Accepted — no new ADR)
- **Contract:** social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/platform-admin-console/SKILL.md
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-7-platform-admin-ui.md, social-listening-admin/.claude/skills/platform-admin-console/SKILL.md, social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/break-glass/request/route.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/break-glass/requests/[requestId]/execute/route.ts, social-listening-admin/src/app/api/admin/tenants/[tenantId]/route.ts, social-listening-admin/src/app/api/admin/tenants/route.ts, social-listening-admin/src/app/platform-admin/BreakGlassPanel.tsx, social-listening-admin/src/app/platform-admin/ProvisionTenantForm.tsx, social-listening-admin/src/app/platform-admin/TenantAdminControls.tsx, social-listening-admin/src/app/platform-admin/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Full suite at merge:** PASS (12/12 suites, 178/178 tests)

**Real rework, correcting the 2026-08-05 "Built" mark — the third and last of this session's batch of three, same root cause as Stories 6.4/6.5.** "Provision tenant," "Update tenant," and "Break-glass" were each a single descriptive `<p>` with zero interactivity, despite `createAdminTenant()`/`updateAdminTenant()`/`requestBreakGlassReset()`/`executeBreakGlassRequest()` already existing as real, working functions in `core-client.ts` that nothing called. Tenant registry and Audit log were already real and needed no rework. Rebuilt: `ProvisionTenantForm.tsx` (`POST /v1/admin/tenants`), `TenantAdminControls.tsx` (one per tenant row, `PATCH` scoped to exactly `status`/`licenseSeatCount`, never `domain`/`activeSeatCount`), and `BreakGlassPanel.tsx` (the real ADR-0030 §3 two-phase flow — a request control, then a separate execute control only offered once the request's own `id` is held in local component state; the returned `temporaryAccessPass` is rendered from that same local state exactly once and never persisted — no `console.log`, no browser storage API, no reload immediately after execute, matching `breakGlassCredentialReset.ts`'s own single-disclosure constraint). Added a database health indicator (2026-08-12) reading Story 1.10's already-real, unauthenticated `GET /v1/health`. `core-client.ts`'s four mutation functions were converted from throw-on-non-2xx to the raw `{status, body}` outcome pattern already used elsewhere for mutations — a safe signature completion, since nothing called any of the four before this rework.

**A real, self-contained Next.js routing bug was found and healed via `heal-contract-failure`, not worked around.** The new tenant-update `PATCH` route was first added at `src/app/api/admin/tenants/[id]/route.ts` — a sibling, at the same path position, of the break-glass routes' own `[tenantId]/...` directory. The Next.js App Router requires every dynamic segment at one path position to share a single parameter name; `[id]` and `[tenantId]` coexisting there broke the whole route tree's compilation, which surfaced as every *other* spawned-dev-server contract in the repo failing to become ready — confirmed directly, not assumed: Story 6.7's own contract (`story-6.7.self-service-signup...`, entirely unrelated to this story) went from 17/17 passing in ~4s to timing out after 185s. Root-caused by isolating the change (`git stash`, confirmed Story 6.7 passed cleanly on the baseline, restored the change, confirmed it failed identically) before touching anything, following this session's own established discipline from the Story 6.4 healing pass. Fixed by renaming the route to `[tenantId]/route.ts`, matching its siblings.

**This closes out the batch of three "Built in error" corrections found during this session's second drafting pass — Stories 6.4, 6.5, and 6.6 are all now real, contract-verified builds**, not fixture-backed screens that merely claimed to be.

---

## 2026-08-12, later still the same day — Enhancement: Story 6.5 connector status shows Active/Inactive for every platform — social-listening-admin@feae698

- **Full commit:** `feae698d9a7024381b824fd074866fb9069e4671`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.5 / ADR-0009, ADR-0022, ADR-0023 (no new ADR — a UI enhancement to already-Ready-sourced work)
- **Contract:** social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/connector-status-view/SKILL.md (unchanged this pass)
- **Files touched:** docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/tenant/connectors/status/page.tsx
- **Full suite at merge:** PASS (12/12 suites, 183/183 tests)

**Requested directly by Menno while manually testing this screen** ("could you provide an indicator of inactive or active on the connector page?"), confirmed against the connector status page specifically via a clarifying question. The screen previously filtered out any platform whose `credentialStatus` was `null` — a tenant had no way to see that GNews/Azure AI Language/Azure OpenAI even existed as connectable options until after connecting one. Now every platform in the local `PLATFORMS` list is always rendered, with a plain "Active"/"Inactive" indicator as the primary signal (derived from the already-computed `connected` boolean), and the finer `ConnectorHealth.status` shown as secondary detail only when Active (`failing` still visually distinguished per ADR-0023; a connected-but-never-polled platform reads "no ingestion runs yet" rather than the more confusing bare word "disconnected" sitting next to "Active").

**A real, previously-unnoticed bug was found and fixed in the same pass:** `loadConnectorStatusRow()` discarded the already-fetched `ConnectorHealth` object for any unconnected platform (`health: connected ? health : null`), even though the fetch had already succeeded and `deriveConnectorHealth()` returns real, honest data for a never-connected platform (`lastSuccessfulFetchAt: null`, `consecutiveFailures: 0`, etc. — confirmed directly against `social-listening-core/src/connectors/connectorHealth.ts`'s own zero-ingestion-runs branch). This was always wasteful; it became actively wrong once inactive platforms started rendering too, since their real detail fields are legitimate data worth showing, not fixture values to hide. Contract extended from 10 to 15 assertions, none weakened.

---

## 2026-08-12, later still the same day — Story 1.11 — social-listening-core@703e755

- **Full commit:** `703e7558d46e43461505ddb2eaca5380a6dd4ed5`
- **Repo:** social-listening-core
- **Story / ADR:** 1.11 / ADR-0051 (accepted 2026-08-12, after seven in-place revisions during live review)
- **Contract:** social-listening-core/contracts/epic-1/story-1.11.connector-activation.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/connector-activation/SKILL.md (new)
- **Files touched:** docs/adr/README.md, docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-core/contracts/epic-1/story-1.11.connector-activation.contract.test.ts, social-listening-core/contracts/epic-2/story-2.3.error-handling-auto-disable.contract.test.ts, social-listening-core/contracts/epic-2/story-2.4.bounded-queues-and-dead-lettering.contract.test.ts, social-listening-core/migrations/0028_create_connector_activations.sql, social-listening-core/src/connectors/connectorActivationStore.ts, social-listening-core/src/connectors/connectorHealth.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- **Full suite at merge:** PASS (54/54 suites, 391/391 tests — one transient, unrelated real-network Newswire-connector 404 during the first full-suite run, confirmed gone on isolated and full re-runs)

**Closes ADR-0051's own core purpose: two new, ownership-scoped, credential-independent activation tables** — `connector_activations` (tenant-wide, ADR-0028 Tier 2) and `connector_user_activations` (user-specific, Tier 3), neither pre-populated (lazy row creation, per the ADR's own Decision §1). `connectorActivationStore.ts`'s `setConnectorActivation()`/`isConnectorActive()` are idempotent, ownerType-explicit (no default, mirroring `credentialStore.ts`'s own `getLatestCredentialId()`/`deleteCredential()` shape), and use two separate query paths per scope rather than dynamic table-name interpolation. `POST /v1/connectors/:platformId/activate` and `.../deactivate` are discriminated by `ownerType` in the body, mirroring `connect`/`disconnect`'s own authorization split (Story 1.7) — including the offboarding-override asymmetry: `activate`'s `ownerType: 'user'` is always self-only (matching `connect`); `deactivate`'s allows the owning user OR a `tenant_admin` of the same tenant (matching `disconnect`'s AC5 precedent), since deactivating is strictly less destructive than disconnecting. `ownerType: 'user'` is rejected `400` for an `authMode: 'none'` platform, determined via the shared connector registry (`getSocialConnector()`/`getAIProviderConnector()`), never a hardcoded providerId literal — `connectorsRouter.ts` is one of Story 2.10/ADR-0048's own `CORE_FILES`.

**`shouldAttemptIngestion()` (`connectorHealth.ts`) is extended with an optional `ownerType`/`userId`, defaulting to `'tenant'` for backward compatibility, and now additionally requires `is_active = true` on the matching-scope activation row alongside its existing health check.** This is the actual functional payoff of the whole ADR: closing the Newswire always-on bug and the credential-presence-as-activation conflation at the real ingestion-gating layer, not just the schema/endpoint layer — though no scheduler exists yet anywhere in this project to call this function in production (confirmed directly, per ADR-0051 Decision §7's own finding), so this is proven via direct contract calls, the same testing style ADR-0009/0010/0023 already established for this exact function.

**A real, necessary AC correction was made during implementation, before any code was written.** The original Story 1.11 Acceptance Criteria claimed `connector_user_activations` needed a second, user-scoped RLS predicate "mirroring `platform_credentials`' existing user-bound-row RLS treatment" — checked directly against `migrations/0019_add_platform_credentials_ownership_tier.sql`'s own comment and found this was factually wrong: that table's RLS is "deliberately unchanged," ownership enforced at the application layer, the same pattern `watchlists` deliberately does *not* use (ADR-0034 §2 explicitly rejects a second RLS predicate, for exactly the reason this correction restores: a `tenant_admin` offboarding override would otherwise be structurally impossible). Corrected in place in `docs/user-stories/epic-1-repository-and-api-foundation.md` with a dated note before implementing against it, not discovered mid-build.

**`connector_user_activations.user_id` is `REFERENCES users(id) ON DELETE CASCADE`, mirroring `watchlists.user_id`'s own precedent and reasoning (migration 0025) — this is why Story 3.8's tenant-deletion pipeline needed no changes.** `updated_by` on both tables is `ON DELETE SET NULL` (an audit pointer, not ownership), so it never blocks deleting the user who last flipped the flag.

**Story 2.3's and Story 2.4's own already-passing contracts needed minimal, dated updates, not a weakening.** `shouldAttemptIngestion()`'s new activation requirement meant three pre-existing "true" assertions (Story 2.3 AC4/AC5, Story 2.4 AC3) would now fail for an unrelated reason (no activation, not a health regression) unless the connector was explicitly activated first — added via direct `setConnectorActivation()` calls, held constant so each AC keeps proving exactly what it always proved (auto-disable wiring, dead-letter/auto-disable independence). This is the identical "a later ADR changes a shared function's behavior, the earlier story's contract gets a dated update pointing to it" pattern Story 2.5/ADR-0023 already established for this same file family (see those two files' own 2026-07-30 dated notes) — not a decision made ad hoc here.

**Two real, self-caught process deviations, corrected before they became a problem:** (1) the store module was initially written before its contract test existed — caught immediately, deleted, and the contract test written and confirmed failing for the right reason (missing module) before any implementation code was restored, per this skill's own hard rule; (2) the contract test's own first draft called `setConnectorActivation()` with a synthetic `randomUUID()` as a Tier-3 `userId` with no real `users` row backing it — `connector_user_activations.user_id`'s real FK caught this immediately as a constraint violation on first run; fixed by using `makeTenantWithUsers()`'s real, resolved user instead, the same pattern Story 1.7's own contract already established for exactly this reason.

**Deliberately out of scope, named, not silently omitted:** `social-listening-admin` UI wiring (the Story 6.3/6.5 screens still render the old hardcoded logic); live credential validation and system-driven auto-deactivation (ADR-0051 Decision §6/§7); the `retryable`/non-retryable auto-disable conflation fix (addressed separately via ADR-0010/0023's own dated Clarification notes, not this story); `GET /v1/connectors/:platformId`'s own response shape combining activation with derived health (ADR-0051 Open Question 5); real production connector-registration bootstrap for `SocialConnector`s (no scheduler exists yet anywhere in this project to need one) — all recorded in `.claude/skills/connector-activation/SKILL.md`'s own "Known gaps" section.

---

## 2026-08-12, later still the same day — Story 1.12 — social-listening-core@c3af2a7

- **Full commit:** `c3af2a7aa5d0ab439773a8edab512c2576737aa0`
- **Repo:** social-listening-core
- **Story / ADR:** 1.12 / ADR-0051 Open Question 5 (no new ADR — additive response-shape extension of an already-decided endpoint)
- **Contract:** social-listening-core/contracts/epic-1/story-1.12.connector-status-includes-activation.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/connector-activation/SKILL.md (updated)
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-1-repository-and-api-foundation.md, social-listening-core/.claude/skills/connector-activation/SKILL.md, social-listening-core/contracts/epic-1/story-1.12.connector-status-includes-activation.contract.test.ts, social-listening-core/src/http/versions/v1/connectorsRouter.ts
- **Full suite at merge:** PASS (55/55 suites, 394/394 tests)

**Closes Story 6.15's own real, named backend dependency.** `GET /v1/connectors/:platformId`'s handler now runs `getCachedConnectorHealth()` (unchanged, still 60-second-TTL-cached) and `isConnectorActive(tenantId, platformId, 'tenant')` (fresh, uncached) in parallel and spreads both into one response object — `{...health, isActive}`. A never-activated platform reads `isActive: false`, never `null`/`undefined`, per Story 1.11's own lazy-creation rule. The contract's own AC2 proves the cache-independence directly: a GET immediately before activating (populating the 60s health cache) followed by a GET immediately after (still well within that TTL) reflects the new `isActive` value — if it had been folded into the cached value, the second call would have read stale `false`. No change to `deriveConnectorHealth()`, `ConnectorHealth`'s own four original fields, or `ConnectorHealthCache`'s TTL/locality decision (ADR-0022).

---

## 2026-08-12, later still the same day — Story 2.12 — social-listening-core@da102a9

- **Full commit:** `da102a9e51f8229a7e617371efaa1c490d2fa2b6`
- **Repo:** social-listening-core
- **Story / ADR:** 2.12 / ADR-0010 §Clarification (2026-08-12), ADR-0023 §Clarification (2026-08-12) — no new ADR, corrective work against already-Accepted policy
- **Contract:** social-listening-core/contracts/epic-2/story-2.12.retryable-failures-excluded-from-auto-disable.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md (updated)
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md, social-listening-core/.claude/skills/connector-health-and-error-handling/SKILL.md, social-listening-core/contracts/epic-2/story-2.12.retryable-failures-excluded-from-auto-disable.contract.test.ts, social-listening-core/src/connectors/connectorHealth.ts
- **Full suite at merge:** PASS (55/55 suites, 399/399 tests — two transient, unrelated real-network/Key-Vault timeouts on the first run, Story 1.11's own Key Vault key-delete `afterAll` and Story 2.8's real Azure AI Language call, confirmed gone on isolated re-runs, not caused by this change)

**Directly closes the gap that reproduced the historical Microsoft Social Engagement failure mode Menno described** (a connector disconnected merely for exhausting quota) via a real, confirmed implementation gap against ADR-0010's own already-Accepted Decision text. `deriveConnectorHealth()`'s query now selects `retryable` from `ingestion_runs`; `recentFailures` and `consecutiveFailures` (the two counters feeding ADR-0023's rate-relative/ceiling rules) count only non-retryable failed runs — a retryable failure is fully invisible to this derivation, neither extending the consecutive streak nor counting toward the rate-formula's numerator or denominator (`recentAttempts`), the same way `runIngestionAttempt()` already treats it as something to silently retry rather than surface as a connector-level problem. `lastAttemptAt` still reflects that an attempt happened regardless of classification — this exclusion is scoped to the `failing`/`degraded`/`healthy` derivation only. A `NULL` `retryable` value (a fixture row created without classifying it, e.g. Story 4.3's own `recordRun()` helper) is treated conservatively, as non-retryable, so an unclassified failure is never silently excluded. No change to ADR-0023's own accepted numeric defaults (50% rate, 5-attempt floor, 20-consecutive ceiling) — this story narrows what counts as an eligible failure going into that math, not the thresholds themselves. Story 2.3's and Story 4.3's own fixtures both already use `malformed_watchlist`/unclassified failures exclusively, so neither needed any assertion change — confirmed directly, not assumed, by the full-suite run.

---

## 2026-08-12, later still the same day — Story 6.15 — social-listening-admin@cc7cae2

- **Full commit:** `cc7cae26080787f8221632552187c6fb6e2b942b`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.15 / ADR-0051 — no new ADR, ordinary UI/CRUD surface against Story 1.11/1.12's already-built endpoints
- **Contract:** social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md (updated), social-listening-admin/.claude/skills/connector-status-view/SKILL.md (updated)
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/connector-connect-disconnect/SKILL.md, social-listening-admin/.claude/skills/connector-status-view/SKILL.md, social-listening-admin/contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.5.connector-status-view.contract.test.ts, social-listening-admin/src/app/api/connectors/[platformId]/activate/route.ts, social-listening-admin/src/app/api/connectors/[platformId]/deactivate/route.ts, social-listening-admin/src/app/tenant/connectors/ActivateDeactivateButton.tsx, social-listening-admin/src/app/tenant/connectors/page.tsx, social-listening-admin/src/app/tenant/connectors/status/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Full suite at merge:** PASS (13/13 suites, 197/197 tests)

**Closes the actual UI-visible instance of the bug ADR-0051 was drafted to fix.** `core-client.ts` gains `activatePlatform()`/`deactivatePlatform()` (raw `{status, body}` outcome pattern, mirroring `connectPlatform()`/`disconnectPlatform()` exactly) and `ConnectorStatus.isActive`; two new same-origin proxy routes (`/api/connectors/[platformId]/activate|deactivate`) mirror `.../connect`/`.../disconnect` exactly, keeping `core-client.ts` the sole bearer-token-attachment choke point (ADR-0036 §2). A new `ActivateDeactivateButton.tsx` client component — single-click activate (non-destructive), two-click-confirm deactivate (mirroring `DisconnectButton.tsx`'s own pending-confirm pattern, never `window.confirm()`) — is rendered on both `tenant/connectors/page.tsx` (Story 6.3) and `tenant/connectors/status/page.tsx` (Story 6.5) for every platform, tenant-wide gated on `tenant_admin` and personal gated on `authMode !== 'none'` (mirroring `ConnectForm`'s own `allowTenantWide` gate exactly).

**Both screens' Active/Inactive derivation now reads real `isActive` (Story 1.12), replacing the old `credentialStatus !== null` / `authMode === 'none'` inference entirely.** Newswire no longer renders unconditionally "Active" — it renders Inactive until a Tenant-Admin explicitly activates it, the concrete, UI-visible fix this whole ADR chain (ADR-0051 → Story 1.11 → Story 1.12 → this story) was built toward. Deactivating a connector never hides or disables `ConnectForm`/`DisconnectButton` — activation and credential management stay two visibly distinct actions (ADR-0051 Decision §3), proven directly by a contract test.

**A real, deliberate rewrite of Story 6.5's own already-passing contract, not a silent change.** That contract's own assertion — Newswire "always renders Active, regardless of credentialStatus" — was correct, intended behavior under this screen's original (pre-ADR-0051) model. Under the model this story ships, that exact behavior is the bug ADR-0051 exists to fix, so the assertion is now the opposite of correct. Rewritten with a dated note (2026-08-12) citing ADR-0051 directly, per this project's own "regression, not rewrite" convention (the same pattern Story 2.5/ADR-0023 already established for this exact situation) — two smaller structural assertions in the same file (`!connected` → `!isActive`) were also renamed the same way.

**A real, named limitation, not a silent inaccuracy:** `GET /v1/connectors/:platformId` only exposes tenant-wide `isActive` (Story 1.12's own scope limit, confirmed in that story's own text) — there is no per-user read yet. The personal `ActivateDeactivateButton` on both screens is therefore always rendered with `isActive={false}` (an honest "unknown, assume off" default) rather than reusing the tenant-wide value, which would misrepresent an individual user's own personal activation state. Documented in both component `SKILL.md`s' own Load-bearing constraints, not discovered later as a surprise.

**Testing approach matches this codebase's own established ceiling, not a newly invented standard:** client-side click-to-activate interaction is not simulated (neither `ConnectForm.tsx` nor `DisconnectButton.tsx` has ever had its own click handler exercised in any contract in this repo either) — `ActivateDeactivateButton`'s presence and gating logic is proven structurally, `core-client.ts`'s two new functions are proven via direct unit tests (mocked fetch, mirroring Story 6.3's own `connectPlatform()`/`disconnectPlatform()` test pattern exactly), and the page-level Active/Inactive label text — rendered by each page directly, not inside the nested button component — is proven via real, mocked-fetch `Page()` renders, the same technique Story 6.5's own contract already established.

---

## 2026-08-12, later still the same day — Healing pass, Story 6.2 (null-identity role-gating) — social-listening-admin@6e110aa (with a social-listening-core file in the same commit)

- **Full commit:** `6e110aa7c5f2759d76822f52226b89312b0271dc`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.2 / ADR-0036 §4 — no new ADR, a correction against this story's own already-Accepted AC2, plus a same-pass cross-component fix to Story 6.1's own contract
- **Contracts healed:** social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md (updated)
- **Files touched:** social-listening-admin/.claude/skills/role-routing-shell/SKILL.md, social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts, social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts, social-listening-admin/src/app/page.tsx, social-listening-admin/src/lib/role-routing.ts, social-listening-core/scripts/ensureContractTestIdentity.ts
- **Full suite at merge:** PASS (13/13 suites, 201/201 tests)

**Found during live manual testing, not a suite failure discovered first.** A real Entra sign-in with no matching `users`/`platform_admins` row anywhere (a genuinely orphaned identity — confirmed directly against the dev database) still rendered `/tenant/connectors`' full "Available connectors" UI instead of being rejected. Root cause: `getRoleShell(null)` defaulted to `'tenant'` — and this was not an oversight, `story-6.2.role-gated-routing-shell.contract.test.ts` asserted it directly, framed as "unresolved/unhydrated session." That framing doesn't hold in this architecture: every page here computes `identity` synchronously, once per request, straight from the decrypted session cookie — there is no client-side hydration step, so `null` means a permanently unresolved caller for that request, not a transient loading state. **Per ADR-0036 §4 this was never a security incident** — `social-listening-core`'s own RLS/auth boundary held throughout; the null-identity session only ever saw defaulted/degraded data (each `getConnectorStatus()` call itself came back unauthorized and was caught, per that page's own existing degrade-to-"not connected" branch), never real tenant content — but it was a real, live violation of Story 6.2's own AC2 intent. **Per this skill's own hard rule (never edit a contract's assertions unilaterally), this was surfaced to Menno as a named decision before any code changed** — his explicit sign-off: reject a null identity, don't default it.

**Fix:** `getRoleShell()` (`role-routing.ts`) now returns `null` for a `null` identity — a third, explicit "no shell" state. `isShellAllowed()` needed no code change (`null === 'tenant'`/`'platform-admin'` was already `false`); `tenant/page.tsx` and `platform-admin/page.tsx` needed no change either, since their existing `isShellAllowed()` + `redirect('/')` guard already rejects a `null` shell correctly. `src/app/page.tsx` (home) did need a real fix — its own render branch keyed only on the `session` boolean, not on `getRoleShell()`'s result, so a signed-in-but-unresolved session still hit the "Tenant shell" JSX; it now redirects that case to `/sign-in`. Contract updated with a dated note reversing the old assertion, plus new route-guard integration tests reproducing the exact live defect for `/tenant`, `/platform-admin`, and `/`.

**A real cross-component regression was found and healed in the same pass, not worked around.** This commit also touches one new `social-listening-core` file (`scripts/ensureContractTestIdentity.ts`) — logged here as a single `social-listening-admin` entry, pre-split single workspace repo, per this file's own established convention. `story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts` deliberately never started a real `social-listening-core` instance (its own "Explicitly out of scope" note) — so its own test identity was always `null`. Harmless under the old default (AC3/AC4/AC6/AC12 only checked that `/` rendered *something* signed-in-looking); with the fix above, those same assertions would now fail permanently, every run, not flakily. Attributed directly (not assumed) before touching anything — per the Cross-Component Regression Protocol, this was surfaced to Menno as a named decision rather than decided unilaterally, since the real fix genuinely required expanding this foreign contract's own scope. **Menno's direction: make Story 6.1's contract also start a real core instance.** Its `beforeAll` now spawns real `social-listening-core` (mirroring `npm run dev`'s own command) and, before that, runs a new idempotent seed script (`social-listening-core/scripts/ensureContractTestIdentity.ts`, general-purpose, not one-off) that finds-or-creates a dedicated tenant and an invited `users` row for `ENTRA_ADMIN_TEST_USER_EMAIL`, so the sign-in test proves the real path — landing on `/` because identity genuinely resolved, not because of a bug loophole.

**A second, real, non-obvious defect was found and fixed while wiring this up, confirmed by direct instrumentation (added and fully reverted after diagnosis, confirmed clean via `git status`) rather than guessed at:** the newly-spawned core instance inherited Jest's own `NODE_ENV=test` (the spawn's `env` option wasn't overridden), which silently triggers `app.ts`'s own `testAuthBypassMiddleware` swap instead of real Entra token verification — a real Bearer token gets rejected with the exact same 401 shape as "missing Authorization header," making it look identical to an auth failure. Fixed by explicitly forcing `NODE_ENV: 'development'` on the spawned core process's env.

**A third, real, external (non-code) defect was found the same way and fixed by Menno directly in the Entra Portal, not in this codebase:** even with real auth running, the test account's identity still never resolved — `resolveIdentity()`'s only path for a brand-new, never-linked account matches an invited row **by email**, and the access token's own `email` claim was consistently empty (confirmed via the same temporary instrumentation, immediately reverted). Root cause, confirmed directly with Menno: the test Entra user's `mail` attribute (distinct from its sign-in username, which is email-*shaped* but not the same field) was never populated — a common gap for locally-created test accounts. The optional-claim configuration on `social-listening-core`'s own app registration (added 2026-08-10) was already correct; there was simply nothing for it to emit. Fixed by Menno setting the user's Email/Mail field in the Entra Portal directly — confirmed closed by re-running the full contract afterward (19/19 passing, real `GET / 200` instead of a redirect).

**Deliberately not attempted as a code fix:** sourcing `email` from the ID token instead of the access token (a real architecture change to what crosses the BFF boundary into `social-listening-core`, touching ADR-0036's own trust-boundary design) — named as an option, explicitly declined by Menno in favor of the Portal fix, not decided unilaterally.

---

## 2026-08-12, later still the same day — Story 6.11 — social-listening-admin@d8ba590

- **Full commit:** `d8ba590883512f353ed9c79872a321a5a30ad02f`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.11 / ADR-0011 (Story 3.4), ADR-0012 (Story 5.1) — no new ADR, an ordinary CRUD/read surface against two already-Accepted, already-built endpoints
- **Contract:** social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/post-feed/SKILL.md (new), social-listening-core/.claude/skills/posts-api/SKILL.md (stale-note correction)
- **Files touched:** docs/implementation-plan.md, docs/user-stories/README.md, docs/user-stories/epic-6-tenant-admin-ui.md, social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/app/tenant/posts/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts, social-listening-admin/src/lib/core-client.ts, social-listening-core/.claude/skills/posts-api/SKILL.md
- **Full suite at merge:** PASS (14/14 suites, 225/225 tests)

**Closes the single largest "built but invisible" gap this project's own 2026-08-12 cross-reference passes found** — `GET /v1/posts`/`GET /v1/posts/:id` have existed, real and contract-verified, since Phase 1 with zero frontend surface anywhere in `social-listening-admin`, for a product whose entire premise is social *listening*. `/tenant/posts` (list) and `/tenant/posts/:id` (detail) are both real, async Server Components — no fixture data anywhere in the render path, confirmed the same way Stories 6.4/6.5's own corrections were: real `Page()` renders against a real encrypted session and mocked `fetch`, not source-string-containment checks (this story's own AC5 names that lesson directly).

**`postDisplay.ts` (new, pure, no JSX) derives display data purely by field presence, never by branching on `providerId`.** `extractDisplayText()` looks only for a `title` field (optionally `description`) — GNews posts (`title`+`description`), Newswire and tenant-owned-feed posts (`title`+`link`, no `description`) both extract correctly through the identical code path, confirmed directly against each connector's real `rawPayload` construction (`pollGNewsSearch.ts`, `newswireConnector.ts`, `pollTenantOwnedFeed.ts`) rather than assumed from the story text alone. Anything without a recognizable `title` falls back to the raw JSON rather than rendering nothing — proven by a dedicated "unknown shape" contract case, not just the two known ones. `extractProviderBadge()` and `extractEnrichmentSummary()` (sentiment/entities/keyPhrases, `null` when nothing is present) follow the same pure, JSX-free pattern so both the list and detail screens can share them.

**Pagination is the real, opaque `nextCursor`, proven both directions.** The list screen's "next page" link (`?cursor=<exact value>`) embeds `page.nextCursor` verbatim, never re-encoded; a real second-page render (`searchParams.cursor` set) forwards that exact string to `GET /v1/posts` unmodified — both directions are contract-proven, not just the outbound link's markup. No page-number control exists anywhere (checked structurally, per ADR-0011's own opaque-cursor contract).

**`authorId`/`acquisitionId` are shown as their raw values on the detail screen, not a fabricated "friendlier" mapping — confirmed as a real gap, not assumed.** No `/v1/authors` route is mounted anywhere in `social-listening-core`'s router, and `getIngestionRunForPost()` (which resolves `connectorVersion`/`triggerType` from an `acquisitionId`) has no HTTP route calling it either — both checked directly against the real router files before deciding the v1 scope, rather than inventing a display transform the backend can't back up. Named explicitly in this component's own `SKILL.md` as deferred, real, future `social-listening-core` scope, not silently faked.

**A real, previously-uncaught stale note was corrected while touching this component's own governing `SKILL.md`, named by Story 6.11's own text as something "whoever picks up this story" must fix.** `social-listening-core/.claude/skills/posts-api/SKILL.md`'s "Load-bearing constraints" section still described tenant identity as coming from an `X-Tenant-Id` header — a Phase 1 placeholder, stale since Story 5.10/ADR-0033 retired that header project-wide as a trust mechanism. `postsRouter.ts` itself already calls the real `requireTenantUser()` — confirmed directly before correcting the note, not assumed from the story text.

**Deliberately out of scope, named directly in this story's own text, not silently omitted:** filtering by `watchlistId`/`platformId` (no such filter exists on `GET /v1/posts` yet); full-text or date-range search; any change to either endpoint's own response shape.

---

## 2026-08-12, later still the same day — Healing pass, Story 2.9 (AI provider activation gating) — social-listening-core@99c1dcf

- **Full commit:** `99c1dcf04f08cc6d358e753df390b5802a56e728`
- **Repo:** social-listening-core
- **Story / ADR:** 2.9 / ADR-0038, ADR-0051 — no new ADR, a correction against Story 2.9's own already-Accepted behavior plus two cross-component regression repairs
- **Contracts healed:** contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts (cross-component), contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts (cross-component)
- **SKILL.md:** .claude/skills/azure-ai-language-connector/SKILL.md, .claude/skills/azure-openai-connector/SKILL.md, .claude/skills/social-post-enrichment/SKILL.md (all updated)
- **Files touched:** social-listening-core/.claude/skills/azure-ai-language-connector/SKILL.md, social-listening-core/.claude/skills/azure-openai-connector/SKILL.md, social-listening-core/.claude/skills/social-post-enrichment/SKILL.md, social-listening-core/contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts, social-listening-core/contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts, social-listening-core/contracts/epic-2/story-2.9.second-ai-provider-connector.contract.test.ts, social-listening-core/src/connectors/azureAiLanguage/enrichPost.ts
- **Full suite at merge:** PASS except one confirmed-external, unrelated failure (`GNews returned 403`, real free-tier daily quota exhaustion from this session's own heavy real-API usage — confirmed by reproducing the identical 403 in isolation, nothing to do with this change; not retried further since the quota is a real, time-based ceiling, not a flake)

**Found via a live question, not a suite failure discovered first:** Menno connected and activated both Azure AI Language and Azure OpenAI in his own test tenant and asked directly which one would actually enrich a post. Traced `enrichPost.ts`'s `tryProvider()` directly: it decided purely by stored-credential presence (`getLatestCredentialId()`) — it never checked `isConnectorActive()` (Story 1.11/ADR-0051) at all, even though `social-listening-admin`'s own connectors screen already renders an Activate/Deactivate control for every `authMode: 'api_key'` platform, both AI providers included (`tenant/connectors/page.tsx`'s `platform.authMode === 'api_key'` branch has no AI-provider exclusion). Deactivating an AI provider through that same UI control therefore had zero real effect — a genuine inconsistency with how activation already gates content connectors' own polling, surfaced to Menno as a named decision before any code changed, per this skill's own hard rule. **Menno's explicit direction: fix it.** `tryProvider()` now checks `isConnectorActive(tenantId, connector.providerId, 'tenant')` first, skipping (no credential read, no API call) when false — a credentialed-but-never-activated provider (no activation row at all, per ADR-0051 Decision §1's own lazy-creation default) or an explicitly deactivated one is now skipped identically to having no credential.

**A second, real, previously-undecided question was resolved the same way, not assumed.** Checked directly against ADR-0038 and Story 2.9's own text: "Azure AI Language first" in `PROVIDERS`' fixed order was never actually decided as a runtime priority policy — it described which provider was *built* first; Story 2.9's own "fails over" AC4 language is about resilience (one provider unavailable, try the other), not a deliberate ranking for a tenant with both genuinely connected on purpose. **Menno's explicit direction: keep Azure AI Language as the intentional default for now** — documented directly in `enrichPost.ts`'s own `PROVIDERS` comment and both connectors' `SKILL.md`s; a per-tenant preference mechanism is named as real, separate, unbuilt scope, not decided unilaterally.

**Two real cross-component regressions found on the first full-suite run, both attributed and fixed per the Cross-Component Regression Protocol, not folded into this story's own attempt counter.** (1) `story-1.4...contract.test.ts` hardcoded the exact `dev` npm-script string, broken by this same session's earlier migration-check commit (`4801a36`) — never full-suite-validated at the time it was made. Updated with a dated note; the invariant AC4 actually proves ("everything reaches `scripts/withDevEnv.js`, no manual env export") is unchanged, just now reached via one more level of npm-script chaining. (2) `story-2.8...contract.test.ts`'s own shared credential-seeding fixture (`seedRealAzureCredential()`) and its standalone bad-credential test never activated what they credentialed, since activation didn't exist as a precondition when Story 2.8 was originally built — updated both to also call `setConnectorActivation()`, so they keep proving what they always meant to prove (a real, usable Azure AI Language setup enriches successfully; a bad *credential* is skipped, not an inactive provider skipped for an unrelated reason).

---

## 2026-08-12, later still the same day — Story 6.11 enhancement (AI provider attribution) — social-listening-admin@43d36ca

- **Full commit:** `43d36caa6094083c993bb774c49ca9e2e0acc853`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.11 — enhancement to an already-built story, Menno's own direct request, no new ADR
- **Contract:** social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts (extended, 25/25)
- **SKILL.md:** social-listening-admin/.claude/skills/post-feed/SKILL.md (updated)
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.11.post-feed.contract.test.ts, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/app/tenant/posts/postDisplay.ts
- **Full suite at merge:** PASS (14/14 suites, 226/226 tests)

**Directly requested by Menno, from the same live question that surfaced the Story 2.9 activation-gating gap above** ("enhance the post details page with the ai providers enrichment"). `postDisplay.ts`'s `extractEnrichmentSummary()` now also extracts `enrichment.modelUsed` (e.g. `"azure-ai-language:2025-01-01"`); the detail screen renders it as "Enriched by: …" when present. This is the one honest, after-the-fact answer to "which provider enriched this post" a viewer can get — `enrichPost.ts`'s fixed `PROVIDERS` order decides that per-post, server-side, with no tenant-visible setting (see the matching `social-listening-core@99c1dcf` entry above for the backend-side finding this same question surfaced).

---

## 2026-08-12, later still the same day — Story 6.16 (backend) — social-listening-core@51a2b40

- **Full commit:** `51a2b4055acec4a4b07abfcb89e3b0f0f2b25120`
- **Repo:** social-listening-core
- **Story / ADR:** 6.16 — no new ADR, exposes the already-built `enrichPost()` (Story 2.8/2.9) over REST, same category as `GET /v1/me`/Story 1.12
- **Contract:** social-listening-core/contracts/epic-3/story-6.16.post-manual-enrich-endpoint.contract.test.ts
- **SKILL.md:** social-listening-core/.claude/skills/posts-api/SKILL.md (updated)
- **Files touched:** social-listening-core/.claude/skills/posts-api/SKILL.md, social-listening-core/contracts/epic-3/story-6.16.post-manual-enrich-endpoint.contract.test.ts, social-listening-core/src/http/versions/v1/postsRouter.ts, social-listening-core/src/posts/socialPostStore.ts
- **Full suite at merge:** PASS except 5 confirmed-external, unrelated failures (`GNews returned 403`, real free-tier daily quota exhaustion from this session's own heavy real-API usage — same root cause as the earlier Story 2.9 healing pass entry above, not retried further since it's a real, time-based ceiling)

**Requested directly by Menno while manually testing Story 6.11's own post detail screen live, not drafted speculatively.** A post ingested before either AI provider was credentialed and active stays `enrichment: null` forever — confirmed directly: `enrichPost()` is only ever called inline during ingestion (`pollGNewsSearch.ts`/`pollNewswireFeeds.ts`), nothing else in this codebase ever re-processes an already-stored post. `POST /v1/posts/:id/enrich` closes that gap. `deriveEnrichmentText()` (new, `socialPostStore.ts`) derives the enrichment text by the exact same rule every real connector's own ingest function already applies inline — checked directly against `pollGNewsSearch.ts`'s own `[title, description].filter(Boolean).join('. ')` and `pollNewswireFeeds.ts`'s own bare `title`, not invented fresh for this endpoint. One rule (`title`, plus `description` when present) covers both real shapes without a `providerId` branch, proven by two separate real-Azure-API contract cases, not assumed from the story text alone.

**`enrichPost()` resolving to `undefined` (no AI provider currently connected and active for this tenant) is a real, honest `200` with `enrichment` left `null` — not an error status.** This matters: a tenant clicking "run enrichment now" with nothing connected gets a truthful "nothing to enrich with" response, not a 4xx/5xx that would misrepresent a real, expected outcome as a failure. The route's own 404-on-unknown/cross-tenant behavior (RLS) matches `GET /v1/posts/:id`'s own existing contract exactly, re-proven here rather than assumed to carry over.

**Deliberately, explicitly not restricted at the backend layer:** re-enrichment of an already-enriched post. The admin UI never offers the button for one (Story 6.16's own frontend AC), but the endpoint itself has no such restriction — a tenant calling it directly via the real API to deliberately re-run enrichment on a specific post is a legitimate case the backend has no reason to forbid, the UI-side gate being a UX choice rather than a security boundary, per this project's own already-established ADR-0036 §4/ADR-0041 pattern.

---

## 2026-08-12, later still the same day — Story 6.16 (frontend) — social-listening-admin@21da4f5

- **Full commit:** `21da4f57568300c80047ceaa62e3e091ee7e02ad`
- **Repo:** social-listening-admin
- **Story / ADR:** 6.16 — companion to `social-listening-core@51a2b40`, no new ADR
- **Contract:** social-listening-admin/contracts/epic-6/story-6.16.manual-enrichment-button.contract.test.ts
- **SKILL.md:** social-listening-admin/.claude/skills/post-feed/SKILL.md (updated)
- **Files touched:** social-listening-admin/.claude/skills/post-feed/SKILL.md, social-listening-admin/contracts/epic-6/story-6.16.manual-enrichment-button.contract.test.ts, social-listening-admin/src/app/api/posts/[id]/enrich/route.ts, social-listening-admin/src/app/tenant/posts/RunEnrichmentButton.tsx, social-listening-admin/src/app/tenant/posts/[id]/page.tsx, social-listening-admin/src/lib/core-client.ts
- **Full suite at merge:** PASS (15/15 suites, 235/235 tests)

**`RunEnrichmentButton` (new, Client Component) mirrors `ActivateDeactivateButton.tsx`'s own established shape exactly** — a same-origin proxy route (`/api/posts/[id]/enrich/route.ts`) forwarding `runPostEnrichment()`'s raw `{status, body}` outcome unchanged, `core-client.ts` staying the sole bearer-token choke point (ADR-0036 §2, re-verified structurally by this story's own contract). Rendered on `/tenant/posts/:id` only when `post.enrichment` is currently `null` — a real, already-enriched post never shows it at all, not merely a disabled state.

**A real, non-obvious testing gap was found and corrected while writing this story's own contract, not silently worked around.** The first draft asserted the button's own literal text ("Run enrichment now") would appear in a `JSON.stringify(Page())` render — it never can: `RunEnrichmentButton` is a Client Component, and a Server Component's own `Page()` call returns an *unrendered* element reference for it, never crossing into its own JSX. Corrected to assert on the actual serializable signal available at that boundary (the real `postId` prop's presence/absence in the tree) — the same category of correction this project's own `code-review`/contract-writing discipline exists to catch before it ships as a false-positive-prone assertion.

**On success with a real, non-null enrichment result, the button reloads the page** (the same `window.location.reload()` pattern `ActivateDeactivateButton`/`DisconnectButton` already established) rather than attempting a partial client-side re-render — consistent with this app's existing "Server Component owns the real data, a full reload is the simplest correct way to reflect a real backend mutation" convention, not a new pattern invented for this one button.
