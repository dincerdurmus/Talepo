/**
 * KÜRE EDİLMİŞ VARLIK TÜKETİMİ V1 (Wave M, 2026-08-31).
 * Run from apps/web: npx tsx scripts/verify-curated-entity-consumption-v1.ts
 *
 * NE ÖLÇER. Keşif formülünün 4. bileşeninin ("matching resolvedEntities
 * okuması") gerçekten çalıştığını, uçtan uca ve ÜRETİM-EŞDEĞER çağrıyla:
 *
 *   DOMAIN_ENTITIES (kürasyon durumu)
 *     → resolveDomainEntity (çakışma/koruma denetimi)
 *       → understandRequest.resolvedEntities (güven ataması)
 *         → buildPublishUnderstandingSnapshot (kalıcılık)
 *           → buildRequestRoutingEnvelope (AYNEN taşıma)
 *             → scoreAllComponents (tüketim)
 *
 * TÜKETİM SÖZLEŞMESİ (skorlayıcı, score-candidate.ts):
 *   - yalnız `verificationStatus === "CURATOR_APPROVED"`,
 *   - yalnız `confidence > 0.5`,
 *   - kanonik etiket tedarikçi profiliyle eşleşiyorsa.
 * Bunların DIŞINDA kalan hiçbir kayıt skor üretmez. Bu doğrulayıcı hem
 * pozitifi hem NEGATİF SÖZLEŞMEYİ dondurur.
 *
 * ONAY = STATÜ + KARAR KAYDI. Wave M'de eklenen kural: `CURATOR_APPROVED`
 * statüsü tek başına güçlü kanıt üretmez; karar referansı, tarihi ve
 * gerekçesi eksikse kayıt aday seviyesinde kalır (M2 mutasyonu bunu ölçer).
 *
 * MATCHING SHADOW'DA KALIR. Burada hiçbir bildirim/fanout iddiası yoktur;
 * ölçülen tek şey skorlayıcının varlık sinyalini doğru sınıflandırmasıdır.
 */
import assert from "node:assert/strict";

import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";
import {
  DOMAIN_ENTITIES,
  domainEntityEvidenceStrength,
} from "../src/lib/catalog/domain-entities";
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

type EntitySnap = {
  canonicalId: string;
  entityType: string;
  canonicalLabel: string;
  domainId: string;
  confidence: number;
  source: string;
  verificationStatus: string;
};

/** ÜRETİM-EŞDEĞER ZARF: db-shaped adaptörle aynı girdi seti. */
function envelopeFor(raw: string) {
  const u = understandRequest({ rawInput: raw });
  const snap = buildPublishUnderstandingSnapshot({
    understanding: u as never,
    userSelected: false,
    primarySlug: null,
  });
  const projection = buildDiscoveryProjectionFromState(
    syncFromText(null, raw).state,
  );
  const env = buildRequestRoutingEnvelope({
    requestId: "verify-curated-entity",
    rawInput: raw,
    understandingSnapshot: snap,
    discoveryProjection: projection,
  } as never) as never as {
    resolvedEntities?: EntitySnap[];
    attributes: Record<string, string>;
  };
  return {
    env,
    understandingEntities: (u as unknown as { resolvedEntities?: EntitySnap[] })
      .resolvedEntities ?? [],
  };
}

/**
 * Tedarikçi profili YALNIZ verilen anahtar kelimeyi taşır ve attributes
 * torbası boşaltılır. Böylece "attribute" bileşeni eşleşirse bunun tek
 * açıklaması KANONİK VARLIK sinyalidir — ölçüm başka bir yoldan sızamaz.
 */
