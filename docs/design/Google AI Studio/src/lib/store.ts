import {
  Tenant,
  Connector,
  Watchlist,
  Post,
  TenantUser,
  InviteAssistCandidate,
  PlatformAdminAuditLog,
  BreakGlassRequest,
  DbHealth,
  UserSession,
} from '../types';

export const STORAGE_KEY = 'socialengage_state_v1';

export interface AppState {
  currentSession: UserSession;
  tenants: Tenant[];
  connectors: Record<string, Connector[]>; // keyed by tenantId
  watchlists: Record<string, Watchlist[]>; // keyed by tenantId
  posts: Record<string, Post[]>; // keyed by tenantId
  tenantUsers: Record<string, TenantUser[]>; // keyed by tenantId
  inviteCandidates: Record<string, InviteAssistCandidate[]>; // keyed by tenantId
  auditLogs: PlatformAdminAuditLog[];
  breakGlassRequests: BreakGlassRequest[];
  dbHealth: DbHealth;
}

const DEFAULT_TENANT_ID = 'ten-acme-9921';
const CONTOSO_TENANT_ID = 'ten-contoso-4412';
const TAILWIND_TENANT_ID = 'ten-tailwind-8831';

export const INITIAL_SESSIONS: Record<string, UserSession> = {
  tenant_admin: {
    id: 'usr-admin-01',
    name: 'Sarah Chen',
    email: 'sarah.chen@acme-global.com',
    role: 'tenant_admin',
    tenantId: DEFAULT_TENANT_ID,
    tenantName: 'Acme Global Operations',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    isAuthenticated: true,
  },
  tenant_user: {
    id: 'usr-analyst-02',
    name: 'Marcus Vance',
    email: 'marcus.vance@acme-global.com',
    role: 'tenant_user',
    tenantId: DEFAULT_TENANT_ID,
    tenantName: 'Acme Global Operations',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    isAuthenticated: true,
  },
  platform_admin: {
    id: 'usr-plat-09',
    name: 'Alex Rivera',
    email: 'alex.rivera@socialengage.platform',
    role: 'platform_admin',
    tenantId: null,
    tenantName: null,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isAuthenticated: true,
  },
  unauthenticated: {
    id: '',
    name: 'Anonymous',
    email: '',
    role: 'unauthenticated',
    tenantId: null,
    tenantName: null,
    isAuthenticated: false,
  },
};

const INITIAL_TENANTS: Tenant[] = [
  {
    id: DEFAULT_TENANT_ID,
    name: 'Acme Global Operations',
    domain: 'acme-global.com',
    status: 'Active',
    activeSeats: 6,
    licenseSeats: 12,
    createdAt: '2026-01-15T08:30:00Z',
  },
  {
    id: CONTOSO_TENANT_ID,
    name: 'Contoso Retail Corp',
    domain: 'contoso.com',
    status: 'Active',
    activeSeats: 18,
    licenseSeats: 25,
    createdAt: '2026-02-01T11:00:00Z',
  },
  {
    id: TAILWIND_TENANT_ID,
    name: 'Tailwind Traders Inc',
    domain: 'tailwindtraders.io',
    status: 'Suspended',
    activeSeats: 4,
    licenseSeats: 5,
    createdAt: '2026-03-10T14:20:00Z',
  },
];

