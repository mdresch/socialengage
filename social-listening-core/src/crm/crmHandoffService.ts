import { withTenant } from '../db/withTenant';
import { getCRMConnector } from '../connectors/crm/crmRegistry';
import { CRMEntityType, CRMCasePayload, CRMPushResult } from '../connectors/crm/types';
import { listFieldMappings } from './crmFieldMappingStore';

export class CRMConflictError extends Error {
  public readonly crmRecordId?: string;
  public readonly crmRecordUrl?: string;
  public readonly outboundActivityId?: string;

  constructor(message: string, details?: { crmRecordId?: string; crmRecordUrl?: string; outboundActivityId?: string }) {
    super(message);
    this.name = 'CRMConflictError';
    this.crmRecordId = details?.crmRecordId;
    this.crmRecordUrl = details?.crmRecordUrl;
    this.outboundActivityId = details?.outboundActivityId;
  }
}

export interface PushCaseInput {
  tenantId: string;
  userId: string;
  postId?: string;
  authorId?: string;
  crmConnectorId: string;
  entityType: CRMEntityType;
  assignedTo?: string;
  notes?: string;
  customFields?: Record<string, any>;
  allowDuplicate?: boolean;
}

export interface PushCaseResponse {
  outboundActivityId: string;
  crmRecordId: string;
  crmRecordUrl: string;
  status: 'success';
}

export async function pushCaseToCRM(input: PushCaseInput): Promise<PushCaseResponse> {
  const { tenantId, userId, postId, crmConnectorId, entityType, assignedTo, notes, customFields, allowDuplicate } = input;

  const connector = getCRMConnector(crmConnectorId);
  if (!connector) {
    throw new Error(`Unsupported or unconfigured CRM connector: ${crmConnectorId}`);
  }

  return withTenant(tenantId, async (client) => {
    // 1. Deduplication check (if postId provided and allowDuplicate !== true)
    if (postId && !allowDuplicate) {
      const existingRes = await client.query(
        `SELECT id, external_id, external_url
         FROM outbound_activities
         WHERE tenant_id = $1 AND post_id = $2 AND provider_id = $3 AND activity_type = 'crm_handoff' AND status = 'sent'
         ORDER BY created_at DESC
         LIMIT 1`,
        [tenantId, postId, crmConnectorId]
      );

      if (existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        throw new CRMConflictError('Item already pushed to CRM', {
          crmRecordId: existing.external_id,
          crmRecordUrl: existing.external_url,
          outboundActivityId: existing.id,
        });
      }
    }

    // 2. Fetch post & author details if postId is present
    let authorId = input.authorId;
    let authorName = 'Anonymous';
    let authorHandle = undefined;
    let postExcerpt = notes || '';
    let platformId = 'generic';
    let publishedAt = new Date().toISOString();
    let sentiment = undefined;
    let watchlistId = undefined;

    if (postId) {
      const postRes = await client.query(
        `SELECT p.id, p.author_id, p.raw_payload, p.body_markdown, p.enrichment, p.published_at,
                a.handle, a.display_name
         FROM social_posts p
         LEFT JOIN authors a ON a.id = p.author_id
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [postId, tenantId]
      );

      if (postRes.rows.length > 0) {
        const post = postRes.rows[0];
        const raw = post.raw_payload || {};
        const enrichment = post.enrichment || {};
        authorId = post.author_id || authorId;
        authorName = post.display_name || raw.authorName || authorName;
        authorHandle = post.handle || raw.authorHandle;
        postExcerpt = post.body_markdown || raw.body || (raw.text ? String(raw.text).substring(0, 500) : postExcerpt);
        platformId = raw.platformId || platformId;
        publishedAt = post.published_at ? post.published_at.toISOString() : publishedAt;
        sentiment = enrichment.sentiment || raw.sentiment;
      }
    }

    // 3. Load tenant field mappings override
    const mappings = await listFieldMappings(tenantId, crmConnectorId, entityType);
    const mappedCustomFields: Record<string, any> = { ...customFields };
    for (const map of mappings) {
      if (map.sourceField === 'notes' && notes) {
        mappedCustomFields[map.targetField] = notes;
      } else if (map.sourceField === 'authorName') {
        mappedCustomFields[map.targetField] = authorName;
      } else if (map.defaultValue) {
        mappedCustomFields[map.targetField] = map.defaultValue;
      }
    }

    // 4. Construct payload and call connector
    const payload: CRMCasePayload = {
      tenantId,
      authorId: authorId || '00000000-0000-0000-0000-000000000000',
      authorName,
      authorHandle,
      postId,
      postExcerpt,
      platformId,
      publishedAt,
      sentiment,
      watchlistId,
      entityType,
      assignedTo,
      notes,
      customFields: mappedCustomFields,
    };

    let pushResult: CRMPushResult;
    try {
      pushResult = await connector.pushEntity({ tenantId }, payload);
    } catch (err: any) {
      // Record failure audit
      await client.query(
        `INSERT INTO outbound_activities (
           tenant_id, post_id, author_id, user_id, provider_id, credential_id,
           activity_type, body, status, error_code, error_details, created_at, failed_at
         )
         VALUES ($1, $2, $3, $4, $5, '00000000-0000-0000-0000-000000000000', 'crm_handoff', $6, 'failed', $7, $8, now(), now())`,
        [
          tenantId,
          postId ?? null,
          authorId ?? null,
          userId,
          crmConnectorId,
          postExcerpt,
          'CRM_PUSH_FAILED',
          JSON.stringify({ error: err.message }),
        ]
      );
      throw err;
    }

    // 5. Insert success audit entry into outbound_activities
    const auditRes = await client.query(
      `INSERT INTO outbound_activities (
         tenant_id, post_id, author_id, user_id, provider_id, credential_id,
         activity_type, body, status, external_id, external_url, created_at, sent_at
       )
       VALUES ($1, $2, $3, $4, $5, '00000000-0000-0000-0000-000000000000', 'crm_handoff', $6, 'sent', $7, $8, now(), now())
       RETURNING id`,
      [
        tenantId,
        postId ?? null,
        authorId ?? null,
        userId,
        crmConnectorId,
        postExcerpt,
        pushResult.crmRecordId,
        pushResult.crmRecordUrl,
      ]
    );

    return {
      outboundActivityId: auditRes.rows[0].id,
      crmRecordId: pushResult.crmRecordId,
      crmRecordUrl: pushResult.crmRecordUrl,
      status: 'success',
    };
  });
}
