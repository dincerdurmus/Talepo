/**
 * KATEGORİ ONAY ADIMI — KAPILAR (kurucu kararı, 2026-09-12).
 *
 * Kilitlenen kural: motor güvenle karar verse bile kullanıcıya önce
 * "Bunu X olarak değerlendiriyorum, doğru mu?" sorulur; "Bu değil" denince
 * makine ikinci tahmin yapmaz, kullanıcı 11 kök kategoriden birini seçer.
 * Model TEK yerden kurulur ve standart form ile Maira aynı nesneyi çizer.
 *
 * Kapılar gerçek üretim fonksiyonları üzerinde koşar: kategori kararını
 * `understandRequest` + `resolveSchemaCategory` verir, model
 * `buildCategoryConfirmation` ile kurulur. Kaynak kapıları iki yüzeyin de
 * kendi kategori mantığı kurmadığını okur.
 *
 * Çalıştırma: npx tsx scripts/verify-category-confirmation-v1.ts
 */
import { readFileSync } from "node:fs";

import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import {
  buildCategoryChoice,
  buildCategoryConfirmation,
  categoryConfirmationPrompt,
  categoryConfirmationToGuidanceSelection,
  listRootCategoryChoices,
  type CategoryConfirmationInput,
} from "../src/lib/request-composer/v2/category-confirmation";
import { categoryGuidanceToUserChoice } from "../src/lib/request-composer/v2/category-guidance";
import { resolveSchemaCategory } from "../src/lib/request-understanding/activation-bridge";
import { understandRequest } from "../src/lib/request-understanding/understand-request";

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

ensureAutomotiveCatalogRegistered();
ensureTaxonomyLoaded();

function inputFor(
  text: string,
  overrides: Partial<CategoryConfirmationInput> = {},
): CategoryConfirmationInput {
  const ru = understandRequest({ rawInput: text });
  const schema = resolveSchemaCategory(ru);
  return {
    rawText: text,
    isSyncing: false,
    categoryConfident: schema.confident,
    categoryLockedByUser: false,
    categoryUserChoice: null,
    categoryId: schema.categoryId,
    displayLabelSafe: schema.displayLabelSafe,
    subcategoryLabel: null,
    ...overrides,
  };
}

/* A — 11 kök kategori listesi tek yerden ve eksiksiz */
{
  const roots = listRootCategoryChoices("automotive");
  const ids = roots.map((r) => r.id);
  check("A1 kök listesi 11 kategori", roots.length === 11, String(roots.length));
  check(
    "A2 kök listesi REQUEST_CATEGORIES sırası",
    ids.join("|") === REQUEST_CATEGORIES.map((c) => c.id).join("|"),
    ids.join("|"),
  );
  check(
    "A3 sistem slug'ı yok",
    !ids.includes("unresolved") && !ids.includes("unknown") && !ids.includes(""),
  );
  check(
    "A4 şu anki tahmin işaretli, gizli değil",
    roots.filter((r) => r.current).map((r) => r.id).join() === "automotive",
  );
  check(
    "A5 etiketler slug değil",
    roots.every((r) => r.label.trim().length > 0 && r.label !== r.id),
  );
}

/* B — güvenli kararda kart kurulur; cümle yolu söyler */
const CONFIDENT_CASES: Array<{ text: string; category: string }> = [
  { text: "Arçelik televizyon arıyorum 55 inç", category: "technology" },
  { text: "no-frost buzdolabı arıyorum İstanbul", category: "appliances" },
  { text: "Kadıköy'de kiralık 2+1 daire arıyorum", category: "real-estate" },
  { text: "500 adet kartvizit bastırmak istiyorum", category: "printing" },
  { text: "bebek arabası arıyorum", category: "baby" },
];
for (const c of CONFIDENT_CASES) {
  const input = inputFor(c.text);
  const model = buildCategoryConfirmation(input);
  check(
    `B1 ${c.category} kart var`,
    model !== null,
    `confident=${input.categoryConfident} id=${input.categoryId}`,
  );
  if (!model) continue;
  check(`B2 ${c.category} kategori doğru`, model.categoryId === c.category, model.categoryId);
  check(
    `B3 ${c.category} cümle yolu söyler`,
    model.prompt === categoryConfirmationPrompt(model.pathLabel) &&
      model.prompt.includes(model.categoryLabel) &&
      /doğru mu\?$/.test(model.prompt),
    model.prompt,
  );
  check(
    `B4 ${c.category} slug kullanıcıya gösterilmez`,
    !model.prompt.includes(c.category),
    model.prompt,
  );
  check(`B5 ${c.category} kök listesi 11`, model.rootChoices.length === 11);
}

