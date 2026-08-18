import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  UserSession,
  UserRole,
  Tenant,
  Connector,
  Watchlist,
  Post,
  TenantUser,
  InviteAssistCandidate,
  PlatformAdminAuditLog,
  BreakGlassRequest,
  DbHealth,
} from '../types';
import { loadState, saveState, AppState, INITIAL_SESSIONS, STORAGE_KEY } from '../lib/store';

export interface AppContextType {
  state: AppState;
  session: UserSession;
  activeRoute: string;
  activeTenant: Tenant | null;
  allTenants: Tenant[];
  connectors: Connector[];
  watchlists: Watchlist[];
  posts: Post[];
  tenantUsers: TenantUser[];
  inviteCandidates: InviteAssistCandidate[];
  auditLogs: PlatformAdminAuditLog[];
  dbHealth: DbHealth;
  breakGlassRequests: BreakGlassRequest[];

  // Navigation & Sessions
  navigateTo: (route: string) => void;
  setSessionRole: (role: UserRole) => void;
  switchTenant: (tenantId: string) => void;
  signOut: () => void;
  signInAs: (role: UserRole) => void;
  completeSignUp: (tenantName: string, domain: string) => void;

  // Connectors
  toggleConnectorActive: (connectorId: string, isActive: boolean) => void;
  updateConnectorConfig: (connectorId: string, config: Partial<Connector['config']>) => void;
  connectPlatform: (platformId: string, config: any) => void;
  disconnectPlatform: (connectorId: string) => void;
  verifyTenantOwnedDns: (connectorId: string) => Promise<'verified' | 'pending'>;

  // Watchlists
  createWatchlist: (data: Omit<Watchlist, 'id' | 'createdAt' | 'matchedPostsCount'>) => void;
  updateWatchlist: (id: string, data: Partial<Watchlist>) => void;
  deleteWatchlist: (id: string) => void;
  toggleWatchlistActive: (id: string, isActive: boolean) => void;

  // Posts & AI Enrichment
  enrichPost: (postId: string) => Promise<void>;

  // Team & Access
  inviteTenantUser: (email: string, role: 'tenant_admin' | 'tenant_user') => void;
  updateUserAccessPeriod: (userId: string, accessEndsAt: string | null) => void;
  removeTenantUser: (userId: string) => void;

  // Invite Assist
  inviteCandidate: (candidateId: string, role: 'tenant_admin' | 'tenant_user') => void;
  dismissCandidate: (candidateId: string) => void;

  // Tenant Settings & Offboarding
  requestTenantDeletion: () => void;
  cancelTenantDeletion: () => void;
  confirmFinalTenantDeletion: () => void;
  exportTenantData: (format: 'json' | 'csv') => void;

  // Platform Admin
  refreshDbHealth: () => void;
  provisionTenant: (data: {
    name: string;
    domain: string;
    plan: 'Enterprise' | 'Scale' | 'Pro';
    licenseSeats: number;
    adminEmail: string;
  }) => void;
  setTenantStatus: (tenantId: string, status: 'active' | 'suspended') => void;
  updateTenantStatus: (tenantId: string, status: 'active' | 'suspended') => void;
  updateTenantSeats: (tenantId: string, count: number) => void;
  updateTenantLicenseSeats: (tenantId: string, count: number) => void;
  updateTenantName: (tenantId: string, name: string) => void;
  createBreakGlassRequest: (tenantId: string, reason: string) => string;
  executeBreakGlassRequest: (requestId: string) => Promise<string>;

  // Utility
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [activeRoute, setActiveRoute] = useState<string>('/tenant');

  // Sync state changes with localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  const session = state.currentSession;
  const tenantId = session.tenantId || 'ten-acme-9921';

  const activeTenant = useMemo(() => {
    if (!session.tenantId) return null;
    return state.tenants.find((t) => t.id === session.tenantId) || null;
  }, [state.tenants, session.tenantId]);

  const allTenants = state.tenants;

  const connectors = useMemo(() => {
    return state.connectors[tenantId] || [];
  }, [state.connectors, tenantId]);

  const watchlists = useMemo(() => {
    return state.watchlists[tenantId] || [];
  }, [state.watchlists, tenantId]);

