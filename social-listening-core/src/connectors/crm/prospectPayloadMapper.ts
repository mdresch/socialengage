import { CRMCasePayload, CRMConnectorContext, CRMPushResult, CRMProspectPushResult, ProspectingListEntryPayload } from './types';

export function prospectPayloadToCasePayload(
  payload: ProspectingListEntryPayload,
  tenantId: string,
  externalId?: string
): CRMCasePayload {
  return {
    tenantId,
    authorId: payload.authorId,
    authorName: payload.authorName,
    authorPublicUrl: payload.publicUrl,
    platformId: payload.platformId,
    entityType: 'lead',
    notes: payload.notes,
    customFields: payload.customFields,
    externalId,
    topic: payload.topic,
    engagementScore: payload.engagementScore,
    authenticityScore: payload.authenticityScore,
    influenceScore: payload.influenceScore,
    relationshipStage: payload.relationshipStage,
    tags: payload.tags,
    entryId: payload.entryId,
  };
}

export async function pushProspectsBatchWithPushEntity(
  connector: { pushEntity(ctx: CRMConnectorContext, payload: CRMCasePayload): Promise<CRMPushResult> },
  ctx: CRMConnectorContext,
  payloads: ProspectingListEntryPayload[],
  options?: { rePushByExternalId?: Record<string, string> }
): Promise<CRMProspectPushResult[]> {
  const results: CRMProspectPushResult[] = [];
  for (const p of payloads) {
    const externalId = options?.rePushByExternalId?.[p.authorId];
    const casePayload = prospectPayloadToCasePayload(p, ctx.tenantId, externalId);
    const res = await connector.pushEntity(ctx, casePayload);
    results.push({ ...res, entryId: p.entryId });
  }
  return results;
}