function attributeComponentMatched(
  env: { resolvedEntities?: EntitySnap[]; attributes: Record<string, string> },
  keyword: string,
): { matched: boolean; reason: string | null } {
  const profile = {
    companyId: "verify-curated-entity",
    label: "kanonik varlık sinyali izolasyon profili",
    categoryDbIds: [],
    categorySlugs: [],
    taxonomyNodeIds: [],
    products: [],
    brands: [],
    models: [],
    families: [],
    brandModelPairs: [],
    brandCoverage: "unknown",
    modelCoverage: "unknown",
    productCoverage: "unknown",
    cities: [],
    districts: [],
    nationwide: false,
    budgetCapability: false,
    availabilityCapability: false,
    keywords: keyword ? [keyword] : [],
    aliases: [],
    inventorySignals: [],
    alertSignals: [],
    savedSearchSignals: [],
    excluded: {},
  } as never;
  const components = scoreAllComponents(
    { ...(env as unknown as Record<string, unknown>), attributes: {} } as never,
    profile,
    [],
  ) as Array<{ id: string; matched: boolean; reason: string | null }>;
  const c = components.find((x) => x.id === "attribute");
  return { matched: c?.matched ?? false, reason: c?.reason ?? null };
}

/* ---------------------------------------------------------------------- *
 * A. COHORT — gerçek kullanıcı probe'ları, dört sınıf birlikte.
 *
 * Sınıflar: CONSUMED (onaylı+eşikli), PENDING (kürasyon yok),
 * GUARDED (koruma varlığı hiç üretmiyor), NO_ENTITY (kanonik kayıt yok).
 * Kolay yeşil için yalnız kusursuz örnekler seçilmedi: koruma vakaları ve
 * kanonik karşılığı olmayan alanlar (otomotiv, beyaz eşya) bilerek içeride.
 * ---------------------------------------------------------------------- */
type CohortCase = {
  raw: string;
  domain: string;
  expect: "CONSUMED" | "PENDING" | "GUARDED" | "NO_ENTITY";
  canonicalId?: string;
  keyword?: string;
  note: string;
};

const COHORT: CohortCase[] = [
  {
    raw: "WordPress sitesi yaptırmak istiyorum",
    domain: "technology",
    expect: "CONSUMED",
    canonicalId: "platform:wordpress",
    keyword: "wordpress",
    note: "onaylı platform · HIGH · koruma gerekmiyor",
  },
  {
    raw: "Shopify mağazası kurdurmak istiyorum",
    domain: "technology",
    expect: "CONSUMED",
    canonicalId: "platform:shopify",
    keyword: "shopify",
    note: "onaylı platform · HIGH",
  },
  {
    raw: "WooCommerce eklentisi yaptırmak istiyorum",
    domain: "technology",
    expect: "CONSUMED",
    canonicalId: "platform:woocommerce",
    keyword: "woocommerce",
    note: "98+ onay probe · HIGH · koruma yok",
  },
  {
    raw: "Wix sitesi yaptırmak istiyorum",
    domain: "technology",
    expect: "CONSUMED",
    canonicalId: "platform:wix",
    keyword: "wix",
    note: "98+ onay probe · HIGH",
  },
  {
    raw: "Magento entegrasyonu arıyorum",
    domain: "technology",
    expect: "CONSUMED",
    canonicalId: "platform:magento",
    keyword: "magento",
    note: "98+ onay probe · HIGH",
  },
  {
    raw: "PrestaShop mağazası kurdurmak istiyorum",
    domain: "technology",
    expect: "CONSUMED",
    canonicalId: "platform:prestashop",
    keyword: "prestashop",
    note: "98+ onay probe · HIGH",
  },
  {
    raw: "OpenCart modülü arıyorum",
    domain: "technology",
    expect: "CONSUMED",
    canonicalId: "platform:opencart",
    keyword: "opencart",
    note: "98+ onay probe · HIGH",
  },
  {
    raw: "İdeasoft mağazam için destek arıyorum",
    domain: "technology",
    expect: "CONSUMED",
    canonicalId: "platform:ideasoft",
    keyword: "ideasoft",
    note: "98+ onay probe · HIGH (TR e-ticaret platformu)",
  },
  {
    raw: "Ticimax entegrasyonu arıyorum",
    domain: "technology",
    expect: "CONSUMED",
    canonicalId: "platform:ticimax",
    keyword: "ticimax",
    note: "98+ onay probe · HIGH (TR e-ticaret platformu)",
  },
  {
    raw: "CNC tezgahı arıyorum",
    domain: "machinery",
    expect: "CONSUMED",
    canonicalId: "machine-type:cnc-tezgahi",
    keyword: "cnc tezgâhı",
    note: "onaylı makine türü · HIGH",
  },
  {
    raw: "CNC torna tezgahı arıyorum",
    domain: "machinery",
    expect: "CONSUMED",
    canonicalId: "machine-type:cnc-tezgahi",
    keyword: "cnc tezgâhı",
    note: "aynı varlık, farklı kullanıcı ifadesi",
  },
  {
    raw: "Logo muhasebe programı arıyorum",
    domain: "technology",
    expect: "PENDING",
    canonicalId: "software-suite:logo-yazilim",
    keyword: "logo yazılım",
    note: "kürasyon YOK (MEDIUM + requiresContext) → skor üretemez",
  },
  {
    raw: "SAP danışmanlığı arıyorum",
    domain: "technology",
    expect: "PENDING",
    canonicalId: "software-suite:sap",
    keyword: "sap",
    note: "kürasyon YOK (MEDIUM + caseSensitive) → skor üretemez",
  },
  {
    raw: "logo tasarımı arıyorum",
    domain: "services",
    expect: "GUARDED",
    keyword: "logo yazılım",
    note: "requiresContext koruması: yazılım bağlamı yok → varlık üretilmez",
  },
  {
    raw: "Kürek sapı arıyorum",
    domain: "machinery",
    expect: "GUARDED",
    keyword: "sap",
    note: "caseSensitive koruması: küçük harf 'sap' varlık değildir",
  },
  {
    raw: "Mercedes C180 satın almak istiyorum",
    domain: "automotive",
    expect: "NO_ENTITY",
    keyword: "mercedes",
    note: "otomotiv alanında kanonik tipli varlık kaydı YOK (dürüst boş)",
  },
  {
    raw: "Arçelik bulaşık makinesi arıyorum",
    domain: "appliances",
    expect: "NO_ENTITY",
    keyword: "arçelik",
    note: "beyaz eşya alanında kanonik tipli varlık kaydı YOK",
  },
  {
    raw: "Bir şeyler arıyorum",
    domain: "generic",
    expect: "NO_ENTITY",
    keyword: "ürün",
    note: "placeholder/jenerik özne → varlık yok",
  },
];

