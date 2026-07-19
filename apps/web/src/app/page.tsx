const featuredRequests = [
  {
    title: "İstanbul’da 50 adet ofis sandalyesi",
    category: "Ofis Mobilyaları",
    location: "İstanbul",
    budget: "₺150.000",
    offers: 8,
  },
  {
    title: "Kurumsal web sitesi tasarımı",
    category: "Yazılım ve Tasarım",
    location: "Türkiye Geneli",
    budget: "₺80.000",
    offers: 14,
  },
  {
    title: "500 adet özel baskılı karton kutu",
    category: "Matbaa ve Ambalaj",
    location: "İstanbul",
    budget: "₺45.000",
    offers: 6,
  },
];

const categories = [
  "Otomotiv",
  "Matbaa ve Ambalaj",
  "Makine",
  "Teknoloji",
  "Ev ve Yaşam",
  "Hizmetler",
];

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-4.35-4.35m1.1-5.4a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12h14m-6-6 6 6-6 6"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f8f6] text-[#171717]">
      <header className="border-b border-black/5 bg-[#f8f8f6]/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          <a
            href="#"
            className="text-2xl font-semibold tracking-[-0.04em]"
            aria-label="Talepo ana sayfa"
          >
            Talepo
          </a>

          <nav className="hidden items-center gap-8 text-sm text-black/65 md:flex">
            <a className="transition hover:text-black" href="#talepler">
              Talepler
            </a>
            <a className="transition hover:text-black" href="#nasil-calisir">
              Nasıl çalışır?
            </a>
            <a className="transition hover:text-black" href="#kurumsal">
              Kurumsal
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button className="hidden rounded-full px-5 py-2.5 text-sm font-medium transition hover:bg-black/5 sm:block">
              Giriş yap
            </button>

            <button className="rounded-full bg-[#171717] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black">
              Ücretsiz başla
            </button>
          </div>
        </div>
      </header>

      <section className="px-6 pb-24 pt-20 lg:px-8 lg:pb-32 lg:pt-28">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-7 w-fit rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black/60 shadow-sm">
            Aradığınız ürün veya hizmeti sizin için bulur
          </div>

          <h1 className="text-balance text-5xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            Bugün ne arıyorsunuz?
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-8 text-black/55 sm:text-xl">
            Talebinizi anlatın. Talepo önce mevcut seçenekleri bulmaya çalışır,
            bulamazsa talebinizi doğru satıcılara ulaştırır.
          </p>

          <form
            className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 rounded-[28px] border border-black/10 bg-white p-3 shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:flex-row"
            action="#"
          >
            <label className="flex min-h-16 flex-1 items-center gap-3 px-4">
              <SearchIcon />
              <span className="sr-only">Aradığınız ürün veya hizmet</span>
              <input
                className="w-full bg-transparent text-base outline-none placeholder:text-black/35 sm:text-lg"
                placeholder="Örneğin: 500 adet baskılı karton kutu arıyorum"
                type="text"
              />
            </label>

            <button
              className="flex min-h-14 items-center justify-center gap-2 rounded-[20px] bg-[#171717] px-7 font-medium text-white transition hover:bg-black"
              type="submit"
            >
              Talep oluştur
              <ArrowIcon />
            </button>
          </form>

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <button
                key={category}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black/55 transition hover:border-black/20 hover:text-black"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-black/5 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-black/5 px-6 lg:grid-cols-4 lg:px-8">
          {[
            ["12.840+", "Yayınlanan talep"],
            ["4.250+", "Doğrulanmış satıcı"],
            ["38.600+", "Gönderilen teklif"],
            ["81", "Aktif kategori"],
          ].map(([number, label]) => (
            <div
              key={label}
              className="bg-white px-4 py-9 text-center sm:px-8"
            >
              <div className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {number}
              </div>
              <div className="mt-2 text-sm text-black/45">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="talepler"
        className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32"
      >
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-black/45">Güncel fırsatlar</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Öne çıkan talepler
            </h2>
          </div>

          <a
            className="flex items-center gap-2 text-sm font-medium"
            href="#talepler"
          >
            Tüm talepleri görüntüle
            <ArrowIcon />
          </a>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {featuredRequests.map((request) => (
            <article
              key={request.title}
              className="group rounded-[28px] border border-black/8 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#f1f1ee] px-3 py-1.5 text-xs font-medium text-black/55">
                  {request.category}
                </span>

                <span className="text-xs text-black/40">
                  {request.offers} teklif
                </span>
              </div>

              <h3 className="mt-8 min-h-16 text-xl font-semibold leading-7 tracking-[-0.025em]">
                {request.title}
              </h3>

              <div className="mt-8 flex items-end justify-between border-t border-black/7 pt-5">
                <div>
                  <p className="text-xs text-black/40">Tahmini bütçe</p>
                  <p className="mt-1 font-semibold">{request.budget}</p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-black/40">Konum</p>
                  <p className="mt-1 text-sm">{request.location}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="nasil-calisir"
        className="border-y border-black/5 bg-[#171717] px-6 py-24 text-white lg:px-8 lg:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-white/45">Basit ve hızlı</p>

          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Siz ne aradığınızı söyleyin. Gerisini Talepo yönetsin.
          </h2>

          <div className="mt-14 grid gap-10 lg:grid-cols-3">
            {[
              [
                "01",
                "İhtiyacınızı anlatın",
                "Ürün, hizmet, bütçe ve teslimat beklentinizi birkaç cümleyle belirtin.",
              ],
              [
                "02",
                "Talepo seçenekleri bulsun",
                "Sistem önce özel envanterleri ve uygun satıcıları tarar.",
              ],
              [
                "03",
                "Teklifleri karşılaştırın",
                "Fiyat, teslimat ve satıcı bilgilerini tek ekranda değerlendirin.",
              ],
            ].map(([number, title, description]) => (
              <div key={number} className="border-t border-white/15 pt-6">
                <span className="text-sm text-white/35">{number}</span>
                <h3 className="mt-7 text-xl font-semibold">{title}</h3>
                <p className="mt-4 max-w-sm leading-7 text-white/55">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="kurumsal"
        className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32"
      >
        <div className="overflow-hidden rounded-[36px] bg-[#e8eadf] px-7 py-12 sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-black/45">
              Satıcılar ve işletmeler için
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Yeni müşterileri aramayın. Talepler size gelsin.
            </h2>

            <p className="mt-5 max-w-xl leading-7 text-black/55">
              Firmanızı oluşturun, özel envanterinizi ekleyin ve size uygun
              satın alma taleplerini tek merkezden yönetin.
            </p>
          </div>

          <button className="mt-8 flex items-center gap-2 rounded-full bg-[#171717] px-6 py-3.5 font-medium text-white transition hover:bg-black lg:mt-0">
            Kurumsal hesabı keşfet
            <ArrowIcon />
          </button>
        </div>
      </section>

      <footer className="border-t border-black/5 px-6 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-black/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Talepo. Tüm hakları saklıdır.</p>

          <div className="flex gap-6">
            <a className="transition hover:text-black" href="#">
              Gizlilik
            </a>
            <a className="transition hover:text-black" href="#">
              Koşullar
            </a>
            <a className="transition hover:text-black" href="#">
              İletişim
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}