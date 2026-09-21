/**
 * KAPI: JEV KARAR SAĞLAYICISI — yerleşik motorla YAN YANA, aynı 1077 vaka.
 *
 * NE KANITLAR. "Jev daha iyi" bir iddiadır; bu betik onu ölçüme çevirir.
 * İki sağlayıcı AYNI korpusta koşar, sonuçlar aynı zemin gerçeğine göre
 * sayılır ve netleştirme politikasının bedeli (kaç talebe soru soruluyor)
 * iki taraf için de yazılır.
 *
 * NEDEN CI'DA DEĞİL. Ağ ve API anahtarı ister, koşusu ~2 dakikadır ve dış bir
 * servise bağlıdır — cetvelin duvar saatine giremez. Elle koşulur, sonucu
 * karar belgesine yazılır. `verify-pharmacy-scope-v1` (deterministik, ağsız)
 * CI tarafındaki karşılığıdır.
 *
 * ANAHTAR HİÇBİR ÇIKTIYA YAZILMAZ — yalnız ortam değişkeninden okunur.
 */
import {
  buildAdversarialCorpus,
  type CorpusCase,
} from "./fixtures/brain-adversarial-corpus-v1";
import { fetchJevDecisions, createJevDecisionProvider } from "@/lib/request-decisions/jev";
import { createBuiltinDecisionProvider } from "@/lib/request-decisions/builtin-provider";
import { isOutOfTaxonomy } from "@/lib/request-decisions/out-of-taxonomy";
import { JEV_CATEGORY_CONFIDENCE_MIN, JEV_SCOPE_CERTAIN_MIN } from "@/lib/request-decisions/jev";

const KEY = process.env.TYPESAFE_API_KEY;
if (!KEY) {
  console.error("TYPESAFE_API_KEY yok — bu kapi ag gerektirir, CI'da kosmaz.");
  process.exit(2);
}

const ESZAMAN = 4;
const builtin = createBuiltinDecisionProvider();

type Satir = {
  id: string;
  input: string;
  beklenen: readonly string[];
  kapsamDisiBekleniyor: boolean;
  jevKat: string | null;
  jevGuven: number;
  jevKapsam: number;
  jevTaksonomiDisi: number;
  yerlesikKat: string | null;
  yerlesikGuven: number;
};

const vakalar: CorpusCase[] = buildAdversarialCorpus();
const sonuc: Satir[] = [];
let sira = 0;

await Promise.all(
  Array.from({ length: ESZAMAN }, async () => {
    for (;;) {
      const i = sira++;
      if (i >= vakalar.length) return;
      const c = vakalar[i];
      const bundle = await fetchJevDecisions(c.input, KEY);
      const jev = createJevDecisionProvider({ bundle, fallback: builtin });
      const jk = jev.decideRequestCategory({ text: c.input, intent: "UNKNOWN" });
      const bk = builtin.decideRequestCategory({ text: c.input, intent: "UNKNOWN" });
      sonuc.push({
        id: c.id,
        input: c.input,
        beklenen: c.expected.categories,
        kapsamDisiBekleniyor: c.expected.scope !== "SUPPORTED",
        jevKat: isOutOfTaxonomy(jk) ? null : jk.value,
        jevGuven: jk.confidence,
        jevKapsam: bundle?.outOfScope ?? 0,
        jevTaksonomiDisi: bundle?.outOfTaxonomy ?? 0,
        yerlesikKat: bk.value,
        yerlesikGuven: bk.confidence,
      });
      if (sonuc.length % 200 === 0) console.log(`  ${sonuc.length}/${vakalar.length}`);
    }
  }),
);

const iddiali = sonuc.filter((s) => !s.kapsamDisiBekleniyor && s.beklenen.length > 0);
const disi = sonuc.filter((s) => s.kapsamDisiBekleniyor);
const dogru = (s: Satir, kat: string | null) => kat !== null && s.beklenen.includes(kat);

const jevD = iddiali.filter((s) => dogru(s, s.jevKat)).length;
const yerD = iddiali.filter((s) => dogru(s, s.yerlesikKat)).length;
const kapsamYakalanan = disi.filter((s) => s.jevKapsam >= JEV_SCOPE_CERTAIN_MIN).length;
const jevYanlis = iddiali.filter((s) => !dogru(s, s.jevKat));
const kart = iddiali.filter(
  (s) => s.jevGuven < JEV_CATEGORY_CONFIDENCE_MIN || (s.jevKapsam >= 0.4 && s.jevKapsam <= 0.8),
);

console.log("\n=== verify-jev-decision-provider-v1 ===");
console.log(`vaka: ${sonuc.length} · kategori iddiasi olan: ${iddiali.length} · kapsam disi: ${disi.length}`);
console.log(`\nKATEGORI DOGRULUGU`);
console.log(`  jev           : ${jevD}/${iddiali.length}`);
console.log(`  talepo-builtin: ${yerD}/${iddiali.length}`);
console.log(`\nKAPSAM (noul >= ${JEV_SCOPE_CERTAIN_MIN}) : ${kapsamYakalanan}/${disi.length}`);
console.log(`\nNETLESTIRME BEDELI (esik ${JEV_CATEGORY_CONFIDENCE_MIN} + kapsam bandi)`);
console.log(`  kart acilan: ${kart.length}/${iddiali.length} = %${((100 * kart.length) / iddiali.length).toFixed(1)}`);
const kacan = jevYanlis.filter((s) => s.jevGuven >= JEV_CATEGORY_CONFIDENCE_MIN);
console.log(`  kapidan KACAN hata: ${kacan.length}`);
for (const s of kacan.slice(0, 15)) {
  console.log(`     ${s.jevGuven.toFixed(2)}  ${s.id} "${s.input}" → ${s.jevKat} (beklenen ${s.beklenen.join("|")})`);
}
console.log(`\nen yuksek guvenli jev hatasi: ${jevYanlis.length ? Math.max(...jevYanlis.map((s) => s.jevGuven)).toFixed(2) : "-"}`);
console.log("\nBu bir OLCUMDUR, karar degil. Saglayici gecisi ayri ve acik onay ister (S-16).");
process.exit(kacan.length ? 1 : 0);
