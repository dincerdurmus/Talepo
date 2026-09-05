/**
 * TALEPO PLANET — GERÇEK ÜÇ BOYUTLU YAYIN SAHNESİ (kurucu, 2026-09-04).
 *
 * Kaynak: GetLayers "Planet" paketi (planet.html + planet.glb +
 * planet-lights.glb + planet-clouds.png) — kurucunun verdiği ZIP.
 * DOĞRUDAN TAŞINAN çekirdek: GLB dünya + gece-ışıkları dokusu,
 * gündüz/gece terminatör + rim + okyanus + kabartma shader'ı
 * (onBeforeCompile), atmosfer glow diski, bulut kabuğu shader'ı ve
 * kara-yüzeyi alan-ağırlıklı marker örneklemesi.
 * ALINMAYANLAR: kontrol paneli, localStorage, OrbitControls/drag,
 * köşe-alev arka planı, yıldız alanı, atmosfer parçacıkları, üçlü
 * composer/bloom zinciri, haloTexture düzeni. Tek renderer, composer yok;
 * atmosfer additive mesh ile çözülür.
 *
 * Bu modül React bilmez: sahneyi kurar, döngüyü yönetir, hikâye
 * durumlarını callback ile bildirir ve dispose() ile tamamen temizlenir.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

/**
 * LİSANS SINIRI (Maira sahnesiyle aynı sözleşme): satın alınan GetLayers
 * varlıklarının adresi TAKİP EDİLEN kaynağa gömülmez ve dosyalar repoya
 * girmez. Taban adres yalnız ortam değişkeninden gelir; tanımsızsa sahne
 * hiç kurulmaz ve hero React tarafındaki statik posterle çalışır.
 */
const ASSET_BASE = process.env.NEXT_PUBLIC_TALEPO_PLANET_ASSETS ?? "";
export function planetAssetsConfigured(): boolean {
  return ASSET_BASE.length > 0;
}

/* ---------- GERÇEK GÜNEŞ KONUMU (UTC) ---------- */

/**
 * Türkiye referans ekseni. Coğrafi çerçeve bu noktadan kalibre edilir ve
 * QA senaryoları da bu eksende doğrulanır (kurucu, 2026-09-05).
 */
export const TURKEY_LAT_DEG = 39;
export const TURKEY_LON_DEG = 35;

export type SolarAngles = {
  /** Güneşin deklinasyonu (radyan): yılın gününe bağlı mevsim ekseni. */
  declinationRad: number;
  /** Güneşin tam tepede olduğu boylam (radyan): günün saatine bağlı. */
  subsolarLonRad: number;
};

/**
 * Yaklaşık güneş konumu — NOAA'nın düşük hassasiyetli günlük serileri.
 * Dakika mertebesinde doğrudur; aydınlatma için fazlasıyla yeterli.
 *
 * Girdi UTC milisaniyedir ve YALNIZ UTC alanları okunur. Kullanıcının
 * bilgisayar saat dilimi hiçbir yerde kullanılmaz: yanlış ayarlı bir
 * makine dünyanın aydınlatmasını kaydıramaz.
 */
export function solarAnglesForUtc(utcMs: number): SolarAngles {
  const d = new Date(utcMs);
  const yearStartMs = Date.UTC(d.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((utcMs - yearStartMs) / 86_400_000) + 1;
  const utcHours =
    d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;

  /* Yılın kesirli açısı (radyan). */
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcHours - 12) / 24);

  const declinationRad =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);

  /* Zaman denklemi (dakika): gerçek güneş saatiyle ortalama saat farkı. */
  const eqTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));

  /* 12:00 UTC'de güneş ~0° boylamdadır ve saatte 15° batıya kayar. */
  const subsolarLonDeg = -15 * (utcHours - 12 + eqTimeMin / 60);

  return {
    declinationRad,
    subsolarLonRad: (subsolarLonDeg * Math.PI) / 180,
  };
}

/**
 * Coğrafi (enlem, boylam) → modelin YEREL yön vektörü.
 *
 * GLB küp-atlas açılımlıdır, bu yüzden boylam sıfırı UV'den okunamaz;
 * `calibrateLongitudeOffset` ile Türkiye çapasından türetilir. Kutup
 * ekseni modelin +Y'sidir ve bu varsayım çalışma anında doğrulanır.
 */
export function geoDirection(
  latRad: number,
  lonRad: number,
  lonOffsetRad: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const a = lonRad + lonOffsetRad;
  return out
    .set(
      Math.cos(latRad) * Math.sin(a),
      Math.sin(latRad),
      Math.cos(latRad) * Math.cos(a),
    )
    .normalize();
}

/**
 * Modelin boylam sıfırını, UV'den bulunmuş Türkiye yüzey noktasından
 * çözer. Tek kalibrasyon noktası kullanmak, ışığın ve radar noktasının
 * aynı çapaya bağlı kalmasını ve birbirinden asla ayrışmamasını sağlar.
 */
export function calibrateLongitudeOffset(turkeyLocal: THREE.Vector3): number {
  const n = turkeyLocal.clone().normalize();
  return Math.atan2(n.x, n.z) - (TURKEY_LON_DEG * Math.PI) / 180;
}

/** Kalibrasyon noktasının ima ettiği enlem (derece) — +Y kutup denetimi. */
export function impliedLatitudeDeg(turkeyLocal: THREE.Vector3): number {
  return (Math.asin(turkeyLocal.clone().normalize().y) * 180) / Math.PI;
}

/** GLSL smoothstep'in JS karşılığı; edge0 > edge1 durumunda da çalışır. */
export function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * BAĞLAMSAL GECE MİKTARI (kurucu, 2026-09-05).
 *
 * Hero'nun anlattığı yer Türkiye'dir. Türkiye gece bölgesindeyken görünen
 * yarımkürenin uzak ucunda kalan gündüz yüzeyi kompozisyonu ele geçiriyor
 * ve sahne "kararsız" görünüyordu. Bu değer yükseldikçe shader, uzak gündüz
 * yüzeyinin yalnız SUNUM pozlamasını yumuşak biçimde sıkıştırır.
 *
 * Güneş geometrisi, terminatörün yeri ve hiçbir noktanın gündüz/gece kararı
 * DEĞİŞMEZ — bu yalnız bir derecelendirme ağırlığıdır. Ekran koordinatına
 * bakmaz; tek girdisi Türkiye'nin gerçek solar ndl değeridir.
 */
export function localNightAmount(turkeyNdl: number): number {
  return smoothstep01(0.1, -0.35, turkeyNdl);
}

/**
 * Modelin YEREL güneş yönünü, shader'ın `vNormal`'ı ile AYNI zincirden
 * geçirerek view uzayına taşır: önce gezegenin dünya matrisi, sonra
 * kameranın view'i.
 *
 * Yapay Y dönüşünün kompanzasyonu tam da buradadır: güneş yönü coğrafi
 * çerçevede üretilip gezegenin kendi matrisiyle döndürüldüğü için, normal
 * ve güneş aynı dönüşü yer. İkisinin iç çarpımı — yani bir noktanın
 * gündüz/gece durumu — görsel dönüşten bağımsız olarak sabit kalır.
 *
 * Sahne bu fonksiyonu her karede çağırır; doğrulayıcı da aynısını çağırır.
 */
export function sunDirectionInView(
  sunLocalDir: THREE.Vector3,
  carrierMatrixWorld: THREE.Matrix4,
  cameraMatrixWorldInverse: THREE.Matrix4,
  out: THREE.Vector3,
): THREE.Vector3 {
  return out
    .copy(sunLocalDir)
    .transformDirection(carrierMatrixWorld)
    .transformDirection(cameraMatrixWorldInverse);
}

/** QA zaman override'ı — YALNIZ development. */
export type PlanetTimeOverride = "day" | "sunset" | "night";

/**
 * Deterministik QA anları. Tarih ekinoksa sabitlenmiştir (deklinasyon ~0),
 * saatler Türkiye ekseninde (35°E) yerel öğle / gün batımı / gece yarısına
 * denk gelir. Production'da bu yol hiç çalışmaz.
 */
export function overrideUtcMsFor(mode: PlanetTimeOverride): number {
  if (mode === "day") return Date.UTC(2026, 2, 20, 9, 40, 0);
  if (mode === "sunset") return Date.UTC(2026, 2, 20, 15, 40, 0);
  return Date.UTC(2026, 2, 20, 21, 40, 0);
}

/**
 * Yalnız development'ta bir QA anı döndürür. Production build'de
 * `NODE_ENV` sabiti "production"a katlanır ve bu fonksiyon her zaman
 * null verir; gerçek UTC dışına çıkılamaz.
 */
export function devTimeOverrideUtcMs(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(window.location.search).get("planetTime");
  } catch {
    return null;
  }
  if (raw === "day" || raw === "sunset" || raw === "night") {
    return overrideUtcMsFor(raw);
  }
  return null;
}

