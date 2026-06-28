"use client";

import { downloadCsv, rowsToCsv } from "@/lib/internal/csv-export";

export function OpsCsvExportButton({
  filename,
  headers,
  getRows,
  label = "Export CSV",
}: {
  filename: string;
  headers: string[];
  getRows: () => (string | number | null | undefined)[][];
  label?: string;
}) {
  function handleExport() {
    const rows = getRows();
    if (rows.length === 0) return;
    downloadCsv(filename, rowsToCsv(headers, rows));
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-gold/40 hover:text-gold"
    >
      {label}
    </button>
  );
}
