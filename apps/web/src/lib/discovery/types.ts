/**
 * Phase 3A — Request discovery projection (publish-time read model).
 * Not a second request authority — built from Single Brain + CanonicalRequestState.
 */

import type {
  ConstraintFilterContract,
  ConstraintMatchContract,
  ConstraintStrength,
} from "@/lib/request-understanding/constraint-semantics";
import type {
  InternalEvidenceSnapshot,
  RequestUnderstandingSnapshot,
} from "@/lib/request/understanding-snapshot";
import type { Authority } from "@/lib/request-understanding/provenance";
import type { FieldValueKind } from "@/lib/request-composer/types";

export const DISCOVERY_PROJECTION_VERSION = 1 as const;
export const DISCOVERY_FILTER_VERSION = 1 as const;

export type DiscoveryFieldMode = "VALUE" | "ANY" | "UNKNOWN";

export type DiscoveryFieldConstraint = {
  mode?: DiscoveryFieldMode;
  value?: string | null;
  include?: string[];
  preferred?: string[];
  excluded?: string[];
  strength?: ConstraintStrength;
  range?: { min?: number; max?: number; unit?: string };
};

/**
 * Otoritenin yazılabileceği İKİ YÜZEY. Yüzey ayrı tutulur çünkü bir alan
 * yalnız birinde var olabilir: değer taşımayan `mode:"ANY"` bir constraint
 * `attributes` torbasına HİÇ girmez.
 */
export type ProjectionAuthoritySurface = "attributes" | "constraints";

/**
 * BİR ALANIN OTORİTESİ — YÜZEY BAŞINA (D3c, 2026-08-27).
 *
 * Otorite tipi kanonik merdivenden OKUNUR (`request-understanding/provenance.ts`
 * → `Authority`: `UNKNOWN < INFERRED < VERIFIED < USER_EXPLICIT`). Burada yeni
 * bir enum, yeni bir rank tablosu ya da ikinci bir "doğrulanmış kaynak"
 * listesi TANIMLANMAZ.
 *
 * FACET BAŞINA OTORİTE ÜRETİLMEZ. Upstream (`CanonicalFieldState.provenance`)
 * provenance'ı ALAN seviyesinde taşır; `strength` / `preferred` / `excluded` /
 * `range` facet'lerinin kendi kaynağı YOKTUR. Her facet'e ayrı otorite yazmak
 * var olmayan bir ayrımı uydurmak olurdu.
 *
 * Yalnız GERÇEKTEN VAR OLAN yüzey yazılır: attribute değeri varsa
 * `attributes`, constraint kaydı varsa `constraints`. Var olmayan yüzey
 * `undefined` kalır ve okuma sınırında `UNKNOWN` olarak görünür.
 */
export type ProjectionFieldAuthority = {
  attributes?: Authority;
  constraints?: Authority;
};

/**
 * BİR ALANIN CEVAP DİSPOZİSYONU — DEĞER DEĞİL, CEVAP (D3f Dilim 2, 2026-08-27).
 *
 * Kullanıcının bilinçli "Bilmiyorum" / "Uygulanamaz" cevabının kalıcı bir
 * yüzeyi yoktu: `attributes`'a girmesi yanlış olurdu (ürün özelliği değildir),
 * `constraints`'e girmesi de yanlış olurdu (matching kısıtı değildir). Bu
 * yüzden sunucu güven sınırında damgalanabileceği bir iddia hiç oluşmuyor ve
 * kalıcı projection'da "kullanıcı bilmiyorum dedi" ile "hiç sorulmadı" aynı
 * kovada kalıyordu.
 *
 * TİP KANONİK KAYNAKLARDAN TÜRER. `kind` besteci merdiveninin
 * (`FieldValueKind`) değer taşımayan iki modudur; `authority` kanonik otorite
 * merdiveninin (`Authority`) tek geçerli seviyesidir. Burada YENİ bir enum,
 * yeni bir rank tablosu ya da yeni bir "doğrulanmış kaynak" listesi
 * TANIMLANMAZ — üstteki listeler değişirse bu tip derleme zamanında kırılır.
 *
 * `ANY` BU YÜZEYE GİRMEZ: onun kendi kanalı vardır (`constraints` →
 * `mode:"ANY"`) ve o kanal filtre sözleşmesini besler. Buraya taşımak çalışan
 * bir davranışı ikinci bir yere kopyalamak olurdu.
 *
 * `USER_EXPLICIT` TEK SEVİYEDİR çünkü bu yüzeye YALNIZ kullanıcının kendi
 * bilinçli seçimi yazılır. Çıkarım ya da katalog bir alanı "bilmiyorum" diye
 * cevaplayamaz; öyle bir kayıt üretilseydi Talepo'nun bilgisizliği kullanıcı
 * beyanı gibi görünürdü.
 */
