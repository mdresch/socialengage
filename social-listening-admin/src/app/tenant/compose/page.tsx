'use client';

import { PolypostComposer } from '@/components/composer';

export default function ComposePage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-8)' }}>
      {/* Page Header */}
      <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              background: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--color-accent)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Polypost Studio
          </span>
        </div>
        <h1 className="page-title" style={{ margin: 0 }}>
          Create &amp; Cross-Publish Post
        </h1>
        <p className="page-subtitle" style={{ margin: 'var(--space-1) 0 0' }}>
          Draft your message once, inspect live native preview rails, and dispatch simultaneously to all connected channels.
        </p>
      </div>

      {/* Main Composer & Rails Workspace */}
      <PolypostComposer />
    </div>
  );
}
