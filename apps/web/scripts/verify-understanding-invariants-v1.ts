/**
 * Understanding invariant sweep — class-level guards over the REAL pipeline.
 *
 * Purpose: Dinçer should never have to find these by hand. Every bug class he
 * reported becomes an invariant here, checked across many realistic Turkish
 * inputs (canonical, diacritic-free and ALL-CAPS spellings alike):
 *
 *   I1  No intent/commission verb may survive as brand, model or product.
 *   I2  No product-type phrase may be labeled as a model.
 *   I3  Category must not be "services" when a confident product detector
 *       fired for a manufacture request (kartvizit yaptırmak ≠ Hizmetler).
 *   I4  ALL-CAPS and diacritic-free inputs must resolve like canonical ones.
 *   I5  Brand values must come from the catalog (canonical spelling), and a
 *       brand the user typed must be recognized as EXPLICIT.
 *   I6  The understood-facts board must never render duplicate label+value
 *       rows, and displayed values keep Turkish diacritics.
 *   I7  An explicit browse/question answer survives a text re-sync when the
 *       conflicting phrase in the text did not change.
 *
 * Synthetic only: no DB, no network, no notifications.
 */
import assert from "node:assert/strict";

import { understandRequest } from "../src/lib/request-understanding/understand-request";
import { isProductTypePhrase } from "../src/lib/product-identity/identity-candidates";
import { enrichUnderstoodFacts } from "../src/lib/request-composer/v2/understood-facts";
import { mergePreservedBrowseFields } from "../src/lib/request-composer/build-state";
import {
  buildUnderstoodFacts,
  syncFromText,
  syncFromBrowse,
} from "../src/lib/request-composer";

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
    passed += 1;
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(err);
  }
}

const FOLD: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};
function fold(s: string): string {
  let out = "";
  for (const ch of s.toLocaleLowerCase("tr-TR")) out += FOLD[ch] ?? ch;
  return out;
}

type Res = Record<string, never>;
function ru(raw: string) {
  return understandRequest({ rawInput: raw }) as never as Res;
}
function catOf(r: Res): string | null {
  return ((r as never)["category"] as Record<string, unknown>)["value"] as
    | string
    | null;
}
function identityOf(r: Res) {
  return ((r as never)["identity"] ?? {}) as Record<
    string,
    { value?: unknown } | undefined
  >;
}

/** Verbs & conversation words that must never become a value. */
const FORBIDDEN_VALUE_TOKENS = [
  "almak", "satmak", "aramak", "bakmak", "bulmak", "kiralamak",
  "yaptırmak", "yaptirmak", "bastırmak", "bastirmak", "ürettirmek",
  "istiyorum", "arıyorum", "ariyorum", "lazım", "lazim", "gerek",
];

/** Broad, realistic sweep corpus — canonical / ASCII / CAPS variants. */
const SWEEP: string[] = [
  "Arçelik 55 inç televizyon almak istiyorum",
  "arcelik 55 inc tv",
  "ARÇELİK 55 İNÇ TELEVİZYON ALMAK İSTİYORUM",
  "kartvizit yaptırmak istiyorum",
  "KARTVİZİT YAPTIRMAK İSTİYORUM",
  "1000 adet kartvizit bastırmak istiyorum",
  "logolu kutu yaptırmak istiyorum",
  "ikinci el dyson hava temizleyicisi arıyorum",
  "dyson hava temizleyicisi",
  "robot süpürge arıyorum",
  "robot supurge ariyorum",
  "vestel çamaşır makinesi almak istiyorum",
  "samsung buzdolabı arıyorum",
  "50 ofis sandalyesi lazım acil İstanbul",
  "2+1 kiralık daire Bağcılar",
  "3+1 kiralık ev arıyorum ankara civarı",
  "klima montajı yaptırmak istiyorum",
  "ev boyatmak istiyorum",
  "Heidelberg SM 74 için nemlendirme pompası lazım",
  "iphone 15 pro max almak istiyorum",
  "makarna makinesi bakıyorum",
  "hava nemlendirici arıyorum",
  "saç kurutma makinesi",
  "bulaşık makinesi tamiri",
  "broşür bastırmak istiyorum 5000 adet",
  // MediaMarkt envanterinden eklenen markalar (2026-08-22)
  "canon fotoğraf makinesi almak istiyorum",
  "jbl bluetooth hoparlör arıyorum",
  "KARCHER HALI YIKAMA MAKİNESİ",
  "logitech kablosuz mouse",
  "nespresso kahve makinesi kapsüllü",
];

