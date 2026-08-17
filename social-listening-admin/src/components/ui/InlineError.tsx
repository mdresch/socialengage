import type { ReactElement } from 'react';

export interface InlineErrorProps {
  message?: string | null;
  className?: string;
}

/**
 * InlineError (Design Spec §6.6)
 * Used inside forms to display field-level or form-level error messages.
 * Always rendered with role="alert" for screen readers.
 */
export function InlineError({ message, className = '' }: InlineErrorProps): ReactElement | null {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={`inline-error ${className}`.trim()}
      data-testid="inline-error"
    >
      {message}
    </div>
  );
}
