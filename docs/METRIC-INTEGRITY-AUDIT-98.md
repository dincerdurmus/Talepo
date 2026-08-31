# METRIC INTEGRITY AUDIT — 98+ Kalite Programı Faz 0 (2026-09-01)

Bu belge üç resmî metriğin TAM matematiksel sözleşmesini çıkarır ve 98+
programının yeni ölçüm sözleşmelerini tanımlar. Tarihsel metrikler
SİLİNMEZ ve formülleri sessizce DEĞİŞTİRİLMEZ; yeni sözleşmeler ayrı adla
yaşar, fark matematiksel olarak açıklanır.

## A — Talep Beyni (%92)

| Alan | Değer |
|---|---|
| Resmî ad | REQUEST_BRAIN_MEASURED_READINESS |
| Üretici | `apps/web/scripts/verify-category-coverage-v1.ts` |
| Numerator | PASS verdikti senaryo sayısı (bugün 100) |
| Denominator | Ölçülen senaryo = 108 dondurulmuş korpus − SCENARIO_NOT_MEASURED (bugün 0) |
| Evren | 108 senaryo · 11 kategori ailesi · 35 adversarial |
| PASS | Senaryonun TÜM zorunlu beklentileri geçti |
| FAIL | Yeni/değişmiş hata → kırmızı çıkış (bugün 0) |
| KNOWN_FAIL | Önceden ölçülmüş hata AYNI imzayla sürüyor; PASS DEĞİL, paydada kalır (bugün 8) |
| NOT_MEASURED | Değerlendirilemedi; hiçbir sayıma girmez, ayrı raporlanır |
| Production-equivalent mi | EVET: dondurulmuş `{ rawInput }` → understandRequest → composer → questions → snapshot → envelope tam zinciri; beklenti enjeksiyonu taramayla + kanaryayla engelli |
| Snapshot-only mu | HAYIR |
| Gerçek kaliteyi temsil | KISMEN: korpus 108 satırla sınırlı; soru kalitesi/halüsinasyon/güven kalibrasyonu AYRI boyut olarak ölçülmüyor |

**8 KNOWN_FAIL (kök neden kümeleri):**

| Küme | Senaryolar | Girdi örneği | Kusur |
|---|---|---|---|
| PART/aile tanıma | auto-11, mach-05, baby-08 | "Araba lastiği arıyorum 205/55 R16" | Parça talebi bütün ürün sanılıyor; part alanı boş; ilgisiz soru (modelYear/ageRange) |
| understanding↔state RC ayrışması | tech-04, tech-11 | "Muhasebe yazılımı lisansı arıyorum" | İki otorite farklı kategori üretiyor (technology vs services) |
| Hizmet kind'ı | tech-12 | "logo tasarımı arıyorum" | kind PRODUCT çıkıyor, metin öznesiz |
| Nitelik çıkarımı | appl-02, furn-07 | "İnverter klima 12000 BTU" / "Yemek masası 6 kişilik ahşap" | İnverter parça sanılıyor; BTU/kişilik/malzeme tutulmuyor, yeniden soruluyor |

**98+ programı için karar:** formül DEĞİŞMEZ (zaten doğruluk ölçüyor).
Eksik olan evren genişliği ve boyut ayrımıdır. Yeni EK yüzeyler:
`BRAIN_ADVERSARIAL_CORPUS` (1000+ üretim-eşdeğer varyasyon, boyut-bazlı) ve
halüsinasyon/ANY/soru-kalitesi sert kapıları. 108'lik tarihsel korpus ve adı
aynen korunur; ≥98 hedefi HER İKİ yüzeyde de geçerlidir.

## B — PROFESSIONAL_DISCOVERY_DATA_READINESS (%36,30)

| Alan | Değer |
|---|---|
| Üretici | ledger hesabı; bileşen ölçümleri coverage + envelope + curated-entity kapılarından |
| Formül | `100×((107/108)+(15/108)+(69/108)+(5/108)+0)/5` |
| Bileşenler | ① slug/kategori 107 · ② marka 15 · ③ ürün türü 69 · ④ curated entity 5 · ⑤ tedarikçi yeteneği 0 (NOT_MEASURED, 0 katkı paydada) |
| NOT_MEASURED | ⑤ bugüne dek korpus üstünde hiç ölçülmedi; 0 sunulmaz ama paydada 0 katkı verir |

