# Açık küme ölçüm kümesi (2026-09-25)

Bu klasör bir **ölçüm kümesidir**, fixture koleksiyonu değil. Ölçtüğü şey tek
bir bug değil bir **hata sınıfıdır**: *kapalı küme kararı açık dünyada
veriliyor.* Sistem "11 kategoriden hangisi?" diye sorunca en yakınını seçer ve
emin görünür; "hiçbiri" seçeneği ya yoktur ya da ayrı, kalibre edilmemiş bir
soruya bırakılmıştır.

Kurucunun kök ilkeleri (görev tanımından, 2026-09-25):

1. Hiçbir kapalı küme kararı **pozitif kanıt** olmadan kesinleşmez.
2. "Ne istiyor" ile "nereye gider" ayrılır.
3. İki bağımsız karar ayrışırsa otomatik karar yoktur.
4. Ana metrik **"emin-ama-yanlış" sayısıdır**, doğruluk değil.

## Kümeler

| küme | dosya | ne ölçer | büyüklük |
|---|---|---|---|
| **A** | `set-a-out-of-taxonomy.ts` | kategori dışı ama meşru talep — "hiçbiri" diyebiliyor muyuz | 202 taban |
| **B** | `set-b-in-taxonomy-hard.ts` | gerçekten içeride olan zor talep — yanlış alarm maliyeti | 226 taban |
| **C** | `apps/web/scripts/lib/metamorphic-transforms.ts` | anlam koruyan 14 dönüşüm; A ve B'nin tamamına uygulanır | ×14 |
| **D** | `apps/web/scripts/verify-scope-metamorphic-v1.ts` | kapsam tuzakları (ilaç, tavsiye, arz, kap) — bu kümede hiçbir şey gevşemez | 95 tohum × 62 dönüşüm |
| **E** | `set-e-answer-authority-traps.ts` | metinde var gibi görünen cevap (D-0030'un ters yönü) | 60 vaka |

A'yı tek başına ölçmek işe yaramaz: "her şeye hiçbiri de" diyen bir sistem A'yı
tam geçer ve ürünü yok eder. B o bedeli aynı koşuda ölçer.

## Bölünme: dev %40 / test %60

`split.ts`, tohumu sabit (`talepo-open-set-2026-09-25`) tutar ve bir satırın
hangi yarıya düştüğünü **yalnız kendi `id`'sinden** hesaplar (FNV-1a). Karıştırma
kullanılmadı bilerek: kümeye tek satır eklenince bütün bölünme kayar ve dünkü
"test" satırı bugün "dev" olur — ölçüm kirlenir ve kirlendiği fark edilmez.

- **dev** kural yazarken okunur.
- **test** yalnız kabul ölçümünde koşulur (`--half=test`).
- **Test yarısına bakarak kural yazmak yasaktır.**

Bu koşuda uyulan disiplin ve tek sapma, `SONUC-ACIK-KUME-2026-09-25.md`
raporunda açıkça yazılıdır: test yarısının TABAN sayıları (yalnız toplamlar,
tek satır bile okunmadan) düzeltmeden önce bir kez alındı, çünkü raporun
istediği ÖNCE/SONRA tablosu iki yarıyı ayrı istiyor.

## Etiketler ölçümle düzeltildi — ve bu kümenin en önemli bulgusu bu

İlk taslakta 24 cümle YANLIŞ etiketlenmişti. Hepsi ölçümle bulundu ve
düzeltildi; gerekçeler ilgili dosyaların başında yazılıdır:

- **18 hizmet talebi** (avukat, kuaför, düğün organizatörü, catering, vize
  danışmanlığı…) A'dan B'ye `services` olarak taşındı. Gerekçe: 1077 vakalık
  adversarial korpus "Düğün fotoğrafçısı arıyorum" ve "Matematik özel ders
  arıyorum" için `services` bekliyor. `services` kökü hizmet taksonomi
  dosyasının 20 yaprağıyla sınırlı değil, Talepo'nun **genel hizmet pazarıdır**.
- **5 cümle** kanonik ağaçta yaprak olarak bulundu (`Uyku tulumu` → baby,
  `Ajanda` → printing, `Kereste` → machinery, `İnverter`/`Akü` → automotive).
- **1 cümle** kürasyonlu sözlükte bulundu (`bulaşık deterjanı` → home-kitchen).

Çekimser kalınan alanlar (emin olunamadığı için kümeye hiç alınmadı): eğitim /
kurs, oyuncak, banyo ürünleri. Gerekçeleri `set-a-out-of-taxonomy.ts` başında.

## Kapılar

| kapı | betik | cetvelde |
|---|---|---|
| A+B+C, **Jev'siz**, CI'da koşar | `verify-open-set-v1` | evet |
| E | `verify-answer-authority-traps-v1` | evet |
| D | `verify-scope-metamorphic-v1` | evet (bu koşuda 17 kaçak → 0) |
| Jev'li tasarım karşılaştırması | `model-eval-jev-taxonomy-gate-v2` | **hayır** — ağ ve anahtar ister, elle tetiklenir |