  const posts = useMemo(() => {
    return state.posts[tenantId] || [];
  }, [state.posts, tenantId]);

  const tenantUsers = useMemo(() => {
    return state.tenantUsers[tenantId] || [];
  }, [state.tenantUsers, tenantId]);

  const inviteCandidates = useMemo(() => {
    return state.inviteCandidates[tenantId] || [];
  }, [state.inviteCandidates, tenantId]);

  const auditLogs = state.auditLogs;
  const dbHealth = state.dbHealth;
  const breakGlassRequests = state.breakGlassRequests;

  // Route security dispatcher & boundary enforcement (Story 6.2)
  const navigateTo = (route: string) => {
    // Canonicalize admin route paths
    const canonicalRoute = route.startsWith('/platform-admin')
      ? route.replace('/platform-admin', '/admin')
      : route === '/signup'
      ? '/sign-up'
      : route === '/signin'
      ? '/sign-in'
      : route;

    // Platform Admin role boundary: Platform Admins cannot access tenant content (ADR-0030 §2, ADR-0041)
    if (session.role === 'platform_admin' && canonicalRoute.startsWith('/tenant')) {
      setActiveRoute('/admin');
      return;
    }
    // Tenant users cannot access platform admin console
    if ((session.role === 'tenant_admin' || session.role === 'tenant_user') && canonicalRoute.startsWith('/admin')) {
      setActiveRoute('/tenant');
      return;
    }
    // Tenant Users cannot access admin-only routes like user management or connector creation
    if (
      session.role === 'tenant_user' &&
      (canonicalRoute === '/tenant/users' ||
        canonicalRoute === '/tenant/invite-assist' ||
        canonicalRoute === '/tenant/connectors' ||
        canonicalRoute === '/tenant/settings/delete')
    ) {
      setActiveRoute('/tenant');
      return;
    }
    setActiveRoute(canonicalRoute);
  };

  const setSessionRole = (role: UserRole) => {
    const template = INITIAL_SESSIONS[role];
    if (template) {
      setState((prev) => ({
        ...prev,
        currentSession: {
          ...template,
          isAuthenticated: role !== 'unauthenticated',
        },
      }));
      if (role === 'platform_admin') {
        setActiveRoute('/admin');
      } else if (role !== 'unauthenticated') {
        setActiveRoute('/tenant');
      } else {
        setActiveRoute('/sign-in');
      }
    }
  };

  const switchTenant = (newTenantId: string) => {
    const targetTenant = state.tenants.find((t) => t.id === newTenantId);
    if (!targetTenant) return;

    setState((prev) => ({
      ...prev,
      currentSession: {
        ...prev.currentSession,
        tenantId: targetTenant.id,
        tenantName: targetTenant.name,
      },
    }));
  };

  const signOut = () => {
    setState((prev) => ({
      ...prev,
      currentSession: {
        id: '',
        name: 'Anonymous',
        email: '',
        role: 'unauthenticated',
        tenantId: null,
        tenantName: null,
        isAuthenticated: false,
      },
    }));
    setActiveRoute('/signed-out');
  };

  const signInAs = (role: UserRole) => {
    setSessionRole(role);
  };

