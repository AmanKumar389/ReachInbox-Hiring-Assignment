# ReachInbox: Email Job Scheduler

A production-style email scheduler with a dashboard. It accepts send requests, stores them in Postgres, schedules them as BullMQ delayed jobs (no cron) and sends them through Ethereal SMTP. It enforces per-sender and per-campaign hourly limits, alerts Slack when a limit is hit, and survives restarts without losing or repeating emails.

```
reachinbox-scheduler/
├── backend/            Express + TypeScript API and BullMQ worker
│   ├── src/
│   │   ├── config/     env validation (zod)
│   │   ├── db/         Drizzle schema, pg pool, idempotent SQL migration
│   │   ├── http/       app, routes (auth, campaigns, emails, slack), middleware
│   │   ├── queue/      BullMQ queue + enqueue helpers
│   │   ├── services/   campaigns, senders, rate limiter, slack, search, reconcile
│   │   ├── worker/     the send pipeline (processor.ts)
│   │   ├── server.ts   API entry point
│   │   └── worker.ts   worker entry point
│   └── scripts/loadTest.ts
├── frontend/           React + Vite + Tailwind dashboard
│   └── src/ api/ context/ hooks/ components/{ui,layout,emails,compose,slack}/ pages/ utils/
├── docker-compose.yml  Postgres, Redis (AOF on), Elasticsearch
└── sample-leads.csv
```

---

## 1. Run it locally

**Requirements:** Node 20+, Docker.

### Start the infrastructure

```bash
docker compose up -d        # Postgres :5432, Redis :6379, Elasticsearch :9200
```

### Run the backend (two processes)

```bash
cd backend
cp .env.example .env        # fill in GOOGLE_CLIENT_ID, JWT_SECRET, Slack keys
npm install
npm run dev:api             # terminal 1: API on http://localhost:4000
npm run dev:worker          # terminal 2: BullMQ worker
```

The tables are created automatically on startup, so there is no separate migration step. The API and the worker are separate processes on purpose, so you can restart one without the other. For several workers, run `npm run dev:worker` more than once.

For production: `npm run build`, then `npm run start:api` and `npm run start:worker`.

### Run the frontend

```bash
cd frontend
cp .env.example .env        # VITE_GOOGLE_CLIENT_ID = same id as the backend
npm install
npm run dev                 # http://localhost:5173
```

Vite proxies `/api` and `/admin` to the backend, so the session cookie is first-party.

### Useful URLs

| What | URL |
|---|---|
| Dashboard | http://localhost:5173 |
| BullMQ dashboard (live queue) | http://localhost:4000/admin/queues (default login `admin` / `admin`) |
| Health check | http://localhost:4000/health |

---

## 2. Set up credentials

### Ethereal Email

You don't need to set anything up. On first boot the API creates `SENDER_COUNT` (default 3) Ethereal accounts with `nodemailer.createTestAccount()` and stores them in the `senders` table, so they survive restarts. Each account's login is printed in the API log, so you can open https://ethereal.email/login to see the delivered messages. Every sent email also has a preview link: the icon on the right of each row in the Sent tab.

To use fixed accounts instead, set:

```
ETHEREAL_SENDERS=[{"name":"Alice","user":"alice@ethereal.email","pass":"..."},{"name":"Bob","user":"bob@ethereal.email","pass":"..."}]
```

### Google login

1. In Google Cloud Console, go to APIs & Services, then Credentials, and create an OAuth client ID of type "Web application".
2. Under Authorized JavaScript origins, add `http://localhost:5173`.
3. Put the client ID in both `backend/.env` (`GOOGLE_CLIENT_ID`) and `frontend/.env` (`VITE_GOOGLE_CLIENT_ID`).

The frontend uses Google Identity Services to get a signed ID token. The backend verifies the token's signature and audience with `google-auth-library`, upserts the user, and sets an httpOnly JWT session cookie.

### Slack alerts

1. Create an app at https://api.slack.com/apps.
2. Under OAuth & Permissions:
   - Add the bot scope `incoming-webhook`.
   - Add the redirect URL `http://localhost:4000/api/slack/callback`. If Slack insists on HTTPS, use an ngrok URL and set `SLACK_REDIRECT_URI` to match.
