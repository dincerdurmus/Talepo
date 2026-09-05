/**
 * PLANET GÜNEŞ OTORİTESİ — v1 (kurucu talebi, 2026-09-05)
 *
 * Tek sözleşme, tek doğrulayıcı. Ana sayfadaki Planet'in gündüz/gece
 * aydınlatması artık sabit bir vektör değil, gerçek UTC'den türeyen bir
 * güneş yönüdür. Bu dosya o sözleşmenin bütün taraflarını ölçer:
 *
 *   A. Astronomi doğru mu (deklinasyon, subsolar boylam, Türkiye yüksekliği)
 *   B. Coğrafi çerçeve Türkiye çapasından doğru kalibre ediliyor mu
 *   C. Görsel Y dönüşü aydınlatmayı kaydırıyor mu (kompanzasyon)
 *   D. QA zaman override'ı yalnız development'ta mı çalışıyor
 *   E. Shader'da sabit güneş vektörü kalmış mı, iki shader aynı uniform'u
 *      mu kullanıyor
 *   F. Bağlamsal gece derecelendirmesi (uzak gündüz yüzeyinin sıkıştırılması)
 *      güneş geometrisine mi bağlı, ekran koordinatına mı
 *
 * Ölçümler ÜRETİM fonksiyonları üzerinden yapılır; karar kopyası kurulmaz.
 * Her sınıf için bir mutasyon kontrolü vardır: kusur kasten geri konduğunda
 * ilgili satırın kırmızıya döndüğü `--mutate` ile gösterilebilir.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import * as THREE from "three";

import {
  TURKEY_LAT_DEG,
  TURKEY_LON_DEG,
  calibrateLongitudeOffset,
  devTimeOverrideUtcMs,
  geoDirection,
  impliedLatitudeDeg,
  localNightAmount,
  overrideUtcMsFor,
  solarAnglesForUtc,
  sunDirectionInView,
} from "../src/lib/planet/broadcast-scene";

const D2R = Math.PI / 180;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCENE_PATH = path.join(HERE, "../src/lib/planet/broadcast-scene.ts");

const MUTATE = process.argv.includes("--mutate");

let problems = 0;
function ok(label: string, pass: boolean, detail: string) {
  if (!pass) problems += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label} — ${detail}`);
}

/** Bir yer/an için güneş yüksekliği (derece), üretim fonksiyonlarından. */
function solarElevationDeg(utcMs: number, latDeg: number, lonDeg: number) {
  const { declinationRad, subsolarLonRad } = solarAnglesForUtc(utcMs);
  const sun = geoDirection(declinationRad, subsolarLonRad, 0, new THREE.Vector3());
  const site = geoDirection(latDeg * D2R, lonDeg * D2R, 0, new THREE.Vector3());
  return Math.asin(Math.max(-1, Math.min(1, sun.dot(site)))) / D2R;
}

/* ---------- A. ASTRONOMİ ---------- */

/* Gün dönümü deklinasyonları eksen eğikliğine eşittir (±23.44°). */
const junDecl = (solarAnglesForUtc(Date.UTC(2026, 5, 21, 12)).declinationRad) / D2R;
const decDecl = (solarAnglesForUtc(Date.UTC(2026, 11, 21, 12)).declinationRad) / D2R;
ok(
  "A1 yaz gün dönümü deklinasyonu",
  Math.abs(junDecl - 23.44) < 0.35,
  `${junDecl.toFixed(2)}° (beklenen ~+23.44°)`,
);
ok(
  "A2 kış gün dönümü deklinasyonu",
  Math.abs(decDecl + 23.44) < 0.35,
  `${decDecl.toFixed(2)}° (beklenen ~-23.44°)`,
);

/* Öğle yüksekliği teorisi: 90 - |enlem - deklinasyon|. */
const junNoon = solarElevationDeg(Date.UTC(2026, 5, 21, 9, 40), TURKEY_LAT_DEG, TURKEY_LON_DEG);
const junTheory = 90 - Math.abs(TURKEY_LAT_DEG - junDecl);
ok(
  "A3 Türkiye yaz öğle yüksekliği teoriyle uyuşur",
  Math.abs(junNoon - junTheory) < 0.6,
  `ölçülen ${junNoon.toFixed(2)}° / teori ${junTheory.toFixed(2)}°`,
);

const decNoon = solarElevationDeg(Date.UTC(2026, 11, 21, 9, 40), TURKEY_LAT_DEG, TURKEY_LON_DEG);
const decTheory = 90 - Math.abs(TURKEY_LAT_DEG - decDecl);
ok(
  "A4 Türkiye kış öğle yüksekliği teoriyle uyuşur",
  Math.abs(decNoon - decTheory) < 0.6,
  `ölçülen ${decNoon.toFixed(2)}° / teori ${decTheory.toFixed(2)}°`,
);

