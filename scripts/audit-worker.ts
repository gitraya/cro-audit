import { runAuditWorker } from "../lib/cro-audit/worker.ts";

const once = process.env.AUDIT_WORKER_ONCE === "true";
const pollIntervalMs = parseInteger(process.env.AUDIT_WORKER_POLL_MS, 5_000);

runAuditWorker({
  once,
  pollIntervalMs,
  shouldStop: createShutdownSignal(),
}).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

function parseInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createShutdownSignal() {
  let stopping = false;

  const requestStop = () => {
    stopping = true;
  };

  process.on("SIGINT", requestStop);
  process.on("SIGTERM", requestStop);

  return () => stopping;
}
