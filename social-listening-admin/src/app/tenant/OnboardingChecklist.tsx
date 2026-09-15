'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type {
  OnboardingChecklistResponse,
  RoleJourneyResponse,
  RoleOnboardingStep,
  OnboardingRoleKind,
} from '@/lib/core-client';

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

const ROLE_TABS: { id: OnboardingRoleKind; label: string; icon: string }[] = [
  { id: 'admin', label: 'Admin', icon: '🛡️' },
  { id: 'care_agent', label: 'Care Agent', icon: '💬' },
  { id: 'social_seller', label: 'Social Seller', icon: '🤝' },
  { id: 'brand_manager', label: 'Brand Manager', icon: '📈' },
];

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
  const [activeTab, setActiveTab] = useState<'overview' | OnboardingRoleKind>('overview');
  const [roleJourney, setRoleJourney] = useState<RoleJourneyResponse | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);

  const fetchRoleJourney = useCallback(async (role: OnboardingRoleKind) => {
    try {
      setLoadingRole(true);
      const res = await fetch(`/api/onboarding-checklist?role=${role}`);
      if (res.ok) {
        const data = (await res.json()) as RoleJourneyResponse;
        setRoleJourney(data);
      }
    } catch {
      // Degrade gracefully without blocking the rest of the UI
    } finally {
      setLoadingRole(false);
    }
  }, []);

  const handleTabChange = (tab: 'overview' | OnboardingRoleKind) => {
    setActiveTab(tab);
    if (tab !== 'overview') {
      fetchRoleJourney(tab);
    }
  };

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

  const currentPercentage = activeTab !== 'overview' && roleJourney
    ? roleJourney.completionPercentage
    : checklist.progressPercentage;

  const currentIsComplete = activeTab !== 'overview' && roleJourney
    ? roleJourney.isComplete
    : checklist.isComplete;

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
            Complete these role-tailored and core operational steps to start monitoring social discussions and news feeds.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)' }}>
            {currentPercentage}% Completed
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

      {/* Role Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1.25rem',
          backgroundColor: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
          overflowX: 'auto',
        }}
        data-testid="onboarding-role-tabs"
      >
        <button
          type="button"
          onClick={() => handleTabChange('overview')}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: activeTab === 'overview' ? '#ffffff' : 'transparent',
            color: activeTab === 'overview' ? '#0f172a' : '#64748b',
            boxShadow: activeTab === 'overview' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          🌐 Tenant Overview
        </button>
        {ROLE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            data-testid={`role-tab-${tab.id}`}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: activeTab === tab.id ? '#ffffff' : 'transparent',
              color: activeTab === tab.id ? '#0f172a' : '#64748b',
              boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Progress Bar */}
      <div style={{ height: '4px', width: '100%', backgroundColor: '#e2e8f0' }}>
        <div
          style={{
            height: '100%',
            width: `${currentPercentage}%`,
            backgroundColor: currentIsComplete ? '#10b981' : '#3b82f6',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Checklist Steps Body */}
      <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
        {activeTab !== 'overview' && roleJourney ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
              {roleJourney.steps.map((step) => {
                const link = normalizeDeepLink(step.actionUrl, '/tenant');
                return (
                  <a
                    key={step.id}
                    href={link}
                    data-testid={`role-step-${step.id}`}
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
                      {step.completed ? '✓' : '•'}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            textDecoration: step.completed ? 'line-through' : 'none',
                          }}
                        >
                          {step.title}
                        </span>
                        {step.completed ? (
                          <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>Done</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                            {step.actionLabel}
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          margin: '0.2rem 0 0',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary)',
                          lineHeight: 1.35,
                        }}
                      >
                        {step.description}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
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
                        <span
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            textDecoration: step.completed ? 'line-through' : 'none',
                          }}
                        >
                          {meta.title}
                        </span>
                        {step.completed && (
                          <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>Done</span>
                        )}
                      </div>
                      <p
                        style={{
                          margin: '0.2rem 0 0',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary)',
                          lineHeight: 1.35,
                        }}
                      >
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
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '0.85rem',
                    marginTop: '0.75rem',
                  }}
                >
                  {advancedStepKeys.map((key) => {
                    const step = (checklist.advancedSteps as Record<string, any>)?.[key] || {
                      completed: false,
                      completedAt: null,
                    };
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
                            <span
                              style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                textDecoration: step.completed ? 'line-through' : 'none',
                              }}
                            >
                              {meta.title}
                            </span>
                            {step.completed && (
                              <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>Done</span>
                            )}
                          </div>
                          <p
                            style={{
                              margin: '0.2rem 0 0',
                              fontSize: '0.75rem',
                              color: 'var(--color-text-secondary)',
                              lineHeight: 1.35,
                            }}
                          >
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
        )}
      </div>
    </div>
  );
}
