"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { CircleCheck, LockKeyhole } from "lucide-react";

import { PasswordInput } from "@/components/auth/PasswordInput";

/**
 * ŞİFRE SIFIRLAMA (2026-09-15).
 *
 * Jeton URL'den okunur ve yalnız sunucuya geri gönderilir; istemci onu
 * çözmeye ya da içindeki kimliği göstermeye çalışmaz. Geçersiz/süresi
 * dolmuş jeton için sunucu TEK ve AYNI mesajı döner — hangi kullanıcıya
 * ait olduğu ya da neden geçersiz olduğu sızdırılmaz.
 */
export default function SifreSifirlaPage() {
  return (
    <Suspense fallback={<Shell />}>
      <SifreSifirlaContent />
    </Suspense>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-16">
      <div className="rounded-[24px] border border-[#0f1f1d]/8 bg-white p-7 shadow-[0_12px_35px_rgba(0,0,0,0.035)]">
        {children}
      </div>
    </main>
  );
}

function SifreSifirlaContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Şifre sıfırlanamadı.");
        return;
      }
      setDone(true);
    } catch {
      setError("Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-[#0f1f1d]">
          Bağlantı geçersiz
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#0f1f1d]/65">
          Sıfırlama bağlantısı eksik görünüyor. Yeni bir bağlantı isteyin.
        </p>
        <Link
          href="/sifremi-unuttum"
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#0f1f1d] text-sm font-medium text-white transition hover:bg-[#0f1f1d]/90"
        >
          Yeni bağlantı iste
        </Link>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <CircleCheck className="h-8 w-8 text-teal-600" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-[#0f1f1d]">
          Şifreniz güncellendi
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#0f1f1d]/65">
          Yeni şifrenizle giriş yapabilirsiniz. Bu bağlantı artık geçersizdir.
        </p>
        <Link
          href="/giris"
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#0f1f1d] text-sm font-medium text-white transition hover:bg-[#0f1f1d]/90"
        >
          Giriş yap
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <LockKeyhole className="h-8 w-8 text-teal-600" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold text-[#0f1f1d]">
        Yeni şifre belirleyin
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#0f1f1d]/65">
        Bağlantı bir saat geçerlidir ve yalnız bir kez kullanılabilir.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label htmlFor="newPassword" className="sr-only">
          Yeni şifre
        </label>
        <div className="rounded-[20px] border border-[#0f1f1d]/8 bg-white p-2 transition focus-within:border-teal-600/35">
          <PasswordInput
            id="newPassword"
            name="newPassword"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Yeni şifreniz"
            wrapClassName="relative"
            inputClassName="h-12 w-full rounded-2xl bg-transparent px-3 pr-12 text-base outline-none placeholder:text-[#0f1f1d]/25"
          />
        </div>
        <label htmlFor="confirmPassword" className="sr-only">
          Yeni şifre (tekrar)
        </label>
        <div className="rounded-[20px] border border-[#0f1f1d]/8 bg-white p-2 transition focus-within:border-teal-600/35">
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Yeni şifreniz (tekrar)"
            wrapClassName="relative"
            inputClassName="h-12 w-full rounded-2xl bg-transparent px-3 pr-12 text-base outline-none placeholder:text-[#0f1f1d]/25"
          />
        </div>
        {error && <p className="text-sm text-[#8b352b]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#0f1f1d] text-sm font-medium text-white transition hover:bg-[#0f1f1d]/90 disabled:opacity-60"
        >
          {loading ? "Güncelleniyor…" : "Şifremi güncelle"}
        </button>
      </form>
    </Shell>
  );
}
