/**
 * CEVAP DÜZELTME EŞİTLİĞİ — TEK DOĞRULAYICI (2026-08-30).
 *
 * Sözleşme tek cümledir: bir alanın normal soru yolunda hangi kontrol,
 * hangi seçenekler ve hangi serbest-cevap izni üretiliyorsa, o alanın
 * DÜZELTME yüzeyi de aynısını almalıdır. İki yüzeyin ayrışması sessizdir
 * ve kullanıcıya farklı bir cevap evreni gösterir.
 *
 * NEDEN AYRI BİR KAPI. Düzeltme yüzeyi cevaplanmış alanı açar; o alan
 * zamanlayıcıdan bilinçli olarak düşmüştür (kanonik değer soruyu kapatır)
 * ve bu bastırma GEVŞETİLMEZ. Bu yüzden düzeltme kontrolünü ayrı bir
 * çağrı çözer — ve tam bu yüzden, ayrı çağrının normal yolla aynı
 * bağlamı okuduğunu kanıtlayan kalıcı bir kapı gerekir. Ölçüldü
 * (2026-08-30): satır içi kopya `printing/quantity` alanında normal
 * yoldan farklı bir kaçış seçeneği üretiyordu.
 */
import {
  resolveEditQuestion,
  scheduledToFocusedQuestion,
} from "@/lib/request-composer/v2/focused-questions";
import {
  listAllProfiles,
  resolveProfileForField,
} from "@/lib/request-composer/v2/question-profiles";
import {
  planAnswerApplication,
  projectUserAnswers,
} from "@/lib/request-composer/v2/answer-apply-plan";
import type { QuestionControlDef } from "@/lib/request-composer/v2/question-control-types";
import type { ScheduledQuestion } from "@/lib/request-composer/v2/question-profile-types";
import type { CanonicalFieldState } from "@/lib/request-composer/types";

let kapi = 0;
let sorun = 0;
const ok = (ad: string, kosul: boolean, detay?: unknown) => {
  kapi++;
  if (!kosul) {
    sorun++;
    console.log(`  ✗ ${ad}` + (detay === undefined ? "" : ` ${JSON.stringify(detay)}`));
  }
};

/** Kontrolün karşılaştırılabilir tam imzası: tip, sıra, label/value, izin. */
const imza = (c: QuestionControlDef | undefined | null) =>
  JSON.stringify({
    tip: c?.controlType ?? null,
    secenekler: (c?.options ?? []).map((o) => [o.value, o.label]),
    kacislar: (c?.softOptions ?? []).map((o) => [o.value, o.label]),
    serbest: c?.allowCustom ?? null,
    birim: c?.unit ?? null,
    butceTemeli: c?.budgetBasis ?? null,
  });

/** Zamanlayıcının ürettiğiyle aynı ara sözleşme — normal yolun aynası. */
function normalQuestion(input: {
  fieldKey: string;
  categoryId: string;
  productType?: string | null;
  needType?: string | null;
}) {
  const profile = resolveProfileForField({
    fieldKey: input.fieldKey,
    categoryId: input.categoryId,
    needType: input.needType ?? null,
    productType: input.productType ?? null,
  });
  if (!profile) return null;
  const scheduled: ScheduledQuestion = {
    fieldKey: input.fieldKey,
    prompt: profile.prompt,
    summaryLabel: profile.summaryLabel,
    importance: profile.importance,
    allowUnknown: Boolean(profile.allowUnknown),
    allowDontCare: Boolean(profile.allowDontCare),
    inputHint: profile.inputHint ?? "text",
    budgetBasis: profile.budgetBasis,
    priorityScore: 0.5,
    quickChoices: profile.quickChoices,
    escapeChoices: [],
    categoryId: input.categoryId,
  };
  return scheduledToFocusedQuestion(scheduled, undefined, {
    productType: input.productType ?? null,
    needType: input.needType ?? null,
    isRemoteService: false,
    listingType: null,
  });
}

const durum = (fields: Record<string, CanonicalFieldState>) =>
  ({ version: "hybrid-v1", fields } as never);

console.log("A) fridgeType — normal yol ile düzeltme yolu birebir aynı");
{
  const normal = normalQuestion({
    fieldKey: "fridgeType",
    categoryId: "appliances",
    productType: "buzdolabi",
  });
  const edit = resolveEditQuestion({
    state: null,
    fieldKey: "fridgeType",
    categoryId: "appliances",
    productType: "buzdolabi",
  });
  ok("düzeltme çözülebiliyor", edit.status === "ready", edit);
  if (edit.status === "ready" && normal) {
    ok("kontrol imzası birebir aynı", imza(normal.control) === imza(edit.question.control), {
      normal: imza(normal.control),
      edit: imza(edit.question.control),
    });
    ok("kontrol tipi single_choice", edit.question.control?.controlType === "single_choice",
      edit.question.control?.controlType);
    ok("serbest cevap yolu açık", edit.question.control?.allowCustom === true);
    const beklenen = ["No-Frost", "Alttan donduruculu", "Gardrop tipi", "Mini"];
    const gelen = (edit.question.control?.options ?? [])
      .filter((o) => o.value !== "__custom__")
      .map((o) => o.value);
    ok("dört kanonik seçenek kayıpsız ve aynı sırada",
      JSON.stringify(gelen) === JSON.stringify(beklenen), gelen);
  }
}

