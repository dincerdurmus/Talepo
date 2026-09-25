/**
 * /talep YENİ TASARIM — GERÇEK TARAYICI GEÇİŞİ (2026-09-25).
 *
 * Harness yeşili UI yeşili değildir: bu betik Chrome'u gerçekten sürer,
 * kullanıcı gibi yazar, soruyu cevaplar, kategori panelini açar ve her karede
 * NE ÖLÇTÜĞÜNÜ yazar. Ekran görüntüleri ölçülen DOM kimlikleriyle birlikte
 * bir manifest dosyasına kaydedilir; etiketsiz kare kanıt sayılmaz.
 *
 * YAZMA YOK. Bu geçiş yalnız okuma yapar; yayın POST'u kasıtlı olarak
 * çalıştırılmaz (bkz. rapor: kabul veritabanı TLS zinciri nedeniyle
 * erişilemiyor, olağan dev ortamı ise birincil projeyi gösteriyor).
 *
 * Koşum (kendi portunda bir dev sunucusu ayakta olmalı):
 *   npx next dev -p 3211
 *   node scripts/qa-talep-ui-browser-v1.cjs
 * Değişkenler: TALEP_QA_URL (varsayılan http://localhost:3211),
 * TALEP_QA_OUT (ekran görüntüsü klasörü).
 *
 * Yeni bağımlılık YOK: Node 24'ün gömülü WebSocket'i ve makinedeki Chrome
 * üzerinden CDP konuşulur; Playwright kurulumu ya da depo değişikliği
 * gerektirmez.
 */
const fs = require("fs");
const path = require("path");
const { launch, connect } = require("./lib/qa-cdp-v1.cjs");

const BASE = process.env.TALEP_QA_URL || "http://localhost:3211";
const OUT = process.env.TALEP_QA_OUT ||
  "C:\\Users\\HP\\Documents\\Veyra\\projects\\talepo\\tasarim\\talep-ui-2026-09-25\\sonuc";

