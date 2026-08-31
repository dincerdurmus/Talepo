"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Binoculars,
  Bookmark,
  Compass,
  Lightbulb,
  Radar,
} from "lucide-react";

import {
  buildCanonicalFilterFromWorkspaceParams,
  type CanonicalDiscoveryFilter,
} from "@/lib/discovery";
import { OpportunitiesHub } from "@/components/panel/OpportunitiesHub";
import { SignalActivityShell } from "@/components/panel/signal/SignalActivityShell";
import type { OpportunityFeedItem } from "@/server/monetization/opportunities-feed";
import type { DiscoveryWorkspaceItem } from "@/server/monetization/discovery-workspace-query";
import {
  RADAR_BRAND_LINE,
  RADAR_BRAND_SUBLINE,
} from "@/lib/monetization/talepo-radar";
import type { TaxonomyNode } from "@/lib/taxonomy";

import { DiscoveryActiveFilterBar } from "./DiscoveryActiveFilterBar";
import { DiscoveryResultCard } from "./DiscoveryResultCard";
import { DiscoveryWorkspaceActions } from "./DiscoveryWorkspaceActions";
import { TaxonomyCascadeBrowse } from "./TaxonomyCascadeBrowse";
import { TaxonomySearchBox } from "./TaxonomySearchBox";

export type WorkspaceView =
  | "suggested"
  | "browse"
  | "saved"
  | "radar"
  | "tracking";

export type ProfessionalDiscoveryWorkspaceProps = {
  view: WorkspaceView;
  feed: OpportunityFeedItem[];
  discoveryItems: DiscoveryWorkspaceItem[];
  taxonomyNode?: string | null;
  taxonomyLeaf?: string | null;
  leafExact?: boolean;
  city?: string | null;
  urgent?: boolean;
  canSaveSearch: boolean;
  canCreateAlert: boolean;
  canWatchlist: boolean;
  canRadar?: boolean;
  trackedSearchCount: number;
  alertCount: number;
  opportunityContext?: "PERSONAL" | "WORKSPACE";
};

function buildHref(params: {
  view?: WorkspaceView;
  taxonomyNode?: string | null;
  taxonomyLeaf?: string | null;
  leafExact?: boolean;
  city?: string | null;
  urgent?: boolean;
}): string {
  const q = new URLSearchParams();
  if (params.view && params.view !== "suggested") q.set("view", params.view);
  if (params.taxonomyNode) q.set("taxonomyNode", params.taxonomyNode);
  if (params.taxonomyLeaf) q.set("taxonomyLeaf", params.taxonomyLeaf);
  if (params.leafExact) q.set("leafExact", "1");
  if (params.city?.trim()) q.set("city", params.city.trim());
  if (params.urgent) q.set("urgent", "1");
  const s = q.toString();
  return s ? `/panel/firsatlar?${s}` : "/panel/firsatlar";
}

const VIEW_TABS: Array<{
  id: WorkspaceView;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "suggested", label: "Önerilen", icon: <Lightbulb className="h-3.5 w-3.5" /> },
  { id: "radar", label: "Talepo Radar", icon: <Radar className="h-3.5 w-3.5" /> },
  { id: "browse", label: "Keşfet", icon: <Compass className="h-3.5 w-3.5" /> },
  { id: "tracking", label: "Takip", icon: <Binoculars className="h-3.5 w-3.5" /> },
  { id: "saved", label: "Kaydettiklerim", icon: <Bookmark className="h-3.5 w-3.5" /> },
];

