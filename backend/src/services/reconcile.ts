import { inArray } from "drizzle-orm";
import { db } from "../db/client";
import { emails } from "../db/schema";
import { emailQueue, jobFor } from "../queue/emailQueue";
import { createLogger } from "../lib/logger";

const log = createLogger("reconcile");
const CHUNK = 200;

/**
 * Runs when a worker boots. Redis (AOF) normally still holds every delayed
 * job, so this is usually a no-op. It repairs the edge cases:
 *  - rows committed but never enqueued (crash between DB write and addBulk)
 *  - Redis data lost (flushed, no persistence)
 *  - a job that finished/failed while the row still says it is pending
 * Because jobId = email id, re-adding is idempotent.
 */
export async function reconcilePendingEmails(): Promise<void> {
  const pending = await db
    .select({ id: emails.id, scheduledAt: emails.scheduledAt })
    .from(emails)
    .where(inArray(emails.status, ["scheduled", "throttled", "sending"]));

  let repaired = 0;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK);
    const jobs = await Promise.all(chunk.map((e) => emailQueue.getJob(e.id)));
    const toAdd: ReturnType<typeof jobFor>[] = [];

    for (let k = 0; k < chunk.length; k++) {
      const job = jobs[k];
      if (job) {
        const state = await job.getState();
        if (state !== "completed" && state !== "failed") continue;
        await job.remove();
      }
      toAdd.push(jobFor(chunk[k].id, chunk[k].scheduledAt));
    }
    if (toAdd.length) {
      await emailQueue.addBulk(toAdd);
      repaired += toAdd.length;
    }
  }
  log.info(`checked ${pending.length} pending emails, re-enqueued ${repaired}`);
}
