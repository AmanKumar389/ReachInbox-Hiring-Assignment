import { redis } from "../lib/redis";
import { hourWindow, windowStart, HOUR_MS } from "../lib/time";
import { env } from "../config/env";

/**
 * Hourly quotas live in Redis, keyed by clock-hour window:
 *   rl:sender:{senderId}:{window}      shared by every campaign using the sender
 *   rl:campaign:{campaignId}:{window}  the limit the user typed in Compose
 *
 * Both are checked and incremented in ONE Lua script, so the check is atomic
 * across any number of worker processes and a send never consumes one quota
 * while being rejected by the other.
 */
const CONSUME_LUA = `
local a = tonumber(redis.call('GET', KEYS[1]) or '0')
local b = tonumber(redis.call('GET', KEYS[2]) or '0')
if a >= tonumber(ARGV[1]) then return {0, 1, a} end
if b >= tonumber(ARGV[2]) then return {0, 2, b} end
a = redis.call('INCR', KEYS[1])
b = redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('EXPIRE', KEYS[2], ARGV[3])
return {1, 0, a}
`;

export type LimitScope = "sender" | "campaign";

export type QuotaResult =
  | { ok: true; used: number }
  | { ok: false; scope: LimitScope; limit: number; window: number };

export async function consumeQuota(args: {
  senderId: number;
  campaignId: string;
  campaignLimit: number;
  now?: number;
}): Promise<QuotaResult> {
  const window = hourWindow(args.now);
  const senderLimit = env.MAX_EMAILS_PER_HOUR_PER_SENDER;
  const res = (await redis.eval(
    CONSUME_LUA,
    2,
    `rl:sender:${args.senderId}:${window}`,
    `rl:campaign:${args.campaignId}:${window}`,
    String(senderLimit),
    String(args.campaignLimit),
    String(2 * 3600),
  )) as [number, number, number];

  if (res[0] === 1) return { ok: true, used: res[2] };
  const scope: LimitScope = res[1] === 1 ? "sender" : "campaign";
  return { ok: false, scope, limit: scope === "sender" ? senderLimit : args.campaignLimit, window };
}

/**
 * Where a throttled job goes: the start of the next hour window, plus a
 * per-window sequence number spaced by MIN_SEND_DELAY_MS. Jobs that hit the
 * limit first get the earliest slots, so the original order is preserved and
 * the next hour doesn't open with a burst of identical timestamps.
 */
export async function nextSlot(scope: LimitScope, scopeId: string | number, window: number): Promise<number> {
  const next = window + 1;
  const seq = await redis.incr(`rl:overflow:${scope}:${scopeId}:${next}`);
  await redis.expire(`rl:overflow:${scope}:${scopeId}:${next}`, 3 * 3600);
  return windowStart(next) + (seq - 1) * env.MIN_SEND_DELAY_MS;
}

/** True only for the first caller in a window, so Slack gets one alert per limit hit, not one per job. */
export async function firstHitInWindow(scope: LimitScope, scopeId: string | number, window: number): Promise<boolean> {
  const ok = await redis.set(`rl:notified:${scope}:${scopeId}:${window}`, "1", "PX", 2 * HOUR_MS, "NX");
  return ok === "OK";
}

/**
 * Global minimum gap between SMTP sends, shared by every worker process.
 * Each caller atomically reserves the next free slot (last + gap, or now) using
 * Redis server time, then waits until it. Unlike BullMQ's limiter, jobs that
 * are only being re-delayed because of the hourly quota don't burn a slot.
 */
const SLOT_LUA = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local gap = tonumber(ARGV[1])
local last = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = math.max(now, last + gap)
redis.call('SET', KEYS[1], slot, 'PX', gap * 50 + 60000)
return {slot, now}
`;

export async function waitForSendSlot(): Promise<void> {
  const [slot, now] = (await redis.eval(SLOT_LUA, 1, "rl:send-slot", String(env.MIN_SEND_DELAY_MS))) as [number, number];
  const wait = slot - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
