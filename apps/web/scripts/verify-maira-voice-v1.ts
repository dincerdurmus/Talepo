/**
 * MAIRA SESİ — KAPILAR (kurucu kararı, 2026-09-12).
 *
 * Kilitlenen kural: Maira aynı soruyu sohbet diliyle (samimi, sen dili)
 * sorar; alan, sıra, seçenekler ve cevabın yazıldığı yer formla birebir
 * aynıdır. Söyleyiş TEK yerden (`maira-voice.ts`) gelir; Maira kendi
 * cümlesini yazmaz, form da Maira'nın cümlesini kullanmaz.
 *
 * Kapılar gerçek üretim zinciri üzerinde koşar: metin → syncFromText →
 * resolveHybridQuestions → scheduleComposerQuestions →
 * scheduledToFocusedQuestion. Ölçülen şey, Maira'nın gördüğü nesnenin
 * kendisidir.
 *
 * Çalıştırma: npx tsx scripts/verify-maira-voice-v1.ts
 */
import { readFileSync } from "node:fs";

import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";
import { syncFromText } from "../src/lib/request-composer/sync";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import {
  scheduleComposerQuestions,
  scheduledToFocusedQuestion,
  type FocusedQuestion,
} from "../src/lib/request-composer/v2/focused-questions";
import type { FieldAnswerState } from "../src/lib/request-composer/v2/question-scheduler";
import {
  mairaVoiceDictionaryKeys,
  toMairaVoice,
  toSenDili,
} from "../src/lib/request-composer/v2/maira-voice";
import { toResolverFieldBag } from "../src/lib/request-composer/build-state";
import { budgetDisplayFromUnderstanding } from "../src/lib/request-understanding/activation-bridge";
import type { CanonicalRequestState } from "../src/lib/request-composer/types";

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

ensureAutomotiveCatalogRegistered();
ensureTaxonomyLoaded();

/** "siz" dili izleri: -nız/-niz/-nuz/-nüz, -sunuz/-siniz, siz/sizin/size. */
const SIZ_RE = /(?:[aeıioöuü]n(?:ız|iz|uz|üz)|s[ıiuü]n(?:ız|iz|uz|üz))\b|\bsiz(?:in|e|i)?\b/i;
/** Ham İngilizce anahtar ya da camelCase sızıntısı. */
const RAW_KEY_RE = /\b[a-z]{2,}[A-Z][a-z]{2,}\b|\b(?:budget|city|delivery|brand|quantity|condition)\b/;

/** Üretimin zamanlayıcıya verdiği girdiyi birebir kurar (maira sözleşmesiyle aynı). */
function focusedFor(text: string): FocusedQuestion[] {
  const state: CanonicalRequestState = syncFromText(null, text).state;
  const hybrid = resolveHybridQuestions(state, {});
  /* Sayfa ile aynı bağlam: kanonik alanlar (ürün tipi dâhil) zamanlayıcıya
     gider; harness ürün bağlamını gizleyip profilleri susturmasın. */
  const values: Record<string, string | undefined> = {
    ...toResolverFieldBag(state),
  };
  values.city = values.city || (state.understanding.location?.city?.value ?? "");
  values.budget = values.budget || budgetDisplayFromUnderstanding(state.understanding);
  const fieldStates: Record<string, FieldAnswerState> = Object.fromEntries(
    Object.entries(state.fields).map(([key, field]) => [
      key,
      {
        kind: field.kind,
        value:
          field.kind === "VALUE"
            ? String(field.value ?? "")
            : field.kind === "ANY"
              ? "no_preference"
              : null,
        provenance: field.provenance ?? null,
      },
    ]),
  );
  const categoryId = state.categoryId ?? state.understanding.category.value ?? "unknown";
  const needType =
    state.fields.needType?.kind === "VALUE" ? String(state.fields.needType.value ?? "") : null;
  /* Bütçe ve konumu cevaplanmış say ki kategori soruları da görünsün. */
  const drained: FocusedQuestion[] = [];
  const answered = new Set<string>();
  for (let round = 0; round < 40; round += 1) {
    const result = scheduleComposerQuestions({
      categoryId,
      needType,
      candidates: hybrid.candidates,
      values,
      fieldStates,
      answeredKeys: answered,
    });
    if (result.visible.length === 0) break;
    const byKey = new Map(hybrid.candidates.map((c) => [c.fieldKey, c]));
    for (const q of result.visible) {
      if (answered.has(q.fieldKey)) continue;
      drained.push(
        scheduledToFocusedQuestion(q, byKey.get(q.fieldKey), { needType }),
      );
      answered.add(q.fieldKey);
      /* Cevaplanmış say: zorunlu alanlar değerle kapanır, sıradaki gelsin. */
      values[q.fieldKey] = values[q.fieldKey] || "x";
    }
  }
  return drained;
}

