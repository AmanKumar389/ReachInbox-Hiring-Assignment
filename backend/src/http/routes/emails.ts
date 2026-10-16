import { Router } from "express";
import { z } from "zod";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { emails, senders, type EmailStatus } from "../../db/schema";
import { requireAuth } from "../middleware/auth";
import { searchEmails } from "../../services/search";
import { HttpError } from "../middleware/errors";

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

const TAB_STATUSES: Record<"scheduled" | "sent", EmailStatus[]> = {
  scheduled: ["scheduled", "throttled", "sending"],
  sent: ["sent", "failed"],
};

const listSchema = z.object({
  tab: z.enum(["scheduled", "sent"]).default("scheduled"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

emailsRouter.get("/", async (req, res) => {
  const { tab, page, pageSize } = listSchema.parse(req.query);
  const where = and(eq(emails.userId, req.user!.id), inArray(emails.status, TAB_STATUSES[tab]));
  const order = tab === "scheduled" ? asc(emails.scheduledAt) : desc(emails.sentAt);

  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: emails.id,
        recipient: emails.recipient,
        subject: emails.subject,
        status: emails.status,
        scheduledAt: emails.scheduledAt,
        sentAt: emails.sentAt,
        previewUrl: emails.previewUrl,
        error: emails.error,
        senderEmail: senders.email,
      })
      .from(emails)
      .innerJoin(senders, eq(senders.id, emails.senderId))
      .where(where)
      .orderBy(order, asc(emails.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(emails).where(where),
  ]);

  res.json({ items, total, page, pageSize });
});

emailsRouter.get("/counts", async (req, res) => {
  const rows = await db
    .select({ status: emails.status, n: count() })
    .from(emails)
    .where(eq(emails.userId, req.user!.id))
    .groupBy(emails.status);
  const by = (s: EmailStatus[]) => rows.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.n, 0);
  res.json({ scheduled: by(TAB_STATUSES.scheduled), sent: by(TAB_STATUSES.sent) });
});

emailsRouter.get("/search", async (req, res) => {
  const { q, tab } = z.object({ q: z.string().trim().min(1), tab: z.enum(["scheduled", "sent"]).optional() }).parse(req.query);
  try {
    const hits = await searchEmails(req.user!.id, q, tab ? TAB_STATUSES[tab] : undefined);
    res.json({ items: hits });
  } catch {
    throw new HttpError(503, "Search is unavailable. Check that Elasticsearch is running.");
  }
});
