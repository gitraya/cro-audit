import { createServiceSupabaseClient } from "../supabase/admin.ts";
import type { AuditStage, AuditStatus, Json } from "../supabase/types.ts";

type AuditUpdateValues = {
  status?: AuditStatus;
  stage?: AuditStage | null;
  url?: string;
  brand_tokens?: Json | null;
  pagespeed_data?: Json | null;
  findings?: Json | null;
  generated_html?: string | null;
  applied_changes?: Json | null;
  error_message?: string | null;
};

export type AuditMutationClient = {
  from: (table: "audits") => {
    update: (values: AuditUpdateValues) => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export type CompletedAuditArtifacts = {
  url?: string;
  brand_tokens?: Json | null;
  pagespeed_data?: Json | null;
  findings: Json;
  generated_html: string | null;
  applied_changes: Json | null;
};

function defaultClient(): AuditMutationClient {
  return createServiceSupabaseClient() as unknown as AuditMutationClient;
}

// Lightweight single-update progress marker between pipeline stages.
export async function updateAuditStage(
  id: string,
  stage: AuditStage,
  supabase: AuditMutationClient = defaultClient(),
): Promise<void> {
  const { error } = await supabase.from("audits").update({ stage }).eq("id", id);

  if (error) {
    throw new Error(`Failed to update audit stage to ${stage}: ${error.message}`);
  }
}

// Terminal success: status complete, stage done, plus the produced artifacts.
export async function completeAudit(
  id: string,
  artifacts: CompletedAuditArtifacts,
  supabase: AuditMutationClient = defaultClient(),
): Promise<void> {
  const { error } = await supabase
    .from("audits")
    .update({
      status: "completed",
      stage: "done",
      error_message: null,
      ...artifacts,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to complete audit: ${error.message}`);
  }
}

// Terminal failure: status failed, reason recorded. Stage is left where it broke.
export async function failAudit(
  id: string,
  reason: string,
  supabase: AuditMutationClient = defaultClient(),
): Promise<void> {
  const { error } = await supabase
    .from("audits")
    .update({
      status: "failed",
      error_message: reason,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to mark audit as failed: ${error.message}`);
  }
}
