import { Queue, type JobsOptions } from "bullmq";
import { env } from "../config/env";
import { createRedis } from "../lib/redis";

export interface SendEmailJob {
  emailId: string;
}

export const EMAIL_JOB_NAME = "send-email";

export const emailQueue = new Queue<SendEmailJob>(env.QUEUE_NAME, {
  connection: createRedis(),
  defaultJobOptions: {
    attempts: env.JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: 30_000 },
    // Keep finished jobs around for a while so the dashboard is useful,
    // without letting Redis grow forever. The DB is the source of truth.
    removeOnComplete: { age: 24 * 3600, count: 5000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/**
 * The job id IS the email id. BullMQ ignores an add() whose jobId already
 * exists, so enqueueing the same email twice (retry of the API call,
 * restart reconciliation, ...) can never create a second job.
 */
export function jobFor(emailId: string, scheduledAt: Date): { name: string; data: SendEmailJob; opts: JobsOptions } {
  return {
    name: EMAIL_JOB_NAME,
    data: { emailId },
    opts: { jobId: emailId, delay: Math.max(0, scheduledAt.getTime() - Date.now()) },
  };
}

const CHUNK = 500;

export async function enqueueEmails(items: { id: string; scheduledAt: Date }[]): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) {
    await emailQueue.addBulk(items.slice(i, i + CHUNK).map((e) => jobFor(e.id, e.scheduledAt)));
  }
}
