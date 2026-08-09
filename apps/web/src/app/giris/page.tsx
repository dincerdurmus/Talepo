"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  LockKeyhole,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Store,
  WandSparkles,
} from "lucide-react";

import { PasswordInput } from "@/components/auth/PasswordInput";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export default function GirisPage() {
  return (
    <Suspense fallback={<GirisPageFallback />}>
      <GirisPageContent />
    </Suspense>
  );
}

function GirisPageFallback() {
  return (
    <main className="min-h-screen bg-[#f3f3ef]">
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-5">
        <p className="text-sm text-black/45">Giriş ekranı yükleniyor...</p>
      </div>
    </main>
  );
}

function GirisPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = getAuthErrorMessage(searchParams.get("error"));
  const callbackUrl = searchParams.get("callbackUrl") || "/panel";
  const [social, setSocial] = useState({
    facebook: false,
    twitter: false,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function onEmailSignIn(event: FormEvent) {
    event.preventDefault();
    setEmailBusy(true);
    setEmailError(null);

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        setEmailError(
          result?.error === "CredentialsSignin"
            ? "E-posta veya şifre hatalı."
            : result?.error || "Giriş yapılamadı.",
        );
        return;
      }

      router.push(result.url || callbackUrl);
      router.refresh();
    } catch {
      setEmailError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setEmailBusy(false);
    }
  }

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
        /* anahtar yoksa butonlar kapalı kalır */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f3f3ef] text-[#151515]">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        {/* SOL — giriş */}
        <section className="relative flex min-h-screen flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12 xl:px-16">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-32 top-0 h-[380px] w-[380px] animate-[talepo-float_14s_ease-in-out_infinite] rounded-full bg-[#9ae89a]/35 blur-[100px]" />
            <div className="absolute right-0 top-40 h-72 w-72 animate-[talepo-float-alt_18s_ease-in-out_infinite] rounded-full bg-[#7ec8ff]/30 blur-[90px]" />
            <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-[#ffe08a]/25 blur-[90px]" />
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <Link
              href="/"
              aria-label="Talepo ana sayfa"
              className="flex w-fit items-center gap-2"
            >
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

          <div className="relative z-10 mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center py-12 lg:py-14">
            <div className="flex w-fit items-center gap-2 rounded-full border border-[#c4b5fd]/40 bg-gradient-to-r from-[#f3e8ff] to-[#e0f2fe] px-4 py-2 text-sm font-medium text-[#4c1d95]/80 shadow-sm">
              <Sparkles className="h-4 w-4 text-[#7c3aed]" />
              Tek hesap · alıcı ve firma
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-[2.75rem]">
              Devam etmek için{" "}
              <span className="bg-gradient-to-r from-teal-700 to-sky-600 bg-clip-text text-transparent">
                giriş yapın
              </span>
            </h1>

            <p className="mt-4 max-w-md text-base leading-7 text-black/50 sm:text-[17px]">
              Talebinizi oluşturun, teklifleri karşılaştırın veya firmanız için
              iş fırsatlarını görün — hepsi aynı hesapta.
            </p>

            {authError && (
              <div className="mt-6 flex items-start gap-3 rounded-[20px] border border-[#efb8b0] bg-[#fff1ee] px-4 py-4 text-sm leading-6 text-[#8b352b]">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Giriş başarısız</p>
                  <p className="mt-1">{authError}</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl })}
              className="group mt-7 flex min-h-[60px] w-full items-center justify-between rounded-[20px] border border-black/[0.08] bg-white px-4 shadow-[0_14px_45px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-teal-600/30 hover:shadow-[0_20px_60px_rgba(13,148,136,0.12)]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4285F4] via-[#34A853] to-[#FBBC05] p-[2px]">
                  <span className="flex h-full w-full items-center justify-center rounded-[14px] bg-white text-lg font-bold text-[#4285F4]">
                    G
                  </span>
                </span>
                <span className="text-left">
                  <span className="block font-semibold">
                    Google ile devam et
                  </span>
                  <span className="block text-xs text-black/40">
                    Tek hesapla paneline devam et
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-teal-700 transition group-hover:translate-x-1" />
            </button>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <SocialButton
                enabled={social.facebook}
                label="Facebook"
                icon={<FacebookMark />}
                onClick={() => signIn("facebook", { callbackUrl })}
              />
              <SocialButton
                enabled={social.twitter}
                label="X"
                icon={<XMark />}
                onClick={() => signIn("twitter", { callbackUrl })}
              />
            </div>
            {!social.facebook && !social.twitter && (
              <p className="mt-2 text-center text-[11px] text-black/35">
                Facebook ve X girişi için uygulama anahtarları eklenince açılır
              </p>
            )}

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
              <span className="text-xs font-medium text-black/35">
                veya e-posta ile
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
            </div>

            <form className="space-y-3" onSubmit={onEmailSignIn}>
              <label htmlFor="email" className="sr-only">
                E-posta adresi
              </label>
              <div className="rounded-[20px] border border-black/[0.08] bg-white p-2 shadow-[0_12px_35px_rgba(0,0,0,0.035)] transition focus-within:border-teal-600/35 focus-within:shadow-[0_16px_50px_rgba(13,148,136,0.1)]">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-posta adresiniz"
                  className="h-12 w-full rounded-2xl bg-transparent px-3 text-base outline-none placeholder:text-black/25"
                />
              </div>
              <label htmlFor="password" className="sr-only">
                Şifre
              </label>
              <div className="rounded-[20px] border border-black/[0.08] bg-white p-2 shadow-[0_12px_35px_rgba(0,0,0,0.035)] transition focus-within:border-teal-600/35 focus-within:shadow-[0_16px_50px_rgba(13,148,136,0.1)]">
                <PasswordInput
                  id="password"
                  name="password"
                  required
                  minLength={8}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifreniz"
                  wrapClassName="relative"
                  inputClassName="h-12 w-full rounded-2xl bg-transparent px-3 pr-12 text-base outline-none placeholder:text-black/25"
                />
              </div>
              {(emailError || authError) && (
                <p className="text-sm text-[#8b352b]">
                  {emailError || authError}
                </p>
              )}
              <button
                type="submit"
                disabled={emailBusy}
                className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[20px] bg-[#151515] font-medium text-white transition hover:bg-black disabled:opacity-60"
              >
                {emailBusy ? "Giriş yapılıyor…" : "E-posta ile giriş yap"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-center text-[11px] text-black/35">
                Hesabınız yok mu?{" "}
                <Link
                  href="/kayit"
                  className="font-semibold text-teal-800 hover:text-teal-950"
                >
                  Ücretsiz kayıt olun
                </Link>
              </p>
            </form>

            <div className="mt-6 rounded-[22px] border border-emerald-200/60 bg-gradient-to-br from-[#ecfdf5] to-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-950">
                    Güvenli ve hızlı giriş
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-900/55">
                    Bilgileriniz paylaşılmaz. Tek oturumla hem alıcı hem firma
                    tarafını yönetebilirsiniz.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-xs leading-5 text-black/35">
              Devam ederek Talepo’nun{" "}
              <Link
                href="/kullanim-kosullari"
                className="font-medium text-teal-800 transition hover:text-teal-950"
              >
                kullanım koşullarını
              </Link>{" "}
              ve{" "}
              <Link
                href="/gizlilik-politikasi"
                className="font-medium text-teal-800 transition hover:text-teal-950"
              >
                gizlilik politikasını
              </Link>{" "}
              kabul etmiş olursunuz.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pb-1 text-xs text-black/35">
            <span className="flex items-center gap-2">
              <LockKeyhole className="h-3.5 w-3.5 text-teal-700" />
              Güvenli giriş
            </span>
            <span className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Tek hesap
            </span>
            <span className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-sky-600" />
              Alıcı + firma
            </span>
          </div>
        </section>

        {/* SAĞ — nasıl çalışır */}
        <section className="relative hidden min-h-screen overflow-hidden p-5 lg:block xl:p-7">
          <div className="absolute inset-5 overflow-hidden rounded-[38px] bg-gradient-to-br from-[#0f766e] via-[#0c4a6e] to-[#172554] shadow-[0_35px_110px_rgba(15,118,110,0.28)] xl:inset-7">
            <div className="pointer-events-none absolute -right-28 -top-28 h-[420px] w-[420px] animate-[talepo-float_16s_ease-in-out_infinite] rounded-full bg-[#5eead4]/25 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-36 -left-20 h-[460px] w-[460px] animate-[talepo-float-alt_20s_ease-in-out_infinite] rounded-full bg-[#38bdf8]/20 blur-[110px]" />
            <div className="pointer-events-none absolute left-[45%] top-[30%] h-72 w-72 rounded-full bg-[#fde68a]/15 blur-[90px]" />

            <div className="relative z-10 flex h-full flex-col p-8 text-white xl:p-11">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm backdrop-blur-md">
                  <Sparkles className="h-4 w-4 text-amber-200" />
                  3 adımda netleşir
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/55">
                  Talep → Eşleşme → Teklif
                </div>
              </div>

              <div className="my-auto">
                <h2 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.05em] xl:text-[3.25rem]">
                  İhtiyacınızı anlatın.
                  <span className="mt-2 block text-teal-100/70">
                    Talepo doğru firmayı bulsun.
                  </span>
                </h2>

                <p className="mt-5 max-w-lg text-base leading-7 text-white/60 xl:text-lg">
                  Yazın, AI özetlesin, uygun firmalar teklif versin. Karmaşık
                  form yok — net bir satın alma akışı.
                </p>

                <div className="mt-9 grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
                  <div className="space-y-3">
                    <StepCard
                      step="1"
                      icon={PackageSearch}
                      title="Talebinizi yazın"
                      description="Ne aradığınızı birkaç cümleyle anlatın."
                      tone="bg-emerald-300"
                    />
                    <StepCard
                      step="2"
                      icon={WandSparkles}
                      title="AI özetlesin"
                      description="Kategori, adet ve konum otomatik çıkarılır."
                      tone="bg-sky-300"
                    />
                    <StepCard
                      step="3"
                      icon={Store}
                      title="Teklifleri karşılaştırın"
                      description="Uygun firmalar size ulaşır, siz seçersiniz."
                      tone="bg-amber-300"
                    />
                  </div>

                  <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-100/60">
                          Canlı örnek
                        </p>
                        <p className="mt-1.5 text-lg font-semibold">
                          Talep özeti hazır
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 to-emerald-200 text-teal-950">
                        <CircleCheck className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4">
                      <p className="text-xs text-white/40">Örnek talep</p>
                      <p className="mt-2 text-[15px] leading-7 text-white/90">
                        “5.000 adet özel baskılı karton kutu yaptırmak
                        istiyorum.”
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <DetectedItem
                        label="Kategori"
                        value="Matbaa"
                        color="bg-emerald-100 text-emerald-900"
                      />
                      <DetectedItem
                        label="Ürün"
                        value="Karton kutu"
                        color="bg-sky-100 text-sky-900"
                      />
                      <DetectedItem
                        label="Adet"
                        value="5.000"
                        color="bg-amber-100 text-amber-950"
                      />
                      <DetectedItem
                        label="Konum"
                        value="İstanbul"
                        color="bg-violet-100 text-violet-900"
                      />
                    </div>

                    <div className="mt-4 rounded-[18px] bg-gradient-to-r from-[#ecfdf5] via-[#e0f2fe] to-[#fef3c7] p-4 text-[#0f172a]">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                          <BriefcaseBusiness className="h-4 w-4 text-teal-700" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-teal-800">
                            Tahmini aralık
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            ₺42.000 – ₺58.000
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-black/50">
                            <Clock3 className="h-3.5 w-3.5" />
                            Ortalama teslim: 8–12 gün · 12 firma eşleşti
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-white/40">
                <span>Talepo © 2026</span>
                <span>İhtiyaçtan doğru teklife.</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SocialButton({
  enabled,
  label,
  icon,
  onClick,
}: {
  enabled: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        title={`${label} girişi için .env anahtarları gerekli`}
        className="flex h-12 cursor-not-allowed items-center justify-center gap-2.5 rounded-[17px] border border-black/[0.06] bg-white/60 text-sm font-medium text-black/30"
      >
        {icon}
        {label}
        <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10px]">
          Yakında
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-12 items-center justify-center gap-2.5 rounded-[17px] border border-black/[0.07] bg-white text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
    >
      {icon}
      {label}
    </button>
  );
}

function FacebookMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden="true"
      fill="#1877F2"
    >
      <path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.4V9.84c0-2.37 1.4-3.69 3.56-3.69 1.03 0 2.11.19 2.11.19v2.33h-1.19c-1.17 0-1.54.73-1.54 1.48v1.78h2.62l-.42 2.91h-2.2V22c4.78-.75 8.44-4.91 8.44-9.93Z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

function StepCard({
  step,
  icon: Icon,
  title,
  description,
  tone,
}: {
  step: string;
  icon: typeof PackageSearch;
  title: string;
  description: string;
  tone: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur-md transition hover:bg-white/[0.14]">
      <div className="flex items-start gap-3.5">
        <div
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone} text-teal-950`}
        >
          <Icon className="h-5 w-5" />
          <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-teal-900 shadow">
            {step}
          </span>
        </div>
        <div>
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-white/55">{description}</p>
        </div>
      </div>
    </div>
  );
}

function DetectedItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`rounded-2xl px-3 py-3 ${color}`}>
      <p className="text-[11px] opacity-60">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
