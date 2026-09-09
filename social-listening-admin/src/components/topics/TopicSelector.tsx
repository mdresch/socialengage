/**
 * TopicSelector — Story 12.8 (ADR-0104).
 * Dashboard header selector for filtering by a specific topic.
 * Renders an "All Topics" option when selectedTopicId is null.
 * The `selectedTopicId` is intended to be persisted in URL search params
 * for deep linking (e.g., ?selectedTopic=topic-1).
 */

import React from 'react';
import { Topic } from './topicCurationUtils';

interface TopicSelectorProps {
  topics: Topic[];
  selectedTopicId: string | null;
  onSelect: (topicId: string | null) => void;
}

const selectorStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const selectStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

export function TopicSelector({
  topics,
  selectedTopicId,
  onSelect,
}: TopicSelectorProps): React.ReactElement {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onSelect(value === '' ? null : value);
  };

  return React.createElement(
    'div',
    { className: 'topic-selector', style: selectorStyle },
    React.createElement(
      'label',
      {
        htmlFor: 'topic-selector-select',
        style: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
      },
      'Topic:'
    ),
    React.createElement(
      'select',
      {
        id: 'topic-selector-select',
        value: selectedTopicId ?? '',
        onChange: handleChange,
        style: selectStyle,
        'aria-label': 'Filter dashboard by topic',
      },
      React.createElement(
        'option',
        { value: '' },
        'All Topics'
      ),
      ...topics.map((topic) =>
        React.createElement(
          'option',
          { key: topic.id, value: topic.id },
          topic.name
        )
      )
    )
  );
}
