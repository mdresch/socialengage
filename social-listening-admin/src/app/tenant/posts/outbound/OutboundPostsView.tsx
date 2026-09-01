'use client';

import React, { useState, useEffect } from 'react';
import type { OutboundActivityItem } from '@/lib/core-client';
import { OutboundComposerModal } from '@/components/composer/OutboundComposerModal';

const STATUS_TABS = [
  { id: 'all', label: 'All Activities' },
  { id: 'scheduled', label: 'Scheduled 🕒' },
  { id: 'published', label: 'Published ✅' },
  { id: 'failed', label: 'Failed ❌' },
  { id: 'cancelled', label: 'Cancelled 🚫' },
];

export function OutboundPostsView() {
  const [posts, setPosts] = useState<OutboundActivityItem[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer Modal state
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // Reschedule Modal state
  const [reschedulingPost, setReschedulingPost] = useState<OutboundActivityItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [reschedulingLoading, setReschedulingLoading] = useState(false);
  const [reschedulingError, setReschedulingError] = useState<string | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        selectedStatus === 'all'
          ? '/api/outbound/posts'
          : `/api/outbound/posts?status=${selectedStatus}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch outbound posts: ${res.status}`);
      }
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err: any) {
      setError(err.message || 'Error loading posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [selectedStatus]);

  const handleCancelActivity = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled post?')) return;
    try {
      const res = await fetch(`/api/outbound/activities/${id}/cancel`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to cancel');
      }
      await fetchPosts();
    } catch (err: any) {
      alert(`Error cancelling post: ${err.message}`);
    }
  };

  const handleOpenReschedule = (post: OutboundActivityItem) => {
    setReschedulingPost(post);
    setReschedulingError(null);

    const baseDate = post.scheduledFor ? new Date(post.scheduledFor) : new Date(Date.now() + 86400000);
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    const hours = String(baseDate.getHours()).padStart(2, '0');
    const minutes = String(baseDate.getMinutes()).padStart(2, '0');

    setRescheduleDate(`${year}-${month}-${day}`);
    setRescheduleTime(`${hours}:${minutes}`);
  };

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingPost) return;

    if (!rescheduleDate || !rescheduleTime) {
      setReschedulingError('Please choose date and time.');
      return;
    }

    const combined = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
    if (isNaN(combined.getTime()) || combined.getTime() <= Date.now()) {
      setReschedulingError('Please choose a future date and time.');
      return;
    }

    setReschedulingLoading(true);
    try {
      const res = await fetch(`/api/outbound/activities/${reschedulingPost.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: combined.toISOString() }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to reschedule');
      }

      setReschedulingPost(null);
      await fetchPosts();
    } catch (err: any) {
      setReschedulingError(err.message || 'Error rescheduling post');
    } finally {
      setReschedulingLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span style={{ backgroundColor: '#1e3a5f', color: '#60a5fa', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
            Scheduled
          </span>
        );
      case 'publishing':
        return (
          <span style={{ backgroundColor: '#422006', color: '#facc15', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
            Publishing
          </span>
        );
      case 'published':
      case 'sent':
        return (
          <span style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
            Published
          </span>
        );
      case 'failed':
        return (
          <span style={{ backgroundColor: '#450a0a', color: '#f87171', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span style={{ backgroundColor: '#334155', color: '#94a3b8', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
            Cancelled
          </span>
        );
      default:
        return (
          <span style={{ backgroundColor: '#334155', color: '#cbd5e1', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem' }}>
            {status}
          </span>
        );
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
            Outbound Publishing & Scheduling
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
            Monitor outbound publishing queues, manage scheduled campaigns, and dispatch updates across connected networks.
          </p>
        </div>
        <button
          onClick={() => setIsComposerOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.625rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          data-testid="create-post-btn"
        >
          <span>✍️</span> Compose Post
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedStatus(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: selectedStatus === tab.id ? '#3b82f6' : '#1e293b',
              color: selectedStatus === tab.id ? '#ffffff' : '#94a3b8',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            data-testid={`filter-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Posts Table / Queue */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          Loading outbound queue...
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 0.25rem 0' }}>
            No outbound posts found
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
            There are currently no posts matching the selected status filter.
          </p>
          <button
            onClick={() => setIsComposerOpen(true)}
            style={{
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Create your first post
          </button>
        </div>
      ) : (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Content</th>
                <th style={{ padding: '0.75rem 1rem' }}>Platform</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Schedule / Published</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  style={{ borderBottom: '1px solid #334155', verticalAlign: 'middle' }}
                  data-testid={`outbound-row-${post.id}`}
                >
                  <td style={{ padding: '1rem', maxWidth: '350px' }}>
                    <div style={{ color: '#f8fafc', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {post.body}
                    </div>
                    {post.externalUrl && (
                      <a
                        href={post.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'none', display: 'inline-block', marginTop: '0.25rem' }}
                      >
                        View on Platform ↗
                      </a>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{post.providerId}</span>
                    </div>
                    {post.targetAssetId && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Target: {post.targetAssetId}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {getStatusBadge(post.status)}
                    {post.errorCode && (
                      <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.25rem' }}>
                        {post.errorCode}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.8125rem' }}>
                    {post.scheduledFor ? (
                      <div>
                        <div>Scheduled: {new Date(post.scheduledFor).toLocaleString()}</div>
                      </div>
                    ) : post.publishedAt ? (
                      <div>Published: {new Date(post.publishedAt).toLocaleString()}</div>
                    ) : (
                      <div>Created: {new Date(post.createdAt).toLocaleString()}</div>
                    )}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {post.status === 'scheduled' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleOpenReschedule(post)}
                          style={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #475569',
                            color: '#93c5fd',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                          data-testid={`reschedule-btn-${post.id}`}
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancelActivity(post.id)}
                          style={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #7f1d1d',
                            color: '#f87171',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                          data-testid={`cancel-btn-${post.id}`}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outbound Composer Modal */}
      <OutboundComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onPostCreated={fetchPosts}
      />

      {/* Reschedule Modal */}
      {reschedulingPost && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              border: '1px solid #334155',
              width: '100%',
              maxWidth: '440px',
              padding: '1.25rem',
              color: '#f8fafc',
            }}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
              Reschedule Post
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
              Select a new date and time to dispatch this scheduled update.
            </p>

            {reschedulingError && (
              <div style={{ backgroundColor: '#450a0a', border: '1px solid #dc2626', color: '#fca5a5', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8125rem' }}>
                {reschedulingError}
              </div>
            )}

            <form onSubmit={handleSaveReschedule}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                    New Date
                  </label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', padding: '0.4rem 0.5rem', color: '#ffffff', fontSize: '0.8125rem' }}
                    data-testid="reschedule-date-input"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                    New Time
                  </label>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', padding: '0.4rem 0.5rem', color: '#ffffff', fontSize: '0.8125rem' }}
                    data-testid="reschedule-time-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setReschedulingPost(null)}
                  style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.8125rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reschedulingLoading}
                  style={{ padding: '0.4rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: '#ffffff', cursor: reschedulingLoading ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
                  data-testid="confirm-reschedule-btn"
                >
                  {reschedulingLoading ? 'Updating...' : 'Update Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
