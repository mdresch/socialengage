export type SupportedPlatform = 'linkedin' | 'instagram' | 'facebook' | 'twitter' | 'threads' | 'bluesky';

export interface PlatformConfig {
  id: SupportedPlatform;
  name: string;
  maxChars: number;
  maxMedia: number;
  supportsCarousel: boolean;
  color: string;
  badgeBg: string;
  iconName: string;
  defaultAuthor: {
    name: string;
    handle: string;
    avatarUrl?: string;
    headline?: string;
  };
}

export const PLATFORM_CONFIGS: Record<SupportedPlatform, PlatformConfig> = {
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    maxChars: 3000,
    maxMedia: 9,
    supportsCarousel: true,
    color: '#0a66c2',
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    iconName: 'linkedin',
    defaultAuthor: {
      name: 'Menno Drescher',
      handle: '@menno-drescher',
      headline: 'Founder & Lead Architect • SocialEngage',
    },
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    maxChars: 2200,
    maxMedia: 10,
    supportsCarousel: true,
    color: '#e1306c',
    badgeBg: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800',
    iconName: 'instagram',
    defaultAuthor: {
      name: 'SocialEngage Official',
      handle: '@socialengage.app',
    },
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    maxChars: 63206,
    maxMedia: 10,
    supportsCarousel: true,
    color: '#1877f2',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    iconName: 'facebook',
    defaultAuthor: {
      name: 'SocialEngage Page',
      handle: '@socialengage',
    },
  },
  twitter: {
    id: 'twitter',
    name: 'X (Twitter)',
    maxChars: 280,
    maxMedia: 4,
    supportsCarousel: false,
    color: '#000000',
    badgeBg: 'bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700',
    iconName: 'twitter',
    defaultAuthor: {
      name: 'SocialEngage',
      handle: '@socialengage',
    },
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    maxChars: 500,
    maxMedia: 10,
    supportsCarousel: true,
    color: '#000000',
    badgeBg: 'bg-stone-100 text-stone-900 border-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:border-stone-700',
    iconName: 'threads',
    defaultAuthor: {
      name: 'SocialEngage',
      handle: '@socialengage',
    },
  },
  bluesky: {
    id: 'bluesky',
    name: 'Bluesky',
    maxChars: 300,
    maxMedia: 4,
    supportsCarousel: false,
    color: '#0085ff',
    badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
    iconName: 'bluesky',
    defaultAuthor: {
      name: 'SocialEngage',
      handle: '@socialengage.bsky.social',
    },
  },
};

export interface MediaAttachment {
  id: string;
  url: string;
  altText?: string;
  type: 'image' | 'video';
}

export interface PlatformOverride {
  text?: string;
  media?: MediaAttachment[];
}

export interface ComposerState {
  mainText: string;
  selectedPlatforms: SupportedPlatform[];
  media: MediaAttachment[];
  platformOverrides: Partial<Record<SupportedPlatform, PlatformOverride>>;
  activePreviewTab?: SupportedPlatform;
  scheduleDate?: string;
}
