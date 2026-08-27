/**
 * SUNUCU GÜVEN SINIRI TABANI — D3d (2026-08-27).
 *
 * BU DOSYA BAĞIMSIZ BİR VERİ OTORİTESİDİR. Üretim kodundan ya da
 * doğrulayıcıdan TÜRETİLMEZ; elle yazılır ve içinde `import` bulunmadığı
 * doğrulayıcı tarafından ayrıca denetlenir. Amaç, "sahte otorite 0" hükmünün
 * sahte yeşile dönmesini engellemektir: bir kimlik ölçüm evreninden sessizce
 * kaybolursa yanlış etiketlenecek kimse kalmadığı için de sıfır çıkardı.
 *
 * KİMLİK BİÇİMİ `senaryo/alanAnahtarı/yüzey = OTORİTE`. Yüzey kimliğin
 * PARÇASIDIR: aynı alan iki yüzeyde birden yaşayabilir ve ayrışabilir
 * (S05'te `color` bunu gösterir — `attributes` yüzeyi doğrulanamaz, aynı
 * alanın `constraints` yüzeyi doğrulanır).
 *
 * `UNKNOWN` SATIRLARI DA DONDURULUR. Otorite haritasında `UNKNOWN` bir giriş
 * YAZILMAZ; okuma sınırı eksik girişi `UNKNOWN` okur. Kimlik evreni
 * projection'da GERÇEKTEN var olan `attributes`/`constraints` yüzeylerinden
 * kurulduğu için, sahte bir seviyenin düşürüldüğü de burada ölçülebilir kalır.
 *
 * SENARYOLAR
 *   S01 create — istemci sahte `VERIFIED` gönderir, üstelik değeri de
 *       değiştirmiştir; ayrıca uydurma ve iç kanıt anahtarları ekler.
 *   S02 create — istemci metinde hiç geçmeyen bir markaya `USER_EXPLICIT`
 *       damgası vurur, cevap kanalı boştur.
 *   S03 create — istemci HER ŞEYE `UNKNOWN` der; sunucu doğru seviyeleri
 *       yeniden türetir. `model` cevap kanalında da vardır ama katalogdan
 *       gelen `VERIFIED` cevap kanalıyla EZİLMEZ; `needType` ise yalnız
 *       çıkarımdır ve süzülmüş cevap kanalıyla onaylandığı için yükselir.
 *   S04 create — `color` metinde YOKTUR, yalnız süzülmüş cevap kanalından
 *       gelir; kullanıcı beyanı olarak kabul edilir.
 *   S05 create — `attributes.color` değeri değiştirilmiş, `constraints.color`
 *       cevapla uyumlu kalmıştır; iki yüzey ayrışır.
 *   S06 update — payload'da `rawInput` YOKTUR; sunucu kendi kaydettiği
 *       metinden türetir ve istemcinin sahte `USER_EXPLICIT`lerini düzeltir.
 *   S08 clone — kaynak kaydın `fieldAuthority`'si yok sayılır, kaynağın
 *       `rawInput`'undan yeniden türetilir.
 *   S09 clone — metinden türetilemeyen kopya alan `UNKNOWN` kalır; clone
 *       yeni bir kullanıcı beyanı ÜRETMEZ.
 *
 * (S07, S10–S12 kimlik üretmeyen sözleşme kontrolleridir ve doğrulayıcıda
 * ayrı ayrı ölçülür: projection göndermeyen update, prototype anahtarları,
 * legacy okuma, idempotence, mutasyonsuzluk, payload drift.)
 */

