import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";

export const SESSION_COOKIE = "ri_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function signSession(user: SessionUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: "7d" });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    maxAge: 7 * 24 * 3600 * 1000,
    path: "/",
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  try {
    const p = jwt.verify(token, env.JWT_SECRET) as SessionUser;
    req.user = { id: p.id, email: p.email, name: p.name, avatarUrl: p.avatarUrl };
    next();
  } catch {
    res.status(401).json({ error: "Session expired, sign in again" });
  }
}

/** Basic auth for the BullMQ dashboard. */
export function basicAuth(user: string, pass: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const [scheme, encoded] = (req.headers.authorization ?? "").split(" ");
    if (scheme === "Basic" && encoded) {
      const [u, p] = Buffer.from(encoded, "base64").toString().split(":");
      if (u === user && p === pass) return next();
    }
    res.setHeader("WWW-Authenticate", 'Basic realm="queues"');
    res.status(401).send("Authentication required");
  };
}
