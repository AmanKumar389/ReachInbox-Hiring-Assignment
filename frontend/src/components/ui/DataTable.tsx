import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: ReactNode;
  skeletonRows?: number;
}

/** Generic table with skeleton loading and an empty slot. Used by both email lists. */
export function DataTable<T>({ columns, rows, rowKey, loading, empty, skeletonRows = 6 }: Props<T>) {
  if (!loading && rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-semibold text-muted">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-5 py-3 font-semibold ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-5 py-4">
                      <div className="h-3.5 w-3/4 animate-pulse rounded bg-canvas" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((r) => (
                <tr key={rowKey(r)} className="border-b border-line last:border-0 hover:bg-canvas/60">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-5 py-3.5 align-middle ${c.className ?? ""}`}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
