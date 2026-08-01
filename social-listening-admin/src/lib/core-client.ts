/**
 * The sole sanctioned path from social-listening-admin to social-listening-core (ADR-0001).
 * Every call reaches core over HTTP against a configurable base URL — never a database
 * driver, never an in-process import of core's source. See
 * .claude/skills/core-api-client/SKILL.md before adding calls here.
 */

function coreBaseUrl(): string {
  const baseUrl = process.env.CORE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('CORE_API_BASE_URL is not set — social-listening-admin cannot reach social-listening-core.');
  }
  return baseUrl;
}

/**
 * Placeholder call proving the REST-only mechanism works end to end. Real endpoint
 * calls (connect/disconnect a platform, manage watchlists, connector status, ...)
 * are added here as Phase 1 stories build the corresponding core routes and admin
 * features — see docs/implementation-plan.md. Path is under /v1/ per ADR-0017
 * (Story 1.3) — every core route lives behind a version prefix, no exceptions.
 */
export async function checkCoreHealth(): Promise<Response> {
  return fetch(`${coreBaseUrl()}/v1/health`);
}

// Phase 1 "also build, not storied" work — connector credential management
export interface ConnectPlatformRequest {
  credential: string;
}

export interface ConnectPlatformResponse {
  id: string;
  platformId: string;
  authMethod: string;
}

export interface DisconnectPlatformResponse {
  status: string;
  platformId: string;
}

/** Connect a platform for the current tenant (Story 1.6) */
export async function connectPlatform(
  platformId: string,
  request: ConnectPlatformRequest
): Promise<ConnectPlatformResponse> {
  const response = await fetch(`${coreBaseUrl()}/v1/connectors/${platformId}/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': localStorage.getItem('tenantId') || '',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to connect platform: ${response.statusText}`);
  }
  return response.json();
}

/** Disconnect a platform for the current tenant (Story 1.6) */
export async function disconnectPlatform(platformId: string): Promise<DisconnectPlatformResponse> {
  const response = await fetch(`${coreBaseUrl()}/v1/connectors/${platformId}/disconnect`, {
    method: 'DELETE',
    headers: {
      'X-Tenant-Id': localStorage.getItem('tenantId') || '',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to disconnect platform: ${response.statusText}`);
  }
  return response.json();
}

// Phase 1 "also build, not storied" work — watchlist CRUD (Story 1.5)
export interface Watchlist {
  id: string;
  tenantId: string;
  name: string;
  matchType: 'keyword' | 'hashtag' | 'account' | 'boolean';
  terms: string[];
  booleanQuery?: string;
  isActive: boolean;
  platformIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWatchlistRequest {
  name: string;
  matchType: 'keyword' | 'hashtag' | 'account' | 'boolean';
  terms: string[];
  booleanQuery?: string;
  isActive?: boolean;
  platformIds?: string[];
}

export interface UpdateWatchlistRequest {
  name?: string;
  matchType?: 'keyword' | 'hashtag' | 'account' | 'boolean';
  terms?: string[];
  booleanQuery?: string;
  isActive?: boolean;
  platformIds?: string[];
}

/** Get all watchlists for the current tenant (Story 1.5) */
export async function getWatchlists(): Promise<Watchlist[]> {
  const response = await fetch(`${coreBaseUrl()}/v1/watchlists`, {
    headers: {
      'X-Tenant-Id': localStorage.getItem('tenantId') || '',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to get watchlists: ${response.statusText}`);
  }
  return response.json();
}

/** Create a watchlist for the current tenant (Story 1.5) */
export async function createWatchlist(request: CreateWatchlistRequest): Promise<Watchlist> {
  const response = await fetch(`${coreBaseUrl()}/v1/watchlists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': localStorage.getItem('tenantId') || '',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to create watchlist: ${response.statusText}`);
  }
  return response.json();
}

/** Update a watchlist for the current tenant (Story 1.5) */
export async function updateWatchlist(
  id: string,
  request: UpdateWatchlistRequest
): Promise<Watchlist> {
  const response = await fetch(`${coreBaseUrl()}/v1/watchlists/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': localStorage.getItem('tenantId') || '',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to update watchlist: ${response.statusText}`);
  }
  return response.json();
}

/** Delete a watchlist for the current tenant (Story 1.5) */
export async function deleteWatchlist(id: string): Promise<void> {
  const response = await fetch(`${coreBaseUrl()}/v1/watchlists/${id}`, {
    method: 'DELETE',
    headers: {
      'X-Tenant-Id': localStorage.getItem('tenantId') || '',
    },
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete watchlist: ${response.statusText}`);
  }
}

// Connector health (Story 4.3)
export interface ConnectorHealth {
  platformId: string;
  status: string;
  lastSuccess?: string;
  lastFailure?: string;
  consecutiveFailures: number;
}

/** Get health status for a connector (Story 4.3) */
export async function getConnectorHealth(platformId: string): Promise<ConnectorHealth> {
  const tenantId = localStorage.getItem('tenantId') || '';
  const response = await fetch(`${coreBaseUrl()}/v1/connectors/${platformId}`, {
    headers: {
      'X-Tenant-Id': tenantId,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to get connector health: ${response.statusText}`);
  }
  return response.json();
}
