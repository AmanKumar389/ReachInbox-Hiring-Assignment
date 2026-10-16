import { estimateSchedule } from "../../utils/schedule";
import { formatDateTime, plural } from "../../utils/format";

interface Props {
  count: number;
  start: Date;
  delaySeconds: number;
  hourlyLimit: number;
}

/** Live estimate of when the first and last email go out, given the limits. */
export function SchedulePreview({ count, start, delaySeconds, hourlyLimit }: Props) {
  const est = estimateSchedule(count, start, delaySeconds, hourlyLimit);
  const bar = est ? Math.min(100, Math.max(6, (est.hours / 24) * 100)) : 0;

  return (
    <div className="rounded-xl bg-ink p-5 text-white">
      <h2 className="text-sm font-bold">Sending plan</h2>
      {!est ? (
        <p className="mt-2 text-sm text-white/70">Upload leads to see when the first and last email will go out.</p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-extrabold tracking-tight">{plural(count, "email")}</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-white/60">First send</dt>
              <dd className="font-semibold">{formatDateTime(est.first.toISOString())}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/60">Last send, about</dt>
              <dd className="font-semibold">{formatDateTime(est.last.toISOString())}</dd>
            </div>
          </dl>
          <div className="mt-5">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <div className="h-full rounded-full bg-[#5BD3A6]" style={{ width: `${bar}%` }} />
            </div>
            <p className="mt-2 text-xs text-white/70">
              {est.hours < 1 ? "Finishes within the hour" : `Spread over about ${Math.ceil(est.hours)} hours`} at up to {hourlyLimit.toLocaleString()} per
              hour, {delaySeconds}s apart.
            </p>
          </div>
          <p className="mt-4 border-t border-white/15 pt-3 text-xs leading-relaxed text-white/60">
            Emails over the hourly limit wait for the next hour instead of being dropped. Sender limits on the server can stretch this further.
          </p>
        </>
      )}
    </div>
  );
}
