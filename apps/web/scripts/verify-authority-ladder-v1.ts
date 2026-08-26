/**
 * TEK KANONİK OTORİTE MERDİVENİ V1 — D3a (2026-08-26).
 *
 * NEDEN VAR. Aynı otorite sırası depoda dört ayrı biçimde yaşıyordu:
 * `provenance.ts` içinde `AttributeAuthority` + kendi rank tablosu,
 * `answer-authority.ts` içinde `AnswerAuthority` + kendi adları,
 * `build-state.ts` içinde `mapRuProvenance`'ın elle yazılmış "verified kaynak"
 * çifti, ve `preferExplicit`'in ikili EXPLICIT/değil kuralı. Dördü bugün aynı
 * yönde karar veriyordu ama hiçbiri diğerinden TÜREMİYORDU; biri değişince
 * ötekiler sessizce ayrışırdı. Bu kusur sınıfı depoda daha önce ölçüldü:
 * paralel bir "doğru listesi", kapanmış bir açığın başka bir katmanda açık
 * kalmasına yol açar.
 *
 * KANONİK SIRA: UNKNOWN < INFERRED < VERIFIED < USER_EXPLICIT.
 *
 * Bu doğrulayıcı SALT-OKUNURDUR.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assignAttributeIfNotWeaker,
  attributeAuthorityOf,
  authorityRank,
  isVerifiedSource,
  preferExplicit,
  uv,
  type Authority,
} from "../src/lib/request-understanding/provenance";
import type {
  UnderstandingSource,
  UnderstandingValue,
} from "../src/lib/request-understanding/types";
import {
  classifyAnswerAuthority,
  mayCloseQuestion,
} from "../src/lib/request-composer/answer-authority";
import { syncFromText } from "../src/lib/request-composer";

const LEVELS: readonly Authority[] = [
  "UNKNOWN",
  "INFERRED",
  "VERIFIED",
  "USER_EXPLICIT",
];

/** Her seviye için o seviyeyi üreten temsili bir değer. */
function valueAt(level: Authority, label: string): UnderstandingValue<string> | undefined {
  switch (level) {
    case "UNKNOWN":
      return undefined;
    case "INFERRED":
      return uv(label, {
        provenance: "INFERRED",
        source: "DETERMINISTIC_INFERENCE",
      });
    case "VERIFIED":
      return uv(label, { provenance: "INFERRED", source: "PRODUCT_IDENTITY" });
    case "USER_EXPLICIT":
      return uv(label, { provenance: "EXPLICIT", source: "USER_EXPLICIT" });
  }
}

let passed = 0;
const problems: string[] = [];

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.log(`FAIL  ${name}`);
    problems.push(`${name}: ${(error as Error).message}`);
  }
}

/* ---- (1) DÖRT SEVİYE × DÖRT SEVİYE — bütün birleştirme çiftleri ---- */
check("dört seviyenin bütün çiftlerinde zayıf olan güçlüyü ezemez", () => {
  for (const current of LEVELS) {
    for (const next of LEVELS) {
      const attributes: Record<string, UnderstandingValue<unknown> | undefined> =
        {};
      const currentValue = valueAt(current, "mevcut");
      if (currentValue) attributes.field = currentValue;
      const nextValue = valueAt(next, "yeni");
      if (!nextValue) continue; // UNKNOWN yazılmaz
      const wrote = assignAttributeIfNotWeaker(attributes, "field", nextValue);
      const expectWrite = authorityRank(next) >= authorityRank(current);
      assert.equal(
        wrote,
        expectWrite,
        `${current} → ${next}: yazım ${wrote}, beklenen ${expectWrite}`,
      );
      assert.equal(
        String(attributes.field?.value ?? ""),
        expectWrite ? "yeni" : "mevcut",
        `${current} → ${next}: değer yanlış`,
      );
      assert.ok(
        authorityRank(attributeAuthorityOf(attributes.field)) >=
          authorityRank(current),
        `${current} → ${next}: otorite düştü`,
      );
    }
  }
});

