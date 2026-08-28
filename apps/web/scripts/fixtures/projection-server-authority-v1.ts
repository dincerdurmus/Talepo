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
 *   S04 create — `color` metinde YOKTUR ve `appliances` kategorisinin soru
 *       evreninde de bulunmaz; cevap kanalından gelse bile fail-closed kalır.
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

  /**
   * S04 — metinde olmayan, süzülmüş cevap kanalından gelen değer.
   *
   * `color` KATEGORİ DENETİMİNE TAKILIR (D3f Dilim 3h, 2026-08-28). Sahne
   * bir buzdolabı talebidir (`appliances`) ve `color` o kategorinin kamuya
   * açık soru evreninde YOKTUR — ne alan registry'sinde ne soru
   * profillerinde. Kurucu kararı gereği "mevcut kategori altında başka
   * kategori anahtarı gönderilince fail-closed" olur; cevap kanalı artık
   * kategori dışı bir anahtarı onaylayamaz. Bu bir sayaç düşürme DEĞİLDİR:
   * kimlik sayısı değişmedi (123), yalnız üç satırın beklenen seviyesi
   * SIKILAŞTI. Metinden türetim etkilenmez — kullanıcı gerçekten "beyaz
   * buzdolabı" yazarsa otorite metin kanalından gelmeye devam eder.
   */
  "S04/productType/attributes = USER_EXPLICIT",
  "S04/productType/constraints = USER_EXPLICIT",
  "S04/applianceType/attributes = USER_EXPLICIT",
  "S04/applianceType/constraints = USER_EXPLICIT",
  "S04/color/attributes = UNKNOWN",
  "S04/color/constraints = UNKNOWN",

  /* S05 — aynı alanın iki yüzeyi ayrışır: cevap yalnız birini doğrular. */
  "S05/productType/attributes = USER_EXPLICIT",
  "S05/productType/constraints = USER_EXPLICIT",
  "S05/applianceType/attributes = USER_EXPLICIT",
  "S05/applianceType/constraints = USER_EXPLICIT",
  "S05/color/attributes = UNKNOWN",
  "S05/color/constraints = UNKNOWN",

  /**
   * S10 / S11 — AYNI ALAN, İKİ KANIT KANALI (D3f Dilim 3h, 2026-08-28).
   *
   * Kategori denetimi `color`ı appliances cevap evreninin dışında tutar.
   * Bu çift, denetimin METİN kanalını kapatmadığını kilitler:
   *
   *   S10 — renk kullanıcının kendi cümlesindedir ("Beyaz buzdolabi
   *         ariyorum"); istemci structured alan, `fieldAuthority` ya da
   *         sahte provenance GÖNDERMEZ ve cevap kanalı boştur. Sunucu
   *         kendi metninden türetir: iki yüzey de `USER_EXPLICIT`, değer
   *         taşıyan `constraints.color` korunur.
   *   S11 — aynı alan, aynı değer, aynı kategori; ama kanıt yalnız
   *         istemcinin structured metadata'sındadır ve otorite haritası
   *         sahtedir. İki yüzey de `UNKNOWN` kalır.
   *
   * İkisi arasındaki tek fark kanıtın kaynağıdır.
   */
  "S10/productType/attributes = USER_EXPLICIT",
  "S10/productType/constraints = USER_EXPLICIT",
  "S10/applianceType/attributes = USER_EXPLICIT",
  "S10/applianceType/constraints = USER_EXPLICIT",
  "S10/color/attributes = USER_EXPLICIT",
  "S10/color/constraints = USER_EXPLICIT",

  "S11/productType/attributes = USER_EXPLICIT",
  "S11/productType/constraints = USER_EXPLICIT",
  "S11/applianceType/attributes = USER_EXPLICIT",
  "S11/applianceType/constraints = USER_EXPLICIT",
  "S11/color/attributes = UNKNOWN",
  "S11/color/constraints = UNKNOWN",

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

  /* ---------------------------------------------------------------- *
   * D3e — DEĞER TAŞIMAYAN CEVAP MODLARI (2026-08-27)
   *
   * Kullanıcının UI'den seçtiği "Fark etmez" kanonik durumda
   * `kind:"ANY", value:null` üretir ve `rawInput`ta HİÇ GEÇMEZ (yayın akışı
   * kullanıcının özgün metnini bilerek korur). Cevap kanalı yalnız `string`
   * taşıdığı sürece bu tercih sunucuya ulaşamıyordu; artık kanonik `mode`
   * ile taşınır. `brand` bu senaryolarda YALNIZ `constraints` yüzeyinde
   * yaşar — `"Fark etmez"` etiketi hiçbir koşulda bir attribute DEĞERİ
   * değildir, bu yüzden `S20/brand/attributes` diye bir kimlik YOKTUR.
   * ---------------------------------------------------------------- */

  /* S20 — create: kullanıcı UI'den ANY seçti, cevap kanalı `mode:"ANY"`
   * taşıyor. İstemcinin otorite haritası yine tamamen yok sayılıyor. */
  "S20/productType/attributes = USER_EXPLICIT",
  "S20/screenSize/attributes = USER_EXPLICIT",
  "S20/needType/attributes = INFERRED",
  "S20/solutionType/attributes = INFERRED",
  "S20/brand/constraints = USER_EXPLICIT",
  "S20/productType/constraints = USER_EXPLICIT",
  "S20/screenSize/constraints = USER_EXPLICIT",
  "S20/needType/constraints = INFERRED",
  "S20/solutionType/constraints = INFERRED",

  /* S21 — create: constraint ANY duruyor ama cevap kanalında karşılığı YOK;
   * istemci yalnız `fieldAuthority` etiketi eklemiş. Etiket kanıt değildir. */
  "S21/productType/attributes = USER_EXPLICIT",
  "S21/screenSize/attributes = USER_EXPLICIT",
  "S21/needType/attributes = INFERRED",
  "S21/solutionType/attributes = INFERRED",
  "S21/brand/constraints = UNKNOWN",
  "S21/productType/constraints = USER_EXPLICIT",
  "S21/screenSize/constraints = USER_EXPLICIT",
  "S21/needType/constraints = INFERRED",
  "S21/solutionType/constraints = INFERRED",

  /* S22 — update/edit: düzenleme ekranı ANY constraint'in KENDİSİNİ artık
   * kaybetmiyor ve tercih typed cevap olarak sunucuya ulaşıyor. */
  "S22/productType/attributes = USER_EXPLICIT",
  "S22/screenSize/attributes = USER_EXPLICIT",
  "S22/needType/attributes = INFERRED",
  "S22/solutionType/attributes = INFERRED",
  "S22/brand/constraints = USER_EXPLICIT",
  "S22/productType/constraints = USER_EXPLICIT",
  "S22/screenSize/constraints = USER_EXPLICIT",
  "S22/needType/constraints = INFERRED",
  "S22/solutionType/constraints = INFERRED",

  /* S27a — clone: kaynak browse-ANY taşıyor ama kaynağın `rawInput`unda
   * karşılığı yok. Clone yeni bir kullanıcı beyanı ÜRETMEZ. */
  "S27a/productType/attributes = USER_EXPLICIT",
  "S27a/screenSize/attributes = USER_EXPLICIT",
  "S27a/needType/attributes = INFERRED",
  "S27a/solutionType/attributes = INFERRED",
  "S27a/brand/constraints = UNKNOWN",
  "S27a/productType/constraints = USER_EXPLICIT",
  "S27a/screenSize/constraints = USER_EXPLICIT",
  "S27a/needType/constraints = INFERRED",
  "S27a/solutionType/constraints = INFERRED",

  /* S27b — clone: kaynağın metninde "marka fark etmez" YAZILI; otorite
   * kaynağın kendi metninden yeniden türetilir, uydurulmaz. */
  "S27b/productType/attributes = USER_EXPLICIT",
  "S27b/screenSize/attributes = USER_EXPLICIT",
  "S27b/needType/attributes = INFERRED",
  "S27b/solutionType/attributes = INFERRED",
  "S27b/brand/constraints = USER_EXPLICIT",
  "S27b/productType/constraints = USER_EXPLICIT",
  "S27b/screenSize/constraints = USER_EXPLICIT",
  "S27b/needType/constraints = INFERRED",
  "S27b/solutionType/constraints = INFERRED",
];

