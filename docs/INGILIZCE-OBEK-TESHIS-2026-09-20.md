# İngilizce ürün öbeği ekseni — teşhis (2026-09-20)

Bu not OL-0011 Sınıf B'deki iki bilinen kırmızının ("Xbox Series X arıyorum"
→ özne/kategori/marka null; "55'' Arçelik Smart TV" → ürün türü null) kök
neden teşhisidir. Görev tanımı gereği kök neden TEK çıkmazsa düzeltmeye
GEÇİLMEZ; ölçüm çok çıktı, bu yüzden bu belge düzeltme değil teşhistir.
Bütün satırlar bu tarihte canlı beyinden (understandRequest → karar
sözleşmesi → talepo-builtin) ölçülmüştür; hiçbir satır tahmin değildir.

## 12 girdilik örneklem (ölçüldü)

| Girdi | Kategori | productType | Marka | subjectKind | Durum |
|---|---|---|---|---|---|
| Xbox Series X arıyorum | null ("no category evidence") | null | null | PRODUCT | DÜŞÜYOR (tam kayıp) |
| 55'' Arçelik Smart TV | technology (canonical-claim "Smart TV") | null | Arçelik | UNKNOWN | DÜŞÜYOR (ürün türü) |
| PlayStation 5 arıyorum | technology | null | Sony | PRODUCT | geçiyor (knownRed dışı) |
| Nintendo Switch arıyorum | technology | null | Nintendo | PRODUCT | geçiyor |
| Apple Watch arıyorum | technology (0.35, TENTATIVE) | null | Apple | PRODUCT | zayıf ama geçiyor |
| MacBook Air arıyorum | technology | null | Apple, model MacBook Air | PRODUCT | geçiyor |
| Galaxy S25 arıyorum | technology | null | FORD (yanlış), model s25 | VEHICLE (yanlış) | DÜŞÜYOR (yeni bulgu) |
| iPhone 17 arıyorum | technology | null | Apple | VEHICLE (yanlış) | DÜŞÜYOR (yeni bulgu) |
| Smart TV 55 inç arıyorum | technology | null | "SMART" (yanlış, oto markası) | PRODUCT | DÜŞÜYOR (yeni bulgu) |
| Air Fryer arıyorum | null | null | null | PRODUCT | DÜŞÜYOR (tam kayıp) |
| Robot süpürge arıyorum (TR kontrol) | appliances (canonical-claim) | null | null | PRODUCT | geçiyor |
| Buzdolabı arıyorum (TR kontrol) | appliances | null | null | PRODUCT | geçiyor |

## Kök nedenler — TEK DEĞİL, EN AZ BEŞ AYRI MEKANİZMA

1. **Tek-sözcüklük iddia kuralı İngilizce marka-serisi öbeğini eliyor.**
   `src/lib/taxonomy/phrase-classification.ts` (findCanonicalCategoryClaim,
   "TEK SÖZCÜKLÜK KANIT, ÇOK SÖZCÜKLÜ İFADEYİ TAŞIYAMAZ", 2026-08-31):
   `if (size === 1 && !claimCoversCore) continue;`. Kanıt: "Xbox arıyorum"
   → claim unique/technology (xbox alias'ı VAR, taxonomy technology
   products.json oyun konsolu düğümü); "Xbox Series X arıyorum" → claim
   NULL, çünkü çekirdek üç sözcük ve "xbox" yalnız tek sözcüğü kapsıyor.
   Kural Türkçe ad tamlaması dersinden doğru ("tekerlekli sandalye" ≠
   "sandalye": niteleyici ÖNDE ve anlamı değiştirir); İngilizce ürün-serisi
   adlandırmasında baş sözcük ÖNDE, devamı model nitelemesidir ("Series X",
   "S25 Ultra") ve kuralın varsayımı ters döner. Skorlayıcı sözlüğünde de
   xbox olmadığından geriye hiçbir kanıt kalmıyor → kategori null.
