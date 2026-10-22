/// <reference types="vite/client" />

/**
 * frontend/src/vite-env.d.ts
 *
 * Type declarations for Vite environment variables and CSS modules.
 */

// CSS Modules
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

// Environment variables exposed through import.meta.env
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