export type ProjectionFieldResponse = {
  kind: Extract<FieldValueKind, "UNKNOWN" | "NOT_APPLICABLE">;
  authority: Extract<Authority, "USER_EXPLICIT">;
};

/**
 * BİR CEVABIN ONAY DAMGASI (D3f Dilim 3e, 2026-08-28).
 *
 * Tazelik otoriteden ayrı bir eksendir: kullanıcı bir cevabı gerçekten
 * vermiş olabilir ama o cevap bugün hâlâ onaylı olmayabilir. Bu kayıt
 * "kullanıcı BU CEVABI bu talep kaydında onayladı" bilgisini taşır.
 *
 * ANAHTAR VARLIĞI YETMEZ. Damga, onaylanan cevabın DETERMİNİSTİK İMZASINA
 * bağlanır; cevap sonradan değişirse eski damga kendiliğinden geçersiz olur.
 * Böylece bir alan için verilmiş eski bir onay, o alanın YENİ bir cevabını
 * taze gösteremez.
 *
 * HAM DEĞER SAKLANMAZ. İmza tek yönlü ve deterministiktir; kullanıcının
 * yazdığı metin (şehir, bütçe) bu metadata kanalına kopyalanmaz.
 */
export type ProjectionFieldConfirmation = {
  signature: string;
};

/**
 * Stabil seller-facing projection persisted on Request.
 * Source of truth remains understandRequest() / CanonicalRequestState at publish.
 */
