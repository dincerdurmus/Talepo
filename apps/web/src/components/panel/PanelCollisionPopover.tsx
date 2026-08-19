"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  collisionPaddingForViewport,
  PANEL_COLLISION_POPOVER_EVENT,
  placeCollisionPopover,
} from "@/lib/panel/collision-popover";

type PanelCollisionPopoverProps = {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  id: string;
  role?: "menu" | "dialog";
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
};

export function PanelCollisionPopover({
  open,
  onClose,
  triggerRef,
  id,
  role = "menu",
  align = "end",
  className,
  children,
}: PanelCollisionPopoverProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    ready: boolean;
  }>({ top: 0, left: 0, ready: false });
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    setCoords({ top: 0, left: 0, ready: false });
  }

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const triggerBox = trigger.getBoundingClientRect();
    const menuBox = menu.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const next = placeCollisionPopover({
      trigger: triggerBox,
      menu: {
        width: Math.max(menuBox.width, menu.offsetWidth),
        height: Math.max(menuBox.height, menu.offsetHeight),
      },
      viewport,
      padding: collisionPaddingForViewport(viewport.width),
      align,
    });
    setCoords((current) => {
      if (
        current.ready &&
        current.top === next.top &&
        current.left === next.left
      ) {
        return current;
      }
      return { top: next.top, left: next.left, ready: true };
    });
  }, [align, triggerRef]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place, children]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(
      new CustomEvent(PANEL_COLLISION_POPOVER_EVENT, { detail: id }),
    );
    function onPeer(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== id) onClose();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    function onViewport() {
      place();
    }
    window.addEventListener(PANEL_COLLISION_POPOVER_EVENT, onPeer);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    const menu = menuRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && menu
        ? new ResizeObserver(() => place())
        : null;
    if (menu) resizeObserver?.observe(menu);
    return () => {
      window.removeEventListener(PANEL_COLLISION_POPOVER_EVENT, onPeer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
      resizeObserver?.disconnect();
    };
  }, [id, onClose, open, place, triggerRef]);

  useEffect(() => {
    if (!open || !coords.ready) return;
    const menu = menuRef.current;
    if (!menu) return;
    const active = document.activeElement;
    if (active instanceof Node && menu.contains(active)) return;
    const first = menu.querySelector<HTMLElement>(
      'button, [href], [tabindex]:not([tabindex="-1"])',
    );
    first?.focus({ preventScroll: true });
  }, [open, coords.ready, children]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      role={role}
      data-collision-popover="true"
      data-ready={coords.ready ? "true" : "false"}
      className={className}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        zIndex: 90,
        visibility: coords.ready ? "visible" : "hidden",
        pointerEvents: coords.ready ? "auto" : "none",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
