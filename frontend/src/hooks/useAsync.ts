import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  /** Re-fetch in the background every N ms (keeps tables live while the worker sends). */
  pollMs?: number;
  enabled?: boolean;
}

/**
 * Loads data, exposes loading/error, and optionally polls.
 * `loading` is only true for the first load of a given key, so background
 * refreshes don't flash the skeleton.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], { pollMs, enabled = true }: Options = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (background: boolean) => {
    if (!background) setLoading(true);
    try {
      const result = await fnRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run(false);
    if (!pollMs) return;
    const t = setInterval(() => void run(true), pollMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, pollMs]);

  return { data, error, loading, reload: () => run(true) };
}
