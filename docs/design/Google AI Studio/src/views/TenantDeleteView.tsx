import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldAlert,
  ArrowLeft,
  Calendar,
  Download,
  AlertTriangle,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export const TenantDeleteView: React.FC = () => {
  const {
    activeTenant,
    requestTenantDeletion,
    cancelTenantDeletion,
    confirmFinalTenantDeletion,
    exportTenantData,
    navigateTo,
  } = useApp();

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const deletionRequest = activeTenant?.deletionRequest;
  const isGracePeriod = deletionRequest?.status === 'grace_period';

  const expectedPhrase = `delete ${activeTenant?.domain || 'workspace'}`;
  const isPhraseCorrect = confirmationPhrase.trim().toLowerCase() === expectedPhrase.toLowerCase();

  return (
    <div className="space-y-6 max-w-4xl" id="tenant-delete-page">
      {/* Back Link & Header */}
      <div className="pb-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => navigateTo('/tenant/settings')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tenant Settings</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Workspace Offboarding & Deletion
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Structured 30-day grace period decommissioning workflow (ADR-0043)
            </p>
          </div>
        </div>
      </div>

      {/* Active Grace Period Notice */}
      {isGracePeriod && deletionRequest && (
        <div
          role="alert"
          className="p-5 bg-rose-50 border-2 border-rose-300 rounded-lg shadow-sm space-y-3"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-bold text-rose-900">
                  Workspace Scheduled for Permanent Deletion
                </h2>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  A 30-day grace period is currently active. All connector ingestion will be ceased and data permanently purged on{' '}
                  <strong>{new Date(deletionRequest.graceEndsAt).toLocaleDateString()}</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={cancelTenantDeletion}
              className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-white border border-emerald-300 rounded-md hover:bg-emerald-50 transition-colors shadow-xs shrink-0"
            >
              Cancel Deletion & Restore
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Pre-deletion Data Archive */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            1. Download Sovereign Compliance Archive
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Before decommissioning, ensure you download complete snapshots of your tenant's enriched posts and match configurations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => exportTenantData('json')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
          >
            <FileJson className="w-4 h-4 text-blue-600" />
            <span>Download All Data (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => exportTenantData('csv')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Download Posts (CSV)</span>
          </button>
        </div>
      </div>

      {/* Step 2: Grace Period Deletion Request */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            2. Request Workspace Deletion (30-Day Grace Period)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Initiates the mandatory 30-day grace period. You can cancel and restore the tenant at any point during this window.
          </p>
        </div>

        {!isGracePeriod ? (
          <button
            type="button"
            id="btn-request-deletion"
            onClick={requestTenantDeletion}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-300 rounded-md hover:bg-rose-100 transition-colors"
          >
            <Calendar className="w-4 h-4 text-rose-600" />
            <span>Initiate 30-Day Grace Period</span>
          </button>
        ) : (
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 font-mono">
            Grace period requested by: <strong className="text-slate-800">{deletionRequest?.requestedBy}</strong>
          </div>
        )}
      </div>

      {/* Step 3: Immediate Irreversible Decommission (High Friction) */}
      <div className="bg-rose-50/40 border border-rose-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-rose-900">
            3. Permanent Irreversible Decommission
          </h2>
          <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
            Instantly drops all tenant database collections, purges encrypted API tokens, and revokes all user sessions immediately. This action cannot be undone.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirmModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Permanently Delete Workspace Now</span>
        </button>
      </div>

      {/* High Friction Confirmation Dialog */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl border border-rose-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-rose-900">
                Confirm Permanent Workspace Deletion
              </h3>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p className="leading-relaxed">
                You are about to permanently destroy all data associated with <strong>{activeTenant?.name}</strong> ({activeTenant?.domain}).
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 space-y-1 font-mono">
                <div>• All watchlist match rules will be deleted</div>
                <div>• All ingested social posts will be dropped</div>
                <div>• All tenant member access sessions will be terminated</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  To confirm, type <code className="bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-mono">{expectedPhrase}</code> below:
                </label>
                <input
                  type="text"
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  placeholder={expectedPhrase}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setConfirmModalOpen(false);
                  setConfirmationPhrase('');
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isPhraseCorrect || isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  await new Promise((r) => setTimeout(r, 900));
                  confirmFinalTenantDeletion();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded shadow-xs transition-colors"
              >
                {isDeleting ? 'Decommissioning...' : 'I understand, delete workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
