import type { RequestIntent, SubjectKind } from "./types";

/**
 * İŞLEM KANIT SINIFI (KB-16).
 *
 * Bir cümlede işlem türünü ele veren ifadeler eşit ağırlıkta değildir. Üç
 * ayrı kanıt sınıfı vardır ve güçlü olan zayıf olanı yener:
 *
 *   EXPLICIT_TRANSACTION  Kullanıcının YAPMAK İSTEDİĞİ işlemi adlandırır:
 *                         "kiralamak", "kiralama", "kiraya vermek", "satmak",
 *                         "satın almak". Fiil de ad da olabilir; ikisi de
 *                         aynı kanıttır.
 *   LISTING_ADJECTIVE     Nesnenin İLAN DURUMUNU betimler: "kiralık",
 *                         "satılık". Kullanıcının işlemini DEĞİL, aradığı
 *                         nesnenin ne olarak sunulduğunu söyler.
 *   GENERIC_SEEK          Yalnız arama eylemi: "arıyorum", "lazım",
 *                         "bakıyorum". Hangi işlem olduğunu SÖYLEMEZ.
 *
 * Ölçülen hata (KB-16) tam olarak bu ayrımın yokluğuydu: "filo kiralama
 * arıyorum" cümlesinde sondaki GENERIC_SEEK fiili, açık kiralama ifadesini
 * yenip talebi satın alma havuzuna düşürüyordu.
 */
export type IntentEvidenceClass =
  | "EXPLICIT_TRANSACTION"
  | "LISTING_ADJECTIVE"
  | "GENERIC_SEEK";

const EVIDENCE_TIER: Record<IntentEvidenceClass, number> = {
  EXPLICIT_TRANSACTION: 3,
  LISTING_ADJECTIVE: 2,
  GENERIC_SEEK: 1,
};

/**
 * İŞLEM EKSENİ. Bu üç niyet aynı sorunun ("hangi işlem?") yanıtıdır ve
 * aralarında kanıt sınıfı yarışır. PART/SERVICE/MANUFACTURE ayrı eksenlerdir
 * (talebin NESNESİ hakkındadır) ve bu yarışa girmezler — davranışları
 * değişmez.
 */
const TRANSACTION_AXIS: ReadonlySet<RequestIntent> = new Set<RequestIntent>([
  "BUY",
  "RENT",
  "SELL",
]);

export type IntentSignalHit = {
  intent: RequestIntent;
  evidence: string;
  weight: number;
  /** Alan adı gibi tek başına karar taşıyamayan sinyal (bkz. Lexicon.weak). */
  weak?: boolean;
  /** İşlem ekseni sinyallerinde kanıt sınıfı (bkz. IntentEvidenceClass). */
  evidenceClass?: IntentEvidenceClass;
};

type Lexicon = {
  intent: RequestIntent;
  patterns: RegExp[];
  weight: number;
  /**
   * ZAYIF SİNYAL (1F): alanın ADINI taşır, NİYETİ değil.
   *
   * "matbaa" bir sektör adıdır; "matbaa makinesi için kontrol paneli
   * arıyorum" bir üretim talebi değil, uyumluluk talebidir. Ölçülen hata tam
   * olarak buydu: alan adı tek başına MANUFACTURE seçtiriyor, konu
   * MANUFACTURED_ITEM oluyor ve profesyonel metin "arıyorum."e düşüyordu.
   *
   * Zayıf sinyal skora katkı verir ama TEK BAŞINA bir niyet seçtiremez;
   * yanında en az bir açık kanıt bulunmalıdır. Kural ada özel değildir ve
   * herhangi bir niyet için kullanılabilir.
   */
  weak?: boolean;
  evidenceClass?: IntentEvidenceClass;
};

