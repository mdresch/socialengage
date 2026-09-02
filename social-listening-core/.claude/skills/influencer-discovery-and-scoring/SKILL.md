---
name: influencer-discovery-and-scoring
description: Author scoring model (reach, engagement, authenticity, influence) and discovery API endpoints with topic and platform filtering and score explainability per ADR-0108.
---

# Influencer Discovery and Scoring Skill

## Contracts that constrain this component

- `social-listening-core/contracts/epic-12/story-12.15.influencer-discovery-and-scoring.contract.test.ts` — Story 12.15 contract test.

## Overview
Implements Story 12.15 (ADR-0108):
- Author scoring columns (`reach_score`, `engagement_score`, `authenticity_score`, `influence_score`).
- Weighted composite calculation:
  `influence_score = min(100, 0.25 * reach + 0.35 * engagement + 0.20 * authenticity + 0.20 * topic_relevance)`.
- Background/daily scoring refresh worker (`refreshAuthorScores(tenantId)`).
- Discovery API (`GET /v1/influencers`) with `topicId`, `platformId`, `watchlistId`, `minScore`, `sort`, and `limit` filters.
- Score explainability API (`GET /v1/influencers/:authorId/explain`).

## Key Types & Functions
```ts
export interface ComputedScores {
  reachScore: number;
  engagementScore: number;
  authenticityScore: number;
  topicRelevance: number;
  influenceScore: number;
}

export function computeAuthorScores(input: ScoreInput): ComputedScores;
export function refreshAuthorScores(tenantId: string): Promise<number>;
export function queryInfluencers(tenantId: string, params: InfluencerQueryParams): Promise<InfluencerItem[]>;
export function explainInfluencerScore(tenantId: string, authorId: string): Promise<ScoreExplanation | null>;
```
