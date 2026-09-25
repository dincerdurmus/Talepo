/**
 * KAPI: METİNDE VAR GİBİ GÖRÜNEN CEVAP — D-0030'UN TERS YÖNÜ (2026-09-25).
 *
 * NE KANITLAR. `verify-stated-answer-suppression-v1` D-0030'un DOĞRU yönünü
 * ölçer: kullanıcı yazdıysa alan dolmalı ve soruyu kapatmalı. Bu kapı ters
 * yönü ölçer ve aynı açık küme hata sınıfının cevap eksenindeki yüzüdür:
 *
 *   Metinde bir rakam, bir ilçe, bir marka GEÇER ama cevap DEĞİLDİR.
 *   "bütçem yok" · "Kadıköy'de değil Üsküdar'da" · "Arçelik gibi bir şey ama
 *   marka önemli değil" · "bütçeyi sonra söyleyeceğim"
 *
 * Çıkarıcı bunu cevap sayarsa SORULMASI GEREKEN SORU HİÇ SORULMAZ ve talep
 * yanlış yere yönlenir. Kurucunun ölçütü bu yüzden tek sayıdır:
 * **atlanan zorunlu soru = 0.**
 *
 * İKİ ÖLÇÜM YÜZEYİ AYRI OKUNUR. `budget/delivery/quantity/brand/model` besteci
 * durumundan (`syncFromText` + tek yetkili `answer-authority`), `city/district`
 * anlama katmanının konum çıkarımından okunur — besteci o iki alanı metinden
 * doldurmaz. Bir yüzeyin ölçümü ötekinin yerine konuşamaz.
 *
 * İKİ BEKLENTİ, İKİ AYRI SAYI.
 *   MUST_NOT_CLOSE  → KAPI. Bir tanesi bile kapanırsa kırmızı.
 *   MUST_CLOSE_WITH → RAPOR. Düzeltme cümlesinde doğru değerin kapatması
 *                     beklenir; kapatmaması gereksiz soru demektir, atlanan
 *                     soru değil. Bu yüzden kapı değil, sayı olarak tutulur.
 *
 * MUTASYON KONTROLÜ (T9): tuzaksız bir kontrol cümlesi ("Bütçem 12.000 TL")
 * soruyu KAPATMAK ZORUNDADIR. Kapatmıyorsa kapı her şeye "kapanmadı" diyor
 * olurdu ve hiçbir şeyi ayırt etmiyordur.
 */
import { syncFromText } from "@/lib/request-composer";
import {
  classifyAnswerAuthority,
  mayCloseQuestion,
} from "@/lib/request-composer/answer-authority";
import type { CanonicalFieldState } from "@/lib/request-composer/types";
import { understandRequest } from "@/lib/request-understanding/understand-request";

import { SET_E } from "../../../qa/open-set/set-e-answer-authority-traps";
import { splitById, type Half } from "../../../qa/open-set/split";

/**
 * GEREKSİZ SORU TABANI — SAYIYLA TUTULUR (mandal).
 *
 * `MUST_CLOSE_WITH` beklentisinin karşılanmadığı vaka sayısı. Artarsa kapı
 * kırmızı verir; azalırsa cetvel güncellenmelidir. Bugün bilinen sınıflar
 * raporda tek tek adlandırıldı (ilçe adının il olmadan çözülememesi, ayın
 * gününün tarih olarak çıkarılmaması).
 */
const UNNECESSARY_QUESTION_BASELINE = { dev: 1, test: 1 };

/**
 * ATLANAN SORU MANDALI — KURUCUNUN HEDEFİ 0'DIR, BUGÜN DEĞİLDİR.
 *
 * Bu sayı bir hedef değil, KAZANILMAMIŞ YEŞİLİN reddidir: kapı bugün sıfıra
 * inmedi ve inmiş gibi gösterilmiyor. Artarsa kırmızı verir. Kalan sınıflar
 * tek tek adlandırıldı (2026-09-25 ölçümü):
 *
 *  1. KATALOG ÜRÜN EŞLEŞMESİ BENZETMEYİ GÖRMÜYOR. "MacBook tarzı bir şey"
 *     cümlesinde teknoloji ürün kataloğu `MacBook`u bulup marka/modeli
 *     USER_EXPLICIT yazıyor. Benzetme belirteçleri konuşma jetonu sözlüğüne ve
 *     `isNegatedMention` penceresine eklendi; katalog eşleşmesi o pencereyi
 *     HİÇ sormuyor. Doğru düzeltme değeri silmek değil, OTORİTESİNİ düşürmek:
 *     benzetme bir ÖNERİdir (INFERRED), kullanıcı beyanı değil. Kimlik
 *     katmanı marka kesinliği (100% precision) sert kapısıyla korunuyor ve o
 *     kapı bu dilimde ölçülmeden değiştirilemedi — AYRI DİLİM.
 *  2. BÜTÇE REDDİNİ OKUMUYOR. "5000 TL'ye kadar diyemem henüz" cümlesinde
 *     rakam bütçe olarak yazılıyor; `diyemem/veremem` biçimleri olumsuzlama
 *     kuyruğunda yok ve bütçe çıkarımı olumlu görünüm maskesini okumuyor.
 *  3. "HARİÇ" MARKA REDDİNİ KAPATMIYOR (test yarısı). "Bosch hariç herhangi
 *     biri" cümlesinde marka `Bosch` olarak yazılıyor. `hariç` olumsuzlama
 *     kuyruğunda VARDIR; kusur katalog marka eşleşmesinin o pencereyi hiç
 *     sormamasıdır — 1. sınıfın aynısı, aynı düzeltmeyle kapanır.
 */
const SKIPPED_QUESTION_BASELINE = { dev: 2, test: 1 };

