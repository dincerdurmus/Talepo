/**
 * MAIRA — CONTOUR SAHNESİ (dekoratif katman, 2026-08-31).
 *
 * GetLayers Contour Anatomy — Full Stack licensed product integration.
 * Kaynak katman sayfası: GetLayers "Contour Anatomy" (Spotlight / Showcase
 * UI şablonları), entegrasyon tarihi 2026-08-31. Yalnız Talepo ürününün
 * parçası olarak kullanılır; bağımsız model, şablon ya da indirilebilir
 * ürün olarak dağıtılmaz ve arayüzde indirme yolu sunulmaz.
 *
 * SINIR — BU MODÜL NE YAPMAZ. Kanonik talep durumunu, beyni, parser'ı,
 * kategori/soru/cevap mantığını ne okur ne üretir. React bilmez, state
 * tutmaz. Girdisi yalnız bir canvas, bir model adresi ve dekoratif
 * seçeneklerdir; çıktısı sahnenin kendisi ve EKSİKSİZ bir temizlik
 * işlevidir. Görsel katman çökse bile /talep akışı bugünkü hâliyle
 * çalışmaya devam eder — bunu `verify-maira-scene-boundary-v1` ölçer.
 *
 * Görünüm değerleri (renk, kontur frekansı, bloom, tone-map, kamera)
 * onaylanan prototipten BİREBİR taşındı; burada yeniden tasarlanmaz.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type ContourSceneHandle = {
  /** Dekoratif "düşünüyor" nabzı — davranış değil, yalnız ışık. */
  setThinking: (on: boolean) => void;
  /** RAF, renderer, geometry, material, observer ve dinleyicileri kapatır. */
  dispose: () => void;
};

export type ContourSceneOptions = {
  canvas: HTMLCanvasElement;
  /** Model adresi çağıran taraftan gelir; burada hard-code edilmez. */
  modelUrl: string;
  /** Cihaz piksel oranı üst sınırı — güvenli varsayılan. */
  maxPixelRatio?: number;
};

const CONFIG = {
  nearColor:'#f6ea3c', farColor:'#17b4da', rimColor:'#2ad6f2', fillColor:'#082031', bgColor:'#000407',
  contourFreq:56.0, lineWidth:1.60, lineGain:1.20, warmPow:1.55, fillGain:0.05,
  rimPow:2.40, rimGain:0.95,
  autoRotate:0.28, camTargetY:0.56, breathe:1.00, camDist:2.35 /* kurucu 2026-09-01: sahne uzaklaştırıldı (1.95 çok yakındı) */, camFov:36,
  pulseSpeed:1.90, pulseWidth:7.0, pulseGain:1.30,
  grain:0.030, vignette:0.38, exposure:1.20, blackFloor:0.045, fadeIn:1.40,
  bgTop:'#01040a', bgBottom:'#031019', bgGlow:'#0b3948', bgGlowAmount:0.28, bgFlow:1.00,
  particleCount:340, particleSize:7.0, particleGlow:0.90, particleDrift:1.00,
  bloomStrength:0.50, bloomRadius:0.62, bloomThreshold:0.00
}

const TARGET_H = 1.8;

function hexToVec3(hex: string): THREE.Vector3 {
  const h = hex.replace("#", "");
  return new THREE.Vector3(
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  );
}

const MESH_VERT = `
varying vec3 vViewPos;
varying vec3 vNormalView;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vNormalView = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;

const MESH_FRAG = `
precision highp float;
varying vec3 vViewPos;
varying vec3 vNormalView;
uniform vec2  iResolution;
uniform float uAspect;
uniform float iTime;
uniform float iAlpha;
uniform float iClickT;
uniform float uCamDist;
uniform vec3  uNear, uFar, uRim, uFill;
uniform float uFreq, uLineW, uLineGain, uWarmPow, uFillGain;
uniform float uRimPow, uRimGain;
uniform float uPulseSpeed, uPulseWidth, uPulseGain;
void main(){
  vec3 n = normalize(vNormalView);
  if (!gl_FrontFacing) n = -n;
  vec3 vd = normalize(-vViewPos);
  float facing = clamp(dot(n, vd), 0.0, 1.0);
  float depth = length(vViewPos);
  float band = depth * uFreq;
  float fr = fract(band);
  float dist = min(fr, 1.0 - fr);
  float aa = max(fwidth(band), 1e-4);
  float line = 1.0 - smoothstep(0.0, aa * uLineW, dist);
  line *= 1.0 - smoothstep(0.32, 0.80, aa);
  float warm = pow(facing, uWarmPow);
  vec3 lineCol = mix(uFar, uNear, warm);
  float rim = pow(1.0 - facing, uRimPow);
  float age = iTime - iClickT;
  float pulse = 0.0;
  if (age > 0.0 && age < 3.0){
    float front = (uCamDist - 1.0) + age * uPulseSpeed;
    pulse = exp(-pow((depth - front) * uPulseWidth, 2.0)) * exp(-age * 1.1);
  }
  vec3 col  = lineCol * line * uLineGain;
  col += uFill * facing * uFillGain;
  col += uRim * rim * uRimGain;
  col += lineCol * line * pulse * uPulseGain;
  col *= mix(1.0, 0.74, clamp((depth - (uCamDist - 0.9)) / 2.0, 0.0, 1.0));
  col = max(col, 0.0) * iAlpha;
  gl_FragColor = vec4(col, 1.0);
}`;

const BG_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`;

