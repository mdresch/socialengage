export interface CRMFieldDef {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
  placeholder?: string;
}

export interface CRMConnectorSetupGuide {
  label: string;
  url: string;
}

export interface CRMConnectorUI {
  id: string;
  title: string;
  description: string;
  fields: CRMFieldDef[];
  setupGuide?: CRMConnectorSetupGuide;
}

export const CRM_CONNECTOR_UI: Record<string, CRMConnectorUI> = {
  dynamics365: {
    id: 'dynamics365',
    title: 'Microsoft Dynamics 365',
    description:
      'Enter the service principal credentials that SocialEngage will use to create records in your Dynamics 365 environment.',
    setupGuide: {
      label: 'How to register an app and create a Dataverse application user',
      url: 'https://learn.microsoft.com/en-us/power-platform/admin/manage-application-users',
    },
    fields: [
      {
        name: 'organizationUrl',
        label: 'Organization URL',
        type: 'url',
        required: true,
        placeholder: 'https://myorg.crm.dynamics.com',
      },
      {
        name: 'tenantId',
        label: 'Entra / Azure AD Tenant ID',
        type: 'text',
        required: true,
        placeholder: '00000000-0000-0000-0000-000000000000',
      },
      {
        name: 'clientId',
        label: 'Application (Client) ID',
        type: 'text',
        required: true,
        placeholder: '00000000-0000-0000-0000-000000000000',
      },
      {
        name: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: '••••••••',
      },
    ],
  },
  hubspot: {
    id: 'hubspot',
    title: 'HubSpot',
    description:
      'Enter the Hub ID (portal ID) and private app access token that SocialEngage will use to create contacts, tickets, and deals in your HubSpot account.',
    setupGuide: {
      label: 'How to create a HubSpot private app access token',
      url: 'https://developers.hubspot.com/docs/api/private-apps',
    },
    fields: [
      {
        name: 'portalId',
        label: 'Hub ID (Portal ID)',
        type: 'text',
        required: true,
        placeholder: '12345678',
      },
      {
        name: 'accessToken',
        label: 'Private App Access Token',
        type: 'password',
        required: true,
        placeholder: '••••••••',
      },
    ],
  },
  salesforce: {
    id: 'salesforce',
    title: 'Salesforce',
    description: 'Salesforce CRM connector configuration is not available yet.',
    fields: [],
  },
};

export const MASKED_PLACEHOLDER = '••••••••';
