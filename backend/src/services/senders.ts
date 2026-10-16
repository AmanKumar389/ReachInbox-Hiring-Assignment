import nodemailer, { type Transporter } from "nodemailer";
import { asc } from "drizzle-orm";
import { db } from "../db/client";
import { senders, type Sender } from "../db/schema";
import { env } from "../config/env";
import { createLogger } from "../lib/logger";

const log = createLogger("senders");

interface SenderConfig {
  name: string;
  user: string;
  pass: string;
  host?: string;
  port?: number;
}

/**
 * Makes sure at least one Ethereal sender exists.
 * - ETHEREAL_SENDERS (JSON) wins if provided.
 * - Otherwise SENDER_COUNT accounts are created through the Ethereal API once
 *   and stored in Postgres, so they survive restarts.
 */
export async function ensureSenders(): Promise<Sender[]> {
  const existing = await listSenders();
  if (existing.length > 0) return existing;

  let configs: SenderConfig[] = [];
  if (env.ETHEREAL_SENDERS.trim()) {
    configs = JSON.parse(env.ETHEREAL_SENDERS) as SenderConfig[];
  } else {
    log.info(`creating ${env.SENDER_COUNT} Ethereal test accounts`);
    for (let i = 0; i < env.SENDER_COUNT; i++) {
      const acc = await nodemailer.createTestAccount();
      configs.push({ name: `Sender ${i + 1}`, user: acc.user, pass: acc.pass, host: acc.smtp.host, port: acc.smtp.port });
    }
  }

  await db
    .insert(senders)
    .values(
      configs.map((c) => ({
        name: c.name,
        email: c.user,
        smtpHost: c.host ?? "smtp.ethereal.email",
        smtpPort: c.port ?? 587,
        smtpUser: c.user,
        smtpPass: c.pass,
      })),
    )
    .onConflictDoNothing();

  const created = await listSenders();
  for (const s of created) log.info(`sender ready`, { id: s.id, email: s.email, pass: s.smtpPass });
  return created;
}

export function listSenders(): Promise<Sender[]> {
  return db.select().from(senders).orderBy(asc(senders.id));
}

const transporters = new Map<number, Transporter>();

/** One pooled SMTP transporter per sender, created lazily. */
export function transporterFor(sender: Sender): Transporter {
  let t = transporters.get(sender.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: { user: sender.smtpUser, pass: sender.smtpPass },
      pool: true,
      maxConnections: 2,
    });
    transporters.set(sender.id, t);
  }
  return t;
}

export async function closeTransporters(): Promise<void> {
  for (const t of transporters.values()) t.close();
  transporters.clear();
}
