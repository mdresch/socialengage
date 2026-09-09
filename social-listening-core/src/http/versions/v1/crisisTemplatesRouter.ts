import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  listActiveCrisisTemplates,
  getCrisisTemplateByKey,
  activateCrisisTemplate,
  ActivateCrisisTemplateInput,
} from '../../../crisis/crisisTemplateStore';

export const crisisTemplatesRouter = Router();

/**
 * Story 9.3 (ADR-0079, BRD-0079, FDD-0079) — Crisis Template Bundle & Activation.
 *
 * GET /v1/crisis-templates
 * Lists active crisis templates with preview metadata, parameters, thresholds, and playbooks.
 */
crisisTemplatesRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return; // 403 sent

  try {
    const templates = await listActiveCrisisTemplates();
    res.json({
      templates: templates.map((t) => ({
        templateKey: t.templateKey,
        name: t.name,
        description: t.description,
        defaultQuery: t.defaultQuery,
        defaultThresholds: t.defaultThresholds,
        parameters: t.parameters,
        playbook: t.playbook,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list crisis templates.', details: err?.message });
  }
});

/**
 * GET /v1/crisis-templates/:templateKey
 * Previews a single active crisis template.
 */
crisisTemplatesRouter.get('/:templateKey', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const template = await getCrisisTemplateByKey(req.params.templateKey);
    if (!template || !template.isActive) {
      res.status(404).json({ error: 'Crisis template not found or inactive.' });
      return;
    }

    res.json({
      templateKey: template.templateKey,
      name: template.name,
      description: template.description,
      defaultQuery: template.defaultQuery,
      defaultThresholds: template.defaultThresholds,
      parameters: template.parameters,
      playbook: template.playbook,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch crisis template.', details: err?.message });
  }
});

/**
 * POST /v1/crisis-templates/:templateKey/activate
 * Activates a crisis template for the authenticated caller's tenant.
 * Authorized for Tenant-Brand-Reputation-Manager, Tenant-Admin, and standard tenant users.
 */
crisisTemplatesRouter.post('/:templateKey/activate', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { templateKey } = req.params;
  const { name, variables, customQuery, customThresholds, notificationChannelIds } = req.body || {};

  const input: ActivateCrisisTemplateInput = {
    name,
    variables: variables || {},
    customQuery,
    customThresholds,
    notificationChannelIds: notificationChannelIds || [],
  };

  try {
    const result = await activateCrisisTemplate(identity.tenantId, identity.userId, templateKey, input);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, details: result.details });
      return;
    }

    res.status(201).json(result.result);
  } catch (err: any) {
    console.error('[crisis-templates] Activate error:', err);
    res.status(500).json({ error: 'Failed to activate crisis template.', details: err?.message });
  }
});
