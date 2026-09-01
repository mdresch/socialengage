import { withTenant } from '../db/withTenant';
import { getCRMConnector } from '../connectors/crm/crmRegistry';
import { CRMEntityType, CRMCasePayload, CRMPushResult } from '../connectors/crm/types';
import { listFieldMappings } from './crmFieldMappingStore';
import { readCRMCredential } from './crmCredentialStore';

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

function resolvePostUrl(raw: Record<string, any>, authorHandle?: string): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  if (raw.url) return String(raw.url);
  if (raw.link) return String(raw.link);
  if (raw.permalink) return String(raw.permalink);
  if (raw.permalinkUrl) return String(raw.permalinkUrl);
  if (raw.permalink_url) return String(raw.permalink_url);
  if (raw.postUrl) return String(raw.postUrl);
  if (raw.webUrl) return String(raw.webUrl);

  const platform = (raw.platformId || raw.providerId || 'generic').toLowerCase();
  const externalId = raw.externalId || raw.id || raw.postId;

  if (platform === 'instagram') {
    const shortcode = raw.shortcode || externalId;
    if (shortcode) return `https://www.instagram.com/p/${shortcode}/`;
    return undefined;
  }

  if (!externalId) return undefined;

  if (platform === 'twitter' || platform === 'x') {
    const handle = (authorHandle || raw.authorHandle || raw.handle || '').replace(/^@/, '');
    if (handle) return `https://x.com/${handle}/status/${externalId}`;
  }

  if (platform === 'linkedin') {
    const id = String(externalId).replace(/^linkedin_/, '');
    return `https://www.linkedin.com/feed/update/urn:li:share:${id}`;
  }

  if (platform === 'facebook') {
    const pageId = raw.pageId || raw.page_id || raw.authorId;
    if (pageId) return `https://www.facebook.com/${pageId}/posts/${externalId}`;
  }

  if (platform === 'instagram') {
    return `https://www.instagram.com/p/${externalId}/`;
  }

  if (platform === 'threads') {
    const handle = (authorHandle || raw.authorHandle || raw.handle || '').replace(/^@/, '');
    if (handle) return `https://www.threads.net/@${handle}/post/${externalId}`;
  }

  return undefined;
}

function resolvePostMediaUrls(raw: Record<string, any>): string[] {
  if (!raw || typeof raw !== 'object') return [];

  const urls = new Set<string>();

  if (raw.full_picture && typeof raw.full_picture === 'string') {
    urls.add(raw.full_picture);
  }

  if (raw.mediaUrl && typeof raw.mediaUrl === 'string') {
    urls.add(raw.mediaUrl);
  }

  if (raw.media_url && typeof raw.media_url === 'string') {
    urls.add(raw.media_url);
  }

  if (raw.imageUrl && typeof raw.imageUrl === 'string') {
    urls.add(raw.imageUrl);
  }

  if (raw.thumbnailUrl && typeof raw.thumbnailUrl === 'string') {
    urls.add(raw.thumbnailUrl);
  }

  if (raw.thumbnail_url && typeof raw.thumbnail_url === 'string') {
    urls.add(raw.thumbnail_url);
  }

  const attachments = raw.attachments;
  if (attachments && typeof attachments === 'object') {
    const data = Array.isArray(attachments.data) ? attachments.data : Array.isArray(attachments) ? attachments : [attachments];
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      if (item.media?.image?.src) urls.add(item.media.image.src);
      if (item.url) urls.add(item.url);
      if (item.unshimmed_url) urls.add(item.unshimmed_url);
      if (item.target?.url) urls.add(item.target.url);
    }
  }

  const media = raw.media;
  if (media && typeof media === 'object') {
    if (Array.isArray(media)) {
      for (const item of media) {
        if (item && typeof item === 'object') {
          if (typeof item.url === 'string') urls.add(item.url);
          if (typeof item.src === 'string') urls.add(item.src);
          if (item.image?.src) urls.add(item.image.src);
        }
      }
    } else {
      if (typeof media.url === 'string') urls.add(media.url);
      if (typeof media.src === 'string') urls.add(media.src);
      if (media.image?.src) urls.add(media.image.src);
    }
  }

  return Array.from(urls).filter((url) => url.startsWith('http'));
}

function resolveAuthorPublicUrl(raw: Record<string, any>, authorHandle?: string, platform = 'generic'): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  if (raw.authorPublicUrl) return String(raw.authorPublicUrl);
  if (raw.url) return String(raw.url);
  if (raw.profileUrl) return String(raw.profileUrl);
  if (raw.profile_url) return String(raw.profile_url);

  const p = (platform || 'generic').toLowerCase();
  const handle = (authorHandle || raw.handle || raw.authorHandle || '').replace(/^@/, '');

  if (p === 'twitter' || p === 'x') {
    return handle ? `https://x.com/${handle}` : undefined;
  }
  if (p === 'linkedin') {
    return handle ? `https://www.linkedin.com/in/${handle}` : undefined;
  }
  if (p === 'instagram') {
    return handle ? `https://www.instagram.com/${handle}/` : undefined;
  }
  if (p === 'threads') {
    return handle ? `https://www.threads.net/@${handle}` : undefined;
  }
  if (p === 'facebook') {
    return handle ? `https://www.facebook.com/${handle}` : undefined;
  }

  return undefined;
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

    let postUrl: string | undefined;
    let authorPublicUrl: string | undefined;
    let postMediaUrls: string[] = [];

    if (postId) {
      const postRes = await client.query(
        `SELECT p.id, p.author_id, p.raw_payload, p.body_markdown, p.enrichment, p.published_at,
                a.handle, a.display_name, a.raw_profile
         FROM social_posts p
         LEFT JOIN authors a ON a.id = p.author_id
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [postId, tenantId]
      );

      if (postRes.rows.length > 0) {
        const post = postRes.rows[0];
        const raw = post.raw_payload || {};
        const enrichment = post.enrichment || {};
        const authorRaw = post.raw_profile || {};
        authorId = post.author_id || authorId;
        authorName = post.display_name || raw.authorName || authorName;
        authorHandle = post.handle || raw.authorHandle;
        platformId = raw.platformId || platformId;
        authorPublicUrl = resolveAuthorPublicUrl(authorRaw, authorHandle, platformId);
        postUrl = resolvePostUrl(raw, authorHandle);
        postMediaUrls = resolvePostMediaUrls(raw);
        postExcerpt = post.body_markdown || raw.body || (raw.text ? String(raw.text).substring(0, 500) : postExcerpt);
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
      authorPublicUrl,
      postId,
      postExcerpt,
      postUrl,
      postMediaUrls,
      platformId,
      publishedAt,
      sentiment,
      watchlistId,
      entityType,
      assignedTo,
      notes,
      customFields: mappedCustomFields,
    };

    const crmCredential = await readCRMCredential(tenantId, crmConnectorId);

    let pushResult: CRMPushResult;
    try {
      pushResult = await connector.pushEntity({ tenantId, credentials: crmCredential ?? undefined }, payload);
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
