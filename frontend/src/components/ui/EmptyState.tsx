import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true" className="mb-5 text-brand">
        <rect x="6" y="14" width="44" height="30" rx="6" stroke="currentColor" strokeWidth="2" />
        <path d="m8 17 20 14 20-14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="44" cy="14" r="8" fill="#F4F6F4" stroke="currentColor" strokeWidth="2" />
        <path d="M44 10.5V14l2.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
