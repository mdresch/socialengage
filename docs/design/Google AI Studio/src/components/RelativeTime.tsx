import React from 'react';

interface RelativeTimeProps {
  dateString: string;
  className?: string;
  id?: string;
}

export const RelativeTime: React.FC<RelativeTimeProps> = ({
  dateString,
  className = 'text-slate-500',
  id,
}) => {
  if (!dateString) return <span>—</span>;

  const date = new Date(dateString);
  const now = new Date();
  const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

  let formatted = '';
  if (diffSecs < 60) {
    formatted = 'just now';
  } else if (diffSecs < 3600) {
    const mins = Math.floor(diffSecs / 60);
    formatted = `${mins} min${mins > 1 ? 's' : ''} ago`;
  } else if (diffSecs < 86400) {
    const hours = Math.floor(diffSecs / 3600);
    formatted = `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffSecs / 86400);
    formatted = `${days} day${days > 1 ? 's' : ''} ago`;
  }

  const iso = date.toISOString();

  return (
    <time
      id={id}
      dateTime={iso}
      title={iso}
      className={`cursor-help hover:underline decoration-dotted underline-offset-2 ${className}`}
    >
      {formatted}
    </time>
  );
};
