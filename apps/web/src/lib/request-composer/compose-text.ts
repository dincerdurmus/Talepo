/**
 * Schema/template-driven natural request text — NOT a second AI brain.
 * Short Turkish; no IDs / confidence.
 */

import { resolveBrowseSemanticRole } from "./browse-semantic-role";
import type { CanonicalRequestState } from "./types";
import {
  isGenericCompatibilityNoun,
  stripRequestedItemClause,
} from "./attribute-hints";
import { resolveDomainEntity } from "@/lib/catalog";
import {
  readRelationContext,
  readRequestedTarget,
  readSafeLeadingPhrase,
  readSafePhraseContaining,
  splitCompatibilityPhrase,
} from "@/lib/request-understanding/part-relation";

function fieldValue(state: CanonicalRequestState, key: string): string | null {
  const f = state.fields[key];
  if (!f || f.kind !== "VALUE" || !f.value?.trim()) return null;
  return f.value.trim();
}

function fieldAny(state: CanonicalRequestState, key: string): boolean {
  return state.fields[key]?.kind === "ANY";
}

function automotiveNeedType(state: CanonicalRequestState): string | null {
  if (state.fields.needType?.kind === "VALUE" && state.fields.needType.value) {
    return String(state.fields.needType.value).toLowerCase();
  }
  const role = resolveBrowseSemanticRole({
    categoryId: state.categoryId,
    subcategorySlug: state.subcategorySlug,
  });
  if (role.needType) return role.needType;
  const subject = state.understanding.requestSubject.kind.value;
  if (subject === "PART" || subject === "ACCESSORY") return "part";
  if (subject === "SERVICE") return "service";
  if (subject === "VEHICLE") return "vehicle";
  return null;
}

/**
 * BÜTÜN ÜRÜN BESTECİSİ, PARÇA TALEBİNİ SAHİPLENEMEZ (1C).
 *
 * `isTv`/`isVacuum` ürüne özel bestecilerdir ve `part` alanını hiç okumazlar.
 * Ölçülen sonuç: "Televizyon için güç kartı arıyorum" → "televizyon arıyorum."
 * Konu PARÇA, kanonik alan "güç kartı", cümle ise bütün bir televizyon
 * talebi — üç yüzey üç ayrı şey söylüyordu.
 *
 * Kural ürüne özel değildir: konu parça VE somut bir parça adı varsa bu
 * talep bütün ürün talebi değildir, ilgili uyumluluk rotasına gider.
 */
function hasCompatibilityPartSubject(state: CanonicalRequestState): boolean {
  if (!fieldValue(state, "part") && !canonicalRequestedItem(state)) return false;
  return (
    state.understanding.requestSubject.kind.value === "PART" ||
    fieldValue(state, "needType") === "part"
  );
}

function isTv(state: CanonicalRequestState): boolean {
  const pt = fieldValue(state, "productType")?.toLocaleLowerCase("tr-TR") ?? "";
  const raw = (state.understanding.rawInput ?? "").toLocaleLowerCase("tr-TR");
  return (
    pt.includes("televizyon") ||
    pt === "television" ||
    raw.includes("televizyon") ||
    /\btv\b/.test(raw) ||
    Boolean(state.taxonomyNodeId?.includes("televizyon"))
  );
}

function isVacuum(state: CanonicalRequestState): boolean {
  const pt = fieldValue(state, "productType")?.toLocaleLowerCase("tr-TR") ?? "";
  const raw = (state.understanding.rawInput ?? "").toLocaleLowerCase("tr-TR");
  const brand = fieldValue(state, "brand")?.toLocaleLowerCase("tr-TR") ?? "";
  return (
    pt.includes("supurge") ||
    pt.includes("süpürge") ||
    raw.includes("süpürge") ||
    raw.includes("supurge") ||
    brand === "dyson"
  );
}

function isAutoPart(state: CanonicalRequestState): boolean {
  const need = automotiveNeedType(state);
  if (need === "vehicle") return false;
  if (need === "part" || need === "tire") return true;
  if (state.subcategorySlug === "yedek-parca") return true;
  if (state.understanding.requestSubject.kind.value === "PART") return true;
  return false;
}

function isAutoVehicle(state: CanonicalRequestState): boolean {
  if (state.categoryId !== "automotive" &&
    state.understanding.category.value !== "automotive") {
    return false;
  }
  if (isAutoPart(state)) return false;
  const need = automotiveNeedType(state);
  return need === "vehicle" || need == null;
}

function preferredPhrase(state: CanonicalRequestState, key: string): string | null {
  const prefs = state.fields[key]?.preferredValues;
  if (!prefs?.length) return null;
  if (prefs.length === 1) return prefs[0]!;
  return `${prefs.slice(0, -1).join(", ")} veya ${prefs[prefs.length - 1]}`;
}

function excludedPhrase(state: CanonicalRequestState, key: string): string | null {
  const excl = state.fields[key]?.excludedValues;
  if (!excl?.length) return null;
  return excl.join(", ");
}

