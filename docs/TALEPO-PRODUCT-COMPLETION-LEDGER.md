# TALEPO PRODUCT COMPLETION LEDGER

Tek devam noktası. Sonraki oturum: **"Completion Ledger'dan devam et"**.
Mevcut kayıtları TAMAMLAR: `docs/KNOWN-BROKEN.md` (kırmızı kapılar) ve
`docs/ai-handoff/08-KNOWN-RISKS-AND-GAPS.md` (25 risk) buranın ekidir;
oradaki hiçbir madde buraya kopyalanarak çoğaltılmadı, ID ile referanslanır.

Son güncelleme: 2026-08-31 · Worktree `Talepo-maira-view-state-v1` ·
Branch `feature/dincer-maira-view-state-v1` · HEAD `bbb3b5f` (+çalışma ağacı).

## Devam bloğu

- CURRENT_WAVE: RC (Release Candidate programı) — sürüyor. Wave M pushlandı (e10aaf2).
  RC-1 sayı-ekseni düzeltmesi + canlı E2E pushlandı (024356f).
  Önceki: L (ölçüm adları + ürün türü + resolvedEntities +
  Pro ürün karnesi) tamamlandı, 2026-08-31. Checkpointler: F **2d834f0**,
  G **27583e0**, H **76f1fed**, I **889125d**, J **b2d396f**,
  K **0e484f0**, L **c8c2547** (hepsi pushlandı).
- LAST_VERIFIED_ITEM: LG-69m (bileşen ④ 0→5/108, mutasyon kanıtlı).
- NEXT_SAFE_ACTION: Kurucu incelemesi → Wave K commit onayı; sonra
  projection-authority imza tabanının kendi dilimi ya da FD-2'de sonraki
  tarihsel (aday: provider-routing / sayfam-home); 4 category_unresolved
  senaryo kurucu taksonomi kürasyonu adayı.
- BLOCKERS: (1) **16** tarihsel kırmızı. (2) ÜRETİM sink kaydı — DW-3
  provision turu. (3) Suppression D1 exit-3: 4 `category_unresolved`
  senaryo (tech-12 "logo tasarımı", health-07 "test çubuğu", health-08
  "hangi ilacı almalıyım", home-06 "kürek sapı") — kategori çözümü/
  taksonomi kürasyonu; hedef sayaçların ÜÇÜ DE SIFIR (aşağıda).

## RC programı kaydı (2026-09-01 — sürüyor)

Kurucu otonom Release Candidate mandası. Wave adları iç organizasyon.
Checkpoint: L c8c2547, M e10aaf2, RC-1 024356f, RC-2 0ca8870+fb7c8d3+2247042+a22e9ac, RC-3 6fb051e+d0a65c2 (hepsi pushlandı).

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-72rc | Ürün envanteri | MAPPED | 47 sayfa route + 74 API route gerçek kaynaktan sayıldı. 42 Prisma modeli. API auth taraması: yalnız 9 meşru-public route auth taşımıyor (nextauth, register, health/ready, imzalı webhook, tokenlı callback, geo/cover public); admin uçları requirePlatformAdmin+MFA taşıyor. |
| LG-73rc | ÜRÜN KUSURU: sayı ekseni çift-tüketimi | FIXED | Canlı /talep QAsinda yakalandı: bütçem 20 bin TL hem BÜTÇE hem ADET=20000 üretiyordu. Kanonik sayı otoritesinde (number-role.ts binRe) eksen düzeltmesi: sayının ardında para birimi ya da önünde bütçe bağlamı varsa rol PRICE, adet kanalına yazılmaz. 5 sınıf ayrık doğrulandı. projection-authority 526→524 sayılı delta (re-02 sahte adet düştü). |
| LG-74rc | ÇEKİRDEK E2E (canlı browser + DB) | VERIFIED | ALICI(C) talep yazdı→beyin doğru anladı→yayınladı (PUBLISHED, budgetMax 20000, quantity YOK); SATICI(D) keşfetti→teklif verdi (18.500 TL); ALICI kabul etti→request OFFER_SELECTED, offer ACCEPTED; TEK conversation (offerId unique) 2 katılımcıyla oluştu; bildirimler doğru kişiye (REQUEST_PUBLISHED+NEW_OFFER→alıcı, OFFER_ACCEPTED→satıcı). Refresh/logout/login sonrası veri kalıcı. |
| LG-75rc | IDOR / conversation erişimi | SECURE | İlgisiz STANDARD(A) conversation mesaj APIsine erişemedi (getSendableConversation katılımcı olmayan için MessageValidationError, veri sızmadı). Alıcı 201; A POST 400. |
| LG-76rc | Entitlement server-gate | SECURE | STANDARD(A): smart_alerts/saved_searches/ai_offer_assistant/hidden_inventory false. Server bypass: saved-searches POST 403, alerts POST 403, watchlist POST 403, company/team 403 — hepsi kanonik requireResourceOwnerFeaturedan. |
| LG-77rc | COMPANY workspace + Gizli Envanter add-on | VERIFIED | Pro(C) firma oluşturdu (POST /api/company 200). Beş-durumlu Gizli Envanter kuralı server-side: company+PROFESSIONAL ama add-on YOK → 403 Gizli envanter bu hesapta kapalı; DBde addon açılınca GET/POST 200, stok kalıcı. Bireysel Pro hiç erişemez. |
| LG-78rc | Verifier scratch artifact | GITIGNORED | verify-global-product-identity.ts çalışma dizinine kalıcı TEST-OUTPUT.txt yazıp tekrar tekrar untracked kirlilik üretiyordu; .gitignorea eklendi. |

RC QA sentetik verisi (request+offer+conversation+company+add-on+inventory)
kesin id ile temizlendi (kalan 0).