/* C — alt kategori etiketi yola girer */
{
  const model = buildCategoryConfirmation(
    inputFor("BMW 320i için fren balatası arıyorum", {
      subcategoryLabel: "Yedek Parça",
    }),
  );
  check("C1 otomotiv kart var", model !== null);
  check(
    "C2 yol 'Otomotiv › Yedek Parça'",
    model?.pathLabel === "Otomotiv › Yedek Parça",
    model?.pathLabel,
  );
  check(
    "C3 cümle alt kategoriyi söyler",
    model?.prompt.includes("Otomotiv › Yedek Parça") === true,
    model?.prompt,
  );
}

/*
 * C4–C5 — KÖK ADIYLA AYNI ALT KATEGORİ YOLU TEKRARLAMAZ (2026-09-25).
 *
 * Tarayıcıda ölçüldü: taksonomide kök adını taşıyan bir alt kategori var ve
 * yol etiketi bunu körü körüne birleştirince kullanıcıya "Bunu Beyaz Eşya ›
 * Beyaz Eşya olarak değerlendiriyorum, doğru mu?" diye soruluyordu — cümle
 * kendi kendini tekrar ediyor ve onay adımını gülünç gösteriyor.
 */
{
  const same = buildCategoryConfirmation(
    inputFor("Arçelik buzdolabı arıyorum, İstanbul Kadıköy", {
      categoryId: "appliances",
      subcategoryLabel: "Beyaz Eşya",
    }),
  );
  check(
    "C4 kök adıyla aynı alt kategori yola eklenmez",
    same?.pathLabel === "Beyaz Eşya",
    same?.pathLabel,
  );
  check(
    "C5 onay cümlesi kendini tekrar etmez",
    same?.prompt.includes("›") === false,
    same?.prompt,
  );
}

/* D — kart kurulmayan durumlar */
{
  const base = inputFor("Arçelik televizyon arıyorum 55 inç");
  check("D1 boş metin → yok", buildCategoryConfirmation({ ...base, rawText: "  " }) === null);
  check("D2 senkron sürerken → yok", buildCategoryConfirmation({ ...base, isSyncing: true }) === null);
  check(
    "D3 kullanıcı kilitlediyse → yok",
    buildCategoryConfirmation({ ...base, categoryLockedByUser: true }) === null,
  );
  check(
    "D4 rehberlikte karar verildiyse → yok",
    buildCategoryConfirmation({ ...base, categoryUserChoice: "picked_candidate" }) === null &&
      buildCategoryConfirmation({ ...base, categoryUserChoice: "defer_to_talepo" }) === null,
  );
  check(
    "D5 güvensiz karar → yok (rehberlik kartı sürer)",
    buildCategoryConfirmation({ ...base, categoryConfident: false }) === null,
  );
  check(
    "D6 etiket güvensiz → yok",
    buildCategoryConfirmation({ ...base, displayLabelSafe: false }) === null,
  );
  check(
    "D7 sistem slug'ı → yok",
    buildCategoryConfirmation({ ...base, categoryId: "unresolved" }) === null &&
      buildCategoryConfirmation({ ...base, categoryId: "" }) === null,
  );
  const vague = inputFor("bir şey lazım");
  check(
    "D8 belirsiz metin → yok",
    buildCategoryConfirmation(vague) === null,
    `confident=${vague.categoryConfident} id=${vague.categoryId}`,
  );
}

