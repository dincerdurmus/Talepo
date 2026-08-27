# 04 — Canonical Request and Knowledge

> `CODE-VERIFIED` aksi belirtilmedikçe.

## Alan sınıfları

### Gerçek DB alanları (`Request` — `apps/web/prisma/schema.prisma`)

| Alan | Not |
|------|-----|
| `id`, `requestNumber` | Kimlik |
| `categoryId` | Prisma Category.id (cuid) — zorunlu FK |
| `title`, `description` | Legacy display/storage; Phase 1 `description` yazımı sürer |
| `rawInput` | Nullable Text; kullanıcı kaynak metni. AI/`professionalDescription` otomatik ezmemeli. Açık update payload ile değişebilir (politika açık değil). |
| `professionalDescription` | AI/Talepo okunabilir metin; rawInput yerine geçmez |
| `discoveryProjection` | Json?; taxonomy + constraints + nested `understanding` |
| `city`, `district`, `budgetMin/Max`, `currency` | Konum/bütçe kolonları |
| `status`, timestamps, moderation flags | Lifecycle |
| `matches` → `RequestMatch` | Legacy fanout kalıcılığı |

### JSON snapshot alanları

`RequestUnderstandingSnapshot` (`understanding-snapshot.ts`):

- `version`, `kind`, `profileVersion`, `builtAt`
- `rawInputRef: "request.rawInput"` (pointer; metin DB’de)
- `categoryResolution`: status, userSelected, userChoice, primary, candidates
- `entities`, `attributes`
- `internalEvidence?` — **additive ve opsiyonel** (`111b412`, D3c-b). Talepo'nun
  KENDİ kanıtı (`brandCandidate`, `brandEvidence`) burada tipli olarak durur;
  `attributes` kullanıcı beyanı ad alanıdır ve bu anahtarları taşıyamaz.
  Girdiler `value` + mevcut kanonik `confidence` / `provenance` / `source` /
  `evidence` bilgisini taşır — **yeni bir otorite merdiveni ya da paralel
  provenance enum'u yoktur**. Anahtar listesi tek otoritedir
  (`INTERNAL_EVIDENCE_ATTRIBUTE_KEYS`). Alan yoksa eski snapshot geçerlidir;
  **migration gerekmez** (JSON kolonu) [`CODE-VERIFIED` — `111b412`]
- `unresolvedExpressions`, `confirmedFieldKeys`

Nested: `discoveryProjection.understanding` via `withUnderstandingSnapshot`.

**Matching/filter bu bloğu ignore etmeli** (dosya sözleşmesi).

⚠️ **Snapshot yalnız create yolunda kurulur.** `update-request.ts` içinde snapshot rebuild yoktur (`understanding` → 0 hit); yalnız client hazır bir `discoveryProjection` gönderirse yazılır (`:162-163`). Yani düzenlenmiş bir talepte snapshot **eski metnin** anlamını gösterebilir — ve snapshot audit authority olduğu için denetim kaydı da yanlış metni anlatır. [`CODE-VERIFIED` — 2026-08-22 denetim düzeltmesi]

### Türetilmiş alanların provenance’ı (açık boşluk)

`discoveryProjection`, create yolunda client projection göndermezse `resolveDiscoveryProjection` (`create-request.ts:46-50`) ile kurulur ve fallback zinciri şudur:

`rawInput` → `description` → **`professionalDescription` (AI metni)** → `title`

Yani türetilmiş taxonomy/constraint okuması AI metninden doğabilir. rawInput bozulmaz, ama **“bu projection hangi metinden kuruldu?” bilgisi hiçbir yerde saklanmaz**. Provenance alanı yoktur. [`CODE-VERIFIED`]

