'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { OnboardingChecklistResponse } from '@/lib/core-client';

export interface OnboardingChecklistProps {
  initialData?: OnboardingChecklistResponse | null;
  tenantId?: string;
  isTenantAdmin?: boolean;
  className?: string;
}

const CORE_STEP_CONFIG = [
  {
    key: 'connect_source' as const,
    title: 'Connect a data source',
    description: 'Activate platform feeds (Newswire, GNews, etc.) to ingest social posts.',
    fallbackDeepLink: '/tenant/connectors',
    actionLabel: 'Connect source →',
  },
  {
    key: 'build_watchlist' as const,
    title: 'Build a watchlist',
    description: 'Define keywords and search terms to match against incoming posts.',
    fallbackDeepLink: '/tenant/watchlists',
    actionLabel: 'Create watchlist →',
  },
  {
    key: 'invite_user' as const,
    title: 'Invite team members',
    description: 'Add collaborators or administrators to your tenant workspace.',
    fallbackDeepLink: '/tenant/users',
    actionLabel: 'Invite users →',
  },
  {
    key: 'verify_posts' as const,
    title: 'Verify ingested posts',
    description: 'Inspect your first matched posts and AI enrichments in the feed.',
    fallbackDeepLink: '/tenant/posts',
    actionLabel: 'View feed →',
  },
];

const ADVANCED_STEP_CONFIG = [
  {
    key: 'enable_enrichment' as const,
    title: 'Enable AI enrichment',
    description: 'Enrich posts with sentiment analysis, key phrases, and entity tagging.',
    fallbackDeepLink: '/tenant/analytics',
    actionLabel: 'Configure AI →',
  },
  {
    key: 'configure_alerts' as const,
    title: 'Configure alert rules',
    description: 'Set up automated threshold alerts for spikes and sensitive keywords.',
    fallbackDeepLink: '/tenant/settings',
    actionLabel: 'Configure alerts →',
  },
];

function normalizeDeepLink(deepLink: string, fallback: string): string {
  if (!deepLink) return fallback;
  if (deepLink.startsWith('/settings/connectors')) return '/tenant/connectors';
  if (deepLink.startsWith('/watchlists')) return '/tenant/watchlists';
  if (deepLink.startsWith('/settings/users')) return '/tenant/users';
  if (deepLink.startsWith('/posts')) return '/tenant/posts';
  if (deepLink.startsWith('/settings/enrichment')) return '/tenant/analytics';
  if (deepLink.startsWith('/settings/alerts')) return '/tenant/settings';
  if (deepLink.startsWith('/tenant/')) return deepLink;
  return fallback;
}

