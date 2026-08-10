import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { requireUser } from "@/server/auth/require-user";
import { buildOpportunitiesFeed } from "@/server/monetization/opportunities-feed";

import { FeatureUpgradeGate } from "@/components/panel/FeatureUpgradeGate";
import { OpportunitiesHub } from "@/components/panel/OpportunitiesHub";

export default async function OpportunitiesPage() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const entitled = hasFeature(entitlements.features, "hot_opportunities");

  const companyId =
    entitled && entitlements.subject.type === "company"
      ? entitlements.subject.id
      : null;

  const feed = companyId ? await buildOpportunitiesFeed(companyId) : [];

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">Profesyonel</p>
        <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">Fırsatlar</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-teal-950/55">
          Sıcak talepler, rekabet sinyalleri ve takip listesi — gerçek veriye dayalı skorlar.
        </p>
      </section>

      <FeatureUpgradeGate feature="hot_opportunities" entitled={entitled}>
        <OpportunitiesHub initialFeed={feed} />
      </FeatureUpgradeGate>
    </>
  );
}