const LEXICON: Lexicon[] = [
  {
    intent: "PART",
    weight: 1.2,
    patterns: [
      // Avoid trailing \b after Turkish letters (JS \w is ASCII-only)
      /parças[ıi]/i,
      /parcas[ıi]/i,
      /\bparça(?=\s|$|[,.])/i,
      /\bparca(?=\s|$|[,.])/i,
      /yedek\s*parça/i,
      /yedek\s*parca/i,
      /\bfiltresi?\b/i,
      /\bbalata\b/i,
      /\blastik\b/i,
      /\bjant\b/i,
    ],
  },
  {
    intent: "SERVICE",
    weight: 1.15,
    patterns: [
      /\byaptır(?:acağım|acagim|cam|acağız|acagiz)?\b/i,
      /\byaptir(?:acagim|cam)?\b/i,
      /\bboyat(?:acağım|acagim|acam|acağız)?\b/i,
      /\bboyat(?:acam)?\b/i,
      /\bkaplat/i,
      /\bbakım\b/i,
      /\bbakim\b/i,
      /\bonarım\b/i,
      /\bonarim\b/i,
      /\btamir\b/i,
      /\bservis\b/i,
      /\bmontaj\b/i,
      /\btemizlik\b/i,
      /\brenovasyon\b/i,
      /\btadilat\b/i,
    ],
  },
  {
    // AÇIK üretim kanıtı — üretim fiili ya da üretim biçiminin adı.
    intent: "MANUFACTURE",
    weight: 1.2,
    patterns: [
      /\bbastır(?:acağım|acagim|cam)?\b/i,
      /\bbastir(?:acagim|cam)?\b/i,
      // JS \b ASCII-only: Türkçe harften önce sınır olarak kullanılamaz.
      /(?:^|[^\p{L}\p{N}])ürettir/iu,
      /(?:^|[^\p{L}\p{N}])urettir/iu,
      /(?:^|[^\p{L}\p{N}])üret(?:mek|im|ece\w*|iyorum)/iu,
      /(?:^|[^\p{L}\p{N}])uret(?:mek|im|ece\w*|iyorum)/iu,
      /\bimalat\b/i,
      /\bimal\s+(?:et\w*|edil\w*)/i,
      /\bfason\b/i,
      // "N adet … yaptırmak/ürettirmek" — adet + üretim bağlamı.
      /(?:\d[\d.]*\s*(?:adet|bin|tane))[\s\S]{0,40}?(?:yaptır|yaptir|ürettir|urettir|imal|üret|uret)/i,
    ],
  },
  {
    // ZAYIF: sektör/alan adı. Tek başına üretim niyeti seçtiremez.
    intent: "MANUFACTURE",
    weight: 0.6,
    weak: true,
    patterns: [/\bbaskı\b/i, /\bbaski\b/i, /\bmatbaa\b/i],
  },

  /* --------------------- İŞLEM EKSENİ (KB-16) --------------------- */

  {
    /**
     * AÇIK KİRALAMA İFADESİ — TALEP tarafı.
     *
     * Fiil ("kiralamak") ve ad ("kiralama") aynı kanıttır: KB-16'da ölçülen
     * hata, adın hiç tanınmaması ve cümlenin sonundaki arama fiiline
     * yenilmesiydi. "kiralık" burada YOKTUR; o bir ilan sıfatıdır ve aşağıda
     * ayrı sınıfta ele alınır.
     */
    intent: "RENT",
    weight: 1.4,
    evidenceClass: "EXPLICIT_TRANSACTION",
    patterns: [
      /(?:^|[^\p{L}\p{N}])kirala(?:ma|mak|yacağım|yacagim|yacağız|yacagiz|rım|rim)/iu,
      /(?:^|[^\p{L}\p{N}])kiralaya(?:cak|bilece)/iu,
      /\baylık\s*kira\b/i,
      /\baylik\s*kira\b/i,
    ],
  },
  {
    /**
     * AÇIK ELDEN ÇIKARMA — ARZ tarafı.
     *
     * "kiraya vermek" kiralamak DEĞİLDİR: kullanıcı kiracı değil, mülk
     * sahibidir. Talepo'da arz yönünü taşıyan mevcut niyet SELL'dir; bu
     * yüzden yön SELL olarak yazılır ve hangi ilanın verildiği `listingType`
     * alanında ("Kiralık"/"Satılık") ayrıca korunur. Birinci sınıf bir LET
     * niyeti eklemek ayrı bir karardır; bu dilimde enum genişletilmedi.
     */
    intent: "SELL",
    weight: 1.4,
    evidenceClass: "EXPLICIT_TRANSACTION",
    patterns: [
      /(?:^|[^\p{L}\p{N}])kiraya\s+ver/iu,
      // Kişi/sayı çekimleri tek kalıpta: istiyorum / istiyoruz / istiyor.
      // ("Makinemizi satmak istiyoruz" yalnız tekil kalıp yüzünden hiçbir
      //  sinyal üretmiyordu — ölçüldü.)
      /\bsatmak\s+isti(?:yorum|yoruz|yor)\b/i,
      /\bsat(?:ıyorum|iyorum|ıyoruz|iyoruz)\b/i,
      /\bsat(?:acağım|acagim|acağız|acagiz)\b/i,
      /\bsatışa\s*çıkar/i,
      /\bsatisa\s*cikar/i,
      /\bsatılığa\s*çıkar/i,
      /\bsatiliga\s*cikar/i,
      /\belden\s*çıkar/i,
      /\belden\s*cikar/i,
    ],
  },
  {
    // AÇIK EDİNME — talep tarafı, işlem adlandırılmış.
    intent: "BUY",
    weight: 1.3,
    evidenceClass: "EXPLICIT_TRANSACTION",
    patterns: [/\bsatın\s*al/i, /\bsatin\s*al/i, /\balmak\s*istiyorum\b/i],
  },
  {
    /**
     * İLAN SIFATI — nesnenin sunuluş biçimi, kullanıcının işlemi değil.
     *
     * Talepo bir TALEP platformudur: "kiralık X" arayan kişi kiracıdır
     * (RENT), "satılık X" arayan kişi alıcıdır (BUY). Sıfat, açık bir işlem
     * ifadesi varsa ona yenilir — "kiralık aracımı satmak istiyorum"
     * cümlesinde istenen işlem SATMAKTIR.
     */
    intent: "RENT",
    weight: 1.1,
    evidenceClass: "LISTING_ADJECTIVE",
    patterns: [/\bkiralık\b/i, /\bkiralik\b/i],
  },
  {
    intent: "BUY",
    weight: 1.1,
    evidenceClass: "LISTING_ADJECTIVE",
    patterns: [/\bsatılık\b/i, /\bsatilik\b/i],
  },
  {
    // GENEL ARAMA — işlem türünü SÖYLEMEZ; yalnız talep yönünü ima eder.
    intent: "BUY",
    weight: 0.9,
    evidenceClass: "GENERIC_SEEK",
    patterns: [
      /\barıyorum\b/i,
      /\bariyorum\b/i,
      /\bbakıyorum\b/i,
      /\bbakiyorum\b/i,
      /\bbakıyom\b/i,
      /\bbakiyom\b/i,
      /\blazım\b/i,
      /\blazim\b/i,
      /\bteklif\s*istiyorum\b/i,
    ],
  },
];

