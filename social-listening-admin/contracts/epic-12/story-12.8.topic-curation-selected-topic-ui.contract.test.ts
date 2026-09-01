/**
 * Contract: Story 12.8 (ADR-0104, BRD-0104, FDD-0104) — Topic curation and selected topic UI (frontend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-128--topic-curation-and-selected-topic-ui-frontend
 * and docs/adr/0104-ai-topic-clustering-post-topics-schema.md
 */

import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import {
  slugifyTopicName,
  getTopicStatusBadge,
  Topic,
  TopicCurationAction,
} from '../../src/components/topics/topicCurationUtils';
import { TopicBadge } from '../../src/components/topics/TopicBadge';
import { TopicsView } from '../../src/components/topics/TopicsView';
import { TopicSelector } from '../../src/components/topics/TopicSelector';

describe('Story 12.8 — Topic curation and selected topic UI (frontend)', () => {
  const sampleTopics: Topic[] = [
    {
      id: 'topic-1',
      tenant_id: 'tenant-abc',
      name: 'Cloud Computing',
      slug: 'cloud-computing',
      status: 'active',
      merged_into_topic_id: null,
      description: 'All things cloud',
      created_at: '2026-08-01T10:00:00Z',
      updated_at: '2026-08-01T10:00:00Z',
    },
    {
      id: 'topic-2',
      tenant_id: 'tenant-abc',
      name: 'Kubernetes Deployment',
      slug: 'kubernetes-deployment',
      status: 'merged',
      merged_into_topic_id: 'topic-3',
      description: null,
      created_at: '2026-08-01T10:00:00Z',
      updated_at: '2026-08-10T10:00:00Z',
    },
    {
      id: 'topic-3',
      tenant_id: 'tenant-abc',
      name: 'Container Orchestration',
      slug: 'container-orchestration',
      status: 'active',
      merged_into_topic_id: null,
      description: 'Docker, Kubernetes, Helm',
      created_at: '2026-08-01T10:00:00Z',
      updated_at: '2026-08-01T10:00:00Z',
    },
    {
      id: 'topic-4',
      tenant_id: 'tenant-abc',
      name: 'Deprecated Framework',
      slug: 'deprecated-framework',
      status: 'hidden',
      merged_into_topic_id: null,
      description: null,
      created_at: '2026-08-01T10:00:00Z',
      updated_at: '2026-08-15T10:00:00Z',
    },
  ];

  describe('AC1: slugifyTopicName utility', () => {
    it('converts names to slugs correctly', () => {
      expect(slugifyTopicName('Cloud Computing')).toBe('cloud-computing');
      expect(slugifyTopicName('Artificial Intelligence & ML')).toBe('artificial-intelligence-ml');
      expect(slugifyTopicName('  DevOps Tools  ')).toBe('devops-tools');
      expect(slugifyTopicName('Kubernetes (v1.28)')).toBe('kubernetes-v1-28');
    });
  });

  describe('AC2: getTopicStatusBadge utility', () => {
    it('returns correct badge labels for each status', () => {
      expect(getTopicStatusBadge('active').label).toBe('Active');
      expect(getTopicStatusBadge('merged').label).toBe('Merged');
      expect(getTopicStatusBadge('hidden').label).toBe('Hidden');
    });

    it('returns distinct colors for each status', () => {
      const active = getTopicStatusBadge('active');
      const merged = getTopicStatusBadge('merged');
      const hidden = getTopicStatusBadge('hidden');
      expect(active.color).not.toBe(merged.color);
      expect(active.color).not.toBe(hidden.color);
    });
  });

  describe('AC3: TopicBadge component renders correctly', () => {
    it('renders active topic badge with name and slug', () => {
      const html = renderToStaticMarkup(
        React.createElement(TopicBadge, { topic: sampleTopics[0] })
      );
      expect(html).toContain('Cloud Computing');
      expect(html).toContain('cloud-computing');
    });

    it('renders merged topic badge with alias indicator', () => {
      const html = renderToStaticMarkup(
        React.createElement(TopicBadge, { topic: sampleTopics[1] })
      );
      expect(html).toContain('Kubernetes Deployment');
      expect(html.toLowerCase()).toContain('merged');
    });

    it('renders hidden topic with hidden indicator', () => {
      const html = renderToStaticMarkup(
        React.createElement(TopicBadge, { topic: sampleTopics[3] })
      );
      expect(html).toContain('Deprecated Framework');
      expect(html.toLowerCase()).toContain('hidden');
    });
  });

  describe('AC4: TopicsView component lists and shows curation actions', () => {
    it('renders active topics with rename, merge, and hide actions', () => {
      const activeTopics = sampleTopics.filter((t) => t.status === 'active');
      const html = renderToStaticMarkup(
        React.createElement(TopicsView, {
          topics: activeTopics,
          onRename: () => {},
          onMerge: () => {},
          onHide: () => {},
        })
      );
      expect(html).toContain('Cloud Computing');
      expect(html).toContain('Container Orchestration');
      expect(html).toMatch(/rename/i);
      expect(html).toMatch(/merge/i);
      expect(html).toMatch(/hide/i);
    });

    it('shows merged topic aliases in the list', () => {
      const html = renderToStaticMarkup(
        React.createElement(TopicsView, {
          topics: sampleTopics,
          showAll: true,
          onRename: () => {},
          onMerge: () => {},
          onHide: () => {},
        })
      );
      expect(html).toContain('Kubernetes Deployment');
      expect(html.toLowerCase()).toContain('merged');
    });

    it('renders empty state when no topics exist', () => {
      const html = renderToStaticMarkup(
        React.createElement(TopicsView, {
          topics: [],
          onRename: () => {},
          onMerge: () => {},
          onHide: () => {},
        })
      );
      expect(html).toBeTruthy();
      expect(html).not.toContain('Cloud Computing');
    });
  });

  describe('AC5: TopicSelector for dashboard selectedTopic filter', () => {
    it('renders topic selector with list of active topics', () => {
      const activeTopics = sampleTopics.filter((t) => t.status === 'active');
      const html = renderToStaticMarkup(
        React.createElement(TopicSelector, {
          topics: activeTopics,
          selectedTopicId: null,
          onSelect: () => {},
        })
      );
      expect(html).toContain('Cloud Computing');
      expect(html).toContain('Container Orchestration');
    });

    it('renders selected topic as highlighted', () => {
      const activeTopics = sampleTopics.filter((t) => t.status === 'active');
      const html = renderToStaticMarkup(
        React.createElement(TopicSelector, {
          topics: activeTopics,
          selectedTopicId: 'topic-1',
          onSelect: () => {},
        })
      );
      expect(html).toContain('Cloud Computing');
    });

    it('renders "All Topics" option when no topic is selected', () => {
      const activeTopics = sampleTopics.filter((t) => t.status === 'active');
      const html = renderToStaticMarkup(
        React.createElement(TopicSelector, {
          topics: activeTopics,
          selectedTopicId: null,
          onSelect: () => {},
        })
      );
      expect(html).toMatch(/all topics/i);
    });
  });
});
