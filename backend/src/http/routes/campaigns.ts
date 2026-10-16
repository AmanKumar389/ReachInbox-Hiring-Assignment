import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { createCampaign } from "../../services/campaigns";
import { env } from "../../config/env";

export const campaignsRouter = Router();
campaignsRouter.use(requireAuth);

const MAX_RECIPIENTS = 10_000;

const createSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().trim().min(1, "Body is required").max(50_000),
  recipients: z.array(z.email()).min(1, "Add at least one recipient").max(MAX_RECIPIENTS),
  startAt: z.coerce.date(),
  delaySeconds: z.coerce.number().int().min(0).max(3600).default(2),
  hourlyLimit: z.coerce.number().int().min(1).max(100_000).default(env.DEFAULT_CAMPAIGN_HOURLY_LIMIT),
});

campaignsRouter.post("/", async (req, res) => {
  const input = createSchema.parse(req.body);
  const result = await createCampaign(req.user!.id, input);
  res.status(201).json({
    campaignId: result.campaign.id,
    scheduled: result.scheduled,
    firstSendAt: result.firstSendAt,
  });
});
