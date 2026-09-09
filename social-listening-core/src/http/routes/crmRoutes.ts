import { Router, Request, Response } from 'express';
import { requireTenantUserIdentity } from '../auth/requireTenantUser';
import { RequestWithIdentity } from '../auth/requestIdentity';
import { pushCaseToCRM, CRMConflictError } from '../../crm/crmHandoffService';
import { listCRMConnectors } from '../../connectors/crm/crmRegistry';
import { listFieldMappings, upsertFieldMapping, deleteFieldMapping } from '../../crm/crmFieldMappingStore';
import {
  upsertCRMCredential,
  readCRMCredential,
  getCRMCredentialRow,
  deleteCRMCredential,
  CRMCredentialInput,
} from '../../crm/crmCredentialStore';

async function loadCredentialsForConnector(tenantId: string, crmConnectorId: string) {
  try {
    return await readCRMCredential(tenantId, crmConnectorId);
  } catch {
    return null;
  }
}

function maskSensitiveCRMCredentialFields(config: CRMCredentialInput): CRMCredentialInput {
  const masked = { ...config };
  Object.keys(masked).forEach((key) => {
    const lower = key.toLowerCase();
    if (lower.includes('secret') || lower.includes('token') || lower.includes('password') || lower.includes('key')) {
      masked[key] = '••••••••';
    }
  });
  return masked;
}

export function createCRMRoutes(): Router {
  const router = Router();

  // POST /v1/inbox/items/:id/case
  router.post('/inbox/items/:id/case', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    const { id } = req.params;
    const postId = Array.isArray(id) ? id[0] : id;
    const { crmConnectorId, entityType, assignedTo, notes, customFields, allowDuplicate, authorId } = req.body || {};

    if (!crmConnectorId || !entityType) {
      res.status(400).json({ error: 'crmConnectorId and entityType are required' });
      return;
    }

    try {
      const result = await pushCaseToCRM({
        tenantId: identity.tenantId,
        userId: identity.userId,
        postId,
        authorId,
        crmConnectorId,
        entityType,
        assignedTo,
        notes,
        customFields,
        allowDuplicate: Boolean(allowDuplicate),
      });

      res.status(201).json(result);
    } catch (err: any) {
      if (err instanceof CRMConflictError) {
        res.status(409).json({
          error: err.message,
          crmRecordId: err.crmRecordId,
          crmRecordUrl: err.crmRecordUrl,
          outboundActivityId: err.outboundActivityId,
        });
        return;
      }
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // GET /v1/crm/connectors
  router.get('/crm/connectors', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    const connectors = listCRMConnectors();
    const result = await Promise.all(
      connectors.map(async (c) => {
        const credentials = await loadCredentialsForConnector(identity.tenantId, c.id);
        const status = await c.status({ tenantId: identity.tenantId, credentials: credentials ?? undefined });
        return {
          id: c.id,
          provider: c.provider,
          status,
        };
      })
    );

    res.status(200).json(result);
  });

  // GET /v1/crm/field-mappings
  router.get('/crm/field-mappings', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    const { crmConnectorId, entityType } = req.query;
    const mappings = await listFieldMappings(
      identity.tenantId,
      crmConnectorId as string | undefined,
      entityType as string | undefined
    );
    res.status(200).json(mappings);
  });

  // POST /v1/crm/field-mappings
  router.post('/crm/field-mappings', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    const { crmConnectorId, entityType, sourceField, targetField, isRequired, defaultValue } = req.body || {};
    if (!crmConnectorId || !entityType || !sourceField || !targetField) {
      res.status(400).json({ error: 'crmConnectorId, entityType, sourceField, and targetField are required' });
      return;
    }

    const created = await upsertFieldMapping(identity.tenantId, {
      crmConnectorId,
      entityType,
      sourceField,
      targetField,
      isRequired,
      defaultValue,
    });
    res.status(201).json(created);
  });

  // DELETE /v1/crm/field-mappings/:id
  router.delete('/crm/field-mappings/:id', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    const { id } = req.params;
    const mappingId = Array.isArray(id) ? id[0] : id;
    const deleted = await deleteFieldMapping(identity.tenantId, mappingId);
    if (!deleted) {
      res.status(404).json({ error: 'Field mapping not found' });
      return;
    }
    res.status(204).end();
  });

  // GET /v1/crm/credentials/:crmConnectorId
  router.get('/crm/credentials/:crmConnectorId', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    const crmConnectorIdParam = Array.isArray(req.params.crmConnectorId) ? req.params.crmConnectorId[0] : req.params.crmConnectorId;
    const crmConnectorId = crmConnectorIdParam as string;
    const row = await getCRMCredentialRow(identity.tenantId, crmConnectorId);
    const config = row ? await readCRMCredential(identity.tenantId, crmConnectorId) : null;
    res.status(200).json({
      crmConnectorId,
      configured: Boolean(row),
      config: config ? maskSensitiveCRMCredentialFields(config) : null,
    });
  });

  // POST /v1/crm/credentials
  router.post('/crm/credentials', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    const { crmConnectorId, ...rest } = req.body || {};
    if (!crmConnectorId) {
      res.status(400).json({ error: 'crmConnectorId is required' });
      return;
    }

    try {
      const row = await upsertCRMCredential(identity.tenantId, crmConnectorId, rest as CRMCredentialInput);
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save CRM credentials' });
    }
  });

  // POST /v1/crm/credentials/:crmConnectorId/health
  router.post('/crm/credentials/:crmConnectorId/health', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    const crmConnectorId = Array.isArray(req.params.crmConnectorId)
      ? req.params.crmConnectorId[0]
      : (req.params.crmConnectorId as string);

    const connector = listCRMConnectors().find((c) => c.id === crmConnectorId);
    if (!connector) {
      res.status(404).json({ error: `Unknown CRM connector: ${crmConnectorId}` });
      return;
    }

    const body = req.body || {};
    const providedConfig = body.config ? (body.config as CRMCredentialInput) : null;
    const credentials = providedConfig ?? (await loadCredentialsForConnector(identity.tenantId, crmConnectorId));
    const status = await connector.status({ tenantId: identity.tenantId, credentials: credentials ?? undefined });

    res.status(200).json({ crmConnectorId, status });
  });

  // DELETE /v1/crm/credentials/:crmConnectorId
  router.delete('/crm/credentials/:crmConnectorId', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    const crmConnectorId = Array.isArray(req.params.crmConnectorId)
      ? req.params.crmConnectorId[0]
      : (req.params.crmConnectorId as string);
    await deleteCRMCredential(identity.tenantId, crmConnectorId);
    res.status(204).end();
  });

  return router;
}
