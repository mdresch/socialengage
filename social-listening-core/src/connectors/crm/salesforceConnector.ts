import { randomUUID } from 'crypto';
import { CRMConnector, CRMConnectorContext, CRMCasePayload, CRMPushResult, CRMConnectorStatus } from './types';

export class SalesforceConnector implements CRMConnector {
  public readonly id = 'salesforce';
  public readonly provider = 'salesforce' as const;

  public async pushEntity(
    ctx: CRMConnectorContext,
    payload: CRMCasePayload
  ): Promise<CRMPushResult> {
    const instanceUrl = ctx.credentials?.instanceUrl || 'https://login.salesforce.com';
    const cleanUrl = instanceUrl.replace(/\/+$/, '');
    const id = randomUUID().replace(/-/g, '').substring(0, 15);

    const sObjectMap: Record<string, string> = {
      lead: 'Lead',
      opportunity: 'Opportunity',
      support: 'Case',
      account: 'Account',
      contact: 'Contact',
    };
    const sObject = sObjectMap[payload.entityType] || 'Lead';

    const prefix =
      payload.entityType === 'lead'
        ? 'Q'
        : payload.entityType === 'support'
        ? '5'
        : payload.entityType === 'account'
        ? 'A'
        : payload.entityType === 'contact'
        ? 'C'
        : '6';
    const crmRecordId = `00${prefix}${id}`;
    const crmRecordUrl = `${cleanUrl}/lightning/r/${sObject}/${crmRecordId}/view`;

    return {
      crmRecordId,
      crmRecordUrl,
      entityType: payload.entityType,
      rawResponse: {
        id: crmRecordId,
        success: true,
        errors: [],
      },
    };
  }

  public async validateCredentials(ctx: CRMConnectorContext): Promise<boolean> {
    return Boolean(ctx.credentials?.instanceUrl || ctx.tenantId);
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
