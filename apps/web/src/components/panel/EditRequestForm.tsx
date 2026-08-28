"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  Save,
  Sparkles,
} from "lucide-react";

import { RealEstateLocationFields } from "@/components/request/RealEstateLocationFields";
import { TrMoneyInput } from "@/components/ui/TrMoneyInput";
import {
  composeProfessionalDescription,
  composeRequestTitle,
} from "@/lib/ai/request-text-composer";
import {
  neighborhoodsFieldValue,
  realEstateLocationError,
  realEstateLocationToCity,
  type RealEstateLocation,
} from "@/lib/geo/real-estate-location";
import { parseNeighborhoods } from "@/lib/geo/neighborhoods";
import { parseRealEstateCity } from "@/lib/geo/turkey-districts";
import {
  resolveRequestCategory,
  getVisibleCategoryFields,
  isFieldRequired,
  resolveCommonField,
  withCategoryFieldDefaults,
  type DynamicField,
} from "@/lib/request-category-engine";
import { understandRequest } from "@/lib/request-understanding/understand-request";
import {
  budgetDisplayFromUnderstanding,
  safeDraftAttributes,
  seedFieldValuesFromUnderstanding,
} from "@/lib/request-understanding/activation-bridge";
import {
  sanitizeRawInput,
  UNRESOLVED_CATEGORY_SLUG,
} from "@/lib/request/raw-input";
import {
  buildPublishUnderstandingSnapshot,
  withUnderstandingSnapshot,
} from "@/lib/request/publish-understanding";
import {
  answerSignature,
  buildDiscoveryProjectionFromState,
} from "@/lib/discovery";
import {
  isReconfirmableCommonKey,
  resolveAnswerFreshness,
  toPreviousAnswer,
  unresolvedInheritedKeys,
  type PreviousAnswer,
} from "@/lib/request-composer/answer-authority";
import {
  applyPublishAnswersToState,
  buildPublishAnswerFields,
  buildPublishFieldValues,
  type PublishFieldAnswer,
  createTextOnlyState,
} from "@/lib/request-composer";

export type EditRequestInitial = {
  id: string;
  title: string;
  description: string;
  rawInput: string | null;
  professionalDescription: string | null;
  city: string | null;
  budget: string | null;
  isUrgent: boolean;
  categorySlug: string;
  fieldValues: Record<string, string>;
  /**
   * KALICI CEVAPLARIN TİPLİ HÂLİ (D3f Dilim 3c, 2026-08-28).
   *
   * `fieldValues` yalnız METİN taşır ve değer taşımayan bilinçli cevabı
   * ifade edemez. Bu harita sunucunun veritabanından okuduğu kanonik
   * cevap şeklidir (`{ mode, value }`) ve düzenleme ekranının kanonik
   * durumunu kurmakta TEK kaynaktır. İstemci bunu üretemez.
   */
  fieldAnswers?: Record<string, PublishFieldAnswer>;
  /**
   * TAZELİK BAĞLAMI (D3f Dilim 3e) — sunucudan gelir, istemci üretemez.
   * `status` talebin kendi kaydından, `fieldConfirmations` sunucunun yazdığı
   * onay damgalarından okunur.
   */
  status?: string | null;
  fieldConfirmations?: Record<string, { signature: string }> | null;
};

/**
 * Önceki cevabın kullanıcıya gösterilen karşılığı. Etiket YALNIZ burada,
 * gösterim sınırında üretilir; kayıt tarafında hiçbir yerelleştirilmiş metin
 * saklanmaz.
 */
function previousAnswerLabel(previous: PreviousAnswer): string {
  if (previous.kind === "ANY") return "Fark etmez";
  if (previous.kind === "UNKNOWN") return "Bilmiyorum";
  if (previous.kind === "NOT_APPLICABLE") return "Uygulanamaz";
  return previous.value ?? "";
}

type CommonDraft = {
  title: string;
  quantity: string;
  city: string;
  delivery: string;
  budget: string;
};

