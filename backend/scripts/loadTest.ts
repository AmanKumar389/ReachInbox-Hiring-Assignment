/**
 * Schedules N emails for (almost) the same instant without going through the UI.
 *   npm run load-test -- 1000 you@example.com
 * The emails go to <you>+0..N@<domain>; Ethereal accepts and stores them all.
 * Watch /admin/queues and the worker log to see the per-hour limit kick in.
 */
import { db, pool } from "../src/db/client";
import { users } from "../src/db/schema";
import { migrate } from "../src/db/migrate";
import { ensureSenders } from "../src/services/senders";
import { createCampaign } from "../src/services/campaigns";
import { emailQueue } from "../src/queue/emailQueue";
import { redis } from "../src/lib/redis";

async function main() {
  const n = Number(process.argv[2] ?? 1000);
  const base = process.argv[3] ?? "lead@example.com";
  const [local, domain] = base.split("@");

  await migrate();
  await ensureSenders();
  const [user] = await db
    .insert(users)
    .values({ googleId: "load-test", email: base, name: "Load test" })
    .onConflictDoUpdate({ target: users.googleId, set: { email: base } })
    .returning();

  const t0 = Date.now();
  const res = await createCampaign(user.id, {
    subject: `Load test ${new Date().toISOString()}`,
    body: "Load test body",
    recipients: Array.from({ length: n }, (_, i) => `${local}+${i}@${domain}`),
    startAt: new Date(Date.now() + 5_000),
    delaySeconds: 0,
    hourlyLimit: 100_000,
  });
  console.log(`scheduled ${res.scheduled} emails in ${Date.now() - t0} ms; first send at ${res.firstSendAt.toISOString()}`);

  await emailQueue.close();
  await redis.quit();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
