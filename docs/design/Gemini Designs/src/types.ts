export type ScreenType =
  | 'overview'
  | 'conversations'
  | 'sentiment'
  | 'location'
  | 'sources'
  | 'post-detail'
  | 'social-center'
  | 'activity-map'
  | 'search-setup'
  | 'alerts'
  | 'settings';

export type AuthViewType = 'login' | 'signup' | 'forgot' | 'reset' | 'mfa' | null;

export type SentimentType = 'Positive' | 'Neutral' | 'Negative';

export interface SourceItem {
  name: string;
  color: string;
  count: number;
  authors?: number;
  reach?: string;
  index?: number;
  pos?: number;
  neu?: number;
  neg?: number;
  trend?: string;
}

export interface AuthorItem {
  name: string;
  initials: string;
  avatarBg: string;
  count: number;
  source: string;
}

export interface PostItem {
  author: string;
  handle: string;
  time: string;
  source: string;
  sentiment: SentimentType;
  text: string;
  shares: number;
  likes: number;
  initials: string;
  avatarBg: string;
}

export interface LanguageItem {
  name: string;
  count: number;
}

export interface TopicItem {
  name: string;
  rules: number;
  volume: string;
}

export interface RuleItem {
  type: 'Keyword' | 'Hashtag' | 'Account' | 'Boolean';
  text: string;
  scope: string;
}

export interface ProfileItem {
  name: string;
  handle: string;
  source: string;
  color: string;
  initial: string;
  status: string;
  statusBg: string;
  statusFg: string;
}

export interface AlertItem {
  id: string;
  title: string;
  detail: string;
  color: string;
  time: string;
}

export interface GeoLocationItem {
  name: string;
  v: number;
  x: number;
  y: number;
}

export interface ThreadMessage {
  author: string;
  initials: string;
  avatarBg: string;
  time: string;
  text: string;
}
