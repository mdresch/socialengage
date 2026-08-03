import { Request } from 'express';
import { ResolvedIdentity } from '../../identity/identityResolution';

/**
 * Shared request augmentation for both the real and test-bypass auth
 * middleware. See .claude/skills/tenant-auth-middleware/SKILL.md.
 */
export interface RequestWithIdentity extends Request {
  identity?: ResolvedIdentity;
}
