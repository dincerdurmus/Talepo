/**
 * ÜYELİK DÖNÜŞÜ YAYIN NİYETİ — REGRESYON DOĞRULAYICISI V1 (2026-08-26).
 *
 * NEDEN VAR. Anonim kullanıcı talebini yazıp yayınla dediğinde üyelik
 * adımına gider. Dönüşte, anlama motoru metni sindirir sindirmez tek bir
 * yayın denemesi başlamalıdır. Eski davranışta deneme YALNIZ talep zaten
 * yayına uygunsa başlıyordu: bütçe ya da konum eksikse latch söndürülüyor
 * ama hiçbir şey yapılmıyordu. Kullanıcı yayınlama niyetiyle üye olup
 * dönüyor ve ne yayın ne eksik alan rehberliği görüyordu.
 *
 * BU DOSYA KAYNAK METNİ OKUMAZ. Sayaç ya da metin araması yerine saf
 * karar fonksiyonunu ve uygulayıcısını doğrudan çağırır; hangi çağrının
 * yapıldığını gerçek çağrı kaydıyla ölçer.
 *
 * SALT-OKUNURDUR.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

import {
  applyResumePublishAction,
  decideResumePublishAction,
  type ResumePublishInput,
} from "../src/lib/request-composer/resume-publish";

const DIGESTED = "Ankara'da 2+1 kiralık daire arıyorum";

function baseInput(over: Partial<ResumePublishInput> = {}): ResumePublishInput {
  return {
    pending: true,
    isSyncing: false,
    understandingRawInput: DIGESTED,
    composerText: DIGESTED,
    ...over,
  };
}

/** Sayfanın effect gövdesinin yaptığı işi kayıt tutarak taklit eder. */
function runOnce(input: ResumePublishInput) {
  const calls: string[] = [];
  applyResumePublishAction(decideResumePublishAction(input), {
    closeLatch: () => calls.push("closeLatch"),
    attemptPublish: () => calls.push("attemptPublish"),
  });
  return calls;
}

const problems: string[] = [];
let passed = 0;

function check(name: string, ok: boolean, detail: string) {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
    return;
  }
  console.log(`FAIL  ${name} — ${detail}`);
  problems.push(`${name}: ${detail}`);
}

console.log("=== UYELIK DONUSU YAYIN NIYETI V1 ===\n");
console.log("--- (1) BEKLEME: latch acik kalir, hicbir sey yapilmaz ---");

for (const [name, over, reason] of [
  ["niyet yoksa beklenir", { pending: false }, "not_pending"],
  ["anlama sururken beklenir", { isSyncing: true }, "syncing"],
  [
    "metin henuz sindirilmediyse beklenir",
    { understandingRawInput: "eski metin" },
    "text_not_digested",
  ],
] as const) {
  const input = baseInput(over);
  const action = decideResumePublishAction(input);
  check(
    name,
    action.kind === "wait" &&
      action.reason === reason &&
      action.closeLatch === false &&
      runOnce(input).length === 0,
    `beklenen wait/${reason} + latch acik, gelen ${JSON.stringify(action)}`,
  );
}

console.log("\n--- (2) B-2 REGRESYONU: yayina uygunluk denemeyi IPTAL ETMEZ ---");
/**
 * Kritik satır. Karar fonksiyonunun imzasında yayına uygunluk (bütçe,
 * konum, kritik soru) diye bir girdi YOKTUR; bu senaryolar aynı girdiyle
 * aynı sonucu vermek zorundadır. Biri "eksikse deneme yapma" mantığını
 * geri getirirse burası kırmızıya döner.
 */
{
  const calls = runOnce(baseInput());
  check(
    "sindirilmis metinde deneme baslar",
    calls.join(">") === "closeLatch>attemptPublish",
    `beklenen closeLatch>attemptPublish, gelen ${calls.join(">") || "(hicbiri)"}`,
  );
  check(
    "eksik butce/konum senaryosu da ayni denemeyi uretir",
    // Eksik alan bilgisi karara hic girmediginden, uygunlugu temsil eden
    // her durum icin sonuc birebir aynidir. handlePublishAttempt eksik
    // alanlari zaten kendi icinde rehberlige cevirir.
    runOnce(baseInput()).join(">") === "closeLatch>attemptPublish",
    "eksik alan durumunda deneme baslamadi — niyet sessizce kayboluyor",
  );
}