export function EditRequestForm({
  initial,
  cloneSuccess = false,
}: {
  initial: EditRequestInitial;
  cloneSuccess?: boolean;
}) {
  const router = useRouter();
  const [requestText, setRequestText] = useState(
    initial.rawInput ||
      initial.description ||
      initial.professionalDescription ||
      "",
  );
  const [manualValues, setManualValues] = useState<Record<string, string>>(
    initial.fieldValues,
  );
  /**
   * ORTAK ALAN CEVAPLARI GERİ YÜKLENİR (D3f Dilim 3e, 2026-08-28).
   *
   * `quantity` ve `delivery` burada sabit boş yazılıydı; kullanıcının verdiği
   * cevap düzenleme ekranına hiç dönmüyordu. Kaynak, sunucunun veritabanından
   * okuduğu kanonik cevap haritasıdır — ikinci bir ayrıştırma yazılmaz.
   * Değer taşımayan cevaplar taslak METNİNE yazılmaz: onların görünümü
   * yeniden onay kontrolünde üretilir.
   */
  const restoredCommonValue = (key: keyof CommonDraft): string => {
    const answer = initial.fieldAnswers?.[key];
    return answer?.mode === "VALUE" ? answer.value : "";
  };
  const [commonDraft, setCommonDraft] = useState<CommonDraft>({
    title: initial.title,
    quantity: restoredCommonValue("quantity"),
    city: initial.city ?? restoredCommonValue("city"),
    delivery: restoredCommonValue("delivery"),
    budget: initial.budget ?? restoredCommonValue("budget"),
  });
  /**
   * "Aynı kalsın" ya da "Değiştir" ile bu oturumda çözülen miras cevaplar.
   * Çözülmemiş bir miras cevap varken kaydetme kapısı açılmaz.
   */
  const [reconfirmedKeys, setReconfirmedKeys] = useState<string[]>([]);
  const [changingKeys, setChangingKeys] = useState<string[]>([]);
  const [isUrgent, setIsUrgent] = useState(initial.isUrgent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const initialParsed = parseRealEstateCity(initial.city);
  const [realEstateLocation, setRealEstateLocation] =
    useState<RealEstateLocation>({
      il: initialParsed?.il ?? "",
      ilce: initialParsed?.ilce ?? "",
      mahalleler: parseNeighborhoods(initial.fieldValues.neighborhoods),
    });

  function updateRealEstateLocation(next: RealEstateLocation) {
    setRealEstateLocation(next);
    setManualValues((current) => ({
      ...current,
      neighborhoods: neighborhoodsFieldValue(next),
    }));
  }

  const understanding = useMemo(
    () =>
      understandRequest({
        rawInput: requestText,
        structured: {
          // Persisted category is a locked structured override on edit
          categoryId: initial.categorySlug,
          city: commonDraft.city || null,
          district: realEstateLocation.ilce || null,
          fieldValues: {
            ...manualValues,
            ...(commonDraft.quantity ? { quantity: commonDraft.quantity } : {}),
            ...(commonDraft.budget ? { budget: commonDraft.budget } : {}),
            ...(commonDraft.delivery ? { delivery: commonDraft.delivery } : {}),
          },
        },
      }),
    [
      commonDraft.budget,
      commonDraft.city,
      commonDraft.delivery,
      commonDraft.quantity,
      initial.categorySlug,
      manualValues,
      realEstateLocation.ilce,
      requestText,
    ],
  );

  // Düzenlemede kategori sabit kalır (persisted STRUCTURED_FIELD).
  const activeCategoryId = initial.categorySlug;
  const isRealEstate = activeCategoryId === "real-estate";
  const selectedCategory = resolveRequestCategory(activeCategoryId);
  const visibleCommonFields = selectedCategory.commonFields.map(
    resolveCommonField,
  );

  /**
   * MİRAS CEVAPLAR — TAZELİK EKSENİ (D3f Dilim 3e).
   *
   * Karar tek kanonik fonksiyondan gelir (`resolveAnswerFreshness`) ve alan
   * adına özel bir dal içermez: kapsam kanonik ortak alan registry'sinden
   * türetilir, `title` bilinçli olarak dışarıdadır.
   */
  const inheritedCommonAnswers = ((): {
    key: string;
    label: string;
    previous: PreviousAnswer;
  }[] => {
    const out: { key: string; label: string; previous: PreviousAnswer }[] = [];
    const commonKeys = visibleCommonFields.map((field) => field.key);
    for (const field of visibleCommonFields) {
      if (!isReconfirmableCommonKey(field.key, commonKeys)) continue;
      const answer = initial.fieldAnswers?.[field.key];
      if (!answer) continue;
      const previous = toPreviousAnswer({
        kind: answer.mode,
        value: answer.mode === "VALUE" ? answer.value : null,
        provenance: "EXPLICIT_BROWSE",
      });
      if (!previous) continue;
      const freshness = resolveAnswerFreshness({
        status: initial.status,
        confirmedSignature:
          initial.fieldConfirmations?.[field.key]?.signature ?? null,
        answerSignature: answerSignature({
          key: field.key,
          mode: answer.mode,
          value: answer.value,
        }),
      });
      if (freshness !== "INHERITED") continue;
      out.push({ key: field.key, label: field.label, previous });
    }
    return out;
  })();

  const unresolvedReconfirmKeys = unresolvedInheritedKeys({
    freshnessByKey: Object.fromEntries(
      inheritedCommonAnswers.map((item) => [item.key, "INHERITED" as const]),
    ),
    resolvedKeys: [...reconfirmedKeys, ...changingKeys],
  });
  const visibleCommonFieldKeys = new Set(
    visibleCommonFields.map((field) => field.key),
  );

  const seededFields = useMemo(
    () => seedFieldValuesFromUnderstanding(understanding),
    [understanding],
  );
  const understandingCity = understanding.location?.city?.value ?? "";
  const understandingBudgetDisplay =
    budgetDisplayFromUnderstanding(understanding);

  const dynamicValues = useMemo(() => {
    const category = resolveRequestCategory(activeCategoryId);
    const values: Record<string, string> = {};
    for (const field of category.fields) {
      const seeded = seededFields[field.key];
      values[field.key] =
        manualValues[field.key] ??
        (seeded === undefined || seeded === null ? "" : String(seeded));
    }
    return withCategoryFieldDefaults(activeCategoryId, values);
  }, [activeCategoryId, seededFields, manualValues]);

  const draftSafeAttributes = useMemo(
    () =>
      safeDraftAttributes(understanding, {
        ...seededFields,
        ...dynamicValues,
      }),
    [understanding, seededFields, dynamicValues],
  );

  const mergedCommonDraft: CommonDraft = {
    title:
      commonDraft.title ||
      composeRequestTitle({
        categoryId: activeCategoryId,
        rawText: requestText,
        attributes: { ...seededFields, ...dynamicValues },
        city: commonDraft.city || understandingCity || "",
        fields: selectedCategory.fields,
        fieldValues: dynamicValues,
      }),
    quantity: visibleCommonFieldKeys.has("quantity")
      ? commonDraft.quantity ||
        (understanding.quantity?.value?.value != null
          ? `${understanding.quantity.value.value} ${understanding.quantity.value.unit ?? "adet"}`
          : "")
      : "",
    city: isRealEstate
      ? realEstateLocationToCity(realEstateLocation) ||
        commonDraft.city ||
        understandingCity ||
        ""
      : visibleCommonFieldKeys.has("city")
        ? commonDraft.city || understandingCity || ""
        : "",
    delivery: visibleCommonFieldKeys.has("delivery")
      ? commonDraft.delivery
      : "",
    budget: visibleCommonFieldKeys.has("budget")
      ? commonDraft.budget || understandingBudgetDisplay
      : "",
  };

  const visibleDynamicFields = getVisibleCategoryFields(
    selectedCategory.fields,
    dynamicValues,
    activeCategoryId,
  );

  const missingFields = visibleDynamicFields.filter(
    (field) =>
      isFieldRequired(field, dynamicValues) &&
      !dynamicValues[field.key]?.trim(),
  );

  const realEstateLocationMissing = isRealEstate
    ? Boolean(realEstateLocationError(realEstateLocation))
    : false;

  const professionalText = composeProfessionalDescription({
    categoryId: activeCategoryId,
    rawText: requestText,
    attributes: draftSafeAttributes,
    city: mergedCommonDraft.city || understandingCity,
    budget:
      understanding.budget?.value?.max ?? understanding.budget?.value?.min,
    quantity: understanding.quantity?.value?.value,
    unit: understanding.quantity?.value?.unit,
    fields: visibleDynamicFields,
    fieldValues: dynamicValues,
    commonDraft: mergedCommonDraft,
    commonFields: visibleCommonFields,
  });

  /**
   * "EVET, AYNI KALSIN" — eski cevap YENİ ve açık bir onay kazanır.
   *
   * Anahtar `manualValues` üzerinden `userConfirmedFieldKeys` kanalına girer;
   * sunucu onay damgasını o cevabın imzasına bağlı olarak yeniden türetir.
   * Değer taşımayan cevapta taslak metnine etiket YAZILMAZ — cevap kanonik
   * modundan gider.
   */
  function keepPreviousAnswer(key: string) {
    const answer = initial.fieldAnswers?.[key];
    if (answer?.mode === "VALUE" && answer.value.trim()) {
      setCommonDraft((current) => ({ ...current, [key]: answer.value }));
    }
    setManualValues((current) => ({
      ...current,
      [key]: answer?.mode === "VALUE" ? answer.value : (current[key] ?? ""),
    }));
    setReconfirmedKeys((current) =>
      current.includes(key) ? current : [...current, key],
    );
  }

  /**
   * "DEĞİŞTİRMEK İSTİYORUM" — eski cevap güncel yayın durumundan ÇIKAR.
   *
   * Silinmez: `previousAnswer` olarak görünmeye devam eder. Kullanıcı yeni
   * bir cevap seçmedikçe hiçbir VALUE / ANY / UNKNOWN / NOT_APPLICABLE
   * üretilmez ve eski cevap Matching'e güncel cevap gibi gönderilmez.
   */
  function changePreviousAnswer(key: string) {
    setCommonDraft((current) => ({ ...current, [key]: "" }));
    setManualValues((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setChangingKeys((current) =>
      current.includes(key) ? current : [...current, key],
    );
  }

  async function saveRequest() {
    if (
      isSaving ||
      missingFields.length > 0 ||
      realEstateLocationMissing ||
      /**
       * ÇÖZÜLMEMİŞ MİRAS CEVAP KAYDETMEYİ DURDURUR (D3f Dilim 3e).
       *
       * Başka bir alanı değiştirip kaydetmek, eski bir bütçeyi ya da teslim
       * tarihini sessizce TAZE yapamaz: kullanıcı her miras cevap için ya
       * "aynı kalsın" demeli ya da yeni bir cevap vermelidir. Aynı taslağın
       * yenilenmesinde geçerli damga varsa bu liste zaten boştur.
       */
      unresolvedReconfirmKeys.length > 0
    ) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);

    /**
     * KULLANICI DOKUNUŞUNUN TEK LİSTESİ — `/talep` İLE AYNI SÖZLEŞME (D3d).
     *
     * Düzenlemede `manualValues` hem kaydedilmiş eski cevapları hem bu
     * oturumdaki değişiklikleri taşır; ikisi de kullanıcıya aittir. Aynı
     * liste hem understanding snapshot'ının `confirmedFieldKeys` girdisini
     * hem yayın torbasını besler — iki ayrı dokunuş kaydı tutulmaz.
     */
    const userConfirmedFieldKeys = Object.keys(manualValues).filter(
      (key) => (manualValues[key] ?? "").trim().length > 0,
    );
    /**
     * DÜZENLEME KANONİK DURUMU — METİN + KULLANICININ KENDİ CEVAPLARI (D3e).
     *
     * Bu durum eskiden YALNIZ metinden kuruluyordu; kullanıcının form
     * cevapları projection'a hiç ulaşmıyor ve değer taşımayan bir
     * "Fark etmez" tercihi kaydedildiği anda `mode:"ANY"` constraint'iyle
     * birlikte tamamen kayboluyordu. Cevaplar üretimin kendi yolundan
     * (`syncFromBrowse`) uygulanır; kanonik tanıyıcı yerelleştirilmiş
     * "Fark etmez" etiketini `kind:"ANY"`ye burada çevirir, kategoriye ya da
     * alana özel hiçbir dal eklenmez.
     *
     * `rawInput` DEĞİŞMEZ: metne hiçbir sentetik ifade yazılmaz.
     */
    /**
     * KALICI CEVAPLAR ÖNCE, OTURUM DEĞİŞİKLİKLERİ SONRA (D3f Dilim 3c).
     *
     * Veritabanından geri yüklenen bilinçli "Bilmiyorum" / "Uygulanamaz" /
     * "Fark etmez" cevapları kanonik duruma önce uygulanır; kullanıcının bu
     * oturumda gerçekten dokunduğu alanlar üstüne yazar. Böylece hiçbir şey
     * değiştirmeden kaydetmek cevabı KAYBETMEZ. Etiket taşınmaz — mod taşınır
     * ve karar `answer-authority` merdiveninden gelir.
     */
    const editCanonicalState = applyPublishAnswersToState(
      createTextOnlyState(requestText.trim() || professionalText),
      {
        ...(initial.fieldAnswers ?? {}),
        ...Object.fromEntries(
          userConfirmedFieldKeys.map((key) => [
            key,
            { mode: "VALUE" as const, value: manualValues[key] ?? "" },
          ]),
        ),
      },
    );
    /**
     * ONAYSIZ TAHMİN CEVAP KANALINA GİREMEZ (D3d).
     *
     * Bu ekran `fields[]` değerlerini eskiden doğrudan `dynamicValues`tan
     * okuyordu; `dynamicValues` ise kullanıcı dokunmadığı alanları anlama
     * katmanının TAHMİNİYLE dolduruyor. Böylece Talepo'nun kendi tahmini
     * düzenleme kaydedildiği anda kullanıcının cevabı olarak
     * kalıcılaşıyordu — ve sunucu güven sınırı bu listeyi kullanıcı beyanı
     * saydığı için tahmin `USER_EXPLICIT` olarak damgalanabilirdi.
     * `/talep` yayın yolunun kullandığı kanonik süzgeç burada da kullanılır;
     * ikinci bir süzgeç yazılmaz.
     */
    const publishFieldValues = buildPublishFieldValues({
      canonicalFields: editCanonicalState.fields,
      values: dynamicValues,
      userTouchedKeys: userConfirmedFieldKeys,
    });
    /**
     * Ortak alan cevapları da AYNI kurucudan geçer (D3f Dilim 2b) — `/talep`
     * ile düzenleme yolu tek kaynak kullanır, ikinci bir liste yazılmaz.
     * Geri YÜKLEME hâlâ yok: bu dilim yalnız kaydetme yönünü kapatır.
     */
    const commonAnswerFields = buildPublishAnswerFields({
      canonicalFields: editCanonicalState.fields,
      /* Kamuya açık soru evreni talebin O ANKİ kategorisinden türer (3h). */
      categoryId: editCanonicalState.categoryId ?? activeCategoryId,
      values: dynamicValues,
      userTouchedKeys: userConfirmedFieldKeys,
      dynamicFieldKeys: visibleDynamicFields.map((field) => field.key),
    }).filter(
      (row) => !visibleDynamicFields.some((field) => field.key === row.key),
    );

    try {
      const response = await fetch(`/api/requests/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mergedCommonDraft.title,
          description: requestText.trim() || professionalText,
          rawInput: sanitizeRawInput(requestText),
          professionalDescription: professionalText,
          category: {
            slug: selectedCategory.id?.trim()
              ? selectedCategory.id
              : UNRESOLVED_CATEGORY_SLUG,
            name: selectedCategory.id?.trim()
              ? selectedCategory.label
              : "Belirsiz kategori (sistem)",
            description: selectedCategory.description,
          },
          city: mergedCommonDraft.city,
          district: isRealEstate ? realEstateLocation.ilce : undefined,
          quantity: mergedCommonDraft.quantity,
          delivery: mergedCommonDraft.delivery,
          budget: mergedCommonDraft.budget,
          aiScore: Math.round(understanding.understandingConfidence * 100),
          aiSummary: [
            `Kategori: ${selectedCategory.label}`,
            `AI güveni: %${Math.round(understanding.understandingConfidence * 100)}`,
            `Strategy: ${understanding.strategy.value ?? "UNKNOWN"}`,
            "Talep kullanıcı tarafından güncellendi",
          ].join("\n"),
          isUrgent,
          publishVersion: "ai",
          discoveryProjection: (() => {
            const base = buildDiscoveryProjectionFromState(editCanonicalState);
            const snap = buildPublishUnderstandingSnapshot({
              understanding,
              userSelected: false,
              primarySlug: selectedCategory.id?.trim() || null,
              confirmedFieldKeys: userConfirmedFieldKeys,
            });
            return withUnderstandingSnapshot(base, snap) ?? undefined;
          })(),
          fields: [
            ...visibleDynamicFields.map((field) => ({
              ...field,
              required: isFieldRequired(field, dynamicValues),
              /* Değer VE mod birlikte gider (D3e). */
              value: publishFieldValues[field.key]?.value ?? "",
              mode: publishFieldValues[field.key]?.mode,
            })),
            /* Ortak alanların bilinçli değer taşımayan cevapları (D3f 2b). */
            ...commonAnswerFields.map((row) => ({
              key: row.key,
              label: row.label ?? row.key,
              type: "text" as const,
              required: false,
              value: row.value,
              mode: row.mode,
            })),
            ...(isRealEstate
              ? [
                  {
                    key: "neighborhoods",
                    label: "Mahalle",
                    type: "text" as const,
                    required: false,
                    value: neighborhoodsFieldValue(realEstateLocation),
                  },
                ]
              : []),
          ],
        }),
      });

      const result = (await response.json()) as {
        message?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || "Talep güncellenemedi.");
      }

      router.push(result.redirectTo || `/panel/taleplerim/${initial.id}`);
      router.refresh();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Talep güncellenirken bir hata oluştu.",
      );
      setIsSaving(false);
    }
  }

  return (
    <div className="relative space-y-5 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[32px]">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-emerald-300/40 blur-[90px]" />
        <div className="absolute -right-16 top-24 h-80 w-80 rounded-full bg-sky-300/40 blur-[90px]" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-amber-200/35 blur-[80px]" />
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-white/80 bg-white/85 px-5 py-4 shadow-[0_12px_40px_rgba(13,148,136,0.08)] backdrop-blur-xl">
        <Link
          href={`/panel/taleplerim/${initial.id}`}
          className="flex items-center gap-2 text-sm font-medium text-black/45 transition hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Talebe dön
        </Link>
        <span className="rounded-full bg-[#0f766e] px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
          Talebi düzenliyorsunuz
        </span>
      </header>

      {cloneSuccess ? (
        <p
          role="status"
          className="rounded-[20px] border border-teal-900/10 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900"
        >
          Yeni taslağın hazır.
        </p>
      ) : null}

      <section className="relative overflow-hidden rounded-2xl border border-teal-900/10 bg-white p-6 shadow-[0_16px_48px_rgba(15,31,29,0.05)] sm:p-8">
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0f766e] text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0f1f1d] sm:text-3xl">
              Talebimi düzelt
            </h1>
            <p className="mt-1 text-sm text-teal-950/45">
              Metni veya alanları güncelleyin, sonra kaydedin.
            </p>
          </div>
        </div>

        <label className="relative mt-8 block">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-teal-900">
              Talep metni
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
              {requestText.length} karakter
            </span>
          </div>
          <textarea
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            className="min-h-[320px] w-full resize-y rounded-[24px] border-2 border-teal-500/25 bg-white/95 px-5 py-4 text-base leading-8 outline-none transition focus:border-teal-500/55 focus:shadow-[0_16px_45px_rgba(13,148,136,0.14)] sm:min-h-[380px] sm:text-lg sm:leading-9"
            placeholder="Talebinizi buradan güncelleyin..."
          />
        </label>

        <div className="relative mt-6">
          <p className="mb-2 text-xs font-medium text-black/40">Kategori</p>
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-100 to-sky-100 px-3.5 py-2 text-xs font-semibold text-teal-950 shadow-sm">
            {selectedCategory.label}
            <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-black/40">
              Kilitli
            </span>
          </div>
        </div>

        <div className="relative mt-6 grid gap-4 sm:grid-cols-2">
          {visibleCommonFields.map((field) => {
            if (isRealEstate && field.key === "city") {
              return (
                <RealEstateLocationFields
                  key="real-estate-location"
                  il={realEstateLocation.il}
                  ilce={realEstateLocation.ilce}
                  mahalleler={realEstateLocation.mahalleler}
                  onIlChange={(il) =>
                    updateRealEstateLocation({
                      il,
                      ilce: "",
                      mahalleler: [],
                    })
                  }
                  onIlceChange={(ilce) =>
                    updateRealEstateLocation({
                      il: realEstateLocation.il,
                      ilce,
                      mahalleler: [],
                    })
                  }
                  onMahallelerChange={(mahalleler) =>
                    updateRealEstateLocation({
                      il: realEstateLocation.il,
                      ilce: realEstateLocation.ilce,
                      mahalleler,
                    })
                  }
                  selectClassName="h-12 w-full appearance-none rounded-[17px] border border-teal-900/10 bg-[#f7faf9] px-4 pr-10 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
                  labelClassName="text-xs font-medium text-black/40"
                  neighborhoodControlClassName="min-h-12 w-full rounded-[17px] border border-teal-900/10 bg-[#f7faf9] px-3 py-2 text-sm outline-none transition focus-within:border-teal-500/40 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
                />
              );
            }

            const fieldClassName =
              "h-12 w-full rounded-[17px] border border-teal-900/10 bg-[#f7faf9] px-4 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]";

            const setFieldValue = (next: string) =>
              setCommonDraft((current) => ({
                ...current,
                [field.key]: next,
              }));

            return (
              <label
                key={field.key}
                className={field.key === "title" ? "sm:col-span-2" : ""}
              >
                <span className="mb-2 block text-xs font-medium text-black/40">
                  {field.label}
                </span>
                {field.key === "budget" ? (
                  <TrMoneyInput
                    value={mergedCommonDraft[field.key]}
                    onValueChange={setFieldValue}
                    placeholder={field.placeholder}
                    allowFreeText
                    className={fieldClassName}
                  />
                ) : (
                  <input
                    value={mergedCommonDraft[field.key]}
                    onChange={(event) => setFieldValue(event.target.value)}
                    placeholder={field.placeholder}
                    className={fieldClassName}
                  />
                )}
              </label>
            );
          })}

          {visibleDynamicFields.map((field) => (
            <DynamicFieldInput
              key={field.key}
              field={{
                ...field,
                required: isFieldRequired(field, dynamicValues),
              }}
              value={dynamicValues[field.key] ?? ""}
              onChange={(value) =>
                setManualValues((current) => ({
                  ...current,
                  [field.key]: value,
                }))
              }
            />
          ))}
        </div>

        <label className="relative mt-5 flex items-center gap-3 rounded-[18px] border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 text-sm font-medium text-amber-950">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(event) => setIsUrgent(event.target.checked)}
            className="h-4 w-4 rounded border-black/20"
          />
          Acil alıcıyım
        </label>

        {/**
         * ÖNCEKİ CEVABI YENİDEN ONAYLATMA (D3f Dilim 3e, 2026-08-28).
         *
         * Geçmiş cevap gösterilir ama SESSİZCE güncel sayılmaz. Bu kanal
         * `inferredSuggestion` DEĞİLDİR: orası Talepo'nun kendi tahminini
         * taşır; buradaki kayıt kullanıcının gerçekten verdiği cevaptır ve
         * yalnız bu bağlamda yeniden onaylanmamıştır.
         */}
        {inheritedCommonAnswers.length > 0 && (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Önceki cevaplarınızı doğrulayalım
            </p>
            <ul className="mt-3 space-y-3">
              {inheritedCommonAnswers.map((item) => {
                const resolved =
                  reconfirmedKeys.includes(item.key) ||
                  changingKeys.includes(item.key);
                return (
                  <li key={item.key} className="text-sm text-amber-900">
                    <p>
                      {`Daha önce ${item.label.toLocaleLowerCase("tr-TR")} için `}
                      <strong>
                        {previousAnswerLabel(item.previous)}
                      </strong>
                      {" demiştiniz. Aynı şekilde devam edelim mi?"}
                    </p>
                    {resolved ? (
                      <p className="mt-1 text-xs text-amber-800">
                        {reconfirmedKeys.includes(item.key)
                          ? "Aynı kalacak."
                          : "Yeni cevabınızı aşağıdan girebilirsiniz."}
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => keepPreviousAnswer(item.key)}
                          className="rounded-xl border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-900"
                        >
                          Evet, aynı kalsın
                        </button>
                        <button
                          type="button"
                          onClick={() => changePreviousAnswer(item.key)}
                          className="rounded-xl border border-black/15 px-3 py-1.5 text-xs text-black/70"
                        >
                          Değiştirmek istiyorum
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {(missingFields.length > 0 || realEstateLocationMissing) && (
          <div className="relative mt-4 rounded-[18px] border border-[#efb8b0] bg-[#fff1ee] px-4 py-3 text-sm text-[#8b352b]">
            Eksik zorunlu alanlar:{" "}
            {[
              ...(realEstateLocationMissing
                ? [realEstateLocationError(realEstateLocation) ?? "İl / İlçe / Mahalle"]
                : []),
              ...missingFields.map((field) => field.label),
            ].join(", ")}
          </div>
        )}

        {saveError && (
          <div className="relative mt-4 flex items-start gap-2 rounded-[18px] border border-[#efb8b0] bg-[#fff1ee] px-4 py-3 text-sm text-[#8b352b]">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {saveError}
          </div>
        )}

        <div className="relative mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              isSaving || missingFields.length > 0 || realEstateLocationMissing
            }
            onClick={() => void saveRequest()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Değişiklikleri kaydet
          </button>
          <Link
            href={`/panel/taleplerim/${initial.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-5 py-3 text-sm font-semibold text-black/60"
          >
            Vazgeç
          </Link>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f766e] via-[#0d9488] to-[#115e59] p-6 text-white shadow-[0_20px_56px_rgba(15,118,110,0.22)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-300/20 blur-[70px]" />
        <div className="relative flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-teal-100/70">
          <Sparkles className="h-4 w-4 text-amber-200" />
          Güncel AI özeti
        </div>
        <p className="relative mt-4 whitespace-pre-line text-sm leading-7 text-white/75">
          {professionalText}
        </p>
        {missingFields.length === 0 && !realEstateLocationMissing ? (
          <div className="relative mt-4 flex items-center gap-2 text-sm text-emerald-200">
            <Check className="h-4 w-4" />
            Kaydetmeye hazır
            <ArrowRight className="h-4 w-4" />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: DynamicField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-black/40">{field.label}</span>
        {field.required && (
          <span className="rounded-full bg-[#ffe8e3] px-2 py-0.5 text-[10px] font-semibold text-[#a44b3d]">
            Zorunlu
          </span>
        )}
      </div>
      <div className="relative">
        {field.type === "select" ? (
          <>
            <select
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="h-12 w-full appearance-none rounded-[17px] border border-teal-900/10 bg-[#f7faf9] px-4 pr-10 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
            >
              <option value="">Seçiniz</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          </>
        ) : (
          <input
            type={field.type === "number" ? "number" : "text"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            className="h-12 w-full rounded-[17px] border border-teal-900/10 bg-[#f7faf9] px-4 text-sm font-medium outline-none transition focus:border-teal-500/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
          />
        )}
      </div>
    </label>
  );
}
