# TALEPO PRODUCT COMPLETION LEDGER

Tek devam noktası. Sonraki oturum: **"Completion Ledger'dan devam et"**.
Mevcut kayıtları TAMAMLAR: `docs/KNOWN-BROKEN.md` (kırmızı kapılar) ve
`docs/ai-handoff/08-KNOWN-RISKS-AND-GAPS.md` (25 risk) buranın ekidir;
oradaki hiçbir madde buraya kopyalanarak çoğaltılmadı, ID ile referanslanır.

Son güncelleme: 2026-08-31 · Worktree `Talepo-maira-view-state-v1` ·
Branch `feature/dincer-maira-view-state-v1` · HEAD `bbb3b5f` (+çalışma ağacı).

## Devam bloğu

- CURRENT_WAVE: E (AC-1 canlı kabul + I22/I23 + telemetri temeli + FD-3)
  tamamlandı, 2026-08-31.
- LAST_VERIFIED_ITEM: LG-15 (FD-3 tek çekirdek ortaklaştırması, offer-draft-lock 10/0).
- NEXT_SAFE_ACTION: Kurucu incelemesi → commit onayı; sonra FD-2 sırasına
  göre tarihsel kırmızı kapanış dilimleri (önce fanout-telemetry/DW-1 sink
  doğrulaması) ya da DW-2 (olay üreticileri).
- BLOCKERS: (1) Admin+MFA POZİTİF canlı kanıtı — sentetik personaya geçici
  SUPER_ADMIN yazımı oturum izin sınıflandırıcısınca engellendi; kurucu
  isterse tek UPDATE ile açılır (negatif kanıt canlı alındı). (2) 22
  tarihsel kırmızı kapı (aşağıda). (3) DW provision (DW-3 karar verildi,
  provision ayrı onay).

## Kurucu kararları (2026-08-31 turu — uygulandı/kaydedildi)

- FD-4 ✔ Acceptance env senkronu serbest (yalnız kabul testi): kaynak
  `Talepo-acceptance-db-boundary-v1` (günlük workspace'teki `.env.acceptance`
  BAYAT — tarihsel proje ref'i taşıyor, kanonik kapı reddediyor). Hedef DB
  `verify-acceptance-db-target-v1` ile PASS kanıtlandı; env git'te görünmüyor.
- FD-1 ✔ AC-1 canlı kabul koşuldu (aşağıda), ardından I22/I23 kapatıldı.
- FD-2 ✔ Sıra kabul edildi: I22/I23 → telemetri sink temeli (bu turda) →
  kanıtlı P0/P1 tarihsel kırmızılar (sonraki dilimler).
- FD-3 ✔ Tek intelligence core kararı KAYITLI ve ilk ortaklaştırma yapıldı
  (LG-15): iki giriş yüzeyi korunur, duplicate taslak/fiyat mantığı tek
  çekirdeğe (`@/lib/ai/offer-assistant`) indirildi; canonical request brain
  değişmedi.
- DW-3 ✔ ClickHouse + günlük batch hedef mimari olarak kabul; provision/
  credential/deploy YAPILMADI (FOUNDATION_ONLY sürüyor).

## AC-1 canlı kabul kaydı (2026-08-31, kendi sunucu :3195 — kapatıldı; 3187'ye dokunulmadı)

Gerçek browser + gerçek API + acceptance DB zinciriyle ölçüldü; kimlikler:

- Request `cmtgztc4g000a2cuy6uifu95k` ("Nespresso Kahve Makinesi arıyorum -
  Kadıköy, İstanbul", rawInput `AC1_` işaretli, Beyaz Eşya, 6.000 TL,
  İstanbul/Kadıköy) — alıcı a ile canlı yayımlandı (POST /api/requests 201).
- Offer `cmtgzy28f000g2cuypljeqnm6` (₺5.750, Professional c) — keşif →
  teklif formu → 201.
- Conversation `cmtgzzxsu000j2cuyavnako6u` — kabul sonrası TEK konuşma;
  tekrar kabul API'si idempotent (aynı id, DB'de hâlâ 1); 3 mesaj (sistem +
  alıcı + satıcı). Kayıtlar sentetik DB'de KANIT olarak bırakıldı; temizlik
  istenirse yalnız bu üç kimlik + bunlara bağlı satırlar silinir.

