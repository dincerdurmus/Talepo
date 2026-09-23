/**
 * KAPI: KAPSAM KARARININ METAMORFİK KARARLILIĞI (2026-09-23).
 *
 * NE KANITLAR. Bir cümlenin kapsam kararı, ANLAMI DEĞİŞMEYEN yazım
 * farklarından etkilenmez. Kapsam dışı bir talep "2 kutu" eklenince kapsam
 * içine düşmez; kapsam içi bir talep "acil" yazılınca kapsam dışına düşmez.
 *
 * NEDEN BU KAPI VAR. Ölçüldü (A-Z koşusu, 2026-09-23, P0-1): "Ağrı kesici
 * arıyorum" doğru bloklanırken "Ağrı kesici arıyorum 2 kutu" DEMAND oluyor ve
 * yayınlanabiliyordu. Tek tek vaka eklemek bu sınıfı kapatmaz — kullanıcılar
 * sonsuz yazım varyantı üretir. Bu yüzden kapı VAKA değil DÖNÜŞÜM sayar:
 * her tohum, anlamı koruyan dönüşümlerin altında aynı kararı vermek
 * zorundadır. Dinçer'in kuralı: keşfedilen her sınıf kalıcı bir değişmeze
 * dönüşür, tek seferlik düzeltmeye değil.
 *
 * DETERMİNİSTİK. Rastgelelik yok: dönüşüm listesi sabit, sıra sabit, yazım
 * hatası üretimi tohumun kendi karakterlerinden hesaplanır. Aynı girdi her
 * koşuda aynı vaka kümesini üretir; CI'da koşar, ağ gerektirmez.
 *
 * MUTASYON KONTROLÜ (T9). Sonda, kapının GERÇEKTEN kırmızı verebildiği
 * kanıtlanır: düzeltilmeden önceki okuma (kap sözcüğü metnin herhangi bir
 * yerinde geçiyorsa kapıyı kapat) aynı korpusta yeniden kurulur ve kaçak
 * ÜRETMEK ZORUNDADIR. Üretmezse kapı kendi kendini kandırıyordur.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { understandRequest } from "@/lib/request-understanding/understand-request";
import { isUnsupportedRequestScope } from "@/lib/request-understanding/types";
import { foldTr } from "@/lib/request-understanding/tr-fold";
import { readPharmacyScope } from "@/lib/request-understanding/pharmacy-scope-gate";

type SeedClass = "OUT_OF_SCOPE" | "IN_SCOPE" | "SUSPECT";

type Seed = {
  text: string;
  cls: SeedClass;
  /** OUT_OF_SCOPE için beklenen tam kapsam değeri. */
  expected?: string;
  why: string;
};

/* ------------------------------------------------------------------ */
/* TOHUMLAR                                                            */
/* ------------------------------------------------------------------ */

/** İLAÇ — istenen şey ilacın kendisi. */
const PHARMACY_SEEDS: Seed[] = [
  ["Ağrı kesici arıyorum", "ilaç ürünü"],
  ["2 kutu ağrı kesici arıyorum", "sayı+birim+ilaç"],
  ["Ağrı kesici arıyorum 2 kutu", "ilaç+sayı+birim"],
  ["1 şişe öksürük şurubu arıyorum", "şişe ölçü birimi"],
  ["3 şişe şurup lazım", "birim çoğul"],
  ["1 tüp merhem arıyorum", "tüp ölçü birimi"],
  ["Antibiyotik almak istiyorum", "ilaç ürünü"],
  ["Etiketli antibiyotik arıyorum", "etiket sıfat, kap değil"],
  ["Ağrı kesici stok almak istiyorum", "stok ilaç alımı"],
  ["Reçetesiz ilaç arıyorum", "ilaç ürünü"],
  ["Vitamin hapı arıyorum", "ilaç ürünü"],
  ["Ateş düşürücü şurup arıyorum", "ilaç ürünü"],
  ["Parasetamol arıyorum", "etken madde"],
  ["İbuprofen almak istiyorum", "etken madde"],
  ["Aspirin arıyorum", "ilaç ürünü"],
  ["Antidepresan arıyorum", "ilaç ürünü"],
  ["Antihistaminik ilaç arıyorum", "ilaç ürünü"],
  ["Pomat arıyorum", "ilaç ürünü"],
  ["Kutu ilaç almak istiyorum", "birim+ilaç"],
  ["Reçeteli ürün arıyorum", "reçete sinyali"],
].map(([text, why]) => ({ text, why, cls: "OUT_OF_SCOPE" as const, expected: "UNSUPPORTED_PHARMACY" }));

