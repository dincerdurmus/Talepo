# 09 — Next Phase Recommendation

> Kör “Dilim 2” etiketi değil; koda dayalı sıra. Öneri = `PROPOSED`. Kanıt zemini = Dilim 1 shadow + legacy riskleri.

## Karar özeti

**Onaylanan sonraki tek aşama (2026-08-22):**  
**Phase 3 Dilim 2a — Legacy fanout gözlemlenebilirliği (yalnız ölçüm; sıfır davranış değişikliği)**

Ardından, taban ölçüm oluştuğunda:  
**Phase 3 Dilim 2b — Production-shaped shadow wiring + persist + compare (feature-flagged, no notification cutover)**

### Neden 2 ikiye bölündü? (2026-08-22 denetim bulgusu)

Bu belgenin önceki sürümü tek bir “Dilim 2” tanımlıyor ve ölçüm hedefini *“entityRescued vs legacy miss; zero-match rate”* olarak yazıyordu. **Bu hedefin önkoşulu eksikti:**

Her iki metrik de **legacy tarafında telemetri** gerektirir — ve legacy’de telemetri **yoktur**:

- `distribute-request.ts:164-165` zero-match logsuz erken dönüş [`CODE-VERIFIED`]
- cap doygunluğu (200/300/40/100/400) kayıtsız
- `unresolved` kategori skip’i kayıtsız (`:81`)
- ikinci yazıcı `backfillMatchesForCompany` (“Silent backfill”) tamamen kayıtsız

Shadow’u bugün persist etsek elimizde *shadow sayıları* olur ama **karşılaştıracak legacy taban çizgisi olmaz**; `compareSyntheticLegacyAndShadow` sentetiktir ve `productionShadowComparison: "not_wired"` tip seviyesinde sabittir. Yani 2b’nin kabul kriteri kendi önkoşulunu içermiyordu.

2a bu boşluğu kapatır. 2b reddedilmiş değildir — **uygulanabilir hâle getirilmiştir**.

Diğer sıralama gerekçeleri değişmedi:

