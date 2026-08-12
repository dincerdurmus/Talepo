import Link from "next/link";

/**
 * Host page for iyzico Checkout Form when paymentPageUrl is unavailable.
 * Token query is for UX only — never activates plan/credits.
 */
export default async function PlanOdemePage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const token = params?.token;

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-black/85">
        Güvenli ödeme
      </h1>
      <p className="mt-3 text-sm leading-6 text-black/50">
        Kart bilgileriniz iyzico üzerinde işlenir. Talepo kart verisi tutmaz.
        Ödeme sonrası plan hakları doğrulanmış webhook ile açılır.
      </p>
      {!token ? (
        <p className="mt-6 text-sm text-black/45">
          Ödeme oturumu bulunamadı.{" "}
          <Link href="/panel/plan" className="underline">
            Plan sayfasına dön
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-sm text-black/45">
          Form Plan sayfasından açılmadıysa checkout’u yeniden başlatın.
          Token: {token.slice(0, 8)}…
        </p>
      )}
      <div id="iyzipay-checkout-form" className="responsive mt-8" />
      <p className="mt-8 text-xs text-black/35">
        <Link href="/panel/plan?billing=pending">Ödeme durumunu kontrol et</Link>
      </p>
    </section>
  );
}
