'use client';

import { useState } from 'react';

/**
 * Story 6.16 — manually runs enrichment for a post.
 * Upgraded visual design: loading spinner, success state, styled button.
 * Callers decide when to show this; this component just acts.
 */
export function RunEnrichmentButton({ postId }: { postId: string }) {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'status'; text: string } | null>(null);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setSuccess(false);
    setMessage(null);

    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/enrich`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));

    if (response.status === 200) {
      if (body.enrichment) {
        setSuccess(true);
        setTimeout(() => { window.location.reload(); }, 800);
        return;
      }
      setPending(false);
      setMessage({ kind: 'status', text: 'No AI provider is currently connected and active for this tenant.' });
      return;
    }

    setPending(false);
    setMessage({ kind: 'error', text: body.error ?? 'Something went wrong while running enrichment.' });
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
    </span>
  );
}
