import { extractModelIdentityTokens } from "@/lib/product-identity/model-identity-tokens";
import {
  findBrand,
  findTechnologyProduct,
  TECHNOLOGY_BRANDS,
} from "@/lib/ai/parser/brand-catalog";

export type NumberRole =
  | "MODEL_IDENTIFIER"
  | "MODEL_YEAR"
  | "QUANTITY"
  | "WEIGHT"
  | "DIMENSION"
  | "ROOM_LAYOUT"
  | "MILEAGE"
  | "CAPACITY"
  | "AREA"
  | "PRICE"
  | "STORAGE"
  | "SCREEN_SIZE"
  | "TIRE_SIZE"
  | "SEATING"
  | "OTHER";

export type ClassifiedNumber = {
  raw: string;
  role: NumberRole;
  value?: number;
  unit?: string;
  evidence: string[];
  index: number;
};

function parseTrInt(raw: string): number {
  const cleaned = raw.replace(/\./g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

const TYPICAL_TV_INCHES = new Set([
  32, 40, 42, 43, 48, 49, 50, 55, 58, 60, 65, 70, 75, 77, 85, 86, 98, 100, 105,
  110, 120, 140,
]);

const TV_BRAND_ENTRIES = TECHNOLOGY_BRANDS.filter((b) =>
  /^(samsung|lg|sony|vestel|philips|tcl|hisense)$/i.test(b.canonical),
);

const APPLIANCE_NOUN_RE =
  /buzdolab[ıi]|çamaş[ıi]r|bulaş[ıi]k|klima|f[ıi]r[ıi]n|ocak|davlumbaz|kombi|kurutma/i;

const PHONE_FAMILY_RE =
  /\b(?:s\d{1,2}(?:\s*(?:ultra|plus|\+))?|galaxy|note\s*\d|z?\s*fold|z?\s*flip|iphone|ipad|macbook)\b/i;

/**
 * Samsung + 55 / 55 inç → TV screen context.
 * Does not map every brand+number (S24, buzdolabı stay out).
 */
export function looksLikeTelevisionScreenContext(text: string): boolean {
  const n = text.toLocaleLowerCase("tr-TR");
  if (APPLIANCE_NOUN_RE.test(n)) return false;

  // Avoid \\b after Turkish "inç" — it often fails in JS and drops TV context.
  const hasTvNoun =
    /(?:inç|inc|inch|ekran(?:lı|li)?|\btv\b|televizyon|smart\s*tv)/i.test(n);
  const hasExplicitTvProduct = /(?:televizyon|\btv\b|smart\s*tv)/i.test(n);

  // Explicit TV product noun wins over phone-catalog false positives (A55 ≠ Galaxy A55).
  const tech = findTechnologyProduct(n);
  if (
    tech &&
    /galaxy|iphone|ipad|macbook|pixel|redmi|poco/i.test(tech.canonical) &&
    !hasExplicitTvProduct
  ) {
    return false;
  }
  if (PHONE_FAMILY_RE.test(n) && !hasTvNoun) return false;
  const hasTvBrand = Boolean(findBrand(n, TV_BRAND_ENTRIES));
  const hasTypicalSize = [...TYPICAL_TV_INCHES].some((size) =>
    new RegExp(`(?:^|[^0-9])${size}(?:$|[^0-9])`).test(n),
  );
  if (hasTvNoun && (hasTvBrand || hasTypicalSize || hasExplicitTvProduct)) {
    return true;
  }
  return hasTvBrand && hasTypicalSize;
}

export function typicalTelevisionSizeInText(text: string): string | null {
  const n = text.toLocaleLowerCase("tr-TR");
  for (const size of TYPICAL_TV_INCHES) {
    if (new RegExp(`(?:^|[^0-9])${size}(?:$|[^0-9])`).test(n)) {
      return String(size);
    }
  }
  return null;
}

/**
 * Classify numeric tokens by surrounding evidence.
 * Never assume bare digits are QUANTITY.
 *
 * Order: unit-backed roles first, then alphanumeric model tokens,
 * then bare-after-alpha model candidates, then OTHER.
 */
export function classifyNumbers(normalizedText: string): ClassifiedNumber[] {
  /** 98+ Faz I (2026-09-01): JS /i Türkçe İ'yi katlamaz — "50 BİN ADET"
   * hiçbir role girmiyordu (ölçüldü). Tek yerde tr-katlanır; Türkçe
   * katlama uzunluk korur, indeksler değişmez. */
  const text = normalizedText.toLocaleLowerCase("tr-TR");
  const lower = text.toLocaleLowerCase("tr-TR");
  const results: ClassifiedNumber[] = [];
  const claimed = new Set<number>();

  const claim = (index: number, len: number) => {
    for (let i = index; i < index + len; i++) claimed.add(i);
  };
  const isClaimed = (index: number, len: number) => {
    for (let i = index; i < index + len; i++) {
      if (claimed.has(i)) return true;
    }
    return false;
  };

  // --- Unit-backed / contextual roles first ---

  const weightRe = /(\d+(?:[.,]\d+)?)\s*(gr|gram|kg)\b/gi;
  let wm: RegExpExecArray | null;
  while ((wm = weightRe.exec(text)) !== null) {
    if (isClaimed(wm.index, wm[0].length)) continue;
    results.push({
      raw: wm[0],
      role: "WEIGHT",
      value: parseTrInt(wm[1]!),
      unit: wm[2]!.toLocaleLowerCase("tr-TR"),
      evidence: [wm[0]],
      index: wm.index,
    });
    claim(wm.index, wm[0].length);
  }

  const storageRe = /(\d+(?:[.,]\d+)?)\s*(gb|tb)\b/gi;
  let sm: RegExpExecArray | null;
  while ((sm = storageRe.exec(text)) !== null) {
    if (isClaimed(sm.index, sm[0].length)) continue;
    results.push({
      raw: sm[0],
      role: "STORAGE",
      value: parseTrInt(sm[1]!),
      unit: sm[2]!.toLocaleLowerCase("tr-TR"),
      evidence: [sm[0]],
      index: sm.index,
    });
    claim(sm.index, sm[0].length);
  }

  // Lastik ebadı: "205/55 R16" — genişlik/oran(+jant çapı). Bir ölçü
  // span'idir; içindeki hiçbir sayı model, ekran ya da adet olamaz.
  const tireRe = /\b(\d{3})\s*\/\s*(\d{2})(?:\s*z?r\s*?(\d{2}))?\b/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tireRe.exec(text)) !== null) {
    if (isClaimed(tm.index, tm[0].length)) continue;
    results.push({
      raw: tm[0],
      role: "TIRE_SIZE",
      value: Number(tm[1]),
      unit: "tire",
      evidence: [tm[0], "tire-size"],
      index: tm.index,
    });
    claim(tm.index, tm[0].length);
  }

  // Boşluklu lastik ebadı: "205 55 r16", "315 80 22.5" (98+ Part IV).
  // Ayraçsız yazım halk dilinde yaygındır; üçlü, gerçek lastik geometrisi
  // aralıklarıyla doğrulanır (genişlik 125–445 / oran 25–85 / jant 10–26) —
  // rastgele üç sayı bu kapıdan geçemez. Span içindeki hiçbir parça
  // (r16 dahil) model olamaz.
  const spacedTire3Re =
    /\b(\d{3})\s+(\d{2})\s+(?:z?r\s*)?(\d{2}(?:[.,]\d)?)\b/gi;
  let st3: RegExpExecArray | null;
  while ((st3 = spacedTire3Re.exec(text)) !== null) {
    if (isClaimed(st3.index, st3[0].length)) continue;
    const w = Number(st3[1]);
    const a = Number(st3[2]);
    const r = Number(String(st3[3]).replace(",", "."));
    if (w < 125 || w > 445 || a < 25 || a > 85 || r < 10 || r > 26) continue;
    results.push({
      raw: st3[0],
      role: "TIRE_SIZE",
      value: w,
      unit: "tire",
      evidence: [st3[0], "spaced-tire-size"],
      index: st3.index,
    });
    claim(st3.index, st3[0].length);
  }

  // Tarım/iş makinesi lastik ebadı: "16.9-30", "12.4-24" (98+ Part IV).
  const agTireRe = /(?:^|[^0-9])(\d{2}(?:[.,]\d)?)\s*[-–]\s*(\d{2})(?=$|[^0-9])/g;
  let agm: RegExpExecArray | null;
  while ((agm = agTireRe.exec(text)) !== null) {
    if (isClaimed(agm.index, agm[0].length)) continue;
    results.push({
      raw: agm[0].trim(),
      role: "TIRE_SIZE",
      unit: "tire",
      evidence: [agm[0].trim(), "ag-tire-size"],
      index: agm.index,
    });
    claim(agm.index, agm[0].length);
  }

  // İnsan sayısı: "45 çalışan", "12 personel" — adet/bütçe/model değildir.
  const personsRe = /(\d+)\s*(çalışan|calisan|personel)(?=$|[^\p{L}\p{N}])/giu;
  let prm: RegExpExecArray | null;
  while ((prm = personsRe.exec(text)) !== null) {
    if (isClaimed(prm.index, prm[0].length)) continue;
    results.push({
      raw: prm[1] ?? prm[0],
      role: "SEATING",
      value: Number(prm[1]),
      unit: (prm[2] ?? "").toLocaleLowerCase("tr-TR"),
      evidence: [prm[0], "person-count"],
      index: prm.index,
    });
    claim(prm.index, prm[0].length);
  }

  // Soğutma kapasitesi: "12000 BTU" — birim rolü belirler.
  const btuRe = /(\d+(?:[.,]\d+)*)\s*btu\b/gi;
  let cm: RegExpExecArray | null;
  while ((cm = btuRe.exec(text)) !== null) {
    if (isClaimed(cm.index, cm[0].length)) continue;
    const value = parseTrInt(cm[1]!);
    if (!Number.isFinite(value)) continue;
    results.push({
      raw: cm[0],
      role: "CAPACITY",
      value,
      unit: "btu",
      evidence: [cm[0], "unit-backed-btu"],
      index: cm.index,
    });
    claim(cm.index, cm[0].length);
  }

  // Kişi kapasitesi: "6 kişilik" — oturma/kullanım kapasitesi. Model veya
  // körlemesine adet değildir.
  const seatRe = /(\d+)\s*(kişilik|kisilik)/gi;
  let stm: RegExpExecArray | null;
  while ((stm = seatRe.exec(text)) !== null) {
    if (isClaimed(stm.index, stm[0].length)) continue;
    results.push({
      raw: stm[0],
      role: "SEATING",
      value: Number(stm[1]),
      unit: "kişilik",
      evidence: [stm[0], "unit-backed-seating"],
      index: stm.index,
    });
    claim(stm.index, stm[0].length);
  }

  const areaRe = /(\d+(?:[.,]\d+)?)\s*(m2|m²|metre\s*kare|metrekare)\b/gi;
  let arm: RegExpExecArray | null;
  while ((arm = areaRe.exec(text)) !== null) {
    if (isClaimed(arm.index, arm[0].length)) continue;
    results.push({
      raw: arm[0],
      role: "AREA",
      value: parseTrInt(arm[1]!),
      unit: "m2",
      evidence: [arm[0]],
      index: arm.index,
    });
    claim(arm.index, arm[0].length);
  }

  const mileRe = /(\d+(?:[.,]\d+)?)\s*(bin\s*)?km\b/gi;
  let mm: RegExpExecArray | null;
  while ((mm = mileRe.exec(text)) !== null) {
    if (isClaimed(mm.index, mm[0].length)) continue;
    let value = parseTrInt(mm[1]!);
    if (mm[2]) value *= 1000;
    results.push({
      raw: mm[0],
      role: "MILEAGE",
      value,
      unit: "km",
      evidence: [mm[0]],
      index: mm.index,
    });
    claim(mm.index, mm[0].length);
  }

  const priceRe = /(?:₺|tl|try)?\s*(\d+(?:[.,]\d+)*)\s*(?:₺|tl|try|lira)\b/gi;
  let pm: RegExpExecArray | null;
  while ((pm = priceRe.exec(text)) !== null) {
    if (isClaimed(pm.index, pm[0].length)) continue;
    results.push({
      raw: pm[0],
      role: "PRICE",
      value: parseTrInt(pm[1]!),
      unit: "TRY",
      evidence: [pm[0]],
      index: pm.index,
    });
    claim(pm.index, pm[0].length);
  }

  const inchRe =
    /(\d{2,3})\s*(?:["”']|inç|inc|inch|ekran(?:lı|li)?)\b/gi;
  let im: RegExpExecArray | null;
  while ((im = inchRe.exec(text)) !== null) {
    if (isClaimed(im.index, im[1]!.length)) continue;
    const n = Number(im[1]);
    if (!Number.isFinite(n) || n < 24 || n > 140) continue;
    results.push({
      raw: im[0],
      role: "SCREEN_SIZE",
      value: n,
      unit: "inch",
      evidence: [im[0], "unit-backed-screen"],
      index: im.index,
    });
    claim(im.index, im[0].length);
  }

  if (looksLikeTelevisionScreenContext(text)) {
    const size = typicalTelevisionSizeInText(text);
    if (size) {
      const sizeRe = new RegExp(`(?:^|[^0-9])(${size})(?:$|[^0-9])`);
      const smatch = text.match(sizeRe);
      const idx = smatch?.index != null
        ? text.indexOf(size, smatch.index)
        : text.indexOf(size);
      if (idx >= 0 && !isClaimed(idx, size.length)) {
        results.push({
          raw: size,
          role: "SCREEN_SIZE",
          value: Number(size),
          unit: "inch",
          evidence: [size, "tv-brand-typical-size"],
          index: idx,
        });
        claim(idx, size.length);
      }
    }
  }

  const dimRe = /(\d+)\s*[x×]\s*(\d+)(?:\s*[x×]\s*(\d+))?/gi;
  let dm: RegExpExecArray | null;
  while ((dm = dimRe.exec(text)) !== null) {
    if (isClaimed(dm.index, dm[0].length)) continue;
    results.push({
      raw: dm[0],
      role: "DIMENSION",
      evidence: [dm[0]],
      index: dm.index,
    });
    claim(dm.index, dm[0].length);
  }

  /**
   * UZUNLUK BİRİMİ VE BEDEN NUMARASI (98+ Faz I, 2026-09-01). Ölçüldü:
   * "24 cm" ve "4 numara" hiçbir role girmeyip OTHER kalıyor, model kanıt
   * kapısı bu sayıyı "serbest" sanıp "tencere kapağı 24 cm" / "4" gibi çöp
   * model kimlikleri kabul ediyordu. "N cm/mm/metre" bir BOYUTTUR;
   * "N numara/beden" bir BEDENDİR — ikisi de model/adet/bütçe olamaz.
   */
  const lenRe = /(\d+(?:[.,]\d+)?)\s*(cm|mm|santim|milim|metre)\b/gi;
  let lm: RegExpExecArray | null;
  while ((lm = lenRe.exec(text)) !== null) {
    if (isClaimed(lm.index, lm[0].length)) continue;
    results.push({
      raw: lm[1] ?? lm[0],
      role: "DIMENSION",
      value: Number((lm[1] ?? "").replace(",", ".")),
      unit: (lm[2] ?? "").toLocaleLowerCase("tr-TR"),
      evidence: [lm[0], "length-unit"],
      index: lm.index,
    });
    claim(lm.index, lm[0].length);
  }
  /**
   * ÖZELLİK SAYISI (98+ Faz I): "2 kapaklı", "3 çekmeceli", "5 raflı" bir
   * ürün NİTELİĞİDİR — model/adet/bütçe olamaz. Ölçüldü: "2 kapaklı"
   * serbest sayı sanılıp model kanalına yazılıyordu.
   */
  const featRe =
    /(\d+)\s*(kapaklı|kapakli|kapılı|kapili|çekmeceli|cekmeceli|raflı|rafli|gözlü|gozlu|kollu|katlı|katli)(?=$|[^\p{L}\p{N}])/giu;
  let fm2: RegExpExecArray | null;
  while ((fm2 = featRe.exec(text)) !== null) {
    if (isClaimed(fm2.index, fm2[0].length)) continue;
    results.push({
      raw: fm2[1] ?? fm2[0],
      role: "DIMENSION",
      value: Number(fm2[1]),
      unit: (fm2[2] ?? "").toLocaleLowerCase("tr-TR"),
      evidence: [fm2[0], "feature-count"],
      index: fm2.index,
    });
    claim(fm2.index, fm2[0].length);
  }

  const sizeNoRe = /(\d+)\s*(numara|beden)\b/gi;
  let sm2: RegExpExecArray | null;
  while ((sm2 = sizeNoRe.exec(text)) !== null) {
    if (isClaimed(sm2.index, sm2[0].length)) continue;
    results.push({
      raw: sm2[1] ?? sm2[0],
      role: "DIMENSION",
      value: Number(sm2[1]),
      unit: (sm2[2] ?? "").toLocaleLowerCase("tr-TR"),
      evidence: [sm2[0], "size-number"],
      index: sm2.index,
    });
    claim(sm2.index, sm2[0].length);
  }

  // Room layout like 2+1 — not quantity
  const roomRe = /\b([1-9])\s*\+\s*([0-9])\b/g;
  let rm: RegExpExecArray | null;
  while ((rm = roomRe.exec(text)) !== null) {
    if (isClaimed(rm.index, rm[0].length)) continue;
    results.push({
      raw: rm[0],
      /**
       * 98+ Faz I (2026-09-01): oda düzeni OTHER değil kendi rolüdür —
       * OTHER "serbest sayı" sayılıp model kanıt kapısından geçiyordu
       * ("2+1" model halüsinasyonu ölçüldü).
       */
      role: "ROOM_LAYOUT",
      evidence: [rm[0], "room-layout"],
      index: rm.index,
    });
    claim(rm.index, rm[0].length);
  }

  const binRe = /(\d+)\s*bin\b/gi;
  let bm: RegExpExecArray | null;
  while ((bm = binRe.exec(text)) !== null) {
    if (isClaimed(bm.index, bm[0].length)) continue;
    const n = Number(bm[1]);
    if (!Number.isFinite(n)) continue;
    // "50bin km" already claimed by mileage; "5bin kutu" is quantity
    const after = lower.slice(bm.index + bm[0].length, bm.index + bm[0].length + 12);
    if (/^\s*km\b/.test(after)) continue;
    /**
     * PARA EKSENİ ADEDİ YENEMEZ — TERSİ DE GEÇERLİ (RC QA, 2026-08-31).
     * "bütçem 20 bin TL" cümlesinde "20 bin" hem bütçeye hem adede
     * yazılıyordu; kullanıcı 20.000 adet bulaşık makinesi istiyormuş gibi
     * yayına gidiyordu. Kural kelimeye değil EKSENE bağlıdır: sayının
     * hemen ardında para birimi (₺/TL/lira/eur/usd) ya da hemen önünde
     * bütçe bağlamı ("bütçe(m)", "fiyat") varsa rol PRICE'tır ve adet
     * kanalına ASLA yazılmaz.
     */
    const before = lower.slice(Math.max(0, bm.index - 16), bm.index);
    const currencyAfter = /^\s*(?:₺|tl\b|try\b|lira\b|eur(?:o)?\b|usd\b|dolar\b)/.test(after);
    const budgetBefore = /(?:bütçe\w*|butce\w*|fiyat\w*)\s*$/.test(before);
    if (currencyAfter || budgetBefore) {
      results.push({
        raw: bm[0],
        role: "PRICE",
        value: n * 1000,
        unit: "TL",
        evidence: [bm[0], "bin multiplier", currencyAfter ? "currency-after" : "budget-context"],
        index: bm.index,
      });
      claim(bm.index, bm[0].length);
      continue;
    }
    results.push({
      raw: bm[0],
      role: "QUANTITY",
      value: n * 1000,
      unit: "adet",
      evidence: [bm[0], "bin multiplier"],
      index: bm.index,
    });
    claim(bm.index, bm[0].length);
  }

  const qtyRe =
    /\b(bir|iki|üç|uc|1|2|3|\d+(?:[.,]\d+)*)\s*(adet|tane|kutu|paket|takım|takim|araçlık|araclik)\b/gi;
  let qm: RegExpExecArray | null;
  while ((qm = qtyRe.exec(text)) !== null) {
    if (isClaimed(qm.index, qm[0].length)) continue;
    const word = qm[1]!.toLocaleLowerCase("tr-TR");
    const map: Record<string, number> = { bir: 1, iki: 2, üç: 3, uc: 3 };
    const value = map[word] ?? parseTrInt(word);
    if (!Number.isFinite(value)) continue;
    results.push({
      raw: qm[0],
      role: "QUANTITY",
      value,
      unit: qm[2]!.toLocaleLowerCase("tr-TR"),
      evidence: [qm[0], "unit-backed quantity"],
      index: qm.index,
    });
    claim(qm.index, qm[0].length);
  }

  // Print / packing: "5000 broşür", "2000 kartvizit" (unit implied by product noun)
  const productQtyRe =
    /\b(\d{2,}(?:[.,]\d+)*)\s*(broşür|brosur|kartvizit|etiket|afiş|afis|katalog|poster|flayer|flyer|kutu|ambalaj|davetiye)\b/gi;
  let pqm: RegExpExecArray | null;
  while ((pqm = productQtyRe.exec(text)) !== null) {
    if (isClaimed(pqm.index, pqm[1]!.length)) continue;
    const value = parseTrInt(pqm[1]!);
    if (!Number.isFinite(value) || value < 2) continue;
    results.push({
      raw: pqm[0],
      role: "QUANTITY",
      value,
      unit: "adet",
      evidence: [pqm[0], "product-noun quantity"],
      index: pqm.index,
    });
    claim(pqm.index, pqm[0].length);
  }

  const yearRe = /\b((?:19|20)\d{2})\b/g;
  let ym: RegExpExecArray | null;
  while ((ym = yearRe.exec(text)) !== null) {
    if (isClaimed(ym.index, ym[0].length)) continue;
    const year = Number(ym[1]);
    const window = lower.slice(Math.max(0, ym.index - 12), ym.index + 20);
    const yearish =
      /model|yıl|yil|sonrası|sonrasi|üstü|ustu|öncesi|oncesi|ama/.test(window) ||
      (year >= 1980 && year <= 2035);
    if (!yearish) continue;
    results.push({
      raw: ym[0],
      role: "MODEL_YEAR",
      value: year,
      evidence: [ym[0], window.trim()],
      index: ym.index,
    });
    claim(ym.index, ym[0].length);
  }

  // --- Model identity tokens (alphanumeric preferred; skip pure digits) ---

  const hyphenModel = /\b([a-z]{1,4}-\d+[a-z0-9-]*)\b/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hyphenModel.exec(text)) !== null) {
    if (isClaimed(hm.index, hm[0].length)) continue;
    results.push({
      raw: hm[0],
      role: "MODEL_IDENTIFIER",
      evidence: ["hyphenated-model-token"],
      index: hm.index,
    });
    claim(hm.index, hm[0].length);
  }

  for (const token of extractModelIdentityTokens(text)) {
    const compact = token.normalized.replace(/[^a-z0-9]/gi, "");
    // Pure numeric tokens are ambiguous — only keep if not already claimed
    // and look like series codes (not large quantities)
    if (/^\d+$/.test(compact)) {
      continue;
    }
    const idx = lower.indexOf(token.normalized);
    const rawLower = token.raw.toLocaleLowerCase("tr-TR");
    let at = text.toLocaleLowerCase("tr-TR").indexOf(rawLower);
    if (at < 0) at = idx >= 0 ? idx : -1;
    if (at < 0) continue;
    if (isClaimed(at, token.raw.length)) continue;
    results.push({
      raw: token.raw,
      role: "MODEL_IDENTIFIER",
      evidence: [`model-token:${token.class}`, token.family],
      index: at,
    });
    claim(at, Math.max(1, token.raw.length));
  }

  const alphaNum = /\b([a-z]{1,4}\d+[a-z0-9-]*)\b/gi;
  let am: RegExpExecArray | null;
  while ((am = alphaNum.exec(text)) !== null) {
    if (isClaimed(am.index, am[0].length)) continue;
    results.push({
      raw: am[0],
      role: "MODEL_IDENTIFIER",
      evidence: ["alphanumeric-token"],
      index: am.index,
    });
    claim(am.index, am[0].length);
  }

  // Bare number after alphabetic brand/product token → MODEL_IDENTIFIER candidate
  const bareAfterAlpha = /\b([a-zçğıöşü]{3,})\s+(\d{1,4})\b/gi;
  let bam: RegExpExecArray | null;
  while ((bam = bareAfterAlpha.exec(text)) !== null) {
    const numStart = bam.index + bam[1]!.length + 1;
    if (isClaimed(numStart, bam[2]!.length)) continue;
    const head = bam[1]!.toLocaleLowerCase("tr-TR");
    const foldedHead = head
      .replace(/\u0131/g, "i")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (
      /adet|tane|kutu|fiyat|tl|kira|butce[mn]?|butcesi|butcemiz|km|m2|bin|gram|ofis|metre/.test(
        foldedHead,
      )
    ) {
      continue;
    }
    // Talep fiili/bağlacından sonra gelen yalın sayı model olamaz — modeller
    // marka/ürün jetonunu izler ("Arçelik 55"), fiili değil ("arıyorum 6").
    if (
      /^(?:ariyorum|araniyor|arayis\w*|lazim|istiyorum|bakiyorum|bakiyom|gerekiyor|olsun|icin)$/.test(
        foldedHead,
      )
    ) {
      continue;
    }
    results.push({
      raw: bam[2]!,
      role: "MODEL_IDENTIFIER",
      value: Number(bam[2]),
      evidence: [`after-token:${bam[1]}`, "bare-number-not-quantity"],
      index: numStart,
    });
    claim(numStart, bam[2]!.length);
  }

  // Remaining bare numbers → OTHER (never auto QUANTITY)
  const bare = /\b(\d+(?:[.,]\d+)*)\b/g;
  let other: RegExpExecArray | null;
  while ((other = bare.exec(text)) !== null) {
    if (isClaimed(other.index, other[0].length)) continue;
    results.push({
      raw: other[0],
      role: "OTHER",
      value: parseTrInt(other[1]!),
      evidence: ["unclassified-number"],
      index: other.index,
    });
  }

  return results;
}

