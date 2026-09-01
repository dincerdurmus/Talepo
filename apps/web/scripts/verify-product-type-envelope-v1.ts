/**
 * ÜRÜN TÜRÜ → ROUTING ENVELOPE SÖZLEŞMESİ V1 (Wave L, 2026-08-31).
 * Run from apps/web: npx tsx scripts/verify-product-type-envelope-v1.ts
 *
 * Teknik keşif formülünün 3. bileşeni ("ürün türü erişimi") 0/108'di:
 * zarfın `product` alanı `entities.product`/attributes bekliyor ama publish
 * snapshot'ı özneyi hiç taşımıyordu. Sözleşme: ürün türü zarfa YALNIZ tek
 * beynin `requestSubject` kaydından, kanıt eşiğiyle girer —
 *   - provenance EXPLICIT ya da kaynak kanonik VERIFIED sınıfında,
 *   - jenerik yer tutucu adlar ("ürün", "servis"…) ASLA taşınmaz,
 *   - eşik altı/kanıtsız kayıtta alan BOŞ kalır (0 hata değildir),
 *   - ikinci bir çıkarıcı/regex yazılmaz, matching yeniden yorum yapmaz.
 */
import assert from "node:assert/strict";

import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";
import { understandRequest } from "../src/lib/request-understanding";
import { buildPublishUnderstandingSnapshot } from "../src/lib/request/publish-understanding";
import { buildRequestRoutingEnvelope } from "../src/lib/matching-v3/routing-envelope";
import { syncFromText } from "../src/lib/request-composer";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";
import { scoreAllComponents } from "../src/lib/matching-v3/scoring/score-candidate";

let pass = 0;
let fail = 0;
const errors: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    errors.push(detail ? `${name}: ${detail}` : name);
    console.log(`FAIL — ${name}${detail ? `: ${detail}` : ""}`);
  }
}

/**
 * ÜRETİM-EŞDEĞER ÇAĞRI: db-shaped adaptör zarfa hem publish snapshot'ını
 * hem discoveryProjection'ı verir (adapters/db-shaped.ts). Yalnız
 * snapshot'la ölçmek yanlış yüzeyi ölçmek olurdu — projection.productType
 * kanonik tabandan (taksonomi iddiası, USER_EXPLICIT) gelir.
 */
function envelopeProductFor(raw: string): string | null {
  const u = understandRequest({ rawInput: raw });
  const snap = buildPublishUnderstandingSnapshot({
    understanding: u as never,
    userSelected: false,
    primarySlug: null,
  });
  const state = syncFromText(null, raw).state;
  const projection = buildDiscoveryProjectionFromState(state);
  const env = buildRequestRoutingEnvelope({
    requestId: "verify-ptype",
    rawInput: raw,
    understandingSnapshot: snap,
    discoveryProjection: projection,
  } as never) as never as { product?: string | null };
  return env.product ?? null;
}

// A. Temsilî aileler — kanıtlı ürün türü zarfa çıkar.
const POSITIVE: Array<{ raw: string; expect: RegExp; family: string }> = [
  { raw: "Mercedes C180 satın almak istiyorum", expect: /c180|araç|otomobil/i, family: "otomotiv" },
  { raw: "Kahve makinesi arıyorum", expect: /kahve makinesi/i, family: "beyaz eşya" },
  { raw: "iPhone 15 Pro arıyorum", expect: /iphone|telefon/i, family: "teknoloji" },
  { raw: "CNC torna tezgahı arıyorum", expect: /cnc|torna/i, family: "makine" },
  { raw: "Koltuk takımı arıyorum", expect: /koltuk takımı/i, family: "mobilya" },
  { raw: "Buzdolabı arıyorum, no-frost olsun", expect: /buzdolabı/i, family: "home" },
  /**
   * FD-7 kürasyonu (2026-08-31): "Grafik ve logo tasarımı" SERVICE_TYPE
   * yaprağı eklendi; bu girdi artık çözümsüz DEĞİL, hizmet türü zarfa
   * meşru şekilde çıkar. Eski B-negatifinden buraya taşındı.
   */
  { raw: "logo tasarımı arıyorum", expect: /logo tasarımı/i, family: "hizmet" },
];
for (const c of POSITIVE) {
  const p = envelopeProductFor(c.raw);
  check(
    `A ${c.family}: ürün türü zarfa çıkar`,
    p != null && c.expect.test(p),
    `→ ${p ?? "null"}`,
  );
}

