import { Router } from 'express';
import { submitDSRRequest } from '../../../governance/dsrQuarantineStore';
import { verifyDSRReceipt, DSRReceiptPayload } from '../../../governance/dsrReceipt';

export const dsrPublicRouter = Router();

/**
 * Public DSR submission endpoint (GDPR/CCPA/Article 18).
 * Enforces mandatory bot mitigation via captchaToken.
 */
dsrPublicRouter.post('/requests', async (req, res) => {
  const {
    tenantId,
    postUrl,
    requesterEmail,
    requesterName,
    requestType,
    reason,
    captchaToken,
  } = req.body || {};

  if (!tenantId || !postUrl || !requesterEmail) {
    res.status(400).json({
      code: 'MISSING_REQUIRED_FIELDS',
      error: 'tenantId, postUrl, and requesterEmail are required.',
    });
    return;
  }

  try {
    const result = await submitDSRRequest(tenantId, {
      postUrl,
      requesterEmail,
      requesterName,
      requestType,
      reason,
      captchaToken,
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err?.message === 'CAPTCHA_VERIFICATION_FAILED') {
      res.status(400).json({
        code: 'CAPTCHA_VERIFICATION_FAILED',
        error: 'Missing or invalid captcha verification token.',
      });
      return;
    }
    res.status(500).json({ error: err?.message || 'Failed to submit DSR request.' });
  }
});

/**
 * Public DSR receipt verification endpoint.
 * Validates HMAC-SHA256 digital signature against payload using constant-time check.
 */
dsrPublicRouter.get('/verify-receipt', async (req, res) => {
  const {
    requestId,
    tenantId,
    subjectHash,
    requestType,
    timestamp,
    signature,
  } = req.query as Record<string, string>;

  if (!requestId || !tenantId || !subjectHash || !requestType || !timestamp || !signature) {
    res.status(400).json({
      code: 'MISSING_RECEIPT_FIELDS',
      error: 'requestId, tenantId, subjectHash, requestType, timestamp, and signature are required for verification.',
    });
    return;
  }

  const payload: DSRReceiptPayload = {
    requestId,
    tenantId,
    subjectHash,
    requestType,
    timestamp,
  };

  const isValid = verifyDSRReceipt(payload, signature);

  if (!isValid) {
    res.status(400).json({
      code: 'INVALID_RECEIPT_SIGNATURE',
      error: 'Digital signature verification failed or payload has been tampered with.',
    });
    return;
  }

  res.status(200).json({
    verified: true,
    payload,
  });
});