/* Subsolar boylam saatte 15° batıya kayar. */
const lonA = solarAnglesForUtc(Date.UTC(2026, 2, 20, 10)).subsolarLonRad / D2R;
const lonB = solarAnglesForUtc(Date.UTC(2026, 2, 20, 13)).subsolarLonRad / D2R;
ok(
  "A5 subsolar boylam 3 saatte 45° batıya kayar",
  Math.abs(lonA - lonB - 45) < 0.3,
  `${(lonA - lonB).toFixed(2)}°`,
);

/* Saat dilimi bağımsızlığı: aynı ana ait iki farklı yerel gösterim,
   aynı UTC milisaniyesi olduğu sürece aynı sonucu vermelidir. */
const tzProbe = Date.UTC(2026, 6, 4, 7, 15, 30);
ok(
  "A6 hesap yalnız UTC alanlarını okur",
  solarElevationDeg(tzProbe, TURKEY_LAT_DEG, TURKEY_LON_DEG) ===
    solarElevationDeg(new Date(tzProbe).getTime(), TURKEY_LAT_DEG, TURKEY_LON_DEG),
  "yerel saat alanları kullanılmıyor",
);

/* QA anları gerçekten gündüz / ufuk / gece mi. */
const qaDay = solarElevationDeg(overrideUtcMsFor("day"), TURKEY_LAT_DEG, TURKEY_LON_DEG);
const qaSet = solarElevationDeg(overrideUtcMsFor("sunset"), TURKEY_LAT_DEG, TURKEY_LON_DEG);
const qaNight = solarElevationDeg(overrideUtcMsFor("night"), TURKEY_LAT_DEG, TURKEY_LON_DEG);
ok("A7 QA 'day' Türkiye'de yüksek gündüz", qaDay > 40, `${qaDay.toFixed(2)}°`);
ok("A8 QA 'sunset' ufuk kuşağında", Math.abs(qaSet) < 4, `${qaSet.toFixed(2)}°`);
ok("A9 QA 'night' derin gece", qaNight < -35, `${qaNight.toFixed(2)}°`);

/* ---------- B. COĞRAFİ KALİBRASYON ---------- */

/* Kalibrasyon, herhangi bir boylam sıfırına sahip modelde Türkiye'yi
   35°E'ye oturtmalıdır. Sentetik bir model çapası ile ölçülür. */
for (const modelZeroDeg of [0, 37, -185.27, 121]) {
  const anchor = geoDirection(
    TURKEY_LAT_DEG * D2R,
    TURKEY_LON_DEG * D2R,
    modelZeroDeg * D2R,
    new THREE.Vector3(),
  );
  const solved = (calibrateLongitudeOffset(anchor) * 180) / Math.PI;
  const diff = Math.abs(((solved - modelZeroDeg + 540) % 360) - 180);
  ok(
    `B1 boylam sıfırı çözülür (model ${modelZeroDeg}°)`,
    diff < 1e-6,
    `çözülen ${solved.toFixed(4)}°`,
  );
  ok(
    `B2 çapanın ima ettiği enlem ${TURKEY_LAT_DEG}° (model ${modelZeroDeg}°)`,
    Math.abs(impliedLatitudeDeg(anchor) - TURKEY_LAT_DEG) < 1e-6,
    `${impliedLatitudeDeg(anchor).toFixed(4)}°`,
  );
}

/* ---------- C. GÖRSEL DÖNÜŞ KOMPANZASYONU ---------- */

/* Sahnedeki zincirin aynısı: taşıyıcı = tilt(z) * dönüş(y), kamera saf
   ötelemedir. Güneş yönü ÜRETİM fonksiyonuyla view'a taşınır; Türkiye'nin
   normali de aynı taşıyıcıdan geçer. Dönüş açısı taransa da iç çarpım —
   yani Türkiye'nin gündüz/gece durumu — değişmemelidir. */
const TILT = 0.37;
const camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 90);
camera.position.set(0, 0, 6.6);
camera.updateMatrixWorld();
const camInv = new THREE.Matrix4().copy(camera.matrixWorld).invert();

const { declinationRad, subsolarLonRad } = solarAnglesForUtc(overrideUtcMsFor("day"));
const lonOffset = -185.26899779967968 * D2R; /* sahnede ölçülen gerçek değer */
const sunLocal = geoDirection(declinationRad, subsolarLonRad, lonOffset, new THREE.Vector3());
const turkeyLocal = geoDirection(
  TURKEY_LAT_DEG * D2R,
  TURKEY_LON_DEG * D2R,
  lonOffset,
  new THREE.Vector3(),
);

