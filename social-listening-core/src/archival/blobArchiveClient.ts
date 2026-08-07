import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const CONTAINER_NAME = 'social-listening-archive';

/**
 * DefaultAzureCredential's chain includes AzureCliCredential, so local dev/test just
 * needs `az login` already done — no separate local credential setup, same as
 * keyVaultProvider.ts/serviceBusPublisher.ts.
 */
function accountName(): string {
  return process.env.ARCHIVE_STORAGE_ACCOUNT ?? 'sociallisteningdev';
}

function client(): BlobServiceClient {
  return new BlobServiceClient(`https://${accountName()}.blob.core.windows.net`, new DefaultAzureCredential());
}

/**
 * Writes archived content to the shared archive container, keyed by
 * `blobPath` (Story 3.5, ADR-0018 — "keyed by post ID"). Overwrites if the
 * path already exists, making archival idempotent to re-run.
 */
export async function uploadArchiveBlob(blobPath: string, content: string): Promise<void> {
  const containerClient = client().getContainerClient(CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
  // BlockBlobClient.upload() overwrites by default — no explicit flag needed.
  await blockBlobClient.upload(content, Buffer.byteLength(content));
}

/** Recovers previously-archived content by its blobPath — ADR-0018's "never discarded" guarantee post-archival. */
export async function downloadArchiveBlob(blobPath: string): Promise<string> {
  const containerClient = client().getContainerClient(CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
  const buffer = await blockBlobClient.downloadToBuffer();
  return buffer.toString('utf-8');
}

/** Test-only: deletes a blob this session wrote, so contract runs don't accumulate leftover fixtures in the real archive container. Never call from real archival code — archived data is meant to be durable. */
export async function __deleteArchiveBlobForTests(blobPath: string): Promise<void> {
  const containerClient = client().getContainerClient(CONTAINER_NAME);
  await containerClient.getBlockBlobClient(blobPath).deleteIfExists();
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
  const containerClient = client().getContainerClient(CONTAINER_NAME);
  const result = await containerClient.getBlockBlobClient(blobPath).deleteIfExists();
  return result.succeeded;
}
