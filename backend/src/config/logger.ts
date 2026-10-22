/**
 * backend/src/config/logger.ts
 *
 * Simple structured logger for the backend.
 * Uses console methods with log-level filtering.
 *
 * Rules:
 * - Never log secrets, tokens, or sensitive user data.
 * - Stack traces are only logged in development and test environments.
 * - In production, log structured JSON for easy ingestion by log aggregators.
 */

import { config } from './env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LEVELS[config.logLevel as LogLevel] ?? LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= currentLevel;
}

function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  if (config.isProduction) {
    return JSON.stringify({ timestamp, level: level.toUpperCase(), message, ...(meta !== undefined ? { meta } : {}) });
  }
  const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug(message: string, meta?: unknown): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, meta));
    }
  },

  info(message: string, meta?: unknown): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, meta));
    }
  },

  warn(message: string, meta?: unknown): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  error(message: string, error?: unknown): void {
    if (shouldLog('error')) {
      if (error instanceof Error) {
        const stack = !config.isProduction ? error.stack : undefined;
        console.error(formatMessage('error', message, { name: error.name, message: error.message, stack }));
      } else {
        console.error(formatMessage('error', message, error));
      }
    }
  },
};