const BG_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float iTime, uAspect, iAlpha;
uniform vec3  uBgTop, uBgBottom, uBgGlow;
uniform float uGlowAmount, uBgFlow;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.02; a *= 0.5; } return s; }
void main(){
  vec2 uv = vUv;
  vec3 col = mix(uBgBottom, uBgTop, clamp(uv.y, 0.0, 1.0));
  vec2 c = uv - vec2(0.5, 0.52); c.x *= uAspect;
  float r = length(c);
  float glow = exp(-r * r * 4.5) * uGlowAmount * (0.82 + 0.18 * sin(iTime * 0.4));
  col += uBgGlow * glow;
  float n = fbm(uv * vec2(2.2, 3.0) + vec2(iTime * 0.02, iTime * 0.014));
  col += uBgGlow * 0.10 * uBgFlow * n * smoothstep(1.05, 0.25, r);
  col *= 1.0 - 0.55 * smoothstep(0.45, 1.15, r);
  gl_FragColor = vec4(col * iAlpha, 1.0);
}`;

const P_VERT = `
attribute float aSeed, aSize, aWarm;
uniform float iTime, uSize, uDrift, uDpr;
varying float vWarm, vTw;
void main(){
  vec3 p = position;
  p += uDrift * vec3(
    0.10 * sin(iTime * 0.25 + aSeed * 6.2831),
    0.08 * sin(iTime * 0.20 + aSeed * 3.7) + 0.05 * sin(iTime * 0.11 + aSeed * 2.0),
    0.10 * cos(iTime * 0.23 + aSeed * 4.1));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(aSize * uSize * uDpr / max(-mv.z, 0.1), 2.0 * uDpr);
  vWarm = aWarm;
  vTw = 0.5 + 0.5 * sin(iTime * (0.7 + aSeed * 1.6) + aSeed * 6.2831);
}`;

const P_FRAG = `
precision highp float;
varying float vWarm, vTw;
uniform vec3 uWarm, uCool;
uniform float uGlow, iAlpha;
void main(){
  vec2 d = gl_PointCoord - 0.5; float r = length(d);
  float a = smoothstep(0.5, 0.0, r); a *= a;
  vec3 c = mix(uCool, uWarm, vWarm);
  gl_FragColor = vec4(c * uGlow * (0.7 + 0.3 * vTw) * a * iAlpha, a);
}`;

/**
 * Sahneyi kurar ve kapatma işlevini döndürür. Hiçbir hata /talep akışına
 * sızmaz: çağıran taraf başarısızlıkta sessizce fallback'e döner.
 */
export function mountContourScene(
  opts: ContourSceneOptions,
): ContourSceneHandle {
  const { canvas, modelUrl } = opts;
  const host = canvas.parentElement ?? canvas;
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    opts.maxPixelRatio ?? 1.75,
  );
  const size = () => ({
    w: Math.max(1, host.clientWidth || canvas.clientWidth || 1),
    h: Math.max(1, host.clientHeight || canvas.clientHeight || 1),
  });

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(dpr);
  const first = size();
  renderer.setSize(first.w, first.h, false);
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const ENTIRE_SCENE = 3;
  const BLOOM_SCENE = 2;
  const camera = new THREE.PerspectiveCamera(
    CONFIG.camFov,
    first.w / first.h,
    0.1,
    100,
  );
  camera.position.set(0, 0, CONFIG.camDist);
  camera.layers.enableAll();
  scene.add(camera);

  const uniforms = {
    iResolution: { value: new THREE.Vector2(first.w * dpr, first.h * dpr) },
    uAspect: { value: first.w / first.h },
    iTime: { value: 0 },
    iAlpha: { value: 0 },
    iClickT: { value: -99 },
    uCamDist: { value: CONFIG.camDist },
    uNear: { value: hexToVec3(CONFIG.nearColor) },
    uFar: { value: hexToVec3(CONFIG.farColor) },
    uRim: { value: hexToVec3(CONFIG.rimColor) },
    uFill: { value: hexToVec3(CONFIG.fillColor) },
    uFreq: { value: CONFIG.contourFreq },
    uLineW: { value: CONFIG.lineWidth },
    uLineGain: { value: CONFIG.lineGain },
    uWarmPow: { value: CONFIG.warmPow },
    uFillGain: { value: CONFIG.fillGain },
    uRimPow: { value: CONFIG.rimPow },
    uRimGain: { value: CONFIG.rimGain },
    uPulseSpeed: { value: CONFIG.pulseSpeed },
    uPulseWidth: { value: CONFIG.pulseWidth },
    uPulseGain: { value: CONFIG.pulseGain },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: MESH_VERT,
    fragmentShader: MESH_FRAG,
    side: THREE.DoubleSide,
  });

  const group = new THREE.Group();
  scene.add(group);

  const bgUniforms = {
    iTime: { value: 0 },
    iAlpha: { value: 0 },
    uAspect: { value: first.w / first.h },
    uBgTop: { value: hexToVec3(CONFIG.bgTop) },
    uBgBottom: { value: hexToVec3(CONFIG.bgBottom) },
    uBgGlow: { value: hexToVec3(CONFIG.bgGlow) },
    uGlowAmount: { value: CONFIG.bgGlowAmount },
    uBgFlow: { value: CONFIG.bgFlow },
  };
  const bgGeometry = new THREE.PlaneGeometry(2, 2);
  const bgMaterial = new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const bg = new THREE.Mesh(bgGeometry, bgMaterial);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  bg.layers.set(ENTIRE_SCENE);
  scene.add(bg);

  const pUniforms = {
    iTime: { value: 0 },
    iAlpha: { value: 0 },
    uSize: { value: CONFIG.particleSize },
    uDrift: { value: CONFIG.particleDrift },
    uGlow: { value: CONFIG.particleGlow },
    uDpr: { value: dpr },
    uWarm: { value: hexToVec3(CONFIG.nearColor) },
    uCool: { value: hexToVec3(CONFIG.farColor) },
  };
  const particleGeometry = new THREE.BufferGeometry();
  {
    const n = CONFIG.particleCount;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const psize = new Float32Array(n);
    const warm = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 1.6;
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * 1.35;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * 1.6;
      seed[i] = Math.random();
      psize[i] = 0.5 + Math.random() * Math.random() * 2.4;
      warm[i] = Math.random() < 0.28 ? Math.random() : 0;
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(psize, 1));
    particleGeometry.setAttribute("aWarm", new THREE.BufferAttribute(warm, 1));
  }
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: pUniforms,
    vertexShader: P_VERT,
    fragmentShader: P_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  });
  const points = new THREE.Points(particleGeometry, particleMaterial);
  points.frustumCulled = false;
  points.layers.set(ENTIRE_SCENE);
  scene.add(points);

  let figureGeometry: THREE.BufferGeometry | null = null;
  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      let src: THREE.Mesh | null = null;
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !src) src = m;
      });
      if (!src) return;
      const geo = (src as THREE.Mesh).geometry as THREE.BufferGeometry;
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      if (!bb) return;
      const c = new THREE.Vector3();
      bb.getCenter(c);
      const dim = new THREE.Vector3();
      bb.getSize(dim);
      geo.translate(-c.x, -c.y, -c.z);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, material);
      mesh.scale.setScalar(TARGET_H / dim.y);
      mesh.layers.set(ENTIRE_SCENE);
      mesh.layers.enable(BLOOM_SCENE);
      figureGeometry = geo;
      group.add(mesh);
    },
    undefined,
    /* Model gelmezse sahne yalnız arka plan ve zerrelerle çalışır; hata
       çağırana sızmaz ve /talep akışını etkilemez. */
    () => {},
  );

const FinalPass = {
  uniforms: {
    tDiffuse:{ value:null }, uExposure:{ value:CONFIG.exposure }, uVignette:{ value:CONFIG.vignette },
    uGrain:{ value:CONFIG.grain }, uFloor:{ value:CONFIG.blackFloor },
    uAspect:{ value:innerWidth/innerHeight }, uTime:{ value:0 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uExposure, uVignette, uGrain, uFloor, uAspect, uTime;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 vg = vUv - 0.5; vg.x *= uAspect;
      c *= 1.0 - uVignette * dot(vg, vg) * 2.2;
      c = 1.0 - exp(-c * uExposure);
      c = max(c - uFloor, 0.0);
      c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      c += (hash(vUv * vec2(1917.0, 1083.0) + fract(uTime) * 97.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`
}

  const renderTarget = new THREE.WebGLRenderTarget(first.w, first.h, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(first.w, first.h),
    CONFIG.bloomStrength,
    CONFIG.bloomRadius,
    CONFIG.bloomThreshold,
  );
  composer.addPass(bloomPass);
  const tonePass = new ShaderPass(FinalPass);
  composer.addPass(tonePass);

  const start = performance.now() / 1000;
  let last = start;
  let yaw = 0;
  let raf = 0;
  let running = true;
  let thinking = false;

  const applySize = () => {
    const { w, h } = size();
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
    tonePass.uniforms.uAspect.value = w / h;
    uniforms.iResolution.value.set(w * dpr, h * dpr);
    uniforms.uAspect.value = w / h;
    bgUniforms.uAspect.value = w / h;
  };
  applySize();

  const resizeObserver = new ResizeObserver(() => applySize());
  resizeObserver.observe(host);

  const onVisibility = () => {
    running = document.visibilityState === "visible";
    if (running) {
      last = performance.now() / 1000;
      raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  /** Bağlam kaybı: döngü durur, sahne sessizce sabit kalır. */
  const onContextLost = (event: Event) => {
    event.preventDefault();
    running = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  const onContextRestored = () => {
    running = true;
    last = performance.now() / 1000;
    applySize();
    raf = requestAnimationFrame(frame);
  };
  canvas.addEventListener("webglcontextlost", onContextLost as EventListener);
  canvas.addEventListener(
    "webglcontextrestored",
    onContextRestored as EventListener,
  );

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now() / 1000;
    let dt = now - last;
    if (dt > 0.1) dt = 0.1;
    last = now;
    const time = now - start;
    uniforms.iTime.value = now;
    bgUniforms.iTime.value = now;
    pUniforms.iTime.value = now;
    yaw += CONFIG.autoRotate * dt;
    uniforms.uCamDist.value = CONFIG.camDist;
    const ty = CONFIG.camTargetY;
    camera.position.set(
      Math.sin(yaw) * CONFIG.camDist,
      ty,
      Math.cos(yaw) * CONFIG.camDist,
    );
    camera.lookAt(0, ty, 0);
    /* Dekoratif nabız: yalnız nefes genliğini artırır, davranış taşımaz. */
    const breatheGain = thinking ? 2.2 : 1;
    const b =
      1 + CONFIG.breathe * 0.006 * breatheGain * Math.sin(time * 1.1);
    group.scale.setScalar(b);
    const fade = Math.min(time / Math.max(CONFIG.fadeIn, 0.05), 1);
    const a = fade * fade * (3 - 2 * fade);
    uniforms.iAlpha.value = a;
    bgUniforms.iAlpha.value = a;
    pUniforms.iAlpha.value = a;
    tonePass.uniforms.uTime.value = now;
    composer.render();
  }
  raf = requestAnimationFrame(frame);

  return {
    setThinking: (on: boolean) => {
      thinking = on;
    },
    dispose: () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener(
        "webglcontextlost",
        onContextLost as EventListener,
      );
      canvas.removeEventListener(
        "webglcontextrestored",
        onContextRestored as EventListener,
      );
      /* r143 EffectComposer.dispose() ÇALIŞMA ZAMANINDA vardır (kaynakta
         satır 284) ama @types/three 0.143.2 onu bildirmez. Tip boşluğu
         yüzünden gerçek temizliği atlamak sızıntı üretirdi. */
      (composer as unknown as { dispose?: () => void }).dispose?.();
      renderTarget.dispose();
      bloomPass.dispose();
      material.dispose();
      bgGeometry.dispose();
      bgMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      figureGeometry?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
