'use client';

import { useState } from 'react';

export interface RunEnrichmentButtonProps {
  postId: string;
  isOverridden?: boolean;
}

/**
 * Story 6.16 / Story 6.31 (ADR-0071) — manually runs enrichment for a post.
 * Upgraded visual design: loading spinner, success state, styled button,
 * and re-enrichment confirmation dialog when manual overrides exist.
 */
export function RunEnrichmentButton({ postId, isOverridden = false }: RunEnrichmentButtonProps) {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'status'; text: string } | null>(null);

  async function executeEnrichment(options: { force?: boolean } = {}) {
    const force = options.force ?? false;
    setPending(true);
    setSuccess(false);
    setMessage(null);
    setShowConfirmModal(false);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.status === 200) {
        if (body.enrichment) {
          setSuccess(true);
          setTimeout(() => {
            window.location.reload();
          }, 800);
          return;
        }
        setPending(false);
        setMessage({ kind: 'status', text: 'No AI provider is currently connected and active for this tenant.' });
        return;
      }

      if (response.status === 409) {
        setPending(false);
        setShowConfirmModal(true);
        return;
      }

      setPending(false);
      setMessage({ kind: 'error', text: body.error ?? 'Something went wrong while running enrichment.' });
    } catch {
      setPending(false);
      setMessage({ kind: 'error', text: 'Network error while triggering enrichment.' });
    }
  }

  function handleClick() {
    if (pending) return;
    if (isOverridden) {
      setShowConfirmModal(true);
      return;
    }
    executeEnrichment({ force: false });
  }

  return (
    <span className="pf-enrich-wrap">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`pf-enrich-btn${success ? ' pf-enrich-btn-success' : ''}`}
        title="Trigger on-demand Azure AI Language & Azure OpenAI reasoning"
      >
        {pending ? (
          <>
            <span className="pf-enrich-spinner" aria-hidden="true" />
            Analyzing…
          </>
        ) : success ? (
          <>✓ Enriched!</>
        ) : (
          <>✦ Run enrichment now</>
        )}
      </button>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className="pf-enrich-msg">
          {message.text}
        </p>
      )}

      {/* Confirmation Modal when post has manual overrides */}
      {showConfirmModal && (
        <div className="pf-confirm-modal-backdrop" role="presentation">
          <div
            className="pf-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="re-enrich-title"
          >
            <h4 id="re-enrich-title" className="pf-confirm-modal-title">
              Overwrite Manual Edits?
            </h4>
            <p className="pf-confirm-modal-text">
              This post has been manually edited by a user. Re-running AI cognitive analysis will replace current sentiment, tags, and summary with fresh AI-generated values.
            </p>
            <div className="pf-confirm-modal-actions">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="pf-confirm-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeEnrichment({ force: true })}
                className="pf-confirm-danger-btn"
              >
                Force Re-enrich
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
