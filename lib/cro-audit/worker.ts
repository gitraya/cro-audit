import { createServiceSupabaseClient } from "../supabase/admin.ts";
import { runAuditPipeline } from "./pipeline.ts";
import type { AuditMutationClient } from "../api/audit-repository.ts";
import type { AuditStage } from "../supabase/types.ts";

type QueueAudit = {
  id: string;
  url: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: AuditStage | null;
  created_at: string;
};

type WorkerLogger = Pick<Console, "log" | "warn" | "error">;

type WorkerSupabaseClient = ReturnType<typeof createServiceSupabaseClient>;

export type AuditWorkerOptions = {
  supabase?: WorkerSupabaseClient;
  logger?: WorkerLogger;
  pollIntervalMs?: number;
  once?: boolean;
  shouldStop?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  runPipeline?: (auditId: string, url: string) => Promise<void>;
};

export async function runAuditWorker(options: AuditWorkerOptions = {}) {
  const supabase = options.supabase ?? createServiceSupabaseClient();
  const logger = options.logger ?? console;
  const pollIntervalMs = options.pollIntervalMs ?? 5_000;
  const shouldStop = options.shouldStop ?? (() => false);
  const sleep = options.sleep ?? defaultSleep;
  const runPipeline =
    options.runPipeline ??
    ((auditId: string, url: string) =>
      runAuditPipeline(auditId, url, {
        supabase: supabase as unknown as AuditMutationClient,
      }));

  logger.log("Audit worker started.");

  while (!shouldStop()) {
    let audit: QueueAudit | null = null;

    try {
      audit = await claimNextQueuedAudit(supabase);
    } catch (error) {
      logger.error("Failed to claim the next audit job:", error);
      await sleep(pollIntervalMs);
      continue;
    }

    if (!audit) {
      if (options.once) {
        return;
      }

      await sleep(pollIntervalMs);
      continue;
    }

    logger.log(`Processing audit ${audit.id} for ${audit.url}.`);

    try {
      await runPipeline(audit.id, audit.url);
    } catch (error) {
      logger.error(`Unhandled worker error for audit ${audit.id}:`, error);
    }

    if (options.once) {
      return;
    }
  }

  logger.log("Audit worker stopped.");
}

export async function claimNextQueuedAudit(
  supabase: WorkerSupabaseClient,
): Promise<QueueAudit | null> {
  const { data: queuedAudits, error: fetchError } = await supabase
    .from("audits")
    .select("id, url, status, stage, created_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (fetchError) {
    throw new Error(`Failed to list queued audits: ${fetchError.message}`);
  }

  const nextAudit = (queuedAudits?.[0] ?? null) as QueueAudit | null;

  if (!nextAudit) {
    return null;
  }

  const { data: claimedAudit, error: claimError } = await supabase
    .from("audits")
    .update({ status: "running" })
    .eq("id", nextAudit.id)
    .eq("status", "queued")
    .select("id, url, status, stage, created_at")
    .single();

  if (claimError) {
    throw new Error(`Failed to claim audit ${nextAudit.id}: ${claimError.message}`);
  }

  return (claimedAudit ?? null) as QueueAudit | null;
}

async function defaultSleep(ms: number) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
