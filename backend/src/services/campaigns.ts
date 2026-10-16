import { db } from "../db/client";
import { campaigns, emails, type Email } from "../db/schema";
import { listSenders } from "./senders";
import { enqueueEmails } from "../queue/emailQueue";
import { indexEmails } from "./search";

export interface CreateCampaignInput {
  subject: string;
  body: string;
  recipients: string[];
  startAt: Date;
  delaySeconds: number;
  hourlyLimit: number;
}

const INSERT_CHUNK = 1000;

/**
 * 1. Persist campaign + one row per recipient (Postgres = source of truth).
 * 2. Enqueue one delayed BullMQ job per email, jobId = email id.
 * 3. Index into Elasticsearch (best effort).
 *
 * If the process dies between 1 and 2, the rows are still "scheduled" and the
 * worker's startup reconciliation enqueues them, so nothing is lost.
 */
export async function createCampaign(userId: string, input: CreateCampaignInput) {
  const allSenders = await listSenders();
  if (allSenders.length === 0) throw new Error("No senders configured");

  const recipients = [...new Set(input.recipients.map((r) => r.trim().toLowerCase()))];
  const startMs = Math.max(input.startAt.getTime(), Date.now());
  const delayMs = input.delaySeconds * 1000;

  const { campaign, inserted } = await db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(campaigns)
      .values({
        userId,
        subject: input.subject,
        body: input.body,
        startAt: new Date(startMs),
        delayMs,
        hourlyLimit: input.hourlyLimit,
        total: recipients.length,
      })
      .returning();

    const inserted: Email[] = [];
    for (let i = 0; i < recipients.length; i += INSERT_CHUNK) {
      const rows = recipients.slice(i, i + INSERT_CHUNK).map((recipient, j) => {
        const idx = i + j;
        return {
          campaignId: campaign.id,
          userId,
          // Round-robin across senders spreads load over their hourly quotas.
          senderId: allSenders[idx % allSenders.length].id,
          recipient,
          subject: input.subject,
          body: input.body,
          scheduledAt: new Date(startMs + idx * delayMs),
        };
      });
      inserted.push(...(await tx.insert(emails).values(rows).onConflictDoNothing().returning()));
    }
    return { campaign, inserted };
  });

  await enqueueEmails(inserted.map((e) => ({ id: e.id, scheduledAt: e.scheduledAt })));
  void indexEmails(inserted);

  return { campaign, scheduled: inserted.length, firstSendAt: new Date(startMs) };
}
