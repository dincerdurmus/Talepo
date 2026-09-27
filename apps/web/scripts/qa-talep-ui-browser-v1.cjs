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
 * Adres ilk argümandan da verilebilir: `node scripts/qa-talep-ui-browser-v1.cjs
 * http://localhost:3271` — Windows kabuğunda ortam değişkeni ön eki
 * kullanılamadığı için eklendi.
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
const { decodePng, inkBounds, cropImage } = require("./lib/qa-png-v1.cjs");

const BASE =
  process.argv[2] || process.env.TALEP_QA_URL || "http://localhost:3211";
/* Her turun kareleri kendi klasörüne yazılır; öncekiler ezilmez. */
const OUT = process.env.TALEP_QA_OUT ||
  "C:\\Users\\HP\\Documents\\Veyra\\projects\\talepo\\tasarim\\talep-ui-2026-09-25\\sonuc8";

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

  /** Son uygulanan görüntü alanı — kare alırken geçici olarak uzatılır. */
  let viewport = { width: 390, height: 844 };
  const setViewport = (width, height = 900) => {
    viewport = { width, height };
    return browser.send(
      "Emulation.setDeviceMetricsOverride",
      { width, height, deviceScaleFactor: 2, mobile: width < 768 },
      S,
    );
  };

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
  /** Son gezinmenin başladığı an — yüz ölçümü buradan sayılır. */
  let lastNavAt = 0;
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
    lastNavAt = Date.now();
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
    const png = decodePng(Buffer.from(data, "base64"));
    const ink = inkBounds(png);
    /*
      İKİ EŞİK, TEK KADRAJ (2026-09-26). Telefonda sahne kurucunun koyduğu
      KALİTE kapısı gereği `maxPixelRatio: 1` ile çizilir; kontur çizgilerinin
      soluk uçları 34 eşiğini geçmez ve kadraj olduğundan kısa ölçülür. Aynı
      kare 12 eşiğiyle masaüstüyle aynı oranı verir — yani fark kadrajda
      değil, piksel oranında. Sert eşik raporlanmaya devam eder; kadraj kapısı
      yumuşak eşikten okunur.
    */
    const inkSoft = inkBounds(png, 12);
    return { box, ink, inkSoft };
  };

  /**
   * BAŞLANGIÇ HİZASI — GERÇEK GEOMETRİDEN (D-0046, 2026-09-26).
   *
   * Kurucu kararı: telefonda başlangıç ekranı videodaki gibi ORTALI, masaüstü
   * DEĞİŞMEZ. Sınıf adına bakmak yetmez (`text-center` bir üst kapsayıcı
   * tarafından ezilebilir); burada elemanların ekrandaki gerçek kutuları
   * okunur.
   *
   * BAŞLIK KUTUSU DEĞİL METNİ ÖLÇÜLÜR. `<h1>` blok elemandır: kutusu sola da
   * ortaya da hizalansa hep tam genişliktir. Hizayı yalnız RENDER EDİLEN METİN
   * gösterir, bu yüzden metin aralığının (Range) kutusu alınır.
   */
  const measureStartAlignment = async () =>
    evaluate(`(() => {
      const kutu = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width < 1) return null;
        return { x: r.x, w: r.width, merkez: r.x + r.width / 2 };
      };
      const metinKutusu = (el) => {
        if (!el) return null;
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        range.detach?.();
        if (r.width < 1) return null;
        return { x: r.x, w: r.width, merkez: r.x + r.width / 2 };
      };
      /*
        SARMALAYICI DEĞİL YÜZÜN KENDİSİ ÖLÇÜLÜR. Dış ızgara hücresi tam
        genişliktir; onun merkezi her hâlükârda içerik merkezidir ve kapı
        önemsiz biçimde yeşil kalırdı (ölçüldü: w=350, sapma=0 — hiza yanlışken
        bile). Kapı, 240px'lik gerçek yüz kutusunu okur.
      */
      const yuzler = [...document.querySelectorAll('[data-testid="talep-start-maira"]')]
        .filter((el) => el.getBoundingClientRect().width > 4);
      const sarmal = yuzler[0] ?? null;
      const yuz = sarmal?.querySelector('[data-testid="maira-face"]') ?? null;
      const h1 = document.querySelector('[data-testid="talep-start-title"]');
      return {
        gorunum: window.innerWidth,
        gorunumMerkezi: window.innerWidth / 2,
        yuzSayisi: yuzler.length,
        yuz: kutu(yuz),
        yuzHizaProp: sarmal?.dataset.align ?? null,
        /*
          GÖRÜNEN ETİKET ÖLÇÜLÜR. Masaüstünde telefon markı (lg:hidden) hâlâ
          DOM'dadır ve belgedeki İLK talep-start-maira-mark odur; belge geneli
          bir querySelector orada genişliği sıfır olan gizli etiketi okuyup
          ölçümü boş bırakıyordu. Etiket, görünen yüzün kendi sarmalayıcısından
          alınır. (Bu blok bir şablon dizesinin İÇİNDEDİR: ters tırnak yazılmaz,
          dizeyi kapatır ve dosya derlenmez.)
        */
        maira: kutu(sarmal?.querySelector('[data-testid="talep-start-maira-mark"]')),
        baslikKutusu: kutu(h1),
        baslikMetni: metinKutusu(h1),
        baslikHizasi: h1 ? getComputedStyle(h1).textAlign : null,
        kutu: kutu(document.querySelector("#talep-composer")?.closest("form")),
      };
    })()`);

  /**
   * YÜZ İLK EKRANDA GÖRÜNÜR — SABİT BEKLEME İLE KANITLANMAZ (2026-09-26).
   *
   * Önceki turda başlangıç karesi (`sonuc4/m-1-baslangic.png`) yüz yerine
   * halka yer tutucusunu gösteriyordu: kare, sahne tam opaklığa ulaşmadan
   * çekiliyordu. Artık sahnenin gerçekten çizdiği (dataset.framing) ve tam
   * opak olduğu YOKLANIR; geçen süre kareye etiket olarak yazılır.
   */
  const waitForFace = async (budgetMs = 6000) => {
    let last = null;
    for (;;) {
      last = await evaluate(`(() => {
        const c = document.querySelector('[data-testid="maira-contour-canvas"]');
        if (!c) return { canvas: false };
        return {
          canvas: true,
          framing: c.dataset.framing || null,
          opacity: Number(getComputedStyle(c).opacity),
          ringOpacity: Number(
            getComputedStyle(document.querySelector('[data-testid="maira-face"] svg')).opacity,
          ),
        };
      })()`);
      const elapsed = Date.now() - lastNavAt;
      if (last?.canvas && last.framing && last.opacity >= 0.99) {
        return { ...last, ms: elapsed, drawn: true };
      }
      if (elapsed > budgetMs) return { ...last, ms: elapsed, drawn: false };
      await sleep(80);
    }
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
    /**
     * WEBGL YÜZÜ TAM SAYFA KARESİNDE KAYBOLUYORDU (ölçüldü, 2026-09-26).
     *
     * `captureBeyondViewport` sayfayı kare için yeniden boyutlandırır ve
     * WebGL çizim tamponu sıfırlanır; sahne bir sonraki kareyi çizmeden
     * görüntü alındığı için Maira'nın yüzü boş bir ışık lekesi olarak
     * kaydediliyordu (kırpılmış ölçümde mürekkep VARDI — yani kusur üründe
     * değil, kanıt aracındaydı). Artık görüntü alanı sayfa yüksekliğine
     * gerçekten uzatılır, sahnenin yeniden çizmesi beklenir, kare normal
     * yoldan alınır ve görüntü alanı geri konur.
     *
     * SABİT BEKLEME YETMEDİ (2026-09-26, ikinci kez ölçüldü). 450 ms'lik
     * bekleme bir koşuda yetti, sonraki koşuda yetmedi: `sonuc6`'nın ilk
     * `m-1-baslangic.png` karesinde yüz yine boş bir ışık lekesiydi — üstelik
     * ölçüm kapıları yeşildi, çünkü onlar kareden ÖNCE ölçüyor. Kanıt artık
     * KENDİ KARESİNDEN doğrulanır: kaydedilecek karede yüzün bölgesindeki
     * mürekkep sayılır, boşsa sahneye yeniden çizdirilip kare yeniden alınır.
     */
    const pageHeight = await evaluate(
      `Math.min(Math.ceil(document.documentElement.scrollHeight), 12000)`,
    );
    await browser.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width: viewport.width,
        height: pageHeight,
        deviceScaleFactor: 2,
        mobile: viewport.width < 768,
      },
      S,
    );
    await sleep(450);

    /** Yüzün SAYFA koordinatındaki kutusu; yoksa null (yüzsüz ekranlar). */
    const faceRect = await evaluate(`(() => {
      const el = [...document.querySelectorAll('[data-testid="maira-face"]')]
        .filter((e) => e.getBoundingClientRect().width > 40)[0];
      if (!el) return null;
      if (!el.querySelector('[data-testid="maira-contour-canvas"]')) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.x + window.scrollX,
        y: r.y + window.scrollY,
        w: r.width,
        h: r.height,
      };
    })()`);

    /** Sahneye yeniden çizdirir: resize olayı + birkaç kare bekle. */
    const yenidenCizdir = async () => {
      await evaluate(`(async () => {
        window.dispatchEvent(new Event("resize"));
        for (let i = 0; i < 6; i += 1) {
          await new Promise((r) => requestAnimationFrame(() => r()));
        }
        return "ok";
      })()`);
      await sleep(500);
    };

    let data = null;
    let yuzMurekkebi = null;
    for (let deneme = 1; deneme <= 4; deneme += 1) {
      ({ data } = await browser.send(
        "Page.captureScreenshot",
        { format: "png" },
        S,
      ));
      if (!faceRect) break;
      const png = decodePng(Buffer.from(data, "base64"));
      /* Kare 2x çekilir; kutu CSS pikselindedir. */
      const parca = cropImage(
        png,
        faceRect.x * 2,
        faceRect.y * 2,
        faceRect.w * 2,
        faceRect.h * 2,
      );
      /*
        SERT EŞİK ŞART (ölçüldü, 2026-09-26). Yumuşak eşik (12) arkadaki IŞIK
        ALANINI da mürekkep sayıyor: yüzün hiç çizilmediği karede bile 0.453
        veriyordu ve kapı sahte yeşil kalıyordu. Aynı iki kare eşik 45'te
        birbirinden ayrılıyor — çizili yüz 0.370, yalnız ışık lekesi 0.079.
        Sınır ikisinin ortasındadır.
      */
      const olcum = parca ? inkBounds(parca, 45) : null;
      yuzMurekkebi = olcum
        ? { coverage: olcum.coverage, empty: olcum.empty, esik: 45, deneme }
        : { coverage: null, empty: true, esik: 45, deneme };
      if (!yuzMurekkebi.empty && yuzMurekkebi.coverage >= 0.2) break;
      if (deneme === 4) break;
      await yenidenCizdir();
    }
    if (faceRect) {
      check(
        `kaydedilen karede Maira'nın yüzü GÖRÜNÜYOR (${name})`,
        Boolean(yuzMurekkebi && !yuzMurekkebi.empty && yuzMurekkebi.coverage >= 0.2),
        JSON.stringify(yuzMurekkebi),
      );
    }
    await browser.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 2,
        mobile: viewport.width < 768,
      },
      S,
    );
    const file = path.join(OUT, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    shots.push({
      file: `${name}.png`,
      label,
      /* Kare kendi kanıtını taşır: bu karede yüzün mürekkebi ölçüldü mü. */
      measured: yuzMurekkebi ? { ...measured, yuzMurekkebi } : measured,
    });
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
          if (!d) return null;
          return {
            docked: d.dataset.docked,
            position: getComputedStyle(d).position,
          };
        })(),
        /*
          SIRA GERÇEK GEOMETRİDEN ÖLÇÜLÜR (2026-09-26). DOM sırası doğruyken
          bile telefonda kenetlenmiş (position: fixed) buton akıştan çıkıp
          sorunun ÜSTÜNE oturuyordu; bu yüzden ekrandaki konum ölçülür.
        */
        categoryAboveCta: (() => {
          const cat = q('[data-testid="category-confirmation-card"]');
          const cta = q('[data-testid="composer-review-cta"]');
          if (!cat || !cta) return null;
          const a = cat.getBoundingClientRect();
          const b = cta.getBoundingClientRect();
          const dock = q('[data-testid="composer-publish-dock"]');
          return {
            catTop: Math.round(a.top),
            ctaTop: Math.round(b.top),
            ok: a.top < b.top,
            dockPosition: dock ? getComputedStyle(dock).position : null,
          };
        })(),
        cardSubPlaceholder: /Tüm alt kategoriler/.test(
          q('[data-testid="talep-request-card"]')?.innerText ?? "",
        ),
        cardRowHint:
          q('[data-testid="talep-card-row-hint"]')?.textContent?.trim() ?? null,
        /*
          D-0047 — CEVAPLANAN ADIM KAPANIR, GERİ DÖNÜŞÜ KALIR. Üç şey ölçülür:
          kapanan blok GÖRÜNÜR mü (yalnız "DOM'da yok" yetmez: soluk ama duran
          bir kopya da kapanmış sayılmaz), odak nereye gitti, kapanış ekran
          okuyucuya ne dedi.
        */
        soruBlokGorunur: (() => {
          const el = q('[data-testid="composer-questions"]');
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && Number(cs.opacity) > 0.01;
        })(),
        kategoriBlokGorunur: (() => {
          const el = q('[data-testid="category-confirmation-card"]');
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && Number(cs.opacity) > 0.01;
        })(),
        softExit: [...document.querySelectorAll('[data-testid="talep-soft-exit"]')].map(
          (e) => e.dataset.softExit,
        ),
        odak: (() => {
          const a = document.activeElement;
          if (!a || a === document.body) return null;
          return {
            etiket: a.tagName.toLowerCase(),
            id: a.id || null,
            testid: a.getAttribute("data-testid"),
            rowKey: a.getAttribute("data-row-key"),
            trailKey: a.getAttribute("data-trail-key"),
            /*
              SIRA ÖNEMLİ (D-0048). Adım bloğu artık izin İÇİNDE de açılabilir;
              en İÇ yüzey kazanır, yoksa izde açılan kategori bloğundaki odak
              "iz" diye okunur ve D-0047'nin kapıları sahte kırmızı verir.
            */
            blok: a.closest('[data-testid="talep-request-card"]')
              ? "kart"
              : a.closest('[data-testid="composer-questions"]')
                ? "soruBlok"
                : a.closest('[data-testid="category-confirmation-card"]')
                  ? "kategoriBlok"
                  : a.closest('[data-testid="talep-step-trail"]')
                    ? "iz"
                    : "diger",
          };
        })(),
        /*
          D-0048 — KATLANAN İZ. İzin kendisi, sayısı, "+N adım"ın N'i, açık izin
          anahtarı ve izin GERÇEKTEN tek satır olup olmadığı ölçülür. Tek satır
          iddiası punto/satır yüksekliği ile doğrulanır: iki satıra taşan bir iz
          "katlanmış" sayılmaz.
        */
        iz: (() => {
          const ol = q('[data-testid="talep-step-trail"]');
          if (!ol) return null;
          const list = [...ol.querySelectorAll('[data-testid="talep-trail-entry"]')];
          const more = ol.querySelector('[data-testid="talep-trail-more"]');
          const open = ol.querySelector('[data-testid="talep-trail-open"]');
          const kutu = ol.getBoundingClientRect();
          return {
            toplam: Number(ol.dataset.trailCount),
            gorunen: Number(ol.dataset.trailVisible),
            toplanan: Number(ol.dataset.trailFolded),
            acikAnahtar: ol.dataset.trailOpen || null,
            yukseklik: Math.round(kutu.height),
            more: more
              ? {
                  metin: more.textContent.trim(),
                  ariaExpanded: more.getAttribute("aria-expanded"),
                }
              : null,
            /* Açık blok, AÇIK İZİN kendi satırının içinde mi? */
            acikIzinIcinde: open
              ? Boolean(
                  open.closest("li")?.querySelector(
                    '[data-testid="talep-trail-entry"][aria-expanded="true"]',
                  ),
                )
              : null,
            izler: list.map((b) => {
              const r = b.getBoundingClientRect();
              const cs = getComputedStyle(b);
              return {
                anahtar: b.dataset.trailKey,
                tur: b.dataset.trailKind,
                metin: b.textContent.trim(),
                ariaLabel: b.getAttribute("aria-label"),
                ariaExpanded: b.getAttribute("aria-expanded"),
                solgun: b.dataset.trailDimmed,
                opaklik: Number(cs.opacity),
                yukseklik: Math.round(r.height),
                punto: cs.fontSize,
                /* İzin GÖVDESİNİN puntosu — düğmenin miras aldığı değil. */
                govdePunto: (() => {
                  const kat = b.querySelector("[data-trail-fold]");
                  const deger = kat?.lastElementChild;
                  return deger ? getComputedStyle(deger).fontSize : cs.fontSize;
                })(),
                /* Tek satır: düğmenin yüksekliği iki satır metni almıyor. */
                tekSatir: r.height <= 44,
              };
            }),
          };
        })(),
        geriGezinmeYuzeyi: (() => {
          const govde = q('[data-testid="talep-step-trail"]')?.parentElement;
          if (!govde) return null;
          return {
            tablist: govde.querySelectorAll('[role="tablist"],[role="tab"]').length,
            ariaStep: govde.querySelectorAll('[aria-current="step"]').length,
            geriMetni: /(^|\s)Geri(\s|$)|Geri dön/.test(govde.innerText),
          };
        })(),
        kapanisDuyurusu:
          q('[data-testid="talep-step-closed-notice"]')?.textContent?.trim() || null,
        degistirAriaExpanded:
          q('[data-testid="talep-card-change-category"]')?.getAttribute(
            "aria-expanded",
          ) ?? null,
        analizKapaliAgirlik: (() => {
          const d = q('[data-testid="talep-analysis-details"]');
          if (!d) return null;
          const su = q('[data-testid="talep-analysis-summary"]');
          const cs = getComputedStyle(d);
          return {
            open: d.dataset.open,
            cerceve: cs.borderTopWidth,
            zemin: cs.backgroundColor,
            punto: su ? getComputedStyle(su).fontSize : null,
          };
        })(),
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
  /*
    TELEFON HİZASI (D-0046). Referans `ref-1.png` ölçüldü: yüz %50.8, MAIRA
    %49.7, başlık %50.0. Eski ürün karesi (sonuc5/m-1) %33.3 / %8.0 / %34.6
    veriyordu. Tolerans ±%2 — yüzün mürekkebi kutusunun içinde birkaç piksel
    kaçık olabilir, karar kutunun hizasıdır.
  */
  const hizaMobil = await measureStartAlignment();
  {
    const sapma = (el) =>
      el ? Math.abs(el.merkez - hizaMobil.gorunumMerkezi) / hizaMobil.gorunum : null;
    const TOL = 0.02;
    check(
      "390: yazma kutusu yatayda ortalı",
      sapma(hizaMobil.kutu) !== null && sapma(hizaMobil.kutu) <= TOL,
      JSON.stringify({ kutu: hizaMobil.kutu, sapma: sapma(hizaMobil.kutu) }),
    );
    check(
      "390: Maira'nın yüzü yatayda ortalı (videodaki ilk an)",
      sapma(hizaMobil.yuz) !== null && sapma(hizaMobil.yuz) <= TOL,
      JSON.stringify({ yuz: hizaMobil.yuz, sapma: sapma(hizaMobil.yuz) }),
    );
    check(
      "390: MAIRA etiketi yatayda ortalı",
      sapma(hizaMobil.maira) !== null && sapma(hizaMobil.maira) <= TOL,
      JSON.stringify({ maira: hizaMobil.maira, sapma: sapma(hizaMobil.maira) }),
    );
    check(
      "390: 'Tek cümle yaz.' başlığının METNİ ortalı",
      sapma(hizaMobil.baslikMetni) !== null && sapma(hizaMobil.baslikMetni) <= TOL,
      JSON.stringify({
        metin: hizaMobil.baslikMetni,
        kutu: hizaMobil.baslikKutusu,
        hiza: hizaMobil.baslikHizasi,
        sapma: sapma(hizaMobil.baslikMetni),
      }),
    );
    /*
      BAŞLIK PUNTOSU VİDEODAKİ İLE AYNI ÖLÇEKTE. Ölçek-bağımsız ölçüt:
      "Tek cümle yaz." metninin genişliği ÷ görünüm genişliği. ref-1'de
      668/1080 = %61.9. Kapı bu bandı korur; başlık küçültülürse kırmızı olur.
    */
    const oran = hizaMobil.baslikMetni
      ? hizaMobil.baslikMetni.w / hizaMobil.gorunum
      : null;
    check(
      "390: başlık puntosu videodaki ölçekte (metin genişliği %55–%70)",
      oran !== null && oran >= 0.55 && oran <= 0.7,
      JSON.stringify({ oran, ref: 0.619 }),
    );
  }
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
  /*
    ÖNCE YÜZÜN ÇİZİLDİĞİ KANITLANIR, SONRA ÖLÇÜLÜR (2026-09-26). Eski sıra
    sahne tam opaklığa ulaşmadan ölçüyordu: kadraj kapıları aslında HALKA YER
    TUTUCUSUNU ölçüp yeşil veriyordu (`sonuc4/m-1-baslangic.png` yüzü hiç
    göstermiyor ama kapılar geçmişti). Ölçüm artık gerçekten yüzü ölçer.
  */
  const faceTiming = await waitForFace();
  check(
    "390: Maira'nın yüzü başlangıç ekranında ÇİZİLMİŞ (halka yer tutucusu değil)",
    faceTiming.drawn === true && faceTiming.ringOpacity < 0.1,
    JSON.stringify(faceTiming),
  );
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
    Boolean(faceMobile && faceMobile.inkSoft.heightRatio >= 0.55),
    JSON.stringify({ sert: faceMobile?.ink, yumusak: faceMobile?.inkSoft }),
  );
  check(
    "240px yüz: mürekkep dikeyde ortalı (gövdeye kaymıyor)",
    Boolean(
      faceMobile &&
        faceMobile.inkSoft.centerY > 0.3 &&
        faceMobile.inkSoft.centerY < 0.7,
    ),
    JSON.stringify(faceMobile?.inkSoft),
  );
  /*
    İKİ ÖLÇEK AYNI KADRAJI VERİR — kapı bunu ayrıca ölçer, böylece "telefonda
    farklı bir kadraj var" iddiası sessizce doğru olamaz.
  */
  await shot("m-1-baslangic", "mobil 390 — başlangıç", {
    start: s.start,
    categories: cats.length,
    faces: s.faces,
    face: faceMobile,
    /* Kare kendi kanıtını taşır: hangi hizayı gösterdiği ölçülmüş hâliyle. */
    hiza: hizaMobil,
    /* Kare kendi kanıtını taşır: yüz kaç ms'de tam göründü. */
    faceFirstPaintMs: faceTiming.ms,
    faceDrawn: faceTiming.drawn,
    ringOpacity: faceTiming.ringOpacity,
  });

  /* 2) OKUMA ANI — Arçelik buzdolabı                                   */
  await typeInto("#talep-composer", "Arçelik buzdolabı arıyorum, İstanbul Kadıköy");
  await sleep(900);
  const detected = await evaluate(
    `[...document.querySelectorAll('[data-testid="talep-start-detected"] span.inline-flex')].map(e=>e.textContent.trim())`,
  );
  check("yazarken anlaşılan etiketler beliriyor", detected.length > 0, detected.join(" | "));
  /*
    YAZARKEN DE ORTALI KALIR. Kutu büyüdükçe hizanın kaymadığı ölçülür; bu kare
    kendi hiza ölçümünü taşır, yoksa karşılaştırma tuvalinde "ölçüm yok" yazar.
  */
  const hizaYazarken = await measureStartAlignment();
  check(
    "390: yazarken de yüz ve başlık ortalı kalır",
    hizaYazarken.yuz != null &&
      hizaYazarken.baslikMetni != null &&
      Math.abs(hizaYazarken.yuz.merkez - hizaYazarken.gorunumMerkezi) <= 8 &&
      Math.abs(hizaYazarken.baslikMetni.merkez - hizaYazarken.gorunumMerkezi) <= 8,
    JSON.stringify({ yuz: hizaYazarken.yuz, baslik: hizaYazarken.baslikMetni }),
  );
  await shot("m-1b-yazarken", "mobil 390 — yazarken anlaşılanlar", {
    detected,
    hiza: hizaYazarken,
  });

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
      degistirAriaExpanded: s.degistirAriaExpanded,
    });
    check(
      "D-0047: adım açıkken 'Değiştir' aria-expanded=true",
      s.degistirAriaExpanded === "true",
      s.degistirAriaExpanded,
    );
    /*
      D-0048 — CÜMLE GÖNDERİLDİ, TEK İZ VAR. Kategori henüz AKTİF ADIM olduğu
      için iz değildir; ekranda yalnız kullanıcının kendi cümlesi iz olarak
      durur ve o iz tek satırdır.
    */
    check(
      "D-0048: cümle gönderildiğinde tek iz var (kullanıcının cümlesi)",
      s.iz?.toplam === 1 &&
        s.iz?.izler?.length === 1 &&
        s.iz.izler[0].tur === "sentence" &&
        s.iz.izler[0].tekSatir === true,
      JSON.stringify(s.iz),
    );
    check(
      "D-0048: iz 'Değiştir: …' diye okunuyor",
      /^Değiştir: /.test(s.iz?.izler?.[0]?.ariaLabel ?? ""),
      s.iz?.izler?.[0]?.ariaLabel,
    );
    check(
      "D-0048: izde sekme çubuğu / numaralı adım / 'Geri' YOK",
      Boolean(
        s.geriGezinmeYuzeyi &&
          s.geriGezinmeYuzeyi.tablist === 0 &&
          s.geriGezinmeYuzeyi.ariaStep === 0 &&
          s.geriGezinmeYuzeyi.geriMetni === false,
      ),
      JSON.stringify(s.geriGezinmeYuzeyi),
    );
    await shot("m-7-iz-cumle", "mobil 390 — cümle gönderildi: 1 iz", {
      iz: s.iz,
      geriGezinmeYuzeyi: s.geriGezinmeYuzeyi,
    });
    await click('[data-testid="category-confirmation-confirm"]');
    /*
      D-0047 — YUMUŞAK KAPANIŞ AN İÇİNDE ÖLÇÜLÜR. Yerleşmiş ekranda çekilen
      kopya zaten yoktur; kapanışın gerçekten kurulduğunu görmek için tıklamadan
      hemen sonra bakılır. Kopya erişilemez olmalı: aria-hidden + inert +
      pointer-events yok.
    */
    await sleep(140);
    const kapanisAni = await evaluate(`(() => {
      const e = document.querySelector('[data-testid="talep-soft-exit"]');
      if (!e) return null;
      const cs = getComputedStyle(e);
      return {
        ad: e.dataset.softExit,
        opaklik: Number(cs.opacity),
        ariaHidden: e.getAttribute("aria-hidden"),
        inert: e.hasAttribute("inert"),
        pointerEvents: cs.pointerEvents,
        animasyon: cs.animationName,
      };
    })()`);
    check(
      "D-0047: kategori bloğu yumuşak kapanıyor (bir karede yok olmuyor)",
      Boolean(
        kapanisAni &&
          kapanisAni.ad === "kategori" &&
          kapanisAni.animasyon === "talep-soft-exit" &&
          kapanisAni.opaklik < 1,
      ),
      JSON.stringify(kapanisAni),
    );
    check(
      "D-0047: çekilen kopyaya klavye/ekran okuyucu/fare ulaşamaz",
      Boolean(
        kapanisAni &&
          kapanisAni.ariaHidden === "true" &&
          kapanisAni.inert === true &&
          kapanisAni.pointerEvents === "none",
      ),
      JSON.stringify(kapanisAni),
    );
    await sleep(1400);
    s = await snapshot();
    check(
      "D-0047: onaylanan kategori bloğu ekranda GÖRÜNÜR değil",
      s.kategoriBlokGorunur === false && s.softExit.length === 0,
      `gorunur=${s.kategoriBlokGorunur} cekilen=${s.softExit.join(",")}`,
    );
    /*
      D-0048 — ŞEKİL GÜNCELLEMESİ. Kapanan adımın EN YAKIN geri dönüş yolu artık
      onun katlandığı izdir; odak oraya geçer. Karttaki "Değiştir" kaybolmadı ve
      aynı bloğu açmaya devam eder (aşağıdaki aria-expanded kapısı ve 4. bölüm
      bunu ölçüyor). İz DOM'da yoksa odak D-0047'nin yoluna düşer.
    */
    check(
      "D-0048: kapanan kategori adımının odağı kendi izine geçti",
      s.odak?.testid === "talep-trail-entry" &&
        s.odak?.trailKey === "__category__",
      JSON.stringify({ odak: s.odak, iz: s.iz?.izler?.map((i) => i.anahtar) }),
    );
    check(
      "D-0048: cevaplanan kategori adımı ize katlandı (iki iz, tek satır)",
      s.iz?.toplam === 2 &&
        s.iz.izler.some((i) => i.tur === "category") &&
        s.iz.izler.every((i) => i.tekSatir === true),
      JSON.stringify(s.iz),
    );
    check(
      "D-0047: kapanış ekran okuyucuya duyuruldu",
      /Kategori .+ kaydedildi/.test(s.kapanisDuyurusu ?? ""),
      s.kapanisDuyurusu,
    );
    check(
      "D-0048: katlanma da duyuruldu",
      /adım katlandı/.test(s.kapanisDuyurusu ?? ""),
      s.kapanisDuyurusu,
    );
    await shot("m-7b-iz-kategori", "mobil 390 — kategori ize katlandı: 2 iz", {
      iz: s.iz,
      odak: s.odak,
      duyuru: s.kapanisDuyurusu,
    });
    check(
      "D-0047: adım kapanınca 'Değiştir' aria-expanded=false",
      s.degistirAriaExpanded === "false",
      s.degistirAriaExpanded,
    );
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

  /* 4) KARTTAN GERİ AÇMA (D-0047) + KATEGORİ PANELİ + ALT KATEGORİ      */
  /*
    KAPANAN BLOĞUN GERİ DÖNÜŞÜ KARTTADIR (kurucu, 2026-09-26). "Değiştir"
    artık başka bir yüzeye atlamaz; kapanan kategori bloğunu aynı yerde geri
    açar. Tam ekran panel kaybolmaz — bloğun içindeki "Tüm kategoriler"den
    açılır ve alt kategori seçimi orada yapılmaya devam eder.
  */
  await click('[data-testid="talep-card-change-category"]');
  await sleep(900);
  s = await snapshot();
  check(
    "D-0047: karttaki 'Değiştir' kapanan kategori bloğunu geri açtı",
    s.kategoriBlokGorunur === true,
    `gorunur=${s.kategoriBlokGorunur} sheet=${s.sheetOpen}`,
  );
  check(
    "D-0047: geri açılan bloğun ilk denetimi odakta",
    s.odak?.blok === "kategoriBlok",
    JSON.stringify(s.odak),
  );
  await shot("m-3b-kategori-geri-acildi", "mobil 390 — karttan geri açılan kategori bloğu", {
    kategoriBlokGorunur: s.kategoriBlokGorunur,
    odak: s.odak,
    degistirAriaExpanded: s.degistirAriaExpanded,
  });

  await click('[data-testid="category-step-open-sheet"]');
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
    /* Kare kendi kanıtını taşır: hazır ekranda iz aktif adımın üstünde durur. */
    iz: s.iz,
    optionalDetails: s.optionalDetails,
    publishDock: s.publishDock,
    cta: s.publishCta,
    rows: s.rows,
    extras: s.extras,
  });

  /*
    D-0047 — YAYINA HAZIRKEN GÖRSEL AĞIRLIK. Ekranda kart + "Talebi yayınla" +
    kapalı "Detay ekle" konuşur; katlanan iz ve "Talep analizi" kalır ama
    ikincil kalır. Kapalı akordeonun çerçevesi ve zemini ölçülür — daha önce
    "Detay ekle" ile aynı ağırlıkta beyaz bir kutuydu.
  */
  check(
    "D-0047: hazır ekranda 'Talep analizi' ikincil (kapalıyken çerçevesiz)",
    Boolean(
      s.analizKapaliAgirlik &&
        s.analizKapaliAgirlik.open === "false" &&
        s.analizKapaliAgirlik.cerceve === "0px" &&
        /rgba\(0, 0, 0, 0\)|transparent/.test(s.analizKapaliAgirlik.zemin),
    ),
    JSON.stringify(s.analizKapaliAgirlik),
  );

  /*
    D-0047 — CEVAPLANAN SORU KART SATIRINDAN GERİ AÇILIR. Kurucunun cümlesi:
    "seçilen şey gidebilir ama geri dönüşü olacak şekilde kalkması lazım."
    Dolu bir satıra dokunulur, soru geri gelir, yeniden cevaplanır ve blok
    tekrar kapanır; odak her iki yönde de doğru yere gider.
  */
  {
    /*
      SÜRÜCÜNÜN CEVAPLAYABİLDİĞİ BİR SATIR SEÇİLİR. `ANSWER_STEP` para ve konum
      denetimlerini ve iOS seçenek satırlarını sürebiliyor; `brand` çok seçimli
      bir düğme kümesi olduğu için sürücü onu cevaplayamıyor ve blok haklı
      olarak açık kalıyor. Kapının ölçtüğü şey KAPANMA; sürücünün sınırı ayrı
      bir kapı olarak yazılır ki iki durum birbirine karışmasın.
    */
    const doluSatirlar = s.rows.filter((r) => r.state === "filled").map((r) => r.key);
    const doluSatir =
      doluSatirlar.find((k) => k === "budget") ??
      doluSatirlar.find((k) => k === "city") ??
      doluSatirlar[0] ??
      null;
    check(
      "D-0047: kartta geri dönülebilecek dolu satır var",
      Boolean(doluSatir),
      doluSatirlar.join(","),
    );
    if (doluSatir) {
      await click(
        `[data-testid="talep-card-row"][data-row-key="${doluSatir}"]`,
      );
      await sleep(1000);
      s = await snapshot();
      check(
        `D-0047: '${doluSatir}' satırı cevaplanan soruyu geri açtı`,
        s.soruBlokGorunur === true && s.questionField === doluSatir,
        `gorunur=${s.soruBlokGorunur} alan=${s.questionField}`,
      );
      check(
        "D-0047: geri açılan sorunun ilk denetimi odakta",
        s.odak?.blok === "soruBlok",
        JSON.stringify(s.odak),
      );
      check(
        "D-0047: geri açılışta bayat kapanış duyurusu silindi",
        s.kapanisDuyurusu === null,
        s.kapanisDuyurusu,
      );
      await shot(
        "m-6c-satirdan-geri-acildi",
        `mobil 390 — '${doluSatir}' satırından geri açılan soru`,
        {
          satir: doluSatir,
          questionField: s.questionField,
          odak: s.odak,
          soruBlokGorunur: s.soruBlokGorunur,
        },
      );

      const yeniden = await evaluate(ANSWER_STEP);
      check(
        "D-0047: sürücü geri açılan soruyu gerçekten cevapladı",
        yeniden !== "no-control" && yeniden !== "no-box",
        yeniden,
      );
      await sleep(1500);
      s = await snapshot();
      check(
        `D-0047: yeniden cevaplanan blok GÖRÜNÜR değil (${yeniden})`,
        s.soruBlokGorunur === false && s.softExit.length === 0,
        `gorunur=${s.soruBlokGorunur} cekilen=${s.softExit.join(",")}`,
      );
      /*
        D-0048 — ODAK ZİNCİRİ: iz → kart satırı. İz "+N adım"ın arkasına
        düştüyse DOM'da yoktur ve odak D-0047'nin yoluna (kart satırı) düşer.
        Hangi dalın koştuğu ölçülüp yazılır; iki durum birbirine karışmaz.
      */
      const izVarMi = (s.iz?.izler ?? []).some((i) => i.anahtar === doluSatir);
      check(
        izVarMi
          ? `D-0048: odak katlanan '${doluSatir}' izine döndü`
          : `D-0047: '${doluSatir}' izi toplanmış — odak kart satırına döndü`,
        izVarMi
          ? s.odak?.testid === "talep-trail-entry" &&
              s.odak?.trailKey === doluSatir
          : s.odak?.testid === "talep-card-row" && s.odak?.rowKey === doluSatir,
        JSON.stringify({ izVarMi, odak: s.odak }),
      );
      check(
        "D-0047: kapanış ekran okuyucuya duyuruldu ve geri dönüşü söylüyor",
        /kartta güncellendi/.test(s.kapanisDuyurusu ?? "") &&
          /satırına dön/.test(s.kapanisDuyurusu ?? ""),
        s.kapanisDuyurusu,
      );
      check(
        "D-0047: geri dönüş sonrası yayın butonu hâlâ açık",
        Boolean(s.publishCta) && s.publishCtaDisabled === false,
        `${s.publishCta} disabled=${s.publishCtaDisabled}`,
      );
      await shot(
        "m-6d-satir-sorusu-kapandi",
        `mobil 390 — satırdan açılan soru yeniden kapandı (${yeniden})`,
        {
          satir: doluSatir,
          odak: s.odak,
          duyuru: s.kapanisDuyurusu,
          soruBlokGorunur: s.soruBlokGorunur,
          rows: s.rows,
        },
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /* 5b) KATLANAN İZ — YERİNDE AÇILIR, YENİDEN KATLANIR (D-0048)         */
  /*
    Kurucunun istediği geri dönüş burada ölçülür: izlerin sırası kullanıcının
    yolunu anlatıyor mu, "+N adım" fazlasını gerçekten topluyor mu, ize
    dokunulunca adım YERİNDE mi açılıyor (aynı blok ikinci kez çizilmiyor) ve
    onaylandığında tekrar katlanıp odağı ize mi devrediyor.
  */
  {
    s = await snapshot();
    check(
      "D-0048: yayına hazır ekranda iz sırası kullanıcının yolunu anlatıyor",
      Boolean(s.iz) && s.iz.toplam >= 3 && s.iz.izler.every((i) => i.tekSatir),
      JSON.stringify(s.iz),
    );
    check(
      "D-0048: en fazla son iki iz açık, fazlası '+N adım'a toplandı",
      Boolean(
        s.iz &&
          s.iz.gorunen <= 2 &&
          s.iz.toplanan === s.iz.toplam - s.iz.gorunen &&
          s.iz.toplanan >= 1 &&
          /^\+\d+ adım$/.test(s.iz.more?.metin ?? ""),
      ),
      JSON.stringify({
        toplam: s.iz?.toplam,
        gorunen: s.iz?.gorunen,
        toplanan: s.iz?.toplanan,
        more: s.iz?.more,
      }),
    );
    check(
      "D-0048: iz ekranda sessiz kalıyor (küçük punto, tek satır)",
      Boolean(
        s.iz &&
          s.iz.izler.every(
            (i) => parseFloat(i.govdePunto) <= 13 && i.yukseklik <= 44,
          ),
      ),
      JSON.stringify(
        s.iz?.izler?.map((i) => `${i.govdePunto}/${i.yukseklik}px`),
      ),
    );
    await shot("m-8-iz-uc", "mobil 390 — üç iz: cümle + kategori + cevap", {
      iz: s.iz,
      meter: s.meter,
      cta: s.publishCta,
    });

    /* "+N adım" fazlasını gerçekten açıyor mu? */
    await click('[data-testid="talep-trail-more"]');
    await sleep(500);
    s = await snapshot();
    check(
      "D-0048: '+N adım' dokununca toplanan izler açılıyor",
      Boolean(s.iz && s.iz.toplanan === 0 && s.iz.gorunen === s.iz.toplam),
      JSON.stringify({ gorunen: s.iz?.gorunen, toplanan: s.iz?.toplanan }),
    );
    await shot("m-8a-iz-hepsi", "mobil 390 — '+N adım' açıldı, bütün izler", {
      iz: s.iz,
    });

    /* Kategori izine dokunulur: adım YERİNDE açılmalı. */
    await click(
      '[data-testid="talep-trail-entry"][data-trail-key="__category__"]',
    );
    await sleep(900);
    s = await snapshot();
    const cizimSayisi = await evaluate(
      `({
        kategori: document.querySelectorAll('[data-testid="category-confirmation-card"]').length,
        soru: document.querySelectorAll('[data-testid="composer-questions"]').length,
      })`,
    );
    check(
      "D-0048: ize dokununca adım YERİNDE açıldı (izin kendi satırında)",
      Boolean(
        s.iz &&
          s.iz.acikAnahtar === "__category__" &&
          s.iz.acikIzinIcinde === true &&
          s.kategoriBlokGorunur === true,
      ),
      JSON.stringify({
        acik: s.iz?.acikAnahtar,
        icinde: s.iz?.acikIzinIcinde,
        gorunur: s.kategoriBlokGorunur,
      }),
    );
    check(
      "D-0048: aynı adım bloğu ikinci kez çizilmedi",
      cizimSayisi.kategori === 1,
      JSON.stringify(cizimSayisi),
    );
    check(
      "D-0048: açılan izin altındaki adımlar soldu",
      (() => {
        const list = s.iz?.izler ?? [];
        const idx = list.findIndex((i) => i.anahtar === "__category__");
        const alt = list.slice(idx + 1);
        return (
          idx >= 0 &&
          alt.length > 0 &&
          alt.every((i) => i.solgun === "true" && i.opaklik < 0.6) &&
          list[idx].solgun === "false"
        );
      })(),
      JSON.stringify((s.iz?.izler ?? []).map((i) => `${i.anahtar}:${i.solgun}`)),
    );
    check(
      "D-0048: açılan iz aç/kapa denetimi (aria-expanded=true) ve odak blokta",
      (s.iz?.izler ?? []).find((i) => i.anahtar === "__category__")
        ?.ariaExpanded === "true" && s.odak?.blok === "kategoriBlok",
      JSON.stringify({
        aria: (s.iz?.izler ?? []).find((i) => i.anahtar === "__category__")
          ?.ariaExpanded,
        odak: s.odak,
      }),
    );
    await shot("m-8b-iz-acildi", "mobil 390 — kategori izi YERİNDE açıldı", {
      iz: s.iz,
      odak: s.odak,
      cizim: cizimSayisi,
    });

    /* Onaylanınca tekrar katlanır ve akış kaldığı yerden sürer. */
    await click('[data-testid="category-confirmation-confirm"]');
    await sleep(1500);
    s = await snapshot();
    check(
      "D-0048: onaylanınca iz tekrar katlandı (adım bloğu görünür değil)",
      Boolean(
        s.iz &&
          s.iz.acikAnahtar === null &&
          s.iz.acikIzinIcinde === null &&
          s.kategoriBlokGorunur === false &&
          s.softExit.length === 0,
      ),
      JSON.stringify({
        acik: s.iz?.acikAnahtar,
        gorunur: s.kategoriBlokGorunur,
        cekilen: s.softExit,
      }),
    );
    check(
      "D-0048: katlanınca odak izin kendisine döndü",
      s.odak?.testid === "talep-trail-entry" &&
        s.odak?.trailKey === "__category__",
      JSON.stringify(s.odak),
    );
    check(
      "D-0048: akış kaldığı yerden sürüyor — yayın butonu hâlâ açık",
      Boolean(s.publishCta) && s.publishCtaDisabled === false,
      `${s.publishCta} disabled=${s.publishCtaDisabled}`,
    );
    await shot(
      "m-8c-iz-yeniden-katlandi",
      "mobil 390 — iz yeniden katlandı, akış sürüyor",
      { iz: s.iz, odak: s.odak, duyuru: s.kapanisDuyurusu, cta: s.publishCta },
    );
  }

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
  const faceTimingDesktop = await waitForFace();
  check(
    "1280: Maira'nın yüzü başlangıç ekranında ÇİZİLMİŞ",
    faceTimingDesktop.drawn === true && faceTimingDesktop.ringOpacity < 0.1,
    JSON.stringify(faceTimingDesktop),
  );
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
  /*
    MASAÜSTÜ DEĞİŞMEDİ — İDDİA DEĞİL ÖLÇÜM (D-0046). Telefon hizası değişirken
    masaüstünün aynı kaldığı, dokunulmayan durumun kendi geometrisiyle
    kanıtlanır: başlık metni SOL kenarda başlar (ortalanmaz) ve büyük yüz
    kendi sağ sütununda durur, görünümün ortasında değil.
  */
  const hizaMasaustu = await measureStartAlignment();
  check(
    "1280: başlık sola hizalı kalır (masaüstü DEĞİŞMEDİ)",
    hizaMasaustu.baslikHizasi === "left" &&
      hizaMasaustu.baslikMetni != null &&
      hizaMasaustu.baslikKutusu != null &&
      Math.abs(hizaMasaustu.baslikMetni.x - hizaMasaustu.baslikKutusu.x) <= 2,
    JSON.stringify({
      hiza: hizaMasaustu.baslikHizasi,
      metinX: hizaMasaustu.baslikMetni?.x,
      kutuX: hizaMasaustu.baslikKutusu?.x,
    }),
  );
  check(
    "1280: büyük yüz sağ sütununda kalır (görünümün ortasında değil)",
    hizaMasaustu.yuz != null &&
      hizaMasaustu.yuzHizaProp === "start" &&
      hizaMasaustu.yuz.merkez > hizaMasaustu.gorunumMerkezi + 40,
    JSON.stringify({ yuz: hizaMasaustu.yuz, prop: hizaMasaustu.yuzHizaProp }),
  );
  await shot("d-1-baslangic", "masaüstü 1280 — başlangıç", {
    faces: s.faces,
    face: faceDesktop,
    hiza: hizaMasaustu,
    faceFirstPaintMs: faceTimingDesktop.ms,
    faceDrawn: faceTimingDesktop.drawn,
    ringOpacity: faceTimingDesktop.ringOpacity,
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

  /* D-0047: masaüstünde de "Değiştir" bloğu geri açar, panel bloktan açılır. */
  await click('[data-testid="talep-card-change-category"]');
  await sleep(900);
  s = await snapshot();
  check(
    "1280: 'Değiştir' kapanan kategori bloğunu geri açtı",
    s.kategoriBlokGorunur === true,
    `gorunur=${s.kategoriBlokGorunur} sheet=${s.sheetOpen}`,
  );
  await click('[data-testid="category-step-open-sheet"]');
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
  /*
    D-0048 — MASAÜSTÜNDE DE İZ. Aynı sözleşme iki genişlikte de ölçülür: iz
    sırası, "+N adım" ve YERİNDE açılma. Kategori izi olmayabilir (masaüstü
    akışında kategori paneli üzerinden kök değiştirildi); o durumda ilk açık iz
    sürülür ve hangi izin sürüldüğü kareye yazılır.
  */
  {
    check(
      "1280: iz sırası kullanıcının yolunu anlatıyor",
      Boolean(s.iz) && s.iz.toplam >= 2 && s.iz.izler.every((i) => i.tekSatir),
      JSON.stringify(s.iz),
    );
    const surulen =
      s.iz?.izler?.find((i) => i.tur === "category")?.anahtar ??
      s.iz?.izler?.find((i) => i.tur === "answer")?.anahtar ??
      null;
    if (surulen) {
      await click(
        `[data-testid="talep-trail-entry"][data-trail-key="${surulen}"]`,
      );
      await sleep(900);
      s = await snapshot();
      check(
        `1280: '${surulen}' izi YERİNDE açıldı`,
        s.iz?.acikAnahtar === surulen && s.iz?.acikIzinIcinde === true,
        JSON.stringify({
          acik: s.iz?.acikAnahtar,
          icinde: s.iz?.acikIzinIcinde,
        }),
      );
      await shot("d-6b-iz-acildi", `masaüstü 1280 — '${surulen}' izi açıldı`, {
        iz: s.iz,
        odak: s.odak,
      });
      const kapat = await evaluate(ANSWER_STEP);
      await sleep(1500);
      s = await snapshot();
      check(
        `1280: '${surulen}' izi yeniden katlandı (${kapat})`,
        s.iz?.acikAnahtar === null && s.softExit.length === 0,
        JSON.stringify({ acik: s.iz?.acikAnahtar, cekilen: s.softExit }),
      );
      await shot(
        "d-6c-iz-katlandi",
        `masaüstü 1280 — iz yeniden katlandı (${kapat})`,
        { iz: s.iz, odak: s.odak, duyuru: s.kapanisDuyurusu },
      );
    } else {
      check("1280: sürülebilecek bir iz bulundu", false, JSON.stringify(s.iz));
    }
  }

  await shot("d-6-hazir", "masaüstü 1280 — yayına hazır, isteğe bağlı bölüm kapalı", {
    status: s.status,
    meter: s.meter,
    meterReady: s.meterReady,
    cardTitle: s.cardTitle,
    question: s.question,
    optionalBadge: s.optionalBadge,
    optionalDetails: s.optionalDetails,
    iz: s.iz,
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

  /*
    D-0041 yolu korunur: "Değiştir" önce bloğu geri açar, tam ekran panel
    bloktaki "Tüm kategoriler"den gelir. Blok kurulamıyorsa (motor emin değil)
    "Değiştir" doğrudan paneli açar; iki durumda da panel açılmış olmalı.
  */
  await click('[data-testid="talep-card-change-category"]');
  await sleep(800);
  await click('[data-testid="category-step-open-sheet"]');
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
        categoryAboveCta: s.categoryAboveCta,
        publishDock: s.publishDock,
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
      /*
        SIRA — kategori onayı beklerken soru butonun ÜSTÜNDE durur (kurucu,
        2026-09-26). Ekrandaki gerçek konum ölçülür: DOM sırası doğru olsa
        bile kenetlenmiş buton sorunun üstüne oturabiliyordu.
      */
      if (s.categoryAboveCta) {
        check(
          `${key}: kategori onayı yayın butonunun ÜSTÜNDE`,
          s.categoryAboveCta.ok === true,
          JSON.stringify(s.categoryAboveCta),
        );
        check(
          `${key}: kategori beklerken buton kenetlenmiyor`,
          s.categoryAboveCta.dockPosition !== "fixed",
          JSON.stringify(s.categoryAboveCta),
        );
      }
      /* Başlık kuralı 1e ekranda da geçerli: konum ve arama fiili yok. */
      if (s.cardTitle) {
        check(
          `${key}: kart başlığında konum ve arama fiili yok`,
          !/arıyorum|istiyorum|lazım/i.test(s.cardTitle) &&
            !/(Kadıköy|Çankaya|Beşiktaş|Bornova|Ümraniye|Topkapı|Şişli)/i.test(
              s.cardTitle,
            ),
          s.cardTitle,
        );
      }
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
