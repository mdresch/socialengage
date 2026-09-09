'use client';

export const PLANS = ['starter', 'pro', 'enterprise'] as const;

export interface PlanSelectorProps {
  value: string;
  onChange: (plan: string) => void;
  disabled?: boolean;
}

export function PlanSelector({ value, onChange, disabled }: PlanSelectorProps) {
  return (
    <label>
      Plan
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
        aria-label="Plan"
      >
        <option value="" disabled>
          Select a plan
        </option>
        {PLANS.map((plan) => (
          <option key={plan} value={plan}>
            {plan}
          </option>
        ))}
      </select>
    </label>
  );
}
