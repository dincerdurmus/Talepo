/**
 * TANITIM VİDEOSU ⇄ ÜRÜN — YAN YANA KARŞILAŞTIRMA KARESİ (kurucu, 2026-09-25).
 *
 * NEDEN VAR. "Videoya yakın oldu mu?" sorusu iki klasör arasında gidip gelerek
 * cevaplanamaz. Bu betik referans karelerini (ref-1…ref-5) ve tarayıcı
 * geçişinin ÜRETTİĞİ ürün karelerini aynı tuvale dizer; her sütun hangi
 * dosyadan geldiğini kendi üstünde yazar.
 *
 * SAHTE YOK. Ürün karesi bulunamayan an için yerine bir görüntü uydurulmaz:
 * o sütun ölçülmemiş olduğunu ve nedenini yazan bir not olarak çizilir.
 *
 * İKİ DİZİM, TEK ARAÇ (2026-09-26). Kurucu "yüz hizası" için ayrı bir kare
 * istedi; bunun için ikinci bir betik açılmadı — aynı araca `yuz` dizimi
 * eklendi. Bu dizim ÖLÇÜLEN merkez değerlerini karenin altına yazar, böylece
 * hangi hizayı gösterdiği kareye bakan kişi için tahmin olmaktan çıkar.
 *
 * Koşum:  node scripts/qa-talep-video-compare-v1.cjs [akis|yuz]
 * Girdi:  referans klasörü + `TALEP_QA_OUT` (varsayılan sonuc6)
 * Çıktı:  <out>/karsilastirma.png  ya da  <out>/karsilastirma-yuz.png
 */
const fs = require("fs");
const path = require("path");
const { launch, connect } = require("./lib/qa-cdp-v1.cjs");

const REF =
  process.env.TALEP_REF_DIR ||
  "C:\\Users\\HP\\Documents\\Veyra\\projects\\talepo\\tasarim\\talep-video-ref-2026-09-25";
const OUT =
  process.env.TALEP_QA_OUT ||
  "C:\\Users\\HP\\Documents\\Veyra\\projects\\talepo\\tasarim\\talep-ui-2026-09-25\\sonuc6";

/** `akis` = videonun altı anı, `yuz` = D-0046 telefon hizası. */
const MODE = process.argv[2] === "yuz" ? "yuz" : "akis";

/**
 * SÜTUNLAR. Ürün karesi, videodaki AYNI anı gösteren kareden seçilir; emlak
 * cümlesi ("Kadıköy'de kiralık 3+1…") videonun kendi cümlesidir, bu yüzden
 * okuma ve hazır anları oradan alınır.
 */
const ROWS = [
  { ref: "ref-1.png", shot: "m-1-baslangic.png", title: "1 — Başlangıç" },
  { ref: "ref-2.png", shot: "m-1b-yazarken.png", title: "2 — Yazma" },
  { ref: "ref-3.png", shot: "m-11v1-okuma-bitti.png", title: "3 — Maira okuyor" },
  { ref: "ref-4.png", shot: "m-11v1-son.png", title: "4 — Kart hazır + yayın butonu" },
  {
    ref: "ref-5.png",
    shot: null,
    title: "5 — Yayında",
    note:
      "[NOT-MEASURED: canlı yayın] Yayın POST'u koşulmadı (kabul veritabanı yok). " +
      "Bu ekranın metni fixture ile ölçülür: verify-talep-ui-2026-09-v1 kapı (d) ve (e).",
  },
];

/**
 * YÜZ HİZASI DİZİMİ (D-0046). Referans `ref-1` ile telefonun başlangıç ve
 * yazma anı, ayrıca masaüstünün DEĞİŞMEDİĞİNİ gösteren kare yan yana durur.
 */
const ROWS_YUZ = [
  { ref: "ref-1.png", shot: "m-1-baslangic.png", title: "1 — Telefon başlangıç" },
  { ref: "ref-2.png", shot: "m-1b-yazarken.png", title: "2 — Telefon yazarken" },
  {
    ref: "ref-1.png",
    shot: "d-1-baslangic.png",
    title: "3 — Masaüstü (DEĞİŞMEDİ)",
  },
];

const fileUrl = (p) => `file:///${p.replace(/\\/g, "/")}`;

