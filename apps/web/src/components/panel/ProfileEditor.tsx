"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";

import {
  PUBLIC_PROFILE_BIO_MAX,
  PUBLIC_PROFILE_NAME_MAX,
} from "@/lib/profile/public-profile";

import {
  SignalPrivateLabel,
  SignalSaveSuccess,
  SignalSection,
  signalInput,
} from "./profile/ProfileSignal";

export type ProfileEditorValues = {
  name: string;
  city: string;
  district: string;
  country: string;
  biography: string;
};

export function ProfileEditor({ initial }: { initial: ProfileEditorValues }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial],
  );

  function update<K extends keyof ProfileEditorValues>(
    key: K,
    value: ProfileEditorValues[K],
  ) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
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
    <form onSubmit={onSubmit}>
      <SignalSection
        title="Profil bilgileri"
        description="Konuşmalarda görünen güvenli alanları güncelleyin."
        action={
          <div className="flex flex-col items-end gap-1">
            {isDirty && !saved ? (
              <span className="text-[11px] font-medium text-amber-700">
                Kaydedilmemiş değişiklikler
              </span>
            ) : null}
            <SignalSaveSuccess show={saved} />
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field
            label="Şehir"
            value={form.city}
            onChange={(value) => update("city", value)}
            placeholder="İstanbul"
          />
          <Field
            label="İlçe"
            value={form.district}
            onChange={(value) => update("district", value)}
            placeholder="Bağcılar"
            privateField
            hint="Public profilde gösterilmez"
          />
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-teal-950/45">Hakkımda</span>
            <textarea
              value={form.biography}
              onChange={(event) => update("biography", event.target.value)}
              rows={4}
              maxLength={PUBLIC_PROFILE_BIO_MAX}
              placeholder="Kısaca kendinizi veya uzmanlığınızı anlatın…"
              className={`${signalInput} resize-none`}
            />
            <span className="mt-1 block text-[11px] text-teal-950/35">
              {form.biography.length}/{PUBLIC_PROFILE_BIO_MAX}
            </span>
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 border-t border-teal-950/[0.06] pt-5">
          <button
            type="submit"
            disabled={busy || !isDirty}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
              isDirty
                ? "bg-[#0f1f1d] text-white hover:bg-black"
                : "border border-teal-950/10 bg-white/60 text-teal-950/35"
            } disabled:opacity-60`}
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Kaydet
          </button>
        </div>
      </SignalSection>
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
  hint,
  privateField,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  hint?: string;
  privateField?: boolean;
}) {
  return (
    <label className="block">
      <span className="inline-flex flex-wrap items-center gap-2 text-xs font-medium text-teal-950/45">
        {label}
        {privateField ? <SignalPrivateLabel /> : null}
      </span>
      <input
        required={required}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={signalInput}
      />
      {hint ? (
        <span className="mt-1 block text-[11px] text-teal-950/35">{hint}</span>
      ) : null}
    </label>
  );
}