### RC-3 turu (2026-09-01) — kapanış

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-85rc | PRODUCTION BUILD ZİNCİRİ | PASS | Prisma validate 0, Prisma generate 0 (kabul env ile), production next build EXIT=0 — 70 sayfa. GERÇEK build kusuru bulundu ve kapatıldı: /kayit prerender useSearchParams Suspense sınırı olmadan KIRILIYORDU; sınır eklendi (davranış aynı). ESLint: 22 error/47 warning — tamamı stil sınıfı (unescaped-entities, server-component try/catch-JSX kuralı, unused-vars); çalışma zamanı hatası yok, release-blocker değil. |
| LG-86rc | TARİHSEL KIRMIZI TRİYAJI TAMAM | TRIAGED 25→8 | Bu turda kapananlar (9): allowlist (kendi yeni kabul betiklerimde redaksiyon/K9 disiplinine uyum — gerçek harness-güvenlik düzeltmesi; ASCII-\b Türkçe 'bütçe' sahte-taint'i kodpoint kurulumuyla çözüldü), p1-closed-beta (seq-token + rail varsayılanı SUPERSEDED), phase3c (başlık Türkçeleşti + attributedOfferFormHref SUPERSEDED), commercial-journey (ConversationShell taşınması SUPERSEDED), offer-media (ConcludedProcessPanel taşınması SUPERSEDED), offer-intelligence-discoverability (yeni kabuk işaretleri SUPERSEDED), hybrid-composer (taksonomi 2151→2152 FD-7 rebase), deal-review, nonvalue (önceki tur). KALAN 8 aktif kırmızı sınıflandırması: STILL_REAL_PRODUCT_BUG P2 ×4 (browse-semantic-closure uyumlu-marka ekseni; catalog-generations-v2a E210-far çıkarımı; fanout-telemetry span bölüntüsü; phase3a tek-fixture printing yaprağı '50 bin adet karton kutu'), LOW_PRIORITY_DATA_GAP ×3 (incoming-offers-nav-badge, offer-unread-action, offer-role-surfaces — kurucunun birincil-DB canlı fixture'larını bekler), EXTERNAL ×1 (dataforseo-live API anahtarı). RELEASE_BLOCKER: 0. Hiçbir test silinmedi. |
| LG-87rc | 47-ROUTE WALKTHROUGH | COVERED | 42 statik/oturumlu route canlı sweep: 33 kullanıcı yüzeyi 200/meşru-redirect; 9 admin route normal kullanıcıya 404 (admin sızıntısı YOK). 9 dinamik [id] rotası program boyunca gerçek akışlarla gezildi (talep detay/düzenle, teklif formu, gelen-teklif çalışma alanı, sohbet, bildirim-r, firma-profil, admin detayları). Silinmiş/geçersiz nesneler (talep, sohbet, bildirim deep-link, firma) markalı yol-gösteren 404'e düşer — ham stack/boş sayfa YOK. |
| LG-88rc | A11Y + SCRATCH TEMİZLİĞİ | PASS | Panel statik denetim: adsız buton 0, alt'sız görsel 0, etiketsiz input 0, main landmark var; blocker yok. Scratch araçlar final tree'den çıktı: tmp-rc-dev.ts SİLİNDİ (kanonik tek-port 3187 kararına aykırı kalıcılaşmasın), tmp-envrun.ts gerçek altyapıya TERFİ etti → scripts/run-with-acceptance-env-v1.ts (kanonik loadAcceptanceEnv + redaksiyon + K9 girişi; allowlist kapısından geçiyor). Working tree CLEAN. |
| LG-89rc | FİNAL REGRESYON | GREEN | 32 kapılık geniş batarya tamamı yeşil + D1 bilinçli exit-3 + TSC 0 + kabul: budget-alert GREEN, supplier-capability 16/0. |

