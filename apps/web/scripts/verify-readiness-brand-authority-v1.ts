/**
 * READINESS MARKA OTORİTESİ DOĞRULAYICISI V1 (2026-08-27).
 *
 * TEK SORU. Readiness Pro formülüne giren "güvenilir marka" sayısı,
 * markanın VAR olmasını değil, marka kanıtının kanonik otorite
 * merdivenindeki seviyesini ölçüyor mu?
 *
 * İKİ AYRI HATA — ikisi de aynı kök nedenden gelir:
 *
 *   (1) KÖR OKUMA. D3c-b (111b412) iç kanıtı `snapshot.attributes`
 *       torbasından tipli `internalEvidence` kanalına taşıdı. Eski yolu
 *       okuyan ölçüm aracı kanıtı hiç göremez ve sistemi olduğundan KÖTÜ
 *       gösterir.
 *
 *   (2) ANAHTAR SAYMA. Tipli kanalı okumak tek başına yetmez: yalnız
 *       "anahtar mevcut" diye saymak, Talepo'nun kendi çıkarımını
 *       kullanıcı doğrulaması gibi gösterir ve sistemi olduğundan İYİ
 *       gösterir.
 *
 * GÜVEN KURALI (kurucu, 2026-08-27). Karar kanonik merdivenden okunur:
 * `request-understanding/provenance.ts` → `Authority` / `AUTHORITY_RANK` /
 * `isAtLeastAuthority`. Eşik `VERIFIED`; `VERIFIED` ve `USER_EXPLICIT`
 * güvenilir, `INFERRED` ve `UNKNOWN` değildir. Bu dosyada ikinci bir rank
 * tablosu ya da ikinci bir "doğrulanmış kaynak" listesi YOKTUR.
 *
 * ÜRÜN KODU DEĞİŞMEDİ. Bu yalnız bir ölçüm otoritesi düzeltmesidir; anlama
 * katmanı, snapshot üreticileri ve routing envelope'a dokunulmadı.
 */
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { join as pathJoin } from "node:path";

import {
  BRAND_BASELINE,
  BRAND_EVIDENCE_AUTHORITY_BASELINE,
  LEGACY_BRAND_EVIDENCE_VALUE,
  TRUSTED_BRAND_IDENTITIES,
} from "./fixtures/readiness-brand-authority-v1";
import { CATEGORY_COVERAGE_V1 } from "./fixtures/category-coverage-v1";

import { understandRequest } from "../src/lib/request-understanding/understand-request";
import {
  attributeAuthorityOf,
  isAtLeastAuthority,
  type Authority,
} from "../src/lib/request-understanding/provenance";
import { buildPublishUnderstandingSnapshot } from "../src/lib/request/publish-understanding";
import {
  normalizeSnapshotInternalEvidence,
  type RequestUnderstandingSnapshot,
} from "../src/lib/request/understanding-snapshot";
import { buildRequestRoutingEnvelope } from "../src/lib/matching-v3/routing-envelope";

/* ------------------------------------------------------------------ *
 * KANONİK OKUYUCU — tek tanım. Kapsam doğrulayıcısı da bunu içe aktarır;
 * ölçüm mantığının ikinci bir kopyası yoktur.
 * ------------------------------------------------------------------ */

export type BrandEvidenceReading = {
  /** Marka kanıtı KAYDI var mı (tipli kanal ya da eski şekil)? */
  present: boolean;
  /** Kaydın kanonik merdivendeki seviyesi. */
  authority: Authority;
  /**
   * Kaydın kendi DEĞERİ (`BrandEvidenceStatus` dizesi). Raporda görünür
   * ama güven kararına GİRMEZ: değerin "VERIFIED_CATALOG" demesi, kaydı
   * yazan katmanın otoritesini değiştirmez.
   */
  value: string | null;
};

/**
 * Marka kanıtını okur.
 *
 * Sıra: önce tipli `internalEvidence.brandEvidence`; eski kayıtlar için
 * kanonik legacy normalizer (`normalizeSnapshotInternalEvidence`) aynı
 * kanala taşır. Fallback'te otorite bilgisi eski kayıtta HİÇ yoktu ve
 * uydurulamaz — provenance ve source'un ikisi de yoksa seviye `UNKNOWN`
 * olur, `UNKNOWN` güvenilir değildir.
 */
