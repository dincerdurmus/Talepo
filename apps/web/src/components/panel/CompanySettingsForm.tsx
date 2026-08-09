"use client";

import { FormEvent, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ImagePlus,
  LoaderCircle,
  Save,
  Trash2,
} from "lucide-react";

import { compressImageToDataUrl } from "@/lib/media/compress-image";

export type CompanySettingsValues = {
  name: string;
  legalName: string;
  description: string;
  phone: string;
  email: string;
  websiteUrl: string;
  city: string;
  district: string;
  address: string;
  taxNumber: string;
  taxOffice: string;
  logoUrl: string | null;
  coverUrl: string | null;
};

export function CompanySettingsForm({
  initial,
}: {
  initial: CompanySettingsValues;
}) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState<"logo" | "cover" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof CompanySettingsValues>(
    key: K,
    value: CompanySettingsValues[K],
  ) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onPickImage(
    kind: "logo" | "cover",
    file: File | undefined,
  ) {
    if (!file) return;
    setMediaBusy(kind);
    setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, {
        maxWidth: kind === "logo" ? 512 : 1600,
        maxHeight: kind === "logo" ? 512 : 640,
        quality: kind === "logo" ? 0.85 : 0.8,
        maxBytes: kind === "logo" ? 280_000 : 700_000,
      });
      update(kind === "logo" ? "logoUrl" : "coverUrl", dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Görsel yüklenemedi.");
    } finally {
      setMediaBusy(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            name: form.name,
            legalName: form.legalName,
            description: form.description,
            phone: form.phone,
            email: form.email,
            websiteUrl: form.websiteUrl,
            city: form.city,
            district: form.district,
            address: form.address,
            taxNumber: form.taxNumber,
            taxOffice: form.taxOffice,
            logoUrl: form.logoUrl,
            coverUrl: form.coverUrl,
          },
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.message ?? "Kaydedilemedi.");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-800/10 text-teal-800">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Firma profili</h2>
          <p className="mt-1 text-sm leading-6 text-black/45">
            Logo, tanıtım ve iletişim bilgileri teklif ve mesajlarda görünür.
          </p>
        </div>
      </div>

      {/* Cover + logo */}
      <div className="overflow-hidden rounded-[22px] border border-black/[0.06]">
        <div
          className="relative flex h-36 items-end justify-between bg-[#e8eeec] bg-cover bg-center px-4 pb-4 sm:h-44"
          style={
            form.coverUrl
              ? { backgroundImage: `url(${form.coverUrl})` }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          <div className="relative flex items-end gap-3">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-white shadow-md">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logoUrl}
                  alt="Firma logosu"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 className="h-8 w-8 text-black/25" />
              )}
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2">
            <button
              type="button"
              disabled={mediaBusy !== null}
              onClick={() => coverInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-black/70 shadow-sm backdrop-blur"
            >
              {mediaBusy === "cover" ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              Kapak
            </button>
            {form.coverUrl && (
              <button
                type="button"
                onClick={() => update("coverUrl", null)}
                className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-black/55 shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Kaldır
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.05] px-4 py-3">
          <button
            type="button"
            disabled={mediaBusy !== null}
            onClick={() => logoInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1.5 text-xs font-semibold text-black/65 transition hover:bg-black/[0.07]"
          >
            {mediaBusy === "logo" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            Logo yükle
          </button>
          {form.logoUrl && (
            <button
              type="button"
              onClick={() => update("logoUrl", null)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-black/45 hover:text-black/70"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Logoyu kaldır
            </button>
          )}
          <p className="text-[11px] text-black/35">
            JPEG/PNG · logo kare, kapak yatay önerilir
          </p>
        </div>
      </div>

      <input
        ref={logoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void onPickImage("logo", e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void onPickImage("cover", e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Firma adı" required>
          <input
            required
            minLength={2}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Yasal unvan" hint="isteğe bağlı">
          <input
            value={form.legalName}
            onChange={(e) => update("legalName", e.target.value)}
            placeholder="A.Ş. / Ltd. unvanı"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Kısa tanıtım">
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Firmanızı, ürün ve hizmetlerinizi kısaca anlatın…"
          className={`${inputClass} min-h-[110px] resize-y py-3`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon">
          <input
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="05xx xxx xx xx"
            className={inputClass}
          />
        </Field>
        <Field label="E-posta">
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="info@firma.com"
            className={inputClass}
          />
        </Field>
        <Field label="Web sitesi">
          <input
            value={form.websiteUrl}
            onChange={(e) => update("websiteUrl", e.target.value)}
            placeholder="https://"
            className={inputClass}
          />
        </Field>
        <Field label="Şehir">
          <input
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="İstanbul"
            className={inputClass}
          />
        </Field>
        <Field label="İlçe">
          <input
            value={form.district}
            onChange={(e) => update("district", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Adres">
          <input
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Vergi no">
          <input
            value={form.taxNumber}
            onChange={(e) => update("taxNumber", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Vergi dairesi">
          <input
            value={form.taxOffice}
            onChange={(e) => update("taxOffice", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {saved && (
        <p className="text-sm font-medium text-teal-800">
          Firma profili kaydedildi.
        </p>
      )}

      <button
        type="submit"
        disabled={busy || mediaBusy !== null}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0f1f1d] px-5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Profili kaydet
      </button>
    </form>
  );
}

const inputClass =
  "h-12 w-full rounded-2xl border border-black/10 bg-[#f8f8f6] px-4 text-sm outline-none transition focus:border-black/35 focus:ring-4 focus:ring-black/5";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">
        {label}
        {required ? null : hint ? (
          <span className="font-normal text-black/35"> ({hint})</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}
