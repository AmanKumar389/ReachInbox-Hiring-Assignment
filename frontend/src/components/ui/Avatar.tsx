export function Avatar({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return src ? (
    <img src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid place-items-center rounded-full bg-brand text-xs font-bold text-white" style={{ width: size, height: size }} aria-hidden="true">
      {initials}
    </span>
  );
}