/* E — dokunuşlar kanonik rehberlik seçimine çevrilir */
{
  const model = buildCategoryConfirmation(inputFor("no-frost buzdolabı arıyorum"));
  check("E0 kart var", model !== null);
  if (model) {
    const yes = categoryConfirmationToGuidanceSelection(model, { kind: "confirm" });
    check(
      "E1 Evet → aynı kategori, picked_candidate",
      yes?.kind === "candidate" &&
        yes.slug === model.categoryId &&
        categoryGuidanceToUserChoice(yes) === "picked_candidate",
      JSON.stringify(yes),
    );
    const pick = categoryConfirmationToGuidanceSelection(model, {
      kind: "pick_root",
      categoryId: "home-kitchen",
    });
    check(
      "E2 kök seçimi → seçilen kategori, picked_candidate",
      pick?.kind === "candidate" &&
        pick.slug === "home-kitchen" &&
        categoryGuidanceToUserChoice(pick) === "picked_candidate",
      JSON.stringify(pick),
    );
    check(
      "E3 listede olmayan kök reddedilir",
      categoryConfirmationToGuidanceSelection(model, {
        kind: "pick_root",
        categoryId: "unresolved",
      }) === null,
    );
    check(
      "E4 Bu değil / Vazgeç kategoriye dokunmaz",
      categoryConfirmationToGuidanceSelection(model, { kind: "reject" }) === null &&
        categoryConfirmationToGuidanceSelection(model, { kind: "back" }) === null,
    );
  }
}

/* G — belirsiz durum: aynı adım, "choose" modu */
{
  const guidance = {
    candidates: [
      { slug: "automotive", label: "Otomotiv", description: "Araç ve parça" },
      { slug: "machinery", label: "Makine", description: "Sanayi makineleri" },
    ],
  };
  const model = buildCategoryChoice({ guidance, categoryId: "automotive" });
  check("G1 belirsizde adım var", model !== null);
  if (model) {
    check("G2 mod choose", model.mode === "choose", model.mode);
    check("G3 adaylar kanonik listeden taşınır", model.candidates.map((c) => c.id).join("|") === "automotive|machinery");
    check("G4 zayıf tahmin işaretli", model.candidates.filter((c) => c.current).map((c) => c.id).join() === "automotive");
    check("G5 kök listesi yine 11", model.rootChoices.length === 11);
    check("G6 'hiçbiri' etiketi var", model.rejectLabel.trim().length > 0 && model.rejectLabel !== model.confirmLabel);
    check(
      "G7 choose modunda uydurma onay yok",
      categoryConfirmationToGuidanceSelection(model, { kind: "confirm" }) === null,
    );
    const picked = categoryConfirmationToGuidanceSelection(model, {
      kind: "pick_root",
      categoryId: "machinery",
    });
    check(
      "G8 aday seçimi picked_candidate",
      picked?.kind === "candidate" &&
        picked.slug === "machinery" &&
        categoryGuidanceToUserChoice(picked) === "picked_candidate",
      JSON.stringify(picked),
    );
    check(
      "G9 listede olmayan slug reddedilir",
      categoryConfirmationToGuidanceSelection(model, { kind: "pick_root", categoryId: "unresolved" }) === null,
    );
  }
  check("G10 aday yoksa adım da yok", buildCategoryChoice({ guidance: { candidates: [] } }) === null);
  check(
    "G11 sistem slug'ı aday olamaz",
    buildCategoryChoice({
      guidance: { candidates: [{ slug: "unresolved", label: "Belirsiz", description: "-" }] },
    }) === null,
  );
  const confirmModel = buildCategoryConfirmation(inputFor("no-frost buzdolabı arıyorum"));
  check("G12 confirm modunda aday listesi boş", confirmModel?.candidates.length === 0);
}

/* H — YAYIN KAPISI DEĞİŞMEZ: kategori onayı zorunlu değil (kurucu) */
{
  const src = readFileSync("src/lib/request-composer/v2/publish-readiness.ts", "utf8");
  check(
    "H1 yayın hazırlığı kategori onayını okumaz",
    !/categoryUserChoice|categoryConfirmation|categoryLockedByUser/.test(src),
    "publish-readiness kategori onayına bakıyor",
  );
  const page = readFileSync("src/app/talep/page.tsx", "utf8");
  const call = /computeComposerPublishReadiness\(\{[\s\S]*?\}\)/.exec(page)?.[0] ?? "";
  check(
    "H2 sayfa yayın hazırlığına kategori onayı geçirmez",
    call.length > 0 && !/categoryUserChoice|categoryConfirmation/.test(call),
    call.slice(0, 200),
  );
}

