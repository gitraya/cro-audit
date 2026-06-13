import { createServiceSupabaseClient } from "../supabase/admin.ts";
import type { AuditStage, AuditStatus, Json } from "../supabase/types.ts";

type AuditUpdateValues = {
  status?: AuditStatus;
  stage?: AuditStage | null;
  url?: string;
  brand_tokens?: Json | null;
  pagespeed_data?: Json | null;
  layout_hints?: Json | null;
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
  layout_hints?: Json | null;
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
  artifacts: AuditUpdateValues,
  supabase: AuditMutationClient = defaultClient(),
): Promise<void> {
  const { error } = await supabase
    .from("audits")
    .update(artifacts)
    .eq("id", id);

  if (error) {
    throw new Error(
      `Failed to update audit stage to ${artifacts.stage}: ${error.message}`,
    );
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
