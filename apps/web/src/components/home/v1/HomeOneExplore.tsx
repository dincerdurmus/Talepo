import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { REQUEST_CATEGORIES } from "@/lib/request-category-engine";
import { getCategoryVisual } from "@/lib/visuals/category-visuals";

/** Homepage-optimized WebP covers (1280px); panel routes keep canonical PNG. */
function homeCategoryImage(slug: string) {
  return `/categories/home/${slug}.webp`;
}

const SPOTLIGHT = "real-estate";

const GRID_PRIMARY = [
  { slug: "furniture", tag: "Ofis · ev · toplu alım" },
  { slug: "technology", tag: "Donanım · yazılım · IT" },
  { slug: "automotive", tag: "Araç · parça · filo" },
] as const;

const GRID_SECONDARY = [
  { slug: "printing", tag: "Baskı · ambalaj" },
  { slug: "appliances", tag: "Beyaz eşya · klima" },
] as const;

const MORE = ["home-kitchen", "machinery", "health", "baby", "services"] as const;

const CINEMATIC_CROP: Record<string, string> = {
  "real-estate": "object-[center_38%]",
  furniture: "object-[center_42%]",
  technology: "object-[center_35%]",
  automotive: "object-[center_40%]",
  printing: "object-[center_45%]",
  appliances: "object-[center_38%]",
  "home-kitchen": "object-[center_40%]",
  machinery: "object-[center_42%]",
  health: "object-[center_36%]",
  baby: "object-[center_44%]",
  services: "object-[center_40%]",
};

function meta(slug: string) {
  const row = REQUEST_CATEGORIES.find((c) => c.id === slug);
  const look = getCategoryVisual(slug);
  return {
    slug,
    label: row?.label ?? slug,
    description: row?.description ?? "",
    image: look.image,
    Icon: look.icon,
    thumb: look.thumb,
    iconTone: look.iconTone,
  };
}

function CategoryImage({
  slug,
  className = "",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: {
  slug: string;
  className?: string;
  sizes?: string;
}) {
  const cat = meta(slug);
  const crop = CINEMATIC_CROP[slug] ?? "object-center";
  if (cat.image) {
    return (
      <Image
        src={homeCategoryImage(slug)}
        alt=""
        fill
        sizes={sizes}
        className={`scale-[1.08] object-cover ${crop} ${className}`}
      />
    );
  }
  return (
    <div className={`flex h-full items-center justify-center bg-gradient-to-br ${cat.thumb}`}>
      <cat.Icon className={`h-12 w-12 opacity-30 ${cat.iconTone}`} strokeWidth={1.25} />
    </div>
  );
}

export function HomeOneExplore() {
  const spotlight = meta(SPOTLIGHT);
  const more = MORE.map(meta);

  return (
    <section
      id="kategoriler"
      className="bg-white px-5 py-24 sm:px-6 lg:px-8 lg:py-32"
      aria-labelledby="home-one-explore-heading"
    >
      <div className="mx-auto max-w-[76rem]">
        <div className="mx-auto max-w-3xl text-center lg:text-left">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-teal-800/42">
            Keşfet
          </p>
          <h2
            id="home-one-explore-heading"
            className="talepo-home1-section-title mt-5 font-semibold text-[#0f1f1d]"
          >
            Her kategori.
            <span className="block text-teal-800/50">Aynı sakin akış.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-8 text-teal-950/45 lg:mx-0">
            Kategori yalnızca yönlendirme içindir. Listede olmayan ürün ve
            hizmetler de talep olarak kabul edilir.
          </p>
        </div>

        <Link
          href={`/talep?category=${encodeURIComponent(SPOTLIGHT)}`}
          className="talepo-home1-card-hover group relative mt-14 block overflow-hidden rounded-[1.75rem] bg-[#0f1f1d] sm:mt-16"
        >
          <div className="relative aspect-[16/7] min-h-[240px] overflow-hidden sm:min-h-[320px] lg:min-h-[380px]">
            <CategoryImage
              slug={SPOTLIGHT}
              sizes="(max-width: 1024px) 100vw, 76rem"
              className="transition duration-[900ms] ease-out group-hover:scale-[1.02]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-[#070c0b]/82 via-[#070c0b]/35 to-transparent"
            />
            <div className="absolute inset-0 flex flex-col justify-end p-7 sm:p-10 lg:p-12">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/42">
                Öne çıkan
              </p>
              <h3 className="mt-3 max-w-lg text-[clamp(1.75rem,3vw,2.75rem)] font-semibold leading-[1.06] tracking-[-0.04em] text-white">
                {spotlight.label}
              </h3>
              <p className="mt-3 max-w-md text-[15px] leading-7 text-white/52">
                {spotlight.description}
              </p>
              <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0f1f1d] transition group-hover:bg-[#f4f7f6]">
                Talep yaz
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </Link>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GRID_PRIMARY.map(({ slug, tag }) => {
            const cat = meta(slug);
            return (
              <Link
                key={slug}
                href={`/talep?category=${encodeURIComponent(slug)}`}
                className="talepo-home1-card-hover group relative overflow-hidden rounded-[1.5rem] bg-[#0f1f1d]"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <CategoryImage
                    slug={slug}
                    className="transition duration-700 group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-[#070c0b]/88 via-[#070c0b]/18 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
                      {tag}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
                      {cat.label}
                    </h3>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {GRID_SECONDARY.map(({ slug, tag }) => {
            const cat = meta(slug);
            return (
              <Link
                key={slug}
                href={`/talep?category=${encodeURIComponent(slug)}`}
                className="talepo-home1-card-hover group relative overflow-hidden rounded-[1.5rem] bg-[#0f1f1d]"
              >
                <div className="relative aspect-[16/11] overflow-hidden">
                  <CategoryImage slug={slug} className="transition duration-700 group-hover:scale-[1.06]" />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-[#070c0b]/85 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
                      {tag}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">
                      {cat.label}
                    </h3>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-16 border-t border-teal-900/8 pt-10">
          <div className="flex items-end justify-between gap-4">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f1d]">
              Daha fazla alan
            </h3>
            <Link
              href="/talep"
              className="hidden text-sm font-medium text-teal-800/60 transition hover:text-teal-900 sm:inline-flex sm:items-center sm:gap-1.5"
            >
              Serbest metin talep
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {more.map((cat) => (
              <Link
                key={cat.slug}
                href={`/talep?category=${encodeURIComponent(cat.slug)}`}
                className="talepo-home1-card-hover group w-[min(240px,78vw)] shrink-0 snap-start overflow-hidden rounded-2xl bg-[#f4f7f6]"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-[#e8f0ee]">
                  <CategoryImage
                    slug={cat.slug}
                    sizes="(max-width: 640px) 78vw, 240px"
                    className="transition duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="px-4 py-3.5">
                  <p className="text-[15px] font-semibold tracking-tight text-[#0f1f1d]">
                    {cat.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-teal-950/45">
                    {cat.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
