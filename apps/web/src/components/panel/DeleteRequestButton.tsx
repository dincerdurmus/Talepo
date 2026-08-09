"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

type DeleteRequestButtonProps = {
  requestId: string;
  variant?: "header" | "aside" | "list";
};

export function DeleteRequestButton({
  requestId,
  variant = "header",
}: DeleteRequestButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (loading) return;
    if (!window.confirm("Bu talebi silmek istediğinize emin misiniz?")) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Talep silinemedi.");
      }

      router.push(result.redirectTo || "/panel/taleplerim");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Talep silinirken bir hata oluştu.",
      );
      setLoading(false);
    }
  }

  const className =
    variant === "aside"
      ? "mt-3 flex w-full items-center justify-center gap-2 rounded-[18px] border border-[#8b352b]/25 bg-[#fff6f5] px-4 py-3 text-sm font-semibold text-[#8b352b] transition hover:bg-[#ffe9e6] disabled:opacity-50"
      : variant === "list"
        ? "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[14px] border border-black/[0.06] px-3 text-xs font-medium text-black/40 transition hover:border-red-200/70 hover:bg-red-50/50 hover:text-red-700 disabled:opacity-50 sm:h-auto sm:px-4 sm:py-2.5"
        : "inline-flex items-center gap-2 rounded-full border border-[#8b352b]/25 bg-[#fff6f5] px-4 py-2 text-xs font-semibold text-[#8b352b] transition hover:bg-[#ffe9e6] disabled:opacity-50";

  return (
    <div
      className={
        variant === "aside" ? "w-full" : variant === "list" ? "shrink-0" : undefined
      }
    >
      <button
        type="button"
        disabled={loading}
        onClick={() => void onDelete()}
        className={className}
        aria-label="Talebi sil"
      >
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        <span className={variant === "list" ? "hidden sm:inline" : undefined}>
          Talebi sil
        </span>
      </button>
      {error && (
        <p
          className={`mt-2 text-xs font-semibold text-[#8b352b] ${
            variant === "aside" ? "text-center" : variant === "list" ? "max-w-[9rem] text-center sm:max-w-none" : ""
          }`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
