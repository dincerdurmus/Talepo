/**
 * PROJECTION OTORİTESİNİN SUNUCU GÜVEN SINIRI — D3d (2026-08-27).
 *
 * SORUN. `discoveryProjection` istemciden gelir ve `fieldAuthority` haritası
 * bugüne kadar bu sınırdan DEĞİŞMEDEN geçiyordu: istemcinin kendi payload'ına
 * yazdığı `"VERIFIED"` doğrudan veritabanına giriyor, oradan okuyan herkese
 * sunucunun doğruladığı bilgi gibi görünüyordu. Ölçüldü (salt-okunur prob,
 * 2026-08-27): metinde hiç geçmeyen bir `condition` için gönderilen
 * `VERIFIED` de, çıkarımdan gelen bir değere vurulan `USER_EXPLICIT` de,
 * hiç var olmayan bir alan anahtarı da aynen kabul ediliyordu.
 *
 * KARAR. İSTEMCİNİN GÖNDERDİĞİ `fieldAuthority` TAMAMEN YOK SAYILIR. Hiçbir
 * seviye doğrudan kabul edilmez, hiçbir seviye istemci etiketine bakılarak
 * korunmaz. Otorite bu sınırda SIFIRDAN, yalnız sunucunun sahip olduğu iki
 * girdiden yeniden türetilir:
 *
 *   1. `rawInput` — sunucunun kalıcılaştırdığı kullanıcı metni. Üretim anlama
 *      beyni (`createTextOnlyState` → `buildDiscoveryProjectionFromState`)
 *      bu metin üzerinde YENİDEN çalıştırılır. `USER_EXPLICIT` (metinde açık
 *      ifade), `VERIFIED` (katalog/kanonik çözüm) ve `INFERRED` (Talepo'nun
 *      kendi tahmini) bu koşumdan gelir.
 *   2. `answers` — sunucunun `RequestFieldValue` olarak kalıcılaştırdığı,
 *      süzülmüş kullanıcı cevap kanalı (`fields[]`). Bu kanal bir KULLANICI
 *      BEYANIDIR; oraya yazılan değer talebin cevabı olarak saklanır ve
 *      firmalara öyle gösterilir.
 *
 * Sunucu bir alanı yeniden türetemiyorsa `UNKNOWN` kullanır ve ASLA yukarı
 * yükseltmez. İstek REDDEDİLMEZ: sahte etiket yayını engellemez, yalnız
 * güvenilirliğini kaybeder — bu bir kullanıcı hatası değil istemci artefaktı
 * olabilir ve talebin kaybolması yanlış etiketten daha pahalıdır.
 *
 * DEĞERE DOKUNULMAZ. `attributes` ve `constraints` torbaları AYNEN korunur;
 * bu modül yalnız `fieldAuthority` alanını yeniden yazar. Matching, filtreleme,
 * routing ve skor davranışı bu yüzden değişmez.
 *
 * YENİ MERDİVEN YOK. Seviye tipi ve sırası kanonik kaynaktan okunur
 * (`request-understanding/provenance.ts` → `Authority`); burada ikinci bir
 * enum, ikinci bir rank tablosu ya da ikinci bir "doğrulanmış kaynak" listesi
 * TANIMLANMAZ. Türetim, projection'ı üretimde kuran fonksiyonun ta kendisiyle
 * yapılır — otorite mantığı ikinci kez yazılmaz.
 *
 * NE ÖLÇMEZ. `rawInput` kullanıcının BÜTÜN browse/manuel seçimlerini taşımaz.
 * Metinde karşılığı olmayan ve süzülmüş cevap kanalında da bulunmayan bir
 * seçim (örneğin değer taşımayan bir "fark etmez" tercihi) burada `UNKNOWN`
 * kalır. Bu bilinçli fail-closed sonuçtur: türetilemeyen bir seviyeyi
 * uydurmaktansa bilinmez bırakmak tercih edilir.
 *
 * NEDEN BU MODÜLDE. Üç yazma yolunun (create / update / clone) PROJECTION
 * KARARI da burada durur. Kararlar route dosyalarının içinde kalsaydı
 * ölçülebilmeleri için Prisma bağlı modüllerin import edilmesi gerekirdi ve
 * "veritabanı yazmadan doğrula" şartı ilk import'ta kırılırdı. Girdiler
 * YAPISAL alınır (`{ key, value }`), böylece bu modül sunucu katmanının
 * tiplerini içeri almaz.
 */

import { createTextOnlyState } from "@/lib/request-composer";
import type { Authority } from "@/lib/request-understanding/provenance";

import { buildDiscoveryProjectionFromState } from "./build-projection";
import type {
  ProjectionAuthoritySurface,
  ProjectionFieldAuthority,
  RequestDiscoveryProjection,
} from "./types";
import {
  isProjectionAuthorityKeyAllowed,
  parseDiscoveryProjection,
} from "./validate-filter";

