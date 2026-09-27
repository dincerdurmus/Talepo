"use client";

/**
 * KATLANAN İZ — SESSİZ BİR ZAMAN ÇİZGİSİ (kurucu, 2026-09-27).
 *
 * Cevaplanan adım yok olmaz; aktif adımın ÜSTÜNDE tek satırlık bir ize
 * katlanır (kâğıt katlanır gibi, `FOLD_MS`). Solda Maira'nın teal renginde
 * ince bir dikey çizgi, her izde küçük bir nokta durur. Aktif adım tam
 * parlaklıkta; izler geri plandadır.
 *
 * NE YAPMAZ — VE BİLEREK YOK OLANLAR. Geri oku, "Geri" düğmesi, numaralı
 * stepper, breadcrumb, sekme çubuğu ve sayfa geçişi YOKTUR (kurucu: "standart
 * bir şey yapma"). Bileşen karar da taşımaz: hangi adımın ize düştüğünü
 * `buildStepTrail` söyler, izin açılınca ne çizileceğini sayfa verir. Burada
 * yalnız çizim ve dokunuşun dışarıya iletilmesi var.
 *
 * AÇILMA YERİNDE OLUR. Bir ize dokunulunca iz kaybolmaz: `aria-expanded`
 * `true` olur ve adım bloğu iznin ALTINDA, durduğu yerde açılır. Böylece
 * katlanma geri alınabilir bir aç/kapa denetimidir ve katlanınca odak aynı
 * düğmeye dönebilir.
 */

import type { ReactNode } from "react";

import { EASE_REVEAL, FOLD_MS } from "@/lib/motion/talep-motion";
import type {
  StepTrailEntry,
  StepTrailModel,
} from "@/lib/request-composer/v2/step-trail-model";

type Props = {
  model: StepTrailModel;
  /** Şu an yerinde açık olan izin anahtarı; yoksa `null`. */
  openKey: string | null;
  /** Açık izin altında çizilecek adım bloğu. */
  openNode?: ReactNode;
  /** "+N adım" açık mı? */
  expanded: boolean;
  onToggleFolded: () => void;
  onOpen: (entry: StepTrailEntry) => void;
};

/**
 * KATLANMA VE AZALTILMIŞ HAREKET TEK YERDE. Tercih JS'te okunmaz, CSS medya
 * sorgusu ile karşılanır: sunucu render'ı bu kararı hiç vermediği için ilk
 * karede bile doğru olur. Azaltılmış harekette iz anında katlanır/açılır.
 *
 * HAREKET DÜĞMENİN KENDİSİNDE DEĞİL, İÇİNDEKİ KATTA (tarayıcıda ölçüldü,
 * `sonuc8/m-8b`). Katlanma animasyonu düğmeye `fill-mode: both` ile
 * uygulandığında son karesi (`opacity:1`) SÜREKLİ geçerli kalıyor ve solma
 * sınıfını cascade'de eziyordu: `data-trail-dimmed="true"` diyen iz ölçülen
 * opaklıkta 1 çıkıyordu. Solma düğmede, katlanma içteki katta — iki karar
 * birbirini ezemez.
 */
const FOLD_CSS = `
@keyframes talep-trail-fold{
  from{opacity:0;transform:perspective(420px) rotateX(-72deg)}
  to{opacity:1;transform:perspective(420px) rotateX(0deg)}
}
@media (prefers-reduced-motion: reduce){
  [data-trail-fold]{animation:none !important}
}`;

