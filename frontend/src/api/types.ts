export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export type EmailStatus = "scheduled" | "throttled" | "sending" | "sent" | "failed";
export type Tab = "scheduled" | "sent";

export interface EmailRow {
  id: string;
  recipient: string;
  subject: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  previewUrl?: string | null;
  error?: string | null;
  senderEmail?: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Counts {
  scheduled: number;
  sent: number;
}

export interface SlackStatus {
  available: boolean;
  connected: boolean;
  teamName: string | null;
  channel: string | null;
}

export interface CreateCampaignInput {
  subject: string;
  body: string;
  recipients: string[];
  startAt: string;
  delaySeconds: number;
  hourlyLimit: number;
}

export interface CreateCampaignResult {
  campaignId: string;
  scheduled: number;
  firstSendAt: string;
}