check("I8: MediaMarkt-sourced brands resolve with correct category", () => {
  for (const [raw, wantCat, wantBrand] of [
    ["canon fotoğraf makinesi almak istiyorum", "technology", "Canon"],
    ["jbl bluetooth hoparlör arıyorum", "technology", "JBL"],
    ["karcher halı yıkama makinesi", "appliances", "Kärcher"],
    ["KARCHER HALI YIKAMA", "appliances", "Kärcher"],
    ["braun tıraş makinesi", "appliances", "Braun"],
    ["nespresso kahve makinesi kapsüllü", "home-kitchen", "Nespresso"],
  ] as const) {
    const r = ru(raw);
    assert.equal(catOf(r), wantCat, raw);
    assert.equal(identityOf(r).brand?.value, wantBrand, raw);
  }
});

/* ================= I1 + I2 + I5 — value hygiene over the sweep ============ */

check("I1: no verb/conversation token survives as brand/model/product", () => {
  const bad: string[] = [];
  for (const raw of SWEEP) {
    const r = ru(raw);
    const idn = identityOf(r);
    for (const key of ["brand", "model", "series"]) {
      const v = idn[key]?.value;
      if (v == null) continue;
      const f = fold(String(v));
      for (const tok of FORBIDDEN_VALUE_TOKENS) {
        if (f === fold(tok)) bad.push(`${raw} → ${key}=${String(v)}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

check("I2: no product-type phrase is labeled as a model", () => {
  const bad: string[] = [];
  for (const raw of SWEEP) {
    const r = ru(raw);
    const model = identityOf(r).model?.value;
    if (model == null) continue;
    if (isProductTypePhrase(String(model))) {
      bad.push(`${raw} → model=${String(model)}`);
    }
  }
  assert.deepEqual(bad, []);
});

check("I2c: composer fields.model never carries a product-type phrase", () => {
  const bad: string[] = [];
  for (const raw of SWEEP) {
    const { state } = syncFromText(null, raw);
    const model = state.fields.model?.value;
    if (model == null) continue;
    if (isProductTypePhrase(String(model))) {
      bad.push(`${raw} → fields.model=${String(model)}`);
    }
  }
  assert.deepEqual(bad, []);
  // Real model codes must survive the same gate.
  const heidelberg = syncFromText(
    null,
    "Heidelberg SM 74 için nemlendirme pompası lazım",
  );
  assert.equal(String(heidelberg.state.fields.model?.value ?? ""), "SM 74");
});

check("I2b: instrument-noun morphology counts as product type", () => {
  for (const phrase of [
    "hava temizleyicisi",
    "temizleyici",
    "nemlendirici",
    "hava nemlendiricisi",
  ]) {
    assert.ok(isProductTypePhrase(phrase), phrase);
  }
  // Real model codes must NOT be swallowed by the suffix rule.
  for (const code of ["DCD996", "SM 74", "C180", "A55", "V15 Detect"]) {
    assert.ok(!isProductTypePhrase(code), code);
  }
});

/* ================= I3 — manufacture vs services =========================== */

check("I3: printed goods with 'yaptırmak' stay in printing, services stay services", () => {
  for (const [raw, want] of [
    ["kartvizit yaptırmak istiyorum", "printing"],
    ["KARTVİZİT YAPTIRMAK İSTİYORUM", "printing"],
    ["logolu kutu yaptırmak istiyorum", "printing"],
    ["1000 adet kartvizit bastırmak istiyorum", "printing"],
    ["klima montajı yaptırmak istiyorum", "services"],
    ["ev boyatmak istiyorum", "services"],
  ] as const) {
    assert.equal(catOf(ru(raw)), want, raw);
  }
});

/* ================= I4 — spelling robustness =============================== */

check("I4: ALL-CAPS and ASCII spellings resolve to the same category", () => {
  const trios: Array<[string, string, string]> = [
    [
      "Arçelik 55 inç televizyon almak istiyorum",
      "arcelik 55 inc tv almak istiyorum",
      "ARÇELİK 55 İNÇ TELEVİZYON ALMAK İSTİYORUM",
    ],
    [
      "kartvizit yaptırmak istiyorum",
      "kartvizit yaptirmak istiyorum",
      "KARTVİZİT YAPTIRMAK İSTİYORUM",
    ],
    [
      "robot süpürge arıyorum",
      "robot supurge ariyorum",
      "ROBOT SÜPÜRGE ARIYORUM",
    ],
  ];
  for (const [a, b, c] of trios) {
    const ca = catOf(ru(a));
    assert.ok(ca, a);
    assert.equal(catOf(ru(b)), ca, `${b} ≠ ${a}`);
    assert.equal(catOf(ru(c)), ca, `${c} ≠ ${a}`);
  }
});

check("I4b: user-typed brand is EXPLICIT regardless of spelling", () => {
  for (const raw of [
    "Arçelik 55 inç televizyon almak istiyorum",
    "arcelik 55 inc tv",
    "ARÇELİK TELEVİZYON",
  ]) {
    const idn = identityOf(ru(raw));
    assert.equal(idn.brand?.value, "Arçelik", raw);
    assert.equal(
      (idn.brand as { provenance?: string } | undefined)?.provenance,
      "EXPLICIT",
      raw,
    );
  }
});

/* ================= I5 — brand canonicalization ============================ */

check("I5: brand values are canonical catalog spellings", () => {
  const bad: string[] = [];
  for (const raw of SWEEP) {
    const v = identityOf(ru(raw)).brand?.value;
    if (v == null) continue;
    const s = String(v);
    // Canonical entries start uppercase and are not shouting.
    if (s === s.toLocaleUpperCase("tr-TR") && s.length > 3) {
      bad.push(`${raw} → brand=${s}`);
    }
  }
  assert.deepEqual(bad, []);
});

/* ================= I6 — understood-facts board hygiene ==================== */

function boardFor(raw: string) {
  const { state } = syncFromText(null, raw);
  const facts = enrichUnderstoodFacts({
    facts: buildUnderstoodFacts(state),
    understanding: state.understanding,
    categoryId: state.categoryId,
  });
  return facts;
}

check("I6: board never renders duplicate label+value rows", () => {
  const bad: string[] = [];
  for (const raw of SWEEP) {
    const rows = boardFor(raw);
    const seen = new Set<string>();
    for (const row of rows) {
      const id = `${row.label}::${fold(row.displayValue)}`;
      if (seen.has(id)) bad.push(`${raw} → ${row.label}: ${row.displayValue}`);
      seen.add(id);
    }
  }
  assert.deepEqual(bad, []);
});

check("I6b: displayed values keep Turkish diacritics for known words", () => {
  const rows = boardFor("robot süpürge arıyorum");
  const flat = rows.map((r) => r.displayValue).join(" | ");
  assert.ok(
    !/supurge/i.test(flat),
    `diacritic-stripped display leaked: ${flat}`,
  );
});

/* ================= I7 — explicit answer beats stale text ================== */

check("I7: unchanged text phrase cannot clobber an explicit answer", () => {
  // Same precedence class Dinçer hit with city ("ankara" in text kept beating
  // his chosen city). `fields` carries brand through the exact same merge, so
  // the invariant is exercised on brand end-to-end.
  // 1) User writes text containing "arçelik"
  const first = syncFromText(null, "arçelik televizyon almak istiyorum");
  assert.equal(
    String(first.state.fields.brand?.value ?? ""),
    "Arçelik",
    "precondition: text extracted Arçelik",
  );
  // 2) User answers the brand question with Vestel (browse/question path)
  const answered = syncFromBrowse(first.state, {
    key: "brand",
    value: "Vestel",
    isAny: false,
  });
  assert.equal(String(answered.state.fields.brand?.value ?? ""), "Vestel");
  // 3) User touches the text again — same "arçelik" phrase still inside
  const resynced = syncFromText(
    answered.state,
    "arçelik televizyon almak istiyorum acil",
    { force: true },
  );
  assert.equal(
    String(resynced.state.fields.brand?.value ?? ""),
    "Vestel",
    "stale 'arçelik' in the text clobbered the explicit answer",
  );
  // 4) But a REAL text change to the brand is a new statement and must win
  const retyped = syncFromText(
    answered.state,
    "samsung televizyon almak istiyorum",
    { force: true },
  );
  assert.equal(
    String(retyped.state.fields.brand?.value ?? ""),
    "Samsung",
    "a genuinely retyped brand must override the old answer",
  );
});

check("I7b: merge helper honors rawInputs contract directly", () => {
  const browseCity = {
    kind: "VALUE" as const,
    value: "İzmir",
    provenance: "EXPLICIT_BROWSE" as const,
    confidence: 1,
    evidence: ["user-answer"],
  };
  const textCity = {
    kind: "VALUE" as const,
    value: "Ankara",
    provenance: "EXPLICIT_TEXT" as const,
    confidence: 0.9,
    evidence: ["ankara"],
  };
  const merged = mergePreservedBrowseFields(
    { city: textCity },
    { city: browseCity },
    "text",
    { previous: "ev arıyorum ankara civarı", current: "ev arıyorum ankara civarı acil" },
  );
  assert.equal(merged.city?.value, "İzmir", "stale restatement must not win");

  const fresh = mergePreservedBrowseFields(
    { city: textCity },
    { city: browseCity },
    "text",
    { previous: "ev arıyorum izmir tarafı", current: "ev arıyorum ankara civarı" },
  );
  assert.equal(fresh.city?.value, "Ankara", "newly typed value must win");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