const INITIAL_CONNECTORS: Record<string, Connector[]> = {
  [DEFAULT_TENANT_ID]: [
    {
      id: 'conn-gnews-01',
      platformId: 'gnews',
      name: 'GNews API Ingestion',
      category: 'Ingestion',
      description: 'Real-time global news article ingestion matching targeted brand terms and industry topics.',
      status: 'healthy',
      isActive: true,
      lastSuccessfulFetch: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      lastAttempt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      consecutiveFailures: 0,
      config: {
        apiKeyMasked: 'gn_live_••••••••••••942a',
      },
    },
    {
      id: 'conn-newswire-02',
      platformId: 'newswire',
      name: 'Global Newswire Feeds',
      category: 'Ingestion',
      description: 'Syndicated corporate press release feeds and media announcements (Public source).',
      status: 'healthy',
      isActive: true,
      lastSuccessfulFetch: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      lastAttempt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      consecutiveFailures: 0,
    },
    {
      id: 'conn-azure-lang-03',
      platformId: 'azure_ai_language',
      name: 'Azure AI Language Service',
      category: 'AI Enrichment',
      description: 'Named Entity Recognition (NER), Sentiment scoring, and Key Phrase extraction.',
      status: 'healthy',
      isActive: true,
      lastSuccessfulFetch: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      lastAttempt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      consecutiveFailures: 0,
      config: {
        endpoint: 'https://acme-language-prod.cognitiveservices.azure.com/',
        apiKeyMasked: 'az_lang_••••••••••••b81e',
        region: 'westeurope',
      },
    },
    {
      id: 'conn-azure-oai-04',
      platformId: 'azure_openai',
      name: 'Azure OpenAI Service',
      category: 'AI Enrichment',
      description: 'GPT-4o powered contextual brand sentiment reasoning and executive summarization.',
      status: 'degraded',
      isActive: true,
      lastSuccessfulFetch: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
      lastAttempt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      consecutiveFailures: 2,
      config: {
        endpoint: 'https://acme-openai-res.openai.azure.com/',
        deploymentName: 'gpt-4o-listening-prod',
        apiKeyMasked: 'aoai_••••••••••••77fa',
      },
    },
    {
      id: 'conn-tenant-feed-05',
      platformId: 'tenant_owned_feed',
      name: 'Tenant-Owned Feed (Acme Newsroom)',
      category: 'Custom Feed',
      description: 'Verified first-party domain RSS/Atom feed ingestion with DNS TXT validation.',
      status: 'healthy',
      isActive: true,
      lastSuccessfulFetch: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      lastAttempt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      consecutiveFailures: 0,
      config: {
        customDomain: 'news.acme-global.com',
        feedUrl: 'https://news.acme-global.com/rss/all-updates.xml',
        dnsTxtHost: '_socialengage-challenge.news.acme-global.com',
        dnsTxtValue: 'se-verify-8f92a10b4c2e',
        dnsVerified: true,
        activationId: 'act-acme-domain-8812',
      },
    },
    {
      id: 'conn-linkedin-06',
      platformId: 'linkedin',
      name: 'LinkedIn Brand Ingestion',
      category: 'Social Ingestion',
      description: 'Ingest company page updates, comments, and direct mentions from your official LinkedIn corporate page.',
      status: 'healthy',
      isActive: true,
      lastSuccessfulFetch: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      lastAttempt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      consecutiveFailures: 0,
      config: {
        customDomain: 'Acme Global Operations',
        apiKeyMasked: 'oauth_li_••••••••••••92b1',
      },
    },
    {
      id: 'conn-x-07',
      platformId: 'x',
      name: 'X (Twitter) Firehose Stream',
      category: 'Social Ingestion',
      description: 'Real-time keyword streaming and direct message / mention ingestion from the X public feed.',
      status: 'healthy',
      isActive: true,
      lastSuccessfulFetch: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      lastAttempt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      consecutiveFailures: 0,
      config: {
        customDomain: '@acmeglobal',
        apiKeyMasked: 'x_bearer_••••••••••••881c',
      },
    },
    {
      id: 'conn-facebook-08',
      platformId: 'facebook',
      name: 'Facebook Page Listener',
      category: 'Social Ingestion',
      description: 'Monitor brand page visitor posts, reviews, comment threads, and engagement statistics.',
      status: 'inactive',
      isActive: false,
      lastSuccessfulFetch: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      lastAttempt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      consecutiveFailures: 0,
      config: {
        customDomain: 'Acme Global Official',
      },
    },
    {
      id: 'conn-instagram-09',
      platformId: 'instagram',
      name: 'Instagram Graph API Listener',
      category: 'Social Ingestion',
      description: 'Ingest media comments, reels feedback, and mentions of your business handle.',
      status: 'inactive',
      isActive: false,
      lastSuccessfulFetch: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      lastAttempt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      consecutiveFailures: 0,
      config: {
        customDomain: '@acme_global_hq',
      },
    },
    {
      id: 'conn-youtube-10',
      platformId: 'youtube',
      name: 'YouTube Channel Monitor',
      category: 'Social Ingestion',
      description: 'Ingest video comments, description mentions, and metadata changes across owned and target channels.',
      status: 'inactive',
      isActive: false,
      lastSuccessfulFetch: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      lastAttempt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      consecutiveFailures: 0,
      config: {
        customDomain: 'Acme Global Media Hub',
      },
    },
  ],
};

