/**
 * KAPI: İLAÇ / ECZANE KAPSAM KARARI (kurucu, 2026-09-21 — D-0028).
 *
 * NE KANITLAR. "İlaç, eczane işimiz değil" kararı koda gerçekten girdi mi ve
 * AYRIM DOĞRU YERDE Mİ: ilacın kendisi kapsam dışı, ilacı saklayan/taşıyan
 * ürün Sağlık'ta DEMAND. İkisi aynı cümlede "ilaç" sözcüğünü taşır; kapı
 * sözcüğe değil ürüne bakmak zorundadır.
 *
 * NEDEN AYRI BİR KAPI. Bu karar yalnız bir regex değil, kapsam otoritesinin
 * yeni bir değeridir: isUnsupportedRequestScope() üzerinden soru motoru,
 * yayın kapısı ve snapshot aynı anda kapanır. Tek bir yerde bozulursa
 * sessizce yanlış davranır — bu yüzden POZİTİF ve NEGATİF iki taraf da
 * burada kırmızıya bağlanır (T9: her kapı mutasyonla kanıtlanır).
 *
 * AĞ GEREKTİRMEZ. Deterministik kapıdır, CI'da koşar.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { understandRequest } from "@/lib/request-understanding/understand-request";
import { parseCreateRequestInput } from "@/server/request/request-schema";
import { isUnsupportedRequestScope } from "@/lib/request-understanding/types";
import {
  outOfScopeNoticeFor,
  OUT_OF_SCOPE_PHARMACY_NOTICE,
  OUT_OF_SCOPE_SUPPLY_NOTICE,
  OUT_OF_SCOPE_MEDICAL_ADVICE_NOTICE,
} from "@/lib/request-composer/v2/publish-readiness";

type Vaka = { input: string; beklenen: string; neden: string };

/**
 * SERT DURUŞ (kurucu, 2026-09-21): ilaç talebi yalnız "kapsam dışı" etiketi
 * almaz — SİTE İLERLETMEZ. Bu kapı üç şeyi birden arar ve üçü de kırmızıya
 * bağlıdır: kapsam değeri, kategori uydurulmaması, ve yayın akışının
 * BLOCKED olması. Yalnız birincisini denemek kapıyı yarım kapatmaktır.
 */

/** Kapsam DIŞI olmalı: istenen şey ilacın kendisi. */
const KAPSAM_DISI: Vaka[] = [
  { input: "Ağrı kesici arıyorum", beklenen: "UNSUPPORTED_PHARMACY", neden: "ilaç ürünü" },
  { input: "agri kesici ariyorum", beklenen: "UNSUPPORTED_PHARMACY", neden: "diyakritiksiz yazım aynı kapı" },
  { input: "AĞRI KESİCİ ARIYORUM", beklenen: "UNSUPPORTED_PHARMACY", neden: "büyük harf aynı kapı" },
  { input: "Antibiyotik almak istiyorum", beklenen: "UNSUPPORTED_PHARMACY", neden: "ilaç ürünü" },
  // ÜNSÜZ YUMUŞAMASI — kapının ilk kırmızısı buradan geldi (2026-09-21).
  // "şurup" → "şurub-u", "antibiyotik" → "antibiyoti-ği": kök sert biçimde
  // sabitlenirse ekli yazım hiç eşleşmez. Sınıf burada kırmızıya bağlandı.
  { input: "Öksürük şurubu arıyorum", beklenen: "UNSUPPORTED_PHARMACY", neden: "p→b yumuşaması" },
  { input: "Ateş düşürücü şurup arıyorum", beklenen: "UNSUPPORTED_PHARMACY", neden: "eksiz biçim de geçmeli" },
  { input: "Vitamin hapı arıyorum", beklenen: "UNSUPPORTED_PHARMACY", neden: "ilaç ürünü" },
  { input: "Reçetesiz ilaç arıyorum", beklenen: "UNSUPPORTED_PHARMACY", neden: "ilaç ürünü" },
];

/** Kapsam İÇİ kalmalı: istenen şey ilaç değil, ilacın etrafındaki ürün. */
const KAPSAM_ICI: Vaka[] = [
  { input: "İlaç kutusu arıyorum", beklenen: "DEMAND", neden: "saklama ürünü — taksonomide Sağlık yaprağı" },
  { input: "İlaç dolabı arıyorum", beklenen: "DEMAND", neden: "mobilya/saklama ürünü" },
  { input: "Hap muhafazası arıyorum", beklenen: "DEMAND", neden: "saklama ürünü" },
  { input: "Eczane için etiket yazılımı arıyorum", beklenen: "DEMAND", neden: "yazılım talebi" },
  { input: "Şurup şişesi arıyorum", beklenen: "DEMAND", neden: "yumuşama sınıfının negatif tarafı — kap, ilaç değil" },
  { input: "Tansiyon aleti arıyorum", beklenen: "DEMAND", neden: "medikal cihaz — Sağlık'ın kendi yaprağı" },
  { input: "Hasta yatağı kiralamak istiyorum", beklenen: "DEMAND", neden: "klinik donanım" },
];

