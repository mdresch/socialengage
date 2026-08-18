'use client';

import { useState, type KeyboardEvent, type ReactElement } from 'react';

export interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxValues?: number;
  disabled?: boolean;
  prefix?: string;
}

/**
 * TagInput (Design Spec §6.4)
 * Multi-value keyboard-accessible input for keyword/hashtag terms.
 */
export function TagInput({
  values = [],
  onChange,
  placeholder = 'Add a term…',
  maxValues,
  disabled = false,
  prefix = '',
}: TagInputProps): ReactElement {
  const [inputValue, setInputValue] = useState('');

  const addTag = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      setInputValue('');
      return;
    }
    if (maxValues && values.length >= maxValues) {
      return;
    }
    onChange([...values, trimmed]);
    setInputValue('');
  };

  const removeTag = (indexToRemove: number) => {
    if (disabled) return;
    onChange(values.filter((_, i) => i !== indexToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && values.length > 0) {
      e.preventDefault();
      removeTag(values.length - 1);
    }
  };

  return (
    <div className="tag-input-container" data-testid="tag-input-container">
      {values.map((tag, index) => (
        <span key={`${tag}-${index}`} className="tag-chip" data-testid="tag-chip">
          <span>{prefix}{tag}</span>
          {!disabled && (
            <button
              type="button"
              className="tag-chip-remove"
              onClick={() => removeTag(index)}
              aria-label={`Remove ${tag}`}
              data-testid={`remove-tag-${index}`}
            >
              ✕
            </button>
          )}
        </span>
      ))}

      {(!maxValues || values.length < maxValues) && !disabled && (
        <input
          type="text"
          className="tag-input-field"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(inputValue)}
          placeholder={values.length === 0 ? placeholder : ''}
          disabled={disabled}
          data-testid="tag-input-field"
        />
      )}
    </div>
  );
}
