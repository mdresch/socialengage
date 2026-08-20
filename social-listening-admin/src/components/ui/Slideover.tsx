'use client';

import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';

export interface SlideoverProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg';
  className?: string;
}

/**
 * Slideover (Design Spec §6.3)
 * Right-side drawer for create/edit forms and detail views.
 */
export function Slideover({
  title,
  subtitle,
  isOpen,
  onClose,
  children,
  footer,
  width = 'md',
  className,
}: SlideoverProps): ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus close button on open
    const timeout = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    // Lock body scroll while drawer is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timeout);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="slideover-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={`slideover-panel ${width === 'lg' ? 'slideover-lg' : ''} ${className ?? ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideover-title"
        data-testid="slideover-panel"
      >
        <div className="slideover-header">
          <div>
            <h3 id="slideover-title">{title}</h3>
            {subtitle && <p className="slideover-subtitle">{subtitle}</p>}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="slideover-close-btn"
            onClick={onClose}
            aria-label="Close panel"
            data-testid="slideover-close-btn"
          >
            ✕
          </button>
        </div>

        <div className="slideover-content">{children}</div>

        {footer && <div className="slideover-footer">{footer}</div>}
      </div>
    </div>
  );
}
