/**
 * frontend/src/types/api.ts
 *
 * Shared TypeScript types for API request and response shapes.
 * Add type definitions here as features are implemented in future phases.
 */

/**
 * Standard API error response shape from the backend.
 */
export interface ApiErrorResponse {
  status: 'error';
  message: string;
  code?: number;
}

/**
 * Health check response shape.
 */
export interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
  environment: string;
  version: string;
  uptime_seconds: number;
  demo_mode: boolean;
}

// Phase 1+: Add authentication and profile types here
// export interface LoginRequest { email: string; password: string; }
// export interface AuthResponse { access_token: string; user: UserProfile; }
// export interface UserProfile { id: string; display_name: string; email: string; }
