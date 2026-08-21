'use client';

import type { LinkPreviewData } from '@/app/api/composer/link-preview/route';

interface CardLinkPreviewProps {
  data: LinkPreviewData;
  onRemove?: () => void;
}

export function CardLinkPreview({ data, onRemove }: CardLinkPreviewProps) {
  return (
    <div
      style={{
        marginTop: 'var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 10,
            width: 20,
            height: 20,
            borderRadius: 'var(--radius-full)',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            border: 'none',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Remove link card"
        >
          ×
        </button>
      )}

      {data.image && (
        <div style={{ maxHeight: 140, overflow: 'hidden', background: '#000' }}>
          <img
            src={data.image}
            alt={data.title}
            style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div style={{ padding: '6px 10px' }}>
        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {data.siteName || data.hostname}
        </div>
        <div
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--color-text)',
            lineHeight: 1.3,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.title}
        </div>
        {data.description && (
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              margin: '2px 0 0',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {data.description}
          </p>
        )}
      </div>
    </div>
  );
}
