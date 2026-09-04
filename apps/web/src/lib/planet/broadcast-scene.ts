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

/** Talepo paletine çevrilmiş sahne ayarları (GetLayers CONFIG'ten türetildi). */
const CONFIG = {
  rimColor: "#bff5ea",
  rimPower: 4.6,
  nightLights: 15,
  terrainDepth: 0.33,
  terrainShade: 1.3,
  oceanGlint: 0.24,
  oceanDeep: 0.62,
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
  /* Referans gece görünümü: bulutlar yalnız limbte hafif bir nem hissi. */
  cloudLayers: [
    { height: 1.008, opacity: 0.1, spin: 0.05, ry: 0.0, phase: 0.0 },
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
        uniform vec3 rimColor; uniform float rimPower; uniform sampler2D nightBlendTexture; uniform float hasNight; uniform float nightLights;
        uniform float terrainDepth; uniform float terrainShade;
        uniform float oceanGlint; uniform float oceanDeep; uniform float oceanFlow;
        uniform float oceanFlowSpeed; uniform float oceanFlowScale;
        varying vec2 vCustomUv;
        ${SNOISE}
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        vec3 normalizedNormal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float rim = 1.0 - max(dot(viewDir, normalizedNormal), 0.0);
        rim = pow(rim, rimPower); rim = pow(rim, 1.5); rim *= 2.1;
        vec3 currentColor = gl_FragColor.rgb;
        float blueDom = currentColor.b - max(currentColor.r, currentColor.g);
        float waterMask = clamp(smoothstep(-0.005, 0.03, blueDom), 0.0, 1.0);
        float shimmer = snoise(vec3(vCustomUv.x * noiseScale + time * speedX, vCustomUv.y * noiseScale - time * speedY, time * speedZ));
        gl_FragColor.rgb += waterMask * shimmer * 0.025;
        float fT = time * oceanFlowSpeed * 4.0;
        float fS = 4.0 * oceanFlowScale;
        float warp = snoise(vec3(vCustomUv.x * fS - fT * 0.5, vCustomUv.y * fS + fT * 0.4, fT * 0.5));
        float flow = snoise(vec3(vCustomUv.x * fS * 2.0 + fT * 0.6 + warp, vCustomUv.y * fS * 2.0 - fT * 0.5, fT * 0.7));
        flow = warp * 0.6 + flow * 0.4;
        gl_FragColor.rgb += waterMask * flow * 0.12 * oceanFlow;
        /* Talepo: açık okyanus maviye değil koyu yeşil-siyaha derinleşir. */
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.014, 0.055, 0.05), waterMask * oceanDeep);
        /* Talepo dünyası: kalan maviyi de yeşile çek — uzay demosu mavisi yok. */
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.72, 1.05, 0.95), waterMask * 0.85);
        gl_FragColor = vec4(gl_FragColor.rgb, 1.0);
        vec3 surfPos = -vViewPosition;
        float terrH = dot(texture2D(map, vCustomUv).rgb, vec3(0.299, 0.587, 0.114));
        vec3 sigX = dFdx(surfPos), sigY = dFdy(surfPos);
        vec3 vR1 = cross(sigY, normalizedNormal), vR2 = cross(normalizedNormal, sigX);
        float fDet = dot(sigX, vR1);
        vec3 vGrad = sign(fDet) * (dFdx(terrH) * vR1 + dFdy(terrH) * vR2);
        vec3 bumpedNormal = normalize(abs(fDet) * normalizedNormal - terrainDepth * vGrad);
        vec3 shadeNormal = mix(bumpedNormal, normalizedNormal, waterMask);
        vec3 cityLights = hasNight > 0.5
          ? texture2D(nightBlendTexture, vCustomUv).rgb * gl_FragColor.rgb * nightLights
          : vec3(0.0);
        /* Talepo: şehir ışıkları mint'e çekilir. */
        cityLights = mix(cityLights, vec3(dot(cityLights, vec3(0.333))) * vec3(0.55, 1.0, 0.88), 0.6);
        vec3 viewSunDir = normalize(vec3(-0.66, 0.40, -0.62));
        float ndl = dot(normalizedNormal, viewSunDir);
        float dayAmt = smoothstep(-0.05, 0.35, ndl);
        float relief = dot(shadeNormal, viewSunDir) - ndl;
        gl_FragColor.rgb *= clamp(1.0 + relief * terrainShade * dayAmt, 0.55, 1.6);
        /* Referans kompozisyonu (kurucu, 2026-09-04): görünen yüzün neredeyse
           tamamı gecedir; terminatör sol üst limbe itilir, gündüz katkısı
           düşük albedoya çekilir ve yüzeyi şehir ağı taşır. */
        float nightFactor  = smoothstep(0.72, 0.02, ndl);
        float lightsFactor = smoothstep(0.86, -0.05, ndl);
        gl_FragColor.rgb *= 0.52;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.3, nightFactor);
        /* Kara siluetleri gecede de okunsun (kurucu, 2026-09-04): kıtalara
           çok hafif mint-nötr bir taban ışık; okyanus koyu kalır. */
        gl_FragColor.rgb += (1.0 - waterMask) * nightFactor * 0.055 * vec3(0.62, 0.82, 0.74);
        gl_FragColor.rgb += cityLights * lightsFactor;
        vec3 halfDir = normalize(viewSunDir + viewDir);
        float ripple = snoise(vec3(vCustomUv * 240.0, time * 4.0));
        float ndh = max(dot(normalizedNormal, halfDir) + ripple * 0.02, 0.0);
        float glint = pow(ndh, 140.0);
        gl_FragColor.rgb += glint * waterMask * dayAmt * oceanGlint * vec3(0.85, 1.0, 0.95);
        gl_FragColor.rgb += rimColor * rim * 1.15;
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
          uniform float uTime; uniform float noiseScale; uniform float uSpeedX; uniform float uSpeedY; uniform float uSpeedZ; uniform float uOpacity; uniform float uPhase;
          varying vec2 vCloudUv;
          ${SNOISE}
        ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          gl_FragColor.rgb = vec3(1.0);
          float cloudNoise = snoise(vec3(vCloudUv.x * noiseScale + uTime * uSpeedX + uPhase, vCloudUv.y * noiseScale - uTime * uSpeedY + uPhase, uTime * uSpeedZ + uPhase));
          float cloudNdv = max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0);
          float cloudEdge = pow(1.0 - cloudNdv, 3.0);
          float cloudMod = mix(cloudNoise, 0.35, cloudEdge);
          float cloudNdl = dot(normalize(vNormal), normalize(vec3(-0.66, 0.40, -0.62)));
          float cloudDay = 1.0 - smoothstep(0.30, -0.30, cloudNdl) * 0.9;
          gl_FragColor.a *= cloudMod * uOpacity * cloudDay;
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

    if (planetMesh && turkeyPoint && opts.onAnchor) {
      scene.updateMatrixWorld(true);
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
