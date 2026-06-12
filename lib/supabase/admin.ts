import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleEnv } from "./env.ts";
import type { Database } from "./types.ts";

export function createServiceSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseServiceRoleEnv();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