/* A — sen dili dönüşümü */
{
  const cases: Array<[string, string]> = [
    ["Bütçeniz nedir?", "Bütçen nedir?"],
    ["Hangi ilde arıyorsunuz?", "Hangi ilde arıyorsun?"],
    ["Ölçüleri biliyor musunuz?", "Ölçüleri biliyor musun?"],
    ["Ne zamana kadar ihtiyacınız var?", "Ne zamana kadar ihtiyacın var?"],
    ["Uzaktan hizmet sizin için uygun mu?", "Uzaktan hizmet senin için uygun mu?"],
    ["Selefon ister misin?", "Selefon ister misin?"],
    ["Kaç kVA güç lazım?", "Kaç kVA güç lazım?"],
  ];
  for (const [inp, exp] of cases) {
    check(`A sen dili: ${inp}`, toSenDili(inp) === exp, toSenDili(inp));
  }
}

/* B — sözlük: sen dili, İngilizce yok, soru işareti var */
{
  const d = mairaVoiceDictionaryKeys();
  check("B1 sözlük boş değil", d.byKey.length >= 40 && d.byCategoryKey.length >= 10);
  const all: Array<[string, string]> = [
    ...d.byKey.map((k) => [k, toMairaVoice({ fieldKey: k, prompt: "" })] as [string, string]),
    ...d.byCategoryKey.map((ck) => {
      const [cat, key] = ck.split(":");
      return [ck, toMairaVoice({ fieldKey: key, prompt: "", categoryId: cat })] as [string, string];
    }),
  ];
  const sizLeaks = all.filter(([, v]) => SIZ_RE.test(v));
  check("B2 sözlükte siz dili yok", sizLeaks.length === 0, JSON.stringify(sizLeaks.slice(0, 5)));
  const rawLeaks = all.filter(([, v]) => RAW_KEY_RE.test(v));
  check("B3 sözlükte ham anahtar yok", rawLeaks.length === 0, JSON.stringify(rawLeaks.slice(0, 5)));
  const noQ = all.filter(([, v]) => !/\?/.test(v));
  check("B4 her söyleyiş bir soru", noQ.length === 0, JSON.stringify(noQ.slice(0, 5)));
  /* Sözlük anahtarları gerçek alanlar olmalı; hayalet anahtar birikmesin. */
  const profiles = readFileSync("src/lib/request-composer/v2/question-profiles.ts", "utf8");
  const engine = readFileSync("src/lib/request-category-engine.ts", "utf8");
  const core = readFileSync("src/lib/request-composer/v2/global-core-profile.ts", "utf8");
  const known = (k: string) =>
    new RegExp(`(fieldKey|key):\\s*"${k}"`).test(profiles) ||
    new RegExp(`(fieldKey|key):\\s*"${k}"`).test(engine) ||
    new RegExp(`fieldKey:\\s*"${k}"`).test(core);
  const ghosts = [
    ...d.byKey.filter((k) => !known(k)),
    ...d.byCategoryKey.map((ck) => ck.split(":")[1]).filter((k) => !known(k)),
  ];
  check("B5 sözlükte hayalet alan yok", ghosts.length === 0, ghosts.join(","));
}