/** TIBBİ TAVSİYE — soru biçimi. */
const ADVICE_SEEDS: Seed[] = [
  ["Baş ağrım için hangi ilacı almalıyım", "soru biçimi"],
  ["Hangi tansiyon ilacını kullanmalıyım", "soru biçimi"],
  ["Öksürük için ne içmeliyim", "soru biçimi"],
  ["Mide ağrım için hangi hapı önerirsiniz", "soru biçimi"],
  ["Belirtilerim için hangi tedaviyi kullanmalıyım", "soru biçimi"],
].map(([text, why]) => ({ text, why, cls: "OUT_OF_SCOPE" as const, expected: "UNSUPPORTED_MEDICAL_ADVICE" }));

/** ARZ İLANI — kendi nesnesini elden çıkarma. */
const SUPPLY_SEEDS: Seed[] = [
  ["Aracımı satmak istiyorum", "arz ilanı"],
  ["Evimi kiraya vermek istiyorum", "arz ilanı"],
  ["Dükkanımı satmak istiyorum", "arz ilanı"],
  ["Traktörümü satmak istiyorum", "arz ilanı"],
  ["Dairemi kiraya vermek istiyorum", "arz ilanı"],
  ["Motosikletimi satmak istiyorum", "arz ilanı"],
  ["İş makinemi kiraya vermek istiyorum", "arz ilanı"],
  ["Buzdolabımı satmak istiyorum", "arz ilanı"],
  ["Ofis mobilyalarımı satmak istiyorum", "arz ilanı"],
  ["Bilgisayarımı satmak istiyorum", "arz ilanı"],
].map(([text, why]) => ({ text, why, cls: "OUT_OF_SCOPE" as const, expected: "UNSUPPORTED_SUPPLY" }));

/** KALDIRILMIŞ KAPSAM — tıbbi test / tahlil hizmeti. */
const REMOVED_SEEDS: Seed[] = [
  ["Kan tahlili yaptırmak istiyorum", "tıbbi test"],
  ["İdrar tahlili yaptırmak istiyorum", "tıbbi test"],
  ["Hemogram testi yaptırmak istiyorum", "tıbbi test"],
  ["Tıbbi test yaptırmak istiyorum", "tıbbi test"],
  ["Check-up yaptırmak istiyorum", "tıbbi test"],
  ["Biyopsi yaptırmak istiyorum", "tıbbi işlem"],
  ["PCR testi yaptırmak istiyorum", "tıbbi test"],
  ["Tomografi çektirmek istiyorum", "görüntüleme"],
  ["Mamografi çektirmek istiyorum", "görüntüleme"],
  ["Ultrason çektirmek istiyorum", "görüntüleme"],
  ["Röntgen çektirmek istiyorum", "görüntüleme"],
  ["Hormon testi yaptırmak istiyorum", "tıbbi test"],
  ["Alerji testi yaptırmak istiyorum", "tıbbi test"],
  ["Medikal analiz yaptırmak istiyorum", "tıbbi analiz"],
  ["Kan testi yaptırmak istiyorum", "tıbbi test"],
].map(([text, why]) => ({ text, why, cls: "OUT_OF_SCOPE" as const, expected: "UNSUPPORTED_REMOVED_SCOPE" }));

