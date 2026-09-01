/**
 * Topic curation utilities — Story 12.8 (ADR-0104).
 * Shared types and utility functions used by topic curation UI components.
 */

export interface Topic {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  status: 'active' | 'merged' | 'hidden';
  merged_into_topic_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type TopicCurationAction = 'rename' | 'merge' | 'hide';

export interface TopicStatusBadge {
  label: string;
  color: string;
}

/**
 * Converts a human-readable topic name into a URL-safe slug.
 * E.g. "Cloud Computing" -> "cloud-computing"
 */
export function slugifyTopicName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Returns the badge label and color for a topic status.
 */
export function getTopicStatusBadge(status: 'active' | 'merged' | 'hidden'): TopicStatusBadge {
  switch (status) {
    case 'active':
      return { label: 'Active', color: 'green' };
    case 'merged':
      return { label: 'Merged', color: 'blue' };
    case 'hidden':
      return { label: 'Hidden', color: 'gray' };
  }
}
