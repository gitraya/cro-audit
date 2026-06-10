import { createAuditEndpoint, getAuditsEndpoint } from "@/lib/api/audits";
import { createGeminiVoiceProvider } from "@/lib/brand/voice/gemini-provider";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const endpointClient = supabase as unknown as Parameters<
    typeof getAuditsEndpoint
  >[0];

  return getAuditsEndpoint(endpointClient);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const endpointClient = supabase as unknown as Parameters<
    typeof createAuditEndpoint
  >[1];

  return createAuditEndpoint(
    request,
    endpointClient,
    undefined,
    createGeminiVoiceProvider(),
  );
}
