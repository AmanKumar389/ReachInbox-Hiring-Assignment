import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { emailsApi } from "../../api/endpoints";
import type { EmailRow, Tab } from "../../api/types";
import { useAsync } from "../../hooks/useAsync";
import { useDebounced } from "../../hooks/useDebounced";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { Pagination } from "../ui/Pagination";
import { IconPlus, IconSearch } from "../ui/Icons";
import { columnsFor } from "./emailColumns";

const PAGE_SIZE = 25;

const copy: Record<Tab, { title: string; emptyTitle: string; emptyBody: string }> = {
  scheduled: {
    title: "Scheduled emails",
    emptyTitle: "Nothing scheduled yet",
    emptyBody: "Upload a list of leads and pick a start time. Each email shows up here until it's sent.",
  },
  sent: {
    title: "Sent emails",
    emptyTitle: "No emails sent yet",
    emptyBody: "Emails move here once they're delivered, or if they fail after every retry.",
  },
};

export function EmailsPanel({ tab, onChanged }: { tab: Tab; onChanged?: () => void }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 300);

  useEffect(() => setPage(1), [tab, q]);

  const list = useAsync(() => emailsApi.list(tab, page, PAGE_SIZE), [tab, page], { pollMs: 5000, enabled: !q });
  const search = useAsync(() => emailsApi.search(q, tab), [tab, q], { enabled: Boolean(q) });

  useEffect(() => {
    if (list.data) onChanged?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data]);

  const active = q ? search : list;
  const rows: EmailRow[] = q ? search.data?.items ?? [] : list.data?.items ?? [];
  const c = copy[tab];

  return (
    <section className="rounded-xl bg-paper shadow-panel">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">{c.title}</h1>
          {!q && list.data && <p className="text-xs text-muted">{list.data.total.toLocaleString()} total · refreshes every 5 seconds</p>}
          {q && <p className="text-xs text-muted">Search results for “{q}”</p>}
        </div>
        <label className="relative block sm:w-72">
          <span className="sr-only">Search emails</span>
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipient, subject or body"
            className="h-9 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm placeholder:text-muted/80 focus:border-brand focus:bg-paper focus:outline-none"
          />
        </label>
      </div>

      {active.error ? (
        <p role="alert" className="px-5 py-10 text-center text-sm font-medium text-danger">
          {active.error}
        </p>
      ) : (
        <DataTable
          columns={columnsFor[tab]}
          rows={rows}
          rowKey={(r) => r.id}
          loading={active.loading}
          empty={
            q ? (
              <EmptyState title="No matches" body="Try part of an address, a word from the subject, or a word from the body." />
            ) : (
              <EmptyState
                title={c.emptyTitle}
                body={c.emptyBody}
                action={
                  tab === "scheduled" ? (
                    <Link to="/compose" className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-white hover:bg-brand-dark">
                      <IconPlus /> Compose new email
                    </Link>
                  ) : undefined
                }
              />
            )
          }
        />
      )}

      {!q && list.data && <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />}
    </section>
  );
}
