'use client';

import { useState, useCallback, type FormEvent } from 'react';
import type { Watchlist } from '@/lib/core-client';
import { TagInput } from '@/components/ui';
import { BooleanQueryBuilder } from '@/components/watchlists/BooleanQueryBuilder';
import {
  WatchlistAST,
  parseBooleanQueryToAst,
  astToBooleanQuery,
} from '@/lib/watchlist-ast';

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
 * `booleanQuery` whenever `matchType` itself changes. Story 12.4 includes `ast`.
 */
function buildEditPatch(
  initial: Watchlist,
  current: { name: string; matchType: MatchType; terms: string[]; booleanQuery: string; ast?: WatchlistAST; platformIds: string[] }
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
  if (current.matchType === 'boolean' && current.ast) {
    patch.ast = current.ast;
  }
  if (!sameStringArray(current.platformIds, initial.platformIds)) {
    patch.platformIds = current.platformIds;
  }

  return patch;
}

/**
 * Story 6.4 / Story 12.4 (ADR-0044, ADR-0102) — handles both `mode="create"` and `mode="edit"`.
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
  const [ast, setAst] = useState<WatchlistAST | undefined>(() => {
    if (watchlist?.ast) return watchlist.ast;
    if (watchlist?.booleanQuery) return parseBooleanQueryToAst(watchlist.booleanQuery);
    return undefined;
  });
  const [platformIds, setPlatformIds] = useState<string[]>(watchlist?.platformIds ?? []);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);

  const handleValidationChange = useCallback((state: { hasErrors: boolean }) => {
    setHasErrors(state.hasErrors);
  }, []);

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
            ast: matchType === 'boolean' ? ast : null,
            platformIds,
          }),
        });
        const body = await response.json().catch(() => ({}));

        if (response.status === 201) {
          window.location.reload();
          return;
        }
        if (response.status === 422) {
          if (body.code === 'UNSUPPORTED_QUERY_CLAUSE') {
            setMessage({
              kind: 'error',
              text: `Unsupported query clause: ${body.reason || 'One or more clauses are unsupported by the selected platforms.'}`,
            });
            return;
          }
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
      const patch = buildEditPatch(current, { name, matchType, terms, booleanQuery, ast, platformIds });

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
        if (body.code === 'UNSUPPORTED_QUERY_CLAUSE') {
          setMessage({
            kind: 'error',
            text: `Unsupported query clause: ${body.reason || 'One or more clauses are unsupported by the selected platforms.'}`,
          });
          return;
        }
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span className="wl-form-label">Visual Boolean Query Builder</span>
            <span className="wl-form-hint">Supports AND, OR, NOT, Groups, & Platform Validation</span>
          </div>
          <BooleanQueryBuilder
            value={ast}
            rawQuery={booleanQuery}
            selectedPlatformIds={platformIds}
            disabled={submitting}
            onChange={(newAst, newQueryString) => {
              setAst(newAst);
              setBooleanQuery(newQueryString);
            }}
            onValidationChange={handleValidationChange}
          />
          <p className="wl-form-hint" style={{ marginTop: 'var(--space-1)' }}>
            Evaluated against titles and bodies during stream ingestion.
          </p>
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
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || hasErrors}>
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {mode === 'create' && !onCancel && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || hasErrors}>
            {submitting ? 'Creating…' : 'Create watchlist'}
          </button>
        </div>
      )}
    </form>
  );
}
