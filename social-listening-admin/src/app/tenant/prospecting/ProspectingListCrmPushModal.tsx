'use client';

import React, { useEffect, useState } from 'react';
import type { ProspectingListEntry } from '@/lib/core-client';

interface CRMConnectorOption {
  id: string;
  provider: string;
  isActive: boolean;
}

interface ProspectingListCrmPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  entries: ProspectingListEntry[];
}

export function ProspectingListCrmPushModal({
  isOpen,
  onClose,
  listId,
  entries,
}: ProspectingListCrmPushModalProps) {
  const [crmConnectorId, setCrmConnectorId] = useState<string>('');
  const [connectors, setConnectors] = useState<CRMConnectorOption[]>([]);
  const [connectorsLoading, setConnectorsLoading] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set(entries.map((e) => e.id)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ pushedCount: number; skippedCount: number; crmUrl?: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setConnectorsLoading(true);
    fetch('/api/crm/connectors')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        const options: CRMConnectorOption[] = Array.isArray(data)
          ? data.map((c) => ({
              id: c.id,
              provider: c.provider || c.id,
              isActive: c.status?.isActive ?? true,
            }))
          : [];
        setConnectors(options);
        if (options.length > 0 && !crmConnectorId) {
          setCrmConnectorId(options[0].id);
        }
      })
      .catch(() => setConnectors([]))
      .finally(() => setConnectorsLoading(false));
  }, [isOpen]);

  useEffect(() => {
    setSelectedEntryIds(new Set(entries.map((e) => e.id)));
  }, [entries]);

  function toggleEntry(entryId: string) {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedEntryIds(checked ? new Set(entries.map((e) => e.id)) : new Set());
  }

  function handleClose() {
    setError(null);
    setSuccess(null);
    onClose();
  }

  async function handlePush() {
    if (!crmConnectorId) {
      setError('Please select a CRM connector.');
      return;
    }
    if (selectedEntryIds.size === 0) {
      setError('Please select at least one entry to push.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/prospecting-lists/${listId}/crm-handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crmConnectorId,
          caseType: 'lead',
          selectedEntryIds: Array.from(selectedEntryIds),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to push to CRM');
        return;
      }

      setSuccess({
        pushedCount: data.pushedCount ?? 0,
        skippedCount: data.skippedCount ?? 0,
        crmUrl: data.crmUrl,
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        role="dialog"
        aria-modal="true"
        aria-label="Push prospecting list to CRM"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Push to CRM</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Push selected leads from this prospecting list to a connected CRM
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">✓</span>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                  Successfully pushed {success.pushedCount} lead{success.pushedCount === 1 ? '' : 's'}
                  {success.skippedCount > 0 ? ` (${success.skippedCount} skipped)` : ''}
                </p>
              </div>
              {success.crmUrl && (
                <div className="mt-3">
                  <a
                    href={success.crmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-emerald-500"
                  >
                    View pushed records in CRM ↗
                  </a>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target CRM Connector
              </label>
              <select
                value={crmConnectorId}
                onChange={(e) => setCrmConnectorId(e.target.value)}
                disabled={connectorsLoading || loading}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {connectorsLoading ? (
                  <option>Loading connectors…</option>
                ) : connectors.length === 0 ? (
                  <option value="">No CRM connectors configured</option>
                ) : (
                  connectors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.provider} {c.isActive ? '' : '(inactive)'}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Entries to push ({selectedEntryIds.size} selected)
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={selectedEntryIds.size === entries.length && entries.length > 0}
                    onChange={(e) => toggleAll(e.target.checked)}
                    disabled={loading}
                  />
                  Select all
                </label>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {entries.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">No entries in this list.</p>
                ) : (
                  entries.map((entry) => (
                    <label
                      key={entry.id}
                      className="flex items-center gap-2 border-b border-slate-100 p-2 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEntryIds.has(entry.id)}
                        onChange={() => toggleEntry(entry.id)}
                        disabled={loading}
                      />
                      <span className="flex-1 text-xs text-slate-800 dark:text-slate-200">
                        {entry.author_name || entry.author_id}
                      </span>
                      <span className="text-xs text-slate-500">{entry.platform_id}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || connectors.length === 0}
                onClick={handlePush}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? 'Pushing to CRM...' : 'Push to CRM'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
