import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db } from "../db/client";
import { slackConnections } from "../db/schema";
import { env } from "../config/env";
import { createLogger } from "../lib/logger";

const log = createLogger("slack");

export const slackConfigured = () => Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);

/** Signed, short-lived state so the callback knows which user is connecting (and can't be forged). */
export function buildAuthorizeUrl(userId: string): string {
  const state = jwt.sign({ uid: userId, purpose: "slack" }, env.JWT_SECRET, { expiresIn: "10m" });
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", env.SLACK_CLIENT_ID);
  url.searchParams.set("scope", "incoming-webhook");
  url.searchParams.set("redirect_uri", env.SLACK_REDIRECT_URI);
  url.searchParams.set("state", state);
  return url.toString();
}

export function readState(state: string): string {
  const payload = jwt.verify(state, env.JWT_SECRET) as { uid: string; purpose: string };
  if (payload.purpose !== "slack") throw new Error("bad state");
  return payload.uid;
}

interface OAuthAccessResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { name?: string };
  incoming_webhook?: { url: string; channel?: string };
}

export async function exchangeCodeAndStore(userId: string, code: string): Promise<void> {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    }),
  });
  const data = (await res.json()) as OAuthAccessResponse;
  if (!data.ok || !data.incoming_webhook?.url) throw new Error(`Slack OAuth failed: ${data.error ?? "no webhook returned"}`);

  const row = {
    userId,
    webhookUrl: data.incoming_webhook.url,
    channel: data.incoming_webhook.channel ?? null,
    teamName: data.team?.name ?? null,
    accessToken: data.access_token ?? null,
    connectedAt: new Date(),
  };
  await db
    .insert(slackConnections)
    .values(row)
    .onConflictDoUpdate({ target: slackConnections.userId, set: row });

  await postToUser(userId, ":white_check_mark: ReachInbox scheduler connected. You'll get a message here whenever an hourly sending limit is reached.");
}

export async function getConnection(userId: string) {
  const [row] = await db.select().from(slackConnections).where(eq(slackConnections.userId, userId)).limit(1);
  return row ?? null;
}

export async function disconnect(userId: string): Promise<void> {
  await db.delete(slackConnections).where(eq(slackConnections.userId, userId));
}

/**
 * Looks the connection up at send time (never cached), so connecting or
 * disconnecting takes effect immediately without a restart.
 * Returns false when the user has no Slack connected; never throws.
 */
export async function postToUser(userId: string, text: string): Promise<boolean> {
  try {
    const conn = await getConnection(userId);
    if (!conn) return false;
    const res = await fetch(conn.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.status === 404 || res.status === 403 || res.status === 410) {
      // Webhook revoked from Slack's side: forget it so the UI shows "Connect" again.
      log.warn("webhook revoked, removing connection", { userId, status: res.status });
      await disconnect(userId);
      return false;
    }
    if (!res.ok) throw new Error(`Slack responded ${res.status}`);
    return true;
  } catch (err) {
    log.error("failed to post to Slack", { userId, err: String(err) });
    return false;
  }
}
