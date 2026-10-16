import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { env } from "../../config/env";
import { requireAuth, setSessionCookie, signSession, SESSION_COOKIE } from "../middleware/auth";
import { HttpError } from "../middleware/errors";

const google = new OAuth2Client(env.GOOGLE_CLIENT_ID);
export const authRouter = Router();

/**
 * The frontend runs Google Identity Services and posts the signed ID token here.
 * We verify signature + audience with Google, upsert the user, and set an
 * httpOnly session cookie.
 */
authRouter.post("/google", async (req, res) => {
  const { credential } = z.object({ credential: z.string().min(10) }).parse(req.body);
  const ticket = await google.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID }).catch(() => null);
  const p = ticket?.getPayload();
  if (!p?.sub || !p.email) throw new HttpError(401, "Google sign-in could not be verified");

  const values = {
    googleId: p.sub,
    email: p.email,
    name: p.name ?? p.email,
    avatarUrl: p.picture ?? null,
  };
  const [user] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.googleId, set: { email: values.email, name: values.name, avatarUrl: values.avatarUrl } })
    .returning();

  const session = { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  setSessionCookie(res, signSession(session));
  res.json({ user: session });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});
