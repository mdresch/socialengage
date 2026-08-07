export type ErrorKind =
  | 'rate_limit'
  | 'network'
  | 'http_5xx'
  | 'http_401'
  | 'http_403'
  | 'malformed_watchlist'
  | 'queue_ttl_exceeded'
  | 'queue_depth_exceeded'
  | 'tenant_deletion_requested';

const RETRYABLE_KINDS: ReadonlySet<ErrorKind> = new Set(['rate_limit', 'network', 'http_5xx']);
const CREDENTIAL_KINDS: ReadonlySet<ErrorKind> = new Set(['http_401', 'http_403']);

/**
 * An ingestion-attempt failure, tagged with the classification that decides how
 * runIngestionAttempt() responds to it (ADR-0010). See
 * .claude/skills/connector-health-and-error-handling/SKILL.md.
 */
export class ClassifiableError extends Error {
  constructor(public readonly kind: ErrorKind, message?: string) {
    super(message ?? kind);
    this.name = 'ClassifiableError';
  }
}

export function isRetryable(kind: ErrorKind): boolean {
  return RETRYABLE_KINDS.has(kind);
}

export function isCredentialError(kind: ErrorKind): boolean {
  return CREDENTIAL_KINDS.has(kind);
}