/** KAPSAM İÇİ — bunlar dönüşüm altında kapsam dışına DÜŞMEMELİ. */
const IN_SCOPE_SEEDS: Seed[] = [
  ["İlaç kutusu arıyorum", "saklama ürünü"],
  ["İlaç dolabı arıyorum", "saklama ürünü"],
  ["Hap kutusu arıyorum", "saklama ürünü"],
  ["Hap muhafazası arıyorum", "saklama ürünü"],
  ["İlaç saklama kabı arıyorum", "saklama ürünü"],
  ["İlaç taşıma çantası arıyorum", "taşıma ürünü"],
  ["Şurup şişesi arıyorum", "kap"],
  ["İlaç için kutu arıyorum", "için yapısı"],
  ["İlaç stok yazılımı arıyorum", "yazılım"],
  ["Eczane için etiket yazılımı arıyorum", "yazılım"],
  ["Eczane rafı arıyorum", "mobilya"],
  ["Tansiyon aleti arıyorum", "medikal cihaz"],
  ["Hasta yatağı kiralamak istiyorum", "klinik donanım"],
  ["Karton kutu arıyorum", "ambalaj"],
  ["Nespresso kahve makinesi kapsüllü arıyorum", "kapsül kahve kapsülü"],
  ["Ampul arıyorum", "aydınlatma"],
  ["Yüz kremi arıyorum", "kozmetik"],
  ["Temizlik spreyi arıyorum", "temizlik"],
  ["Su tahlili yaptırmak istiyorum", "laboratuvar hizmeti, tıbbi değil"],
  ["Toprak analizi yaptırmak istiyorum", "laboratuvar hizmeti"],
  ["Kan tahlili cihazı arıyorum", "cihaz alımı"],
  ["Röntgen cihazı arıyorum", "cihaz alımı"],
  ["Arçelik buzdolabı arıyorum", "beyaz eşya"],
  ["55 inç Samsung televizyon arıyorum", "teknoloji"],
  ["Ofis çalışma sandalyesi arıyorum", "mobilya"],
  ["Kuşe kartvizit bastırmak istiyorum", "matbaa"],
  ["Kiralık 3+1 daire arıyorum", "emlak talebi"],
  ["Satılık araç arıyorum", "ilan sıfatı alıcıyı gösterir"],
  ["Evden eve nakliyat firması arıyorum", "hizmet"],
  ["Aracımı satmak için ekspertiz hizmeti arıyorum", "hedef hizmet"],
  ["Evimi kiraya vermek için emlakçı arıyorum", "hedef hizmet"],
  ["Ürünlerimi satmak için e-ticaret yazılımı arıyorum", "hedef yazılım"],
  ["Bebek arabası arıyorum", "anne çocuk"],
  ["4 çuval kedi maması arıyorum", "birim çuval, ilaç değil"],
  ["Endüstriyel bulaşık makinesi arıyorum", "makine"],
  ["Forklift kiralamak istiyorum", "makine kiralama"],
  ["Michelin kış lastiği arıyorum", "otomotiv"],
  ["Yemek masası arıyorum", "mobilya"],
  ["Klima montajı yaptırmak istiyorum", "hizmet"],
  ["Elektrikçi arıyorum", "hizmet"],
].map(([text, why]) => ({ text, why, cls: "IN_SCOPE" as const }));

/**
 * ŞÜPHELİ — kapı burada karar VEREMEZ. Beklenen davranış: DEMAND'e DÜŞMEMEK.
 * Dönüşümler bu sınıfı da kıramaz; fail-closed bir kapının kararlılığı da
 * ölçülmelidir, yoksa belirsizlik sessizce yayına açılabilir.
 */
