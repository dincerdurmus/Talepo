"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, LoaderCircle, Save } from "lucide-react";

import {
  getDistrictsForProvince,
  resolveCanonicalDistrict,
  resolveCanonicalProvince,
  TURKEY_IL_NAMES,
} from "@/lib/geo/turkey-districts";
import {
  PUBLIC_PROFILE_BIO_MAX,
  PUBLIC_PROFILE_NAME_MAX,
} from "@/lib/profile/public-profile";

import {
  SignalPrivateLabel,
  SignalSaveSuccess,
  SignalSection,
  signalEditorialInput,
  signalHelper,
  signalInput,
  signalLabel,
} from "./profile/ProfileSignal";

export type ProfileEditorValues = {
  name: string;
  city: string;
  district: string;
  country: string;
  biography: string;
};

function hydrateLocation(values: ProfileEditorValues): ProfileEditorValues {
  const city = resolveCanonicalProvince(values.city);
  const district = resolveCanonicalDistrict(city, values.district);
  return { ...values, city, district };
}

export function ProfileEditor({ initial }: { initial: ProfileEditorValues }) {
  const router = useRouter();
  const [form, setForm] = useState(() => hydrateLocation(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hydratedInitial = useMemo(() => hydrateLocation(initial), [initial]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(hydratedInitial),
    [form, hydratedInitial],
  );

  const cityOptions = useMemo(() => {
    if (form.city && !TURKEY_IL_NAMES.includes(form.city)) {
      return [form.city, ...TURKEY_IL_NAMES];
    }
    return TURKEY_IL_NAMES;
  }, [form.city]);

  const districtOptions = useMemo(() => {
    const known = form.city ? getDistrictsForProvince(form.city) : [];
    if (form.district && known.length > 0 && !known.includes(form.district)) {
      return [form.district, ...known];
    }
    if (form.district && known.length === 0) {
      return [form.district];
    }
    return known;
  }, [form.city, form.district]);

  function update<K extends keyof ProfileEditorValues>(
    key: K,
    value: ProfileEditorValues[K],
  ) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onCityChange(nextCity: string) {
    setSaved(false);
    setForm((current) => {
      const districts = nextCity ? getDistrictsForProvince(nextCity) : [];
      const keepDistrict =
        current.district && districts.includes(current.district)
          ? current.district
          : "";
      return { ...current, city: nextCity, district: keepDistrict };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !isDirty) return;

    const name = form.name.trim();
    if (!name || name.length > PUBLIC_PROFILE_NAME_MAX) {
      setError(
        `Ad soyad zorunlu ve en fazla ${PUBLIC_PROFILE_NAME_MAX} karakter olabilir.`,
      );
      return;
    }

    if (form.biography.length > PUBLIC_PROFILE_BIO_MAX) {
      setError(`Hakkımda en fazla ${PUBLIC_PROFILE_BIO_MAX} karakter olabilir.`);
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          city: form.city,
          district: form.district,
          country: form.country,
          biography: form.biography,
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
    <form onSubmit={onSubmit} className="space-y-4">
      <SignalSection
        title="Görünen profil"
        description="Konuşmalarda ve herkese açık profilinizde görünen alanlar."
        action={
          <div className="flex flex-col items-end gap-1">
            {isDirty && !saved ? (
              <span className="text-[11px] font-medium text-amber-800/85">
                Kaydedilmemiş değişiklikler
              </span>
            ) : null}
            <SignalSaveSuccess show={saved} />
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
          <Field
            label="Ad soyad / görünen ad"
            required
            value={form.name}
            maxLength={PUBLIC_PROFILE_NAME_MAX}
            onChange={(value) => update("name", value)}
            placeholder="Adınız Soyadınız"
          />
          <Field
            label="Ülke"
            value={form.country}
            onChange={(value) => update("country", value)}
            placeholder="Türkiye"
          />
          <SelectField
            label="Şehir"
            value={form.city}
            onChange={onCityChange}
            placeholder="Şehir seçin"
            options={cityOptions}
          />
        </div>

        <div className="mt-5 border-t border-teal-950/[0.06] pt-5">
          <label className="block w-full">
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className={signalLabel}>Hakkımda</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3d5c58]/80">
                <Eye className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                Herkese açık
              </span>
            </span>
            <textarea
              value={form.biography}
              onChange={(event) => update("biography", event.target.value)}
              rows={5}
              maxLength={PUBLIC_PROFILE_BIO_MAX}
              placeholder="Kısaca kendinizi veya uzmanlığınızı anlatın…"
              className={signalEditorialInput}
            />
            <span className="mt-1.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <span className={signalHelper}>
                Kısa ve net tutun · Herkese açık profilinizde görünür
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-[#0f1f1d]/52">
                {form.biography.length} / {PUBLIC_PROFILE_BIO_MAX}
              </span>
            </span>
          </label>
        </div>
      </SignalSection>

      <SignalSection
        title="Özel bilgiler"
        description="Bu alanlar herkese açık profilinizde gösterilmez."
      >
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-x-4">
          <SelectField
            label="İlçe"
            value={form.district}
            onChange={(value) => update("district", value)}
            placeholder={form.city ? "İlçe seçin" : "Önce şehir seçin"}
            options={districtOptions}
            disabled={!form.city}
            privateField
            hint="Herkese açık profilinizde gösterilmez"
          />
        </div>
      </SignalSection>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy || !isDirty}
          className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition sm:w-auto ${
            isDirty
              ? "bg-[#0f766e] text-white hover:bg-[#0d6a63]"
              : "border border-teal-950/10 bg-white text-[#0f1f1d]/35"
          } disabled:opacity-60`}
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Değişiklikleri kaydet
        </button>
        {isDirty && !saved ? (
          <span className="text-[12px] text-amber-800/80">
            Kaydetmeden ayrılırsanız değişiklikler kaybolur.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className={signalLabel}>{label}</span>
      <input
        required={required}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={signalInput}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  options,
  disabled = false,
  privateField = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
  disabled?: boolean;
  privateField?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className={signalLabel}>{label}</span>
        {privateField ? <SignalPrivateLabel /> : null}
      </span>
      <span className="relative mt-1.5 block">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`${signalInput} mt-0 appearance-none pr-10 disabled:cursor-not-allowed disabled:bg-[#f4f6f5] disabled:text-[#0f1f1d]/40`}
          aria-label={label}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f1f1d]/40"
          aria-hidden
        />
      </span>
      {hint ? <span className={signalHelper}>{hint}</span> : null}
    </label>
  );
}