3. Copy the Client ID and Client Secret into `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`.

To connect from the dashboard:

1. Click **Connect Slack**. You go to Slack's consent screen, where you pick a channel.
2. The backend exchanges the code for an incoming-webhook URL and stores it for your user. It immediately posts a confirmation message to that channel.

### All environment variables

See `backend/.env.example`. Every limit is configurable and none are hard-coded.

| Variable | Default | Meaning |
|---|---|---|
| `WORKER_CONCURRENCY` | 5 | Jobs each worker process handles in parallel |
| `MIN_SEND_DELAY_MS` | 2000 | Minimum gap between any two sends, across all workers |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | 200 | Hourly cap per sender account |
| `DEFAULT_CAMPAIGN_HOURLY_LIMIT` | 100 | Per-campaign cap if the request doesn't set one |
| `JOB_ATTEMPTS` | 3 | SMTP retries, with exponential backoff starting at 30 s |
| `SEND_LOCK_TTL_MS` | 60000 | How long a worker's claim on an email lasts |
| `SENDER_COUNT` | 3 | Ethereal accounts to auto-create |

---

## 3. Architecture

```
 Browser ──► Express API ──► Postgres (source of truth)
                │                 ▲
                │ addBulk         │ claim / mark sent
                ▼                 │
          Redis / BullMQ ───► Worker(s) ──► Ethereal SMTP
          (delayed jobs,          │
           rate counters)         ├──► Elasticsearch (search index)
                                  └──► Slack webhook (limit alerts)
```

### How scheduling works

`POST /api/campaigns` takes the subject, body, recipients, start time, delay and hourly limit. Recipients are deduplicated in the request and by a `UNIQUE(campaign_id, recipient)` constraint.

1. **Store:** in one transaction, insert the campaign and one `emails` row per recipient. Each row gets `scheduled_at = start + i × delay` and a sender assigned round-robin.
2. **Enqueue:** `queue.addBulk` in chunks of 500. Each job has `jobId = email id` and `delay = scheduled_at − now`.
3. **Index:** bulk-index the rows into Elasticsearch. This is best effort; sending never depends on it.

BullMQ keeps delayed jobs in a Redis sorted set and promotes them when they are due. There is no polling loop and no cron.

### What the worker does with each job (`worker/processor.ts`)

1. **Load the row.** If it is already `sent` or `failed`, skip it (idempotency).
2. **Check the hourly quota.** One atomic Redis Lua script checks and increments both `rl:sender:{id}:{hour}` and `rl:campaign:{id}:{hour}`. If either is full, the email is rescheduled (see Rate limiting below).
3. **Claim the email in Postgres.** `UPDATE … SET status='sending', locked_until=now+TTL WHERE status IN ('scheduled','throttled') OR (status='sending' AND locked_until < now)`. Only one worker can win this update.
4. **Wait for the global send slot.** This enforces the minimum delay between sends.
5. **Send** through the sender's pooled SMTP transporter, using a deterministic `Message-ID: <emailId@reachinbox.scheduler>`.
6. **Mark the email `sent`** with the time, message id and Ethereal preview URL, then re-index it.
7. **On SMTP error:** release the claim and rethrow so BullMQ retries with backoff. After the last attempt the email is marked `failed`.

### How restarts are handled

- **Postgres is the source of truth.** Every email row has a status: `scheduled`, `throttled`, `sending`, `sent` or `failed`.
- **Redis runs with AOF persistence** (see `docker-compose.yml`), so delayed jobs survive a Redis restart. When a worker stops, the delayed jobs simply wait in Redis. When it starts again, BullMQ sends anything now due, and future jobs still fire at their original time.
- **Reconciliation on worker boot** (`services/reconcile.ts`): every unsent row is checked against the queue. A row with no job, or with a job that already completed or failed, is re-enqueued. Because `jobId = email id`, re-enqueueing can never create a second job. This covers two cases: a crash between the database commit and the enqueue, and lost Redis data.
- **Graceful shutdown:** on SIGTERM, `worker.close()` waits for in-flight sends to finish.

**Tested:**

| Scenario | Result |
|---|---|
| Worker killed with `kill -9` before 4 emails were due, restarted after their time | All 4 sent, once each |
| Every queue key wiped from Redis, worker restarted | Reconciliation re-enqueued all 4 pending emails |
| Same jobId added again | Ignored |
| Job manually replayed for an email already sent | Skipped |

