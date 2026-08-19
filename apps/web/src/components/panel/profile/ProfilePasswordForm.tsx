"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { signOut } from "next-auth/react";

import { signalInput } from "./ProfileSignal";

export function ProfilePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        requiresReLogin?: boolean;
      };

      if (!response.ok || !data.ok) {
        setError(data.message ?? "Şifre güncellenemedi.");
        return;
      }

      setSuccess(
        data.message ??
          "Şifreniz güncellendi. Bu cihazdaki oturumunuz kapatılacaktır. Diğer açık oturumlar geçerli kalabilir.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (data.requiresReLogin) {
        window.setTimeout(() => {
          void signOut({ callbackUrl: "/giris?reason=password-changed" });
        }, 1200);
      }
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PasswordField
        label="Mevcut şifre"
        value={currentPassword}
        onChange={setCurrentPassword}
        show={showCurrent}
        onToggleShow={() => setShowCurrent((value) => !value)}
        autoComplete="current-password"
      />
      <PasswordField
        label="Yeni şifre"
        value={newPassword}
        onChange={setNewPassword}
        show={showNew}
        onToggleShow={() => setShowNew((value) => !value)}
        autoComplete="new-password"
      />
      <PasswordField
        label="Yeni şifre tekrar"
        value={confirmPassword}
        onChange={setConfirmPassword}
        show={showNew}
        onToggleShow={() => setShowNew((value) => !value)}
        autoComplete="new-password"
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-[#0f766e]">{success}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#151515] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        Şifreyi güncelle
      </button>
    </form>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete: string;
}) {
  const inputId = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <label className="block" htmlFor={inputId}>
      <span className="text-xs font-medium text-black/45">{label}</span>
      <div className="relative mt-1.5">
        <input
          id={inputId}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className={`${signalInput} pr-11`}
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? `${label} gizle` : `${label} göster`}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-black/40"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
