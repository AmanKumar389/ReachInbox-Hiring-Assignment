import { Link } from "react-router-dom";
import type { Counts, Tab } from "../../api/types";
import { IconClock, IconPlus, IconSend } from "../ui/Icons";
import { SlackConnect } from "../slack/SlackConnect";

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  counts: Counts | null;
}

const items: { id: Tab; label: string; Icon: typeof IconClock }[] = [
  { id: "scheduled", label: "Scheduled", Icon: IconClock },
  { id: "sent", label: "Sent", Icon: IconSend },
];

export function Sidebar({ tab, onTab, counts }: Props) {
  return (
    <div className="flex flex-col gap-5 md:sticky md:top-[88px]">
      <Link to="/compose" className="flex h-11 items-center justify-center gap-2 rounded-lg bg-brand text-sm font-bold text-white hover:bg-brand-dark">
        <IconPlus /> Compose new email
      </Link>

      <nav aria-label="Email folders" className="flex gap-1 md:flex-col">
        {items.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => onTab(id)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                active ? "bg-paper text-ink shadow-panel" : "text-ink-soft hover:bg-paper/60"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-brand" : ""}`} />
              {label}
              <span className="ml-auto text-xs font-bold text-muted">{counts ? counts[id].toLocaleString() : ""}</span>
            </button>
          );
        })}
      </nav>

      <SlackConnect />
    </div>
  );
}
