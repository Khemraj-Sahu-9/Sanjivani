/**
 * backend/tests/health.test.ts
 *
 * Tests for the GET /api/health endpoint.
 */

import { describe, it, expect } from 'vitest';
import supertest from 'supertest';

// Set DEMO_MODE before importing app to avoid Supabase validation
process.env['DEMO_MODE'] = 'true';
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';

// Dynamic import after env setup
const { app } = await import('../src/app.js');

const request = supertest(app);

describe('GET /api/health', () => {
  it('returns HTTP 200', async () => {
    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
  });

  it('returns status "ok"', async () => {
    const res = await request.get('/api/health');
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('returns expected fields', async () => {
    const res = await request.get('/api/health');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('environment');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('uptime_seconds');
    expect(res.body).toHaveProperty('demo_mode');
  });

  it('returns demo_mode true in test environment', async () => {
    const res = await request.get('/api/health');
    expect(res.body.demo_mode).toBe(true);
  });

  it('returns a valid ISO timestamp', async () => {
    const res = await request.get('/api/health');
    const ts = new Date(res.body.timestamp as string);
    expect(ts.getTime()).not.toBeNaN();
  });
});

describe('GET /api/health/ready', () => {
  it('returns HTTP 200 with readiness status and memory metrics', async () => {
    const res = await request.get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ready: true,
      status: 'ready',
    });
    expect(res.body).toHaveProperty('database');
    expect(res.body).toHaveProperty('memory');
    expect(res.body.memory).toHaveProperty('rss_mb');
    expect(res.body.memory).toHaveProperty('heap_used_mb');
  });
});

describe('404 handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request.get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('returns error status in 404 body', async () => {
    const res = await request.get('/api/does-not-exist');
    expect(res.body).toMatchObject({ status: 'error' });
  });
});
