import React from 'react';
import { SocialConnectorCapabilities } from '../../lib/core-client';

interface ConnectorCapabilityBadgesProps {
  capabilities?: SocialConnectorCapabilities;
  className?: string;
}

export function ConnectorCapabilityBadges({ capabilities, className = '' }: ConnectorCapabilityBadgesProps) {
  if (!capabilities) return null;

  const badges: Array<{ label: string; key: string; color: string }> = [];

  if (capabilities.poll) {
    badges.push({ label: 'Poll', key: 'poll', color: 'bg-blue-50 text-blue-700 border-blue-200' });
  }

  if (capabilities.publish) {
    badges.push({ label: 'Publish', key: 'publish', color: 'bg-green-50 text-green-700 border-green-200' });
  }

  if (capabilities.reply) {
    badges.push({ label: 'Reply', key: 'reply', color: 'bg-purple-50 text-purple-700 border-purple-200' });
  }

  if (capabilities.count) {
    badges.push({ label: 'Count', key: 'count', color: 'bg-amber-50 text-amber-700 border-amber-200' });
  }

  if (capabilities.backfill) {
    badges.push({ label: 'Backfill', key: 'backfill', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' });
  }

  return (
    <div className={`flex flex-wrap gap-1.5 items-center ${className}`}>
      {badges.map((b) => (
        <span
          key={b.key}
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${b.color}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