/** Komşu kapsam kararları bozulmamalı — bu kapı onları çalmaz. */
const KOMSU: Vaka[] = [
  { input: "Hangi tansiyon ilacını kullanmalıyım", beklenen: "UNSUPPORTED_MEDICAL_ADVICE", neden: "soru biçimi kapısı önce gelir" },
  { input: "Aracımı satmak istiyorum", beklenen: "UNSUPPORTED_SUPPLY", neden: "arz ilanı" },
];

let kirmizi = 0;
const satir: string[] = [];

function kos(baslik: string, vakalar: Vaka[]): void {
  satir.push(`\n--- ${baslik} ---`);
  for (const v of vakalar) {
    const r = understandRequest(v.input);
    const gelen = String(r.requestScope.value);
    const ok = gelen === v.beklenen;
    if (!ok) kirmizi += 1;
    satir.push(
      `${ok ? "  yesil" : "  KIRMIZI"}  "${v.input}" → ${gelen}` +
        (ok ? "" : ` (beklenen ${v.beklenen})`) +
        `   [${v.neden}]`,
    );
    if (!ok) continue;
    if (isUnsupportedRequestScope(gelen)) {
      /** Kapsam dışı talep kategori UYDURAMAZ ("ölçtüm, yok" ≠ "ölçemedim"). */
      if (r.category.value !== null) {
        kirmizi += 1;
        satir.push(`  KIRMIZI  kapsam disi talebe kategori uyduruldu: ${r.category.value}`);
      }
      /** SERT DURUŞ: yayın akışı kapalı olmalı. ENRICHABLE yetmez. */
      if (r.publishReadiness.status !== "BLOCKED") {
        kirmizi += 1;
        satir.push(
          `  KIRMIZI  kapsam disi talep yayin akisinda ilerliyor: ${r.publishReadiness.status}`,
        );
      }
      /** Almayacağımız bir talebi zenginleştirmek için soru sorulmaz. */
      if (r.recommendedQuestions.length > 0) {
        kirmizi += 1;
        satir.push(
          `  KIRMIZI  kapsam disi talebe ${r.recommendedQuestions.length} soru onerildi`,
        );
      }
    } else {
      /**
       * TERS TARAF: kapsam İÇİ talep bu kapı yüzünden durmamalı. Kurucu
       * ayrımı nettir — "kategoriye bağlanmasa da aratılabilir, ilaç gibi
       * şeyler sıkıntılıdır". Yani sert duruş YALNIZ kapsam dışına aittir.
       */
      if (r.publishReadiness.status === "BLOCKED") {
        kirmizi += 1;
        satir.push(`  KIRMIZI  gecerli talep BLOCKED'a dustu: ${r.publishReadiness.reasons.join(", ")}`);
      }
    }
  }
}

kos("KAPSAM DISI olmali (ilacin kendisi)", KAPSAM_DISI);
kos("KAPSAM ICI kalmali (ilacin etrafindaki urun)", KAPSAM_ICI);
/**
 * KATEGORİYE BAĞLANMAYAN GEÇERLİ TALEP — kurucu ayrımı (2026-09-21):
 * "geri kalan şeyler kategoriye bağlanmasa da aratılabilir". Yani kök
 * bulunamaması bir durdurma sebebi DEĞİLDİR; yalnız kapsam dışı olmak öyledir.
 * Bu blok sert duruşun taşmadığını kanıtlar.
 */
const KATEGORISIZ: Vaka[] = [
  { input: "Sirkeli kokulu mum yaptırmak istiyorum", beklenen: "DEMAND", neden: "kok belirsiz olabilir ama gecerli talep" },
  { input: "Paraglayt kanadi kiralamak istiyorum", beklenen: "DEMAND", neden: "taksonomide yok, yine de talep" },
];

kos("KOMSU kapsam kararlari bozulmamali", KOMSU);
kos("KATEGORIYE BAGLANMAYAN talep DURMAMALI", KATEGORISIZ);