const INITIAL_WATCHLISTS: Record<string, Watchlist[]> = {
  [DEFAULT_TENANT_ID]: [
    {
      id: 'wl-brand-01',
      name: 'Acme Brand & Executive Reputation',
      matchType: 'Keyword',
      query: 'Acme Global, Acme Cloud, Sarah Chen, John Acme',
      terms: ['Acme Global', 'Acme Cloud', 'Sarah Chen', 'John Acme'],
      owner: 'Sarah Chen',
      platforms: ['GNews', 'Newswire', 'Tenant-Owned Feed'],
      isActive: true,
      createdAt: '2026-01-20T10:15:00Z',
      matchedPostsCount: 428,
    },
    {
      id: 'wl-competitor-02',
      name: 'Competitor Intelligence & Launches',
      matchType: 'Boolean',
      query: '("Contoso" OR "Tailwind") AND (cloud OR "AI agent" OR acquisition) NOT spam',
      terms: ['Contoso', 'Tailwind', 'cloud', 'AI agent'],
      owner: 'Marcus Vance',
      platforms: ['GNews', 'Newswire'],
      isActive: true,
      createdAt: '2026-02-14T09:00:00Z',
      matchedPostsCount: 215,
    },
    {
      id: 'wl-hashtag-03',
      name: '#EnterpriseAI & #SocialCare',
      matchType: 'Hashtag',
      query: '#EnterpriseAI, #SocialCare, #B2BTech, #CustomerSuccess',
      terms: ['#EnterpriseAI', '#SocialCare', '#B2BTech', '#CustomerSuccess'],
      owner: 'Elena Rostova',
      platforms: ['GNews'],
      isActive: true,
      createdAt: '2026-03-01T15:45:00Z',
      matchedPostsCount: 164,
    },
    {
      id: 'wl-account-04',
      name: 'Key Industry Analysts & Outlets',
      matchType: 'Account',
      query: '@TechCrunch, @BloombergTech, @Gartner_inc, @Forrester',
      terms: ['@TechCrunch', '@BloombergTech', '@Gartner_inc', '@Forrester'],
      owner: 'Sarah Chen',
      platforms: ['Newswire', 'GNews'],
      isActive: false,
      createdAt: '2026-04-10T12:00:00Z',
      matchedPostsCount: 92,
    },
  ],
};

