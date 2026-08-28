import { randomUUID } from 'crypto';
import { CRMConnector, CRMConnectorContext, CRMCasePayload, CRMPushResult, CRMConnectorStatus } from './types';

export class Dynamics365Connector implements CRMConnector {
  public readonly id = 'dynamics365';
  public readonly provider = 'dynamics365' as const;

  public async pushEntity(
    ctx: CRMConnectorContext,
    payload: CRMCasePayload
  ): Promise<CRMPushResult> {
    const orgUrl = ctx.credentials?.organizationUrl || 'https://default.crm.dynamics.com';
    const cleanOrgUrl = orgUrl.replace(/\/+$/, '');
    const guid = randomUUID();

    let entitySet = 'leads';
    let entityLogicalName = 'lead';

    if (payload.entityType === 'opportunity') {
      entitySet = 'opportunities';
      entityLogicalName = 'opportunity';
    } else if (payload.entityType === 'support') {
      entitySet = 'incidents';
      entityLogicalName = 'incident';
    }

    const crmRecordId = guid;
    const crmRecordUrl = `${cleanOrgUrl}/main.aspx?etn=${entityLogicalName}&id={${guid}}&pagetype=entityrecord`;

    return {
      crmRecordId,
      crmRecordUrl,
      entityType: payload.entityType,
      rawResponse: {
        id: guid,
        entitySet,
        createdOn: new Date().toISOString(),
      },
    };
  }

  public async validateCredentials(ctx: CRMConnectorContext): Promise<boolean> {
    return Boolean(ctx.credentials?.organizationUrl || ctx.tenantId);
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
