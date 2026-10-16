import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { createLogger } from "../../lib/logger";

const log = createLogger("http");

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  log.error("unhandled error", { path: req.path, err: String(err) });
  res.status(500).json({ error: "Something went wrong on the server" });
}
