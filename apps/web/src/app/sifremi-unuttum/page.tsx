"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CircleCheck, LockKeyhole } from "lucide-react";

/**
 * ŞİFREMİ UNUTTUM (2026-09-15).
 *
 * Sayfa, e-postanın kayıtlı olup olmadığını ASLA göstermez: başarı ekranı
 * her iki durumda da aynıdır. Uç nokta da aynı cevabı döner; iki yüzeyin
 * birbiriyle çelişmemesi bilinçlidir, yoksa arayüz sunucunun sakladığı
 * bilgiyi sızdırırdı.
 */
export default function SifremiUnuttumPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok) {
        setError(data.message ?? "İstek gönderilemedi. Tekrar deneyin.");
        return;
      }
      setSent(true);
    } catch {
      setError("Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-16">
      <Link
        href="/giris"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[#0f1f1d]/60 transition hover:text-[#0f1f1d]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Girişe dön
      </Link>

      {sent ? (
        <div className="rounded-[24px] border border-[#0f1f1d]/8 bg-white p-7 shadow-[0_12px_35px_rgba(0,0,0,0.035)]">
          <CircleCheck className="h-8 w-8 text-teal-600" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-[#0f1f1d]">
            Bağlantı gönderildi
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#0f1f1d]/65">
            Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen
            kutunuzu ve spam klasörünü kontrol edin. Bağlantı 1 saat geçerlidir.
          </p>
          <Link
            href="/giris"
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#0f1f1d] text-sm font-medium text-white transition hover:bg-[#0f1f1d]/90"
          >
            Giriş ekranına dön
          </Link>
        </div>
      ) : (
        <div className="rounded-[24px] border border-[#0f1f1d]/8 bg-white p-7 shadow-[0_12px_35px_rgba(0,0,0,0.035)]">
          <LockKeyhole className="h-8 w-8 text-teal-600" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-[#0f1f1d]">
            Şifrenizi mi unuttunuz?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#0f1f1d]/65">
            Hesabınızın e-posta adresini yazın; size sıfırlama bağlantısı
            gönderelim.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <label htmlFor="email" className="sr-only">
              E-posta
            </label>
            <div className="rounded-[20px] border border-[#0f1f1d]/8 bg-white p-2 transition focus-within:border-teal-600/35">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="E-posta adresiniz"
                className="h-12 w-full rounded-2xl bg-transparent px-3 text-base outline-none placeholder:text-[#0f1f1d]/25"
              />
            </div>
            {error && <p className="text-sm text-[#8b352b]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#0f1f1d] text-sm font-medium text-white transition hover:bg-[#0f1f1d]/90 disabled:opacity-60"
            >
              {loading ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
            </button>
          </form>

          <p className="mt-5 text-xs leading-relaxed text-[#0f1f1d]/45">
            Google veya başka bir hesapla giriş yaptıysanız şifreniz yoktur;
            o hesapla giriş yapmayı deneyin.
          </p>
        </div>
      )}
    </main>
  );
}
