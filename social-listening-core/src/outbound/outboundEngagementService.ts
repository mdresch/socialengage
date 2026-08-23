import { SocialConnector } from '../connectors/types';
import { acquireForOutbound } from '../connectors/requestGate';
import { ClassifiableError, ErrorKind } from '../ingestion/errorClassification';
import { SocialPostSummary } from '../posts/socialPostStore';

export interface OutboundEngagementInput {
  tenantId: string;
  userId: string;
  post: SocialPostSummary;
  body: string;
  credential: string;
  connector: SocialConnector;
}

export interface OutboundEngagementResult {
  tenantId: string;
  postId: string;
  userId: string;
  providerId: string;
  credential: string;
  activityType: 'reply';
  body: string;
  status: 'pending' | 'sent' | 'failed';
  externalId: string | null;
  externalUrl: string | null;
  errorCode: ErrorKind | null;
  createdAt: string;
  sentAt: string | null;
  failedAt: string | null;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Story 2.26 (ADR-0073) — execute an optional outbound `SocialConnector.reply()`
 * under a separate RequestGate key and return an `outbound_activities`-shaped
 * result. This is the outbound side of the connector reply framework; it does
 * not persist the row (Story 3.14 owns persistence/REST).
 */
export async function invoke(input: OutboundEngagementInput): Promise<OutboundEngagementResult> {
  const { tenantId, userId, post, body, credential, connector } = input;
  const createdAt = now();

  if (!connector.reply) {
    return {
      tenantId,
      postId: post.id,
      userId,
      providerId: connector.providerId,
      credential,
      activityType: 'reply',
      body,
      status: 'failed',
      externalId: null,
      externalUrl: null,
      errorCode: 'reply_not_supported',
      createdAt,
      sentAt: null,
      failedAt: now(),
    };
  }

  try {
    await acquireForOutbound(tenantId, connector);
  } catch (err) {
    const errorCode = mapGateError(err);
    return {
      tenantId,
      postId: post.id,
      userId,
      providerId: connector.providerId,
      credential,
      activityType: 'reply',
      body,
      status: 'failed',
      externalId: null,
      externalUrl: null,
      errorCode,
      createdAt,
      sentAt: null,
      failedAt: now(),
    };
  }

  try {
    const { externalId, externalUrl } = await connector.reply(post, body, credential);
    return {
      tenantId,
      postId: post.id,
      userId,
      providerId: connector.providerId,
      credential,
      activityType: 'reply',
      body,
      status: 'sent',
      externalId,
      externalUrl,
      errorCode: null,
      createdAt,
      sentAt: now(),
      failedAt: null,
    };
  } catch (err) {
    const errorCode = err instanceof ClassifiableError ? err.kind : 'network';
    return {
      tenantId,
      postId: post.id,
      userId,
      providerId: connector.providerId,
      credential,
      activityType: 'reply',
      body,
      status: 'failed',
      externalId: null,
      externalUrl: null,
      errorCode,
      createdAt,
      sentAt: null,
      failedAt: now(),
    };
  }
}

function mapGateError(err: unknown): ErrorKind {
  if (err instanceof ClassifiableError) {
    return err.kind;
  }
  if (err instanceof Error && err.name === 'QueueTtlExceededError') {
    return 'queue_ttl_exceeded';
  }
  if (err instanceof Error && err.name === 'QueueDepthExceededError') {
    return 'queue_depth_exceeded';
  }
  return 'network';
}
