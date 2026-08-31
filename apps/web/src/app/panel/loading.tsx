/**
 * PANEL GEÇİŞ İSKELETİ (CLAUDE_PRODUCT_IMPROVEMENT, 2026-08-31).
 *
 * Ölçüldü: 30+ panel sayfasından yalnız ikisinin (analiz, taleplerim)
 * loading durumu vardı; diğer sayfalara geçişte kullanıcı sunucu bileşeni
 * çözülene kadar boş beyaz ekranda bekliyordu. Bu iskelet panel segmentinin
 * TAMAMI için genel bekleme yüzeyidir; kendi loading dosyası olan sayfalar
 * kendi özel iskeletini kullanmaya devam eder.
 */
export default function PanelLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[64rem] animate-pulse pb-8 pt-2"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-2.5 w-40 rounded-full bg-[#0f1f1d]/8" />
      <div className="mt-3 h-8 w-64 rounded-lg bg-[#0f1f1d]/10" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-[#0f1f1d]/6" />
      <div className="mt-6 space-y-3">
        <div className="h-24 rounded-2xl border border-[#0f1f1d]/6 bg-white" />
        <div className="h-24 rounded-2xl border border-[#0f1f1d]/6 bg-white" />
        <div className="h-24 rounded-2xl border border-[#0f1f1d]/6 bg-white" />
      </div>
    </div>
  );
}
