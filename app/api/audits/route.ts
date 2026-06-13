import { after } from "next/server";
import { createAuditEndpoint, getAuditsEndpoint } from "@/lib/api/audits";
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

  // `after()` (Next.js / Vercel) keeps the pipeline running on the same
  // invocation after the response is flushed — like waitUntil — so the request
  // returns in well under the serverless limit while the 40-90s pipeline (3 LLM
  // calls + PageSpeed) finishes in the background.
  return createAuditEndpoint(request, endpointClient, {
    schedule: (task) => after(task),
  });
}
