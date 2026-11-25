export interface Column<T> {
  header: string;
  value: (row: T) => string | number;
}

function cell(value: string | number): string {
  const text = String(value);
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV with a UTF-8 byte order mark (so Excel on Windows reads it as UTF-8) and LF line
 * endings (so the file diffs cleanly in Git).
 */
export function toCsv<T>(rows: readonly T[], columns: readonly Column<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(","));
  return "﻿" + lines.join("\n") + "\n";
}
