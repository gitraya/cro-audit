"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractBrandTokens } from "@/lib/brand/extraction";
import { scrapeHomepage } from "@/lib/scraper/homepage";
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

  let scrapedPage;
  let brandTokens;

  try {
    scrapedPage = await scrapeHomepage(url);
    brandTokens = await extractBrandTokens(scrapedPage);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }

  const { data, error } = await supabase
    .from("audits")
    .insert({
      user_id: user.id,
      url: scrapedPage.requestedUrl,
      status: "queued",
      brand_tokens: brandTokens,
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
