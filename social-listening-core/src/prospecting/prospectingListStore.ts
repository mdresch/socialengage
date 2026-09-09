import { getPool } from '../db/pool';
import { withTenant } from '../db/withTenant';
import { PoolClient } from 'pg';

function toScore(v: any): number | null {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function resolveAuthorPublicUrl(raw: Record<string, any>, handle?: string, platform = 'generic'): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  if (raw.authorPublicUrl) return String(raw.authorPublicUrl);
  if (raw.url) return String(raw.url);
  if (raw.profileUrl) return String(raw.profileUrl);
  if (raw.profile_url) return String(raw.profile_url);

  const p = (platform || 'generic').toLowerCase();
  const h = (handle || raw.handle || raw.authorHandle || '').replace(/^@/, '');

  if (p === 'twitter' || p === 'x') {
    return h ? `https://x.com/${h}` : undefined;
  }
  if (p === 'linkedin') {
    return h ? `https://www.linkedin.com/in/${h}` : undefined;
  }
  if (p === 'instagram') {
    return h ? `https://www.instagram.com/${h}/` : undefined;
  }
  if (p === 'threads') {
    return h ? `https://www.threads.net/@${h}` : undefined;
  }
  if (p === 'facebook') {
    return h ? `https://www.facebook.com/${h}` : undefined;
  }

  return undefined;
}

export type SharingScope = 'private' | 'workspace_read' | 'workspace_write';

export interface ProspectingList {
  id: string;
  tenant_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  shared: boolean;
  sharing_scope: SharingScope;
  created_at: string;
  updated_at: string;
}

export interface ProspectingListEntry {
  id: string;
  prospecting_list_id: string;
  tenant_id: string;
  author_id: string;
  author_name: string | null;
  platform_id: string;
  public_url: string | null;
  topic: string | null;
  engagement_score: string | null;
  authenticity_score: string | null;
  influence_score: string | null;
  reach_score: string | null;
  relationship_stage: 'new' | 'contacted' | 'engaged' | 'converted' | 'passed';
  notes: string | null;
  tags: string[];
  custom_attributes: Record<string, any>;
  added_by_user_id: string;
  added_at: string;
  updated_at: string;
}

export interface CreateProspectingListInput {
  name: string;
  description?: string | null;
  shared?: boolean;
  sharingScope?: SharingScope;
}

export interface UpdateProspectingListInput {
  name?: string;
  description?: string | null;
  shared?: boolean;
  sharingScope?: SharingScope;
}

export interface CreateEntryInput {
  author_id: string;
  platform_id?: string;
  author_name?: string | null;
  public_url?: string | null;
  topic?: string | null;
  engagement_score?: number | null;
  authenticity_score?: number | null;
  influence_score?: number | null;
  reach_score?: number | null;
  relationship_stage?: 'new' | 'contacted' | 'engaged' | 'converted' | 'passed';
  notes?: string | null;
  tags?: string[];
  custom_attributes?: Record<string, any>;
}

export interface UpdateEntryInput {
  relationship_stage?: 'new' | 'contacted' | 'engaged' | 'converted' | 'passed';
  notes?: string | null;
  tags?: string[];
  custom_attributes?: Record<string, any>;
}

export async function createProspectingList(
  tenantId: string,
  userId: string,
  input: CreateProspectingListInput
): Promise<ProspectingList> {
  return withTenant<ProspectingList>(
    tenantId,
    async (client: PoolClient) => {
      let sharingScope: SharingScope = 'private';
      let isShared = false;

      if (input.sharingScope) {
        sharingScope = input.sharingScope;
        isShared = sharingScope !== 'private';
      } else if (input.shared) {
        sharingScope = 'workspace_read';
        isShared = true;
      }

      const { rows } = await client.query(
        `INSERT INTO prospecting_lists (tenant_id, owner_id, name, description, shared, sharing_scope, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())
         RETURNING *`,
        [tenantId, userId, input.name.trim(), input.description?.trim() || null, isShared, sharingScope]
      );
      return rows[0] as ProspectingList;
    },
    getPool(),
    userId
  );
}

