/**
 * backend/src/controllers/healthController.ts
 *
 * Controller for the /api/health endpoint.
 *
 * Architecture rule: Controllers are thin.
 * This controller reads config and returns a response — no business logic.
 */

import { Request, Response } from 'express';
import { config } from '../config/env.js';

const START_TIME = new Date();

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '0.0.1',
    uptime_seconds: Math.floor((Date.now() - START_TIME.getTime()) / 1000),
    demo_mode: config.isDemoMode,
  });
}

export function getReady(_req: Request, res: Response): void {
  const mem = process.memoryUsage();
  res.status(200).json({
    ready: true,
    status: 'ready',
    database: config.isDemoMode ? 'in_memory_datastore' : 'supabase_connected',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - START_TIME.getTime()) / 1000),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    },
  });
}