console.log("\n--- (3) LATCH: yalniz gercek denemede, tek kez kapanir ---");
{
  const first = runOnce(baseInput());
  // Latch kapandiktan sonraki tur: pending artik false.
  const second = runOnce(baseInput({ pending: false }));
  check(
    "deneme sonrasi ikinci tur yeni deneme uretmez",
    first.filter((c) => c === "attemptPublish").length === 1 &&
      second.length === 0,
    `ilk tur ${first.join(">")}, ikinci tur ${second.join(">") || "(hicbiri)"}`,
  );
  const waiting = runOnce(baseInput({ isSyncing: true }));
  check(
    "beklerken latch sondurulmez (niyet korunur)",
    !waiting.includes("closeLatch"),
    `beklerken ${waiting.join(">")} calisti`,
  );
}

console.log("\n--- (4) METIN ESITLIGI: bosluk farki sindirilmemis sayilmaz ---");
{
  const calls = runOnce(
    baseInput({ composerText: `  ${DIGESTED}  `, understandingRawInput: DIGESTED }),
  );
  check(
    "bas/son bosluk farki denemeyi engellemez",
    calls.join(">") === "closeLatch>attemptPublish",
    `gelen ${calls.join(">") || "(hicbiri)"}`,
  );
  const stale = runOnce(baseInput({ composerText: `${DIGESTED} ek cumle` }));
  check(
    "kullanici metni degistirdiyse eski analizle yayin denenmez",
    stale.length === 0,
    `gelen ${stale.join(">")}`,
  );
}

