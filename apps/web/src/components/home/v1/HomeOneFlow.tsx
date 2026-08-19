import Link from "next/link";
import { ArrowRight } from "lucide-react";

const STORIES = [
  {
    id: "write",
    title: "Yazın.",
    body: "Ne lazım, nerede, kaç adet — günlük dille yazmanız yeter. Form yok, uzun kayıt yok.",
    tone: "light" as const,
  },
  {
    id: "compare",
    title: "Karşılaştırın.",
    body: "Uygun firmalar fiyat ve süre sunar. Teklifleri yan yana görür, baskı hissetmeden incelersiniz.",
    tone: "dark" as const,
  },
  {
    id: "choose",
    title: "Seçin.",
    body: "Beğendiğiniz teklifi kabul edince mesajlaşmaya geçersiniz. Öncesinde iletişim bilgileriniz gizli kalır.",
    tone: "light" as const,
  },
];

export function HomeOneFlow() {
  return (
    <section id="nasil" aria-label="Nasıl çalışır">
      <div className="border-b border-teal-900/8 bg-white px-5 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[76rem] text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-teal-800/42">
            Nasıl çalışır
          </p>
          <h2 className="talepo-home1-section-title mt-4 font-semibold text-[#0f1f1d]">
            Üç adım. Tek akış.
          </h2>
        </div>
      </div>

      {STORIES.map((story, index) => (
        <article
          key={story.id}
          className={
            story.tone === "dark"
              ? "relative bg-[#070c0b] px-5 py-24 text-white sm:px-6 sm:py-28 lg:px-8 lg:py-32"
              : "relative bg-[#f4f7f6] px-5 py-24 sm:px-6 sm:py-28 lg:px-8 lg:py-32"
          }
        >
          <div className="mx-auto grid max-w-[76rem] items-end gap-10 lg:grid-cols-12 lg:gap-12">
            <div className={`lg:col-span-7 ${index % 2 === 1 ? "lg:order-2 lg:col-start-6" : ""}`}>
              <h3
                className={`mt-5 text-[clamp(2.75rem,6vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.055em] ${
                  story.tone === "dark" ? "text-white" : "text-[#0f1f1d]"
                }`}
              >
                {story.title}
              </h3>
            </div>
            <div
              className={`lg:col-span-5 ${index % 2 === 1 ? "lg:order-1 lg:col-start-1 lg:row-start-1" : ""}`}
            >
              <p
                className={`max-w-md text-[17px] leading-8 sm:text-[18px] sm:leading-9 ${
                  story.tone === "dark" ? "text-white/50" : "text-teal-950/48"
                }`}
              >
                {story.body}
              </p>
              {index === STORIES.length - 1 ? (
                <Link
                  href="/talep"
                  className={`mt-8 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    story.tone === "dark"
                      ? "bg-white text-[#0f1f1d] hover:bg-[#f4f7f6]"
                      : "bg-[#0f1f1d] text-white hover:bg-[#162826]"
                  }`}
                >
                  Talep yazmaya başla
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

export function HomeOneAudience() {
  return (
    <section
      id="saticilar"
      className="bg-white px-5 py-24 sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-[76rem]">
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.22em] text-teal-800/42">
          Kimler için
        </p>
        <div className="mt-12 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <article className="rounded-[1.75rem] bg-[#f4f7f6] p-9 sm:p-11 lg:p-12">
            <p className="text-sm font-medium text-teal-800/42">Alıcı</p>
            <h3 className="mt-4 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-[#0f1f1d]">
              Bir şeye ihtiyacınız var.
            </h3>
            <p className="mt-4 max-w-md text-[16px] leading-8 text-teal-950/48">
              Yazın, teklifleri toplayın, birini seçin. Talep oluşturmak ücretsizdir.
            </p>
            <Link
              href="/talep"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#0f1f1d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#162826]"
            >
              Talep oluştur
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>

          <article className="flex flex-col justify-between rounded-[1.75rem] bg-[#0f1f1d] p-9 text-white sm:p-11 lg:p-12">
            <div>
              <p className="text-sm font-medium text-teal-200/42">Satıcı</p>
              <h3 className="mt-4 text-[clamp(1.75rem,3vw,2.35rem)] font-semibold leading-[1.08] tracking-[-0.04em]">
                Gerçek taleplere teklif verin.
              </h3>
              <p className="mt-4 text-[16px] leading-8 text-white/48">
                Açık talepleri keşfedin; alıcı kabul edince mesajlaşmaya geçin.
              </p>
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/talepler"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0f1f1d] transition hover:bg-[#f4f7f6]"
              >
                Talepleri gör
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#planlar"
                className="inline-flex items-center gap-2 rounded-full border border-white/14 px-5 py-3 text-sm font-medium text-white/78 transition hover:bg-white/5"
              >
                Planlar
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
