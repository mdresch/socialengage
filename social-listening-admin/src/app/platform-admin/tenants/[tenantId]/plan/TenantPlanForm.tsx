'use client';

import { useState, type FormEvent } from 'react';
import { PlanSelector } from '@/components/plan/PlanSelector';
import { FeatureToggleList } from '@/components/plan/FeatureToggleList';
import { SeatUsageCard } from '@/components/plan/SeatUsageCard';
import type { TenantPlanView } from '@/lib/core-client';

const PLAN_DEFAULTS: Record<string, { max_seats: number; feature_gates: Record<string, boolean> }> = {
  starter: {
    max_seats: 3,
    feature_gates: {
      ai_assist: true,
      analytics_dashboard: true,
      multi_user: false,
      api_access: false,
      webhooks: false,
      crisis_templates: false,
      compliance_packs: false,
      dsr_portal: false,
      rag_search: false,
      connectors: true,
      watchlists: true,
      exports: true,
    },
  },
  pro: {
    max_seats: 25,
    feature_gates: {
      ai_assist: true,
      analytics_dashboard: true,
      multi_user: true,
      api_access: true,
      webhooks: true,
      crisis_templates: false,
      compliance_packs: false,
      dsr_portal: false,
      rag_search: true,
      connectors: true,
      watchlists: true,
      exports: true,
    },
  },
  enterprise: {
    max_seats: 100,
    feature_gates: {
      ai_assist: true,
      analytics_dashboard: true,
      multi_user: true,
      api_access: true,
      webhooks: true,
      crisis_templates: true,
      compliance_packs: true,
      dsr_portal: true,
      rag_search: true,
      connectors: true,
      watchlists: true,
      exports: true,
    },
  },
};

export interface TenantPlanFormProps {
  tenantId: string;
  initialPlan: TenantPlanView;
}

export function TenantPlanForm({ tenantId, initialPlan }: TenantPlanFormProps) {
  const [plan, setPlan] = useState(initialPlan.plan);
  const [featureGates, setFeatureGates] = useState<Record<string, any>>(initialPlan.featureGates);
  const [maxSeats, setMaxSeats] = useState<number>(featureGates.max_seats ?? initialPlan.maxSeats);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handlePlanChange(newPlan: string) {
    setPlan(newPlan);
    const defaults = PLAN_DEFAULTS[newPlan] ?? PLAN_DEFAULTS.starter;
    const nextFeatureGates = { ...defaults.feature_gates, max_seats: defaults.max_seats };
    setFeatureGates(nextFeatureGates);
    setMaxSeats(defaults.max_seats);
  }

  function handleFeatureToggle(key: string, value: boolean) {
    setFeatureGates((prev) => ({ ...prev, [key]: value }));
  }

  function handleMaxSeatsChange(value: number) {
    setMaxSeats(value);
    setFeatureGates((prev) => ({ ...prev, max_seats: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!plan) {
      setMessage({ kind: 'error', text: 'Plan is required.' });
      return;
    }

    const maxSeatsNumber = Number(maxSeats);
    if (!Number.isFinite(maxSeatsNumber) || maxSeatsNumber < 1) {
      setMessage({ kind: 'error', text: 'Max seats must be at least 1.' });
      return;
    }

    setSubmitting(true);
    const response = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, featureGates }),
    });
    const body = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (response.status === 200) {
      setMessage({ kind: 'success', text: 'Plan and feature gates saved.' });
      window.location.reload();
      return;
    }
    setMessage({ kind: 'error', text: body.error ?? 'Something went wrong while saving plan settings.' });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PlanSelector value={plan} onChange={handlePlanChange} />

      <label>
        Max seats
        <input
          type="number"
          min={1}
          required
          value={maxSeats}
          onChange={(event) => handleMaxSeatsChange(Number(event.target.value))}
          style={{ marginLeft: '0.5rem' }}
        />
      </label>

      <SeatUsageCard usedSeats={initialPlan.usedSeats} maxSeats={maxSeats} />

      <FeatureToggleList featureGates={featureGates} onChange={handleFeatureToggle} />

      {initialPlan.usedSeats > maxSeats && (
        <p role="alert" style={{ color: '#dc2626', fontSize: '0.875rem' }}>
          Max seats is below the current active user count. Existing active users stay active, but new
          invites will be blocked until active seats are available again.
        </p>
      )}

      <button type="submit" disabled={submitting}>
        Save
      </button>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </form>
  );
}
