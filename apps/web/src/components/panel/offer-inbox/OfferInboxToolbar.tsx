import type { ReactNode } from "react";

export function OfferInboxToolbar({
  filters,
  action = null,
}: {
  filters: ReactNode;
  action?: ReactNode | null;
}) {
  if (!action) {
    return <div className="talepo-offer-inbox-toolbar">{filters}</div>;
  }

  return (
    <div className="talepo-offer-inbox-toolbar talepo-offer-inbox-toolbar--with-action">
      <div className="talepo-offer-inbox-toolbar-filters">{filters}</div>
      <div className="talepo-offer-inbox-toolbar-action">{action}</div>
    </div>
  );
}
