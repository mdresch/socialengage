'use client';

import React, { useState } from 'react';
import type { OnboardingChecklistResponse } from '@/lib/core-client';

interface OnboardingChecklistProps {
  tenantId: string;
  initialChecklist: OnboardingChecklistResponse | null;
  isTenantAdmin?: boolean;
}

const STEP_METADATA: Record<
  string,
  { title: string; description: string; defaultLink: string; icon: string }
> = {
  connect_source: {
    title: 'Connect an Ingestion Source',
    description: 'Activate news feeds or social accounts (e.g. GNews, Newswire, Wikipedia) to start collecting data.',
    defaultLink: '/tenant/connectors',
    icon: '🔌',
  },
  build_watchlist: {
    title: 'Create a Brand Watchlist',
    description: 'Define target keywords, hashtags, accounts, or boolean query match logic.',
    defaultLink: '/tenant/watchlists',
    icon: '🎯',
  },
  invite_user: {
    title: 'Invite a Team Member',
    description: 'Add your brand analysts or reputation managers to the workspace.',
    defaultLink: '/tenant/users',
    icon: '👥',
  },
  verify_posts: {
    title: 'Verify Ingested Posts',
    description: 'Confirm that incoming posts and Azure AI sentiment enrichments are streaming in.',
    defaultLink: '/tenant/posts',
    icon: '📊',
  },
  enable_enrichment: {
    title: 'Enable AI Enrichment',
    description: 'Connect Azure AI Language and OpenAI cognitive services for sentiment analysis.',
    defaultLink: '/tenant/connectors',
    icon: '✨',
  },
  configure_alerts: {
    title: 'Configure Crisis Monitoring',
    description: 'Activate standardized Crisis Templates with advisory playbooks for rapid response.',
    defaultLink: '/tenant/watchlists',
    icon: '⚡',
  },
};

function normalizeDeepLink(deepLink?: string, fallback: string = '/tenant'): string {
  if (!deepLink) return fallback;
  if (deepLink.startsWith('/settings/connectors')) return '/tenant/connectors';
  if (deepLink.startsWith('/watchlists')) return '/tenant/watchlists';
  if (deepLink.startsWith('/settings/users')) return '/tenant/users';
  if (deepLink.startsWith('/posts')) return '/tenant/posts';
  if (deepLink.startsWith('/settings/enrichment')) return '/tenant/connectors';
  if (deepLink.startsWith('/settings/alerts')) return '/tenant/watchlists';
  if (deepLink.startsWith('/tenant/')) return deepLink;
  return fallback;
}

export function OnboardingChecklist({
  tenantId,
  initialChecklist,
  isTenantAdmin = false,
}: OnboardingChecklistProps) {
  const [checklist, setChecklist] = useState<OnboardingChecklistResponse | null>(initialChecklist);
  const [isDismissed, setIsDismissed] = useState<boolean>(initialChecklist?.dismissed ?? false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!checklist) return null;
  if (isDismissed) {
    return (
      <div style={{ marginBottom: 'var(--space-4)', textAlign: 'right' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            setIsDismissed(false);
            if (isTenantAdmin) {
              await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/onboarding-checklist`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dismissed: false }),
              });
            }
          }}
          data-testid="reopen-checklist-btn"
        >
          📋 Show Setup Checklist
        </button>
      </div>
    );
  }

  const coreStepKeys = ['connect_source', 'build_watchlist', 'invite_user', 'verify_posts'];
  const advancedStepKeys = ['enable_enrichment', 'configure_alerts'];

  const handleDismiss = async () => {
    setIsDismissed(true);
    if (isTenantAdmin) {
      try {
        setIsUpdating(true);
        await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/onboarding-checklist`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dismissed: true }),
        });
      } catch {
        // Degrade gracefully
      } finally {
        setIsUpdating(false);
      }
    }
  };

  return (
    <div
      data-testid="onboarding-checklist-container"
      className="card"
      style={{
        marginBottom: 'var(--space-5)',
        border: '1px solid #bfdbfe',
        backgroundColor: '#f8fafc',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header */}
      <div
        className="card-header"
        style={{
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🚀</span>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Get Started with SocialEngage</h2>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            Complete these core steps to start monitoring social discussions and news feeds.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)' }}>
            {checklist.progressPercentage}% Completed
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDismiss}
            disabled={isUpdating}
            data-testid="dismiss-checklist-btn"
            title="Dismiss checklist"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            Dismiss ✕
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ height: '4px', width: '100%', backgroundColor: '#e2e8f0' }}>
        <div
          style={{
            height: '100%',
            width: `${checklist.progressPercentage}%`,
            backgroundColor: checklist.isComplete ? '#10b981' : '#3b82f6',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Checklist Core Steps Grid */}
      <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
          {coreStepKeys.map((key) => {
            const step = (checklist.steps as Record<string, any>)?.[key] || { completed: false, completedAt: null };
            const meta = STEP_METADATA[key] || {
              title: key,
              description: '',
              defaultLink: '/tenant',
              icon: '📌',
            };
            const link = normalizeDeepLink(step.deepLink, meta.defaultLink);

            return (
              <a
                key={key}
                href={link}
                data-testid={`checklist-step-${key}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem',
                  borderRadius: '6px',
                  border: step.completed ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                  backgroundColor: step.completed ? '#f0fdf4' : '#ffffff',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: step.completed ? '#22c55e' : '#e2e8f0',
                    color: step.completed ? '#ffffff' : '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  {step.completed ? '✓' : meta.icon}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, textDecoration: step.completed ? 'line-through' : 'none' }}>
                      {meta.title}
                    </span>
                    {step.completed && (
                      <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>Done</span>
                    )}
                  </div>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.35 }}>
                    {meta.description}
                  </p>
                </div>
              </a>
            );
          })}
        </div>

        {/* Advanced Steps Section */}
        <div style={{ marginTop: '1rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{showAdvanced ? '▼ Hide Advanced Steps' : '▶ Show Advanced Setup Steps'}</span>
          </button>

          {showAdvanced && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem', marginTop: '0.75rem' }}>
              {advancedStepKeys.map((key) => {
                const step = (checklist.advancedSteps as Record<string, any>)?.[key] || { completed: false, completedAt: null };
                const meta = STEP_METADATA[key] || {
                  title: key,
                  description: '',
                  defaultLink: '/tenant',
                  icon: '⚙️',
                };
                const link = normalizeDeepLink(step.deepLink, meta.defaultLink);

                return (
                  <a
                    key={key}
                    href={link}
                    data-testid={`checklist-step-${key}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.85rem',
                      borderRadius: '6px',
                      border: step.completed ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      backgroundColor: step.completed ? '#f0fdf4' : '#ffffff',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: step.completed ? '#22c55e' : '#e2e8f0',
                        color: step.completed ? '#ffffff' : '#64748b',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      {step.completed ? '✓' : meta.icon}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, textDecoration: step.completed ? 'line-through' : 'none' }}>
                          {meta.title}
                        </span>
                        {step.completed && (
                          <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>Done</span>
                        )}
                      </div>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.35 }}>
                        {meta.description}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