export function readBrandEvidence(
  snapshot: RequestUnderstandingSnapshot,
): BrandEvidenceReading {
  const entry = normalizeSnapshotInternalEvidence(snapshot).internalEvidence
    ?.brandEvidence;
  const value = String(entry?.value ?? "").trim();
  if (!entry || !value) {
    return { present: false, authority: "UNKNOWN", value: null };
  }
  const hasAuthoritySignal =
    entry.provenance != null || entry.source != null;
  return {
    present: true,
    authority: hasAuthoritySignal
      ? attributeAuthorityOf(entry as never)
      : "UNKNOWN",
    value,
  };
}

/** Eşik merdivenin kendisinden okunur; burada seviye listesi kurulmaz. */
export function isTrustedBrandAuthority(authority: Authority): boolean {
  return isAtLeastAuthority(authority, "VERIFIED");
}

/* ------------------------------------------------------------------ */

type Row = {
  id: string;
  envBrand: string | null;
  /** Gerçek üretim snapshot'ı — mutasyon kapıları bunun üzerinde çalışır. */
  snapshot: RequestUnderstandingSnapshot;
  evidence: BrandEvidenceReading;
  /** Eski (D3c-b öncesi) yolun gördüğü şey — körlüğü kanıtlamak için. */
  legacyAttributeKeyPresent: boolean;
};

function measureAll(): Row[] {
  const rows: Row[] = [];
  for (const sc of CATEGORY_COVERAGE_V1 as ReadonlyArray<{
    id: string;
    input: string;
  }>) {
    const input = Object.freeze({ rawInput: sc.input });
    assert.equal(
      Object.keys(input).length,
      1,
      "engine girdisi tek alanlı olmalı",
    );
    const u = understandRequest(input as never);
    const snap = buildPublishUnderstandingSnapshot({
      understanding: u as never,
      userSelected: false,
      primarySlug: null,
    });
    const env = buildRequestRoutingEnvelope({
      understandingSnapshot: snap,
    } as never) as never as { brand?: string | null };
    rows.push({
      id: sc.id,
      envBrand: env.brand ?? null,
      snapshot: snap,
      evidence: readBrandEvidence(snap),
      legacyAttributeKeyPresent: Object.prototype.hasOwnProperty.call(
        snap.attributes ?? {},
        "brandEvidence",
      ),
    });
  }
  return rows;
}

function trustedIds(rows: Row[]): string[] {
  return rows
    .filter((r) => r.envBrand && isTrustedBrandAuthority(r.evidence.authority))
    .map((r) => r.id)
    .sort();
}

function serialize(rows: Row[]): string {
  return rows
    .map(
      (r) =>
        `${r.id}|${r.envBrand ?? "-"}|${r.evidence.present ? 1 : 0}|` +
        `${r.evidence.authority}|${r.evidence.value ?? "-"}|` +
        `${r.legacyAttributeKeyPresent ? 1 : 0}`,
    )
    .join("\n");
}

/* ------------------------------------------------------------------ */

const problems: string[] = [];
function check(ok: boolean, message: string): void {
  if (!ok) problems.push(message);
}

