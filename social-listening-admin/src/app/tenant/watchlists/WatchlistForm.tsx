'use client';

import { useState, type FormEvent } from 'react';
import type { Watchlist } from '@/lib/core-client';
import { TagInput } from '@/components/ui';

type MatchType = 'keyword' | 'hashtag' | 'account' | 'boolean';

const MATCH_TYPE_OPTIONS: { value: MatchType; label: string; icon: string }[] = [
  { value: 'keyword', label: 'Keyword', icon: '🏷' },
  { value: 'hashtag', label: 'Hashtag', icon: '#' },
  { value: 'account', label: 'Account', icon: '@' },
  { value: 'boolean', label: 'Boolean', icon: '⊕' },
];

function parseTerms(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

function sameStringArray(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

/**
 * Story 6.4 (reworked 2026-08-12, ADR-0044) — RFC 7396 merge-patch: only
 * fields that actually differ from `initial` are included, plus `terms`/
 * `booleanQuery` whenever `matchType` itself changes — ADR-0044 §5a's
 * invariant is checked against the *resulting merged row* on the backend,
 * so a matchType change must explicitly clear/set its companion field even
 * when that field's own displayed value happens not to have changed.
 * `isActive` is deliberately never part of this patch — WatchlistRow.tsx's
 * own dedicated toggle owns that field alone, per the revised AC's "toggling
 * isActive alone still sends only that field."
 */
function buildEditPatch(
  initial: Watchlist,
  current: { name: string; matchType: MatchType; terms: string[]; booleanQuery: string; platformIds: string[] }
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (current.name !== initial.name) {
    patch.name = current.name;
  }

  const matchTypeChanged = current.matchType !== initial.matchType;
  if (matchTypeChanged) {
    patch.matchType = current.matchType;
  }

  const finalTerms = current.matchType === 'boolean' ? null : current.terms;
  const finalBooleanQuery = current.matchType === 'boolean' ? current.booleanQuery.trim() || null : null;

  if (matchTypeChanged || !sameStringArray(finalTerms, initial.terms ?? null)) {
    patch.terms = finalTerms;
  }
  if (matchTypeChanged || finalBooleanQuery !== (initial.booleanQuery ?? null)) {
    patch.booleanQuery = finalBooleanQuery;
  }
  if (!sameStringArray(current.platformIds, initial.platformIds)) {
    patch.platformIds = current.platformIds;
  }

  return patch;
}

/**
 * Story 6.4 (reworked 2026-08-12, ADR-0044) — handles both `mode="create"`
 * (a real POST /v1/watchlists via /api/watchlists) and `mode="edit"` (a
 * real, merge-patch-only PATCH /v1/watchlists/:id, If-Match set from the
 * row's own last-known version). Every response body from this backend is a
 * `{code, ...}` shape — there is no `error` string field anywhere on this
 * router, unlike several other Epic 6 backends — so every message here is
 * built from `code`/`details`/`current_version`, never a `body.error`
 * fallback.
 */
export function WatchlistForm({
  mode,
  watchlist,
  connectedPlatforms,
  onCancel,
}: {
  mode: 'create' | 'edit';
  watchlist?: Watchlist;
  connectedPlatforms: { id: string; name: string }[];
  onCancel?: () => void;
}) {
  const [name, setName] = useState(watchlist?.name ?? '');
  const [matchType, setMatchType] = useState<MatchType>((watchlist?.matchType as MatchType) ?? 'keyword');
  const [terms, setTerms] = useState<string[]>(watchlist?.terms ?? []);
  const [booleanQuery, setBooleanQuery] = useState(watchlist?.booleanQuery ?? '');
  const [platformIds, setPlatformIds] = useState<string[]>(watchlist?.platformIds ?? []);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function togglePlatform(id: string) {
    setPlatformIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      if (mode === 'create') {
        const response = await fetch('/api/watchlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            matchType,
            terms: matchType === 'boolean' ? null : terms,
            booleanQuery: matchType === 'boolean' ? booleanQuery.trim() || null : null,
            platformIds,
          }),
        });
        const body = await response.json().catch(() => ({}));

        if (response.status === 201) {
          window.location.reload();
          return;
        }
        if (response.status === 422) {
          setMessage({
            kind: 'error',
            text: Array.isArray(body.details) && body.details.length > 0 ? body.details.join(' ') : 'Validation failed.',
          });
          return;
        }
        setMessage({ kind: 'error', text: 'Something went wrong while creating this watchlist.' });
        return;
      }

      const current = watchlist as Watchlist;
      const patch = buildEditPatch(current, { name, matchType, terms, booleanQuery, platformIds });

      const response = await fetch(`/api/watchlists/${encodeURIComponent(current.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch, version: current.version }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.status === 200) {
        window.location.reload();
        return;
      }
      if (response.status === 409) {
        setMessage({
          kind: 'error',
          text: `This watchlist changed elsewhere (now at version ${body.current_version ?? '?'}) — reload the page to see the latest before retrying.`,
        });
        return;
      }
      if (response.status === 428) {
        setMessage({ kind: 'error', text: 'A required version header was missing — reload the page and try again.' });
        return;
      }
      if (response.status === 422) {
        setMessage({
          kind: 'error',
          text: Array.isArray(body.details) && body.details.length > 0 ? body.details.join(' ') : 'Validation failed.',
        });
        return;
      }
      if (response.status === 404) {
        setMessage({ kind: 'error', text: 'This watchlist no longer exists — reload the page.' });
        return;
      }
      setMessage({ kind: 'error', text: 'Something went wrong while saving this watchlist.' });
    } finally {
      setSubmitting(false);
    }
  }

  const termPrefix = matchType === 'hashtag' ? '#' : matchType === 'account' ? '@' : '';

  return (
    <form id="watchlist-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Watchlist Name */}
      <div className="wl-form-section">
        <label className="wl-form-label" htmlFor="wl-name">Watchlist Name</label>
        <input
          id="wl-name"
          type="text"
          className="form-input"
          required
          placeholder="e.g. Acme Executive Mentions"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Match Type */}
      <div className="wl-form-section">
        <span className="wl-form-label">Match Type</span>
        <div className="match-type-grid">
          {MATCH_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`match-type-btn${matchType === opt.value ? ' is-selected' : ''}`}
              onClick={() => setMatchType(opt.value)}
            >
              <span style={{ fontSize: '1rem' }}>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Query / Terms */}
      {matchType === 'boolean' ? (
        <div className="wl-form-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="wl-form-label">Boolean Query</span>
            <span className="wl-form-hint">Supports AND, OR, NOT, (), &quot;&quot;</span>
          </div>
          <textarea
            className="boolean-query-editor"
            rows={4}
            required
            value={booleanQuery}
            onChange={(e) => setBooleanQuery(e.target.value)}
            placeholder={`("Acme Global" OR "Acme Cloud") AND (launch OR enterprise) NOT spam`}
          />
          <p className="wl-form-hint">Evaluated against titles and bodies during stream ingestion.</p>
        </div>
      ) : (
        <div className="wl-form-section">
          <label className="wl-form-label">{MATCH_TYPE_OPTIONS.find((o) => o.value === matchType)?.label} List</label>
          <TagInput
            values={terms}
            onChange={setTerms}
            prefix={termPrefix}
            placeholder={
              matchType === 'hashtag'
                ? 'e.g. EnterpriseAI…'
                : matchType === 'account'
                ? 'e.g. ReutersTech…'
                : 'e.g. Acme Global…'
            }
          />
          <p className="wl-form-hint">Press Enter or comma to add each term.</p>
        </div>
      )}

      {/* Connected Platforms */}
      <div className="wl-form-section">
        <span className="wl-form-label">Ingestion Platform Sources</span>
        {connectedPlatforms.length === 0 && (
          <p className="wl-form-hint">Connect a platform first (see the Connectors screen).</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {connectedPlatforms.map((platform) => {
            const selected = platformIds.includes(platform.id);
            return (
              <div
                key={platform.id}
                className={`platform-row${selected ? ' is-selected' : ''}`}
                role="checkbox"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => togglePlatform(platform.id)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePlatform(platform.id); } }}
              >
                <span>{platform.name}</span>
                <div className="platform-row-check">{selected ? '✓' : ''}</div>
              </div>
            );
          })}
        </div>
      </div>

      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`form-message ${message.kind === 'error' ? 'form-message-error' : 'form-message-success'}`}
        >
          {message.text}
        </p>
      )}

      {/* Inline cancel for edit mode when not in slideover */}
      {mode === 'edit' && onCancel && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {mode === 'create' && !onCancel && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create watchlist'}
          </button>
        </div>
      )}
    </form>
  );
}
