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
 * ÜÇ EKSEN AYRI AYRI ÖLÇÜLÜR (ECC denetimi, 2026-08-26):
 *   (A) Eksik bütçe/konum denemeyi İPTAL ETMEZ — rehberliğe ulaşılır.
 *   (B) Kapsam dışı (UNSUPPORTED_SUPPLY) talep yayın yoluna HİÇ girmez.
 *   (C) Başarısız deneme sessizce yutulmaz.
 * (A) ve (B) farklı sonuç üretmek ZORUNDADIR; aynı girdiyle iki kez
 * çalıştırılan bir kontrol bu ayrımı ölçmez ve sahte güvence verir.
 *
 * BU DOSYA KAYNAK METNİ OKUMAZ ve KENDİ KARAR MEKANİZMASINI KURMAZ.
 * Kapsam kararı kanonik otoriteden (`understandRequest().requestScope`),
 * rehberlik sonucu üretim fonksiyonundan
 * (`computeComposerPublishReadiness`) okunur.
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
import {
  computeComposerPublishReadiness,
  type PublishReadiness,
} from "../src/lib/request-composer/v2/publish-readiness";
import type { ScheduleResult } from "../src/lib/request-composer/v2/question-profile-types";
import { understandRequest } from "../src/lib/request-understanding/understand-request";

/** Kapsam içi (DEMAND) örnek — sınıfı kanonik otorite ile doğrulanır. */
const DEMAND_TEXT =
  "Ofisimiz için 12 adet ergonomik çalışma sandalyesi almak istiyorum";
/** Kapsam dışı (UNSUPPORTED_SUPPLY) örnek — sınıfı kanonik otorite ile doğrulanır. */
const SUPPLY_TEXT = "Aracımı satmak istiyorum";

/** Soru kuyruğu boş: kalan engel yalnız bütçe/konumdan gelsin. */
const EMPTY_SCHEDULE: ScheduleResult = {
  visible: [],
  remainingCriticalCount: 0,
  remainingOptionalCount: 0,
  canEnterReview: true,
  blockingFieldKeys: [],
  blockingLabels: [],
};

/** Kanonik kapsam otoritesi — bu dosyanın kendi listesi YOKTUR. */
function scopeOf(text: string): string {
  return understandRequest({ rawInput: text }).requestScope.value;
}

/** Üretim rehberlik otoritesi — bu dosyanın kendi kopyası YOKTUR. */
function readinessOf(text: string, filled: boolean): PublishReadiness {
  return computeComposerPublishReadiness({
    hasUsableText: Boolean(text.trim()),
    schedule: EMPTY_SCHEDULE,
    categoryId: "furniture-office",
    budgetValue: filled ? "45000" : "",
    cityValue: filled ? "Ankara" : "",
    locationMode: null,
    requestScope: scopeOf(text),
  });
}

function baseInput(over: Partial<ResumePublishInput> = {}): ResumePublishInput {
  return {
    pending: true,
    isSyncing: false,
    understandingRawInput: DEMAND_TEXT,
    composerText: DEMAND_TEXT,
    requestScope: scopeOf(DEMAND_TEXT),
    ...over,
  };
}

type RunResult = { calls: string[]; failures: unknown[] };

/**
 * Sayfanın effect gövdesinin yaptığı işi kayıt tutarak taklit eder. Deneme
 * davranışı çağıran tarafından verilir; böylece senkron hata ile reddedilen
 * Promise ayrı ayrı ölçülebilir.
 */
