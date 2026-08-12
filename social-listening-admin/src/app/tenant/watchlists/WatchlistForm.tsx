'use client';

import { useState, type FormEvent } from 'react';
import type { Watchlist } from '@/lib/core-client';

type MatchType = 'keyword' | 'hashtag' | 'account' | 'boolean';

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
  current: { name: string; matchType: MatchType; terms: string; booleanQuery: string; platformIds: string[] }
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (current.name !== initial.name) {
    patch.name = current.name;
  }

  const matchTypeChanged = current.matchType !== initial.matchType;
  if (matchTypeChanged) {
    patch.matchType = current.matchType;
  }

  const finalTerms = current.matchType === 'boolean' ? null : parseTerms(current.terms);
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
  const [terms, setTerms] = useState((watchlist?.terms ?? []).join('\n'));
  const [booleanQuery, setBooleanQuery] = useState(watchlist?.booleanQuery ?? '');
  const [platformIds, setPlatformIds] = useState<string[]>(watchlist?.platformIds ?? []);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  function togglePlatform(id: string) {
    setPlatformIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (mode === 'create') {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          matchType,
          terms: matchType === 'boolean' ? null : parseTerms(terms),
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
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Name
        <input required value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Match type
        <select value={matchType} onChange={(event) => setMatchType(event.target.value as MatchType)}>
          <option value="keyword">keyword</option>
          <option value="hashtag">hashtag</option>
          <option value="account">account</option>
          <option value="boolean">boolean</option>
        </select>
      </label>
      {matchType === 'boolean' ? (
        <label>
          Boolean query
          <textarea value={booleanQuery} onChange={(event) => setBooleanQuery(event.target.value)} />
        </label>
      ) : (
        <label>
          Terms (one per line)
          <textarea value={terms} onChange={(event) => setTerms(event.target.value)} />
        </label>
      )}
      <fieldset>
        <legend>Platforms</legend>
        {connectedPlatforms.length === 0 && <p>Connect a platform first (see the Connectors screen).</p>}
        {connectedPlatforms.map((platform) => (
          <label key={platform.id}>
            <input
              type="checkbox"
              checked={platformIds.includes(platform.id)}
              onChange={() => togglePlatform(platform.id)}
            />
            {platform.name}
          </label>
        ))}
      </fieldset>
      <button type="submit">{mode === 'create' ? 'Create watchlist' : 'Save changes'}</button>
      {mode === 'edit' && onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </form>
  );
}
