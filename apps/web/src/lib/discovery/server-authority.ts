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

import { getCategoryById } from "@/lib/request-category-engine";
import {
  createTextOnlyState,
  isFieldValueKind,
  type FieldValueKind,
} from "@/lib/request-composer";
import { publishAnswerKeyUniverse } from "@/lib/request-composer/answer-authority";
import type { Authority } from "@/lib/request-understanding/provenance";

import { buildDiscoveryProjectionFromState } from "./build-projection";
import type {
  ProjectionAuthoritySurface,
  ProjectionFieldAuthority,
  ProjectionFieldConfirmation,
  ProjectionFieldResponse,
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
 * CEVAP KANALINDAN GELEN ANAHTARIN ALAN EVRENİ (D3f Dilim 2b).
 *
 * `fields[]` şeması bilinçli olarak açıktır: `FormField` her anahtar için
 * upsert edilir ve kategori alanları zamanla büyür. Bu esneklik DEĞER
 * kanalı için doğrudur, ama değer TAŞIMAYAN cevap için bir çıpa bırakmaz.
 * Bu yüzden yalnız cevap-disposition yüzeyi bir alan evrenine bağlanır:
 * kategorinin kendi tanımlı alanları ve kanonik ortak alan registry'si.
 * Elle yazılmış bir anahtar listesi TUTULMAZ; iki kaynak da zaten vardır.
 *
 * Kategori çözülemezse yalnız ortak alanlar kalır — uydurma anahtar hiçbir
 * koşulda yüzey üretemez (fail-closed).
 */
function canonicalAnswerKeyGuard(
  categoryId: string | null | undefined,
): (key: string) => boolean {
  /**
   * Üretilen etiketler (başlık) alan evrenine GİRMEZ: onlar cevap alanı
   * değildir ve istemci bir cevap gönderse bile fail-closed düşer (D3f 3g).
   */
  /**
   * EVREN TEK YERDEN OKUNUR (D3f Dilim 3h, 2026-08-28). Sunucu daha önce
   * kendi listesini kuruyordu (ortak alanlar + kategori registry'si) ve soru
   * profili anahtarlarını tanımıyordu; istemci onları gönderdiğinde cevap
   * sessizce düşerdi. Karar artık `publishAnswerKeyUniverse`dedir ve iki
   * taraf AYNI kaynaktan okur.
   */
  const allowed = publishAnswerKeyUniverse(categoryId);
  return (key: string) =>
    isProjectionAuthorityKeyAllowed(key) && allowed.has(key);
}

/**
 * SUNUCUNUN GÖRDÜĞÜ BİR CEVAP — DEĞER VE MOD (D3e, 2026-08-27).
 *
 * `mode` kanonik `FieldValueKind`tir. `mode !== "VALUE"` olduğunda `value`
 * yalnız kullanıcıya gösterilen ETİKETTİR ve otorite kararında KULLANILMAZ:
 * yerelleştirilmiş `"Fark etmez"` metni bir kanıt değildir, karar `mode`
 * üzerinden verilir.
 */
export type ProjectionAnswer = {
  mode: FieldValueKind;
  value: string;
};

/**
 * SÜZÜLMÜŞ CEVAP KANALINI TEK YERDE KURAR.
 *
 * `create` ve `update` aynı `fields[]` listesini gönderir ve sunucu ikisini de
 * `RequestFieldValue` olarak kalıcılaştırır. Kanalı iki yolda ayrı ayrı
 * kurmak, birinde eklenen bir süzgecin ötekinde sessizce eksik kalmasına yol
 * açardı.
 *
 * `mode` YOKSA `VALUE` kabul edilir — bu, alanı hiç göndermeyen eski
 * istemcilerin davranışını birebir korur. TANINMAYAN bir `mode` de `VALUE`
 * sayılmaz ve kabul edilmez: geçersiz mod, güvenilir bir otorite üretemez.
 */
export function projectionAnswerChannel(
  fields:
    | ReadonlyArray<{ key?: unknown; value?: unknown; mode?: unknown }>
    | null
    | undefined,
): Record<string, ProjectionAnswer> {
  const out: Record<string, ProjectionAnswer> = {};
  for (const field of fields ?? []) {
    const key = typeof field?.key === "string" ? field.key : "";
    if (!isProjectionAuthorityKeyAllowed(key)) continue;

    const value = typeof field?.value === "string" ? field.value.trim() : "";

    if (field?.mode === undefined || field?.mode === null) {
      /* Legacy istemci: mod yok → değer cevabı. */
      if (value) out[key] = { mode: "VALUE", value };
      continue;
    }
    if (!isFieldValueKind(field.mode)) {
      /* Tanınmayan mod — sözleşme dışı. Cevap kanalına hiç girmez. */
      continue;
    }
    /* Değer taşımayan modun boş etiketi geçerlidir; VALUE'nun boş değeri değil. */
    if (field.mode === "VALUE" && !value) continue;
    out[key] = { mode: field.mode, value };
  }
  return out;
}

/**
 * BİR CEVABIN DETERMİNİSTİK İMZASI (D3f Dilim 3e, 2026-08-28).
 *
 * Onay damgası anahtar varlığına bağlanamaz: bir alan için verilmiş eski bir
 * onay, o alanın SONRADAN DEĞİŞMİŞ cevabını taze gösterirdi. Damga bu yüzden
 * cevabın kendisine bağlanır ve cevap değiştiğinde kendiliğinden geçersiz
 * olur.
 *
 * HAM DEĞER TAŞINMAZ. İmza tek yönlü ve deterministiktir; kullanıcının
 * yazdığı şehir ya da bütçe metni metadata kanalına kopyalanmaz. Kriptografik
 * bir güvence amaçlanmaz — burada sorulan tek soru "bu, onaylanan cevabın ta
 * kendisi mi?"dir; bu yüzden Node'a bağlı olmayan saf ve taşınabilir bir
 * karma kullanılır (istemci ve sunucu aynı sonucu üretmelidir).
 */
export function answerSignature(input: {
  key: string;
  mode: FieldValueKind;
  value?: string | null;
}): string {
  /* Değer taşımayan modda değer YOK sayılır: etiket cevabın kendisi değildir. */
  const value =
    input.mode === "VALUE"
      ? (input.value ?? "").trim().toLocaleLowerCase("tr-TR")
      : "";
  const material = `${input.key}|${input.mode}|${value}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < material.length; index++) {
    hash ^= material.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `v1:${hash.toString(16).padStart(8, "0")}`;
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
  answers?: Record<string, ProjectionAnswer> | null | undefined;
  /**
   * Kullanıcının BU yazma işleminde gerçekten onayladığı anahtarlar
   * (`confirmedFieldKeys`). Yalnız bunlar onay damgası kazanır: bir cevabın
   * sadece yeniden gönderilmiş olması onu taze YAPMAZ.
   */
  confirmedKeys?: readonly string[] | null;
  /**
   * SUNUCUNUN KANONİK KATEGORİ BAĞLAMI (D3f Dilim 3h, 2026-08-28).
   *
   * Cevap kanalı bu kategorinin soru evreniyle sınırlanır. Verilmezse
   * projection'ın kendi `categoryId`'si okunur — bu YALNIZ clone yolunda
   * güvenlidir, çünkü orada kaynak projection sunucunun kendi kaydıdır.
   * Yazma yolları (create/update) her zaman açıkça geçirir.
   */
  categoryId?: string | null;
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

  /**
   * Cevap kanalı: yalnız izinli anahtarlar, tanınan modlar ve SUNUCUNUN
   * kategori evrenine ait sorular (D3f Dilim 3h).
   *
   * Kategori denetimi burada durur çünkü otorite kararının TEK girdisi bu
   * haritadır. Mevcut kategori altında başka bir kategorinin alan anahtarı
   * gönderilirse cevap kanala hiç girmez ve o anahtar `USER_EXPLICIT`
   * kazanamaz — kategori meşru biçimde değişmiş olsa bile yalnız YENİ
   * kategorinin kendi alanları kabul edilir, eskiler taşınmaz.
   */
  const answerKeyIsInCategory = canonicalAnswerKeyGuard(
    input.categoryId !== undefined ? input.categoryId : projection.categoryId,
  );
  const answers = new Map<string, ProjectionAnswer>();
  for (const [key, answer] of Object.entries(input.answers ?? {})) {
    if (!isProjectionAuthorityKeyAllowed(key)) continue;
    if (!answerKeyIsInCategory(key)) continue;
    if (!answer || typeof answer !== "object") continue;
    if (!isFieldValueKind(answer.mode)) continue;
    const value = typeof answer.value === "string" ? answer.value.trim() : "";
    if (answer.mode === "VALUE" && !value) continue;
    answers.set(key, { mode: answer.mode, value });
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
       * CEVAP KANALI YALNIZ PROJECTION'DAKİ İDDİANIN AYNISINI ONAYLAR.
       *
       * Kullanıcı bir cevap gönderdi diye BAŞKA bir iddiaya otorite
       * yazılamaz; iddia ile cevap uyuşmuyorsa fail-closed `UNKNOWN` kalır.
       *
       * DEĞER TAŞIMAYAN CEVAPLAR YALNIZ `constraints` YÜZEYİNDE ONAYLANIR
       * (D3e). `mode:"ANY"` bir attribute değeri DEĞİLDİR: kullanıcının
       * gördüğü `"Fark etmez"` etiketi hiçbir koşulda `attributes` yüzeyine
       * bir değer olarak yazılamaz ve o yüzeyi onaylayamaz. Karar etikete
       * değil, kanonik `mode`a bakar — yerelleştirilmiş metin kanıt değildir.
       */
      const answer = answers.get(key);
      const answerConfirms =
        answer !== undefined &&
        (answer.mode === "VALUE"
          ? surface === "attributes"
            ? answer.value === claim
            : claim === `VALUE|${answer.value}`
          : surface === "constraints" && claim === `${answer.mode}|`);

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

  /**
   * CEVAP DİSPOZİSYONU YÜZEYİ — İSTEMCİ KOPYASI ATILIR (D3f Dilim 2).
   *
   * `fieldAuthority` ile AYNI muamele: istemcinin gönderdiği `fieldResponses`
   * hiçbir koşulda kabul edilmez, çünkü "kullanıcı bu soruyu bilinçli olarak
   * kapattı" iddiası da bir kullanıcı beyanıdır ve uydurulabilir.
   *
   * TEK KAYNAK SÜZÜLMÜŞ CEVAP KANALIDIR. Metin türetimi burada kullanılamaz:
   * "bilmiyorum" cevabının `rawInput` içinde bir karşılığı YOKTUR ve olması da
   * beklenmez — bu yüzden `fields[]` kanalı (`mode`) tek geçerli girdidir.
   * Kanal yoksa (clone) yüzey de yoktur: fail-closed.
   */
  const fieldResponses: Record<string, ProjectionFieldResponse> = {};
  /* AYNI kategori evreni — ikinci bir guard kurulmaz (D3f Dilim 3h). */
  const answerKeyIsCanonical = answerKeyIsInCategory;
  for (const [key, answer] of answers) {
    if (answer.mode !== "UNKNOWN" && answer.mode !== "NOT_APPLICABLE") continue;
    /**
     * ANAHTAR KANONİK OLMAK ZORUNDA (D3f Dilim 2b).
     *
     * Değer taşıyan bir iddianın doğal bir çıpası vardır: `attributes` ya da
     * `constraints` torbasında GERÇEKTEN bulunmalıdır. Değer taşımayan cevabın
     * tasarımı gereği böyle bir çıpası YOKTUR — bu yüzden uydurma bir alan adı
     * (`__hack__`) cevap kanalından geçip kalıcı bir yüzey üretebiliyordu
     * (ölçüldü, 2026-08-27).
     *
     * Çıpa artık ALAN EVRENİDİR: kategorinin kendi alanları ve kanonik ortak
     * alan registry'si. İkisi de var olan kaynaklardan okunur; burada elle
     * yazılmış bir anahtar listesi tutulmaz.
     */
    if (!answerKeyIsCanonical(key)) continue;
    /**
     * TEK YÜZEY KURALI. Aynı anahtar `attributes` ya da `constraints`
     * torbasında da duruyorsa cevap dispozisyonu YAZILMAZ: değer taşıyan bir
     * iddia ile "değer vermedim" cevabı aynı anda doğru olamaz ve ikisini
     * birden yazmak okuyucuya çelişkili bir kayıt bırakırdı.
     */
    if (projection.attributes?.[key] !== undefined) continue;
    if (projection.constraints?.[key] !== undefined) continue;
    /**
     * SÜZÜLMÜŞ CEVAP KANALI BİR KULLANICI BEYANIDIR (D3d sözleşmesi). Bu
     * yüzden tek geçerli seviye `USER_EXPLICIT`tir. `satisfies` ile kanonik
     * merdivene bağlanır: `Authority` listesinden bu seviye kalkarsa burası
     * derleme zamanında kırılır, sessizce ayrışmaz.
     */
    const responseAuthority = "USER_EXPLICIT" as const satisfies Authority;
    fieldResponses[key] = { kind: answer.mode, authority: responseAuthority };
  }

  /**
   * ONAY DAMGALARI — İSTEMCİ KOPYASI ATILIR (D3f Dilim 3e).
   *
   * Damga "kullanıcı bu cevabı bu kayıtta onayladı" der ve tazelik kararının
   * tek kalıcı girdisidir; uydurulabilir olsaydı bayat bir cevap taze
   * görünürdü. Bu yüzden `fieldAuthority` / `fieldResponses` ile aynı muamele:
   * gelen kopya tamamen atılır ve YALNIZ sunucunun doğruladığı cevap
   * kanalından, GERÇEKTEN onaylanmış anahtarlar için yeniden türetilir.
   *
   * Damga cevabın imzasına bağlanır: cevap değişirse eski onay geçersizdir.
   */
  const fieldConfirmations: Record<string, ProjectionFieldConfirmation> = {};
  const confirmedKeys = new Set(
    (input.confirmedKeys ?? []).filter((key) => typeof key === "string"),
  );
  for (const [key, answer] of answers) {
    if (!confirmedKeys.has(key)) continue;
    if (!answerKeyIsCanonical(key)) continue;
    fieldConfirmations[key] = {
      signature: answerSignature({
        key,
        mode: answer.mode,
        value: answer.value,
      }),
    };
  }

  const next: RequestDiscoveryProjection = { ...projection };
  /* Harita boşsa alan HİÇ üretilmez — metadata'sız legacy şekil korunur. */
  delete next.fieldAuthority;
  delete next.fieldResponses;
  delete next.fieldConfirmations;
  if (Object.keys(fieldAuthority).length) next.fieldAuthority = fieldAuthority;
  if (Object.keys(fieldResponses).length) next.fieldResponses = fieldResponses;
  if (Object.keys(fieldConfirmations).length) {
    next.fieldConfirmations = fieldConfirmations;
  }
  return next;
}

/* ------------------------------------------------------------------ *
 * YAZMA YOLLARININ PROJECTION KARARLARI (route sözleşmeleri)
 * ------------------------------------------------------------------ */

/** Yazma yollarının ortak, yapısal payload görünümü. */
/**
 * KULLANICININ BU YAZMADA ONAYLADIĞI ANAHTARLAR.
 *
 * Kaynak, yayın anında zaten taşınan `understanding.confirmedFieldKeys`
 * listesidir — ikinci bir "dokunuş kaydı" kurulmaz. Bu liste `fields[]` ile
 * AYNI güven düzeyindedir: ikisi de kullanıcı beyanıdır. Sahte bir onay
 * anahtarı yalnız o cevabın imzasıyla eşleştiğinde damga üretir ve cevap
 * değiştiğinde damga kendiliğinden geçersiz olur.
 */
function confirmedKeysOf(
  projection: RequestDiscoveryProjection | null | undefined,
): string[] {
  const raw: unknown = projection?.understanding?.confirmedFieldKeys;
  if (!Array.isArray(raw)) return [];
  return raw.filter((key): key is string => typeof key === "string");
}

export type ProjectionWriteInput = {
  discoveryProjection?: unknown;
  rawInput?: string | null;
  description?: string | null;
  professionalDescription?: string | null;
  title?: string | null;
  /**
   * `mode` TİPTE DE TAŞINIR (D3f Dilim 2). Çalışma anında zaten okunuyordu
   * (`projectionAnswerChannel`) ama sözleşmede yoktu; tip ile davranış
   * sessizce ayrışıyordu. Değer taşımayan cevabın TEK kaynağı bu alan
   * olduğu için ayrışma artık kabul edilemez.
   */
  fields?: ReadonlyArray<{
    key?: unknown;
    value?: unknown;
    mode?: unknown;
  }> | null;
  /**
   * TALEBİN KALICILAŞTIRILAN KATEGORİSİ (D3f Dilim 3h, 2026-08-28).
   *
   * Cevap evreni bu alandan türer, `discoveryProjection.categoryId`'den DEĞİL.
   * İkisi de istemciden gelir ama aynı değildir: `category.slug` sunucunun
   * gerçekten `Request.categoryId` olarak yazdığı ve yönlendirme/filtreleme
   * kararlarının okuduğu alandır; projection'ın içindeki `categoryId` ise
   * serbestçe uydurulabilen bir JSON alanıdır. Cevap kabulünü ikincisine
   * bağlamak, istemcinin talebi bir kategoriye yazdırıp cevaplarını BAŞKA bir
   * kategorinin evreninden geçirmesine izin verirdi.
   */
  category?: { slug?: unknown } | null;
};

/**
 * SUNUCUNUN CEVAP KABULÜNDE KULLANDIĞI KANONİK KATEGORİ.
 *
 * Kanonik registry'de KARŞILIĞI OLMAYAN her değer `null` okunur: tanınmayan
 * bir dize evreni genişletemez, yalnız daraltabilir (fail-closed).
 */
function serverAnswerCategoryOf(
  input: ProjectionWriteInput,
): string | null {
  const slug =
    typeof input.category?.slug === "string" ? input.category.slug.trim() : "";
  if (!slug) return null;
  return getCategoryById(slug)?.id ?? null;
}

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
  /* Cevap evreni sunucunun KALICILAŞTIRDIĞI kategoriden türer (D3f 3h). */
  const serverCategory = serverAnswerCategoryOf(input);

  const fromClient = parseDiscoveryProjection(input.discoveryProjection);
  if (fromClient) {
    return {
      projection: resolveServerFieldAuthority({
        projection: fromClient,
        rawInput: text,
        answers,
        categoryId: serverCategory,
        confirmedKeys: confirmedKeysOf(fromClient),
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
        categoryId: serverCategory,
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
      /* Cevap evreni sunucunun KALICILAŞTIRDIĞI kategoriden türer (D3f 3h). */
      categoryId: serverAnswerCategoryOf(input),
      confirmedKeys: confirmedKeysOf(fromClient),
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
 * CEVAP KANALI — KURUCU KARARIYLA DARALTILDI (D3f Dilim 3d, 2026-08-28).
 *
 * D3d'de burada "clone HİÇBİR cevap kanalı almaz" yazıyordu: kopyalanan
 * `fieldValues` kayıtları eski talebin cevaplarıydı ve onları yeni taslağın
 * beyanı saymak, kullanıcının bu taslak için hiç vermediği bir beyanı
 * üretmek olurdu.
 *
 * Kurucu bu kuralı BİLİNÇLİ olarak daralttı: klonlamayı kullanıcının KENDİSİ
 * başlatır ve kendi önceki açık seçiminin yeni TASLAĞA taşınmasını ister.
 * Yeni kayıt DRAFT kalır — bu bir otomatik yayın değildir. Bu yüzden çağıran,
 * kaynağın VERİTABANINDA DOĞRULANMIŞ değer taşımayan cevaplarını
 * (`cloneAnswerChannel`) geçirebilir.
 *
 * DEĞİŞMEYEN KISIM: kaynak kaydın `fieldAuthority` / `fieldResponses`
 * metadata'sı HÂLÂ GÜVENİLİR SAYILMAZ ve hiçbir koşulda kopyalanmaz. Kanal
 * verilmezse eski davranış birebir korunur ve metinden türetilemeyen her alan
 * `UNKNOWN` kalır.
 *
 * Legacy normalizasyon korunur: kopya `parseDiscoveryProjection`'dan geçer,
 * böylece D3c-b öncesi kayıtların generic torbalarındaki iç kanıt tipli
 * `internalEvidence` kanalına ayrılır.
 */
export function resolveCloneProjection(source: {
  discoveryProjection?: unknown;
  rawInput?: string | null;
  /**
   * Kaynağın DB'de doğrulanmış DEĞER TAŞIMAYAN cevapları. Kaynağın projection
   * metadata'sından DEĞİL, `RequestFieldValue` satırlarından türetilir.
   */
  fieldAnswers?: Record<string, ProjectionAnswer> | null;
}): RequestDiscoveryProjection | undefined {
  const parsed = parseDiscoveryProjection(source.discoveryProjection);
  if (!parsed) return undefined;
  return (
    resolveServerFieldAuthority({
      projection: parsed,
      rawInput: source.rawInput ?? "",
      answers: source.fieldAnswers ?? null,
    }) ?? undefined
  );
}
