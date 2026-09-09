/**
 * TopicsView — Story 12.8 (ADR-0104).
 * Lists topics with rename, merge, and hide curation actions.
 * By default only shows active topics; pass showAll=true to include merged/hidden.
 * Merged topics appear with an alias indicator showing which active topic they merged into.
 */

import React from 'react';
import { Topic, TopicCurationAction, getTopicStatusBadge } from './topicCurationUtils';
import { TopicBadge } from './TopicBadge';

interface TopicsViewProps {
  topics: Topic[];
  showAll?: boolean;
  onRename: (topic: Topic) => void;
  onMerge: (topic: Topic) => void;
  onHide: (topic: Topic) => void;
}

const actionButtonStyle: React.CSSProperties = {
  padding: '2px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 500,
};

export function TopicsView({
  topics,
  showAll = false,
  onRename,
  onMerge,
  onHide,
}: TopicsViewProps): React.ReactElement {
  const visibleTopics = showAll ? topics : topics.filter((t) => t.status === 'active');

  if (visibleTopics.length === 0) {
    return React.createElement(
      'div',
      { className: 'topics-view topics-view--empty', style: { padding: 24, color: '#6b7280' } },
      'No topics found.'
    );
  }

  return React.createElement(
    'div',
    { className: 'topics-view' },
    React.createElement(
      'table',
      { className: 'topics-view__table', style: { width: '100%', borderCollapse: 'collapse' } },
      React.createElement(
        'thead',
        null,
        React.createElement(
          'tr',
          null,
          React.createElement('th', { style: { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #e5e7eb' } }, 'Topic'),
          React.createElement('th', { style: { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #e5e7eb' } }, 'Status'),
          React.createElement('th', { style: { textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid #e5e7eb' } }, 'Actions')
        )
      ),
      React.createElement(
        'tbody',
        null,
        ...visibleTopics.map((topic) =>
          React.createElement(
            'tr',
            { key: topic.id, className: `topics-view__row topics-view__row--${topic.status}` },
            React.createElement(
              'td',
              { style: { padding: '8px 12px', borderBottom: '1px solid #f3f4f6' } },
              React.createElement(TopicBadge, { topic }),
              topic.status === 'merged' && topic.merged_into_topic_id
                ? React.createElement(
                    'span',
                    { style: { marginLeft: 8, fontSize: '0.75em', color: '#6b7280' } },
                    `→ merged into ${topic.merged_into_topic_id}`
                  )
                : null
            ),
            React.createElement(
              'td',
              { style: { padding: '8px 12px', borderBottom: '1px solid #f3f4f6' } },
              getTopicStatusBadge(topic.status).label
            ),
            React.createElement(
              'td',
              { style: { padding: '8px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' } },
              topic.status === 'active'
                ? [
                    React.createElement(
                      'button',
                      { key: 'rename', onClick: () => onRename(topic), style: actionButtonStyle, 'aria-label': `Rename ${topic.name}` },
                      'Rename'
                    ),
                    React.createElement(
                      'button',
                      { key: 'merge', onClick: () => onMerge(topic), style: actionButtonStyle, 'aria-label': `Merge ${topic.name}` },
                      'Merge'
                    ),
                    React.createElement(
                      'button',
                      { key: 'hide', onClick: () => onHide(topic), style: { ...actionButtonStyle, color: '#dc2626' }, 'aria-label': `Hide ${topic.name}` },
                      'Hide'
                    ),
                  ]
                : React.createElement(
                    'span',
                    { style: { fontSize: '0.8em', color: '#9ca3af' } },
                    topic.status === 'merged' ? 'Alias' : '—'
                  )
            )
          )
        )
      )
    )
  );
}
