import {
  SourceItem,
  AuthorItem,
  PostItem,
  LanguageItem,
  TopicItem,
  RuleItem,
  ProfileItem,
  AlertItem,
  GeoLocationItem,
} from '../types';

export const INITIAL_SOURCES: SourceItem[] = [
  { name: 'Twitter/X', color: '#1D9BF0', count: 4820, authors: 2140, reach: '1.9M', index: 38, pos: 54, neu: 30, neg: 16, trend: '+21%' },
  { name: 'LinkedIn', color: '#0A66C2', count: 2140, authors: 1180, reach: '820K', index: 66, pos: 71, neu: 24, neg: 5, trend: '+14%' },
  { name: 'News', color: '#7C3AED', count: 1310, authors: 410, reach: '3.4M', index: 39, pos: 49, neu: 41, neg: 10, trend: '+8%' },
  { name: 'Blogs', color: '#F59E0B', count: 940, authors: 360, reach: '610K', index: 58, pos: 66, neu: 26, neg: 8, trend: '−3%' },
  { name: 'Forums', color: '#10B981', count: 610, authors: 290, reach: '140K', index: 15, pos: 38, neu: 39, neg: 23, trend: '+6%' },
  { name: 'YouTube', color: '#EF4444', count: 380, authors: 96, reach: '980K', index: 16, pos: 44, neu: 28, neg: 28, trend: '−9%' },
];

export const INITIAL_POSTS: PostItem[] = [
  { author: 'Dana Whitfield', handle: '@danabuilds', time: '12m', source: 'Twitter/X', sentiment: 'Positive', text: 'SocialEngage picked up a spike in ADPA mentions three hours before our own dashboards did. Genuinely impressive listening pipeline.', shares: 42, likes: 318, initials: 'DW', avatarBg: '#2563EB' },
  { author: 'Marcus Ilori', handle: '@m_ilori', time: '48m', source: 'LinkedIn', sentiment: 'Neutral', text: 'Adaptive Digital Processing Analytics is an odd name but the sentiment scoring model is doing real work here. Writing up a comparison.', shares: 11, likes: 96, initials: 'MI', avatarBg: '#7C3AED' },
  { author: 'Tech Ledger', handle: 'News', time: '2h', source: 'News', sentiment: 'Positive', text: 'ADPA expands SocialEngage with AI-driven intention detection, targeting teams that lost their social listening stack.', shares: 205, likes: 640, initials: 'TL', avatarBg: '#0F172A' },
  { author: 'Priya Raghavan', handle: '@praghavan', time: '3h', source: 'Twitter/X', sentiment: 'Negative', text: 'Onboarding for SocialEngage took longer than advertised — the profile authorisation step timed out twice for us.', shares: 8, likes: 54, initials: 'PR', avatarBg: '#EF4444' },
  { author: 'OpsRoom Forum', handle: 'thread #4821', time: '5h', source: 'Forums', sentiment: 'Neutral', text: "Anyone benchmarked SocialEngage's AI topic clustering against the old rules-based setup? Curious about recall on niche keywords.", shares: 3, likes: 27, initials: 'OF', avatarBg: '#10B981' },
  { author: 'Elena Sørensen', handle: '@elenasoren', time: '7h', source: 'Blogs', sentiment: 'Positive', text: 'Wrote 2,000 words on why AI-assisted social listening finally works. SocialEngage is the example I keep coming back to.', shares: 61, likes: 412, initials: 'ES', avatarBg: '#F59E0B' },
  { author: 'Jonah Kessler', handle: '@jkessler', time: '9h', source: 'YouTube', sentiment: 'Negative', text: 'Walkthrough video up. The analytics are strong, the alert configuration UI still needs work.', shares: 19, likes: 143, initials: 'JK', avatarBg: '#DC2626' },
  { author: 'Aisha Bello', handle: '@aishab', time: '11h', source: 'LinkedIn', sentiment: 'Positive', text: 'Our team replaced three tools with SocialEngage. The location view alone justified the switch for regional campaign planning.', shares: 34, likes: 287, initials: 'AB', avatarBg: '#0A66C2' },
];

export const AUTHORS_LIST: AuthorItem[] = [
  { name: 'Dana Whitfield', initials: 'DW', avatarBg: '#2563EB', count: 412, source: 'Twitter/X' },
  { name: 'Elena Sørensen', initials: 'ES', avatarBg: '#F59E0B', count: 288, source: 'Blogs' },
  { name: 'Aisha Bello', initials: 'AB', avatarBg: '#0A66C2', count: 241, source: 'LinkedIn' },
  { name: 'Marcus Ilori', initials: 'MI', avatarBg: '#7C3AED', count: 196, source: 'LinkedIn' },
  { name: 'Jonah Kessler', initials: 'JK', avatarBg: '#DC2626', count: 154, source: 'YouTube' },
];

