import { logPlatformAdminAction } from '../admin/platformAdminAuditLog';

export type RemediationAction =
  | 'retry_now'
  | 'override_backoff'
  | 'clear_error_state'
  | 'reprompt_credentials';

export interface RemediationResult {
  connectorId: string;
  action: RemediationAction;
  status: 'active' | 'retrying' | 'healthy' | 'needs_reauth';
  backoffLiftedUntil?: string;
  remediatedAt: string;
}

export async function remediateConnector(
  connectorId: string,
  action: RemediationAction,
  actorIdentity: string,
  overrideMinutes?: number
): Promise<RemediationResult> {
  const remediatedAt = new Date().toISOString();
  let status: 'active' | 'retrying' | 'healthy' | 'needs_reauth';
  let backoffLiftedUntil: string | undefined;

  switch (action) {
    case 'retry_now':
      status = 'retrying';
      break;
    case 'override_backoff': {
      const minutes = overrideMinutes && overrideMinutes > 0 ? overrideMinutes : 15;
      backoffLiftedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      status = 'active';
      break;
    }
    case 'clear_error_state':
      status = 'healthy';
      break;
    case 'reprompt_credentials':
      status = 'needs_reauth';
      break;
    default:
      throw new Error(`Unsupported remediation action: ${action}`);
  }

  await logPlatformAdminAction({
    actorIdentity,
    operation: 'connector_remediation',
    detail: {
      connectorId,
      action,
      ...(overrideMinutes !== undefined ? { overrideMinutes } : {}),
      ...(backoffLiftedUntil ? { backoffLiftedUntil } : {}),
      status,
    },
  });

  return {
    connectorId,
    action,
    status,
    ...(backoffLiftedUntil ? { backoffLiftedUntil } : {}),
    remediatedAt,
  };
}
