export const ADMIN_HEALTH_LABELS: Record<string, string> = {
  newUsers: "Yeni kullanıcı", companyRegistrations: "Firma kayıtları", companyClosures: "Firma kapatmaları",
  published: "Yayınlanan talep", requests: "Oluşturulan talep", offers: "Teklif", accepted: "Kabul edilen teklif",
  acceptanceRate: "Kabul oranı", offerCoverage: "Teklif kapsaması", noOffer: "Teklifsiz talep", activeSellers: "Aktif satıcı",
  openCases: "Açık vaka", failedBilling: "Başarısız ödeme", billingDrift: "Ödeme/üyelik ayrışması",
  billingDriftScanned: "Ayrışma taraması (hesap)", billingDriftTruncated: "Ayrışma taraması sınırı",
  zeroReach: "Hiç tedarikçiye ulaşmayan talep",
};

const alertKeys = new Set(["failedBilling", "noOffer", "companyClosures", "billingDrift", "billingDriftTruncated", "zeroReach"]);

export function healthMetricDisplay(key: string, value: number) {
  if (!Number.isFinite(value) || value < 0) return "Ölçülemedi";
  if (key === "billingDriftTruncated") return value ? "Sınıra ulaşıldı" : "Tamamlandı";
  return `${value.toLocaleString("tr-TR")}${key.includes("Rate") || key.includes("Coverage") ? "%" : ""}`;
}

export function healthMetricSummary(metrics: Record<string, number>) {
  const entries = Object.entries(metrics);
  return {
    alerts: entries.filter(([key, value]) => alertKeys.has(key) && value > 0),
    unknown: entries.filter(([, value]) => !Number.isFinite(value) || value < 0),
  };
}
