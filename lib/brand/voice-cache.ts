import type { Json } from "../supabase/types.ts";
import type { VoiceTokens } from "./extraction.ts";

type BrandVoiceCacheRow = {
  voice: Json;
};

export async function readCachedVoice(urlKey: string): Promise<VoiceTokens | null> {
  const supabase = await createVoiceCacheSupabaseClient();
  const { data, error } = await supabase
    .from("brand_voice_caches")
    .select("voice")
    .eq("url_key", urlKey)
    .maybeSingle<BrandVoiceCacheRow>();

  if (error) {
    throw error;
  }

  return isVoiceTokens(data?.voice) ? data.voice : null;
}

export async function writeCachedVoice(urlKey: string, voice: VoiceTokens) {
  const supabase = await createVoiceCacheSupabaseClient();
  const { error } = await supabase.from("brand_voice_caches").upsert(
    {
      url_key: urlKey,
      voice: voice as unknown as Json,
    },
    {
      onConflict: "url_key",
    },
  );

  if (error) {
    throw error;
  }
}

async function createVoiceCacheSupabaseClient() {
  const { createServerSupabaseClient } = await import("../supabase/server.ts");

  return createServerSupabaseClient();
}

function isVoiceTokens(value: Json | undefined): value is VoiceTokens {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return false;
  }

  return (
    typeof value.tone === "string" &&
    isFormality(value.formality) &&
    Array.isArray(value.phrases) &&
    value.phrases.every((phrase) => typeof phrase === "string")
  );
}

function isFormality(value: Json | undefined): value is VoiceTokens["formality"] {
  return value === "casual" || value === "neutral" || value === "formal";
}