// B. Negatifler — jenerik/placeholder ve kanıtsız durumda alan BOŞ kalır.
const NEGATIVE: Array<{ raw: string; reason: string }> = [
  { raw: "Bir şeyler arıyorum", reason: "kanıtsız jenerik ifade" },
  /**
   * FD-9 (2026-08-31): tıbbi tavsiye sorusu kapsam dışıdır — özne/kategori
   * susturulur, ürün türü zarfa ASLA çıkmaz.
   */
  { raw: "Baş ağrım için hangi ilacı almalıyım", reason: "tıbbi tavsiye sorusu — kapsam dışı" },
];
for (const c of NEGATIVE) {
  const p = envelopeProductFor(c.raw);
  check(`B boş kalır (${c.reason})`, p == null, `→ ${p}`);
}

// C. Erişim ölçümü — 108 corpus üzerinde; yalnız doğrulanmış kayıtlar sayılır.
{
  let reach = 0;
  const misses: string[] = [];
  for (const sc of CATEGORY_COVERAGE_V1 as ReadonlyArray<{ id: string; input: string }>) {
    const p = envelopeProductFor(sc.input);
    if (p) reach += 1;
    else misses.push(sc.id);
  }
  console.log(
    `PRODUCT_TYPE_ENVELOPE_REACH=${reach}/108  (boş kalanlar hata değildir; ` +
      `eşik altı/kanıtsız kayıtlar sayılmaz)`,
  );
  /*
   * DONDURULMUŞ TABAN (Wave L, 2026-08-31): kanıt eşiği (EXPLICIT +
   * USER_EXPLICIT/VERIFIED, placeholder yok, marka/model rol guard'ı)
   * altında ölçülen erişim 98'dir. Delta geçmişi (her adım satır satır):
   *   67→66: rol guard'ı — tech-03 "Samsung"→"televizyon", appl-04
   *          "Arçelik"→"Bulaşık Makinesi" (sızıntı düzeldi), auto-10
   *          "C200" model kanalına ayrıldı (−1, dürüst boş).
   *   66→69: FD-7/8/10 kurucu kürasyonu — tech-12 "logo tasarımı",
   *          health-07 "test çubuğu", home-06 "Kürek sapı" artık kanonik
   *          yaprağa çözülüyor (+3).
   * Sayı HER İKİ yönde kilitlidir; değişiklik sayılmış delta ister.
   */
  /**
   * 69→98 (98+ Part II, 2026-09-01): kullanıcının ürün ad-öbeği artık yer
   * tutucu/marka yerine özne adına iner (userProductPhrase) ve köprü
   * bar-geçen ilk kaydı taşır. +29 satırın kimlik listesi projection
   * tabanının PART II notunda; kalite karşılığı verify-discovery-quality-v1
   * (bileşen ③ %100, 584 uygulanabilir vakada WRONG=0).
   */
  check("C erişim dondurulmuş tabana eşit (98)", reach === 98, `→ ${reach}`);
  check(
    "C jenerik placeholder hiçbir kayıtta taşınmadı",
    !CATEGORY_COVERAGE_V1.some((sc) => {
      const p = envelopeProductFor((sc as { input: string }).input);
      return p != null && /^(ürün|urun|servis|hizmet)$/i.test(p.trim());
    }),
  );
}

