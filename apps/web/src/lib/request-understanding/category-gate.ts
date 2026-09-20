/**
 * KATEGORİ KAPISI — talebin kategori kararının tek yetkilisi (2026-09-20).
 *
 * Bu fonksiyon understand-request.ts içinden TAŞINDI, yeniden yazılmadı;
 * karar mantığının tek satırı değişmedi (git geçmişi taşımayı gösterir).
 * Taşımanın sebebi mimaridir: karar katmanı (request-decisions) bu mantığı
 * bir sözleşmenin arkasına sarmak zorundadır ve understand-request'in içinde
 * kaldığı sürece bunu döngüsüz import edemez (understand-request karar
 * sağlayıcısını import eder; sağlayıcı da bu mantığı import eder).
 *
 * Buradaki öncelik sözleşmesi ve kurucu kararların tamamı yerinde durur:
 * ev-destek hizmeti önce, sahipli araç + arıza dili otomotiv, lastik ailesi
 * routing kanıtı, parça uyumluluk alanı, kanonik en-uzun eşleşme, ürün
 * kategorisinde servis niyeti yönlendirmesi, zayıf services bastırması.
 */
import type { RequestIntent, UnderstandingDecision } from "./types";
import {
  CATEGORY_DECISION,
  decisionStatus,
} from "./confidence-config";
import { foldTr } from "./tr-fold";
import { readTireRequestContext } from "./tire-request-context";
import { clamp01 } from "@/lib/request-understanding/provenance";
import { detectCategoryResult } from "@/lib/ai/parser/category";
import { findCanonicalCategoryClaim } from "@/lib/taxonomy/phrase-classification";
import { categoryOwnsServiceLeaves } from "@/lib/taxonomy";
import {
  classifyRequestedTargetRole,
  SERVICE_LEMMAS,
} from "@/lib/request-understanding/requested-item-role";
import {
  resolveRelationDomain,
  splitCompatibilityPhrase,
  readRequestedTarget,
} from "@/lib/request-understanding/part-relation";

/**
 * Lastik/jant/servis sinyali — tek yetkili tire-request-context'tir; burada
 * yalnız kategori kapısının okuduğu dar görünüm vardır. understand-request
 * de aynı görünümü buradan import eder (ikinci tanım yok).
 */
export function lastikWheelOrServiceSignal(text: string): boolean {
  return readTireRequestContext(text)?.isTireRequest ?? false;
}