console.log("A) COHORT — gerçek probe zinciri");
for (const c of COHORT) {
  const { env, understandingEntities } = envelopeFor(c.raw);
  const carried = env.resolvedEntities ?? [];
  const hit = attributeComponentMatched(env, c.keyword ?? "");

  if (c.expect === "CONSUMED") {
    const e = carried.find((x) => x.canonicalId === c.canonicalId);
    check(
      `A ${c.domain} ${c.canonicalId}: zarf varlığı AYNEN taşır`,
      Boolean(e) &&
        e!.verificationStatus === "CURATOR_APPROVED" &&
        e!.confidence > 0.5,
      `→ ${e ? `${e.verificationStatus} conf=${e.confidence}` : "yok"}`,
    );
    check(
      `A ${c.domain} ${c.canonicalId}: skorlayıcı varlık sinyalini TÜKETİR`,
      hit.matched && /Kanonik varlık/i.test(hit.reason ?? ""),
      `→ matched=${hit.matched} reason=${hit.reason ?? "-"}`,
    );
  } else if (c.expect === "PENDING") {
    const e = carried.find((x) => x.canonicalId === c.canonicalId);
    check(
      `A ${c.canonicalId}: kürasyonsuz kayıt taşınır ama ONAYSIZ (${c.note})`,
      Boolean(e) && e!.verificationStatus === "PENDING_CURATION",
      `→ ${e ? e.verificationStatus : "yok"}`,
    );
    check(
      `A ${c.canonicalId}: PENDING kayıt skor ÜRETMEZ`,
      !hit.matched,
      `→ matched=${hit.matched}`,
    );
  } else {
    check(
      `A "${c.raw}": varlık ÜRETİLMEZ (${c.note})`,
      carried.length === 0 && understandingEntities.length === 0,
      `→ ${JSON.stringify(carried.map((e) => e.canonicalId))}`,
    );
    check(`A "${c.raw}": skor katkısı 0`, !hit.matched, `→ ${hit.matched}`);
  }
}

