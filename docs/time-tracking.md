# Time Tracking
## SocialEngage

**Purpose:** Track commit-level activity to support estimation-accuracy metrics and capacity planning, without requiring session-level time entry.

**Approach, corrected 2026-08-06:** this file previously claimed an interactive pre-commit prompt enforced mandatory time entry — checked directly against the real `scripts/git-hooks/pre-commit`, no such prompt ever existed there (that hook is the contract-first backstop, unrelated to time tracking); this file's own log table had also sat empty since it was first added. Both this file and `docs/templates/time-tracking.md` also still carried "Spark Capture Project" branding, evidence this was copied in from some other project's template and never adapted. An interactive prompt was deliberately not built: most commits in this project are made by Claude Code on Menno's own behalf via tool calls, with no TTY attached — a blocking prompt would hang or fail on exactly those commits, not just skip them.

**What's real now:** `scripts/git-hooks/post-commit` auto-derives one log row per commit from the commit's own message — no prompt, works identically whether Menno or Claude Code committed. It infers an Activity category from the commit subject (Implementation/Debugging/Design/Documentation/Review/Infrastructure — see "Session Types" below) and extracts a Story/ADR reference via pattern match if the subject names one. **Start Time is the git commit's HH:MM — useful as a day-timeline marker, not a work-start time.** End time and duration are not tracked; this log is a work diary, not a time-accounting system.

---

## 📊 Time Tracking Log

**Format:** One row per session. Use ISO dates (YYYY-MM-DD).

