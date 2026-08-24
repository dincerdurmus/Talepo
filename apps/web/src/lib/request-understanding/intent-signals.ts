import type { RequestIntent, SubjectKind } from "./types";

export type IntentSignalHit = {
  intent: RequestIntent;
  evidence: string;
  weight: number;
  /** Alan adı gibi tek başına karar taşıyamayan sinyal (bkz. Lexicon.weak). */
  weak?: boolean;
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
  {
    intent: "RENT",
    weight: 1.25,
    patterns: [
      /\bkiralık\b/i,
      /\bkiralik\b/i,
      /\bkiralamak\b/i,
      /\bkiraya\b/i,
      /\baylık\s*kira\b/i,
    ],
  },
  {
    intent: "SELL",
    weight: 1.1,
    patterns: [/\bsatılık\b/i, /\bsatilik\b/i, /\bsatmak\s*istiyorum\b/i],
  },
  {
    intent: "BUY",
    weight: 0.9,
    patterns: [
      /\barıyorum\b/i,
      /\bariyorum\b/i,
      /\bbakıyorum\b/i,
      /\bbakiyorum\b/i,
      /\bbakıyom\b/i,
      /\bbakiyom\b/i,
      /\blazım\b/i,
      /\blazim\b/i,
      /\bsatın\s*al/i,
      /\bsatin\s*al/i,
      /\bteklif\s*istiyorum\b/i,
      /\balmak\s*istiyorum\b/i,
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

export function collectIntentSignals(normalizedText: string): IntentSignalHit[] {
  const hits: IntentSignalHit[] = [];
  const negated = new Set<RequestIntent>();

  for (const neg of NEGATIONS) {
    for (const p of neg.patterns) {
      if (p.test(normalizedText)) negated.add(neg.intent);
    }
  }

  for (const entry of LEXICON) {
    if (negated.has(entry.intent)) continue;
    for (const p of entry.patterns) {
      const m = normalizedText.match(p);
      if (m) {
        hits.push({
          intent: entry.intent,
          evidence: m[0],
          weight: entry.weight,
          weak: entry.weak,
        });
      }
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

  const scores = new Map<
    RequestIntent,
    { score: number; evidence: string[]; strong: number }
  >();
  for (const hit of hits) {
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
  if (intent === "RENT" || hints.hasPropertySignals) return "PROPERTY";
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
