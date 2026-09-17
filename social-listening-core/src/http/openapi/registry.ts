/**
 * A route registers its own OpenAPI operation by calling
 * registerOpenApiOperation() at module load time, next to where the route
 * itself is defined — see src/http/versions/v1/watchlistsRouter.ts and
 * src/http/versions/v1/router.ts for the current registrants. See
 * .claude/skills/openapi-spec-generation/SKILL.md for why this is a manifest
 * a route opts into, rather than something reconstructed by walking
 * Express's router tree after the fact.
 */

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface OpenApiOperation {
  summary: string;
  responses: Record<string, { description: string }>;
}

const registry = new Map<string, Partial<Record<HttpMethod, OpenApiOperation>>>();

export function registerOpenApiOperation(method: HttpMethod, path: string, operation: OpenApiOperation): void {
  const methods = registry.get(path) ?? {};
  methods[method] = operation;
  registry.set(path, methods);
}

export function getRegisteredOpenApiPaths(): ReadonlyMap<string, Partial<Record<HttpMethod, OpenApiOperation>>> {
  return registry;
}
