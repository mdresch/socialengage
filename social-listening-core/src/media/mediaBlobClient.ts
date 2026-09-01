import {
  BlobServiceClient,
  BlockBlobClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const MEDIA_CONTAINER_NAME = process.env.MEDIA_CONTAINER_NAME ?? 'social-listening-media';

function accountName(): string {
  return process.env.MEDIA_STORAGE_ACCOUNT ?? process.env.ARCHIVE_STORAGE_ACCOUNT ?? 'sociallisteningmcpp';
}

function serviceClient(): BlobServiceClient {
  return new BlobServiceClient(`https://${accountName()}.blob.core.windows.net`, new DefaultAzureCredential());
}

function getContainerClient() {
  return serviceClient().getContainerClient(MEDIA_CONTAINER_NAME);
}

/**
 * Story 13.9 (ADR-0115) — ensures the media container exists before uploading.
 * Called once per upload; idempotent and safe to call concurrently.
 */
export async function ensureMediaContainer(): Promise<void> {
  await getContainerClient().createIfNotExists();
}

export function getMediaBlockBlobClient(blobPath: string): BlockBlobClient {
  return getContainerClient().getBlockBlobClient(blobPath);
}

/**
 * Story 13.9 (ADR-0115) — uploads a media buffer to the tenant-scoped blob path
 * with its MIME type set as the Blob content type.
 */
export async function uploadMediaBlob(blobPath: string, buffer: Buffer, mimeType: string): Promise<void> {
  const client = getMediaBlockBlobClient(blobPath);
  await client.upload(buffer, buffer.length, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
    },
  });
}

function downloadUrlLifetimeSeconds(): number {
  return Number(process.env.MEDIA_DOWNLOAD_URL_LIFETIME_SECONDS ?? 24 * 60 * 60);
}

/**
 * Story 13.9 (ADR-0115) — generates a 24-hour user-delegation presigned read
 * SAS URL for the media blob. Falls back to the plain blob URL if the current
 * credential cannot obtain a user delegation key, so callers can still locate
 * the object (contract tests treat a missing SAS as a failure, not here).
 */
export async function generateMediaDownloadUrl(blobPath: string): Promise<string> {
  const client = getMediaBlockBlobClient(blobPath);
  const expiresOn = new Date(Date.now() + downloadUrlLifetimeSeconds() * 1000);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);

  try {
    const svc = serviceClient();
    const key = await svc.getUserDelegationKey(startsOn, expiresOn);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: MEDIA_CONTAINER_NAME,
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
    return client.url;
  }
}

/**
 * Test-only: deletes a media blob this session wrote so contract runs don't
 * accumulate fixture data in the real media container. Never call from
 * production code.
 */
export async function __deleteMediaBlobForTests(blobPath: string): Promise<void> {
  const client = getMediaBlockBlobClient(blobPath);
  await client.deleteIfExists();
}
