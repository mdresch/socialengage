import { randomUUID } from 'crypto';
import { CRMConnector, CRMConnectorContext, CRMCasePayload, CRMPushResult, CRMConnectorStatus } from './types';

export class HubSpotConnector implements CRMConnector {
  public readonly id = 'hubspot';
  public readonly provider = 'hubspot' as const;

  public async pushEntity(
    ctx: CRMConnectorContext,
    payload: CRMCasePayload
  ): Promise<CRMPushResult> {
    const portalId = ctx.credentials?.portalId || '12345678';
    const recordId = Math.floor(100000000 + Math.random() * 900000000).toString();

    let objectType = 'contacts';
    if (payload.entityType === 'opportunity') {
      objectType = 'deals';
    } else if (payload.entityType === 'support') {
      objectType = 'tickets';
    }

    const crmRecordId = `hs-${objectType}-${recordId}`;
    const crmRecordUrl = `https://app.hubspot.com/contacts/${portalId}/record/0-1/${recordId}`;

    return {
      crmRecordId,
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

  public async validateCredentials(ctx: CRMConnectorContext): Promise<boolean> {
    return Boolean(ctx.credentials?.accessToken || ctx.credentials?.apiKey || ctx.tenantId);
  }

  public async status(ctx: CRMConnectorContext): Promise<CRMConnectorStatus> {
    const isValid = await this.validateCredentials(ctx);
    return {
      isActive: isValid,
      provider: this.provider,
      lastValidatedAt: new Date().toISOString(),
    };
  }
}
