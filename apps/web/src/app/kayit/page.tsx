"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

import { COMPANY_DRAFT_STORAGE_KEY } from "@/components/panel/CompanyCreateForm";

type AccountType = "buyer" | "seller" | "both";

const SECTOR_TO_CATEGORY: Record<string, string> = {
  printing: "printing",
  technology: "technology",
  automotive: "automotive",
  machine: "machinery",
  construction: "services",
  food: "services",
  textile: "services",
  service: "services",
  other: "services",
};

export default function KayitPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("buyer");
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const showCompanyFields =
    accountType === "seller" || accountType === "both";

  function persistCompanyDraft() {
    if (!showCompanyFields) {
      try {
        sessionStorage.removeItem(COMPANY_DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }

    const categorySlug = SECTOR_TO_CATEGORY[sector];

    try {
      sessionStorage.setItem(
        COMPANY_DRAFT_STORAGE_KEY,
        JSON.stringify({
          name: companyName.trim(),
          city: city.trim(),
          taxNumber: taxNumber.trim(),
          sector,
          categorySlugs: categorySlug ? [categorySlug] : [],
        }),
      );
    } catch {
      // ignore
    }
  }

  function startGoogleSignIn() {
    persistCompanyDraft();
    const callbackUrl = showCompanyFields ? "/panel/firma/yeni" : "/panel";
    void signIn("google", { callbackUrl });
  }

  async function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setHint(null);
    persistCompanyDraft();

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
        callbackUrl: showCompanyFields ? "/panel/firma/yeni" : "/panel",
      });

      if (!result || result.error) {
        setHint(
          "Hesap oluşturuldu ancak giriş yapılamadı. /giris sayfasından deneyin.",
        );
        return;
      }

      router.push(result.url || (showCompanyFields ? "/panel/firma/yeni" : "/panel"));
      router.refresh();
    } catch {
      setHint("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f8f6] text-[#171717] lg:flex">
      <section className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-3/5 lg:px-16">
        <Link href="/" className="flex w-fit items-center gap-2">
          <span className="text-2xl font-bold tracking-[-0.06em]">
            tale<span className="text-black/45">po</span>
          </span>

          <span className="rounded-full border border-black/10 bg-white px-2 py-1 text-[9px] font-semibold tracking-[0.16em] text-black/45">
            BETA
          </span>
        </Link>

        <div className="mx-auto w-full max-w-xl py-14">
          <p className="text-sm font-medium text-black/45">
            Talepo&apos;ya katılın
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">
            Ücretsiz hesabınızı oluşturun
          </h1>

          <p className="mt-4 leading-7 text-black/50">
            İhtiyaçlarınızı yayınlayın, doğru satıcıları bulun ve teklifleri tek
            merkezden yönetin.
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={startGoogleSignIn}
              className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white font-medium transition hover:border-black/20"
            >
              Google
            </button>

            <button
              type="button"
              disabled
              title="Facebook girişi için .env anahtarları gerekli"
              className="flex h-14 cursor-not-allowed items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white/70 font-medium text-black/30"
            >
              Facebook
            </button>

            <button
              type="button"
              disabled
              title="X girişi için .env anahtarları gerekli"
              className="flex h-14 cursor-not-allowed items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white/70 font-medium text-black/30"
            >
              X
            </button>
          </div>

          {showCompanyFields && (
            <p className="mt-4 text-xs leading-5 text-black/40">
              Satıcı hesabında kayıt veya Google sonrası firma oluşturma
              adımına yönlendirilirsiniz. Aşağıdaki firma alanları o adımda
              önceden doldurulur.
            </p>
          )}

          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-black/10"></div>

            <span className="text-xs text-black/35">
              veya e-posta ile kayıt olun
            </span>

            <div className="h-px flex-1 bg-black/10"></div>
          </div>

          <form className="space-y-6" onSubmit={onEmailSubmit}>
            <fieldset>
              <legend className="mb-3 text-sm font-medium">
                Talepo&apos;da ne yapmak istiyorsunuz?
              </legend>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setAccountType("buyer")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    accountType === "buyer"
                      ? "border-black bg-[#171717] text-white"
                      : "border-black/10 bg-white"
                  }`}
                >
                  <div className="font-semibold">Alıcı</div>
                  <div className="mt-1 text-xs opacity-70">
                    Ürün veya hizmet arıyorum
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType("seller")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    accountType === "seller"
                      ? "border-black bg-[#171717] text-white"
                      : "border-black/10 bg-white"
                  }`}
                >
                  <div className="font-semibold">Satıcı</div>
                  <div className="mt-1 text-xs opacity-70">
                    Ürün veya hizmet satıyorum
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType("both")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    accountType === "both"
                      ? "border-black bg-[#171717] text-white"
                      : "border-black/10 bg-white"
                  }`}
                >
                  <div className="font-semibold">Her İkisi</div>
                  <div className="mt-1 text-xs opacity-70">
                    Hem alıyor hem satıyorum
                  </div>
                </button>
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
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
                  className="h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none transition placeholder:text-black/30 focus:border-black/35 focus:ring-4 focus:ring-black/5"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-medium"
                >
                  Telefon numarası
                </label>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="05XX XXX XX XX"
                  required
                  className="h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none transition placeholder:text-black/30 focus:border-black/35 focus:ring-4 focus:ring-black/5"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                E-posta adresi
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="ornek@firma.com"
                required
                className="h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none transition placeholder:text-black/30 focus:border-black/35 focus:ring-4 focus:ring-black/5"
              />
            </div>

            {showCompanyFields && (
              <div className="rounded-[24px] border border-black/10 bg-white p-5">
                <p className="mb-5 text-sm font-semibold">Firma bilgileri</p>

                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="companyName"
                      className="mb-2 block text-sm font-medium"
                    >
                      Firma adı
                    </label>

                    <input
                      id="companyName"
                      name="companyName"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Firma adınız"
                      required={showCompanyFields}
                      className="h-14 w-full rounded-2xl border border-black/10 bg-[#f8f8f6] px-4 outline-none transition placeholder:text-black/30 focus:border-black/35 focus:ring-4 focus:ring-black/5"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="sector"
                        className="mb-2 block text-sm font-medium"
                      >
                        Sektör
                      </label>

                      <select
                        id="sector"
                        name="sector"
                        required={showCompanyFields}
                        value={sector}
                        onChange={(e) => setSector(e.target.value)}
                        className="h-14 w-full rounded-2xl border border-black/10 bg-[#f8f8f6] px-4 outline-none transition focus:border-black/35 focus:ring-4 focus:ring-black/5"
                      >
                        <option value="" disabled>
                          Sektör seçin
                        </option>
                        <option value="printing">Matbaa ve Ambalaj</option>
                        <option value="technology">Teknoloji</option>
                        <option value="automotive">Otomotiv</option>
                        <option value="machine">Makine ve Sanayi</option>
                        <option value="construction">İnşaat ve Yapı</option>
                        <option value="food">Gıda</option>
                        <option value="textile">Tekstil</option>
                        <option value="service">Hizmetler</option>
                        <option value="other">Diğer</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="city"
                        className="mb-2 block text-sm font-medium"
                      >
                        Şehir
                      </label>

                      <input
                        id="city"
                        name="city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Örneğin İstanbul"
                        required={showCompanyFields}
                        className="h-14 w-full rounded-2xl border border-black/10 bg-[#f8f8f6] px-4 outline-none transition placeholder:text-black/30 focus:border-black/35 focus:ring-4 focus:ring-black/5"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="taxNumber"
                      className="mb-2 block text-sm font-medium"
                    >
                      Vergi numarası{" "}
                      <span className="font-normal text-black/35">
                        (isteğe bağlı)
                      </span>
                    </label>

                    <input
                      id="taxNumber"
                      name="taxNumber"
                      type="text"
                      inputMode="numeric"
                      value={taxNumber}
                      onChange={(e) => setTaxNumber(e.target.value)}
                      placeholder="Vergi numaranız"
                      className="h-14 w-full rounded-2xl border border-black/10 bg-[#f8f8f6] px-4 outline-none transition placeholder:text-black/30 focus:border-black/35 focus:ring-4 focus:ring-black/5"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium"
                >
                  Şifre
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="En az 8 karakter"
                  minLength={8}
                  required
                  className="h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none transition placeholder:text-black/30 focus:border-black/35 focus:ring-4 focus:ring-black/5"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium"
                >
                  Şifre tekrar
                </label>

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Şifrenizi tekrar girin"
                  minLength={8}
                  required
                  className="h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none transition placeholder:text-black/30 focus:border-black/35 focus:ring-4 focus:ring-black/5"
                />
              </div>
            </div>

            <p className="-mt-2 text-xs text-black/40">
              Şifreniz en az 8 karakter olmalıdır.
            </p>

            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-black/55">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="mt-1 h-4 w-4 rounded border-black/20 accent-black"
              />

              <span>
                <Link
                  href="/kullanim-kosullari"
                  className="font-medium text-black hover:underline"
                >
                  Kullanım koşullarını
                </Link>{" "}
                ve{" "}
                <Link
                  href="/gizlilik-politikasi"
                  className="font-medium text-black hover:underline"
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
              className="h-14 w-full rounded-2xl bg-[#171717] font-medium text-white transition hover:bg-black disabled:opacity-60"
            >
              {busy ? "Hesap oluşturuluyor…" : "Hesap oluştur"}
            </button>

            {showCompanyFields && (
              <button
                type="button"
                onClick={startGoogleSignIn}
                className="h-12 w-full rounded-2xl border border-black/10 bg-white text-sm font-medium transition hover:border-black/20"
              >
                Google ile devam et ve firmayı oluştur
              </button>
            )}
          </form>

          <p className="mt-8 text-center text-sm text-black/45">
            Zaten hesabınız var mı?{" "}
            <Link
              href="/giris"
              className="font-medium text-black transition hover:opacity-60"
            >
              Giriş yapın
            </Link>
          </p>
        </div>
      </section>
      <section className="relative hidden min-h-screen w-2/5 overflow-hidden bg-[#171717] p-12 text-white lg:flex">
        <div className="relative z-10 flex w-full flex-col justify-between">
          <div>
            <p className="text-sm text-white/45">Talepo İş Ağı</p>

            <h2 className="mt-6 text-5xl font-semibold leading-tight tracking-[-0.04em]">
              İhtiyacınızı paylaşın,
              <br />
              doğru satıcılar sizi bulsun.
            </h2>

            <p className="mt-6 max-w-md text-base leading-7 text-white/60">
              Talepo; alıcılarla satıcıları güvenli, hızlı ve şeffaf şekilde
              buluşturan yeni nesil B2B platformudur.
            </p>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm text-white/50">Ortalama teklif süresi</p>
              <p className="mt-2 text-3xl font-bold">&lt; 24 Saat</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm text-white/50">Binlerce tedarikçi</p>
              <p className="mt-2 text-3xl font-bold">Türkiye Geneli</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm text-white/50">Güvenli teklif sistemi</p>
              <p className="mt-2 text-3xl font-bold">%100 Şeffaf</p>
            </div>
          </div>
        </div>

        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full border border-white/10" />
      </section>
    </main>
  );
}
