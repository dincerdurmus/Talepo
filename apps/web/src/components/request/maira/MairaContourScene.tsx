"use client";

/**
 * MAIRA CONTOUR SAHNESİ — YAŞAM DÖNGÜSÜ SARMALI (2026-08-31).
 *
 * GetLayers Contour Anatomy — Full Stack licensed product integration
 * (katman sayfası: GetLayers "Contour Anatomy", 2026-08-31). Sahne yalnız
 * Talepo ürününün parçası olarak çalışır; kullanıcıya model indirme yolu
 * sunulmaz.
 *
 * NE YAPAR. WebGL sahnesini KOŞULLU olarak kurar ve söker. Hiçbir talep
 * verisi okumaz, hiçbir cevabı tetiklemez; katman tamamen dekoratiftir ve
 * `pointer-events: none` ile altındaki soru/cevap yüzeyini kapatmaz.
 *
 * NEDEN KOŞULLU MOUNT. Sahne bir yardımcıdır, bir önkoşul değil. WebGL2
 * yoksa, kullanıcı azaltılmış hareket istiyorsa ya da model adresi tanımlı
 * değilse canvas HİÇ kurulmaz ve çağıranın kendi fallback'i görünür.
 * Kurulum sırasında bir hata olursa sessizce aynı fallback'e dönülür —
 * görsel katman /talep akışını kıramaz.
 *
 * TELEFON (kurucu, 2026-09-25). 768px eşiği artık MOUNT kapısı değil,
 * KALİTE kapısıdır: dar ekranda sahne yine açılır ama düşük piksel oranı ve
 * düşük kare hızıyla. Sahne görünür alandan çıkınca çizim tamamen durur
 * (bkz. `lib/maira/contour-scene.ts` görünürlük kapıları).
 */
import { useEffect, useRef, useState } from "react";

import type {
  ContourAppearance,
  ContourFraming,
  ContourSceneHandle,
} from "@/lib/maira/contour-scene";

/** Altında sahnenin "hafif ayar" ile koştuğu genişlik eşiği. */
const MIN_WIDTH = 768;

/**
 * Model adresi YALNIZ ortam değişkeninden gelir; satın alınan kaynağın
 * adresi takip edilen koda gömülmez. Tanımsızsa sahne çalışmaz.
 */
const MODEL_URL = process.env.NEXT_PUBLIC_MAIRA_CONTOUR_MODEL_URL ?? "";

type SceneBudget = {
  maxPixelRatio: number;
  maxFps: number;
};

function sceneBudget(): SceneBudget | null {
  if (!MODEL_URL) return null;
  if (typeof window === "undefined") return null;
  try {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      return null;
    }
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2");
    if (!gl) return null;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    const narrow = window.innerWidth < MIN_WIDTH;
    return narrow
      ? { maxPixelRatio: 1, maxFps: 24 }
      : { maxPixelRatio: 1.75, maxFps: 0 };
  } catch {
    return null;
  }
}

type Props = {
  /**
   * Dekoratif "düşünüyor" nabzı. Davranış taşımaz; yalnız ışık genliğini
   * değiştirir ve sahne yoksa hiçbir etkisi olmaz.
   */
  thinking?: boolean;
  /** Zemin varyantı; /talep beyaz zeminde `light` ister. */
  appearance?: ContourAppearance;
  /**
   * Kadraj; küçük kutularda `portrait` (baş + boyun) istenir. Verilmezse
   * onaylanan tam kadraj korunur — koyu tam ekran sahne bu yoldan geçer.
   */
  framing?: ContourFraming;
  /**
   * Sahne gerçekten çizmeye başladığında haber verir. Çağıran taraf kendi
   * fallback'ini söndürebilsin diye var: iki katman üst üste durduğunda
   * yüz, konturların değil iç içe halkaların görüntüsüne dönüşüyordu.
   * Sahne hiç kurulmazsa bu geri çağrı HİÇ `true` ile çağrılmaz — fallback
   * görünür kalır.
   */
  onReady?: (ready: boolean) => void;
};

export function MairaContourScene({
  thinking = false,
  appearance = "dark",
  framing = "full",
  onReady,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<ContourSceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  /**
   * Yetenek ölçümü BİR KEZ, ilk render'da yapılır. Bileşen yalnız
   * `dynamic(..., { ssr: false })` ile bağlandığı için bu kod sunucuda hiç
   * koşmaz; effect içinde ölçüp state'e yazmak gereksiz bir ikinci render
   * üretirdi.
   */
  const [budget] = useState<SceneBudget | null>(() => sceneBudget());

  useEffect(() => {
    if (!budget) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;

    void (async () => {
      try {
        const mod = await import("@/lib/maira/contour-scene");
        if (disposed) return;
        handleRef.current = mod.mountContourScene({
          canvas,
          modelUrl: MODEL_URL,
          appearance,
          framing,
          maxPixelRatio: budget.maxPixelRatio,
          maxFps: budget.maxFps,
        });
        /*
          KANIT KARESİ KENDİ KADRAJINI SÖYLER. Değerler sahnenin uyguladığı
          hâlinden okunur; burada ikinci bir sayı tablosu tutulmaz.
        */
        const applied = handleRef.current.framing;
        canvas.dataset.framing = applied.name;
        canvas.dataset.camTarget = String(applied.camTargetY);
        canvas.dataset.camDist = String(applied.camDist);
        setReady(true);
        onReady?.(true);
      } catch {
        /* Sessiz fallback: çağıranın ışık alanı görünmeye devam eder. */
        handleRef.current = null;
        setReady(false);
        onReady?.(false);
      }
    })();

    return () => {
      disposed = true;
      try {
        handleRef.current?.dispose();
      } catch {
        /* Temizlik hatası da akışa sızmaz. */
      }
      handleRef.current = null;
      onReady?.(false);
    };
  }, [appearance, budget, framing, onReady]);

  useEffect(() => {
    handleRef.current?.setThinking(thinking);
  }, [thinking]);

  if (!budget) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="maira-contour-canvas"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: ready ? 1 : 0, transition: "opacity .6s ease" }}
    />
  );
}

export default MairaContourScene;
