import React, { useState, useEffect } from 'react';
import { Power, Check, X } from 'lucide-react';

interface ActivateDeactivateButtonProps {
  platformId?: string;
  isActive: boolean;
  onToggle: (nextState: boolean) => void;
  disabled?: boolean;
  labelActive?: string;
  labelInactive?: string;
  id?: string;
}

export const ActivateDeactivateButton: React.FC<ActivateDeactivateButtonProps> = ({
  isActive,
  onToggle,
  disabled = false,
  labelActive = 'Active',
  labelInactive = 'Inactive',
  id,
}) => {
  const [confirming, setConfirming] = useState(false);

  // Auto-reset confirmation if user clicks away or after 4 seconds
  useEffect(() => {
    if (confirming) {
      const timer = setTimeout(() => setConfirming(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [confirming]);

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1.5 animate-in fade-in duration-100" id={id}>
        <span className="text-xs text-slate-500 font-medium">
          {isActive ? 'Pause?' : 'Activate?'}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(!isActive);
            setConfirming(false);
          }}
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-white shadow-xs transition-colors ${
            isActive
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
          title={isActive ? 'Confirm pause' : 'Confirm activation'}
        >
          <Check className="w-3 h-3" /> Yes
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
          }}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        isActive
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'
          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
      }`}
      title={isActive ? 'Click to deactivate connector' : 'Click to activate connector'}
    >
      <Power
        className={`w-3.5 h-3.5 ${
          isActive ? 'text-emerald-600' : 'text-slate-400'
        }`}
      />
      <span>{isActive ? labelActive : labelInactive}</span>
    </button>
  );
};
