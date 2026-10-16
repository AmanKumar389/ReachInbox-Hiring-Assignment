import { DelayedError, type Job } from "bullmq";
import nodemailer from "nodemailer";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { campaigns, emails, senders } from "../db/schema";
import { env } from "../config/env";
import { createLogger } from "../lib/logger";
import type { SendEmailJob } from "../queue/emailQueue";
import { consumeQuota, firstHitInWindow, nextSlot, waitForSendSlot, type LimitScope } from "../services/rateLimiter";
import { transporterFor } from "../services/senders";
import { indexEmail } from "../services/search";
import { postToUser } from "../services/slack";
import { windowStart } from "../lib/time";

const log = createLogger("worker");

async function load(emailId: string) {
  const [row] = await db
    .select({ email: emails, hourlyLimit: campaigns.hourlyLimit, sender: senders })
    .from(emails)
    .innerJoin(campaigns, eq(campaigns.id, emails.campaignId))
    .innerJoin(senders, eq(senders.id, emails.senderId))
    .where(eq(emails.id, emailId))
    .limit(1);
  return row ?? null;
}

async function notifyLimitHit(args: {
  userId: string;
  scope: LimitScope;
  limit: number;
  senderEmail: string;
  subject: string;
  window: number;
}) {
  const resume = new Date(windowStart(args.window + 1)).toISOString().slice(11, 16);
  const who = args.scope === "sender" ? `Sender *${args.senderEmail}*` : `Campaign *"${args.subject}"*`;
  const sent = await postToUser(
    args.userId,
    `:warning: ${who} reached its hourly limit of *${args.limit} emails*. ` +
      `Remaining emails are paused, not dropped, and will resume at ${resume} UTC.`,
  );
  log.info("rate limit hit", { ...args, slackNotified: sent });
}

/**
 * Pipeline for one email:
 *  1. load row; skip if already final (idempotency for duplicate/replayed jobs)
 *  2. hourly quota (sender + campaign) in Redis; if exhausted, move the job to
 *     the next hour window and alert Slack once
 *  3. claim the row in Postgres (scheduled -> sending) with a lease
 *  4. wait for the global send slot (min delay between sends)
 *  5. send through the sender's Ethereal SMTP, mark sent
 */
export async function processSendEmail(job: Job<SendEmailJob>, token?: string) {
  const { emailId } = job.data;
  const row = await load(emailId);
  if (!row) return { skipped: "missing" };
  const { email, hourlyLimit, sender } = row;

  if (email.status === "sent" || email.status === "failed") return { skipped: email.status };

  // A previous attempt still holds the lease (e.g. stalled-job re-run). Try again after it expires.
  if (email.status === "sending" && email.lockedUntil && email.lockedUntil.getTime() > Date.now()) {
    await job.moveToDelayed(email.lockedUntil.getTime() + 1000, token);
    throw new DelayedError();
  }

  const quota = await consumeQuota({ senderId: sender.id, campaignId: email.campaignId, campaignLimit: hourlyLimit });
  if (!quota.ok) {
    const scopeId = quota.scope === "sender" ? sender.id : email.campaignId;
    const at = await nextSlot(quota.scope, scopeId, quota.window);
    const [updated] = await db
      .update(emails)
      .set({ status: "throttled", scheduledAt: new Date(at), updatedAt: new Date() })
      .where(and(eq(emails.id, emailId), inArray(emails.status, ["scheduled", "throttled"])))
      .returning();
    if (updated) void indexEmail(updated);
    if (await firstHitInWindow(quota.scope, scopeId, quota.window)) {
      void notifyLimitHit({
        userId: email.userId,
        scope: quota.scope,
        limit: quota.limit,
        senderEmail: sender.email,
        subject: email.subject,
        window: quota.window,
      });
    }
    await job.moveToDelayed(at, token);
    throw new DelayedError();
  }

  const now = new Date();
  const [claimed] = await db
    .update(emails)
    .set({
      status: "sending",
      lockedUntil: new Date(now.getTime() + env.SEND_LOCK_TTL_MS),
      attempts: sql`${emails.attempts} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(emails.id, emailId),
        or(
          inArray(emails.status, ["scheduled", "throttled"]),
          and(eq(emails.status, "sending"), lt(emails.lockedUntil, now)),
        ),
      ),
    )
    .returning();
  if (!claimed) return { skipped: "claimed-elsewhere" };

  await waitForSendSlot();

  try {
    const info = await transporterFor(sender).sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to: email.recipient,
      subject: email.subject,
      text: email.body,
      // Deterministic Message-ID: if a send is ever repeated after a crash,
      // receiving systems can still recognise it as the same message.
      messageId: `<${email.id}@reachinbox.scheduler>`,
      headers: { "X-ReachInbox-Email-Id": email.id },
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    const [done] = await db
      .update(emails)
      .set({
        status: "sent",
        sentAt: new Date(),
        messageId: info.messageId,
        previewUrl,
        error: null,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(emails.id, emailId))
      .returning();
    if (done) void indexEmail(done);
    log.info("sent", { emailId, to: email.recipient, sender: sender.email, previewUrl });
    return { sent: true, previewUrl };
  } catch (err) {
    const isFinal = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    const [failed] = await db
      .update(emails)
      .set({
        status: isFinal ? "failed" : "scheduled",
        sentAt: isFinal ? new Date() : null,
        error: err instanceof Error ? err.message : String(err),
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(emails.id, emailId))
      .returning();
    if (failed) void indexEmail(failed);
    log.error(isFinal ? "send failed permanently" : "send failed, will retry", { emailId, err: String(err) });
    throw err; // BullMQ retries with exponential backoff
  }
}
