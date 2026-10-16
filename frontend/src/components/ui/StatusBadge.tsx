import type { EmailStatus } from "../../api/types";

const styles: Record<EmailStatus, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-canvas text-ink-soft" },
  throttled: { label: "Waiting for next hour", cls: "bg-amber-tint text-amber" },
  sending: { label: "Sending", cls: "bg-brand-tint text-brand-dark" },
  sent: { label: "Sent", cls: "bg-brand-tint text-brand-dark" },
  failed: { label: "Failed", cls: "bg-danger-tint text-danger" },
};

export function StatusBadge({ status, title }: { status: EmailStatus; title?: string }) {
  const s = styles[status];
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {s.label}
    </span>
  );
}