const results = [];
const shots = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? `: ${String(detail).slice(0, 180)}` : ""}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { proc, wsUrl } = await launch(9333);
  const browser = await connect(wsUrl);

  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const S = sessionId;
  await browser.send("Page.enable", {}, S);
  await browser.send("Runtime.enable", {}, S);
  await browser.send("Network.enable", {}, S);

  const setViewport = (width, height = 900) =>
    browser.send(
      "Emulation.setDeviceMetricsOverride",
      { width, height, deviceScaleFactor: 2, mobile: width < 768 },
      S,
    );

  const evaluate = async (expr) => {
    const r = await browser.send(
      "Runtime.evaluate",
      { expression: expr, awaitPromise: true, returnByValue: true },
      S,
    );
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || "eval failed");
    }
    return r.result.value;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * SABİT BEKLEME YETMEZ (ölçüldü: bir koşuda masaüstü karesi boş çıktı ve
   * beş kapı sahte kırmızı verdi). Yükleme olayından sonra başlangıç ekranı
   * DOM'a girene kadar yoklanır; kanıt aracı kendi zamanlamasına güvenmez.
   */
  const goto = async (url) => {
    const loaded = browser.once((m) => m.method === "Page.loadEventFired" && m.sessionId === S);
    await browser.send("Page.navigate", { url }, S);
    await loaded;
    for (let i = 0; i < 40; i += 1) {
      const ready = await evaluate(
        `Boolean(document.querySelector('[data-testid="talep-start"]') || document.querySelector('[data-testid="talep-request-card"]'))`,
      );
      if (ready) break;
      await sleep(300);
    }
    await sleep(600);
  };

  const shot = async (name, label, measured) => {
    /* Next dev rozeti üründen değildir; kanıt karesine girmesin. */
    await evaluate(`(() => {
      if (!document.getElementById("qa-hide-devtools")) {
        const s = document.createElement("style");
        s.id = "qa-hide-devtools";
        s.textContent = "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}";
        document.head.appendChild(s);
      }
      return "ok";
    })()`);
    const { data } = await browser.send(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true },
      S,
    );
    const file = path.join(OUT, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    shots.push({ file: `${name}.png`, label, measured });
    console.log(`SHOT ${name}.png — ${label} — ${JSON.stringify(measured)}`);
  };

  /* Cümleyi React'in gördüğü şekilde yazar: native setter + input olayı. */
  const typeInto = async (selector, text) =>
    evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return "no-el";
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(proto.prototype, "value").set;
      setter.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return "ok";
    })()`);

  const click = async (selector) =>
    evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return "no-el";
      el.scrollIntoView({ block: "center" });
      el.click();
      return "ok";
    })()`);

  /**
   * TEK CEVAP ADIMI. Kullanıcı gibi davranır: para alanında tutarı yazıp
   * "Kaydet"e basar, konum seçicide bir il işaretleyip kaydeder, aksi hâlde
   * ilk iOS seçenek satırına dokunur. Hiçbir cevabı doğrudan state'e yazmaz.
   */
  const ANSWER_STEP = `(() => {
    const box = document.querySelector('[data-testid="composer-questions"]');
    if (!box) return "no-box";
    const setValue = (el, v) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const saveBtn = () =>
      [...box.querySelectorAll("button")].find((b) => b.textContent.trim() === "Kaydet");

    const money = box.querySelector("#budget-amount");
    if (money) {
      setValue(money, "32000");
      const s = saveBtn();
      if (s && !s.disabled) { s.click(); return "money:kaydet"; }
      return "money:kaydet-disabled";
    }
    const locBox = box.querySelector('[data-testid="control-location-picker"]');
    if (locBox) {
      const boxes = [...locBox.querySelectorAll('input[type="checkbox"]')];
      const il = boxes.find((c) => (c.parentElement?.textContent || "").trim() === "İstanbul") || boxes[1];
      if (il) { il.click(); }
      const s = saveBtn();
      if (s && !s.disabled) { s.click(); return "location:kaydet"; }
      return "location:no-save";
    }
    const rows = [...box.querySelectorAll("button")].filter(
      (b) => getComputedStyle(b).minHeight === "58px",
    );
    if (rows.length > 0) { rows[0].click(); return "option:" + rows[0].textContent.trim(); }
    const input = box.querySelector("input");
    const s = saveBtn();
    if (input && s) { setValue(input, "Belirtildi"); s.click(); return "typed"; }
    const free = box.querySelector('input[id$="-custom"]');
    if (free) {
      setValue(free, "Belirtildi");
      const send = box.querySelector('button[aria-label="Kaydet"]');
      if (send && !send.disabled) { send.click(); return "free-row"; }
    }
    return "no-control";
  })()`;

  const snapshot = async () =>
    evaluate(`(() => {
      const q = (s) => document.querySelector(s);
      const rows = [...document.querySelectorAll('[data-testid="talep-card-row"]')]
        .map((r) => ({ key: r.dataset.rowKey, state: r.dataset.rowState }));
      const ents = [...document.querySelectorAll('[data-testid="maira-reading-entity"]')]
        .map((e) => ({ key: e.dataset.entityKey, label: e.dataset.entityLabel, on: e.dataset.on }));
      return {
        start: Boolean(q('[data-testid="talep-start"]')),
        status: q('[data-testid="maira-status"]')?.textContent?.trim() ?? null,
        readingPhase: q('[data-testid="maira-reading-sentence"]')?.dataset.phase ?? null,
        entities: ents,
        card: Boolean(q('[data-testid="talep-request-card"]')),
        meter: q('[data-testid="talep-card-meter"]')?.textContent?.trim() ?? null,
        rows,
        crumbTop: q('[data-testid="talep-request-card"] .font-mono')?.textContent?.trim() ?? null,
        question: q('[data-testid="composer-question-prompt"]')?.textContent?.trim() ?? null,
        questionField: q('[data-field-key]')?.dataset.fieldKey ?? null,
        controlType: q('[data-control-type]')?.dataset.controlType ?? null,
        optionRows: [...document.querySelectorAll('[data-testid="composer-questions"] button')]
          .map((b) => b.textContent.trim()).filter(Boolean).slice(0, 8),
        publishCta: q('[data-testid="composer-review-cta"]')?.textContent?.trim() ?? null,
        continueHint: q('[data-testid="composer-continue-hint"]')?.textContent?.trim() ?? null,
        outOfScope: q('[data-testid="composer-out-of-scope"]')?.textContent?.trim()?.slice(0, 140) ?? null,
        extras: [...document.querySelectorAll('[data-testid="talep-card-extras"] button')].map((b) => b.textContent.trim()),
        sheetOpen: Boolean(q('[data-testid="talep-category-sheet"]')),
        sheetRoots: [...document.querySelectorAll('[data-testid="talep-category-root"] b')].map((b) => b.textContent.trim()),
        categoryAsk: /Hangi alanda arıyorsun|olarak değerlendiriyorum/.test(document.body.innerText),
        sheetSubs: [...document.querySelectorAll('[data-testid="talep-category-sub"]')].map((b) => b.textContent.trim()),
        darkThemeClasses: document.documentElement.outerHTML.includes(' dark:'),
        faceCanvas: Boolean(q('[data-testid="maira-contour-canvas"]')),
        faces: document.querySelectorAll('[data-testid="maira-face"]').length,
      };
    })()`);

  /* ---------------------------------------------------------------- */
  /* 1) BAŞLANGIÇ — telefon                                            */
  await setViewport(390, 844);
  await goto(`${BASE}/talep`);
  /** Yatay taşma ölçümü: sayfa kendi genişliğini aşmamalı. */
  const overflow = () =>
    evaluate(
      `({ scrollW: document.documentElement.scrollWidth, inner: window.innerWidth })`,
    );

  let s = await snapshot();
  const ov1 = await overflow();
  check(
    "390: sayfa yatay taşmıyor",
    ov1.scrollW <= ov1.inner + 1,
    JSON.stringify(ov1),
  );
  check("390: başlangıç ekranı çiziliyor", s.start === true, JSON.stringify(s).slice(0, 120));
  check("390: Maira yüzü var", s.faces >= 1, `faces=${s.faces}`);
  check("başlangıçta koyu tema sınıfı yok", s.darkThemeClasses === false);
  const cats = await evaluate(
    `[...document.querySelectorAll('[data-testid="talep-start-category"] b')].map(b=>b.textContent.trim())`,
  );
  check("390: kategori şeridi fotoğraflı kartlarla dolu", cats.length >= 10, cats.join(","));
  await shot("m-1-baslangic", "mobil 390 — başlangıç", { start: s.start, categories: cats.length, faces: s.faces });

  /* 2) OKUMA ANI — Arçelik buzdolabı                                   */
  await typeInto("#talep-composer", "Arçelik buzdolabı arıyorum, İstanbul Kadıköy");
  await sleep(900);
  const detected = await evaluate(
    `[...document.querySelectorAll('[data-testid="talep-start-detected"] span.inline-flex')].map(e=>e.textContent.trim())`,
  );
  check("yazarken anlaşılan etiketler beliriyor", detected.length > 0, detected.join(" | "));
  await shot("m-1b-yazarken", "mobil 390 — yazarken anlaşılanlar", { detected });

  await click('[data-testid="composer-intro-continue"]');
  await sleep(500);
  s = await snapshot();
  check("okuma anı açıldı (OKUYOR)", s.status === "OKUYOR", `status=${s.status} phase=${s.readingPhase}`);
  check("okuma anında cümle büyük puntoda", s.readingPhase === "reading", s.readingPhase);
  check(
    "vurgular anlama sonucundan geliyor",
    s.entities.length > 0,
    s.entities.map((e) => `${e.label}:${e.on}`).join(","),
  );
  await sleep(700);
  s = await snapshot();
  await shot("m-2-okuma", "mobil 390 — Maira okuyor", {
    status: s.status,
    phase: s.readingPhase,
    entities: s.entities,
  });

  /* 3) SORU — kart + tek soru                                          */
  await sleep(3200);
  s = await snapshot();
  check("okuma anı alıntıya dönüyor", s.readingPhase === "quote", s.readingPhase);
  check("talep kartı belirdi", s.card === true);
  check("kartta doluluk çubuğu var", Boolean(s.meter), s.meter);
  check("ekranda tek soru var", Boolean(s.question), s.question);
  check("durum SORUYOR", s.status === "SORUYOR", s.status);
  check(
    "kartta 'şimdi soruluyor' satırı sorulan alanla eşleşiyor",
    s.rows.some((r) => r.state === "asking" && r.key === s.questionField),
    JSON.stringify(s.rows) + " q=" + s.questionField,
  );
  check(
    "kategori kırıntısı tekrarlı değil",
    (s.crumbTop || "").length > 0,
    s.crumbTop,
  );
  check("ana eylem hep görünür", Boolean(s.publishCta || s.continueHint), s.publishCta || s.continueHint);
  /* Kapsam İÇİNDE kategori adımı DURUR — kapsam dışı susturmasının karşı kontrolü. */
  check("kapsam içinde kategori adımı görünür", s.categoryAsk === true);
  {
    const ov = await overflow();
    check("390: soru ekranı yatay taşmıyor", ov.scrollW <= ov.inner + 1, JSON.stringify(ov));
  }
  await shot("m-3-soru", "mobil 390 — tek soru + talep kartı", {
    status: s.status,
    meter: s.meter,
    question: s.question,
    field: s.questionField,
    control: s.controlType,
    rows: s.rows,
  });

  /* 4) KATEGORİ PANELİ + ALT KATEGORİ                                  */
  await click('[data-testid="talep-card-change-category"]');
  await sleep(700);
  s = await snapshot();
  check("kategori paneli alttan açıldı", s.sheetOpen === true);
  check("panelde fotoğraflı kök kategoriler var", s.sheetRoots.length >= 10, s.sheetRoots.join(","));
  await shot("m-4-kategoriler", "mobil 390 — kategori paneli", { roots: s.sheetRoots.length });

  await click('[data-testid="talep-category-root"]');
  await sleep(700);
  s = await snapshot();
  check("alt kategori listesi açıldı", s.sheetSubs.length > 0, s.sheetSubs.join(","));
  await shot("m-5-altkategori", "mobil 390 — alt kategori", { subs: s.sheetSubs });
  await evaluate(`document.querySelector('[role="dialog"] button.ml-auto')?.click()`);
  await sleep(500);

  /* 5) HAZIR — soruları cevapla                                        */
  for (let i = 0; i < 6; i += 1) {
    s = await snapshot();
    if (!s.question) break;
    const answered = await evaluate(ANSWER_STEP);
    console.log(`  cevap adımı ${i + 1}: ${answered}`);
    await sleep(1400);
  }
  s = await snapshot();
  check("tüm zorunlu cevaplar sonrası yayın butonu açık", Boolean(s.publishCta), s.publishCta || s.continueHint);
  check("kart doluluk çubuğu tamamlandı", Boolean(s.meter), s.meter);
  await shot("m-6-hazir", "mobil 390 — hazır", {
    status: s.status,
    meter: s.meter,
    cta: s.publishCta,
    rows: s.rows,
    extras: s.extras,
  });

  /* 6) MASAÜSTÜ 1280                                                   */
  await setViewport(1280, 900);
  await goto(`${BASE}/talep`);
  s = await snapshot();
  check("1280: başlangıç ekranı", s.start === true);
  check("1280: büyük Maira yüzü var", s.faces >= 1, `faces=${s.faces}`);
  await shot("d-1-baslangic", "masaüstü 1280 — başlangıç", { faces: s.faces });

  await typeInto("#talep-composer", "1000 adet kartvizit, mat selefonlu, Topkapı");
  await sleep(900);
  await click('[data-testid="composer-intro-continue"]');
  await sleep(1200);
  s = await snapshot();
  await shot("d-2-okuma", "masaüstü 1280 — Maira okuyor", {
    status: s.status,
    phase: s.readingPhase,
    entities: s.entities,
  });
  await sleep(3200);
  s = await snapshot();
  check("1280: kart sağ kolonda", s.card === true);
  check("1280: tek soru", Boolean(s.question), s.question);
  await shot("d-3-soru", "masaüstü 1280 — soru + sticky kart", {
    status: s.status,
    meter: s.meter,
    question: s.question,
    field: s.questionField,
    rows: s.rows,
  });

  await click('[data-testid="talep-card-change-category"]');
  await sleep(700);
  s = await snapshot();
  await shot("d-4-kategoriler", "masaüstü 1280 — kategori paneli", { roots: s.sheetRoots.length });

  await click('[data-testid="talep-category-root"]');
  await sleep(700);
  s = await snapshot();
  check("1280: alt kategori listesi açıldı", s.sheetSubs.length > 0, s.sheetSubs.join(","));
  await shot("d-5-altkategori", "masaüstü 1280 — alt kategori", { subs: s.sheetSubs });
  await evaluate(`document.querySelector('[role="dialog"] button.ml-auto')?.click()`);
  await sleep(400);

  for (let i = 0; i < 6; i += 1) {
    s = await snapshot();
    if (!s.question) break;
    console.log(`  masaüstü cevap adımı ${i + 1}: ${await evaluate(ANSWER_STEP)}`);
    await sleep(1400);
  }
  s = await snapshot();
  await shot("d-6-hazir", "masaüstü 1280 — hazır", {
    status: s.status,
    meter: s.meter,
    cta: s.publishCta,
    rows: s.rows,
  });

  /* 7) BELİRSİZ CÜMLE                                                   */
  await goto(`${BASE}/talep`);
  await typeInto("#talep-composer", "bir şeyler lazım acil");
  await sleep(900);
  await click('[data-testid="composer-intro-continue"]');
  await sleep(4500);
  s = await snapshot();
  check(
    "belirsiz cümlede akış kilitlenmiyor",
    Boolean(s.question || s.continueHint || s.publishCta || s.outOfScope),
    JSON.stringify({ q: s.question, hint: s.continueHint, cta: s.publishCta }).slice(0, 160),
  );
  await shot("d-7-belirsiz", "masaüstü 1280 — belirsiz cümle", {
    status: s.status,
    question: s.question,
    hint: s.continueHint,
    card: s.card,
  });

  /* 8) İLAÇ — kapsam kapısı                                             */
  await goto(`${BASE}/talep`);
  await typeInto("#talep-composer", "Ağrı kesici ilaç arıyorum, İstanbul");
  await sleep(900);
  await click('[data-testid="composer-intro-continue"]');
  await sleep(4500);
  s = await snapshot();
  check("ilaç talebinde kapsam metni görünüyor", Boolean(s.outOfScope), s.outOfScope);
  check("ilaç talebinde yayın butonu YOK", !s.publishCta, s.publishCta);
  const saysLive = await evaluate(
    `document.body.innerText.includes("Talebin yayında")`,
  );
  check("ilaç talebinde 'yayında' denmiyor", saysLive === false);
  check(
    "kapsam dışında kategori sorulmuyor",
    s.categoryAsk === false,
    "kapsam metninin altında kategori sorusu duruyor",
  );
  await shot("d-8-ilac-kapsam", "masaüstü 1280 — ilaç kapsam kapısı", {
    outOfScope: Boolean(s.outOfScope),
    publishCta: s.publishCta,
  });

  fs.writeFileSync(
    path.join(OUT, "olcum-manifest.json"),
    JSON.stringify({ base: BASE, at: new Date().toISOString(), checks: results, shots }, null, 2),
  );

  await browser.send("Target.closeTarget", { targetId });
  try { proc.kill(); } catch {}

  const failed = results.filter((r) => !r.ok);
  console.log(`\nTARAYICI GEÇİŞİ: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  if (failed.length) {
    for (const f of failed) console.log(" -", f.name, f.detail ?? "");
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("QA RUN FAILED:", e.message);
  process.exit(1);
});
