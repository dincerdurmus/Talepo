"use client";

/**
 * MAIRA GİRİŞ SAHNESİ — ONAYLANAN GÖRSELİN KENDİSİ (kurucu, 2026-09-01).
 *
 * Kullanıcı talebini yazıp "Devam et" dediğinde (ya da Enter'a bastığında)
 * bu sahne açılır: GetLayers Contour Anatomy figürü ışık süzmeleriyle
 * yavaşça belirir, üstünde "Maira hazır" ve el yazısı "Talebini aldım",
 * altında iki kapsül — "Konuşalım →" (Maira görünümü) ve "Formla devam"
 * (standart form). Beyaz kart/modal YOKTUR; kurucunun reddettiği o yüzeydi.
 *
 * SUNUM KATMANIDIR: hiçbir talep verisi okumaz, hiçbir cevabı değiştirmez.
 * Contour sahnesi kendi kurulum kurallarına tabidir (WebGL2, genişlik,
 * reduced-motion, model adresi) — kurulamazsa koyu zemin + radyal ışık
 * fallback'i aynı sahne dilini korur.
 */
import dynamic from "next/dynamic";
import { Alex_Brush } from "next/font/google";

const scriptFont = Alex_Brush({ weight: "400", subsets: ["latin"] });

const MairaContourScene = dynamic(
  () => import("./MairaContourScene").then((m) => m.MairaContourScene),
  { ssr: false },
);

const ARROW = (
  <svg
    className="h-[0.62em] w-[0.84em] flex-none"
    viewBox="0 0 20 14.7279"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 6.36396C0.447715 6.36396 0 6.81168 0 7.36396C0 7.91625 0.447715 8.36396 1 8.36396V7.36396V6.36396ZM19.7071 8.07107C20.0976 7.68054 20.0976 7.04738 19.7071 6.65685L13.3431 0.292893C12.9526 -0.097631 12.3195 -0.097631 11.9289 0.292893C11.5384 0.683418 11.5384 1.31658 11.9289 1.70711L17.5858 7.36396L11.9289 13.0208C11.5384 13.4113 11.5384 14.0445 11.9289 14.435C12.3195 14.8256 12.9526 14.8256 13.3431 14.435L19.7071 8.07107ZM1 7.36396V8.36396H19V7.36396V6.36396H1V7.36396Z"
      fill="currentColor"
    />
  </svg>
);

/** Sahne içi kademeli beliriş — ışık süzmeleri önce, yazı sonra, eylem en son. */
const REVEAL_CSS = `
@keyframes maira-handoff-veil { from { opacity: 0 } to { opacity: 1 } }
@keyframes maira-handoff-out { from { opacity: 1 } to { opacity: 0 } }
/* PİKSEL PİKSEL DOĞUŞ (kurucu, 2026-09-01): önce Maira noktacıklardan
   OLUŞUR (halftone çözünme + odaktan gelme), arka plan örtüsü ondan SONRA
   yavaşça oturur. Sayfa hiçbir anda "kesilmez". */
@property --maira-dot {
  syntax: "<length>";
  inherits: false;
  initial-value: 0.3px;
}
@keyframes maira-handoff-pixelize {
  from { --maira-dot: 0.35px; filter: blur(10px) saturate(1.3); }
  55%  { --maira-dot: 3.2px; filter: blur(3px) saturate(1.12); }
  to   { --maira-dot: 9px; filter: blur(0) saturate(1); }
}
@keyframes maira-handoff-arrive {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.maira-handoff-root { background: transparent; }
.maira-handoff-root.maira-handoff-leave {
  /* Konuşalım vedası: altta TAM OPAK Maira katmanı hazır beklerken sahne
     uzun ve yumuşak erir — karanlıktan karanlığa, hiçbir parlak kare yok. */
  animation: maira-handoff-out 1.15s cubic-bezier(0.4,0,0.2,1) both;
  pointer-events: none;
}
.maira-handoff-dark {
  /* EKRAN, PİKSELLER MAİRA'YI OLUŞTURANA KADAR KARARMAZ (kurucu):
     örtü ancak çözünme bittikten sonra yavaşça oturur. */
  animation: maira-handoff-veil 2.2s cubic-bezier(0.33,0,0.2,1) 2.8s both;
}
.maira-handoff-figure {
  /* Doğuş TÜM SAYFADA: merkez kümelenmesi (scale) ve kenar maskesi yok —
     noktacıklar ekranın her yerinde belirip birleşir. */
  animation: maira-handoff-arrive 0.7s ease-out both;
}
.maira-handoff-pixel {
  animation: maira-handoff-pixelize 2.9s cubic-bezier(0.3,0,0.3,1) both;
  -webkit-mask-image: radial-gradient(circle, #000 0 var(--maira-dot), transparent calc(var(--maira-dot) + 0.4px));
  mask-image: radial-gradient(circle, #000 0 var(--maira-dot), transparent calc(var(--maira-dot) + 0.4px));
  -webkit-mask-size: 9px 9px;
  mask-size: 9px 9px;
}
@supports not (mask-size: 9px 9px) {
  .maira-handoff-pixel { -webkit-mask-image: none; mask-image: none; }
}
.maira-handoff-title { animation: maira-handoff-veil 1.2s ease-out 3.7s both; }
.maira-handoff-script { animation: maira-handoff-veil 1.5s ease-out 4.1s both; }
.maira-handoff-cta { animation: maira-handoff-veil 1s ease-out 4.6s both; }
@media (prefers-reduced-motion: reduce) {
  .maira-handoff-dark, .maira-handoff-figure, .maira-handoff-pixel,
  .maira-handoff-title, .maira-handoff-script, .maira-handoff-cta { animation: none; }
  .maira-handoff-dark { opacity: 1; }
  .maira-handoff-pixel { -webkit-mask-image: none; mask-image: none; filter: none; }
}
`;