  const completeSignUp = (tenantName: string, domain: string) => {
    const newTenantId = `ten-${domain.replace(/[^a-z0-9]/gi, '').slice(0, 8)}-${Date.now().toString().slice(-4)}`;
    const newAdminUser: TenantUser = {
      id: `usr-admin-${Date.now().toString().slice(-4)}`,
      name: `Admin (${domain.split('.')[0]})`,
      email: `admin@${domain}`,
      role: 'tenant_admin',
      status: 'Active',
      accessEndsAt: null,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    const newTenant: Tenant = {
      id: newTenantId,
      name: tenantName,
      domain: domain,
      status: 'active',
      plan: 'Enterprise',
      licenseSeats: 10,
      activeSeats: 1,
      createdAt: new Date().toISOString(),
      isolationMode: 'row_level_security',
    };

    setState((prev) => ({
      ...prev,
      tenants: [newTenant, ...prev.tenants],
      connectors: {
        ...prev.connectors,
        [newTenantId]: [
          {
            id: `conn-gnews-${newTenantId}`,
            tenantId: newTenantId,
            platformId: 'gnews',
            name: 'GNews API Service',
            category: 'News Ingestion',
            description: 'Real-time global news monitoring with keyword and topic filtering',
            status: 'inactive',
            isActive: false,
            lastSuccessfulFetch: new Date().toISOString(),
            lastAttempt: new Date().toISOString(),
            consecutiveFailures: 0,
            config: {},
          },
          {
            id: `conn-newswire-${newTenantId}`,
            tenantId: newTenantId,
            platformId: 'newswire',
            name: 'Global Newswire Feeds',
            category: 'Press Ingestion',
            description: 'Public syndicated enterprise press releases and regulatory disclosures',
            status: 'healthy',
            isActive: true,
            lastSuccessfulFetch: new Date().toISOString(),
            lastAttempt: new Date().toISOString(),
            consecutiveFailures: 0,
            config: {},
          },
          {
            id: `conn-azure-lang-${newTenantId}`,
            tenantId: newTenantId,
            platformId: 'azure_ai_language',
            name: 'Azure AI Language Service',
            category: 'Cognitive Enrichment',
            description: 'Named Entity Recognition and sentiment analysis cognitive pipeline',
            status: 'inactive',
            isActive: false,
            lastSuccessfulFetch: new Date().toISOString(),
            lastAttempt: new Date().toISOString(),
            consecutiveFailures: 0,
            config: {},
          },
          {
            id: `conn-azure-oai-${newTenantId}`,
            tenantId: newTenantId,
            platformId: 'azure_openai',
            name: 'Azure OpenAI Service',
            category: 'Cognitive Reasoning',
            description: 'Contextual brand reputation synthesis and executive insights generation',
            status: 'inactive',
            isActive: false,
            lastSuccessfulFetch: new Date().toISOString(),
            lastAttempt: new Date().toISOString(),
            consecutiveFailures: 0,
            config: {},
          },
          {
            id: `conn-tenant-feed-${newTenantId}`,
            tenantId: newTenantId,
            platformId: 'tenant_owned_feed',
            name: 'Tenant-Owned Feed',
            category: 'Custom Domain Feed',
            description: 'Direct RSS/Atom feed verified via DNS TXT record challenge (ADR-0050)',
            status: 'inactive',
            isActive: false,
            lastSuccessfulFetch: new Date().toISOString(),
            lastAttempt: new Date().toISOString(),
            consecutiveFailures: 0,
            config: {
              activationId: `act-${newTenantId.slice(-6)}`,
              dnsVerified: false,
              dnsTxtValue: `se-verify-${Date.now().toString(16).slice(-10)}`,
            },
          },
        ],
      },
      watchlists: {
        ...prev.watchlists,
        [newTenantId]: [
          {
            id: `wl-def-${Date.now().toString().slice(-4)}`,
            tenantId: newTenantId,
            name: `${tenantName} Brand Terms`,
            matchType: 'Keyword',
            query: `${tenantName}, AI, Cloud`,
            terms: [tenantName, 'AI', 'Cloud'],
            platforms: ['GNews', 'Newswire'],
            isActive: true,
            createdAt: new Date().toISOString(),
            owner: newAdminUser.name,
            matchedPostsCount: 0,
          },
        ],
      },
      posts: {
        ...prev.posts,
        [newTenantId]: [],
      },
      tenantUsers: {
        ...prev.tenantUsers,
        [newTenantId]: [newAdminUser],
      },
      inviteCandidates: {
        ...prev.inviteCandidates,
        [newTenantId]: [],
      },
      currentSession: {
        id: newAdminUser.id,
        name: newAdminUser.name,
        email: newAdminUser.email,
        role: 'tenant_admin',
        tenantId: newTenantId,
        tenantName: tenantName,
      },
      auditLogs: [
        {
          id: `aud-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString(),
          actor: newAdminUser.email,
          operation: 'tenant_create',
          targetTenant: tenantName,
          targetTenantId: newTenantId,
          details: 'Self-service sign-up workspace established with 10 license seats',
          ipAddress: '192.0.2.1',
        },
        ...prev.auditLogs,
      ],
    }));

    setActiveRoute('/tenant');
  };

  // Connector Actions
  const toggleConnectorActive = (connectorId: string, isActive: boolean) => {
    setState((prev) => {
      const tenantConns = prev.connectors[tenantId] || [];
      const updated = tenantConns.map((c) => {
        if (c.id === connectorId) {
          return {
            ...c,
            isActive,
            status: isActive ? (c.status === 'inactive' ? 'healthy' : c.status) : 'inactive',
          };
        }
        return c;
      });
      return {
        ...prev,
        connectors: {
          ...prev.connectors,
          [tenantId]: updated,
        },
      };
    });
  };

  const updateConnectorConfig = (connectorId: string, config: Partial<Connector['config']>) => {
    setState((prev) => {
      const tenantConns = prev.connectors[tenantId] || [];
      const updated = tenantConns.map((c) => {
        if (c.id === connectorId) {
          return {
            ...c,
            config: { ...c.config, ...config },
          };
        }
        return c;
      });
      return {
        ...prev,
        connectors: {
          ...prev.connectors,
          [tenantId]: updated,
        },
      };
    });
  };

  const connectPlatform = (platformId: string, config: any) => {
    setState((prev) => {
      const tenantConns = prev.connectors[tenantId] || [];
      const updated = tenantConns.map((c) => {
        if (c.platformId === platformId) {
          return {
            ...c,
            isActive: true,
            status: 'healthy' as const,
            config: { ...c.config, ...config },
            lastSuccessfulFetch: new Date().toISOString(),
            lastAttempt: new Date().toISOString(),
            consecutiveFailures: 0,
          };
        }
        return c;
      });
      return {
        ...prev,
        connectors: {
          ...prev.connectors,
          [tenantId]: updated,
        },
      };
    });
  };

  const disconnectPlatform = (connectorId: string) => {
    setState((prev) => {
      const tenantConns = prev.connectors[tenantId] || [];
      const updated = tenantConns.map((c) => {
        if (c.id === connectorId) {
          return {
            ...c,
            isActive: false,
            status: 'inactive' as const,
            config: {},
          };
        }
        return c;
      });
      return {
        ...prev,
        connectors: {
          ...prev.connectors,
          [tenantId]: updated,
        },
      };
    });
  };

  const verifyTenantOwnedDns = async (connectorId: string): Promise<'verified' | 'pending'> => {
    await new Promise((r) => setTimeout(r, 1200));

    let result: 'verified' | 'pending' = 'verified';

    setState((prev) => {
      const tenantConns = prev.connectors[tenantId] || [];
      const updated = tenantConns.map((c) => {
        if (c.id === connectorId) {
          return {
            ...c,
            isActive: true,
            status: 'healthy' as const,
            config: {
              ...c.config,
              dnsVerified: true,
              lastVerifiedAt: new Date().toISOString(),
            },
          };
        }
        return c;
      });
      return {
        ...prev,
        connectors: {
          ...prev.connectors,
          [tenantId]: updated,
        },
      };
    });

    return result;
  };

  // Watchlist Actions
  const createWatchlist = (data: Omit<Watchlist, 'id' | 'createdAt' | 'matchedPostsCount'>) => {
    const newWatchlist: Watchlist = {
      ...data,
      id: `wl-${Date.now().toString().slice(-4)}`,
      tenantId,
      createdAt: new Date().toISOString(),
      matchedPostsCount: Math.floor(Math.random() * 4) + 1,
    };

    setState((prev) => {
      const currentList = prev.watchlists[tenantId] || [];
      return {
        ...prev,
        watchlists: {
          ...prev.watchlists,
          [tenantId]: [newWatchlist, ...currentList],
        },
      };
    });
  };

  const updateWatchlist = (id: string, data: Partial<Watchlist>) => {
    setState((prev) => {
      const currentList = prev.watchlists[tenantId] || [];
      const updated = currentList.map((w) => (w.id === id ? { ...w, ...data } : w));
      return {
        ...prev,
        watchlists: {
          ...prev.watchlists,
          [tenantId]: updated,
        },
      };
    });
  };

  const deleteWatchlist = (id: string) => {
    setState((prev) => {
      const currentList = prev.watchlists[tenantId] || [];
      return {
        ...prev,
        watchlists: {
          ...prev.watchlists,
          [tenantId]: currentList.filter((w) => w.id !== id),
        },
      };
    });
  };

  const toggleWatchlistActive = (id: string, isActive: boolean) => {
    updateWatchlist(id, { isActive });
  };

  // Posts & AI Enrichment (Story 6.16)
  const enrichPost = async (postId: string) => {
    await new Promise((r) => setTimeout(r, 1000));

    setState((prev) => {
      const tenantPosts = prev.posts[tenantId] || [];
      const updated = tenantPosts.map((p) => {
        if (p.id === postId) {
          const currentSentiment = p.enrichment.sentiment;
          return {
            ...p,
            enrichment: {
              ...p.enrichment,
              sentiment: currentSentiment,
              sentimentScores: {
                positive: currentSentiment === 'Positive' ? 0.96 : 0.2,
                neutral: currentSentiment === 'Neutral' ? 0.78 : 0.05,
                negative: currentSentiment === 'Negative' ? 0.75 : 0.02,
              },
              lastEnrichedAt: new Date().toISOString(),
            },
          };
        }
        return p;
      });
      return {
        ...prev,
        posts: {
          ...prev.posts,
          [tenantId]: updated,
        },
      };
    });
  };

  // Team Management Actions (Story 6.8, 6.14)
  const inviteTenantUser = (email: string, role: 'tenant_admin' | 'tenant_user') => {
    const newUser: TenantUser = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      email,
      role,
      status: 'Pending',
      accessEndsAt: null,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    setState((prev) => {
      const users = prev.tenantUsers[tenantId] || [];
      const tenants = prev.tenants.map((t) =>
        t.id === tenantId ? { ...t, activeSeats: t.activeSeats + 1 } : t
      );
      return {
        ...prev,
        tenants,
        tenantUsers: {
          ...prev.tenantUsers,
          [tenantId]: [newUser, ...users],
        },
      };
    });
  };

  const updateUserAccessPeriod = (userId: string, accessEndsAt: string | null) => {
    setState((prev) => {
      const users = prev.tenantUsers[tenantId] || [];
      const updated = users.map((u) => (u.id === userId ? { ...u, accessEndsAt } : u));
      return {
        ...prev,
        tenantUsers: {
          ...prev.tenantUsers,
          [tenantId]: updated,
        },
      };
    });
  };

  const removeTenantUser = (userId: string) => {
    setState((prev) => {
      const users = prev.tenantUsers[tenantId] || [];
      const tenants = prev.tenants.map((t) =>
        t.id === tenantId ? { ...t, activeSeats: Math.max(1, t.activeSeats - 1) } : t
      );
      return {
        ...prev,
        tenants,
        tenantUsers: {
          ...prev.tenantUsers,
          [tenantId]: users.filter((u) => u.id !== userId),
        },
      };
    });
  };

  // Invite Assist (Story 6.10)
  const inviteCandidate = (candidateId: string, role: 'tenant_admin' | 'tenant_user') => {
    setState((prev) => {
      const candidates = prev.inviteCandidates[tenantId] || [];
      const target = candidates.find((c) => c.id === candidateId);
      if (!target) return prev;

      const newUser: TenantUser = {
        id: `usr-${candidateId}`,
        name: target.name,
        email: target.email,
        role,
        status: 'Active',
        accessEndsAt: null,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };

      const updatedCandidates = candidates.map((c) =>
        c.id === candidateId ? { ...c, status: 'invited' as const } : c
      );

      const users = prev.tenantUsers[tenantId] || [];
      const tenants = prev.tenants.map((t) =>
        t.id === tenantId ? { ...t, activeSeats: t.activeSeats + 1 } : t
      );

      return {
        ...prev,
        tenants,
        inviteCandidates: {
          ...prev.inviteCandidates,
          [tenantId]: updatedCandidates,
        },
        tenantUsers: {
          ...prev.tenantUsers,
          [tenantId]: [newUser, ...users],
        },
      };
    });
  };

  const dismissCandidate = (candidateId: string) => {
    setState((prev) => {
      const candidates = prev.inviteCandidates[tenantId] || [];
      const updated = candidates.map((c) =>
        c.id === candidateId ? { ...c, status: 'dismissed' as const } : c
      );
      return {
        ...prev,
        inviteCandidates: {
          ...prev.inviteCandidates,
          [tenantId]: updated,
        },
      };
    });
  };

  // Tenant Settings & Offboarding (ADR-0043)
  const requestTenantDeletion = () => {
    const graceEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setState((prev) => {
      const tenants = prev.tenants.map((t) => {
        if (t.id === tenantId) {
          return {
            ...t,
            deletionRequest: {
              requestedAt: new Date().toISOString(),
              requestedBy: session.email,
              graceEndsAt,
              status: 'grace_period' as const,
            },
          };
        }
        return t;
      });
      return { ...prev, tenants };
    });
  };

  const cancelTenantDeletion = () => {
    setState((prev) => {
      const tenants = prev.tenants.map((t) => {
        if (t.id === tenantId) {
          const copy = { ...t };
          delete copy.deletionRequest;
          return copy;
        }
        return t;
      });
      return { ...prev, tenants };
    });
  };

  const confirmFinalTenantDeletion = () => {
    setState((prev) => {
      const tenants = prev.tenants.filter((t) => t.id !== tenantId);
      const remainingConnectors = { ...prev.connectors };
      delete remainingConnectors[tenantId];
      const remainingWatchlists = { ...prev.watchlists };
      delete remainingWatchlists[tenantId];
      const remainingPosts = { ...prev.posts };
      delete remainingPosts[tenantId];
      const remainingUsers = { ...prev.tenantUsers };
      delete remainingUsers[tenantId];

      return {
        ...prev,
        tenants,
        connectors: remainingConnectors,
        watchlists: remainingWatchlists,
        posts: remainingPosts,
        tenantUsers: remainingUsers,
        currentSession: {
          id: '',
          name: 'Anonymous',
          email: '',
          role: 'unauthenticated',
          tenantId: null,
          tenantName: null,
          isAuthenticated: false,
        },
      };
    });
    setActiveRoute('/signed-out');
  };

  const exportTenantData = (format: 'json' | 'csv') => {
    const payload = {
      tenant: activeTenant,
      connectors,
      watchlists,
      posts,
      users: tenantUsers,
      exportedAt: new Date().toISOString(),
    };

    let blob: Blob;
    let filename: string;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      filename = `socialengage_${activeTenant?.domain || 'workspace'}_export_${Date.now()}.json`;
    } else {
      const headers = 'ID,Title,Provider,Author,Sentiment,PublishedAt,URL\n';
      const rows = posts
        .map(
          (p) =>
            `"${p.id}","${p.title.replace(/"/g, '""')}","${p.provider}","${p.author}","${p.enrichment.sentiment}","${p.publishedAt}","${p.url}"`
        )
        .join('\n');
      blob = new Blob([headers + rows], { type: 'text/csv' });
      filename = `socialengage_posts_${activeTenant?.domain || 'workspace'}_${Date.now()}.csv`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Platform Admin Management
  const refreshDbHealth = () => {
    setState((prev) => ({
      ...prev,
      dbHealth: {
        ...prev.dbHealth,
        latencyMs: Math.floor(Math.random() * 5) + 3,
        timestamp: new Date().toISOString(),
      },
    }));
  };

  const provisionTenant = (data: {
    name: string;
    domain: string;
    plan: 'Enterprise' | 'Scale' | 'Pro';
    licenseSeats: number;
    adminEmail: string;
  }) => {
    const newTenantId = `ten-${data.domain.replace(/[^a-z0-9]/gi, '').slice(0, 8)}-${Date.now().toString().slice(-4)}`;
    const newTenant: Tenant = {
      id: newTenantId,
      name: data.name,
      domain: data.domain,
      status: 'active',
      plan: data.plan,
      licenseSeats: data.licenseSeats,
      activeSeats: 1,
      createdAt: new Date().toISOString(),
      isolationMode: 'row_level_security',
    };

    const adminUser: TenantUser = {
      id: `usr-admin-${Date.now().toString().slice(-4)}`,
      name: `Admin (${data.domain.split('.')[0]})`,
      email: data.adminEmail,
      role: 'tenant_admin',
      status: 'Active',
      accessEndsAt: null,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      tenants: [newTenant, ...prev.tenants],
      connectors: {
        ...prev.connectors,
        [newTenantId]: [
          {
            id: `conn-gnews-${newTenantId}`,
            tenantId: newTenantId,
            platformId: 'gnews',
            name: 'GNews API Service',
            category: 'News Ingestion',
            description: 'Real-time global news monitoring with keyword and topic filtering',
            status: 'healthy',
            isActive: true,
            lastSuccessfulFetch: new Date().toISOString(),
            lastAttempt: new Date().toISOString(),
            consecutiveFailures: 0,
            config: { apiKeyMasked: 'gn_live_••••••••3821' },
          },
          {
            id: `conn-newswire-${newTenantId}`,
            tenantId: newTenantId,
            platformId: 'newswire',
            name: 'Global Newswire Feeds',
            category: 'Press Ingestion',
            description: 'Public syndicated enterprise press releases and regulatory disclosures',
            status: 'healthy',
            isActive: true,
            lastSuccessfulFetch: new Date().toISOString(),
            lastAttempt: new Date().toISOString(),
            consecutiveFailures: 0,
            config: {},
          },
        ],
      },
      watchlists: {
        ...prev.watchlists,
        [newTenantId]: [
          {
            id: `wl-${Date.now().toString().slice(-4)}`,
            tenantId: newTenantId,
            name: `${data.name} Brand Mentions`,
            matchType: 'Keyword',
            query: `${data.name}, Industry, Cloud`,
            terms: [data.name, 'Industry', 'Cloud'],
            platforms: ['GNews', 'Newswire'],
            isActive: true,
            createdAt: new Date().toISOString(),
            owner: adminUser.name,
            matchedPostsCount: 0,
          },
        ],
      },
      posts: {
        ...prev.posts,
        [newTenantId]: [],
      },
      tenantUsers: {
        ...prev.tenantUsers,
        [newTenantId]: [adminUser],
      },
      inviteCandidates: {
        ...prev.inviteCandidates,
        [newTenantId]: [],
      },
      auditLogs: [
        {
          id: `aud-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString(),
          actor: session.email || 'platform.admin@socialengage.platform',
          operation: 'tenant_create',
          targetTenant: data.name,
          targetTenantId: newTenantId,
          details: `Provisioned tenant with ${data.plan} plan (${data.licenseSeats} seats)`,
          ipAddress: '198.51.100.14',
        },
        ...prev.auditLogs,
      ],
    }));
  };

  const setTenantStatus = (tenantIdToUpdate: string, status: 'active' | 'suspended') => {
    setState((prev) => {
      const tenants = prev.tenants.map((t) =>
        t.id === tenantIdToUpdate ? { ...t, status } : t
      );
      const target = prev.tenants.find((t) => t.id === tenantIdToUpdate);
      return {
        ...prev,
        tenants,
        auditLogs: [
          {
            id: `aud-${Date.now().toString().slice(-4)}`,
            timestamp: new Date().toISOString(),
            actor: session.email || 'platform.admin@socialengage.platform',
            operation: status === 'suspended' ? 'tenant_suspend' : 'tenant_reactivate',
            targetTenant: target?.name || tenantIdToUpdate,
            targetTenantId: tenantIdToUpdate,
            details: `Tenant status updated to ${status}`,
            ipAddress: '198.51.100.14',
          },
          ...prev.auditLogs,
        ],
      };
    });
  };

  const updateTenantStatus = setTenantStatus;

  const updateTenantSeats = (tenantIdToUpdate: string, count: number) => {
    setState((prev) => {
      const tenants = prev.tenants.map((t) =>
        t.id === tenantIdToUpdate ? { ...t, licenseSeats: count } : t
      );
      const target = prev.tenants.find((t) => t.id === tenantIdToUpdate);
      return {
        ...prev,
        tenants,
        auditLogs: [
          {
            id: `aud-${Date.now().toString().slice(-4)}`,
            timestamp: new Date().toISOString(),
            actor: session.email || 'platform.admin@socialengage.platform',
            operation: 'license_seats_update',
            targetTenant: target?.name || tenantIdToUpdate,
            targetTenantId: tenantIdToUpdate,
            details: `Adjusted licensed seats quota to ${count}`,
            ipAddress: '198.51.100.14',
          },
          ...prev.auditLogs,
        ],
      };
    });
  };

  const updateTenantLicenseSeats = updateTenantSeats;

  const updateTenantName = (tenantIdToUpdate: string, name: string) => {
    setState((prev) => {
      const tenants = prev.tenants.map((t) =>
        t.id === tenantIdToUpdate ? { ...t, name } : t
      );
      return { ...prev, tenants };
    });
  };

  const createBreakGlassRequest = (targetTenantId: string, reason: string): string => {
    const requestId = `bg-${Date.now().toString().slice(-4)}`;
    const targetTenant = state.tenants.find((t) => t.id === targetTenantId);

    const newRequest: BreakGlassRequest = {
      id: requestId,
      tenantId: targetTenantId,
      tenantName: targetTenant?.name || targetTenantId,
      requestedBy: session.email || 'platform.admin@socialengage.platform',
      reason,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    const newLog: PlatformAdminAuditLog = {
      id: `aud-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      actor: session.email || 'platform.admin@socialengage.platform',
      operation: 'break_glass_request',
      targetTenant: targetTenant?.name || targetTenantId,
      targetTenantId,
      details: `Break-glass emergency access requested. Reason: "${reason}"`,
      ipAddress: '198.51.100.14',
    };

    setState((prev) => ({
      ...prev,
      breakGlassRequests: [newRequest, ...prev.breakGlassRequests],
      auditLogs: [newLog, ...prev.auditLogs],
    }));

    return requestId;
  };

  const executeBreakGlassRequest = async (requestId: string): Promise<string> => {
    await new Promise((r) => setTimeout(r, 1000));
    const generatedTap = `TAP-SECURE-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    const targetReq = state.breakGlassRequests.find((r) => r.id === requestId);

    const newLog: PlatformAdminAuditLog = {
      id: `aud-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      actor: session.email || 'platform.admin@socialengage.platform',
      operation: 'break_glass_execute',
      targetTenant: targetReq?.tenantName || 'Unknown Tenant',
      targetTenantId: targetReq?.tenantId || 'ten-unknown',
      details: `Break-glass Temporary Access Pass (TAP) generated under emergency protocol`,
      ipAddress: '198.51.100.14',
    };

    setState((prev) => ({
      ...prev,
      breakGlassRequests: prev.breakGlassRequests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'executed' as const,
              executedAt: new Date().toISOString(),
              temporaryAccessPass: generatedTap,
            }
          : r
      ),
      auditLogs: [newLog, ...prev.auditLogs],
    }));

    return generatedTap;
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(loadState());
    setActiveRoute('/tenant');
  };

  const value: AppContextType = {
    state,
    session,
    activeRoute,
    activeTenant,
    allTenants,
    connectors,
    watchlists,
    posts,
    tenantUsers,
    inviteCandidates,
    auditLogs,
    dbHealth,
    breakGlassRequests,
    navigateTo,
    setSessionRole,
    switchTenant,
    signOut,
    signInAs,
    completeSignUp,
    toggleConnectorActive,
    updateConnectorConfig,
    connectPlatform,
    disconnectPlatform,
    verifyTenantOwnedDns,
    createWatchlist,
    updateWatchlist,
    deleteWatchlist,
    toggleWatchlistActive,
    enrichPost,
    inviteTenantUser,
    updateUserAccessPeriod,
    removeTenantUser,
    inviteCandidate,
    dismissCandidate,
    requestTenantDeletion,
    cancelTenantDeletion,
    confirmFinalTenantDeletion,
    exportTenantData,
    refreshDbHealth,
    provisionTenant,
    setTenantStatus,
    updateTenantStatus,
    updateTenantSeats,
    updateTenantLicenseSeats,
    updateTenantName,
    createBreakGlassRequest,
    executeBreakGlassRequest,
    resetDemoData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
