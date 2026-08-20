import type { WorkspacePerformanceMetrics } from "@/lib/monetization/types";

export type AnalysisRoleView = "overview" | "buyer" | "seller";

export type AnalysisNextStep = {
  title: string;
  body: string;
  href: string;
  cta: string;
};

export const ANALYSIS_ROLE_TABS: {
  id: AnalysisRoleView;
  label: string;
}[] = [
  { id: "overview", label: "Genel" },
  { id: "buyer", label: "Alıcı olarak" },
  { id: "seller", label: "Satıcı olarak" },
];

export function analysisWorkspaceCopy(input: {
  kind: "user" | "company";
  companyName: string | null;
}): string {
  if (input.kind === "company") {
    return input.companyName?.trim() || "Firma çalışma alanı";
  }
  return "Kişisel çalışma alanı";
}

export function analysisHeadlineInsight(
  metrics: WorkspacePerformanceMetrics | null,
  days: number,
): string {
  if (!metrics) {
    return "Hareketleriniz geldikçe Analiz burada netleşir.";
  }

  const requests = metrics.requests;
  const offers = metrics.offers;
  const published = requests?.published ?? 0;
  const submitted = offers.submitted;
  const withoutOffers = requests?.withoutOffers ?? 0;
  const pending = offers.pending;

  if (published === 0 && submitted === 0) {
    return "Bu dönemde henüz hareket yok. Talep veya teklif oluşunca özet burada görünür.";
  }
  if (withoutOffers > 0) {
    return `${withoutOffers} talebiniz hâlâ teklif bekliyor.`;
  }
  if (pending > 0) {
    return `${pending} teklifiniz yanıt bekliyor.`;
  }
  if (metrics.scope === "company") {
    return `Son ${days} günde ${submitted} teklif gönderildi.`;
  }
  if (published > 0 && submitted > 0) {
    return `Son ${days} günde ${published} talep yayınlandı ve ${submitted} teklif gönderildi.`;
  }
  if (published > 0) {
    return `Son ${days} günde ${published} talep yayınlandı.`;
  }
  return `Son ${days} günde ${submitted} teklif gönderildi.`;
}

export function resolveAnalysisNextStep(
  metrics: WorkspacePerformanceMetrics | null,
): AnalysisNextStep {
  if (!metrics) {
    return {
      title: "Analizi doldurmak için başlayın",
      body: "Bir talep yayınlayın veya açık bir talebe teklif verin. Özet gerçek kayıtlardan oluşur.",
      href: "/talep",
      cta: "Talep oluştur",
    };
  }

  const requests = metrics.requests;
  const offers = metrics.offers;
  const isCompany = metrics.scope === "company";

  if (requests && requests.withoutOffers > 0) {
    return {
      title: "Teklif bekleyen talepleriniz var",
      body: `${requests.withoutOffers} talebiniz henüz teklif almadı. Metni netleştirmek yanıtı hızlandırabilir.`,
      href: "/panel/taleplerim",
      cta: "Taleplerim",
    };
  }

  if (!isCompany && requests && requests.withOffers > 0) {
    return {
      title: "Gelen teklifleri değerlendirin",
      body: `${requests.totalOffersReceived} teklif bekleyen taleplerinize ulaştı.`,
      href: "/panel/gelen-teklifler",
      cta: "Gelen teklifler",
    };
  }

  if (offers.pending > 0) {
    return {
      title: "Yanıt bekleyen teklifleriniz var",
      body: `${offers.pending} gönderilmiş teklif hâlâ açık. Durumu tekliflerinizden izleyebilirsiniz.`,
      href: "/panel/teklifler",
      cta: "Tekliflerim",
    };
  }

  if ((requests?.published ?? 0) === 0 && offers.submitted === 0) {
    return {
      title: "İlk hareketinizi kaydedin",
      body: "Analiz, yayınladığınız talepler ve gönderdiğiniz tekliflerden oluşur.",
      href: "/talep",
      cta: "Talep oluştur",
    };
  }

  return {
    title: "Açık taleplere bakın",
    body: "Uygun bir talebe teklif vererek satıcı performansınızı büyütebilirsiniz.",
    href: "/panel/talepler",
    cta: "Talepler",
  };
}

export type AnalysisFlowStep = {
  key: string;
  label: string;
  value: number;
  href: string;
};

export function buyerFlowSteps(
  metrics: WorkspacePerformanceMetrics,
): AnalysisFlowStep[] | null {
  if (!metrics.requests) return null;
  const r = metrics.requests;
  return [
    { key: "request", label: "Talep", value: r.published, href: "/panel/taleplerim" },
    {
      key: "offer",
      label: "Teklif",
      value: r.totalOffersReceived,
      href: "/panel/gelen-teklifler",
    },
    {
      key: "result",
      label: "Sonuç",
      value: r.acceptedOutcome,
      href: "/panel/gelen-teklifler",
    },
  ];
}

export function sellerFlowSteps(
  metrics: WorkspacePerformanceMetrics,
  negotiatedCompleted?: number | null,
): AnalysisFlowStep[] {
  const o = metrics.offers;
  const middle =
    negotiatedCompleted != null
      ? {
          key: "wait",
          label: "Pazarlık",
          value: negotiatedCompleted,
          href: "/panel/teklifler",
        }
      : {
          key: "wait",
          label: "Bekleyen",
          value: o.pending,
          href: "/panel/teklifler",
        };
  return [
    { key: "offer", label: "Teklif", value: o.submitted, href: "/panel/teklifler" },
    middle,
    {
      key: "result",
      label: "Sonuç",
      value: o.completedTransactions,
      href: "/panel/teklifler",
    },
  ];
}

export function displayEmptyMetric(value: string | number): string | number {
  return value === "—" ? "Veri yok" : value;
}
