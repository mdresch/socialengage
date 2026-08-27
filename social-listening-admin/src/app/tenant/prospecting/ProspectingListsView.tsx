'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ProspectingList, ProspectingListsResponse } from '@/lib/core-client';

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  engaged: 'Engaged',
  converted: 'Converted',
  passed: 'Passed',
};

const STAGE_COLORS: Record<string, string> = {
  new: '#6366f1',
  contacted: '#f59e0b',
  engaged: '#10b981',
  converted: '#3b82f6',
  passed: '#6b7280',
};

interface ProspectingListsViewProps {
  userId: string;
  initialLists: ProspectingList[];
}

export function ProspectingListsView({ userId, initialLists }: ProspectingListsViewProps) {
  const [lists, setLists] = useState<ProspectingList[]>(initialLists);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newShared, setNewShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/prospecting-lists');
      if (res.ok) {
        const data: ProspectingListsResponse = await res.json();
        setLists(data.lists);
      }
    } catch {}
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/prospecting-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, shared: newShared }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to create list');
        return;
      }
      setCreating(false);
      setNewName('');
      setNewDesc('');
      setNewShared(false);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (listId: string) => {
    if (!confirm('Delete this prospecting list and all its entries?')) return;
    setDeletingId(listId);
    try {
      await fetch(`/api/prospecting-lists/${listId}`, { method: 'DELETE' });
      await refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Prospecting Lists</h1>
          <p className="page-subtitle">Build and manage qualified author lead lists for social selling outreach</p>
        </div>
        <button
          id="btn-new-prospecting-list"
          className="btn btn-primary btn-sm"
          onClick={() => setCreating(true)}
        >
          + New List
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="card" style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-4)' }}>
          <h3 style={{ margin: '0 0 var(--space-3)' }}>New Prospecting List</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label htmlFor="list-name" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)', fontSize: '0.875rem' }}>Name *</label>
                <input
                  id="list-name"
                  type="text"
                  className="input"
                  placeholder="e.g. Enterprise Tech Influencers"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="list-desc" style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-1)', fontSize: '0.875rem' }}>Description</label>
                <textarea
                  id="list-desc"
                  className="input"
                  placeholder="Optional description"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newShared}
                  onChange={e => setNewShared(e.target.checked)}
                  id="list-shared"
                />
                <span style={{ fontSize: '0.875rem' }}>Share with team (read-only for others)</span>
              </label>
              {error && <p style={{ color: 'var(--color-error)', margin: 0, fontSize: '0.875rem' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                  {loading ? 'Creating…' : 'Create List'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setCreating(false); setError(null); }}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Empty state */}
      {lists.length === 0 && !creating && (
        <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>📋</div>
          <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>No prospecting lists yet</p>
          <p style={{ fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>Create a list to start qualifying and tracking social selling leads.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ New List</button>
        </div>
      )}

      {/* Lists grid */}
      {lists.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {lists.map(list => (
            <div key={list.id} className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>{list.name}</span>
                    {list.shared && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--color-primary-subtle, #ede9fe)', color: 'var(--color-primary, #6366f1)', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                        Shared
                      </span>
                    )}
                    {list.owner_id !== userId && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--color-bg-muted, #f3f4f6)', color: 'var(--color-text-muted)', padding: '2px 8px', borderRadius: '9999px' }}>
                        Read-only
                      </span>
                    )}
                  </div>
                  {list.description && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 'var(--space-1) 0 0' }}>{list.description}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                  <a
                    href={`/tenant/prospecting/${list.id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem' }}
                  >
                    Open →
                  </a>
                  {list.owner_id === userId && (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ fontSize: '0.75rem', opacity: deletingId === list.id ? 0.5 : 1 }}
                      onClick={() => handleDelete(list.id)}
                      disabled={deletingId === list.id}
                      title="Delete list"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Created {new Date(list.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