function appendExclusionBits(
  bits: string[],
  state: CanonicalRequestState,
  keys: string[],
) {
  for (const key of keys) {
    const excl = excludedPhrase(state, key);
    if (excl) bits.push(`ama ${excl} olmasın`);
  }
}

function strengthPrefix(state: CanonicalRequestState, key: string): string {
  const s = state.fields[key]?.strength;
  if (s === "MUST") return "mutlaka ";
  if (s === "PREFERRED") return "tercihen ";
  return "";
}

function composeTv(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const screen = fieldValue(state, "screenSize");
  if (screen) bits.push(`${screen} ekran`);

  const brandPrefs = preferredPhrase(state, "brand");
  if (fieldAny(state, "brand")) {
    bits.push("marka fark etmez");
    const excl = excludedPhrase(state, "brand");
    if (excl) bits.push(`ama ${excl} olmasın`);
  } else if (brandPrefs) {
    bits.push(`${brandPrefs} olabilir`);
  } else {
    const brand = fieldValue(state, "brand");
    if (brand) bits.push(brand);
    const excl = excludedPhrase(state, "brand");
    if (excl) bits.push(`ama ${excl} olmasın`);
  }

  const model = fieldValue(state, "model") ?? preferredPhrase(state, "model");
  if (model) bits.push(model);
  appendExclusionBits(bits, state, ["model"]);

  const resolution = fieldValue(state, "resolution");
  if (resolution) bits.push(`${strengthPrefix(state, "resolution")}${resolution}`.trim());

  const condition = fieldValue(state, "condition");
  if (condition) {
    bits.push(condition.toLocaleLowerCase("tr-TR"));
  } else if (state.fields.condition?.excludedValues?.includes("USED")) {
    bits.push("ikinci el olmasın");
  }

  bits.push("televizyon arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function composeVacuum(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const brand = fieldValue(state, "brand");
  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else if (brand) bits.push(brand);

  const model =
    fieldValue(state, "model") ?? preferredPhrase(state, "model");
  if (model) bits.push(model);

  bits.push("süpürge arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

/** Role-aware identity phrase: brand + model + generation without token echo. */
function planIdentityPhrase(
  brand: string | null,
  model: string | null,
  generation: string | null,
): string[] {
  const bits: string[] = [];
  const push = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const lower = t.toLocaleLowerCase("tr-TR");
    const existing = bits.map((b) => b.toLocaleLowerCase("tr-TR"));
    if (existing.some((e) => e === lower)) return;
    // Drop token fully covered by a longer existing bit (Golf ⊂ Golf VII)
    if (existing.some((e) => e.includes(lower) && e !== lower)) return;
    // Replace shorter bit when new token subsumes it
    for (let i = bits.length - 1; i >= 0; i--) {
      const e = existing[i]!;
      if (lower.includes(e) && lower !== e) {
        bits.splice(i, 1);
      }
    }
    bits.push(t);
  };

  if (brand) push(brand);
  if (model && !isGenericCompatibilityNoun(model)) push(model);
  if (generation) push(generation);
  return bits;
}

function targetAlreadyExpressesItem(target: string, item: string): boolean {
  const t = target.toLocaleLowerCase("tr-TR");
  const i = item.toLocaleLowerCase("tr-TR").trim();
  if (!i) return false;
  if (t === i) return true;
  if (t.includes(`için ${i}`)) return true;
  const itemTokens = i.split(/\s+/).filter((tok) => tok.length > 2);
  if (itemTokens.length === 0) return t.includes(i);
  return itemTokens.every((tok) => t.includes(tok));
}

/**
 * Plan compatibility-part sentence from semantic roles, not string surgery
 * on a finished sentence.
 */
function composeCompatibilityPartSentence(input: {
  brand: string | null;
  model: string | null;
  generation: string | null;
  parentProduct?: string | null;
  part: string | null;
  position?: string | null;
  fallbackNoun: string;
}): string {
  const requestedItem = planPartPhrase(
    input.part?.toLocaleLowerCase("tr-TR") ?? null,
    input.position ?? null,
    input.fallbackNoun,
  );
  const model = stripRequestedItemClause(input.model, requestedItem);
  const parentProduct = stripRequestedItemClause(
    input.parentProduct,
    requestedItem,
  );
  const brand = isGenericCompatibilityNoun(input.brand)
    ? null
    : input.brand;

  let modelForPlan = model;
  if (parentProduct) {
    if (!modelForPlan) {
      modelForPlan = parentProduct;
    } else {
      const mf = modelForPlan.toLocaleLowerCase("tr-TR");
      const pf = parentProduct.toLocaleLowerCase("tr-TR");
      if (mf !== pf && !mf.includes(pf) && !pf.includes(mf)) {
        modelForPlan = `${parentProduct} ${modelForPlan}`;
      }
    }
  }

  const targetBits = planIdentityPhrase(
    brand,
    modelForPlan,
    input.generation,
  ).filter((bit) => !isGenericCompatibilityNoun(bit));

  const itemIsGeneric = isGenericCompatibilityNoun(requestedItem);
  if (targetBits.length === 0) {
    return `${requestedItem} arıyorum.`.replace(/\s+/g, " ").trim();
  }
  const target = targetBits.join(" ");
  if (itemIsGeneric && isGenericCompatibilityNoun(target)) {
    return `${requestedItem} arıyorum.`.replace(/\s+/g, " ").trim();
  }
  if (targetAlreadyExpressesItem(target, requestedItem)) {
    if (/(arıyorum|ariyorum)\s*[.!?]*$/i.test(target)) {
      return `${target.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "")}.`;
    }
    return `${target} arıyorum.`.replace(/\s+/g, " ").trim();
  }
  return `${target} için ${requestedItem} arıyorum.`
    .replace(/\s+/g, " ")
    .trim();
}

const POSITION_ORDER = ["sol", "sağ", "ön", "arka", "üst", "alt", "iç", "dış"];

/** Merge position field + part noun so "ön" is not repeated. */
function planPartPhrase(
  part: string | null,
  pos: string | null,
  fallbackNoun: string,
): string {
  const noun = (part ?? fallbackNoun).trim();
  const nounLower = noun.toLocaleLowerCase("tr-TR");
  const posTokens = (pos ?? "")
    .toLocaleLowerCase("tr-TR")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !nounLower.split(/\s+/).includes(t));

  // Also strip position tokens already embedded in the noun from a leading re-prefix
  const leadingPos = new Set(POSITION_ORDER);
  const nounTokens = nounLower.split(/\s+/).filter(Boolean);
  const strippedNounTokens = [...nounTokens];
  while (strippedNounTokens.length && leadingPos.has(strippedNounTokens[0]!)) {
    // keep first occurrence inside noun; don't also prefix
    break;
  }

  const orderedPos = [...new Set(posTokens)].sort(
    (a, b) => POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b),
  );
  return [...orderedPos, noun].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function composeAutoPart(state: CanonicalRequestState): string {
  const role = resolveBrowseSemanticRole({
    categoryId: state.categoryId,
    subcategorySlug: state.subcategorySlug,
  });
  const fallbackNoun =
    automotiveNeedType(state) === "tire"
      ? "lastik"
      : role.subjectNounTr ?? "yedek parça";
  return composeCompatibilityPartSentence({
    brand: fieldValue(state, "brand"),
    model: fieldValue(state, "model"),
    generation: fieldValue(state, "generation"),
    part: fieldValue(state, "part"),
    position: fieldValue(state, "partPosition"),
    fallbackNoun,
  });
}

function composeAutoVehicle(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const brand = fieldValue(state, "brand");
  const model = fieldValue(state, "model");
  const generation = fieldValue(state, "generation");
  const year = fieldValue(state, "year");
  const condition = fieldValue(state, "condition");

  if (year) bits.push(`${year} model`);
  bits.push(...planIdentityPhrase(brand, model, generation));
  appendExclusionBits(bits, state, ["brand", "model"]);
  if (condition) bits.push(condition.toLocaleLowerCase("tr-TR"));
  if (bits.length === 0) bits.push("araç");
  bits.push("arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function composeRealEstate(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const listing = fieldValue(state, "listingType");
  const prop = fieldValue(state, "propertyType");
  const rooms = fieldValue(state, "roomCount");
  if (listing) bits.push(listing.toLocaleLowerCase("tr-TR"));
  if (rooms) bits.push(rooms);
  if (prop) bits.push(prop.toLocaleLowerCase("tr-TR"));
  else bits.push("konut");
  bits.push("arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function composeDomainId(state: CanonicalRequestState): string | null {
  return state.categoryId ?? state.understanding.category.value ?? null;
}

/**
 * Otomotiv rotasının TEK yetkisi (kurucu, KB-10 — 2026-08-24).
 *
 * `composeDomainId` bu dosyanın mevcut canonical kategori otoritesidir
 * (`isFurniture` / `isAppliances` de ona dayanır); yeni bir otorite
 * uydurulmadı. Tek başına şunlar otomotiv KANITI DEĞİLDİR ve buraya
 * girmemelidir: `needType === "part"`, `requestSubject.kind === "PART"`,
 * "parça" kelimesi, ürün adı, ham kullanıcı metni.
 */
function isAutomotiveDomain(state: CanonicalRequestState): boolean {
  return composeDomainId(state) === "automotive";
}

/**
 * Uyumluluk parçasının ÜST ÜRÜNÜ — tek çözüm kuralı (KB-10, 2026-08-24).
 *
 * Zincir: `applianceType → productType → machineType`.
 *
 * Neden tek yardımcı: bu zincir iki ayrı rotada (doğrudan `compatibility_part`
 * dalı ve otomotiv dışı yol) ayrı ayrı yazıldığında birbirinden kopuyor. İlk
 * denemede tam olarak bu oldu — `compatibility_part` dalı `machineType`'ı
 * okumuyordu, dolayısıyla o daldan geçen bir sanayi makinesi parçası talebi
 * üst makine adını yine kaybediyordu. Kategoriye özel metin yok; kategori
 * eklendiğinde yalnız bu zincir değişir.
 */
function compatibilityParentProduct(
  state: CanonicalRequestState,
): string | null {
  return (
    fieldValue(state, "applianceType") ??
    fieldValue(state, "productType") ??
    fieldValue(state, "machineType")
  );
}

/**
 * Otomotiv DIŞI uyumluluk parçası cümlesi (KB-10).
 *
 * Sorun: `isAutoPart()` kategoriye bakmadığı için beyaz eşya/makine parçaları
 * otomotiv bestecisine düşüyordu; o besteci `parentProduct` taşımaz (otomotivde
 * ebeveyn araçtır, marka/model üzerinden gider). Sonuç: "Bosch çamaşır makinesi
 * için pompa arıyorum" → "Bosch için pompa arıyorum." — tedarikçi pompanın
 * hangi cihaz için istendiğini göremiyordu.
 *
 * Yalnız rotayı kapatmak YETMEZ, kötüleştirir: kategori gövdesine düşen talep
 * `part` alanını hiç okumaz ve pompa tamamen kaybolur (ölçüldü). Bu yüzden
 * sınır ile bu yol birlikte gider.
 */
/**
 * İSTENEN ŞEY KATEGORİ ŞEMASINDAN BAĞIMSIZDIR (1F).
 *
 * `fields.part` yalnız o kategorinin şemasında `part` alanı varsa dolar;
 * baby/mobilya/sağlık formlarında yoktur ve domain geçişinde temizlenir.
 * Kategoriye alan EKLEMEK bir ürün kararıdır — bunun yerine cümle kanonik
 * gerçeğe düşer: konu bir uyumluluk konusuysa istenen şey konunun kendisidir.
 * Ölçülen kayıp buydu: "Bebek arabası için bardaklık adaptörü arıyorum" →
 * "bebek arabası arıyorum."
 */
function canonicalRequestedItem(state: CanonicalRequestState): string | null {
  const subject = state.understanding.requestSubject;
  const kind = subject?.kind?.value;
  if (kind !== "PART" && kind !== "ACCESSORY") return null;
  const value =
    subject.displayPhrase?.value ?? subject.name?.value ?? null;
  return value ? String(value).trim() || null : null;
}

function composeNonAutomotiveCompatibilityPart(
  state: CanonicalRequestState,
  role: ReturnType<typeof resolveBrowseSemanticRole>,
): string | null {
  if (isAutomotiveDomain(state)) return null;
  const part = fieldValue(state, "part") ?? canonicalRequestedItem(state);
  if (!part) return null;
  return composeCompatibilityPartSentence({
    brand: fieldValue(state, "brand"),
    model: fieldValue(state, "model"),
    generation: fieldValue(state, "generation"),
    parentProduct: compatibilityParentProduct(state),
    part,
    fallbackNoun: role.subjectNounTr ?? "yedek parça",
  });
}

function isIntentVerbToken(value: string | null): boolean {
  if (!value) return false;
  const fold = value.toLocaleLowerCase("tr-TR");
  return /^(yapt[iı]rmak|yapt[iı]rma|istiyorum|arıyorum|ariyorum|laz[iı]m|bak[iı]yorum|almak|satmak)$/i.test(
    fold.trim(),
  );
}

function isFurniture(state: CanonicalRequestState): boolean {
  const domain = composeDomainId(state);
  if (domain && domain !== "furniture") return false;
  return (
    state.categoryId === "furniture" ||
    state.understanding.category.value === "furniture" ||
    Boolean(state.subcategorySlug?.includes("mobilya")) ||
    Boolean(state.taxonomyNodeId?.startsWith("tax:furniture:")) ||
    Boolean(fieldValue(state, "furnitureType"))
  );
}

function composeFurniture(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const furnitureType = fieldValue(state, "furnitureType");
  const product = fieldValue(state, "productType");
  const brand = fieldValue(state, "brand");

  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else if (brand) bits.push(brand);

  /**
   * KULLANICININ AÇIK BEYANI PROFESYONEL METİNDE KALIR (98+ Faz I,
   * 2026-09-01). "Yemek masası arıyorum 6 kişilik ahşap" yazan kullanıcının
   * "6 kişilik" ve "ahşap" beyanları state'e doğru biniyor ama cümleye geri
   * yazılmıyordu; sorular aynı bilgiyi YENİDEN soruyordu (ölçüldü,
   * furn-07). Türkçe sıfat isimden önce gelir: beyanlar tip adının ÖNÜNE
   * eklenir. YALNIZ kullanıcı beyanı (EXPLICIT provenance) yazılır —
   * çıkarım/katalog dolgusu cevap gibi gösterilmez
   * (suggestion-is-not-an-answer sözleşmesi).
   */
  const explicitModifier = (key: string): string | null => {
    const f = state.fields[key];
    if (!f || f.kind !== "VALUE" || !f.value?.trim()) return null;
    if (
      f.provenance !== "EXPLICIT_TEXT" &&
      f.provenance !== "EXPLICIT_BROWSE"
    ) {
      return null;
    }
    return f.value.trim();
  };
  const seats =
    explicitModifier("diningSeats") ?? explicitModifier("seatingCapacity");
  if (seats) bits.push(seats);
  const material = explicitModifier("material");
  if (material) bits.push(material.toLocaleLowerCase("tr-TR"));

  if (furnitureType) bits.push(furnitureType);
  else if (product) bits.push(product);
  else if (state.subcategorySlug === "ev-mobilyasi") bits.push("ev mobilyası");
  else if (state.subcategorySlug === "ofis-mobilyalari") {
    bits.push("ofis mobilyası");
  } else {
    bits.push("mobilya");
  }

  bits.push("arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function isAppliances(state: CanonicalRequestState): boolean {
  const domain = composeDomainId(state);
  if (domain && domain !== "appliances") return false;
  return (
    state.categoryId === "appliances" ||
    state.understanding.category.value === "appliances" ||
    Boolean(state.taxonomyNodeId?.startsWith("tax:appliances:")) ||
    Boolean(fieldValue(state, "applianceType"))
  );
}

function composeAppliances(state: CanonicalRequestState): string {
  const role = resolveBrowseSemanticRole({
    categoryId: state.categoryId,
    subcategorySlug: state.subcategorySlug,
    taxonomyNodeId: state.taxonomyNodeId,
    productType:
      fieldValue(state, "applianceType") ?? fieldValue(state, "productType"),
  });
  if (role.compositionMode === "compatibility_part") {
    return composeCompatibilityPartSentence({
      brand: fieldValue(state, "brand"),
      model: fieldValue(state, "model"),
      generation: fieldValue(state, "generation"),
      // Aynı tek zincir — üçüncü bir kopya bırakılmadı.
      parentProduct: compatibilityParentProduct(state),
      part: fieldValue(state, "part"),
      fallbackNoun: role.subjectNounTr ?? "yedek parça",
    });
  }

  const bits: string[] = [];
  const applianceType = fieldValue(state, "applianceType");
  const product = fieldValue(state, "productType");
  const brand = fieldValue(state, "brand");

  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else if (brand) bits.push(brand);
  appendExclusionBits(bits, state, ["brand", "model"]);

  if (applianceType && !/yedek\s*par/i.test(applianceType)) {
    bits.push(applianceType);
  } else if (product && !/yedek\s*par/i.test(product)) {
    bits.push(product);
  } else if (state.subcategorySlug === "kucuk-ev-aletleri") {
    bits.push("küçük ev aleti");
  } else if (state.subcategorySlug === "beyaz-esya") {
    bits.push("beyaz eşya");
  } else if (state.subcategorySlug === "isitma-sogutma-ve-havalandirma") {
    bits.push("ısıtma soğutma");
  } else {
    bits.push("beyaz eşya");
  }

  bits.push("arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function composeGeneric(state: CanonicalRequestState): string {
  const bits: string[] = [];
  const product = fieldValue(state, "productType");
  const furnitureType = fieldValue(state, "furnitureType");
  const brand = fieldValue(state, "brand");
  const model = fieldValue(state, "model");
  const productFold = (product ?? "").toLocaleLowerCase("tr-TR");
  const brandFold = (brand ?? "").toLocaleLowerCase("tr-TR");

  if (fieldAny(state, "brand")) bits.push("marka fark etmez");
  else if (
    brand &&
    (!productFold ||
      (brandFold !== productFold && !productFold.includes(brandFold)))
  ) {
    bits.push(brand);
  }
  if (model && !isIntentVerbToken(model) && model !== product) {
    const modelFold = model.toLocaleLowerCase("tr-TR");
    if (!productFold.includes(modelFold) && brandFold !== modelFold) {
      bits.push(model);
    }
  }
  appendExclusionBits(bits, state, ["brand", "model"]);
  if (furnitureType) bits.push(furnitureType);
  if (product && product !== furnitureType) bits.push(product);
  const condition = fieldValue(state, "condition");
  if (condition) bits.push(condition.toLocaleLowerCase("tr-TR"));
  if (
    bits.length === 0 ||
    (bits.length === 1 && fieldAny(state, "brand"))
  ) {
    /* keep arıyorum */
  }
  bits.push("arıyorum");
  return bits.join(" ").replace(/\s+/g, " ").trim() + ".";
}

function appendCanonicalLocation(
  state: CanonicalRequestState,
  text: string,
): string {
  const city = fieldValue(state, "city");
  if (!city) return text;
  const hay = text.toLocaleLowerCase("tr-TR");
  if (hay.includes(city.toLocaleLowerCase("tr-TR"))) return text;
  const trimmed = text.replace(/[.!\s]+$/u, "").trim();
  return `${trimmed}, ${city}.`;
}

/**
 * Render short Turkish natural-language request from canonical state.
 */
/**
 * KULLANICININ YAZDIĞI HEDEF CÜMLEDEN DÜŞEMEZ (1G).
 *
 * "X için Y" yapısında ilişki parça ilişkisi olarak kurulmadığında talep
 * kategori gövdesine düşüyor ve o gövde kategori-genel bir adla cümle
 * kuruyordu. Ölçülen kayıplar:
 *   "Salon için koltuk arıyorum"           → "mobilya arıyorum."
 *   "Ev için klima servisi arıyorum"       → "Klima arıyorum."
 *   "Ofis için muhasebe yazılımı arıyorum" → "konut arıyorum."
 * Üçünde de kullanıcının yazdığı şey profesyonel yüzeyden siliniyor.
 *
 * Kural DAR ve YAPISALDIR: yalnız uyumluluk bağlacı bulunan cümlelerde,
 * yalnız bağlacın sağındaki hedef ifade cümlede hiç geçmiyorsa devreye girer.
 * Bağlaçsız hiçbir akışa dokunmaz; ürettiği cümle kullanıcının kendi
 * sözcükleridir, sisteme ait bir genelleme değil.
 */
function preserveRequestedTarget(
  state: CanonicalRequestState,
  sentence: string,
): string {
  /**
   * Uyumluluk konusuna DOKUNULMAZ: orada cümleyi kuran özel besteci üst ürünü,
   * markayı ve modeli birlikte taşır; buradan yapılacak bir yeniden yazım o
   * bağlamı yok eder ("Mercedes C180 için su pompası" → "su pompası", ölçüldü).
   * Bu kural yalnız kategori gövdesine düşen taleplerin kurtarma ağıdır.
   */
  const kind = state.understanding.requestSubject?.kind?.value;
  const raw = String(state.understanding.rawInput ?? "");
  const split = splitCompatibilityPhrase(raw);
  /**
   * TİPLİ PLATFORM İSTİSNASI (1J).
   *
   * Uyumluluk bestecisi üst ürünü MARKA alanı üzerinden taşır. Platform ve
   * makine türü artık marka sayılmadığı için ("WordPress" bir üretici
   * markası değildir) o yol kapalı ve ad cümleden düşüyordu — ölçüldü:
   * "WordPress için SEO eklentisi" → "seo eklentisi arıyorum.". Bu dar
   * istisna adı geri koyar; katalog markası taşıyan üst ürünlere
   * (Mercedes, Heidelberg, Arçelik) dokunmaz, çünkü onlar zaten cümlededir.
   */
  const typedContext = split ? resolveDomainEntity(split.parent) : null;
  const typedPlatformContext = Boolean(
    typedContext && typedContext.status !== "NONE" && typedContext.entityType && typedContext.entityType !== "BRAND",
  );
  if ((kind === "PART" || kind === "ACCESSORY") && !typedPlatformContext) {
    return sentence;
  }
  if (!split) return sentence;
  const target = readRequestedTarget(split.requested).value;
  if (!target) return sentence;
  const lower = (v: string) => v.toLocaleLowerCase("tr-TR");
  const withContext = (body: string): string => {
    /**
     * HİZMETİN UYGULANDIĞI ÜRÜN/PLATFORM SİLİNEMEZ (1I).
     *
     * "WordPress için teknik destek arıyorum" cümlesi "teknik destek
     * arıyorum."a indiğinde hangi ürün için destek arandığı kaybolur ve
     * talep eşleşemez hâle gelir. Sol yaka yalnız HİZMET taleplerinde geri
     * yazılır: bütün ürün taleplerinde sol taraf kullanım yeridir ve
     * cümleye ait değildir ("Ofis için televizyon" → "televizyon arıyorum.").
     *
     * Taşınan şey ham cümle değil, `readRelationContext` ile ayrıştırılmış
     * güvenli span'dir; bütçe, telefon ve adres parçaları oraya giremez.
     */
    if (kind !== "SERVICE" && !typedPlatformContext) return body;
    const context = readRelationContext(split.parent);
    if (!context) return body;
    if (lower(body).includes(lower(context))) return body;
    return `${context} için ${body}`;
  };
  if (lower(sentence).includes(lower(target))) return withContext(sentence);
  return withContext(`${target} arıyorum.`);
}

/**
 * TİPLİ VARLIK PROFESYONEL METİNDEN DÜŞEMEZ (1K).
 *
 * Bağlacı olmayan cümlelerde besteci kullanıcının ifadesini kaybediyordu:
 * "WordPress destek arıyorum" → "arıyorum.", "CNC tezgâh bakımı arıyorum"
 * → "arıyorum.". Varlık kategoriyi değiştirip metinden siliniyordu.
 *
 * Kural varlık ROLÜNE dayanır, kelimeye değil: talepte kanonik bir tipli
 * varlık çözülmüşse ve adı üretilen cümlede geçmiyorsa cümle kullanıcının
 * GÜVENLİ ifadesinden yeniden kurulur. Taşınan şey ham cümle değil, adı
 * içeren tek yan cümledir (bütçe/telefon/adres girmez).
 */
function preserveResolvedEntity(
  state: CanonicalRequestState,
  sentence: string,
): string {
  const raw = String(state.understanding.rawInput ?? "");
  const lower = (v: string) => v.toLocaleLowerCase("tr-TR");
  /**
   * ÇAPA LİSTESİ (RC_BRAND takip dilimi): tipli varlıklar + marka ADAYI.
   *
   * Aday marka kesinleşmez ama kullanıcının yazdığı ifadedir; kanonik
   * markadan düştüğü için besteci onu kaybediyordu — "Nordex klima" →
   * "Klima arıyorum.", "Torna tezgahı" → "mobilya arıyorum." (ölçüldü).
   * Çapa metinde yoksa cümle, çapayı içeren GÜVENLİ öbekten yeniden
   * kurulur; ham cümlenin tamamı asla taşınmaz.
   */
  const candidate = (state.understanding.attributes as
    | Record<string, { value?: unknown } | undefined>
    | undefined)?.brandCandidate?.value;
  const anchors: string[] = [
    ...(state.understanding.resolvedEntities ?? []).map(
      (e) => e.matchedAlias ?? e.canonicalLabel,
    ),
    ...(candidate ? [String(candidate)] : []),
  ].filter(Boolean);
  for (const alias of anchors) {
    if (lower(sentence).includes(lower(alias))) continue;
    const safe = readSafePhraseContaining(raw, alias);
    if (safe) return `${safe} arıyorum.`;
  }
  /**
   * ÖZNESİZ METİN YASAĞI: cümle hiçbir bilgi taşımıyorsa ham cümlenin ilk
   * güvenli öbeği kullanılır. Yalnız tam öznesiz ("arıyorum.") durumda
   * devreye girer; dolu cümleler ezilmez, PII noktalama sınırında kalır.
   */
  if (sentence.trim() === "arıyorum.") {
    const lead = readSafeLeadingPhrase(raw);
    if (lead) return `${lead} arıyorum.`;
  }
  return sentence;
}

export function composeNaturalRequestText(
  state: CanonicalRequestState,
): string {
  return appendCanonicalLocation(
    state,
    preserveResolvedEntity(
      state,
      preserveRequestedTarget(state, composeNaturalRequestTextCore(state)),
    ),
  );
}

function composeNaturalRequestTextCore(
  state: CanonicalRequestState,
): string {
  /* 98+ Part IV: "70 inç tv duvar montajı" bir HİZMET talebidir; TV
     bestecisi ürün cümlesi üretip montajı siliyordu (ölçüldü). Hizmet
     kipindeki state'i bütün-ürün bestecileri sahiplenemez. */
  const serviceState =
    state.fields.needType?.kind === "VALUE" &&
    String(state.fields.needType.value).toLowerCase() === "service";
  const wholeProductComposerAllowed =
    !hasCompatibilityPartSubject(state) && !serviceState;
  /* 98+ Part IV: metin-yerli HİZMET talebi ürün bestecilerine gidemez —
     "vestel buzdolabım su akıtıyor tamirci" cümlesi "Vestel Buzdolabı
     arıyorum." oluyordu (ölçüldü). Hedef + hizmet adı kullanıcı
     kanallarından okunur. */
  if (serviceState) {
    const svc =
      fieldValue(state, "serviceType") ??
      fieldValue(state, "part") ??
      "servis";
    const target = [
      fieldValue(state, "brand"),
      fieldValue(state, "applianceType") ??
        fieldValue(state, "productType") ??
        fieldValue(state, "furnitureType"),
    ]
      .filter(Boolean)
      .join(" ");
    return target
      ? `${target} için ${svc} arıyorum.`
      : `${svc} arıyorum.`;
  }
  if (wholeProductComposerAllowed && isTv(state)) return composeTv(state);
  if (wholeProductComposerAllowed && isVacuum(state)) return composeVacuum(state);

  const role = resolveBrowseSemanticRole({
    categoryId: state.categoryId,
    subcategorySlug: state.subcategorySlug,
    taxonomyNodeId: state.taxonomyNodeId,
    productType:
      fieldValue(state, "applianceType") ??
      fieldValue(state, "productType") ??
      fieldValue(state, "machineType"),
  });

  if (role.compositionMode === "compatibility_part") {
    // Otomotiv bestecisi YALNIZ canonical alan otomotivken yetkilidir (KB-10).
    if (isAutomotiveDomain(state)) {
      return composeAutoPart(state);
    }
    return composeCompatibilityPartSentence({
      brand: fieldValue(state, "brand"),
      model: fieldValue(state, "model"),
      generation: fieldValue(state, "generation"),
      // Üst ürün zinciri TEK yerde: machineType da buradan gelir, yoksa bu
      // daldan geçen sanayi makinesi parçası üst makine adını kaybeder.
      parentProduct: compatibilityParentProduct(state),
      part: fieldValue(state, "part"),
      fallbackNoun: role.subjectNounTr ?? "yedek parça",
    });
  }

  if (role.compositionMode === "service") {
    const brand = fieldValue(state, "brand");
    const model = fieldValue(state, "model");
    const target = [brand, model].filter(Boolean).join(" ");
    const subject =
      fieldValue(state, "serviceType") ?? role.subjectNounTr ?? "bakım";
    if (target) return `${target} için ${subject} arıyorum.`;
    return `${subject} arıyorum.`;
  }

  // `isAutoPart` tek başına otomotiv KANITI DEĞİLDİR (KB-10): needType=part her
  // kategoride true olabilir. Kategori otoritesi olmadan bu rota beyaz eşya ve
  // makine parçalarını da yutuyordu.
  if (isAutomotiveDomain(state) && isAutoPart(state)) {
    return composeAutoPart(state);
  }
  if (isAutoVehicle(state)) return composeAutoVehicle(state);
  // Bütün-varlık bestecisi de uyumluluk talebini sahiplenemez (1C kuralının
  // aynısı): "Daire için kapı kolu arıyorum" → "konut arıyorum." oluyordu.
  if (wholeProductComposerAllowed && composeDomainId(state) === "real-estate") {
    return composeRealEstate(state);
  }
  // Otomotiv dışı uyumluluk parçası: üst ürün cümlede kalmalı (KB-10).
  const nonAutomotivePart = composeNonAutomotiveCompatibilityPart(state, role);
  if (nonAutomotivePart) return nonAutomotivePart;
  if (isFurniture(state)) return composeFurniture(state);
  if (isAppliances(state)) return composeAppliances(state);
  if (
    role.compositionMode === "whole_product" &&
    (state.categoryId === "machinery" || state.categoryId === "industrial")
  ) {
    const bits = [
      fieldValue(state, "brand"),
      fieldValue(state, "machineType") ?? fieldValue(state, "productType"),
      fieldValue(state, "model"),
    ].filter(Boolean);
    if (bits.length) return `${bits.join(" ")} arıyorum.`;
    return `${role.subjectNounTr ?? "makine"} arıyorum.`;
  }
  return composeGeneric(state);
}

/** Compose natural request from live browse cascade stack (category → leaf). */
export function composeTextFromBrowseStack(
  stack: Array<{ kind: string; label: string }>,
  opts?: {
    categoryId?: string | null;
    subcategorySlug?: string | null;
  },
): string {
  if (!stack.length) return "";

  const sub =
    [...stack].reverse().find((n) => n.kind === "subcategory") ?? null;
  const subcategorySlug =
    opts?.subcategorySlug ??
    (sub
      ? sub.label
          .toLocaleLowerCase("tr-TR")
          .replace(/ğ/g, "g")
          .replace(/ü/g, "u")
          .replace(/ş/g, "s")
          .replace(/ı/g, "i")
          .replace(/ö/g, "o")
          .replace(/ç/g, "c")
          .replace(/\s+/g, "-")
      : null);

  const categoryId =
    opts?.categoryId ??
    stack.find((n) => n.kind === "category")?.label ??
    null;

  const resolvedCategoryId = (() => {
    if (opts?.categoryId) return opts.categoryId;
    if (typeof categoryId !== "string") return null;
    const fold = categoryId.toLocaleLowerCase("tr-TR");
    if (fold === "otomotiv" || categoryId === "automotive") return "automotive";
    if (fold === "makine" || categoryId === "machinery") return "machinery";
    if (fold.includes("beyaz") || fold === "appliances") return "appliances";
    if (!categoryId.includes(" ") && !categoryId.includes("·")) return categoryId;
    return null;
  })();

  const resolvedSubSlug = opts?.subcategorySlug ?? subcategorySlug;

  // Prefer structured slug when caller passes it (composer walk).
  const role = resolveBrowseSemanticRole({
    categoryId: resolvedCategoryId,
    subcategorySlug: resolvedSubSlug,
  });

  const brand = [...stack].reverse().find((n) => n.kind === "brand");
  const model = [...stack].reverse().find((n) => n.kind === "model");
  const generation = [...stack].reverse().find((n) => n.kind === "generation");
  const part = [...stack].reverse().find((n) => n.kind === "part");
  const product = [...stack]
    .reverse()
    .find(
      (n) =>
        n.kind === "product_type" ||
        n.kind === "service_type" ||
        n.kind === "commodity_type",
    );
  const group = [...stack].reverse().find((n) => n.kind === "group");
  const cat = stack.find((n) => n.kind === "category");

  if (role.compositionMode === "compatibility_part") {
    return composeCompatibilityPartSentence({
      brand: brand?.label ?? null,
      model: model?.label ?? null,
      generation: generation?.label ?? null,
      part: part?.label?.toLocaleLowerCase("tr-TR") ?? null,
      fallbackNoun: role.subjectNounTr ?? "yedek parça",
    });
  }

  if (role.compositionMode === "service") {
    const target = [brand?.label, model?.label].filter(Boolean).join(" ");
    const subject = product?.label ?? role.subjectNounTr ?? "bakım";
    if (target) return `${target} için ${subject} arıyorum.`;
    return `${subject} arıyorum.`;
  }

  if (role.compositionMode === "whole_product") {
    const bits = [brand?.label, model?.label, generation?.label].filter(Boolean);
    if (bits.length) return `${bits.join(" ")} arıyorum.`;
  }

  const subject =
    part?.label ??
    product?.label ??
    brand?.label ??
    group?.label ??
    sub?.label ??
    cat?.label ??
    "";
  if (!subject.trim()) return "";
  return `${subject.trim()} arıyorum.`;
}