const NEGATIONS: Array<{ intent: RequestIntent; patterns: RegExp[] }> = [
  {
    intent: "SERVICE",
    patterns: [
      /\bservis\s*istemiyorum\b/i,
      /\bbakım\s*istemiyorum\b/i,
      /\bbakim\s*istemiyorum\b/i,
      /\btamir\s*istemiyorum\b/i,
    ],
  },
  {
    intent: "PART",
    patterns: [
      /\bparça\s*değil\b/i,
      /\bparca\s*degil\b/i,
      /\byedek\s*parça\s*değil\b/i,
      /\bparça\s*aramıyorum\b/i,
      /\bkomple\s+(?:cihaz|makine|araç|arac)\b/i,
      /\bkendisini\s*arıyorum\b/i,
    ],
  },
];

/**
 * KULLANIM BAĞLAMI İŞLEMİ BELİRLEYEMEZ (KB-16; I25/I45 ile aynı ilke).
 *
 * "Kiralık makine için bakım arıyorum" cümlesinde "kiralık" SOLDAKİ kullanım
 * bağlamını niteler; istenen şey bakımdır. Bu yüzden yalnız bağlamda geçip
 * istenen hedefte geçmeyen işlem belirteçleri karar veremez.
 *
 * Kural muhafazakârdır: bir belirteç hedefte bulunamıyor AMA bağlamda da
 * bulunamıyorsa (ayrıştırma kırpması) sinyal KORUNUR — kanıt yokluğu bir ret
 * değildir. İlişkinin iki yakası burada YENİDEN çözülmez; tek yetkili
 * `readUsageContextSplit` sonucundan çağıran tarafından geçirilir.
 */
export type IntentScope = {
  /** `readUsageContextSplit` sonucunun sol yakası (kullanım bağlamı). */
  usageContext?: string | null;
  /** `readUsageContextSplit` sonucunun sağ yakası (istenen hedef). */
  requestedTarget?: string | null;
};

export function collectIntentSignals(
  normalizedText: string,
  scope?: IntentScope,
): IntentSignalHit[] {
  const hits: IntentSignalHit[] = [];
  const negated = new Set<RequestIntent>();

  for (const neg of NEGATIONS) {
    for (const p of neg.patterns) {
      if (p.test(normalizedText)) negated.add(neg.intent);
    }
  }

  const context = scope?.usageContext ?? null;
  const target = scope?.requestedTarget ?? null;
  const scoped = context != null && target != null;

  for (const entry of LEXICON) {
    if (negated.has(entry.intent)) continue;
    for (const p of entry.patterns) {
      const m = normalizedText.match(p);
      if (!m) continue;
      if (
        scoped &&
        TRANSACTION_AXIS.has(entry.intent) &&
        p.test(context as string) &&
        !p.test(target as string)
      ) {
        // Yalnız kullanım bağlamında geçen işlem belirteci karar veremez.
        continue;
      }
      hits.push({
        intent: entry.intent,
        evidence: m[0],
        weight: entry.weight,
        weak: entry.weak,
        evidenceClass: entry.evidenceClass,
      });
    }
  }

  return hits;
}