export function primaryQuantity(
  numbers: ClassifiedNumber[],
): ClassifiedNumber | undefined {
  return numbers.find((n) => n.role === "QUANTITY" && n.value != null);
}

export function primaryYear(
  numbers: ClassifiedNumber[],
): ClassifiedNumber | undefined {
  return numbers.find((n) => n.role === "MODEL_YEAR" && n.value != null);
}

/** Calendar year token — never a brand/model identity by itself. */
export function looksLikeYearToken(value: string | null | undefined): boolean {
  return /^(19|20)\d{2}$/.test(String(value ?? "").trim());
}

export function modelIdentifierTokens(
  numbers: ClassifiedNumber[],
): ClassifiedNumber[] {
  return numbers.filter((n) => n.role === "MODEL_IDENTIFIER");
}

/**
 * MODEL KANIT KAPISI — marka kanıt sisteminin (RC_BRAND) model ikizi.
 *
 * Exact model yalnız güvenilir kanıttan geçer:
 *   1. Katalog doğrulaması (otomotiv/teknoloji katalog modeli) — çağıran
 *      `catalogVerified` ile bildirir; "Clio", "Passat", "MacBook Pro" gibi
 *      sayısız katalog modelleri yalnız bu yoldan geçer.
 *   2. Sayı içeren jetonlar: jetonun kapladığı span, sayı otoritesinin
 *      model-dışı bir rolüyle (QUANTITY, WEIGHT, TIRE_SIZE, SEATING,
 *      SCREEN_SIZE, CAPACITY, …) çakışıyorsa model DEĞİLDİR
 *      ("lastiği 205/55 R16", "6 kişilik").
 *   3. Yalın sayı jetonu ("6", "100", "55") yalnız sayı otoritesi onu
 *      MODEL_IDENTIFIER saydıysa model olabilir ("Arçelik 55" değil ama
 *      "iPhone 15" evet).
 *   4. Sayısız ve katalogsuz jeton ("tezgahı") model olamaz — bir ürün
 *      türü ekidir, model kimliği değildir.
 *
 * Girdide GEÇMEYEN türetilmiş katalog modelleri (ör. zenginleştirmeden gelen
 * "Galaxy A55") 2. kuralın kapsamına girmez: span çakışması ancak jeton
 * metinde bulunduğunda ölçülebilir.
 */