1. V3 motoru var ama gerçek Request/Company şekline ve publish anına bağlı değil → laboratuvar kalır.
2. Legacy sessiz zero-match / cap / category-only riskleri ölçülmeden cutover tehlikeli.
3. Vector/semantic erken eklemek kalibrasyonsuz gürültü artırır (`08` #15).
4. Admin curation ve human labeling, shadow çıktı persist olmadan verimsiz.

## Dilim planı (additive, reversible, measurable)

### Dilim 2a (ONAYLANDI — şimdi bu) — Legacy fanout gözlemlenebilirliği

| | |
|--|--|
| **Neden** | 2b’nin ölçüm hedeflerinin matematiksel önkoşulu; ayrıca `08` #2’yi tek başına ölçülebilir kılar |
| **Değişir** | **Yalnız yapısal, PII’siz olay ve sayım logu.** Kapsam: (a) zero-match olayı + nedeni, (b) `isSystemCategorySlug` kategori-skip, (c) cap doygunluğu (200/300/40/100/400), (d) city-only fallback sayısı, (e) `backfillMatchesForCompany` çağrıları, (f) erken dönüş (`:67`) |
| **Değişmez** | **Hiçbir davranış.** Bildirim içeriği ve alıcıları, eşleşen firma kümesi, query limitleri, skorlar, return değerleri, `RequestMatch` yazımları — hepsi aynı. Yeni tablo yok, migration yok, UI yok, flag yok, `matching-v3`’e dokunulmaz |
| **Gizlilik (zorunlu)** | `rawInput`, `professionalDescription`, `title`, `description`, `matchReason`, iletişim bilgisi veya herhangi bir serbest metin **loglanmaz**. Yalnız PII içermeyen yapısal alanlar: opak id, sabit slug, enum, sayım, boolean, süre |
| **Konum telemetrisi (zorunlu sözleşme)** | Aşağıdaki “Konum sözleşmesi” bölümü. Ham şehir/ilçe/mahalle/adres metni **hiçbir koşulda** loglanmaz |
| **Kabul** | Diff **yalnız** log çağrısı ekler; tek bir karar / `return` / skor / query satırı değişmez (diff review ile kanıtlanır). Mevcut 10 verifier yeşil kalır |
| **Ölçüm** | 1–2 hafta sonra: gerçek zero-match oranı, cap doygunluk oranı, unresolved skip oranı, backfill hacmi, **il bazında tedarikçi boşluğu** |
| **Rollback** | Log satırlarını kaldırmak. Pratikte sıfır risk |
| **Onay kapıları** | Kod → **commit onayı** → **deploy onayı** → **sink doğrulama kapısı** (aşağıda). Migration yok |
| **Tamamlanma** | Deploy tek başına yeterli **değildir**; sink doğrulanana kadar dilim `PRODUCTION-SINK-NOT-VERIFIED` sayılır |

#### Konum sözleşmesi (Dilim 2a — zorunlu)

Ürün kararı (2026-08-22): tedarikçi boşluğunu **illere göre** ölçebilmemiz gerekir; ancak kullanıcının yazdığı ham konum metni loglanamaz.

| Alan | Değerler | Kural |
|---|---|---|
| `locationScope` | `province` \| `nationwide` \| `remote` \| `unspecified` | Her konum olayında **zorunlu** |
| `provinceCode` | Yalnız sabit ve **allowlist edilmiş** Türkiye il kodu (ör. `TR-34`) | Yalnız `locationScope === "province"` iken yazılabilir |
| `resolutionStatus` | `resolved` \| `unknown` | Canonical il koduna güvenilir dönüşüm yoksa `unknown` |

Kesin yasaklar:

- Ham şehir adı, ilçe, mahalle, adres ve diğer serbest metinler **loglanamaz**.
- Girdi güvenilir biçimde canonical il koduna dönüştürülemiyorsa **`provinceCode` yazılmaz**; `locationScope: "unspecified"` ve/veya `resolutionStatus: "unknown"` kullanılır.
- `provinceCode` **serbest metinden türetilmiş bir string olamaz**; yalnız sabit allowlist üyesi olabilir (allowlist dışı değer → olay reddedilir, tahmin edilmez).
- **İlçe seviyesinde ölçüm bu dilimde yapılmayacaktır.** İlçe alanı ne loglanır ne türetilir.
- PII verifier bu sözleşmeyi **ayrıca** doğrular (allowlist üyeliği, scope↔code tutarlılığı, ilçe alanının hiç bulunmaması).

Not: `distribute-request.ts` içindeki `matchReason` alanı `` `Şehir (${company.city})` `` gibi ham şehir adı içerir — bu alan **asla** loglanmaz.

#### Deploy ve sink doğrulama kapısı (Dilim 2a — zorunlu)

Ölçüm altyapısı, olaylar yalnız üretildiği için tamamlanmış **sayılmaz**:

1. Logların hangi production sink’e ulaştığı doğrulanmadığı sürece durum açıkça **`PRODUCTION-SINK-NOT-VERIFIED`** olarak işaretlenir.
2. Dilim 2a’nın başarılı sayılabilmesi için, deploy sonrasında olayların **merkezî log sisteminde sorgulanabildiği ayrıca doğrulanmalıdır** (örnek sorgu + dönen kayıt kanıtı).
3. **Yalnız uygulama konsoluna yazılan fakat sonradan sorgulanamayan loglar, ölçüm altyapısı tamamlanmış sayılmaz.** Bu durumda dilim “kod tamam, ölçüm eksik” olarak raporlanır ve 2b **başlatılmaz**.

Bu kapı geçilmeden Dilim 2b’nin önkoşulu (gerçek legacy taban ölçümü) sağlanmış olmaz.

### Dilim 2b (2a’nın verisi geldikten sonra) — Shadow wire + persist

| | |
|--|--|
| **Neden** | Aynı publish olayında legacy sonuç ile V3 shadow’u yan yana yaz; bildirim hâlâ legacy |
| **Önkoşul** | **2a’nın legacy taban ölçümü canlıda birikmiş olmalı.** Aksi hâlde karşılaştırma yapılamaz |
| **Değişir** | Flag’li shadow runner çağrısı; shadow result store (yeni tablo veya JSON audit — tasarım onayı gerekir); compare raporu |
| **Değişmez** | Kullanıcıya giden Notification içeriği; RequestMatch’in mevcut fanout anlamı (veya dual-write açıkça ayrılır); scoring’e plan karışmaz |
| **Kabul** | Flag off = bugünkü davranış; flag on = shadow persist + bildirim davranışında sıfır değişiklik; verifier + staging shadow diff |
| **Ölçüm** | entityRescued vs **2a’dan gelen gerçek legacy miss**; zero-match rate karşılaştırması; tier histogram (shadow only) |
| **Rollback** | Flag off; shadow tablo okunmaz |
| **Onay kapıları** | Commit → (migration varsa ayrı onay) → staging → **deploy onayı** → asla sessiz prod cutover |

### Paralel yürüyebilen, koddan bağımsız iş

**rawInput revizyon şeması tasarımı.** Ürün kararı 2026-08-22’de verildi (append-only revizyon, aktör/zaman/kaynak, son revizyondan yeniden kurulan understanding, anlamlı düzenlemede re-match, revizyon × firma idempotent bildirim) fakat **bilinçli olarak koda dönüştürülmedi** → `DECIDED-NOT-IMPLEMENTED`. Ayrı şema + davranış tasarım dilimi gerektirir; 2a/2b’yi beklemesi gerekmez. Bkz. `11-DECISION-LOG.md`.

**Verifier’ları npm script’e bağlama.** `08` #21: handoff’un dayandığı 10 verifier’ın hiçbiri `package.json` scripts’te değil. Küçük, risksiz, davranış değiştirmeyen bir dilim.

### Dilim 3 — Review / ops queue for unresolved & zero-match

Shadow ve branch fanout zero-match / unresolved category için insan kuyruğu; sessiz kayıp yasağı.

### Dilim 4 — Notification delivery log + dedupe/retry

V3 contract’taki delivery record’u branch fanout yoluna kontrollü yaklaştır; fire-and-forget’u azalt.

### Dilim 5 — Supplier expertise model (DB-shaped)

Inventory/follow/brandModelPairs coverage’ı gerçek adaptörlerle; synthetic’ten çık.

### Dilim 6 — Human labeling + threshold calibration

Precision/recall için etiket seti; EXACT/STRONG eşikleri.

### Dilim 7 — Category question knowledge deepen (6 kategori)

Composer profil boşlukları; Matching’den bağımsız ama paralel yapılabilir küçük dilimler.

### Dilim 8 — Admin curation UI

Review queue + alias/category conflict araçları.

### Dilim 9+ — Vector/semantic retrieval

Ancak labeling + shadow metrics sonrası.

## Bilinçli erteleme

- Branch fanout’u V3 ile değiştirmek (erken)
- Plan’ı relevance skoruna bağlamak (yasak)
- Büyük rewrite / tek PR’da migration+UI+cutover

---

**Bunu ne için yapıyoruz?**  
Önce “Laboratuvardaki akıllı eşleştirme, gerçek taleplerde legacy’den ne kadar iyi?” sorusunu ölçülebilir kılıyoruz; Pro’ya dokunmadan güven kazanıyoruz.
