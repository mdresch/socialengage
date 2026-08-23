import { SocialConnector, OutboundPostPayload } from '../connectors/types';
import { acquireForOutboundPost } from '../connectors/requestGate';
import { ClassifiableError, ErrorKind } from '../ingestion/errorClassification';

export interface OutboundPostInput {
  tenantId: string;
  userId: string;
  payload: OutboundPostPayload;
  credential: string;
  connector: SocialConnector;
}

export interface OutboundPostResult {
  tenantId: string;
  userId: string;
  providerId: string;
  credential: string;
  postId: null;
  activityType: 'post';
  targetAssetId: string;
  targetAssetType: string;
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
 * Story 2.28 (ADR-0075) — execute an optional outbound `SocialConnector.publish()`
 * under a separate RequestGate key and return an `outbound_activities`-shaped
 * result for `activity_type='post'`. This is the outbound side of the connector
 * publish framework; it does not persist the row (Story 3.15 owns persistence/REST).
 */
export async function invoke(input: OutboundPostInput): Promise<OutboundPostResult> {
  const { tenantId, userId, payload, credential, connector } = input;
  const createdAt = now();

  const baseResult: Omit<OutboundPostResult, 'status' | 'externalId' | 'externalUrl' | 'errorCode'> = {
    tenantId,
    userId,
    providerId: connector.providerId,
    credential,
    postId: null,
    activityType: 'post',
    targetAssetId: payload.targetAssetId,
    targetAssetType: payload.targetAssetType,
    body: payload.text,
    createdAt,
    sentAt: null,
    failedAt: null,
  };

  if (!connector.publish) {
    return {
      ...baseResult,
      status: 'failed',
      externalId: null,
      externalUrl: null,
      errorCode: 'publish_not_supported',
      sentAt: null,
      failedAt: now(),
    };
  }

  try {
    await acquireForOutboundPost(tenantId, connector);
  } catch (err) {
    const errorCode = mapGateError(err);
    return {
      ...baseResult,
      status: 'failed',
      externalId: null,
      externalUrl: null,
      errorCode,
      sentAt: null,
      failedAt: now(),
    };
  }

  try {
    const { externalId, externalUrl } = await connector.publish(tenantId, userId, payload, credential);
    return {
      ...baseResult,
      status: 'sent',
      externalId,
      externalUrl,
      errorCode: null,
      sentAt: now(),
      failedAt: null,
    };
  } catch (err) {
    const errorCode = err instanceof ClassifiableError ? err.kind : 'network';
    return {
      ...baseResult,
      status: 'failed',
      externalId: null,
      externalUrl: null,
      errorCode,
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
