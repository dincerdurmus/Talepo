"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { PasswordInput } from "@/components/auth/PasswordInput";

const inputClass =
  "h-14 w-full rounded-2xl border border-black/10 bg-white/90 px-4 text-sm outline-none transition placeholder:text-black/30 focus:border-teal-600/40 focus:ring-4 focus:ring-teal-600/10";

export default function KayitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Yarım kalan talep akışı buraya callbackUrl ile gelir — kayıt sonrası
  // kullanıcı kaldığı yere döner (kurucu, 2026-08-23).
  const callbackUrl = searchParams.get("callbackUrl") || "/panel";
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [social, setSocial] = useState({ facebook: false, twitter: false });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/providers-status")
      .then((response) => response.json())
      .then((data: { facebook?: boolean; twitter?: boolean }) => {
        if (cancelled) return;
        setSocial({
          facebook: Boolean(data.facebook),
          twitter: Boolean(data.twitter),
        });
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function startGoogleSignIn() {
    void signIn("google", { callbackUrl });
  }

  async function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setHint(null);

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const phone = String(form.get("phone") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          password,
          confirmPassword,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        setHint(data.message ?? "Kayıt tamamlanamadı.");
        return;
      }

      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        setHint(
          "Hesap oluşturuldu ancak giriş yapılamadı. /giris sayfasından deneyin.",
        );
        return;
      }

      router.push(result.url || callbackUrl);
      router.refresh();
    } catch {
      setHint("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f7f6] text-[#0f1f1d]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex min-h-screen flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12 xl:px-16">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-32 top-0 h-[380px] w-[380px] animate-[talepo-float_14s_ease-in-out_infinite] rounded-full bg-[#9ae89a]/35 blur-[100px]" />
            <div className="absolute right-0 top-40 h-72 w-72 animate-[talepo-float-alt_18s_ease-in-out_infinite] rounded-full bg-[#7ec8ff]/30 blur-[90px]" />
            <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-[#ffe08a]/25 blur-[90px]" />
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" className="flex w-fit items-center gap-2">
              <span className="text-2xl font-semibold tracking-[-0.06em]">
                tale<span className="text-[#0d9488]">po</span>
              </span>
              <span className="rounded-full border border-[#0d9488]/20 bg-[#e6fffa] px-2.5 py-1 text-[9px] font-semibold tracking-[0.16em] text-teal-800 shadow-sm">
                BETA
              </span>
            </Link>

            <Link
              href="/"
              className="group flex items-center gap-2 rounded-full border border-black/[0.07] bg-white/80 px-4 py-2 text-sm font-medium text-black/50 shadow-sm backdrop-blur-xl transition hover:bg-white hover:text-black"
            >
              <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
              Ana sayfa
            </Link>
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center py-10 lg:py-12">
            <div className="flex w-fit items-center gap-2 rounded-full border border-teal-600/20 bg-gradient-to-r from-[#e6fffa] to-[#e0f2fe] px-4 py-2 text-sm font-medium text-teal-900/80 shadow-sm">
              <Sparkles className="h-4 w-4 text-teal-700" />
              Tek hesap · ücretsiz başlayın
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-[2.75rem]">
              Ücretsiz hesabınızı{" "}
              <span className="bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent">
                oluşturun
              </span>
            </h1>

            <p className="mt-4 max-w-md text-base leading-7 text-black/50">
              Talebinizi yayınlayın, teklifleri karşılaştırın veya firmanız için
              fırsatları görün — hepsi aynı hesapta.
            </p>

            <button
              type="button"
              onClick={startGoogleSignIn}
              className="group mt-7 flex min-h-[56px] w-full items-center justify-between rounded-[20px] border border-black/[0.08] bg-white px-4 shadow-[0_14px_45px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-teal-600/30"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4285F4] via-[#34A853] to-[#FBBC05] p-[2px]">
                  <span className="flex h-full w-full items-center justify-center rounded-[14px] bg-white text-lg font-bold text-[#4285F4]">
                    G
                  </span>
                </span>
                <span className="text-left">
                  <span className="block font-semibold">Google ile devam et</span>
                  <span className="block text-xs text-black/40">
                    Hızlı ve güvenli kayıt
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-teal-700 transition group-hover:translate-x-1" />
            </button>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!social.facebook}
                title={
                  social.facebook
                    ? "Facebook ile kayıt"
                    : "Facebook girişi yakında"
                }
                onClick={() =>
                  social.facebook && signIn("facebook", { callbackUrl })
                }
                className={`flex h-12 items-center justify-center rounded-2xl border text-sm font-medium ${
                  social.facebook
                    ? "border-black/10 bg-white hover:border-black/20"
                    : "cursor-not-allowed border-black/8 bg-white/60 text-black/30"
                }`}
              >
                Facebook{!social.facebook ? " · Yakında" : ""}
              </button>
              <button
                type="button"
                disabled={!social.twitter}
                title={social.twitter ? "X ile kayıt" : "X girişi yakında"}
                onClick={() =>
                  social.twitter && signIn("twitter", { callbackUrl })
                }
                className={`flex h-12 items-center justify-center rounded-2xl border text-sm font-medium ${
                  social.twitter
                    ? "border-black/10 bg-white hover:border-black/20"
                    : "cursor-not-allowed border-black/8 bg-white/60 text-black/30"
                }`}
              >
                X{!social.twitter ? " · Yakında" : ""}
              </button>
            </div>

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
              <span className="text-xs font-medium text-black/35">
                veya e-posta ile
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
            </div>

            <form className="space-y-4" onSubmit={onEmailSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium">
                    Ad soyad
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Adınız ve soyadınız"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-medium"
                  >
                    Telefon
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="05XX XXX XX XX"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium">
                  E-posta
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ornek@firma.com"
                  required
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium"
                  >
                    Şifre
                  </label>
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    placeholder="En az 8 karakter"
                    minLength={8}
                    required
                    inputClassName={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-medium"
                  >
                    Şifre tekrar
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Tekrar girin"
                    minLength={8}
                    required
                    inputClassName={inputClass}
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-black/55">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="mt-1 h-4 w-4 rounded border-black/20 accent-teal-700"
                />
                <span>
                  <Link
                    href="/kullanim-kosullari"
                    className="font-medium text-teal-800 hover:underline"
                  >
                    Kullanım koşullarını
                  </Link>{" "}
                  ve{" "}
                  <Link
                    href="/gizlilik-politikasi"
                    className="font-medium text-teal-800 hover:underline"
                  >
                    gizlilik politikasını
                  </Link>{" "}
                  kabul ediyorum.
                </span>
              </label>

              {hint && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950/80">
                  {hint}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-teal-800 to-sky-800 font-semibold text-white shadow-[0_14px_40px_rgba(13,148,136,0.25)] transition hover:opacity-95 disabled:opacity-60"
              >
                {busy ? "Hesap oluşturuluyor…" : "Hesap oluştur"}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-black/45">
              Zaten hesabınız var mı?{" "}
              <Link
                href="/giris"
                className="font-semibold text-teal-800 transition hover:text-teal-950"
              >
                Giriş yapın
              </Link>
            </p>
          </div>
        </section>

        <section className="relative hidden min-h-screen overflow-hidden p-5 lg:block xl:p-7">
          <div className="absolute inset-5 overflow-hidden rounded-[38px] bg-gradient-to-br from-[#0f766e] via-[#0c4a6e] to-[#172554] shadow-[0_35px_110px_rgba(15,118,110,0.28)] xl:inset-7">
            <div className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-[#5eead4]/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-10 right-0 h-64 w-64 rounded-full bg-[#38bdf8]/20 blur-3xl" />

            <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white xl:p-12">
              <div>
                <p className="text-sm font-medium text-teal-100/70">
                  Talepo iş ağı
                </p>
                <h2 className="mt-5 max-w-md text-4xl font-semibold leading-[1.1] tracking-[-0.04em] xl:text-5xl">
                  İhtiyacınızı paylaşın, doğru firmalar size ulaşsın.
                </h2>
                <p className="mt-5 max-w-sm text-base leading-7 text-white/65">
                  Tek hesapla hem talep oluşturun hem firma olarak teklif verin.
                  İletişiminiz kabulden önce gizli kalır.
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  { label: "Talep oluşturma", value: "Ücretsiz" },
                  { label: "İletişim bilgileri", value: "Kabulden önce gizli" },
                  { label: "Teklifler", value: "Yan yana karşılaştırın" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur"
                  >
                    <p className="text-xs font-medium text-teal-100/70">
                      {item.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                <p className="text-sm leading-6 text-emerald-50/85">
                  Firma kurmak isterseniz kayıt sonrası panelden birkaç dakikada
                  ekleyebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
