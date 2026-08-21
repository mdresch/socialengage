'use client';

import { useState, useEffect } from 'react';
import type { SavedDraft } from './lib/draftStorage';
import { getSavedDrafts, deleteDraft } from './lib/draftStorage';

interface DraftHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDraft: (draft: SavedDraft) => void;
}

export function DraftHistoryDrawer({ isOpen, onClose, onSelectDraft }: DraftHistoryDrawerProps) {
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDrafts(getSavedDrafts());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteDraft(id);
    setDrafts(getSavedDrafts());
  };

  return (
    <div
      className="modal-backdrop"
      style={{ justifyContent: 'flex-end', padding: 0 }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="slideover-panel"
        style={{ maxWidth: 420 }}
        role="dialog"
        aria-label="Draft History"
      >
        <div className="slideover-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.125rem' }}>📁</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Saved Drafts ({drafts.length})</h3>
              <p className="slideover-subtitle">Autosaved versions and saved templates</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="slideover-close-btn" aria-label="Close">
            ×
          </button>
        </div>

        <div className="slideover-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {drafts.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
              <span style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📝</span>
              <h3>No saved drafts yet</h3>
              <p>Your drafted posts and autosaved versions will appear here.</p>
            </div>
          ) : (
            drafts.map((d) => (
              <div
                key={d.id}
                onClick={() => {
                  onSelectDraft(d);
                  onClose();
                }}
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
                    {d.title || 'Untitled Draft'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, d.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-danger)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: '2px 4px',
                    }}
                    title="Delete draft"
                  >
                    Delete
                  </button>
                </div>

                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    margin: '0 0 6px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {d.mainText || '(No content)'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                  <span>{new Date(d.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(d.updatedAt).toLocaleDateString()}</span>
                  <span>{d.selectedPlatforms.length} platforms</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
