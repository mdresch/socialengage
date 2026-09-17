/**
 * Story 20.1 (ADR-0144/TDS-0144): generates openapi.json at the repo root
 * from the real, currently-registered routes and writes it to disk. Run via
 * `npm run openapi:generate` — wired into CI as a build-time step that
 * publishes the result as an artifact on every build (TDS-0144's CI/CD
 * summary). Importing the real v1 router (the same module createApp() uses)
 * is what triggers each route file's registerOpenApiOperation() calls.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import '../src/http/versions/v1/router';
import { generateOpenApiDocument } from '../src/http/openapi/generateOpenApiDocument';

const doc = generateOpenApiDocument();
const outPath = join(__dirname, '..', 'openapi.json');
writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');
console.log(`Wrote ${outPath} with ${Object.keys(doc.paths).length} path(s).`);
