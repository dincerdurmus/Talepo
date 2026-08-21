# 01A — Founder Intent and Operating Principles

> Etiket: **`PRODUCT-INTENT`**  
> Bu belge teknik mimari değildir. Ürün sahibinin düşünme biçimini ve değişmez öncelikleri aktarır.  
> **Buradaki maddeler mevcut kodda uygulanmış kabul edilmez.** Kodla çelişirse: niyet burada, gerçek davranış kodda ve tarayıcıda doğrulanır.

---

## 1. Talepo’nun hedefi

Talepo yalnız çalışan bir ilan formu olmayacak. Kullanıcı açısından büyük teknoloji şirketlerinin ürünleri gibi:

- Sade
- Hızlı
- Güven veren
- Hata yaptığında kullanıcıyı cezalandırmayan
- Karmaşıklığı arka tarafta çözen

bir deneyim sunmalıdır.

“Apple/Tesla standardı” görsel taklit anlamına gelmez. Karmaşık sistemi kullanıcıya yansıtmadan güvenilir ve anlaşılır hizmet vermek anlamına gelir.

[`PRODUCT-INTENT`]

---

## 2. Kurucunun iki temel korkusu

1. Kullanıcı bir şey arar fakat Talepo anlamadığı veya kategoride bulamadığı için talep oluşturamaz.
2. Pro paket için para ödeyen tedarikçi, kendisine uygun bir talep sisteme girdiği halde yanlış kategori veya eşleştirme hatası nedeniyle bunu göremez.

Mimari kararların önceliği bu iki riski azaltmaktır.

[`PRODUCT-INTENT`]

---

## 3. Kategori yaklaşımı

Kategori sistemi korunmalıdır çünkü:

- Kullanıcıya alışılmış ve güvenli bir gezinme yolu verir
- Yazmak istemeyen kullanıcı elle seçebilir
- Arama, filtreleme ve tedarikçi uzmanlığında ortak omurga sağlar

Ancak kategori ağacı Talepo’nun bildiği her şey değildir.

Katalogda veya taxonomy’de bulunmayan ürün de talep oluşturabilmelidir. Marka, model ve ürün aileleri kategori ağacına zorla doldurulmamalıdır.

Kategori güçlü bir yönlendirme sinyali olmalı fakat kullanıcıyı hapseden hard allowlist olmamalıdır.

[`PRODUCT-INTENT`]

---

## 4. Talep oluşturma deneyimi

Kullanıcı doğal dilde yazmalıdır. Talepo önce yazıdan bildiği her şeyi çıkarmalı, kullanıcıya tekrar sormamalıdır.

Hedef çoğu talebin 15–30 saniyede tamamlanmasıdır.

Arayüz:

- Uzun form olmamalı
- Bir anda çok fazla alan göstermemeli
- Bir ekranda yalnız en önemli 1–3 soruyu göstermeli
- Mümkün olduğunca seçenek sunmalı
- Sürekli serbest metin yazdırmamalı
- “Bilmiyorum”, “Fark etmez”, “Teklifleri görmek istiyorum”, “Listede yok” gibi güvenli çıkışlar sunmalı
- Talepo’nun anladıklarını sade ve düzenlenebilir biçimde göstermeli
- Kullanıcıya teknik confidence yüzdeleri yüklememeli

Kategori seçimi isteğe bağlı kalmalıdır.

[`PRODUCT-INTENT`]

---

## 5. Doğru soru ilkesi

Amaç çok bilgi toplamak değil, tedarikçinin gerçek teklif verebilmesi için gereken minimum doğru bilgiyi toplamaktır.

**Yanlış örnekler:**

- Otomobil arayana gereksiz “Kaç adet?” sormak
- Matbaa ürününe “Satılık mı kiralık mı?” sormak
- Kullanıcının yazdığı adedi, oda sayısını veya markayı tekrar sormak
- İhtiyacın başında önemsiz detaylarla kullanıcıyı yormak
- Her kategoride aynı soru setini kullanmak

**Doğru örnekler:**

- Klima: BTU/kapasite, klima tipi, kullanılacak alan, marka tercihi, konum, bütçe ve zaman
- Mercedes C180/C200: Mercedes marka, C180/C200 model/seri; paket zorunlu değil
- 2+1 satılık ev: il, ilçe, toplam bütçe, anlamlıysa kiracılı/kiracısız; parke başlangıçta gereksiz
- 5000 broşür: adet zaten biliniyor; ölçü, malzeme/gramaj, baskı, tasarım durumu ve teslim
- Heidelberg SM 74 nemlendirme pompası: Heidelberg marka, SM 74 makine modeli, nemlendirme pompası aranan parça
- Bebek arabası: ürün “bebek arabasıdır”; “bebek” marka, “arabası” model değildir