export function OnboardingChecklist({
  initialData,
  tenantId,
  isTenantAdmin = false,
  className = '',
}: OnboardingChecklistProps) {
  const [data, setData] = useState<OnboardingChecklistResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchChecklist = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/onboarding-checklist');
      if (res.ok) {
        const json = (await res.json()) as OnboardingChecklistResponse;
        setData(json);
        setErrorMessage(null);
      }
    } catch {
      // Degrade gracefully without blocking the rest of the UI
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh on mount if no initial data, and re-fetch on window focus to capture return-navigation milestones
  useEffect(() => {
    if (!initialData) {
      fetchChecklist();
    }

    const handleFocus = () => {
      fetchChecklist();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchChecklist, initialData]);

  if (!data && !loading && !errorMessage) {
    return null;
  }

  const handleDismiss = async () => {
    if (!isTenantAdmin || updating) return;
    setUpdating(true);
    try {
      const res = await fetch('/api/onboarding-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      });
      if (res.ok) {
        const updated = (await res.json()) as OnboardingChecklistResponse;
        setData(updated);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error || 'Failed to dismiss checklist.');
      }
    } catch {
      setErrorMessage('Network error dismissing checklist.');
    } finally {
      setUpdating(false);
    }
  };

  const handleReopen = async () => {
    if (!isTenantAdmin || updating) return;
    setUpdating(true);
    try {
      const res = await fetch('/api/onboarding-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: false }),
      });
      if (res.ok) {
        const updated = (await res.json()) as OnboardingChecklistResponse;
        setData(updated);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error || 'Failed to reopen checklist.');
      }
    } catch {
      setErrorMessage('Network error reopening checklist.');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleAdvancedVisibility = async (stepKey: 'enable_enrichment' | 'configure_alerts') => {
    if (!isTenantAdmin || updating || !data) return;
    setUpdating(true);

    const currentlyHidden = data.advancedSteps[stepKey]?.hidden ?? false;
    const currentHiddenList: string[] = [];
    if (data.advancedSteps.enable_enrichment?.hidden) currentHiddenList.push('enable_enrichment');
    if (data.advancedSteps.configure_alerts?.hidden) currentHiddenList.push('configure_alerts');

    const nextHiddenList = currentlyHidden
      ? currentHiddenList.filter((k) => k !== stepKey)
      : Array.from(new Set([...currentHiddenList, stepKey]));

    try {
      const res = await fetch('/api/onboarding-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hiddenAdvancedSteps: nextHiddenList }),
      });
      if (res.ok) {
        const updated = (await res.json()) as OnboardingChecklistResponse;
        setData(updated);
      }
    } catch {
      // Ignore
    } finally {
      setUpdating(false);
    }
  };

  // If dismissed, render a subtle reopenable banner/pill
  if (data?.dismissed) {
    return (
      <div
        className={`onboarding-checklist-dismissed card ${className}`.trim()}
        data-testid="onboarding-checklist-dismissed"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-5)',
          background: 'var(--color-surface-card)',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: '1.125rem' }}>📋</span>
          <div>
            <strong style={{ fontSize: '0.875rem' }}>Setup Checklist Dismissed</strong>
            <span
              style={{
                marginLeft: 'var(--space-2)',
                fontSize: '0.8125rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              ({data.progressPercentage}% complete)
            </span>
          </div>
        </div>
        {isTenantAdmin && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleReopen}
            disabled={updating}
            data-testid="btn-reopen-checklist"
            style={{ fontSize: '0.8125rem' }}
          >
            Reopen Checklist
          </button>
        )}
      </div>
    );
  }

  if (!data) return null;

  const coreSteps = data.steps;
  const completedCount = Object.values(coreSteps).filter((s) => s.completed).length;
  const totalCoreCount = CORE_STEP_CONFIG.length;
  const isAllComplete = data.isComplete || completedCount === totalCoreCount;

  return (
    <div
      className={`onboarding-checklist card ${className}`.trim()}
      data-testid="onboarding-checklist"
      role="region"
      aria-label="Onboarding setup checklist"
      style={{
        marginBottom: 'var(--space-5)',
        background: 'var(--color-surface-card)',
        border: isAllComplete ? '1px solid var(--color-status-healthy)' : '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-5)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '1.25rem' }}>{isAllComplete ? '🎉' : '🚀'}</span>
            <h2
              style={{
                margin: 0,
                fontSize: '1.0625rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
              data-testid="onboarding-title"
            >
              {isAllComplete ? 'Workspace Setup Complete!' : 'Get Started with SocialEngage'}
            </h2>
            {isAllComplete && (
              <span
                className="badge badge-success"
                data-testid="onboarding-complete-badge"
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  background: 'rgba(22, 163, 74, 0.1)',
                  color: 'var(--color-status-healthy)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                }}
              >
                100% Ready
              </span>
            )}
          </div>
          <p
            style={{
              margin: 'var(--space-1) 0 0 0',
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
            }}
          >
            {isAllComplete
              ? 'All core monitoring milestones have been completed. Your workspace is active and ingesting posts.'
              : 'Complete these essential steps to configure feeds, match rules, and team access.'}
          </p>
        </div>

        {isTenantAdmin && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleDismiss}
            disabled={updating}
            title="Dismiss checklist"
            aria-label="Dismiss checklist"
            data-testid="btn-dismiss-checklist"
            style={{
              color: 'var(--color-text-secondary)',
              padding: '4px 8px',
              fontSize: '0.8125rem',
            }}
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 'var(--space-4)' }} data-testid="onboarding-progress-section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.8125rem',
            marginBottom: 'var(--space-1)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span>
            <strong>{completedCount}</strong> of <strong>{totalCoreCount}</strong> core steps completed
          </span>
          <span style={{ fontWeight: 600 }} data-testid="onboarding-progress-text">
            {data.progressPercentage}%
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '8px',
            background: 'var(--color-border)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
          data-testid="onboarding-progress-track"
        >
          <div
            style={{
              width: `${data.progressPercentage}%`,
              height: '100%',
              background: isAllComplete ? 'var(--color-status-healthy)' : 'var(--color-accent)',
              transition: 'width 0.3s ease',
            }}
            data-testid="onboarding-progress-fill"
          />
        </div>
      </div>

      {/* Core Steps List */}
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
        data-testid="onboarding-core-steps"
      >
        {CORE_STEP_CONFIG.map((step) => {
          const stepState = coreSteps[step.key];
          const isCompleted = stepState?.completed ?? false;
          const href = normalizeDeepLink(stepState?.deepLink, step.fallbackDeepLink);

          return (
            <li
              key={step.key}
              data-testid={`onboarding-step-${step.key}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3) var(--space-4)',
                background: isCompleted ? 'var(--color-surface-page)' : 'var(--color-surface-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    background: isCompleted ? 'rgba(22, 163, 74, 0.15)' : 'var(--color-border)',
                    color: isCompleted ? 'var(--color-status-healthy)' : 'var(--color-text-secondary)',
                    fontWeight: 600,
                    marginTop: '2px',
                  }}
                  data-testid={`step-status-icon-${step.key}`}
                  aria-hidden="true"
                >
                  {isCompleted ? '✓' : '○'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <strong
                      style={{
                        fontSize: '0.9375rem',
                        color: isCompleted ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                      }}
                    >
                      {step.title}
                    </strong>
                    {isCompleted && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--color-status-healthy)',
                          fontWeight: 600,
                        }}
                      >
                        Completed
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>

              <div>
                <a
                  href={href}
                  className={`btn btn-sm ${isCompleted ? 'btn-secondary' : 'btn-primary'}`}
                  data-testid={`btn-step-${step.key}`}
                  style={{
                    whiteSpace: 'nowrap',
                    fontSize: '0.8125rem',
                    padding: '4px 12px',
                  }}
                >
                  {isCompleted ? 'Review' : step.actionLabel}
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Advanced Steps Toggle & Section */}
      <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowAdvanced((prev) => !prev)}
            data-testid="btn-toggle-advanced-section"
            style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', padding: '2px 6px' }}
          >
            {showAdvanced ? '▾ Hide Advanced Setup' : '▸ Show Advanced Setup (AI & Alerts)'}
          </button>
        </div>

        {showAdvanced && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 'var(--space-3) 0 0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
            data-testid="onboarding-advanced-steps"
          >
            {ADVANCED_STEP_CONFIG.map((step) => {
              const stepState = data.advancedSteps[step.key];
              const isCompleted = stepState?.completed ?? false;
              const isHidden = stepState?.hidden ?? false;
              const href = normalizeDeepLink(stepState?.deepLink, step.fallbackDeepLink);

              return (
                <li
                  key={step.key}
                  data-testid={`onboarding-advanced-step-${step.key}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-surface-page)',
                    border: '1px dashed var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    opacity: isHidden ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: '0.8125rem', color: isCompleted ? 'var(--color-status-healthy)' : 'var(--color-text-disabled)' }}>
                      {isCompleted ? '✓' : '○'}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{step.title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>— {step.description}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {isTenantAdmin && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => handleToggleAdvancedVisibility(step.key)}
                        data-testid={`btn-hide-show-advanced-${step.key}`}
                        style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}
                      >
                        {isHidden ? 'Show in checklist' : 'Hide from checklist'}
                      </button>
                    )}
                    <a
                      href={href}
                      className="btn btn-secondary btn-sm"
                      data-testid={`btn-advanced-step-${step.key}`}
                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    >
                      {isCompleted ? 'Review' : step.actionLabel}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Error display */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'rgba(220, 38, 38, 0.1)',
            color: 'var(--color-danger)',
            fontSize: '0.8125rem',
            borderRadius: 'var(--radius-sm)',
          }}
          data-testid="onboarding-error"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
