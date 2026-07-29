import express, { Express } from 'express';
import { v1Router } from './versions/v1/router';

/**
 * Every route is mounted under a version prefix (ADR-0017) — never mount
 * anything at the app root. See .claude/skills/http-api-versioning/SKILL.md.
 */
export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/v1', v1Router);
  return app;
}