### How duplicates are prevented

| Layer | Mechanism |
|---|---|
| Same email enqueued twice | `jobId = email id`, so BullMQ ignores the duplicate add |
| Job runs again after completing (replay or reconciliation) | The status check returns early for `sent` and `failed` |
| Two workers, or a stalled job running twice | The conditional `UPDATE … WHERE status …` claim, which only one wins |
| Same recipient twice in one upload | Deduplicated in the request and by a `UNIQUE(campaign_id, recipient)` constraint |

### Rate limiting and concurrency

**Concurrency.** `WORKER_CONCURRENCY` sets parallelism per process, and you can run several worker processes. Running jobs in parallel is safe for three reasons:

- The database claim stops two workers from sending the same email.
- All counters live in Redis and are updated by atomic Lua scripts.
- No state is kept only in memory.

**Delay between emails.** There are two layers:

1. **Per campaign:** the user's "delay between emails" spaces out `scheduled_at` values (start + i × delay).
2. **Global:** `MIN_SEND_DELAY_MS` (default **2 seconds** between sends). A Lua script reserves the next free slot, `max(now, last + gap)`, using Redis server time, so the gap holds across every worker and process. The worker waits until its slot before sending.

I chose this over BullMQ's built-in `limiter` on purpose. The limiter counts every processed job, so jobs that are only being moved to the next hour would also use up 2-second slots. With 1,000 throttled jobs, that would block the queue for over half an hour. With the slot approach, only real sends wait.

**Emails per hour.** The counters are keyed by clock-hour window and expire after two hours:

- `rl:sender:{senderId}:{hourWindow}`, capped at `MAX_EMAILS_PER_HOUR_PER_SENDER`
- `rl:campaign:{campaignId}:{hourWindow}`, capped at the campaign's hourly limit

Both are checked and incremented in a single Lua script, so a send can't use up one quota while the other rejects it.

When a limit is reached, the job is not dropped or failed. Instead:

- `job.moveToDelayed(nextSlot)` moves it, and the row becomes `throttled` with its new `scheduled_at`. The dashboard shows "Waiting for next hour".
- `nextSlot` is the start of the next hour, plus a per-window sequence number × `MIN_SEND_DELAY_MS`. Jobs that hit the limit first get the earliest slots, so the original order is kept and the next hour doesn't open with a burst of identical timestamps.
- If the next hour is also full, the same logic moves the job forward again.

**Slack alert on limit hit.** The first job to hit a limit in a window sets `SET NX rl:notified:{scope}:{id}:{window}` and posts to the user's Slack. That gives one message per sender per hour, not one per throttled email. The Slack connection is read from the database at the moment of the alert, which has two consequences:

- If you never connected Slack, nothing happens and nothing crashes.
- If you connect later, alerts start right away with no redeploy.

If Slack reports the webhook as revoked, the connection is deleted, so the dashboard shows "Connect Slack" again.

### Behaviour under load: 1,000+ emails at the same moment

Tested locally with 1,000 emails due at once, 2 senders and a test limit of 3 per hour per sender:

| Measure | Result |
|---|---|
| Time for the API to store and enqueue all 1,000 | 544 ms (chunked inserts and `addBulk`) |
| Sent in the current hour | 6 (3 per sender) |
| Moved to the next hour, in order | 994, spaced by the minimum delay |
| Slack alerts | 2 (one per sender), not 994 |
| Duplicate sends | 0 (every email reached the mail server once) |

Try it yourself: `npm run load-test -- 1000 you@example.com`, then watch `/admin/queues` and the worker log.

### Search (Elasticsearch)

- Every email is indexed on creation and on each status change, with recipient, subject, body, status and times.
- `GET /api/emails/search?q=…&tab=…` runs a fuzzy multi-match query (recipient weighted highest), filtered to the current user.
- The search box in the dashboard uses it.
- If Elasticsearch is down, sending keeps working, search returns a clear error, and the warning is logged at most once a minute.

---

