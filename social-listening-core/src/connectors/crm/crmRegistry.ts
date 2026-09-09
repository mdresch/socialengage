import { CRMConnector, CRMProviderType } from './types';
import { Dynamics365Connector } from './dynamics365Connector';
import { SalesforceConnector } from './salesforceConnector';
import { HubSpotConnector } from './hubspotConnector';

const registry = new Map<string, CRMConnector>();

// Register default providers
const d365 = new Dynamics365Connector();
const sf = new SalesforceConnector();
const hs = new HubSpotConnector();

registry.set(d365.id, d365);
registry.set(sf.id, sf);
registry.set(hs.id, hs);

export function registerCRMConnector(connector: CRMConnector): void {
  registry.set(connector.id, connector);
}

export function getCRMConnector(idOrProvider: string): CRMConnector | undefined {
  return registry.get(idOrProvider);
}

export function listCRMConnectors(): CRMConnector[] {
  return Array.from(registry.values());
}
