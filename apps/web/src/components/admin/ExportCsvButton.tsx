"use client";

export function ExportCsvButton({ rows, filename = "admin-kayitlari.csv", onExport }: { rows: Array<Record<string, unknown>>; filename?: string; onExport?: () => void }) {
  function exportCsv() {
    if (!rows.length) return;
    onExport?.();
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers, ...rows.map((row) => headers.map((header) => row[header]))].map((row) => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <button type="button" onClick={exportCsv} disabled={!rows.length} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:bg-white/[.07] disabled:cursor-not-allowed disabled:opacity-40">CSV dışa aktar</button>;
}
