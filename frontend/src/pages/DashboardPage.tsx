import { useState } from "react";
import { emailsApi } from "../api/endpoints";
import type { Tab } from "../api/types";
import { AppShell } from "../components/layout/AppShell";
import { Sidebar } from "../components/layout/Sidebar";
import { EmailsPanel } from "../components/emails/EmailsPanel";
import { useAsync } from "../hooks/useAsync";

export function DashboardPage() {
  const [tab, setTab] = useState<Tab>("scheduled");
  const counts = useAsync(() => emailsApi.counts(), []);

  return (
    <AppShell sidebar={<Sidebar tab={tab} onTab={setTab} counts={counts.data} />}>
      <EmailsPanel key={tab} tab={tab} onChanged={() => void counts.reload()} />
    </AppShell>
  );
}