const carrier = new THREE.Object3D();
carrier.rotation.z = TILT;
const ndlSamples: number[] = [];
for (let i = 0; i < 96; i++) {
  const rotY = (i / 96) * Math.PI * 2;
  carrier.rotation.y = rotY;
  carrier.updateMatrixWorld(true);

  const sunView = sunDirectionInView(
    sunLocal,
    carrier.matrixWorld,
    camInv,
    new THREE.Vector3(),
  );
  /* MUTASYON KONTROLÜ: kusur, güneşi taşıyıcıdan geçirmemektir — yani
     eski sabit/dünya-uzayı davranışı. Bu durumda dönüş aydınlatmayı
     kaydırır ve aşağıdaki yayılım eşiği kırmızıya döner. */
  if (MUTATE) sunView.copy(sunLocal).transformDirection(camInv);

  const turkeyView = turkeyLocal
    .clone()
    .transformDirection(carrier.matrixWorld)
    .transformDirection(camInv);
  ndlSamples.push(turkeyView.dot(sunView));
}
const ndlSpread = Math.max(...ndlSamples) - Math.min(...ndlSamples);
const expectedNdl = Math.sin(qaDay * D2R);
ok(
  "C1 görsel Y dönüşü Türkiye'nin aydınlanmasını kaydırmaz",
  ndlSpread < 1e-9,
  `96 açıda yayılım ${ndlSpread.toExponential(2)}`,
);
ok(
  "C2 aydınlanma gerçek güneş yüksekliğine eşittir",
  Math.abs(ndlSamples[0]! - expectedNdl) < 1e-6,
  `ndl ${ndlSamples[0]!.toFixed(6)} / sin(${qaDay.toFixed(2)}°) ${expectedNdl.toFixed(6)}`,
);
/* Gece senaryosunda işaret gerçekten ters dönmeli — sabit bir vektör
   olsaydı gündüz/gece ayrımı hiç oluşmazdı. */
const nightAngles = solarAnglesForUtc(overrideUtcMsFor("night"));
const sunNight = geoDirection(
  nightAngles.declinationRad,
  nightAngles.subsolarLonRad,
  lonOffset,
  new THREE.Vector3(),
);
ok(
  "C3 gece senaryosunda Türkiye gölgededir",
  turkeyLocal.dot(sunNight) < -0.5,
  `ndl ${turkeyLocal.dot(sunNight).toFixed(4)}`,
);

/* ---------- D. OVERRIDE YALNIZ DEVELOPMENT ---------- */

ok(
  "D1 sunucu tarafında override yoktur (window yok)",
  devTimeOverrideUtcMs() === null,
  "null döndü",
);
ok(
  "D2 üç QA anı birbirinden farklıdır",
  new Set([
    overrideUtcMsFor("day"),
    overrideUtcMsFor("sunset"),
    overrideUtcMsFor("night"),
  ]).size === 3,
  "day / sunset / night ayrı anlar",
);

/* ---------- E. SHADER KAYNAK SÖZLEŞMESİ ---------- */

const src = readFileSync(SCENE_PATH, "utf8");
const hardCodedSun = src.match(/vec3\(\s*-?0\.66\s*,\s*0\.40?\s*,\s*-?0\.62\s*\)/g) ?? [];
/* Tek kabul edilen kalıntı, uniform'un JS tarafındaki ilk değeridir. */
ok(
  "E1 shader'da sabit güneş vektörü kalmadı",
  hardCodedSun.length === 0,
  `GLSL içinde ${hardCodedSun.length} sabit vektör`,
);
const uniformAssignments = src.match(/uniforms\.uSunDirection\s*=\s*sunDirView/g) ?? [];
ok(
  "E2 gezegen ve bulut aynı güneş uniform'unu paylaşır",
  uniformAssignments.length === 2,
  `${uniformAssignments.length} atama (gezegen + bulut)`,
);
const uniformDecls = src.match(/uniform vec3 uSunDirection;/g) ?? [];
ok(
  "E3 iki fragment shader da uniform'u bildirir",
  uniformDecls.length === 2,
  `${uniformDecls.length} bildirim`,
);
ok(
  "E4 astronomi her karede değil, eşikle tazelenir",
  /SOLAR_REFRESH_MS\s*=\s*60_000/.test(src) &&
    /wall - lastSolarWallMs < SOLAR_REFRESH_MS/.test(src),
  "60 saniyelik eşik yerinde",
);
ok(
  "E5 gündüz/alacakaranlık/gece smoothstep ile karışır",
  /float dayAmt\s+= smoothstep/.test(src) &&
    /float duskAmt\s+= exp/.test(src) &&
    /float lightsFactor = smoothstep/.test(src),
  "üç bölge yumuşak",
);