const SUSPECT_SEEDS: Seed[] = [
  ["Ağrı kesici kutu arıyorum", "yapı çözülemedi"],
  ["500 mg parasetamol kutusu arıyorum", "dozaj + kap başı"],
  ["Eczane için krem arıyorum", "iki anlamlı biçim + eczane bağlamı"],
  ["Eczane için sprey arıyorum", "iki anlamlı biçim + eczane bağlamı"],
  ["Reçeteli krem kutusu arıyorum", "dozaj + kap başı"],
].map(([text, why]) => ({ text, why, cls: "SUSPECT" as const }));

const SEEDS: Seed[] = [
  ...PHARMACY_SEEDS,
  ...ADVICE_SEEDS,
  ...SUPPLY_SEEDS,
  ...REMOVED_SEEDS,
  ...IN_SCOPE_SEEDS,
  ...SUSPECT_SEEDS,
];

/* ------------------------------------------------------------------ */
/* ANLAM KORUYAN DÖNÜŞÜMLER                                            */
/* ------------------------------------------------------------------ */

type Transform = { name: string; apply: (text: string) => string };

/**
 * GERÇEKÇİ YAZIM HATASI — VE NEDEN BU BİÇİM.
 *
 * İlk sürüm rastgele iki harfi yer değiştiriyordu; bu, tek sözcükte İKİ ayrı
 * değişim demekti ("kesici" → "keoici" değil "reoici") ve insanların yaptığı
 * hataya benzemiyordu. İnsan hatası üç biçimdedir: komşu iki harfin yer
 * değişmesi, bir harfin düşmesi, bir harfin yanlış basılması. Kapı bunları
 * ölçer; uydurulmuş bir bozulmayı değil.
 *
 * İki hata AYRI YARILARA düşürülür ki tek bir ad iki kez bozulmasın —
 * "1–2 yazım hatası" iki farklı sözcükte bir hata demektir.
 */
function letterPositions(text: string, from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i < to && i < text.length; i += 1) {
    if (/[a-zçğıöşüA-ZÇĞİÖŞÜ]/.test(text[i])) out.push(i);
  }
  return out;
}

/** Komşu iki harfin yer değişmesi — ilk yarıda, deterministik konumda. */
function typoSwap(text: string): string {
  const half = Math.floor(text.length / 2);
  const pos = letterPositions(text, 0, half);
  if (pos.length < 3) return text;
  const at = pos[(text.length + 1) % (pos.length - 1)];
  if (!/[a-zçğıöşüA-ZÇĞİÖŞÜ]/.test(text[at + 1] ?? "")) return text;
  return text.slice(0, at) + text[at + 1] + text[at] + text.slice(at + 2);
}

/** Bir harfin düşmesi — ikinci yarıda, deterministik konumda. */
function typoDrop(text: string): string {
  const half = Math.floor(text.length / 2);
  const pos = letterPositions(text, half, text.length);
  if (pos.length < 2) return text;
  const at = pos[(text.length + 2) % pos.length];
  return text.slice(0, at) + text.slice(at + 1);
}

/** Cümle sırasını değiştir: son sözcüğü başa al (anlam korunur). */
function reorder(text: string): string {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3) return text;
  return [parts[parts.length - 1], ...parts.slice(0, -1)].join(" ");
}

const UNIT_PREFIXES = ["2 adet", "2 kutu", "1 şişe", "1 tüp", "3 paket", "2 koli", "1 düzine"];

