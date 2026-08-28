"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * SOHBET OKUNDU İŞARETİ — RENDER'DA DEĞİL (KB-22 Dilim 1).
 *
 * Yazım eskiden sayfanın RSC render'ında koşuyordu; prefetch bile onu
 * tetikleyebiliyordu. Artık ekran açıldıktan sonra yetkili bir POST çağrılır.
 *
 * DÖNGÜ YOK. Başarıdan sonra rozetin düşmesi için `router.refresh()` çağrılır;
 * bu, sunucu bileşenlerini yeniden render eder. `ranRef` tek koşum işareti
 * olmasaydı her yenileme yeni bir POST doğurabilir ve istek döngüsü
 * oluşabilirdi.
 *
 * SESSİZ BAŞARI YOK. Hata konuşma içeriğini yok etmez — sayfa açık kalır —
 * ama görünür bir uyarı ve yeniden deneme düğmesiyle bildirilir.
 */
export function ConversationReadReceipt({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();
  const ranRef = useRef(false);
  const [failed, setFailed] = useState(false);

  const run = useCallback(async () => {
    setFailed(false);
    try {
      const response = await fetch(
        `/api/messages/${encodeURIComponent(conversationId)}/read`,
        { method: "POST" },
      );
      if (!response.ok) {
        setFailed(true);
        return;
      }
      router.refresh();
    } catch {
      setFailed(true);
    }
  }, [conversationId, router]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void run();
  }, [run]);

  if (!failed) return null;

  return (
    <div role="alert">
      <span>Konuşma okundu işaretlenemedi.</span>
      <button
        type="button"
        onClick={() => {
          void run();
        }}
      >
        Tekrar dene
      </button>
    </div>
  );
}