export function gateCategory(
  rawInput: string,
  intent: RequestIntent,
): UnderstandingDecision<string> {
  const foldedInput = foldTr(rawInput);
  const explicitHomeSupport = /ev\s+(?:de\s+)?yardimcisi|ev\s+(?:de\s+)?hizmetli|ev\s+isleri\s+yardimcisi|(?:yasli|hasta)\s+bak(?:im|ici)/.test(
    foldedInput,
  );
  const ambiguousHelper = /(?:^|\s)yardimci\s+ariyorum(?:\s|$)/.test(
    foldedInput,
  );

  // "Ev" is also an Emlak keyword. Explicit human-support phrases must
  // enter Hizmetler before the generic category scorer sees that token.
  if (explicitHomeSupport) {
    return {
      value: "services",
      confidence: 0.98,
      status: "CONFIDENT",
      evidence: ["explicit-home-support-service"],
    };
  }
  // A bare "yardımcı arıyorum" is a clarification case, not a reason to
  // guess Emlak or another product root.
  if (ambiguousHelper) {
    return {
      value: "services",
      confidence: 0.55,
      status: "TENTATIVE",
      evidence: ["ambiguous-helper-service-clarification"],
    };
  }

  /**
   * SAHİPLİ ARAÇ + ARIZA/BAKIM DİLİ OTOMOTİV SERVİSİDİR (kurucu, 2026-09-12).
   *
   * Ölçüldü: "Aracım çalışmıyor arıza var" Hizmetler › Teknik Servis'e
   * gidiyordu. Skorlayıcı "aracım" iyelik biçimini araç kanıtı saymıyor
   * (anahtar kelime "araç"), "arıza" ise Hizmetler'e puan yazıyordu. Aracın
   * kendi servis akışı vardır (kurucu istisnası, 2026-08-23, ürün→hizmet
   * yönlendirmesi otomotivi zaten dışarıda tutar); iyelikli araç adı ile
   * servis/arıza dili aynı cümlede geçince talep otomotive gider, alt tür
   * intent-signals'ın SERVICE kararıyla "service" olur. Yalnız iyelik
   * biçimi aranır ("aracım", "arabamız", "otomobilimin"); yalın "araç"
   * eskisi gibi skorlayıcıya kalır ki "araç kiralama" gibi cümleler bu
   * kuralın dışında kalsın.
   */
  const ownedVehicle =
    /(?<![a-z])(?:arac|araba|otomobil|kamyon|kamyonet|minibus|motosiklet|motor|tir)(?:[iua])?m(?:iz)?(?:[iua]n?|d[ae]n?)?(?![a-z])/u.test(
      foldedInput,
    );
  const vehicleFaultOrService =
    /(?<![a-z])(?:calismiyor|bozuldu|bozuk|ariza|arizali|tamir|bakim|servis|onarim|muayene|ekspertiz|kaza|hasar|ses geliyor|isik yaniyor|yag degisimi|calismiyor)(?![a-z])/u.test(
      foldedInput,
    );
  if (ownedVehicle && vehicleFaultOrService) {
    return {
      value: "automotive",
      confidence: 0.9,
      status: "CONFIDENT",
      evidence: ["owned-vehicle-service"],
    };
  }

  const detected = detectCategoryResult(rawInput);
  const scoreConf = clamp01(detected.score / 6);

  /* Kamyon/araba gibi üst ürün adları lastik/jant tamlamasında alan kanıtını
     gölgeleyebilir. Lastik ailesi kendi başına otomotiv routing kanıtıdır;
     böylece "kamyon lastiği" de kategori dışı kalmaz. */
  const canonicalClaimBeforeTireRouting = findCanonicalCategoryClaim(rawInput);
  const tireContext = readTireRequestContext(rawInput);
  if (!canonicalClaimBeforeTireRouting && tireContext?.competingCategory) {
    return {
      value: tireContext.competingCategory,
      confidence: 0.85,
      status: "CONFIDENT",
      evidence: ["canonical-claim", `node=${tireContext.head?.id}`, "tire-modifier-only"],
    };
  }
  const tireSignalOwnsRouting =
    !canonicalClaimBeforeTireRouting ||
    canonicalClaimBeforeTireRouting.kind !== "unique" ||
    canonicalClaimBeforeTireRouting.categoryId === "automotive";
  if (lastikWheelOrServiceSignal(rawInput) && tireSignalOwnsRouting) {
    return {
      value: "automotive",
      confidence: 0.88,
      status: "CONFIDENT",
      evidence: ["automotive-tire-or-wheel"],
    };
  }

  /**
   * PARÇA UYUMLULUK ALANI, GENEL PARÇA ALIAS'INDAN ÖNCE GELİR.
   *
   * "Torna tezgahı için yedek parça" gibi cümlelerde sağ hedef olan
   * "yedek parça" birden fazla katalog alanında bulunabilir. Sol taraftaki
   * doğrulanmış üst ürün alanı (burada machinery) daha güçlü kanıttır; aksi
   * halde genel "yedek parça" alias'ı Beyaz Eşya'ya kilitlenebilir.
   */
  const compatibility = splitCompatibilityPhrase(rawInput);
  if (compatibility) {
    const target = readRequestedTarget(compatibility.requested).value;
    const targetClaim = target ? findCanonicalCategoryClaim(target) : null;
    if (targetClaim?.kind === "unique" &&
      targetClaim.node.id.startsWith("tax:automotive:diger:diger-otomotiv:aksesuar:")) {
      return {
        value: targetClaim.categoryId, confidence: 0.85, status: "CONFIDENT",
        evidence: ["canonical-claim", `phrase=${targetClaim.phrase}`, `node=${targetClaim.node.id}`, "accessory-target"],
      };
    }
    const targetRole = classifyRequestedTargetRole(compatibility.requested).role;
    if (targetRole === "COMPONENT_OR_ACCESSORY") {
      const relationDomain = resolveRelationDomain(rawInput);
      if (relationDomain?.categoryId) {
        return {
          value: relationDomain.categoryId,
          confidence: relationDomain.verified ? 0.92 : 0.62,
          status: relationDomain.verified ? "CONFIDENT" : "TENTATIVE",
          evidence: [relationDomain.code, `domainSpan=${relationDomain.span}`],
        };
      }
    }
  }

  /**
   * ÖNCELİK 1 — KANONİK EN-UZUN EŞLEŞME (2026-08-30).
   *
   * Ölçüldü: tam katalog matrisinde 804 kanonik yaprak adı taksonomide
   * çözülebildiği hâlde token skorlayıcı içlerindeki tek bir genel
   * kelimeye yenildi ("Klima gaz dolumu" → appliances, "Buz Makinesi" →
   * machinery). Metindeki en uzun tam kanonik yaprak/alias eşleşmesi ve
   * onun katalog sahibi artık token skorundan önce gelir; skorlayıcı
   * yalnız kanonik kanıt bulunamayınca çalışan fallback'tir. Çok sahipli
   * ifade tipli belirsizlik politikasından okunur; karar UYDURULMAZ.
   *
   * KURUCU İSTİSNASI KORUNUR (2026-08-23): ürün kategorisinde SERVİS
   * niyeti Hizmetler'e yönlenir (otomotiv hariç). Kanonik iddia bir
   * HİZMET yaprağına çözülüyorsa yönlendirmeye gerek yoktur — sahip
   * kategori hizmetin kanonik evidir; ürün yaprağına çözülüyorsa ve
   * niyet servisse mevcut yönlendirme aynen işler.
   */
  /**
   * "X için Y" cümlelerinde iddia ÜRETİLMEZ: uyumluluk ilişkisinin tek
   * yetkilisi part-relation zinciridir ve kategori kararını rol + bağlam
   * verir (öncelik sözleşmesinin 4. basamağı oradadır). Ölçülen
   * regresyonlar: "Klima için dış ünite fan motoru" iddia yüzünden
   * otomotive, "Renault Clio için bakım" bebek "Bakım" düğümüne
   * kayıyordu. Bağlaçsız düz metinde iddia tam yetkilidir.
   */
  const rawClaim = findCanonicalCategoryClaim(rawInput);
  const claimSpansConnective =
    rawClaim != null && /(?:^|[^\p{L}])i[cç]in(?:[^\p{L}]|$)/iu.test(rawClaim.phrase);
  const claim =
    splitCompatibilityPhrase(rawInput) && !claimSpansConnective
      ? null
      : rawClaim;
  /**
   * Servis niyeti kanıtı, iddia edilen kanonik adın DIŞINDA aranır: "Video
   * Montaj Donanımı ... arıyorum" bir donanım satın alma talebidir; ürün
   * adının içindeki "montaj" sözcüğü servis niyeti sayılırsa kanonik ürün
   * Hizmetler'e sürülür (ölçüldü). Ad çıkarıldıktan sonra kalan metinde
   * servis dili varsa kurucu yönlendirmesi aynen işler.
   */
  /**
   * Hizmet dili tek yetkiliden türetilir (SERVICE_LEMMAS) — ikinci bir
   * fiil listesi tutulmaz. "yaptır" lemmalarda yoktur çünkü o bir niyet
   * fiilidir; burada niyet + lemma birlikte arandığı için eklenir.
   */
  const SERVICE_WORD_RE = new RegExp(
    [...SERVICE_LEMMAS, "yaptır", "yaptir", "arıza", "ariza"]
      /* Türkçe ünsüz yumuşaması: "temizlik" iyelikle "temizliği" olur. */
      .map((l) => l.replace(/k$/u, "[kğg]"))
      .join("|"),
    "i",
  );
  const textOutsideClaim = claim
    ? rawInput
        .toLocaleLowerCase("tr-TR")
        .replace(claim.phrase.toLocaleLowerCase("tr-TR"), " ")
    : rawInput;
  /* Niyet etiketi bu noktada henüz kaba olabilir; belirleyici olan, adın
     DIŞINDA gerçek servis dili bulunmasıdır ("web sitesi yaptırmak
     istiyorum" → yaptır dışarıda → kurucu yönlendirmesi işler). */
  const serviceIntentForClaim = SERVICE_WORD_RE.test(textOutsideClaim);
  if (claim?.kind === "unique") {
    const claimIsService = claim.node.nodeType === "SERVICE_TYPE";
    /**
     * Servis niyeti Hizmetler'e YÖNLENDİRMEZ, eğer iddia edilen kategori
     * hizmeti KENDİ kanonik taksonomisinde adlandırıyorsa (98+ Faz I,
     * 2026-09-01). Eski istisna ada özeldi ("automotive"); gerçek gerekçe
     * kategorinin SERVICE_TYPE yaprağı sahipliğidir ve artık kanonik
     * veriden türetilir. Ölçüldü: "Sunucu bakım hizmeti arıyorum" —
     * technology "Bakım / destek sözleşmesi" yaprağına sahipken talep
     * services'e kaçıyor, IT tedarikçileri onu hiç görmüyordu. Kombi
     * örneği değişmez: appliances hizmet yaprağı taşımaz, yönlendirme
     * kurucu kararıyla sürer.
     */
    const productServiceRedirect =
      serviceIntentForClaim &&
      !claimIsService &&
      !categoryOwnsServiceLeaves(claim.categoryId);
    if (!productServiceRedirect) {
      /**
       * KISMİ İDDİA + KARARSIZ SKORLAYICI = KESİN DEĞİL (2026-09-15).
       *
       * Ölçüldü: "Klima dış ünite fan motoru arıyorum" — "fan motoru"
       * yalnız otomotiv yaprağında var diye beş sözcüklük cümle otomotive
       * CONFIDENT bağlanıyor, beyaz eşya tedarikçisi talebi hiç görmüyordu.
       * ("Klima İÇİN dış ünite fan motoru" bağlaç yoluyla zaten
       * korunuyordu; bağlaçsız yazım korunmuyordu.) Yaprak adı cümlenin
       * yalnız bir PARÇASIYSA, token skorlayıcı emin DEĞİLSE ve
       * skorlayıcının kazananı ya da ikincisi BAŞKA bir kategoriyse karar
       * TENTATIVE'dir; iki aday da netleştirme kartına gider. Çekirdeği
       * tamamen kapsayan iddia ("Klima gaz dolumu", "Buz makinesi") ve
       * skorlayıcının zaten emin olduğu iddia değişmez.
       */
      const contestant =
        detected.categoryId !== claim.categoryId && detected.score > 0
          ? detected.categoryId
          : detected.runnerUpId &&
              detected.runnerUpId !== claim.categoryId &&
              detected.runnerUpScore > 0
            ? detected.runnerUpId
            : null;
      if (!claim.coversCore && !detected.confident && contestant) {
        return {
          value: claim.categoryId,
          confidence: 0.5,
          status: "TENTATIVE",
          evidence: [
            "canonical-claim-partial",
            `phrase=${claim.phrase}`,
            `node=${claim.node.id}`,
            `span=${claim.span}`,
            `contested-by=${contestant}`,
          ],
          alternatives: [
            {
              value: contestant,
              confidence: 0.45,
              evidence: [`detector=${detected.categoryId}`, `score=${detected.score}`],
            },
          ],
        };
      }
      return {
        value: claim.categoryId,
        confidence: Math.max(0.85, scoreConf),
        status: "CONFIDENT",
        evidence: [
          "canonical-claim",
          `phrase=${claim.phrase}`,
          `node=${claim.node.id}`,
          `span=${claim.span}`,
        ],
      };
    }
  } else if (claim?.kind === "ambiguous") {
    return {
      value: null,
      confidence: 0.4,
      status: "UNKNOWN",
      evidence: [
        "canonical-claim-ambiguous",
        `phrase=${claim.phrase}`,
        `allowed=${claim.categoryIds.join("|")}`,
      ],
      alternatives: claim.categoryIds.map((cid) => ({
        value: cid,
        confidence: 0.5,
        evidence: ["ambiguity-policy"],
      })),
    };
  }

  const alternatives =
    detected.runnerUpId && detected.runnerUpScore > 0
      ? [
          {
            value: detected.runnerUpId,
            confidence: clamp01(detected.runnerUpScore / 6),
            evidence: [`runnerUpScore=${detected.runnerUpScore}`],
          },
        ]
      : undefined;

  // Kurucu (2026-08-23): ürün kategorisinde SERVİS niyeti (kombi bakımı,
  // buzdolabı tamiri, web sitesi yaptırmak…) Hizmetler'e yönlenir.
  // Otomotiv hariç — aracın kendi servis akışı (arac-bakim) vardır.
  const PRODUCT_TO_SERVICE_CATEGORIES = new Set([
    "appliances",
    "technology",
    "home-kitchen",
    "furniture",
    "machinery",
    "baby",
  ]);
  // "yaptırmak" MANUFACTURE niyeti sayılır (kartvizit akışı) — bakım/tamir
  // bağlamında ise bu bir hizmet talebidir, üretim değil.
  const SERVICE_CONTEXT_RE =
    /bak[ıi]m|tamir|onar[ıi]m|montaj|kurulum|servis|ar[ıi]za/i;
  const serviceIntentDetected =
    intent === "SERVICE" ||
    (intent === "MANUFACTURE" && SERVICE_CONTEXT_RE.test(rawInput));
  if (
    serviceIntentDetected &&
    detected.categoryId &&
    PRODUCT_TO_SERVICE_CATEGORIES.has(detected.categoryId)
  ) {
    return {
      value: "services",
      confidence: Math.max(scoreConf, 0.75),
      status: "CONFIDENT",
      evidence: [
        `detector=${detected.categoryId}`,
        "service-intent-routes-to-services",
      ],
      alternatives: [
        {
          value: detected.categoryId,
          confidence: scoreConf,
          evidence: [`productCategory=${detected.categoryId}`],
        },
      ],
    };
  }

  // NO DEFAULT SERVICES: score 0 / unconfident services → UNKNOWN
  if (detected.score <= 0) {
    return {
      value: null,
      confidence: 0,
      status: "UNKNOWN",
      evidence: ["no category evidence"],
      alternatives,
    };
  }

  if (detected.categoryId === "services" && !detected.confident) {
    return {
      value: null,
      confidence: scoreConf,
      status: "UNKNOWN",
      evidence: [
        `detector=${detected.categoryId}`,
        `score=${detected.score}`,
        "unconfident-services-suppressed",
      ],
      alternatives,
    };
  }

  // Purchase/product intents should not inherit a confident SERVICE category from weak lexicon
  if (
    detected.categoryId === "services" &&
    (intent === "BUY" || intent === "SELL" || intent === "PART" || intent === "MANUFACTURE") &&
    detected.score < CATEGORY_DECISION.confidentMinScore + 2
  ) {
    return {
      value: detected.confident ? detected.categoryId : null,
      confidence: Math.min(scoreConf, 0.4),
      status: "TENTATIVE",
      evidence: [
        `detector=${detected.categoryId}`,
        `score=${detected.score}`,
        "intent-overrides-weak-services",
      ],
      alternatives,
    };
  }

  // Detector found evidence (score > 0): never nullify value.
  // Weak scores stay TENTATIVE so filters follow the detected category.
  const status = decisionStatus(scoreConf, {
    detectorConfident: detected.confident,
  });
  const resolvedStatus =
    detected.confident && scoreConf >= CATEGORY_DECISION.tentativeBelow
      ? "CONFIDENT"
      : status === "UNKNOWN"
        ? "TENTATIVE"
        : status;

  return {
    value: detected.categoryId,
    confidence: Math.max(scoreConf, CATEGORY_DECISION.unknownBelow),
    status: resolvedStatus,
    evidence: [
      `detector=${detected.categoryId}`,
      `score=${detected.score}`,
      `confident=${detected.confident}`,
    ],
    alternatives,
  };
}