export const LANGUAGES: LanguageItem[] = [
  { name: 'English', count: 6120 },
  { name: 'Dutch', count: 1310 },
  { name: 'German', count: 940 },
  { name: 'French', count: 610 },
];

export const BUZZ_DATA = [38, 44, 41, 52, 49, 63, 58, 71, 66, 84, 79, 92, 88, 74, 81, 95, 103, 97, 112, 106, 124, 118, 131, 127, 142, 136, 151, 147, 158, 166];

export const TOPICS: TopicItem[] = [
  { name: 'SocialEngage · AI · ADPA', rules: 6, volume: '9,240' },
  { name: 'Competitor watch', rules: 3, volume: '2,110' },
  { name: 'Brand mentions — EU', rules: 4, volume: '1,480' },
  { name: 'Product launch buzz', rules: 2, volume: '640' },
];

export const INITIAL_RULES: RuleItem[] = [
  { type: 'Keyword', text: '"SocialEngage" OR "adaptive analytics"', scope: 'All sources' },
  { type: 'Keyword', text: '"ADPA" AND "social listening"', scope: 'All sources' },
  { type: 'Hashtag', text: '#SocialEngage', scope: 'Twitter/X, LinkedIn' },
  { type: 'Account', text: '@socialengage mentions', scope: 'Twitter/X' },
  { type: 'Boolean', text: '"SocialEngage" NOT "job posting"', scope: 'News, Blogs' },
  { type: 'Keyword', text: '"AI listening" OR "intention detection"', scope: 'All sources' },
];

export const PROFILES: ProfileItem[] = [
  { name: 'SocialEngage HQ', handle: '@socialengage', source: 'Twitter/X', color: '#1D9BF0', initial: 'T', status: 'Connected', statusBg: '#ECFDF5', statusFg: '#047857' },
  { name: 'SocialEngage Company', handle: 'linkedin.com/company/socialengage', source: 'LinkedIn', color: '#0A66C2', initial: 'L', status: 'Connected', statusBg: '#ECFDF5', statusFg: '#047857' },
  { name: 'ADPA Support', handle: '@adpasupport', source: 'Twitter/X', color: '#1D9BF0', initial: 'T', status: 'Needs auth', statusBg: '#FEF2F2', statusFg: '#B91C1C' },
];

export const ADDABLE_SOURCES = [
  { name: 'Facebook Page', color: '#1877F2', initial: 'F' },
  { name: 'Instagram Business', color: '#DD2A7B', initial: 'I' },
  { name: 'YouTube Channel', color: '#EF4444', initial: 'Y' },
];

export const ALERTS: AlertItem[] = [
  { id: '1', title: 'Spike in negative sentiment', detail: 'Onboarding friction mentions up 41% in the last 6 hours', color: '#EF4444', time: '14m ago' },
  { id: '2', title: 'New high-influence author', detail: '@techledger (280K followers) posted about SocialEngage', color: '#2563EB', time: '1h ago' },
  { id: '3', title: 'Volume threshold reached', detail: 'SocialEngage · AI · ADPA topic crossed 9,000 posts this period', color: '#F59E0B', time: '3h ago' },
  { id: '4', title: 'Competitor mention spike', detail: 'Comparison thread trending on LinkedIn', color: '#7C3AED', time: '6h ago' },
  { id: '5', title: 'Positive sentiment milestone', detail: 'Sentiment index reached +45 for the week', color: '#10B981', time: '1d ago' },
];

export const GEO_LOCATIONS: GeoLocationItem[] = [
  { name: 'United States', v: 3120, x: 22, y: 40 },
  { name: 'United Kingdom', x: 43, y: 26, v: 1480 },
  { name: 'Netherlands', x: 52, y: 18, v: 1240 },
  { name: 'Germany', x: 56, y: 33, v: 980 },
  { name: 'India', x: 68, y: 51, v: 860 },
  { name: 'Brazil', x: 32, y: 70, v: 540 },
  { name: 'Japan', x: 84, y: 40, v: 420 },
  { name: 'Australia', x: 84, y: 76, v: 310 },
  { name: 'Canada', x: 21, y: 24, v: 290 },
];

export const PHRASE_WORDS = [
  'adaptive analytics', 'AI listening', 'sentiment model', 'SocialEngage', 'ADPA',
  'intention detection', 'topic clustering', 'real-time alerts', 'brand health',
  'social CRM', 'data pipeline', 'share of voice', 'campaign lift', 'API access'
];
