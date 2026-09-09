---
name: ai-topic-clustering-post-topics-schema
description: Schema, store, curation lifecycle, and 7-day rolling refresh worker for AI topic clustering and post_topics junction (ADR-0104)
---

# AI Topic Clustering Post-Topics Schema (ADR-0104)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-12/story-12.7.ai-topic-clustering-post-topics-schema.contract.test.ts` — Story 12.7 contract test.

## Overview

Story 12.7 (ADR-0104, BRD-0104, FDD-0104) introduces relational topic persistence for AI clustering, replacing pure JSONB containment with a normalized `topics` catalog and `post_topics` junction table with tenant-isolated Row-Level Security (RLS).

## Schema (`migrations/0060_create_topics_and_post_topics.sql`)

```sql
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'merged' | 'hidden'
  merged_into_topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_topics_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS post_topics (
  post_id UUID NOT NULL,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, topic_id)
);
```

## Curation API Endpoints

- `GET /v1/topics` — List active topics for tenant (supports `?status=all` and `?search=...`).
- `POST /v1/topics/:id/rename` — Rename topic name & regenerated slug.
- `POST /v1/topics/:id/merge` — Merge source topic into target topic, update `post_topics` references, mark status `'merged'`.
- `POST /v1/topics/:id/hide` — Mark topic status `'hidden'`.

## Background Refresh

- `TopicClusteringRefresh.run({ tenantId, windowDays = 7 })` handles scheduled re-clustering across the 7-day rolling ingestion window.