### RC-2 turu (2026-09-01)

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-79rc | ADMIN operasyon derinliği | VERIFIED+EXTENDED | QA admin (FD-6: geçici yükseltme, test sonrası USER/SUSPENDED geri alındı) ile canlı gezinti: MFA kapısı (localhost bypass yalnız dev), users (arama ad/e-posta/üye-no/telefon — telefon yalnız sensitive.view; sayfalama; rol/plan/durum filtreleri; CSV), companies (plan+koltuk), requests (talep-no arama, sahip, teklif drawer), offers, health (eşik uyarılı gerçek metrikler), audit (writeAdminAudit), moderasyon SLA. İKİ YENİ yüzey eklendi: /admin/notifications (tür/alıcı/okundu/dedupe-kimliği; alıcı e-postası sensitive.view kapılı) ve /admin/curation (kanonik DOMAIN_ENTITIES defterinden — ikinci liste yok; onaylı satır karar ref+tarih gösterir, eksikse EKSİK! bayrağı). |
| LG-80rc | NOTIFICATIONS tam E2E | VERIFIED | Üretici envanteri koddan: kanonik tek yazıcı (create-notification.ts, KB-22) + 17 tip + 8 tüketici + 6 doğrudan site. Canlı zincir: unread 2→1 (deep-link tıklaması /panel/bildirimler/r/<id> üzerinden OKUNDU işaretleyip DOĞRU sohbete indi) → tümü-okundu → reload sonrası kalıcı 0. Redirect route sahiplik kapılı (userId), silinmiş hedefe NOTIFICATION_MISSING_TARGET_HREF ile graceful. verify-notifications-v1 51/0. |
| LG-81rc | PLAN LIFECYCLE | VERIFIED | Kanonik syncSubjectPlanFromBilling üzerinden: STANDARD(hepsi false) → UPGRADE(PROFESSIONAL; alerts/saved/analytics true) → EXPIRED(süre geçmiş Pro → efektif STANDARD, stale entitlement YOK) → DOWNGRADE(kapandı). Veri silinmedi; persona E başlangıç durumuna döndü. Mock upgrade prod'da HER ZAMAN kapalı (sahte ödeme başarısı yok); iyzico webhook V3 imza doğrulamalı; gerçek sağlayıcı anahtarı EXTERNAL_PRODUCTION_DEPENDENCY. |
| LG-82rc | RESPONSIVE örneklem | PASS | 375px: panel gerçek mobil desen (alt tab bar + FAB), talepler/taleplerim/analiz/teklifler/talep sıfır yatay taşma (scrollWidth ölçümü). 1024px: fırsatlar/gelen-teklifler sıfır taşma. Tam 47-route süpürmesi yapılmadı — örneklem; kalan rotalar continuation kapsamında. |
| LG-83rc | BİLEŞEN ⑤ tedarikçi yeteneği | MEASURED 6/6 sınıf | Kök neden bulundu: kanonik adaptörün (adaptDbCompanyToProfile) hiçbir ÜRETİM çağıranı yoktu. Yeni tek yükleyici src/server/matching/load-supplier-capability.ts (ikinci matcher DEĞİL): CompanyCategory/city/CompanyInventoryItem/AlertRule/SavedSearch(kanonik filters JSON) → mevcut adaptör → mevcut skorlayıcı. verify-supplier-capability-consumption-v1 16/0 GERÇEK kabul DB satırlarıyla: sınıf başına pozitif tüketim + yanlış-tedarikçi bastırma + olmayan-firma null + mutasyon (satır silinince kanıt durdu, geri gelince döndü). SUPPLIER_CAPABILITY_PROVEN=6/6 (payda 6 kanonik sinyal sınıfı — ölçüm BİRİMİ boru-hattı kanıtıdır; corpus-yoğunluğu lansman metriğidir ve lansman öncesi bilinçli ölçülmez). Fixture kesin etiketle silindi. |
| LG-84rc | Tarihsel kırmızı triyajı (kısmi) | TRIAGED | deal-review 75/77→77/77: (1) STILL_REAL_PRODUCT_BUG — kullanıcıya değerlendirme değişmezliği vaadi kaybolmuştu; kanonik DEAL_REVIEW_BLIND_HINT metnine geri eklendi (davranış zaten değişmezdi). (2) SUPERSEDED_CONTRACT — pencere props kablolaması ConversationShell'e taşınmıştı; test iki dosyayı birden okuyor. nonvalue-answer-authority H2 988→986 rebase (FD-7/8/10 kürasyonu productType'ları VALUE yaptı — kararla geçen delta). Env-runner ile: my-requests-surface/offer-inbox-scope/outgoing-offer-inbox/auth-fix YEŞİL (yalnız DB env ister); incoming-offers-nav-badge + offer-unread-action LOW_PRIORITY_DATA_GAP (kurucunun birincil-DB canlı hesabını bekliyor, kabul DB'de yok). Kalan 14 tarihsel gate sınıflandırma/karar bekliyor — continuation listesinde. |

SHADOW→LIVE değerlendirmesi: matching SHADOW KALIR. Gerekçe: (a) V3'ün
üretim tedarikçi yükleyicisi bu turda doğdu ve henüz feed'e bağlanmadı;
(b) canlı öneri motoru hâlâ V3-öncesi smart-matching.ts (bilinen mimari,
V3 kesişiminde emekliye ayrılacak); (c) kullanıcıya sahte eşleşme vaadi
gösterilmiyor (fırsat feed'i mevcut motordan gerçek veriyle çalışıyor).

## Wave M kaydı (2026-08-31 — COMMIT EDİLMEDİ)

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-64m | Bileşen ④ kürasyon otoritesi | IMPLEMENTED | Kürasyon kararı varlığın KENDİ kanonik kaydında yaşar (`domain-entities.ts` → `DomainEntityProvenance`); ikinci kayıt defteri/matcher/whitelist YOK. Additive üç alan: `curationDecisionRef`, `curationDecidedAt`, `curationReason` (mevcut provenance dilbilgisi: `sourceRef`/`retrievedAt` kalıbı) |
| LG-65m | ONAY = STATÜ + KARAR KAYDI | HARDENED | `domainEntityEvidenceStrength` artık `CURATOR_APPROVED` statüsünü tek başına VERIFIED saymaz: karar kaydı eksikse kayıt CANDIDATE kalır (`hasCurationDecisionRecord`). Sözleşme GEVŞEMEDİ, sıkılaştı; I26e iki yönlü ölçüme çevrildi |
| LG-66m | Onay ölçütü (ada özel DEĞİL) | CURATED | Üç koşul: `confidence === "HIGH"` + bağlam koruması YOK (`caseSensitiveAliases`/`requiresContext`) + gerçek probe'da `RESOLVED` & çakışma 0. Onaylanan 3: `platform:wordpress`, `platform:shopify`, `machine-type:cnc-tezgahi`. Bilinçli PENDING kalan 2: `software-suite:sap`, `software-suite:logo-yazilim` — adları Türkçede sıradan sözcükler ("sap", "logo") |
| LG-67m | Kabul kapısı | GREEN 42/0 | `verify-curated-entity-consumption-v1`: 11 satırlık cohort (4 sınıf birlikte), 9 negatif tüketim sözleşmesi, 3 onay-kaydı denetimi, 4 mutasyon adımı. Tedarikçi profili YALNIZ varlık etiketini taşır ve `attributes` boşaltılır → "attribute" bileşeni eşleşirse tek açıklama kanonik varlık sinyalidir (sinyal izolasyonu ayrıca negatif kontrolle kanıtlandı) |
| LG-68m | Mutasyon kanıtı | PROVEN | M0 tüketiliyor → M1 statü PENDING'e çevrilince tüketim DURUYOR → M2 statü onaylı ama karar kaydı silinince yine tüketilmiyor (strength CANDIDATE) → M3 geri yükleme sonrası taban aynen dönüyor. Kayıt defteri koşum sonunda DEĞİŞMEZ |
| LG-69m | Bileşen ④ ölçümü (payda 108 korundu) | MEASURED 0→5/108 | `CURATED_ENTITY_CONSUMABLE=5` (tech-05 WordPress, tech-06 Shopify, mach-01/mach-02/mach-07 CNC) · `PENDING_ENTITY=2` (tech-07 SAP, tech-08 Logo) · `NO_ENTITY=101` (ölçülmüş yokluk — kanonik kayıt yok, ölçülememiş DEĞİL). Sınıflar paydayı tüketir: 5+2+101=108. Taban SAYI değil KİMLİK KÜMESİ olarak dondurulur |
| LG-70m | mach-07 kurucu dikkatine | FLAGGED | "CNC marka bir ürün arıyorum": kullanıcı CNC'yi MARKA beyan ediyor (brandEvidence USER_ASSERTED), kanonik kayıt onu MAKİNE TÜRÜ sayıyor. Roller karışmıyor (marka kendi kanalında, varlık kendi kanalında) ve alan sinyali doğru; yine de satır bilinçle sayıldı — kurucu istemezse çözüm REJECTED değil alias daraltmasıdır |
| LG-71m | Kürasyonun beyin davranışına etkisi | MEASURED | Belgelenen kural ("PENDING tek başına CONFIDENT kategori üretemez") artık iki yönlü ölçülüyor: onaylı varlıklı üç probe CONFIDENT/0.8, kürasyon bekleyen iki probe TENTATIVE/0.5. Kategori ATAMASI değişmedi (coverage 100/8/0 aynen); değişen yalnız kesinlik statüsü |

**PROFESSIONAL_DISCOVERY_DATA_READINESS (Wave M yeniden hesabı — ad DEĞİŞMEDİ):**
`100×((107/108)+(15/108)+(69/108)+(5/108)+0)/5` = **%36,30 ≈ %36**
(Wave L checkpoint'i **%35,37** tarihsel kayıt olarak KORUNUR; artışın tek
kaynağı bileşen ④'ün 0→5/108 ölçülmesidir. ⑤ tedarikçi yeteneği hâlâ
ölçülmedi ve 0 katkı veriyor — "ölçülmedi" 0-ölçüm olarak sunulmaz.)

**Matching SHADOW'da kaldı.** Bu dalgada bildirim/fanout iddiası, otomatik
sağlayıcı dağıtımı ve LIVE geçişi YOKTUR; kapanan tek şey varlık sinyalinin
doğruluğudur.

## Wave L kaydı (2026-08-31 — COMMIT EDİLMEDİ)

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-51l | ÖLÇÜM ADI SÖZLEŞMESİ | RENAMED | `100×(Σ bileşen)/5` formülünün adı artık **PROFESSIONAL_DISCOVERY_DATA_READINESS** — yalnız teknik keşif/projection VERİ hazırlığını ölçer, Pro ürün deneyimini DEĞİL. Ürün deneyimi ayrı metriktir: **PROFESSIONAL_PRODUCT_READINESS** (LG-57l). %21/%22/%41 birbirinin devamı olarak SUNULMAZ; %41 zaten geri çekilmişti (LG-50k) |
| LG-52l | Tarihsel kırmızı: projection-authority | CLOSED (16→15) | Dondurulmuş taban satır-satır sayılmış delta ile yeniden kuruldu: 2 home-03/kitchenProductType satırı kurucu sahiplik kararıyla ÇIKTI, 10 USER_EXPLICIT satırı (appl-03/05/10, furn-01, re-02 × attributes+constraints — hepsi girdiden probe edildi) GİRDİ; totalIdentities 510→518, 15 payload imzası güncellendi. Mutasyon kanıtı: re-02 satırı INFERRED'e çevrilince 1 ihlal, geri alınca yeşil |
| LG-53l | Keşif bileşeni ③: ürün türü erişimi 0→66/108 | IMPLEMENTED | Publish snapshot köprüsü: TEK beynin `requestSubject` kaydı, kanıt eşiğiyle (`EXPLICIT` provenance + USER_EXPLICIT/VERIFIED kaynak) `entities.product`a taşınır; jenerik yer tutucular (paylaşılan `GENERIC_SUBJECT_PLACEHOLDER_RE` otoritesi) ve marka/model rol sızıntısı (tech-03 "Samsung"→"televizyon", appl-04 "Arçelik"→"Bulaşık Makinesi" düzeldi; auto-10 "C200" model kanalına ayrıldı, −1 dürüst) ASLA taşınmaz. Kapı `verify-product-type-envelope-v1` 14/14 (6 aile pozitifi, 2 negatif, 66 donmuş erişim, mutasyon kontrolü); ölçüm ÜRETİM-EŞDEĞER çağrıyla (snapshot+projection, db-shaped adaptör sırası) |
| LG-54l | D2 tabanı Wave K sonuçlarıyla uzlaştırıldı | REBASED | `verify-inference-question-authority-v2` HEAD'de de kırmızıydı (Wave K merdiven düzeltmesinin meşru sonucu; bu dalganın değişikliklerinden bağımsız — HEAD'e geri alınarak kanıtlandı). Sayılmış delta: 8 kayıt correctly_suppressed'e (5 açık beyan: no-frost/9 kg/Ankastre/koltuk takımı/25 bin TL; 3 CATALOG_ENRICHED marka), authority_suppressed 3→0 (göç), ASKED'den 2 düştü (yazılmış değer yeniden sorulmuyor — sessiz bastırma değil). Kapı YEŞİL, D1 exit-3 sözleşmesi korunuyor |
| LG-55l | Keşif bileşeni ④: matching resolvedEntities | CONTRACT CLOSED (kanıt 0 = kürasyon açığı) | Zarf `resolvedEntities`i snapshot'tan AYNEN taşır (yeniden çıkarım yok); skorlayıcı kürasyon sözleşmesini uygular: yalnız `CURATOR_APPROVED` + güven>0.5 kanıt üretir, `PENDING_CURATION` üretmez (domain-entities.ts'nin kendi belgelediği kural). Kapı D bölümü: taşıma + PENDING-negatif + APPROVED-pozitif (çift aynı zamanda mutasyon kontrolü). Bugünkü katalogda TÜM varlıklar PENDING_CURATION → ölçülen tüketim 0; bu kod açığı değil kürasyon açığıdır. Golden 117/0, matrix, unified, phase2, personal-opportunity hepsi yeşil |
| LG-56l | Pro dilimi: budget_change_alerts (YOK→CANLI) | IMPLEMENTED + VERIFIED | Entitlement anahtarı yalnız plan pazarlamasında yaşıyordu; artık gerçek: bütçe alanı değişince `recordRequestChanges` watchlist sahibi firmalara bakar, yetkiyi kanonik `featuresForPlan`dan okur (ikinci yetki listesi yok), OWNER/ADMIN/MANAGER üyelere GENERAL bildirim üretir (yazar hariç, non-blocking, alarm-teslim kalıbıyla dedupe). Canlı kabul DB kanıtı (`acceptance-budget-alert-v1`): PRO firma aldı / STANDARD almadı / yazar almadı / mesaj içeriği "1.000 → 1.500" / dedupe 1 — 5/5, kalıntı kesin etiketle temizlendi |
| LG-57l | PROFESSIONAL_PRODUCT_READINESS (ilk resmî ölçüm) | MEASURED **%60** | 6 gerçek kullanıcı-yüzü Pro yeteneği × 5 eksen (plan kapısı / gerçek veri / canlı E2E / cihaz UX / hata-boş-güvenlik). TAM=1, KISMİ=0.5, YOK-BLOCKED-NOT_MEASURED=0; payda tam tutulur. Alarmlar %80 (canlı, Wave J) · Bütçe-değişim alarmı %80 (canlı, bu dalga) · Analiz %60 · Takip+Kayıtlı arama %60 · Fırsatlar/Smart Match %50 (motor SHADOW) · AI Asistan %30 (LLM yok — BLOCKED). Cihaz UX ekseni hiçbir yüzeyde ölçülmedi (0 katkı, paydada). Ayrıntı tablo aşağıda |
| LG-58l | 4 kürasyon vakası kurucu masasında | TABLED→APPROVED (aşağıda FD tablosu) | FOUNDER_DECISION_REQUIRED tablosuna FD-7..FD-10 eklendi; bu dalgada kategori sahipliği DEĞİŞTİRİLMEDİ. health-07 ayrıca teknik aday: `tibbi-testler` yaprağı VAR ama alias'ında "test çubuğu" yok — kürasyon kararına bağlı alias dilimi |