> **Bu boşluk `ce464eb` sonrasında da AÇIKTIR** (D3c). O commit besteci
> tarafındaki **alan otoritesini** tek kanonik merdivene indirdi
> (`UNKNOWN < INFERRED < VERIFIED < USER_EXPLICIT`,
> `request-understanding/provenance.ts`), ama **yayın tarafı bu bilgiyi hâlâ
> taşımıyor**: `build-projection.ts` içinde `provenance` hiç geçmez ve
> understanding snapshot yalnız `confidence` taşır. Sonuç: bir alanın değerinin
> kullanıcı beyanı mı, katalog doğrulaması mı, yoksa çıkarım mı olduğu yayın
> verisinde okunamaz. Bu yüzden `provenance_mismatch = 69` ölçümünün bugün
> **davranışsal etkisi ölçülmemiştir** — etiket ekseni yayına hiç ulaşmıyor.
> [`CODE-VERIFIED` — 2026-08-26]
>
> **`83be90b` (D3c-a, 2026-08-27) bu boşluğu DARALTTI ama KAPATMADI.**
> Kullanıcı-cevabı kanalı (`payload.fields[]` → sunucuda `fieldValues`) artık
> tek kurucudan geçer: `ui-helpers.ts` → `buildPublishFieldValues` onaysız
> `INFERRED` değeri o kanala yazmaz (108 senaryoda sızan 23 kimlik → 0;
> kontrol `verify-publish-inference-authority-v1`). Ölçütü kanonik cevap
> otoritesi + kullanıcı dokunuş kanıtıdır (`userTouchedKeys`, snapshot'ın
> `confirmedFieldKeys` girdisiyle aynı dizi); alan/kategori dalı yoktur.
> **O TARİHTEKİ AÇIK KALAN:** `discoveryProjection.attributes/constraints` 85
> `INFERRED` değeri otorite işareti olmadan taşımaya devam ediyor;
> projection/snapshot provenance alanı hâlâ yoktur. [`CODE-VERIFIED` —
> `83be90b`; tarayıcı ölçümü yapılmadı, production deploy yoktur]
>
> **`111b412` (D3c-b, 2026-08-27) boşluğu bir kez daha DARALTTI ama KAPATMADI.**
> Talepo'nun kendi kanıtı (`brandCandidate` / `brandEvidence`) artık kullanıcı
> attribute'u ad alanında taşınmıyor: yazımda snapshot'ın ve projection'ın
> tipli `internalEvidence` kanalına, okumada tek kanonik normalizer
> (`parseUnderstandingSnapshot` / `parseDiscoveryProjection`) üzerinden gider —
> böylece eski kayıtlar da güvenli yorumlanır. 108 senaryoda ölçülen 36 iç
> kanıt kimliği dört generic kanalda birden 36 → 0; tipli kanalda korunan
> 36/36; provenance kaybı 0. Kontrol:
> `verify-snapshot-internal-evidence-v1`.
>
> **`111b412` TARİHİNDEKİ AÇIK KALAN — sayı yeniden ölçüldü, kopyalanmadı.** Yukarıdaki 85,
> `83be90b` tarihindeki gerçek ölçümdür ve tarihsel kanıt olarak duruyor;
> `111b412` ile daralmıştır. İki deterministik koşuda yeniden ölçüm: kanonik
> `INFERRED` **85** kimlikten **56**'sı generic
> `projection.attributes/constraints` içinde otorite işareti olmadan **kalmaya
> devam ediyor**, **29**'u tipli iç kanıt kanalına ayrıldı. Kalan dağılım:
> `needType` 45 · `solutionType` 5 · `usageArea` 4 · `condition` 2. Aynı
> torbadaki 182 `USER_EXPLICIT` ve 17 `VERIFIED` değer de işaretsizdir —
> provenance boşluğu yalnız `INFERRED`e özgü değildir ve **projection otoritesi
> sorunu ÇÖZÜLMÜŞ DEĞİLDİR**. [`CODE-VERIFIED` — `111b412`; tarayıcı ölçümü
> yapılmadı, production deploy yoktur]
>
> **`008a4ac` (D3c, 2026-08-27) PROJECTION EKSENİNİ KAPATTI.** Yukarıdaki
> paragraf `111b412` tarihindeki gerçek ölçümdür ve tarihsel kanıt olarak
> duruyor; **bugün geçerli olan aşağıdakidir.** Projection artık additive ve
> opsiyonel bir `fieldAuthority` haritası taşır: alan başına, YÜZEY başına
> (`attributes` / `constraints`), kanonik `Authority` değeriyle. Ölçülen 56 /
> 17 / 182 dağılımı DEĞİŞMEDİ — değişen, o değerlerin artık kaynağını
> taşımasıdır. 108 senaryoda `senaryo/alan/yüzey` biçiminde **510** kimlik
> donduruldu; missing 0, unexpected 0, duplicate 0, otorite uyuşmazlığı 0,
> çapraz yüzey uyuşmazlığı 0, iç kanıt sızması 0, değer payload'ı drift 0.
> Kontrol: `verify-projection-authority-v1`. Ürün kararı: `11-DECISION-LOG.md`
> → **Karar H, H10**.
>
> Sözleşmenin üç sınırı burada da yazılıdır. (a) Otorite YALNIZ mevcut kanonik
> merdivenden gelir; yeni enum, rank tablosu ya da "doğrulanmış kaynak"
> listesi kurulmadı ve okuma tek yardımcıdan yapılır
> (`projectionAuthorityOf`). (b) Metadata'sı olmayan veya bozuk legacy kayıt
> `UNKNOWN` okunur, throw etmez ve hiçbir koşulda `USER_EXPLICIT` / `VERIFIED`
> sayılmaz; migration yapılmadı, JSON şekli additive olduğu için gerekmez.
> (c) Kullanıcının gezinmeden açıkça seçtiği "Fark etmez" (`mode:"ANY"`,
> `provenance: "EXPLICIT_BROWSE"`) `constraints` yüzeyinde `USER_EXPLICIT`
> sayılır; değer taşımadığı için `attributes` yüzeyinde hiç görünmez.
>
> **HÂLÂ AÇIK — kapanmış gösterilmez.** `fieldAuthority` AÇIKLAYICI provenance
> metadata'sıdır ve bir yetki kanıtı değildir; istemciden gelen bir payload'da
> da bulunabilir. Bugün hiçbir skor, filtre ya da yetki kararına girmediği
> için zarar üretmez, fakat skorlamada veya yönlendirmede kullanılmadan ÖNCE
> sunucu tarafında yeniden türetilmesi ya da doğrulanması gerekir
> (`update-request.ts` istemci projection'ını parse etmeden persist eder).
> `provenance_mismatch = 69` etiket ekseni AYRI bir eksendir ve DEĞİŞMEDİ.
> [`CODE-VERIFIED` — `008a4ac`; tarayıcı ölçümü yapılmadı, production deploy
> yoktur]

### Client / composer state

- `build-state`, field answer `kind` / `value` / `softStatus`
- UI phase, focused questions, locationMode
- Entity role düzeltmeleri (`entity-roles.ts`)
- **Çıkarım önerisi — `QuestionCandidate.inferredSuggestion`** (`request-brain/types.ts`).
  Talepo tahmini, sorunun CEVABINDAN ayrı bir alanda ve **sorunun kendi
  sözleşmesinde** taşınır; arayüz kabuğunun prop zincirinde değil. Alanlar:
  `value` (gösterilecek tahmin), `authority` — tip düzeyinde yalnız `INFERRED`
  (`Extract<Authority, "INFERRED">`) — ve `confirmed` — tip düzeyinde yalnız
  `false`. Öneri bir kullanıcı cevabı, bir seçim ya da kalıcı bir otorite
  DEĞİLDİR: seçili durum yalnız taslaktan türetilir, öneri soruyu kapatmaz ve
  hiçbir kontrolü `aria-checked="true"` yapmaz. Kullanıcı açıkça seçip
  onayladığında değer normal cevap zincirinden `USER_EXPLICIT` olarak yazılır;
  bu alan güncellenmez, ilgisiz hâle gelir. Sunum kararı tek saf yardımcıda
  (`request-composer/ui-helpers.ts` → `resolveQuestionDraftPresentation`);
  nihai render süzgeci de aynı dosyada (`filterRenderableCandidates`) ve
  `/talep` sayfası onu çağırır. Bugünkü `TalepoAiPanel` ile onun yerini alacak
  arayüz aynı kanonik adayı tüketebilir — **Maira uygulanmış değildir**, bu
  yalnız arayüz değiştirilebilirliğini sağlayan sözleşmedir.
  [`CODE-VERIFIED` · `BROWSER-MEASURED-LOCAL` — `b12ce53`, 2026-08-26]

### Hesaplanan / geçici

- Publish readiness blocking labels
- Category guidance display
- AI confidence scores (normalize 0..1 snapshot’ta)

### Vizyon seviyesi (henüz DB’de yok / kısmi)

- Match result persistence for V3 tiers/reasons
- Notification delivery log (V3 contract tipi var, tablo wiring yok — `NOT-VERIFIED` ayrı tablo)
- Human review queue persistence
- Exhaustive supplier expertise as first-class DB model
- **rawInput revizyon zinciri** — append-only kullanıcı revizyonları + aktör/zaman/kaynak alanları; güncel canonical understanding’in son revizyondan yeniden kurulması. Karar verildi, şema yok → `DECIDED-NOT-IMPLEMENTED` (bkz. `11`)
- **Projection/snapshot provenance alanı** — türetilmiş okumanın hangi kaynak metinden kurulduğu (`raw_input` | `description` | `professional_description` | `title` | `client`)
- **Bildirim idempotency anahtarı** — revizyon × firma bazında dedupe (`notification.createMany` bugün dedupe’suz)

## Kavram durumu

| Kavram | Durum |
|--------|--------|
| rawInput | DB + sanitize + authority tests. **Sözleşme:** kullanıcı kalıcı kaynak metin; AI/professionalDescription otomatik ezemez. **Kod gerçeği:** açık `rawInput` update payload mevcut kodda alanı **geri dönüşsüz** değiştirir (`update-request.ts:155-156`); versiyon/history/aktör kaydı yok [`CODE-VERIFIED`]. **Ürün kararı (2026-08-22):** ilk metin değiştirilemez olmalı, düzenleme yeni bir kullanıcı revizyonu açmalı — `DECIDED-NOT-IMPLEMENTED`, bkz. `11-DECISION-LOG.md`. |
| professionalDescription | DB; create yolunda rawInput olarak kullanılmaz (`create-request.ts`) |
| primary category | Snapshot slug + DB `categoryId` (iki dünya) |
| category candidates | Snapshot candidates[] |
| confidence | Snapshot candidate confidence |
| taxonomy leaf/ancestors | discoveryProjection + Matching V3 envelope |
| product/brand/family/model/variant | Entities + product-identity; variant kısmi |
| attributes | Snapshot + field values |
| confirmed fields | `confirmedFieldKeys` |
| soft answers | Scheduler softStatus parse |
| unresolved expressions | Snapshot array |
| userChoice | CategoryUserChoice enum |
| profile/model version | `UNDERSTANDING_PROFILE_VERSION` |
| provenance | source ai/user/system on candidates |
| inference suggestion | `QuestionCandidate.inferredSuggestion` — onaysız öneri; `authority` yalnız `INFERRED`, `confirmed` yalnız `false`. Kullanıcı cevabı/seçimi değildir ve soruyu kapatmaz [`CODE-VERIFIED` — `b12ce53`] |
| publish field values (kullanıcı-cevabı kanalı) | `ui-helpers.ts` → `buildPublishFieldValues`: `payload.fields[]` değerlerinin tek kurucusu. Onaysız `INFERRED` değer bu kanala yazılmaz; kullanıcı dokunuşu (`userTouchedKeys` = snapshot `confirmedFieldKeys` dizisi) ve kanonik otorite kanıtıyla süzülür. Projection/snapshot eksenini KAPSAMAZ [`CODE-VERIFIED` — `83be90b`] |
| internal evidence (Talepo'nun kendi kanıtı) | `brandCandidate` / `brandEvidence` — kullanıcı beyanı DEĞİLDİR. Tipli `internalEvidence` kanalında yaşar (snapshot ve, snapshot eklenmemiş çıplak projection'da, projection); generic `attributes` / `constraints` / envelope torbasına ve `attributeHit` puanına giremez. Eski kayıtlarda generic torbada duran anahtarları tek kanonik normalizer okuma sınırında ayırır — **DB'de backfill yoktur**. Kanonik anlama kaydı (`understanding.attributes`) değişmez; compose-text marka çapası oradan okur [`CODE-VERIFIED` — `111b412`] |
| internal evidence OTORİTESİ (okuma sınırı) | Kanıtın MEVCUT olması ile yönlendirmede GÜVENİLİR olması **iki ayrı metriktir**. Güven kararı tek kanonik merdivenden okunur (`request-understanding/provenance.ts` → `Authority` / `AUTHORITY_RANK` / `isAtLeastAuthority`; eşik `VERIFIED`): `VERIFIED` ve `USER_EXPLICIT` güvenilirdir, `INFERRED` ve `UNKNOWN` **değildir**. Eski kayıtlarda otorite bilgisi hiç yoktur ve **uydurulmaz** — legacy normalizer değeri tipli kanala taşır, seviye `UNKNOWN` kalır ve trusted sayılmaz. Kanıt kaydının DEĞERİ (`VERIFIED_CATALOG` / `USER_ASSERTED`) ikinci bir güven kaynağı DEĞİLDİR; kaydın kendi `provenance` / `source` bilgisi belirleyicidir [`CODE-VERIFIED` — `7aa6990`] |

## Knowledge Engine haritası

| Kaynak | Yol | Rol |
|--------|-----|-----|
| REQUEST_CATEGORIES | `lib/request-category-engine.ts` | 11 browse kök + keywords + form hints |
| data/taxonomy | `data/taxonomy/**`, `manifest.json` | Leaf/node graf (~1239 node drift test) |
| Prisma Category | schema + DB | Fanout FK authority |
| Category keywords | engine keywords | Heuristik detect (deprecated detectCategory) |
| CatalogRegistry / automotive / tech brands | knowledge + product-identity | Marka/model adayları |
| Alias/synonym | çeşitli parser + matching-v3 aliases fixtures | Çakışma riski |
| Product phrase lexicon | `request-composer/v2/product-phrase-lexicon.ts` | Ürün span |
| Question profiles | `question-profiles.ts` | Soru beyni |
| Supplier inventory / alerts / saved search | monetization + company relations | Legacy yan yollar |

## Drift riski (açık)

Birden fazla “kategori gerçeği” birlikte yaşar:

1. `REQUEST_CATEGORIES.id` (slug-like engine id)
2. Prisma `Category.id` (cuid) + `Category.slug`
3. Taxonomy `tax:…` node ids
4. Understanding snapshot `primary.slug`
5. Matching V3 envelope: `primaryCategoryDbId` vs `primaryCategorySlug` vs `taxonomyNodeIds`

Yanlış namespace birleştirme → yanlış fanout veya sahte EXACT. Taxonomy drift verifier `diger` çoklu parent çarpışmasını belgeler. [`TEST-VERIFIED`]

---

**Bunu ne için yapıyoruz?**  
“Kategori” kelimesinin üç farklı kimlik sistemine işaret edebileceğini yazıyoruz; böylece bir sonraki ajan yanlışlıkla cuid ile slug’ı eşitleyip Pro’ya yanlış talep göndermez / kaçırmaz.