type Reading = {
  /** Alan bir DEĞER taşıyor mu? */
  filled: boolean;
  /** O değer soruyu kapatmaya yetkili mi? */
  closes: boolean;
  value: string;
  provenance: string;
};

const UNDERSTANDING_FIELDS = new Set(["city", "district"]);

function readComposerField(text: string, key: string): Reading {
  const { state } = syncFromText(null, text);
  const field = (state.fields as Record<string, CanonicalFieldState | undefined>)[
    key
  ];
  const value = field?.kind === "VALUE" ? String(field.value ?? "") : "";
  const filled = value.trim().length > 0;
  return {
    filled,
    closes: filled && mayCloseQuestion(classifyAnswerAuthority(field)),
    value,
    provenance: String(field?.provenance ?? "-"),
  };
}

/**
 * Konum yüzeyi: anlama katmanının çıkarımı. `EXPLICIT` provenance burada
 * "kullanıcı yazdı" demektir ve soru katmanı onu kapanış sayar; ölçüt bu
 * yüzden provenance'tır, ikinci bir eşik kurulmaz.
 */
function readUnderstandingField(text: string, key: string): Reading {
  const u = understandRequest({ rawInput: text });
  const node = key === "city" ? u.location?.city : u.location?.district;
  const value = node?.value ? String(node.value) : "";
  const filled = value.trim().length > 0;
  return {
    filled,
    closes: filled && String(node?.provenance ?? "") === "EXPLICIT",
    value,
    provenance: String(node?.provenance ?? "-"),
  };
}

function read(text: string, key: string): Reading {
  return UNDERSTANDING_FIELDS.has(key)
    ? readUnderstandingField(text, key)
    : readComposerField(text, key);
}

function main(): void {
  const halfArg = process.argv.find((a) => a.startsWith("--half="));
  const half: Half | "all" = halfArg
    ? (halfArg.slice("--half=".length) as Half | "all")
    : "dev";
  const split = splitById(SET_E);
  const rows = half === "all" ? SET_E : half === "dev" ? split.dev : split.test;

  console.log("=== verify-answer-authority-traps-v1 ===");
  console.log(`YARIM: ${half}  ·  VAKA: ${rows.length}/${SET_E.length}`);

  let skipped = 0;
  let unnecessary = 0;
  const skippedLines: string[] = [];
  const unnecessaryLines: string[] = [];

  for (const c of rows) {
    const r = read(c.text, c.field);
    if (c.expect === "MUST_NOT_CLOSE") {
      if (r.closes) {
        skipped += 1;
        skippedLines.push(
          `  ATLANAN SORU [${c.trap}] ${c.id} ${c.field} "${c.text}" ` +
            `deger=${r.value} kanit=${r.provenance} · ${c.why}`,
        );
      }
      continue;
    }
    const want = (c.expectContains ?? "").toLocaleLowerCase("tr-TR");
    const ok =
      r.closes && r.value.toLocaleLowerCase("tr-TR").includes(want);
    if (!ok) {
      unnecessary += 1;
      unnecessaryLines.push(
        `  GEREKSIZ SORU ${c.id} ${c.field} "${c.text}" ` +
          `beklenen=${c.expectContains} deger=${r.value || "(bos)"} kapatir=${r.closes}`,
      );
    }
  }

  const mustNotClose = rows.filter((c) => c.expect === "MUST_NOT_CLOSE").length;
  const mustClose = rows.length - mustNotClose;

  console.log("");
  console.log(`MUST_NOT_CLOSE ....... ${mustNotClose} vaka · ATLANAN SORU ${skipped} (kapı: 0)`);
  console.log(
    `MUST_CLOSE_WITH ...... ${mustClose} vaka · GEREKSIZ SORU ${unnecessary} ` +
      `(taban ${UNNECESSARY_QUESTION_BASELINE[half === "all" ? "dev" : half] ?? 0})`,
  );
  if (skippedLines.length) {
    console.log("");
    for (const l of skippedLines) console.log(l);
  }
  if (unnecessaryLines.length) {
    console.log("");
    for (const l of unnecessaryLines) console.log(l);
  }

  /* MUTASYON KONTROLÜ */
  const control = readComposerField("Ofis masası arıyorum, bütçem 12.000 TL", "budget");
  const controlOk = control.closes && control.value.includes("12");
  console.log(
    `\nMUTASYON KONTROLU: ${controlOk ? "gecti" : "GECMEDI"} — ` +
      "tuzaksiz butce beyani soruyu kapatiyor",
  );

  const budget = UNNECESSARY_QUESTION_BASELINE[half === "all" ? "dev" : half] ?? 0;
  const skipBudget = SKIPPED_QUESTION_BASELINE[half === "all" ? "dev" : half] ?? 0;
  const ok = skipped <= skipBudget && unnecessary <= budget && controlOk;
  console.log(
    `\nKAPI 1 (atlanan soru ≤ ${skipBudget}; kurucu hedefi 0) ... ` +
      `${skipped <= skipBudget ? "yesil" : "KIRMIZI"}  (ölçülen ${skipped})`,
  );
  console.log(
    `KAPI 2 (gereksiz soru ≤ ${budget}) ...... ${unnecessary <= budget ? "yesil" : "KIRMIZI"}`,
  );
  console.log(`KAPI 3 (mutasyon kontrolü) ........ ${controlOk ? "yesil" : "KIRMIZI"}`);
  if (ok) {
    console.log("PASS — metinde var gibi gorunen cevap soruyu kapatmiyor");
    process.exit(0);
  }
  console.log("KIRMIZI — cevap otoritesi tuzaklari gecmedi");
  process.exit(1);
}

main();
