import type { EmailRow, Tab } from "../../api/types";
import type { Column } from "../ui/DataTable";
import { StatusBadge } from "../ui/StatusBadge";
import { IconExternal } from "../ui/Icons";
import { formatDateTime, relativeFromNow } from "../../utils/format";

const recipient: Column<EmailRow> = {
  key: "email",
  header: "Email",
  render: (r) => (
    <div className="min-w-0">
      <p className="truncate font-semibold">{r.recipient}</p>
      {r.senderEmail && <p className="truncate text-xs text-muted">from {r.senderEmail}</p>}
    </div>
  ),
  className: "max-w-[280px]",
};

const subject: Column<EmailRow> = {
  key: "subject",
  header: "Subject",
  render: (r) => <span className="line-clamp-1 text-ink-soft">{r.subject}</span>,
  className: "max-w-[280px]",
};

const status: Column<EmailRow> = {
  key: "status",
  header: "Status",
  render: (r) => <StatusBadge status={r.status} title={r.error ?? undefined} />,
};

/** Column sets for each tab; shared columns are defined once above. */
export const columnsFor: Record<Tab, Column<EmailRow>[]> = {
  scheduled: [
    recipient,
    subject,
    {
      key: "scheduledAt",
      header: "Scheduled time",
      render: (r) => (
        <div>
          <p className="font-medium">{formatDateTime(r.scheduledAt)}</p>
          <p className="text-xs text-muted">{relativeFromNow(r.scheduledAt)}</p>
        </div>
      ),
    },
    status,
  ],
  sent: [
    recipient,
    subject,
    {
      key: "sentAt",
      header: "Sent time",
      render: (r) => <span className="font-medium">{formatDateTime(r.sentAt)}</span>,
    },
    status,
    {
      key: "preview",
      header: "",
      className: "w-10 text-right",
      render: (r) =>
        r.previewUrl ? (
          <a href={r.previewUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-md p-1.5 text-muted hover:bg-canvas hover:text-brand" aria-label={`Open ${r.recipient} in Ethereal`} title="Open in Ethereal">
            <IconExternal />
          </a>
        ) : null,
    },
  ],
};
