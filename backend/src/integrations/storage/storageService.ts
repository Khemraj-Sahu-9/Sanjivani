/**
 * backend/src/integrations/storage/storageService.ts
 *
 * Implements private storage operations for medical documents.
 * Never issues public permanent URLs.
 * In DEMO_MODE/test, operates in an in-memory/buffer registry.
 * In live mode, interacts with private Supabase Storage buckets.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { IStorageProvider, StorageUploadOptions } from './types.js';

class MemoryStorageProvider implements IStorageProvider {
  private files = new Map<string, { buffer: Buffer; contentType: string }>();

  async uploadFile({ bucket, path, fileBuffer, contentType }: StorageUploadOptions): Promise<{ storagePath: string }> {
    const key = `${bucket}/${path}`;
    this.files.set(key, { buffer: fileBuffer, contentType });
    logger.debug(`[Storage:Memory] Uploaded ${key} (${fileBuffer.length} bytes, ${contentType})`);
    return { storagePath: path };
  }

  async downloadFile(bucket: string, path: string): Promise<Buffer> {
    const key = `${bucket}/${path}`;
    const file = this.files.get(key);
    if (!file) {
      throw new Error(`[Storage:Memory] File not found: ${key}`);
    }
    return file.buffer;
  }

  async getSignedUrl(bucket: string, path: string, _expiresInSeconds = 300): Promise<string> {
    const key = `${bucket}/${path}`;
    const file = this.files.get(key);
    if (!file) {
      throw new Error(`[Storage:Memory] Cannot generate URL. File not found: ${key}`);
    }
    // Return a data URL or safe backend proxy URL
    return `/api/families/documents/file-view?path=${encodeURIComponent(path)}`;
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    const key = `${bucket}/${path}`;
    this.files.delete(key);
    logger.debug(`[Storage:Memory] Deleted ${key}`);
  }
}

class SupabaseStorageProvider implements IStorageProvider {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async uploadFile({ bucket, path, fileBuffer, contentType }: StorageUploadOptions): Promise<{ storagePath: string }> {
    const { error } = await this.client.storage.from(bucket).upload(path, fileBuffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(`[Storage:Supabase] Upload failed: ${error.message}`);
    }
    return { storagePath: path };
  }

  async downloadFile(bucket: string, path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(bucket).download(path);
    if (error || !data) {
      throw new Error(`[Storage:Supabase] Download failed: ${error?.message || 'File not found'}`);
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getSignedUrl(bucket: string, path: string, expiresInSeconds = 300): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`[Storage:Supabase] Signed URL generation failed: ${error?.message || 'Unknown error'}`);
    }
    return data.signedUrl;
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) {
      throw new Error(`[Storage:Supabase] Delete failed: ${error.message}`);
    }
  }
}

export const storageProvider: IStorageProvider = config.isDemoMode
  ? new MemoryStorageProvider()
  : new SupabaseStorageProvider();
