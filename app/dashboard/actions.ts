"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createAudit(formData: FormData) {
  const rawUrl = formData.get("url");
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";

  if (!url) {
    redirect("/dashboard?error=Website%20URL%20is%20required");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("audits")
    .insert({
      user_id: user.id,
      url,
      status: "queued",
      brand_tokens: null,
      pagespeed_data: null,
      findings: null,
      generated_html: null,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect(`/audits/${data.id}`);
}
