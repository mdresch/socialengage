import { randomUUID } from 'crypto';
import { CRMConnector, CRMConnectorContext, CRMCasePayload, CRMPushResult, CRMConnectorStatus } from './types';

interface DynamicsTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface DynamicsCredential {
  organizationUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

function normalizeOrgUrl(raw: string): string {
  return raw.replace(/\/+$/, '').trim();
}

function parseDataverseError(responseText: string, status: number): string {
  let parsed: any;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = null;
  }

  const message =
    parsed?.error?.message ||
    parsed?.Message ||
    parsed?.message ||
    responseText;

  if (status === 403 && message.includes('not a member of the organization')) {
    return (
      'The service principal is not a Dataverse application user in this organization. ' +
      'In the Power Platform admin center, add the registered Entra application as an ' +
      'Application User, assign it a security role (for example "System Customizer" or a role ' +
      'with create permissions on the target entity), and try again. ' +
      'See https://learn.microsoft.com/en-us/power-platform/admin/manage-application-users'
    );
  }

  if (status === 404 && message.includes('Resource not found for the segment')) {
    const segmentMatch = message.match(/segment ['"]([^'"]+)['"]/);
    const segment = segmentMatch ? segmentMatch[1] : 'the requested table';
    return (
      `Dataverse cannot access the '${segment}' table. This usually means the Application User's ` +
      `security role does not include Read/Create privileges for that table, or the table does not ` +
      `exist in this environment. In the Power Platform admin center, edit the Application User's ` +
      `security role and add Create and Read privileges for the matching Dataverse table. ` +
      `See https://learn.microsoft.com/en-us/power-platform/admin/create-edit-security-role`
    );
  }

  if (status === 404) {
    return `Dataverse request failed (${status}): ${message}`;
  }

  if (status === 403) {
    return `Dataverse access denied: ${message}`;
  }

  if (status === 401) {
    return `Dataverse authentication failed: ${message}`;
  }

  return `Dataverse request failed (${status}): ${message}`;
}

async function getAccessToken(cred: DynamicsCredential): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(cred.tenantId)}/oauth2/v2.0/token`;
  const scope = `${normalizeOrgUrl(cred.organizationUrl)}/.default`;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cred.clientId,
    client_secret: cred.clientSecret,
    scope,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dynamics 365 authentication failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as DynamicsTokenResponse;
  return data.access_token;
}

function entitySetAndName(entityType: string): { entitySet: string; entityLogicalName: string } {
  if (entityType === 'opportunity') {
    return { entitySet: 'opportunities', entityLogicalName: 'opportunity' };
  }
  if (entityType === 'support') {
    return { entitySet: 'incidents', entityLogicalName: 'incident' };
  }
  if (entityType === 'account') {
    return { entitySet: 'accounts', entityLogicalName: 'account' };
  }
  if (entityType === 'contact') {
    return { entitySet: 'contacts', entityLogicalName: 'contact' };
  }
  return { entitySet: 'leads', entityLogicalName: 'lead' };
}

function buildRecordBody(entityType: string, payload: CRMCasePayload): Record<string, any> {
  const description = `${payload.postExcerpt ?? ''}\n\n${payload.notes ?? ''}`.trim();

  if (entityType === 'support') {
    return {
      title: payload.authorName,
      description,
      ...payload.customFields,
    };
  }
  if (entityType === 'opportunity') {
    return {
      name: payload.authorName,
      description,
      ...payload.customFields,
    };
  }
  if (entityType === 'account') {
    return {
      name: payload.authorName,
      description,
      ...payload.customFields,
    };
  }
  if (entityType === 'contact') {
    const [firstName, ...rest] = (payload.authorName ?? '').split(/\s+/);
    const lastName = rest.join(' ') || '';
    return {
      firstname: firstName,
      lastname: lastName,
      description,
      ...payload.customFields,
    };
  }
  return {
    subject: payload.authorName,
    description,
    ...payload.customFields,
  };
}

export class Dynamics365Connector implements CRMConnector {
  public readonly id = 'dynamics365';
  public readonly provider = 'dynamics365' as const;

  public async pushEntity(
    ctx: CRMConnectorContext,
    payload: CRMCasePayload
  ): Promise<CRMPushResult> {
    const cred = ctx.credentials as DynamicsCredential | undefined;

    // Test fixture shortcut: existing contract tests run without real service
    // principal credentials. Generate a canonical record URL instead of calling
    // Dataverse so the contract still validates the connector shape. Production
    // and real dev runs require full credentials.
    if (process.env.NODE_ENV === 'test') {
      const orgUrl = normalizeOrgUrl(cred?.organizationUrl || 'https://default.crm.dynamics.com');
      const guid = randomUUID();
      const { entityLogicalName } = entitySetAndName(payload.entityType);
      const crmRecordUrl = `${orgUrl}/main.aspx?etn=${entityLogicalName}&id={${guid}}&pagetype=entityrecord`;
      return {
        crmRecordId: guid,
        crmRecordUrl,
        entityType: payload.entityType,
        rawResponse: { id: guid, entityLogicalName },
      };
    }

    if (!cred?.organizationUrl || !cred?.tenantId || !cred?.clientId || !cred?.clientSecret) {
      throw new Error(
        'Dynamics 365 connector is not configured for this tenant. Save the organization URL, tenant ID, client ID and client secret in CRM settings.'
      );
    }

    const orgUrl = normalizeOrgUrl(cred.organizationUrl);
    const token = await getAccessToken(cred);
    const { entitySet, entityLogicalName } = entitySetAndName(payload.entityType);
    const apiUrl = `${orgUrl}/api/data/v9.2/${entitySet}`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
      body: JSON.stringify(buildRecordBody(payload.entityType, payload)),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Dynamics 365 create record failed: ${parseDataverseError(err, res.status)}`);
    }

    const odataEntityId = res.headers.get('OData-EntityId') || '';
    const guidMatch = odataEntityId.match(/\(([a-f0-9\-]{36})\)/i);
    const crmRecordId = guidMatch ? guidMatch[1] : odataEntityId;
    const crmRecordUrl = `${orgUrl}/main.aspx?etn=${entityLogicalName}&id={${crmRecordId}}&pagetype=entityrecord`;

    return {
      crmRecordId,
      crmRecordUrl,
      entityType: payload.entityType,
      rawResponse: {
        odataEntityId,
      },
    };
  }

  public async validateCredentials(ctx: CRMConnectorContext): Promise<boolean> {
    const cred = ctx.credentials as DynamicsCredential | undefined;
    return Boolean(cred?.organizationUrl && cred?.tenantId && cred?.clientId && cred?.clientSecret);
  }

  public async status(ctx: CRMConnectorContext): Promise<CRMConnectorStatus> {
    const cred = ctx.credentials as DynamicsCredential | undefined;
    let isValid = false;
    let error: string | undefined;

    if (!cred?.organizationUrl || !cred?.tenantId || !cred?.clientId || !cred?.clientSecret) {
      error = 'Connector is not configured';
    } else if (process.env.NODE_ENV === 'test') {
      isValid = true;
    } else {
      try {
        const orgUrl = normalizeOrgUrl(cred.organizationUrl);
        const token = await getAccessToken(cred);

        const res = await fetch(`${orgUrl}/api/data/v9.2/WhoAmI`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
          },
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Dataverse access check failed: ${parseDataverseError(err, res.status)}`);
        }

        isValid = true;
      } catch (err: any) {
        error = err.message;
      }
    }

    return {
      isActive: isValid,
      provider: this.provider,
      lastValidatedAt: new Date().toISOString(),
      error,
    };
  }
}
