import { useRef, useState, type DragEvent } from "react";
import { parseLeads, type ParsedLeads } from "../../utils/parseLeads";
import { IconFile, IconUpload } from "../ui/Icons";
import { plural } from "../../utils/format";

interface Props {
  value: (ParsedLeads & { fileName: string }) | null;
  onChange: (v: (ParsedLeads & { fileName: string }) | null) => void;
  error?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;

export function LeadsUpload({ value, onChange, error }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const read = async (file: File | undefined) => {
    if (!file) return;
    setReadError(null);
    if (file.size > MAX_BYTES) return setReadError("That file is over 5 MB. Split it into smaller lists.");
    const parsed = parseLeads(await file.text());
    if (parsed.emails.length === 0) {
      onChange(null);
      return setReadError(`No email addresses found in ${file.name}.`);
    }
    onChange({ ...parsed, fileName: file.name });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void read(e.dataTransfer.files[0]);
  };

  const message = readError ?? error;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink-soft">Leads</span>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-4 py-3">
          <IconFile className="h-5 w-5 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{value.fileName}</p>
            <p className="text-xs text-muted">
              <strong className="font-bold text-brand-dark">{plural(value.emails.length, "email address", "email addresses")}</strong> detected
              {value.duplicates > 0 && `, ${plural(value.duplicates, "duplicate")} removed`}
            </p>
          </div>
          <button type="button" onClick={() => input.current?.click()} className="text-xs font-bold text-brand hover:underline">
            Replace
          </button>
          <button type="button" onClick={() => onChange(null)} className="text-xs font-bold text-muted hover:text-danger">
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors ${
            dragging ? "border-brand bg-brand-tint" : "border-line hover:border-brand/50 hover:bg-canvas"
          }`}
        >
          <IconUpload className="h-6 w-6 text-brand" />
          <span className="text-sm font-semibold">Upload a CSV or text file</span>
          <span className="text-xs text-muted">Drop it here or click to browse. Any column with email addresses works.</span>
        </button>
      )}
      <input ref={input} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => void read(e.target.files?.[0])} />
      {message && <p className="text-xs font-medium text-danger">{message}</p>}
    </div>
  );
}
