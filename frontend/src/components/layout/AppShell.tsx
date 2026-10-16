import type { ReactNode } from "react";
import { Header } from "./Header";

/** Page frame used by every signed-in screen. */
export function AppShell({ sidebar, children }: { sidebar?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-6 md:flex-row md:px-6">
        {sidebar && <aside className="w-full shrink-0 md:w-64">{sidebar}</aside>}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
