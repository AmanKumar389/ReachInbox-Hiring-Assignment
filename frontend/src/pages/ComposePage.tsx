import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { campaignsApi } from "../api/endpoints";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { Field, Input, Textarea } from "../components/ui/Field";
import { IconArrowLeft } from "../components/ui/Icons";
import { LeadsUpload } from "../components/compose/LeadsUpload";
import { SchedulePreview } from "../components/compose/SchedulePreview";
import { useToast } from "../context/ToastContext";
import { plural, toLocalInput } from "../utils/format";
import type { ParsedLeads } from "../utils/parseLeads";

type Leads = (ParsedLeads & { fileName: string }) | null;
type Errors = Partial<Record<"subject" | "body" | "leads" | "startAt" | "delay" | "limit", string>>;

export function ComposePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [leads, setLeads] = useState<Leads>(null);
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date(Date.now() + 2 * 60_000)));
  const [delay, setDelay] = useState("2");
  const [limit, setLimit] = useState("100");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const start = useMemo(() => new Date(startAt), [startAt]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!subject.trim()) e.subject = "Add a subject line.";
    if (!body.trim()) e.body = "Write the email body.";
    if (!leads?.emails.length) e.leads = "Upload a file with at least one email address.";
    if (Number.isNaN(start.getTime())) e.startAt = "Pick a start date and time.";
    const d = Number(delay);
    if (!Number.isInteger(d) || d < 0 || d > 3600) e.delay = "Use a whole number from 0 to 3600.";
    const l = Number(limit);
    if (!Number.isInteger(l) || l < 1) e.limit = "Use a whole number of at least 1.";
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      const res = await campaignsApi.create({
        subject: subject.trim(),
        body: body.trim(),
        recipients: leads!.emails,
        startAt: start.toISOString(),
        delaySeconds: Number(delay),
        hourlyLimit: Number(limit),
      });
      toast(`Scheduled ${plural(res.scheduled, "email")}`, "success");
      navigate("/");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't schedule these emails", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-brand">
        <IconArrowLeft /> Back to emails
      </Link>

      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6 rounded-xl bg-paper p-5 shadow-panel sm:p-7">
          <h1 className="text-xl font-extrabold tracking-tight">Compose new email</h1>

          <Field label="Subject" error={errors.subject}>
            {(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick question about your outbound" maxLength={300} />}
          </Field>

          <Field label="Body" error={errors.body} hint="Sent as plain text.">
            {(id) => <Textarea id={id} rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder={"Hi there,\n\n..."} />}
          </Field>

          <LeadsUpload value={leads} onChange={setLeads} error={errors.leads} />

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Start time" error={errors.startAt}>
              {(id) => <Input id={id} type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />}
            </Field>
            <Field label="Delay between emails" error={errors.delay} hint="Seconds">
              {(id) => <Input id={id} type="number" min={0} max={3600} value={delay} onChange={(e) => setDelay(e.target.value)} />}
            </Field>
            <Field label="Hourly limit" error={errors.limit} hint="Emails per hour">
              {(id) => <Input id={id} type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} />}
            </Field>
          </div>

          <div className="flex justify-end gap-3 border-t border-line pt-5">
            <Button type="button" variant="secondary" onClick={() => navigate("/")}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {leads ? `Schedule ${plural(leads.emails.length, "email")}` : "Schedule"}
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-[88px] lg:self-start">
          <SchedulePreview count={leads?.emails.length ?? 0} start={start} delaySeconds={Number(delay) || 0} hourlyLimit={Number(limit) || 0} />
        </div>
      </form>
    </AppShell>
  );
}
