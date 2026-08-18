import React from 'react';
import { StatusBadgeVariant } from '../types';

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label?: string;
  size?: 'sm' | 'md';
  id?: string;
}

const VARIANT_CONFIG: Record<
  StatusBadgeVariant,
  { dotColor: string; bg: string; text: string; defaultLabel: string }
> = {
  healthy: {
    dotColor: 'bg-emerald-500',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    text: 'text-emerald-800',
    defaultLabel: 'Healthy',
  },
  active: {
    dotColor: 'bg-emerald-500',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    text: 'text-emerald-800',
    defaultLabel: 'Active',
  },
  verified: {
    dotColor: 'bg-emerald-500',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    text: 'text-emerald-800',
    defaultLabel: 'Verified',
  },
  degraded: {
    dotColor: 'bg-amber-500',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    text: 'text-amber-800',
    defaultLabel: 'Degraded',
  },
  pending: {
    dotColor: 'bg-amber-500',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    text: 'text-amber-800',
    defaultLabel: 'Pending',
  },
  failing: {
    dotColor: 'bg-rose-500',
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    text: 'text-rose-800',
    defaultLabel: 'Failing',
  },
  suspended: {
    dotColor: 'bg-rose-500',
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    text: 'text-rose-800',
    defaultLabel: 'Suspended',
  },
  inactive: {
    dotColor: 'bg-slate-400',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    text: 'text-slate-700',
    defaultLabel: 'Inactive',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  label,
  size = 'sm',
  id,
}) => {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.inactive;
  const displayLabel = label || config.defaultLabel;

  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1.5 font-medium border rounded-md transition-colors ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      } ${config.bg}`}
      role="status"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotColor}`}
        aria-hidden="true"
      />
      <span className="truncate">{displayLabel}</span>
    </span>
  );
};
