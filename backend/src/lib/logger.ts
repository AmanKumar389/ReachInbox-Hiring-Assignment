type Level = "info" | "warn" | "error" | "debug";

function log(level: Level, scope: string, msg: string, meta?: Record<string, unknown>) {
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}`;
  const out = meta ? `${line} ${JSON.stringify(meta)}` : line;
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const createLogger = (scope: string) => ({
  info: (m: string, meta?: Record<string, unknown>) => log("info", scope, m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log("warn", scope, m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log("error", scope, m, meta),
  debug: (m: string, meta?: Record<string, unknown>) => {
    if (process.env.DEBUG) log("debug", scope, m, meta);
  },
});
