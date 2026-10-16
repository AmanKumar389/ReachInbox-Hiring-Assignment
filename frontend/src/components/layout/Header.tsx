import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../ui/Avatar";
import { IconLogout } from "../ui/Icons";

export function Header() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <span>ReachInbox</span>
          <span className="hidden text-sm font-semibold text-muted sm:inline">Scheduler</span>
        </Link>

        {user && (
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-3 rounded-lg py-1.5 pl-1.5 pr-3 hover:bg-canvas"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <Avatar src={user.avatarUrl} name={user.name} size={32} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-bold">{user.name}</span>
                <span className="block text-xs text-muted">{user.email}</span>
              </span>
            </button>
            {open && (
              <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-paper p-1.5 shadow-pop">
                <div className="px-3 py-2 sm:hidden">
                  <p className="text-sm font-bold">{user.name}</p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                </div>
                <button role="menuitem" onClick={() => void signOut()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-canvas">
                  <IconLogout /> Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