const INITIAL_POSTS: Record<string, Post[]> = {
  [DEFAULT_TENANT_ID]: [
    {
      id: 'pst-101',
      title: 'Acme Global Unveils Next-Gen Social Listening Orchestrator with Azure AI Integration',
      text: 'Acme Global today announced the general availability of its flagship SocialEngage administration hub, combining Azure OpenAI reasoning with enterprise multi-tenant telemetry to streamline brand listening at scale.',
      author: 'Diane Prescott',
      authorHandle: '@dianeprescott',
      authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
      url: 'https://reuters.com/technology/acme-global-social-orchestrator-2026-08-14',
      provider: 'X',
      sourceType: 'x',
      publishedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      ingestedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      ingestionRunId: 'ing-run-882194',
      matchedWatchlistId: 'wl-brand-01',
      matchedWatchlistName: 'Acme Brand & Executive Reputation',
      language: 'en',
      location: {
        country: 'United States',
        city: 'Seattle',
        region: 'North America',
        latitude: 47.6062,
        longitude: -122.3321,
      },
      enrichment: {
        sentiment: 'Positive',
        sentimentScores: {
          positive: 0.94,
          neutral: 0.05,
          negative: 0.01,
        },
        entities: [
          { text: 'Acme Global', category: 'Organization' },
          { text: 'SocialEngage', category: 'Product' },
          { text: 'Azure OpenAI', category: 'Product' },
        ],
        keyPhrases: [
          '#msdyncrm',
          'Microsoft',
          'Azure AI',
          'SocialEngage',
          'general availability',
          'brand listening at scale',
        ],
        lastEnrichedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      },
      rawPayload: {
        source_id: 'reuters-88219',
        language: 'en',
        geo_country: 'US',
        provider_hash: 'sha256:7f8a9e01823bc',
      },
    },
    {
      id: 'pst-102',
      title: 'Contoso Retail reports quarterly cloud infrastructure expansion and agentic AI trials',
      text: 'Contoso Retail Corp disclosed strong Q2 gains alongside pilot deployments of intelligent customer engagement bots, intensifying competitive posture across digital listening segments.',
      author: 'Annie Herriman',
      authorHandle: '@aherriman_cx',
      authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
      url: 'https://bloomberg.com/news/articles/2026-08-14/contoso-cloud-expansion-results',
      provider: 'FACEBOOK',
      sourceType: 'facebook',
      publishedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      ingestedAt: new Date(Date.now() - 39 * 60 * 1000).toISOString(),
      ingestionRunId: 'ing-run-882190',
      matchedWatchlistId: 'wl-competitor-02',
      matchedWatchlistName: 'Competitor Intelligence & Launches',
      language: 'en',
      location: {
        country: 'United Kingdom',
        city: 'London',
        region: 'Europe',
        latitude: 51.5074,
        longitude: -0.1278,
      },
      enrichment: {
        sentiment: 'Neutral',
        sentimentScores: {
          positive: 0.22,
          neutral: 0.74,
          negative: 0.04,
        },
        entities: [
          { text: 'Contoso Retail Corp', category: 'Organization' },
          { text: 'Q2', category: 'Event' },
        ],
        keyPhrases: [
          '#msdynamics',
          'Dynamics CRM',
          'Integration',
          'Cloud',
          'competitive posture',
        ],
        lastEnrichedAt: new Date(Date.now() - 39 * 60 * 1000).toISOString(),
      },
      rawPayload: {
        source_id: 'bbg-99120',
        language: 'en',
        geo_country: 'GB',
      },
    },
    {
      id: 'pst-103',
      title: 'Press Release: Acme Newsroom announces European Data Sovereignty and ISO 27001 renewal',
      text: 'Acme Global has finalized validation of its Dublin data region and successfully completed its annual ISO/IEC 27001 audit for sovereign tenant isolation and zero-trust ingestion pipelines.',
      author: 'Lori Penor',
      authorHandle: '@loripenor',
      authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
      url: 'https://news.acme-global.com/press/european-data-sovereignty-iso-27001',
      provider: 'LINKEDIN',
      sourceType: 'linkedin',
      publishedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      ingestedAt: new Date(Date.now() - 2 * 3600 * 1000 + 120000).toISOString(),
      ingestionRunId: 'ing-run-882181',
      matchedWatchlistId: 'wl-brand-01',
      matchedWatchlistName: 'Acme Brand & Executive Reputation',
      language: 'en',
      location: {
        country: 'Ireland',
        city: 'Dublin',
        region: 'Europe',
        latitude: 53.3498,
        longitude: -6.2603,
      },
      enrichment: {
        sentiment: 'Positive',
        sentimentScores: {
          positive: 0.88,
          neutral: 0.11,
          negative: 0.01,
        },
        entities: [
          { text: 'Acme Global', category: 'Organization' },
          { text: 'Dublin', category: 'Location' },
          { text: 'ISO/IEC 27001', category: 'Product' },
        ],
        keyPhrases: [
          '#EnterpriseAI',
          'Microsoft MSFT',
          'Subscription',
          'Security',
          'Data Sovereignty',
        ],
        lastEnrichedAt: new Date(Date.now() - 2 * 3600 * 1000 + 120000).toISOString(),
      },
      rawPayload: {
        feed_guid: 'urn:acme:news:pr-2026-08-14-01',
      },
    },
    {
      id: 'pst-104',
      title: 'Industry Analysis: Why Legacy Social Monitoring Tools Face Urgent Enterprise Modernization',
      text: 'With Microsoft Social Engagement deprecated, enterprises are migrating to modern REST and streaming listening consoles that respect tenant sovereignty and provide BYOK AI capabilities.',
      author: 'Justin Harrison',
      authorHandle: '@jharrison_tech',
      authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
      url: 'https://gartner.com/insights/enterprise-social-listening-modernization-2026',
      provider: 'YOUTUBE',
      sourceType: 'youtube',
      publishedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      ingestedAt: new Date(Date.now() - 5 * 3600 * 1000 + 300000).toISOString(),
      ingestionRunId: 'ing-run-882170',
      matchedWatchlistId: 'wl-hashtag-03',
      matchedWatchlistName: '#EnterpriseAI & #SocialCare',
      language: 'en',
      location: {
        country: 'United States',
        city: 'New York',
        region: 'North America',
        latitude: 40.7128,
        longitude: -74.006,
      },
      enrichment: {
        sentiment: 'Positive',
        sentimentScores: {
          positive: 0.75,
          neutral: 0.20,
          negative: 0.05,
        },
        entities: [
          { text: 'Microsoft Social Engagement', category: 'Product' },
          { text: 'Gartner', category: 'Organization' },
        ],
        keyPhrases: [
          '#msdyncrm',
          'Bing',
          'sales',
          'ebook',
          'AI agent',
          'Legacy Social Monitoring Tools',
        ],
        lastEnrichedAt: new Date(Date.now() - 5 * 3600 * 1000 + 300000).toISOString(),
      },
      rawPayload: {
        source_id: 'gartner-analyst-memo-402',
      },
    },
    {
      id: 'pst-105',
      title: 'Customer Feedback on Service Latency during APAC Maintenance Window',
      text: 'A minor subsea cable reroute briefly impacted query ingestion speeds for regional Asian telemetry queries before automated failover completed.',
      author: 'Kim Akers',
      authorHandle: '@kakers_cloud',
      authorAvatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=120&auto=format&fit=crop&q=80',
      url: 'https://cloudstatus.asia/incident/report-9921',
      provider: 'INSTAGRAM',
      sourceType: 'instagram',
      publishedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
      ingestedAt: new Date(Date.now() - 14 * 3600 * 1000 + 60000).toISOString(),
      ingestionRunId: 'ing-run-882160',
      matchedWatchlistId: 'wl-brand-01',
      matchedWatchlistName: 'Acme Brand & Executive Reputation',
      language: 'de',
      location: {
        country: 'Germany',
        city: 'Frankfurt',
        region: 'Europe',
        latitude: 50.1109,
        longitude: 8.6821,
      },
      enrichment: {
        sentiment: 'Negative',
        sentimentScores: {
          positive: 0.05,
          neutral: 0.28,
          negative: 0.67,
        },
        entities: [
          { text: 'APAC', category: 'Location' },
          { text: 'CloudStatus Asia', category: 'Organization' },
        ],
        keyPhrases: [
          'Service Latency',
          '#EnterpriseAI',
          'subsea cable reroute',
          'automated failover',
        ],
        lastEnrichedAt: new Date(Date.now() - 14 * 3600 * 1000 + 60000).toISOString(),
      },
      rawPayload: {
        source_id: 'cs-asia-9921',
      },
    },
    {
      id: 'pst-106',
      title: 'Wie Dynamics CRM und Social Listening die B2B-Kundenbindung revolutionieren',
      text: 'Enterprise-Analysten zeigen auf der Konferenz, wie multimodale Ingestion über soziale Kanäle die Reaktionszeit im Kundenservice um bis zu 40 Prozent senkt.',
      author: 'Marcus Vance',
      authorHandle: '@marcus_vance',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      url: 'https://techblog.de/dynamics-crm-social-listening-2026',
      provider: 'BLOG',
      sourceType: 'blog',
      publishedAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
      ingestedAt: new Date(Date.now() - 22 * 3600 * 1000 + 45000).toISOString(),
      ingestionRunId: 'ing-run-882155',
      matchedWatchlistId: 'wl-competitor-02',
      matchedWatchlistName: 'Competitor Intelligence & Launches',
      language: 'de',
      location: {
        country: 'Germany',
        city: 'Munich',
        region: 'Europe',
        latitude: 48.1351,
        longitude: 11.582,
      },
      enrichment: {
        sentiment: 'Positive',
        sentimentScores: {
          positive: 0.89,
          neutral: 0.08,
          negative: 0.03,
        },
        entities: [
          { text: 'Dynamics CRM', category: 'Product' },
          { text: 'B2B', category: 'Organization' },
        ],
        keyPhrases: [
          '#msdyncrm',
          'Dynamics CRM',
          'Kundenbindung',
          'Multimodale Ingestion',
          'Microsoft',
        ],
        lastEnrichedAt: new Date(Date.now() - 22 * 3600 * 1000 + 45000).toISOString(),
      },
      rawPayload: {
        source_id: 'techblog-de-491',
      },
    },
    {
      id: 'pst-107',
      title: 'Stratégies de veille sociale et conformité RGPD dans le Cloud Hybride',
      text: 'Le traitement en temps réel des données des réseaux sociaux nécessite une isolation stricte des locataires et un chiffrement des clés d’API de bout en bout.',
      author: 'Diane Prescott',
      authorHandle: '@dianeprescott',
      authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
      url: 'https://infosec.fr/veille-sociale-rgpd-azure',
      provider: 'GNEWS',
      sourceType: 'gnews',
      publishedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      ingestedAt: new Date(Date.now() - 36 * 3600 * 1000 + 12000).toISOString(),
      ingestionRunId: 'ing-run-882142',
      matchedWatchlistId: 'wl-brand-01',
      matchedWatchlistName: 'Acme Brand & Executive Reputation',
      language: 'fr',
      location: {
        country: 'France',
        city: 'Paris',
        region: 'Europe',
        latitude: 48.8566,
        longitude: 2.3522,
      },
      enrichment: {
        sentiment: 'Positive',
        sentimentScores: {
          positive: 0.81,
          neutral: 0.17,
          negative: 0.02,
        },
        entities: [
          { text: 'RGPD', category: 'Product' },
          { text: 'Cloud Hybride', category: 'Product' },
        ],
        keyPhrases: [
          '#EnterpriseAI',
          'Cloud',
          'Data Sovereignty',
          'Microsoft MSFT',
          'Chiffrement',
        ],
        lastEnrichedAt: new Date(Date.now() - 36 * 3600 * 1000 + 12000).toISOString(),
      },
      rawPayload: {
        source_id: 'infosec-fr-884',
      },
    },
    {
      id: 'pst-108',
      title: 'Global Telemetry Benchmark: High-Throughput Webhook Ingestion on Azure Infrastructure',
      text: 'Global Newswire telecommunications brief highlighting 99.999% availability for enterprise social feed ingestion connectors with dynamic burst buffering.',
      author: 'Lori Penor',
      authorHandle: '@loripenor',
      authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
      url: 'https://globalnewswire.com/telecom/azure-ingestion-benchmark-2026',
      provider: 'NEWSWIRE',
      sourceType: 'newswire',
      publishedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      ingestedAt: new Date(Date.now() - 48 * 3600 * 1000 + 30000).toISOString(),
      ingestionRunId: 'ing-run-882130',
      matchedWatchlistId: 'wl-hashtag-03',
      matchedWatchlistName: '#EnterpriseAI & #SocialCare',
      language: 'en',
      location: {
        country: 'Japan',
        city: 'Tokyo',
        region: 'Asia Pacific',
        latitude: 35.6762,
        longitude: 139.6503,
      },
      enrichment: {
        sentiment: 'Positive',
        sentimentScores: {
          positive: 0.92,
          neutral: 0.07,
          negative: 0.01,
        },
        entities: [
          { text: 'Global Newswire', category: 'Organization' },
          { text: 'Azure', category: 'Product' },
        ],
        keyPhrases: [
          '#msdyncrm',
          'Telemetry',
          'Azure AI',
          'Subscription',
          'High-Throughput',
        ],
        lastEnrichedAt: new Date(Date.now() - 48 * 3600 * 1000 + 30000).toISOString(),
      },
      rawPayload: {
        source_id: 'gnw-99382',
      },
    },
    {
      id: 'pst-109',
      title: 'Analisi sull’impatto dell’AI generativa nei processi di ascolto della reputazione aziendale',
      text: 'Uno studio italiano evidenzia l’efficacia degli algoritmi di sentiment analysis nella prevenzione delle crisi di brand in tempo reale.',
      author: 'Annie Herriman',
      authorHandle: '@aherriman_cx',
      authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
      url: 'https://digitalbusiness.it/ai-sentiment-reputazione-2026',
      provider: 'X',
      sourceType: 'x',
      publishedAt: new Date(Date.now() - 60 * 3600 * 1000).toISOString(),
      ingestedAt: new Date(Date.now() - 60 * 3600 * 1000 + 15000).toISOString(),
      ingestionRunId: 'ing-run-882110',
      matchedWatchlistId: 'wl-brand-01',
      matchedWatchlistName: 'Acme Brand & Executive Reputation',
      language: 'it',
      location: {
        country: 'Italy',
        city: 'Milan',
        region: 'Europe',
        latitude: 45.4642,
        longitude: 9.19,
      },
      enrichment: {
        sentiment: 'Positive',
        sentimentScores: {
          positive: 0.85,
          neutral: 0.12,
          negative: 0.03,
        },
        entities: [
          { text: 'AI generativa', category: 'Product' },
          { text: 'Milano', category: 'Location' },
        ],
        keyPhrases: [
          '#msdyncrm',
          'Microsoft',
          'Sentiment Analysis',
          'Brand Reputation',
          'Crisis Prevention',
        ],
        lastEnrichedAt: new Date(Date.now() - 60 * 3600 * 1000 + 15000).toISOString(),
      },
      rawPayload: {
        source_id: 'it-biz-8820',
      },
    },
    {
      id: 'pst-110',
      title: 'Tendencias en Inteligencia de Clientes y Automatización de Casos en América Latina',
      text: 'Las compañías que conectan sus canales de Twitter, LinkedIn y Facebook a paneles unificados reducen los tiempos de respuesta a menos de 5 minutos.',
      author: 'Justin Harrison',
      authorHandle: '@jharrison_tech',
      authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
      url: 'https://innovacionlatam.com/automatizacion-clientes-2026',
      provider: 'LINKEDIN',
      sourceType: 'linkedin',
      publishedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      ingestedAt: new Date(Date.now() - 72 * 3600 * 1000 + 20000).toISOString(),
      ingestionRunId: 'ing-run-882090',
      matchedWatchlistId: 'wl-competitor-02',
      matchedWatchlistName: 'Competitor Intelligence & Launches',
      language: 'es',
      location: {
        country: 'Spain',
        city: 'Madrid',
        region: 'Europe',
        latitude: 40.4168,
        longitude: -3.7038,
      },
      enrichment: {
        sentiment: 'Positive',
        sentimentScores: {
          positive: 0.87,
          neutral: 0.10,
          negative: 0.03,
        },
        entities: [
          { text: 'Latinoamérica', category: 'Location' },
          { text: 'LinkedIn', category: 'Product' },
        ],
        keyPhrases: [
          '#EnterpriseAI',
          'Dynamics CRM',
          'Integration',
          'Automatización',
          'Social Care',
        ],
        lastEnrichedAt: new Date(Date.now() - 72 * 3600 * 1000 + 20000).toISOString(),
      },
      rawPayload: {
        source_id: 'latam-inn-201',
      },
    },
  ],
};