type Props = {
  onTalk: () => void;
  onForm: () => void;
  /** Konuşalım sonrası yumuşak veda — sahne aşağıdaki Maira katmanına erir. */
  leaving?: boolean;
};

export function MairaHandoffScene({ onTalk, onForm, leaving = false }: Props) {
  return (
    <div
      data-testid="maira-handoff"
      role="dialog"
      aria-modal="true"
      aria-label="Maira hazır — nasıl devam edelim?"
      className={`maira-handoff-root fixed inset-0 z-[70] overflow-hidden text-[#f2f2f2] ${leaving ? "maira-handoff-leave" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") onForm();
      }}
    >
      <style>{REVEAL_CSS}</style>

      {/* Karanlık örtü — sayfa anında kararmaz, figürün etrafında dolar. */}
      <div
        className="maira-handoff-dark pointer-events-none absolute inset-0 bg-[#02070c]"
        aria-hidden="true"
      />

      {/* Işık katmanı — figür uzaktan büyüyerek sayfanın içinde doğar. */}
      <div
        className="maira-handoff-figure pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="maira-handoff-pixel absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(60% 70% at 50% 45%, rgba(45,212,191,0.12), rgba(14,60,80,0.05) 55%, transparent 100%)",
            }}
          />
          <MairaContourScene />
        </div>
      </div>

      <div className="relative flex h-full flex-col items-center justify-center px-6">
        <p className="maira-handoff-title text-[clamp(28px,4.2vw,58px)] font-light tracking-wide text-[#f2f2f2]/85">
          Maira hazır
        </p>
        <p
          className={`maira-handoff-script ${scriptFont.className} -mt-[0.55em] text-[clamp(48px,7.5vw,110px)] leading-tight text-[#eef6f4]`}
        >
          Talebini aldım
        </p>

        <div className="maira-handoff-cta mt-[clamp(20px,4vh,44px)] flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            data-testid="maira-handoff-talk"
            onClick={onTalk}
            className="inline-flex min-h-[52px] items-center gap-3 rounded-full bg-[#0c0c0c] py-3 pl-7 pr-2 text-[16px] font-medium text-white shadow-[0_10px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/15 transition hover:ring-white/35"
          >
            Konuşalım
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#0c0c0c]">
              {ARROW}
            </span>
          </button>
          <button
            type="button"
            data-testid="maira-handoff-standard"
            onClick={onForm}
            className="min-h-[52px] rounded-full border border-white/30 px-8 text-[16px] font-medium text-white/90 transition hover:border-white/60 hover:text-white"
          >
            Formla devam
          </button>
        </div>
      </div>
    </div>
  );
}
