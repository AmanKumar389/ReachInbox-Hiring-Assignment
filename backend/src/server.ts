import { env } from "./config/env";
import { buildApp } from "./http/app";
import { migrate } from "./db/migrate";
import { ensureSenders } from "./services/senders";
import { ensureIndex } from "./services/search";
import { createLogger } from "./lib/logger";
import { emailQueue } from "./queue/emailQueue";
import { pool } from "./db/client";
import { redis } from "./lib/redis";

const log = createLogger("api");

async function main() {
  await migrate();
  await ensureSenders();
  void ensureIndex(); // best effort: search is optional for sending

  const server = buildApp().listen(env.PORT, () => {
    log.info(`API on http://localhost:${env.PORT}  ·  queues on http://localhost:${env.PORT}/admin/queues`);
  });

  const shutdown = async () => {
    server.close();
    await emailQueue.close();
    await redis.quit();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  log.error("API failed to start", { err: String(err) });
  process.exit(1);
});
