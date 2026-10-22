/**
 * backend/src/integrations/storage/types.ts
 *
 * Pluggable file storage interface for medical records.
 * Supports Supabase Storage (production) and Local Disk / Memory Storage (demo/test).
 */

export interface StorageUploadOptions {
  bucket: string;
  path: string;
  fileBuffer: Buffer;
  contentType: string;
}

export interface IStorageProvider {
  uploadFile(options: StorageUploadOptions): Promise<{ storagePath: string }>;
  downloadFile(bucket: string, path: string): Promise<Buffer>;
  getSignedUrl(bucket: string, path: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(bucket: string, path: string): Promise<void>;
}
