/**
 * MARKA HALÜSİNASYONU ŞEKİL KAPISI V1 (2026-09-20, OL-0011 devamı).
 *
 * NEDEN VAR. 1077 korpusun halüsinasyon kapıları yalnız korpustaki girdi
 * şekillerini görür; İngilizce öbek teşhisi korpusta hiç olmayan üç canlı
 * halüsinasyon buldu (SMART markası, FORD + VEHICLE, iPhone 17 VEHICLE).
 * Bu kapı o sınıfın kalıcı ölçümüdür: 67 girdilik şekil × kategori
 * ızgarası (fixtures/brand-hallucination-shapes-v1) canlı beyinden geçer.
 *
 * SERT KURALLAR
 *   H1 — beklenen marka yokken (null) herhangi bir marka dönerse, ya da
 *        ONLY:<ad> satırında BAŞKA bir marka dönerse: HALÜSİNASYON.
 *        Markanın hiç dönmemesi H1 ihlali DEĞİLDİR (bilmemek ≠ uydurmak).
 *   H2 — araç olmayan girdi (MUST_NOT) VEHICLE öznesi dönerse: sahte araç.
 *   H3 — gerçek araç girdisi (MUST) VEHICLE dönmezse: tuzak kaybı — bu
 *        kapı otomotiv kataloğunu cezalandırma bahanesi olamaz.
 *   H4 — marka girdide AÇIKÇA yazılıyken (brandRule=MUST) kesin marka
 *        alanı boş ya da yanlışsa: MARKA KAYBI (2026-09-2x eki). Kapı tek
 *        yönlüydü: uydurmayı görüyor, çalmayı görmüyordu — alan-uyumu
 *        indirgemesi (9934f8a c maddesi) tam bu yönde risk taşır. Kesin
 *        alan boşken adayda (brandCandidate) duran marka AYRI raporlanır:
 *        "adayda var" ile "hiç yok" aynı sayıya katılmaz — ikisi farklı
 *        şiddettir ama ikisi de H4'tür (ödenen filtre adayı görmez).
 *
 * Çıktı ratchet'e bağlanabilir: "N passed, M failed" + eksen kırılımı.
 * Doğuşunda KIRMIZI olması beklenir (teşhiste en az üç ihlal canlı
 * ölçüldü); bu, kapının kırmızı verebildiğinin doğum kanıtıdır.
 */
process.env.DATABASE_URL ??=
  "postgresql://verifier:verifier@127.0.0.1:5432/verifier";

import {
  BRAND_HALLUCINATION_SHAPES_V1,
  type HallucinationShapeCase,
} from "./fixtures/brand-hallucination-shapes-v1";
import { understandRequest } from "../src/lib/request-understanding/understand-request";

function foldTr(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
}

type Violation = { id: string; axis: string; rule: "H1" | "H2" | "H3" | "H4"; detail: string };

const violations: Violation[] = [];
let passed = 0;
let h4InCandidate = 0;
let h4Absent = 0;

function judge(c: HallucinationShapeCase): void {
  const u = understandRequest(c.input);
  const brand = u.identity.brand?.value ?? null;
  const candidate =
    (u.attributes.brandCandidate as { value?: unknown } | undefined)?.value ??
    null;
  const kind = u.subject.kind.value;
  const local: Violation[] = [];

  if (brand != null) {
    if (c.expectedBrand == null) {
      local.push({
        id: c.id, axis: c.axis, rule: "H1",
        detail: `markasız girdide marka üretildi: "${brand}"`,
      });
    } else if (!foldTr(brand).includes(foldTr(c.expectedBrand)) &&
      !foldTr(c.expectedBrand).includes(foldTr(brand))) {
      local.push({
        id: c.id, axis: c.axis, rule: "H1",
        detail: `yanlış marka: beklenen "${c.expectedBrand}", dönen "${brand}"`,
      });
    }
  }

  if (c.brandRule === "MUST" && c.expectedBrand != null) {
    const brandMatches =
      brand != null &&
      (foldTr(brand).includes(foldTr(c.expectedBrand)) ||
        foldTr(c.expectedBrand).includes(foldTr(brand)));
    if (!brandMatches) {
      const inCandidate =
        typeof candidate === "string" &&
        (foldTr(candidate).includes(foldTr(c.expectedBrand)) ||
          foldTr(c.expectedBrand).includes(foldTr(candidate)));
      if (inCandidate) h4InCandidate += 1;
      else h4Absent += 1;
      local.push({
        id: c.id, axis: c.axis, rule: "H4",
        detail: `marka kaybı: beklenen "${c.expectedBrand}", kesin alan ${brand == null ? "boş" : `"${brand}"`}${inCandidate ? ` (adayda duruyor: "${String(candidate)}")` : " (adayda da yok)"}`,
      });
    }
  }

  if (c.vehicle === "MUST_NOT" && kind === "VEHICLE") {
    local.push({
      id: c.id, axis: c.axis, rule: "H2",
      detail: `araç olmayan girdi VEHICLE döndü (marka=${brand ?? "-"})`,
    });
  }
  if (c.vehicle === "MUST" && kind !== "VEHICLE") {
    local.push({
      id: c.id, axis: c.axis, rule: "H3",
      detail: `gerçek araç girdisi VEHICLE dönmedi (kind=${kind})`,
    });
  }

  if (local.length === 0) passed += 1;
  else violations.push(...local);
}

for (const c of BRAND_HALLUCINATION_SHAPES_V1) judge(c);

console.log("===== MARKA HALÜSİNASYONU ŞEKİL KAPISI V1 =====");
console.log(`girdi: ${BRAND_HALLUCINATION_SHAPES_V1.length} (5 eksen)`);

const byAxis = new Map<string, number>();
const byRule = new Map<string, number>();
for (const v of violations) {
  byAxis.set(v.axis, (byAxis.get(v.axis) ?? 0) + 1);
  byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1);
}
for (const [rule, n] of [...byRule.entries()].sort()) {
  console.log(`${rule}: ${n} ihlal`);
}
console.log(
  `H4 kırılımı — kesin alanda yok, adayda var: ${h4InCandidate} · hiç yok: ${h4Absent}`,
);
for (const [axis, n] of [...byAxis.entries()].sort()) {
  console.log(`  eksen ${axis}: ${n}`);
}
for (const v of violations) {
  console.log(`  - ${v.rule} ${v.id} (${v.axis}): ${v.detail}`);
}

const failedCases =
  BRAND_HALLUCINATION_SHAPES_V1.length - passed;
console.log(`\n${passed} passed, ${failedCases} failed`);
if (failedCases > 0) process.exit(1);