/* C — üretim zinciri: her görünen soru Maira sesine sahip, alan aynı */
const SCENARIOS: Array<{ text: string; category: string }> = [
  { text: "Arçelik televizyon arıyorum", category: "technology" },
  { text: "no-frost buzdolabı arıyorum", category: "appliances" },
  { text: "Kadıköy'de kiralık 2+1 daire arıyorum", category: "real-estate" },
  { text: "500 adet kartvizit bastırmak istiyorum", category: "printing" },
  { text: "BMW 320i için fren balatası arıyorum", category: "automotive" },
  { text: "araba lastiği arıyorum", category: "automotive" },
  { text: "evime boya badana yaptıracağım", category: "services" },
  { text: "ofis için toplantı masası arıyorum", category: "furniture" },
  { text: "bebek arabası arıyorum", category: "baby" },
  { text: "forklift arıyorum", category: "machinery" },
  { text: "stok takip yazılımı yaptırmak istiyorum", category: "technology" },
];
let totalQuestions = 0;
let dictionaryHits = 0;
for (const sc of SCENARIOS) {
  const qs = focusedFor(sc.text);
  totalQuestions += qs.length;
  check(`C0 ${sc.text}: soru var`, qs.length > 0, String(qs.length));
  const missing = qs.filter((q) => !q.mairaPrompt || !q.mairaPrompt.trim());
  check(`C1 ${sc.text}: her sorunun Maira sesi var`, missing.length === 0, missing.map((q) => q.fieldKey).join(","));
  const same = qs.filter((q) => q.mairaPrompt === q.humanPrompt);
  check(
    `C2 ${sc.text}: Maira formla aynı cümleyi kullanmaz`,
    same.length === 0,
    same.map((q) => `${q.fieldKey}=${q.humanPrompt}`).join(" | "),
  );
  const siz = qs.filter((q) => SIZ_RE.test(q.mairaPrompt ?? ""));
  check(`C3 ${sc.text}: siz dili yok`, siz.length === 0, siz.map((q) => q.mairaPrompt).join(" | "));
  const raw = qs.filter((q) => RAW_KEY_RE.test(q.mairaPrompt ?? ""));
  check(`C4 ${sc.text}: ham anahtar yok`, raw.length === 0, raw.map((q) => q.mairaPrompt).join(" | "));
  /* Aynı nesne: alan, seçenek ve önem Maira için değişmez. */
  const recomputed = qs.map((q) =>
    toMairaVoice({ fieldKey: q.fieldKey, prompt: q.humanPrompt ?? "", categoryId: q.categoryId, importance: q.importance }),
  );
  check(
    `C5 ${sc.text}: söyleyiş deterministik ve alana bağlı`,
    recomputed.every((p, i) => p === qs[i].mairaPrompt),
  );
  for (const q of qs) {
    const generic = /^(Peki,|Bir de şunu sorayım:|Şunu da sorayım:|Bir de:|Peki .+ için ne düşünüyorsun\?$|Bir detay daha)/.test(q.mairaPrompt ?? "");
    if (!generic) dictionaryHits += 1;
  }
  console.log(`   ${sc.text} → ${qs.map((q) => `${q.fieldKey}: "${q.mairaPrompt}"`).join(" | ")}`);
}
console.log(`   sözlükten gelen: ${dictionaryHits}/${totalQuestions}`);
check("C6 soruların çoğu sözlükten geliyor", totalQuestions > 0 && dictionaryHits / totalQuestions >= 0.6, `${dictionaryHits}/${totalQuestions}`);

/* D — kaynak kapıları: tek yer, iki yüzey ayrı söyleyiş */
{
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const read = (p: string) => strip(readFileSync(p, "utf8"));
  const maira = read("src/components/request/maira/MairaStage.tsx");
  const panel = read("src/components/request/v2/FocusedQuestionsPanel.tsx");
  const focused = read("src/lib/request-composer/v2/focused-questions.ts");
  const voice = read("src/lib/request-composer/v2/maira-voice.ts");
  check("D1 Maira mairaPrompt okur", /active\.mairaPrompt/.test(maira));
  check("D2 form Maira sesini kullanmaz", !/mairaPrompt/.test(panel));
  check("D3 söyleyiş yalnız focused-questions'ta üretilir", /toMairaVoice\(/.test(focused) && !/toMairaVoice|maira-voice/.test(maira));
  check("D4 maira-voice saf: motor ya da profil import etmez", !/from "@\/lib\/request-category-engine|question-profiles|understand-request/.test(voice));
  check("D5 Maira'da elle yazılmış soru cümlesi yok", !/aklında ne var|Aşağı yukarı/.test(maira));
}

console.log(`verify-maira-voice-v1: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const e of errors) console.log(" - " + e);
  process.exit(1);
}
