import Link from "next/link";

import {
  LEGAL_ENTITY,
  LEGAL_ENTITY_LABELS,
  missingLegalFields,
  type LegalEntityKey,
} from "@/lib/legal/company-info";

/**
 * Hukuki metin kabuğu. Doldurulmamış şirket bilgisi SAYFADA GÖRÜNÜR —
 * sessizce boş bırakılmaz (bkz. `company-info.ts`).
 */
export function Field({ name }: { name: LegalEntityKey }) {
  const value = LEGAL_ENTITY[name];
  if (value) return <>{value}</>;
  return (
    <mark className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[0.85em] font-semibold text-amber-950">
      [DOLDURULACAK: {LEGAL_ENTITY_LABELS[name]}]
    </mark>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f1d]">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-black/65">
        {children}
      </div>
    </section>
  );
}

export function LegalShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  const missing = missingLegalFields();
  return (
    <main className="min-h-screen bg-[#f4f7f6] px-5 py-12 text-[#0f1f1d] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-medium text-black/45 transition hover:text-black"
        >
          ← Talepo
        </Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.045em]">
          {title}
        </h1>
        <p className="mt-3 text-sm text-black/40">
          Yürürlük tarihi: <Field name="effectiveDate" />
        </p>
        {missing.length > 0 && (
          <p className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            <strong className="font-semibold">Bu metin yayına hazır değil.</strong>{" "}
            {missing.length} alan doldurulmamış. Tümü{" "}
            <code className="rounded bg-amber-200/60 px-1">
              src/lib/legal/company-info.ts
            </code>{" "}
            dosyasından doldurulur.
          </p>
        )}
        {intro && (
          <div className="mt-6 space-y-3 text-[15px] leading-7 text-black/65">
            {intro}
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
