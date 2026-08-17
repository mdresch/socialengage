import type { ReactElement } from 'react';

export type StatusBadgeVariant =
  | 'healthy'
  | 'degraded'
  | 'failing'
  | 'active'
  | 'suspended'
  | 'inactive'
  | 'verified'
  | 'pending';

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label?: string;
  className?: string;
}

const DEFAULT_LABELS: Record<StatusBadgeVariant, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  failing: 'Failing',
  active: 'Active',
  suspended: 'Suspended',
  inactive: 'Paused',
  verified: 'Verified',
  pending: 'Pending',
};

/**
 * StatusBadge (Design Spec §6.1)
 * Renders a coloured dot + text label for connector health, tenant status, or DNS verification.
 */
export function StatusBadge({ variant, label, className = '' }: StatusBadgeProps): ReactElement {
  const displayLabel = label ?? DEFAULT_LABELS[variant] ?? variant;

  return (
    <span
      className={`status-badge status-badge-${variant} ${className}`.trim()}
      data-testid="status-badge"
      data-variant={variant}
    >
      <span className="status-badge-dot" aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}
