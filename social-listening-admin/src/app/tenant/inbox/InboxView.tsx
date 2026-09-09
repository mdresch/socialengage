'use client';

import React, { useState, useEffect } from 'react';
import type { AdminInboxItem } from '@/lib/core-client';
import { InboxItemDetail } from './InboxItemDetail';

const PRIORITY_TABS = [
  { id: 'all', label: 'All Items' },
  { id: 'urgent', label: '🔥 Urgent' },
  { id: 'high', label: '⚠️ High Priority' },
  { id: 'snoozed', label: '💤 Snoozed' },
  { id: 'resolved', label: '✓ Resolved' },
];

export function InboxView() {
  const [items, setItems] = useState<AdminInboxItem[]>([]);
  const [selectedTab, setSelectedTab] = useState('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = '';
      if (selectedTab === 'urgent') query = '?priority=urgent&status=open';
      else if (selectedTab === 'high') query = '?priority=high&status=open';
      else if (selectedTab === 'snoozed') query = '?status=snoozed';
      else if (selectedTab === 'resolved') query = '?status=resolved';
      else query = '?status=open';

      const res = await fetch(`/api/inbox${query}`);
      if (!res.ok) {
        throw new Error(`Failed to load inbox: ${res.status}`);
      }
      const data = await res.json();
      const list: AdminInboxItem[] = data.items || [];
      setItems(list);

      // Auto-select first item if current selection not found
      if (list.length > 0 && (!selectedItemId || !list.some((i) => i.id === selectedItemId))) {
        setSelectedItemId(list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching inbox');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedTab]);

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const content =
      item.post?.rawPayload?.content ||
      item.post?.rawPayload?.commentary ||
      item.notes ||
      '';
    return (
      content.toLowerCase().includes(q) ||
      item.providerId.toLowerCase().includes(q) ||
      item.priority.toLowerCase().includes(q)
    );
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span style={{ backgroundColor: '#450a0a', color: '#f87171', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>URGENT</span>;
      case 'high':
        return <span style={{ backgroundColor: '#431407', color: '#fb923c', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>HIGH</span>;
      case 'normal':
        return <span style={{ backgroundColor: '#1e293b', color: '#94a3b8', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}>NORMAL</span>;
      default:
        return <span style={{ backgroundColor: '#0f172a', color: '#64748b', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}>LOW</span>;
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc', height: 'calc(100vh - 4rem)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
            Unified Social Inbox
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
            Triage, prioritize, and respond to social mentions across all connected channels.
          </p>
        </div>
        <button
          onClick={fetchItems}
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#cbd5e1',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
          {PRIORITY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: selectedTab === tab.id ? '#3b82f6' : '#1e293b',
                color: selectedTab === tab.id ? '#ffffff' : '#94a3b8',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              data-testid={`inbox-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter mentions..."
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '0.4rem 0.75rem',
            color: '#ffffff',
            fontSize: '0.8125rem',
            width: '220px',
            outline: 'none',
          }}
          data-testid="inbox-search-input"
        />
      </div>

      {/* Main 2-Pane Workdesk */}
      <div style={{ display: 'flex', flex: 1, gap: '1.25rem', minHeight: 0 }}>
        {/* Left Pane: Queue List */}
        <div
          style={{
            flex: '0 0 380px',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            border: '1px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #334155', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Queue ({filteredItems.length})
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                Loading mentions...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                No conversations in this view.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedItemId;
                const snippet =
                  item.post?.rawPayload?.content ||
                  item.post?.rawPayload?.commentary ||
                  item.notes ||
                  'No preview text available';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    style={{
                      padding: '0.875rem 1rem',
                      borderBottom: '1px solid #334155',
                      backgroundColor: isSelected ? '#0f172a' : 'transparent',
                      borderLeft: isSelected ? '4px solid #3b82f6' : '4px solid transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    data-testid={`inbox-item-row-${item.id}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {getPriorityBadge(item.priority)}
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#60a5fa', textTransform: 'capitalize' }}>
                          {item.providerId}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: isSelected ? '#f8fafc' : '#cbd5e1',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {snippet}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Selected Detail & Reply Composer */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            border: '1px solid #334155',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <InboxItemDetail
            item={selectedItem}
            onItemUpdated={fetchItems}
          />
        </div>
      </div>
    </div>
  );
}