export function resolveIntentFromSignals(
  hits: IntentSignalHit[],
): {
  intent: RequestIntent;
  confidence: number;
  evidence: string[];
} {
  if (hits.length === 0) {
    return { intent: "UNKNOWN", confidence: 0.2, evidence: [] };
  }

  /**
   * KANIT SINIFI ÖNCELİĞİ (KB-16): işlem ekseninde en güçlü kanıt sınıfı
   * kazanır. Açık işlem ifadesi varsa ilan sıfatı ve genel arama fiili işlem
   * türünü belirleyemez; ilan sıfatı varsa genel arama fiili belirleyemez.
   * Skor yalnız AYNI sınıf içinde yarışır. PART/SERVICE/MANUFACTURE bu
   * elemeden etkilenmez.
   */
  let topTier = 0;
  for (const hit of hits) {
    if (!TRANSACTION_AXIS.has(hit.intent)) continue;
    const tier = EVIDENCE_TIER[hit.evidenceClass ?? "GENERIC_SEEK"];
    if (tier > topTier) topTier = tier;
  }
  const effective = hits.filter((hit) => {
    if (!TRANSACTION_AXIS.has(hit.intent)) return true;
    return EVIDENCE_TIER[hit.evidenceClass ?? "GENERIC_SEEK"] >= topTier;
  });

  const scores = new Map<
    RequestIntent,
    { score: number; evidence: string[]; strong: number }
  >();
  for (const hit of effective) {
    const cur = scores.get(hit.intent) ?? { score: 0, evidence: [], strong: 0 };
    cur.score += hit.weight;
    cur.evidence.push(hit.evidence);
    if (!hit.weak) cur.strong += 1;
    scores.set(hit.intent, cur);
  }

  /**
   * ZAYIF-SİNYAL KAPISI (1F): bir niyet yalnız alan adı gibi zayıf kanıtlarla
   * SEÇİLEMEZ. Zayıf sinyal skoru korur (açık kanıt varsa onu güçlendirir)
   * ama tek başına kararı taşıyamaz.
   */
  for (const [intent, row] of [...scores]) {
    if (row.strong === 0) scores.delete(intent);
  }
  if (scores.size === 0) {
    return { intent: "UNKNOWN", confidence: 0.2, evidence: [] };
  }

  // Priority when close: PART/SERVICE/MANUFACTURE/RENT/SELL over generic BUY
  const priority: RequestIntent[] = [
    "PART",
    "SERVICE",
    "MANUFACTURE",
    "RENT",
    "SELL",
    "BUY",
    "UNKNOWN",
  ];

  let best: RequestIntent = "UNKNOWN";
  let bestScore = -1;
  for (const intent of priority) {
    const row = scores.get(intent);
    if (!row) continue;
    if (row.score > bestScore) {
      best = intent;
      bestScore = row.score;
    }
  }

  const evidence = scores.get(best)?.evidence ?? [];
  const confidence = Math.min(0.95, 0.45 + bestScore * 0.2);
  return { intent: best, confidence, evidence };
}

export function subjectKindForIntent(
  intent: RequestIntent,
  hints: {
    hasVehicleModel?: boolean;
    hasPropertySignals?: boolean;
    hasMachineSignals?: boolean;
    hasProductSignals?: boolean;
  },
): SubjectKind {
  if (intent === "PART") return "PART";
  if (intent === "SERVICE") return "SERVICE";
  if (intent === "MANUFACTURE") return "MANUFACTURED_GOOD";
  /**
   * İŞLEM TÜRÜ KONU TÜRÜNÜ ÜRETEMEZ (KB-16).
   *
   * Eski kural `intent === "RENT"` gördüğünde konuyu PROPERTY yapıyordu;
   * "Araç kiralamak istiyorum" ve "Forklift kiralamak istiyorum" talepleri bu
   * yüzden emlak konusuna düşüyordu. Kiralamak bir İŞLEMDİR, nesne değildir:
   * emlak kanıtı emlak nesnesinden gelir.
   */
  if (hints.hasPropertySignals) return "PROPERTY";
  if (hints.hasVehicleModel && (intent === "BUY" || intent === "UNKNOWN")) {
    return "VEHICLE";
  }
  if (hints.hasMachineSignals) return "MACHINE";
  if (hints.hasProductSignals || intent === "BUY") return "PRODUCT";
  return "UNKNOWN";
}

/** Map canonical intent → strategy needType field when applicable */
export function needTypeForIntent(
  intent: RequestIntent,
  subject: SubjectKind,
): string | null {
  if (intent === "PART") return "part";
  if (intent === "SERVICE") return "service";
  if (subject === "VEHICLE" && intent === "BUY") return "vehicle";
  if (subject === "MACHINE" && intent === "BUY") return "machine";
  return null;
}