/* F — kaynak kapıları: tek beyin, iki yüzey */
{
  const read = (p: string) => {
    try {
      return readFileSync(p, "utf8");
    } catch {
      return null;
    }
  };
  /* Kaynak kapıları KODU okur, açıklamayı değil: yorumlar ayıklanır. */
  const stripComments = (src: string | null) =>
    src === null
      ? null
      : src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const page = stripComments(read("src/app/talep/page.tsx"));
  const maira = stripComments(read("src/components/request/maira/MairaStage.tsx"));
  const card = stripComments(read("src/components/request/v2/CategoryConfirmationCard.tsx"));
  const panel = stripComments(read("src/components/request/v2/FocusedQuestionsPanel.tsx"));

  check("F0 kaynaklar mevcut", Boolean(page && maira && card && panel));
  if (page && maira && card && panel) {
    check(
      "F1 modeli yalnız sayfa kurar",
      page.includes("buildCategoryConfirmation(") &&
        !maira.includes("buildCategoryConfirmation") &&
        !card.includes("buildCategoryConfirmation"),
    );
    check(
      "F2 iki yüzey aynı modeli alır",
      /categoryStep=\{categoryStepForMaira\}/.test(page) &&
        /categoryStepForMaira = categoryConfirmation \?\? categoryChoice/.test(page) &&
        /<CategoryConfirmationCard[\s\S]*?model=\{categoryConfirmation\}/.test(page),
    );
    check(
      "F3 iki yüzey aynı işleyiciye gider",
      /onCategoryAction=\{applyCategoryConfirmation\}/.test(page) &&
        /onAction=\{applyCategoryConfirmation\}/.test(page),
    );
    check(
      "F4 Maira kendi kategori mantığı kurmaz",
      !/request-category-engine|understand-request|category-guidance"/.test(maira) &&
        !/değerlendiriyorum/.test(maira),
      "MairaStage kategori kuralı ya da cümle içeriyor",
    );
    check(
      "F5 kart kendi kategori mantığı kurmaz",
      !/request-category-engine|understand-request|REQUEST_CATEGORIES/.test(card) &&
        !/değerlendiriyorum/.test(card),
    );
    check(
      "F6 'Bu değil' görünümü sayfa state'i",
      /categoryRejectedFor/.test(page) &&
        /categoryRejected=\{categoryRejected\}/.test(page) &&
        /rejected=\{categoryRejected\}/.test(page),
    );
    check(
      "F7 metin değişince görünüm sıfırlanır",
      /function clearCategoryOverridesOnTextEdit\(\) \{[\s\S]*?setCategoryRejectedFor\(null\)/.test(page),
    );
    check(
      "F8 Maira aşama başlığını şemadan alır",
      /phaseHeading=\{focusedQuestionSchedule\.phaseHeading\}/.test(page) &&
        (page.match(/phaseHeading=\{focusedQuestionSchedule\.phaseHeading\}/g) ?? []).length >= 2 &&
        /phaseHeading/.test(maira) &&
        !/Teklif için iki bilgi yeterli|Talebi detaylandır/.test(maira),
      "Maira aşama başlığını ya almıyor ya da kendi metnini yazıyor",
    );
    check(
      "F9 Maira 11 kökü modelden çizer",
      /categoryStep\.rootChoices/.test(maira) && !/REQUEST_CATEGORIES/.test(maira),
    );
    check(
      "F13 Maira adayları modelden çizer",
      /categoryStep\.candidates/.test(maira) && !/buildCategoryGuidance/.test(maira),
    );
    check(
      "F14 belirsiz adım da aynı işleyiciye gider",
      /categoryChoice = useMemo/.test(page) &&
        /buildCategoryChoice\(/.test(page) &&
        (page.match(/onCategoryAction=\{applyCategoryConfirmation\}/g) ?? []).length === 1,
    );
    check(
      "F10 Maira onay/ret etiketlerini modelden okur",
      /categoryStep\.confirmLabel/.test(maira) &&
        /categoryStep\.rejectLabel/.test(maira) &&
        !/"Evet, doğru"|"Bu değil"/.test(maira),
    );
    check(
      "F11 kart onay/ret etiketlerini modelden okur",
      /model\.confirmLabel/.test(card) &&
        /model\.rejectLabel/.test(card) &&
        !/"Evet, doğru"|"Bu değil"/.test(card),
    );
    check(
      "F12 kategori adımı cevap deposuna yazmaz",
      !/onAnswer\([^)]*__confirm__|onAnswer\([^)]*__reject__/.test(maira) &&
        !/setManualValues|applyQuickOption/.test(maira),
    );
  }
}

console.log(`verify-category-confirmation-v1: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const e of errors) console.log(" - " + e);
  process.exit(1);
}
