'use client';

import React, { useState } from 'react';
import type { AdminInboxItem } from '@/lib/core-client';

interface InboxItemDetailProps {
  item: AdminInboxItem | null;
  onItemUpdated: () => void;
  onClose?: () => void;
}

export function InboxItemDetail({ item, onItemUpdated, onClose }: InboxItemDetailProps) {
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState(false);

  const [notes, setNotes] = useState(item?.notes || '');
  const [notesSaving, setNotesSaving] = useState(false);

  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);
  const [snoozeHours, setSnoozeHours] = useState('4');

  if (!item) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '3rem',
          color: '#94a3b8',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📥</div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#e2e8f0', margin: '0 0 0.25rem 0' }}>
          No Conversation Selected
        </h3>
        <p style={{ fontSize: '0.875rem', maxWidth: '300px' }}>
          Select an item from the inbox queue to inspect, triage, assign, or compose a reply.
        </p>
      </div>
    );
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setReplyLoading(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/inbox/${item.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to send reply');
      }

      setReplySuccess(true);
      setReplyText('');
      setTimeout(() => {
        setReplySuccess(false);
        onItemUpdated();
      }, 1000);
    } catch (err: any) {
      setReplyError(err.message || 'Error sending reply');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleResolve = async () => {
    try {
      const res = await fetch(`/api/inbox/${item.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        onItemUpdated();
      }
    } catch {
      // ignore
    }
  };

  const handleSnooze = async () => {
    const hours = parseInt(snoozeHours, 10) || 4;
    const snoozedUntil = new Date(Date.now() + hours * 3600000).toISOString();

    try {
      const res = await fetch(`/api/inbox/${item.id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snoozedUntil }),
      });
      if (res.ok) {
        setIsSnoozeOpen(false);
        onItemUpdated();
      }
    } catch {
      // ignore
    }
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      await fetch(`/api/inbox/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      onItemUpdated();
    } finally {
      setNotesSaving(false);
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { bg: '#450a0a', text: '#f87171', label: '🔥 Urgent' };
      case 'high':
        return { bg: '#431407', text: '#fb923c', label: '⚠️ High' };
      case 'normal':
        return { bg: '#1e293b', text: '#94a3b8', label: 'Normal' };
      case 'low':
        return { bg: '#0f172a', text: '#64748b', label: 'Low' };
      default:
        return { bg: '#1e293b', text: '#94a3b8', label: priority };
    }
  };

  const pri = getPriorityStyle(item.priority);
  const postContent =
    item.post?.rawPayload?.content ||
    item.post?.rawPayload?.commentary ||
    item.post?.rawPayload?.message ||
    item.notes ||
    'Post content unavailable';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#1e293b', color: '#f8fafc', padding: '1.5rem', overflowY: 'auto' }}>
      {/* Top Header / Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #334155', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                backgroundColor: pri.bg,
                color: pri.text,
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
              data-testid="item-priority-badge"
            >
              {pri.label}
            </span>
            <span
              style={{
                backgroundColor: '#0f172a',
                color: '#60a5fa',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {item.providerId}
            </span>
            <span
              style={{
                backgroundColor: item.status === 'resolved' ? '#064e3b' : '#334155',
                color: item.status === 'resolved' ? '#34d399' : '#cbd5e1',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
              data-testid="item-status-badge"
            >
              {item.status}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Received: {new Date(item.createdAt).toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {item.status !== 'resolved' && (
            <>
              <button
                onClick={() => setIsSnoozeOpen(!isSnoozeOpen)}
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #475569',
                  color: '#cbd5e1',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
                data-testid="snooze-action-btn"
              >
                💤 Snooze
              </button>
              <button
                onClick={handleResolve}
                style={{
                  backgroundColor: '#064e3b',
                  border: '1px solid #059669',
                  color: '#34d399',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                data-testid="resolve-action-btn"
              >
                ✓ Resolve
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.25rem',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Snooze Options Sub-panel */}
      {isSnoozeOpen && (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
          data-testid="snooze-panel"
        >
          <span style={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>Snooze for:</span>
          <select
            value={snoozeHours}
            onChange={(e) => setSnoozeHours(e.target.value)}
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '0.3rem 0.5rem',
              color: '#ffffff',
              fontSize: '0.8125rem',
            }}
          >
            <option value="1">1 Hour</option>
            <option value="4">4 Hours</option>
            <option value="24">Tomorrow (24 Hours)</option>
            <option value="72">Weekend (3 Days)</option>
          </select>
          <button
            onClick={handleSnooze}
            style={{
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            data-testid="confirm-snooze-btn"
          >
            Apply Snooze
          </button>
        </div>
      )}

      {/* Post Content Card */}
      <div
        style={{
          backgroundColor: '#0f172a',
          borderRadius: '10px',
          border: '1px solid #334155',
          padding: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>
          Original Post
        </h4>
        <p style={{ fontSize: '0.9375rem', lineHeight: 1.5, margin: '0 0 0.75rem 0', color: '#f8fafc' }} data-testid="post-content-body">
          {postContent}
        </p>

        {item.post && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px solid #1e293b', paddingTop: '0.5rem' }}>
            {item.post.sentiment && <div>Sentiment: <strong style={{ color: '#cbd5e1' }}>{item.post.sentiment}</strong></div>}
            {item.post.reach !== undefined && <div>Est. Reach: <strong style={{ color: '#cbd5e1' }}>{item.post.reach.toLocaleString()}</strong></div>}
          </div>
        )}
      </div>

      {/* Internal Notes */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#cbd5e1' }}>
            Triage & Team Notes
          </label>
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={notesSaving}
            style={{
              background: 'none',
              border: 'none',
              color: '#60a5fa',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {notesSaving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add internal notes or context for other agents..."
          rows={2}
          style={{
            width: '100%',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '0.5rem',
            color: '#ffffff',
            fontSize: '0.8125rem',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
          data-testid="inbox-notes-textarea"
        />
      </div>

      {/* Reply Composer */}
      {item.status !== 'resolved' && (
        <div style={{ marginTop: 'auto', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cbd5e1', margin: '0 0 0.5rem 0' }}>
            Send Public Reply
          </h4>

          {replyError && (
            <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', color: '#fca5a5', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
              {replyError}
            </div>
          )}

          {replySuccess && (
            <div style={{ backgroundColor: '#064e3b', border: '1px solid #059669', color: '#6ee7b7', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
              Reply sent & item resolved!
            </div>
          )}

          <form onSubmit={handleSendReply}>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply directly to this ${item.providerId} post...`}
              rows={3}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.75rem',
                color: '#ffffff',
                fontSize: '0.875rem',
                marginBottom: '0.5rem',
                resize: 'none',
                fontFamily: 'inherit',
              }}
              data-testid="reply-composer-textarea"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {replyText.length} chars · Replying as Connected Brand Account
              </span>
              <button
                type="submit"
                disabled={replyLoading || !replyText.trim()}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: replyLoading || !replyText.trim() ? 'not-allowed' : 'pointer',
                  opacity: replyLoading || !replyText.trim() ? 0.6 : 1,
                }}
                data-testid="send-reply-btn"
              >
                {replyLoading ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
