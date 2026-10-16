const dateTime = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : "—");
export const formatTime = (d: Date) => time.format(d);

export function relativeFromNow(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const text = mins < 1 ? "under a minute" : mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** Value for <input type="datetime-local"> in the user's local time. */
export function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
