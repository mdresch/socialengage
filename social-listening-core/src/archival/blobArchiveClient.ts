import {
  BlobServiceClient,
  BlockBlobClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const CONTAINER_NAME = 'social-listening-archive';

/**
 * DefaultAzureCredential's chain includes AzureCliCredential, so local dev/test just
 * needs `az login` already done — no separate local credential setup, same as
 * keyVaultProvider.ts/serviceBusPublisher.ts.
 */
function accountName(): string {
  return process.env.ARCHIVE_STORAGE_ACCOUNT ?? 'sociallisteningmcpp';
}

function serviceClient(): BlobServiceClient {
  return new BlobServiceClient(`https://${accountName()}.blob.core.windows.net`, new DefaultAzureCredential());
}

function blockBlobClient(blobPath: string): BlockBlobClient {
  return serviceClient().getContainerClient(CONTAINER_NAME).getBlockBlobClient(blobPath);
}

/**
 * Writes archived content to the shared archive container, keyed by
 * `blobPath` (Story 3.5, ADR-0018 — "keyed by post ID"). Overwrites if the
 * path already exists, making archival idempotent to re-run.
 */
export async function uploadArchiveBlob(blobPath: string, content: string): Promise<void> {
  const client = blockBlobClient(blobPath);
  await client.upload(content, Buffer.byteLength(content));
}

/** Recovers previously-archived content by its blobPath — ADR-0018's "never discarded" guarantee post-archival. */
export async function downloadArchiveBlob(blobPath: string): Promise<string> {
  const client = blockBlobClient(blobPath);
  const buffer = await client.downloadToBuffer();
  return buffer.toString('utf-8');
}

/** Test-only: deletes a blob this session wrote, so contract runs don't accumulate leftover fixtures in the real archive container. Never call from real archival code — archived data is meant to be durable. */
export async function __deleteArchiveBlobForTests(blobPath: string): Promise<void> {
  await serviceClient().getContainerClient(CONTAINER_NAME).getBlockBlobClient(blobPath).deleteIfExists();
}

/**
 * Story 3.7 (ADR-0039 §3) — the one real, production caller allowed to delete
 * archived content. ADR-0018's "never discarded" guarantee is a default for
 * an *active* tenant's ongoing operation, not a promise surviving the
 * tenant's own deletion (ADR-0039 §3's own framing) — this function is that
 * named, scoped exception, distinct from `__deleteArchiveBlobForTests()`
 * above (which exists only to keep contract runs from littering the real
 * archive container, never called from real deletion logic). `deleteIfExists`
 * so a blob that was never actually archived (e.g. a post whose rawPayload
 * never aged out) is a no-op, not an error.
 */
export async function deleteArchiveBlob(blobPath: string): Promise<boolean> {
  const result = await serviceClient().getContainerClient(CONTAINER_NAME).getBlockBlobClient(blobPath).deleteIfExists();
  return result.succeeded;
}

function exportBlobLifetimeSeconds(): number {
  return Number(process.env.EXPORT_BLOB_LIFETIME_SECONDS ?? 7 * 24 * 60 * 60);
}

function downloadUrlLifetimeSeconds(): number {
  return Number(process.env.EXPORT_DOWNLOAD_URL_LIFETIME_SECONDS ?? 24 * 60 * 60);
}

/**
 * Story 13.4 (ADR-0111) — upload an export blob with `expires_at` metadata set
 * to 7 days in the future. The actual hard-deletion is the responsibility of a
 * container-level lifecycle policy (not implemented by application code in this
 * story).
 */
export async function uploadExportBlob(blobPath: string, content: string, tenantId: string, jobId: string): Promise<void> {
  const client = blockBlobClient(blobPath);
  const expiresAt = new Date(Date.now() + exportBlobLifetimeSeconds() * 1000).toISOString();
  await client.upload(content, Buffer.byteLength(content), {
    metadata: {
      expires_at: expiresAt,
      tenant_id: tenantId,
      job_id: jobId,
    },
    blobHTTPHeaders: {
      blobContentType: blobPath.endsWith('.json') ? 'application/json' : 'text/csv; charset=utf-8',
    },
  });
}

/**
 * Story 13.4 (ADR-0111) — generate a 24-hour user-delegation presigned read
 * SAS URL for the export blob. Falls back to a plain HTTPS URL if the current
 * credential cannot generate a user delegation key, so callers can still locate
 * the object. The contract asserts the URL contains SAS parameters; a fallback
 * without a SAS token is treated as a test failure there, not here.
 */
export async function generatePresignedDownloadUrl(blobPath: string): Promise<string> {
  const client = blockBlobClient(blobPath);
  const expiresOn = new Date(Date.now() + downloadUrlLifetimeSeconds() * 1000);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000); // small clock skew buffer

  try {
    const svc = serviceClient();
    const key = await svc.getUserDelegationKey(startsOn, expiresOn);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: CONTAINER_NAME,
        blobName: blobPath,
        permissions: BlobSASPermissions.parse('r'),
        startsOn,
        expiresOn,
      },
      key,
      accountName()
    );
    return `${client.url}?${sas.toString()}`;
  } catch {
    // If the credential cannot obtain a user delegation key (e.g. local dev
    // identity missing the right RBAC), return the unadorned blob URL. The
    // contract will fail on the missing SAS parameters and surface the issue.
    return client.url;
  }
}

/**
 * Story 13.4 (ADR-0111) — test-only helper that reads back the metadata we
 * wrote with `uploadExportBlob()`. Contract tests use this to assert the 7-day
 * blob expiry. Never call from production code.
 */
export async function __getExportBlobMetadataForTests(
  blobPath: string
): Promise<{ blobPath: string; expiresAt: string; tenantId: string; jobId: string; contentType: string }> {
  const client = blockBlobClient(blobPath);
  const props = await client.getProperties();
  return {
    blobPath,
    expiresAt: props.metadata?.expires_at ?? '',
    tenantId: props.metadata?.tenant_id ?? '',
    jobId: props.metadata?.job_id ?? '',
    contentType: props.contentType ?? '',
  };
}
