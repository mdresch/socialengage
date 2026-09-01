'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CrisisTemplate } from '@/lib/core-client';

interface CrisisThresholdWizardProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

const TEMPLATE_ICONS: Record<string, string> = {
  'brand-crisis': '🔥',
  'product-recall': '⚠️',
  'exec-attack': '👤',
  'competitor-surge': '📈',
  'data-breach': '🔒',
};

const TEMPLATE_BADGES: Record<string, { label: string; color: string }> = {
  'brand-crisis': { label: 'High Impact', color: '#ef4444' },
  'product-recall': { label: 'Safety Critical', color: '#f97316' },
  'exec-attack': { label: 'Leadership', color: '#8b5cf6' },
  'competitor-surge': { label: 'Market Threat', color: '#3b82f6' },
  'data-breach': { label: 'Urgent Severity', color: '#dc2626' },
};

export function CrisisThresholdWizard({ onClose, onSuccess }: CrisisThresholdWizardProps) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templates, setTemplates] = useState<CrisisTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('brand-crisis');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [customThresholds, setCustomThresholds] = useState<Record<string, any>>({});
  const [notificationChannels, setNotificationChannels] = useState<string[]>(['primary-email']);

  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load templates from API
  useEffect(() => {
    async function load() {
      try {
        setLoadingTemplates(true);
        const res = await fetch('/api/crisis-templates');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.templates) && data.templates.length > 0) {
            setTemplates(data.templates);
            setSelectedKey(data.templates[0].template_key);
          }
        }
      } catch {
        // Fallback gracefully if API not ready
      } finally {
        setLoadingTemplates(false);
      }
    }
    load();
  }, []);

  const currentTemplate = templates.find((t) => t.template_key === selectedKey) || templates[0];

  // Initialize variable defaults when template selection changes
  useEffect(() => {
    if (currentTemplate) {
      const initialVars: Record<string, string> = {};
      currentTemplate.parameters.forEach((param) => {
        initialVars[param.name] = param.default || '';
      });
      setVariables(initialVars);
      setCustomThresholds({ ...(currentTemplate.default_thresholds || {}) });
      setErrorMessage(null);
    }
  }, [selectedKey, currentTemplate]);

  const handleVariableChange = (name: string, value: string) => {
    setVariables((prev) => ({ ...prev, [name]: value }));
    setErrorMessage(null);
  };

  const handleThresholdChange = (key: string, value: any) => {
    setCustomThresholds((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep2 = (): boolean => {
    if (!currentTemplate) return false;
    for (const param of currentTemplate.parameters) {
      if (param.required) {
        const val = variables[param.name];
        if (!val || val.trim().length === 0) {
          setErrorMessage(`Please fill in the required field: ${param.label}`);
          return false;
        }
      }
    }
    setErrorMessage(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (validateStep2()) {
        setStep(3);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2);
      setErrorMessage(null);
    }
  };

  const handleActivate = async () => {
    if (!currentTemplate) return;

    if (!validateStep2()) {
      setStep(2);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/crisis-templates/${encodeURIComponent(selectedKey)}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variables,
          customThresholds,
          notificationChannelIds: notificationChannels,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data?.error || data?.message || 'Activation failed. Please check parameters.');
        setSubmitting(false);
        return;
      }

      // Success
      if (onSuccess) onSuccess();
      if (onClose) onClose();
      router.refresh();
      router.push('/tenant/watchlists');
    } catch (err: any) {
      setErrorMessage(err?.message || 'A network error occurred during activation.');
      setSubmitting(false);
    }
  };

  if (loadingTemplates && templates.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading crisis templates...</p>
      </div>
    );
  }

  return (
    <div className="crisis-wizard-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Wizard Header & Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: step === 1 ? 'var(--color-primary)' : 'inherit' }}>1. Select Template</span>
          <span>→</span>
          <span style={{ fontWeight: 600, color: step === 2 ? 'var(--color-primary)' : 'inherit' }}>2. Variables</span>
          <span>→</span>
          <span style={{ fontWeight: 600, color: step === 3 ? 'var(--color-primary)' : 'inherit' }}>3. Thresholds & Playbook</span>
        </div>
      </div>

      {/* Persistent V1 Disclosure Banner */}
      <div
        data-testid="alert-disclosure-banner"
        style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1e3a8a',
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          fontSize: '0.85rem',
          lineHeight: 1.4,
        }}
      >
        <strong>ℹ️ Monitoring Scope Notice:</strong> Activating this template immediately creates a real-time monitoring watchlist. Automated alert dispatch (email/Slack/webhook) will be enabled in an upcoming release.
      </div>

      {/* Inline Error Message */}
      {errorMessage && (
        <div
          data-testid="inline-error-banner"
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* STEP 1: Select Template */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            Choose a standardized reputation risk scenario to begin:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
            {templates.map((tpl) => {
              const isSelected = tpl.template_key === selectedKey;
              const badge = TEMPLATE_BADGES[tpl.template_key] || { label: 'Standard', color: '#6b7280' };
              return (
                <div
                  key={tpl.template_key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedKey(tpl.template_key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedKey(tpl.template_key);
                  }}
                  style={{
                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '1rem',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-surface)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{TEMPLATE_ICONS[tpl.template_key] || '📋'}</span>
                      <strong style={{ fontSize: '1rem' }}>{tpl.name}</strong>
                    </div>
                    <span
                      style={{
                        backgroundColor: badge.color,
                        color: '#fff',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    {tpl.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: Configure Target Variables */}
      {step === 2 && currentTemplate && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            Provide the required names and keywords for <strong>{currentTemplate.name}</strong>:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {currentTemplate.parameters.map((param) => (
              <div key={param.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label htmlFor={`var-${param.name}`} style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {param.label} {param.required && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                <input
                  id={`var-${param.name}`}
                  type="text"
                  value={variables[param.name] || ''}
                  placeholder={`e.g. ${param.description}`}
                  onChange={(e) => handleVariableChange(param.name, e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.9rem',
                    width: '100%',
                  }}
                  required={param.required}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {param.description}
                </span>
              </div>
            ))}
          </div>

          {/* Live Query Preview */}
          <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--color-background)', borderRadius: '6px', border: '1px dashed var(--color-border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Interpolated Query Preview:
            </span>
            <pre style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {currentTemplate.default_query.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `[${key}]`)}
            </pre>
          </div>
        </div>
      )}

      {/* STEP 3: Thresholds & Playbook */}
      {step === 3 && currentTemplate && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Threshold Customization */}
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>Trigger Thresholds</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Volume Spike (%)</label>
                <input
                  type="number"
                  value={customThresholds.volume_spike_multiplier_percent ?? 200}
                  onChange={(e) => handleThresholdChange('volume_spike_multiplier_percent', Number(e.target.value))}
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Negative Sentiment Share</label>
                <input
                  type="number"
                  step="0.05"
                  value={customThresholds.negative_sentiment_threshold_percent ?? 0.3}
                  onChange={(e) => handleThresholdChange('negative_sentiment_threshold_percent', Number(e.target.value))}
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              </div>
            </div>
          </div>

          {/* Advisory Playbook Steps */}
          {currentTemplate.playbook && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                Advisory Playbook ({currentTemplate.playbook.severity.toUpperCase()})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentTemplate.playbook.steps.map((stepItem) => (
                  <div
                    key={stepItem.step}
                    style={{
                      padding: '0.6rem 0.75rem',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '0.2rem' }}>
                      <span>Step {stepItem.step}: {stepItem.owner}</span>
                      <span style={{ color: '#d97706' }}>⏱ {stepItem.sla_minutes} min SLA</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{stepItem.action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
        <div>
          {step > 1 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleBack} disabled={submitting}>
              ← Back
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onClose && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
          )}
          {step < 3 ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleNext}>
              Next →
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleActivate}
              disabled={submitting}
              data-testid="activate-crisis-template-btn"
            >
              {submitting ? 'Activating Watchlist...' : '⚡ Activate Crisis Watchlist'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
