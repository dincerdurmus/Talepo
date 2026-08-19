export type SayfamMetricKey = "requests" | "responses" | "messages";

export type SayfamFocusItem = {
  id: string;
  requestId: string;
  title: string;
  categorySlug: string | null;
  categoryName: string | null;
  coverImageUrl: string | null;
  statusLabel: string;
  detailLabel: string;
  href: string;
};

export type SayfamActivityItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  timeLabel: string;
  unread: boolean;
};

export type SayfamHomeData = {
  metrics: {
    activeRequests: number;
    actionRequiredOffers: number;
    unreadMessages: number;
  };
  focusItems: SayfamFocusItem[];
  activity: SayfamActivityItem[];
  heroHint: string;
};
