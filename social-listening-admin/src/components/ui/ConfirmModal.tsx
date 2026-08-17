'use client';

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

export interface ConfirmModalProps {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  confirmVariant?: 'destructive' | 'primary';
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  isOpen: boolean;
}

/**
 * ConfirmModal (Design Spec §6.2)
 * Accessible dialog used for destructive or irreversible actions.
 */
export function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  isOpen,
}: ConfirmModalProps): ReactElement | null {
  const [isPending, setIsPending] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button on open
    const timeout = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isPending, onCancel]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = async () => {
    try {
      setIsPending(true);
      await onConfirm();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        data-testid="confirm-modal"
      >
        <div className="modal-header">
          <h3 id="confirm-modal-title">{title}</h3>
        </div>

        <div className="modal-body">{body}</div>

        <div className="modal-footer">
          <button
            type="button"
            className="modal-btn-cancel"
            onClick={onCancel}
            disabled={isPending}
            data-testid="modal-cancel-btn"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={confirmVariant === 'destructive' ? 'modal-btn-destructive' : ''}
            onClick={handleConfirm}
            disabled={isPending}
            data-testid="modal-confirm-btn"
          >
            {isPending ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