export function StepTrail({
  model,
  openKey,
  openNode,
  expanded,
  onToggleFolded,
  onOpen,
}: Props) {
  if (model.entries.length === 0) return null;
  const openIndex = openKey
    ? model.visible.findIndex((entry) => entry.key === openKey)
    : -1;

  return (
    <ol
      data-testid="talep-step-trail"
      data-trail-count={model.entries.length}
      data-trail-visible={model.visible.length}
      data-trail-folded={model.foldedCount}
      data-trail-open={openKey ?? ""}
      className="relative m-0 grid list-none gap-0.5 p-0 pl-[14px]"
    >
      <style>{FOLD_CSS}</style>
      {/* Maira'nın teal renginde ince dikey çizgi — sessiz bir zaman çizgisi. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2 left-[3px] top-2 w-px bg-[#0d9488]/25"
      />

      {/*
        FAZLASI TEK SATIRA TOPLANIR. En eski izler "+N adım"ın arkasındadır;
        dokununca açılır. Satır bir aç/kapa denetimidir, ikinci bir gezinme
        yüzeyi değil.
      */}
      {model.foldedCount > 0 ? (
        <li className="relative">
          <button
            type="button"
            data-testid="talep-trail-more"
            data-trail-folded-count={model.foldedCount}
            aria-expanded={expanded}
            onClick={onToggleFolded}
            className="flex min-h-9 w-full items-center gap-2 rounded-lg px-1 text-left text-[12.5px] text-[#0f1f1d]/40 transition-colors duration-150 active:bg-[#f0fdfa] lg:hover:text-[#0f1f1d]/60"
          >
            <span
              aria-hidden
              className="absolute left-[-15px] top-[15px] h-[5px] w-[5px] rounded-full bg-[#0d9488]/35"
            />
            +{model.foldedCount} adım
          </button>
        </li>
      ) : null}

      {model.visible.map((entry, index) => {
        const open = openKey !== null && entry.key === openKey;
        /*
          AÇIK İZİN ALTINDAKİ ADIMLAR SOLAR (kurucu). Kullanıcı hangi adıma
          döndüğünü ekrandan görür; solan izler yine dokunulabilir kalır,
          çünkü solma bir kilit değil, bir vurgu farkıdır.
        */
        const dimmed = openIndex >= 0 && index > openIndex;
        return (
          <li key={entry.key} className="relative">
            <button
              type="button"
              data-testid="talep-trail-entry"
              data-trail-key={entry.key}
              data-trail-kind={entry.kind}
              data-trail-dimmed={dimmed ? "true" : "false"}
              aria-expanded={open}
              aria-label={entry.accessibleLabel}
              onClick={() => onOpen(entry)}
              className={`block min-h-9 w-full rounded-lg px-1 text-left text-[12.5px] transition-opacity duration-200 active:bg-[#f0fdfa] ${
                dimmed ? "opacity-40" : "opacity-100"
              }`}
            >
              <span
                aria-hidden
                className={`absolute left-[-15px] top-[15px] h-[5px] w-[5px] rounded-full ${
                  open ? "bg-[#0d9488]" : "bg-[#0d9488]/45"
                }`}
              />
              <span
                data-trail-fold=""
                style={{
                  animation: `talep-trail-fold ${FOLD_MS}ms ${EASE_REVEAL} both`,
                  transformOrigin: "top center",
                }}
                className="flex min-h-9 items-center gap-1.5"
              >
                {entry.label ? (
                  <>
                    <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#0f1f1d]/40">
                      {entry.label}
                    </span>
                    <span aria-hidden className="shrink-0 text-[#0f1f1d]/25">
                      ·
                    </span>
                  </>
                ) : null}
                {entry.value ? (
                  <span
                    className={`truncate ${
                      open ? "font-medium text-[#0f766e]" : "text-[#0f1f1d]/55"
                    }`}
                  >
                    {entry.value}
                  </span>
                ) : null}
              </span>
            </button>

            {/*
              KATLANMANIN TERSİ — ADIM YERİNDE AÇILIR. Blok izin altında, aynı
              hizada açılır; başka bir ekrana ya da sayfaya geçilmez.
            */}
            {open && openNode ? (
              <div data-testid="talep-trail-open" className="grid gap-2 py-2">
                {openNode}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
