import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { REQUEST_CATEGORIES } from "@/lib/request-category-engine";
import { getCategoryVisual } from "@/lib/visuals/category-visuals";

/** Homepage grid: popular marketplace categories with photo cards. */
const HOME_CATEGORY_SLUGS = [
  "real-estate",
  "furniture",
  "automotive",
  "printing",
  "technology",
  "appliances",
  "home-kitchen",
  "machinery",
  "health",
  "baby",
  "services",
] as const;

export function PopularCategories() {
  const categories = HOME_CATEGORY_SLUGS.map((slug) => {
    const meta = REQUEST_CATEGORIES.find((c) => c.id === slug);
    const look = getCategoryVisual(slug);
    return {
      slug,
      label: meta?.label ?? slug,
      description: meta?.description ?? "Talep oluştur",
      image: look.image,
      Icon: look.icon,
      thumb: look.thumb,
      iconTone: look.iconTone,
    };
  });

  return (
    <section
      id="kategoriler"
      className="border-b border-teal-900/8 bg-[#f4f7f6] px-5 py-14 sm:px-6 lg:px-8 lg:py-16"
      aria-labelledby="popular-categories-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-teal-800/50">Kategoriler</p>
            <h2
              id="popular-categories-heading"
              className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#0f1f1d] sm:text-3xl"
            >
              Popüler kategoriler
            </h2>
            <p className="mt-2 text-sm leading-6 text-teal-950/50">
              İhtiyacınıza uygun alanı seçin; talebinizi yazıp teklif toplamaya
              başlayın.
            </p>
          </div>
          <Link
            href="/talep"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0f766e] transition hover:text-[#115e59]"
          >
            Tüm talepler
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/talep?category=${encodeURIComponent(category.slug)}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-teal-900/8 bg-white shadow-[0_10px_28px_rgba(15,31,29,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,31,29,0.08)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#e8f0ee]">
                  {category.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={category.image}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div
                      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${category.thumb}`}
                      aria-hidden
                    >
                      <category.Icon
                        className={`h-10 w-10 ${category.iconTone}`}
                        strokeWidth={1.5}
                      />
                    </div>
                  )}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent"
                  />
                </div>
                <div className="flex flex-1 flex-col px-3.5 py-3.5 sm:px-4 sm:py-4">
                  <h3 className="text-[15px] font-semibold tracking-tight text-[#0f766e] sm:text-base">
                    {category.label}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-teal-950/45 sm:text-[13px]">
                    Talep oluştur
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
