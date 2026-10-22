import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
import path from 'node:path';
import { URL } from 'node:url';

// Load backend/.env for diagnostic testing
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
process.env['DEMO_MODE'] = 'false';

const { config } = await import('../src/config/env.js');
const { createClient } = await import('@supabase/supabase-js');

describe('Supabase Connection & Environment Diagnostic', () => {
  it('loads configuration properly and supports modern and legacy key aliases', () => {
    expect(config.supabase).toBeDefined();
    expect(config.supabase.url).toBeDefined();
    expect(config.supabase.secretKey).toBeDefined();
    expect(config.supabase.publishableKey).toBeDefined();
    expect(config.supabase.serviceRoleKey).toEqual(config.supabase.secretKey);
    expect(config.supabase.anonKey).toEqual(config.supabase.publishableKey);
  });

  it('has a valid HTTPS project URL format', () => {
    expect(config.supabase.url).toBeTruthy();
    const parsed = new URL(config.supabase.url);
    expect(parsed.protocol).toBe('https:');
    expect(parsed.hostname).toMatch(/\.supabase\.co$/);
  });

  it('initializes Supabase client cleanly with the configured credentials', () => {
    const client = createClient(config.supabase.url, config.supabase.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(client.storage).toBeDefined();
  });

  it('verifies real authorized database / service operation with live Supabase', async () => {
    const client = createClient(config.supabase.url, config.supabase.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Verify storage bucket listing
    const { data: buckets, error: bError } = await client.storage.listBuckets();
    expect(bError).toBeNull();
    expect(Array.isArray(buckets)).toBe(true);

    // Verify roundtrip authorized storage read/write
    const bucketName = 'health-documents';
    const testFile = 'test-ping-' + Date.now() + '.txt';
    const { error: upErr } = await client.storage.from(bucketName).upload(testFile, Buffer.from('ping'), { upsert: true });
    expect(upErr).toBeNull();

    const { data: downData, error: downErr } = await client.storage.from(bucketName).download(testFile);
    expect(downErr).toBeNull();
    expect(downData).toBeDefined();

    const { error: rmErr } = await client.storage.from(bucketName).remove([testFile]);
    expect(rmErr).toBeNull();
  });
});
