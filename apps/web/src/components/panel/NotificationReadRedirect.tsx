"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * BİLDİRİM TIKLAMASI — OKUNDU İŞARETİ RENDER'DA DEĞİL (KB-22 Dilim 1).
 *
 * Sayfa artık render sırasında yazmaz: yalnız bildirimi okur ve GÜVENLİ
 * HEDEFİ SUNUCUDA hesaplar. Bu bileşen ekran açıldıktan sonra yetkili POST'u
 * çağırır ve ancak BAŞARIDAN SONRA hedefe geçer.
 *
 * AÇIK YÖNLENDİRME YOK. `destination` sunucudan gelen bir prop'tur; istemci
 * hiçbir yerden (sorgu dizesi, `location.search`, kullanıcı girdisi) hedef
 * okumaz. Yine de savunma amaçlı doğrulanır: yalnız tek eğik çizgiyle
 * başlayan iç yollar kabul edilir, `//host` biçimi reddedilir.
 *
 * SESSİZ BAŞARI YOK. POST başarısızsa yönlendirme yapılmaz; kullanıcıya
 * erişilebilir bir hata ve yeniden deneme düğmesi gösterilir.
 */
/**
 * YALNIZ İÇ YOL. Tek eğik çizgiyle başlamak YETMEZ: tarayıcılar `/\host`
 * biçimini de protokole bağlı dış adres gibi çözer. Bu yüzden ikinci karakter
 * eğik çizgi ya da TERS eğik çizgi olamaz. Şema taşıyan (`http:`, `https:`)
 * ve ters eğik çizgiyle başlayan değerler zaten ilk koşulda düşer.
 */
export function isInternalPath(value: string): boolean {
  if (!value.startsWith("/")) return false;
  const second = value.charAt(1);
  if (second === "/" || second === "\\") return false;
  return true;
}

export function NotificationReadRedirect({
  notificationId,
  destination,
}: {
  notificationId: string;
  destination: string;
}) {
  const router = useRouter();
  const startedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  const run = useCallback(async () => {
    setFailed(false);
    try {
      const response = await fetch(
        `/api/notifications/${encodeURIComponent(notificationId)}/read`,
        { method: "POST" },
      );
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const target = isInternalPath(destination) ? destination : "/panel";
      router.replace(target);
    } catch {
      setFailed(true);
    }
  }, [destination, notificationId, router]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void run();
  }, [run]);

  if (!failed) {
    return (
      <p role="status" aria-live="polite">
        Bildirim açılıyor…
      </p>
    );
  }

  return (
    <div role="alert">
      <p>Bildirim okundu işaretlenemedi. Yönlendirme yapılmadı.</p>
      <button
        type="button"
        onClick={() => {
          startedRef.current = true;
          void run();
        }}
      >
        Tekrar dene
      </button>
    </div>
  );
}
