"use client";

/**
 * GLOBAL HATA SINIRI (CLAUDE_PRODUCT_IMPROVEMENT, 2026-08-31).
 *
 * Kök layout'un kendisi çökerse `error.tsx` çalışamaz; Next bu durumda
 * yalnız `global-error.tsx`'i çizer ve o hiç yoktu. Bu dosya kendi <html>
 * iskeletini taşımak zorundadır. Stil bilinçli olarak satır içidir: layout
 * çöktüğünde global CSS'in yüklendiği garanti edilemez.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f7f6",
          color: "#0f1f1d",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(139,53,43,0.8)",
            }}
          >
            Bir şeyler ters gitti
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: 24, fontWeight: 600 }}>
            Talepo şu anda yüklenemedi
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(15,31,29,0.55)",
            }}
          >
            Geçici bir sorun oluştu. Yeniden denemek çoğu zaman yeterlidir.
          </p>
          {error.digest ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 11,
                color: "rgba(15,31,29,0.35)",
              }}
            >
              Destek kodu: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              minHeight: 48,
              width: "100%",
              borderRadius: 12,
              border: 0,
              background: "#0f766e",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Yeniden dene
          </button>
        </div>
      </body>
    </html>
  );
}