check("USER_EXPLICIT hiçbir alt seviye tarafından düşürülemez", () => {
  for (const lower of ["INFERRED", "VERIFIED"] as const) {
    const attributes: Record<string, UnderstandingValue<unknown> | undefined> = {
      field: valueAt("USER_EXPLICIT", "kullanici"),
    };
    assignAttributeIfNotWeaker(attributes, "field", valueAt(lower, "alt")!);
    assert.equal(attributeAuthorityOf(attributes.field), "USER_EXPLICIT");
    assert.equal(String(attributes.field?.value), "kullanici");
  }
});

check("VERIFIED, INFERRED tarafından düşürülemez", () => {
  const attributes: Record<string, UnderstandingValue<unknown> | undefined> = {
    field: valueAt("VERIFIED", "katalog"),
  };
  assignAttributeIfNotWeaker(attributes, "field", valueAt("INFERRED", "tahmin")!);
  assert.equal(attributeAuthorityOf(attributes.field), "VERIFIED");
  assert.equal(String(attributes.field?.value), "katalog");
});

/* ---- (2) SORU KAPATMA DAVRANIŞI ---- */
check("INFERRED soru kapatmaz", () => {
  const authority = classifyAnswerAuthority({
    kind: "VALUE",
    value: "vehicle",
    provenance: "INFERRED",
  });
  assert.equal(authority, "INFERRED");
  assert.equal(mayCloseQuestion(authority), false);
});

check("VERIFIED soru kapatır ama kullanıcı beyanı gibi etiketlenmez", () => {
  const authority = classifyAnswerAuthority({
    kind: "VALUE",
    value: "Apple",
    provenance: "CATALOG_ENRICHED",
  });
  assert.equal(authority, "VERIFIED");
  assert.equal(mayCloseQuestion(authority), true);
  assert.notEqual(authority, "USER_EXPLICIT");
});

check("USER_EXPLICIT yalnız açık kullanıcı eyleminden doğar", () => {
  for (const p of ["EXPLICIT_TEXT", "EXPLICIT_BROWSE"] as const) {
    assert.equal(
      classifyAnswerAuthority({ kind: "VALUE", value: "x", provenance: p }),
      "USER_EXPLICIT",
    );
  }
  for (const p of ["INFERRED", "CATALOG_ENRICHED"] as const) {
    assert.notEqual(
      classifyAnswerAuthority({ kind: "VALUE", value: "x", provenance: p }),
      "USER_EXPLICIT",
    );
  }
  // Değeri olmayan alan hiçbir otorite üretmez.
  assert.equal(classifyAnswerAuthority({ kind: "UNKNOWN" }), "UNKNOWN");
  assert.equal(
    classifyAnswerAuthority({ kind: "VALUE", value: "  ", provenance: "EXPLICIT_TEXT" }),
    "UNKNOWN",
  );
});

/* ---- (3) SOURCE EŞLEMESİ TAM VE TİP GÜVENLİ ---- */
check("gerçek UnderstandingSource → authority eşlemesi TAM", () => {
  /**
   * `Record<UnderstandingSource, …>` eksiksizliği DERLEME zamanında zorlar:
   * enum'a yeni bir üye eklenirse bu nesne derlenmez.
   */
  const expected: Record<UnderstandingSource, boolean> = {
    USER_EXPLICIT: false,
    NORMALIZED_EXPLICIT: false,
    DETERMINISTIC_INFERENCE: false,
    PRODUCT_IDENTITY: true,
    CATEGORY_INFERENCE: false,
    STRATEGY_INFERENCE: false,
    STRUCTURED_FIELD: false,
    FUTURE_KNOWLEDGE: true,
    FUTURE_LLM: false,
  };
  for (const [source, verified] of Object.entries(expected)) {
    assert.equal(
      isVerifiedSource(source as UnderstandingSource),
      verified,
      `${source}: isVerifiedSource ${!verified} döndü`,
    );
  }
});

