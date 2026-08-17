'use client';

import { useEffect, type ReactElement, type ReactNode } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Modal (Design Spec §6.2) — the generic dialog shell `ConfirmModal` also
 * uses (same `.modal-backdrop`/`.modal-dialog` classes), but with a plain
 * `children` slot instead of a baked-in confirm/cancel footer. For a form or
 * multi-action flow (invite a user, configure a time-bounded access window)
 * that needs its own internal state and buttons, not a single static
 * confirm action — `ConfirmModal` stays the right choice for a real
 * irreversible-action confirmation (Design Spec §2's "Confirmed
 * irreversibility" principle).
 */
export function Modal({ isOpen, onClose, title, children }: ModalProps): ReactElement | null {
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
      <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-testid="modal-panel">
        <div className="modal-header">
          <h3 id="modal-title">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}
