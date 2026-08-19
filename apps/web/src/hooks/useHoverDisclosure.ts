"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";

const CLOSE_DELAY_MS = 220;

export function useHoverDisclosure() {
  const [open, setOpen] = useState(false);
  const hoverCapableRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const pointerIntentRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      hoverCapableRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current == null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const close = useCallback(() => {
    cancelClose();
    setOpen(false);
  }, [cancelClose]);

  const openMenu = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  return {
    open,
    setOpen,
    menuId,
    rootRef,
    openMenu,
    close,
    getRootProps: () => ({
      ref: rootRef,
      onPointerEnter: () => {
        if (hoverCapableRef.current) openMenu();
      },
      onPointerLeave: () => {
        if (!hoverCapableRef.current) return;
        cancelClose();
        closeTimerRef.current = window.setTimeout(close, CLOSE_DELAY_MS);
      },
      onBlurCapture: (event: FocusEvent<HTMLDivElement>) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        close();
      },
    }),
    getTriggerProps: () => ({
      "aria-expanded": open,
      "aria-haspopup": "menu" as const,
      "aria-controls": menuId,
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        pointerIntentRef.current =
          event.pointerType === "mouse" || event.pointerType === "touch";
      },
      onClick: () => setOpen((current) => !current),
      onFocus: () => {
        if (pointerIntentRef.current) {
          pointerIntentRef.current = false;
          return;
        }
        openMenu();
      },
    }),
    getMenuProps: () => ({
      id: menuId,
      role: "menu" as const,
    }),
  };
}
