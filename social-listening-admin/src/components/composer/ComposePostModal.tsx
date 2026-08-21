'use client';

import { useEffect } from 'react';
import { PolypostComposer } from './PolypostComposer';

interface ComposePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
}

export function ComposePostModal({ isOpen, onClose, initialText = '' }: ComposePostModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="composer-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-modal-title"
        data-testid="compose-modal"
      >
        {/* Modal Header */}
        <div className="composer-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              ✍️
            </div>
            <div>
              <h2
                id="compose-modal-title"
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  lineHeight: 1.2,
                }}
              >
                Compose &amp; Cross-Publish Post
              </h2>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Polypost multi-channel editor with real-time platform preview rails
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="composer-modal-body">
          <PolypostComposer
            initialText={initialText}
            onPublishSuccess={onClose}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
