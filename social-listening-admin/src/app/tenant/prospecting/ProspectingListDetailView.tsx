'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ProspectingList, ProspectingListEntry } from '@/lib/core-client';

const STAGE_LABELS: Record<string, string> = {
  new: 'New Lead',
  contacted: 'Contacted',
  engaged: 'Engaged',
  converted: 'Converted',
  passed: 'Passed',
};

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: '#ede9fe', text: '#6366f1' },
  contacted: { bg: '#fef3c7', text: '#d97706' },
  engaged: { bg: '#d1fae5', text: '#059669' },
  converted: { bg: '#dbeafe', text: '#2563eb' },
  passed: { bg: '#f3f4f6', text: '#6b7280' },
};

interface ProspectingListDetailViewProps {
  listId: string;
  userId: string;
  initialList: ProspectingList;
  initialEntries: ProspectingListEntry[];
}

export function ProspectingListDetailView({
  listId,
  userId,
  initialList,
  initialEntries,
}: ProspectingListDetailViewProps) {
  const [list, setList] = useState<ProspectingList>(initialList);
  const [entries, setEntries] = useState<ProspectingListEntry[]>(initialEntries);
  const [isOwner, setIsOwner] = useState(initialList.owner_id === userId);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(initialList.name);
  const [editDesc, setEditDesc] = useState(initialList.description || '');
  const [editShared, setEditShared] = useState(initialList.shared);
  const [savingList, setSavingList] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editStage, setEditStage] = useState<string>('new');
  const [editNotes, setEditNotes] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const refreshEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/prospecting-lists/${listId}/entries`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch {}
  }, [listId]);

  const handleSaveList = async () => {
    setSavingList(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/prospecting-lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null, shared: editShared }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setEditError(body.error || 'Failed to save');
        return;
      }
      const updated: ProspectingList = await res.json();
      setList(updated);
      setEditing(false);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSavingList(false);
    }
  };

  const handleStartEditEntry = (entry: ProspectingListEntry) => {
    setEditingEntryId(entry.id);
    setEditStage(entry.relationship_stage);
    setEditNotes(entry.notes || '');
  };

  const handleSaveEntry = async (entryId: string) => {
    setSavingEntry(true);
    try {
      const res = await fetch(`/api/prospecting-lists/${listId}/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationship_stage: editStage, notes: editNotes || null }),
      });
      if (res.ok) {
        const updated: ProspectingListEntry = await res.json();
        setEntries(prev => prev.map(e => e.id === entryId ? updated : e));
        setEditingEntryId(null);
      }
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Remove this lead from the list?')) return;
    setDeletingEntryId(entryId);
    try {
      await fetch(`/api/prospecting-lists/${listId}/entries/${entryId}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== entryId));
    } finally {
      setDeletingEntryId(null);
    }
  };

  return (
    <div>
      {/* Back nav */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/tenant/prospecting" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
          ← All Lists
        </a>
      </div>

      {/* List header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        {editing ? (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 480 }}>
              <input
                id="edit-list-name"
                type="text"
                className="input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="List name"
              />
              <textarea
                className="input"
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                style={{ resize: 'vertical' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={editShared} onChange={e => setEditShared(e.target.checked)} />
                Share with team (read-only)
              </label>
              {editError && <p style={{ color: 'var(--color-error)', margin: 0, fontSize: '0.875rem' }}>{editError}</p>}
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveList} disabled={savingList}>
                  {savingList ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setEditError(null); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ margin: 0 }}>{list.name}</h1>
              {list.shared && (
                <span style={{ fontSize: '0.75rem', background: '#ede9fe', color: '#6366f1', padding: '2px 10px', borderRadius: '9999px', fontWeight: 600 }}>
                  Shared
                </span>
              )}
              {!isOwner && (
                <span style={{ fontSize: '0.75rem', background: '#f3f4f6', color: '#6b7280', padding: '2px 10px', borderRadius: '9999px' }}>
                  Read-only
                </span>
              )}
            </div>
            {list.description && (
              <p className="page-subtitle" style={{ marginTop: 'var(--space-1)' }}>{list.description}</p>
            )}
          </div>
        )}
        {isOwner && !editing && (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        {Object.entries(STAGE_LABELS).map(([stage, label]) => {
          const count = entries.filter(e => e.relationship_stage === stage).length;
          const colors = STAGE_COLORS[stage];
          return (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: '4px 12px', borderRadius: '9999px', background: colors.bg, color: colors.text, fontSize: '0.8125rem', fontWeight: 600 }}>
              {label}: {count}
            </div>
          );
        })}
      </div>

      {/* Entries table */}
      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-muted)' }}>
          <p style={{ fontWeight: 600 }}>No entries yet</p>
          <p style={{ fontSize: '0.875rem' }}>Add authors from Post or Author views to this list.</p>
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>Author</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>Platform</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>Stage</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>Scores</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>Notes</th>
                {isOwner && <th style={{ textAlign: 'right', padding: 'var(--space-2) var(--space-3)', borderBottom: '2px solid var(--color-border)' }}></th>}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const isEditingThis = editingEntryId === entry.id;
                const stageColors = STAGE_COLORS[entry.relationship_stage] || STAGE_COLORS.new;
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: 'var(--space-3)', verticalAlign: 'middle' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{entry.author_id.slice(0, 8)}…</span>
                      {entry.topic && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{entry.topic}</div>}
                      {entry.tags && entry.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {entry.tags.map(tag => (
                            <span key={tag} style={{ fontSize: '0.65rem', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-3)', fontSize: '0.875rem', verticalAlign: 'middle' }}>
                      {entry.platform_id}
                    </td>
                    <td style={{ padding: 'var(--space-3)', verticalAlign: 'middle' }}>
                      {isEditingThis ? (
                        <select
                          className="input"
                          value={editStage}
                          onChange={e => setEditStage(e.target.value)}
                          style={{ fontSize: '0.8125rem', padding: '4px 8px' }}
                        >
                          {Object.entries(STAGE_LABELS).map(([s, l]) => (
                            <option key={s} value={s}>{l}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ background: stageColors.bg, color: stageColors.text, padding: '3px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {STAGE_LABELS[entry.relationship_stage] || entry.relationship_stage}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-3)', fontSize: '0.75rem', verticalAlign: 'middle' }}>
                      {entry.engagement_score && <div>Eng: {entry.engagement_score}</div>}
                      {entry.influence_score && <div>Inf: {entry.influence_score}</div>}
                      {entry.reach_score && <div>Reach: {entry.reach_score}</div>}
                    </td>
                    <td style={{ padding: 'var(--space-3)', verticalAlign: 'middle', maxWidth: 200 }}>
                      {isEditingThis ? (
                        <textarea
                          className="input"
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          rows={2}
                          style={{ fontSize: '0.8125rem', resize: 'vertical', width: '100%' }}
                          placeholder="Notes…"
                        />
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: entry.notes ? undefined : 'var(--color-text-muted)' }}>
                          {entry.notes || '—'}
                        </span>
                      )}
                    </td>
                    {isOwner && (
                      <td style={{ padding: 'var(--space-3)', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                          {isEditingThis ? (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => handleSaveEntry(entry.id)}
                                disabled={savingEntry}
                              >
                                {savingEntry ? '…' : 'Save'}
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => setEditingEntryId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => handleStartEditEntry(entry)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ fontSize: '0.75rem', opacity: deletingEntryId === entry.id ? 0.5 : 1 }}
                                onClick={() => handleDeleteEntry(entry.id)}
                                disabled={deletingEntryId === entry.id}
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
