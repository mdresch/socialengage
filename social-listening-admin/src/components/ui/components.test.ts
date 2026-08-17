import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import {
  StatusBadge,
  ConfirmModal,
  Slideover,
  TagInput,
  EmptyState,
  InlineError,
  RelativeTime,
  formatRelativeTime,
} from './index';

describe('UI Component Primitives (Design Spec §6)', () => {
  describe('StatusBadge (§6.1)', () => {
    it('renders healthy status with default label', () => {
      const html = renderToStaticMarkup(React.createElement(StatusBadge, { variant: 'healthy' }));
      expect(html).toContain('status-badge-healthy');
      expect(html).toContain('Healthy');
      expect(html).toContain('aria-hidden="true"');
    });

    it('renders custom label overriding default', () => {
      const html = renderToStaticMarkup(
        React.createElement(StatusBadge, { variant: 'failing', label: 'Connector Down' })
      );
      expect(html).toContain('status-badge-failing');
      expect(html).toContain('Connector Down');
    });

    it('supports all defined variants', () => {
      const variants = [
        'healthy',
        'degraded',
        'failing',
        'active',
        'suspended',
        'inactive',
        'verified',
        'pending',
      ] as const;

      for (const variant of variants) {
        const html = renderToStaticMarkup(React.createElement(StatusBadge, { variant }));
        expect(html).toContain(`status-badge-${variant}`);
      }
    });
  });

  describe('ConfirmModal (§6.2)', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        React.createElement(ConfirmModal, {
          isOpen: false,
          title: 'Delete Watchlist',
          body: 'This action is irreversible.',
          confirmLabel: 'Delete',
          onConfirm: () => {},
          onCancel: () => {},
        })
      );
      expect(html).toBe('');
    });

    it('renders accessible dialog structure when isOpen is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(ConfirmModal, {
          isOpen: true,
          title: 'Delete Watchlist',
          body: 'This action is irreversible.',
          confirmLabel: 'Delete',
          confirmVariant: 'destructive',
          onConfirm: () => {},
          onCancel: () => {},
        })
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="confirm-modal-title"');
      expect(html).toContain('Delete Watchlist');
      expect(html).toContain('This action is irreversible.');
      expect(html).toContain('modal-btn-destructive');
    });
  });

  describe('Slideover (§6.3)', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        React.createElement(Slideover, {
          isOpen: false,
          title: 'New Watchlist',
          onClose: () => {},
          children: React.createElement('p', null, 'Form content'),
        })
      );
      expect(html).toBe('');
    });

    it('renders accessible drawer panel when isOpen is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(Slideover, {
          isOpen: true,
          title: 'New Watchlist',
          onClose: () => {},
          width: 'lg',
          children: React.createElement('p', null, 'Form content'),
        })
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="slideover-title"');
      expect(html).toContain('slideover-lg');
      expect(html).toContain('New Watchlist');
      expect(html).toContain('Form content');
    });
  });

  describe('TagInput (§6.4)', () => {
    it('renders existing tags as removable chips', () => {
      const html = renderToStaticMarkup(
        React.createElement(TagInput, {
          values: ['microsoft', 'social', 'azure'],
          onChange: () => {},
        })
      );
      expect(html).toContain('microsoft');
      expect(html).toContain('social');
      expect(html).toContain('azure');
      expect(html).toContain('aria-label="Remove microsoft"');
      expect(html).toContain('tag-chip');
    });

    it('renders empty placeholder when no tags present', () => {
      const html = renderToStaticMarkup(
        React.createElement(TagInput, {
          values: [],
          onChange: () => {},
          placeholder: 'Type a keyword…',
        })
      );
      expect(html).toContain('placeholder="Type a keyword…"');
    });
  });

  describe('EmptyState (§6.5)', () => {
    it('renders heading, description, and action button', () => {
      const html = renderToStaticMarkup(
        React.createElement(EmptyState, {
          heading: 'No watchlists yet',
          body: 'Create your first watchlist to start monitoring.',
          action: { label: 'New Watchlist', onClick: () => {} },
        })
      );
      expect(html).toContain('No watchlists yet');
      expect(html).toContain('Create your first watchlist to start monitoring.');
      expect(html).toContain('New Watchlist');
    });
  });

  describe('InlineError (§6.6)', () => {
    it('renders error message with role="alert"', () => {
      const html = renderToStaticMarkup(
        React.createElement(InlineError, {
          message: 'Invalid API key provided.',
        })
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('Invalid API key provided.');
    });

    it('returns null when message is empty or null', () => {
      const html = renderToStaticMarkup(React.createElement(InlineError, { message: null }));
      expect(html).toBe('');
    });
  });

  describe('RelativeTime (§6.7)', () => {
    it('renders time element with ISO date in title and dateTime attributes', () => {
      const iso = '2026-08-14T08:00:00Z';
      const html = renderToStaticMarkup(React.createElement(RelativeTime, { timestamp: iso }));
      expect(html).toContain(`dateTime="${iso}"`);
      expect(html).toContain(`title="${iso}"`);
    });

    it('renders fallback when timestamp is null', () => {
      const html = renderToStaticMarkup(
        React.createElement(RelativeTime, { timestamp: null, fallback: 'never' })
      );
      expect(html).toContain('never');
    });

    it('formats relative durations accurately', () => {
      const now = new Date();
      expect(formatRelativeTime(now.toISOString())).toBe('just now');

      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      expect(formatRelativeTime(tenMinutesAgo.toISOString())).toBe('10m ago');

      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeHoursAgo.toISOString())).toBe('3h ago');
    });
  });
});
