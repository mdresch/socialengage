'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  WatchlistAST,
  WatchlistClause,
  ClauseType,
  DateOperator,
  ConnectorQueryCapabilities,
  validateAstAgainstCapabilities,
  astToBooleanQuery,
  parseBooleanQueryToAst,
  AstWarning,
} from '@/lib/watchlist-ast';

export interface BooleanQueryBuilderProps {
  value?: WatchlistAST;
  rawQuery?: string;
  onChange: (ast: WatchlistAST, queryString: string) => void;
  selectedPlatformIds?: string[];
  disabled?: boolean;
}

const CLAUSE_TYPE_LABELS: Record<ClauseType, { label: string; icon: string; placeholder: string }> = {
  keyword: { label: 'Keyword', icon: '🔤', placeholder: 'e.g. Acme' },
  phrase: { label: 'Phrase', icon: '💬', placeholder: 'e.g. product launch' },
  hashtag: { label: 'Hashtag', icon: '#️⃣', placeholder: 'e.g. Tech2026' },
  mention: { label: 'Mention', icon: '@️⃣', placeholder: 'e.g. acme_corp' },
  author: { label: 'Author', icon: '👤', placeholder: 'e.g. founder_jane' },
  source: { label: 'Source', icon: '📰', placeholder: 'e.g. gnews' },
  sentiment: { label: 'Sentiment', icon: '🎭', placeholder: 'positive' },
  date: { label: 'Date', icon: '📅', placeholder: '2026-08-01' },
  nested: { label: 'Group (Nested)', icon: '📦', placeholder: '' },
};

const OPERATOR_OPTIONS: Array<{ value: 'AND' | 'OR' | 'NOT'; label: string; icon: string; badgeClass: string }> = [
  { value: 'AND', label: 'AND (All)', icon: '&', badgeClass: 'op-and' },
  { value: 'OR', label: 'OR (Any)', icon: '|', badgeClass: 'op-or' },
  { value: 'NOT', label: 'NOT (None)', icon: '!', badgeClass: 'op-not' },
];

const DATE_OPERATORS: Array<{ value: DateOperator; label: string }> = [
  { value: '>=', label: 'On or After (>=)' },
  { value: '<=', label: 'On or Before (<=)' },
  { value: '=', label: 'Exact Date (=)' },
  { value: '>', label: 'After (>)' },
  { value: '<', label: 'Before (<)' },
];

