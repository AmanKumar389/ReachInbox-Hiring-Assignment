import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { slackApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { Button } from "../ui/Button";
import { IconSlack } from "../ui/Icons";

/** Slack alerts card: connect via OAuth, send a test, disconnect. */
export function SlackConnect() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data, loading, reload } = useAsync(() => slackApi.status(), []);
  const [busy, setBusy] = useState(false);

  // Result of the OAuth round trip comes back as ?slack=connected|error
  useEffect(() => {
    const result = params.get("slack");
    if (!result) return;
    toast(result === "connected" ? "Slack connected. Check your channel for a confirmation." : "Slack connection didn't complete. Try again.", result === "connected" ? "success" : "error");
    params.delete("slack");
    setParams(params, { replace: true });
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok, "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Slack request failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl bg-paper p-4 shadow-panel">
      <div className="flex items-center gap-2">
        <IconSlack className="h-5 w-5" />
        <h2 className="text-sm font-bold">Slack alerts</h2>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">Get a message when a sender reaches its hourly limit.</p>

      <div className="mt-3">
        {loading ? (
          <div className="h-8 animate-pulse rounded-lg bg-canvas" />
        ) : !data?.available ? (
          <p className="text-xs font-medium text-amber">Slack isn't configured on the server.</p>
        ) : data.connected ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-brand-dark">
              Connected{data.teamName ? ` to ${data.teamName}` : ""}
              {data.channel ? ` · ${data.channel}` : ""}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(slackApi.test, "Test message sent to Slack")}>
                Send test
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(slackApi.disconnect, "Slack disconnected")}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <a href={slackApi.connectUrl} className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-3 text-[13px] font-semibold hover:bg-canvas">
            <IconSlack /> Connect Slack
          </a>
        )}
      </div>
    </section>
  );
}