2. **Kanonik iddia düğümü ürün türü kanalına hiç akmıyor (Smart TV).**
   "Smart TV" alias'ı televizyon yaprağına çözülüyor ve kategoriyi
   taşıyor; ama ürün türü kanalını besleyen findTechnologyProduct, A55
   dersi gereği televizyon bağlamında BİLEREK susturulmuş
   (`understand-request.ts` techProduct = looksLikeTelevisionScreenContext
   ? null : ...). İddianın çözdüğü düğümün adını ("Televizyon") productType
   kanalına taşıyan başka hiçbir yol yok → kategori doğru, ürün türü null.
   (Türkçe "Robot süpürge" da aynı kanaldan null alıyor; correlated boşluk.)
3. **İngilizce öbek içinden çapraz-katalog marka yanlış pozitifi.**
   "Smart TV 55 inç" → marka "SMART" (otomotiv katalogundaki Smart);
   "Galaxy S25" → marka FORD (Ford Galaxy) + model s25. Marka çıkarımı,
   kanonik ürün öbeğinin ("Smart TV") içindeki sözcüğü ayrı bir markaya
   verebiliyor. Bu, korpustaki BRAND_HALLUCINATION=0 kapısının HİÇ
   görmediği girdi şekli — kapı yeşilken canlıda halüsinasyon sınıfı.
4. **Araç-model sezgisi sayı tokenında taşıyor.** "iPhone 17" ve
   "Galaxy S25"te subjectKind=VEHICLE (understand-request hasVehicleModel
   deseni: tek harf+2-3 hane). Kategori technology ve marka Apple doğru
   çözülürken özne kanalı araca kayıyor; kanallar çelişiyor.
5. **Alias varyant boşluğu.** "airfryer" alias'ı var
   (data/taxonomy/appliances, Fritöz & Airfryer yaprağı), boşluklu
   "air fryer" yazımı yok → "Air Fryer arıyorum" tam kayıp.

## Korpus evreni

1077 vakada İngilizce ürün öbeği deseni 24 vakada geçiyor (tech-a: iPhone
15 Pro Max 13 varyant, tech-i: PlayStation 5 11 varyant) ve 24'ü de bugün
yeşil — ikisi de katalog yoluyla çözülen şekiller. Kırılan beş şekil (Xbox
Series X, Smart TV, Galaxy S25, iPhone <sayı>, Air Fryer) korpusta HİÇ yok;
iki knownRed'in kapılarda görünmeyip canlıda kanamasının sebebi bu. Düzeltme
işi korpusa bu şekilleri de eklemeden "kapandı" diyemez.

## Sonuç ve sınır

Kök neden tek değil; tek dar yamayla iki knownRed birlikte kapanamaz
(Xbox=1+belki 5, Smart TV=2, yeni bulgular=3+4). Eksen en az üç ayrı dilime
ayrılmalı ve her dilim kendi kararını ister:
- Dilim α (kural): tek-sözcüklük iddia kuralına, kalan sözcüklerin model/seri
  kimliği olarak TÜKETİLDİĞİ durumda dar bir istisna — Türkçe tamlama dersi
  bozulmadan (tasarım kararı ister; "İngilizce her şeyi kabul et" kapısı
  değil).
- Dilim β (kanal): kanonik iddia düğümünün adını productType kanalına taşıyan
  tek yetkili köprü (Türkçe yaprakları da düzeltir; ölçüm evreni geniş).
- Dilim γ (koruma): marka/araç sezgilerinin kanonik ürün öbeği span'ına ve
  çözülmüş kategori kanıtına saygısı (A55 dersinin markaya ve araca
  genellenmesi — fix-the-axis, keyword yaması değil).
- Veri: air fryer alias varyantı + xbox/microsoft marka-hattı kayıtları,
  provenance'lı.

Bu teşhisin 12 girdilik örneklemi, düzeltme dilimleri geldiğinde önce/sonra
tablosunun BEFORE tarafıdır.
