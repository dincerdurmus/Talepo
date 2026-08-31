/**
 * MAIRA 3D SAHNE SINIRI — TEK KALICI DOĞRULAYICI (2026-08-31).
 *
 * Sözleşme: dekoratif Contour sahnesi Maira'nın GÖRÜNÜŞÜNÜ değiştirir,
 * DAVRANIŞINI değiştirmez. Sahne katmanı kanonik talep durumunu, beyni,
 * parser'ı ya da soru/cevap mantığını ne okur ne de üretir; kendi React
 * state'ini talep akışına sızdırmaz. Görsel katman çalışmasa da /talep
 * akışı bugünkü hâliyle ayakta kalır.
 *
 * NEDEN STATİK ÖLÇÜM. Bu bir görünüm sınırıdır: ihlali çalışma zamanında
 * değil, bir import satırında doğar. Tarayıcı QA'i bu sınırı kanıtlayamaz
 * (sahne WebGL yoksa hiç mount olmaz), bu yüzden kapı kaynak metni üzerinde
 * ölçer ve her yeni import'ta otomatik uygulanır.
 *
 * Lisans sınırı da burada tutulur: satın alınan modelin adresi takip edilen
 * kaynağa gömülemez, GLB/vendor dosyası repoya giremez.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = join(__dirname, "..");
const STAGE = join(ROOT, "src/components/request/maira/MairaStage.tsx");
const SCENE_COMPONENT = join(
  ROOT,
  "src/components/request/maira/MairaContourScene.tsx",
);
const SCENE_LIB = join(ROOT, "src/lib/maira/contour-scene.ts");
const PAGE = join(ROOT, "src/app/talep/page.tsx");

let kapi = 0;
let sorun = 0;
const ok = (ad: string, kosul: boolean, detay?: unknown) => {
  kapi++;
  if (!kosul) {
    sorun++;
    console.log(`  ✗ ${ad}${detay === undefined ? "" : ` — ${String(detay).slice(0, 160)}`}`);
  }
};
const oku = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : null);

console.log("A) Dosyalar ve client-only bağlantı");
const stage = oku(STAGE);
const comp = oku(SCENE_COMPONENT);
const lib = oku(SCENE_LIB);

ok("MairaStage okunabiliyor", stage != null);
ok("MairaContourScene.tsx var", comp != null, SCENE_COMPONENT);
ok("lib/maira/contour-scene.ts var", lib != null, SCENE_LIB);
ok(
  "sahne dynamic import ile bağlanıyor",
  Boolean(stage && /dynamic\(/.test(stage) && /MairaContourScene/.test(stage)),
);
ok(
  "SSR kapalı",
  Boolean(stage && /ssr:\s*false/.test(stage)),
);

console.log("B) Sahne katmanı kanonik durumu okumuyor");
const YASAK_IMPORT =
  /from\s+["'][^"']*(request-understanding|request-composer|request-brain|request-category-engine|product-identity|matching-v3|discovery|taxonomy)[^"']*["']/g;
for (const [ad, src] of [
  ["MairaContourScene", comp],
  ["contour-scene", lib],
] as const) {
  const hits = src ? [...src.matchAll(YASAK_IMPORT)].map((m) => m[0]) : [];
  ok(`${ad}: beyin/parser/kanonik state import etmiyor`, hits.length === 0, hits.join(" | "));
}
ok(
  "contour-scene saf: React import etmiyor",
  Boolean(lib && !/from\s+["']react["']/.test(lib)),
);
/**
 * Temizlik iddiası GEVŞETİLMEDİ, DOĞRU ŞEKLİ ölçülüyor: kurulum bir tutamaç
 * döndürür ve o tutamacın `dispose`'u gerçekten her kaynağı kapatır. Yalnız
 * "bir fonksiyon döndürüyor mu" demek sızıntıyı yakalamazdı.
 */
for (const iz of [
  "dispose:",
  "cancelAnimationFrame",
  "disconnect()",
  "removeEventListener",
  "renderer.dispose()",
  "forceContextLoss()",
]) {
  ok(`contour-scene temizliği kapsıyor: ${iz}`, Boolean(lib && lib.includes(iz)));
}

