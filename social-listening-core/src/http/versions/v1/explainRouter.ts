import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  explainMetric,
  MetricExplainRequest,
  MetricExplainError,
} from '../../../ai/metricExplainabilityService';

export const explainRouter = Router();

/**
 * Story 9.2 (ADR-0078, BRD-0078, FDD-0078) — Metric Explainability Endpoint.
 *
 * POST /v1/explain
 * Returns a short, plain-language, confidence-graded explanation for any dashboard metric.
 */
explainRouter.post('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return; // 403 sent

  const { metricKey, value, context, locale, noCache } = req.body || {};

  const explainReq: MetricExplainRequest = {
    metricKey,
    value,
    context,
    locale,
    noCache,
  };

  try {
    const result = await explainMetric(identity.tenantId, identity.userId, explainReq);
    res.json(result);
  } catch (err: any) {
    if (err instanceof MetricExplainError) {
      res.status(err.status).json({ code: err.code, error: err.message });
      return;
    }
    res.status(500).json({ code: 'INTERNAL_ERROR', error: 'Failed to generate metric explanation.', details: err?.message });
  }
});