export async function listProspectingLists(
  tenantId: string,
  userId: string
): Promise<ProspectingList[]> {
  return withTenant<ProspectingList[]>(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query(
        `SELECT * FROM prospecting_lists
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenantId]
      );
      return rows as ProspectingList[];
    },
    getPool(),
    userId
  );
}

export async function getProspectingList(
  tenantId: string,
  userId: string,
  listId: string
): Promise<ProspectingList | null> {
  return withTenant<ProspectingList | null>(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query(
        `SELECT * FROM prospecting_lists
         WHERE id = $1 AND tenant_id = $2`,
        [listId, tenantId]
      );
      return (rows[0] as ProspectingList) || null;
    },
    getPool(),
    userId
  );
}

export async function updateProspectingList(
  tenantId: string,
  userId: string,
  listId: string,
  input: UpdateProspectingListInput
): Promise<ProspectingList | null> {
  return withTenant<ProspectingList | null>(
    tenantId,
    async (client: PoolClient) => {
      const fields: string[] = [];
      const values: any[] = [listId, tenantId];
      let idx = 3;

      if (input.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(input.name.trim());
      }
      if (input.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(input.description?.trim() || null);
      }
      if (input.sharingScope !== undefined) {
        fields.push(`sharing_scope = $${idx++}`);
        values.push(input.sharingScope);
        fields.push(`shared = $${idx++}`);
        values.push(input.sharingScope !== 'private');
      } else if (input.shared !== undefined) {
        fields.push(`shared = $${idx++}`);
        values.push(input.shared);
        fields.push(`sharing_scope = $${idx++}`);
        values.push(input.shared ? 'workspace_read' : 'private');
      }

      if (fields.length === 0) {
        const { rows } = await client.query(
          `SELECT * FROM prospecting_lists WHERE id = $1 AND tenant_id = $2`,
          [listId, tenantId]
        );
        return (rows[0] as ProspectingList) || null;
      }

      fields.push(`updated_at = now()`);

      const { rows } = await client.query(
        `UPDATE prospecting_lists
         SET ${fields.join(', ')}
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        values
      );
      return (rows[0] as ProspectingList) || null;
    },
    getPool(),
    userId
  );
}

export async function updateProspectingListScope(
  tenantId: string,
  userId: string,
  listId: string,
  sharingScope: SharingScope
): Promise<ProspectingList | null> {
  return withTenant<ProspectingList | null>(
    tenantId,
    async (client: PoolClient) => {
      const isShared = sharingScope !== 'private';
      const { rows } = await client.query(
        `UPDATE prospecting_lists
         SET sharing_scope = $1, shared = $2, updated_at = now()
         WHERE id = $3 AND tenant_id = $4 AND owner_id = $5
         RETURNING *`,
        [sharingScope, isShared, listId, tenantId, userId]
      );
      return (rows[0] as ProspectingList) || null;
    },
    getPool(),
    userId
  );
}

export async function deleteProspectingList(
  tenantId: string,
  userId: string,
  listId: string
): Promise<boolean> {
  return withTenant<boolean>(
    tenantId,
    async (client: PoolClient) => {
      const { rowCount } = await client.query(
        `DELETE FROM prospecting_lists
         WHERE id = $1 AND tenant_id = $2`,
        [listId, tenantId]
      );
      return (rowCount ?? 0) > 0;
    },
    getPool(),
    userId
  );
}

export async function addEntry(
  tenantId: string,
  userId: string,
  listId: string,
  input: CreateEntryInput
): Promise<ProspectingListEntry> {
  return withTenant<ProspectingListEntry>(
    tenantId,
    async (client: PoolClient) => {
      const platformId = input.platform_id || 'unknown';
      const stage = input.relationship_stage || 'new';

      // Resolve author metadata for the entry snapshot so export and CRM
      // payloads can be built from the entry row without leaking PII.
      const authorRes = await client.query(
        `SELECT display_name, handle, raw_profile, engagement_score, authenticity_score, influence_score, reach_score
         FROM authors WHERE id = $1`,
        [input.author_id]
      );
      const author = authorRes.rows[0];
      const authorName = input.author_name ?? (author ? (author.display_name || author.handle || 'Unknown') : 'Unknown');
      const publicUrl = input.public_url ?? (author ? resolveAuthorPublicUrl(author.raw_profile, author.handle, platformId) : undefined);

      const scores = author
        ? {
            engagement: input.engagement_score ?? toScore(author.engagement_score),
            authenticity: input.authenticity_score ?? toScore(author.authenticity_score),
            influence: input.influence_score ?? toScore(author.influence_score),
            reach: input.reach_score ?? toScore(author.reach_score),
          }
        : {
            engagement: input.engagement_score ?? null,
            authenticity: input.authenticity_score ?? null,
            influence: input.influence_score ?? null,
            reach: input.reach_score ?? null,
          };

      const { rows } = await client.query(
        `INSERT INTO prospecting_list_entries (
          prospecting_list_id, tenant_id, author_id, author_name, platform_id, public_url, topic,
          engagement_score, authenticity_score, influence_score, reach_score,
          relationship_stage, notes, tags, custom_attributes,
          added_by_user_id, added_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now())
        RETURNING *`,
        [
          listId,
          tenantId,
          input.author_id,
          authorName,
          platformId,
          publicUrl ?? null,
          input.topic || null,
          scores.engagement,
          scores.authenticity,
          scores.influence,
          scores.reach,
          stage,
          input.notes || null,
          input.tags || [],
          JSON.stringify(input.custom_attributes || {}),
          userId,
        ]
      );
      return rows[0] as ProspectingListEntry;
    },
    getPool(),
    userId
  );
}

