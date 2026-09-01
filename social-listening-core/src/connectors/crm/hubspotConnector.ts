import { randomUUID } from 'crypto';
import { CRMConnector, CRMConnectorContext, CRMCasePayload, CRMPushResult, CRMConnectorStatus } from './types';

interface HubSpotCredential {
  portalId: string;
  accessToken: string;
}

interface HubSpotProperties {
  [key: string]: string | undefined;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildNoteBody(payload: CRMCasePayload): string {
  const parts: string[] = [];

  if (payload.postExcerpt) {
    parts.push(`<p><strong>Post excerpt:</strong><br/>${escapeHtml(payload.postExcerpt)}</p>`);
  }

  if (payload.postUrl) {
    parts.push(`<p><strong>Post URL:</strong> <a href="${escapeHtml(payload.postUrl)}" target="_blank">${escapeHtml(payload.postUrl)}</a></p>`);
  } else if (payload.authorPublicUrl) {
    parts.push(`<p><strong>Author profile:</strong> <a href="${escapeHtml(payload.authorPublicUrl)}" target="_blank">${escapeHtml(payload.authorPublicUrl)}</a></p>`);
  }

  if (payload.authorName || payload.authorHandle) {
    const handle = payload.authorHandle ? ` (${escapeHtml(payload.authorHandle)})` : '';
    parts.push(`<p><strong>Author:</strong> ${escapeHtml(payload.authorName ?? 'Unknown')}${handle}</p>`);
  }

  if (payload.platformId) {
    parts.push(`<p><strong>Platform:</strong> ${escapeHtml(payload.platformId)}</p>`);
  }

  if (payload.publishedAt) {
    parts.push(`<p><strong>Published:</strong> ${escapeHtml(payload.publishedAt)}</p>`);
  }

  if (payload.sentiment) {
    parts.push(`<p><strong>Sentiment:</strong> ${escapeHtml(payload.sentiment)}</p>`);
  }

  if (payload.postMediaUrls && payload.postMediaUrls.length > 0) {
    const mediaLinks = payload.postMediaUrls
      .map((url) => `<li><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a></li>`)
      .join('\n');
    parts.push(`<p><strong>Media / attachments:</strong></p>\n<ul>\n${mediaLinks}\n</ul>`);
  }

  if (payload.notes) {
    parts.push(`<p><strong>Internal notes:</strong><br/>${escapeHtml(payload.notes)}</p>`);
  }

  return parts.join('\n') || '<p>Social post context added from SocialEngage.</p>';
}

function hsObjectType(entityType: string): { objectType: string; hsObjectId: number } {
  if (entityType === 'opportunity') {
    return { objectType: 'deals', hsObjectId: 0 };
  }
  if (entityType === 'support') {
    return { objectType: 'tickets', hsObjectId: 0 };
  }
  if (entityType === 'account') {
    return { objectType: 'companies', hsObjectId: 0 };
  }
  return { objectType: 'contacts', hsObjectId: 0 };
}

function hsRecordObjectTypeId(objectType: string): string {
  const map: Record<string, string> = {
    contacts: '0-1',
    companies: '0-2',
    deals: '0-3',
    tickets: '0-5',
  };
  return map[objectType] || '0-1';
}

function firstAndLastName(fullName?: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = (fullName ?? '').split(/\s+/);
  const lastName = rest.join(' ') || '';
  return { firstName, lastName };
}

async function hsFindExistingRecord(
  objectType: string,
  payload: CRMCasePayload,
  accessToken: string
): Promise<{ id: string } | null> {
  if (objectType !== 'companies' && objectType !== 'contacts') {
    return null;
  }

  let filters: { propertyName: string; operator: string; value: string }[] = [];

  if (objectType === 'companies') {
    filters = [{ propertyName: 'name', operator: 'EQ', value: payload.authorName }];
  } else {
    const { firstName, lastName } = firstAndLastName(payload.authorName);
    filters = [
      { propertyName: 'firstname', operator: 'EQ', value: firstName },
      { propertyName: 'lastname', operator: 'EQ', value: lastName },
    ];
  }

  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filterGroups: [{ filters }],
      limit: 1,
      properties: filters.map((f) => f.propertyName),
    }),
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as { results?: { id: string }[] };
  return data.results?.[0] ?? null;
}

function hsRecordProperties(entityType: string, payload: CRMCasePayload): HubSpotProperties {
  const notes = `${payload.postExcerpt ?? ''}\n\n${payload.notes ?? ''}`.trim();

  if (entityType === 'opportunity') {
    return {
      dealname: payload.authorName,
      description: notes,
      ...payload.customFields,
    };
  }
  if (entityType === 'support') {
    return {
      subject: payload.authorName,
      content: notes,
      ...payload.customFields,
    };
  }
  if (entityType === 'account') {
    return {
      name: payload.authorName,
      ...payload.customFields,
    };
  }
  if (entityType === 'lead' || entityType === 'contact') {
    const { firstName, lastName } = firstAndLastName(payload.authorName);
    return {
      firstname: firstName,
      lastname: lastName,
      ...payload.customFields,
    };
  }
  return {
    firstname: payload.authorName,
    ...payload.customFields,
  };
}