const TRANSFORMS: Transform[] = [
  { name: "kimlik", apply: (t) => t },
  ...UNIT_PREFIXES.map((u) => ({ name: `birim-öne:${u}`, apply: (t: string) => `${u} ${t}` })),
  ...UNIT_PREFIXES.map((u) => ({ name: `birim-sona:${u}`, apply: (t: string) => `${t} ${u}` })),
  { name: "bütçe", apply: (t) => `${t} bütçem 1500 TL` },
  { name: "şehir", apply: (t) => `${t} İstanbul` },
  { name: "şehir+ilçe", apply: (t) => `${t} Ankara Çankaya` },
  { name: "tarih", apply: (t) => `${t} iki hafta içinde` },
  { name: "aciliyet", apply: (t) => `acil ${t}` },
  { name: "nezaket", apply: (t) => `merhaba ${t}` },
  { name: "nezaket+acil", apply: (t) => `merhaba acil ${t}` },
  { name: "büyük-harf", apply: (t) => t.toLocaleUpperCase("tr-TR") },
  { name: "türkçe-karaktersiz", apply: (t) => foldTr(t) },
  { name: "sıra-değişimi", apply: reorder },
  { name: "yazım-hatası-1", apply: typoSwap },
  { name: "yazım-hatası-2", apply: typoDrop },
  { name: "ingilizce-sözcük", apply: (t) => `${t} urgent please` },
  { name: "marka", apply: (t) => `${t} Bosch marka olsun` },
  { name: "ünlem", apply: (t) => `${t}!!!` },
  { name: "fazla-boşluk", apply: (t) => t.replace(/\s+/g, "  ") },
];

/**
 * İkili birleşimler: tek dönüşümün gizlediği etkileşimleri açar.
 *
 * Tam çarpım 17.000 vaka üretiyordu ve CI'da 12 dakikayı geçiyordu. Örnekleme
 * SESSİZ DEĞİLDİR: adım sabittir, çıktıda kaç ikili koşulduğu yazılır ve hedef
 * (≥5.000 türetilmiş vaka) aşılır. Rastgelelik yok — aynı girdi aynı kümeyi
 * üretir.
 */
const PAIR_SAMPLE_STEP = 5;
const ALL_PAIRS: Array<[number, number]> = [];
for (let i = 1; i < TRANSFORMS.length; i += 1) {
  for (let j = i + 1; j < TRANSFORMS.length; j += 3) ALL_PAIRS.push([i, j]);
}
const PAIRS = ALL_PAIRS.filter((_, k) => k % PAIR_SAMPLE_STEP === 0);

/* ------------------------------------------------------------------ */
/* KOŞU                                                                */
/* ------------------------------------------------------------------ */

type Leak = {
  seed: string;
  cls: SeedClass;
  transform: string;
  derived: string;
  expected: string;
  got: string;
};

function scopeOf(text: string): string {
  return String(understandRequest({ rawInput: text }).requestScope.value);
}

/**
 * YAZIM BOZAN DÖNÜŞÜMDE HÜKÜM NEDEN GEVŞER.
 *
 * Anlamı koruyan diğer dönüşümler ("2 kutu", "acil", büyük harf) metindeki
 * ilaç adına DOKUNMAZ; orada kapsam değerinin AYNEN korunması beklenir.
 * Yazım hatası ise adın kendisini bozar: "antibiyotk" artık kesin bir ilaç adı
 * değil, ona benzeyen bir sözcüktür. Benzerlik üstüne mevzuata tabi bir ENGEL
 * kurmak yanlış olurdu (bkz. pharmacy-scope-gate: yaklaşık eşleşme yalnız
 * sorar). Bu yüzden orada beklenen şey KAPININ KAPALI KALMASIDIR: talep
 * yayına girmez. DEMAND'e düşmek hâlâ kaçaktır.
 *
 * Aynı gevşeme SIRA DEĞİŞİMİ için de geçerlidir: "almalıyım Baş ağrım için
 * hangi ilacı" artık bir soru cümlesi değildir; tavsiye kapısı kapanıp ilaç
 * kapısı açılır. Ürün sonucu aynıdır (yayınlanmaz), yalnız gösterilen metin
 * değişir — ve bu, ölçülmesi gereken şeyin kendisi değildir.
 */
function damagesSpelling(transformName: string): boolean {
  return transformName.includes("yazım-hatası") || transformName.includes("sıra-değişimi");
}