export function BooleanQueryBuilder({
  value,
  rawQuery,
  onChange,
  selectedPlatformIds = [],
  disabled = false,
}: BooleanQueryBuilderProps) {
  const [mode, setMode] = useState<'guided' | 'advanced'>('guided');
  const [ast, setAst] = useState<WatchlistAST>(() => {
    if (value && value.clauses) return value;
    if (rawQuery && rawQuery.trim()) return parseBooleanQueryToAst(rawQuery);
    return { operator: 'AND', clauses: [{ type: 'keyword', value: '' }] };
  });

  const [textQuery, setTextQuery] = useState<string>(() => {
    if (rawQuery && rawQuery.trim()) return rawQuery;
    if (value && value.clauses) return astToBooleanQuery(value);
    return '';
  });

  const [capabilitiesList, setCapabilitiesList] = useState<ConnectorQueryCapabilities[]>([]);
  const [showAstPreview, setShowAstPreview] = useState(false);

  // Fetch capabilities for target platforms
  useEffect(() => {
    let isMounted = true;
    async function fetchCapabilities() {
      if (!selectedPlatformIds || selectedPlatformIds.length === 0) {
        setCapabilitiesList([]);
        return;
      }
      try {
        const fetched = await Promise.all(
          selectedPlatformIds.map(async (pid) => {
            const res = await fetch(`/api/connectors/${encodeURIComponent(pid)}/query-capabilities`);
            if (res.ok) {
              return (await res.json()) as ConnectorQueryCapabilities;
            }
            return null;
          })
        );
        if (isMounted) {
          setCapabilitiesList(fetched.filter((c): c is ConnectorQueryCapabilities => c !== null));
        }
      } catch {
        // Best effort
      }
    }
    fetchCapabilities();
    return () => {
      isMounted = false;
    };
  }, [selectedPlatformIds]);

  const updateAstAndNotify = useCallback(
    (newAst: WatchlistAST) => {
      setAst(newAst);
      const generated = astToBooleanQuery(newAst);
      setTextQuery(generated);
      onChange(newAst, generated);
    },
    [onChange]
  );

  const handleAdvancedTextChange = (newText: string) => {
    setTextQuery(newText);
    const parsed = parseBooleanQueryToAst(newText);
    setAst(parsed);
    onChange(parsed, newText);
  };

  const setRootOperator = (operator: 'AND' | 'OR' | 'NOT') => {
    updateAstAndNotify({ ...ast, operator });
  };

  const addClause = (type: ClauseType = 'keyword') => {
    let newClause: WatchlistClause;
    if (type === 'nested') {
      newClause = { type: 'nested', operator: 'AND', clauses: [{ type: 'keyword', value: '' }] };
    } else if (type === 'date') {
      newClause = { type: 'date', operator: '>=', value: new Date().toISOString().slice(0, 10) };
    } else if (type === 'sentiment') {
      newClause = { type: 'sentiment', value: 'positive' };
    } else {
      newClause = { type, value: '' } as WatchlistClause;
    }
    updateAstAndNotify({ ...ast, clauses: [...ast.clauses, newClause] });
  };

  const updateClause = (index: number, updated: WatchlistClause) => {
    const updatedClauses = [...ast.clauses];
    updatedClauses[index] = updated;
    updateAstAndNotify({ ...ast, clauses: updatedClauses });
  };

  const removeClause = (index: number) => {
    const updatedClauses = ast.clauses.filter((_, i) => i !== index);
    updateAstAndNotify({ ...ast, clauses: updatedClauses });
  };

  const warnings: AstWarning[] = validateAstAgainstCapabilities(ast, capabilitiesList);

  return (
    <div className="boolean-query-builder card" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
      {/* Header with Mode Toggle and AST debug toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div className="btn-group" role="tablist" aria-label="Query builder mode">
          <button
            type="button"
            className={`btn btn-sm ${mode === 'guided' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('guided')}
            role="tab"
            aria-selected={mode === 'guided'}
          >
            🧭 Guided Builder
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'advanced' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('advanced')}
            role="tab"
            aria-selected={mode === 'advanced'}
          >
            ⚡ Advanced Text
          </button>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowAstPreview((prev) => !prev)}
          style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
        >
          {showAstPreview ? 'Hide AST JSON' : 'View AST JSON'}
        </button>
      </div>

      {/* Warnings Section */}
      {warnings.length > 0 && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
            color: 'var(--danger-400, #f87171)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 'var(--space-1)' }}>
            ⚠️ Platform Query Warnings:
          </div>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: '0.8rem' }}>
            {warnings.map((w, idx) => (
              <li key={idx}>
                <strong>[{w.platformId}]</strong> {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Guided Visual Mode */}
      {mode === 'guided' ? (
        <div className="guided-builder-tree" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Root Group Operator Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--surface-muted, rgba(255, 255, 255, 0.03))',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Match clauses with operator:
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              {OPERATOR_OPTIONS.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  disabled={disabled}
                  className={`btn btn-xs ${ast.operator === op.value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setRootOperator(op.value)}
                  style={{ fontWeight: 600 }}
                >
                  <span style={{ marginRight: '4px' }}>{op.icon}</span>
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clause Rows List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {ast.clauses.map((clause, idx) => (
              <ClauseRowItem
                key={idx}
                clause={clause}
                index={idx}
                onChange={(updated) => updateClause(idx, updated)}
                onDelete={() => removeClause(idx)}
                disabled={disabled}
              />
            ))}
          </div>

          {/* Add Clause Controls */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => addClause('keyword')}
              disabled={disabled}
            >
              + Add Clause
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => addClause('nested')}
              disabled={disabled}
            >
              + Add Nested Group
            </button>
          </div>
        </div>
      ) : (
        /* Advanced Text Mode */
        <div className="advanced-text-editor">
          <textarea
            className="form-input boolean-query-editor"
            rows={5}
            value={textQuery}
            onChange={(e) => handleAdvancedTextChange(e.target.value)}
            disabled={disabled}
            placeholder={`("Acme Launch" OR #Tech2026) AND NOT spam sentiment:positive date:>=2026-08-01`}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.9rem' }}
          />
          <p className="wl-form-hint" style={{ marginTop: 'var(--space-1)' }}>
            Advanced boolean query parser automatically parses operators (AND, OR, NOT), quotes (&quot;&quot;), hashtags (#), mentions (@), author (from:), source (source:), sentiment (sentiment:), and dates (date:&gt;=).
          </p>
        </div>
      )}

      {/* AST JSON Preview */}
      {showAstPreview && (
        <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Canonical AST JSON:</span>
          <pre
            style={{
              marginTop: 'var(--space-1)',
              padding: 'var(--space-2)',
              background: 'var(--surface-muted)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              overflowX: 'auto',
              maxHeight: '180px',
            }}
          >
            {JSON.stringify(ast, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ClauseRowItem({
  clause,
  onChange,
  onDelete,
  disabled,
}: {
  clause: WatchlistClause;
  index: number;
  onChange: (clause: WatchlistClause) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  if (clause.type === 'nested') {
    return (
      <div
        className="nested-group-container"
        style={{
          border: '1px dashed var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-3)',
          background: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nested Group ({clause.operator}):</span>
            <select
              className="form-select form-select-sm"
              value={clause.operator}
              onChange={(e) => onChange({ ...clause, operator: e.target.value as 'AND' | 'OR' | 'NOT' })}
              disabled={disabled}
            >
              <option value="AND">& AND</option>
              <option value="OR">| OR</option>
              <option value="NOT">! NOT</option>
            </select>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs text-danger"
            onClick={onDelete}
            disabled={disabled}
            aria-label="Delete nested group"
          >
            ✕ Delete Group
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingLeft: 'var(--space-2)' }}>
          {clause.clauses.map((childClause, childIdx) => (
            <ClauseRowItem
              key={childIdx}
              clause={childClause}
              index={childIdx}
              onChange={(updatedChild) => {
                const newClauses = [...clause.clauses];
                newClauses[childIdx] = updatedChild;
                onChange({ ...clause, clauses: newClauses });
              }}
              onDelete={() => {
                const newClauses = clause.clauses.filter((_, i) => i !== childIdx);
                onChange({ ...clause, clauses: newClauses });
              }}
              disabled={disabled}
            />
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            style={{ alignSelf: 'flex-start', marginTop: 'var(--space-1)' }}
            onClick={() => {
              onChange({
                ...clause,
                clauses: [...clause.clauses, { type: 'keyword', value: '' }],
              });
            }}
            disabled={disabled}
          >
            + Add to group
          </button>
        </div>
      </div>
    );
  }

  const handleTypeChange = (newType: ClauseType) => {
    if (newType === 'nested') {
      onChange({ type: 'nested', operator: 'AND', clauses: [{ type: 'keyword', value: '' }] });
    } else if (newType === 'date') {
      onChange({ type: 'date', operator: '>=', value: new Date().toISOString().slice(0, 10) });
    } else if (newType === 'sentiment') {
      onChange({ type: 'sentiment', value: 'positive' });
    } else {
      onChange({ type: newType, value: (clause as any).value || '' } as WatchlistClause);
    }
  };

  return (
    <div
      className="clause-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        background: 'var(--surface-subtle)',
        padding: 'var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Type Dropdown */}
      <select
        className="form-select form-select-sm"
        style={{ minWidth: '130px' }}
        value={clause.type}
        onChange={(e) => handleTypeChange(e.target.value as ClauseType)}
        disabled={disabled}
      >
        {Object.entries(CLAUSE_TYPE_LABELS).map(([typeKey, info]) => (
          <option key={typeKey} value={typeKey}>
            {info.icon} {info.label}
          </option>
        ))}
      </select>

      {/* Value Input by Type */}
      {clause.type === 'sentiment' ? (
        <select
          className="form-select form-select-sm"
          style={{ flex: 1 }}
          value={clause.value}
          onChange={(e) => onChange({ ...clause, value: e.target.value })}
          disabled={disabled}
        >
          <option value="positive">🟢 Positive</option>
          <option value="negative">🔴 Negative</option>
          <option value="neutral">⚪ Neutral</option>
        </select>
      ) : clause.type === 'date' ? (
        <div style={{ display: 'flex', gap: 'var(--space-1)', flex: 1 }}>
          <select
            className="form-select form-select-sm"
            style={{ width: '140px' }}
            value={clause.operator}
            onChange={(e) => onChange({ ...clause, operator: e.target.value as DateOperator })}
            disabled={disabled}
          >
            {DATE_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="form-input form-input-sm"
            style={{ flex: 1 }}
            value={clause.value}
            onChange={(e) => onChange({ ...clause, value: e.target.value })}
            disabled={disabled}
          />
        </div>
      ) : (
        <input
          type="text"
          className="form-input form-input-sm"
          style={{ flex: 1 }}
          placeholder={CLAUSE_TYPE_LABELS[clause.type]?.placeholder}
          value={clause.value}
          onChange={(e) => onChange({ ...clause, value: e.target.value })}
          disabled={disabled}
        />
      )}

      {/* Delete button */}
      <button
        type="button"
        className="btn btn-ghost btn-xs text-danger"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Remove clause"
        title="Remove clause"
      >
        ✕
      </button>
    </div>
  );
}
