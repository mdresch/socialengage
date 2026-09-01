import type { ReactElement } from 'react';

export interface RelativeTimeProps {
  timestamp?: string | null;
  fallback?: string;
  className?: string;
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 45) {
      return 'just now';
    }
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) {
      return 'yesterday';
    }
    if (diffDays < 30) {
      return `${diffDays}d ago`;
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * RelativeTime (Design Spec §6.7)
 * Renders a human-relative time string with an ISO absolute timestamp in the title attribute.
 */
export function RelativeTime({
  timestamp,
  fallback = 'never',
  className = '',
}: RelativeTimeProps): ReactElement {
  if (!timestamp) {
    return (
      <time className={className} suppressHydrationWarning>
        {fallback}
      </time>
    );
  }

  const formatted = formatRelativeTime(timestamp);

  return (
    <time
      dateTime={timestamp}
      title={timestamp}
      className={className}
      data-testid="relative-time"
      suppressHydrationWarning
    >
      {formatted}
    </time>
  );
}