/* ---------------------------------------------------------------------- *
 * B. NEGATİF SÖZLEŞME — sözleşme düzeyinde dondurulur.
 * Cohort gerçek probe'larla ölçer; burada tüketim kuralının KENDİSİ
 * (statü + eşik) doğrudan sınanır, çünkü bazı sınıflar (onaylı-ama-belirsiz,
 * düşük güven) bugünkü kayıt defterinde gerçek bir probe'la üretilemez.
 * ---------------------------------------------------------------------- */
console.log("\nB) NEGATİF TÜKETİM SÖZLEŞMESİ");
{
  const base = {
    canonicalId: "platform:wordpress",
    entityType: "PLATFORM",
    canonicalLabel: "WordPress",
    domainId: "technology",
    source: "AI_INFERRED:talepo-1j-seed",
  };
  /**
   * Taban zarf GERÇEK üretim çağrısından gelir; yalnız tek varlık kaydı
   * denetlenen değerle değiştirilir. Böylece negatifler elle kurulmuş bir
   * şekil üzerinde değil, üretim zarfının kendisi üzerinde ölçülür.
   */
  const realEnv = envelopeFor("WordPress sitesi yaptırmak istiyorum").env;
  const envWith = (e: Partial<EntitySnap>) => ({
    ...(realEnv as unknown as Record<string, unknown>),
    resolvedEntities: [
      {
        ...base,
        confidence: 0.8,
        verificationStatus: "CURATOR_APPROVED",
        ...e,
      } as EntitySnap,
    ],
  });
  const NEG: Array<{ name: string; patch: Partial<EntitySnap> }> = [
    { name: "PENDING_CURATION", patch: { verificationStatus: "PENDING_CURATION" } },
    { name: "REJECTED", patch: { verificationStatus: "REJECTED" } },
    { name: "DEPRECATED", patch: { verificationStatus: "DEPRECATED" } },
    { name: "confidence = 0.5 (eşiğe eşit)", patch: { confidence: 0.5 } },
    { name: "confidence = 0.3", patch: { confidence: 0.3 } },
    {
      name: "onaylı ama BELİRSİZ çözüm (güven 0.5'e düşer)",
      patch: { confidence: 0.5, verificationStatus: "CURATOR_APPROVED" },
    },
    { name: "boş kanonik etiket (placeholder)", patch: { canonicalLabel: "" } },
  ];
  for (const n of NEG) {
    const hit = attributeComponentMatched(
      envWith(n.patch) as never,
      "wordpress",
    );
    check(`B ${n.name} → skor katkısı 0`, !hit.matched, `→ ${hit.matched}`);
  }
  // Pozitif kontrol: aynı kurulumda onaylı+eşikli kayıt TÜKETİLİR.
  const control = attributeComponentMatched(envWith({}) as never, "wordpress");
  check(
    "B pozitif kontrol: onaylı + conf>0.5 TÜKETİLİR (negatifler boş değil)",
    control.matched,
    `→ ${control.matched}`,
  );
  // Profil eşleşmiyorsa varlık tek başına skor üretmez (sinyal izolasyonu).
  const noProfile = attributeComponentMatched(envWith({}) as never, "sunucu");
  check(
    "B varlık tek başına yetmez: tedarikçi profili eşleşmezse skor 0",
    !noProfile.matched,
    `→ ${noProfile.matched}`,
  );
}

/* ---------------------------------------------------------------------- *
 * C. ONAY KAYDI ZORUNLULUĞU — statü tek başına yetki değildir.
 * ---------------------------------------------------------------------- */
