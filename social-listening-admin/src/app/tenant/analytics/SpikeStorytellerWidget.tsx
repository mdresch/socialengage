'use client';

/**
 * Story 8.8 (ADR-0062 Decision §6) — AI Spike Storyteller widget.
 *
 * Renders inside the Overview tab's `id="widget-spike-storyteller"` grid
 * slot (reserved empty by Story 8.7). Visible only when `activeDateFilter`
 * is non-null — i.e. the user has clicked a specific chart bar on the
 * Volume & Projections Timeline. Calls POST /api/posts/explain-spike (the
 * same-origin proxy) with the clicked date, shows a skeleton while loading,
 * renders the narrative/postsAnalysed/generatedAt on success, and offers a
 * custom-prompt textarea for re-firing. On 503 AI_UNAVAILABLE, renders an
 * honest "not configured" message with no textarea. Never a fabricated
 * narrative — the initial state is an honest prompt to click a spike.
 */

import { useState, useCallback, useEffect } from 'react';

interface SpikeStorytellerWidgetProps {
  spikeDate: string;
}

interface SpikeExplainResponse {
  narrative: string;
  postsAnalysed: number;
  generatedAt: string;
}

type WidgetState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: SpikeExplainResponse }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };

export function SpikeStorytellerWidget({ spikeDate }: SpikeStorytellerWidgetProps) {
  const [state, setState] = useState<WidgetState>({ kind: 'idle' });
  const [customPrompt, setCustomPrompt] = useState('');

  const fireExplain = useCallback(async (prompt?: string) => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch('/api/posts/explain-spike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spikeDate, customPrompt: prompt }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 503 && body?.code === 'AI_UNAVAILABLE') {
        setState({ kind: 'unavailable' });
        return;
      }
      if (!response.ok) {
        setState({ kind: 'error', message: 'Analysis unavailable' });
        return;
      }
      if (typeof body?.narrative === 'string') {
        setState({
          kind: 'success',
          data: {
            narrative: body.narrative,
            postsAnalysed: typeof body.postsAnalysed === 'number' ? body.postsAnalysed : 0,
            generatedAt: typeof body.generatedAt === 'string' ? body.generatedAt : new Date().toISOString(),
          },
        });
        return;
      }
      setState({ kind: 'error', message: 'Analysis unavailable' });
    } catch {
      setState({ kind: 'error', message: 'Analysis unavailable' });
    }
  }, [spikeDate]);

  const handleRefire = useCallback(() => {
    fireExplain(customPrompt.trim() || undefined);
  }, [fireExplain, customPrompt]);

  const handleRetry = useCallback(() => {
    fireExplain();
  }, [fireExplain]);

  // Auto-fire on mount and when spikeDate changes
  useEffect(() => {
    fireExplain();
  }, [fireExplain]);

  return (
    <div className="an-spike-storyteller" data-testid="spike-storyteller-widget">
      <h3 className="an-widget-title">AI Spike Storyteller</h3>

      {state.kind === 'idle' && (
        <p className="an-spike-prompt">
          Click a spike on the timeline to get an AI-generated explanation of what drove it.
        </p>
      )}

      {state.kind === 'loading' && (
        <div className="an-spike-skeleton" data-testid="spike-skeleton" aria-live="polite">
          <div className="an-skeleton-line an-skeleton-line--wide" />
          <div className="an-skeleton-line" />
          <div className="an-skeleton-line" />
          <div className="an-skeleton-line an-skeleton-line--narrow" />
          <p className="an-spike-loading-text">Analysing posts around {spikeDate}…</p>
        </div>
      )}

      {state.kind === 'success' && (
        <div className="an-spike-result" data-testid="spike-result">
          <p className="an-spike-narrative">{state.data.narrative}</p>
          <div className="an-spike-meta">
            <span className="an-spike-meta-item">{state.data.postsAnalysed} posts analysed</span>
            <span className="an-spike-meta-item">Generated {new Date(state.data.generatedAt).toLocaleString()}</span>
          </div>
          <div className="an-spike-custom-prompt">
            <textarea
              className="an-spike-textarea"
              placeholder="Refine the analysis (e.g. 'Focus on negative sentiment drivers')…"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              aria-label="Custom analysis prompt"
            />
            <button type="button" className="an-spike-refire-btn" onClick={handleRefire}>
              Re-analyse
            </button>
          </div>
        </div>
      )}

      {state.kind === 'unavailable' && (
        <div className="an-spike-unavailable" data-testid="spike-unavailable">
          <p className="an-spike-unavailable-msg">AI analysis is not configured for this tenant.</p>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="an-spike-error" data-testid="spike-error">
          <p className="an-spike-error-msg">{state.message}</p>
          <button type="button" className="an-spike-retry-btn" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
