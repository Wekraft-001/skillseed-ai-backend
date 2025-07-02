import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export async function uploadToAzureStorage(
  file: Express.Multer.File,
): Promise<string> {
  const accountName = process.env.AZURE_ACCT_NAME;
  const accountKey = process.env.AZURE_ACCT_KEY;
  const containerName = process.env.AZURE_CONTAINER_NAME;

  if (!accountName || !accountKey || !containerName) {
    throw new Error(
      'Azure storage environment variables are not properly set.',
    );
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey,
  );

  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    sharedKeyCredential,
  );

  const containerClient = blobServiceClient.getContainerClient(containerName);

  const compressedBuffer = await sharp(file.buffer)
    .resize({ width: 800 })
    .jpeg({ quality: 60 })
    .toBuffer();

  const blobName = `${uuidv4()}.jpeg`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(compressedBuffer, {
    blobHTTPHeaders: { blobContentType: 'image/jpeg' },
  });

  return blockBlobClient.url;
}