/**
 * KULLANICIYA NE SÖYLENİYOR — sessizce engellemek yetmez.
 *
 * Kurucu (2026-09-21): "böyle bir talep gelince ne yapacak? uyarıda bulunması
 * lazım." Engel doğru metinle birlikte gelmezse kullanıcı ya çıkmazda kalır ya
 * da YANLIŞ bilgilenir. Ölçüldü: eczane değeri eklendiğinde metin eşlemesi
 * varsayılana düşüyordu ve ilaç arayana "satış ilanı yayınlayamazsınız"
 * deniyordu — susmaktan kötü. Bu blok onu kırmızıya bağlar.
 */
satir.push("\n--- KULLANICIYA GOSTERILEN METIN ---");
{
  const eczane = outOfScopeNoticeFor("UNSUPPORTED_PHARMACY");
  const kontroller: Array<[boolean, string]> = [
    [eczane === OUT_OF_SCOPE_PHARMACY_NOTICE, "eczane kapsami kendi metnini aliyor"],
    [eczane !== OUT_OF_SCOPE_SUPPLY_NOTICE, "eczane metni 'satis ilani'na DUSMUYOR"],
    [/aranamaz|yayinlanamaz|yayınlanamaz/i.test(eczane), "metin acikca 'aranamaz/yayinlanamaz' diyor"],
    [/eczane|hekim/i.test(eczane), "dogru mercii gosteriyor"],
    [
      outOfScopeNoticeFor("UNSUPPORTED_SUPPLY") === OUT_OF_SCOPE_SUPPLY_NOTICE,
      "arz ilani metni bozulmadi",
    ],
    [
      !/ağrı kesici|agri kesici/i.test(OUT_OF_SCOPE_MEDICAL_ADVICE_NOTICE),
      "tibbi tavsiye metni artik kapsam disi bir ornek ONERMIYOR",
    ],
  ];
  for (const [ok, ad] of kontroller) {
    if (!ok) kirmizi += 1;
    satir.push(`${ok ? "  yesil" : "  KIRMIZI"}  ${ad}`);
  }
}

/**
 * SUNUCU YAYIN KAPISI - EN YETKILI KARAR (2026-09-21).
 *
 * NEDEN BURADA. Yukaridaki bloklar beynin kararini olcer; ama Request satirini
 * yaratan karar sunucudadir ve OLCULDU: duzeltmeden once
 * `parseCreateRequestInput` kapsam degerlerini ELLE sayiyordu (uc deger) ve
 * "Agri kesici ariyorum" bu kapidan GECIYORDU - yani ilac talebi satir
 * olusturabiliyor, oradan eslestirme/fanout/bildirim yollarina ulasabiliyordu.
 * Tek ornegi duzeltmek yetmez: asagidaki liste SINIFI kirmiziya baglar, yani
 * `RequestScope`'a eklenen her kapsam-disi deger burada da durmak zorundadir.
 *
 * Ag gerektirmez: bu fonksiyon saf dogrulama yapar, veritabanina dokunmaz.
 */
satir.push("\n--- SUNUCU YAYIN KAPISI (parseCreateRequestInput) ---");
{
  const govde = (metin: string) => ({
    title: "Talep basligi",
    description: metin,
    rawInput: metin,
    category: { slug: "health", name: "Saglik" },
    city: "Istanbul",
    publishVersion: "ai",
    fields: [],
  });

  const durmali: Array<[string, string]> = [
    ["Agri kesici ariyorum", "UNSUPPORTED_PHARMACY"],
    ["Aracimi satmak istiyorum", "UNSUPPORTED_SUPPLY"],
    ["Hangi tansiyon ilacini kullanmaliyim", "UNSUPPORTED_MEDICAL_ADVICE"],
    ["Tibbi tahlil yaptirmak istiyorum", "UNSUPPORTED_REMOVED_SCOPE"],
  ];

  for (const [metin, kapsam] of durmali) {
    const gercekKapsam = String(understandRequest(metin).requestScope.value);
    if (gercekKapsam !== kapsam) {
      kirmizi += 1;
      satir.push(`  KIRMIZI  vaka kapsami kaydi: "${metin}" -> ${gercekKapsam} (beklenen ${kapsam})`);
      continue;
    }
    let durdu = false;
    let mesaj = "";
    try {
      parseCreateRequestInput(govde(metin));
    } catch (hata) {
      durdu = true;
      const sorunlar = (hata as { issues?: string[] }).issues ?? [];
      mesaj = sorunlar.join(" | ");
    }
    if (!durdu) {
      kirmizi += 1;
      satir.push(`  KIRMIZI  sunucu kapisi gecirdi: ${kapsam} - "${metin}"`);
      continue;
    }
    /* Metin kanonik esleme ile AYNI olmali: sunucu ile composer ayri cumle
     * soylerse kullanici hangisine inanacagini bilemez. */
    if (!mesaj.includes(outOfScopeNoticeFor(kapsam))) {
      kirmizi += 1;
      satir.push(`  KIRMIZI  sunucu kapisi kanonik metni kullanmiyor: ${kapsam}`);
      continue;
    }
    satir.push(`  yesil  sunucu kapisi durdurdu + kanonik metin: ${kapsam}`);
  }

  /* TERS TARAF: gecerli talep sunucu kapisinda durmamali. */
  let gecerliDurdu = false;
  try {
    parseCreateRequestInput(govde("Tansiyon aleti ariyorum kablosuz olsun"));
  } catch {
    gecerliDurdu = true;
  }
  if (gecerliDurdu) {
    kirmizi += 1;
    satir.push("  KIRMIZI  gecerli talep sunucu kapisinda durdu");
  } else {
    satir.push("  yesil  gecerli talep sunucu kapisindan gecti");
  }
}

