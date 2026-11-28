import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase clients.
 *
 * Three distinct clients on purpose:
 *
 *   getPublicClient()   — anon key, no session. Catalog reads only; RLS applies.
 *   getServerClient()   — anon key + forwarded user JWT. All customer actions.
 *   getServiceClient()  — service-role key. Webhook + trusted writes only.
 *                         NEVER import this from client-side code; it bypasses RLS.
 *
 * The service key must exist only in server environment variables.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

let publicClient: SupabaseClient | undefined;

export function getPublicClient(): SupabaseClient {
  if (!publicClient) {
    publicClient = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_ANON_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return publicClient;
}

/** Build a client scoped to an end user by forwarding their access token. */
export function getServerClient(accessToken?: string): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      ...(accessToken
        ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
        : {}),
    },
  );
}

let serviceClient: SupabaseClient | undefined;

export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return serviceClient;
}

/**
 * Resolve the caller from the Authorization header.
 * Returns null for anonymous requests — never throws, so callers decide policy.
 */
export async function getUserFromRequest(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  const { data, error } = await getServiceClient().auth.getUser(token);
  if (error || !data.user) return null;

  return { user: data.user, token };
}
