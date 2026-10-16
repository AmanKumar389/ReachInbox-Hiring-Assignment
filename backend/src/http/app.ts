import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { env } from "../config/env";
import { emailQueue } from "../queue/emailQueue";
import { authRouter } from "./routes/auth";
import { campaignsRouter } from "./routes/campaigns";
import { emailsRouter } from "./routes/emails";
import { slackRouter } from "./routes/slack";
import { basicAuth } from "./middleware/auth";
import { errorHandler } from "./middleware/errors";

export function buildApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: "5mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Live BullMQ dashboard
  const board = new ExpressAdapter();
  board.setBasePath("/admin/queues");
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: board });
  app.use("/admin/queues", basicAuth(env.BULL_BOARD_USER, env.BULL_BOARD_PASS), board.getRouter());

  app.use("/api/auth", authRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/emails", emailsRouter);
  app.use("/api/slack", slackRouter);

  app.use(errorHandler);
  return app;
}
