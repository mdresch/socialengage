'use client';

import { useState } from 'react';

/**
 * Story 6.16 — manually runs enrichment for a post that has none yet.
 * Rendered by the detail page only when post.enrichment is currently null
 * (see [id]/page.tsx) — this component itself doesn't re-check that, the
 * same "caller decides visibility, component just acts" split
 * ActivateDeactivateButton.tsx already established.
 */
export function RunEnrichmentButton({ postId }: { postId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'status'; text: string } | null>(null);

  async function handleClick() {
    setPending(true);
    setMessage(null);

    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/enrich`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));

    if (response.status === 200) {
      if (body.enrichment) {
        window.location.reload();
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
    <span>
      <button type="button" onClick={handleClick} disabled={pending}>
        {pending ? 'Running…' : 'Run enrichment now'}
      </button>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </span>
  );
}