/**
 * KARE KENDİ ÖLÇÜMÜNÜ TAŞIR. Etiketler manifestten okunur; burada hiçbir sayı
 * yeniden hesaplanmaz. Manifest yoksa satır "ölçüm yok" der — uydurmaz.
 */
function hizaEtiketi(shotFile) {
  const manifestPath = path.join(OUT, "olcum-manifest.json");
  if (!fs.existsSync(manifestPath)) return "olcum-manifest.json yok — ölçüm okunamadı";
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return "olcum-manifest.json okunamadı";
  }
  const shot = (manifest.shots || []).find((s) => s.file === shotFile);
  const h = shot?.measured?.hiza;
  if (!h) return "bu karede hiza ölçümü yok";
  const yuzde = (el) =>
    el ? `%${((el.merkez / h.gorunum) * 100).toFixed(1)}` : "—";
  return [
    `görünüm ${h.gorunum}px · merkez ${yuzde({ merkez: h.gorunumMerkezi, ...h })}`,
    `yüz ${yuzde(h.yuz)} · MAIRA ${yuzde(h.maira)} · başlık ${yuzde(h.baslikMetni)}`,
    `text-align=${h.baslikHizasi} · hiza prop=${h.yuzHizaProp}`,
  ].join(" — ");
}

/** ref-1 ölçüldü (bu oturumda, sharp ile): video karesindeki merkezler. */
const REF1_OLCUM =
  "ref-1.png ölçüldü: yüz %50.8 · MAIRA %49.7 · başlık %50.0 (1080px genişlik)";

