"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";

import { SignalPrivateLabel, signalInput, signalSurface } from "./ProfileSignal";

import type { ProfileEditorValues } from "@/components/panel/ProfileEditor";

export function ProfilePhoneField({
  phone,
  profileSnapshot,
}: {
  phone: string;
  profileSnapshot: ProfileEditorValues;
}) {
  const router = useRouter();
  const [value, setValue] = useState(phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profileSnapshot,
          phone: value,
        }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Telefon güncellenemedi.");
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
    <form onSubmit={onSubmit} className={`${signalSurface} p-4`}>
      <label className="block">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-teal-950/45">
          Telefon
          <SignalPrivateLabel />
        </span>
        <input
          value={value}
          onChange={(event) => {
            setSaved(false);
            setValue(event.target.value);
          }}
          placeholder="05xx xxx xx xx"
          className={signalInput}
        />
      </label>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {saved ? (
        <p className="mt-2 text-sm text-[#0f766e]">Telefon kaydedildi.</p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#151515] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Telefonu kaydet
      </button>
    </form>
  );
}