/** Talepo paletine çevrilmiş sahne ayarları (GetLayers CONFIG'ten türetildi). */
const CONFIG = {
  rimColor: "#bff5ea",
  rimPower: 4.6,
  /* Işıklar artık yüzey rengiyle çarpılmadığı için kazanç yeniden
     ölçeklendi (15 → 0.9): yoğun çekirdek ~1.0'a doyar, sönük yerleşim
     ~0.03'te kalır. Patlamış beyaz leke üretmez. */
  nightLights: 2.4,
  terrainDepth: 0.33,
  terrainShade: 1.3,
  oceanGlint: 0.24,
  /* 0.62 gerçek okyanus dokusunu düz tonla eziyordu; 0.44'te batimetri
     ve kıyı sığlığı okunur kalır (kurucu, 2026-09-05). */
  oceanDeep: 0.44,
  oceanFlow: 2.2,
  oceanFlowSpeed: 0.8,
  oceanFlowScale: 2.1,
  glowColor: "#2dd4bf",
  glowIntensity: 0.8,
  planetRadius: 1.95,
  /** One revolution in roughly 8.7 minutes: visible, never attention-seeking. */
  spin: 0.012,
  initRotation: 2.07,
  tilt: 0.37,
  /* Taban opaklık gündüz için yükseltildi (kurucu, 2026-09-05); shader'daki
     cloudVis gecede 0.05'e indirdiği için referans gece görünümü korunur. */
  cloudLayers: [
    { height: 1.008, opacity: 0.55, spin: 0.05, ry: 0.0, phase: 0.0 },
  ],
  markerColor: "#7ceccb",
  markerCount: 26,
  markerSize: 13,
  markerSpeed: 0.5,
  signalColor: "#8ff0dc",
} as const;

export type PlanetStory = 0 | 1 | 2 | 3 | 4 | 5;

export type PlanetAnchor = {
  /** CSS-pixel coordinates relative to the renderer container. */
  x: number;
  y: number;
  visible: boolean;
};

/** Interaction-led sequence; unlike the old demo it never auto-plays at rest. */
const TIMELINE: Array<{ at: number; state: PlanetStory }> = [
  { at: 0, state: 0 },
  { at: 0.9, state: 1 },
  { at: 1.6, state: 2 },
  { at: 2.4, state: 3 },
  { at: 3.2, state: 4 },
  { at: 11.4, state: 0 },
];
const LOOP = 11.5;
const FOCUS_DURATION = 1.15;

const SNOISE = `
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }`;

function hexToVec3(hex: string): THREE.Vector3 {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  );
}

function tuneTexture(tex: THREE.Texture | null, renderer: THREE.WebGLRenderer) {
  if (!tex) return;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
}

function firstMesh(obj: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  obj.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
  });
  return found;
}

/** Find Türkiye directly in the GetLayers Earth texture atlas. */
function turkeySurfacePoint(geometry: THREE.BufferGeometry): THREE.Vector3 | null {
  const uv = geometry.attributes.uv as THREE.BufferAttribute | undefined;
  const position = geometry.attributes.position as THREE.BufferAttribute | undefined;
  if (!uv || !position) return null;
  /* This source is cube-atlas unwrapped, not equirectangular. The point below
     is central Anatolia in the bundled 6000px diffuse map. Keeping the anchor
     in mesh UV space means the light, beam and focus can never drift apart. */
  const targetU = 0.742;
  /* glTF textures use the atlas' top-origin V coordinate (GLTFLoader keeps
     flipY disabled), so this is 1765 / 6000 rather than its inverse. */
  const targetV = 0.294;
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < uv.count; i++) {
    const rawDu = Math.abs(uv.getX(i) - targetU);
    const du = Math.min(rawDu, 1 - rawDu);
    const dv = uv.getY(i) - targetV;
    const distance = du * du + dv * dv;
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best < 0
    ? null
    : new THREE.Vector3()
        .fromBufferAttribute(position, best)
        .multiplyScalar(1.018);
}

export type BroadcastPlanetHandle = {
  start: () => void;
  stop: () => void;
  resize: (w?: number, h?: number) => void;
  /** Composer'a yazılınca: döngüyü "talep yayınlandı" anına uyandır. */
  triggerBroadcast: () => void;
  /** Reduced-motion: yüklendiğinde tek kare çiz, döngü kurma. */
  renderSingleFrame: () => void;
  dispose: () => void;
};

