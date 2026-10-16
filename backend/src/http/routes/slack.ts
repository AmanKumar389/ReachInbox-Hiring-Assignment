import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import { env } from "../../config/env";
import {
  buildAuthorizeUrl,
  disconnect,
  exchangeCodeAndStore,
  getConnection,
  postToUser,
  readState,
  slackConfigured,
} from "../../services/slack";
import { createLogger } from "../../lib/logger";

const log = createLogger("slack");
export const slackRouter = Router();

slackRouter.get("/status", requireAuth, async (req, res) => {
  const conn = await getConnection(req.user!.id);
  res.json({
    available: slackConfigured(),
    connected: Boolean(conn),
    teamName: conn?.teamName ?? null,
    channel: conn?.channel ?? null,
  });
});

/** Browser navigates here; we redirect to Slack's consent screen. */
slackRouter.get("/connect", requireAuth, (req, res) => {
  if (!slackConfigured()) throw new HttpError(400, "Slack is not configured on the server");
  res.redirect(buildAuthorizeUrl(req.user!.id));
});

/** Slack redirects back here. The signed state identifies the user (no cookie needed). */
slackRouter.get("/callback", async (req, res) => {
  const back = new URL(env.FRONTEND_URL);
  try {
    if (req.query.error) throw new Error(String(req.query.error));
    const userId = readState(String(req.query.state ?? ""));
    await exchangeCodeAndStore(userId, String(req.query.code ?? ""));
    back.searchParams.set("slack", "connected");
  } catch (err) {
    log.warn("Slack connect failed", { err: String(err) });
    back.searchParams.set("slack", "error");
  }
  res.redirect(back.toString());
});

slackRouter.post("/test", requireAuth, async (req, res) => {
  const ok = await postToUser(req.user!.id, ":bell: Test message from the ReachInbox scheduler.");
  if (!ok) throw new HttpError(400, "Slack is not connected");
  res.json({ ok });
});

slackRouter.delete("/", requireAuth, async (req, res) => {
  await disconnect(req.user!.id);
  res.json({ ok: true });
});
