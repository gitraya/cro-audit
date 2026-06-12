"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditEndpoint } from "@/lib/api/audits";
import { createGeminiVoiceProvider } from "@/lib/brand/voice/gemini-provider";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuditEndpointClient = Parameters<typeof createAuditEndpoint>[1];

export async function createAudit(formData: FormData) {
  const rawUrl = formData.get("url");
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";

  if (!url) {
    redirect("/dashboard?error=Website%20URL%20is%20required");
  }

  const supabase = await createServerSupabaseClient();
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const request = new Request(`${protocol}://${host}/api/audits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const response = await createAuditEndpoint(
    request,
    supabase as unknown as AuditEndpointClient,
    undefined,
    createGeminiVoiceProvider(),
  );

  const body = (await response.json()) as {
    audit?: { id: string };
    error?: string;
  };

  if (!response.ok || !body.audit?.id) {
    redirect(
      `/dashboard?error=${encodeURIComponent(body.error ?? "Audit failed")}`,
    );
  }

  revalidatePath("/dashboard");
  redirect(`/audits/${body.audit.id}`);
}
