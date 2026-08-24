'use client';

import { useState, useEffect, useMemo } from 'react';
import type { OutboundActivity } from '@/lib/core-client';

export interface PostRepliesTabProps {
  postId: string;
  initialReplies?: OutboundActivity[];
  optimisticReplies?: OutboundActivity[];
  refreshToken?: number;
}

export function PostRepliesTab({
  postId,
  initialReplies,
  optimisticReplies,
  refreshToken,
}: PostRepliesTabProps) {
  const [replies, setReplies] = useState<OutboundActivity[] | undefined>(initialReplies);
  const [loading, setLoading] = useState(initialReplies === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialReplies !== undefined) {
      setReplies(initialReplies);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/posts/${encodeURIComponent(postId)}/replies`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load replies: ${res.status}`);
        return res.json();
      })
      .then((data: { replies?: OutboundActivity[] }) => {
        if (!cancelled) {
          setReplies(data.replies || []);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load replies.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [postId, initialReplies, refreshToken]);

  const allReplies = useMemo(() => {
    const base = replies ?? [];
    const baseIds = new Set(base.map((r) => r.id));
    const extras = (optimisticReplies || []).filter((r) => !baseIds.has(r.id));
    return [...extras, ...base];
  }, [replies, optimisticReplies]);

  if (loading) {
    return <div className="replies-tab-empty">Loading...</div>;
  }

  if (error) {
    return (
      <div className="replies-tab-error" role="alert">
        {error}
      </div>
    );
  }

  if (allReplies.length === 0) {
    return <div className="replies-tab-empty">No replies yet.</div>;
  }

  return (
    <ul className="replies-tab-list">
      {allReplies.map((reply) => (
        <li key={reply.id} className="replies-tab-row">
          <p className="replies-tab-body">{reply.body}</p>
          <div className="replies-tab-meta">
            <span className={`replies-tab-status replies-tab-status-${reply.status}`}>
              {reply.status}
            </span>
            <time className="replies-tab-time" dateTime={reply.createdAt}>
              {new Date(reply.createdAt).toLocaleString()}
            </time>
          </div>
          {reply.status === 'sent' && reply.externalUrl && (
            <a
              href={reply.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="replies-tab-link"
            >
              View live reply
            </a>
          )}
          {reply.status === 'failed' && reply.errorCode && (
            <span className="replies-tab-error-code">{reply.errorCode}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