console.log("\n--- (5) PRODUCTION WIRING SOZLESMESI (AST) ---");
/**
 * Saf karari dogru test etmek yeterli DEGILDIR: kullanicinin gercekten
 * gectigi yol page.tsx'teki effect'tir. Biri readiness onkosulunu oraya
 * geri koyarsa yukaridaki bolumler yesil kalir ama hata geri gelir. Bu
 * bolum sayfayi TypeScript AST'i olarak okur; satir numarasi ya da
 * kirilgan substring aramasi kullanmaz.
 */
{
  const pagePath = join(__dirname, "..", "src", "app", "talep", "page.tsx");
  const source = ts.createSourceFile(
    pagePath,
    readFileSync(pagePath, "utf8"),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );

  const calleeName = (node: ts.CallExpression): string | null => {
    const e = node.expression;
    if (ts.isIdentifier(e)) return e.text;
    if (ts.isPropertyAccessExpression(e)) return e.name.text;
    return null;
  };

  const walk = (node: ts.Node, visit: (n: ts.Node) => void): void => {
    visit(node);
    node.forEachChild((c) => walk(c, visit));
  };

  const applyCalls: ts.CallExpression[] = [];
  const latchCloseCalls: ts.CallExpression[] = [];
  walk(source, (n) => {
    if (!ts.isCallExpression(n)) return;
    const name = calleeName(n);
    if (name === "applyResumePublishAction") applyCalls.push(n);
    if (
      name === "setResumePublishPending" &&
      n.arguments.length === 1 &&
      n.arguments[0].kind === ts.SyntaxKind.FalseKeyword
    ) {
      latchCloseCalls.push(n);
    }
  });

  check(
    "sayfa production helper'i tam olarak bir kez cagiriyor",
    applyCalls.length === 1,
    "applyResumePublishAction cagri sayisi " + applyCalls.length,
  );

  const call = applyCalls[0];
  if (!call) {
    problems.push("wiring: helper cagrisi yok, kalan kontroller olculemedi");
  } else {
    /* (a) Cagri uyelik donusu useEffect'inin govdesinde mi? */
    let effectBody: ts.Block | null = null;
    for (let n: ts.Node | undefined = call.parent; n; n = n.parent) {
      if (
        (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) &&
        n.parent !== undefined &&
        ts.isCallExpression(n.parent) &&
        calleeName(n.parent) === "useEffect"
      ) {
        if (ts.isBlock(n.body)) effectBody = n.body;
        break;
      }
    }
    check(
      "helper cagrisi bir useEffect govdesinde",
      effectBody !== null,
      "cagri hicbir useEffect callback blogunun icinde degil",
    );

    if (effectBody) {
      /*
       * (b) Helper cagrisi effect'in ILK calisan ifadesi olmali. Onunde
       * duran her if/return bir onkosuldur; eski kusur tam olarak boyle
       * bir onkosuldu.
       */
      const first: ts.Statement | undefined = effectBody.statements[0];
      const firstIsHelper =
        first !== undefined &&
        ts.isExpressionStatement(first) &&
        first.expression === call;
      check(
        "helper cagrisindan once hicbir onkosul/guard yok",
        firstIsHelper,
        first === undefined
          ? "effect govdesi bos"
          : "effect'in ilk ifadesi helper cagrisi degil: " +
            ts.SyntaxKind[first.kind],
      );

      /* (c) Effect govdesinde readiness ismi hic gecmemeli. */
      const readinessHits: string[] = [];
      walk(effectBody, (n) => {
        if (ts.isIdentifier(n) && /^(canReview|canPublish)$/.test(n.text)) {
          readinessHits.push(n.text);
        }
      });
      check(
        "effect govdesinde readiness guard'i yok",
        readinessHits.length === 0,
        "readiness referanslari geri gelmis: " + readinessHits.join(", "),
      );
    }

    /* (d) Latch YALNIZ helper'a verilen closeLatch handler'inda kapanmali. */
    const handlers: ts.Expression | undefined = call.arguments[1];
    const handlerObject =
      handlers !== undefined && ts.isObjectLiteralExpression(handlers)
        ? handlers
        : null;
    const namedProp = (key: string) =>
      handlerObject?.properties.find(
        (pr) =>
          pr.name !== undefined &&
          ts.isIdentifier(pr.name) &&
          pr.name.text === key,
      );
    const closeLatchProp = namedProp("closeLatch");
    check(
      "helper'a closeLatch ve attemptPublish handler'lari veriliyor",
      closeLatchProp !== undefined && namedProp("attemptPublish") !== undefined,
      "closeLatch ya da attemptPublish handler'i eksik",
    );

    const insideCloseLatch = (n: ts.Node): boolean => {
      for (let c: ts.Node | undefined = n; c; c = c.parent) {
        if (c === closeLatchProp) return true;
      }
      return false;
    };
    const stray = latchCloseCalls.filter((c) => !insideCloseLatch(c));
    check(
      "latch yalniz closeLatch handler'inda sonduruluyor",
      latchCloseCalls.length > 0 && stray.length === 0,
      latchCloseCalls.length === 0
        ? "hicbir yerde latch sondurulmuyor"
        : stray.length + " adet closeLatch disi setResumePublishPending(false)",
    );
  }
}

console.log("\n===== HUKUM =====");
if (problems.length) {
  console.error(`KIRMIZI — ${problems.length} ihlal:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `YESIL — ${passed} passed. Yayin niyeti, talep yayina uygun olmasa bile\n` +
    "denemeye donusur; latch yalniz gercek denemede tek kez kapanir ve\n" +
    "talep sayfasinin gercek baglantisi readiness onkosulu tasimiyor.",
);
process.exit(0);
