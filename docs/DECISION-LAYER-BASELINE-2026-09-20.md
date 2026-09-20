# Decision Layer — BEFORE baseline (2026-09-20)

Bu dosya, karar katmanı (Decision Layer) işine başlamadan ÖNCE mevcut anlama
zincirinin ölçülmüş durumunu dondurur. Amaç BEFORE ile AFTER'ın aynı cetvelle
karşılaştırılabilmesidir. Buradaki hiçbir sayı tahmin değildir; hepsi bu
tarihte, bu depoda koşturulmuş doğrulayıcı çıktısından alınmıştır.

Ölçüm tabanı: commit `7148975` üzeri çalışma ağacı (kod değişikliği yok).
Ortam: Windows 11, Node üzerinden `npx tsx`, `DATABASE_URL` CI'daki sahte
değerle (`postgresql://ci:ci@127.0.0.1:5432/ci`); hiçbir doğrulayıcı gerçek
veritabanına dokunmaz. Çalışma dizini `apps/web` (`@/` alias gereği).

## Ölçüm evreni

1077 vakalık üretim-eşdeğer adversarial korpus
(`scripts/fixtures/brain-adversarial-corpus-v1.ts`). Zemin gerçeği şablondan
gelir, motora sızmaz. İki doğrulayıcı aynı korpusu iki ayrı zincirle koşar:

- `verify-brain-adversarial-corpus-v1` — understandRequest → syncFromText →
  resolveHybridQuestions (talep beyni boyut boyut)
- `verify-discovery-quality-v1` — understandRequest → snapshot → routing
  envelope (keşif/eşleştirmenin okuduğu kanallar)

## BEFORE — brain adversarial (1077 vaka, ölçüldü 2026-09-20, rc=0)

| Boyut | Değer | Sert kapı |
|---|---|---|
| category | %100,0 (ok=1023, miss=0) | HIGH_CONFIDENCE_WRONG_CATEGORY = 0 |
| kind | %100,0 (ok=1027, miss=0) | HIGH_CONFIDENCE_WRONG_KIND = 0 |
| brand precision | %100,0 (asserted=145) | BRAND_HALLUCINATION = 0 |
| brand recall | %100,0 (uygulanabilir=125) | — |
| model precision | %100,0 (asserted=106) | MODEL_HALLUCINATION = 0 |
| number rol doğruluğu | 0/209 ihlal | FORBIDDEN_NUMBER_IN_ROLE = 0 |
| quantity | %100,0 (62/62) | — |
| budget | %100,0 (34/34) | BUDGET_HALLUCINATION = 0 |
| ANY | %100,0 (34/34) | ANY_REASK = 0 |
| scope | %100,0 (1077/1077) | SCOPE_MISS = 0, supportedDropped = 0 |
| questions (gereksiz soru) | %100,0 (223/223) | REASK = 0 |

HARD_GATES=GREEN. Süre: 144 sn (yüksüz, tek başına).

## BEFORE — discovery quality (1077 vaka, ölçüldü 2026-09-20, rc=0)

| Bileşen | Skor | Payda |
|---|---|---|
| ① kategori | %100,0 | CORRECT=1027, WRONG=0, MISSING=0, N/A=24 |
| ② marka | %100,0 | CORRECT=145, WRONG=0, MISSING=0, N/A=932 |
| ③ ürün türü | %100,0 | CORRECT=586, WRONG=0, MISSING=0, N/A=477 |
| ④ kanonik varlık | %100,0 | CORRECT=62, WRONG=0, MISSING=0, N/A=1011 |
| ⑤ tedarikçi yeteneği | bu evrende NOT_APPLICABLE | ayrı kapılar: supplier-capability-consumption 16/0, curated-entity-consumption 56/0 |

Sınıflanan sapma: 2 (yalnız lossy/typo varyantında kategori kayması,
`hlth-b~typo` ve `hlth-b~typo-ascii` → furniture; kalibrasyon sözleşmesi
gereği lossy MISSING sayılmaz, WRONG her varyantta sayılır — bu ikisi WRONG
değildir). QUALITY_GATES=GREEN. Süre: 140 sn (yüksüz, tek başına).

## Provider routing hatası hakkında

Fiyat zekâsı sağlayıcı yönlendirmesinin kendi doğrulayıcısı vardır ve
bataryadadır: `verify-provider-routing` (mock searchImpl, ücretli çağrı yok) —
bu tarihte yerelde `ROUTING VERIFY: PASS`, maliyet kontrolü dahil. Talep
routing'i için ayrı bir sayaç icat edilmedi: routing envelope zincirinin
doğruluğu ②③④ bileşenlerinin ölçüm kanalıdır (discovery-quality bu envelope'u
okur), kapsam kararlarının routing'i (UNSUPPORTED_* yayına/eşleşmeye gitmez)
brain-adversarial `scope` boyutundadır: 1077/1077, MISS=0.

## Bu iki doğrulayıcı bugün neden bataryada değil

2026-09-17 ölçüm oturumunda her scripte 60 sn zaman sınırı verilmişti; bu
ikisi rc=124 (timeout) ile dışarıda kaldı. Sebep başarısızlık değil süredir:
bugün tam koşu ikisinde de rc=0 ve süreler 144 sn / 140 sn. Bataryanın kendi
içinde script başına zaman sınırı yoktur (bilinen en ağır cetvel üyesi
~69 sn koşar); yani engel cetvele yazılmamış olmalarıdır. Cetvele yazılmayan
doğrulayıcı hiç koşmaz — bu işin 2. adımı tam bu kapıyı kurar.

## Batarya durumu (bağlam)

Cetvel: 141 yeşil + 2 bilinen kırmızı (`verify-battery.json`, commit
`7148975`). 2026-09-17'de ölçülen ve cetvel DIŞI tutulan 20 gerçek kırmızı
bu işin kapsamında değildir ve bu baseline'a karıştırılmamıştır. `7148975`
push'unun CI Doğrulama koşusu (143 cetvel üyesiyle ilk koşu) kırmızı düştü;
tanı: paralel koşucunun soğuk başlangıcında eşzamanlı `npx --yes tsx`
indirme yarışı ilk beş süreci öldürüyordu, kodda kusur yok. Düzeltme kendi
commit'indedir (`34c666b`, tsx sabit sürümle devDependency) ve o commit'in
Doğrulama koşusu YEŞİL — 143 cetvel üyesi CI'da ilk kez bu commit'te
ölçülmüştür. Yerelde aynı cetvel iki tam koşuda yeşildi (482 sn ve TZ=UTC
ile 458 sn, 8 paralel).

## AFTER nasıl okunacak

Decision Layer davranış değiştirmemeyi taahhüt eder. AFTER koşusunda yukarıdaki
her satır aynı kalmalıdır; herhangi bir sapma ya bilinçli, açıklanmış ve kendi
commit'inde ölçülmüş bir davranış değişikliğidir ya da regresyondur.
