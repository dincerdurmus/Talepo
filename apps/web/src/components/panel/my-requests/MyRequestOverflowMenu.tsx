"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { LoaderCircle, MoreHorizontal } from "lucide-react";

import { CloneRequestAsDraftControl } from "@/components/panel/my-requests/CloneRequestAsDraftControl";
import { PanelCollisionPopover } from "@/components/panel/PanelCollisionPopover";
import type { MyRequestCardModel } from "@/lib/panel/my-requests-surface";

export function MyRequestOverflowMenu({
  request,
}: {
  request: Pick<
    MyRequestCardModel,
    | "id"
    | "canEdit"
    | "canDelete"
    | "canCloneAsDraft"
    | "editHref"
    | "viewHref"
    | "primaryCta"
  >;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setConfirmingDelete(false);
    setError(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  async function onDelete() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/requests/${request.id}`, {
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
      setOpen(false);
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

  const showEdit =
    request.canEdit && request.primaryCta.kind !== "continue_edit";
  const showView =
    request.primaryCta.kind !== "view" &&
    request.primaryCta.kind !== "view_process";

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#0f1f1d]/10 bg-white text-[#0f1f1d]/55 transition hover:bg-[#f4f7f6] hover:text-[#0f1f1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30"
        aria-label="Talep işlemleri"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((current) => !current);
          setConfirmingDelete(false);
          setError(null);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <PanelCollisionPopover
        open={open}
        onClose={close}
        triggerRef={triggerRef}
        id={menuId}
        role="menu"
        align="end"
        className="w-max min-w-[13.5rem] max-w-[min(18rem,calc(100vw-1rem))] rounded-2xl border border-[#0f1f1d]/10 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,31,29,0.16)]"
      >
        {showEdit ? (
          <Link
            href={request.editHref}
            role="menuitem"
            className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-[#0f1f1d] hover:bg-[#f4f7f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30"
          >
            Düzenle
          </Link>
        ) : null}
        {showView ? (
          <Link
            href={request.viewHref}
            role="menuitem"
            className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-[#0f1f1d] hover:bg-[#f4f7f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30"
          >
            Talebi görüntüle
          </Link>
        ) : null}
        {request.canCloneAsDraft ? (
          <CloneRequestAsDraftControl requestId={request.id} variant="menu" />
        ) : null}
        {request.canDelete ? (
          confirmingDelete ? (
            <div className="rounded-xl bg-[#fff6f5] px-3 py-2.5">
              <p className="text-sm font-medium text-[#8b352b]">
                Bu talebi silmek istediğinize emin misiniz?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#8b352b] px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b352b]/40 disabled:opacity-50"
                  disabled={loading}
                  onClick={() => void onDelete()}
                >
                  {loading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    "Sil"
                  )}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#0f1f1d]/10 bg-white px-3 text-sm font-medium text-[#0f1f1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Vazgeç
                </button>
              </div>
              {error ? (
                <p className="mt-2 text-xs font-medium text-[#8b352b]">
                  {error}
                </p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-[#8b352b] hover:bg-[#fff6f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b352b]/30"
              onClick={() => setConfirmingDelete(true)}
            >
              Talebi sil
            </button>
          )
        ) : null}
      </PanelCollisionPopover>
    </div>
  );
}
