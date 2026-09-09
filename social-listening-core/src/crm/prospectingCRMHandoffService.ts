import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { PoolClient } from 'pg';
import { getCRMConnector } from '../connectors/crm/crmRegistry';
import { CRMConnectorContext, CRMProspectPushResult, ProspectingListEntryPayload } from '../connectors/crm/types';
import { listEntriesForExport, ProspectingListEntry } from '../prospecting/prospectingListStore';
import { readCRMCredential } from './crmCredentialStore';
import {
  clusterDeduplicatedContacts,
  deduplicatedContactToPayload,
} from '../prospecting/prospectingDeduplicationEngine';

export interface PushProspectsInput {
  tenantId: string;
  userId: string;
  listId: string;
  crmConnectorId: string;
  selectedEntryIds?: string[];
  customFields?: Record<string, any>;
  deduplicate?: boolean;
}

export interface PushProspectsResponse {
  outboundActivityIds: string[];
  pushedCount: number;
  skippedCount: number;
  rawEntriesCount?: number;
  deduplicatedContactsCount?: number;
  crmUrl?: string;
}

const BATCH_SIZE = 50;

function toProspectPayload(entry: ProspectingListEntry, customFields?: Record<string, any>): ProspectingListEntryPayload {
  return {
    entryId: entry.id,
    authorId: entry.author_id,
    authorName: entry.author_name || 'Unknown',
    platformId: entry.platform_id,
    publicUrl: entry.public_url || undefined,
    topic: entry.topic || '',
    engagementScore: Number(entry.engagement_score) || 0,
    authenticityScore: Number(entry.authenticity_score) || 0,
    influenceScore: Number(entry.influence_score) || 0,
    relationshipStage: entry.relationship_stage,
    notes: entry.notes || '',
    tags: entry.tags || [],
    customFields,
  };
}

async function resolveRePushExternalIds(
  tenantId: string,
  crmConnectorId: string,
  entries: ProspectingListEntry[]
): Promise<Record<string, string>> {
  if (entries.length === 0) return {};

  return withTenant<Record<string, string>>(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query<{ author_id: string; external_id: string }>(
        `SELECT DISTINCT ON (author_id) author_id, external_id
         FROM outbound_activities
         WHERE tenant_id = $1
           AND provider_id = $2
           AND activity_type = 'crm_prospect'
           AND status = 'sent'
           AND author_id = ANY($3::uuid[])
         ORDER BY author_id, created_at DESC`,
        [tenantId, crmConnectorId, entries.map((e) => e.author_id)]
      );
      const map: Record<string, string> = {};
      for (const row of rows) {
        if (row.external_id) {
          map[row.author_id] = row.external_id;
        }
      }
      return map;
    },
    getPool()
  );
}

