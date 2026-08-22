'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PLATFORM_CONFIGS, type SupportedPlatform } from './types';
import type { FacebookConnectedPageRow } from '@/lib/core-client';

interface PublishTargetsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlatforms: SupportedPlatform[];
  onConfirm: (selectedPages: FacebookConnectedPageRow[]) => void;
  isPublishing: boolean;
}

export function PublishTargetsDialog({
  isOpen,
  onClose,
  selectedPlatforms,
  onConfirm,
  isPublishing,
}: PublishTargetsDialogProps) {
  const [pages, setPages] = useState<FacebookConnectedPageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());

  const hasFacebook = selectedPlatforms.includes('facebook');
  const hasNonPagePlatform = selectedPlatforms.some((p) => p !== 'facebook');
  const canPublish = hasNonPagePlatform || selectedPageIds.size > 0;

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;

    if (!hasFacebook) {
      setPages([]);
      setSelectedPageIds(new Set());
      return;
    }

    setLoading(true);
    setError(null);

    fetch('/api/connectors/facebook/pages')
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || 'Failed to load pages');
        const all = (body?.pages ?? []) as FacebookConnectedPageRow[];
        const active = all.filter(
          (p) =>
            p.status === 'connected' &&
            p.connectorHealth?.status !== 'disconnected' &&
            p.connectorHealth?.status !== 'failing'
        );
        setPages(active);
        setSelectedPageIds(new Set(active.map((p) => p.id)));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load pages');
        setPages([]);
        setSelectedPageIds(new Set());
      })
      .finally(() => setLoading(false));
  }, [isOpen, hasFacebook]);

  if (!isOpen) return null;

  const togglePage = (id: string) => {
    const next = new Set(selectedPageIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPageIds(next);
  };

  const handleConfirm = () => {
    const selectedPages = pages.filter((p) => selectedPageIds.has(p.id));
    onConfirm(selectedPages);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Publish to active pages">
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {loading && <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading active pages…</p>}

        {error && (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.875rem' }}>
            {error}
          </p>
        )}

        {!loading && !error && !hasFacebook && (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text)' }}>
            This will publish to{' '}
            {selectedPlatforms.map((p) => PLATFORM_CONFIGS[p].name).join(', ')}.
          </p>
        )}

        {!loading && !error && hasFacebook && pages.length === 0 && (
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            No active Facebook Pages available for posting.
          </p>
        )}

        {!loading && !error && hasFacebook && pages.length > 0 && (
          <>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              Select the connected Facebook Pages you want to post to.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              {pages.map((page) => (
                <label
                  key={page.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPageIds.has(page.id)}
                    onChange={() => togglePage(page.id)}
                    disabled={isPublishing}
                  />
                  <span>{page.pageName}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {page.connectorHealth?.status?.replace(/_/g, ' ')}
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="modal-btn-cancel" onClick={onClose} disabled={isPublishing}>
          Cancel
        </button>
        <button
          type="button"
          className="composer-btn-primary"
          onClick={handleConfirm}
          disabled={!canPublish || isPublishing}
        >
          {isPublishing ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </Modal>
  );
}