**TESPİT — metrik PRESENCE ölçüyor, QUALITY değil.** ②③④ bileşenleri
"108 talebin kaçında X kanalı DOLU" sorusuna cevap verir. Oysa
"grafik tasarımcı arıyorum" talebinde marka OLMAMALIDIR; bu satırın ②'de
0 sayılması kalite eksikliği değildir. Tersine "logo programı → GoPro"
tipi bir uydurma, dolu kanal olarak metriği YÜKSELTİRDİ. Metrik bu haliyle
kalite diye yorumlanırsa hem yanlış cezalandırır hem yanlış ödüllendirir.

**Yeni sözleşme (EK, tarihsel adın yerine geçmez):**
`PROFESSIONAL_DISCOVERY_DATA_QUALITY` — her bileşen için her satır önce
uygulanabilirlik sınıfına ayrılır:

- `APPLICABLE_AND_CORRECT` — kanal uygulanabilir ve değer kullanıcı beyanına göre doğru
- `APPLICABLE_AND_WRONG` — kanal dolu ama YANLIŞ (halüsinasyon dahil; en ağır sınıf)
- `APPLICABLE_BUT_MISSING` — kullanıcı beyan etti, sistem kaçırdı
- `NOT_APPLICABLE` — kanıtla uygulanamaz (ör. hizmet talebinde marka)
- `NOT_MEASURED` — değerlendirilemedi; PASS DEĞİL, ayrı raporlanır

Bileşen skoru = `CORRECT / (CORRECT + WRONG + MISSING)`; yani payda YALNIZ
uygulanabilir satırlardır ve `NOT_APPLICABLE` sınıfı TEK TEK kanıtlanır
(satır gerekçesi fixture'da durur — toptan düşürme yok). Bu, payda
küçültme hilesi değildir: presence metriğindeki 108'lik payda uygulanamaz
satırları da sayarak kaliteyi olduğundan DÜŞÜK gösteriyordu; yeni payda
"uygulanabilir evren"dir ve WRONG sınıfı skoru sert düşürür.

**Matematiksel fark örneği (marka bileşeni):** presence = 15/108 ≈ %13,9.
Kalite sorusu: marka beyan edilen N satırın kaçında doğru yakalandı +
beyan edilmeyen satırların kaçında uydurulMAdı. İkisi ayrı eksendir;
yeni sözleşmede precision kapısı (WRONG=0 hedefi) ayrıca sert kapıdır.

## C — PROFESSIONAL_PRODUCT_READINESS (%60)

| Alan | Değer |
|---|---|
| Üretici | ledger LG-57l karnesi (el hesabı, kanıtları adlandırılmış koşular) |
| Formül | 6 yüzey × 5 eksen; hücre TAM=1 · KISMİ=0.5 · YOK/BLOCKED/NOT_MEASURED=0; skor = Σ/30 |
| Yüzeyler | Alarmlar · Bütçe-değişim alarmı · Analiz · Takip+Kayıtlı arama · Fırsatlar/Smart Match · AI Asistan |
| Eksenler | plan kapısı · gerçek veri · canlı E2E · cihaz UX · hata/boş/güvenlik |
| Bugün | %60; cihaz UX ekseni 6 yüzeyde de NOT_MEASURED (6 hücre 0), Analiz+Fırsatlar E2E NOT_MEASURED, AI Asistan 2 hücre BLOCKED |

**Karar:** formül ve payda KORUNUR (yüzey silme yasak). ≥98 fiilen 30/30
ister → tüm NOT_MEASURED hücreler gerçek kanıtla ölçülecek, KISMİ hücreler
TAM'a taşınacak, AI Asistan dürüstlük kuralıyla yeniden değerlendirilecek
("AI" etiketiyle sahte premium yok).

## Faz 0 hükmü

Üç metrikten hiçbiri sahte değildir; A doğruluk ölçer (dar evren),
C kanıt-tabanlıdır (eksik hücreler dürüstçe 0). B ise presence'ı kalite
diye yorumlamaya açıktır → yeni QUALITY sözleşmesi tanımlandı. Program
hedefleri: A ≥98 (108 + adversarial korpus), B-yeni ≥98 (bileşen bazında,
false-positive sert kapılarıyla), C = 30/30.