function workspaceChrome(
  view: WorkspaceView,
  isPersonalSurface: boolean,
  criteriaCount: number,
): {
  title: string;
  description: string;
  summary: string;
} {
  if (view === "radar") {
    return {
      title: RADAR_BRAND_LINE,
      description: RADAR_BRAND_SUBLINE,
      summary:
        "Bu bir öneri listesi değil. Pazarın hareketlenen bölümlerini izlersiniz.",
    };
  }
  if (view === "browse") {
    return {
      title: isPersonalSurface ? "Fırsat Havuzu" : "Keşfet",
      description: isPersonalSurface
        ? "Önerilen kriterlerinize girmeyen fakat platformda açık olan diğer ticari fırsatlar."
        : "Kategori, şehir ve aciliyete göre açık talepleri tarayın.",
      summary: "Keşif görünümü",
    };
  }
  if (view === "saved") {
    return {
      title: "Kaydettiklerim",
      description: "Daha sonra bakmak için kaydettiğiniz talepler.",
      summary: "Kayıtlı talepler",
    };
  }
  if (view === "tracking") {
    return {
      title: "Takip",
      description:
        "Kayıtlı takip kriterlerinizden gelen açık fırsatlar. Kuralları Takiplerim’de yönetirsiniz.",
      summary:
        criteriaCount > 0
          ? `${criteriaCount} aktif takip kriteri`
          : "Henüz takip kriteri yok",
    };
  }
  return {
    title: "Önerilen fırsatlar",
    description: isPersonalSurface
      ? "Takiplerim kriterlerinizle gerçekten eşleşen açık talepler."
      : "Size uygun fırsatlar ve neden önerildikleri.",
    summary: "Neden uygun olduğu önce görünür.",
  };
}