/** Bir alanın `attributes` yüzeyindeki değeri (yoksa null). */
function attributeValueOf(
  projection: RequestDiscoveryProjection | null | undefined,
  key: string,
): string | null {
  const raw: unknown = projection?.attributes?.[key];
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value || null;
}

/**
 * Bir alanın `constraints` yüzeyindeki İDDİA İMZASI (yoksa null).
 *
 * İmzaya YALNIZ `mode` ve `value` girer. `preferred` / `include` / `excluded`
 * / `range` birer FACET'tir ve D3c'de yazıldığı gibi kendi kaynakları YOKTUR;
 * provenance alan seviyesinde taşınır. Facet'leri imzaya katmak, kaynağı
 * olmayan bir ayrımı otorite kararına sokardı.
 */
function constraintSignatureOf(
  projection: RequestDiscoveryProjection | null | undefined,
  key: string,
): string | null {
  const raw: unknown = projection?.constraints?.[key];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const constraint = raw as { mode?: unknown; value?: unknown };
  const mode = typeof constraint.mode === "string" ? constraint.mode : "";
  const value = constraint.value == null ? "" : String(constraint.value).trim();
  return `${mode}|${value}`;
}

/** Yüzeyin o projection'daki iddia imzası — null ise o yüzey hiç yoktur. */
function surfaceSignature(
  projection: RequestDiscoveryProjection | null | undefined,
  key: string,
  surface: ProjectionAuthoritySurface,
): string | null {
  return surface === "attributes"
    ? attributeValueOf(projection, key)
    : constraintSignatureOf(projection, key);
}

/** Sunucunun kendi koşumundaki otorite (yoksa undefined). */
function derivedAuthority(
  serverProjection: RequestDiscoveryProjection | null,
  key: string,
  surface: ProjectionAuthoritySurface,
): Authority | undefined {
  return serverProjection?.fieldAuthority?.[key]?.[surface];
}

const AUTHORITY_SURFACES: readonly ProjectionAuthoritySurface[] = [
  "attributes",
  "constraints",
];

/**
 * SÜZÜLMÜŞ CEVAP KANALINI TEK YERDE KURAR.
 *
 * `create` ve `update` aynı `fields[]` listesini gönderir ve sunucu ikisini de
 * `RequestFieldValue` olarak kalıcılaştırır. Kanalı iki yolda ayrı ayrı
 * kurmak, birinde eklenen bir süzgecin ötekinde sessizce eksik kalmasına yol
 * açardı.
 */
export function projectionAnswerChannel(
  fields: ReadonlyArray<{ key?: unknown; value?: unknown }> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields ?? []) {
    const key = typeof field?.key === "string" ? field.key : "";
    if (!isProjectionAuthorityKeyAllowed(key)) continue;
    const value = typeof field?.value === "string" ? field.value.trim() : "";
    if (value) out[key] = value;
  }
  return out;
}

export type ServerFieldAuthorityInput = {
  /** İstemciden gelen, parse edilmiş projection. Değerleri korunur. */
  projection: RequestDiscoveryProjection | null | undefined;
  /** Sunucunun kalıcılaştırdığı kullanıcı metni. */
  rawInput: string | null | undefined;
  /**
   * Süzülmüş kullanıcı cevap kanalı (`fields[]` → `RequestFieldValue`).
   * Yoksa (clone) yalnız metin türetimi kullanılır.
   */
  answers?: Record<string, string> | null | undefined;
};

/**
 * SUNUCU GÜVEN SINIRI — TEK NORMALİZASYON FONKSİYONU.
 *
 * Girdiyi MUTATE ETMEZ; yeni bir projection nesnesi döner. İDEMPOTENTTİR:
 * kendi çıktısını tekrar geçirmek aynı sonucu verir, çünkü karar hiçbir
 * zaman gelen `fieldAuthority`'ye bakmaz.
 */
