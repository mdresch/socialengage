import { getRegisteredOpenApiPaths, OpenApiOperation, HttpMethod } from './registry';

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
}

/**
 * Assembles an OpenAPI 3.0 document from whichever routes have registered
 * themselves via registerOpenApiOperation() by the time this runs — see
 * registry.ts. Callers must import the real route modules (or createApp())
 * first so those registrations have actually happened; see
 * scripts/generateOpenApiSpec.ts for the real CI entry point.
 */
export function generateOpenApiDocument(): OpenApiDocument {
  const paths: OpenApiDocument['paths'] = {};
  for (const [path, methods] of getRegisteredOpenApiPaths()) {
    paths[path] = methods;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'social-listening-core',
      version: '1',
    },
    paths,
  };
}
