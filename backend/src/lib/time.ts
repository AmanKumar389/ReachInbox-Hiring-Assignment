export const HOUR_MS = 60 * 60 * 1000;

/** Index of the clock hour containing `ms` (UTC). Used as part of Redis counter keys. */
export const hourWindow = (ms: number = Date.now()) => Math.floor(ms / HOUR_MS);

export const windowStart = (window: number) => window * HOUR_MS;
