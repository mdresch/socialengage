'use client';

import React, { useState } from 'react';

export interface CRMHandoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId?: string;
  authorId?: string;
  authorName?: string;
  postExcerpt?: string;
  defaultConnectorId?: string;
  defaultEntityType?: string;
}

export function CRMHandoffModal({
  isOpen,
  onClose,
  postId,
  authorId,
  authorName,
  postExcerpt,
  defaultConnectorId = 'dynamics365',
  defaultEntityType = 'support',
}: CRMHandoffModalProps) {
  const [crmConnectorId, setCrmConnectorId] = useState<string>(defaultConnectorId);
  const [entityType, setEntityType] = useState<string>(defaultEntityType);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [allowDuplicate, setAllowDuplicate] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateData, setDuplicateData] = useState<{ crmRecordId: string; crmRecordUrl: string } | null>(null);
  const [successResult, setSuccessResult] = useState<{ crmRecordId: string; crmRecordUrl: string } | null>(null);

  if (!isOpen) return null;

  async function handleHandoff(forceDuplicate = false) {
    setLoading(true);
    setError(null);
    setDuplicateData(null);

    try {
      const res = await fetch('/api/crm/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: postId,
          authorId,
          crmConnectorId,
          entityType,
          assignedTo: assignedTo.trim() || undefined,
          notes: notes.trim() || undefined,
          allowDuplicate: forceDuplicate || allowDuplicate,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setDuplicateData({
          crmRecordId: data.crmRecordId,
          crmRecordUrl: data.crmRecordUrl,
        });
      } else if (!res.ok) {
        setError(data.error || 'Failed to push to CRM');
      } else {
        setSuccessResult({
          crmRecordId: data.crmRecordId,
          crmRecordUrl: data.crmRecordUrl,
        });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  function handleResetAndClose() {
    setError(null);
    setDuplicateData(null);
    setSuccessResult(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Push to CRM
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escalate context to Microsoft Dynamics 365, Salesforce, or HubSpot
            </p>
          </div>
          <button
            onClick={handleResetAndClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Success View */}
        {successResult ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">✓</span>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                  Successfully escalated to CRM!
                </p>
              </div>
              <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-400">
                Record ID: <span className="font-mono">{successResult.crmRecordId}</span>
              </p>
              <div className="mt-3">
                <a
                  href={successResult.crmRecordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-emerald-500"
                >
                  Open in CRM Portal ↗
                </a>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleResetAndClose}
                className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <div className="mt-4 space-y-4 text-sm">
            {authorName && (
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Target Author:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{authorName}</p>
                {postExcerpt && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400 italic">
                    "{postExcerpt}"
                  </p>
                )}
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Duplicate 409 Conflict Banner */}
            {duplicateData && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <span>⚠️ Duplicate Escalation Warning</span>
                </div>
                <p>
                  This social item has already been escalated to this CRM provider.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={duplicateData.crmRecordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-amber-200 px-2 py-1 text-amber-900 font-medium hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100"
                  >
                    View existing record ({duplicateData.crmRecordId}) ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => handleHandoff(true)}
                    disabled={loading}
                    className="rounded bg-amber-600 px-2 py-1 text-white font-medium hover:bg-amber-500"
                  >
                    Create duplicate anyway
                  </button>
                </div>
              </div>
            )}

            {/* CRM Connector Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target CRM Connector
              </label>
              <select
                value={crmConnectorId}
                onChange={(e) => setCrmConnectorId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="dynamics365">Microsoft Dynamics 365 (Dataverse v9.2)</option>
                <option value="salesforce">Salesforce CRM (REST API)</option>
                <option value="hubspot">HubSpot (CRM v3)</option>
              </select>
            </div>

            {/* Entity Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Record Type
              </label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {[
                  { value: 'support', label: 'Support Case / Incident' },
                  { value: 'lead', label: 'Lead / Prospect' },
                  { value: 'opportunity', label: 'Opportunity / Deal' },
                  { value: 'account', label: 'Account' },
                  { value: 'contact', label: 'Contact' },
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setEntityType(type.value as any)}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition ${
                      entityType === type.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assigned User / Queue ID <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="e.g. tier1-support-queue"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Internal Escalation Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Provide internal instructions or escalation context..."
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Duplicate Override Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="allowDuplicateCheckbox"
                checked={allowDuplicate}
                onChange={(e) => setAllowDuplicate(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700"
              />
              <label htmlFor="allowDuplicateCheckbox" className="text-xs text-slate-600 dark:text-slate-400">
                Allow duplicate push if already escalated
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleHandoff(false)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? 'Pushing to CRM...' : 'Escalate to CRM'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