export async function listEntries(
  tenantId: string,
  userId: string,
  listId: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<{ entries: ProspectingListEntry[]; nextCursor: string | null }> {
  return withTenant<{ entries: ProspectingListEntry[]; nextCursor: string | null }>(
    tenantId,
    async (client: PoolClient) => {
      const limit = Math.min(200, Math.max(1, options.limit ?? 50));
      const params: any[] = [listId, tenantId, limit + 1];
      let query = `
        SELECT * FROM prospecting_list_entries
        WHERE prospecting_list_id = $1 AND tenant_id = $2
      `;

      if (options.cursor) {
        query += ` AND added_at < $4`;
        params.push(options.cursor);
      }

      query += ` ORDER BY added_at DESC LIMIT $3`;

      const { rows } = await client.query(query, params);
      const resultRows = rows as ProspectingListEntry[];
      const hasMore = resultRows.length > limit;
      const resultEntries = hasMore ? resultRows.slice(0, limit) : resultRows;
      const nextCursor = hasMore && resultEntries.length > 0
        ? resultEntries[resultEntries.length - 1].added_at
        : null;

      return { entries: resultEntries, nextCursor };
    },
    getPool(),
    userId
  );
}

export async function updateEntry(
  tenantId: string,
  userId: string,
  listId: string,
  entryId: string,
  input: UpdateEntryInput
): Promise<ProspectingListEntry | null> {
  return withTenant<ProspectingListEntry | null>(
    tenantId,
    async (client: PoolClient) => {
      const fields: string[] = [];
      const values: any[] = [entryId, listId, tenantId];
      let idx = 4;

      if (input.relationship_stage !== undefined) {
        fields.push(`relationship_stage = $${idx++}`);
        values.push(input.relationship_stage);
      }
      if (input.notes !== undefined) {
        fields.push(`notes = $${idx++}`);
        values.push(input.notes);
      }
      if (input.tags !== undefined) {
        fields.push(`tags = $${idx++}`);
        values.push(input.tags);
      }
      if (input.custom_attributes !== undefined) {
        fields.push(`custom_attributes = $${idx++}`);
        values.push(JSON.stringify(input.custom_attributes));
      }

      if (fields.length === 0) {
        const { rows } = await client.query(
          `SELECT * FROM prospecting_list_entries WHERE id = $1 AND prospecting_list_id = $2 AND tenant_id = $3`,
          [entryId, listId, tenantId]
        );
        return (rows[0] as ProspectingListEntry) || null;
      }

      fields.push(`updated_at = now()`);

      const { rows } = await client.query(
        `UPDATE prospecting_list_entries
         SET ${fields.join(', ')}
         WHERE id = $1 AND prospecting_list_id = $2 AND tenant_id = $3
         RETURNING *`,
        values
      );
      return (rows[0] as ProspectingListEntry) || null;
    },
    getPool(),
    userId
  );
}

export async function deleteEntry(
  tenantId: string,
  userId: string,
  listId: string,
  entryId: string
): Promise<boolean> {
  return withTenant<boolean>(
    tenantId,
    async (client: PoolClient) => {
      const { rowCount } = await client.query(
        `DELETE FROM prospecting_list_entries
         WHERE id = $1 AND prospecting_list_id = $2 AND tenant_id = $3`,
        [entryId, listId, tenantId]
      );
      return (rowCount ?? 0) > 0;
    },
    getPool(),
    userId
  );
}

/**
 * Loads all entries for a list for export or CRM handoff. The caller must
 * have already verified list ownership/authorization.
 */
export async function listEntriesForExport(
  tenantId: string,
  userId: string,
  listId: string,
  options: { entryIds?: string[]; limit?: number } = {}
): Promise<{ entries: ProspectingListEntry[]; total: number }> {
  return withTenant<{ entries: ProspectingListEntry[]; total: number }>(
    tenantId,
    async (client: PoolClient) => {
      const countRes = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM prospecting_list_entries
         WHERE prospecting_list_id = $1 AND tenant_id = $2`,
        [listId, tenantId]
      );

      const limit = options.limit ? Math.max(1, options.limit) : undefined;
      const params: any[] = [listId, tenantId];
      let query = `SELECT * FROM prospecting_list_entries
                   WHERE prospecting_list_id = $1 AND tenant_id = $2`;
      let paramIndex = 3;

      if (options.entryIds && options.entryIds.length > 0) {
        query += ` AND id = ANY($${paramIndex++}::uuid[])`;
        params.push(options.entryIds);
      }

      query += ` ORDER BY added_at ASC`;
      if (limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(limit);
      }

      const { rows } = await client.query(query, params);
      return { entries: rows as ProspectingListEntry[], total: countRes.rows[0].count };
    },
    getPool(),
    userId
  );
}
