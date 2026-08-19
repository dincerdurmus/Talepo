import { MyRequestCard } from "@/components/panel/my-requests/MyRequestCard";
import { MyRequestsFilterBar } from "@/components/panel/my-requests/MyRequestsFilterBar";
import {
  MyRequestsEmpty,
  PanelMyRequestsHome,
} from "@/components/panel/my-requests/PanelMyRequestsHome";
import { UrgentNoOfferNudgePoller } from "@/components/panel/UrgentNoOfferNudgePoller";
import { loadMyRequestsHome } from "@/lib/panel/my-requests-home-data";
import {
  countMyRequestFilters,
  filterMyRequests,
  parseMyRequestsFilter,
  summarizeMyRequestBanner,
} from "@/lib/panel/my-requests-surface";
import { requireUser } from "@/server/auth/require-user";

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const filter = parseMyRequestsFilter(query.durum);
  const { cards, hasOpenUrgentWithoutNudge } = await loadMyRequestsHome(user.id);
  const counts = countMyRequestFilters(cards);
  const visible = filterMyRequests(cards, filter);

  return (
    <>
      <UrgentNoOfferNudgePoller enabled={hasOpenUrgentWithoutNudge} />
      <PanelMyRequestsHome
        banner={summarizeMyRequestBanner(cards)}
        filterBar={
          counts.all > 0 ? (
            <MyRequestsFilterBar active={filter} counts={counts} />
          ) : null
        }
      >
        {visible.length === 0 ? (
          <MyRequestsEmpty filter={filter} totalCount={counts.all} />
        ) : (
          <section className="grid gap-3" aria-label="Taleplerim listesi">
            {visible.map((request) => (
              <MyRequestCard key={request.id} request={request} />
            ))}
          </section>
        )}
      </PanelMyRequestsHome>
    </>
  );
}
