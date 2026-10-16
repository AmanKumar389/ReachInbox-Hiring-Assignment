export interface ScheduleEstimate {
  first: Date;
  last: Date;
  hours: number;
}

/**
 * Mirrors the backend's behaviour closely enough for a preview: emails are spaced
 * by the per-email delay, and anything beyond the hourly limit rolls into the
 * next clock hour. Sender-level limits on the server can only make it slower.
 */
export function estimateSchedule(count: number, start: Date, delaySeconds: number, hourlyLimit: number): ScheduleEstimate | null {
  if (count <= 0 || hourlyLimit <= 0 || Number.isNaN(start.getTime())) return null;
  const HOUR = 3_600_000;
  let t = Math.max(start.getTime(), Date.now());
  let windowIdx = Math.floor(t / HOUR);
  let inWindow = 0;
  let last = t;
  for (let i = 0; i < count; i++) {
    if (Math.floor(t / HOUR) !== windowIdx) {
      windowIdx = Math.floor(t / HOUR);
      inWindow = 0;
    }
    if (inWindow >= hourlyLimit) {
      windowIdx += 1;
      t = windowIdx * HOUR;
      inWindow = 0;
    }
    last = t;
    inWindow++;
    t += delaySeconds * 1000;
  }
  const first = new Date(Math.max(start.getTime(), Date.now()));
  return { first, last: new Date(last), hours: (last - first.getTime()) / HOUR };
}