export const FROZEN_SERVER_AUTHORITY_IDENTITIES: readonly string[] = [
  /* S01 — sahte VERIFIED + değiştirilmiş değer + kirli anahtarlar.
   * `condition` değeri "Sıfır"a çevrilmiştir; sunucunun metni "İkinci el"
   * diyor, yani gelen seviye O DEĞERE ait değildir ve taşınamaz.
   * `usageArea` istemcide `USER_EXPLICIT` etiketlidir; sunucu onu kendi
   * tahmini olarak yeniden türetir ve YALAN DÜZELTİLİR. */
  "S01/condition/attributes = UNKNOWN",
  "S01/condition/constraints = UNKNOWN",
  "S01/productType/attributes = USER_EXPLICIT",
  "S01/productType/constraints = USER_EXPLICIT",
  "S01/furnitureType/attributes = USER_EXPLICIT",
  "S01/furnitureType/constraints = USER_EXPLICIT",
  "S01/usageArea/attributes = INFERRED",
  "S01/usageArea/constraints = INFERRED",

  /* S02 — metinde geçmeyen marka, cevap kanalı boş. */
  "S02/condition/attributes = USER_EXPLICIT",
  "S02/condition/constraints = USER_EXPLICIT",
  "S02/productType/attributes = USER_EXPLICIT",
  "S02/productType/constraints = USER_EXPLICIT",
  "S02/furnitureType/attributes = USER_EXPLICIT",
  "S02/furnitureType/constraints = USER_EXPLICIT",
  "S02/usageArea/attributes = INFERRED",
  "S02/usageArea/constraints = INFERRED",
  "S02/brand/attributes = UNKNOWN",
  "S02/brand/constraints = UNKNOWN",

  /* S03 — istemci hepsine UNKNOWN dedi; sunucu doğrusunu türetir.
   * `model` cevap kanalında da var ama katalog doğrulaması korunur. */
  "S03/brand/attributes = USER_EXPLICIT",
  "S03/brand/constraints = USER_EXPLICIT",
  "S03/model/attributes = VERIFIED",
  "S03/model/constraints = VERIFIED",
  "S03/productType/attributes = USER_EXPLICIT",
  "S03/productType/constraints = USER_EXPLICIT",
  "S03/needType/attributes = USER_EXPLICIT",
  "S03/needType/constraints = USER_EXPLICIT",
  "S03/part/attributes = VERIFIED",
  "S03/part/constraints = VERIFIED",
  "S03/partPosition/attributes = USER_EXPLICIT",
  "S03/partPosition/constraints = USER_EXPLICIT",
  "S03/partSystem/attributes = VERIFIED",
  "S03/partSystem/constraints = VERIFIED",

  /* S04 — metinde olmayan, süzülmüş cevap kanalından gelen değer. */
  "S04/productType/attributes = USER_EXPLICIT",
  "S04/productType/constraints = USER_EXPLICIT",
  "S04/applianceType/attributes = USER_EXPLICIT",
  "S04/applianceType/constraints = USER_EXPLICIT",
  "S04/color/attributes = USER_EXPLICIT",
  "S04/color/constraints = USER_EXPLICIT",

  /* S05 — aynı alanın iki yüzeyi ayrışır: cevap yalnız birini doğrular. */
  "S05/productType/attributes = USER_EXPLICIT",
  "S05/productType/constraints = USER_EXPLICIT",
  "S05/applianceType/attributes = USER_EXPLICIT",
  "S05/applianceType/constraints = USER_EXPLICIT",
  "S05/color/attributes = UNKNOWN",
  "S05/color/constraints = USER_EXPLICIT",

  /* S06 — update, payload'da rawInput yokken sunucunun kendi metnini okur. */
  "S06/brand/attributes = USER_EXPLICIT",
  "S06/brand/constraints = USER_EXPLICIT",
  "S06/model/attributes = VERIFIED",
  "S06/model/constraints = VERIFIED",
  "S06/productType/attributes = USER_EXPLICIT",
  "S06/productType/constraints = USER_EXPLICIT",
  "S06/needType/attributes = INFERRED",
  "S06/needType/constraints = INFERRED",
  "S06/part/attributes = VERIFIED",
  "S06/part/constraints = VERIFIED",
  "S06/partPosition/attributes = USER_EXPLICIT",
  "S06/partPosition/constraints = USER_EXPLICIT",
  "S06/partSystem/attributes = VERIFIED",
  "S06/partSystem/constraints = VERIFIED",

  /* S08 — clone kaynağın etiketine değil kaynağın metnine bakar. */
  "S08/brand/attributes = USER_EXPLICIT",
  "S08/brand/constraints = USER_EXPLICIT",
  "S08/model/attributes = VERIFIED",
  "S08/model/constraints = VERIFIED",
  "S08/productType/attributes = USER_EXPLICIT",
  "S08/productType/constraints = USER_EXPLICIT",
  "S08/needType/attributes = INFERRED",
  "S08/needType/constraints = INFERRED",
  "S08/part/attributes = VERIFIED",
  "S08/part/constraints = VERIFIED",
  "S08/partPosition/attributes = USER_EXPLICIT",
  "S08/partPosition/constraints = USER_EXPLICIT",
  "S08/partSystem/attributes = VERIFIED",
  "S08/partSystem/constraints = VERIFIED",

  /* S09 — clone yeni kullanıcı beyanı üretmez; türetilemeyen UNKNOWN kalır. */
  "S09/productType/attributes = USER_EXPLICIT",
  "S09/productType/constraints = USER_EXPLICIT",
  "S09/applianceType/attributes = USER_EXPLICIT",
  "S09/applianceType/constraints = USER_EXPLICIT",
  "S09/color/attributes = UNKNOWN",
  "S09/color/constraints = UNKNOWN",
];

