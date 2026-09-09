import { Router, Request, Response } from 'express';
import { validateCaptchaToken } from '../../../governance/captchaValidator';
import { createTakedownRequest, verifyTakedownMagicLink } from '../../../governance/takedownStore';

export const takedownsPublicRouter = Router();

// POST /public/v1/takedowns (or /v1/public/takedowns)
takedownsPublicRouter.post('/', async (req: Request, res: Response) => {
  const { tenantId, postId, postUrl, authorEmail, authorName, reason, captchaToken, riskFlag, riskReason } = req.body || {};

  // AC1: Mandatory bot mitigation (CAPTCHA)
  const captchaResult = validateCaptchaToken(captchaToken);
  if (!captchaResult.valid) {
    return res.status(400).json({
      error: 'CAPTCHA_VERIFICATION_FAILED',
      message: captchaResult.reason || 'Bot mitigation challenge token is missing or invalid.',
    });
  }

  if (!postUrl || !authorEmail) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'postUrl and authorEmail are required fields.',
    });
  }

  if (!tenantId) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'tenantId is required.',
    });
  }

  try {
    const takedown = await createTakedownRequest({
      tenantId,
      postId,
      postUrl,
      authorEmail,
      authorName,
      reason,
      captchaToken,
      riskFlag,
      riskReason,
    });

    return res.status(202).json({
      status: takedown.status,
      message: 'Verification link sent to author email. SLA clock begins upon verification.',
      requestId: takedown.id,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'SUBMISSION_FAILED',
      message: err.message || 'Failed to submit takedown request.',
    });
  }
});

// POST /public/v1/takedowns/verify
takedownsPublicRouter.post('/verify', async (req: Request, res: Response) => {
  const { token } = req.body || {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      error: 'INVALID_TOKEN',
      message: 'Magic link verification token is required.',
    });
  }

  try {
    const verified = await verifyTakedownMagicLink(token);
    if (!verified) {
      return res.status(404).json({
        error: 'TOKEN_NOT_FOUND',
        message: 'Invalid or expired verification token.',
      });
    }

    return res.status(200).json(verified);
  } catch (err: any) {
    return res.status(500).json({
      error: 'VERIFICATION_FAILED',
      message: err.message || 'Failed to verify takedown token.',
    });
  }
});
