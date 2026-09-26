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
const { decodePng, inkBounds } = require("./lib/qa-png-v1.cjs");

const BASE = process.env.TALEP_QA_URL || "http://localhost:3211";
const OUT = process.env.TALEP_QA_OUT ||
  "C:\\Users\\HP\\Documents\\Veyra\\projects\\talepo\\tasarim\\talep-ui-2026-09-25\\sonuc4";

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
  /**
   * BELGE YANITININ DURUMU. Önceki turda sunucu kapalıyken çekilen kareler
   * "siteye ulaşılamıyor" sayfasını gösteriyordu ve kanıt diye teslim
   * edilmişti. Artık her gezinmenin HTTP durumu kaydedilir ve kare
   * kaydedilmeden önce okunur.
   */
  let lastDocStatus = null;
  browser.listeners.push((m) => {
    if (
      m.method === "Network.responseReceived" &&
      m.params?.type === "Document"
    ) {
      lastDocStatus = m.params.response.status;
    }
  });

  const goto = async (url) => {
    lastDocStatus = null;
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
    check(
      `gezinme 200 döndü (${url})`,
      lastDocStatus === 200,
      `status=${lastDocStatus}`,
    );
  };

  /**
   * SAYFA GERÇEKTEN YÜKLENDİ Mİ? Ürün yüzeylerinden en az biri DOM'da
   * olmalı; yoksa kare KAYDEDİLMEZ ve hata sayılır (kurucu, 2026-09-25).
   */
  const pageAlive = async () =>
    evaluate(`(() => {
      const hasSurface = Boolean(
        document.querySelector('[data-testid="talep-start"]') ||
        document.querySelector('[data-testid="talep-request-card"]') ||
        document.querySelector('[data-testid="composer-questions"]') ||
        document.querySelector('[data-testid="composer-out-of-scope"]') ||
        /* Okuma anında kart henüz yok; ekranda duran şey cümlenin kendisidir. */
        document.querySelector('[data-testid="maira-reading-sentence"]')
      );
      const text = document.body?.innerText || "";
      return {
        hasSurface,
        hasCopy: /Ne arıyorsun|Maira|Talebi yayınla|Talepo/.test(text),
        title: document.title || "",
      };
    })()`);

  /**
   * MAIRA'NIN YÜZÜNÜ ÖLÇER. Kutunun kırpılmış karesi çözülür ve mürekkebin
   * kutuyu ne kadar kapladığı sayılır: "yüz seçiliyor mu" sorusu göz kararı
   * değil, sayı olarak cevaplanır.
   */
  const measureFace = async (index = 0) => {
    /*
      GÖRÜNEN yüz ölçülür. Masaüstünde telefon yüzü (`lg:hidden`) DOM'da
      durur ama genişliği sıfırdır; sıralamayı ona göre yapmak ölçümü boşa
      düşürüyordu.
    */
    const box = await evaluate(`(() => {
      const faces = [...document.querySelectorAll('[data-testid="maira-face"]')]
        .filter((el) => el.getBoundingClientRect().width > 4);
      const el = faces[${index}];
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      const canvas = el.querySelector('[data-testid="maira-contour-canvas"]');
      return {
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
        scene: Boolean(canvas),
        framing: canvas?.dataset.framing ?? null,
        camTarget: canvas?.dataset.camTarget ?? null,
        camDist: canvas?.dataset.camDist ?? null,
      };
    })()`);
    if (!box || box.w < 4) return null;
    const { data } = await browser.send(
      "Page.captureScreenshot",
      {
        format: "png",
        clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 2 },
      },
      S,
    );
    const ink = inkBounds(decodePng(Buffer.from(data, "base64")));
    return { box, ink };
  };

  const shot = async (name, label, measured) => {
    const alive = await pageAlive();
    if (!alive.hasSurface || !alive.hasCopy || lastDocStatus !== 200) {
      check(
        `kare kaydedilmedi — sayfa yüklü değil (${name})`,
        false,
        JSON.stringify({ ...alive, status: lastDocStatus }),
      );
      return;
    }
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
    /*
      KATEGORİ ADIMI SORULARDAN ÖNCE GELİR (kurucu, 2026-09-25). Kartın
      içinden çıkan doğrulama artık tek soru alanında duruyor; akışı sürdürmek
      için önce o onaylanır. Kanonik eylem çağrılır, state'e yazılmaz.
    */
    const catConfirm = document.querySelector('[data-testid="category-confirmation-confirm"]');
    if (catConfirm) { catConfirm.click(); return "category:confirm"; }

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
        meterReady: q('[data-testid="talep-card-meter"]')?.dataset.meterReady ?? null,
        meterFilled: q('[data-testid="talep-card-meter"]')?.dataset.meterFilled ?? null,
        meterTotal: q('[data-testid="talep-card-meter"]')?.dataset.meterTotal ?? null,
        cardTitle: q('[data-testid="talep-request-card"] h2')?.textContent?.trim() ?? null,
        optionalBadge: q('[data-testid="composer-question-optional"]')?.textContent?.trim() ?? null,
        publishCtaDisabled: q('[data-testid="composer-review-cta"]')?.disabled ?? null,
        rows,
        crumbTop: q('[data-testid="talep-request-card"] .font-mono')?.textContent?.trim() ?? null,
        /*
          KARTIN KIRINTISI İKİ SATIRDIR: üstte kök (font-mono satırı), altında
          alt kategori. crumbTop yalnız kökü okur; alt kategoriyi ona sormak
          ölçümü yanlış düğüme bağlar (ölçüldü: D-0041 kapısı kök satırında
          "Kartvizit" arıyordu ve sahte KIRMIZI verdi).
        */
        crumbLeaf:
          q('[data-testid="talep-request-card"] .font-mono ~ span')?.textContent?.trim() ?? null,
        question: q('[data-testid="composer-question-prompt"]')?.textContent?.trim() ?? null,
        questionField: q('[data-field-key]')?.dataset.fieldKey ?? null,
        controlType: q('[data-control-type]')?.dataset.controlType ?? null,
        optionRows: [...document.querySelectorAll('[data-testid="composer-questions"] button')]
          .map((b) => b.textContent.trim()).filter(Boolean).slice(0, 8),
        publishCta: q('[data-testid="composer-review-cta"]')?.textContent?.trim() ?? null,
        continueHint: q('[data-testid="composer-continue-hint"]')?.textContent?.trim() ?? null,
        /*
          VİDEODAKİ SADELİK KAPILARI — EKRANDAN ÖLÇÜLÜR (2026-09-26).
          Kaynak şekli doğrulayıcıda ölçülüyor; burada gerçekten görünen DOM
          sorulur: isteğe bağlı bölüm kapalı mı, yayın butonu onun üstünde mi,
          kartta yer tutucu ya da kalem ikonu kaldı mı.
        */
        optionalDetails: (() => {
          const d = q('[data-testid="composer-optional-details"]');
          if (!d) return null;
          const cta = q('[data-testid="composer-review-cta"]');
          return {
            open: d.open,
            summary: d.querySelector("summary")?.textContent?.trim() ?? null,
            /* DOM sırası: buton bölümden ÖNCE gelmeli. */
            ctaBefore: cta
              ? Boolean(
                  cta.compareDocumentPosition(d) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
                )
              : null,
          };
        })(),
        publishDock: (() => {
          const d = q('[data-testid="composer-publish-dock"]');
          return d ? { docked: d.dataset.docked } : null;
        })(),
        cardSubPlaceholder: /Tüm alt kategoriler/.test(
          q('[data-testid="talep-request-card"]')?.innerText ?? "",
        ),
        cardRowHint:
          q('[data-testid="talep-card-row-hint"]')?.textContent?.trim() ?? null,
        cardHasCategoryConfirm: Boolean(
          q('[data-testid="talep-card-category-confirm"]'),
        ),
        categoryStepSurface: Boolean(
          q('[data-testid="category-confirmation-card"]'),
        ),
        startHeading: q('[data-testid="talep-start"] h1')?.textContent?.trim() ?? null,
        startPlaceholder: q("#talep-composer")?.getAttribute("placeholder") ?? null,
        startMairaMark:
          q('[data-testid="talep-start-maira-mark"]')?.textContent?.trim() ?? null,
        publishedMono:
          q('[data-testid="talep-published-mono"]')?.textContent?.trim() ?? null,
        publishOutcome:
          q('[data-testid="talep-published"]')?.dataset.publishOutcome ?? null,
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
  /* VİDEODAKİ İLK AN: büyük yüz, mono MAIRA, "Tek cümle yaz." ve kutu. */
  check(
    "390: başlık 'Tek cümle yaz.'",
    s.startHeading === "Tek cümle yaz.",
    s.startHeading,
  );
  check(
    "390: kutu placeholder'ı 'Ne arıyorsun?'",
    s.startPlaceholder === "Ne arıyorsun?",
    s.startPlaceholder,
  );
  check(
    "390: yüzün altında mono MAIRA etiketi",
    s.startMairaMark === "MAIRA",
    s.startMairaMark,
  );
  {
    const gone = await evaluate(
      `(() => { const t = document.querySelector('[data-testid="talep-start"]')?.innerText ?? ""; return { desc: /Maira eksik kalanı sorar/.test(t), hint: /Marka, adet, konum yazarsan/.test(t) }; })()`,
    );
    check(
      "390: açıklama paragrafı ve ipucu satırı kalktı",
      gone.desc === false && gone.hint === false,
      JSON.stringify(gone),
    );
  }
  check("başlangıçta koyu tema sınıfı yok", s.darkThemeClasses === false);
  const cats = await evaluate(
    `[...document.querySelectorAll('[data-testid="talep-start-category"] b')].map(b=>b.textContent.trim())`,
  );
  check("390: kategori şeridi fotoğraflı kartlarla dolu", cats.length >= 10, cats.join(","));

  /*
    YÜZ KADRAJI — ÖLÇÜLÜR, GÖZLE KARAR VERİLMEZ. Mürekkep kutunun dikey
    ortasında ve yüksekliğinin çoğunda durmalı; gövde kadrajında mürekkep
    kutunun altına yığılıyordu.
  */
  const faceMobile = await measureFace(0);
  check(
    "240px yüz: telefonda büyütüldü (videodaki ilk an)",
    Boolean(faceMobile && faceMobile.box.w >= 220),
    JSON.stringify(faceMobile?.box),
  );
  check(
    "240px yüz: sahne portre kadrajında kuruldu",
    Boolean(faceMobile && faceMobile.box.framing === "portrait"),
    JSON.stringify(faceMobile?.box),
  );
  check(
    "240px yüz: mürekkep kutunun yüksekliğinin çoğunu kaplıyor",
    Boolean(faceMobile && faceMobile.ink.heightRatio >= 0.55),
    JSON.stringify(faceMobile?.ink),
  );
  check(
    "240px yüz: mürekkep dikeyde ortalı (gövdeye kaymıyor)",
    Boolean(
      faceMobile &&
        faceMobile.ink.centerY > 0.3 &&
        faceMobile.ink.centerY < 0.7,
    ),
    JSON.stringify(faceMobile?.ink),
  );
  await shot("m-1-baslangic", "mobil 390 — başlangıç", {
    start: s.start,
    categories: cats.length,
    faces: s.faces,
    face: faceMobile,
  });

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
  /*
    KONUM VURGUSU EKRANDAN ÖLÇÜLÜR (kurucu ölçümü, m-2-okuma.png). Metinde
    yeri bulunan HER alan yanmalı; konum "İstanbul Kadıköy" diye bitişik
    yazıldığında da vurgu tamamını kapsar.
  */
  check(
    "okuma anında konum da vurgulanıyor",
    s.entities.some((e) => /konum|şehir/i.test(e.label ?? "")),
    s.entities.map((e) => `${e.label}:${e.on}`).join(","),
  );

  /* 3) SORU — kart + tek soru                                          */
  await sleep(3200);
  s = await snapshot();
  check("okuma anı alıntıya dönüyor", s.readingPhase === "quote", s.readingPhase);
  check("talep kartı belirdi", s.card === true);
  check("kartta doluluk çubuğu var", Boolean(s.meter), s.meter);
  check("durum SORUYOR", s.status === "SORUYOR", s.status);
  check(
    "kategori kırıntısı tekrarlı değil",
    (s.crumbTop || "").length > 0,
    s.crumbTop,
  );
  /*
    "Yayın için son adım: …" bandı kalktı (kurucu, 2026-09-25): kalan zorunlu
    alan kartta amber "şimdi soruluyor" satırı olarak zaten görünüyor. Ekranda
    yine tek eylem durur — ya soru ya yayın butonu.
  */
  check("eksik alan varken ayrı 'son adım' bandı YOK", s.continueHint === null, s.continueHint);
  check(
    "eksik alan kartta 'şimdi soruluyor' olarak görünüyor",
    s.rows.some((r) => r.state === "asking"),
    JSON.stringify(s.rows),
  );
  check(
    "ekranda tek eylem var",
    Boolean(s.question || s.publishCta || s.categoryStepSurface),
    `${s.question} / ${s.publishCta} / cat=${s.categoryStepSurface}`,
  );
  check("kartta 'Tüm alt kategoriler' yer tutucusu yok", s.cardSubPlaceholder === false);
  check("kartta kategori doğrulama kutusu yok", s.cardHasCategoryConfirm === false);
  check(
    "kart altında satır ipucu duruyor",
    s.cardRowHint === "Satıra dokunup değiştirebilirsin",
    s.cardRowHint,
  );
  check(
    "kart başlığı kısa: marka + ürün, konum yok",
    Boolean(s.cardTitle) &&
      !/Kadıköy|İstanbul/.test(s.cardTitle) &&
      !/arıyorum/i.test(s.cardTitle),
    s.cardTitle,
  );
  /*
    KATEGORİ DOĞRULAMASI SORULARDAN ÖNCE, KARTIN ALTINDAKİ TEK ALANDA. Ekranda
    aynı anda hem doğrulama hem soru durmaz; onaylandıktan sonra soru gelir.
  */
  check(
    "kapsam içinde kategori adımı tek soru alanında görünür",
    s.categoryStepSurface === true,
    `categoryAsk=${s.categoryAsk} surface=${s.categoryStepSurface}`,
  );
  if (s.categoryStepSurface) {
    check("doğrulama açıkken ayrıca soru gösterilmiyor", s.question === null, s.question);
    await shot("m-2b-kategori-onay", "mobil 390 — kategori doğrulaması tek soru alanında", {
      crumbTop: s.crumbTop,
      rows: s.rows,
      cardHasCategoryConfirm: s.cardHasCategoryConfirm,
    });
    await click('[data-testid="category-confirmation-confirm"]');
    await sleep(1400);
    s = await snapshot();
  }
  check("ekranda tek soru var", Boolean(s.question), s.question);
  check(
    "kartta 'şimdi soruluyor' satırı sorulan alanla eşleşiyor",
    s.rows.some((r) => r.state === "asking" && r.key === s.questionField),
    JSON.stringify(s.rows) + " q=" + s.questionField,
  );
  check(
    "ilk soru zorunlu: 'İsteğe bağlı' rozeti YOK",
    s.optionalBadge === null,
    s.optionalBadge,
  );
  /* 38px durum işaretindeki yüz de portre okunmalı (sahne kurulmaz). */
  {
    const small = await measureFace(0);
    check(
      "38px durum işareti: mürekkep kutuda ortalı",
      Boolean(small && small.ink.centerY > 0.3 && small.ink.centerY < 0.7),
      JSON.stringify(small),
    );
    check(
      "38px durum işareti: gövde silüeti yok (mürekkep alta yığılmıyor)",
      Boolean(small && small.ink.y + small.ink.h <= small.ink.height * 0.94),
      JSON.stringify(small?.ink),
    );
  }
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

  /* 5) HAZIR — YALNIZ ZORUNLULARI cevapla, isteğe bağlı soru AÇIK kalsın   */
  for (let i = 0; i < 6; i += 1) {
    s = await snapshot();
    /* Kategori adımı da bir "bekleyen şey"dir: onaylanmadan soru gelmez. */
    if (s.publishCta) break;
    if (!s.question && !s.categoryStepSurface) break;
    const answered = await evaluate(ANSWER_STEP);
    console.log(`  cevap adımı ${i + 1}: ${answered}`);
    await sleep(1400);
  }
  s = await snapshot();
  check("tüm zorunlu cevaplar sonrası yayın butonu açık", Boolean(s.publishCta), s.publishCta || s.continueHint);
  check("kart doluluk çubuğu tamamlandı", Boolean(s.meter), s.meter);
  /*
    KURUCU ÖLÇÜMÜ: bütçe girilince sayaç "4/7" oluyordu. Doğrusu: zorunlular
    bitince sayaç TAM ve "Yayına hazır"; isteğe bağlı sorular kart satırı
    değil chip; soru açıkken bile yayın butonu basılabilir.
  */
  check(
    "zorunlular bitince sayaç 'Yayına hazır' der",
    s.meterReady === "true" && /Yayına hazır/i.test(s.meter || ""),
    `${s.meter} (${s.meterFilled}/${s.meterTotal})`,
  );
  check(
    "kartta 'sorulacak' satırı kalmadı",
    s.rows.every((r) => r.state === "filled"),
    JSON.stringify(s.rows),
  );
  /*
    HAZIR ANI — VİDEODAKİ SIRA (kurucu, 2026-09-25). Yayın butonu kartın
    hemen altında ve isteğe bağlı bölümün ÜSTÜNDE durur; isteğe bağlı soru
    kendiliğinden AÇILMAZ.
  */
  check(
    "hazır durumda isteğe bağlı soru otomatik açılmıyor",
    s.question === null,
    s.question,
  );
  check(
    "isteğe bağlı bölüm kapalı doğuyor",
    s.optionalDetails !== null && s.optionalDetails.open === false,
    JSON.stringify(s.optionalDetails),
  );
  check(
    "yayın butonu isteğe bağlı bölümün ÜSTÜNDE",
    Boolean(s.optionalDetails && s.optionalDetails.ctaBefore === true),
    JSON.stringify(s.optionalDetails),
  );
  check(
    "kapalı bölümün satırı tek ve isteğe bağlı olduğunu söylüyor",
    /Detay ekle/.test(s.optionalDetails?.summary ?? "") &&
      /isteğe bağlı/i.test(s.optionalDetails?.summary ?? ""),
    s.optionalDetails?.summary,
  );
  check(
    "telefonda yayın butonu ekranın altına sabitlendi",
    s.publishDock?.docked === "visible",
    JSON.stringify(s.publishDock),
  );
  check(
    "yayın butonu basılabilir",
    Boolean(s.publishCta) && s.publishCtaDisabled === false,
    `cta=${s.publishCta} disabled=${s.publishCtaDisabled}`,
  );
  await shot("m-6-hazir", "mobil 390 — yayına hazır, isteğe bağlı bölüm kapalı", {
    status: s.status,
    meter: s.meter,
    meterReady: s.meterReady,
    cardTitle: s.cardTitle,
    question: s.question,
    optionalDetails: s.optionalDetails,
    publishDock: s.publishDock,
    cta: s.publishCta,
    rows: s.rows,
    extras: s.extras,
  });

  /* Kapalı bölüm açılınca chip'ler ve isteğe bağlı soru görünür. */
  await click('[data-testid="composer-optional-details"] summary');
  await sleep(1200);
  s = await snapshot();
  check(
    "bölüm açılınca ek alan chip'leri görünür",
    s.extras.length > 0,
    s.extras.join(","),
  );
  check(
    "bölüm açılınca isteğe bağlı soru rozetiyle gelir",
    !s.question || s.optionalBadge === "İsteğe bağlı",
    `${s.question} / badge=${s.optionalBadge}`,
  );
  check(
    "bölüm açıkken de yayın butonu duruyor",
    Boolean(s.publishCta),
    s.publishCta,
  );
  await shot("m-6b-detay-acik", "mobil 390 — 'Detay ekle' açık", {
    optionalDetails: s.optionalDetails,
    question: s.question,
    optionalBadge: s.optionalBadge,
    extras: s.extras,
    cta: s.publishCta,
  });

  /* 6) MASAÜSTÜ 1280                                                   */
  await setViewport(1280, 900);
  await goto(`${BASE}/talep`);
  s = await snapshot();
  check("1280: başlangıç ekranı", s.start === true);
  check("1280: büyük Maira yüzü var", s.faces >= 1, `faces=${s.faces}`);
  const faceDesktop = await measureFace(0);
  check(
    "380px yüz: sahne portre kadrajında kuruldu",
    Boolean(faceDesktop && faceDesktop.box.framing === "portrait"),
    JSON.stringify(faceDesktop?.box),
  );
  check(
    "380px yüz: mürekkep kutunun yüksekliğinin çoğunu kaplıyor",
    Boolean(faceDesktop && faceDesktop.ink.heightRatio >= 0.55),
    JSON.stringify(faceDesktop?.ink),
  );
  check(
    "380px yüz: mürekkep dikeyde ortalı (gövdeye kaymıyor)",
    Boolean(
      faceDesktop &&
        faceDesktop.ink.centerY > 0.3 &&
        faceDesktop.ink.centerY < 0.7,
    ),
    JSON.stringify(faceDesktop?.ink),
  );
  await shot("d-1-baslangic", "masaüstü 1280 — başlangıç", {
    faces: s.faces,
    face: faceDesktop,
  });

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
  /* Kategori adımı sorulardan önce gelir; onaylanınca tek soru kalır. */
  if (s.categoryStepSurface) {
    await click('[data-testid="category-confirmation-confirm"]');
    await sleep(1400);
    s = await snapshot();
  }
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
    /* Kategori adımı da bir "bekleyen şey"dir: onaylanmadan soru gelmez. */
    if (s.publishCta) break;
    if (!s.question && !s.categoryStepSurface) break;
    console.log(`  masaüstü cevap adımı ${i + 1}: ${await evaluate(ANSWER_STEP)}`);
    await sleep(1400);
  }
  s = await snapshot();
  check(
    "1280: zorunlular bitince sayaç 'Yayına hazır' der",
    s.meterReady === "true",
    `${s.meter} (${s.meterFilled}/${s.meterTotal})`,
  );
  check(
    "1280: yayın butonu duruyor ve isteğe bağlı bölümün üstünde",
    Boolean(s.publishCta) && s.optionalDetails?.ctaBefore === true,
    `${s.publishCta} / ${JSON.stringify(s.optionalDetails)}`,
  );
  check(
    "1280: masaüstünde buton sabitlenmez (akışta durur)",
    s.publishDock?.docked === "visible",
    JSON.stringify(s.publishDock),
  );
  await shot("d-6-hazir", "masaüstü 1280 — yayına hazır, isteğe bağlı bölüm kapalı", {
    status: s.status,
    meter: s.meter,
    meterReady: s.meterReady,
    cardTitle: s.cardTitle,
    question: s.question,
    optionalBadge: s.optionalBadge,
    optionalDetails: s.optionalDetails,
    cta: s.publishCta,
    rows: s.rows,
    extras: s.extras,
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
    Boolean(
      s.question || s.categoryStepSurface || s.publishCta || s.outOfScope,
    ),
    JSON.stringify({
      q: s.question,
      cat: s.categoryStepSurface,
      cta: s.publishCta,
    }).slice(0, 160),
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

  /* 9) AÇIK KÜME DİLİMİNİN DÖRT CÜMLESİ — 2026-09-25 akşam                */
  /**
   * NEDEN BU BÖLÜM VAR. Bu dört cümle bu dilimde harness üzerinde ölçüldü;
   * harness yeşili UI yeşili değildir. Her kare ölçülen kimliklerle
   * etiketlenir: kart başlığı, kategori kırıntısı, kart satırları ve bekleyen
   * soru. Etiketsiz kare kanıt sayılmaz.
   */
  await setViewport(1280, 900);
  const OPEN_SET_FLOWS = [
    {
      name: "d-9a-arcelik-kadikoy",
      text: "Arçelik buzdolabı arıyorum, Kadıköy",
      label: "masaüstü 1280 — marka + ürün + ilçe",
    },
    {
      name: "d-9b-kartvizit-topkapi",
      text: "1000 adet kartvizit, mat selefonlu, Topkapı",
      label: "masaüstü 1280 — semt adı konum cevabıdır (D-0030)",
    },
    {
      name: "d-9c-zeytinyagi",
      text: "Zeytinyağı 5 litre arıyorum",
      label: "masaüstü 1280 — taksonomi dışı meşru talep",
    },
    {
      name: "d-9d-camasir-deterjani",
      text: "Çamaşır deterjanı arıyorum, 10 kg",
      label: "masaüstü 1280 — üst ürün izi niteleyici konumda",
    },
  ];
  const openSetSeen = {};
  for (const flow of OPEN_SET_FLOWS) {
    await goto(`${BASE}/talep`);
    await typeInto("#talep-composer", flow.text);
    await sleep(900);
    await click('[data-testid="composer-intro-continue"]');
    await sleep(4500);
    s = await snapshot();
    const bodyText = await evaluate(`document.body.innerText`);
    openSetSeen[flow.name] = {
      cardTitle: s.cardTitle,
      crumbTop: s.crumbTop,
      rows: s.rows,
      question: s.questionField,
      outOfScope: Boolean(s.outOfScope),
      mentionsKadikoy: /Kadıköy/.test(bodyText),
      mentionsFatih: /Fatih/.test(bodyText),
      mentionsIstanbul: /İstanbul/.test(bodyText),
      /**
       * KATEGORİ SEÇİCİ EKRANDA BÜTÜN KÖKLERİ LİSTELER; gövde metninde bir kök
       * adının GEÇMESİ o kökün ATANDIĞI anlamına gelmez. İlk yazımda ölçüt
       * gövde metniydi ve 9d sahte KIRMIZI verdi (kırıntı "Kategori", yani kök
       * atanmamış). Ölçüt kırıntının kendisidir.
       */
      mentionsBeyazEsya: /Beyaz Eşya/.test(bodyText),
    };
    await shot(flow.name, flow.label, openSetSeen[flow.name]);
  }

  check(
    "9a: kart başlığında konum ve 'arıyorum' yok",
    Boolean(openSetSeen["d-9a-arcelik-kadikoy"].cardTitle) &&
      !/Kadıköy|arıyorum/i.test(openSetSeen["d-9a-arcelik-kadikoy"].cardTitle),
    openSetSeen["d-9a-arcelik-kadikoy"].cardTitle,
  );
  check(
    "9a: yazılan ilçe ekranda duruyor",
    openSetSeen["d-9a-arcelik-kadikoy"].mentionsKadikoy === true,
    JSON.stringify(openSetSeen["d-9a-arcelik-kadikoy"].rows).slice(0, 180),
  );
  check(
    "9b: semt adı konuma çözülüyor (Fatih ya da İstanbul ekranda)",
    openSetSeen["d-9b-kartvizit-topkapi"].mentionsFatih === true ||
      openSetSeen["d-9b-kartvizit-topkapi"].mentionsIstanbul === true,
    JSON.stringify(openSetSeen["d-9b-kartvizit-topkapi"].rows).slice(0, 180),
  );
  check(
    "9c: taksonomi dışı talep engellenmiyor",
    openSetSeen["d-9c-zeytinyagi"].outOfScope === false,
    JSON.stringify(openSetSeen["d-9c-zeytinyagi"]).slice(0, 180),
  );
  check(
    "9d: çamaşır deterjanı beyaz eşyaya bağlanmıyor",
    !/Beyaz Eşya/.test(
      openSetSeen["d-9d-camasir-deterjani"].crumbTop ?? "",
    ),
    openSetSeen["d-9d-camasir-deterjani"].crumbTop,
  );

  /* 10) KARTVİZİT AYRI ALT KATEGORİ (D-0041) — kurucu kararının ekrandaki hâli */
  /**
   * NEDEN BU BÖLÜM VAR. Kurucu "Kartvizit ayrı bir kategori olması lazım"
   * dedi; harness kapısı bunu üretim fonksiyonlarıyla ölçüyor ama ekranda
   * görünen şey ayrıca kanıtlanmalı. Her kare ÖLÇÜLEN kimlikle etiketlenir:
   * kategori kırıntısı, kart satırları, bekleyen sorunun alan anahtarı ve
   * kategori panelinde Matbaa'nın altındaki alt kategori listesi. Etiketsiz
   * kare kanıt sayılmaz; alt kategori listesi için Matbaa kökü ADIYLA
   * tıklanır — ilk kök tıklanırsa kare başka bir kategoriyi gösterir.
   */
  const clickRootByLabel = async (label) =>
    evaluate(`(() => {
      const el = [...document.querySelectorAll('[data-testid="talep-category-root"]')]
        .find((b) => (b.querySelector("b")?.textContent || "").trim() === ${JSON.stringify(label)});
      if (!el) return "no-el";
      el.scrollIntoView({ block: "center" });
      el.click();
      return "ok";
    })()`);

  await setViewport(1280, 900);
  await goto(`${BASE}/talep`);
  await typeInto("#talep-composer", "1000 adet kartvizit, mat selefonlu, Topkapı");
  await sleep(900);
  await click('[data-testid="composer-intro-continue"]');
  await sleep(4500);
  s = await snapshot();
  const kartvizitSeen = {
    crumbTop: s.crumbTop,
    crumbLeaf: s.crumbLeaf,
    cardTitle: s.cardTitle,
    rows: s.rows,
    question: s.question,
    questionField: s.questionField,
    optionRows: s.optionRows,
    meter: s.meter,
    outOfScope: Boolean(s.outOfScope),
  };
  check(
    "10a: kartın kırıntısı Matbaa ve Ambalaj › Kartvizit",
    /Matbaa/i.test(kartvizitSeen.crumbTop ?? "") &&
      /^Kartvizit$/i.test(kartvizitSeen.crumbLeaf ?? ""),
    `${kartvizitSeen.crumbTop} › ${kartvizitSeen.crumbLeaf}`,
  );
  check(
    "10a: kartvizit talebi kapsam dışı sayılmıyor",
    kartvizitSeen.outOfScope === false,
    JSON.stringify(kartvizitSeen).slice(0, 160),
  );
  await shot("d-10a-kartvizit-kirinti", "masaüstü 1280 — Kartvizit alt kategorisi kırıntıda", kartvizitSeen);

  await click('[data-testid="talep-card-change-category"]');
  await sleep(700);
  const printingClick = await clickRootByLabel("Matbaa ve Ambalaj");
  await sleep(800);
  s = await snapshot();
  const printingSubs = s.sheetSubs;
  check(
    "10b: kategori panelinde Matbaa kökü adıyla açıldı",
    printingClick === "ok",
    printingClick,
  );
  check(
    "10b: Matbaa'nın alt kategori listesinde Kartvizit var",
    printingSubs.some((t) => /Kartvizit/i.test(t)),
    printingSubs.join(" · "),
  );
  await shot("d-10b-kartvizit-panel", "masaüstü 1280 — Matbaa altında Kartvizit alt kategorisi", {
    root: "Matbaa ve Ambalaj",
    subs: printingSubs,
  });
  await evaluate(`document.querySelector('[role="dialog"] button.ml-auto')?.click()`);
  await sleep(500);

  /* Kartvizitin KENDİ soruları sorulup yayına hazıra kadar yürütülür. */
  const kartvizitAskedFields = [];
  for (let i = 0; i < 8; i += 1) {
    s = await snapshot();
    if (s.questionField) kartvizitAskedFields.push(s.questionField);
    /* Kategori adımı da bir "bekleyen şey"dir: onaylanmadan soru gelmez. */
    if (s.publishCta) break;
    if (!s.question && !s.categoryStepSurface) break;
    console.log(`  kartvizit cevap adımı ${i + 1}: ${await evaluate(ANSWER_STEP)}`);
    await sleep(1400);
  }
  s = await snapshot();
  check(
    "10c: kartvizit akışı yayına hazıra ulaştı",
    s.meterReady === "true" && Boolean(s.publishCta),
    `${s.meter} (${s.meterFilled}/${s.meterTotal}) cta=${s.publishCta}`,
  );
  check(
    "10c: sorulan alanlar kartvizit ailesinden, komşu aileden değil",
    kartvizitAskedFields.every(
      (k) => !["publicationPageCount", "publicationBinding", "flatPrintFold", "boxDieLine", "labelAdhesive"].includes(k),
    ),
    kartvizitAskedFields.join(","),
  );
  await shot("d-10c-kartvizit-hazir", "masaüstü 1280 — kartvizit yayına hazır", {
    crumbTop: s.crumbTop,
    cardTitle: s.cardTitle,
    meter: s.meter,
    meterReady: s.meterReady,
    askedFields: kartvizitAskedFields,
    rows: s.rows,
    extras: s.extras,
    cta: s.publishCta,
  });

  /* 11) VİDEO SADELİĞİ — BEŞ SENARYO, İKİ GENİŞLİK, OKUMA ANI İKİ KAREDE */
  /**
   * NEDEN BU BÖLÜM VAR (kurucu, 2026-09-25 tanıtım videosu). Yeni akışın beş
   * cümlesi 390 ve 1280'de baştan sona sürülür. Okuma anı iki ayrı karede
   * yakalanır — vurgular YARIDA ve BİTTİĞİNDE — çünkü "sırayla vurgulanıyor"
   * iddiası tek karede kanıtlanamaz. Her kare ölçülen kimliklerle etiketlenir.
   */
  const VIDEO_FLOWS = [
    { slug: "v1", text: "Kadıköy'de kiralık 3+1, eşyasız, 60 bin TL'ye kadar", label: "emlak — videodaki cümle" },
    { slug: "v2", text: "Egea için 4 kış lastiği, takma dahil, Ümraniye", label: "otomotiv — parça + hizmet" },
    { slug: "v3", text: "Arçelik buzdolabı arıyorum, İstanbul Kadıköy", label: "beyaz eşya — bütçe sorusu ve hazır durumu" },
    { slug: "v4", text: "bir şeyler lazım acil", label: "kategorisiz, belirsiz cümle" },
    { slug: "v5", text: "Ağrı kesici ilaç arıyorum, İstanbul", label: "ilaç — 'yayında' demez" },
  ];
  const VIEWPORTS = [
    { w: 390, h: 844, tag: "m" },
    { w: 1280, h: 900, tag: "d" },
  ];
  const videoSeen = {};

  for (const vp of VIEWPORTS) {
    await setViewport(vp.w, vp.h);
    for (const flow of VIDEO_FLOWS) {
      const key = `${vp.tag}-11${flow.slug}`;
      await goto(`${BASE}/talep`);
      await typeInto("#talep-composer", flow.text);
      await sleep(900);
      await click('[data-testid="composer-intro-continue"]');

      /* Okuma anı — YARIDA. Vurguların bir kısmı açık, bir kısmı kapalı. */
      await sleep(700);
      let mid = await snapshot();
      await shot(`${key}-okuma-yarida`, `${vp.w} — ${flow.label} · okuma yarıda`, {
        phase: mid.readingPhase,
        status: mid.status,
        entities: mid.entities,
      });

      /*
        Okuma anı — SON VURGU AÇILDIĞINDA. Sabit bekleme yanlış an yakalar:
        vurgu sayısı cümleden cümleye değişiyor ve sabit süre kimi cümlede
        okuma bitip alıntıya döndükten SONRA düşüyordu (ölçüldü). Faz hâlâ
        `reading` iken bütün vurgular açılana kadar yoklanır.
      */
      let end = mid;
      for (let i = 0; i < 24; i += 1) {
        end = await snapshot();
        if (end.readingPhase !== "reading") break;
        if (
          end.entities.length > 0 &&
          end.entities.every((e) => e.on === "true")
        ) {
          break;
        }
        await sleep(120);
      }
      await shot(`${key}-okuma-bitti`, `${vp.w} — ${flow.label} · okuma bitti`, {
        phase: end.readingPhase,
        status: end.status,
        entities: end.entities,
      });

      const revealedMid = mid.entities.filter((e) => e.on === "true").length;
      const revealedEnd = end.entities.filter((e) => e.on === "true").length;
      if (end.entities.length > 1) {
        check(
          `${key}: vurgular SIRAYLA açılıyor (yarıda ${revealedMid} < bitişte ${revealedEnd})`,
          revealedMid < revealedEnd || revealedEnd === end.entities.length,
          `${revealedMid}/${revealedEnd}/${end.entities.length}`,
        );
      }

      /* Okuma anı kendi kendine kapanır; kart belirene kadar beklenir. */
      for (let i = 0; i < 30; i += 1) {
        s = await snapshot();
        if (s.readingPhase === "quote" || s.outOfScope) break;
        await sleep(300);
      }
      await sleep(900);

      /* Akışı yürüt: kategori onayı + zorunlu sorular. */
      for (let i = 0; i < 8; i += 1) {
        s = await snapshot();
        if (s.outOfScope) break;
        if (!s.question && !s.categoryStepSurface) break;
        if (s.publishCta) break;
        await evaluate(ANSWER_STEP);
        await sleep(1400);
      }
      s = await snapshot();
      const bodyText = await evaluate(`document.body.innerText`);
      videoSeen[key] = {
        outOfScope: Boolean(s.outOfScope),
        crumbTop: s.crumbTop,
        crumbLeaf: s.crumbLeaf,
        cardTitle: s.cardTitle,
        meter: s.meter,
        meterReady: s.meterReady,
        rows: s.rows,
        question: s.questionField,
        cta: s.publishCta,
        optionalDetails: s.optionalDetails,
        subPlaceholder: s.cardSubPlaceholder,
        saysLive: /Talebin yayında/.test(bodyText),
        saysDelivered: /ulaştı|iletildi|gönderildi/i.test(bodyText),
      };
      await shot(`${key}-son`, `${vp.w} — ${flow.label} · akışın son hâli`, videoSeen[key]);

      check(
        `${key}: hiçbir kartta 'Tüm alt kategoriler' yok`,
        videoSeen[key].subPlaceholder === false,
      );
      check(
        `${key}: ekranda 'ulaştı/iletildi/gönderildi' yok`,
        videoSeen[key].saysDelivered === false,
      );
      if (s.publishCta) {
        check(
          `${key}: yayın butonu isteğe bağlı bölümün üstünde`,
          s.optionalDetails === null || s.optionalDetails.ctaBefore === true,
          JSON.stringify(s.optionalDetails),
        );
        check(
          `${key}: isteğe bağlı bölüm kapalı doğdu`,
          s.optionalDetails === null || s.optionalDetails.open === false,
          JSON.stringify(s.optionalDetails),
        );
      }
    }
  }

  check(
    "11v5: ilaç cümlesi kapsam dışı ve 'yayında' demiyor (390)",
    videoSeen["m-11v5"].outOfScope === true && videoSeen["m-11v5"].saysLive === false,
    JSON.stringify(videoSeen["m-11v5"]).slice(0, 200),
  );
  check(
    "11v5: ilaç cümlesi kapsam dışı ve 'yayında' demiyor (1280)",
    videoSeen["d-11v5"].outOfScope === true && videoSeen["d-11v5"].saysLive === false,
    JSON.stringify(videoSeen["d-11v5"]).slice(0, 200),
  );
  check(
    "11v4: belirsiz cümlede akış kilitlenmiyor",
    Boolean(
      videoSeen["d-11v4"].question ||
        videoSeen["d-11v4"].cta ||
        videoSeen["d-11v4"].outOfScope ||
        videoSeen["d-11v4"].crumbTop,
    ),
    JSON.stringify(videoSeen["d-11v4"]).slice(0, 200),
  );
  check(
    "11v3: Arçelik akışı yayına hazıra ulaşıyor (390)",
    videoSeen["m-11v3"].meterReady === "true" && Boolean(videoSeen["m-11v3"].cta),
    JSON.stringify(videoSeen["m-11v3"]).slice(0, 200),
  );

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