| LG-59l | FD-7/8/10 kürasyonu uygulandı | CURATED | services'e 1 yeni SERVICE_TYPE yaprağı; tibbi-testler + machinery/saplar alias kürasyonu (tam-ifade; "logo"/"test"/"sap" tek başına YASAK). Negatif probe'lar temiz: "yazılım testi"→technology, "SAP danışmanlığı"→technology, "Logo muhasebe programı"→technology (services'e sızmadı) |
| LG-60l | FD-9 tıbbi-tavsiye kapsam politikası | IMPLEMENTED | `UNSUPPORTED_MEDICAL_ADVICE` + merkezî `isUnsupportedRequestScope`; I52a-e kalıcı invariantlar (3 pozitif kapsam-dışı; koruma: "Ağrı kesici arıyorum"/"Tansiyon aleti"/"test çubuğu"/"İlaç kutusu"/"Hangi laptopu almalıyım" DEMAND; supply önceliği korunur). Batarya 129/0 |
| LG-61l | Yüzey-kimliği düzeltmesi (I43d ile yakalandı) | FIXED | FD-10 alias'ı gerçek kusuru gösterdi: alias eşleşmesinde kanonik yaprak adı ("Saplar") kullanıcı ifadesini ("kürek sapı") eziyordu. attribute-hints: alias-eşleşen ifade ≠ kanonik ad ise KULLANICI İFADESİ korunur. Sayılı imza etkisi: auto-04 "su pompası", auto-09 "panelvan", print-05 "promosyon kalem", appl-10 "Ankastre fırın", furn-07 "Yemek masası"+diningSeats — hepsi kullanıcı dilinden doğrulandı; tech-04 "Muhasebe" ve print-10 "Kraft" kullanıcı sözcüğü ama kısmî ifade (kozmetik takip notu) |
| LG-62l | Taban rebase'leri (hepsi sayılı) | REBASED | projection-authority 518→526 (+8: furn-07/diningSeats, health-07/productType, home-06/productType, tech-12/productType × a+c; USER_EXPLICIT 186→190; 10 imza), publish-inference 76→75 (kanarya), snapshot-internal-evidence INFERRED 20→19 + kanarya→gerileme bekçisi, D2 correctly 57→58 + not_measured 4→1, coverage fixture health-07 knownIssue kaldırıldı (XPASS kapanışı) + home-06 sahiplik machinery, readiness G8 99/9→100/8, envelope tabanı 66→69 (+3 FD) ve "logo tasarımı" negatiften pozitife taşındı |
| LG-63l | Kürasyon sonrası ölçümler | MEASURED | Coverage 100 pass/8 known_fail/0 fail; D1 not_measured 4→1 (yalnız health-08 — FD-9 gereği bilinçli kapsam dışı); PROFESSIONAL_DISCOVERY_DATA_READINESS %34,26→**%35,37** = `100×((107/108)+(15/108)+(69/108)+0+0)/5` (slug 104→107, ürün türü 66→69; yüzey: üretim-eşdeğer zarf çağrısı — coverage'ın snapshot-only product ölçümü 13/108 AYRI yüzeydir ve karıştırılmaz) |

**PROFESSIONAL_DISCOVERY_DATA_READINESS (yeniden hesap, bu dalga):**
`100×((104/108)+(15/108)+(66/108)+0+0)/5` = **%34,26** → FD kürasyonu sonrası
`100×((107/108)+(15/108)+(69/108)+0+0)/5` = **%35,37 ≈ %35**
(③ 0→66 bu dalganın kazancı; ④ sözleşme kapalı ama tüketilebilir kanıt 0 —
kürasyon açığı; ⑤ tedarikçi yeteneği ölçülmedi, 0 katkı paydada).

**PROFESSIONAL_PRODUCT_READINESS karnesi (LG-57l ayrıntısı):**

| Yetenek | Plan kapısı | Gerçek veri | Canlı E2E | Cihaz UX | Hata/boş/güvenlik | Skor |
|---|---|---|---|---|---|---|
| Uyarılar/Alarmlar | TAM | TAM | TAM (Wave J 15 adım + 8 negatif) | NOT_MEASURED | TAM (negatifler+403) | %80 |
| Bütçe-değişim alarmı | TAM | TAM | TAM (kabul 5/5) | NOT_MEASURED | TAM (non-blocking+dedupe+plan negatifi) | %80 |
| Analiz | TAM | TAM (`generateMarketInsight`) | NOT_MEASURED | NOT_MEASURED | TAM (insufficientData+upsell fallback) | %60 |
| Takiplerim + Kayıtlı arama | TAM | TAM | KISMİ (server-path kapılar) | NOT_MEASURED | KISMİ | %60 |
| Fırsatlar / Smart Match | TAM | TAM | NOT_MEASURED | NOT_MEASURED | KISMİ (motor SHADOW) | %50 |
| AI Asistan | TAM | KISMİ (talep listesi gerçek; taslak LLM'siz) | BLOCKED | NOT_MEASURED | BLOCKED | %30 |

Kapsam dışı (firma-içi ürünler, karneye girmez): ekip/koltuk yönetimi,
Gizli Envanter. Eksen kanıtları kod-inceleme + adı geçen canlı koşular;
"NOT_MEASURED" hiçbir yerde 0-ölçüm olarak sunulmaz.

## Wave K kaydı (2026-08-31 — COMMIT EDİLMEDİ)

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-45k | KB-17 dört vaka | CLOSED | re-02 (high-risk): kullanıcı "25 bin TL" YAZDI, ürün kaydı EXPLICIT_TEXT doğruydu; kapının kanıt probu sayı-normalize edilmiş beyanı bulamıyordu → kanonik TEK sayı otoritesi (`classifyNumbers`) probu eklendi. tech-02/10 (authority): "iPhone" katalogun KENDİ Apple alias'ı — alias-metinde = markanın açık beyanı → EXPLICIT; model→marka türetimi (auto-10) otoritede KALDI ve çift koşulla (çağrılabilir otorite + ürün kaydının CATALOG_ENRICHED provenance'ı) correctly_suppressed sayılır — provenance uyuşmazsa hâlâ yakalanır. Sonuç: **wrongly_repeated=0 · high_risk=0 · authority_suppressed=0**, correctly 53→57; mutasyon kanıtı (alias yükseltmesi kapatılınca 2 geri geldi) |
| LG-46k | Davranış bataryası | GREEN | nonvalue(ANY)/freshness/user-choice/edit-parity(Maira↔standart)/maira-contract/inference-confirmation/scheduler hepsi yeşil |
| LG-47k | Pro dilimi: KNOWN-OPEN 9 sertifika kaydı (ÜRÜN) | FIXED | `understand-request` brandEvidence kaydı artık belgelediği statüyü merdivende taşıyor (VERIFIED_CATALOG→PRODUCT_IDENTITY/VERIFIED; USER_ASSERTED→USER_EXPLICIT). Delta TAM olarak 7aa6990'ın adlı 9 kümesi: **BRAND_ROUTABLE_TRUSTED 7→15/108** (mach-07 envelope'sız → doğru şekilde dışarıda). readiness-brand 0 ihlal + RED-2/G3 mutasyon çapaları yeni dağılıma taşındı (kanıt gücü korunarak) |
| LG-48k | İmza tabanları (delta'lı) | REBASED | publish-inference INFERRED evreni 85→76 (çıkan 9 adlı satır) YEŞİL; snapshot-internal-evidence yeni USER_EXPLICIT_BRAND_EVIDENCE sınıfıyla YEŞİL. projection-authority (tarihsel) 15 imza kayması genişledi — kendi dilimi |
| LG-49k | Canlı değer kanıtı | VERIFIED | Gerçek acceptance DB'de "AC1K iPhone 15 Pro" talebi kanonik yayın yolundan geçti; satırın `discoveryProjection.attributes.brand="Apple"` — güvenilir marka gerçek kayda akıyor; kayıt kesin kimlikle temizlendi |
| LG-50k | Pro %41 düzeltmesi (ölçüm dürüstlüğü) | CORRECTED | Wave J'de 5. bileşeni yanlış atadım: resmî 5. bileşen "tedarikçi yeteneği"dir, "canlı bildirim teslimatı" formül DIŞI bağlamdı. %41 GERİ ÇEKİLDİ. Güncel resmî hesap: `100×((104/108)+(15/108)+0+0+0)/5 = 22.04` ≈ **%22** (7→15 güvenilir marka bu dalganın gerçek kazancı) |

## Wave J kaydı (2026-08-31 — COMMIT EDİLMEDİ)

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-37j | Canlı Alarm E2E | VERIFIED (uçtan uca) | Kural `AC1J` gerçek API ile kuruldu (kategori+şehir+ilçe+bütçe+keyword+df zarfı DB'de doğrulandı); eşleşen yayın → yayın-anında TAM 1 bildirim; tıklama → doğru `/panel/talepler/<id>`; Opportunity Center AYNI talebi AYNI kuralla listeledi ("Takiplerim kriterlerinizle eşleşen"); replay dedupe (1→0); pasif→0, yeniden aktif→1, kriter düzenleme uygulanıyor (espresso→0), silme→0+satır yok; kendi talebi tetiklemiyor; STANDARD kullanıcı plan kapısında temiz 403. Negatifler 5/5 sıfır: yanlış kategori/şehir, bütçe-dışı, null bütçe (wildcard DEĞİL), eksik keyword. Tüm AC1J kayıtları kesin id ile temizlendi (11 talep, 14 bildirim, kural 0) |
| LG-38j | ÜRÜN KUSURU: alarm teslimi fanout'a bağlıydı | FIXED | Sıfır firma eşleşmesi erken dönüşü `deliverAlertRuleNotifications`tan ÖNCE çıkıyordu — alarmlar tam da fanout'un boş kaldığı durumda hiç teslim edilmiyordu (canlıda yakalandı). Teslim zero-match yoluna da kondu (non-blocking, kendi dedupe'u). Test-first: unified kapıya kural 17 (kırmızı→44/0); canlı POZ5 yayın-anı 1 bildirim |
| LG-39j | ÜRÜN KUSURU: konum eşleşmesi | FIXED (kanonik, migration'sız) | (a) Composer talepleri `city="İl / İlçe"` + district=null sakladığından ilçeli alarm HİÇ eşleşmiyordu; (b) contains, ad-içinde-ad yanlış pozitifi ("Van"⊂"Şirvan") üretiyordu. TEK yardımcı (`locationMatches`) kanonik parça kuralına geçti: "/" bölme (mevcut konvansiyon; adanmış kolon yetkili) + Türkçe fold'lu TAM parça eşitliği. Test-first 8 vaka (4 kırmızı→43/0); saved-search kapısı yeşil kaldı. LOCATION_CANONICALIZATION_REQUIRED blocker'ına GEREK KALMADI |
| LG-40j | Davranışsal kırmızı: global-product-identity | FIXED | Kök: "ürün ifadesi marka olamaz" koruması, solutionType'tan gelen tam ÜRÜN ADINI ("Samsung Galaxy S24 Ultra 256GB") tip-ifadesi sanıp katalog-doğrulamalı markayı siliyordu. Eksen: ifade kanonik marka taşıyorsa AD'dır, koruma atlanır (tek kimlik motoru `identity-builder`; karar kanonik `extractBrandFromText`ten). Kapı YEŞİL; bonus: tarihsel `external-price-intelligence` de yeşile döndü |
| LG-41j | KB-17 / question-suppression ölçümü | MEASURED, NOT CLOSED | Güncel: `wrongly_repeated=0` (cevaplanan soru TEKRAR SORULMUYOR — çekirdek güvence sağlam), `correctly_suppressed=53`, `high_risk_silent_suppression=1` (tarihsel 45→1), `authority_suppressed=3`, `not_measured=4`. Kapanış kapısı (D2) bilinçli NOT_MEASURED; kalan 1+3 vaka kendi beyin dilimi — boyanmadı |

## Pro yetenek tablosu (Wave J sonrası — ölçülü)

| Yetenek | Durum | Kanıt |
|---|---|---|
| Alarm/Uyarı (kural→eşleşme→bildirim→detay) | **TAMAM (canlı)** | LG-37j/38j/39j |
| Saved search / Takiplerim sözleşmesi | TAMAM (kapı) | unified 44/0 |
| Opportunity Center eşleşme tutarlılığı | TAMAM (canlı, aynı kural) | LG-37j |
| Teklif asistanı (tek çekirdek) | KISMİ (LOCKED-until-LIVE) | LG-15/offer-draft-lock 10/0 |
| Fırsat routing (108 corpus bileşeni) | EKSİK (0/108) | 11-DECISION-LOG formülü |
| Matching resolvedEntities okuması | EKSİK (0) | aynı formül |

**Pro hazırlık yeniden hesabı (aynı resmî formül, `7aa6990` tabanı):**
`100 × ((104/108) + (7/108) + (0/108) + 0 + 1) / 5` = **%40,6 ≈ %41**.
Değişen TEK bileşen 5.si: "canlı bildirim teslimatı" önceden ÖLÇÜLMEMİŞ
(0) idi; Wave J bunu uçtan uca canlı kanıtladı (=1). 1-2. bileşenler
ölçülü sabit, 3-4 hâlâ 0 — sayı şişirilmedi, yalnız gerçekten kapanan
bileşen sayıldı.

## Wave I kaydı (2026-08-31 — COMMIT EDİLMEDİ)

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-29i | Bildirimler uçtan uca | VERIFIED (canlı) | Gerçek akış bildirimleri (yayın/teklif/mesaj/DEAL_COMPLETED) doğru kullanıcıda; sayaç↔liste paritesi (4=4, DB unread=4); tek okundu: tıklama → doğru gerçek detay + sayaç 3; tümü okundu → 0; duplicate YOK (tekrar-kabul/tekrar-onay tek satır — DB per-type 1/1/1); yabancı bildirim: sayfa sızıntısız 404, yazım 0 satır, 200-varlık-sızdırmaz İMZALI belgeli tasarım; mobil 390 taşmasız; tür etiketleri ayrık |
| LG-30i | verify-notifications drift | VERIFIER REPAIRED | "render'da mark-read" beklentisi KB-22 Dilim 1 kararıyla tarihe karıştı; kapı üç bacaklı güncel sözleşmeyi ölçüyor (sayfa yazmaz + istemci başarı-koşullu yönlendirir + POST tek yetkili sahiplikli). 51/0 |
| LG-31i | Gelen teklif kartı canlı | VERIFIED (canlı) | AC1I fixture'ı kanonik akışlarla üretildi: request `cmth7kzea0002fcuylzgfuhsc`, offer C `cmth7lmf00004fcuy5ukn3qa2` (pazarlık ₺16.000, tur BUYER), offer B `cmth7m8b50007fcuy8kro6t9n` (reddedildi). Liste: filtre sayaçları (Tümü 3/Okunmadı 1/Yeni 1/Pazarlıkta 1/Sonuçlananlar 2), gerçek aralık ₺16.000–₺21.000, "2 teklif · 1 yeni", durum=pazarlik filtresi sonucu değiştiriyor; kart: pazarlık masası (sıra satıcıda, %11, 2 hareket·1 tur); CTA'lar doğru detaya; id sızıntısı yok; 1440/1024/390 taşmasız. Kayıtlar sentetik DB'de kanıt olarak duruyor |
| LG-32i | incoming-offer-card + offer-decision-footer driftleri | VERIFIER REPAIRED | Sabit `layout="footer"` beklentisi; ürün bağlam ayrımına evrilmiş (decisionDesk→compact, liste→footer; tabanda da aynı). İki kapı kesin ifadeye bağlandı: 41/41 ve 95/95 |
| LG-33i | unified-preference-criteria driftleri | VERIFIER REPAIRED | (a) dedupe: actionUrl artık kullanıcıya özel İMZALI token taşıdığı için bilinçli olarak user+request+alarm-adı üçlüsü — kapı gerçek koruyucuyu ölçüyor; (b) tıklama: KB-22 sanitized-destination sözleşmesi. Kapı GEÇTİ |
| LG-34i | phase2 worktree kırılganlığı | VERIFIER REPAIRED | `.git/HEAD`i dosya okuyan no-op prob worktree'de çöküyordu; niyet ("script migration koşmaz") artık script içeriğinden doğrudan ölçülüyor |
| LG-35i | Marka pozitif/dışlama EKSEN düzeltmesi (ÜRÜN) | FIXED | Gerçek kusur (15b): "LG olsun ama Samsung olmasın"da pozitif LG düşüyordu — teklik kuralı dışlanan markayı da sayıyordu. Eksen: teklik dışlananlar çıkarıldıktan sonra ölçülür (`constraint-semantics.ts`). phase2 56/0; TAM batarya: matrix 6069/0, invariants 124/0, coverage/common/field/nonvalue/knowledge/maira/controls/parity/user-choice yeşil, TSC 0 |
| LG-36i | Alarm eski risklerinin güncel durumu | RE-VERIFIED | Matcher ayrışması KAPALI (tek `evaluatePreferenceCriteria`); null-budget bypass KAPALI (eksik bütçe wildcard değil — belgeli); leaf yazımı kapıda; keyword tek yardımcıda (substring semantiği BİLİNÇLİ ortak — kalite iyileştirmesi ayrı aday); city/district hâlâ serbest-metin contains ama TEK yardımcıda + canonical location zarfı backfill'li (derin kanonikleştirme açık kalem); discoveryFilter zarfı kapıda |

Tarihsel kırmızı güncel sayımı: 22 → **17** (notifications,
incoming-offer-card, offer-decision-footer, unified-preference-criteria,
phase2-constraint-preference kapandı).

## Wave H kaydı (2026-08-31 — COMMIT EDİLMEDİ)

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-25h | FD-7 → **RESOLVED_BY_FIXTURE** | FIXED | `verify-auth-fix` kişisel-hesap probu, `resolveSessionUser` SÖZLEŞME kapısına yeniden yazıldı: sentetik QA kimliği (turda kurulur + kesin id'lerle TAMAMEN temizlenir), id→e-posta düşüşü, veri bağlantısı (eski "≥3/≥1" → tam "=3/=1"e SIKILAŞTIRILDI), bilinmeyen kimlikte fallback+dbUnavailable sözleşmesi. Canlı 5/0; env'siz dürüst NOT-MEASURED. Emeklilik gerekmedi — güvence benzersizdi |
| LG-26h | Pinned-ID (outgoing-offer-inbox) | FIXED | Eski sabit offer id (`cmsyipshk…`) kaldırıldı; fixture turda kanonik yollarla üretiliyor (createRequest + harness kalıbı cookie'siz teklif [acceptance-core-commerce emsali] + proposeOfferNegotiation/rejectPendingNegotiation), HER İKİ dal deterministik ölçülüyor (Pazarlıkta/aksiyonlu/rozet=1 → çözülünce değil/değil/0), kesin id temizliği; yazma kapısı KB-9/FD-5 + NOT-MEASURED. Canlı **62/0**, env'siz 56/0 |
| LG-27h | PanelShell "collapsed dot" drift | VERIFIER REPAIRED | Kaynak otorite: onaylı Signal PanelShell (temiz tabanda da aynı) — daraltılmış rozet DAVRANIŞI yerinde (hasBadge && collapsed → h-2 w-2 rounded-full inline dot; açıkta sayısal rozet), yalnız eski `talepo-plan-dot` sınıf adı tarihe karışmış. Kapı gerçek sözleşmeyi ölçüyor; ürün DEĞİŞTİRİLMEDİ |
| LG-28h | FD-2 dilimi: corporate-workspace-isolation | FIXED | Tabanda da aynı 2 fail (tarihsel ✓). Kök: kapı KALDIRILMIŞ ürün kararını bekliyordu — ürün evrildi: workspace planı TEK yetkiliden (`resolveWorkspaceEffectivePlan`), tek istisna belgeli owner-inheritance (membership-rules 3/6); izolasyon özü kural 2/5. Kapı güncel değişmezlere onarıldı (tek yetkili + üye-planı MAX'i yok + resolver salt-okunur); **26/0** + mutasyon kanıtı (yasak yazma izi → 25/1) |

Tarihsel kırmızı güncel sayımı: 24 → **22** (outgoing-offer-inbox,
corporate-workspace-isolation kapandı); +1 davranışsal
(global-product-identity) + KB-17'ye bağlı question-suppression ayrı.

## Wave G kaydı (2026-08-31 — DW-2 + LG-19; COMMIT EDİLMEDİ)

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-20g | DW-2 üreticileri | FIXED | 1-3 zaten kanonik servis sınırındaydı (create-request, offer-service submit/accept — yeniden kurulmadı); köprü alanları eklendi (categoryId + provinceCode, il YALNIZ `resolveProvinceTelemetry`dan). 4. üretici: `DEAL_COMPLETED` deal-outcome çift onay geçişine bağlandı (`justCompleted` — yarış korumalı, DB sonrası, tek sefer). DOMAIN_EVENT_MISSING GEREKMEDİ: gerçek domain geçişi mevcut |
| LG-20g-b | MI köprüsü | FIXED | `market-intelligence/bridge.ts`: ürün olayı → v1 warehouse olayı → sink; sözleşmesiz olay sessizce sayılmaz, retry duplicate üretmez (deterministik eventId + sink idempotency), köprü/sink hatası ürün akışını kırmaz, abonelik geri alınabilir. Kapı 35/0 + mutasyon kanıtı (kontrol atlatılınca H3 kırmızı). ÜRETİM KAYDI YAPILMADI — transport DW-3 |
| LG-20g-c | Canlı üretici kanıtı | VERIFIED | AC-1 anlaşması iki taraflı canlı tamamlandı (deal `cmtgzzy1x000o2cuy3vy6dau3` → COMPLETED/BOTH_CONFIRMED): sunucu logunda TAM 1 `DEAL_COMPLETED` (categoryId=appliances, provinceCode=TR-34, özne=dealOutcomeId); tekrar onay ikinci olay ÜRETMEDİ; alıcı tek onayı olay üretmedi (PENDING) |
| LG-21g | LG-19/1 request-publish | FIXED (canlı 18/0) | Neden: yalnız eksik persona (`e2e-alici-20260817184814@talepo.test`). Sentetik + işaretli olarak kanonik guard yoluyla kuruldu (id `cmth6al8g0000jsuy6njzxbau`, TLP-990098); kapının canlı yazma sözleşmesi + idempotent replay artık ölçülüyor: 18/0, 0 not-measured |
| LG-22g | LG-19/2 auth-fix | RECLASSIFIED | Sözleşme kapısı DEĞİL: kurucunun GERÇEK kişisel hesabının (≥3 talep + firma üyeliği) eski-DB anlık görüntüsünü bekleyen olay-bazlı debug probu. FD-6 gereği gerçek kimlik acceptance'ta kurulamaz; sahte veriyle yeşile boyanmadı. FD-7: emekliye ayır ya da sentetik sözleşme olarak yeniden yaz (kurucu kararı) |
| LG-23g | LG-19/3 outgoing-offer-inbox | DOCUMENTED | 55/2: (a) canlı yarım eski DB'den SABİTLENMİŞ offer id bekliyor (`cmsyipshk…`) — ölçülen nesneyi elle üretmek sahte fixture olur; kapı keşfedilebilir işaretli fixture'a yeniden bağlanmalı (kendi dilimi); (b) "collapsed uses dot" statik drift — PanelShell incelemesiyle kapanacak, aynı dilim |
| LG-24g | LG-19/4 question-suppression | CONFIRMED BLOCKED | Kapanış kapısı BİLİNÇLİ NOT_MEASURED çıkışıyla KB-17 production düzeltmesine bağlı (kapı içi belge: D2). Gerçek bağımlılık; saklanmadı, boyanmadı |

## Yeni FOUNDER_DECISION adayı

| ID | Karar | Sonuç |
|---|---|---|
| FD-7 | verify-auth-fix'in geleceği | **RESOLVED_BY_FIXTURE (Wave H)** — kurucu kararıyla sentetik sözleşme kapısına dönüştürüldü; kişisel kimlik kalmadı (LG-25h) |

## Wave F kaydı (2026-08-31 — FD-5/FD-6/DW-1 uygulandı)

| ID | İş | Durum | Kanıt |
|---|---|---|---|
| LG-16 | FD-5 host güvenlik kapısı | FIXED | `db-guard.ts` acceptance yolu KANONİK yetkililerden türer (`evaluateAcceptanceDbTarget` ref/host/verify-full + `loadAcceptanceCa` CA pin, fingerprint zorunlu); genel liste GEVŞETİLMEDİ, bilinmeyen/production fail-closed. Test-first: I15b (kırmızı 123/1 → yeşil), I15 eski kural korunuyor; invariants **124/0** (1 known_fail I25d). Sonuç: offer-inbox-scope tam YEŞİL; my-requests, profile-security zaten yeşildi; 4 kapı artık gerçekten ÖLÇÜYOR (aşağıda LG-19) |
| LG-17 | FD-6 pozitif admin+MFA canlı kanıtı | VERIFIED + GERİ ALINDI | Yeni QA-only hesap `acceptance-v1-qa-admin@talepo.test` (id `cmth2jumz0000y4uykegoot6k`), EN DAR rol SUPPORT, kanonik guard yoluyla oluşturuldu. Canlı: MFA'sız /admin 404 → gerçek TOTP kaydı (secret tarayıcı dışına çıkmadı, WebCrypto ile) → /admin ve /admin/health RENDER (hassas alanlar rol gereği kapalı) → revoke (role USER, MFA temiz, SUSPENDED) → /admin yeniden 404. Geçici araç silindi |
| LG-18 | DW-1 sink zinciri | FIXED | Ölçülen kusur: fırlatan sink her iki kanalda ürün akışını kırıyordu (yalıtım yok, sessiz kayıp). Teslim sink başına yalıtıldı + düşen teslim sayaçları eklendi (logger + product-events). Yeni kalıcı kapı `verify-log-sink-chain-v1` 10/0, mutasyon kontrolü kanıtlı (naif dispatch → 7/3). Üretim sink kaydı DÜRÜSTÇE raporlanır: YOK — DW-3 provision'a bağlı |
| LG-19 | FD-5 sonrası kalan 4 canlı yarım | DOCUMENTED | request-publish 15/1 ("live buyer" fixture kimliği yok), auth-fix (beklediği kullanıcı yok), outgoing-offer-inbox 55/2 (fixture + 1 statik drift), question-suppression (KB-17 production düzeltmesine bağlı kapanış kapısı). Fixture kimliklerinin seed-acceptance-fixtures'a eklenmesi AYRI dilim — harness sözleşmesine dokunur |

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
| FD-7 | tech-12 "logo tasarımı arıyorum" kanonik sahibi | **APPROVED-A + UYGULANDI (2026-08-31):** `tax:services:diger:diger-hizmetler:grafik-ve-logo-tasarimi` SERVICE_TYPE yaprağı eklendi (alias: "logo tasarımı", "grafik tasarım", "kurumsal kimlik tasarımı"; "logo" tek başına DEĞİL — Logo yazılım çakışması). Kalan teknik borç: subject.kind hâlâ PRODUCT (SUBJECT_EXTRACTION_GAP, ayrı dilim) |
| FD-8 | health-07 "şeker ölçüm cihazı için test çubuğu" | **APPROVED-A + UYGULANDI:** mevcut `tibbi-testler` yaprağına tam-ifade alias kürasyonu ("test çubuğu", "şeker ölçüm çubuğu", "glukometre test çubuğu"); yeni yaprak YOK, "test" tek başına DEĞİL. Follow-up (kurucu backlog): glukometre CİHAZ yaprağı `cihaz-gruplari`na eklenebilir |
| FD-9 | health-08 "baş ağrım için hangi ilacı almalıyım" | **APPROVED-A + UYGULANDI:** kurucu ürün politikası — kişiye özel tıbbi tavsiye sorusu marketplace talebi olarak yayınlanmaz. Mevcut kapsam otoritesi merkezî genişletildi: `RequestScope`a `UNSUPPORTED_MEDICAL_ADVICE`, tek yardımcı `isUnsupportedRequestScope` beş kapıyı kapatır (soru motoru/review-publish/sunucu şeması/resume/talep sayfası); eczacı-hekim yönlendirmeli nazik metin. Eksen soru biçimi+tıbbi bağlam; "ilaç" kelimesi tek başına engelleyemez (I52e korumaları). Follow-up (ayrı kurucu kararı): OTC/reçeteli ilaç ÜRÜN taleplerinin koşulları |
| FD-10 | home-06 "kürek sapı arıyorum" | **APPROVED-A + UYGULANDI:** İLK ÖNERİ ("home-kitchen/Bahçe el aletleri" yaprağı) taksonomi tam incelenmeden yapılmıştı; kurucu review sırasında machinery kanonik otoritesi bulundu (`tax:machinery:diger:el-aletleri-ve-hirdavat:saplar`, kurucu onayı 2026-08-23) ve YENİ YAPRAK ÖNERİSİ GERİ ÇEKİLDİ — mevcut otorite güçlendirildi: alias "kürek sapı", "alet sapı" ("sap" tek başına DEĞİL — SAP yazılım çakışması). Fixture sahipliği kurucu kararıyla `["machinery","null"]` yapıldı. Kanarya (home-06/brandCandidate) BİLİNÇLİ çözüldü: sahte "Kürek" adayı artık üretilmiyor, sabit gerileme bekçisine dönüştü |
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