## 4. API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/google` | `{ credential }`: Google ID token; sets the session cookie |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Clears the cookie |
| POST | `/api/campaigns` | `{ subject, body, recipients[], startAt, delaySeconds, hourlyLimit }` |
| GET | `/api/emails?tab=scheduled\|sent&page=&pageSize=` | Paginated list |
| GET | `/api/emails/counts` | `{ scheduled, sent }` |
| GET | `/api/emails/search?q=&tab=` | Elasticsearch search |
| GET | `/api/slack/status` | Whether Slack is connected, plus team and channel |
| GET | `/api/slack/connect` | Redirects to Slack OAuth (state is a signed JWT) |
| GET | `/api/slack/callback` | OAuth callback |
| POST | `/api/slack/test` | Sends a test message |
| DELETE | `/api/slack` | Disconnects Slack |
| GET | `/admin/queues` | Bull Board (basic auth) |

Postman example:

```http
POST http://localhost:4000/api/campaigns
Cookie: ri_session=<copy from the browser after login>
Content-Type: application/json

{ "subject": "Hello", "body": "Hi there", "recipients": ["a@example.com","b@example.com"],
  "startAt": "2026-10-20T10:00:00Z", "delaySeconds": 2, "hourlyLimit": 100 }
```

---

## 5. Features implemented

**Backend**

- [x] Scheduling with BullMQ delayed jobs, one per email, with `jobId = email id`; no cron of any kind
- [x] Postgres persistence, with an idempotent schema bootstrap guarded by an advisory lock
- [x] Restart safety: Redis AOF plus boot-time reconciliation against the database
- [x] Idempotency: deduplicated job ids, status checks, conditional claim with a lease, unique recipient per campaign
- [x] Multiple senders, round-robin, with pooled SMTP transporters
- [x] Configurable worker concurrency; safe across processes
- [x] Global minimum delay between sends (Redis slot reservation)
- [x] Hourly limits per sender and per campaign using Redis counters; extra emails roll into the next hour in order
- [x] Slack OAuth connect, disconnect and test; one alert per limit hit per hour
- [x] Elasticsearch indexing and search
- [x] Live BullMQ dashboard (Bull Board) behind basic auth
- [x] Retries with exponential backoff; final failures marked `failed` with the error message
- [x] Environment validated with zod at startup; graceful shutdown

**Frontend**

- [x] Real Google login; name, email and avatar in the header; logout
- [x] Dashboard with Scheduled and Sent tabs, counts, and a Compose button
- [x] Compose page:
  - [x] Subject and body
  - [x] CSV or text upload (drag and drop) showing how many addresses were found and how many duplicates were removed
  - [x] Start time, delay between emails and hourly limit
  - [x] Live sending-plan estimate
- [x] Tables showing email, subject, scheduled or sent time, status, sender, and an Ethereal preview link
- [x] Loading skeletons, empty states, error messages and toasts; tables refresh every 5 seconds
- [x] Search across scheduled and sent emails
- [x] Slack connect card
- [x] Reusable UI components (`Button`, `Field`, `DataTable`, `StatusBadge`, `EmptyState`, `Pagination`) and typed API layer

---

## 6. Assumptions and trade-offs

- **Small duplicate window.** If a worker crashes after Ethereal accepted an email but before the database update, the email can be sent again once the lease expires. Exactly-once delivery isn't possible over SMTP. The deterministic `Message-ID` lets receiving systems spot the repeat.
- **Catch-up order.** When the worker comes back after downtime, overdue emails are processed in parallel, so their order within the backlog can differ slightly. The minimum gap between sends still holds.
- **Hour windows** are clock hours in UTC. A sliding window would be smoother but needs more Redis bookkeeping.
- **Sender limits stretch campaigns.** The sender limit is shared across all campaigns that use the sender, so one campaign can slow another. This mirrors real mailbox limits.
- **Elasticsearch is a secondary index.** Postgres stays the source of truth; search can lag a little or be unavailable.
- **Plain-text bodies.** No templating or personalisation.
- **Design.** The assignment's Figma link wasn't included in the brief I received, so the layout is my own. It is easy to restyle because every screen is built from shared components.
- **Session handling.** Sessions are JWTs in httpOnly cookies with a 7-day expiry, with no server-side session store.
- **Slack may require HTTPS** redirect URLs; use ngrok locally if it does.