/**
 * SEVİYE DAĞILIMI. Kimlik listesi tek başına yeterli değildir: toplu bir
 * kayma (örneğin her şeyin `UNKNOWN`a düşmesi) kimlik listesinde satır satır
 * görünür ama dağılım tek bakışta okunabilir bir güvenlik göstergesidir.
 *
 * D3f Dilim 3h (2026-08-28), birinci tur: kimlik sayısı DEĞİŞMEDİ (123).
 * Kategori denetimi devreye girince kategori dışı `color` anahtarının üç
 * yüzeyi `USER_EXPLICIT` yerine `UNKNOWN` okunur; dağılım 68→65 / 9→12
 * olarak SIKILAŞTI. Bu bir gevşeme değil, cevap kabulünün daralmasıdır.
 *
 * İkinci tur: S10/S11 çifti eklendi. Kimlik 123 → 135 (+12: S10 altı, S11
 * altı satır). Dağılım USER_EXPLICIT 65 → 75 (+10) ve UNKNOWN 12 → 14 (+2);
 * artışların TAMAMI yeni senaryolardan gelir, mevcut hiçbir satırın
 * beklentisi değişmedi.
 */
export const SERVER_AUTHORITY_BASELINE = {
  identities: 135,
  UNKNOWN: 14,
  INFERRED: 28,
  VERIFIED: 18,
  USER_EXPLICIT: 75,
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
