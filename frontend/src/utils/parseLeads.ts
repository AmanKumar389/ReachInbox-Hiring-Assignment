const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export interface ParsedLeads {
  emails: string[];
  duplicates: number;
}

/**
 * Works for CSV (any column order, with or without header) and plain text:
 * every email-shaped token is a lead. Duplicates are removed case-insensitively.
 */
export function parseLeads(text: string): ParsedLeads {
  const found = text.match(EMAIL_RE) ?? [];
  const seen = new Set<string>();
  for (const e of found) seen.add(e.toLowerCase());
  return { emails: [...seen], duplicates: found.length - seen.size };
}
