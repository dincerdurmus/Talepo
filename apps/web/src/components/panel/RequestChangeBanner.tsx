import { AlertTriangle } from "lucide-react";

const CHANGE_LABELS: Record<string, string> = {
  budgetMin: "Minimum bütçe",
  budgetMax: "Bütçe",
  isUrgent: "Acil durum",
  deadlineAt: "Teslim tarihi",
  status: "Durum",
};

const CHANGE_SUMMARY: Record<string, string> = {
  budgetMin: "Bütçe güncellendi",
  budgetMax: "Bütçe güncellendi",
  isUrgent: "Acil olarak işaretlendi",
  deadlineAt: "Teslim tarihi değişti",
  status: "Durum güncellendi",
};

function formatChangeValue(field: string, value: string | null) {
  if (value == null) return "—";
  if (field === "isUrgent") return value === "true" ? "Acil" : "Normal";
  if (field === "deadlineAt") {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? value
      : new Intl.DateTimeFormat("tr-TR").format(d);
  }
  if (field === "budgetMin" || field === "budgetMax") {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
      }).format(n);
    }
  }
  return value;
}

export type RequestChangeRow = {
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

export function RequestChangeBanner({ changes }: { changes: RequestChangeRow[] }) {
  if (changes.length === 0) return null;

  const summaries = [
    ...new Set(changes.map((c) => CHANGE_SUMMARY[c.field] ?? "Talep güncellendi")),
  ];

  return (
    <section className="mt-5 rounded-2xl border border-amber-200/60 bg-amber-50/70 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-950">
        <AlertTriangle className="h-4 w-4" />
        {summaries.join(" · ")}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-amber-900/80">
        {changes.map((change) => (
          <li key={`${change.field}-${change.newValue}`}>
            {CHANGE_LABELS[change.field] ?? change.field}:{" "}
            {formatChangeValue(change.field, change.oldValue)} →{" "}
            {formatChangeValue(change.field, change.newValue)}
          </li>
        ))}
      </ul>
    </section>
  );
}
