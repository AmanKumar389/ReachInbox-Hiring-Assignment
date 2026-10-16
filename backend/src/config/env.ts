import "dotenv/config";
import { z } from "zod";

const num = (def: number) => z.coerce.number().int().positive().default(def);

const schema = z.object({
  PORT: num(4000),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  PUBLIC_API_URL: z.string().default("http://localhost:4000"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ELASTICSEARCH_URL: z.string().default("http://localhost:9200"),
  ELASTICSEARCH_INDEX: z.string().default("emails"),

  GOOGLE_CLIENT_ID: z.string(),

  SLACK_CLIENT_ID: z.string().default(""),
  SLACK_CLIENT_SECRET: z.string().default(""),
  SLACK_REDIRECT_URI: z.string().default("http://localhost:4000/api/slack/callback"),

  ETHEREAL_SENDERS: z.string().default(""),
  SENDER_COUNT: num(3),

  QUEUE_NAME: z.string().default("email-send"),
  WORKER_CONCURRENCY: num(5),
  MIN_SEND_DELAY_MS: num(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: num(200),
  DEFAULT_CAMPAIGN_HOURLY_LIMIT: num(100),
  JOB_ATTEMPTS: num(3),
  SEND_LOCK_TTL_MS: num(60000),

  BULL_BOARD_USER: z.string().default("admin"),
  BULL_BOARD_PASS: z.string().default("admin"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
