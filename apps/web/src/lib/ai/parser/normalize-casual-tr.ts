/**
 * Cheap casual Turkish normalization for request parsing.
 * Expands common abbreviations / typos and strips conversational slang
 * so category + product matching can see the real ask.
 */

const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  // Conversational fillers / slang openers (strip — keep product tokens)
  [/\bben\s+ne\s+arıyorum\b/gi, " "],
  [/\bben\s+ne\s+ariyorum\b/gi, " "],
  [/\bben\s+ne\s+arıyom\b/gi, " "],
  [/\bne\s+arıyorum\s+biliyo(?:r)?\s*musun\b/gi, " "],
  [/\bne\s+ariyorum\s+biliyo(?:r)?\s*musun\b/gi, " "],
  [/\bbiliyo(?:r)?\s*musun\b/gi, " "],
  [/\bbiliyosun\b/gi, " "],
  [/\bbiliyo\s*sun\b/gi, " "],
  [/\bbiliyor\s*musunuz\b/gi, " "],
  [/\b(anladın|anladin)\s*mı\b/gi, " "],
  [/\b(anladın|anladin)\s*mi\b/gi, " "],
  [/\b(valla|vallahi)\b/gi, " "],
  [/\b(yani|işte|iste)\b/gi, " "],
  [/\b(baba|abi|kanka|lan|moruk|kral)\b/gi, " "],
  [/\bşey\b/gi, " "],
  [/\bsey\b/gi, " "],
  // Lone filler "ya" (not part of product tokens)
  [/(?:^|\s)ya(?:\s|$)/gi, " "],

  // Preference slang → corporate cues (kept for attribute detection)
  [/\bucuz\s+olsun\b/gi, "uygun fiyatlı"],
  [/\bucuza\b/gi, "uygun fiyatlı"],
  [/\btemiz\s+olsun\b/gi, "temiz durumda"],
  [/\biyi\s+olsun\b/gi, "iyi durumda"],
  [/\bucuz\b/gi, "uygun fiyatlı"],

  // Condition / listing shorthand
  [/\b2\.?\s*el\b/gi, "ikinci el"],
  [/\bikinciel\b/gi, "ikinci el"],
  [/\b0\s*km\b/gi, "0 km"],
  [/\bsifir\b/gi, "sıfır"],
  [/\bhatasiz\b/gi, "hatasız"],
  [/\bboyasiz\b/gi, "boyasız"],
  [/\bsatilik\b/gi, "satılık"],
  [/\bkiralik\b/gi, "kiralık"],
  [/\bkirilik\b/gi, "kiralık"],
  [/\bno[\s-]?frost\b/gi, "no-frost"],
  [/\bnofrost\b/gi, "no-frost"],

  // Real-estate room slang
  [/\biki\s*artı\s*bir\b/gi, "2+1"],
  [/\büç\s*artı\s*bir\b/gi, "3+1"],
  [/\buc\s*arti\s*bir\b/gi, "3+1"],
  [/\bbir\s*artı\s*bir\b/gi, "1+1"],
  [/\b(\d)\s*arti\s*(\d)\b/gi, "$1+$2"],

  // Intent / verb typos & casual conjugations
  [/\barıyom\b/gi, "arıyorum"],
  [/\bariyom\b/gi, "arıyorum"],
  [/\bariyorum\b/gi, "arıyorum"],
  [/\bariyorm\b/gi, "arıyorum"],
  [/\barıyorm\b/gi, "arıyorum"],
  [/\bistiyom\b/gi, "istiyorum"],
  [/\bistiyorm\b/gi, "istiyorum"],
  [/\blazm\b/gi, "lazım"],
  [/\blazim\b/gi, "lazım"],
  [/\bsatin\s*al(mak|ıyorum|iyorum|ıyom|iyom)?\b/gi, "satın al"],

  // Product / category shorthand
  [/\byedek\s*prc\b/gi, "yedek parça"],
  [/\byedekprc\b/gi, "yedek parça"],
  [/\byedek\s*parca\b/gi, "yedek parça"],
  [/\bparcasi?\b/gi, "parça"],
  [/\barb\b/gi, "araba"],
  [/\barac\b/gi, "araç"],
  [/\botomtv\b/gi, "otomotiv"],
  [/\bbilg\b/gi, "bilgisayar"],
  [/\bpc\b/gi, "bilgisayar"],
  [/\blptp\b/gi, "laptop"],
  [/\bmoblya\b/gi, "mobilya"],
  [/\bsandaly\b/gi, "sandalye"],
  [/\byzm\b/gi, "yazılım"],
  [/\byazilim\b/gi, "yazılım"],
  [/\bmakina\b/gi, "makine"],
  [/\bbuzdolabi\b/gi, "buzdolabı"],
  [/\bcamasir\s*makinesi\b/gi, "çamaşır makinesi"],
  [/\bbulasik\s*makinesi\b/gi, "bulaşık makinesi"],
  [/\bofis\s*sandalyesi\b/gi, "ofis sandalyesi"],
  [/\bcalisma\s*masasi\b/gi, "çalışma masası"],
  [/\bkart\s*vizit\b/gi, "kartvizit"],
  [/\bbrosur\b/gi, "broşür"],
  [/\bafis\b/gi, "afiş"],
  [/\bkatalog\b/gi, "katalog"],
  [/\betiket\b/gi, "etiket"],

  // City shorthand (word-boundary only; keep high-confidence only)
  [/\bist\b/gi, "İstanbul"],
  [/\bankan\b/gi, "Ankara"],
  [/\bizm\b/gi, "İzmir"],
];

export function normalizeCasualTurkish(text: string): string {
  if (!text?.trim()) return text ?? "";

  let result = text;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  return result.replace(/\s+/g, " ").trim();
}
