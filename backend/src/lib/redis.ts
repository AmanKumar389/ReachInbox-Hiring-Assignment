import { Redis } from "ioredis";
import { env } from "../config/env";

/**
 * BullMQ requires maxRetriesPerRequest = null on connections used by workers.
 * Each caller gets its own connection; BullMQ duplicates as needed.
 */
export function createRedis(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
}

/** Shared connection for app-level keys (rate-limit counters, flags). */
export const redis = createRedis();
