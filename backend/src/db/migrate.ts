import { pool } from "./client";
import { createLogger } from "../lib/logger";

const log = createLogger("migrate");

/**
 * Idempotent schema bootstrap, run by both the API and the worker on start.
 * Kept as plain SQL so it needs no CLI step; mirrors src/db/schema.ts.
 */
const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id   text NOT NULL UNIQUE,
  email       text NOT NULL,
  name        text NOT NULL,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slack_connections (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  team_name     text,
  channel       text,
  webhook_url   text NOT NULL,
  access_token  text,
  connected_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS senders (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  smtp_host   text NOT NULL,
  smtp_port   integer NOT NULL,
  smtp_user   text NOT NULL,
  smtp_pass   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject       text NOT NULL,
  body          text NOT NULL,
  start_at      timestamptz NOT NULL,
  delay_ms      integer NOT NULL,
  hourly_limit  integer NOT NULL,
  total         integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id     integer NOT NULL REFERENCES senders(id),
  recipient     text NOT NULL,
  subject       text NOT NULL,
  body          text NOT NULL,
  scheduled_at  timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','throttled','sending','sent','failed')),
  attempts      integer NOT NULL DEFAULT 0,
  sent_at       timestamptz,
  message_id    text,
  preview_url   text,
  error         text,
  locked_until  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, recipient)
);

CREATE INDEX IF NOT EXISTS emails_user_status_sched_idx ON emails (user_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS emails_status_idx ON emails (status);
`;

export async function migrate(): Promise<void> {
  // Advisory lock so API + worker starting together don't race on DDL.
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(842001)");
    await client.query(SQL);
    log.info("schema ready");
  } finally {
    await client.query("SELECT pg_advisory_unlock(842001)").catch(() => undefined);
    client.release();
  }
}
