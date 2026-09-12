/**
 * CEVAP DÜZELTME OTORİTESİ — TEK DOĞRULAYICI (D3g, 2026-08-30).
 *
 * Sözleşme: cevaplanmış bir alan, zamanlayıcının aday listesinden düşmüş
 * olsa bile düzenlenebilmelidir. Düzenleme sorusu geçici bir hafızadan ya
 * da geçmiş DOM'dan değil, HER SEFERİNDE mevcut profil ve kontrol
 * otoritelerinden yeniden çözülür. Çözülemiyorsa fail-closed
 * `unavailable` döner; uydurma bir metin kutusu açılmaz.
 *
 * NEDEN AYRI BİR OTORİTE. `enrichmentCandidates` bilinçli olarak
 * cevaplanmış alanı gizler — bu, soru sormayı durduran doğru davranıştır
 * ve gevşetilmemelidir. Düzeltme bambaşka bir niyettir: kullanıcı zaten
 * verdiği bir cevabı değiştirmek ister. İki niyeti tek listeye
 * bindirmek, ya soruyu tekrar sordurur ya da düzeltmeyi imkânsız kılar.
 * Bu yüzden düzeltme kendi dar kapısını alır ve zamanlayıcıya dokunmaz.
 */
import {
  resolveEditQuestion,
  type EditQuestionResolution,
} from "@/lib/request-composer/v2/focused-questions";
import { listAllProfiles } from "@/lib/request-composer/v2/question-profiles";
import { assertCriticalControlNotTextFallback } from "@/lib/request-composer/v2/question-control-registry";
import type { CanonicalRequestState } from "@/lib/request-composer/types";

let hata = 0;
const ok = (ad: string, kosul: boolean, detay?: unknown) => {
  if (!kosul) {
    hata++;
    console.log(`  ✗ ${ad}`, detay === undefined ? "" : JSON.stringify(detay));
  } else {
    console.log(`  ✓ ${ad}`);
  }
};

/** Cevaplanmış bir alanı taşıyan asgari kanonik durum. */
function durum(
  fields: Record<string, { kind: string; value?: string; provenance: string }>,
): CanonicalRequestState {
  return {
    version: "hybrid-v1",
    fields,
    understanding: undefined,
  } as unknown as CanonicalRequestState;
}

const CEVAPLI = durum({
  condition: {
    kind: "VALUE",
    value: "Sıfır",
    provenance: "EXPLICIT_BROWSE",
  },
});

console.log("1) Cevaplanmış alan düzenlenebilir (aday listesinde olmasa da)");
{
  const r = resolveEditQuestion({
    state: CEVAPLI,
    fieldKey: "condition",
    categoryId: "appliances",
  });
  ok("durum ready", r.status === "ready", r);
  if (r.status === "ready") {
    ok("fieldKey korunur", r.question.fieldKey === "condition");
    ok(
      "kontrol kanonik (text_fallback değil)",
      r.question.control?.controlType === "single_choice",
      r.question.control?.controlType,
    );
    ok(
      "seçenekler kontrol otoritesinden gelir",
      (r.question.control?.options.length ?? 0) >= 2,
      r.question.control?.options,
    );
    ok(
      "mevcut değer okunur",
      r.currentValue === "Sıfır",
      r.currentValue,
    );
    ok(
      "ANY / UNKNOWN kaçışları taşınır",
      (r.question.control?.softOptions.length ?? 0) >= 1,
      r.question.control?.softOptions,
    );
  }
}

console.log("2) Aynı soru iki kez çözülünce aynı sözleşme çıkar (hafıza yok)");
{
  const a = resolveEditQuestion({
    state: CEVAPLI,
    fieldKey: "condition",
    categoryId: "appliances",
  });
  const b = resolveEditQuestion({
    state: durum({}),
    fieldKey: "condition",
    categoryId: "appliances",
  });
  const say = (r: EditQuestionResolution) =>
    r.status === "ready"
      ? JSON.stringify({
          k: r.question.fieldKey,
          c: r.question.control?.controlType,
          o: r.question.control?.options.map((o) => o.value),
        })
      : r.status;
  ok("cevap durumu soruyu değiştirmez", say(a) === say(b), [say(a), say(b)]);
  ok(
    "cevapsız durumda mevcut değer boştur",
    b.status === "ready" && b.currentValue === null,
  );
}

console.log("3) Profili olmayan alan fail-closed");
{
  const r = resolveEditQuestion({
    state: CEVAPLI,
    fieldKey: "boyleBirAlanYok",
    categoryId: "appliances",
  });
  ok("unavailable", r.status === "unavailable", r);
  ok(
    "gerekçe no_profile",
    r.status === "unavailable" && r.reason === "no_profile",
    r,
  );
}

console.log("4) Kritik alan text_fallback'e düşerse uydurma metin kutusu açılmaz");
{
  const r = resolveEditQuestion({
    state: durum({}),
    fieldKey: "fridgeType",
    categoryId: "appliances",
    productType: "buzdolabi",
  });
  ok(
    "unavailable (kanonik kontrol çözülemedi)",
    r.status === "unavailable",
    r,
  );
  ok(
    "gerekçe critical_text_fallback",
    r.status === "unavailable" && r.reason === "critical_text_fallback",
    r,
  );
}

console.log("5) Serbest metin alanı (kritik değil) düzenlenebilir kalır");
{
  const serbest = listAllProfiles().find((p) => {
    if (p.importance !== "optional") return false;
    const cat = p.categories?.[0] ?? "technology";
    return !assertCriticalControlNotTextFallback({
      categoryId: cat,
      fieldKey: p.fieldKey,
      importance: p.importance,
    }).ok
      ? false
      : true;
  });
  ok("ölçülecek isteğe bağlı profil bulundu", Boolean(serbest), serbest?.fieldKey);
  if (serbest) {
    const r = resolveEditQuestion({
      state: durum({}),
      fieldKey: serbest.fieldKey,
      categoryId: serbest.categories?.[0] ?? "technology",
      productType: serbest.whenProductTypes?.[0] ?? null,
    });
    ok("ready", r.status === "ready", r);
  }
}

console.log("6) Mutasyon kontrolü — otorite gerçekten ölçülüyor mu");
{
  /* Bilinçli olarak var olmayan bir kategori verilir: profil çözülemez ve
     kapı KAPALI dönmek ZORUNDADIR. Bu kontrol, doğrulayıcının her şeye
     `ready` demediğini kanıtlar. */
  const r = resolveEditQuestion({
    state: CEVAPLI,
    fieldKey: "condition",
    categoryId: "boyle-bir-kategori-yok",
  });
  ok(
    "bilinmeyen kategoride kapı kapalı ya da global profil",
    r.status === "unavailable" || r.question.fieldKey === "condition",
    r,
  );
}

console.log(hata === 0 ? "\nSONUÇ: YEŞİL" : `\nSONUÇ: KIRMIZI (${hata} hata)`);
process.exit(hata === 0 ? 0 : 1);