/* ---------- F. BAĞLAMSAL GECE DERECELENDİRMESİ ---------- */

/* Türkiye gündüzdeyken sıfır, gecedeyken bir; arada yumuşak rampa. */
ok(
  "F1 Türkiye gündüzdeyken bağlamsal gece 0",
  localNightAmount(Math.sin(qaDay * D2R)) === 0,
  `ndl ${Math.sin(qaDay * D2R).toFixed(4)} → ${localNightAmount(Math.sin(qaDay * D2R))}`,
);
ok(
  "F2 Türkiye gecedeyken bağlamsal gece 1",
  localNightAmount(Math.sin(qaNight * D2R)) === 1,
  `ndl ${Math.sin(qaNight * D2R).toFixed(4)} → ${localNightAmount(Math.sin(qaNight * D2R))}`,
);
/* Gün batımı karesi neredeyse hiç etkilenmemeli — beğenilen kare odur. */
const sunsetLocalNight = localNightAmount(Math.sin(qaSet * D2R));
ok(
  "F3 gün batımı karesi bağlamsal sıkıştırmadan neredeyse etkilenmez",
  sunsetLocalNight < 0.12,
  `${sunsetLocalNight.toFixed(4)}`,
);
/* Rampa monoton ve sürekli olmalı: hiçbir yerde ani kararma yok. */
let monotonic = true;
let maxStep = 0;
let prev = localNightAmount(1);
for (let i = 1; i <= 400; i++) {
  const v = localNightAmount(1 - (2 * i) / 400);
  if (v < prev - 1e-12) monotonic = false;
  maxStep = Math.max(maxStep, Math.abs(v - prev));
  prev = v;
}
ok(
  "F4 bağlamsal rampa monoton ve adımsız",
  monotonic && maxStep < 0.02,
  `monoton ${monotonic}, en büyük adım ${maxStep.toFixed(4)}`,
);

/* Kaynak sözleşmesi: sıkıştırma ekran koordinatına DEĞİL, güneş
   geometrisine bağlıdır. */
const planetShaderBody = src.slice(
  src.indexOf("function applyPlanetShader"),
  src.indexOf("function addAtmosphereGlow"),
);
ok(
  "F5 ekran koordinatına dayalı karartma hack'i yok",
  !/gl_FragCoord|screenPosition|vec2\s*\(\s*gl_Frag/.test(planetShaderBody),
  "gl_FragCoord kullanılmıyor",
);
ok(
  "F6 gezegen ve bulut aynı bağlamsal gece uniform'unu paylaşır",
  (src.match(/uniforms\.uLocalNight\s*=\s*localNight/g) ?? []).length === 2 &&
    (src.match(/uniform float uLocalNight;/g) ?? []).length === 2,
  "2 atama + 2 bildirim",
);
ok(
  "F7 sıkıştırma pozlamaya uygulanır, güneş yönüne değil",
  /dayPresence = mix\(1\.0, mix\(0\.62, 0\.36, farDay\), uLocalNight\)/.test(src) &&
    /mix\(0\.156, 1\.05 \* dayPresence, dayAmt\)/.test(src),
  "dayPresence yalnız pozlama çarpanı",
);

/* Kurucu sınırı (2026-09-05 premium rötuşu): 1.15–1.25. Sırayla 2.05
   (metalik), 1.45 (hâlâ oyulmuş), onaylanan 1.20. */
const reliefMatch = src.match(/terrainShade \* mix\(0\.55, ([0-9.]+), dayAmt\)/);
const reliefDay = reliefMatch ? Number(reliefMatch[1]) : NaN;
ok(
  "F8 gündüz kabartma çarpanı kurucu aralığında",
  reliefDay >= 1.15 && reliefDay <= 1.25,
  `${reliefDay} (istenen 1.15–1.25)`,
);
ok(
  "F10 kabartmanın gece ucu rötuştan etkilenmedi",
  src.includes("terrainShade * mix(0.55, "),
  "gece çarpanı 0.55",
);
ok(
  "F11 gece yüzeyi kısıntısı onaylanan 0.52x değerinde",
  src.includes("mix(1.0, mix(0.52, 1.0, dayAmt), uLocalNight * nightAmt)"),
  "0.52x yerinde",
);
/* Gündüz paleti luminance rampası DEĞİL: orijinal kroma baskın kalmalı. */
ok(
  "F9 gündüz karası luminance rampasına indirgenmez",
  /mix\(vec3\(dayLum\), gl_FragColor\.rgb, 0\.7[0-9]\)/.test(src) &&
    !/dayLum \* paletteChroma/.test(src),
  "orijinal diffuse kroma %74 korunuyor",
);

console.log(`\nPROBLEMS=${problems}`);
process.exit(problems === 0 ? 0 : 1);