[`PRODUCT-INTENT`]

---

## 6. Eşleştirme düşüncesi

Pro tedarikçiyi kaçırmamak önceliklidir fakat herkese alakasız bildirim göndermek çözüm değildir.

Belirsizlik durumunda:

- Uygun aday sessizce silinmemeli
- NEAR veya REVIEW seviyesinde korunmalı
- Gerekirse operasyon kuyruğuna düşmeli
- EXACT yalnız güçlü kanıtla verilmelidir

Eksik katalog bilgisi hard conflict değildir. Kullanıcının açık dışlaması veya doğrulanmış çelişki hard conflict olabilir.

Relevance ile ücretli plan ayrıdır. Bir firmanın para ödemesi onu daha ilgili yapmaz; yalnız gerçekten ilgili talebin ne zaman ve nasıl ulaştırılacağını etkiler.

[`PRODUCT-INTENT`]

---

## 7. Bilgi motorunun öğrenme biçimi

Talepo’nun beyni yalnız LLM promptlarından oluşmamalıdır.

Bilgi şuralarda kalıcı hale gelmelidir:

- Stabil taxonomy
- Canonical ürün/marka/seri/model varlıkları
- Alias ve eş anlamlılar
- Kategori/ürün bazlı soru profilleri
- Tedarikçi uzmanlıkları
- Golden/adversarial test senaryoları
- Düşük güvenli ifadeler için inceleme kuyruğu
- Ölçüm ve kullanıcı düzeltmeleri

LLM yardımcı yorumlayıcıdır; tek doğruluk kaynağı değildir.

Yeni bilgi kullanıcı davranışından öğrenilebilir fakat doğrulanmadan otomatik gerçek kabul edilmemelidir.

[`PRODUCT-INTENT`]

---

## 8. Öncelik yaklaşımı

En derin kalite hedefi:

1. Emlak
2. Otomotiv
3. Teknoloji
4. Matbaa ve Ambalaj
5. Beyaz Eşya

Diğer kategoriler de çöp veya göstermelik olmamalıdır. Minimum Talepo standardı sağlamalıdır.

Önce güven sözleşmeleri ve doğru çalışma; sonra süs özellikler.

[`PRODUCT-INTENT`]

---

## 9. Araştırma etiği

Canlı sitelerden:

- Kamusal kategori yapıları
- Kullanıcıya sorulan alan türleri
- Ortak ürün kavramları
- Filtre ve özellik fikirleri

incelenebilir.

Fakat:

- Site kopyası üretilmemeli
- Erişim sınırları aşılmamalı
- Scraping bypass yapılmamalı
- Kaynaklar arasında ortak kavramlar canonicalize edilmelidir

[`PRODUCT-INTENT`]

---

## 10. Çalışma ve iletişim biçimi

Yeni ajan:

- Rapor söyledi diye davranışı doğru kabul etmemeli; kod ve gerçek tarayıcıyla doğrulamalı
- Tamamlanan işi yeniden yapmamalı
- Büyük değişikliği tek seferde uygulamamalı
- Küçük, geri alınabilir ve ölçülebilir dilimler kullanmalı
- Commit, push, migration ve deploy’u ayrı onay noktaları olarak görmeli
- “Hatasız” iddiasında bulunmamalı
- Güveni fallback, test, shadow, ölçüm, audit ve operasyon ile kurmalı
- Her aşama sonunda teknik olmayan Türkçeyle “Bunu ne için yapıyoruz?” açıklaması vermeli
- Başarılı test sayısını production başarısı gibi sunmamalı
- Görsel rapor gerçek tarayıcı davranışıyla çelişirse gerçek davranışı esas almalı

[`PRODUCT-INTENT`]

---

## 11. Başarı tanımı

Talepo başarılıdır eğer:

- Kullanıcı aradığı şeyi katalog eksik olsa da yazıp yayınlayabiliyorsa
- Sistem ne anladığını dürüstçe gösteriyorsa
- Gereksiz sorularla kullanıcıyı yormuyorsa
- Kritik bilgileri kaçırmıyorsa
- Uygun tedarikçiyi sessizce kaybetmiyorsa
- Yanlış tedarikçiye bildirim yağdırmıyorsa
- Her kararın nedenini denetlenebilir biçimde kaydediyorsa
- Gerçek verilerle zaman içinde ölçülerek gelişiyorsa

[`PRODUCT-INTENT`]

---

**Bunu ne için yapıyoruz?**  
Claude’a yalnız dosya haritasını değil, Talepo’nun neden böyle kurulması gerektiğini ve ürün sahibinin karar verirken hangi iki korkuyu (alıcı engellenmesin, Pro kaçmasın) önceliklendirdiğini aktarmak için.
