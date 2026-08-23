/**
 * Soru akışı denetimi (kurucu talebi, 2026-08-23):
 * her kategori için temsilî talepleri gerçek boru hattından geçirir ve
 * sorulan soruları döker — mantıksız eşleşmeler göz önüne çıksın.
 * Salt-okunur bir araçtır; hiçbir durumu değiştirmez.
 */
import { syncFromText } from "../src/lib/request-composer/sync";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { scheduleComposerQuestions } from "../src/lib/request-composer/v2/focused-questions";

const SCENARIOS: Array<[string, string]> = [
  // real-estate
  ["real-estate", "Ankara Çankaya'da kiralık 3+1 daire arıyorum"],
  ["real-estate", "satılık imarlı arsa arıyorum Adana"],
  ["real-estate", "kiralık dükkan arıyorum İzmir"],
  ["real-estate", "satılık tarla arıyorum"],
  // automotive
  ["automotive", "ikinci el Toyota Corolla almak istiyorum"],
  ["automotive", "Abarth için yedek parça arıyorum"],
  ["automotive", "205/55 R16 kış lastiği lazım"],
  ["automotive", "aracıma periyodik bakım yaptırmak istiyorum"],
  // technology
  ["technology", "55 inç Arçelik televizyon arıyorum İstanbul"],
  ["technology", "oyun bilgisayarı arıyorum"],
  ["technology", "iPhone arıyorum"],
  ["technology", "drone arıyorum"],
  ["technology", "kulaklık arıyorum"],
  ["technology", "modem arıyorum"],
  // Kurucu (2026-08-23): yaptırma/servis niyeti Hizmetler'e gider
  ["services", "web sitesi yaptırmak istiyorum"],
  ["services", "muhasebe yazılımı arıyorum"],
  // appliances
  ["appliances", "Arçelik buzdolabı arıyorum Ankara"],
  ["appliances", "robot süpürge arıyorum"],
  ["appliances", "klima arıyorum"],
  ["appliances", "kombi arıyorum"],
  // furniture
  ["furniture", "çekyat arıyorum"],
  ["furniture", "ofis sandalyesi arıyorum 10 adet"],
  ["furniture", "toplantı masası arıyorum"],
  ["furniture", "bahçe oturma grubu arıyorum"],
  // printing
  ["printing", "1000 adet kartvizit bastırmak istiyorum"],
  ["printing", "karton kutu ürettirmek istiyorum"],
  ["printing", "etiket bastırmak istiyorum"],
  ["printing", "roll-up banner yaptırmak istiyorum"],
  // machinery
  ["machinery", "CNC torna tezgahı arıyorum"],
  ["machinery", "jeneratör arıyorum"],
  ["machinery", "mini ekskavatör arıyorum"],
  ["machinery", "Heidelberg SM 74 için nemlendirme pompası lazım"],
  ["machinery", "matkap arıyorum"],
  // baby
  ["baby", "bebek arabası arıyorum"],
  ["baby", "oto koltuğu arıyorum"],
  ["baby", "bebek bezi arıyorum"],
  ["baby", "akülü araba arıyorum"],
  // home-kitchen
  ["home-kitchen", "yemek takımı arıyorum"],
  ["home-kitchen", "tencere seti arıyorum"],
  ["appliances", "kahve makinesi arıyorum"],
  // health
  ["health", "tekerlekli sandalye arıyorum"],
  ["health", "işitme cihazı arıyorum"],
  ["health", "hasta yatağı arıyorum"],
  // services
  ["services", "ofis temizliği hizmeti arıyorum"],
  ["services", "evden eve nakliye arıyorum"],
  ["services", "logo tasarımı yaptırmak istiyorum"],
  ["services", "muhasebe danışmanlığı arıyorum"],
  ["services", "kombi bakımı yaptırmak istiyorum"], // kurucu: ürün bakımı = hizmet
  ["services", "web sitesi yaptırmak istiyorum uzaktan olabilir"],
];

for (const [expectCat, text] of SCENARIOS) {
  const { state } = syncFromText(null, text);
  const hybrid = resolveHybridQuestions(state);
  const fieldStates = Object.fromEntries(
    Object.entries(state.fields).map(([k, f]) => [
      k,
      {
        kind: f?.kind,
        value:
          f?.kind === "VALUE"
            ? String(f.value ?? "")
            : f?.kind === "ANY"
              ? "no_preference"
              : null,
      },
    ]),
  );
  const schedule = scheduleComposerQuestions({
    categoryId: state.categoryId ?? "technology",
    needType:
      state.fields.needType?.kind === "VALUE"
        ? String(state.fields.needType.value ?? "")
        : null,
    candidates: hybrid.candidates,
    values: {},
    fieldStates,
  });
  const catFlag = state.categoryId === expectCat ? "" : ` !KATEGORİ:${state.categoryId}`;
  const visible = schedule.visible
    .map((q) => `${q.summaryLabel}${q.importance === "publish_required" ? "*" : ""}`)
    .join(", ");
  const chips = hybrid.candidates
    .slice(0, 10)
    .map((c) => c.label)
    .join(", ");
  console.log(`[${expectCat}]${catFlag} "${text}"`);
  console.log(`   soru: ${visible || "-"}`);
  console.log(`   çip : ${chips || "-"}`);
}