| Date | Start Time | End Time | Duration (min) | Activity | Story/ADR | Notes |
|------|------------|----------|----------------|----------|-----------|-------|
| 2026-08-28 | 05:16 | — | — | Review | — | Queue commit fd38ed3 for Manager, Documentation Steward, and Learning & Development review (b7970b3) |
| 2026-08-28 | 05:16 | — | — | Review | — | Scheduled doc review: Documentation Steward pass, final (2026-08-28) (fd38ed3) |
| 2026-08-28 | 05:15 | — | — | Review | — | Queue commit 95e6d3a for Manager, Documentation Steward, and Learning & Development review (3495a00) |
| 2026-08-28 | 05:14 | — | — | Review | — | Queue commit e875e18 for Manager, Documentation Steward, and Learning & Development review (95e6d3a) |
| 2026-08-28 | 05:14 | — | — | Review | — | Queue commit 89b6e75 for Manager, Documentation Steward, and Learning & Development review (e875e18) |
| 2026-08-28 | 05:14 | — | — | Review | — | Scheduled doc review: Documentation Steward pass, continued (2026-08-28) (89b6e75) |
| 2026-08-28 | 05:14 | — | — | Review | — | Scheduled doc review: Documentation Steward pass, in progress (2026-08-28) (44bed55) |
| 2026-08-28 | 05:13 | — | — | Review | — | Scheduled doc review: Ideal Manager pass (2026-08-28) (4860f96) |
| 2026-08-28 | 05:10 | — | — | Review | — | Queue commit a2f134e for Manager, Documentation Steward, and Learning & Development review (d863661) |
| 2026-08-28 | 05:10 | — | — | Review | — | Scheduled doc review: Learning & Development Writer pass (2026-08-28) (a2f134e) |
| 2026-08-27 | 01:03 | — | — | Documentation | ADR-0088 | docs(adr): approve ADR-0088 through ADR-0094 (93 total accepted ADRs) and sync dashboard (fb40e92) |
| 2026-08-27 | 01:00 | — | — | Documentation | — | feat(youtube): integrate full SocialConnector lifecycle, registration and UI activation for YouTube (b24195a) |
| 2026-08-27 | 00:31 | — | — | Documentation | — | docs(epic-10): mark Stories 10.1–10.14 as built and sync project progress dashboard (164/210 stories built) (086fcce) |
| 2026-08-27 | 00:28 | — | — | Documentation | — | feat(epic-10): complete Batch 5 (Stories 10.11, 10.12, 10.13, 10.14) (fdb9bb8) |
| 2026-08-27 | 23:39 | — | — | Documentation | — | feat(epic-10): complete Batch 4 (Stories 10.9, 10.10) (1a17f89) |
| 2026-08-27 | 22:41 | — | — | Documentation | — | feat(epic-10): complete Batch 3 (Stories 10.6, 10.7, 10.8) (265dd5f) |
| 2026-08-27 | 22:05 | — | — | Documentation | — | feat(epic-10): complete Batch 1 & Batch 2 (Stories 10.1, 10.2, 10.3, 10.4, 10.5) (ffe640d) |
| 2026-08-27 | 21:43 | — | — | Documentation | ADR-0086 | feat(story-10.1): prospecting list model and sharing backend (ADR-0086) (6cc1089) |
| 2026-08-27 | 21:35 | — | — | Documentation | — | feat(dashboard): update Phase Milestone Story Velocity curve and synchronized telemetry (7cccf96) |
| 2026-08-27 | 21:26 | — | — | Documentation | — | fix(rag): fetch live status on mount in RAGDiscoveryClient (a4dbb66) |
| 2026-08-27 | 21:20 | — | — | Documentation | — | chore: remove ephemeral test db json (13a38b0) |
| 2026-08-27 | 21:20 | — | — | Documentation | — | feat(rag): enhance PgvectorRAGConnector and RAG backfill pipeline (e2ba717) |
| 2026-08-27 | 21:13 | — | — | Documentation | — | feat(rag): add RAG backfill utility (npm run rag:backfill) and DB-backed status in PgvectorRAGConnector (57d4be3) |
| 2026-08-27 | 21:10 | — | — | Documentation | — | fix(rag): add migration 0047 granting app_user permissions on rag_chunks and rag_chunks_sync (a57a0d5) |
| 2026-08-27 | 20:39 | — | — | Documentation | — | fix(admin): eliminate duplicate onboarding checklist exports and fix typing in OnboardingChecklist (4ae7f92) |
| 2026-08-27 | 20:16 | — | — | Documentation | — | Merge branch 'main' of https://github.com/mdresch/socialengage into main (Epic 9 completed) (6fe3b5d) |
| 2026-08-27 | 20:10 | — | — | Documentation | — | Merge branch 'main' of https://github.com/mdresch/socialengage (3f21e11) |
| 2026-08-27 | 20:05 | — | — | Review | Story 9.6 | chore(tracking): record post-commit review entries for Story 9.6 (bb3281c) |
| 2026-08-27 | 20:05 | — | — | Review | Story 9.6 | chore(tracking): record post-commit review entries for Story 9.6 (e0018a4) |
| 2026-08-27 | 20:04 | — | — | Documentation | — | feat(story-9.6): Onboarding checklist UI (frontend) (8fd0aa4) |
| 2026-08-27 | 16:52 | — | — | Documentation | — | chore(synthesis): commit self-learning synthesis outputs and tracking docs (b3599e5) |
| 2026-08-27 | 16:49 | — | — | Documentation | ADR-0086 | docs(adr): accept ADR-0086 (Prospecting list model) and ADR-0087 (Preconfigured analytics views) (a15222e) |
| 2026-08-27 | 16:48 | — | — | Documentation | ADR-0086 | docs(adr): accept ADR-0086 (Prospecting list model) and ADR-0087 (Preconfigured analytics views) (1f581dd) |
| 2026-08-27 | 14:25 | — | — | Documentation | Story 6.6 | fix(dashboard): recognize Relocated story status so Story 6.6 stub is not counted as pending (2ccc739) |
| 2026-08-27 | 14:17 | — | — | Documentation | Story 3.7 | fix(dashboard): recognize Retired story status so Story 3.7 is not counted as pending (c490a99) |
| 2026-08-27 | 12:47 | — | — | Design | ADR-0083 | Accept ADR-0083, ADR-0084, ADR-0085 — RAG vector store, search/ask endpoints, and UI/UX patterns (f5d56ab) |
| 2026-08-27 | 12:43 | — | — | Infrastructure | — | fix(synthesis): run capture-compile sequentially in post-commit hook (0a7def7) |
| 2026-08-27 | 12:40 | — | — | Infrastructure | ADR-0122 | feat(synthesis): wire ADR-0122 capture-compile into post-commit hook for Story 14.5 (d1ab715) |
| 2026-08-27 | 12:36 | — | — | Documentation | ADR-0122 | feat(synthesis): wire full raw/ capture-compile pipeline for ADR-0122 (6f4f25e) |
| 2026-08-27 | 12:10 | — | — | Documentation | Story 14.5 | docs(adr-0122): complete Story 14.5 self-learning synthesis remediation (4595a20) |
| 2026-08-27 | 08:29 | — | — | Documentation | — | chore: sync tracking docs and dashboard telemetry after pull (1eac41f) |
| 2026-08-26 | 14:14 | — | — | Documentation | Story 6.2 | docs(trace): add Story 6.2 healing pass implementation log entry (fe8ef00) |
| 2026-08-26 | 14:14 | — | — | Documentation | — | heal(story-6.2): add CSS module mapper to Jest config for page.module.css import (3cb453d) |
| 2026-08-26 | 09:57 | — | — | Documentation | — | docs(trace): fix healing pass implementation log commit hash (0e4b787) |
| 2026-08-26 | 09:56 | — | — | Documentation | — | heal(story-4.4/9.5): fix stale test template DB missing pg_cron and onboarding_checklist (01bce70) |
| 2026-08-26 | 09:55 | — | — | Documentation | — | heal(story-4.4/9.5): fix stale test template DB missing pg_cron and onboarding_checklist (7920e48) |
| 2026-08-26 | 09:55 | — | — | Documentation | — | heal(story-4.4/9.5): fix stale test template DB missing pg_cron and onboarding_checklist (01064dd) |
| 2026-08-26 | 09:54 | — | — | Documentation | — | heal(story-4.4/9.5): fix stale test template DB missing pg_cron and onboarding_checklist (00066ec) |
| 2026-08-26 | 09:53 | — | — | Documentation | — | heal(story-4.4/9.5): fix stale test template DB missing pg_cron and onboarding_checklist (0ee011c) |
| 2026-08-25 | 17:11 | — | — | Documentation | — | chore(dashboard): sync local project telemetry  Generated with [Devin](https://devin.ai)  Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com> (fbfe9ed) |
| 2026-08-25 | 16:58 | — | — | Documentation | — | Merge origin/main (aa2488b) |
| 2026-08-25 | 16:44 | — | — | Review | ADR-0081 | docs(adr): reviewed ADR-0081–0084, BRD/FDD-0081–0085, and Epic 9 stories (b12f5ec) |
| 2026-08-25 | 10:11 | — | — | Documentation | ADR-0079 | docs(trace): align FDD-0079 and Stories 9.3/9.4 with ADR-0079's 2026-08-25 amendment (acb4ec9) |
| 2026-08-25 | 08:51 | — | — | Documentation | — | chore(infra): extend multi-agent isolation to social-listening-admin; add user-story skill (4878510) |
| 2026-08-24 | 20:24 | — | — | Documentation | ADR-0080 | docs(trace): fix ADR-0080 README status, create Epic 14, update no-story ADR list (0a7c450) |
| 2026-08-24 | 18:04 | — | — | Documentation | Story 9.1 | docs(trace): finalize Story 9.1 Built field and Implementation Log entry (f912b13) |
| 2026-08-24 | 18:01 | — | — | Review | Story 9.1 | feat(core): Story 9.1 / ADR-0077 — watchlist connector count and preview volume endpoint (a4bf276) |
| 2026-08-24 | 17:31 | — | — | Documentation | — | chore(infra): update implement-story and heal-contract-failure skills and Postgres template DB test harness (56aec12) |
| 2026-08-24 | 16:29 | — | — | Documentation | ADR-0080 | docs(onboarding): approve BRD-0080 and FDD-0080 and unblock Stories 9.5 and 9.6 following ADR-0080 acceptance (a9f73c4) |
| 2026-08-24 | 15:24 | — | — | Infrastructure | ADR-0080 | docs(adr): accept ADR-0080 with milestone locking, bundled query reconciliation, and TypeScript contracts (7f2e1f9) |
| 2026-08-24 | 15:13 | — | — | Infrastructure | — | feat(dashboard): add automated repository sync script and predev/prebuild triggers (8e16327) |
| 2026-08-24 | 15:03 | — | — | Documentation | — | feat(dashboard): transform into enterprise telemetry portal with sidebar, test contracts, extended roadmap, and ADR open questions resolution center (44b4962) |
| 2026-08-24 | 14:14 | — | — | Documentation | Story 1.9 | docs(trace): backfill Story 1.9 Built field (f49bba1) |
| 2026-08-24 | 14:06 | — | — | Documentation | Story 6.10 | docs(trace): backfill Story 6.10 Built field (c7ecbc3) |
| 2026-08-24 | 14:01 | — | — | Documentation | Story 6.9 | docs(trace): backfill Story 6.9 Built field (68b70be) |
| 2026-08-24 | 13:58 | — | — | Documentation | Story 6.16 | docs(trace): backfill Story 6.16 Built field (9fb2086) |
| 2026-08-24 | 13:22 | — | — | Documentation | Story 6.38 | docs(trace): finalize Story 6.38 Built field and Implementation Log entry (ef1e984) |
| 2026-08-24 | 13:12 | — | — | Documentation | Story 6.38 | feat(admin): Story 6.38 / ADR-0073 — post detail reply composer and replies tab (ae5d16a) |
| 2026-08-24 | 12:56 | — | — | Documentation | Story 6.38 | feat(admin): Story 6.38 contract (b62e2c0) |
| 2026-08-24 | 11:44 | — | — | Documentation | Story 6.35 | docs(trace): backfill Story 6.35 Built field and Implementation Log entry (3c64c15) |
| 2026-08-24 | 11:40 | — | — | Documentation | Story 6.34 | docs(trace): backfill Story 6.34 Built field and Implementation Log entry (ebf4144) |
| 2026-08-24 | 11:38 | — | — | Documentation | Story 6.33 | docs(trace): backfill Story 6.33 Built field and Implementation Log entry (a920eee) |
| 2026-08-24 | 11:36 | — | — | Documentation | Story 6.32 | docs(trace): backfill Story 6.32 Built field and Implementation Log entry (e7d69a1) |
| 2026-08-24 | 11:32 | — | — | Documentation | Story 6.31 | docs(trace): backfill Story 6.31 Built field and Implementation Log entry (86b7b7e) |
| 2026-08-24 | 10:57 | — | — | Documentation | Story 3.17 | docs(trace): Story 3.17 implementation log and Built field (f75da21) |
| 2026-08-24 | 10:56 | — | — | Documentation | Story 3.17 | feat(composer): Story 3.17 POST /v1/composer/research Deep Research endpoint (ADR-0076) (bdd9bcf) |
| 2026-08-24 | 10:53 | — | — | Documentation | — | feat(dashboard): add standalone Next.js project progress dashboard with interactive charts and gauges (8ac5a8a) |
| 2026-08-24 | 08:19 | — | — | Documentation | Story 3.16 | docs(trace): Story 3.16 implementation log and Built field (5b4ebd6) |
| 2026-08-24 | 08:17 | — | — | Documentation | Story 3.16 | feat(export): Story 3.16 tenant workspace and matched-posts exports (ADR-0074) (0d11e3f) |
| 2026-08-24 | 07:01 | — | — | Documentation | Story 3.15 | docs(trace): Story 3.15 implementation log and Built field (fc48c3a) |
| 2026-08-24 | 07:00 | — | — | Documentation | Story 3.15 | feat(outbound-post): Story 3.15 outbound post publishing audit table and POST/GET/DELETE /v1/outbound/posts (8e7f312) |
| 2026-08-23 | 21:23 | — | — | Documentation | Story 3.14 | docs(trace): Story 3.14 implementation log and Built field (18d5e77) |
| 2026-08-23 | 21:19 | — | — | Documentation | Story 3.14 | feat(outbound-reply): Story 3.14 outbound_activities table and POST/GET /v1/posts/:id/replies (e3e661b) |
| 2026-08-23 | 20:14 | — | — | Documentation | Story 2.32 | docs(trace): Story 2.32 implementation log and Built field (9d7b31b) |
| 2026-08-23 | 20:12 | — | — | Documentation | Story 2.32 | feat(azure-openai): optional research?() capability (Story 2.32, ADR-0076) (7854300) |
| 2026-08-23 | 20:12 | — | — | Documentation | — | docs(brd): commit updated BRD drafts (bd9cb91) |
| 2026-08-23 | 20:12 | — | — | Documentation | — | docs(fdd): commit updated FDD drafts (a8551b4) |
| 2026-08-23 | 20:10 | — | — | Documentation | — | docs(fdd): commit updated FDD drafts (dfa3673) |
| 2026-08-23 | 20:10 | — | — | Documentation | — | docs(brd): commit updated BRD drafts (0bba070) |
| 2026-08-23 | 20:04 | — | — | Documentation | ADR-0079 | docs(adr): accept ADR-0079 and add newly drafted ADRs 0118-0121 (0c1d5b9) |
| 2026-08-23 | 20:03 | — | — | Documentation | ADR-0079 | docs(fdd): regenerate FDD-0079 and BRD-0079 for accepted ADR-0079 (ce1c11a) |
| 2026-08-23 | 20:03 | — | — | Documentation | ADR-0079 | docs(user-stories): mark ADR-0079 stories Ready and refresh Epic 9 statuses (b64bf07) |
| 2026-08-23 | 20:03 | — | — | Documentation | — | docs(skills): add fdd-writer and fdd-writer-batch skill modules (17a3405) |
| 2026-08-23 | 19:50 | — | — | Documentation | Story 2.30 | docs(trace): Story 2.30 implementation log and Built field (1a28fc5) |
| 2026-08-23 | 19:49 | — | — | Documentation | Story 2.30 | feat(linkedin): LinkedIn post publishing (Story 2.30, ADR-0075) (3a65691) |
| 2026-08-23 | 18:41 | — | — | Documentation | Story 2.29 | docs(trace): Story 2.29 implementation log and Built field (af0c048) |
| 2026-08-23 | 18:38 | — | — | Documentation | Story 2.29 | feat(facebook): Facebook Page post publishing (Story 2.29, ADR-0075) (4234834) |
| 2026-08-23 | 16:21 | — | — | Documentation | Story 2.28 | docs(trace): Story 2.28 implementation log and Built field (e04854d) |
| 2026-08-23 | 16:11 | — | — | Documentation | Story 2.28 | feat(core): Connector publish framework and outbound post rate gate (Story 2.28, ADR-0075) (f1e0f9b) |
| 2026-08-23 | 15:21 | — | — | Documentation | — | docs(skills): include BRD/FDD context in heal-contract-failure (3df8ccf) |
| 2026-08-23 | 15:19 | — | — | Documentation | — | docs(skills): include BRD/FDD context in implement-story process (c63752e) |
| 2026-08-23 | 15:15 | — | — | Documentation | Story 2.27 | docs(trace): Story 2.27 implementation log and Built field (3bf8786) |
| 2026-08-23 | 15:12 | — | — | Documentation | Story 2.27 | feat(core): Facebook Page reply implementation (Story 2.27, ADR-0073) (2da26eb) |
| 2026-08-23 | 14:57 | — | — | Documentation | — | docs: add FDD template and functional design documents for ADR/BRD 0001-0121 (dc22ecc) |
| 2026-08-23 | 14:38 | — | — | Documentation | Story 2.31 | docs(trace): Story 2.31 implementation log and Built field (0364adb) |
| 2026-08-23 | 14:37 | — | — | Documentation | Story 2.31 | feat(core): Brave and Bing one-off research search helpers (Story 2.31) (4949200) |
| 2026-08-23 | 14:36 | — | — | Documentation | Story 2.26 | docs(trace): Story 2.26 implementation log and Built field (9231a67) |
| 2026-08-23 | 14:34 | — | — | Documentation | Story 2.26 | feat(core): implement Story 2.26 connector reply framework and outbound rate gate (ADR-0073) (e3df7d9) |
| 2026-08-23 | 11:24 | — | — | Documentation | — | docs: add BRD-Template and one BRD for every ADR 0001-0121 (eb319d6) |
| 2026-08-22 | 01:33 | — | — | Review | — | docs: add manager-review note on roadmap brainstorming and ADR expansion (bae4adf) |
| 2026-08-22 | 01:30 | — | — | Documentation | — | devin: add research skills for feature design and comparison (5c1e521) |
| 2026-08-22 | 01:20 | — | — | Documentation | — | feat(admin): wire Polypost Composer to real publish target dialog and loading states (6a8b69e) |
| 2026-08-24 | 05:33 | — | — | Review | — | chore: record post-commit hook outputs for this scheduled review's own commits (8b9bd14) |
| 2026-08-24 | 05:33 | — | — | Review | — | Scheduled doc review: Documentation Steward pass (2026-08-24) (3a8ff91) |
| 2026-08-24 | 05:24 | — | — | Review | — | Scheduled doc review: Ideal Manager and L&D Writer passes (2026-08-24) (5ff1879) |
| 2026-08-22 | 01:17 | — | — | Documentation | ADR-0076 | docs: persist ADR-0076, implementation stories, and pending design docs (3e86b5f) |
| 2026-08-22 | 01:13 | — | — | Documentation | — | docs: capture v1.5/v2 feature roadmap with ADRs 0077-0117 and user stories (658b392) |
| 2026-08-22 | 18:47 | — | — | Review | — | Merge origin/main and keep local review tracking copies (298411d) |
| 2026-08-22 | 18:16 | — | — | Review | — | docs: preserve local management and steward review tracking (c9b06b4) |
| 2026-08-22 | 17:53 | — | — | Documentation | ADR-0073 | docs(adr): accept ADR-0073 and add user stories for outbound reply to ingested posts (f9273d5) |
| 2026-08-22 | 17:30 | — | — | Documentation | Story 6.37 | docs: Implementation Log and Built field for Story 6.37 (6f6990f) |
| 2026-08-22 | 17:26 | — | — | Documentation | Story 6.37 | feat: Story 6.37 — admin post-feed Facebook Page and matched watchlist attribution (ADR-0067) (b40041f) |
| 2026-08-22 | 15:37 | — | — | Documentation | Story 6.37 | docs(user-stories): add Story 6.37 for ADR-0067 admin-side Facebook Page and watchlist attribution (5f962e8) |
| 2026-08-22 | 15:35 | — | — | Documentation | ADR-0067 | docs(adr): amend ADR-0067 with admin-side Facebook Page and matched watchlist attribution (3d16bf1) |
| 2026-08-22 | 15:23 | — | — | Documentation | Story 6.36 | docs: finalize Story 6.36 traceability and Implementation Log (ef24e9d) |
| 2026-08-22 | 15:20 | — | — | Documentation | Story 6.36 | feat(admin): Story 6.36 / ADR-0072 — contract, SKILL.md, and alt-text traceability for Polypost Composer (f459114) |
| 2026-08-21 | 10:19 | — | — | Documentation | — | docs: sync tracking records (4af9dda) |
| 2026-08-21 | 10:19 | — | — | Documentation | — | fix(core): improve LinkedIn credential parsing, profile fetching, and version handling (e31fe98) |
| 2026-08-21 | 09:40 | — | — | Documentation | — | docs: sync tracking records (3f9024c) |
| 2026-08-21 | 09:40 | — | — | Documentation | — | fix(core): enable configurable lookback and ingest historical Instagram posts (1713a09) |
| 2026-08-21 | 08:56 | — | — | Documentation | — | docs: sync tracking records (6d5f5b8) |
| 2026-08-21 | 08:56 | — | — | Documentation | — | fix(core): update scheduler test provider roster, refine reconnect_required derivation, and handle Graph API error bodies (3318b2b) |
| 2026-08-21 | 08:38 | — | — | Review | — | docs: finalize review queues and time tracking records (cd8e624) |
| 2026-08-21 | 08:38 | — | — | Documentation | — | docs: sync user stories, implementation log, and time tracking (9510c47) |
| 2026-08-21 | 08:38 | — | — | Documentation | — | feat(admin): enhance Analytics drawer and post list cards with author, top entities, and key phrases (6d3169e) |
| 2026-08-21 | 08:38 | — | — | Documentation | — | feat(admin): display ingested post count on last successful run and render connector status indicators (2f428e0) |
| 2026-08-21 | 08:37 | — | — | Documentation | — | feat(core): isolate historical credential failures, record posts ingested count, and mount instagram & linkedin routers (5d56919) |
| 2026-08-21 | 08:37 | — | — | Documentation | Story 6.35 | feat(admin): implement LinkedIn connector UI and OAuth proxy (Story 6.35, ADR-0069) (89eb97c) |
| 2026-08-21 | 08:37 | — | — | Documentation | Story 2.25 | feat(core): implement LinkedIn REST API connector and OAuth flow (Story 2.25, ADR-0069) (513b125) |
| 2026-08-21 | 08:37 | — | — | Documentation | Story 6.32 | test(admin): add contract test for Bing Search connector UI (Story 6.32, ADR-0066) (0c24532) |
| 2026-08-21 | 08:36 | — | — | Documentation | Story 6.34 | feat(admin): implement Instagram Business connector UI and OAuth proxy (Story 6.34, ADR-0068) (986a93c) |
| 2026-08-21 | 08:36 | — | — | Documentation | Story 2.24 | feat(core): implement Instagram Business Graph API connector and OAuth flow (Story 2.24, ADR-0068) (86f093b) |
| 2026-08-20 | 00:57 | — | — | Documentation | Story 2.22 | feat(core): implement bing search active watchlist sourcing connector (Story 2.22, ADR-0066) (8de21b3) |
| 2026-08-20 | 00:57 | — | — | Documentation | Story 2.22 | feat(core): implement bing search active watchlist sourcing connector (Story 2.22, ADR-0066) (bb34673) |
| 2026-08-20 | 00:33 | — | — | Documentation | Story 3.13 | docs(stories): mark Story 3.13 and Story 6.31 as Implemented (ADR-0071) (cede597) |
| 2026-08-20 | 00:24 | — | — | Documentation | Story 6.30 | feat(admin): expose brave search connector setup and watchlist sourcing (Story 6.30, ADR-0065) (5ff540a) |
| 2026-08-20 | 00:18 | — | — | Documentation | Story 6.30 | feat(admin): expose brave search connector setup and watchlist sourcing (Story 6.30, ADR-0065) (dedfb6b) |
| 2026-08-20 | 00:01 | — | — | Documentation | Story 2.21 | feat(core): implement brave search active watchlist sourcing connector (Story 2.21, ADR-0065) (16a47d8) |
| 2026-08-20 | 00:01 | — | — | Documentation | Story 2.21 | feat(core): implement brave search active watchlist sourcing connector (Story 2.21, ADR-0065) (4df8d6d) |
| 2026-08-20 | 23:50 | — | — | Review | — | docs: sync review and time tracking for healing pass (e67a53d) |
| 2026-08-20 | 23:50 | — | — | Documentation | — | fix(core+admin): heal postgres connection pool deadlock and scope facebook page health (d0094f6) |
| 2026-08-20 | 23:50 | — | — | Documentation | — | fix(core+admin): heal postgres connection pool deadlock and scope facebook page health (0052776) |
| 2026-08-20 | 23:50 | — | — | Documentation | — | fix(core+admin): heal postgres connection pool deadlock and scope facebook page health (dca7b22) |
| 2026-08-20 | 21:26 | — | — | Review | Story 6.33 | docs(reviews): sync review tracking for Story 6.33 (519fb4b) |
| 2026-08-20 | 21:26 | — | — | Documentation | Story 6.33 | feat(admin): implement Facebook hosting Page attribution and author distinction display (Story 6.33 / ADR-0067) (b0dc89e) |
| 2026-08-20 | 21:11 | — | — | Review | Story 2.23 | docs(reviews): sync review tracking for Story 2.23 (2b908be) |
| 2026-08-20 | 21:11 | — | — | Documentation | Story 2.23 | feat(core): implement Facebook Graph API from extraction and two-tier author resolution (Story 2.23 / ADR-0067) (450fffc) |
| 2026-08-20 | 20:57 | — | — | Review | — | docs(reviews): update pending reviews with latest story commits (9e6c2c4) |
| 2026-08-20 | 20:57 | — | — | Documentation | — | chore: update tracking docs and apply UI connector label refinements (c1c7b2f) |
| 2026-08-20 | 20:57 | — | — | Documentation | Story 6.31 | feat(admin): implement post enrichment cascading edit drawer and entity categorization (Story 6.31 / ADR-0071) (9260f6f) |
| 2026-08-20 | 20:57 | — | — | Documentation | Story 3.13 | feat(core): implement post enrichment overrides API and precedence guard (Story 3.13 / ADR-0071) (d9639df) |
| 2026-08-20 | 19:53 | — | — | Documentation | ADR-0068 | docs(adr): accept ADR-0068 (Instagram) & ADR-0069 (LinkedIn); draft Stories 2.24, 2.25, 6.34, 6.35 (9617cec) |
| 2026-08-20 | 19:35 | — | — | Documentation | ADR-0067 | docs(adr): accept ADR-0067 and draft Story 2.23 and Story 6.33 (1c47d9e) |
| 2026-08-20 | 19:15 | — | — | Documentation | — | fix(analytics): add resilient error handling for watchlist coverage and analytics initial load (30ed2df) |
| 2026-08-20 | 19:11 | — | — | Documentation | — | feat(tenant): include Facebook connector and display connected status in Active Connectors card (7cd9cf9) |
| 2026-08-20 | 19:01 | — | — | Infrastructure | ADR-0067 | docs(adr): update ADR-0067 with modernized catalog description, active ingestion clarification, and personal intent sharing (b26cc4f) |
| 2026-08-20 | 18:55 | — | — | Documentation | — | docs(deferred): document personal account outbound post authoring and browser intent URI sharing (e2802f2) |
| 2026-08-20 | 18:44 | — | — | Documentation | ADR-0067 | docs(adr): update ADR-0067 with Personal Account analysis, Tier-3 OAuth alignment, and ADR-0064 geo normalization (Proposed) (a697749) |
| 2026-08-20 | 18:38 | — | — | Documentation | ADR-0066 | docs(adr): accept ADR-0066 and draft Story 2.22 and Story 6.32 for Bing Search connector (1872453) |
| 2026-08-20 | 18:35 | — | — | Documentation | ADR-0066 | docs(adr): update ADR-0066 with Author mapping, AST validation, pacing loop, and direct Azure billing (Proposed) (b6631ad) |
| 2026-08-20 | 18:30 | — | — | Documentation | Story 3.13 | docs(stories): draft Story 3.13 (backend enrichment overrides API) and Story 6.31 (cascading drawer UI) for ADR-0071 (761a25a) |
| 2026-08-20 | 18:29 | — | — | Documentation | ADR-0071 | docs(adr): update ADR-0071 with re-enrichment precedence, audit history, a11y, and mark as Accepted (210f063) |
| 2026-08-20 | 18:26 | — | — | Documentation | ADR-0071 | docs(adr): draft ADR-0071 Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI (dae4b78) |
| 2026-08-20 | 18:18 | — | — | Documentation | Story 2.21 | docs(stories): draft Story 2.21 (Brave Search backend connector) and Story 6.30 (Brave Search admin UI) for ADR-0065 (49760f7) |
| 2026-08-20 | 18:16 | — | — | Review | ADR-0065 | docs(adr): update ADR-0065 with review recommendations and mark as Accepted (1dd76ef) |
| 2026-08-20 | 18:07 | — | — | Documentation | ADR-0064 | docs(adr): mark ADR-0064 as Accepted and Story 8.10 as Built (3ee2b75) |
| 2026-08-20 | 18:02 | — | — | Documentation | Story 6.29 | docs: record Story 6.29 implementation in log and user story metadata (8930de7) |
| 2026-08-20 | 18:02 | — | — | Documentation | Story 6.29 | feat(admin): implement Story 6.29 connector ingestion status badges, stalled alerts banner, and on-demand re-sync (ADR-0070) (be6c4cd) |
| 2026-08-20 | 17:29 | — | — | Infrastructure | Story 1.16 | chore: record post-commit hook outputs for Story 1.16 (3df6e74) |
| 2026-08-20 | 17:28 | — | — | Documentation | Story 1.16 | docs: record Story 1.16 implementation in log and user story metadata (e40d3e5) |
| 2026-08-20 | 17:27 | — | — | Documentation | Story 1.16 | feat(core): implement Story 1.16 ingestion watchdog, stalled health, and alert events (ADR-0070) (ae1bd98) |
| 2026-08-20 | 16:45 | — | — | Infrastructure | ADR-0070 | chore: record post-commit hook outputs for ADR-0070 acceptance (39211ac) |
| 2026-08-20 | 16:44 | — | — | Documentation | ADR-0070 | docs: accept ADR-0070 and update Stories 1.16 and 6.29 with lock-safe watchdog and health precedence (f00b34c) |
| 2026-08-20 | 16:43 | — | — | Infrastructure | ADR-0070 | chore: record post-commit hook outputs for ADR-0070 (79da4c8) |
| 2026-08-20 | 16:42 | — | — | Documentation | ADR-0070 | docs: draft ADR-0070, Story 1.16, and Story 6.29 for connector ingestion status, watchdog, and alerts (70035d7) |
| 2026-08-20 | 16:39 | — | — | Infrastructure | Story 8.10 | chore: record post-commit hook outputs for Story 8.10 (07a885b) |
| 2026-08-20 | 16:39 | — | — | Documentation | Story 8.10 | docs: record Story 8.10 implementation in user stories and log (168e5f7) |
| 2026-08-20 | 16:38 | — | — | Documentation | Story 8.10 | Story 8.10: Location & Geospatial Insights on Overview tab with SVG choropleth map (ADR-0064) (75a0a4a) |
| 2026-08-20 | 16:25 | — | — | Infrastructure | — | chore: record post-commit hook outputs for merge (4740537) |
| 2026-08-20 | 16:24 | — | — | Documentation | — | Merge remote-tracking branch 'origin/main' (93dadab) |
| 2026-08-20 | 16:22 | — | — | Review | — | docs: record review logs for 8bc60a1 (ca847c0) |
| 2026-08-20 | 16:20 | — | — | Documentation | Story 2.20 | Story 2.20: Country-level geospatial extraction and normalization on post enrichment (ADR-0064) (8bc60a1) |
| 2026-08-20 | 14:05 | — | — | Review | — | docs: update review logs (ad3e8be) |
| 2026-08-20 | 14:03 | — | — | Documentation | — | feat(analytics): add platform icons and brand coloring to Authors by Source widget (d2dff0d) |
| 2026-08-20 | 13:49 | — | — | Review | — | docs: update review tracking (624c626) |
| 2026-08-20 | 13:48 | — | — | Documentation | — | feat(analytics): add well-known platform icons and dynamic percentage linebars to sources widget (8cbb71a) |
| 2026-08-20 | 13:42 | — | — | Review | — | docs: update review logs (034e968) |
| 2026-08-20 | 13:42 | — | — | Documentation | — | feat(analytics): place Sources and Authors widgets underneath volume graph in centre column (72a15c9) |
| 2026-08-20 | 12:46 | — | — | Review | — | docs: update review logs (c3044d0) |
| 2026-08-20 | 12:46 | — | — | Documentation | — | fix(tenant): show most-recently ingested posts first in recent ingestion stream (cb953f1) |
| 2026-08-20 | 12:43 | — | — | Review | — | docs: update review logs (142638c) |
| 2026-08-20 | 12:42 | — | — | Documentation | — | feat(tenant): update overview metric cards with icons, full-width grid, and real actuals (8d9b6f3) |
| 2026-08-20 | 12:38 | — | — | Review | — | docs: update review tracking (6115e1b) |
| 2026-08-20 | 12:38 | — | — | Documentation | — | feat(shell): add icons to sidebar navigation items and make sidebar collapsable (76941c0) |
| 2026-08-20 | 12:31 | — | — | Review | — | docs: update reviews and time tracking (8e50e38) |
| 2026-08-20 | 12:30 | — | — | Documentation | — | feat(analytics): promote toolbar items to header for persistent visibility across all tabs (1edd1e7) |
| 2026-08-20 | 12:20 | — | — | Review | — | docs: update review logs and time tracking (ee03f09) |
| 2026-08-20 | 12:20 | — | — | Documentation | — | fix(analytics): align topic selector, date range picker, and matching posts count on a single control line (3d7d743) |
| 2026-08-20 | 12:05 | — | — | Review | — | docs: update review logs and time tracking (3e3c352) |
| 2026-08-20 | 12:05 | — | — | Documentation | — | fix(analytics): sort watchlist coverage descending by post count and limit to top 6 items (aa1e7f5) |
| 2026-08-20 | 12:00 | — | — | Documentation | Story 3.12 | docs(story-3.12): record Story 3.12 implementation and update traceability (af83d18) |
| 2026-08-20 | 11:59 | — | — | Documentation | — | feat(story-3.12): post-watchlist match historical backfill and discovery attribution (3adc060) |
| 2026-08-20 | 11:40 | — | — | Documentation | Story 3.12 | docs(story-3.12): draft Story 3.12 and add ADR-0063 Amendment Log for historical backfill and discovery attribution (1320adb) |
| 2026-08-20 | 11:24 | — | — | Documentation | Story 8.9 | docs(story-8.9): record implementation and traceability for Story 8.9 (1fee797) |
| 2026-08-20 | 11:23 | — | — | Documentation | — | feat(story-8.9): selectedTopic watchlist filter and Watchlist Coverage widget (605e5a4) |
| 2026-08-20 | 09:55 | — | — | Review | — | docs: sync tracking and review registers (983ae70) |
| 2026-08-20 | 09:54 | — | — | Review | — | docs: ADR filename fixes and governance review updates (1bb19f7) |
| 2026-08-20 | 09:54 | — | — | Documentation | — | feat(story-6.28): tenant-owned-feed friendly naming in setup UI (cc38b6a) |
| 2026-08-20 | 09:21 | — | — | Documentation | Story 2.19 | docs: implementation log entry for Story 2.19, Built hash finalized (e54f937) |
| 2026-08-20 | 09:20 | — | — | Documentation | — | feat(story-2.19): tenant-owned-feed per-feed name + per-item byline (2f52c0f) |
| 2026-08-20 | 08:39 | — | — | Documentation | — | fix(post-feed): surface Facebook Page author and original-post link (2fa45ba) |
| 2026-08-20 | 08:33 | — | — | Documentation | — | fix(facebook-connector): denormalize Page id/name into rawPayload (75362d3) |
| 2026-08-20 | 08:13 | — | — | Documentation | — | fix(post-feed): allocate the Newswire issuer to the author position (cd6f41e) |
| 2026-08-20 | 08:09 | — | — | Documentation | — | fix(analytics-overview): unreadable white-on-white post title in drawer rows (efa96e8) |
| 2026-08-20 | 07:58 | — | — | Documentation | — | feat(analytics-overview): live UI/UX refinements + stacked post-detail drawer (2859a76) |
| 2026-08-20 | 05:18 | — | — | Infrastructure | — | chore: post-commit hook outputs for 6673537 (ab41a7c) |
| 2026-08-20 | 05:18 | — | — | Infrastructure | — | fix(post-commit hook): stop the queue files from re-queuing their own bookkeeping commits (6673537) |
| 2026-08-20 | 05:16 | — | — | Infrastructure | — | chore: post-commit hook outputs for d5ef459 (d4c8ca0) |
| 2026-08-20 | 05:15 | — | — | Infrastructure | — | chore: post-commit hook outputs for 532e713 (d5ef459) |
| 2026-08-20 | 05:13 | — | — | Review | — | Scheduled doc review: 2026-08-20 — clear 14-entry backlog across all three review queues (532e713) |
| 2026-08-19 | 20:52 | — | — | Documentation | Story 8.7 | docs: implementation log entry for Story 8.7, Built hash finalized (6a59885) |
| 2026-08-19 | 20:51 | — | — | Documentation | Story 8.7 | feat: Story 8.7 — Overview Tab Enhancement (ADR-0062), folded in with ADR-0062/0063 acceptance (7698563) |
| 2026-08-19 | 20:06 | — | — | Documentation | — | docs: methodology amendment — epic-scoped local validation, CI as the unconditional full-suite gate (1d550a1) |
| 2026-08-19 | 19:54 | — | — | Documentation | Story 3.11 | docs: implementation log entry for Story 3.11 healing pass (6e6755e) |
| 2026-08-19 | 19:52 | — | — | Documentation | Story 3.11 | fix: Story 3.11 heal — post_watchlist_matches FK conflict, ambiguous-column JOIN bug, fixture typo (63902a1) |
| 2026-08-19 | 17:15 | — | — | Documentation | — | Writen the ADRs 0064 0065 0066 0067 0068 0069 (5d3ec45) |
| 2026-08-19 | 13:41 | — | — | Documentation | Story 6.27 | docs: implementation log entry for Story 6.27 backend healing pass (49a7e26) |
| 2026-08-19 | 13:41 | — | — | Documentation | — | heal(story-6.27): give the fan-out test enough real-world margin (1974d1d) |
| 2026-08-19 | 12:44 | — | — | Documentation | Story 6.1 | docs: implementation log entry for Story 6.1 healing pass (afe53ac) |
| 2026-08-19 | 12:43 | — | — | Documentation | — | heal(story-6.1): fix broken local-dev login and Jest TLS-trust gap (23e94fc) |
| 2026-08-19 | 10:26 | — | — | Documentation | Story 6.24 | docs: implementation log entry for Story 6.24 (8fe2960) |
| 2026-08-19 | 10:25 | — | — | Documentation | — | feat(story-6.24): connector status screen groups Connectors and AI Providers (5d76e44) |
| 2026-08-19 | 05:28 | — | — | Review | — | Scheduled doc review: 2026-08-19 — clear 81-entry backlog across all three review queues (6080795) |
| 2026-08-18 | 17:13 | — | — | Documentation | Story 6.11 | docs: implementation log entry for Story 6.11 Facebook title fix (afd846b) |
| 2026-08-18 | 17:13 | — | — | Documentation | — | fix(post-feed): normalize Facebook post titles instead of raw JSON (fc011df) |
| 2026-08-18 | 16:35 | — | — | Documentation | Story 6.27 | docs: implementation log entry for Story 6.27 (a02edb1) |
| 2026-08-18 | 16:34 | — | — | Documentation | ADR-0060 | feat(story-6.27): Facebook multi-Page-per-user support (ADR-0060) (b58b323) |
| 2026-08-18 | 15:03 | — | — | Documentation | Story 1.15 | docs: implementation log entry for Story 1.15 (42b1e59) |
| 2026-08-18 | 15:02 | — | — | Documentation | ADR-0061 | feat(story-1.15): Tier-3 per-user poll scheduling (ADR-0061) (b270662) |
| 2026-08-18 | 14:25 | — | — | Documentation | — | docs(story-2.18): implementation log entry and Built field (87c6792) |
| 2026-08-18 | 14:24 | — | — | Documentation | — | feat(story-2.18): Facebook connector captures post-level engagement counts (35e35c3) |
| 2026-08-18 | 13:27 | — | — | Documentation | — | docs: analytics dashboard tab frontend specs (Overview, Sentiment, Source, Conversations, Location) (2de0b19) |
| 2026-08-18 | 13:24 | — | — | Documentation | — | docs: add Social Ingest and Command Center Design brainstorm (Gemini/AI Studio) (d623dac) |
| 2026-08-18 | 13:21 | — | — | Review | — | chore: SessionStart git-hook self-heal, plus queued review/time-tracking entries (be3807d) |
| 2026-08-18 | — | — | auto | Documentation | ADR-0059 | docs: ADR-0059/0060/0061 acceptance and Story 6.27/1.15 governance update (7c0572c) |
| 2026-08-18 | — | — | auto | Documentation | — | docs(story-6.23): implementation log entry and Built field (f6a1794) |
| 2026-08-18 | — | — | auto | Documentation | — | feat(story-6.23): Facebook OAuth connect flow with Page selection (535338f) |
| 2026-08-18 | — | — | auto | Documentation | — | docs(story-1.14): implementation log entry and Built field (3ce8db2) |
| 2026-08-18 | — | — | auto | Documentation | — | feat(story-1.14): poll scheduler skips a pair whose most recent run is still running (838e3dc) |
| 2026-08-18 | — | — | auto | Documentation | — | docs(story-2.15): implementation log entry and Built field (caf50ed) |
| 2026-08-18 | — | — | auto | Documentation | — | feat(story-2.15): Facebook connector -- tenant's own Page, Tier 3 credential (50a5914) |
| 2026-08-18 | — | — | auto | Documentation | — | docs(story-6.26): implementation log entry and Built field (42e693f) |
| 2026-08-18 | — | — | auto | Documentation | — | feat(story-6.26): post feed's Provider filter derives its options from real data (03c37c9) |
| 2026-08-18 | — | — | auto | Documentation | — | docs(story-6.25): implementation log entry and Built field (05d9ee0) |
| 2026-08-18 | — | — | auto | Documentation | — | feat(story-6.25): post feed shows most-recently-ingested posts first (6550716) |
| 2026-08-18 | — | — | auto | Documentation | — | docs(story-2.17): implementation log entry and Built field (28090fe) |
| 2026-08-18 | — | — | auto | Documentation | — | feat(story-2.17): Azure OpenAI structured enrichment gains a summary field (6a9b628) |
| 2026-08-18 | — | — | auto | Documentation | — | docs(story-2.16): implementation log entry and Built field (38c3e51) |
| 2026-08-18 | — | — | auto | Documentation | — | fix(story-2.16): azureAiLanguageConnector throws classified error on rejected document (3fedac3) |
| 2026-08-18 | — | — | auto | Documentation | Story 6.22 | docs: implementation log entry for Story 6.22 (14ada1b) |
| 2026-08-18 | — | — | auto | Documentation | — | feat(story-6.22): add Wikipedia to the watchlist screen's platform-source list (8182706) |
| 2026-08-17 | — | — | auto | Documentation | Story 2.14 | docs: implementation log entry for Story 2.14 (8ed1e7b) |
| 2026-08-17 | — | — | auto | Documentation | — | feat(story-2.14): Wikipedia discovery search driven by the tenant's own watchlist terms (c802b64) |
| 2026-08-17 | — | — | auto | Documentation | — | The latest round of fronbend designs with Google AI Stduio App builder. Latest brainstorm sessions and the reworks of the frontend designs (2317c60) |
| 2026-08-17 | — | — | auto | Documentation | — | Design principals with Gemini Building a new frontend (fd6cdb3) |
| 2026-08-17 | — | — | auto | Documentation | Story 6.21 | docs: implementation log entry for Story 6.21 (ce4c2fa) |
| 2026-08-17 | — | — | auto | Documentation | — | feat(story-6.21): expose the Wikipedia connector in the Tenant Admin UI (21c30bf) |
| 2026-08-17 | — | — | auto | Documentation | Story 2.13 | docs: implementation log entry for Story 2.13 (e7055db) |
| 2026-08-17 | — | — | auto | Documentation | — | feat(story-2.13): Wikipedia connector — MediaWiki Action API, revision re-poll via recentchanges, article-as-Author (591b0b8) |
| 2026-08-17 | — | — | auto | Documentation | Story 5.19 | docs: implementation log entry for Story 5.19 (8ee53d9) |
| 2026-08-17 | — | — | auto | Documentation | — | feat(story-5.19): wire SocialPostIngestedEvent/ConnectorHealthChangedEvent publishing into the real ingestion pipeline (3ef32ad) |
| 2026-08-17 | — | — | auto | Documentation | Story 6.20 | docs: traceability for Story 6.20 (tenant-owned-feed multi-feed administration) (b05f317) |
| 2026-08-17 | — | — | auto | Documentation | Story 6.20 | feat(admin): tenant-owned-feed multi-feed administration (Story 6.20, admin half) (be1764d) |
| 2026-08-17 | — | — | auto | Documentation | Story 6.20 | feat(core): tenant-owned-feed multi-feed administration (Story 6.20, core half) (e9d797f) |
| 2026-08-17 | — | — | auto | Documentation | — | docs: Implementation Log entry for dead analytics code cleanup (fc41590) |
| 2026-08-17 | — | — | auto | Documentation | — | docs(admin): lock in the dead-analytics-code deletions with contract checks (bd126c8) |
| 2026-08-17 | — | — | auto | Documentation | — | chore(admin): delete dead analytics prototype/demo code (2acee9b) |
| 2026-08-17 | — | — | auto | Documentation | ADR-0056 | docs: accept ADR-0056 and ADR-0057; draft Story 6.20 (bae1277) |
| 2026-08-17 | — | — | auto | Review | ADR-0057 | docs: revise ADR-0057 against an external review (4 points, checked) (114d94f) |
| 2026-08-17 | — | — | auto | Documentation | — | style(admin): widen the main content container from 900px to 1280px (249402a) |
| 2026-08-17 | — | — | auto | Documentation | ADR-0057 | docs: draft ADR-0057 (tenant-owned-feed multi-feed administration) (0a1db2d) |
| 2026-08-17 | — | — | auto | Documentation | — | docs: traceability for seat-counts enhancement and Team & Access redesign (145d38c) |
| 2026-08-17 | — | — | auto | Documentation | — | feat(admin): redesign the Team & Access screen (/tenant/users) (1501247) |
| 2026-08-17 | — | — | auto | Documentation | — | feat(core): expose caller tenant's own seat counts on GET /v1/tenants/users (556bb65) |
| 2026-08-17 | — | — | auto | Documentation | — | docs: Implementation Log entry for language display + card-snippet fix (b86e518) |
| 2026-08-17 | — | — | auto | Documentation | — | feat(admin): show detected language and clean the card-list post snippet (b837b39) |
| 2026-08-17 | — | — | auto | Documentation | Story 6.19 | docs: traceability for Story 6.19 (post body Markdown rendering) (3edfed8) |
| 2026-08-17 | — | — | auto | Documentation | Story 6.19 | feat(admin): render post detail body as real Markdown (Story 6.19) (4f099a6) |
| 2026-08-17 | — | — | auto | Documentation | — | docs: Implementation Log entries for body_markdown exposure and GNews marker fix (00812ac) |
| 2026-08-17 | — | — | auto | Documentation | ADR-0053 | fix(core): GNews truncation marker has no '+' sign (ADR-0053 Open Q11 resolved) (4bea1b8) |
| 2026-08-17 | — | — | auto | Documentation | — | feat(core): expose body_markdown over GET /v1/posts and GET /v1/posts/:id (aa4f317) |
| 2026-08-17 | — | — | auto | Documentation | ADR-0023 | docs: log ADR-0023 ceiling-recovery healing pass (6152308) |
| 2026-08-17 | — | — | auto | Documentation | — | fix(core): shouldAttemptIngestion() allows a bounded probe once ceiling-failing (ff66d31) |
| 2026-08-17 | — | — | auto | Documentation | — | docs: log Provider filter tenant-owned-feed value fix (177de14) |
| 2026-08-17 | — | — | auto | Documentation | — | fix(admin): Provider filter's tenant-owned-feed option used the wrong value (5886a3e) |
| 2026-08-17 | — | — | auto | Documentation | Story 6.14 | docs: log Story 6.14 (50c7de1) |
| 2026-08-17 | — | — | auto | Documentation | Story 6.14 | feat(admin): Story 6.14 — access-history view on the tenant users screen (a27aa10) |
| 2026-08-17 | — | — | auto | Documentation | Story 6.18 | docs: log Story 6.18 (5c23158) |
| 2026-08-17 | — | — | auto | Documentation | Story 6.18 | feat(admin): Story 6.18 — post feed search/filter operates over all matched posts (a97cf30) |
| 2026-08-17 | — | — | auto | Documentation | — | docs: log Key Vault credential-storage healing pass (1d49817) |
| 2026-08-17 | — | — | auto | Documentation | — | fix(core): connect fails clearly when KEY_VAULT_KEY_ID is unconfigured (eeb9c8c) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.6 | docs: log Story 8.6, draft ADR-0056 (AI-inferred Newswire dateline location) (0ca3a9b) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.6 | feat(admin): Story 8.6 — Sources tab per-source sentiment score, volume-over-time (a17af3f) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.5 | docs: log Story 8.5, close out Epic 8's traceability (fa457e9) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.5 | feat(admin): Story 8.5 — Languages breakdown widget (8b8bb14) |
| 2026-08-17 | — | — | auto | Documentation | ADR-0055 | docs: accept ADR-0055, move Story 8.5 to Ready (6a55e8b) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.4 | docs: log Story 8.4, draft ADR-0055 (language/location enrichment feasibility) (63d3604) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.4 | feat(admin): Story 8.4 — Overview volume/sentiment charts, period-over-period comparison (ae015e0) |
| 2026-08-17 | — | — | auto | Infrastructure | — | docs: log core-side healing pass, publish infrastructure migration runbook (c1275ed) |
| 2026-08-17 | — | — | auto | Documentation | — | fix(core): reject personal-scope connect/activate for AI provider connectors (5d0fb49) |
| 2026-08-17 | — | — | auto | Documentation | ADR-0028 | fix: no personal-scope credential/activation UI for AI providers (ADR-0028 Tier 2 only) (4082a8a) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.3 | docs: log Story 8.3 (Conversations tab) traceability, closing out Epic 8 (838ac19) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.3 | feat: Story 8.3 — Conversations tab, closing out Epic 8 (5fed9dd) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.2 | docs: log Story 8.2 (Sentiment tab) traceability (05cc132) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.2 | feat: Story 8.2 — Sentiment tab (a54bf05) |
| 2026-08-17 | — | — | auto | Documentation | ADR-0054 | docs: ADR-0054 (Analytics Dashboard), Epic 8, and Story 8.1 traceability (87e8cf4) |
| 2026-08-17 | — | — | auto | Documentation | Story 8.1 | feat: Story 8.1 — Analytics dashboard shell, date-range filter, Overview and Sources tabs (5558e11) |
| 2026-08-17 | — | — | auto | Documentation | — | docs: log the 2026-08-17 healing pass for Stories 6.1/6.2/6.3/6.5/6.11/6.12/6.15 (30816ad) |
| 2026-08-17 | — | — | auto | Documentation | — | fix: heal contract staleness from an uncommitted Server/Client component split (ea9d9fe) |
| 2026-08-13 | — | — | auto | Infrastructure | — | chore: post-commit hook queue entries for 6443562 (8d210af) |
| 2026-08-13 | — | — | auto | Documentation | — | chore: rewrite root README, harden AGENTS.md, wire up VS Code test discovery (6443562) |
| 2026-08-13 | — | — | auto | Documentation | — | docs: methodology retrospective — relationship-assertion contracts, story resume, Built field, environment gotchas (e59b2da) |
| 2026-08-13 | — | — | auto | Documentation | Story 3.10 | docs: implementation log entry for Story 3.10 (social-listening-core@dcec172) (df0c2c3) |
| 2026-08-13 | — | — | auto | Documentation | Story 3.10 | feat: Story 3.10 — canonical Markdown post-body storage and enrichment input (ADR-0053) (dcec172) |
| 2026-08-13 | — | — | auto | Review | — | docs: clear review backlog — Documentation Steward, L&D Writer, Ideal Manager passes (2026-08-13) (13f5163) |
| 2026-08-13 | — | — | auto | Documentation | ADR-0053 | docs: accept ADR-0053, draft Story 3.10 (canonical Markdown post-body normalization) (bd9bbfc) |
| 2026-08-13 | — | — | auto | Documentation | Story 6.17 | docs: implementation log entry for Story 6.17 (social-listening-admin@d0eb088) (780f981) |
| 2026-08-13 | — | — | auto | Documentation | Story 6.17 | feat: tenant-wide activate/deactivate control on tenant-owned-feed screen (Story 6.17, ADR-0051) (d0eb088) |
| 2026-08-13 | — | — | auto | Documentation | Story 1.13 | docs: implementation log entry for Story 1.13 (social-listening-core@a479383) (9a347c6) |
| 2026-08-13 | — | — | auto | Documentation | Story 1.13 | feat: live ingestion-polling scheduler (Story 1.13, ADR-0052) (a479383) |
| 2026-08-13 | — | — | auto | Documentation | Story 6.13 | docs: implementation log entry for Story 6.13 (social-listening-admin@500a4b9) (42ff7b5) |
| 2026-08-13 | — | — | auto | Documentation | Story 6.13 | feat: self-service tenant deletion/offboarding UI (Story 6.13, ADR-0043) (500a4b9) |
| 2026-08-13 | — | — | auto | Documentation | Story 6.12 | docs: implementation log entry for Story 6.12 (social-listening-admin@e1e9913) (b155bc5) |
| 2026-08-13 | — | — | auto | Documentation | Story 6.12 | feat: tenant-owned-feed connector setup UI (Story 6.12, ADR-0050) (e1e9913) |
| 2026-08-13 | — | — | auto | Documentation | — | docs: correct CLAUDE.md's stale Epic 6 build-status summary (57fe1de) |
| 2026-08-12 | — | — | auto | Documentation | — | docs: implementation log entry for ProvisionTenantForm domain field (social-listening-admin@c2aa7b1) (8b54aae) |
| 2026-08-12 | — | — | auto | Documentation | — | feat: ProvisionTenantForm gains an optional domain field (c2aa7b1) |
| 2026-08-12 | — | — | auto | Documentation | — | docs: implementation log entry for tenant rename enhancement (cross-repo@f5bb2d4) (8905c21) |
| 2026-08-12 | — | — | auto | Documentation | — | feat: tenant rename (PATCH /v1/admin/tenants/:id gains name) (f5bb2d4) |
| 2026-08-12 | — | — | auto | Documentation | ADR-0030 | docs: clarify break-glass request intake channel (ADR-0030, Story 5.13) (ab37bf3) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.16 | docs: Story 6.16 traceability and implementation log entries (e5fec8f) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.16 | feat: Story 6.16 (frontend) — manual "run enrichment now" button (21da4f5) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.16 | feat: Story 6.16 (backend) — POST /v1/posts/:id/enrich (51a2b40) |
| 2026-08-12 | — | — | auto | Documentation | — | docs: name the AI-provider status display gap on the connector status screen (e556c3c) |
| 2026-08-12 | — | — | auto | Documentation | — | style: global baseline stylesheet for social-listening-admin (216c32a) |
| 2026-08-12 | — | — | auto | Documentation | — | docs: implementation log entries for the AI provider activation-gating fix and enrichment attribution enhancement (3b5f08b) |
| 2026-08-12 | — | — | auto | Documentation | — | feat: show which AI provider enriched a post on the detail screen (43d36ca) |
| 2026-08-12 | — | — | auto | Documentation | Story 2.9 | fix: activation now gates AI enrichment provider selection (Story 2.9 healing) (99c1dcf) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.11 | docs: implementation log entry for Story 6.11 (social-listening-admin@d8ba590) (6362dda) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.11 | feat: Story 6.11 — post feed screen in social-listening-admin (d8ba590) |
| 2026-08-12 | — | — | auto | Documentation | — | fix: run pending migrations automatically before social-listening-core's dev server starts (4801a36) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.2 | docs: implementation log entry for the Story 6.2 role-gating healing pass (eb8b10b) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.2 | fix: reject unresolved identity in admin role-gating (Story 6.2 healing) (6e110aa) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.15 | docs: implementation log entry for Story 6.15 (social-listening-admin@cc7cae2) (62d78ff) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.15 | feat: Story 6.15 — activate/deactivate controls on the connector screens (cc7cae2) |
| 2026-08-12 | — | — | auto | Documentation | Story 2.13 | docs: draft Story 2.13 — closing a real gap, ADR-0042 (Wikipedia) never got a story (8abacce) |
| 2026-08-12 | — | — | auto | Documentation | Story 2.12 | docs: implementation log entry for Story 2.12 (social-listening-core@da102a9) (5adff09) |
| 2026-08-12 | — | — | auto | Documentation | Story 2.12 | feat: Story 2.12 — exclude retryable failures from the failing derivation (da102a9) |
| 2026-08-12 | — | — | auto | Documentation | Story 1.12 | docs: implementation log entry for Story 1.12 (social-listening-core@c3af2a7) (c481e01) |
| 2026-08-12 | — | — | auto | Documentation | Story 1.12 | feat: Story 1.12 — GET /v1/connectors/:platformId includes real isActive (c3af2a7) |
| 2026-08-12 | — | — | auto | Documentation | Story 1.11 | docs: draft Stories 1.12, 2.12, 6.15 — closing three of Story 1.11's own named gaps (f8985b9) |
| 2026-08-12 | — | — | auto | Documentation | Story 1.11 | docs: implementation log entry for Story 1.11 (social-listening-core@703e755) (7ffd477) |
| 2026-08-12 | — | — | auto | Documentation | Story 1.11 | feat: Story 1.11 — connector activation decoupled from credential presence (703e755) |
| 2026-08-12 | — | — | auto | Documentation | ADR-0051 | docs: companion ADR-0051 cross-reference notes — ADR-0009/0010/0022/0023/0024/0034 (18a0e38) |
| 2026-08-12 | — | — | auto | Documentation | ADR-0051 | docs: ADR governance pass — accept ADR-0051, add Story 1.11 (e6c0617) |
| 2026-08-12 | — | — | auto | Documentation | — | docs: implementation log entry for the connector status Active/Inactive indicator (e430a6b) |
| 2026-08-12 | — | — | auto | Documentation | — | feat(social-listening-admin): show Active/Inactive on every connector, not just connected ones (feae698) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.6 | docs: implementation log entry for Story 6.6 Platform Admin console rebuild (7102011) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.6 | feat(social-listening-admin): rebuild Story 6.6 Platform Admin console for real (51eecf0) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.5 | docs: implementation log entry for Story 6.5 connector status screen rebuild (2e77c17) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.5 | feat(social-listening-admin): rebuild Story 6.5 connector status screen for real (4046e75) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.4 | docs: implementation log entry for Story 6.4 watchlist screen rebuild (d96d782) |
| 2026-08-12 | — | — | auto | Documentation | Story 6.4 | feat(social-listening-admin): rebuild Story 6.4 watchlist screen for real, against ADR-0044 (fded97b) |
| 2026-08-12 | — | — | auto | Documentation | Story 1.5 | docs: correct wrong commit hash on the 2026-08-01 Story 1.5 implementation-log entry (4cd4ef1) |
| 2026-08-12 | — | — | auto | Documentation | Story 3.9 | docs: implementation log entry for Story 3.9 author follower count at publish (3d650c8) |
| 2026-08-12 | — | — | auto | Documentation | Story 3.9 | feat: Story 3.9 -- point-in-time author follower count on SocialPost (ADR-0049) (34e9dfb) |
| 2026-08-12 | — | — | auto | Documentation | Story 2.11 | docs: implementation log entry for Story 2.11 tenant-owned-feed connector (9f09393) |
| 2026-08-12 | — | — | auto | Documentation | Story 2.11 | feat: Story 2.11 -- tenant-owned-domain RSS connector with DNS TXT verification (ADR-0050) (afcb59e) |
| 2026-08-12 | — | — | auto | Documentation | Story 2.10 | docs: implementation log entry for Story 2.10 connector registration transparency (9f90a82) |
| 2026-08-12 | — | — | auto | Documentation | Story 2.10 | feat: Story 2.10 -- connector registration transparency, mechanically enforced (ADR-0048) (f2c7788) |
| 2026-08-12 | — | — | auto | Documentation | — | chore: stop tracking .claude/settings.local.json, gitignore it (8cf76a2) |
| 2026-08-12 | — | — | auto | Documentation | Story 1.10 | docs: implementation log entry for Story 1.10 Postgres readiness check (0694d2c) |
| 2026-08-12 | — | — | auto | Documentation | Story 1.10 | feat: Story 1.10 -- Postgres boot-time readiness check and a real /v1/health (63dcbce) |
| 2026-08-12 | — | — | auto | Documentation | Story 1.5 | docs: implementation log entry for Story 1.5 watchlist ownership rebuild (c5fca67) |
| 2026-08-12 | — | — | auto | Documentation | Story 1.5 | feat: rebuild Story 1.5 watchlist CRUD against ADR-0044 (personal ownership, RFC 7396 PATCH, optimistic locking) (aaf6bd7) |
| 2026-08-11 | — | — | auto | Documentation | ADR-0044 | docs: ADR governance pass — accept ADR-0044/0047/0048/0049/0050, resolve resulting stories (8dff76b) |
| 2026-08-10 | — | — | auto | Documentation | — | chore: remove .vscode/tasks.json and launch.json, dead since the Foundry sample's removal (8018de4) |
| 2026-08-10 | — | — | auto | Documentation | — | chore: remove unrelated Microsoft Foundry Python sample project and stray azd scaffolding (9eef81b) |
| 2026-08-10 | — | — | auto | Documentation | Story 5.15 | docs: implementation log entry for Story 5.15 seat-count healing pass (3ae641e) |
| 2026-08-10 | — | — | auto | Documentation | Story 5.15 | heal: Story 5.15 — self-service tenant founder never consumed a seat (f36d765) |
| 2026-08-10 | — | — | auto | Documentation | — | docs: backlog missing invite-withdrawal capability, found during live invite testing (4551e26) |
| 2026-08-10 | — | — | auto | Documentation | — | docs: backlog a future ADR candidate — richer self-service sign-up business-details form (49eaa50) |
| 2026-08-10 | — | — | auto | Documentation | — | docs: record real Entra tenant-config prerequisites found during live self-service sign-up test (f4c50db) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.2 | docs: implementation log entry for Story 6.2 root-redirect healing pass (596b2c3) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.2 | heal: Story 6.2 — a successful platform_admin sign-in lands on / with only a manual link (35b70a8) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.1 | docs: implementation log entry for Story 6.1 OAuth-scope healing pass (6d08379) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.1 | heal: Story 6.1 — real Platform Admin sign-in blocked by missing OAuth scope and oid-vs-sub seed error (dba9895) |
| 2026-08-10 | — | — | auto | Documentation | Story 1.4 | docs: implementation log entry for Story 1.4 withDevEnv.js healing pass (de96102) |
| 2026-08-10 | — | — | auto | Documentation | Story 1.4 | heal: Story 1.4 — withDevEnv.js never loaded .env, only jest's test setup did (15756e0) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.3 | docs: implementation log entry for Story 6.3 healing pass (d545174) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.3 | heal: Story 6.3 — real connector connect/disconnect flow, not a static placeholder (1dbd26a) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.3 | docs: correct overstated Story 6.3 connect-flow claims in AI connector SKILL.mds (7d978e0) |
| 2026-08-10 | — | — | auto | Documentation | ADR-0049 | docs: draft ADR-0049 and ADR-0050 (Proposed) from Cursor Composer brainstorm session (8e1ac18) |
| 2026-08-10 | — | — | auto | Review | Story 2.9 | docs: implementation log addendum for Story 2.9 self-review/overallConfidence follow-up (d936082) |
| 2026-08-10 | — | — | auto | Review | Story 2.9 | feat: Story 2.9 follow-up — self-review + overallConfidence for Azure OpenAI enrichment (292a22a) |
| 2026-08-10 | — | — | auto | Documentation | Story 2.9 | docs: implementation log entry for Story 2.9 (9007da1) |
| 2026-08-10 | — | — | auto | Documentation | Story 2.9 | feat: Story 2.9 — second AIProviderConnector, Azure OpenAI (gpt-5-mini), provider swappability (69310ba) |
| 2026-08-10 | — | — | auto | Documentation | ADR-0038 | docs: ADR-0038 correction — gpt-4o-mini deprecated, gpt-5-mini deployed instead (54b32fa) |
| 2026-08-10 | — | — | auto | Documentation | ADR-0038 | docs: ADR-0038 amendment — Foundry Local rejected, Azure OpenAI Service selected for Story 2.9 (1e7e9ac) |
| 2026-08-10 | — | — | auto | Documentation | Story 2.8 | docs: implementation log entry for Story 2.8 (80cc28d) |
| 2026-08-10 | — | — | auto | Documentation | Story 2.8 | feat: Story 2.8 — Azure AI Language connector, real AIProviderConnector (ADR-0038) (f70b07d) |
| 2026-08-10 | — | — | auto | Documentation | Story 5.18 | docs: implementation log entry for Story 5.18 (d1ad0c6) |
| 2026-08-10 | — | — | auto | Documentation | Story 5.18 | feat: Story 5.18 — self-service sign-up rate limiting (ADR-0040) (7a2466d) |
| 2026-08-10 | — | — | auto | Documentation | — | docs: implementation log entry for break-glass retry healing pass (d78c598) |
| 2026-08-10 | — | — | auto | Documentation | — | heal: retry break-glass password-reset/TAP calls on transient Graph 409s (99b58c3) |
| 2026-08-10 | — | — | auto | Documentation | Story 5.17 | docs: implementation log entry for Story 5.17 (f0e3c36) |
| 2026-08-10 | — | — | auto | Documentation | Story 5.17 | feat: Story 5.17 — access-history read endpoint (ADR-0032 §9) (5fe1999) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.10 | docs: implementation log entry for Story 6.10 (19d50d7) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.10 | feat: Story 6.10 — Same-Domain Invite Assist view, closing out Epic 6 (3661ce9) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.9 | docs: implementation log entry for Story 6.9 (1e18c4b) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.9 | feat: Story 6.9 — tenant settings screen (9ec62fa) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.8 | docs: implementation log entries for Story 6.8 and its healing follow-up (09b626f) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.8 | feat: Story 6.8 — Tenant-Admin user invitation and management screen (6b7fc00) |
| 2026-08-10 | — | — | auto | Documentation | — | chore: regenerate next-env.d.ts/tsconfig.json for per-test distDir (c89ee47) |
| 2026-08-10 | — | — | auto | Documentation | — | docs: implementation log entry for healing pass (6.1/6.7 dev-server race) (09160c4) |
| 2026-08-10 | — | — | auto | Documentation | Story 6.1 | heal: parallel-worker race between Story 6.1/6.7's spawned dev servers (832f7b3) |
| 2026-08-09 | — | — | auto | Documentation | Story 6.7 | docs: implementation log entry for Story 6.7 (d114c16) |
| 2026-08-09 | — | — | auto | Documentation | Story 6.7 | feat: Story 6.7 — self-service tenant sign-up UI (ADR-0037) (2b44637) |
| 2026-08-09 | — | — | auto | Documentation | Story 1.9 | docs: implementation log entry for Story 1.9 (afd270f) |
| 2026-08-09 | — | — | auto | Documentation | Story 1.9 | feat: Story 1.9 — user invitation and offboarding REST surface (ADR-0032) (3badf2f) |
| 2026-08-09 | — | — | auto | Documentation | ADR-0018 | docs: ADR-0018 amendment + SKILL.md update for partition eligibility boundary fix (75cc58d) |
| 2026-08-09 | — | — | auto | Documentation | Story 3.5 | heal: Story 3.5 — fix archival partition eligibility boundary condition (ADR-0018) (4de308e) |
| 2026-08-09 | — | — | auto | Documentation | Story 1.8 | feat: Story 1.8 — GET /v1/tenants/me tenant self-view endpoint (ADR-0031) (10fc934) |
| 2026-08-09 | — | — | auto | Documentation | — | update github copilot instructions (11186b7) |
| 2026-08-09 | — | — | auto | Documentation | — | ADR changes and updates approvals - VSCode Copilot Registration and project optimizations (0b9e1dd) |
| 2026-08-08 | — | — | auto | Documentation | — | feat: add azd and ai agent deployment config (8abdb48) |
| 2026-08-08 | — | — | auto | Documentation | Story 6.6 | Log Story 6.6 in the Implementation Log (77e1bfc) |
| 2026-08-08 | — | — | auto | Implementation | Story 6.6 | Implement Story 6.6 platform admin console (2b2d40b) |
| 2026-08-08 | — | — | auto | Documentation | — | Time tracking: log commit HH:MM as day-timeline marker (13a909f) |
| 2026-08-08 | — | — | auto | Documentation | — | gitignore: exclude Python __pycache__ and bytecode files (bb42281) |
| 2026-08-08 | — | — | auto | Documentation | — | Add Foundry agent tracing tests (0c3409b) |
| 2026-08-08 | — | — | auto | Review | — | Setup: Codacy config, VS Code MCP settings, Claude settings, and pending reviews (34b5333) |
| 2026-08-08 | — | — | auto | Documentation | — | UI mock designs: globals, types, mockData, and Tailwind config (fa7954c) |
| 2026-08-08 | — | — | auto | Documentation | — | Healing pass: Stories 2.7, 5.7, 5.13 — contract fixes and implementation (488ac49) |
| 2026-08-08 | — | — | auto | Documentation | — | Add Foundry Toolkit setup and configuration (4ff04cd) |
| 2026-08-08 | — | — | auto | Documentation | — | Governance updates: heal-contract-failure SKILL enhancements, new ADRs 0044-0048, and traceability (5b7a69f) |
| 2026-08-08 | — | — | auto | Documentation | Story 1.1 | Story 1.1 healing: restore repo independence by removing parent package.json (c33353d) |
| 2026-08-08 | — | — | auto | Documentation | — | Designs from converting the HTML to Next js frontend pages (769c28c) |
| 2026-08-07 | — | — | auto | Documentation | — | Design documents mockup - microsoft-social-engagement-ui-mockup - including images from social engagement for reference - The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit. (c5e1532) |
| 2026-08-07 | — | — | auto | Documentation | Story 3.8 | Log Story 3.8 in the Implementation Log (b80aa58) |
| 2026-08-07 | — | — | auto | Implementation | Story 3.8 | Implement Story 3.8: self-service tenant deletion (supersedes Story 3.7) (9a99257) |
| 2026-08-06 | — | — | auto | Design | ADR-0043 | Draft ADR-0043: self-service, Tenant-Admin-initiated tenant deletion (9bc1a48) |
| 2026-08-06 | — | — | auto | Documentation | — | Auto-queue bookkeeping for the prior bookkeeping commit (10e310d) |
| 2026-08-06 | — | — | auto | Documentation | — | Auto-queue bookkeeping and time-log rows for recent commits (3c96b74) |
| 2026-08-06 | — | — | auto | Documentation | — | Documentation Steward: close the Stakeholder Management cross-reference gap (f5e4e41) |
| 2026-08-06 | — | — | auto | Review | — | Data Privacy & Sovereignty Reviewer: first real review (7dddb56) |
| 2026-08-06 | — | — | auto | Review | ADR-0038 | Legal & Compliance Reviewer: first real review, ADR-0038 (3a757b7) |
| 2026-08-06 | — | — | auto | Design | ADR-0042 | Draft ADR-0042: Wikipedia connector (MediaWiki API, article-as-Author) (f932f41) |
| 2026-08-06 | — | — | auto | Documentation | — | Fix: auto-derived time-log row landed after the file footer, not in the table (406bf2c) |
| 2026-08-06 | — | — | auto | Documentation | — | Add real, auto-derived commit time-logging to post-commit; fix stale template (cd308eb) |

**Total Time:** Not tracked (see "Metrics Derived from Time Tracking" below) — the log table's own row count is the accurate figure for "commits logged," not a separately-maintained number here that could drift out of sync with it.

---

## 📈 Metrics Derived from Time Tracking

**Corrected 2026-08-06:** every metric below requires real wall-clock duration data this mechanism does not collect (see "Approach" above) — marked **Not tracked**, not "TBD," since "TBD" implies data will eventually fill this in through normal use, which it structurally cannot under the auto-derived mechanism. Commit-count-based metrics (activity mix, story/ADR coverage) are derivable from the log table's own rows today and are a more honest near-term substitute — not built here, a real follow-up if capacity planning is ever actually needed at this project's current solo-developer scale.

### Estimation Accuracy
| Metric | Calculation | Current Value |
|--------|-------------|---------------|
| Avg Estimate vs. Actual | (Estimated Hours - Actual Hours) / Estimated Hours | Not tracked — no duration data collected |
| Estimation Error % | (Actual - Estimated) / Estimated × 100 | Not tracked — no duration data collected |

### Velocity
| Metric | Calculation | Current Value |
|--------|-------------|---------------|
| Stories per Hour | Stories Completed / Total Hours | Not tracked — no duration data collected |
| Points per Hour | Story Points / Total Hours | Not tracked — no duration data collected |

### Capacity
| Metric | Calculation | Current Value |
|--------|-------------|---------------|
| Available Hours/Week | Self-reported capacity | Not tracked — no duration data collected |
| Utilization % | Actual Hours / Available Hours × 100 | Not tracked — no duration data collected |

---

## 🎯 Usage Instructions

### For Each Commit (automatic, since 2026-08-06):
1. **After committing:** `scripts/git-hooks/post-commit` reads the commit's own hash and message — no prompt, nothing to enter.
2. **Automatic entry:** the hook infers an Activity category and a Story/ADR reference (if the subject names one) and appends a row to the log table above.
3. **Honest gaps, not fabrication:** Start Time, End Time, and Duration are recorded as `—`/`auto` — this mechanism cannot know real elapsed time, and does not invent a plausible-looking number to fill the column.

### Manual Entry (if you want real duration data for a specific session):
Add a row directly to the table above, following the same format the auto-derived rows use:
```
| YYYY-MM-DD | HH:MM | HH:MM | minutes | Activity | Story/ADR | Notes |
```
A manually-entered row with real Start/End times is the only way this file will ever contain real duration data — the automatic mechanism deliberately doesn't attempt to.

---

## 📋 Session Types

| Type | Description | Example |
|------|-------------|---------|
| **Implementation** | Writing code to pass contracts | Story 2.7 implementation |
| **Design** | Drafting ADRs, architecture decisions | ADR-0026 drafting |
| **Debugging** | Investigating and fixing issues | Contract failure diagnosis |
| **Review** | AI agent review, code review | Architecture review |
| **Infrastructure** | Environment setup, CI/CD | GitHub Actions setup |
| **Documentation** | Writing docs, updating plans | Management plans |
| **Meeting** | External discussions, planning | Stakeholder review |

---

## 🔧 Technical Details

**Hook location:** `scripts/git-hooks/post-commit` (synced to `.git/hooks/post-commit` by `scripts/setup-git-hooks.js`) — corrected 2026-08-06 from this file's own prior, inaccurate claim of a `.git/hooks/pre-commit` Node.js prompt, which never actually existed.

**Hook type:** POSIX `sh`, same file that already queues the Ideal Manager/Documentation Steward/Learning & Development Writer reviews (`docs/management/pending-manager-reviews.md` and siblings) — time-logging is one more thing that same hook does per commit, not a separate mechanism.

**Skipped scenarios:**
- A commit whose only changed file is `docs/time-tracking.md` itself (avoids a self-referential logging loop).
- Non-blocking either way: this runs post-commit, after the commit has already succeeded — it can never fail or delay a commit, unlike a pre-commit hook would.

**Bypass:** not applicable — there's nothing to bypass; `--no-verify` skips pre-commit/commit-msg hooks, not post-commit.

---

## 📊 Template for Monthly Time Report

```markdown
# Monthly Time Report — [Month] [Year]

**Reporting Period:** [Start Date] to [End Date]
**Total Time:** [X] hours ([Y] minutes)

## Summary
- **Stories Completed:** [N]
- **ADRs Created:** [N]
- **Estimated Time:** [X] hours
- **Actual Time:** [Y] hours
- **Estimation Accuracy:** [Z]%

## Breakdown by Activity
| Activity | Time (hours) | % of Total |
|----------|--------------|------------|
| Implementation | [X] | [Y]% |
| Design | [X] | [Y]% |
| Debugging | [X] | [Y]% |
| Review | [X] | [Y]% |
| Infrastructure | [X] | [Y]% |
| Documentation | [X] | [Y]% |
| **Total** | **[X]** | **100%** |

## Breakdown by Story/ADR
| Story/ADR | Estimated | Actual | Variance | Notes |
|-----------|-----------|--------|----------|-------|
| Story 2.7 | [X]h | [Y]h | [Z]h | GNews connector |

## Lessons Learned
- [Lesson 1]
- [Lesson 2]

## Next Month Goals
- [Goal 1]
- [Goal 2]
```

---

*This file is automatically maintained by `scripts/git-hooks/post-commit`. Manual edits are permitted but should follow the established format.*