function judge(seed: Seed, derived: string, transformName: string): Leak | null {
  const got = scopeOf(derived);
  if (seed.cls === "OUT_OF_SCOPE") {
    if (got === seed.expected) return null;
    if (damagesSpelling(transformName) && isUnsupportedRequestScope(got)) return null;
    return {
      seed: seed.text,
      cls: seed.cls,
      transform: transformName,
      derived,
      expected: damagesSpelling(transformName) ? `${seed.expected} ya da kapalı kalma` : (seed.expected ?? ""),
      got,
    };
  }
  if (seed.cls === "IN_SCOPE") {
    if (got === "DEMAND") return null;
    // Simetri: yazım/sıra bozan dönüşüm kap adını da bozabilir. Orada
    // netleştirmeye düşmek kabul edilir; ENGELE düşmek kabul edilmez —
    // meşru bir alıcıyı kesmek, kaçak kadar ciddi bir kusurdur.
    if (damagesSpelling(transformName) && got === "NEEDS_SCOPE_CLARIFICATION") return null;
    return {
      seed: seed.text,
      cls: seed.cls,
      transform: transformName,
      derived,
      expected: damagesSpelling(transformName) ? "DEMAND ya da netleştirme" : "DEMAND",
      got,
    };
  }
  // SUSPECT: DEMAND'e düşmemeli — engellenmiş ya da netleştirme bekliyor olmalı.
  if (isUnsupportedRequestScope(got)) return null;
  // Yazım hatası şüpheyi doğuran sözcüğün kendisini yok edebilir; orada
  // şüphe sinyali gerçekten kalmamıştır.
  if (damagesSpelling(transformName)) return null;
  return { seed: seed.text, cls: seed.cls, transform: transformName, derived, expected: "DEMAND olmamalı", got };
}

function run(): { total: number; leaks: Leak[] } {
  const leaks: Leak[] = [];
  let total = 0;
  let done = 0;
  for (const seed of SEEDS) {
    done += 1;
    if (done % 20 === 0) console.log(`  ... ${done}/${SEEDS.length} tohum`);
    for (const t of TRANSFORMS) {
      total += 1;
      const leak = judge(seed, t.apply(seed.text), t.name);
      if (leak) leaks.push(leak);
    }
    for (const [i, j] of PAIRS) {
      total += 1;
      const derived = TRANSFORMS[j].apply(TRANSFORMS[i].apply(seed.text));
      const leak = judge(seed, derived, `${TRANSFORMS[i].name}+${TRANSFORMS[j].name}`);
      if (leak) leaks.push(leak);
    }
  }
  return { total, leaks };
}

/**
 * MUTASYON KONTROLÜ (T9).
 *
 * Düzeltilmeden ÖNCEKİ okuma: "kap sözcüğü metnin herhangi bir yerinde geçiyor
 * mu". Bu, kapının yakalaması GEREKEN kusurun ta kendisidir ve buraya yalnız
 * kapının kırmızı verebildiğini kanıtlamak için konmuştur. Üretim yolu bunu
 * hiç görmez; `readPharmacyScope` tek yetkilidir.
 */
const LEGACY_CONTAINER_WORD =
  /(?:^|[^a-z0-9])(kutu[a-z]*|muhafaza[a-z]*|dolab[a-z]*|dolap|raf[a-z]*|kab[a-z]*|kap|cihaz[a-z]*|alet[a-z]*|kiti?|makine[a-z]*|canta[a-z]*|sepet[a-z]*|etiket[a-z]*|yazilim[a-z]*|stok[a-z]*|sise[a-z]*|tup[a-z]*)(?:[^a-z0-9]|$)/;