/**
 * SEVİYE DAĞILIMI. Kimlik listesi tek başına yeterli değildir: toplu bir
 * kayma (örneğin her şeyin `UNKNOWN`a düşmesi) kimlik listesinde satır satır
 * görünür ama dağılım tek bakışta okunabilir bir güvenlik göstergesidir.
 */
export const SERVER_AUTHORITY_BASELINE = {
  identities: 78,
  UNKNOWN: 7,
  INFERRED: 8,
  VERIFIED: 18,
  USER_EXPLICIT: 45,
} as const;

/**
 * EDİT EKRANI CEVAP KANALI TABANI.
 *
 * `EditRequestForm` `fields[]` listesini eskiden doğrudan `dynamicValues`tan
 * kuruyordu; `dynamicValues` kullanıcı dokunmadığı alanları anlama
 * katmanının TAHMİNİYLE doldurur. Aşağıdaki satırlar, kanonik yayın
 * süzgecinden geçtikten sonra hangi anahtarın cevap kanalına GİRDİĞİNİ
 * dondurur. `-` girmediğini, `+` girdiğini gösterir.
 *
 * E1 kullanıcı hiçbir alana dokunmadı — yalnız çıkarım olan `usageArea`
 *    düşer, kullanıcının metninden gelenler kalır.
 * E2 kullanıcı `usageArea`ya dokundu — artık onun cevabıdır, kalır.
 * E3 kullanıcı `usageArea`yı tahminden FARKLI bir değere çevirdi —
 *    dokunuş listesi boş olsa bile kullanıcının girdisi tahmine indirgenmez.
 */
export const FROZEN_EDIT_ANSWER_CHANNEL: readonly string[] = [
  "E1/condition = +",
  "E1/productType = +",
  "E1/furnitureType = +",
  "E1/usageArea = -",
  "E2/condition = +",
  "E2/productType = +",
  "E2/furnitureType = +",
  "E2/usageArea = +",
  "E3/condition = +",
  "E3/productType = +",
  "E3/furnitureType = +",
  "E3/usageArea = +",
];

/**
 * UÇTAN UCA EDİT KANARYASI. Süzgeçten geçen `fields[]` update güven
 * sınırına verildiğinde, dokunulmamış tahmin `USER_EXPLICIT` OLMAMALIDIR.
 */
export const FROZEN_EDIT_END_TO_END: readonly string[] = [
  "E4/condition/attributes = USER_EXPLICIT",
  "E4/productType/attributes = USER_EXPLICIT",
  "E4/furnitureType/attributes = USER_EXPLICIT",
  "E4/usageArea/attributes = INFERRED",
];