function buildHtml() {
  if (MODE === "yuz") return buildHtmlYuz();
  const cols = ROWS.map((row) => {
    const refPath = path.join(REF, row.ref);
    const shotPath = row.shot ? path.join(OUT, row.shot) : null;
    const hasShot = shotPath && fs.existsSync(shotPath);
    const productCell = hasShot
      ? `<img src="${fileUrl(shotPath)}" alt="${row.shot}"><em>${row.shot}</em>`
      : `<div class="note">${row.note ?? "Ürün karesi yok."}</div><em>${
          row.shot ?? "—"
        }</em>`;
    return `<section>
      <h2>${row.title}</h2>
      <div class="pair">
        <figure><figcaption>VİDEO</figcaption><img src="${fileUrl(refPath)}" alt="${row.ref}"><em>${row.ref}</em></figure>
        <figure><figcaption>ÜRÜN</figcaption>${productCell}</figure>
      </div>
    </section>`;
  }).join("");

  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font:14px/1.4 system-ui,sans-serif;color:#0f1f1d;padding:28px}
    h1{font-size:22px;margin:0 0 4px;letter-spacing:-0.02em}
    .sub{margin:0 0 24px;color:#0f1f1d80;font-size:13px}
    .grid{display:flex;gap:22px;align-items:flex-start}
    section{flex:1;min-width:0}
    h2{font:600 13px/1.2 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;margin:0 0 8px}
    .pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    figure{margin:0;min-width:0}
    figcaption{font:600 10px/1 ui-monospace,monospace;letter-spacing:.12em;color:#0f1f1d66;margin-bottom:4px}
    /* contain: referans kareleri 9:16'dır, kırpmak videonun kendisini gizler. */
    img{width:100%;height:620px;object-fit:contain;object-position:top center;border:1px solid #0b191714;border-radius:10px;background:#f5f8f7}
    .note{height:620px;display:flex;align-items:center;padding:14px;font-size:11.5px;line-height:1.5;color:#a15c07;background:#fffaf2;border:1px solid #a15c0733;border-radius:10px}
    em{display:block;margin-top:4px;font:400 10px/1.3 ui-monospace,monospace;color:#0f1f1d66;font-style:normal;word-break:break-all}
  </style>
  <h1>/talep — tanıtım videosu ⇄ ürün</h1>
  <p class="sub">Sol sütun videonun karesi, sağ sütun tarayıcı geçişinin ürettiği ürün karesi. Her kare kaynak dosyasını kendi altında yazar.</p>
  <div class="grid">${cols}</div>`;
}

function buildHtmlYuz() {
  const cols = ROWS_YUZ.map((row) => {
    const refPath = path.join(REF, row.ref);
    const shotPath = path.join(OUT, row.shot);
    const hasShot = fs.existsSync(shotPath);
    const productCell = hasShot
      ? `<img src="${fileUrl(shotPath)}" alt="${row.shot}"><em>${row.shot}</em><b class="olcum">${hizaEtiketi(row.shot)}</b>`
      : `<div class="note">Ürün karesi yok: ${row.shot}</div><em>${row.shot}</em>`;
    return `<section>
      <h2>${row.title}</h2>
      <div class="pair">
        <figure><figcaption>VİDEO</figcaption><img src="${fileUrl(refPath)}" alt="${row.ref}"><em>${row.ref}</em><b class="olcum">${REF1_OLCUM}</b></figure>
        <figure><figcaption>ÜRÜN</figcaption>${productCell}</figure>
      </div>
    </section>`;
  }).join("");

  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font:14px/1.4 system-ui,sans-serif;color:#0f1f1d;padding:28px}
    h1{font-size:22px;margin:0 0 4px;letter-spacing:-0.02em}
    .sub{margin:0 0 24px;color:#0f1f1d80;font-size:13px}
    .grid{display:flex;gap:22px;align-items:flex-start}
    section{flex:1;min-width:0}
    h2{font:600 13px/1.2 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;margin:0 0 8px}
    .pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    figure{margin:0;min-width:0}
    figcaption{font:600 10px/1 ui-monospace,monospace;letter-spacing:.12em;color:#0f1f1d66;margin-bottom:4px}
    img{width:100%;height:560px;object-fit:contain;object-position:top center;border:1px solid #0b191714;border-radius:10px;background:#f5f8f7}
    .note{height:560px;display:flex;align-items:center;padding:14px;font-size:11.5px;line-height:1.5;color:#a15c07;background:#fffaf2;border:1px solid #a15c0733;border-radius:10px}
    em{display:block;margin-top:4px;font:400 10px/1.3 ui-monospace,monospace;color:#0f1f1d66;font-style:normal;word-break:break-all}
    .olcum{display:block;margin-top:3px;font:500 10px/1.45 ui-monospace,monospace;color:#0f766e;word-break:break-word}
  </style>
  <h1>/talep — telefonda başlangıç ORTALI (D-0046)</h1>
  <p class="sub">Her karenin altında ÖLÇÜLEN merkez yüzdeleri durur; hiza gözle değil sayıyla okunur. Üçüncü sütun masaüstünün değişmediğini gösterir.</p>
  <div class="grid">${cols}</div>`;
}

async function main() {
  const html = buildHtml();
  const stem = MODE === "yuz" ? "karsilastirma-yuz" : "karsilastirma";
  const htmlPath = path.join(OUT, `${stem}.html`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(htmlPath, html, "utf8");

  const { proc, wsUrl } = await launch(9337);
  const browser = await connect(wsUrl);
  const { targetId } = await browser.send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await browser.send(
    "Target.attachToTarget",
    { targetId, flatten: true },
    undefined,
  );
  const S = sessionId;
  await browser.send("Page.enable", {}, S);
  await browser.send("Runtime.enable", {}, S);
  await browser.send(
    "Emulation.setDeviceMetricsOverride",
    { width: 1720, height: 1100, deviceScaleFactor: 1.5, mobile: false },
    S,
  );
  const loaded = browser.once(
    (m) => m.method === "Page.loadEventFired" && m.sessionId === S,
  );
  await browser.send("Page.navigate", { url: fileUrl(htmlPath) }, S);
  await loaded;
  await new Promise((r) => setTimeout(r, 1200));

  const { data } = await browser.send(
    "Page.captureScreenshot",
    { format: "png", captureBeyondViewport: true },
    S,
  );
  const outFile = path.join(OUT, `${stem}.png`);
  fs.writeFileSync(outFile, Buffer.from(data, "base64"));
  console.log(`KARŞILAŞTIRMA: ${outFile}`);
  for (const row of MODE === "yuz" ? ROWS_YUZ : ROWS) {
    const shotPath = row.shot ? path.join(OUT, row.shot) : null;
    console.log(
      `  ${row.title}: ${row.ref} ⇄ ${
        shotPath && fs.existsSync(shotPath) ? row.shot : "[NOT-MEASURED]"
      }`,
    );
  }

  await browser.send("Target.closeTarget", { targetId });
  try {
    proc.kill();
  } catch {
    /* zaten kapalı */
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("KARŞILAŞTIRMA BAŞARISIZ:", e.message);
  process.exit(1);
});
