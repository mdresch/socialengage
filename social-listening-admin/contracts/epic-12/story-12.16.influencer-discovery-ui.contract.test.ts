/**
 * Contract: Story 12.16 (ADR-0108, BRD-0108, FDD-0108) — Influencer discovery UI (frontend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-1216--influencer-discovery-ui-frontend
 * and docs/adr/0108-influencer-discovery-and-scoring.md
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InfluencerCard } from '../../src/components/influencers/InfluencerCard';
import { InfluencerDiscoveryView } from '../../src/components/influencers/InfluencerDiscoveryView';
import type { InfluencerItem } from '../../src/lib/core-client';

describe('Story 12.16 — Influencer discovery UI (frontend)', () => {
  const mockInfluencers: InfluencerItem[] = [
    {
      authorId: 'auth-1',
      authorName: 'Alex TechLead',
      platformId: 'twitter',
      publicUrl: 'https://twitter.com/alextech',
      reachScore: 88.0,
      engagementScore: 79.5,
      authenticityScore: 92.0,
      influenceScore: 84.8,
      topTopics: [
        { topicId: 'ai', topicName: 'Artificial Intelligence', relevance: 0.95 },
        { topicId: 'cloud', topicName: 'Cloud Computing', relevance: 0.8 },
      ],
      recentPosts: 24,
    },
    {
      authorId: 'auth-2',
      authorName: 'Sarah Marketing Guru',
      platformId: 'linkedin',
      publicUrl: 'https://linkedin.com/in/sarahguru',
      reachScore: 72.0,
      engagementScore: 94.0,
      authenticityScore: 89.0,
      influenceScore: 81.3,
      topTopics: [
        { topicId: 'growth', topicName: 'Growth Marketing', relevance: 0.88 },
      ],
      recentPosts: 12,
    },
  ];

  describe('AC1: InfluencerCard renders multi-factor score bars and topic tags', () => {
    it('displays author name, platform badge, four score bars, and topics', () => {
      const html = renderToStaticMarkup(
        React.createElement(InfluencerCard, {
          influencer: mockInfluencers[0],
          onAddToProspectingList: () => {},
        })
      );

      expect(html).toContain('Alex TechLead');
      expect(html).toContain('twitter');
      expect(html).toContain('Influence');
      expect(html).toContain('84.8');
      expect(html).toContain('Reach');
      expect(html).toContain('88');
      expect(html).toContain('Engagement');
      expect(html).toContain('79.5');
      expect(html).toContain('Authenticity');
      expect(html).toContain('92');
      expect(html).toContain('Artificial Intelligence');
      expect(html).toContain('Add to Prospecting List');
      expect(html).toContain('View Posts');
    });
  });

  describe('AC2: InfluencerDiscoveryView renders filter toolbar and sort options', () => {
    it('displays filters for platform, topic, minScore, and sort selector', () => {
      const html = renderToStaticMarkup(
        React.createElement(InfluencerDiscoveryView, {
          initialInfluencers: mockInfluencers,
          platforms: ['twitter', 'linkedin', 'facebook', 'youtube'],
          topics: ['Artificial Intelligence', 'Growth Marketing', 'Cloud Computing'],
        })
      );

      expect(html).toContain('Influencer Discovery');
      expect(html).toContain('All Platforms');
      expect(html).toContain('All Topics');
      expect(html).toContain('Sort by');
      expect(html).toContain('Alex TechLead');
      expect(html).toContain('Sarah Marketing Guru');
    });

    it('renders empty state when no influencers match criteria', () => {
      const html = renderToStaticMarkup(
        React.createElement(InfluencerDiscoveryView, {
          initialInfluencers: [],
        })
      );

      expect(html).toContain('No influencers found');
    });
  });

  describe('AC3: Actions and Navigation', () => {
    it('includes view posts link with authorId parameter', () => {
      const html = renderToStaticMarkup(
        React.createElement(InfluencerCard, {
          influencer: mockInfluencers[0],
          onAddToProspectingList: () => {},
        })
      );

      expect(html).toContain('/tenant/posts?authorId=auth-1');
    });
  });
});
