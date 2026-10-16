// Small inline icon set (stroke icons, currentColor) to avoid an icon dependency.
type P = { className?: string };
const base = (className = "h-4 w-4") => ({ className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconPlus = ({ className }: P) => <svg {...base(className)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconClock = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconSend = ({ className }: P) => <svg {...base(className)}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>;
export const IconSearch = ({ className }: P) => <svg {...base(className)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const IconUpload = ({ className }: P) => <svg {...base(className)}><path d="M12 15V3m0 0-4 4m4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>;
export const IconLogout = ({ className }: P) => <svg {...base(className)}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>;
export const IconArrowLeft = ({ className }: P) => <svg {...base(className)}><path d="M19 12H5m6-6-6 6 6 6" /></svg>;
export const IconExternal = ({ className }: P) => <svg {...base(className)}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
export const IconFile = ({ className }: P) => <svg {...base(className)}><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /></svg>;
export const IconSlack = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#E01E5A" d="M5 15a2 2 0 1 1-2-2h2zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0z" />
    <path fill="#36C5F0" d="M9 5a2 2 0 1 1 2-2v2zm0 1a2 2 0 1 1 0 4H4a2 2 0 1 1 0-4z" />
    <path fill="#2EB67D" d="M19 9a2 2 0 1 1 2 2h-2zm-1 0a2 2 0 1 1-4 0V4a2 2 0 1 1 4 0z" />
    <path fill="#ECB22E" d="M15 19a2 2 0 1 1-2 2v-2zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4z" />
  </svg>
);