export async function pushProspectsToCRM(input: PushProspectsInput): Promise<PushProspectsResponse> {
  const { tenantId, userId, listId, crmConnectorId, selectedEntryIds, customFields, deduplicate } = input;

  const connector = getCRMConnector(crmConnectorId);
  if (!connector) {
    throw new Error(`Unsupported or unconfigured CRM connector: ${crmConnectorId}`);
  }

  if (!connector.pushProspectsBatch) {
    throw new Error(`CRM connector ${crmConnectorId} does not support prospect batch push`);
  }

  const { entries } = await listEntriesForExport(tenantId, userId, listId, {
    entryIds: selectedEntryIds,
  });

  if (entries.length === 0) {
    return { outboundActivityIds: [], pushedCount: 0, skippedCount: 0 };
  }

  const credentials = await readCRMCredential(tenantId, crmConnectorId);
  const ctx: CRMConnectorContext = { tenantId, credentials: credentials ?? undefined };
  const rePushByExternalId = await resolveRePushExternalIds(tenantId, crmConnectorId, entries);

  let payloads: ProspectingListEntryPayload[];

  if (deduplicate) {
    // Query author metadata to assist handle resolution
    const authors = await withTenant<Array<{ id: string; handle: string; display_name: string }>>(
      tenantId,
      async (client: PoolClient) => {
        const { rows } = await client.query<{ id: string; handle: string; display_name: string }>(
          `SELECT id, handle, display_name FROM authors WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
          [tenantId, entries.map((e) => e.author_id)]
        );
        return rows;
      },
      getPool()
    );

    const authorMeta: Record<string, { handle?: string; displayName?: string }> = {};
    for (const a of authors) {
      authorMeta[a.id] = { handle: a.handle, displayName: a.display_name };
    }

    const clusters = clusterDeduplicatedContacts(entries, authorMeta);
    payloads = clusters.map((c) => deduplicatedContactToPayload(c, customFields));
  } else {
    payloads = entries.map((entry) => toProspectPayload(entry, customFields));
  }

  const chunks: ProspectingListEntryPayload[][] = [];
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    chunks.push(payloads.slice(i, i + BATCH_SIZE));
  }

  const results: CRMProspectPushResult[] = [];
  for (const chunk of chunks) {
    const chunkResults = await connector.pushProspectsBatch(ctx, chunk, { rePushByExternalId });
    results.push(...chunkResults);
  }

  const credentialId = credentials
    ? await withTenant<string | null>(
        tenantId,
        async (client: PoolClient) => {
          const { rows } = await client.query<{ id: string }>(
            `SELECT id FROM crm_credentials WHERE tenant_id = $1 AND crm_connector_id = $2`,
            [tenantId, crmConnectorId]
          );
          return rows[0]?.id ?? null;
        },
        getPool()
      )
    : null;

  const outboundActivityIds = await withTenant<string[]>(
    tenantId,
    async (client: PoolClient) => {
      const ids: string[] = [];
      for (let i = 0; i < payloads.length; i++) {
        const payloadItem = payloads[i];
        const result = results[i] ?? {
          entryId: payloadItem.entryId,
          crmRecordId: 'unknown',
          crmRecordUrl: '',
          entityType: 'lead',
        };

        const body = `${payloadItem.topic || ''}\n\n${payloadItem.notes || ''}`.trim() || 'Prospecting list handoff';
        const payload = {
          prospectingListId: listId,
          entryId: payloadItem.entryId,
          entryIds: payloadItem.entryIds || [payloadItem.entryId],
          authorId: payloadItem.authorId,
          platformId: payloadItem.platformId,
          topic: payloadItem.topic,
          engagementScore: Number(payloadItem.engagementScore) || 0,
          authenticityScore: Number(payloadItem.authenticityScore) || 0,
          influenceScore: Number(payloadItem.influenceScore) || 0,
          relationshipStage: payloadItem.relationshipStage,
          tags: payloadItem.tags,
          crmConnectorId,
          customFields: customFields ?? null,
          matchedHandles: payloadItem.matchedHandles,
        };

        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO outbound_activities (
             tenant_id, post_id, author_id, user_id, provider_id, credential_id,
             activity_type, body, payload, status, external_id, external_url, created_at, sent_at
           )
           VALUES ($1, NULL, $2, $3, $4, $5, 'crm_prospect', $6, $7, 'sent', $8, $9, now(), now())
           RETURNING id`,
          [
            tenantId,
            payloadItem.authorId,
            userId,
            crmConnectorId,
            credentialId,
            body,
            JSON.stringify(payload),
            result.crmRecordId,
            result.crmRecordUrl,
          ]
        );
        ids.push(rows[0].id);
      }
      return ids;
    },
    getPool(),
    userId
  );

  const crmUrl = results.find((r) => r.crmRecordUrl)?.crmRecordUrl;

  return {
    outboundActivityIds,
    pushedCount: outboundActivityIds.length,
    skippedCount: 0,
    rawEntriesCount: entries.length,
    deduplicatedContactsCount: payloads.length,
    crmUrl,
  };
}