console.log("B) 37 profil alanında normal/düzeltme drift'i sıfır");
{
  let olculen = 0;
  for (const p of listAllProfiles()) {
    if (!p.quickChoices || p.quickChoices.length === 0) continue;
    olculen++;
    const categoryId = p.categories?.[0] ?? "technology";
    const productType = p.whenProductTypes?.[0] ?? null;
    const normal = normalQuestion({ fieldKey: p.fieldKey, categoryId, productType });
    const edit = resolveEditQuestion({
      state: null,
      fieldKey: p.fieldKey,
      categoryId,
      productType,
    });
    ok(`drift ${categoryId}/${p.fieldKey}`,
      edit.status === "ready" && imza(normal?.control) === imza(edit.question.control),
      edit.status === "ready"
        ? { normal: imza(normal?.control), edit: imza(edit.question.control) }
        : edit);
  }
  ok("ölçülen quickChoices alanı 37", olculen === 37, olculen);
}

console.log("C) Kanonik kontrol çözülemiyorsa fail-closed — uydurma metin kutusu yok");
{
  const yok = resolveEditQuestion({
    state: null,
    fieldKey: "boyleBirAlanYok",
    categoryId: "appliances",
  });
  ok("profilsiz alan unavailable", yok.status === "unavailable", yok);
  ok("gerekçe taşınır",
    yok.status === "unavailable" && yok.reason === "no_profile", yok);
}

console.log("D) ANY / UNKNOWN kaçışları düzeltme yüzeyinde de çalışır");
{
  const edit = resolveEditQuestion({
    state: null,
    fieldKey: "condition",
    categoryId: "appliances",
  });
  ok("condition ready", edit.status === "ready", edit);
  if (edit.status === "ready") {
    ok("kaçış seçeneği taşınır",
      (edit.question.control?.softOptions.length ?? 0) >= 1,
      edit.question.control?.softOptions);
    ok("kaçışlar değer seçeneklerine karışmaz",
      (edit.question.control?.options ?? []).every((o) => !o.soft));
  }
}

console.log("E) Düzeltme kanonik durumdaki mevcut değeri okur, üretmez");
{
  const st = durum({
    fridgeType: { kind: "VALUE", value: "No-Frost", provenance: "EXPLICIT_BROWSE" },
  });
  const dolu = resolveEditQuestion({
    state: st, fieldKey: "fridgeType", categoryId: "appliances", productType: "buzdolabi",
  });
  const bos = resolveEditQuestion({
    state: null, fieldKey: "fridgeType", categoryId: "appliances", productType: "buzdolabi",
  });
  ok("mevcut değer okunur", dolu.status === "ready" && dolu.currentValue === "No-Frost", dolu);
  ok("cevapsız durumda değer boş", bos.status === "ready" && bos.currentValue === null, bos);
  ok("cevap durumu soruyu DEĞİŞTİRMEZ",
    dolu.status === "ready" && bos.status === "ready" &&
      imza(dolu.question.control) === imza(bos.question.control));
}

console.log("F) No-Frost → Mini tek satırı günceller, sayaç değişmez");
{
  const once: Record<string, CanonicalFieldState> = {
    fridgeType: { kind: "VALUE", value: "No-Frost", provenance: "EXPLICIT_BROWSE" },
    city: { kind: "VALUE", value: "İstanbul", provenance: "EXPLICIT_BROWSE" },
  };
  const ortak = { title: "", quantity: "", city: "", delivery: "", budget: "" };
  const oncekiSatirlar = projectUserAnswers({
    fields: once, commonDraft: ortak, touchedCommonKeys: [], categoryId: "appliances",
  });

  const plan = planAnswerApplication({
    fieldKey: "fridgeType",
    rawValue: "Mini",
    categoryId: "appliances",
  } as never);
  ok("uygulama planı üretildi", Boolean(plan), plan);

  const sonra: Record<string, CanonicalFieldState> = {
    ...once,
    fridgeType: { kind: "VALUE", value: "Mini", provenance: "EXPLICIT_BROWSE" },
  };
  const sonrakiSatirlar = projectUserAnswers({
    fields: sonra, commonDraft: ortak, touchedCommonKeys: [], categoryId: "appliances",
  });

  const fridgeSatirlari = sonrakiSatirlar.filter((r) => r.fieldKey === "fridgeType");
  ok("aynı alan tek satır", fridgeSatirlari.length === 1, fridgeSatirlari);
  ok("satır yeni değeri gösterir",
    fridgeSatirlari[0]?.displayValue === "Mini", fridgeSatirlari[0]);
  ok("eski değer hiçbir satırda kalmaz",
    sonrakiSatirlar.every((r) => !String(r.displayValue).includes("No-Frost")),
    sonrakiSatirlar.map((r) => r.displayValue));
  ok("yanıt sayısı değişmez",
    sonrakiSatirlar.length === oncekiSatirlar.length,
    [oncekiSatirlar.length, sonrakiSatirlar.length]);
}

console.log("G) Mutasyon kontrolü — imza karşılaştırması gerçekten ayrım yapıyor");
{
  const a = resolveEditQuestion({
    state: null, fieldKey: "fridgeType", categoryId: "appliances", productType: "buzdolabi",
  });
  const b = resolveEditQuestion({
    state: null, fieldKey: "condition", categoryId: "appliances",
  });
  ok("farklı alanların imzası farklı olmalı",
    a.status === "ready" && b.status === "ready" &&
      imza(a.question.control) !== imza(b.question.control));
}

console.log(`\nkapi=${kapi} sorun=${sorun}`);
console.log(sorun === 0 ? "SONUC=GECTI" : "SONUC=KALDI");
process.exit(sorun === 0 ? 0 : 1);