Adım sonuçları: 1-17 PASS (giriş, yayın, "Talebi görüntüle" gerçek detay,
liste→detay, keşif, teklif, gelen teklif, kabul, tek Conversation, çift
yönlü mesaj, duplicate-yok, kabul-öncesi mesaj kapalı [yüzey + canlı 400],
başka firma sayfaları sızıntısız 404 + API'ler fail-closed [kabul denemesi
400 varlık sızdırmadan; mesaj POST'u önce 500 → LG-13 ile 400], teklif
aşaması telefon/whatsapp canlı 400 VALIDATION_FAILED / kabul-sonrası
serbestlik belgeli karara uygun, okunmamış rozet açılınca temizlendi,
mobil 390 yatay taşma yok + CTA'lar erişilebilir). Adım 18: NEGATİF yarı
canlı PASS (normal kullanıcıya /admin ve /admin/health sızıntısız 404,
admin API'leri 403); POZİTİF yarı (gerçek admin+MFA girişi) rol yazımı
engellendiği için ÖLÇÜLMEDİ.

## FOUNDER_APPROVED_LOCKED_WIP (dokunulmaz, kanıtlı regresyon dışında)

`package.json`, `package-lock.json`, `MairaStage.tsx`, `MairaContourScene.tsx`,
`lib/maira/contour-scene.ts`, `verify-maira-scene-boundary-v1.ts` —
SHOWCASE_MATCH_PASS; scene 49/0, Maira 396/0, matrix 6069/0, parity 57/0.

## Doğrulayıcı envanteri (2026-08-31 UZLAŞTIRILMIŞ, toplam tam 168)

Dağılım (batch envanteri + tekil yeniden koşumlar + temiz-taban sınıflaması):

- **YEŞİL: 128** = 119 (batch) + 8 (bu turda tekil doğrulanan/düzeltilen:
  category-coverage, common-field-response, field-response-authority,
  talep-companion-contract, must-improve, nonvalue, publish-inference,
  readiness-brand) + 1 (routing matrix 6069/6069). Wave E'de ek: invariants
  artık **123/0** (aşağıda), phase4a-observability 24/0, offer-draft-lock
  10/0, YENİ market-intelligence-foundation 22/0 (envanter 168→169'a çıktı;
  yeni kapı yeşil sınıfına eklenir).
- **TARİHSEL KIRMIZI: 24** (temiz integration tabanında da kırmızı;
  companion bu turda düzeltildiği için 25→24): browse-semantic-closure,
  catalog-generations-v2a, commercial-journey-consolidation,
  corporate-workspace-isolation, deal-review, external-price-intelligence,
  fanout-telemetry, incoming-offer-card, inference-question-authority-v2,
  notifications, offer-decision-footer, offer-intelligence-discoverability,
  offer-media, p1-closed-beta-closure, phase2-constraint-preference,
  phase3a-discovery-foundation, phase3c-corporate-opportunity-center,
  pro-feature-tooltips, projection-authority, provider-routing, public-home,
  sayfam-home, talep-hybrid-ui, unified-preference-criteria.
- **DB-SINIFI: 15** — FD-4 sonrası gerçek durumları ölçüldü:
  - YEŞİL (4): acceptance-db-target, acceptance-personas,
    my-requests-surface, profile-security-trust.
  - TARİHSEL KIRMIZI (+1 → toplam tarihsel fiilen 25 sayılır):
    generated-field-answer — kayıtlı tabanı (1279/255) TEMİZ TABANDA da
    tutmuyor (taban 1284/260); dal etkisi satır satır sayıldı ve YALNIZ
    home-03 `kitchenProductType` (LG-7 ile aynı belgeli sahiplik sonucu).
    Taban gevşetilmedi; kapanışı kendi dilimine bırakıldı.
  - HOST-GÜVENLİĞİ NOT-MEASURED (8): auth-fix, incoming-offers-nav-badge,
    offer-inbox-scope, offer-role-surfaces, offer-unread-action (statik
    49/1 — canlı fixture kullanıcısı eksik), outgoing-offer-inbox,
    question-suppression-authority, request-publish (statik 15/0; canlı
    yazma ölçülmedi). Ortak kök: bu kapıların KENDİ yazma-güvenlik
    yasak listesi `pooler.supabase.com`u reddediyor; güncel acceptance
    projesinde HEM DATABASE_URL HEM DIRECT_URL pooler alan adını taşıyor
    (Supabase IPv4 topolojisi). Yasak listeyi güncellemek güvenlik
    yetkilisine dokunur → kendi dilimi/karar (FD-5 adayı). Dürüst durum:
    canlı DB sözleşmeleri ÖLÇÜLMEDİ, sıfır ya da yeşil DEĞİL.
  - KIRMIZI (1): global-product-identity — davranışsal assert
    (expected 'Samsung'); taban durumu bu sınıfta ölçülememişti,
    kapanışı ayrı dilim.
  - DIŞ SERVİS (1): dataforseo-live — sağlayıcı kimlik bilgisi ister,
    bu ortamda ölçülmez.
- **INVARIANTS: 1** — Wave E'de I22/I23 KAPANDI: **123 passed, 0 failed,
  1 known_fail** (known_fail = I25d, önceden beri açıkça işaretli).

Toplam: 128 + 24 + 15 + 1 = 168 (+ yeni market-intelligence kapısı = 169).

## Bu turda kapatılanlar (CLAUDE_PRODUCT_IMPROVEMENT)

| ID | Yüzey | Durum | Kanıt/İşlem |
|---|---|---|---|
| LG-1 | Kök 404 | FIXED | `app/not-found.tsx` yoktu → Signal dilinde eklendi; smoke: /boyle-bir-sayfa-yok → markalı 404 |
| LG-2 | Kök hata sınırı | FIXED | `app/error.tsx` eklendi (tek scoped sınır vardı) |
| LG-3 | Layout çökmesi | FIXED | `app/global-error.tsx` eklendi (inline stil, layout'suz çalışır) |
| LG-4 | Panel geçiş boşluğu | FIXED | `app/panel/loading.tsx` — 30+ sayfada boş beyaz bekleme vardı |
| LG-5 | /admin/health korumasız sayfa | FIXED | Tek admin sayfası kapısızdı; `requirePlatformAdmin`+MFA+notFound kalıbı uygulandı (API zaten kapılıydı) |
| LG-6 | Saved-search kapısı bayat probu | FIXED | `fitReasons.map` → primary/secondary gerçek niyet ölçümü; 24/0 |
| LG-7 | E2/E6/E7 & F2/F5/F6 tabanları | FIXED | Delta satır satır sayıldı: TEK fark home-03 kahve makinesi sahiplik kararı (`kitchenProductType` kopyası düştü, değer yerinde); iki kapı yeşil |
| LG-8 | Tek-sözcük iddia regresyonu | FIXED | "Tekerlekli sandalye"→furniture, "koltuk destek mekanizması"→null; span kuralı: tek sözcüklük kanıt yalnız tek sözcüklük çekirdeği taşır; category-coverage 99/0'a döndü, matrix 6069/0 korunud |
| LG-12 | Companion extractor kusuru | FIXED | Tek tırnaklı Türkçe YORUM prop taramasını kırıyordu (tabanda da kırmızıydı); yorum soyma eklendi; 19/0 |
| LG-13 | Yetkisiz mesaj POST'u 500 dönüyordu | FIXED (Wave E) | Canlıda ölçüldü: sınır TUTUYOR (yazma 0) ama `mapUnknownToSafeError` `MessageValidationError` adını tanımıyordu → 500. Kardeş doğrulama hatalarıyla aynı 400 eşlemesine eklendi; test-first (phase4a-observability 5b: kırmızı→24/0); canlı yeniden prob 400 |
| LG-14 | I22 + I23 invariant kapanışı | FIXED (Wave E) | Kırmızı kanıt: 121/2. Kök: (I23) katalog zenginleştirmesi + "için" dalı konum+ad naif join'i ("ön ön far"); (I22) VERIFIED-authority dalı kullanıcının zengin ifadesini başlıkta lemma'ya düşürüyordu. Eksen düzeltmesi: `catalog/part-display.ts` tek birleşim yetkilisi + VERIFIED dalda `coversRequestedTokens` (mevcut kanonik) ile zenginleştirme. Sonuç: invariants **123/0** (1 known_fail I25d), matrix 6069/0, Maira 396/0, controls 309/0, parity 57/0, scene 49/0, TSC 0 |
| LG-15 | FD-3 tek intelligence core ortaklaştırması | FIXED (Wave E) | Monetization offer-assistant sağlayıcısı kendi taslak şablonu + sahte pricingHint taşıyordu; test-first (offer-draft-lock'a 2 kapı: kırmızı→10/0) `@/lib/ai/offer-assistant` çekirdeğinden türetildi. İki giriş yüzeyi (panel + teklif bağlamı) korunur; API sözleşme alanları değişmedi |

## Doğrulanan (değişiklik gerekmedi)

| ID | Yüzey | Durum | Kanıt |
|---|---|---|---|
| LG-20 | "Talebi görüntüle" zinciri | VERIFIED(statik) + OWNED_ELSEWHERE | `viewHref=/panel/taleplerim/[id]` → sayfa var, sahip kilidi `createdById` + notFound; keşif `detailHref=/panel/talepler/[id]` var. Kimlikli browser kanıtı AC-1'e bağlı. Alan `feature/dincer-my-requests-visual-v1` dalında aktif WIP (15cefe8) — oraya dokunulmadı |
| LG-21 | Mesajlaşma sözleşmesi | VERIFIED(statik) | Conversation yalnız kabul servisi içinde, `offerId @unique`, idempotent create, `getSendableConversation` erişim kapısı, kabul-sonrası iletişim serbestisi BELGELİ karar; E2E AC-1'e bağlı |
| LG-22 | Admin kapıları | VERIFIED | Tüm admin sayfaları + API'ler kapılı (LG-5 sonrası); cron'lar CRON_SECRET fail-closed; webhook imzalı |
| LG-23 | API guard taraması | VERIFIED | Kapısız görünen 13 route'un tamamı bilinçli public/secret-korumalı sınıfta |
| LG-24 | Secret/XSS | VERIFIED | Kaynakta gömülü secret 0; `dangerouslySetInnerHTML` 0 |
| LG-25 | İç link bütünlüğü | VERIFIED | 42 benzersiz href ↔ 48 route; tek kopukluk render edilmeyen ölü export'ta (LG-40) |
| LG-26 | AI Asistan | PARTIAL | Entitlement kapılı, tek-talep kapsamı IDOR-farkında; "teklif ekranı asistanından farkı" ürün değerlendirmesi → FD-3 |

## Açık — güvenli ama bu worktree'de yapılamaz

| ID | Konu | Durum | Neden |
|---|---|---|---|
| AC-1 | Kimlikli canlı kabul | **PASS (çekirdek döngü, Wave E)** | 18 adımın 17'si canlı PASS; adım 18 pozitif yarısı (admin+MFA girişi) rol yazımı engellendiği için ölçülmedi. Ayrıntı: "AC-1 canlı kabul kaydı". Kapsam dışı kalan derin senaryolar (district parity, RequestChange E2E, AI draft→teklif, alarm→bildirim, smart-match) sonraki kabul turu |
| LG-40 | `HomeOnePreviewBanner` ölü export + kırık `/onizleme/ana-sayfa-v2` linki | PARTIAL/OWNED_ELSEWHERE | Hiçbir yerde render edilmiyor; home/v1 görsel dalın aktif alanı — çakışmamak için bırakıldı |
| LG-41 | `cover-preview` public POST hız sınırı yok | P2 | Dış Wikimedia sorgusu; kötüye kullanım maliyeti düşük ama sınırsız |
| LG-42 | GLB 2,6 MB her Maira girişinde | P2 | Önbellek/boyut stratejisi ayrı dilim; FOUNDER_APPROVED_LOCKED_WIP olduğu için dokunulmadı |

## Kurucu kararları — FD-5 / FD-6 / DW (2026-08-31, checkpoint onayı turu)

FD-1..FD-4 ve DW-3 önceki blokta; bu turda kurucu şunları karara bağladı:

- **FD-5 ✔ (karar verildi):** Supabase host güvenlik kapısı geniş wildcard
  ya da genel gevşetmeyle ÇÖZÜLMEYECEK. Kabul edilen tek çözüm şekli:
  doğrulanmış proje referansı + doğrulanmış direct/pooler host biçimleri +
  development/test hedefi kanıtı + TLS doğrulaması + CA pin + bilinmeyen
  veya production hedefte fail-closed. Uygulaması ayrı dilimdir; o dilim
  bu maddeleri sözleşme olarak alır.
- **FD-6 ✔ (karar verildi):** Pozitif admin+MFA testi YALNIZ doğrulanmış
  development/test ortamında ve şu sınırlarla yetkilidir: yeni ve yalnız
  QA'ya ait geçici hesap; mevcut güvenli fixture/seed yolu; en dar rol
  değişikliği; kesin kimlik kaydı; test sonrası aynı hesabın rolünün geri
  alınması/temizlenmesi. Gerçek kullanıcı, mevcut kişisel hesap veya
  production rolü DEĞİŞTİRİLEMEZ.
- **DW kilidi ✔:** Telemetri sink doğrulanmadan (DW-1) ClickHouse
  provision/credential/deploy YAPILMAYACAK.

## FOUNDER_DECISION_REQUIRED (kalan açık)

| ID | Karar | Not |
|---|---|---|
| DW-4 | Admin "Pazar ve Talep Zekâsı" yüzeyi | Read-model sözleşmesi hazır (`market-intelligence/provider.ts`); yüzey dilimi DW-1 sink doğrulaması sonrası |

## Data warehouse programı

Ayrı kalıcı kayıt: `docs/MARKET-INTELLIGENCE-PROGRAM.md` (ölçüm sözlüğü,
olay sözleşmesi, sağlayıcı sınırı, tek mimari öneri, DW-1..DW-4).
Durum: FOUNDATION uygulandı (Wave E) — `src/lib/market-intelligence/`
(contract/sink/provider) + `verify-market-intelligence-foundation-v1`
(22/0, mutasyon kontrollü). Provision/credential/migration YOK; transport
yokken sink dürüstçe `DW_PROVISION_REQUIRED` der. Sahte rakam/dashboard
üretilmedi.

## Wave E dosya kapsamı (commit onayı bekleyen ek yollar)

Değişen: `verify-phase4a-observability-v1.ts`, `verify-offer-draft-lock-v1.ts`,
`src/lib/observability/errors.ts`, `src/lib/catalog/apply-enrichment.ts`,
`src/lib/request-understanding/semantic-subject.ts`,
`src/server/monetization/ai-offer-assistant.ts`,
`docs/MARKET-INTELLIGENCE-PROGRAM.md`, bu ledger.
Yeni: `src/lib/catalog/part-display.ts`, `src/lib/market-intelligence/`
(contract/sink/provider), `scripts/verify-market-intelligence-foundation-v1.ts`.
Ayrıca yerel-only (git dışı, ignore kanıtlı): `apps/web/.env.acceptance`,
`apps/web/.acceptance/supabase-ca.crt`.