function mutationControl(): { caught: number; probes: string[] } {
  const probes = [
    "2 kutu ağrı kesici arıyorum",
    "Ağrı kesici arıyorum 2 kutu",
    "1 şişe öksürük şurubu arıyorum",
    "1 tüp merhem arıyorum",
    "Etiketli antibiyotik arıyorum",
    "Ağrı kesici stok almak istiyorum",
  ];
  let caught = 0;
  for (const probe of probes) {
    const folded = foldTr(probe);
    const legacyWouldOpenGate = LEGACY_CONTAINER_WORD.test(folded);
    const todayBlocks = readPharmacyScope(folded).kind === "MEDICINE_ITSELF";
    if (legacyWouldOpenGate && todayBlocks) caught += 1;
  }
  return { caught, probes };
}

function main(): void {
  console.log("=== verify-scope-metamorphic-v1 ===");
  console.log(
    `TOHUM: ${SEEDS.length} (kapsam dışı ${SEEDS.filter((s) => s.cls === "OUT_OF_SCOPE").length}, ` +
      `kapsam içi ${SEEDS.filter((s) => s.cls === "IN_SCOPE").length}, ` +
      `şüpheli ${SEEDS.filter((s) => s.cls === "SUSPECT").length})`,
  );
  console.log(
    `DÖNÜŞÜM: ${TRANSFORMS.length} tekli + ${PAIRS.length} ikili ` +
      `(${ALL_PAIRS.length} ikiliden her ${PAIR_SAMPLE_STEP}. alındı — örnekleme sessiz değil)`,
  );

  const { total, leaks } = run();
  console.log(`TÜRETİLMİŞ VAKA: ${total}`);

  const shown = leaks.slice(0, 40);
  for (const leak of shown) {
    console.log(
      `  KACAK [${leak.cls}] "${leak.seed}" --(${leak.transform})--> "${leak.derived}" ` +
        `beklenen=${leak.expected} gelen=${leak.got}`,
    );
  }
  if (leaks.length > shown.length) {
    console.log(`  ... ${leaks.length - shown.length} kaçak daha (ilk 40 gösterildi)`);
  }

  // Dönüşüm bazlı özet: hangi eksen kaçırıyor, tek bakışta görünsün.
  const byTransform = new Map<string, number>();
  for (const leak of leaks) {
    byTransform.set(leak.transform, (byTransform.get(leak.transform) ?? 0) + 1);
  }
  const top = [...byTransform.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (top.length) {
    console.log("");
    console.log("KACAK DAGILIMI (dönüşüme göre, ilk 15):");
    for (const [name, n] of top) console.log(`  ${String(n).padStart(4)}  ${name}`);
  }

  // Tüm kaçaklar diske yazılır: ilk 40 ekranda, tamamı dosyada. Kesilen
  // liste, "kaçak yok" sanılmasına yol açar.
  const outPath = join(__dirname, "..", "..", "..", "reports", "scope-metamorphic-kacaklar.jsonl");
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    const lines = leaks.map((l) => JSON.stringify(l));
    writeFileSync(outPath, lines.concat("").join(String.fromCharCode(10)), "utf8");
    console.log(`KACAK DOSYASI: ${outPath}`);
  } catch {
    console.log("KACAK DOSYASI: yazilamadi");
  }

  const control = mutationControl();
  console.log(
    `MUTASYON KONTROLÜ: ${control.caught}/${control.probes.length} — ` +
      "eski okuma kapıyı açardı, bugünkü kapı engelliyor",
  );

  const controlOk = control.caught === control.probes.length;
  console.log(`\n${total - leaks.length}/${total} yesil  ·  kacak ${leaks.length}`);
  if (leaks.length === 0 && controlOk) {
    console.log("PASS — kapsam karari anlam koruyan donusumler altinda kararli");
    process.exit(0);
  }
  if (!controlOk) {
    console.log(
      "KIRMIZI — mutasyon kontrolu gecmedi: kapi kendi yakalamasi gereken kusuru yakalamiyor",
    );
  }
  console.log(`KIRMIZI — ${leaks.length} kacak`);
  process.exit(1);
}

main();