console.log("\nC) ONAY KAYDI SÖZLEŞMESİ");
{
  const approved = DOMAIN_ENTITIES.filter(
    (e) => e.provenance.verificationStatus === "CURATOR_APPROVED",
  );
  check(
    "C her onaylı kayıt karar referansı/tarihi/gerekçesi taşır",
    approved.length > 0 &&
      approved.every(
        (e) =>
          Boolean(e.provenance.curationDecisionRef?.trim()) &&
          Boolean(e.provenance.curationDecidedAt?.trim()) &&
          Boolean(e.provenance.curationReason?.trim()),
      ),
    `→ onaylı=${approved.length}`,
  );
  check(
    "C onay ölçütü: onaylı kayıtların hepsi HIGH ve koruma taşımıyor",
    approved.every(
      (e) =>
        e.provenance.confidence === "HIGH" &&
        !e.caseSensitiveAliases?.length &&
        !e.requiresContext?.length,
    ),
    `→ ${approved.map((e) => e.canonicalId).join(",")}`,
  );
  check(
    "C koruma taşıyan kayıtlar onaylanmadı",
    DOMAIN_ENTITIES.filter(
      (e) => e.caseSensitiveAliases?.length || e.requiresContext?.length,
    ).every((e) => e.provenance.verificationStatus !== "CURATOR_APPROVED"),
  );
}

/* ---------------------------------------------------------------------- *
 * D. BİLEŞEN ④ ÖLÇÜMÜ — 108 senaryoluk kanonik evren (Wave L ile aynı payda).
 * Sınıflar ayrı ayrı yayınlanır; "ölçülmedi" hiçbir yerde 0 diye sunulmaz.
 * ---------------------------------------------------------------------- */
console.log("\nD) BİLEŞEN ④ ÖLÇÜMÜ (payda 108 — Wave L paydası korunur)");
{
  let consumable = 0;
  let pending = 0;
  let none = 0;
  const consumableIds: string[] = [];
  const pendingIds: string[] = [];
  for (const sc of CATEGORY_COVERAGE_V1 as ReadonlyArray<{
    id: string;
    input: string;
  }>) {
    const { env } = envelopeFor(sc.input);
    const list = env.resolvedEntities ?? [];
    if (!list.length) {
      none += 1;
      continue;
    }
    const ok = list.some(
      (e) => e.verificationStatus === "CURATOR_APPROVED" && e.confidence > 0.5,
    );
    if (ok) {
      consumable += 1;
      consumableIds.push(sc.id);
    } else {
      pending += 1;
      pendingIds.push(sc.id);
    }
  }
  console.log(
    `CURATED_ENTITY_CONSUMABLE=${consumable}/108 · PENDING_ENTITY=${pending}/108 · ` +
      `NO_ENTITY=${none}/108`,
  );
  console.log(`  tüketilebilir: ${consumableIds.join(", ") || "—"}`);
  console.log(`  kürasyon bekleyen: ${pendingIds.join(", ") || "—"}`);
  console.log(
    `  NOT: "NO_ENTITY" ölçülmüş bir yokluktur (kanonik kayıt yok), ` +
      `ölçülememiş değildir. Kayıt defteri bugün ${DOMAIN_ENTITIES.length} varlık ` +
      `taşır ve yalnız technology/machinery alanlarını kapsar — diğer alanların ` +
      `varlık kürasyonu AÇIK bir kurucu kalemidir.`,
  );
  /**
   * DONDURULMUŞ TABAN (Wave M) — SAYI DEĞİL KİMLİK KÜMESİ kilitlidir.
   * Ölçülen tüketilebilir küme 5 senaryodur ve her biri tek tek
   * doğrulandı:
   *   tech-05 "WordPress için teknik destek"       → platform:wordpress
   *   tech-06 "Shopify için entegrasyon hizmeti"   → platform:shopify
   *   mach-01 "CNC tezgahı arıyorum"               → machine-type:cnc-tezgahi
   *   mach-02 "CNC tezgahı için teknik servis"     → machine-type:cnc-tezgahi
   *   mach-07 "CNC marka bir ürün arıyorum"        → machine-type:cnc-tezgahi
   *
   * mach-07 KURUCU DİKKATİNE: kullanıcı "CNC" sözcüğünü MARKA olarak
   * beyan ediyor (brandEvidence USER_ASSERTED); kanonik kayıt ise onu
   * MAKİNE TÜRÜ sayıyor. Roller karışmıyor — marka kendi kanalında,
   * varlık kendi kanalında — ve alan sinyali (machinery) doğru. Yine de
   * bu satır tesadüfen değil, bilinçle sayılmıştır; kurucu bu eşleşmeyi
   * istemezse kayıt REJECTED değil, alias daraltmasıyla düzeltilmelidir.
   */
  const BASELINE_CONSUMABLE = ["mach-01", "mach-02", "mach-07", "tech-05", "tech-06"];
  const BASELINE_PENDING = ["tech-07", "tech-08"];
  check(
    "D tüketilebilir kimlik kümesi dondurulmuş tabana eşit (5)",
    JSON.stringify([...consumableIds].sort()) === JSON.stringify(BASELINE_CONSUMABLE),
    `→ ${JSON.stringify([...consumableIds].sort())}`,
  );
  check(
    "D kürasyon bekleyen kimlik kümesi dondurulmuş tabana eşit (2)",
    JSON.stringify([...pendingIds].sort()) === JSON.stringify(BASELINE_PENDING),
    `→ ${JSON.stringify([...pendingIds].sort())}`,
  );
  check("D varlıksız taban (101)", none === 101, `→ ${none}`);
  check(
    "D sınıflar paydayı tüketir (5 + 2 + 101 = 108)",
    consumable + pending + none === 108,
    `→ ${consumable + pending + none}`,
  );
}

