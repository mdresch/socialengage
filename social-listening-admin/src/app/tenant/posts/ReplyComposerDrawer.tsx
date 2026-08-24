'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { countCharacters } from '@/components/composer/lib/counting';
import { PLATFORM_CONFIGS, type SupportedPlatform } from '@/components/composer/types';
import type { PostDetailPanelPost } from './PostDetailPanel';

export interface ReplyComposerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  post: PostDetailPanelPost;
  onSubmit: (body: string) => Promise<void>;
}

export function ReplyComposerDrawer({
  isOpen,
  onClose,
  post,
  onSubmit,
}: ReplyComposerDrawerProps) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const drawerRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timeout = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearTimeout(timeout);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const platform = post.provider as SupportedPlatform;
  const platformConfig = PLATFORM_CONFIGS[platform];
  const maxChars = platformConfig?.maxChars ?? 2000;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !body.trim()) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await onSubmit(body.trim());
      setBody('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send reply.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="reply-composer-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reply-composer-title"
      ref={drawerRef}
    >
      <div className="reply-composer-drawer-header">
        <div>
          <button
            type="button"
            className="reply-composer-back-btn"
            onClick={onClose}
            aria-label="Back to post details"
          >
            ← Back to Details
          </button>
          <h2 id="reply-composer-title" className="reply-composer-drawer-title">
            Reply to Post
          </h2>
          <p className="reply-composer-drawer-subtitle">
            Post ID: <code>{post.id}</code>
          </p>
        </div>
        <button
          ref={firstFocusableRef}
          type="button"
          className="slideover-close-btn"
          onClick={onClose}
          aria-label="Close reply composer"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="reply-composer-drawer-content">
        {errorMsg && (
          <div role="alert" className="pf-edit-error-banner">
            {errorMsg}
          </div>
        )}

        <div className="pf-edit-section">
          <div className="pf-edit-label-row">
            <label htmlFor="reply-body" className="pf-edit-label">
              Reply
            </label>
            <span className="pf-edit-char-count">
              {countCharacters(body)}/{maxChars}
            </span>
          </div>
          <textarea
            id="reply-body"
            name="replyBody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a reply..."
            maxLength={maxChars}
            rows={6}
            className="pf-edit-textarea"
            aria-label="Reply body"
          />
        </div>

        <div className="reply-composer-drawer-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="pf-edit-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="pf-edit-save-btn"
          >
            {submitting ? 'Sending...' : 'Send Reply'}
          </button>
        </div>
      </form>
    </div>
  );
}
