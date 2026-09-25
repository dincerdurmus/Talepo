"use client";

/**
 * MAIRA'NIN YÜZÜ — /talep AKIŞINDAKİ TEK GÖRÜNÜM (kurucu, 2026-09-25).
 *
 * Yüz, lisanslı GetLayers Contour modelidir ve beyaz zeminde teal tonlarıyla
 * çizilir. Prototipteki çizgi yüz yalnız yer tutucuydu, buraya kopyalanmadı.
 *
 * AKIŞ YÜZE BAĞLI DEĞİLDİR. Sahne dynamic import ile ve `ssr: false` ile
 * bağlanır; WebGL yoksa, azaltılmış hareket isteniyorsa ya da model adresi
 * tanımlı değilse hiç kurulmaz ve aşağıdaki ışık alanı görünür. Katman
 * dekoratiftir: hiçbir talep verisi okumaz, hiçbir cevabı tetiklemez.
 */

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

const MairaContourScene = dynamic(
  () => import("../maira/MairaContourScene").then((m) => m.MairaContourScene),
  { ssr: false },
);

type Props = {
  /** Kenar uzunluğu (px). Başlangıçta büyük, durum satırında küçük. */
  size: number;
  /** Dekoratif "düşünüyor" nabzı — davranış taşımaz. */
  thinking?: boolean;
  /**
   * Lisanslı sahne yalnız yüzün OKUNABİLDİĞİ boyutta kurulur.
   *
   * Ölçüldü (tarayıcıda, 2026-09-25): 38px'lik durum işaretinde kontur
   * modeli bir lekeye dönüşüyor ve kaliteyi düşürüyor. Küçük işaret temiz
   * kontur halkalarıyla çizilir; sahne büyük yüzde açılır. Aynı kimlik, iki
   * ölçek — ikinci bir görsel dil değil.
   */
  scene?: boolean;
  className?: string;
};

export function MairaFace({
  size,
  thinking = false,
  scene = true,
  className = "",
}: Props) {
  /**
   * Yer tutucu halkalar sahne çizmeye başlayınca SÖNER. İkisi üst üste
   * durduğunda yüz, konturların değil iç içe ovallerin görüntüsüne
   * dönüşüyordu (tarayıcıda ölçüldü). Sahne hiç kurulmazsa halkalar görünür
   * kalır — akış yüze bağımlı değildir.
   */
  const [sceneReady, setSceneReady] = useState(false);
  const handleReady = useCallback((ready: boolean) => setSceneReady(ready), []);

  return (
    <span
      aria-hidden
      data-testid="maira-face"
      className={`relative block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/*
        IŞIK ALANI = FALLBACK. Sahne kurulduğunda üstüne biner, kurulmadığında
        Maira'nın varlığını tek başına taşır.
      */}
      <span
        className={`absolute inset-[8%] rounded-full ${thinking ? "animate-pulse" : ""}`}
        style={{
          background:
            "radial-gradient(circle at 50% 46%, rgba(94,234,212,0.42), rgba(94,234,212,0.10) 58%, transparent 72%)",
          filter: "blur(6px)",
        }}
      />
      <svg
        viewBox="0 0 100 100"
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
          sceneReady ? "opacity-0" : "opacity-100"
        }`}
        fill="none"
      >
        {[0, 1, 2, 3, 4].map((ring) => (
          <ellipse
            key={ring}
            cx="50"
            cy="46"
            rx={30 - ring * 5.5}
            ry={38 - ring * 6.5}
            stroke="#0f766e"
            strokeOpacity={0.16 + ring * 0.05}
            strokeWidth="0.9"
          />
        ))}
        <path
          d="M24 88c6.5-8 15.5-12 26-12s19.5 4 26 12"
          stroke="#0f766e"
          strokeOpacity="0.22"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </svg>
      {scene ? (
        <MairaContourScene
          appearance="light"
          thinking={thinking}
          onReady={handleReady}
        />
      ) : null}
    </span>
  );
}