/* ---------------------------------------------------------------------- *
 * M. MUTASYON KANITI — kapı gerçekten kırmızıya dönebiliyor mu?
 *   M1: onaylı kaydın statüsü PENDING'e çevrilir → tüketim kaybolur.
 *   M2: statü onaylı kalır ama KARAR KAYDI silinir → yine tüketilmez
 *       (statü tek başına yetki değildir).
 * Her iki mutasyondan sonra kayıt defteri AYNEN geri yüklenir.
 * ---------------------------------------------------------------------- */
console.log("\nM) MUTASYON KANITI");
{
  const target = DOMAIN_ENTITIES.find(
    (e) => e.canonicalId === "platform:wordpress",
  );
  if (!target) {
    check("M hedef kayıt bulundu", false, "platform:wordpress yok");
  } else {
    const raw = "WordPress sitesi yaptırmak istiyorum";
    const original = { ...target.provenance };
    const before = attributeComponentMatched(envelopeFor(raw).env, "wordpress");
    check("M0 mutasyon öncesi TÜKETİLİYOR", before.matched, `→ ${before.matched}`);

    // M1 — statü düşürülür.
    (target.provenance as { verificationStatus: string }).verificationStatus =
      "PENDING_CURATION";
    const m1 = attributeComponentMatched(envelopeFor(raw).env, "wordpress");
    check("M1 statü PENDING → tüketim DURUR", !m1.matched, `→ ${m1.matched}`);

    // M2 — statü onaylı, karar kaydı yok.
    (target.provenance as { verificationStatus: string }).verificationStatus =
      "CURATOR_APPROVED";
    (target.provenance as { curationDecisionRef?: string }).curationDecisionRef =
      undefined;
    (target.provenance as { curationDecidedAt?: string }).curationDecidedAt =
      undefined;
    (target.provenance as { curationReason?: string }).curationReason = undefined;
    const strengthNoRecord = domainEntityEvidenceStrength(target);
    const m2 = attributeComponentMatched(envelopeFor(raw).env, "wordpress");
    check(
      "M2 karar kaydı silinince onay güçlü kanıt ÜRETMEZ",
      strengthNoRecord === "CANDIDATE" && !m2.matched,
      `→ strength=${strengthNoRecord} matched=${m2.matched}`,
    );

    // Geri yükleme.
    Object.assign(target.provenance, original);
    const after = attributeComponentMatched(envelopeFor(raw).env, "wordpress");
    check("M3 geri yükleme sonrası taban AYNEN döner", after.matched, `→ ${after.matched}`);
  }
}

console.log(`\nCurated entity consumption: ${pass} PASS / ${fail} FAIL`);
if (errors.length) {
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
assert.ok(true);