// D. KANONİK TİPLİ VARLIK KANALI (madde 5 — matching resolvedEntities).
// Sözleşme: zarf snapshot'taki resolvedEntities'i AYNEN taşır; skorlayıcı
// kürasyon sözleşmesini uygular — PENDING_CURATION kanıt ÜRETMEZ,
// CURATOR_APPROVED üretir. D2/D3 çifti aynı zamanda mutasyon kontrolüdür:
// statü denetimi silinirse D2 kırmızıya döner.
{
  const raw = "WordPress sitesi yaptırmak istiyorum";
  const u = understandRequest({ rawInput: raw });
  const snap = buildPublishUnderstandingSnapshot({
    understanding: u as never,
    userSelected: false,
    primarySlug: null,
  });
  const env = buildRequestRoutingEnvelope({
    requestId: "verify-re",
    rawInput: raw,
    understandingSnapshot: snap,
  } as never) as never as {
    resolvedEntities?: Array<{ canonicalId: string; verificationStatus: string }>;
  };
  const carried = env.resolvedEntities ?? [];
  check(
    "D zarf resolvedEntities'i aynen taşır (platform:wordpress)",
    carried.some((e) => e.canonicalId === "platform:wordpress"),
    `→ ${JSON.stringify(carried.map((e) => e.canonicalId))}`,
  );

  const profile = {
    categoryDbIds: [],
    categorySlugs: [],
    taxonomyNodeIds: [],
    products: [],
    keywords: ["wordpress"],
    aliases: [],
    inventorySignals: [],
    alertSignals: [],
    savedSearchSignals: [],
    excluded: {},
  } as never;
  const entity = (status: string) => ({
    canonicalId: "platform:wordpress",
    entityType: "PLATFORM",
    canonicalLabel: "WordPress",
    domainId: "technology",
    confidence: 0.8,
    source: "test",
    verificationStatus: status,
  });
  const scoreWith = (status: string) => {
    const components = scoreAllComponents(
      {
        ...( env as never as Record<string, unknown>),
        requestId: "verify-re-score",
        rawInput: raw,
        attributes: {},
        resolvedEntities: [entity(status)],
      } as never,
      profile,
      [],
    ) as Array<{ id: string; matched: boolean }>;
    return components.find((c) => c.id === "attribute")?.matched ?? false;
  };
  check(
    "D PENDING_CURATION varlık skor kanıtı ÜRETMEZ (kürasyon sözleşmesi)",
    scoreWith("PENDING_CURATION") === false,
  );
  check(
    "D CURATOR_APPROVED varlık attribute kanıtı üretir",
    scoreWith("CURATOR_APPROVED") === true,
  );
}

// M. Mutasyon kontrolü — kapı kırmızıya dönebildiğini KANITLAR: köprü
// filtresi atlanır ve placeholder doğrudan snapshot'a enjekte edilirse zarf
// onu aynen taşır; yani C-placeholder denetimi gerçek yakalayıcıdır.
{
  const u = understandRequest({ rawInput: "Mercedes C180 satın almak istiyorum" });
  const snap = buildPublishUnderstandingSnapshot({
    understanding: u as never,
    userSelected: false,
    primarySlug: null,
  }) as never as { entities: { product?: { value: string; confidence?: number } } };
  snap.entities.product = { value: "ürün", confidence: 0.9 };
  const env = buildRequestRoutingEnvelope({
    requestId: "verify-ptype-mutation",
    rawInput: "Mercedes C180 satın almak istiyorum",
    understandingSnapshot: snap,
  } as never) as never as { product?: string | null };
  check(
    "M mutasyon: filtre atlanınca placeholder zarfa sızar (kapı yakalar)",
    env.product === "ürün",
    `→ ${env.product ?? "null"}`,
  );
}

console.log(`\nProduct type envelope: ${pass} PASS / ${fail} FAIL`);
if (errors.length) {
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
assert.ok(true);