export function ProfessionalDiscoveryWorkspace({
  view,
  feed,
  discoveryItems,
  taxonomyNode,
  taxonomyLeaf,
  leafExact,
  city,
  urgent,
  canSaveSearch,
  canCreateAlert,
  canWatchlist,
  canRadar = true,
  trackedSearchCount,
  alertCount,
  opportunityContext,
}: ProfessionalDiscoveryWorkspaceProps) {
  const router = useRouter();
  const [cityDraft, setCityDraft] = useState(city ?? "");
  const [bookmarkBusy, setBookmarkBusy] = useState<string | null>(null);
  const [bookmarkError, setBookmarkError] = useState<{
    requestId: string;
    message: string;
  } | null>(null);
  const [localItems, setLocalItems] = useState(discoveryItems);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL/props → görünüm durumu senkronu (PanelShell emsali)
    setLocalItems(discoveryItems);
  }, [discoveryItems]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL/props → görünüm durumu senkronu (PanelShell emsali)
    setCityDraft(city ?? "");
  }, [city]);

  const filter: CanonicalDiscoveryFilter | null = useMemo(
    () =>
      buildCanonicalFilterFromWorkspaceParams({
        taxonomyNode,
        taxonomyLeaf,
        leafExact,
        city,
        urgent: Boolean(urgent),
      }),
    [taxonomyNode, taxonomyLeaf, leafExact, city, urgent],
  );

  const selectedNodeId = taxonomyLeaf || taxonomyNode || null;

  function navigate(next: {
    view?: WorkspaceView;
    taxonomyNode?: string | null;
    taxonomyLeaf?: string | null;
    leafExact?: boolean;
    city?: string | null;
    urgent?: boolean;
  }) {
    router.push(
      buildHref({
        view: next.view ?? view,
        taxonomyNode:
          next.taxonomyNode === undefined ? taxonomyNode : next.taxonomyNode,
        taxonomyLeaf:
          next.taxonomyLeaf === undefined ? taxonomyLeaf : next.taxonomyLeaf,
        leafExact: next.leafExact === undefined ? leafExact : next.leafExact,
        city: next.city === undefined ? city : next.city,
        urgent: next.urgent === undefined ? urgent : next.urgent,
      }),
    );
  }

  function onTaxonomySelect(node: TaxonomyNode, exact: boolean) {
    navigate({
      view: "browse",
      taxonomyNode: exact ? null : node.id,
      taxonomyLeaf: exact ? node.id : null,
      leafExact: exact,
    });
  }

  function onTaxonomyPick(nodeId: string, exact: boolean) {
    navigate({
      view: "browse",
      taxonomyNode: exact ? null : nodeId,
      taxonomyLeaf: exact ? nodeId : null,
      leafExact: exact,
    });
  }

  async function toggleBookmark(requestId: string, add: boolean) {
    if (!canWatchlist) return;
    setBookmarkBusy(requestId);
    setBookmarkError(null);
    try {
      const response = await fetch("/api/monetization/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: add ? "add" : "remove",
          requestId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        setBookmarkError({
          requestId,
          message: data.message ?? "Kaydedilemedi.",
        });
        return;
      }
      setLocalItems((rows) =>
        rows.map((r) =>
          r.requestId === requestId ? { ...r, isWatchlisted: add } : r,
        ),
      );
    } catch {
      setBookmarkError({ requestId, message: "Bağlantı hatası." });
    } finally {
      setBookmarkBusy(null);
    }
  }

  const surface =
    opportunityContext ??
    feed[0]?.context ??
    (canWatchlist ? "WORKSPACE" : "PERSONAL");
  const isPersonalSurface = surface === "PERSONAL";
  const showBrowseChrome =
    !isPersonalSurface && (view === "browse" || Boolean(selectedNodeId));
  const showDiscoveryResults =
    !isPersonalSurface &&
    (view === "browse" || view === "saved");
  const hubView =
    view === "browse"
      ? "browse"
      : view === "radar"
        ? "radar"
        : view === "tracking"
          ? "tracking"
          : "suggested";

  const criteriaCount = trackedSearchCount + alertCount;

  const viewTabs = VIEW_TABS.filter((tab) => {
    if (tab.id === "saved" && !canWatchlist) return false;
    if (tab.id === "radar" && !canRadar) return false;
    // Takip results live in the personal opportunity family only.
    if (tab.id === "tracking" && !isPersonalSurface) return false;
    return true;
  }).map((tab) =>
    tab.id === "browse" && isPersonalSurface
      ? { ...tab, label: "Fırsat Havuzu" }
      : tab,
  );

  const chrome = workspaceChrome(view, isPersonalSurface, criteriaCount);
  const isRadarView = view === "radar";
  const isPoolView = view === "browse";
  const isTrackingView = view === "tracking";
  const shellTone = isRadarView
    ? "radar"
    : isPoolView
      ? "pool"
      : isTrackingView
        ? "follows"
        : "opportunity";
  const shellClass = isRadarView
    ? "talepo-opportunity-shell talepo-opportunity-shell--radar"
    : isPoolView
      ? "talepo-opportunity-shell talepo-opportunity-shell--pool"
      : isTrackingView
        ? "talepo-opportunity-shell talepo-opportunity-shell--follows"
        : "talepo-opportunity-shell";

  return (
    <SignalActivityShell
      tone={shellTone}
      className={shellClass}
      eyebrow={
        isRadarView ? "Talepo Radar" : isTrackingView ? "Takip" : "Fırsatlar"
      }
      title={chrome.title}
      description={chrome.description}
      summary={chrome.summary}
    >
      <div className="talepo-opportunity-toolbar">
        <nav
          className="talepo-opportunity-switch"
          aria-label="Fırsat görünümü"
        >
          {viewTabs.map((tab) => {
            const active = view === tab.id;
            return (
              <Link
                key={tab.id}
                href={buildHref({
                  view: tab.id,
                  taxonomyNode: tab.id === "browse" ? taxonomyNode : null,
                  taxonomyLeaf: tab.id === "browse" ? taxonomyLeaf : null,
                  leafExact: tab.id === "browse" ? leafExact : false,
                  city,
                })}
                aria-current={active ? "page" : undefined}
                className="talepo-opportunity-tab"
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {isTrackingView ? (
          <Link
            href="/panel/takiplerim"
            className="talepo-opportunity-manage"
          >
            <Binoculars className="h-3.5 w-3.5" aria-hidden />
            Takipleri yönet
          </Link>
        ) : null}
      </div>

      <div className="space-y-5">
      {showBrowseChrome ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-3">
            <TaxonomySearchBox onPick={onTaxonomyPick} />
            <TaxonomyCascadeBrowse
              selectedNodeId={selectedNodeId}
              onSelect={onTaxonomySelect}
            />
          </div>
          <div className="space-y-3">
            <form
              className="talepo-opportunity-filters"
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ city: cityDraft.trim() || null, view: "browse" });
              }}
            >
              <label className="min-w-[140px] flex-1 text-xs font-semibold text-teal-950/50">
                Şehir
                <input
                  value={cityDraft}
                  onChange={(e) => setCityDraft(e.target.value)}
                  placeholder="İstanbul"
                  className="mt-1 h-10 w-full rounded-lg border border-teal-900/10 px-3 text-sm"
                />
              </label>
              <label className="flex items-end gap-2 pb-1 text-xs font-semibold text-teal-950/70">
                <input
                  type="checkbox"
                  checked={Boolean(urgent)}
                  onChange={(e) =>
                    navigate({ urgent: e.target.checked, view: "browse" })
                  }
                />
                Acil
              </label>
              <button
                type="submit"
                className="h-10 self-end rounded-lg bg-teal-900 px-4 text-xs font-semibold text-white"
              >
                Uygula
              </button>
            </form>

            <DiscoveryActiveFilterBar
              filter={filter}
              city={city}
              urgent={urgent}
              onClearNode={() =>
                navigate({
                  taxonomyNode: null,
                  taxonomyLeaf: null,
                  leafExact: false,
                  view: "browse",
                })
              }
              onClearCity={() => {
                setCityDraft("");
                navigate({ city: null, view: "browse" });
              }}
              onClearUrgent={() => navigate({ urgent: false, view: "browse" })}
              onToggleLeafExact={() =>
                navigate({
                  leafExact: !leafExact,
                  taxonomyLeaf: taxonomyLeaf || taxonomyNode,
                  taxonomyNode: leafExact ? taxonomyLeaf || taxonomyNode : null,
                  view: "browse",
                })
              }
            />

            <DiscoveryWorkspaceActions
              filter={filter}
              city={city}
              urgent={urgent}
              canSaveSearch={canSaveSearch}
              canCreateAlert={canCreateAlert}
              selectedNodeId={selectedNodeId}
            />
          </div>
        </div>
      ) : null}

      {showDiscoveryResults ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-teal-950">
                {view === "saved"
                  ? "Kaydettiklerim"
                  : urgent
                    ? "Acil keşif sonuçları"
                    : "Keşif sonuçları"}
              </h2>
              <p className="mt-1 text-sm text-teal-950/50">
                Mevcut talep ve eşleşme verileriyle oluşturulan keşif sonuçları.
              </p>
            </div>
            <p className="text-xs font-medium text-teal-900/45">
              {localItems.length} sonuç
            </p>
          </div>

          {localItems.length > 0 ? (
            <div className="space-y-3">
              {localItems.map((item) => (
                <DiscoveryResultCard
                  key={item.requestId}
                  item={item}
                  onBookmarkToggle={canWatchlist ? toggleBookmark : undefined}
                  busy={bookmarkBusy}
                  saveError={
                    bookmarkError?.requestId === item.requestId
                      ? bookmarkError.message
                      : null
                  }
                />
              ))}
            </div>
          ) : (
            <div className="talepo-opportunity-empty text-center">
              <p className="text-base font-semibold text-teal-950">
                {selectedNodeId
                  ? "Bu kategoride şu an aktif talep yok."
                  : view === "saved"
                    ? "Henüz kaydettiğiniz talep yok."
                    : "Filtreye uyan açık talep yok."}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-teal-950/55">
                Kategoriyi takip ederek veya alarm kurarak yeni taleplerden haberdar
                olabilirsiniz.
              </p>
              {selectedNodeId && canSaveSearch ? (
                <div className="mx-auto mt-4 max-w-lg">
                  <DiscoveryWorkspaceActions
                    filter={filter}
                    city={city}
                    urgent={urgent}
                    canSaveSearch={canSaveSearch}
                    canCreateAlert={canCreateAlert}
                    selectedNodeId={selectedNodeId}
                  />
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link
                  href="/panel/takiplerim"
                  className="inline-flex h-10 items-center rounded-xl border border-teal-900/12 bg-white px-4 text-xs font-semibold text-teal-900"
                >
                  Takiplerim
                </Link>
                <Link
                  href="/panel/talepler?tab=newest"
                  className="inline-flex h-10 items-center rounded-xl bg-teal-900 px-4 text-xs font-semibold text-white"
                >
                  Yeni taleplere bak
                </Link>
              </div>
            </div>
          )}
        </section>
      ) : (
        <OpportunitiesHub
          initialFeed={feed}
          canWatchlist={canWatchlist}
          view={hubView}
          opportunityContext={surface}
          followCriteriaCount={criteriaCount}
        />
      )}
      </div>
    </SignalActivityShell>
  );
}