export function resolveServerFieldAuthority(
  input: ServerFieldAuthorityInput,
): RequestDiscoveryProjection | null {
  const projection = input.projection ?? null;
  if (!projection) return null;

  const text = (input.rawInput ?? "").trim();
  /* Üretim beyni sunucuda YENİDEN koşar — otorite mantığı kopyalanmaz. */
  let serverProjection: RequestDiscoveryProjection | null = null;
  if (text.length >= 3) {
    try {
      serverProjection = buildDiscoveryProjectionFromState(
        createTextOnlyState(text),
      );
    } catch {
      /* Metin çözülemediyse türetim yok demektir; UNKNOWN tarafında kalınır. */
      serverProjection = null;
    }
  }

  /* Cevap kanalı: yalnız boş olmayan, izinli anahtarlar. */
  const answers = new Map<string, string>();
  for (const [key, value] of Object.entries(input.answers ?? {})) {
    if (!isProjectionAuthorityKeyAllowed(key)) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) answers.set(key, trimmed);
  }

  const fieldAuthority: Record<string, ProjectionFieldAuthority> = {};

  /**
   * ANAHTAR EVRENİ YALNIZ PROJECTION'IN KENDİSİDİR. Bir anahtara otorite
   * yazılabilmesi için o anahtarın projection'da GERÇEK bir yüzeyi olmalıdır.
   * Böylece uydurma alan anahtarları ve değeri silinmiş öksüz metadata
   * kendiliğinden düşer — ayrı bir temizleme adımı gerekmez.
   */
  const keys = new Set<string>([
    ...Object.keys(projection.attributes ?? {}),
    ...Object.keys(projection.constraints ?? {}),
  ]);

  for (const key of keys) {
    if (!isProjectionAuthorityKeyAllowed(key)) continue;

    const entry: ProjectionFieldAuthority = {};

    for (const surface of AUTHORITY_SURFACES) {
      const claim = surfaceSignature(projection, key, surface);
      if (claim === null) continue; // bu yüzey yok — otorite de yok

      /**
       * Sunucu koşumu YALNIZ aynı iddiayı doğruladığında sayılır. Değer
       * değişmiş ama eski metadata kalmışsa sunucunun türettiği seviye o
       * değere ait DEĞİLDİR ve taşınamaz.
       */
      const serverClaim = surfaceSignature(serverProjection, key, surface);
      const fromText =
        serverClaim !== null && serverClaim === claim
          ? derivedAuthority(serverProjection, key, surface)
          : undefined;

      /**
       * Cevap kanalı yalnız projection'daki İDDİANIN AYNISINI onaylıyorsa
       * kullanılır: kullanıcı bir değer gönderdi diye BAŞKA bir değere
       * otorite yazılamaz. Değer taşımayan bir constraint (`mode:"ANY"`) bu
       * kanaldan onaylanamaz — cevabın kendisi bir değerdir.
       */
      const answer = answers.get(key);
      const answerConfirms =
        answer !== undefined &&
        (surface === "attributes"
          ? answer === claim
          : claim === `VALUE|${answer}`);

      let authority: Authority | undefined = fromText;

      if (answerConfirms) {
        /**
         * KATALOG DOĞRULAMASI CEVAP KANALIYLA EZİLMEZ. Metinden zaten
         * `VERIFIED` türeyen bir değer (C200 → Mercedes-Benz) yalnız
         * `fields[]` listesinde göründüğü için `USER_EXPLICIT` sayılmaz:
         * bilginin NEREDEN geldiği sorusunun cevabı değişmedi, kullanıcı
         * yalnız onu da gönderdi. Diğer her durumda süzülmüş cevap kanalı
         * bir kullanıcı beyanıdır.
         */
        authority = fromText === "VERIFIED" ? "VERIFIED" : "USER_EXPLICIT";
      }

      /* Türetilemeyen yüzey yazılmaz — okuma sınırı onu `UNKNOWN` okur. */
      if (authority && authority !== "UNKNOWN") entry[surface] = authority;
    }

    if (entry.attributes || entry.constraints) fieldAuthority[key] = entry;
  }

  const next: RequestDiscoveryProjection = { ...projection };
  /* Harita boşsa alan HİÇ üretilmez — metadata'sız legacy şekil korunur. */
  delete next.fieldAuthority;
  if (Object.keys(fieldAuthority).length) next.fieldAuthority = fieldAuthority;
  return next;
}

/* ------------------------------------------------------------------ *
 * YAZMA YOLLARININ PROJECTION KARARLARI (route sözleşmeleri)
 * ------------------------------------------------------------------ */

/** Yazma yollarının ortak, yapısal payload görünümü. */
export type ProjectionWriteInput = {
  discoveryProjection?: unknown;
  rawInput?: string | null;
  description?: string | null;
  professionalDescription?: string | null;
  title?: string | null;
  fields?: ReadonlyArray<{ key?: unknown; value?: unknown }> | null;
};

/**
 * Sunucunun bu talep için sahip olduğu KENDİ metni. Otorite türetimi ve
 * yayın-anı yeniden kurulumu AYNI metni okur; ikisi ayrışırsa projection bir
 * metinden, otoritesi başka bir metinden türetilmiş olurdu.
 */
function serverOwnedText(input: ProjectionWriteInput): string {
  return (
    input.rawInput?.trim() ||
    input.description?.trim() ||
    input.professionalDescription?.trim() ||
    input.title?.trim() ||
    ""
  );
}