export type ModelTokenEvidence = "VERIFIED_MODEL" | "REJECTED";

const NON_MODEL_CLAIM_ROLES: ReadonlySet<string> = new Set([
  "MODEL_YEAR",
  "ROOM_LAYOUT",
  "QUANTITY",
  "WEIGHT",
  "DIMENSION",
  "MILEAGE",
  "CAPACITY",
  "AREA",
  "PRICE",
  "STORAGE",
  "SCREEN_SIZE",
  "TIRE_SIZE",
  "SEATING",
]);

export function classifyModelTokenEvidence(
  normalizedText: string,
  candidate: unknown,
  opts?: { catalogVerified?: boolean },
): ModelTokenEvidence {
  const token = String(candidate ?? "").trim();
  if (!token) return "REJECTED";
  if (opts?.catalogVerified) return "VERIFIED_MODEL";
  if (!/\d/.test(token)) return "REJECTED";

  const numbers = classifyNumbers(normalizedText);
  const lowerText = normalizedText.toLocaleLowerCase("tr-TR");

  if (/^\d+(?:[.,]\d+)*$/.test(token)) {
    return numbers.some(
      (n) => n.role === "MODEL_IDENTIFIER" && n.raw === token,
    )
      ? "VERIFIED_MODEL"
      : "REJECTED";
  }

  /**
   * Jeton bitişik geçmeyebilir ("lastiği 205/55 R16" araya fiil girer);
   * bu yüzden çakışma denetimi KELİME bazında yapılır: sayı taşıyan her
   * kelimenin metindeki hiçbir serbest (model-dışı role kapılmamış)
   * geçişi yoksa jeton model olamaz.
   */
  const overlapsNonModelClaim = (start: number, end: number): boolean =>
    numbers.some(
      (n) =>
        NON_MODEL_CLAIM_ROLES.has(String(n.role)) &&
        n.index < end &&
        start < n.index + n.raw.length,
    );
  const isBoundary = (i: number): boolean => {
    if (i < 0 || i >= lowerText.length) return true;
    return !/[\p{L}\p{N}]/u.test(lowerText[i]!);
  };
  for (const word of token.toLocaleLowerCase("tr-TR").split(/\s+/)) {
    if (!/\d/.test(word)) continue;
    let hasFreeOccurrence = false;
    let seen = false;
    let at = lowerText.indexOf(word);
    while (at >= 0) {
      const end = at + word.length;
      if (isBoundary(at - 1) && isBoundary(end)) {
        seen = true;
        if (!overlapsNonModelClaim(at, end)) {
          hasFreeOccurrence = true;
          break;
        }
      }
      at = lowerText.indexOf(word, end);
    }
    if (seen && !hasFreeOccurrence) return "REJECTED";
  }
  return "VERIFIED_MODEL";
}