check("enum'da olmayan ölü source değeri production listesinde yok", () => {
  const src = readFileSync(
    join(__dirname, "..", "src", "lib", "request-understanding", "provenance.ts"),
    "utf8",
  );
  for (const dead of ["CATALOG", "TAXONOMY"]) {
    assert.ok(
      !new RegExp(`"${dead}"`).test(src),
      `provenance.ts hâlâ ölü source "${dead}" taşıyor`,
    );
  }
  // Liste TypeScript tarafından denetlenmeli: serbest string kümesi olmasın.
  assert.ok(
    /satisfies readonly UnderstandingSource\[\]/.test(src),
    "verified source listesi `satisfies readonly UnderstandingSource[]` ile denetlenmiyor",
  );
  assert.ok(
    !/new Set<string>\(/.test(src),
    "verified source listesi hâlâ tipsiz `Set<string>`",
  );
});

/* ---- (4) İKİNCİ BAĞIMSIZ RANK TABLOSU YOK ---- */
check("aynı rank'i tanımlayan ikinci bağımsız tablo bulunmaz", () => {
  const root = join(__dirname, "..", "src", "lib");
  const files = [
    join(root, "request-understanding", "provenance.ts"),
    join(root, "request-composer", "answer-authority.ts"),
    join(root, "request-composer", "build-state.ts"),
  ];
  let rankTables = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    rankTables += (src.match(/USER_EXPLICIT:\s*\d/g) ?? []).length;
    // Answer katmanı kendi merdiven ADLARINI da taşımamalı.
    if (file.endsWith("answer-authority.ts")) {
      assert.ok(
        !/AUTHORITY_VERIFIED_EQUIVALENT|INFERENCE_ONLY"/.test(src),
        "answer-authority.ts hâlâ kendi merdiven adlarını taşıyor",
      );
      assert.ok(
        /from "@\/lib\/request-understanding\/provenance"|from "\.\.\/request-understanding\/provenance"/.test(
          src,
        ),
        "answer-authority.ts kanonik otoriteden türemiyor",
      );
    }
    if (file.endsWith("build-state.ts")) {
      assert.ok(
        /isVerifiedSource/.test(src),
        "mapRuProvenance kanonik verified kaynağından türemiyor",
      );
    }
  }
  assert.equal(rankTables, 1, `rank tablosu sayısı ${rankTables}, 1 olmalı`);
});

check("preferExplicit ayrı ikili kural değil, kanonik merdiveni kullanır", () => {
  const strong = valueAt("USER_EXPLICIT", "kullanici")!;
  const verified = valueAt("VERIFIED", "katalog")!;
  const inferred = valueAt("INFERRED", "tahmin")!;
  assert.equal(preferExplicit(inferred, strong)?.value, "kullanici");
  assert.equal(preferExplicit(strong, inferred)?.value, "kullanici");
  // İkili kural burada YANILIRDI: ikisi de EXPLICIT değil, ama VERIFIED üstündür.
  assert.equal(preferExplicit(inferred, verified)?.value, "katalog");
  assert.equal(preferExplicit(verified, inferred)?.value, "katalog");
  const srcPath = join(
    __dirname,
    "..",
    "src",
    "lib",
    "request-understanding",
    "provenance.ts",
  );
  const src = readFileSync(srcPath, "utf8");
  const body = src.slice(src.indexOf("export function preferExplicit"));
  assert.ok(
    /authorityRank|attributeAuthorityOf/.test(body),
    "preferExplicit kanonik merdiveni okumuyor",
  );
});

/* ---- (5) D2 SÖZLEŞMESİ KORUNUR ---- */
check("PART/SERVICE açık seçimleri yeniden analizde USER_EXPLICIT kalır", () => {
  for (const [input, needType] of [
    ["yedek parça arıyorum", "part"],
    ["servis arıyorum", "service"],
  ] as const) {
    const { state } = syncFromText(null, input, {
      structured: { fieldValues: { needType } },
    });
    const field = (
      state.fields as Record<string, { value?: unknown; provenance?: string }>
    ).needType;
    assert.equal(String(field?.value ?? ""), needType, `${input}: değer düştü`);
    assert.equal(
      classifyAnswerAuthority(field),
      "USER_EXPLICIT",
      `${input}: otorite düştü`,
    );
    const attr = (
      state.understanding as unknown as {
        attributes?: Record<string, UnderstandingValue<unknown>>;
      }
    ).attributes?.needType;
    assert.equal(
      attributeAuthorityOf(attr),
      "USER_EXPLICIT",
      `${input}: anlama otoritesi düştü`,
    );
  }
});

console.log("\n===== HUKUM =====");
if (problems.length) {
  console.error(`KIRMIZI — ${passed} passed, ${problems.length} failed:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `YESIL — ${passed} passed. Tek kanonik merdiven: ` +
    "UNKNOWN < INFERRED < VERIFIED < USER_EXPLICIT.",
);
process.exit(0);
