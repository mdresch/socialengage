import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  id?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  id,
}) => {
  return (
    <div
      id={id}
      className="flex flex-col items-center justify-center p-12 text-center bg-white border border-dashed border-slate-200 rounded-lg max-w-md mx-auto my-6"
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-500 mb-4">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-sm leading-relaxed">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-xs"
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
};
