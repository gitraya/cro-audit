import { getAuditStatusEndpoint } from "@/lib/api/audits";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const endpointClient = supabase as unknown as Parameters<
    typeof getAuditStatusEndpoint
  >[0];

  return getAuditStatusEndpoint(endpointClient, id);
}