function main(): void {
  /* ---- G1: determinizm — iki koşu byte-birebir aynı ---- */
  const runA = measureAll();
  const runB = measureAll();
  const serialA = serialize(runA);
  const serialB = serialize(runB);
  check(
    serialA === serialB,
    "G1 determinizm: iki ölçüm koşusu byte-birebir aynı değil.",
  );

  const rows = runA;
  const n = rows.length;
  check(
    n === BRAND_BASELINE.scenarios,
    `G1 senaryo sayısı ${n}, taban ${BRAND_BASELINE.scenarios}.`,
  );

  /* ---- sayaçlar ---- */
  const brandPresent = rows.filter((r) => r.envBrand).length;
  const evidencePresent = rows.filter((r) => r.evidence.present).length;
  const byAuthority = (a: Authority) =>
    rows.filter((r) => r.evidence.present && r.evidence.authority === a).length;
  const evUnknown = byAuthority("UNKNOWN");
  const evInferred = byAuthority("INFERRED");
  const evVerified = byAuthority("VERIFIED");
  const evUserExplicit = byAuthority("USER_EXPLICIT");
  const routableTrusted = trustedIds(rows).length;

  check(
    evUnknown + evInferred + evVerified + evUserExplicit === evidencePresent,
    "sayaç bütünlüğü: otorite kovaları BRAND_EVIDENCE_PRESENT'i bölmüyor.",
  );

  /* ---- KIRMIZI KANIT 1: eski yol kör ---- */
  const legacyPathSees = rows.filter((r) => r.legacyAttributeKeyPresent).length;
  check(
    legacyPathSees === 0 && evidencePresent > 0,
    `RED-1 kör okuma: eski attributes yolu ${legacyPathSees}, tipli kanal ` +
      `${evidencePresent} kanıt görüyor — beklenen 0 / >0.`,
  );

  /* ---- KIRMIZI KANIT 2: anahtar saymak INFERRED'i trusted yapar ---- */
  const naiveKeyCount = rows.filter((r) => r.envBrand && r.evidence.present)
    .length;
  check(
    naiveKeyCount > routableTrusted,
    `RED-2 anahtar sayma: "anahtar mevcut" ${naiveKeyCount}, otorite kapılı ` +
      `${routableTrusted} — naif sayım fazla saymalıydı.`,
  );

  /* ---- G2: fixture ile çift yönlü kimlik doğrulaması ---- */
  const expected = [...TRUSTED_BRAND_IDENTITIES].sort();
  const actual = trustedIds(rows);
  const missing = expected.filter((id) => !actual.includes(id));
  const unexpected = actual.filter((id) => !expected.includes(id));
  check(missing.length === 0, `G2 missing=${missing.length} [${missing}]`);
  check(
    unexpected.length === 0,
    `G2 unexpected=${unexpected.length} [${unexpected}]`,
  );

  const authMap: Record<string, string> = {};
  for (const r of rows) if (r.evidence.present) authMap[r.id] = r.evidence.authority;
  const baseIds = Object.keys(BRAND_EVIDENCE_AUTHORITY_BASELINE).sort();
  const gotIds = Object.keys(authMap).sort();
  check(
    JSON.stringify(baseIds) === JSON.stringify(gotIds),
    `G2 kanıt kimlik kümesi taban ile aynı değil: taban ${baseIds.length}, ölçülen ${gotIds.length}.`,
  );
  for (const id of baseIds) {
    check(
      authMap[id] === BRAND_EVIDENCE_AUTHORITY_BASELINE[id],
      `G2 ${id} otoritesi ${authMap[id]}, taban ${BRAND_EVIDENCE_AUTHORITY_BASELINE[id]}.`,
    );
  }

  /* ---- G3 / G4: mutasyon duyarlılığı ----------------------------------
   * Mutasyon GERÇEK snapshot üzerinde yapılır ve değer okuyucudan yeniden
   * geçirilir; böylece hem `readBrandEvidence` hem de sayaç sınanır. Sayaç
   * yalnız "anahtar mevcut" deseydi bu kapılar hareket etmezdi.
   *
   * `source` alanı kanonik `VERIFIED_SOURCES` üzerinden yükseltilir;
   * doğrulanmış kaynakların ikinci bir listesi burada kurulmaz.
   */
  const mutate = (
    from: Authority,
    nextSource: string | undefined,
  ): { after: number; authority: Authority } => {
    const victim = rows.find(
      (r) => r.envBrand && r.evidence.present && r.evidence.authority === from,
    );
    assert.ok(victim, `mutasyon için ${from} kaydı bulunamadı`);
    const bag = victim.snapshot.internalEvidence!;
    const original = bag.brandEvidence;
    bag.brandEvidence = { ...original, source: nextSource as never };
    victim.evidence = readBrandEvidence(victim.snapshot);
    const result = { after: trustedIds(rows).length, authority: victim.evidence.authority };
    bag.brandEvidence = original;
    victim.evidence = readBrandEvidence(victim.snapshot);
    return result;
  };
  const up = mutate("INFERRED", "FUTURE_KNOWLEDGE");
  check(
    up.authority === "VERIFIED" && up.after === routableTrusted + 1,
    `G3 INFERRED→VERIFIED: otorite ${up.authority}, sayaç ${up.after}, ` +
      `beklenen VERIFIED / ${routableTrusted + 1}.`,
  );
  const down = mutate("VERIFIED", "DETERMINISTIC_INFERENCE");
  check(
    down.authority === "INFERRED" && down.after === routableTrusted - 1,
    `G4 VERIFIED→INFERRED: otorite ${down.authority}, sayaç ${down.after}, ` +
      `beklenen INFERRED / ${routableTrusted - 1}.`,
  );
  check(
    trustedIds(rows).length === routableTrusted &&
      serialize(rows) === serialA,
    "G3/G4 geri alma: mutasyon sonrası ölçüm eski değerine dönmedi.",
  );

  /* ---- G5: provenance'sız legacy değer güvenilir sayılmaz ---- */
  const sample = rows.find((r) => r.evidence.present);
  assert.ok(sample, "legacy testi için örnek kayıt yok");
  const donor = buildPublishUnderstandingSnapshot({
    understanding: understandRequest(
      Object.freeze({
        rawInput: (CATEGORY_COVERAGE_V1 as ReadonlyArray<{
          id: string;
          input: string;
        }>).find((s) => s.id === sample.id)!.input,
      }) as never,
    ) as never,
    userSelected: false,
    primarySlug: null,
  });
  const legacySnap = {
    ...donor,
    internalEvidence: undefined,
    attributes: {
      ...donor.attributes,
      brandEvidence: { value: LEGACY_BRAND_EVIDENCE_VALUE, confidence: 1 },
    },
  } as never as RequestUnderstandingSnapshot;
  const legacyReading = readBrandEvidence(legacySnap);
  check(
    legacyReading.present && legacyReading.value === LEGACY_BRAND_EVIDENCE_VALUE,
    "G5 legacy fallback: eski şekildeki değer okunamadı.",
  );
  check(
    legacyReading.authority === "UNKNOWN",
    `G5 legacy otoritesi ${legacyReading.authority}, beklenen UNKNOWN.`,
  );
  check(
    !isTrustedBrandAuthority(legacyReading.authority),
    "G5 provenance'sız legacy marka değeri GÜVENİLİR sayıldı.",
  );

  /* ---- KNOWN-OPEN: değer otorite iddia ediyor, kayıt etmiyor ---- */
  const valueClaimsMore = rows.filter(
    (r) =>
      r.evidence.present &&
      (r.evidence.value === "VERIFIED_CATALOG" ||
        r.evidence.value === "USER_ASSERTED") &&
      !isTrustedBrandAuthority(r.evidence.authority),
  ).length;
  check(
    valueClaimsMore === BRAND_BASELINE.evidenceValueClaimsAuthorityAboveRecord,
    `KNOWN-OPEN sayısı ${valueClaimsMore}, taban ${BRAND_BASELINE.evidenceValueClaimsAuthorityAboveRecord}.`,
  );

  /* ---- taban sayıları ---- */
  const measured = {
    scenarios: n,
    brandPresent,
    brandEvidencePresent: evidencePresent,
    brandEvidenceUnknown: evUnknown,
    brandEvidenceInferred: evInferred,
    brandEvidenceVerified: evVerified,
    brandEvidenceUserExplicit: evUserExplicit,
    brandRoutableTrusted: routableTrusted,
    evidenceValueClaimsAuthorityAboveRecord: valueClaimsMore,
  };
  for (const [key, want] of Object.entries(BRAND_BASELINE)) {
    const got = (measured as Record<string, number>)[key];
    check(got === want, `taban ${key}: ölçülen ${got}, beklenen ${want}.`);
  }

  /* ---- G6/G7: kapsam doğrulayıcısı GERÇEKTEN bu sayıyı yayınlıyor mu ---- */
  const coverageScript = pathJoin(__dirname, "verify-category-coverage-v1.ts");
  /**
   * Aynı TypeScript koşucusuyla yeniden çalıştırılır: `process.execArgv`
   * tsx kaydını taşır, böylece burada ikinci bir koşucu varsayımı kurulmaz.
   */
  const runCoverage = (): string =>
    execFileSync(process.execPath, [...process.execArgv, coverageScript], {
      cwd: pathJoin(__dirname, ".."),
      encoding: "utf8",
    });
  let outA = "";
  let outB = "";
  try {
    outA = runCoverage();
    outB = runCoverage();
  } catch (err) {
    problems.push(
      `G6 kapsam doğrulayıcısı koşturulamadı: ${(err as Error).message.slice(0, 200)}`,
    );
  }
  if (outA) {
    check(
      outA === outB,
      "G6 iki deterministik coverage koşusu byte-birebir aynı değil.",
    );
    const trustedLine = /BRAND_ROUTABLE_TRUSTED=(\d+)\/(\d+)/.exec(outA);
    check(
      Boolean(trustedLine) && Number(trustedLine![1]) === routableTrusted,
      `G7 coverage BRAND_ROUTABLE_TRUSTED=${trustedLine?.[1] ?? "yok"}, ` +
        `otorite kapılı gerçek değer ${routableTrusted}.`,
    );
    for (const key of [
      "BRAND_EVIDENCE_PRESENT",
      "BRAND_EVIDENCE_UNKNOWN",
      "BRAND_EVIDENCE_INFERRED",
      "BRAND_EVIDENCE_VERIFIED",
      "BRAND_EVIDENCE_USER_EXPLICIT",
    ]) {
      check(
        outA.includes(`${key}=`),
        `G7 coverage çıktısında ${key} yayınlanmıyor.`,
      );
    }
    check(
      /99 pass, 9 known_fail, 0 fail/.test(outA),
      "G8 coverage senaryo sonucu 99 PASS / 9 known_fail / 0 fail değil.",
    );
  }

  /* ---- rapor ---- */
  console.log("--- readiness marka otoritesi (kanonik merdiven) ---");
  for (const r of rows) {
    if (!r.evidence.present && !r.envBrand) continue;
    console.log(
      `${r.id.padEnd(10)} envBrand=${(r.envBrand ?? "-").padEnd(14)} ` +
        `evidence=${(r.evidence.value ?? "-").padEnd(17)} ` +
        `authority=${r.evidence.authority.padEnd(13)} ` +
        `trusted=${r.envBrand && isTrustedBrandAuthority(r.evidence.authority) ? "EVET" : "hayır"}`,
    );
  }
  console.log(
    `\nBRAND_PRESENT=${brandPresent}/${n}  BRAND_EVIDENCE_PRESENT=${evidencePresent}/${n}`,
  );
  console.log(
    `BRAND_EVIDENCE_UNKNOWN=${evUnknown}  BRAND_EVIDENCE_INFERRED=${evInferred}  ` +
      `BRAND_EVIDENCE_VERIFIED=${evVerified}  BRAND_EVIDENCE_USER_EXPLICIT=${evUserExplicit}`,
  );
  console.log(
    `BRAND_ROUTABLE_TRUSTED=${routableTrusted}/${n}  (eşik: isAtLeastAuthority(·, "VERIFIED"))`,
  );
  console.log(
    `TRUSTED_IDS=[${actual.join(", ")}]  missing=${missing.length} unexpected=${unexpected.length}`,
  );
  console.log(
    `LEGACY_BLIND_PATH_SEES=${legacyPathSees}/${n}  NAIVE_KEY_COUNT=${naiveKeyCount}  ` +
      `KNOWN_OPEN_value_claims_more_than_record=${valueClaimsMore}`,
  );

  if (problems.length) {
    console.error("\nKIRMIZI:");
    for (const p of problems) console.error("  - " + p);
    console.error(`\n${problems.length} ihlal`);
    process.exit(1);
  }
  console.log("\n0 ihlal — güvenilir marka sayısı kanonik merdivenden ölçülüyor.");
}

if (require.main === module) main();
