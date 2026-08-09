"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Save } from "lucide-react";

export type ProfileEditorValues = {
  name: string;
  email: string;
  phone: string;
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

  function update<K extends keyof ProfileEditorValues>(
    key: K,
    value: ProfileEditorValues[K],
  ) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
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
    <form
      onSubmit={onSubmit}
      className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">
            Profili düzenle
          </h3>
          <p className="mt-1 text-sm text-black/45">
            İletişim ve konum bilgilerinizi güncel tutun.
          </p>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f7f2] px-3 py-1.5 text-xs font-semibold text-[#0f766e]">
            <Check className="h-3.5 w-3.5" />
            Kaydedildi
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          label="Ad soyad"
          required
          value={form.name}
          onChange={(value) => update("name", value)}
          placeholder="Adınız Soyadınız"
        />
        <label className="block">
          <span className="text-xs font-medium text-black/40">E-posta</span>
          <input
            value={form.email}
            disabled
            className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f0f0ec] px-3 py-2.5 text-sm text-black/45 outline-none"
          />
          <span className="mt-1 block text-[11px] text-black/35">
            Google hesabından gelir, değiştirilemez.
          </span>
        </label>
        <Field
          label="Telefon"
          value={form.phone}
          onChange={(value) => update("phone", value)}
          placeholder="05xx xxx xx xx"
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
        />
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-black/40">Hakkımda</span>
          <textarea
            value={form.biography}
            onChange={(event) => update("biography", event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Kısaca kendinizi veya firmanızı anlatın…"
            className="mt-1.5 w-full resize-none rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 text-sm outline-none focus:border-black/25"
          />
          <span className="mt-1 block text-[11px] text-black/35">
            {form.biography.length}/1000
          </span>
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-[#151515] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Kaydet
        </button>
        <p className="text-xs text-black/40">
          Telefonunuz teklif kabulüne kadar gizli kalır.
        </p>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-black/40">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 text-sm outline-none focus:border-black/25"
      />
    </label>
  );
}
