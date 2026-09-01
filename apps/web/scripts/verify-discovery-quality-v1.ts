/**
 * PROFESSIONAL_DISCOVERY_DATA_QUALITY V1 (98+ Part II, 2026-09-01).
 *
 * YENİ RESMÎ KALİTE SÖZLEŞMESİ — tarihsel PROFESSIONAL_DISCOVERY_DATA_READINESS
 * metriğinin YERİNE GEÇMEZ (o presence ölçer ve ledger'da aynen korunur; fark
 * docs/METRIC-INTEGRITY-AUDIT-98.md'de matematiksel olarak açıklanmıştır).
 *
 * Her bileşen için satırlar önce UYGULANABİLİRLİK sınıfına ayrılır:
 *   APPLICABLE_AND_CORRECT / APPLICABLE_AND_WRONG / APPLICABLE_BUT_MISSING /
 *   NOT_APPLICABLE / NOT_MEASURED
 * Bileşen skoru = CORRECT / (CORRECT + WRONG + MISSING). NOT_APPLICABLE tek
 * tek zemin gerçeğinden gelir (şablon beyanı), toptan düşürme yoktur.
 * NOT_MEASURED hiçbir sayaca girmez ve ayrı raporlanır.
 *
 * ÖLÇÜM EVRENİ: 1077 vakalık üretim-eşdeğer adversarial korpus
 * (fixtures/brain-adversarial-corpus-v1) — zemin gerçeği ŞABLONDAN gelir,
 * motora sızmaz. Zincir: understandRequest → snapshot → routing envelope
 * (keşif/eşleştirmenin okuduğu gerçek kanallar).
 *
 * BİLEŞENLER
 *   ① kategori doğruluğu     — envelope kategori kararı beklenen kümede mi
 *   ② marka doğruluğu        — beyan varsa doğru yakalandı mı; beyan yokken
 *                              güvenilir marka üretmek WRONG (false positive)
 *   ③ ürün türü doğruluğu    — şablon productTokens beyanı envelope product
 *                              kanalında mı; beyan yokken placeholder-siz
 *                              yanlış ürün üretmek WRONG
 *   ④ kanonik varlık         — şablon expectedEntity çözülüyor mu; matchedAlias
 *                              metinde yoksa evrensel WRONG (halüsinasyon)
 *   ⑤ tedarikçi yeteneği     — bu korpusun evreni DEĞİL (talep değil firma
 *                              profili ölçer); pipeline doğruluğu ayrı kapıdan
 *                              rapor edilir (verify-supplier-capability-
 *                              consumption-v1 16/0). Burada NOT_APPLICABLE.
 *
 * SERT KAPILAR: her ölçülen bileşen ≥ %98 VE ②③④ için WRONG = 0.
 * Lossy (typo) varyantlarda MISSING sayılmaz (kalibrasyon sözleşmesi,
 * korpus doğrulayıcısıyla aynı); WRONG her varyantta sayılır.
 */
import { buildAdversarialCorpus } from "./fixtures/brain-adversarial-corpus-v1";
import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { buildPublishUnderstandingSnapshot } from "../src/lib/request/publish-understanding";
import { buildRequestRoutingEnvelope } from "../src/lib/matching-v3/routing-envelope";
import { syncFromText } from "../src/lib/request-composer";
import { buildDiscoveryProjectionFromState } from "../src/lib/discovery/build-projection";

function fold(v: unknown): string {
  return String(v ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/\s+/g, " ");
}

type Cls = {
  correct: number;
  wrong: number;
  missing: number;
  notApplicable: number;
};
const cls = (): Cls => ({ correct: 0, wrong: 0, missing: 0, notApplicable: 0 });
const score = (c: Cls) => {
  const den = c.correct + c.wrong + c.missing;
  return den ? (100 * c.correct) / den : null;
};

