/** Human readable file size, e.g. "840 KB" or "1.2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * Shortens a file name for use inside a sentence, keeping the extension so
 * the file is still recognisable. Chips and trace lines can truncate with
 * CSS because the name is the whole line; a name inside a message cannot,
 * which is how a screenshot called after its timestamp ends up pushing a
 * rejection badge off the composer.
 */
export function shortenFileName(name: string, max = 22): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  // Only treat a trailing dot group as an extension if it looks like one.
  const extension = dot > 0 && name.length - dot <= 8 ? name.slice(dot) : "";
  const stem = extension ? name.slice(0, dot) : name;
  const keep = Math.max(8, max - extension.length - 1);
  return `${stem.slice(0, keep).trimEnd()}…${extension}`;
}

/**
 * Matches a file against an accept list that mixes MIME types ("image/png"),
 * wildcards ("image/*") and extensions (".md"). Extensions matter because
 * browsers report an empty type for some plain-text formats.
 */
export function isAcceptedFile(file: File, accept: readonly string[]): boolean {
  const type = file.type.toLowerCase();
  const extension = `.${file.name.split(".").pop() ?? ""}`.toLowerCase();

  return accept.some((rule) => {
    const pattern = rule.toLowerCase();
    if (pattern.startsWith(".")) return extension === pattern;
    if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1));
    return type === pattern;
  });
}