export type RequestDiscoveryProjection = {
  version: typeof DISCOVERY_PROJECTION_VERSION;
  kind: "discovery_projection";
  /** Full ancestor chain + leaf (stable taxonomy IDs). */
  taxonomyNodeIds: string[];
  primaryLeafId: string | null;
  categoryId: string | null;
  subcategorySlug: string | null;
  /** Optional catalog/entity refs (automotive-heavy). */
  entityRefs?: Record<string, string>;
  /** Normalized attribute bag for filtering. */
  attributes: Record<string, string>;
  /**
   * İÇ KANIT (D3c-b) — additive ve OPSİYONEL. Yeni yazımda iç kanıt nested
   * `understanding.internalEvidence` içinde yaşar; kurucu
   * (`buildDiscoveryProjectionFromState`) bu alanı ÜRETMEZ. Alanı yalnız
   * OKUMA SINIRI (`parseDiscoveryProjection`) doldurur: D3c-b öncesi
   * kayıtların `attributes`/`constraints` içinde bıraktığı iç kanıt buraya
   * ayrılır ki değer kaybolmadan tipli kalsın. Create/update yolları parse
   * çıktısını persist ettiği için normalize edilmiş şekil (bu alan dahil)
   * legacy bir istemci payload'ında DB'ye YAZILABİLİR — bu bilinçli bir
   * write-through'dur, idempotenttir ve ikinci parse'ta değişmeden geçer.
   * Filtre/facts okuyucuları bu alanı kullanıcı beyanı gibi OKUYAMAZ.
   */
  internalEvidence?: Record<string, InternalEvidenceSnapshot>;
  /** Field-scoped constraint semantics (Phase 2). */
  constraints: Record<string, DiscoveryFieldConstraint>;
  /**
   * DEĞERİN KAYNAĞI (D3c) — additive ve OPSİYONEL.
   *
   * `attributes` ve `constraints` torbaları çıplak değer taşır; bir değerin
   * kullanıcının kendi beyanı mı, çağrılabilir bir katalog otoritesinin
   * doğruladığı bilgi mi, yoksa Talepo'nun kendi tahmini mi olduğu bu
   * torbalarda görünmezdi ve sonraki katmanlarda kaybolurdu. Bu harita o
   * bilgiyi PARALEL ve tipli olarak taşır; mevcut değerlerin hiçbirine
   * dokunmaz, hiçbir anahtarı ya da sırayı değiştirmez.
   *
   * GERİYE UYUMLU: alan yoksa eski kayıt geçerli kalır ve HER kimlik
   * `UNKNOWN` okunur (`projectionAuthorityOf`). Eksik metadata hiçbir koşulda
   * `USER_EXPLICIT` ya da `VERIFIED` sayılamaz — o iki seviye firmalara
   * yönlendirme sinyalidir ve uydurulamaz. `discoveryProjection` bir JSON
   * kolonudur; migration GEREKMEZ.
   *
   * İÇ KANIT GİREMEZ: `brandCandidate` / `brandEvidence` generic torbalara
   * girmediği için bu haritada da yerleri yoktur.
   *
   * BU BİR YETKİ/İZİN KANITI DEĞİLDİR. Harita AÇIKLAYICI provenance
   * metadata'sıdır ve istemciden gelen bir payload'da da bulunabilir; update
   * yolunun sunucu doğrulaması yapılmadan güvenlik kararı, yetki kontrolü ya
   * da "bu değeri kullanıcı gerçekten söyledi" ispatı olarak KULLANILAMAZ.
   */
  fieldAuthority?: Record<string, ProjectionFieldAuthority>;
  /**
   * AÇIK "BİLMİYORUM" / "UYGULANAMAZ" CEVAPLARI (D3f Dilim 2) — additive ve
   * OPSİYONEL. Alanı olmayan eski kayıtlar aynen geçerlidir; `discoveryProjection`
   * bir JSON kolonudur, migration GEREKMEZ.
   *
   * Bu yüzey MATCHING KISITI DEĞİLDİR ve bu dilimde routing, filtreleme,
   * Matching V3 ya da skorlama kararına BAĞLANMAMIŞTIR. Yalnız "kullanıcı bu
   * soruyu bilinçli olarak değer vermeden kapattı" bilgisini taşır; firmaya
   * dönük bir ürün özelliği üretmez.
   *
   * Yalnız `isDeliberateNonValueAnswer` true olan kayıtlar girer. Varsayılan /
   * çıkarımdan gelen `UNKNOWN` — 108 senaryoluk kapsam tabanında 988 alan —
   * buraya TEK BİR kayıt bile yazmaz.
   *
   * SUNUCU GÜVEN SINIRI `fieldAuthority` ile AYNIDIR: istemcinin gönderdiği
   * kopya tamamen atılır ve yalnız sunucunun doğrulanmış cevap kanalından
   * (`fields[]` → kanonik `mode`) yeniden türetilir.
   */
  fieldResponses?: Record<string, ProjectionFieldResponse>;
  /**
   * CEVAP ONAY DAMGALARI (D3f Dilim 3e) — additive ve OPSİYONEL. Alanı
   * olmayan eski kayıtlar geçerlidir; `discoveryProjection` bir JSON
   * kolonudur, migration GEREKMEZ.
   *
   * `fieldAuthority` / `fieldResponses` ile AYNI güven modeli: istemcinin
   * gönderdiği kopya tamamen atılır ve yalnız sunucunun doğruladığı cevap
   * kanalından yeniden türetilir. Clone bu alanı DÜŞÜRÜR — kopyalamak, hiç
   * verilmemiş bir onayı üretmek olurdu.
   */
  fieldConfirmations?: Record<string, ProjectionFieldConfirmation>;
  /** Reuse Phase 2 match contract shape. */
  matchContract: ConstraintMatchContract;
  /** Reuse Phase 2 filter contract shape. */
  filterContract: ConstraintFilterContract;
  builtAt: string;
  /**
   * Phase 1 — publish-time understanding audit snapshot.
   * Optional; matching/filter evaluators must ignore this block.
   */
  understanding?: RequestUnderstandingSnapshot;
};

/**
 * Typed filter for SavedSearch / Alert / Explore (versioned).
 * Legacy flat fields remain for backward compatibility.
 */
export type CanonicalDiscoveryFilter = {
  version: typeof DISCOVERY_FILTER_VERSION;
  kind: "canonical_discovery_filter";
  /** Match requests whose path includes this node (ancestor semantics). */
  taxonomyNodeIds?: string[];
  /** Exact leaf only — siblings excluded. */
  primaryLeafId?: string | null;
  leafExact?: boolean;
  entityRefs?: Record<string, string>;
  attributes?: Record<string, string>;
  /** From toConstraintFilterContract — preferred is NOT hard reject. */
  constraints?: ConstraintFilterContract;
  /** Hard includes from MUST / allowed sets. */
  mustIncludes?: Record<string, string[]>;
  excluded?: Record<string, string[]>;
  preferred?: Record<string, string[]>;
  ranges?: Record<string, { min?: number; max?: number; unit?: string }>;
  location?: { city?: string; district?: string };
  urgency?: boolean;
};

export type DiscoveryMatchPath = "CANONICAL_MATCH" | "LEGACY_FALLBACK";

export type DiscoveryMatchResult = {
  match: boolean;
  path: DiscoveryMatchPath;
  reasons: string[];
};