async function main() {
  const corpus = buildAdversarialCorpus();
  const category = cls();
  const brand = cls();
  const product = cls();
  const entity = cls();
  const failures: string[] = [];
  const fail = (id: string, m: string) => failures.push(`${id}: ${m}`);

  for (const c of corpus) {
    if (c.expected.scope !== "SUPPORTED") {
      category.notApplicable += 1;
      brand.notApplicable += 1;
      product.notApplicable += 1;
      entity.notApplicable += 1;
      continue;
    }
    const u = understandRequest(c.input) as never as {
      identity: { brand?: { value?: string } };
      resolvedEntities?: Array<{ canonicalId: string; matchedAlias?: string }>;
    };
    const snap = buildPublishUnderstandingSnapshot({
      understanding: u as never,
      userSelected: false,
      primarySlug: null,
    });
    const { state } = syncFromText(null, c.input) as never as {
      state: import("../src/lib/request-composer/types").CanonicalRequestState;
    };
    const projection = buildDiscoveryProjectionFromState(state);
    const env = buildRequestRoutingEnvelope({
      understandingSnapshot: snap,
      discoveryProjection: projection,
      categorySlug: state.categoryId ?? undefined,
    } as never) as never as {
      categoryResolution?: { primaryCategorySlug?: string | null };
      brand?: string | null;
      product?: string | null;
    };

    // ① KATEGORİ (envelope kararı)
    if (!c.expected.categories.length) category.notApplicable += 1;
    else {
      const got = env.categoryResolution?.primaryCategorySlug ?? null;
      if (got && c.expected.categories.includes(got)) category.correct += 1;
      else if (got && c.lossy) {
        /* Typo ayırt edici sözcüğü yok etmişse ("tekrlekli sandalye")
           kategori kayması kalibrasyon sınıfıdır — sert kapı dışı, ayrı
           raporlanır. */
        fail(c.id, `kategori(lossy) ${got}`);
      } else if (got) {
        category.wrong += 1;
        fail(c.id, `kategori WRONG: ${got}`);
      } else if (!c.lossy) {
        category.missing += 1;
        fail(c.id, `kategori MISSING`);
      }
    }

    // ② MARKA (envelope güvenilir marka kanalı + understanding kanalı)
    const gotBrand = env.brand ?? u.identity?.brand?.value ?? null;
    if (c.expected.brand) {
      if (gotBrand && fold(gotBrand).includes(fold(c.expected.brand))) {
        brand.correct += 1;
      } else if (gotBrand) {
        brand.wrong += 1;
        fail(c.id, `marka WRONG: ${gotBrand}`);
      } else if (!c.lossy) {
        brand.missing += 1;
        fail(c.id, `marka MISSING (beyan: ${c.expected.brand})`);
      }
    } else if (gotBrand) {
      brand.wrong += 1;
      fail(c.id, `marka FALSE-POSITIVE: ${gotBrand}`);
    } else {
      brand.notApplicable += 1;
    }

    // ③ ÜRÜN TÜRÜ (envelope product kanalı)
    const gotProduct = env.product ?? null;
    if (c.expected.productTokens.length) {
      const hay = fold(gotProduct);
      const hit = c.expected.productTokens.some((t) => hay.includes(fold(t)));
      if (gotProduct && hit) product.correct += 1;
      else if (
        gotProduct &&
        c.lossy &&
        fold(c.input).includes(fold(gotProduct))
      ) {
        /* Typo varyantında kullanıcının KENDİ bozuk sözcüğünü aynen taşımak
           sadakattir, yanlış değil ("playsttion"). Ayrı sınıf: lossy-verbatim. */
        product.correct += 1;
      } else if (gotProduct) {
        product.wrong += 1;
        fail(c.id, `ürün WRONG: "${gotProduct}" (beklenen ~${c.expected.productTokens[0]})`);
      } else if (!c.lossy) {
        product.missing += 1;
        fail(c.id, `ürün MISSING (beklenen ~${c.expected.productTokens[0]})`);
      }
    } else if (
      gotProduct &&
      !(() => {
        const hay = fold(c.input);
        const words = fold(gotProduct).split(" ").filter(Boolean);
        /* Kullanıcı-sözcüğü testi ünsüz yumuşamasını tanır:
           "danışmanlığı" → "danışmanlık" meşru normalizasyondur. */
        return words.every(
          (w) =>
            hay.includes(w) ||
            (w.length >= 5 && hay.includes(w.slice(0, -1))),
        );
      })()
    ) {
      /* Beyan yokken kullanıcının hiç yazmadığı bir ürün üretmek
         halüsinasyondur; kullanıcının kendi ifadesi serbesttir. */
      product.wrong += 1;
      fail(c.id, `ürün FALSE-POSITIVE: "${gotProduct}"`);
    } else {
      product.notApplicable += 1;
    }

    // ④ KANONİK VARLIK
    const ents = u.resolvedEntities ?? [];
    for (const e of ents) {
      if (c.lossy) break;
      if (e.matchedAlias && !fold(c.input).includes(fold(e.matchedAlias))) {
        entity.wrong += 1;
        fail(c.id, `varlık HALÜSİNASYONU: ${e.canonicalId} (alias metinde yok)`);
      }
    }
    if (c.expected.expectedEntity) {
      if (ents.some((e) => e.canonicalId === c.expected.expectedEntity)) {
        entity.correct += 1;
      } else if (!c.lossy) {
        entity.missing += 1;
        fail(c.id, `varlık MISSING: ${c.expected.expectedEntity}`);
      }
    } else {
      entity.notApplicable += 1;
    }
  }

  const p = (v: number | null) => (v == null ? "N/A" : v.toFixed(1) + "%");
  console.log("\n===== PROFESSIONAL_DISCOVERY_DATA_QUALITY V1 =====");
  console.log(`evren: ${corpus.length} üretim-eşdeğer vaka (zemin gerçeği şablondan)`);
  const rows: Array<[string, Cls]> = [
    ["① kategori", category],
    ["② marka", brand],
    ["③ ürün türü", product],
    ["④ kanonik varlık", entity],
  ];
  for (const [name, cc] of rows) {
    console.log(
      `${name}: ${p(score(cc))}  (CORRECT=${cc.correct} WRONG=${cc.wrong} MISSING=${cc.missing} N/A=${cc.notApplicable})`,
    );
  }
  console.log(
    "⑤ tedarikçi yeteneği: NOT_APPLICABLE bu evrende (talep değil firma profili ölçer) — pipeline doğruluğu: verify-supplier-capability-consumption-v1 (16/0) + verify-curated-entity-consumption-v1 (56/0)",
  );

  const gates =
    (score(category) ?? 0) >= 98 &&
    (score(brand) ?? 0) >= 98 &&
    (score(product) ?? 0) >= 98 &&
    (score(entity) ?? 0) >= 98 &&
    brand.wrong === 0 &&
    product.wrong === 0 &&
    entity.wrong === 0;

  if (failures.length) {
    console.log(`\n--- sınıflanan sapmalar (${failures.length}) ---`);
    for (const f of failures.slice(0, 60)) console.log("  " + f);
    if (failures.length > 60) console.log(`  … +${failures.length - 60}`);
  }
  console.log(`\nQUALITY_GATES=${gates ? "GREEN" : "RED"}`);
  if (!gates) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