export type CreateProjectionDecision = {
  projection: RequestDiscoveryProjection | null;
  /**
   * Sunucu metinden yeniden kurmayı denedi ve anlama beyni hata verdi.
   * Karar saf kalsın diye burada LOG YAZILMAZ; çağıran kendi alt sistem
   * günlüğüne yazar.
   */
  rebuildFailed: boolean;
};

/**
 * CREATE YOLUNUN PROJECTION KARARI.
 *
 * İstemcinin gönderdiği projection'ın DEĞERLERİ korunur (talebin ne olduğunu
 * kullanıcı söyler), ama `fieldAuthority` haritası bu sınırda tamamen atılıp
 * sunucunun kendi metninden ve süzülmüş cevap kanalından YENİDEN türetilir.
 */
export function resolveCreateProjection(
  input: ProjectionWriteInput,
): CreateProjectionDecision {
  const text = serverOwnedText(input);
  const answers = projectionAnswerChannel(input.fields);

  const fromClient = parseDiscoveryProjection(input.discoveryProjection);
  if (fromClient) {
    return {
      projection: resolveServerFieldAuthority({
        projection: fromClient,
        rawInput: text,
        answers,
      }),
      rebuildFailed: false,
    };
  }

  if (!text || text.length < 3) return { projection: null, rebuildFailed: false };
  try {
    /* Sunucunun kendi kurduğu projection da AYNI sınırdan geçer: cevap kanalı
     * burada da okunmalıdır, yoksa aynı talep istemci projection'ı gönderip
     * göndermemesine göre farklı otorite taşırdı. */
    return {
      projection: resolveServerFieldAuthority({
        projection: buildDiscoveryProjectionFromState(createTextOnlyState(text)),
        rawInput: text,
        answers,
      }),
      rebuildFailed: false,
    };
  } catch {
    return { projection: null, rebuildFailed: true };
  }
}

/**
 * UPDATE YOLUNUN PROJECTION KARARI.
 *
 * Create ile AYNI güven sınırından geçer, tek farkla: düzenlemede `rawInput`
 * payload'da olmayabilir (boş gönderilen `rawInput` bilinçli olarak
 * yoksayılır ki AI metni özgün kullanıcı metnini ezmesin). O durumda sunucu
 * KENDİ kaydettiği metni okur — istemcinin metni göndermemesi, otoritenin
 * türetilemez sayılması için bir gerekçe değildir.
 *
 * İstemci projection göndermezse eski kayda DOKUNULMAZ: `undefined` dönmek
 * "bu alanı güncelleme" demektir.
 */
export function resolveUpdateProjection(
  input: ProjectionWriteInput,
  existingRawInput: string | null | undefined,
): RequestDiscoveryProjection | undefined {
  const fromClient = parseDiscoveryProjection(input.discoveryProjection);
  if (!fromClient) return undefined;

  return (
    resolveServerFieldAuthority({
      projection: fromClient,
      rawInput: input.rawInput?.trim() || existingRawInput?.trim() || "",
      answers: projectionAnswerChannel(input.fields),
    }) ?? undefined
  );
}

/**
 * CLONE YOLUNUN PROJECTION KARARI.
 *
 * KAYNAK KAYDIN `fieldAuthority`'Sİ GÜVENİLİR SAYILMAZ. Kaynak, bu güven
 * sınırından önce yazılmış olabilir; o kayıttaki `USER_EXPLICIT` istemcinin
 * kendi payload'ından gelmiş olabilir ve klonlamak onu aklamaz. Bu yüzden
 * otorite kaynağın KENDİ `rawInput`'undan sıfırdan yeniden türetilir.
 *
 * CLONE YENİ BİR KULLANICI BEYANI ÜRETMEZ: cevap kanalı BİLİNÇLİ olarak
 * verilmez. Kopyalanan `fieldValues` kayıtları eski talebin cevaplarıdır;
 * onları yeni taslağın cevap kanalı saymak, kullanıcının bu taslak için hiç
 * vermediği bir beyanı üretmek olurdu. Metinden türetilemeyen her alan
 * `UNKNOWN` kalır.
 *
 * Legacy normalizasyon korunur: kopya `parseDiscoveryProjection`'dan geçer,
 * böylece D3c-b öncesi kayıtların generic torbalarındaki iç kanıt tipli
 * `internalEvidence` kanalına ayrılır.
 */
export function resolveCloneProjection(source: {
  discoveryProjection?: unknown;
  rawInput?: string | null;
}): RequestDiscoveryProjection | undefined {
  const parsed = parseDiscoveryProjection(source.discoveryProjection);
  if (!parsed) return undefined;
  return (
    resolveServerFieldAuthority({
      projection: parsed,
      rawInput: source.rawInput ?? "",
      answers: null,
    }) ?? undefined
  );
}
