import { Client } from "@elastic/elasticsearch";
import { env } from "../config/env";
import { createLogger } from "../lib/logger";
import type { Email } from "../db/schema";

const log = createLogger("search");

// When ES is down every send would log a warning; keep it to one per minute.
let lastWarn = 0;
const warnThrottled = (msg: string, meta: Record<string, unknown>) => {
  if (Date.now() - lastWarn < 60_000) return;
  lastWarn = Date.now();
  log.warn(`${msg} (further search warnings muted for 60s)`, meta);
};
const index = env.ELASTICSEARCH_INDEX;

export const es = new Client({ node: env.ELASTICSEARCH_URL, requestTimeout: 5000, maxRetries: 1 });

export async function ensureIndex(): Promise<void> {
  try {
    const exists = await es.indices.exists({ index });
    if (exists) return;
    await es.indices.create({
      index,
      mappings: {
        properties: {
          userId: { type: "keyword" },
          campaignId: { type: "keyword" },
          recipient: { type: "text", fields: { raw: { type: "keyword" } } },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
        },
      },
    });
    log.info(`created index "${index}"`);
  } catch (err) {
    log.warn("Elasticsearch unavailable; search will be degraded", { err: String(err) });
  }
}

const toDoc = (e: Email) => ({
  userId: e.userId,
  campaignId: e.campaignId,
  recipient: e.recipient,
  subject: e.subject,
  body: e.body,
  status: e.status,
  scheduledAt: e.scheduledAt,
  sentAt: e.sentAt,
});

/**
 * Indexing is best-effort: Postgres is the source of truth and sending must
 * never fail because the search cluster is down.
 */
export async function indexEmails(rows: Email[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const operations = rows.flatMap((e) => [{ index: { _index: index, _id: e.id } }, toDoc(e)]);
    const res = await es.bulk({ operations, refresh: false });
    if (res.errors) warnThrottled("some documents failed to index", {});
  } catch (err) {
    warnThrottled("bulk index failed", { err: String(err) });
  }
}

export async function indexEmail(row: Email): Promise<void> {
  try {
    await es.index({ index, id: row.id, document: toDoc(row) });
  } catch (err) {
    warnThrottled("index failed", { id: row.id, err: String(err) });
  }
}

export interface SearchHit {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
}

export async function searchEmails(userId: string, q: string, statuses?: string[]): Promise<SearchHit[]> {
  const filter: object[] = [{ term: { userId } }];
  if (statuses?.length) filter.push({ terms: { status: statuses } });
  const res = await es.search<ReturnType<typeof toDoc>>({
    index,
    size: 50,
    query: {
      bool: {
        filter,
        must: [{ multi_match: { query: q, fields: ["recipient^3", "subject^2", "body"], fuzziness: "AUTO" } }],
      },
    },
    sort: [{ _score: { order: "desc" } }],
  });
  return res.hits.hits.map((h) => ({
    id: h._id as string,
    recipient: h._source!.recipient,
    subject: h._source!.subject,
    status: h._source!.status,
    scheduledAt: String(h._source!.scheduledAt),
    sentAt: h._source!.sentAt ? String(h._source!.sentAt) : null,
  }));
}