export function createBroadcastPlanetScene(opts: {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  small: boolean;
  reducedMotion?: boolean;
  onStory: (s: PlanetStory) => void;
  onAnchor?: (anchor: PlanetAnchor) => void;
  onReady?: () => void;
  /** Kürenin boyutunu belirleyen REFERANS yükseklik (taşmayan kutu). */
  getFocusHeight?: () => number;
}): BroadcastPlanetHandle {
  const { canvas, container, small, onStory } = opts;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  /* Sahne arka planı YOK: dünya dışındaki her piksel gerçek alfa 0. */
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 90);
  const BASE_DIST = small ? 7.4 : 6.6;
  camera.position.set(0, 0, BASE_DIST);
  scene.add(camera);

  /* Kaynaktaki gibi düz aydınlatma: terminatörü DÜNYA ışığı değil,
     shader'daki view-space güneş çizer. */
  /* Gece dünyası: düz aydınlatma minimumda; yüzeyi şehir ışıkları taşır. */
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const sun = new THREE.DirectionalLight(0xffffff, 0.16);
  sun.position.set(0, 10, 2);
  scene.add(sun);

  const planetGroup = new THREE.Group();
  planetGroup.rotation.z = CONFIG.tilt;
  scene.add(planetGroup);
  const cloudGroup = new THREE.Group();
  cloudGroup.rotation.z = CONFIG.tilt;
  cloudGroup.visible = false;
  scene.add(cloudGroup);

  const planetTime = { value: 0 };
  const cloudTime = { value: 0 };
  const markerTime = { value: 0 };

  /* ---------- GÜNEŞ DURUMU ----------
     Tek uniform nesnesi hem gezegen hem bulut shader'ına verilir; iki yüzey
     asla farklı bir güneş görmez. Değer VIEW uzayındadır (vNormal de öyle).

     Astronomi ~60 saniyede bir hesaplanır (kurucu kuralı). View'a çevirme
     her karede yapılır ve YAPAY Y DÖNÜŞÜNÜ KOMPANSE EDER: güneş yönü
     modelin coğrafi çerçevesinde üretilip gezegenin kendi dünya matrisiyle
     taşındığı için, 8,7 dakikalık görsel dönüş Türkiye'nin gündüz/gece
     durumunu değiştiremez — aydınlatma coğrafyaya kilitlidir. */
  const SOLAR_REFRESH_MS = 60_000;
  const sunDirView = { value: new THREE.Vector3(-0.66, 0.4, -0.62).normalize() };
  /* Türkiye gecedeyken uzak gündüz yüzeyini sıkıştıran bağlamsal ağırlık.
     Gezegen ve bulut shader'ları AYNI nesneyi paylaşır. */
  const localNight = { value: 0 };
  const sunLocal = new THREE.Vector3(0, 0, 1);
  const cameraViewInverse = new THREE.Matrix4();
  let lonOffsetRad = 0;
  let lastSolarWallMs = Number.NEGATIVE_INFINITY;

  function refreshSolarLocal(force = false) {
    const wall = Date.now();
    if (!force && wall - lastSolarWallMs < SOLAR_REFRESH_MS) return;
    lastSolarWallMs = wall;
    const utcMs = devTimeOverrideUtcMs() ?? wall;
    const { declinationRad, subsolarLonRad } = solarAnglesForUtc(utcMs);
    geoDirection(declinationRad, subsolarLonRad, lonOffsetRad, sunLocal);
  }

  const turkeyNormalView = new THREE.Vector3();

  function updateSunUniform() {
    refreshSolarLocal();
    const carrier = planetMesh ?? planetGroup;
    camera.updateMatrixWorld();
    cameraViewInverse.copy(camera.matrixWorld).invert();
    sunDirectionInView(
      sunLocal,
      carrier.matrixWorld,
      cameraViewInverse,
      sunDirView.value,
    );

    if (!turkeyPoint || !planetMesh) return;

    /* Türkiye'nin aydınlanması, shader'ın gördüğü ZİNCİRİN AYNISINDAN
       ölçülür — yerel normal, gezegenin dünya matrisi, kamera view'i.
       Görsel dönüş sürerken bu değerin sabit kalması, aydınlatmanın
       coğrafyaya kilitli olduğunun kanıtıdır. */
    turkeyNormalView
      .copy(turkeyPoint)
      .transformDirection(planetMesh.matrixWorld)
      .transformDirection(cameraViewInverse);
    const turkeyNdl = turkeyNormalView.dot(sunDirView.value);
    localNight.value = localNightAmount(turkeyNdl);

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__talepoPlanetSun = {
        turkeyNdl,
        localNight: localNight.value,
        sunView: sunDirView.value.toArray(),
        rotationY: planetGroup.rotation.y,
        lonOffsetDeg: (lonOffsetRad * 180) / Math.PI,
      };
    }
  }

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  let planetMesh: THREE.Mesh | null = null;
  let planetMat: THREE.MeshStandardMaterial | null = null;
  let glowMesh: THREE.Mesh | null = null;
  let disposed = false;
  let planetRotationY: number = CONFIG.initRotation;
  let turkeyPoint: THREE.Vector3 | null = null;
  let turkeyFacingRotation: number = CONFIG.initRotation;
  let focusStartRotation: number = CONFIG.initRotation;

  /* Kaynaktaki alttan-yükselme girişi KALDIRILDI (dayanıklılık): ilk kare
     rAF beklenmeden senkron çizilir; beliriş React'te opaklıkla yapılır. */

  /* ---------- GÜNDÜZ/GECE/RIM/OKYANUS SHADER'I (GetLayers portu) ---------- */
  function applyPlanetShader(
    material: THREE.MeshStandardMaterial,
    nightTex: THREE.Texture | null,
  ) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.time = planetTime;
      shader.uniforms.uSunDirection = sunDirView;
      shader.uniforms.uLocalNight = localNight;
      shader.uniforms.noiseScale = { value: 30.0 };
      shader.uniforms.speedX = { value: 1.5 };
      shader.uniforms.speedY = { value: 2.0 };
      shader.uniforms.speedZ = { value: 2.5 };
      shader.uniforms.rimColor = { value: hexToVec3(CONFIG.rimColor) };
      shader.uniforms.rimPower = { value: CONFIG.rimPower };
      shader.uniforms.nightBlendTexture = { value: nightTex };
      shader.uniforms.hasNight = { value: nightTex ? 1 : 0 };
      shader.uniforms.nightLights = { value: CONFIG.nightLights };
      shader.uniforms.terrainDepth = { value: CONFIG.terrainDepth };
      shader.uniforms.terrainShade = { value: CONFIG.terrainShade };
      shader.uniforms.oceanGlint = { value: CONFIG.oceanGlint };
      shader.uniforms.oceanDeep = { value: CONFIG.oceanDeep };
      shader.uniforms.oceanFlow = { value: CONFIG.oceanFlow };
      shader.uniforms.oceanFlowSpeed = { value: CONFIG.oceanFlowSpeed };
      shader.uniforms.oceanFlowScale = { value: CONFIG.oceanFlowScale };
      shader.vertexShader = `varying vec2 vCustomUv;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "void main() {",
        "void main() {\n  vCustomUv = uv;",
      );
      shader.fragmentShader =
        `
        uniform float time; uniform float noiseScale; uniform float speedX; uniform float speedY; uniform float speedZ;
        uniform vec3 uSunDirection; uniform float uLocalNight;
        uniform vec3 rimColor; uniform float rimPower; uniform sampler2D nightBlendTexture; uniform float hasNight; uniform float nightLights;
        uniform float terrainDepth; uniform float terrainShade;
        uniform float oceanGlint; uniform float oceanDeep; uniform float oceanFlow;
        uniform float oceanFlowSpeed; uniform float oceanFlowScale;
        varying vec2 vCustomUv;
        ${SNOISE}
      ` + shader.fragmentShader;
      /* DENİZ, SIKIŞTIRILMIŞ ARAZİ HARİTALARINI KULLANMAZ (kurucu, 2026-09-05).

         ÖLÇÜLDÜ: paketteki earth_Normal 6000x6000'i 184 KB'a, earth_Diffuse
         574 KB'a sıkıştırılmış. Normal haritasında 4 piksellik blok ızgarası
         komşu farklarında 1.34 kat, diffuse'ta 1.56 kat baskın — yani her iki
         dokuda da kodlayıcının blok yapısı ölçülebilir durumda.

         Karada bu görünmez, çünkü arazi zaten yüksek frekanslıdır. Ama deniz
         bu ölçekte düz bir aynadır: blok sınırları yönlü ışık altında
         dikdörtgen fasetler hâline geliyordu — kurucunun ekran görüntüsündeki
         kutular tam olarak buydu.

         Çözüm dokuyu yapay olarak yumuşatmak değil, SU ÜZERİNDE arazi
         normalini ve pürüzlülüğünü hiç kullanmamak. Denizin yansımasını
         aşağıdaki kontrollü güneş parlaması sağlar. */
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        vec4 talepoSeaTex = texture2D(map, vCustomUv);
        float talepoSeaMask = clamp(
          smoothstep(-0.005, 0.03, talepoSeaTex.b - max(talepoSeaTex.r, talepoSeaTex.g)),
          0.0, 1.0);
        /* Su tamamen pürüzlü sayılır: standart materyalin keskin specular'ı
           blok fasetleri aydınlatamaz. */
        roughnessFactor = mix(roughnessFactor, 1.0, talepoSeaMask);`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        /* Su üzerinde normal haritası yerine düz küre normali kullanılır. */
        normal = normalize(mix(normal, normalize(vNormal), talepoSeaMask));`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        vec3 normalizedNormal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        /* Güneş terimleri EN BAŞTA hesaplanır: okyanus derinliği, arazi
           kabartması, palet ve rim'in hepsi gündüz miktarına bakar
           (kurucu, 2026-09-05). Güneş yönü gerçek UTC'den gelir ve view
           uzayına gezegenin kendi matrisiyle taşınır. */
        vec3 viewSunDir = normalize(uSunDirection);
        float ndl = dot(normalizedNormal, viewSunDir);
        /* Üç bölge yumuşak karışır — gündüz, alacakaranlık, gece. Hiçbir
           yerde sert terminatör çizgisi oluşmaz. */
        float dayAmt   = smoothstep(-0.06, 0.26, ndl);
        float nightAmt = 1.0 - dayAmt;
        float duskAmt  = exp(-(ndl * ndl) / 0.032);
        float rim = 1.0 - max(dot(viewDir, normalizedNormal), 0.0);
        rim = pow(rim, rimPower); rim = pow(rim, 1.5); rim *= 2.1;
        vec3 currentColor = gl_FragColor.rgb;
        /* SU MASKESİ sıkıştırma bloklarına duyarsız olmalı (kurucu, 2026-09-05).
           Dar pencere (-0.005..0.03) blok düzeyindeki minik renk basamaklarını
           görünür maske basamaklarına çeviriyordu; maske 0 ile 1 arasında
           kaldığı her yerde arazi kabartması denize sızıyordu. Kaba bir mip
           seviyesinden örnekleyip pencereyi genişletmek bunu kaynağında keser. */
        vec4 waterProbe = texture2D(map, vCustomUv, 2.0);
        float blueDom = waterProbe.b - max(waterProbe.r, waterProbe.g);
        float waterMask = clamp(smoothstep(-0.02, 0.06, blueDom), 0.0, 1.0);
        /* OKYANUS (kurucu, 2026-09-05).

           Önceki hâl deniz yüzeyini sahte gösteriyordu çünkü GLB diffuse
           haritasındaki GERÇEK okyanus görüntüsünü düz tek bir tonla
           %62 oranında boyuyordu; batimetri, şelf ve kıyı sığlığı farkı
           kayboluyordu. Ayrıca yüksek genlikli akış gürültüsü suyu
           lekeli gösteriyordu. Yeni asset gerekmedi — çözüm, kaynak
           dokunun kendi bilgisini geri getirmek. */

        /* Kaynak dokunun parlaklığı sığ/derin ayrımını taşır: derin abisal
           su koyu, şelf daha açık, kıyı sığlığı en açık. Hedef ton bu
           bilgiden türetilir, düz bir renkle ezilmez. */
        float seaLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 seaDeep    = vec3(0.014, 0.046, 0.072);
        vec3 seaShelf   = vec3(0.030, 0.094, 0.126);
        vec3 seaCoastal = vec3(0.058, 0.156, 0.170);
        vec3 seaDay = mix(seaDeep, seaShelf, smoothstep(0.05, 0.24, seaLum));
        seaDay = mix(seaDay, seaCoastal, smoothstep(0.24, 0.44, seaLum));
        /* Gece suyu neredeyse siyah kalır — onaylanan gece görünümü. */
        vec3 seaNight = vec3(0.014, 0.055, 0.050);
        /* Karışım %62 → %44: dokunun gerçek renk değişimi yüzeyde okunur. */
        gl_FragColor.rgb = mix(
          gl_FragColor.rgb,
          mix(seaNight, seaDay, dayAmt),
          waterMask * oceanDeep);

        /* Yüzey dokusu: dalga alanı görünür bir leke değil, çok hafif bir
           kırılma olmalı. Genlikler düşürüldü (shimmer 0.025 → 0.010,
           akış katkısı 0.12 → 0.045). */
        float shimmer = snoise(vec3(vCustomUv.x * noiseScale + time * speedX, vCustomUv.y * noiseScale - time * speedY, time * speedZ));
        gl_FragColor.rgb += waterMask * shimmer * 0.010;
        float fT = time * oceanFlowSpeed * 4.0;
        float fS = 4.0 * oceanFlowScale;
        float warp = snoise(vec3(vCustomUv.x * fS - fT * 0.5, vCustomUv.y * fS + fT * 0.4, fT * 0.5));
        float flow = snoise(vec3(vCustomUv.x * fS * 2.0 + fT * 0.6 + warp, vCustomUv.y * fS * 2.0 - fT * 0.5, fT * 0.7));
        flow = warp * 0.6 + flow * 0.4;
        gl_FragColor.rgb += waterMask * flow * 0.045 * oceanFlow;
        /* Kalan maviyi hafifçe yeşile çek — ama denizi teale boğma. */
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.82, 1.02, 0.98), waterMask * 0.55);
        gl_FragColor = vec4(gl_FragColor.rgb, 1.0);
        vec3 surfPos = -vViewPosition;
        /* Kabartma yüksekliği hafif yumuşatılmış bir mip'ten okunur: türev
           artık 4 piksellik kodlayıcı bloklarının kenarını görmez, büyük
           arazi formu korunur. */
        float terrH = dot(texture2D(map, vCustomUv, 0.75).rgb, vec3(0.299, 0.587, 0.114));
        vec3 sigX = dFdx(surfPos), sigY = dFdy(surfPos);
        vec3 vR1 = cross(sigY, normalizedNormal), vR2 = cross(normalizedNormal, sigX);
        float fDet = dot(sigX, vR1);
        vec3 vGrad = sign(fDet) * (dFdx(terrH) * vR1 + dFdy(terrH) * vR2);
        vec3 bumpedNormal = normalize(abs(fDet) * normalizedNormal - terrainDepth * vGrad);
        /* Kabartma yalnız karada ve yalnız gündüzde uygulanır. Gölgedeki
           yüzeyde zaten okunamaz; orada açık bırakmak yalnız blok artefaktı
           üretiyordu. */
        float bumpAllow = (1.0 - waterMask) * dayAmt;
        vec3 shadeNormal = mix(normalizedNormal, bumpedNormal, bumpAllow);
        /* ŞEHİR IŞIKLARI — gerçekçi emission (kurucu, 2026-09-05).

           ÖLÇÜLDÜ: earth_night_Diffuse 4000x4000 VP8, maksimum luminance 255,
           16 kovalı histogramda %99.09 karanlık ve kalan %0.99 sürekli bir
           düşüşle dağılıyor — yani doku ikili bir maske DEĞİL, gerçek bir
           yoğunluk gradyanı taşıyor. Işıklı piksellerin ortalaması (83,83,83),
           yani doku NÖTR; renk shader'da üretilmek zorunda.

           ESKİ KUSUR: doku, altındaki yüzey rengiyle (gl_FragColor.rgb)
           çarpılıp 15 ile ölçekleniyordu. Bu iki şeyi birden bozuyordu —
           ışık şiddeti topoğrafyaya bağlanıyor (kar/dağ bölgeleri yanlışlıkla
           aydınlanıyor), ve parlak arazi üzerinde sonuç 1.0'ı aşıp düz beyaz
           lekeye patlıyordu. Sorun çözünürlük veya kanal değil, bu çarpımdı.

           YENİ: ışık yalnız dokunun luminance'ından türer, yüzeyden bağımsızdır
           ve üç yoğunluk seviyesi smoothstep ile karışır — sert eşik yok. */
        float lightsRaw = hasNight > 0.5
          ? dot(texture2D(nightBlendTexture, vCustomUv).rgb, vec3(0.299, 0.587, 0.114))
          : 0.0;
        float tSettlement = smoothstep(0.010, 0.085, lightsRaw);
        float tCluster    = smoothstep(0.075, 0.300, lightsRaw);
        float tCore       = smoothstep(0.340, 0.800, lightsRaw);
        /* Doygun turuncu-amber → altın → sıcak beyaza yaklaşan çekirdek.
           Referans gece görselindeki gibi belirgin turuncu; mint YOK, o renk
           yalnız ışın, radar, Türkiye noktası ve durum arayüzüne aittir. */
        vec3 lightsTone = vec3(1.00, 0.42, 0.10);
        lightsTone = mix(lightsTone, vec3(1.00, 0.66, 0.22), tCluster);
        lightsTone = mix(lightsTone, vec3(1.00, 0.88, 0.62), tCore);
        /* Şiddet dokunun luminance ayrıntısını korur; çekirdek ayrı bir
           katkıyla küçük ve sıcak kalır. */
        float lightsAmp = tSettlement * (0.16 + 0.85 * lightsRaw) + tCore * 0.30;
        vec3 cityLights = lightsTone * lightsAmp * nightLights;
        /* HÂLE. Referans görselde şehir kümeleri çevrelerine gerçek bir ışık
           yayıyor. Bunu AYNI dokunun iki kaba mip seviyesinden üretiyoruz —
           yakın hâle kümeyi sarar, uzak hâle bölgeye genel bir parıltı verir.
           Composer/bloom zinciri EKLENMEZ; tek renderer yolunda kalır.
           Mipmap'ler tuneTexture'da zaten üretiliyor. */
        float haloNear = hasNight > 0.5
          ? dot(texture2D(nightBlendTexture, vCustomUv, 2.0).rgb, vec3(0.299, 0.587, 0.114))
          : 0.0;
        float haloFar = hasNight > 0.5
          ? dot(texture2D(nightBlendTexture, vCustomUv, 5.0).rgb, vec3(0.299, 0.587, 0.114))
          : 0.0;
        cityLights += lightsTone * smoothstep(0.008, 0.22, haloNear) * 0.34 * nightLights;
        cityLights += lightsTone * smoothstep(0.004, 0.12, haloFar) * 0.26 * nightLights;
        /* YUMUŞAK DOYUM. Kazanç referanstaki parlaklığa çıkarıldığı için
           çekirdekler 1.0'ı aşabilir; Reinhard tipi bir diz bunları düz beyaz
           diske patlatmadan doyurur. Patlamış leke bu satır sayesinde oluşmaz. */
        cityLights = cityLights / (1.0 + cityLights * 0.55);
        /* ARAZİ KABARTMASI. Gündüzde okunur, ama YÖNETMEZ. 2.05 yüzeyi
           metalik bir kabartma haritasına çeviriyordu; 1.45 hâlâ oyulmuş
           hissi bırakıyordu (kurucu, 2026-09-05). 1.20: mikro-kontrast ve
           normal sertliği ~%17 azalır, büyük coğrafi formlar okunmaya devam
           eder. Clamp aralığı da daraltılarak en sert vurgu/gölge uçları
           alınır — arazi DÜZLEŞTİRİLMEZ, yalnız yumuşar.
           GECE ETKİLENMEZ: gündüz ucu değişti, gece ucu 0.55 sabit. */
        float relief = dot(shadeNormal, viewSunDir) - ndl;
        float reliefStrength = terrainShade * mix(0.55, 1.20, dayAmt);
        gl_FragColor.rgb *= clamp(1.0 + relief * reliefStrength, 0.62, 1.46);
        /* BAĞLAMSAL SIKIŞTIRMA. Türkiye gecedeyken görünen yarımkürenin uzak
           ucundaki gündüz yüzeyi sunum pozlamasında bastırılır. Terminatöre
           yakın kuşak daha az bastırılır (0.62), tam gündüz daha çok (0.36),
           böylece geriye yalnız ince ve yumuşak bir şafak hilali kalır.
           Güneş geometrisi ve terminatörün yeri DEĞİŞMEZ. */
        float farDay = smoothstep(0.18, 0.62, ndl);
        float dayPresence = mix(1.0, mix(0.62, 0.36, farDay), uLocalNight);
        /* POZLAMA. Gece beğenilen referans seviyesinde kalır (0.156);
           gündüz 1.05'tir. Renderer'ın global exposure'ına DOKUNULMAZ;
           yalnız güneş alan katman değişir, hero'nun siyah/yeşil zemini
           korunur. */
        gl_FragColor.rgb *= mix(0.156, 1.05 * dayPresence, dayAmt);
        /* GÜNDÜZ KARA PALETİ. Orijinal diffuse renkleri BASKIN kalır — büyük
           coğrafi renk bölgeleri okunsun diye: bitki örtüsü koyu doğal
           zeytin-yeşil, çöl düşük doygunluklu sıcak taş, dağlar nötr
           kahverengi-gri. Yalnız doygunluk bir miktar düşürülür ve kırmızı
           kanal kısılarak çölün sarı parlaması alınır. Luminance rampasına
           dönüştürme YOK: gri/metal görünümün kaynağı oydu. */
        float dayLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 landDay = mix(vec3(dayLum), gl_FragColor.rgb, 0.74) * vec3(0.88, 0.97, 0.83);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, landDay, dayAmt * (1.0 - waterMask));
        /* Gündüz gölgelerinin tabanı hafifçe yükselir. dayAmt ile
           ölçeklendiği için terminatörü yumuşatmaz. */
        gl_FragColor.rgb += (1.0 - waterMask) * dayAmt * dayPresence * 0.030 * vec3(0.66, 0.80, 0.68);
        /* KAR CLAMP'İ. Yalnız KAR sıkıştırılır: yüksek ışıklılık VE düşük
           doygunluk birlikte arandığı için açık ama renkli arazi (çöl, bozkır)
           kar gibi beyazlaşmaz. Şehir ışıkları ve rim BUNDAN SONRA eklenir. */
        float hiLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        float hiMax = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);
        float hiMin = min(min(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);
        float hiSat = (hiMax - hiMin) / max(hiMax, 1e-4);
        float snowish = smoothstep(0.42, 0.78, hiLum) * (1.0 - smoothstep(0.10, 0.32, hiSat));
        gl_FragColor.rgb *= mix(1.0, 0.55, snowish * dayAmt);
        /* Güvenlik tavanı: patlamayı keser, renkli araziyi düzleştirmez. */
        gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(0.86, 0.88, 0.83));
        /* Kara siluetleri gecede de okunsun (kurucu, 2026-09-04): kıtalara
           çok hafif mint-nötr bir taban ışık; okyanus koyu kalır. */
        /* GECE KARASI referanstaki gibi soğuk mavi-griye kayar: aydınlanmamış
           yüzey kahverengi görünmez, doku detayı luminance olarak korunur.
           Gündüz tarafı nightAmt ile dışarıda kalır. */
        float nightLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, nightLum * vec3(0.76, 0.90, 1.20), nightAmt * 0.72);
        gl_FragColor.rgb += (1.0 - waterMask) * nightAmt * 0.055 * vec3(0.55, 0.70, 0.95);
        /* GECE KOMPOZİSYONUNDA YÜZEY GERİ ÇEKİLİR. Ölçüldü (2026-09-05):
           gece karesinde görünen diskin yalnız %11.9'u gündüzdür ve en parlak
           nokta ekran dışındaki sağ limbdedir — soldaki parlaklık gündüz
           yüzeyi değil, fazla öne çıkmış GECE yüzeyiydi. Türkiye gecedeyken
           kara yüzeyi kısılır; şehir ışıkları BUNDAN SONRA eklendiği için
           yüzeyden baskın hâle gelir. Şehir ışığı dağılımı değişmez. */
        gl_FragColor.rgb *= mix(1.0, mix(0.52, 1.0, dayAmt), uLocalNight * nightAmt);
        /* ŞEHİR IŞIKLARI kademeli karışır: tam gündüzde neredeyse sıfır,
           alacakaranlıkta kısmen görünür, gecede mevcut seviyede. Kare
           alınarak gündüze doğru daha hızlı söner. */
        float lightsFactor = smoothstep(0.34, -0.10, ndl);
        lightsFactor *= lightsFactor;
        gl_FragColor.rgb += cityLights * lightsFactor;
        /* DENİZ YANSIMASI (kurucu, 2026-09-05).

           ÖNCEKİ KUSUR: 240x UV frekanslı gürültü doğrudan specular üssünün
           girdisine ekleniyordu. Küre üzerinde yumuşak değişen bir terimin
           içine bu kadar yüksek frekans girince tek bir güneş yansıması
           yerine noktalı bir mozaik — pullu, sahte bir parıltı alanı —
           oluşuyordu.

           GERÇEK deniz yansıması tek, uzamış ve yumuşak bir parlamadır:
           geniş bir taban lobu ile daha dar bir çekirdek. Dalga alanı
           artık üsse değil, yalnız parlamanın ŞİDDETİNE ve düşük frekansta
           uygulanır; böylece kenarı doğal biçimde kırılır ama nokta deseni
           üretmez. */
        vec3 halfDir = normalize(viewSunDir + viewDir);
        float ndh = max(dot(normalizedNormal, halfDir), 0.0);
        float glintBroad = pow(ndh, 30.0);
        float glintCore = pow(ndh, 170.0);
        float swell = snoise(vec3(vCustomUv * 16.0, time * 0.45)) * 0.5 + 0.5;
        float glint = glintBroad * (0.55 + 0.45 * swell) * 0.42 + glintCore * 0.85;
        gl_FragColor.rgb += glint * waterMask * dayAmt * oceanGlint * 1.7 * vec3(0.94, 0.98, 1.0);
        /* ATMOSFER RIM'İ çember boyunca aynı değildir: güneş alan limb daha
           parlak ve nötr-mint, gece limbi daha ince ve koyu teal, terminatör
           kuşağı sıcak-mint. Mint baskın kalır; turuncu uzay demosu tonuna
           kaçmaz. */
        /* Beyaz karışımı 0.45 → 0.28: güneş alan üst limbdeki beyaz patlama
           azalır, mint atmosfer korunur. */
        vec3 dayRim   = mix(rimColor, vec3(0.94, 1.00, 0.97), 0.28);
        vec3 nightRim = vec3(0.24, 0.52, 0.50);
        vec3 duskRim  = mix(rimColor, vec3(1.00, 0.84, 0.63), 0.42);
        vec3 rimTint  = mix(nightRim, dayRim, dayAmt);
        rimTint = mix(rimTint, duskRim, duskAmt * 0.75);
        /* Gündüz kazancı 1.55 → 1.28 (~%17 daha az). Gece kompozisyonunda
           gündüz limbi ayrıca sıkışır, böylece rim geniş beyaz bant değil
           ince mint-teal çizgi olarak kalır. */
        float rimGain = mix(0.58, 1.28, dayAmt) + duskAmt * 0.22;
        rimGain *= mix(1.0, mix(1.0, 0.45, dayAmt), uLocalNight);
        gl_FragColor.rgb += rimTint * rim * rimGain;
      `,
      );
    };
    material.needsUpdate = true;
  }

  /* ---------- ATMOSFER GLOW (kaynak billboard'ı, düşük yoğunluk) ---------- */
  function addAtmosphereGlow(radius: number) {
    const g = track(new THREE.PlaneGeometry(2, 2));
    const glowMat = track(
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uGlow: { value: hexToVec3(CONFIG.glowColor) },
          uIntensity: { value: CONFIG.glowIntensity },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uGlow; uniform float uIntensity; varying vec2 vUv;
        void main(){
          float d = length(vUv - 0.5) * 2.0;
          /* Halo disk kenarından ÖNCE tam sıfıra iner; billboard'ın kare
             sınırı hiçbir yoğunlukta okunamaz. */
          float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
          a *= smoothstep(1.0, 0.82, d);
          gl_FragColor = vec4(uGlow * a * uIntensity, a);
        }`,
      }),
    );
    glowMesh = new THREE.Mesh(g, glowMat);
    glowMesh.scale.setScalar(radius * 1.62);
    glowMesh.position.copy(planetGroup.position);
    scene.add(glowMesh);
  }

  /* ---------- YÖRÜNGE AĞI (Talepo, 2026-09-04) ----------
     Dünya tek başına boş durmasın: iki ince eğik yörünge halkası, üzerinde
     yavaşça dolaşan birkaç düğüm ve kameraya sabit çok soluk ışık zerreleri.
     Hepsi additive ve düşük yoğunluk — dashboard/oyun estetiği değil,
     "işleyen bir ağ" hissi. */
  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);
  const orbitNodes: Array<{
    mesh: THREE.Mesh;
    radius: number;
    speed: number;
    phase: number;
    tilt: THREE.Euler;
  }> = [];

  function addOrbitNetwork() {
    const col = new THREE.Color(CONFIG.signalColor);
    const rings = [
      { r: CONFIG.planetRadius * 1.42, tilt: new THREE.Euler(1.18, 0.0, 0.42), op: 0.16 },
      { r: CONFIG.planetRadius * 1.76, tilt: new THREE.Euler(1.02, 0.55, -0.2), op: 0.1 },
    ];
    for (const ring of rings) {
      const geo = track(new THREE.RingGeometry(ring.r, ring.r + 0.008, 128));
      const mat = track(
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: ring.op,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.copy(ring.tilt);
      orbitGroup.add(mesh);
    }
    /* Yörünge düğümleri: ağın canlı olduğunu gösteren birkaç ışık. */
    const nodeGeo = track(new THREE.SphereGeometry(0.035, 12, 12));
    const nodeMat = track(
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const specs = [
      { radius: rings[0]!.r, speed: 0.12, phase: 0.0, tilt: rings[0]!.tilt },
      { radius: rings[0]!.r, speed: 0.12, phase: 2.4, tilt: rings[0]!.tilt },
      { radius: rings[1]!.r, speed: -0.08, phase: 1.1, tilt: rings[1]!.tilt },
    ];
    for (const spec of specs) {
      const mesh = new THREE.Mesh(nodeGeo, nodeMat);
      orbitGroup.add(mesh);
      orbitNodes.push({ ...spec, mesh });
    }
  }
  addOrbitNetwork();
  /* The approved hero keeps the idle globe clean; legacy orbit geometry stays
     out of the render while this branch remains easy to compare/revert. */
  orbitGroup.visible = false;

  /* Işık zerreleri: kamera önünde çok soluk, yavaş süzülen noktalar. */
  let moteMat: THREE.ShaderMaterial | null = null;
  const moteTime = { value: 0 };
  function addMotes() {
    const N = small ? 90 : 190;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    let st = 7;
    const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd() * 2 - 1) * 5.2;
      pos[i * 3 + 1] = (rnd() * 2 - 1) * 3.4;
      pos[i * 3 + 2] = (rnd() * 2 - 1) * 2.6 - 1.2;
      seed[i] = rnd();
    }
    const g = track(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.Float32BufferAttribute(seed, 1));
    moteMat = track(
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: moteTime,
          uColor: { value: hexToVec3(CONFIG.signalColor) },
        },
        vertexShader: `
        attribute float seed; uniform float uTime; varying float vA;
        void main(){
          vec3 p = position;
          p.y += sin(uTime * 0.18 + seed * 6.28) * 0.22;
          p.x += cos(uTime * 0.12 + seed * 5.13) * 0.16;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = 0.25 + 0.4 * abs(sin(uTime * 0.5 + seed * 6.28));
          gl_PointSize = (1.6 + seed * 2.2) * (6.0 / max(-mv.z, 1.0)) * 6.0;
          gl_Position = projectionMatrix * mv;
        }`,
        fragmentShader: `
        uniform vec3 uColor; varying float vA;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float l = length(d); if (l > 0.5) discard;
          float core = smoothstep(0.5, 0.0, l);
          gl_FragColor = vec4(uColor, core * vA * 0.28);
        }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    );
    const pts = new THREE.Points(g, moteMat);
    pts.frustumCulled = false;
    pts.visible = false;
    scene.add(pts);
  }
  addMotes();

  /* ---------- BULUTLAR (kaynaktan; 2 katmana sadeleştirildi) ---------- */
  const cloudMeshes: Array<{
    mesh: THREE.Mesh;
    spin: number;
    phase: number;
  }> = [];
  function addClouds() {
    const tex = track(
      new THREE.TextureLoader().load(`${ASSET_BASE}/planet-clouds.png`),
    );
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    tuneTexture(tex, renderer);
    for (const layer of CONFIG.cloudLayers) {
      const g = track(
        new THREE.SphereGeometry(
          CONFIG.planetRadius * layer.height,
          small ? 40 : 64,
          small ? 40 : 64,
        ),
      );
      const mat = track(
        new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
        }),
      );
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = cloudTime;
        /* Gezegenle AYNI uniform nesnesi: iki yüzey tek güneşi paylaşır. */
        shader.uniforms.uSunDirection = sunDirView;
        shader.uniforms.uLocalNight = localNight;
        shader.uniforms.noiseScale = { value: 20.0 };
        shader.uniforms.uSpeedX = { value: 1.0 };
        shader.uniforms.uSpeedY = { value: 2.0 };
        shader.uniforms.uSpeedZ = { value: 2.0 };
        shader.uniforms.uOpacity = { value: layer.opacity };
        shader.uniforms.uPhase = { value: layer.phase };
        shader.vertexShader = `varying vec2 vCloudUv;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "void main() {",
          "void main() {\n  vCloudUv = uv;",
        );
        shader.fragmentShader =
          `
          uniform vec3 uSunDirection; uniform float uLocalNight;
          uniform float uTime; uniform float noiseScale; uniform float uSpeedX; uniform float uSpeedY; uniform float uSpeedZ; uniform float uOpacity; uniform float uPhase;
          varying vec2 vCloudUv;
          ${SNOISE}
        ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          float cloudNoise = snoise(vec3(vCloudUv.x * noiseScale + uTime * uSpeedX + uPhase, vCloudUv.y * noiseScale - uTime * uSpeedY + uPhase, uTime * uSpeedZ + uPhase));
          float cloudNdv = max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0);
          float cloudEdge = pow(1.0 - cloudNdv, 3.0);
          /* snoise -1..1 aralığındadır; kırpılmadan opaklığa çarpılınca
             bulutun yarısı görünmez oluyordu. Gündüz katmanı için pozitif
             aralığa alınır. */
          float cloudMod = mix(cloudNoise * 0.5 + 0.5, 0.42, cloudEdge);
          /* Gezegenle AYNI üç bölge: bulutlar gündüzü ele veren katmandır. */
          float cloudNdl  = dot(normalize(vNormal), normalize(uSunDirection));
          float cloudDay  = smoothstep(-0.06, 0.26, cloudNdl);
          float cloudDusk = exp(-(cloudNdl * cloudNdl) / 0.032);
          /* Gündüz yumuşak beyaz-mint, gece mint'e düşen çok soluk bir nem.
             Düşük kontrast: 0.86 ile 0.97 arası, parlak beyaz değil. */
          gl_FragColor.rgb = mix(vec3(0.74, 0.88, 0.86), vec3(0.95, 0.97, 0.94), cloudDay);
          /* Opaklık gündüzde görünür, gecede çok düşük, gün batımında arada. */
          float cloudVis = mix(0.05, 1.0, cloudDay) + cloudDusk * 0.10;
          /* Türkiye gecedeyken uzak gündüz bulutları da kompozisyonu ele
             geçirmesin — gezegen yüzeyiyle aynı bağlamsal sıkıştırma. */
          cloudVis *= mix(1.0, mix(1.0, 0.34, cloudDay), uLocalNight);
          gl_FragColor.a *= cloudMod * uOpacity * cloudVis;
        `,
        );
      };
      mat.needsUpdate = true;
      const clouds = new THREE.Mesh(g, mat);
      clouds.rotation.y = layer.ry;
      clouds.renderOrder = 2;
      cloudGroup.add(clouds);
      cloudMeshes.push({ mesh: clouds, spin: layer.spin, phase: layer.ry });
    }
  }
  addClouds();

  /* ---------- KARA MARKER ÖRNEKLEMESİ (kaynak algoritması) ---------- */
  type LandPoint = THREE.Vector3;
  let landPoints: LandPoint[] = [];
  let markerPoints: THREE.Points | null = null;

  function sampleLand(mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial) {
    const tex = mat.map;
    const img = tex?.image as
      | { width?: number; height?: number }
      | HTMLImageElement
      | ImageBitmap
      | undefined;
    if (!tex || !img) return;
    const W = Math.min((img as { width?: number }).width || 1024, 1024);
    const H = Math.min((img as { height?: number }).height || 512, 512);
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const cctx = cv.getContext("2d");
    if (!cctx) return;
    try {
      cctx.drawImage(img as CanvasImageSource, 0, 0, W, H);
    } catch {
      return;
    }
    let px: Uint8ClampedArray;
    try {
      px = cctx.getImageData(0, 0, W, H).data;
    } catch {
      return;
    }
    const geom = mesh.geometry;
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const uv = geom.attributes.uv as THREE.BufferAttribute | undefined;
    if (!uv) return;
    const index = geom.index;
    const triCount = index ? index.count / 3 : pos.count / 3;
    const triIdx = (t: number, k: number) =>
      index ? index.getX(t * 3 + k) : t * 3 + k;
    const cum = new Float32Array(triCount);
    const A = new THREE.Vector3(),
      B = new THREE.Vector3(),
      C = new THREE.Vector3(),
      e1 = new THREE.Vector3(),
      e2 = new THREE.Vector3();
    let total = 0;
    for (let t = 0; t < triCount; t++) {
      A.fromBufferAttribute(pos, triIdx(t, 0));
      B.fromBufferAttribute(pos, triIdx(t, 1));
      C.fromBufferAttribute(pos, triIdx(t, 2));
      e1.subVectors(B, A);
      e2.subVectors(C, A);
      total += e1.cross(e2).length() * 0.5;
      cum[t] = total;
    }
    /* Deterministik örnekleme — her yüklemede aynı dağılım. */
    let seedState = 42;
    const rand = () => {
      seedState = (seedState * 1664525 + 1013904223) >>> 0;
      return seedState / 4294967296;
    };
    const pickTri = () => {
      const rnd = rand() * total;
      let lo = 0,
        hi = triCount - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (cum[m]! < rnd) lo = m + 1;
        else hi = m;
      }
      return lo;
    };
    const want = CONFIG.markerCount;
    const uvA = new THREE.Vector2(),
      uvB = new THREE.Vector2(),
      uvC = new THREE.Vector2();
    const lift = 1.012;
    let attempts = 0;
    const maxAtt = want * 400 + 2000;
    const out: LandPoint[] = [];
    while (out.length < want && attempts < maxAtt) {
      attempts++;
      const t = pickTri();
      const i0 = triIdx(t, 0),
        i1 = triIdx(t, 1),
        i2 = triIdx(t, 2);
      let r1 = rand(),
        r2 = rand();
      if (r1 + r2 > 1) {
        r1 = 1 - r1;
        r2 = 1 - r2;
      }
      const w0 = 1 - r1 - r2;
      uvA.fromBufferAttribute(uv, i0);
      uvB.fromBufferAttribute(uv, i1);
      uvC.fromBufferAttribute(uv, i2);
      const u = uvA.x * w0 + uvB.x * r1 + uvC.x * r2;
      const vv = uvA.y * w0 + uvB.y * r1 + uvC.y * r2;
      const sx = Math.min(W - 1, Math.max(0, (u * W) | 0));
      const sy = Math.min(H - 1, Math.max(0, ((1 - vv) * H) | 0));
      const o = (sy * W + sx) * 4;
      const cr = px[o]!,
        cg = px[o + 1]!,
        cb = px[o + 2]!;
      if (cb > cr + 6 && cb > cg + 6) continue;
      A.fromBufferAttribute(pos, i0);
      B.fromBufferAttribute(pos, i1);
      C.fromBufferAttribute(pos, i2);
      out.push(
        new THREE.Vector3(
          (A.x * w0 + B.x * r1 + C.x * r2) * lift,
          (A.y * w0 + B.y * r1 + C.y * r2) * lift,
          (A.z * w0 + B.z * r1 + C.z * r2) * lift,
        ),
      );
    }
    landPoints = out;
  }

  function addMarkers(mesh: THREE.Mesh) {
    if (landPoints.length === 0) return;
    const positions: number[] = [];
    const seeds: number[] = [];
    landPoints.forEach((p, i) => {
      positions.push(p.x, p.y, p.z);
      seeds.push((i * 0.61803) % 1);
    });
    const g = track(new THREE.BufferGeometry());
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    g.setAttribute("seed", new THREE.Float32BufferAttribute(seeds, 1));
    const markerMat = track(
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: markerTime,
          uColor: { value: hexToVec3(CONFIG.markerColor) },
          uSize: { value: CONFIG.markerSize },
          uSpeed: { value: CONFIG.markerSpeed },
          uRes: {
            value: new THREE.Vector2(
              renderer.domElement.width,
              renderer.domElement.height,
            ),
          },
        },
        vertexShader: `
        attribute float seed; uniform float uSize; uniform vec2 uRes;
        varying float vSeed; varying float vFade;
        void main(){
          vSeed = seed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 vn = normalize(normalMatrix * normalize(position));
          vec3 vd = normalize(-mv.xyz);
          vFade = smoothstep(0.15, 0.5, dot(vn, vd));
          gl_PointSize = max(uSize * uRes.y / 900.0 * (7.0 / max(-mv.z, 1.0)), 2.0);
          gl_Position = projectionMatrix * mv;
        }`,
        fragmentShader: `
        uniform vec3 uColor; uniform float uTime; uniform float uSpeed;
        varying float vSeed; varying float vFade;
        void main(){
          if (vFade <= 0.001) discard;
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p) * 2.0;
          if (d > 1.0) discard;
          float core = smoothstep(0.30, 0.0, d) * 1.2;
          float ph = fract(uTime * uSpeed + vSeed);
          float ring = smoothstep(0.07, 0.0, abs(d - ph)) * (1.0 - ph);
          gl_FragColor = vec4(uColor, clamp(core + ring, 0.0, 1.0) * vFade);
        }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    );
    markerPoints = new THREE.Points(g, markerMat);
    markerPoints.frustumCulled = false;
    markerPoints.visible = false;
    mesh.add(markerPoints);
  }

  /* ---------- TALEPO YAYIN KATMANI (özgün — hikâyeyi anlatır) ----------
     Köken + 4 hedef kara noktası; kökenden radar halkası, hedeflere kavisli
     sinyal yolları, dönüşte köken yönünde akan teklif noktaları. */
  const broadcast = {
    origin: null as THREE.Vector3 | null,
    targets: [] as THREE.Vector3[],
    curves: [] as THREE.QuadraticBezierCurve3[],
    lines: [] as THREE.Line[],
    lineGeos: [] as THREE.BufferGeometry[],
    returnDots: null as THREE.Points | null,
    ringMesh: null as THREE.Mesh | null,
    ringMat: null as THREE.ShaderMaterial | null,
    group: new THREE.Group(),
  };
  const SIGNAL_SEGS = 48;

  function setupBroadcast(mesh: THREE.Mesh) {
    if (landPoints.length < 8) return;
    /* Köken: kameraya dönük üst-sol bölgeye en yakın kara noktası
       (initRotation sonrası). Hedefler: kökenden en uzak, birbirinden
       ayrık 4 nokta — deterministik. */
    const rotated = landPoints.map((p) =>
      p
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), CONFIG.initRotation),
    );
    const ideal = new THREE.Vector3(-0.35, 0.55, 0.75).normalize();
    let bestI = 0;
    let bestD = -Infinity;
    rotated.forEach((p, i) => {
      const d = p.clone().normalize().dot(ideal);
      if (d > bestD) {
        bestD = d;
        bestI = i;
      }
    });
    broadcast.origin = landPoints[bestI]!.clone();
    const chosen: number[] = [];
    const originN = landPoints[bestI]!.clone().normalize();
    const cands = landPoints
      .map((p, i) => ({ i, a: p.clone().normalize().dot(originN) }))
      .filter((c) => c.i !== bestI)
      .sort((a, b) => a.a - b.a);
    for (const c of cands) {
      if (chosen.length >= 4) break;
      const pN = landPoints[c.i]!.clone().normalize();
      if (
        chosen.every(
          (j) => landPoints[j]!.clone().normalize().dot(pN) < 0.75,
        )
      ) {
        chosen.push(c.i);
      }
    }
    broadcast.targets = chosen.map((i) => landPoints[i]!.clone());

    const signalCol = new THREE.Color(CONFIG.signalColor);
    for (const target of broadcast.targets) {
      const mid = broadcast.origin
        .clone()
        .add(target)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(1.45);
      const curve = new THREE.QuadraticBezierCurve3(
        broadcast.origin.clone(),
        mid,
        target.clone(),
      );
      broadcast.curves.push(curve);
      const pts = curve.getPoints(SIGNAL_SEGS);
      const geo = track(new THREE.BufferGeometry().setFromPoints(pts));
      geo.setDrawRange(0, 0);
      const mat = track(
        new THREE.LineBasicMaterial({
          color: signalCol,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      broadcast.lines.push(line);
      broadcast.lineGeos.push(geo);
      broadcast.group.add(line);
    }

    /* Dönen teklif noktaları: eğri başına bir parlak nokta. */
    const dotGeo = track(new THREE.BufferGeometry());
    dotGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        new Float32Array(broadcast.targets.length * 3),
        3,
      ),
    );
    const dotMat = track(
      new THREE.PointsMaterial({
        color: signalCol,
        size: 0.09,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    broadcast.returnDots = new THREE.Points(dotGeo, dotMat);
    broadcast.returnDots.frustumCulled = false;
    broadcast.group.add(broadcast.returnDots);

    /* Köken radar halkası: yüzeye teğet, büyüyüp sönen disk. */
    const ringGeo = track(new THREE.RingGeometry(0.96, 1.0, 48));
    broadcast.ringMat = track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: hexToVec3(CONFIG.signalColor) },
          uAlpha: { value: 0 },
        },
        vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uAlpha; void main(){ gl_FragColor = vec4(uColor, uAlpha); }`,
      }),
    );
    broadcast.ringMesh = new THREE.Mesh(ringGeo, broadcast.ringMat);
    const n = broadcast.origin.clone().normalize();
    broadcast.ringMesh.position.copy(
      broadcast.origin.clone().multiplyScalar(1.01),
    );
    broadcast.ringMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      n,
    );
    broadcast.ringMesh.scale.setScalar(0.001);
    broadcast.group.add(broadcast.ringMesh);

    /* Signal/pulse is rendered once in the DOM from the projected Türkiye
       anchor. Hide the old four-target WebGL narrative to avoid duplicates. */
    broadcast.group.visible = false;
    mesh.add(broadcast.group);
  }

  /* ---------- YÜKLEME ---------- */
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(draco);

  function buildPlanet(nightTex: THREE.Texture | null) {
    gltfLoader.load(
      `${ASSET_BASE}/planet.glb`,
      (gltf) => {
        if (disposed) return;
        const mesh = firstMesh(gltf.scene);
        if (!mesh) return;
        mesh.geometry.computeBoundingSphere();
        const r = mesh.geometry.boundingSphere
          ? mesh.geometry.boundingSphere.radius
          : 1;
        const s = CONFIG.planetRadius / r;
        const srcMat = mesh.material as THREE.MeshStandardMaterial;
        planetMat = srcMat.clone();
        planetMat.metalness = 0.0;
        planetMat.roughness = 1.0;
        planetMat.envMapIntensity = 0.0;
        tuneTexture(planetMat.map, renderer);
        tuneTexture(planetMat.normalMap, renderer);
        tuneTexture(planetMat.roughnessMap, renderer);
        tuneTexture(nightTex, renderer);
        track(planetMat);
        track(mesh.geometry);
        applyPlanetShader(planetMat, nightTex);
        planetMesh = new THREE.Mesh(mesh.geometry, planetMat);
        planetMesh.scale.setScalar(s);
        planetGroup.add(planetMesh);
        turkeyPoint = turkeySurfacePoint(mesh.geometry);
        if (turkeyPoint) {
          /* Rotate the selected surface vector onto the camera-facing +Z axis.
             The DOM beam and radar are projected from this exact same point. */
          /* Keep Türkiye on the globe's upper-left quadrant rather than dead
             centre: the short composer beam and nearby response rail stay in
             frame at both wide and tablet breakpoints. */
          turkeyFacingRotation = Math.atan2(-turkeyPoint.x, turkeyPoint.z) - 0.92;
          planetRotationY = turkeyFacingRotation;
          focusStartRotation = turkeyFacingRotation;
          planetGroup.rotation.y = planetRotationY;
          /* Coğrafi çerçeveyi aynı çapadan kalibre et: ışık ve radar noktası
             tek kaynaktan türediği için birbirinden ayrışamaz. */
          lonOffsetRad = calibrateLongitudeOffset(turkeyPoint);
          refreshSolarLocal(true);
          if (process.env.NODE_ENV !== "production") {
            /* +Y kutup varsayımının denetimi: bu değer 39'a yakın değilse
               modelin ekseni farklıdır ve aydınlatma coğrafyaya oturmaz. */
            console.info(
              "[planet] kalibrasyon — ima edilen enlem:",
              impliedLatitudeDeg(turkeyPoint).toFixed(2),
              "beklenen:",
              TURKEY_LAT_DEG,
            );
          }
        }
        const armLand = () => {
          if (disposed || !planetMesh || !planetMat) return;
          sampleLand(planetMesh, planetMat);
          addMarkers(planetMesh);
          setupBroadcast(planetMesh);
        };
        const mapTex = planetMat.map;
        if (mapTex?.image) armLand();
        else if (mapTex) {
          /* Doku hazır değilse hata verme — hazır olunca örnekle. */
          const check = window.setInterval(() => {
            if (disposed) {
              window.clearInterval(check);
              return;
            }
            if (mapTex.image) {
              window.clearInterval(check);
              armLand();
            }
          }, 120);
        }
        addAtmosphereGlow(CONFIG.planetRadius);
        cloudGroup.visible = true;
        /* rAF gecikse bile küre anında görünsün. */
        frame(0);
        opts.onReady?.();
      },
      undefined,
      () => {
        /* Dünya yüklenemedi: sahne boş kalır; React katmanındaki statik
           fallback görünmeye devam eder — hero bozulmaz. */
      },
    );
  }

  gltfLoader.load(
    `${ASSET_BASE}/planet-lights.glb`,
    (lights) => {
      if (disposed) return;
      const lmesh = firstMesh(lights.scene);
      const nightTex =
        lmesh && (lmesh.material as THREE.MeshStandardMaterial)?.map
          ? (lmesh.material as THREE.MeshStandardMaterial).map
          : null;
      if (nightTex) track(nightTex);
      buildPlanet(nightTex);
    },
    undefined,
    () => {
      /* Gece ışıkları yüklenemezse dünya gündüz materyaliyle devam eder. */
      if (!disposed) buildPlanet(null);
    },
  );

  /* ---------- HİKÂYE + DÖNGÜ ---------- */
  let currentState: PlanetStory = 0;
  let raf = 0;
  let running = false;
  let lastNow = 0;
  let clock = 0;
  let broadcasting = false;

  const stateAt = (t: number): PlanetStory => {
    let s: PlanetStory = 0;
    for (const row of TIMELINE) if (t >= row.at) s = row.state;
    return s;
  };
  const projectedAnchor = new THREE.Vector3();
  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function frame(dt: number) {
    planetTime.value += dt / 12;
    cloudTime.value += dt / 20;
    markerTime.value += dt;
    if (broadcasting) {
      clock += dt;
      if (opts.reducedMotion) {
        planetRotationY = turkeyFacingRotation;
      } else {
        const progress = Math.min(clock / FOCUS_DURATION, 1);
        const delta = Math.atan2(
          Math.sin(turkeyFacingRotation - focusStartRotation),
          Math.cos(turkeyFacingRotation - focusStartRotation),
        );
        planetRotationY =
          focusStartRotation + delta * easeInOutCubic(progress);
      }
      if (clock >= LOOP) {
        broadcasting = false;
        clock = 0;
      }
    } else if (!opts.reducedMotion) {
      planetRotationY += dt * CONFIG.spin;
    }
    planetGroup.rotation.y = planetRotationY;
    for (const cl of cloudMeshes) {
      cl.phase += dt * cl.spin;
      cl.mesh.rotation.y = cl.phase;
    }
    if (glowMesh) glowMesh.quaternion.copy(camera.quaternion);

    const s = broadcasting ? stateAt(clock) : 0;
    if (s !== currentState) {
      currentState = s;
      onStory(s);
    }

    scene.updateMatrixWorld(true);
    /* Reduced-motion yalnız hareketi kapatır; doğru saat aydınlatması tek
       karede de çalışsın diye güneş her çizimde tazelenir (astronomi kendi
       60 saniyelik eşiğiyle korunur). */
    updateSunUniform();

    if (planetMesh && turkeyPoint && opts.onAnchor) {
      projectedAnchor.copy(turkeyPoint);
      planetMesh.localToWorld(projectedAnchor);
      projectedAnchor.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      opts.onAnchor({
        x: (projectedAnchor.x * 0.5 + 0.5) * rect.width,
        y: (-projectedAnchor.y * 0.5 + 0.5) * rect.height,
        visible:
          projectedAnchor.z > -1 &&
          projectedAnchor.z < 1 &&
          projectedAnchor.x > -1.1 &&
          projectedAnchor.x < 1.1 &&
          projectedAnchor.y > -1.1 &&
          projectedAnchor.y < 1.1,
      });
    }

    renderer.render(scene, camera);
  }

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    frame(dt);
  };

  function resize(cw?: number, ch?: number) {
    const rect = container.getBoundingClientRect();
    const w = Math.max(cw ?? rect.width, 1);
    const h = Math.max(ch ?? rect.height, 1);
    /* Kurucu DPR politikası: masaüstü min(max(dpr,1.75),2);
       mobil min(max(dpr,1.5),1.75). Reduced-motion çözünürlüğü DÜŞÜRMEZ. */
    const raw = window.devicePixelRatio || 1;
    const dpr = small
      ? Math.min(Math.max(raw, 1.5), 1.75)
      : Math.min(Math.max(raw, 1.75), 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const compact = w < 640;
    const aspect = w / h;
    /* Referans kadraj: küre viewport'tan BÜYÜK, merkezi sağ-alt bölgede;
       sağdan ve alttan kırpılır, sol kenarı composer'ın bitişine yaklaşır.
       Konum ekran-oranı hedefinden türetilir, sabit sayı tahmini yapılmaz. */
    const wide = aspect > 1.6;
    camera.position.z = compact ? 6.5 : wide ? 3.78 : 4.85;
    const halfH = camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const halfW = halfH * aspect;
    /* Dar/orta ekranda küre sağa itilir: sol metin ve composer okunur kalır. */
    const ndcX = compact ? 0.1 : wide ? 0.56 : 0.88;
    /* Mobilde küre composer'ın ALTINA iner: başlık ve giriş alanı temiz kalır. */
    const ndcY = compact ? -1.24 : wide ? -0.84 : -0.72;
    const sceneX = ndcX * halfW;
    const sceneY = ndcY * halfH;
    planetGroup.position.set(sceneX, sceneY, 0);
    cloudGroup.position.set(sceneX, sceneY, 0);
    if (glowMesh) glowMesh.position.set(sceneX, sceneY, 0);
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    /** RO contentRect ölçüleriyle çağrılabilir. */
    start() {
      if (running || disposed) return;
      running = true;
      lastNow = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    },
    resize,
    triggerBroadcast() {
      /* Restart safely: focus Türkiye first, then reveal the compact response
         sequence. Reduced motion resolves directly to the final readable state. */
      focusStartRotation = planetRotationY;
      broadcasting = true;
      clock = opts.reducedMotion ? 3.2 : 0;
      if (opts.reducedMotion) planetRotationY = turkeyFacingRotation;
      if (currentState !== 0) {
        currentState = 0;
        onStory(0);
      }
    },
    renderSingleFrame() {
      frame(0);
    },
    dispose() {
      disposed = true;
      this.stop();
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* dispose sırasında tek tek hatalar yutulur */
        }
      }
      scene.clear();
      draco.dispose();
      renderer.dispose();
      /* WEBGL_lose_context ÇAĞRILMAZ (ölçüldü, 2026-09-05): React StrictMode
         geliştirme modunda efekti iki kez çalıştırır; ilk sahnenin dispose'u
         canvas bağlamını kalıcı olarak öldürünce İKİNCİ sahne aynı canvas
         üzerinde hiç çizemiyor ve hero posterde kalıyordu. renderer.dispose()
         GPU kaynaklarını zaten bırakır; bağlam GC ile toplanır. */
    },
  };
}
