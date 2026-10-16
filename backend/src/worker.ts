import { Worker } from "bullmq";
import { env } from "./config/env";
import { createRedis, redis } from "./lib/redis";
import { createLogger } from "./lib/logger";
import { migrate } from "./db/migrate";
import { pool } from "./db/client";
import { ensureIndex } from "./services/search";
import { reconcilePendingEmails } from "./services/reconcile";
import { closeTransporters } from "./services/senders";
import { processSendEmail } from "./worker/processor";
import { emailQueue, type SendEmailJob } from "./queue/emailQueue";

const log = createLogger("worker");

async function main() {
  await migrate();
  void ensureIndex(); // best effort: search is optional for sending
  await reconcilePendingEmails();

  const worker = new Worker<SendEmailJob>(env.QUEUE_NAME, (job, token) => processSendEmail(job, token), {
    connection: createRedis(),
    concurrency: env.WORKER_CONCURRENCY,
    // Long enough to cover waiting for a send slot + a slow SMTP handshake.
    lockDuration: 120_000,
  });

  worker.on("failed", (job, err) => log.warn("job failed", { jobId: job?.id, attempts: job?.attemptsMade, err: err.message }));
  worker.on("error", (err) => log.error("worker error", { err: err.message }));

  log.info(`worker started`, {
    queue: env.QUEUE_NAME,
    concurrency: env.WORKER_CONCURRENCY,
    minSendDelayMs: env.MIN_SEND_DELAY_MS,
    maxPerHourPerSender: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
  });

  const shutdown = async (signal: string) => {
    log.info(`${signal} received, finishing in-flight jobs`);
    // close() waits for active jobs; delayed jobs stay in Redis untouched.
    await worker.close();
    await emailQueue.close();
    await closeTransporters();
    await redis.quit();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  log.error("worker failed to start", { err: String(err) });
  process.exit(1);
});