const INITIAL_TENANT_USERS: Record<string, TenantUser[]> = {
  [DEFAULT_TENANT_ID]: [
    {
      id: 'usr-admin-01',
      name: 'Sarah Chen',
      email: 'sarah.chen@acme-global.com',
      role: 'tenant_admin',
      status: 'Active',
      accessEndsAt: null,
      joinedAt: '2026-01-15T08:30:00Z',
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: 'usr-analyst-02',
      name: 'Marcus Vance',
      email: 'marcus.vance@acme-global.com',
      role: 'tenant_user',
      status: 'Active',
      accessEndsAt: null,
      joinedAt: '2026-01-18T14:10:00Z',
      lastActiveAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'usr-analyst-03',
      name: 'Elena Rostova',
      email: 'elena.rostova@acme-global.com',
      role: 'tenant_user',
      status: 'Active',
      accessEndsAt: '2026-12-31T23:59:59Z',
      joinedAt: '2026-02-05T09:20:00Z',
      lastActiveAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: 'usr-analyst-04',
      name: 'David Kim',
      email: 'david.kim@acme-global.com',
      role: 'tenant_user',
      status: 'Active',
      accessEndsAt: null,
      joinedAt: '2026-03-01T10:00:00Z',
      lastActiveAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'usr-analyst-05',
      name: 'Priya Sharma',
      email: 'priya.sharma@acme-global.com',
      role: 'tenant_user',
      status: 'Active',
      accessEndsAt: '2026-09-30T23:59:59Z',
      joinedAt: '2026-04-12T16:40:00Z',
      lastActiveAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    },
    {
      id: 'usr-analyst-06',
      name: 'Thomas Mueller',
      email: 'thomas.mueller@acme-global.com',
      role: 'tenant_admin',
      status: 'Active',
      accessEndsAt: null,
      joinedAt: '2026-05-19T11:15:00Z',
      lastActiveAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
  ],
};

const INITIAL_INVITE_CANDIDATES: Record<string, InviteAssistCandidate[]> = {
  [DEFAULT_TENANT_ID]: [
    {
      id: 'inv-cand-01',
      name: 'Liam O’Connor',
      email: 'liam.oconnor@acme-global.com',
      domain: 'acme-global.com',
      attemptAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      status: 'pending',
    },
    {
      id: 'inv-cand-02',
      name: 'Mei Ling Tan',
      email: 'mei.tan@acme-global.com',
      domain: 'acme-global.com',
      attemptAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
      status: 'pending',
    },
    {
      id: 'inv-cand-03',
      name: 'Arthur Pendelton',
      email: 'arthur.p@acme-global.com',
      domain: 'acme-global.com',
      attemptAt: new Date(Date.now() - 4 * 86400 * 1000).toISOString(),
      status: 'pending',
    },
  ],
};

const INITIAL_AUDIT_LOGS: PlatformAdminAuditLog[] = [
  {
    id: 'aud-8891',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    actor: 'alex.rivera@socialengage.platform',
    operation: 'seat_count_adjust',
    targetTenant: 'Acme Global Operations',
    targetTenantId: DEFAULT_TENANT_ID,
    details: 'License seats adjusted: 10 -> 12',
    ipAddress: '192.0.2.45',
  },
  {
    id: 'aud-8890',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    actor: 'alex.rivera@socialengage.platform',
    operation: 'tenant_suspend',
    targetTenant: 'Tailwind Traders Inc',
    targetTenantId: TAILWIND_TENANT_ID,
    details: 'Tenant suspended: Billing reconciliation hold',
    ipAddress: '192.0.2.45',
  },
  {
    id: 'aud-8889',
    timestamp: '2026-08-10T14:22:00Z',
    actor: 'system-provisioner',
    operation: 'tenant_create',
    targetTenant: 'Contoso Retail Corp',
    targetTenantId: CONTOSO_TENANT_ID,
    details: 'Tenant provisioned via Self-Service with 25 license seats',
    ipAddress: '10.0.4.12',
  },
  {
    id: 'aud-8888',
    timestamp: '2026-08-08T09:15:00Z',
    actor: 'alex.rivera@socialengage.platform',
    operation: 'break_glass_execute',
    targetTenant: 'Contoso Retail Corp',
    targetTenantId: CONTOSO_TENANT_ID,
    details: 'Executed Break-Glass Temporary Access Pass reset (Ticket SEC-44102)',
    ipAddress: '192.0.2.45',
  },
];

const INITIAL_BREAK_GLASS_REQUESTS: BreakGlassRequest[] = [
  {
    id: 'bg-req-4412',
    tenantId: CONTOSO_TENANT_ID,
    tenantName: 'Contoso Retail Corp',
    requestedBy: 'alex.rivera@socialengage.platform',
    reason: 'Emergency Tenant Admin lockout recovery per incident SEC-44102',
    requestedAt: '2026-08-08T09:10:00Z',
    executedAt: '2026-08-08T09:15:00Z',
    status: 'executed',
  },
];

const INITIAL_DB_HEALTH: DbHealth = {
  status: 'ok',
  latencyMs: 3.2,
  activeConnections: 42,
  maxConnections: 200,
  poolSize: 50,
  version: 'PostgreSQL 16.4 (Azure Cosmos DB for PostgreSQL)',
  timestamp: new Date().toISOString(),
  uptime: '99.994%',
};

export function loadState(): AppState {
  if (typeof window === 'undefined') {
    return {
      currentSession: INITIAL_SESSIONS.tenant_admin,
      tenants: INITIAL_TENANTS,
      connectors: INITIAL_CONNECTORS,
      watchlists: INITIAL_WATCHLISTS,
      posts: INITIAL_POSTS,
      tenantUsers: INITIAL_TENANT_USERS,
      inviteCandidates: INITIAL_INVITE_CANDIDATES,
      auditLogs: INITIAL_AUDIT_LOGS,
      breakGlassRequests: INITIAL_BREAK_GLASS_REQUESTS,
      dbHealth: INITIAL_DB_HEALTH,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: AppState = JSON.parse(raw);
      if (parsed.currentSession) {
        if (parsed.currentSession.isAuthenticated === undefined) {
          parsed.currentSession.isAuthenticated =
            parsed.currentSession.role !== 'unauthenticated' && !!parsed.currentSession.id;
        }
      }
      return parsed;
    }
  } catch (err) {
    console.error('Failed to parse saved state:', err);
  }

  return {
    currentSession: INITIAL_SESSIONS.tenant_admin,
    tenants: INITIAL_TENANTS,
    connectors: INITIAL_CONNECTORS,
    watchlists: INITIAL_WATCHLISTS,
    posts: INITIAL_POSTS,
    tenantUsers: INITIAL_TENANT_USERS,
    inviteCandidates: INITIAL_INVITE_CANDIDATES,
    auditLogs: INITIAL_AUDIT_LOGS,
    breakGlassRequests: INITIAL_BREAK_GLASS_REQUESTS,
    dbHealth: INITIAL_DB_HEALTH,
  };
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}
