import React, { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxValues?: number;
  id?: string;
  prefix?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  values,
  onChange,
  placeholder = 'Type and press Enter...',
  maxValues = 20,
  id,
  prefix = '',
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && inputValue === '' && values.length > 0) {
      removeTag(values.length - 1);
    }
  };

  const addTag = () => {
    let clean = inputValue.trim();
    if (!clean) return;
    if (prefix && !clean.startsWith(prefix)) {
      clean = `${prefix}${clean}`;
    }
    if (!values.includes(clean) && values.length < maxValues) {
      onChange([...values, clean]);
      setInputValue('');
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(values.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div
      id={id}
      className="min-h-[42px] p-1.5 bg-white border border-slate-300 rounded-md focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 transition-all flex flex-wrap items-center gap-1.5"
    >
      {values.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800"
        >
          <span className="truncate max-w-[200px]">{tag}</span>
          <button
            type="button"
            onClick={() => removeTag(idx)}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
            aria-label={`Remove ${tag}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {values.length < maxValues && (
        <div className="flex items-center flex-1 min-w-[140px]">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder={values.length === 0 ? placeholder : 'Add more...'}
            className="w-full text-xs text-slate-900 placeholder:text-slate-400 bg-transparent outline-none px-1.5 py-1"
          />
          {inputValue.trim() && (
            <button
              type="button"
              onClick={addTag}
              className="px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>
      )}
    </div>
  );
};
