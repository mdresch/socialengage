'use client';

import React, { useState, useEffect } from 'react';

export interface IngestionAlertIssue {
  platformId: string;
  platformName: string;
  status: 'stalled' | 'failing' | 'reconnect_required';
  reason?: string;
  userId?: string;
}

export interface IngestionAlertBannerProps {
  issues: IngestionAlertIssue[];
  isTenantAdmin?: boolean;
  className?: string;
  onRetrySuccess?: (platformId: string) => void;
}

export function IngestionAlertBanner({
  issues,
  isTenantAdmin = false,
  className = '',
  onRetrySuccess,
}: IngestionAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDismissed = sessionStorage.getItem('dismissed_ingestion_alert_banner');
      if (isDismissed === 'true') {
        setDismissed(true);
      }
    }
  }, []);

  if (dismissed || !issues || issues.length === 0) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dismissed_ingestion_alert_banner', 'true');
    }
  };

  const handleRetry = async (issue: IngestionAlertIssue) => {
    setRetryingId(issue.platformId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/connectors/${encodeURIComponent(issue.platformId)}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issue.userId ? { userId: issue.userId } : {}),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 200) {
        setFeedback({ type: 'success', message: `Ingestion run triggered for ${issue.platformName}.` });
        if (onRetrySuccess) {
          onRetrySuccess(issue.platformId);
        }
      } else if (res.status === 409) {
        setFeedback({ type: 'info', message: data.message || `An ingestion run for ${issue.platformName} is already in progress.` });
      } else {
        setFeedback({ type: 'error', message: data.error || `Failed to re-sync ${issue.platformName}.` });
      }
    } catch {
      setFeedback({ type: 'error', message: `Network error re-syncing ${issue.platformName}.` });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div
      className={`ingestion-alert-banner alert alert-warning ${className}`.trim()}
      data-testid="ingestion-alert-banner"
      role="alert"
    >
      <div className="ingestion-alert-content">
        <div className="ingestion-alert-header">
          <span className="ingestion-alert-icon" aria-hidden="true">⚠️</span>
          <strong className="ingestion-alert-title">Ingestion Alert:</strong>
          <span>
            {issues.length === 1 ? '1 connector requires attention' : `${issues.length} connectors require attention`}
          </span>
        </div>

        <ul className="ingestion-alert-list">
          {issues.map((issue) => (
            <li key={issue.platformId} className="ingestion-alert-item">
              <span className="ingestion-alert-platform font-semibold">{issue.platformName}</span>
              {' — '}
              <span className="ingestion-alert-reason">
                {issue.reason || (
                  issue.status === 'stalled'
                    ? 'No posts ingested for > 24 hours (Ingestion Stalled)'
                    : issue.status === 'reconnect_required'
                    ? 'Access token expired or revoked'
                    : 'Consecutive polling failures threshold exceeded'
                )}
              </span>

              <div className="ingestion-alert-actions">
                {issue.status === 'reconnect_required' ? (
                  <a
                    href="/api/connectors/facebook/oauth/start"
                    className="btn btn-sm btn-primary ingestion-alert-action-btn"
                  >
                    Reconnect Account
                  </a>
                ) : isTenantAdmin ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary ingestion-alert-action-btn"
                    onClick={() => handleRetry(issue)}
                    disabled={retryingId === issue.platformId}
                  >
                    {retryingId === issue.platformId ? 'Re-syncing...' : 'Re-sync now'}
                  </button>
                ) : (
                  <a href="/tenant/connectors" className="btn btn-sm btn-secondary ingestion-alert-action-btn">
                    View Connectors
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>

        {feedback && (
          <div className={`ingestion-alert-feedback feedback-${feedback.type}`}>
            {feedback.message}
          </div>
        )}
      </div>

      <button
        type="button"
        className="ingestion-alert-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss alert for session"
      >
        ✕
      </button>
    </div>
  );
}
