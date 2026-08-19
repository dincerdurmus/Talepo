export type CollisionBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type CollisionPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const PANEL_COLLISION_POPOVER_EVENT = "talepo:panel-collision-popover-open";

export const DESKTOP_COLLISION_PADDING: CollisionPadding = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
};

/** Keep the menu above the mobile bottom nav. */
export const MOBILE_COLLISION_PADDING: CollisionPadding = {
  top: 8,
  right: 8,
  bottom: 88,
  left: 8,
};

export function collisionPaddingForViewport(width: number): CollisionPadding {
  return width < 1024 ? MOBILE_COLLISION_PADDING : DESKTOP_COLLISION_PADDING;
}

export function placeCollisionPopover(input: {
  trigger: CollisionBox;
  menu: { width: number; height: number };
  viewport: { width: number; height: number };
  padding?: CollisionPadding;
  gap?: number;
  align?: "start" | "end";
}): { top: number; left: number; side: "top" | "bottom" } {
  const padding = input.padding ?? DESKTOP_COLLISION_PADDING;
  const gap = input.gap ?? 6;
  const menuWidth = Math.min(
    input.menu.width,
    Math.max(48, input.viewport.width - padding.left - padding.right),
  );
  const menuHeight = Math.min(
    input.menu.height,
    Math.max(44, input.viewport.height - padding.top - padding.bottom),
  );

  const spaceBelow =
    input.viewport.height - (input.trigger.top + input.trigger.height) - padding.bottom;
  const spaceAbove = input.trigger.top - padding.top;
  const side: "top" | "bottom" =
    spaceBelow < menuHeight + gap && spaceAbove > spaceBelow ? "top" : "bottom";

  let top =
    side === "bottom"
      ? input.trigger.top + input.trigger.height + gap
      : input.trigger.top - menuHeight - gap;
  top = Math.min(
    Math.max(padding.top, top),
    input.viewport.height - menuHeight - padding.bottom,
  );

  let left =
    input.align === "start"
      ? input.trigger.left
      : input.trigger.left + input.trigger.width - menuWidth;
  left = Math.min(
    Math.max(padding.left, left),
    input.viewport.width - menuWidth - padding.right,
  );

  return { top, left, side };
}
