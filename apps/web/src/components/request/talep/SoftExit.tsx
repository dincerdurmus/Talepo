"use client";

/**
 * YUMUŞAK KAPANIŞ — CEVAPLANAN ADIM GÖZ ÖNÜNDE ÇEKİLİR (kurucu, 2026-09-26).
 *
 * Kurucunun cümlesi: "geriye dönük kapanmadığı zaman biraz karışık oluyor;
 * seçilen şey gidebilir ama geri dönüşü olacak şekilde kalkması lazım."
 * Ölçüldü (390px, `sonuc7/once-*`): bloklar zaten kalkıyordu ama BİR KAREDE
 * yok oluyordu — kullanıcı neyin kalktığını görmeden ekran değişiyordu.
 *
 * NE YAPAR. Kalkan bloğun DONDURULMUŞ kopyasını hareket tablosundaki süre
 * (`REVEAL_MS`) ve eğri (`EASE_REVEAL`) ile soldurup yukarı çeker. Kopya
 * `inert` + `aria-hidden` + `pointer-events-none`'dur: ne klavye, ne ekran
 * okuyucu, ne fare ona ulaşır. Böylece "kapanan blok görünür değil" kapısı
 * kapanış bittiğinde gerçekten kapanır.
 *
 * NE YAPMAZ — VE NEDEN BÖYLE KURULDU. Kopyayı bu bileşen ÜRETMEZ; kapanışı
 * başlatan olay (onay dokunuşu, cevap) sayfada olduğu için dondurma da
 * oradadır. Denenen ve bırakılan yol: bileşenin `open` prop'unu izleyip son
 * içeriği kendi içinde saklaması. İki sebeple bırakıldı — (1) model, `open`
 * ile AYNI render'da null olduğu için saklanacak içerik zaten kalmıyordu,
 * (2) bunu kurtarmak için gereken "render sırasında ref yaz / efekt içinde
 * setState" kalıbı React kurallarına aykırı (`react-hooks/refs`,
 * `react-hooks/set-state-in-effect` — ikisi de bu depoda hata).
 *
 * Karar taşımaz: hiçbir cevabı, zorunluluğu ya da yayın kararını etkilemez.
 */

import type { ReactNode } from "react";

import { EASE_REVEAL, REVEAL_MS } from "@/lib/motion/talep-motion";

type Props = {
  /** Kalkmakta olan blok; yoksa hiçbir şey çizilmez. */
  closing: { name: string; node: ReactNode } | null;
};

export function SoftExit({ closing }: Props) {
  if (!closing) return null;
  return (
    <div
      data-testid="talep-soft-exit"
      data-soft-exit={closing.name}
      aria-hidden
      inert
      className="pointer-events-none"
      style={{
        animation: `talep-soft-exit ${REVEAL_MS}ms ${EASE_REVEAL} both`,
      }}
    >
      <style>{`@keyframes talep-soft-exit{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-6px)}}`}</style>
      {closing.node}
    </div>
  );
}
