import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client.
 *
 * Holds the user's session (persisted in localStorage by supabase-js, but the
 * session token is opaque and refreshable — unlike the previous design where the
 * plaintext password itself lived in localStorage).
 *
 * Only the anon key is used here. All privileged writes go through server
 * functions; RLS is the actual authority.
 *
 * Returns null when env vars are absent so the app can fall back to demo mode
 * during local development without a Supabase project.
 */

let browserClient: SupabaseClient | null = null;
let initialised = false;

function readEnv(key: string): string | undefined {
  // Vite inlines import.meta.env at build time; process.env covers SSR.
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return viteEnv?.[key] ?? process.env[key];
}

export function getBrowserClient(): SupabaseClient | null {
  if (initialised) return browserClient;
  initialised = true;

  const url = readEnv("VITE_SUPABASE_URL");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    browserClient = null;
    return null;
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "smartpro-auth",
    },
  });
  return browserClient;
}

/** True when a Supabase project is configured. UI uses this to show demo mode. */
export function isBackendEnabled(): boolean {
  return getBrowserClient() !== null;
}
