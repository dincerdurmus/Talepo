import Link from "next/link";
import { Target } from "lucide-react";

type SmartMatchPanelProps = {
  score: number;
  reasons: string[];
  profileIncomplete?: boolean;
  missingProfileFields?: string[];
};

export function SmartMatchPanel({
  score,
  reasons,
  profileIncomplete = false,
  missingProfileFields = [],
}: SmartMatchPanelProps) {
  if (profileIncomplete) {
    return (
      <section className="mt-5 rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5">
        <p className="text-sm font-semibold text-amber-950">
          Daha doğru eşleşmeler için firma profilinizi tamamlayın.
        </p>
        {missingProfileFields.length > 0 ? (
          <p className="mt-1 text-sm text-amber-900/70">
            Eksik: {missingProfileFields.join(", ")}
          </p>
        ) : null}
        <Link
          href="/panel/firma"
          className="mt-3 inline-flex text-sm font-semibold text-teal-800 underline"
        >
          Firma profilini düzenle
        </Link>
      </section>
    );
  }

  if (score <= 0) return null;

  return (
    <section className="mt-5 rounded-2xl border border-teal-900/10 bg-gradient-to-br from-teal-50/60 to-white p-5">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-teal-700" />
        <h2 className="text-sm font-semibold text-teal-950">
          Firmanızla %{Math.round(score)} eşleşiyor
        </h2>
      </div>
      {reasons.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-teal-950/65">
          {reasons.slice(0, 5).map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
