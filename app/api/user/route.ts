import { getUserEndpoint } from "@/lib/api/user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const endpointClient = supabase as unknown as Parameters<
    typeof getUserEndpoint
  >[0];

  return getUserEndpoint(endpointClient);
}
