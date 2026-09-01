/**
 * İÇ KANIT KİMLİKLERİ — DONDURULMUŞ TABAN V1 (D3c-b, 2026-08-27).
 *
 * BU DOSYA BAĞIMSIZ VERİ OTORİTESİDİR. İçerik, HEAD `77648d2` üzerinde 108
 * senaryoluk kapsama tabanının üretim kurucularıyla (syncFromText →
 * buildPublishUnderstandingSnapshot → buildDiscoveryProjectionFromState →
 * buildRequestRoutingEnvelope) iki deterministik koşuda BİR KEZ ölçülüp ELLE
 * donduruldu. Üretim kodundan çalışma anında türetilmez, otomatik
 * güncellenmez; doğrulayıcı bu dosyada import olmadığını ayrıca denetler.
 *
 * SINIFLANDIRMA kanonik cevap otoritesinden okunur (`classifyAnswerAuthority`,
 * state.fields üzerinden); burada ikinci bir merdiven kurulmaz. Anlama
 * katmanı provenance'ı 36 kimliğin tamamında `INFERRED`dir; 7 otomotiv
 * kimliği kaynak `FUTURE_KNOWLEDGE` (katalog doğrulaması) üzerinden kanonik
 * merdivende `VERIFIED` sınıfına çıkar.
 *
 * ÖLÇÜM YÜZEYİ NOTU (home-06/brandCandidate). NOT_MEASURED bir kimliğin
 * değil, (kimlik × ölçüm yüzeyi) çiftinin statüsüdür ve iki evren burada
 * birbirine karıştırılmaz:
 *   - D1 kategori/soru ölçümünde home-06 `category_unresolved → NOT_MEASURED`
 *     statüsündedir ve ÖYLE KALIR; o evrenin fixture'ına ve tarihsel
 *     beklentisine bu dosya dokunmaz.
 *   - Bu dosyanın evreni D3c-b SERİLEŞTİRME yüzeyidir: aynı kimlik burada iki
 *     ardışık koşuda deterministik ölçülür (değer "Kürek", INFERRED, güven
 *     0.3) ve yapısal olarak home-04 ("Toptan") / home-07 ("Çelik") ile
 *     aynıdır; bu yüzden ölçülen tabanın İÇİNDEDİR.
 * Kimlik ayrıca sahte marka adayı kanaryası olarak adlandırılır: "Kürek" bir
 * ürün kelimesidir, marka değildir — anlama katmanı bunu bir gün
 * düzelttiğinde bu taban KIRMIZI olur ve fark karar gerekçesiyle buradan
 * düşülür; sessizce kaybolamaz.
 *
 * SIRALAMA SÖZLEŞMESİ: listeler kod-birimi sırasında ve benzersizdir;
 * sınıflar ayrıktır; doğrulayıcı bunları da denetler.
 */

/**
 * Kanonik merdivende INFERRED kalan marka adayları (19 kimlik).
 *
 * Wave L (2026-08-31): home-06/brandCandidate BİLİNÇLİ olarak düştü —
 * kanaryanın beklediği düzeltme gerçekleşti: FD-10 kürasyonu
 * (machinery/saplar alias) + yüzey-kimliği düzeltmesiyle "Kürek" artık
 * marka adayı ÜRETİLMİYOR (brandCandidate=null), ürün türü "Kürek sapı"
 * EXPLICIT_TEXT olarak doğru kanalda. Aşağıdaki kanarya sabiti artık
 * ÇÖZÜLMÜŞ-GERİLEME-BEKÇİSİ anlamındadır: kimlik ölçülen evrene GERİ
 * DÖNERSE kapı kırmızı olur.
 */
export const BASELINE_INFERRED_BRAND_CANDIDATES: readonly string[] = [
  "auto-05/brandCandidate",
  "auto-09/brandCandidate",
  "auto-11/brandCandidate",
  "furn-03/brandCandidate",
  "furn-08/brandCandidate",
  "home-04/brandCandidate",
  "home-07/brandCandidate",
  "print-04/brandCandidate",
  "print-12/brandCandidate",
  "re-01/brandCandidate",
  "re-05/brandCandidate",
  "re-11/brandCandidate",
  "re-12/brandCandidate",
  "svc-05/brandCandidate",
  "svc-06/brandCandidate",
  "svc-07/brandCandidate",
  "tech-05/brandCandidate",
  "tech-06/brandCandidate",
];

