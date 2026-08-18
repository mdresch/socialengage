import type { ReactElement } from 'react';

export interface EmptyStateProps {
  heading: string;
  body?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * EmptyState (Design Spec §6.5)
 * Standardised empty state layout used when lists or tables have no items.
 */
export function EmptyState({ heading, body, action, className = '' }: EmptyStateProps): ReactElement {
  return (
    <div className={`empty-state ${className}`.trim()} data-testid="empty-state">
      <h3>{heading}</h3>
      {body && <p>{body}</p>}
      {action && (
        <button type="button" onClick={action.onClick} data-testid="empty-state-action">
          {action.label}
        </button>
      )}
    </div>
  );
}
