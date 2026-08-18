import React from 'react';
import { AlertCircle } from 'lucide-react';

interface InlineErrorProps {
  message: string;
  id?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({ message, id }) => {
  if (!message) return null;
  return (
    <div
      id={id}
      role="alert"
      className="flex items-center gap-1.5 mt-1.5 text-xs text-rose-600 font-medium"
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
};