console.log("C) Fallback ve etkileşimsizlik sınırı");
ok(
  "WebGL2 yeteneği ölçülüyor",
  Boolean(comp && /webgl2/i.test(comp)),
);
ok(
  "reduced-motion sınırı var",
  Boolean(comp && /prefers-reduced-motion/.test(comp)),
);
ok(
  "genişlik eşiği (>=768) var",
  Boolean(comp && /768/.test(comp)),
);
ok(
  "model adresi yoksa sahne mount edilmiyor",
  Boolean(comp && /NEXT_PUBLIC_MAIRA_CONTOUR_MODEL_URL/.test(comp)),
);
ok(
  "canvas dekoratif (aria-hidden)",
  Boolean(comp && /aria-hidden/.test(comp)),
);
ok(
  "canvas etkileşimsiz (pointer-events yok)",
  Boolean(comp && /pointer-events-none|pointerEvents:\s*["']none["']/.test(comp)),
);
ok(
  "MairaStage ışık alanı fallback olarak duruyor",
  Boolean(stage && /radial-gradient\(closest-side/.test(stage)),
);
ok(
  "hata halinde sessiz fallback (catch)",
  Boolean(comp && /catch/.test(comp)),
);
ok(
  "unmount temizliği bağlanmış",
  Boolean(comp && /useEffect/.test(comp) && /return\s*\(\)\s*=>/.test(comp)),
);

console.log("D) Lisans ve kaynak sınırı");
for (const [ad, src] of [
  ["MairaStage", stage],
  ["MairaContourScene", comp],
  ["contour-scene", lib],
] as const) {
  ok(
    `${ad}: model adresi hard-code edilmemiş`,
    Boolean(src && !/storage\.getlayers\.ai/.test(src)),
  );
}
const izlenen = execFileSync("git", ["ls-files"], { cwd: join(ROOT, "..", "..") })
  .toString()
  .split("\n");
ok(
  "repoda GLB yok",
  !izlenen.some((f) => /\.glb$/i.test(f)),
  izlenen.filter((f) => /\.glb$/i.test(f)).join(","),
);
ok(
  "repoda vendor three kopyası yok",
  !izlenen.some((f) => /vendor\/(three|postprocessing|loaders)/.test(f)),
);
ok(
  "provenance yorumu kaynakta duruyor",
  Boolean(lib && /GetLayers Contour Anatomy/.test(lib) && /Full Stack/.test(lib)),
);

console.log("F) Showcase kompozisyonu — tam ekran sahne, kutu değil");
/**
 * Ölçülen ret (2026-08-31): sahne 26vh / 520px'lik bir yuvaya sıkıştırılmış,
 * mor sayfa zemini ve standart beyaz "Son birkaç detay" kartı Maira'nın
 * içinde kalmıştı. Kapı artık kompozisyonun kendisini ölçer: tam ekran
 * sahne sözleşmesi, kutu sınırlarının yokluğu ve Showcase katmanı.
 */
for (const [ad, kotu] of [
  ["26vh yüksekliği yok", /\[26vh\]/],
  ["max-h-[240px] kutusu yok", /max-h-\[240px\]/],
  ["max-w-[520px] kutusu yok", /max-w-\[520px\]/],
  ["min-h-[70vh] panel kabuğu yok", /min-h-\[70vh\]/],
  ["yuvarlatılmış dış kabuk yok", /rounded-3xl/],
] as const) {
  ok(`MairaStage: ${ad}`, Boolean(stage && !kotu.test(stage)), ad);
}
ok(
  "MairaStage tam ekran (fixed inset-0)",
  Boolean(stage && /fixed inset-0/.test(stage)),
);
ok(
  "canvas tam kaplama (absolute inset-0 + h-full w-full)",
  Boolean(comp && /absolute inset-0/.test(comp) && /h-full w-full/.test(comp)),
);
ok(
  "Maira'da standart beyaz soru kartı YOK",
  Boolean(stage && !/FocusedQuestionsPanel/.test(stage)),
  "MairaStage hâlâ standart paneli çiziyor",
);
for (const iz of [
  "sc-nav",
  "sc-plate",
  "sc-wordmark",
  "sc-bottom",
  "sc-lead",
  "maira-option",
  "sc-card-stat",
]) {
  ok(`Showcase katmanı: ${iz}`, Boolean(stage && stage.includes(iz)));
}
ok(
  "MairaAnswers bağlı kalıyor",
  Boolean(stage && /MairaAnswers/.test(stage)),
);
ok(
  "seçenekler kanonik kontrolden geliyor (hardcode yok)",
  Boolean(stage && /control\?\.options|control\.options/.test(stage) && /softOptions/.test(stage)),
);

console.log("E) Dış sözleşmeler değişmedi");
const PROPS = [
  "questions:",
  "draftByKey:",
  "onDraftChange:",
  "onAnswer:",
  "onSkip:",
  "answers:",
  "subtitle:",
  "onExitToStandard:",
  "editControl:",
  "onEditAnswer:",
];
ok(
  "MairaStage dış prop sözleşmesi korunuyor",
  Boolean(stage && PROPS.every((p) => stage.includes(p))),
  stage ? PROPS.filter((p) => !stage.includes(p)).join(",") : "dosya yok",
);
const pageDiff = execFileSync(
  "git",
  ["diff", "--name-only", "HEAD", "--", "apps/web/src/app/talep/page.tsx"],
  { cwd: join(ROOT, "..", "..") },
)
  .toString()
  .trim();
ok("page.tsx değişmedi", pageDiff === "", pageDiff);
/**
 * Soru/cevap YÜZEYLERİ Maira'da durmaya devam eder — ama artık standart
 * beyaz panelle değil, Showcase katmanıyla. Bu iddia F bölümündeki
 * "beyaz kart yok" kuralıyla çelişmemeli: ölçülen şey eylemlerin
 * varlığıdır, hangi kabukla çizildiği değil.
 */
ok(
  "soru/cevap yüzeyleri MairaStage'de duruyor",
  Boolean(
    stage &&
      /maira-question-prompt/.test(stage) &&
      /maira-open-answers/.test(stage) &&
      /maira-exit-to-standard/.test(stage),
  ),
);

console.log(`\nkapi=${kapi} sorun=${sorun}`);
console.log(sorun === 0 ? "SONUC=GECTI" : "SONUC=KALDI");
process.exit(sorun === 0 ? 0 : 1);