/**
 * Kanonik merdivende INFERRED kalan marka kanıt durumları.
 *
 * Wave K (2026-08-31): 7aa6990'da adlarıyla dondurulan KNOWN-OPEN 9 kayıt,
 * ürün kodundaki sertifika-merdiveni düzeltmesiyle (understand-request
 * brandEvidence kaydı artık belgelediği statüyü taşıyor) bu sınıftan
 * çıktı — 8'i VERIFIED'a, mach-07 (USER_ASSERTED) USER_EXPLICIT'e.
 * Delta satır satır sayıldı ve tam olarak o dondurulmuş kümedir.
 */
export const BASELINE_INFERRED_BRAND_EVIDENCE: readonly string[] = [];

/**
 * Kanonik merdivende VERIFIED sınıfına çıkan marka kanıt durumları
 * (7 otomotiv katalog doğrulaması + Wave K'de merdiveni düzeltilen 8
 * VERIFIED_CATALOG kaydı).
 */
export const BASELINE_VERIFIED_BRAND_EVIDENCE: readonly string[] = [
  "appl-04/brandEvidence",
  "appl-06/brandEvidence",
  "appl-07/brandEvidence",
  "auto-01/brandEvidence",
  "auto-02/brandEvidence",
  "auto-03/brandEvidence",
  "auto-04/brandEvidence",
  "auto-07/brandEvidence",
  "auto-08/brandEvidence",
  "auto-10/brandEvidence",
  "mach-03/brandEvidence",
  "print-07/brandEvidence",
  "tech-02/brandEvidence",
  "tech-03/brandEvidence",
  "tech-10/brandEvidence",
];

/**
 * Kullanıcının "X marka" beyanıyla (USER_ASSERTED) belgelenen kanıt —
 * merdivende USER_EXPLICIT (Wave K).
 */
export const BASELINE_USER_EXPLICIT_BRAND_EVIDENCE: readonly string[] = [
  "mach-07/brandEvidence",
];

/**
 * Sahte marka adayı KANARYASI — D3c-b serileştirme yüzeyinde ölçülen kimlik
 * (yukarıdaki yüzey notuna bak; D1'deki NOT_MEASURED statüsü değişmez).
 * Ölçülen tabanın İÇİNDEDİR; ayrı ad, gelecekteki anlama düzeltmesinin
 * buradan bilinçli bir kararla geçmesi içindir.
 */
export const FALSE_BRAND_CANDIDATE_CANARY = "home-06/brandCandidate" as const;

/**
 * ESKİ ŞEKİL ÖRNEĞİ — D3c-b öncesi yazılmış bir understanding snapshot'ı:
 * iç kanıt anahtarları kullanıcı attribute'ları arasında duruyor ve
 * `internalEvidence` alanı yok. Routing envelope bu şekli kabul etmeli,
 * iç kanıtı tipli kanala AYIRMALI ve genel attributes torbasında
 * BIRAKMAMALI; `color` gibi gerçek kullanıcı attribute'u torbada kalmalı.
 */
export const LEGACY_SNAPSHOT_SAMPLE = {
  version: 1,
  kind: "understanding_snapshot",
  profileVersion: "understand-request/v1",
  builtAt: "2026-08-20T00:00:00.000Z",
  rawInputRef: "request.rawInput",
  categoryResolution: {
    status: "resolved",
    userSelected: false,
    userChoice: null,
    primary: { slug: "technology", confidence: 0.82, source: "ai" },
    candidates: [{ slug: "technology", confidence: 0.82, source: "ai" }],
  },
  entities: { brand: { value: "Arçelik", confidence: 0.7 } },
  attributes: {
    color: { value: "Siyah", confidence: 0.9 },
    brandCandidate: { value: "WordPress", confidence: 0.3 },
    brandEvidence: { value: "CANDIDATE", confidence: 0.3 },
  },
  unresolvedExpressions: [],
  confirmedFieldKeys: [],
} as const;

/** Eski şekil projection — iç kanıt anahtarları attributes/constraints içinde. */
export const LEGACY_PROJECTION_SAMPLE = {
  version: 1,
  kind: "discovery_projection",
  taxonomyNodeIds: ["tax:technology"],
  primaryLeafId: null,
  categoryId: "technology",
  subcategorySlug: null,
  attributes: {
    color: "Siyah",
    brandCandidate: "WordPress",
    brandEvidence: "CANDIDATE",
  },
  constraints: {
    brandCandidate: { mode: "VALUE", value: "WordPress" },
    color: { mode: "VALUE", value: "Siyah" },
  },
  matchContract: { must: {}, mustNot: {}, preferred: {} },
  filterContract: { exclude: {}, preferred: {}, any: [], range: {} },
  builtAt: "2026-08-20T00:00:00.000Z",
} as const;