/**
 * ARAMA / ILERLETME YUZEYLERI - SINIF KAPISI (2026-09-21).
 *
 * Kurucunun cumlesi "ilac arayan kisi bunu arayamamali ve site ilerletmemeli"
 * yayin kapisiyla sinirli degil: kullaniciya "kac firma bulunur" ya da "piyasa
 * su fiyat" diyen her yuzey talebi ILERLETIR. Bu yuzeyler bugune kadar hic
 * olculmedi; ilac metni orada tesaduf en duruyordu (kategori cozulemedigi icin),
 * ama istemci `categoryLocked=1` ile kategori dayatabiliyordu.
 *
 * Tek tek ornek yerine SINIF baglanir: kullanicinin serbest metnini beyne veren
 * her API rotasi kapsam kararini da okumak zorundadir. Yeni bir rota yazildigi
 * gun kapiyi unutursa bu kontrol kirmizi verir.
 */
satir.push("\n--- ARAMA/ILERLETME YUZEYLERI (API rotalari) ---");
{
  const apiKok = join(process.cwd(), "src", "app", "api");
  const beyniCagiranlar: string[] = [];

  const gez = (dizin: string): void => {
    for (const ad of readdirSync(dizin)) {
      const tam = join(dizin, ad);
      if (statSync(tam).isDirectory()) {
        gez(tam);
        continue;
      }
      if (!/\.(?:ts|tsx)$/.test(ad)) continue;
      const metin = readFileSync(tam, "utf8");
      if (!/understandRequest\s*\(/.test(metin)) continue;
      beyniCagiranlar.push(relative(process.cwd(), tam));
      const kapiVar = /isUnsupportedRequestScope\s*\(/.test(metin);
      if (!kapiVar) {
        kirmizi += 1;
        satir.push(`  KIRMIZI  beyni okuyor ama kapsam kapisi yok: ${relative(process.cwd(), tam)}`);
      } else {
        satir.push(`  yesil  kapsam kapisi var: ${relative(process.cwd(), tam)}`);
      }
    }
  };
  gez(apiKok);

  /* Bir yuzeyin kaybolmasi da bir regresyondur: sayac sifirlanirsa kontrol
   * hicbir sey olcmeden yesil gorunurdu. */
  if (beyniCagiranlar.length === 0) {
    kirmizi += 1;
    satir.push("  KIRMIZI  beyni cagiran hicbir API rotasi bulunamadi - tarama bozuk");
  }
}

console.log("=== verify-pharmacy-scope-v1 ===");
console.log(satir.join("\n"));
/**
 * TOPLAM SATIRDAN SAYILIR, ELLE TOPLANMAZ (2026-09-21).
 *
 * Onceki hali vaka dizilerinin uzunluklarini toplayip metin kontrolleri icin
 * sabit bir "6" ekliyordu. Sunucu kapisi ve API yuzeyi bloklari DINAMIK sayida
 * satir uretir (rota sayisi degisir); elle toplam bu blogu hic saymaz ve kapi
 * yanlis bir payda ile yesil gorunurdu. Artik payda uretilen satirlardan gelir.
 */
const yesilSayisi = satir.filter((l) => l.startsWith("  yesil")).length;
const toplam = yesilSayisi + kirmizi;
console.log(
  `\n${yesilSayisi}/${toplam} yesil` +
    (kirmizi ? `  · ${kirmizi} KIRMIZI` : "  ·  kapi kapali"),
);
process.exit(kirmizi ? 1 : 0);
