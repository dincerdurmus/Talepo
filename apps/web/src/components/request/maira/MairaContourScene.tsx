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
 * yoksa, kullanıcı azaltılmış hareket istiyorsa, ekran dar ise ya da model
 * adresi tanımlı değilse canvas HİÇ kurulmaz ve `MairaStage`'in bugünkü
 * ışık alanı aynen görünür. Kurulum sırasında bir hata olursa sessizce
 * aynı fallback'e dönülür — görsel katman /talep akışını kıramaz.
 */
import { useEffect, useRef, useState } from "react";

import type { ContourSceneHandle } from "@/lib/maira/contour-scene";

const MIN_WIDTH = 768;

/**
 * Model adresi YALNIZ ortam değişkeninden gelir; satın alınan kaynağın
 * adresi takip edilen koda gömülmez. Tanımsızsa sahne çalışmaz.
 */
const MODEL_URL = process.env.NEXT_PUBLIC_MAIRA_CONTOUR_MODEL_URL ?? "";

function sceneAllowed(): boolean {
  if (!MODEL_URL) return false;
  if (typeof window === "undefined") return false;
  try {
    if (window.innerWidth < MIN_WIDTH) return false;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      return false;
    }
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

type Props = {
  /**
   * Dekoratif "düşünüyor" nabzı. Davranış taşımaz; yalnız ışık genliğini
   * değiştirir ve sahne yoksa hiçbir etkisi olmaz.
   */
  thinking?: boolean;
};

export function MairaContourScene({ thinking = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<ContourSceneHandle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sceneAllowed()) return;
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
        });
        setReady(true);
      } catch {
        /* Sessiz fallback: ışık alanı görünmeye devam eder. */
        handleRef.current = null;
        setReady(false);
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
    };
  }, []);

  useEffect(() => {
    handleRef.current?.setThinking(thinking);
  }, [thinking]);

  if (!sceneAllowed()) return null;

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