function runOnce(
  input: ResumePublishInput,
  attempt: () => void | Promise<void> = () => {},
): RunResult {
  const calls: string[] = [];
  const failures: unknown[] = [];
  applyResumePublishAction(decideResumePublishAction(input), {
    closeLatch: () => calls.push("closeLatch"),
    attemptPublish: () => {
      calls.push("attemptPublish");
      return attempt();
    },
    onAttemptFailed: (error) => {
      calls.push("onAttemptFailed");
      failures.push(error);
    },
  });
  return { calls, failures };
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

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function main(): Promise<void> {
  console.log("=== UYELIK DONUSU YAYIN NIYETI V1 ===\n");

  console.log("--- (0) KANONIK OTORITE: fixture'lar gercekten farkli sinifta ---");
  check(
    "DEMAND ornegi kanonik otoritede DEMAND",
    scopeOf(DEMAND_TEXT) === "DEMAND",
    "gelen " + scopeOf(DEMAND_TEXT),
  );
  check(
    "SUPPLY ornegi kanonik otoritede UNSUPPORTED_SUPPLY",
    scopeOf(SUPPLY_TEXT) === "UNSUPPORTED_SUPPLY",
    "gelen " + scopeOf(SUPPLY_TEXT),
  );

  console.log("\n--- (1) BEKLEME: latch acik kalir, hicbir sey yapilmaz ---");
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
        runOnce(input).calls.length === 0,
      `beklenen wait/${reason} + latch acik, gelen ${JSON.stringify(action)}`,
    );
  }

  console.log("\n--- (2A) YAYINA HAZIR TALEP ---");
  {
    const ready = readinessOf(DEMAND_TEXT, true);
    check(
      "uretim otoritesi bu talebi yayina hazir sayiyor",
      ready.canReview &&
        ready.blockingLabels.length === 0 &&
        ready.outOfScopeNotice === null,
      `canReview=${ready.canReview} blocking=${JSON.stringify(ready.blockingLabels)}`,
    );
    const run = runOnce(baseInput());
    check(
      "hazir talepte deneme baslar",
      run.calls.join(">") === "closeLatch>attemptPublish",
      "gelen " + (run.calls.join(">") || "(hicbiri)"),
    );
  }

  console.log(
    "\n--- (2B) BUTCE/KONUM EKSIK: deneme IPTAL EDILMEZ, rehberlige ulasilir ---",
  );
  {
    const gapped = readinessOf(DEMAND_TEXT, false);
    check(
      "uretim otoritesi eksik alanlari rehberlik olarak bildiriyor",
      !gapped.canReview &&
        gapped.outOfScopeNotice === null &&
        gapped.blockingLabels.some((l) => /bütçe/i.test(l)) &&
        gapped.blockingLabels.some((l) => /konum|şehir|il/i.test(l)),
      `canReview=${gapped.canReview} blocking=${JSON.stringify(gapped.blockingLabels)}`,
    );
    const run = runOnce(baseInput());
    check(
      "eksik alanli talepte de deneme baslar",
      run.calls.join(">") === "closeLatch>attemptPublish",
      "gelen " +
        (run.calls.join(">") || "(hicbiri)") +
        " — eksik alan denemeyi iptal etmemeli",
    );
  }

  console.log("\n--- (2C) KAPSAM DISI: yayin yoluna HIC girilmez ---");
  {
    const outOfScope = readinessOf(SUPPLY_TEXT, true);
    check(
      "uretim otoritesi kapsam disi rehberligini uretiyor",
      !outOfScope.canReview &&
        !outOfScope.canPublish &&
        typeof outOfScope.outOfScopeNotice === "string" &&
        outOfScope.outOfScopeNotice.length > 0,
      `canReview=${outOfScope.canReview} notice=${outOfScope.outOfScopeNotice}`,
    );
    const input = baseInput({
      understandingRawInput: SUPPLY_TEXT,
      composerText: SUPPLY_TEXT,
      requestScope: scopeOf(SUPPLY_TEXT),
    });
    const action = decideResumePublishAction(input);
    const run = runOnce(input);
    check(
      "kapsam disi talep attempt uretmez",
      action.kind === "blocked" && action.reason === "out_of_scope",
      "beklenen blocked/out_of_scope, gelen " + JSON.stringify(action),
    );
    check(
      "kapsam disi talepte attemptPublish HIC cagrilmaz",
      !run.calls.includes("attemptPublish"),
      "gelen " +
        (run.calls.join(">") || "(hicbiri)") +
        " — kapsam disi istek sunucuya gonderilemez",
    );
    check(
      "kapsam disi talepte latch kapanir (otomatik tekrar olmaz)",
      run.calls.includes("closeLatch"),
      "gelen " + (run.calls.join(">") || "(hicbiri)"),
    );
  }

  console.log("\n--- (3) BASARISIZ DENEME SESSIZCE YUTULMAZ ---");
  {
    const boom = new Error("senkron publish hatasi");
    const run = runOnce(baseInput(), () => {
      throw boom;
    });
    check(
      "senkron hata onAttemptFailed'e ulasir",
      run.calls.join(">") === "closeLatch>attemptPublish>onAttemptFailed" &&
        run.failures[0] === boom,
      `gelen ${run.calls.join(">")} failures=${run.failures.length}`,
    );
  }
  {
    /**
     * HELPER-LEVEL ROBUSTNESS — production-wired DEGIL.
     *
     * Bugunku uretim baglantisinda `attemptPublish` = `handlePublishAttempt`
     * ve o fonksiyon senkrondur, `void` doner: gercek ag yayini kullanici
     * onayindan sonra `publishRequest` icinde kosar ve kendi try/catch'i ile
     * gorunur hale gelir. Yani asagidaki reddedilen-Promise korumasi bugun
     * hicbir uretim yolunda TETIKLENMEZ. Iddiayi "gercek yayin hatasi
     * yakalaniyor" diye okumayin; bu yalnizca `attemptPublish` ileride
     * gercekten bir Promise dondurecek sekilde degistirilirse devreye
     * girecek bir dayaniklilik katmanidir.
     */
    const boom = new Error("async publish reddi");
    const run = runOnce(baseInput(), () => Promise.reject(boom));
    await settle();
    check(
      "[helper-level] reddedilen Promise onAttemptFailed'e ulasir",
      run.calls.includes("onAttemptFailed") && run.failures[0] === boom,
      `gelen ${run.calls.join(">")} failures=${run.failures.length}`,
    );
  }
  {
    const run = runOnce(baseInput(), () => Promise.resolve());
    await settle();
    check(
      "basarili async denemede hata bildirimi uretilmez",
      run.calls.join(">") === "closeLatch>attemptPublish",
      "gelen " + run.calls.join(">"),
    );
  }
  {
    /**
     * Basarisiz deneme kullaniciyi KALICI olarak kilitlemez: latch'i geri
     * acmiyoruz (otomatik tekrar sonsuz donguye doner), ama ayni girdi
     * yeniden geldiginde karar hala `attempt` uretir — yani kullanicinin
     * kendi yeniden deneme yolu acik kalir.
     */
    const retry = runOnce(baseInput());
    check(
      "basarisiz denemeden sonra yeniden deneme mumkun (kalici kilit yok)",
      retry.calls.join(">") === "closeLatch>attemptPublish",
      "gelen " + (retry.calls.join(">") || "(hicbiri)"),
    );
  }

  console.log("\n--- (4) LATCH: yalniz gercek denemede, tek kez kapanir ---");
  {
    const first = runOnce(baseInput());
    const second = runOnce(baseInput({ pending: false }));
    check(
      "deneme sonrasi ikinci tur yeni deneme uretmez",
      first.calls.filter((c) => c === "attemptPublish").length === 1 &&
        second.calls.length === 0,
      `ilk tur ${first.calls.join(">")}, ikinci tur ${second.calls.join(">") || "(hicbiri)"}`,
    );
    const waiting = runOnce(baseInput({ isSyncing: true }));
    check(
      "beklerken latch sondurulmez (niyet korunur)",
      !waiting.calls.includes("closeLatch"),
      "beklerken " + waiting.calls.join(">") + " calisti",
    );
  }

  console.log("\n--- (5) METIN ESITLIGI: bosluk farki sindirilmemis sayilmaz ---");
  {
    const run = runOnce(baseInput({ composerText: `  ${DEMAND_TEXT}  ` }));
    check(
      "bas/son bosluk farki denemeyi engellemez",
      run.calls.join(">") === "closeLatch>attemptPublish",
      "gelen " + (run.calls.join(">") || "(hicbiri)"),
    );
    const stale = runOnce(baseInput({ composerText: DEMAND_TEXT + " ek cumle" }));
    check(
      "kullanici metni degistirdiyse eski analizle yayin denenmez",
      stale.calls.length === 0,
      "gelen " + stale.calls.join(">"),
    );
  }

  console.log("\n--- (6) PRODUCTION WIRING SOZLESMESI (AST) ---");
  /**
   * Saf karari dogru test etmek yeterli DEGILDIR: kullanicinin gercekten
   * gectigi yol page.tsx'teki effect'tir. Biri readiness onkosulunu oraya
   * geri koyarsa ya da kapsam girdisini kesers e yukaridaki bolumler yesil
   * kalir ama hata geri gelir. Bu bolum sayfayi TypeScript AST'i olarak
   * okur; satir numarasi ya da kirilgan substring aramasi kullanmaz.
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
    const decideCalls: ts.CallExpression[] = [];
    const latchCloseCalls: ts.CallExpression[] = [];
    walk(source, (n) => {
      if (!ts.isCallExpression(n)) return;
      const name = calleeName(n);
      if (name === "applyResumePublishAction") applyCalls.push(n);
      if (name === "decideResumePublishAction") decideCalls.push(n);
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

      /*
       * (d) KAPSAM KAPISI WIRING'DE OLMALI. Karar fonksiyonuna `requestScope`
       * gecirilmezse kapsam dali hic calismaz ve kapsam disi talep yayin
       * yoluna girer — bu tam olarak ECC denetiminde bulunan acikti.
       */
      const decideCall = decideCalls[0];
      const decideArg = decideCall?.arguments[0];
      const scopePassed =
        decideArg !== undefined &&
        ts.isObjectLiteralExpression(decideArg) &&
        decideArg.properties.some(
          (pr) =>
            pr.name !== undefined &&
            ts.isIdentifier(pr.name) &&
            pr.name.text === "requestScope",
        );
      check(
        "karar fonksiyonuna kanonik requestScope gecriliyor",
        decideCalls.length === 1 && scopePassed,
        decideCalls.length !== 1
          ? "decideResumePublishAction cagri sayisi " + decideCalls.length
          : "girdide requestScope alani yok — kapsam kapisi wiring'de kopuk",
      );

      /* (e) Handler sozlesmesi: latch, deneme ve HATA BILDIRIMI. */
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
        "helper'a closeLatch, attemptPublish ve onAttemptFailed veriliyor",
        closeLatchProp !== undefined &&
          namedProp("attemptPublish") !== undefined &&
          namedProp("onAttemptFailed") !== undefined,
        "handler sozlesmesi eksik — basarisiz deneme sessizce yutulabilir",
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

    /*
     * (f) HATA GORUNURLUGU. Yakalanan hatanin state'e yazilmasi YETMEZ;
     * kullanicinin onu gormesi gerekir. Eski halde `publishError` yalnizca
     * iki yerde render ediliyordu: review ozeti (uxStage === "review", resume
     * akisinda erisilmez) ve VARSAYILAN KAPALI bir <details> icindeki kutu.
     * Yani hata DOM'da vardi ama kesfedilemezdi.
     */
    /**
     * Yalnizca HATA DURUMUNDA ACILMAYAN `<details>` bir gomme sayilir.
     * `open` niteligi `publishError`'a bagliysa akordeon hata ciktiginda
     * kendiliginden acilir ve kutu kesfedilebilir olur; boyle bir akordeon
     * bu kontrolun ihlali degildir. Bu bir gevsetme degil, cozumun iki
     * gecerli bicimini (details disina tasima YA DA hata-duyarli acilma)
     * ayni sozlesmede modellemektir.
     */
    const detailsRanges: Array<[number, number]> = [];
    walk(source, (n) => {
      let opening: ts.JsxOpeningLikeElement | null = null;
      if (
        ts.isJsxElement(n) &&
        n.openingElement.tagName.getText(source) === "details"
      ) {
        opening = n.openingElement;
      } else if (
        ts.isJsxSelfClosingElement(n) &&
        n.tagName.getText(source) === "details"
      ) {
        opening = n;
      }
      if (!opening) return;
      /**
       * Yon kontrolu ZORUNLU. Yalnizca "open ifadesinde publishError gecti"
       * demek bir kacis deligidir: `open={publishError ? false : undefined}`
       * ya da `open={!publishError}` gibi mantigi TERS ceviren bir ifade de
       * ayni metin taramasina takilir ve gomme kontrolunden muaf sayilirdi.
       * Bu yuzden ifadenin gercekten "hata VARKEN acilir" anlamina geldigini
       * sinariz: publishError'i dogrulayan dal `true` olmali.
       */
      const errorAware = opening.attributes.properties.some((attr) => {
        if (!ts.isJsxAttribute(attr)) return false;
        if (attr.name.getText(source) !== "open") return false;
        const init = attr.initializer;
        if (!init || !ts.isJsxExpression(init) || !init.expression) return false;
        const expr = init.expression;
        /* open={... || Boolean(publishError)} ve open={... || publishError} */
        const opensOnTruthy = (node: ts.Expression): boolean => {
          if (ts.isParenthesizedExpression(node)) {
            return opensOnTruthy(node.expression);
          }
          if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.BarBarToken
          ) {
            return opensOnTruthy(node.left) || opensOnTruthy(node.right);
          }
          if (ts.isCallExpression(node)) {
            return (
              node.expression.getText(source) === "Boolean" &&
              node.arguments.length === 1 &&
              node.arguments[0]!.getText(source) === "publishError"
            );
          }
          /*
           * Turetilmis karar da kabul edilir. Bu bir kacis deligi DEGILDIR:
           * `publishSignalDemandsAttention` turevinin `publishError` dahil
           * dort sinyali de kapsadigi (h) bolumunde ayrica sinaniyor.
           */
          if (ts.isIdentifier(node)) {
            return (
              node.text === "publishError" ||
              node.text === "publishSignalDemandsAttention"
            );
          }
          /* open={publishError ? true : undefined} */
          if (ts.isConditionalExpression(node)) {
            return (
              node.condition.getText(source) === "publishError" &&
              node.whenTrue.kind === ts.SyntaxKind.TrueKeyword
            );
          }
          return false;
        };
        return opensOnTruthy(expr);
      });
      if (errorAware) return;
      detailsRanges.push([n.getStart(source), n.getEnd()]);
    });
    /**
     * DEGISKEN-ARACILI JSX'I DE IZLE. Sozdizimsel ic-icelik yetmez: mobil
     * companion `<details>` icinde `{aiCompanionShell}` diye cagriliyor,
     * ama o degiskenin JSX tanimi dosyanin bambaska bir yerinde. Yalnizca
     * lexical aralik bakan bir kontrol, hata kutusunun uretimde kapali bir
     * akordeonun icinde cizildigini GOREMEZ ve sahte yesil verir. Bu yuzden
     * `<details>` icinde kullanilan her JSX degiskeninin tanim araligini da
     * "details'e bagli" sayip sabit noktaya kadar genisletiyoruz.
     */
    const boundRanges: Array<[number, number]> = [...detailsRanges];
    const withinBound = (n: ts.Node) =>
      boundRanges.some(
        ([start, end]) => n.getStart(source) >= start && n.getEnd() <= end,
      );
    const declarationRange = (name: string): [number, number] | null => {
      let found: [number, number] | null = null;
      walk(source, (n) => {
        if (found) return;
        if (!ts.isVariableDeclaration(n)) return;
        if (!ts.isIdentifier(n.name) || n.name.text !== name) return;
        if (!n.initializer) return;
        found = [n.initializer.getStart(source), n.initializer.getEnd()];
      });
      return found;
    };
    for (let pass = 0; pass < 8; pass += 1) {
      const referenced = new Set<string>();
      walk(source, (n) => {
        if (!ts.isJsxExpression(n) || !n.expression) return;
        if (!withinBound(n)) return;
        walk(n.expression, (inner) => {
          if (ts.isIdentifier(inner)) referenced.add(inner.text);
        });
      });
      let grew = false;
      for (const name of referenced) {
        const range = declarationRange(name);
        if (!range) continue;
        if (boundRanges.some(([s, e]) => s === range[0] && e === range[1])) {
          continue;
        }
        boundRanges.push(range);
        grew = true;
      }
      if (!grew) break;
    }
    const insideDetails = (n: ts.Node) => withinBound(n);

    /** JSX icinde `publishError` degerini OKUYAN her nokta. */
    const errorReads: ts.Identifier[] = [];
    walk(source, (n) => {
      if (!ts.isIdentifier(n) || n.text !== "publishError") return;
      if (ts.isPropertyAssignment(n.parent) && n.parent.name === n) return;
      if (
        ts.isVariableDeclaration(n.parent) ||
        ts.isBindingElement(n.parent) ||
        ts.isImportSpecifier(n.parent)
      ) {
        return;
      }
      let inJsx = false;
      for (let c: ts.Node | undefined = n; c; c = c.parent) {
        if (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) {
          inJsx = true;
          break;
        }
      }
      if (inJsx) errorReads.push(n);
    });

    const buried = errorReads.filter(insideDetails);
    check(
      "yayin hatasi kapali <details> icine gomulmuyor",
      errorReads.length > 0 && buried.length === 0,
      errorReads.length === 0
        ? "publishError hicbir JSX noktasinda okunmuyor"
        : buried.length +
          " adet publishError okumasi varsayilan kapali <details> icinde",
    );

    /*
     * (g) TEK HATA YUZEYI OTORITESI. Bir yayin onkosulu hatasi iki seyi
     * BIRLIKTE yapmak zorundadir: mesaji kaydetmek ve hatayi tasiyan yuzeyi
     * acmak. Bunlar ayri ayri elle yazilirsa dallar zamanla ayrisir — nitekim
     * `requestPublish` icindeki dort erken donus (baslik, butce, emlak konum,
     * missingFields) ve `publishRequest`'in emlak dali mesaji yaziyor ama
     * companion'i acmiyordu; mobilde ic panel kapali kaldigi icin kullanici
     * hatayi hic gormuyordu.
     *
     * Kontrol METIN ARAMASI DEGILDIR: her `setPublishError(<mesaj>)` cagrisini
     * AST'te bulur, null sifirlamalarini ayirir ve her birinin tek otorite
     * fonksiyonunun govdesinde olup olmadigini bakar. Otoritenin kendisi de
     * her iki eylemi de icermek zorundadir.
     */
    const AUTHORITY = "surfacePublishFailure";
    let authorityBody: ts.Node | null = null;
    walk(source, (n) => {
      if (authorityBody) return;
      if (ts.isFunctionDeclaration(n) && n.name?.text === AUTHORITY && n.body) {
        authorityBody = n.body;
        return;
      }
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.name.text === AUTHORITY &&
        n.initializer
      ) {
        authorityBody = n.initializer;
      }
    });

    const authorityDoesBoth = (() => {
      if (!authorityBody) return false;
      let writes = false;
      let opens = false;
      walk(authorityBody, (n) => {
        if (!ts.isCallExpression(n)) return;
        const name = calleeName(n);
        if (name === "setPublishError") writes = true;
        if (
          name === "setAiCompanionOpen" &&
          n.arguments[0]?.kind === ts.SyntaxKind.TrueKeyword
        ) {
          opens = true;
        }
      });
      return writes && opens;
    })();
    check(
      "tek hata yuzeyi otoritesi hem mesaji yazar hem paneli acar",
      authorityDoesBoth,
      authorityBody === null
        ? `${AUTHORITY} tanimlanmamis — her dal ayni iki eylemi elle kopyaliyor`
        : `${AUTHORITY} setPublishError ve setAiCompanionOpen(true) ikilisini birlikte yapmiyor`,
    );

    /** Otorite disinda kalan, kullaniciya mesaj yazan her cagri bir kacaktir. */
    const strayErrorWrites: number[] = [];
    walk(source, (n) => {
      if (!ts.isCallExpression(n)) return;
      if (calleeName(n) !== "setPublishError") return;
      const arg = n.arguments[0];
      /* `setPublishError(null)` bir hata yuzeyi degil, temizliktir. */
      if (arg && arg.kind === ts.SyntaxKind.NullKeyword) return;
      if (authorityBody) {
        let inside = false;
        for (let c: ts.Node | undefined = n; c; c = c.parent) {
          if (c === authorityBody) {
            inside = true;
            break;
          }
        }
        if (inside) return;
      }
      strayErrorWrites.push(
        source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1,
      );
    });
    check(
      "her yayin onkosulu hatasi tek otoriteden geciyor",
      strayErrorWrites.length === 0,
      strayErrorWrites.length +
        " adet dogrudan setPublishError(<mesaj>) cagrisi otorite disinda (satir " +
        strayErrorWrites.join(", ") +
        ") — bu dallarda panel acilmayabilir",
    );

    /** Companion paneline hata koprusu kuruluyor mu? */
    const failureBridge = (() => {
      let found = false;
      walk(source, (n) => {
        if (!ts.isJsxAttribute(n)) return;
        if (n.name.getText(source) !== "publishFailure") return;
        found = true;
      });
      return found;
    })();
    check(
      "resume/clarify asamasinda hata AI companion'a koprulenmis",
      failureBridge,
      "TalepoAiPanel'e publishFailure prop'u gecirilmiyor — hata yalnizca review asamasinda gorunur",
    );

    /* Retry kanonik kapidan gecmeli: kapsam ve eksik alan atlanamaz. */
    const panelPath = join(
      __dirname,
      "..",
      "src",
      "components",
      "request",
      "TalepoAiPanel.tsx",
    );
    const panelSource = ts.createSourceFile(
      panelPath,
      readFileSync(panelPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let alertRole = false;
    walk(panelSource, (n) => {
      if (!ts.isJsxAttribute(n)) return;
      const attr = n.name.getText(panelSource);
      if (attr !== "role" && attr !== "aria-live") return;
      const init = n.initializer;
      if (init && ts.isStringLiteral(init)) {
        if (init.text === "alert" || init.text === "assertive" || init.text === "polite") {
          alertRole = true;
        }
      }
    });
    check(
      "companion hata kutusu ekran okuyuculara duyuruluyor",
      alertRole,
      "TalepoAiPanel icinde role=\"alert\" ya da aria-live yok",
    );

    /*
     * Retry `handlePublishAttempt` uzerinden gecmeli. `requestPublish`
     * dogrudan cagrilirsa kapsam kapisi ve eksik alan rehberligi atlanir.
     */
    const retryViaCanonical = (() => {
      let ok = true;
      let seen = false;
      walk(source, (n) => {
        if (!ts.isJsxAttribute(n)) return;
        if (n.name.getText(source) !== "publishFailure") return;
        seen = true;
        const text = n.getText(source);
        if (/requestPublish\s*\(/.test(text)) ok = false;
        if (!/handlePublishAttempt/.test(text)) ok = false;
      });
      return seen && ok;
    })();
    check(
      "hata kutusundaki tekrar denemesi kanonik handlePublishAttempt'ten geciyor",
      retryViaCanonical,
      "retry `requestPublish`'i dogrudan cagiriyor ya da kanonik kapiyi atliyor",
    );

    /*
     * (h) MOBIL GORUNURLUK: IKI KAPI, TEK KARAR.
     *
     * Mobilde companion iki kapinin arkasindadir: onu tasiyan dis <details>
     * ve `aiCompanionOpen` ile yonetilen ic panel. Tarayici olcumu eksik alan
     * rehberliginin her iki kapinin arkasinda kaldigini gosterdi: metin
     * DOM'da uretiliyor ama kullaniciya hic gorunmuyordu, cunku
     * `publishGuidanceAttempted` bir `publishError` uretmez.
     *
     * Kural: companion'in GERCEKTEN tasidigi bir sinyal varsa mobil panel
     * gorunur olmali ve HER IKI kapi da AYNI turetilmis karari kullanmali.
     * Iki kapi ayri ifadeler tasirsa biri acilip digeri kapali kalabilir —
     * olculen kusur tam olarak buydu.
     */
    const SIGNALS = ["publishError", "publishGuidanceAttempted", "aiCompanionOpen"];

    /** Zorunlu gorunurluk turevi: kullanici tercihinden BAGIMSIZ sinyaller. */
    const derivedDecl = (name: string): ts.Expression | null => {
      let found: ts.Expression | null = null;
      walk(source, (n) => {
        if (found) return;
        if (!ts.isVariableDeclaration(n)) return;
        if (!ts.isIdentifier(n.name) || n.name.text !== name) return;
        found = n.initializer ?? null;
      });
      return found;
    };
    const attentionExpr = derivedDecl("publishSignalDemandsAttention");
    const effectiveExpr = derivedDecl("effectiveAiCompanionOpen");
    const exprText = (e: ts.Expression | null) => (e ? e.getText(source) : "");
    const attentionText = exprText(attentionExpr);
    const effectiveText = exprText(effectiveExpr);
    const combined = attentionText + " " + effectiveText;
    const missingSignals = SIGNALS.filter((s) => !combined.includes(s));

    check(
      "tek gorunurluk karari companion'in tasidigi sinyalleri kapsiyor",
      attentionExpr !== null && effectiveExpr !== null && missingSignals.length === 0,
      attentionExpr === null || effectiveExpr === null
        ? "publishSignalDemandsAttention / effectiveAiCompanionOpen turevleri tanimlanmamis"
        : "turevde eksik sinyal: " + missingSignals.join(", "),
    );

    /*
     * (h-scope) KAPSAM DISI BILDIRIMI COMPANION'I ZORLA ACMAZ.
     *
     * Onceki turda "kapsam disi aciklamasi mobilde gorunmuyor" diye olculen
     * sey bir YANLIS POZITIFTI: `checkVisibility()` bu sayfada guvenilmez
     * sonuc veriyor. Yapisal gercek asagidaki kontrolle sabitlenir —
     * bildirim zaten `<details>` agacinin DISINDA, ana composer kartinda
     * ciziliyor ve her iki kapidan da bagimsiz olarak gorunur.
     *
     * Bu yuzden `outOfScopeNotice` companion'i zorla acan bir sinyal
     * OLMAMALIDIR: yanlis bir olcumden dogan gereksiz panel acilmasi
     * kaliciasmasin. Kapsam guvenligi ayri eksende (2C) korunuyor: kapsam
     * disi talep publish yoluna hic girmiyor.
     */
    /*
     * Kontrol yalnizca iki turev adinin initializer'ina bakmaz. Regresyon,
     * ismi koruyup KULLANIM NOKTASINA ucuncu bir disjunct eklenerek de geri
     * gelebilir — ornegin `open={editDetailsOpen || publishSignalDemandsAttention
     * || Boolean(composerReadiness.outOfScopeNotice)}`. Bu yuzden companion
     * gorunurlugunu belirleyen HER ifade taranir: iki turev ve iki kapinin
     * attribute metinleri.
     */
    const companionVisibilityExprs: string[] = [attentionText, effectiveText];
    walk(source, (n) => {
      if (!ts.isJsxAttribute(n)) return;
      const attrName = n.name.getText(source);
      if (attrName !== "open" && attrName !== "className" && attrName !== "aria-expanded") {
        return;
      }
      const text = n.getText(source);
      if (!/publishSignalDemandsAttention|effectiveAiCompanionOpen/.test(text)) {
        return;
      }
      companionVisibilityExprs.push(text);
    });
    const scopeLeak = companionVisibilityExprs.filter((t) =>
      t.includes("outOfScopeNotice"),
    );
    check(
      "kapsam disi bildirimi companion-acma kararina karistirilmamis",
      scopeLeak.length === 0,
      "outOfScopeNotice companion gorunurluk ifadesinde geciyor (" +
        scopeLeak.length +
        " yerde) — bildirim zaten <details> disinda gorunur, bu zorlama yanlis pozitif bir olcumden gelir",
    );

    /*
     * (h0) ZORLA ACMA GECICI OLMALI — KALICI MANDAL DEGIL.
     *
     * `publishGuidanceAttempted` bir kez `true` olduktan sonra hicbir yerde
     * `false`'a donmuyor. Turevde CIPLAK kullanilirsa, kullanicinin ilk
     * yayin denemesinden sonra panel kalici olarak zorla acik kalir ve
     * kapatma dugmesi sessizce etkisizlesir. Sinyal, ancak KARSILIK GELEN
     * REHBERLIK GERCEKTEN GORUNURKEN gorunurluk talep etmelidir; bu da
     * panelin kendi render kosuluyla ayni otoriteye baglanmak demektir
     * (`attempted && missingLabels.length > 0`).
     */
    const guidanceLatchGuarded = (() => {
      if (!attentionText.includes("publishGuidanceAttempted")) return true;
      return /missingPublishLabels/.test(attentionText);
    })();
    check(
      "zorla acma gecici: rehberlik sinyali kalici mandal degil",
      guidanceLatchGuarded,
      "publishGuidanceAttempted turevde ciplak kullaniliyor — hic false'a donmedigi icin panel ilk denemeden sonra kalici acik kalir",
    );

    /*
     * (h-scope2) KAPSAM DISI BILDIRIMI IKI KAPININ DA DISINDA CIZILMELI.
     *
     * Yukaridaki karar (`outOfScopeNotice` companion'i acmaz) ancak bildirim
     * gercekten kapilarin disindaysa guvenlidir. Bunu YAPISAL olarak
     * sabitliyoruz: bildirimi tasiyan JSX, hicbir <details> alt agacinda
     * olmamali. Biri onu ileride akordeonun icine tasirsa bu satir kirmiziya
     * doner ve kapsam disi kullanicisi yine sessizce bilgisiz kalmaz.
     */
    let scopeNoticeNode: ts.Node | null = null;
    walk(source, (n) => {
      if (scopeNoticeNode) return;
      if (!ts.isJsxAttribute(n)) return;
      if (n.name.getText(source) !== "data-testid") return;
      const init = n.initializer;
      if (!init || !ts.isStringLiteral(init)) return;
      if (init.text !== "composer-out-of-scope") return;
      scopeNoticeNode = n;
    });

    /*
     * MUAFIYETSIZ ARALIK. Yukaridaki `insideDetails`, hata varken kendiligindern
     * acilan akordeonu bilerek muaf tutar — cunku `publishError` yolunda kutu
     * zaten gorunur olur. Kapsam disi bildiriminde bu muafiyet GECERSIZDIR:
     * bildirim hicbir hata olmadan da gorunmek zorundadir. Bu yuzden burada
     * dosyadaki HER <details> agaci sayilir.
     */
    const allDetailsRanges: Array<[number, number]> = [];
    walk(source, (n) => {
      if (
        (ts.isJsxElement(n) &&
          n.openingElement.tagName.getText(source) === "details") ||
        (ts.isJsxSelfClosingElement(n) && n.tagName.getText(source) === "details")
      ) {
        allDetailsRanges.push([n.getStart(source), n.getEnd()]);
      }
    });
    const insideAnyDetails = (n: ts.Node) =>
      allDetailsRanges.some(
        ([start, end]) => n.getStart(source) >= start && n.getEnd() <= end,
      );

    check(
      "kapsam disi bildirimi <details> agacinin disinda ciziliyor",
      scopeNoticeNode !== null && !insideAnyDetails(scopeNoticeNode),
      scopeNoticeNode === null
        ? "composer-out-of-scope isaretcisi bulunamadi — bildirimin yeri dogrulanamadi"
        : "kapsam disi bildirimi bir <details> icine tasinmis — akordeon kapaliyken kullanici kapsam disi oldugunu goremez",
    );

    /* (h1) Dis kapi: <details open> zorunlu gorunurluk turevini kullanmali. */
    let outerGateUsesDerived = false;
    walk(source, (n) => {
      let opening: ts.JsxOpeningLikeElement | null = null;
      if (ts.isJsxElement(n) && n.openingElement.tagName.getText(source) === "details") {
        opening = n.openingElement;
      } else if (
        ts.isJsxSelfClosingElement(n) &&
        n.tagName.getText(source) === "details"
      ) {
        opening = n;
      }
      if (!opening) return;
      for (const attr of opening.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        if (attr.name.getText(source) !== "open") continue;
        if (/publishSignalDemandsAttention/.test(attr.getText(source))) {
          outerGateUsesDerived = true;
        }
      }
    });
    check(
      "dis <details> kapisi tek gorunurluk kararini kullaniyor",
      outerGateUsesDerived,
      "details `open` yalnizca publishError'a bakiyor — rehberlik ve kapsam disi sinyalleri akordeonu acmaz",
    );

    /*
     * (h2) Ic kapi: companion icerigini saran className kararinda CIPLAK
     * `aiCompanionOpen` kalmamali; turetilmis karar kullanilmali.
     */
    let innerGateUsesDerived: boolean | null = null;
    walk(source, (n) => {
      if (innerGateUsesDerived !== null) return;
      if (!ts.isJsxExpression(n) || !n.expression) return;
      if (!ts.isIdentifier(n.expression) || n.expression.text !== "aiPanelContent") {
        return;
      }
      /* Bu ifadeyi tasiyan JSX elemaninin className'i ic kapidir. */
      let host: ts.JsxElement | null = null;
      for (let c: ts.Node | undefined = n.parent; c; c = c.parent) {
        if (ts.isJsxElement(c)) {
          host = c;
          break;
        }
      }
      if (!host) return;
      for (const attr of host.openingElement.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        if (attr.name.getText(source) !== "className") continue;
        const text = attr.getText(source);
        innerGateUsesDerived = /effectiveAiCompanionOpen/.test(text);
      }
    });
    check(
      "ic companion kapisi tek gorunurluk kararini kullaniyor",
      innerGateUsesDerived === true,
      innerGateUsesDerived === null
        ? "aiPanelContent'i saran className bulunamadi"
        : "ic panel hala ciplak aiCompanionOpen'a bagli — dis akordeon acilsa bile panel gizli kalir",
    );

    /* (h3) Mobil baslik aria-expanded ayni karari bildirmeli. */
    let ariaUsesDerived: boolean | null = null;
    walk(source, (n) => {
      if (ariaUsesDerived !== null) return;
      if (!ts.isJsxAttribute(n)) return;
      if (n.name.getText(source) !== "aria-expanded") return;
      ariaUsesDerived = /effectiveAiCompanionOpen/.test(n.getText(source));
    });
    check(
      "mobil baslik aria-expanded ayni karari bildiriyor",
      ariaUsesDerived === true,
      ariaUsesDerived === null
        ? "aria-expanded bulunamadi"
        : "aria-expanded gercek gorunurlukle uyusmuyor — ekran okuyucu yanlis durum duyurur",
    );

    /*
     * (h4) Gorunurluk TURETILMELI, effect ile senkronize EDILMEMELI.
     *
     * Olculen sey dar: bir effect'in bagimlilik dizisinde gorunurluk
     * sinyallerinden biri varsa ve o effect `setAiCompanionOpen` cagiriyorsa,
     * turetme yerine state senkronizasyonu kurulmus demektir — kullanici
     * tercihi ile zorunlu gorunurluk birbirini sessizce ezer. Kullanici
     * eylemine karsilik gelen mevcut effect'ler (ornegin `deps: []` ile
     * calisan taslak geri yukleme) bu kuralin disindadir; onlar bir sinyali
     * izlemez, bir olayi uygular.
     */
    const VISIBILITY_SIGNALS = /(publishError|publishGuidanceAttempted|outOfScopeNotice)/;
    let syncEffect = false;
    walk(source, (n) => {
      if (!ts.isCallExpression(n)) return;
      if (calleeName(n) !== "useEffect") return;
      const deps = n.arguments[1];
      if (!deps || !ts.isArrayLiteralExpression(deps)) return;
      if (!VISIBILITY_SIGNALS.test(deps.getText(source))) return;
      walk(n, (inner) => {
        if (!ts.isCallExpression(inner)) return;
        if (calleeName(inner) === "setAiCompanionOpen") syncEffect = true;
      });
    });
    check(
      "gorunurluk effect ile senkronize edilmiyor",
      !syncEffect,
      "gorunurluk sinyalini izleyen bir useEffect setAiCompanionOpen cagiriyor — turetme yerine state senkronizasyonu kurulmus",
    );
  }

  console.log("\n===== HUKUM =====");
  if (problems.length) {
    console.error(`KIRMIZI — ${problems.length} ihlal:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `YESIL — ${passed} passed. Yayin niyeti, talep yayina uygun olmasa bile\n` +
      "denemeye donusur; kapsam disi talep yayin yoluna hic girmez; basarisiz\n" +
      "deneme sessizce yutulmaz; latch yalniz gercek denemede tek kez kapanir\n" +
      "ve talep sayfasinin gercek baglantisi bu sozlesmeyi tasiyor.",
  );
  process.exit(0);
}

void main();
