import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface SlideoverProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl'; // md = 480px, lg = 640px, xl = 768px
  id?: string;
}

export const Slideover: React.FC<SlideoverProps> = ({
  title,
  subtitle,
  isOpen,
  onClose,
  children,
  footer,
  width = 'md',
  id,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass =
    width === 'xl'
      ? 'max-w-2xl sm:max-w-3xl'
      : width === 'lg'
      ? 'max-w-xl sm:max-w-2xl'
      : 'max-w-md sm:max-w-lg';

  return (
    <div
      id={id || 'slideover-container'}
      className="fixed inset-0 z-50 overflow-hidden"
      aria-labelledby="slideover-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          onClick={onClose}
          aria-hidden="true"
        />

        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div
            ref={panelRef}
            className={`w-screen ${widthClass} bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right`}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/75">
              <div>
                <h2 id="slideover-title" className="text-lg font-semibold text-slate-900">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                aria-label="Close slideover panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content body */}
            <div className="relative flex-1 px-6 py-6 overflow-y-auto">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
