/**
 * TopicBadge — Story 12.8 (ADR-0104).
 * Renders a badge for a topic showing its name, slug, and status indicator.
 * Merged topics display an alias indicator.
 */

import React from 'react';
import { Topic, getTopicStatusBadge } from './topicCurationUtils';

interface TopicBadgeProps {
  topic: Topic;
}

const statusColorMap: Record<string, string> = {
  green: '#16a34a',
  blue: '#2563eb',
  gray: '#6b7280',
};

export function TopicBadge({ topic }: TopicBadgeProps): React.ReactElement {
  const badge = getTopicStatusBadge(topic.status);
  const color = statusColorMap[badge.color] ?? '#6b7280';

  return React.createElement(
    'span',
    {
      className: `topic-badge topic-badge--${topic.status}`,
      style: { display: 'inline-flex', alignItems: 'center', gap: 6 },
    },
    React.createElement(
      'span',
      { className: 'topic-badge__name', style: { fontWeight: 600 } },
      topic.name
    ),
    React.createElement(
      'code',
      { className: 'topic-badge__slug', style: { fontSize: '0.75em', color: '#6b7280' } },
      topic.slug
    ),
    React.createElement(
      'span',
      {
        className: `topic-badge__status topic-badge__status--${topic.status}`,
        style: {
          fontSize: '0.7em',
          padding: '1px 6px',
          borderRadius: 9999,
          background: color,
          color: '#fff',
          fontWeight: 700,
          textTransform: 'uppercase' as const,
        },
        title:
          topic.status === 'merged' && topic.merged_into_topic_id
            ? `Merged into ${topic.merged_into_topic_id}`
            : badge.label,
      },
      badge.label
    )
  );
}
