import { api } from "./client";
import type { Counts, CreateCampaignInput, CreateCampaignResult, EmailRow, Paged, SlackStatus, Tab, User } from "./types";

export const authApi = {
  me: () => api<{ user: User }>("/api/auth/me"),
  google: (credential: string) => api<{ user: User }>("/api/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  logout: () => api<{ ok: true }>("/api/auth/logout", { method: "POST" }),
};

export const emailsApi = {
  list: (tab: Tab, page: number, pageSize = 25) => api<Paged<EmailRow>>(`/api/emails?tab=${tab}&page=${page}&pageSize=${pageSize}`),
  counts: () => api<Counts>("/api/emails/counts"),
  search: (q: string, tab: Tab) => api<{ items: EmailRow[] }>(`/api/emails/search?tab=${tab}&q=${encodeURIComponent(q)}`),
};

export const campaignsApi = {
  create: (input: CreateCampaignInput) => api<CreateCampaignResult>("/api/campaigns", { method: "POST", body: JSON.stringify(input) }),
};

export const slackApi = {
  status: () => api<SlackStatus>("/api/slack/status"),
  /** Full-page navigation: the backend redirects on to Slack's consent screen. */
  connectUrl: "/api/slack/connect",
  test: () => api<{ ok: true }>("/api/slack/test", { method: "POST" }),
  disconnect: () => api<{ ok: true }>("/api/slack", { method: "DELETE" }),
};
