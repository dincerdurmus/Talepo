"use client";

/**
 * HERO SAĞ GÖRSELİ — TALEPO PLANET (kurucu, 2026-09-04).
 *
 * Eski statik teklif illüstrasyonunun yerini Request Broadcast sahnesi aldı:
 * talep doğar → dünya üzerinde nokta aktive olur → sinyal doğru satıcılara
 * yayılır → teklifler geri döner → kullanıcı karşılaştırır.
 *
 * Sahne dynamic import ile İSTEMCİDE ve GEÇ yüklenir (code splitting):
 * ilk boya küçük kalır, canvas kodu hero görünene dek paketten ayrı durur.
 * Yüklenene kadar aynı kadrajda premium statik bir zemin gösterilir —
 * layout kayması yok. Tamamı dekoratiftir (aria-hidden).
 */
import dynamic from "next/dynamic";

const PlanetScene = dynamic(
  () => import("./TalepoSignalPlanet").then((m) => m.TalepoSignalPlanet),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="relative h-full w-full"
      >
        <div
          className="absolute -bottom-[28%] -right-[22%] h-[112%] aspect-square rounded-full opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(closest-side at 50% 52%, rgba(45,212,191,0.10), rgba(45,212,191,0.02) 62%, transparent 74%)",
          }}
        />
      </div>
    ),
  },
);

export function HomeOneHeroIllustration() {
  return (
    <div className="relative h-full w-full">
      <PlanetScene />
    </div>
  );
}