export class HubSpotConnector implements CRMConnector {
  public readonly id = 'hubspot';
  public readonly provider = 'hubspot' as const;

  public async pushEntity(
    ctx: CRMConnectorContext,
    payload: CRMCasePayload
  ): Promise<CRMPushResult> {
    const cred = ctx.credentials as HubSpotCredential | undefined;

    if (process.env.NODE_ENV === 'test') {
      return this.stubResult(cred?.portalId || '12345678', payload);
    }

    if (!cred?.portalId || !cred?.accessToken) {
      throw new Error(
        'HubSpot connector is not configured for this tenant. Save the Hub ID (portal ID) and access token in CRM settings.'
      );
    }

    const { objectType } = hsObjectType(payload.entityType);

    // Look for an existing company/contact with the same name before creating a duplicate.
    const existing = await hsFindExistingRecord(objectType, payload, cred.accessToken);
    let data: { id: string; properties?: { hs_object_id?: string } };
    let isExistingRecord = false;

    if (existing) {
      data = { id: existing.id };
      isExistingRecord = true;
    } else {
      const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cred.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: hsRecordProperties(payload.entityType, payload) }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HubSpot create record failed: ${res.status} ${err}`);
      }

      data = (await res.json()) as { id: string; properties?: { hs_object_id?: string } };
    }

    const crmRecordId = data.id;
    const objectTypeId = hsRecordObjectTypeId(objectType);
    const crmRecordUrl = `https://app.hubspot.com/contacts/${cred.portalId}/record/${objectTypeId}/${crmRecordId}`;

    // Attach a note with the original social post details and URL.
    // Use the legacy v1 Engagements endpoint because the v3 Notes object
    // requires crm.objects.notes scopes that are not exposed for private apps.
    const engagementBody: Record<string, any> = {
      engagement: { active: true, type: 'NOTE', timestamp: Date.now() },
      associations: {},
      metadata: { body: buildNoteBody(payload) },
    };

    if (objectType === 'contacts') {
      engagementBody.associations = { contactIds: [crmRecordId] };
    } else if (objectType === 'companies') {
      engagementBody.associations = { companyIds: [crmRecordId] };
    } else if (objectType === 'deals') {
      engagementBody.associations = { dealIds: [crmRecordId] };
    } else if (objectType === 'tickets') {
      engagementBody.associations = { ticketIds: [crmRecordId] };
    }

    const noteRes = await fetch('https://api.hubapi.com/engagements/v1/engagements', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(engagementBody),
    });

    let noteId: string | undefined;
    if (noteRes.ok) {
      const noteData = (await noteRes.json()) as { engagement?: { id: string | number }; status?: string; message?: string };
      noteId = noteData.engagement?.id ? String(noteData.engagement.id) : undefined;
    } else {
      const noteErr = await noteRes.text();
      // Surface the note error but still return the record so the caller can decide.
      throw new Error(`HubSpot record created, but note attachment failed: ${noteRes.status} ${noteErr}`);
    }

    return {
      crmRecordId,
      crmRecordUrl,
      entityType: payload.entityType,
      rawResponse: {
        ...data,
        noteId,
        isExistingRecord,
      },
    };
  }

  public async validateCredentials(ctx: CRMConnectorContext): Promise<boolean> {
    const cred = ctx.credentials as HubSpotCredential | undefined;
    if (!cred?.portalId || !cred?.accessToken) {
      return false;
    }

    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    try {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1&properties=hs_object_id&archived=false', {
        headers: { Authorization: `Bearer ${cred.accessToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async status(ctx: CRMConnectorContext): Promise<CRMConnectorStatus> {
    const isValid = await this.validateCredentials(ctx);
    return {
      isActive: isValid,
      provider: this.provider,
      lastValidatedAt: new Date().toISOString(),
    };
  }

  private stubResult(portalId: string, payload: CRMCasePayload): CRMPushResult {
    const { objectType } = hsObjectType(payload.entityType);
    const recordId = randomUUID();
    const objectTypeId = hsRecordObjectTypeId(objectType);
    const crmRecordUrl = `https://app.hubspot.com/contacts/${portalId}/record/${objectTypeId}/${recordId}`;
    return {
      crmRecordId: `hs-${objectType}-${recordId}`,
      crmRecordUrl,
      entityType: payload.entityType,
      rawResponse: {
        id: recordId,
        properties: {
          hs_object_id: recordId,
          createdate: new Date().toISOString(),
        },
      },
    };
  }
}
