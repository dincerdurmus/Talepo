"use client";

import { FormEvent, useState } from "react";
import { Building2, LoaderCircle } from "lucide-react";

import { CompanyCategoryPicker } from "@/components/panel/CompanyCategoriesForm";

export const COMPANY_DRAFT_STORAGE_KEY = "talepo_company_draft";

export type CompanyDraft = {
  name?: string;
  city?: string;
  taxNumber?: string;
  sector?: string;
  categorySlugs?: string[];
};

type CompanyCreateFormProps = {
  initial?: CompanyDraft;
  compact?: boolean;
};

function readDraftFromStorage(): CompanyDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(COMPANY_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CompanyDraft;
  } catch {
    return null;
  }
}

function getInitialCompanyDraft(initial?: CompanyDraft): CompanyDraft {
  if (initial?.name || initial?.city || initial?.taxNumber) {
    return initial;
  }
  return readDraftFromStorage() ?? {};
}

function clearDraft() {
  try {
    sessionStorage.removeItem(COMPANY_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function CompanyCreateForm({
  initial,
  compact = false,
}: CompanyCreateFormProps) {
  const [name, setName] = useState(() => getInitialCompanyDraft(initial).name ?? "");
  const [city, setCity] = useState(() => getInitialCompanyDraft(initial).city ?? "");
  const [taxNumber, setTaxNumber] = useState(
    () => getInitialCompanyDraft(initial).taxNumber ?? "",
  );
  const [categorySlugs, setCategorySlugs] = useState<string[]>(
    () => getInitialCompanyDraft(initial).categorySlugs ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, city, taxNumber, categorySlugs }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        company?: { id: string; name: string };
      };

      if (!response.ok || !data.ok) {
        setError(data.message ?? "Firma oluşturulamadı.");
        return;
      }

      clearDraft();
      // Hard navigation so the panel layout re-reads the company-context
      // cookie and memberships (soft push can keep a stale layout).
      window.location.assign("/panel");
      return;
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`border border-black/[0.06] bg-white shadow-sm ${
        compact
          ? "rounded-[24px] p-5"
          : "rounded-[28px] p-6 sm:p-8 shadow-[0_18px_60px_rgba(0,0,0,0.04)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-800/10 text-teal-800">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Firma oluştur
          </h2>
          <p className="mt-1 text-sm leading-6 text-black/45">
            Firmanızı oluşturduğunuzda ekip daveti, envanter ve kurumsal panel
            araçları açılır. Üyelik varsayılanı Bireysel’dir.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="company-name" className="mb-2 block text-sm font-medium">
            Firma adı
          </label>
          <input
            id="company-name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Anadolu Ambalaj"
            className="h-12 w-full rounded-2xl border border-black/10 bg-[#f8f8f6] px-4 text-sm outline-none transition focus:border-black/35 focus:ring-4 focus:ring-black/5"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="company-city" className="mb-2 block text-sm font-medium">
              Şehir
            </label>
            <input
              id="company-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="İstanbul"
              className="h-12 w-full rounded-2xl border border-black/10 bg-[#f8f8f6] px-4 text-sm outline-none transition focus:border-black/35 focus:ring-4 focus:ring-black/5"
            />
          </div>
          <div>
            <label
              htmlFor="company-tax"
              className="mb-2 block text-sm font-medium"
            >
              Vergi no{" "}
              <span className="font-normal text-black/35">(isteğe bağlı)</span>
            </label>
            <input
              id="company-tax"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder="Vergi numarası"
              className="h-12 w-full rounded-2xl border border-black/10 bg-[#f8f8f6] px-4 text-sm outline-none transition focus:border-black/35 focus:ring-4 focus:ring-black/5"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Hizmet kategorileri</p>
          <p className="mb-3 text-xs leading-5 text-black/40">
            Talepler bu kategorilere göre firmanıza iletilir. En az birini seçin.
          </p>
          <CompanyCategoryPicker
            value={categorySlugs}
            onChange={setCategorySlugs}
          />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0f1f1d] px-5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
      >
        {busy ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Oluşturuluyor…
          </>
        ) : (
          "Firmayı oluştur"
        )}
      </button>
    </form>
  );
}
