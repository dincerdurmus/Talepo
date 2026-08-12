"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Bookmark,
  Flame,
  LoaderCircle,
  Radar,
  Search,
  Users,
} from "lucide-react";

import { matchBandLabel } from "@/lib/discovery";
import type {
  CorporateOpportunityFilter,
  CorporateOpportunityItem,
  CorporateOpportunitySummary,
  CorporateTeamMemberOption,
} from "@/server/monetization/corporate-opportunity-center";

type CorporateOpportunityCenterProps = {
  filter: CorporateOpportunityFilter;
  summary: CorporateOpportunitySummary;
  items: CorporateOpportunityItem[];
  teamMembers: CorporateTeamMemberOption[];
  currentMemberId: string | null;
  canAssign: boolean;
  canLeadDistribution: boolean;
  companyName: string;
};

const FILTERS: Array<{ id: CorporateOpportunityFilter; label: string }> = [
  { id: "all", label: "Tümü" },
  { id: "new", label: "Yeni" },
  { id: "unassigned", label: "Atanmamış" },
  { id: "assigned_to_me", label: "Bana atanan" },
  { id: "assigned", label: "Ekibe atanan" },
  { id: "following", label: "Kaydettiklerim" },
  { id: "offered", label: "Teklif verilen" },
];

function filterHref(filter: CorporateOpportunityFilter): string {
  const q = new URLSearchParams();
  q.set("view", "ops");
  if (filter !== "all") q.set("opsFilter", filter);
  return `/panel/firsatlar?${q.toString()}`;
}

function CorporateOpportunityCard({
  item,
  teamMembers,
  canAssign,
  busyId,
  onAssign,
  onUnassign,
}: {
  item: CorporateOpportunityItem;
  teamMembers: CorporateTeamMemberOption[];
  canAssign: boolean;
  busyId: string | null;
  onAssign: (opportunityId: string, memberId: string) => void;
  onUnassign: (opportunityId: string) => void;
}) {
  const band = matchBandLabel(item.priorityBand);
  const [memberId, setMemberId] = useState(item.assignedToMemberId ?? "");

  return (
    <article className="rounded-2xl border border-teal-900/8 bg-white p-4 shadow-[0_8px_30px_rgba(15,60,50,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.matchStatus === "NEW" ? (
              <span className="rounded-full bg-teal-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                Yeni
              </span>
            ) : null}
            {item.isUrgent ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                Acil
              </span>
            ) : null}
            {band ? (
              <span className="rounded-full bg-teal-900/8 px-2 py-0.5 text-[10px] font-semibold text-teal-900">
                {band === "Yüksek eşleşme"
                  ? "Yüksek öncelik"
                  : band === "Orta eşleşme"
                    ? "Normal"
                    : "İzlenebilir"}
              </span>
            ) : null}
            {item.offerStatusLabel ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                {item.offerStatusLabel}
              </span>
            ) : null}
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-teal-900/50 ring-1 ring-teal-900/10">
              {item.source === "INVENTORY"
                ? "Envanter"
                : item.source === "ALERT_RULE"
                  ? "Takip"
                  : "Profil"}
            </span>
          </div>
          <Link
            href={`/panel/talepler/${item.requestId}`}
            className="mt-2 block text-base font-semibold text-teal-950 hover:underline"
          >
            {item.title}
          </Link>
          <p className="mt-1 text-xs text-teal-800/65">
            {item.taxonomyPathLabels.length
              ? item.taxonomyPathLabels.join(" › ")
              : item.categoryName}
          </p>
          <p className="mt-1 text-xs text-teal-950/45">
            {[item.city, item.budgetLabel, item.assignedToLabel ? `Atanan: ${item.assignedToLabel}` : "Atanmamış"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {item.reasonLabels.length > 0 ? (
        <div className="mt-3 rounded-xl bg-teal-50/50 px-3 py-2">
          <p className="text-[11px] font-semibold text-teal-900/70">Neden uygun?</p>
          <ul className="mt-1 space-y-0.5 text-xs text-teal-950/55">
            {item.reasonLabels.map((label) => (
              <li key={label}>• {label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Link
          href={`/panel/talepler/${item.requestId}`}
          className="inline-flex h-9 items-center rounded-xl border border-teal-900/12 px-3 text-xs font-semibold text-teal-900"
        >
          İncele
        </Link>
        <Link
          href={`/panel/talepler/${item.requestId}/teklif`}
          className="inline-flex h-9 items-center rounded-xl bg-teal-900 px-3 text-xs font-semibold text-white"
        >
          Teklif ver
        </Link>

        {canAssign ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-semibold text-teal-950/50">
              Ata
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="mt-1 block h-9 min-w-[140px] rounded-xl border border-teal-900/12 bg-white px-2 text-xs"
              >
                <option value="">Üye seç</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.load})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!memberId || busyId === item.opportunityId}
              onClick={() => onAssign(item.opportunityId, memberId)}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-teal-900/12 px-3 text-xs font-semibold text-teal-900 disabled:opacity-40"
            >
              {busyId === item.opportunityId ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Ata
            </button>
            {item.assignedToMemberId ? (
              <button
                type="button"
                disabled={busyId === item.opportunityId}
                onClick={() => onUnassign(item.opportunityId)}
                className="inline-flex h-9 items-center rounded-xl border border-teal-900/12 px-3 text-xs font-semibold text-teal-900/60"
              >
                Atamayı kaldır
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function CorporateOpportunityCenter({
  filter,
  summary,
  items,
  teamMembers,
  canAssign,
  canLeadDistribution,
  companyName,
}: CorporateOpportunityCenterProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  async function assign(opportunityId: string, memberId: string) {
    setBusyId(opportunityId);
    setMessage(null);
    try {
      const response = await fetch("/api/monetization/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          opportunityId,
          memberId,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setMessage(data.message ?? "Atama başarısız.");
        return;
      }
      const member = teamMembers.find((m) => m.id === memberId);
      setLocalItems((rows) =>
        rows.map((r) =>
          r.opportunityId === opportunityId
            ? {
                ...r,
                assignedToMemberId: memberId,
                assignedToLabel: member?.label ?? "Üye",
              }
            : r,
        ),
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function unassign(opportunityId: string) {
    setBusyId(opportunityId);
    setMessage(null);
    try {
      const response = await fetch("/api/monetization/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unassign",
          opportunityId,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setMessage(data.message ?? "Kaldırılamadı.");
        return;
      }
      setLocalItems((rows) =>
        rows.map((r) =>
          r.opportunityId === opportunityId
            ? {
                ...r,
                assignedToMemberId: null,
                assignedToLabel: null,
              }
            : r,
        ),
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-teal-900/8 bg-gradient-to-br from-teal-50/50 via-white to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/55">
              Corporate Opportunity Center
            </p>
            <h2 className="mt-1 text-xl font-semibold text-teal-950">
              {companyName} fırsat operasyonu
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-teal-950/55">
              Keşfet → Nitelendir → Ata → Takip et → Teklif ver. Master Taxonomy ve
              canonical discovery üzerine kuruludur.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href="/panel/firsatlar?view=browse"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-teal-900/10 bg-white px-3 font-semibold text-teal-900/70"
            >
              <Search className="h-3.5 w-3.5" />
              Taxonomy keşif
            </Link>
            <Link
              href="/panel/kayitli-aramalar"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-teal-900/10 bg-white px-3 font-semibold text-teal-900/70"
            >
              <Radar className="h-3.5 w-3.5" />
              Takipler ({summary.trackedCategoryCount})
            </Link>
            <Link
              href="/panel/uyarilar"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-teal-900/10 bg-white px-3 font-semibold text-teal-900/70"
            >
              <Bell className="h-3.5 w-3.5" />
              Bildirimler ({summary.alertCount})
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Yeni", value: summary.newCount },
            { label: "Atanmamış", value: summary.unassignedCount },
            { label: "Bana atanan", value: summary.assignedToMeCount },
            { label: "Ekipte", value: summary.assignedCount },
            { label: "Kaydedilen", value: summary.followingCount },
            { label: "Teklif", value: summary.offeredCount },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-teal-900/8 bg-white px-3 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-900/45">
                {m.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-teal-950">{m.value}</p>
            </div>
          ))}
        </div>

        {teamMembers.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-teal-900/8 bg-white px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-900/60">
              <Users className="h-3.5 w-3.5" />
              Ekip yükü
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-teal-950/70">
              {teamMembers.slice(0, 8).map((m) => (
                <span
                  key={m.id}
                  className="rounded-full bg-teal-50 px-2.5 py-1 font-medium"
                >
                  {m.label} — {m.load} fırsat
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-dashed border-teal-900/12 bg-teal-50/30 px-4 py-3 text-sm text-teal-950/60">
          <p className="font-semibold text-teal-950">Fırsat takibi ayarı</p>
          <p className="mt-1 text-xs leading-5">
            Hunter, kayıtlı arama ve alarmlardaki{" "}
            <strong className="font-semibold">canonical taxonomy filtrelerini</strong>{" "}
            kullanır. İkinci filter şeması yoktur.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Link
              href="/panel/kayitli-aramalar"
              className="font-semibold text-teal-900 underline-offset-2 hover:underline"
            >
              Kategori / arama takibi
            </Link>
            <Link
              href="/panel/uyarilar"
              className="font-semibold text-teal-900 underline-offset-2 hover:underline"
            >
              Bildirim kuralları
            </Link>
            <Link
              href="/panel/envanter"
              className="font-semibold text-teal-900 underline-offset-2 hover:underline"
            >
              Envanter
            </Link>
            <Link
              href="/panel/ekip"
              className="font-semibold text-teal-900 underline-offset-2 hover:underline"
            >
              Ekip
            </Link>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-teal-900/8 bg-white p-1">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Link
              key={f.id}
              href={filterHref(f.id)}
              className={`inline-flex h-9 items-center rounded-xl px-3 text-xs font-semibold transition ${
                active
                  ? "bg-teal-900 text-white"
                  : "text-teal-900/65 hover:bg-teal-50"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
        <Link
          href="/panel/firsatlar"
          className="ml-auto inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-teal-900/55"
        >
          <Flame className="h-3.5 w-3.5" />
          Pro keşif
        </Link>
      </div>

      {message ? (
        <p className="text-xs font-medium text-teal-800">{message}</p>
      ) : null}

      {!canLeadDistribution ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Lead dağıtımı bu planda kapalı. Opportunity listesi görüntülenebilir; atama
          için Corporate `lead_distribution` gerekir.
        </p>
      ) : null}

      {localItems.length > 0 ? (
        <div className="space-y-3">
          {localItems.map((item) => (
            <CorporateOpportunityCard
              key={item.opportunityId}
              item={item}
              teamMembers={teamMembers}
              canAssign={canAssign && canLeadDistribution}
              busyId={busyId}
              onAssign={assign}
              onUnassign={unassign}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-teal-900/12 bg-teal-50/30 p-8 text-center">
          <p className="text-base font-semibold text-teal-950">
            Henüz bu filtrede fırsat yok.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-teal-950/55">
            Kategori takibi kurun, alarm oluşturun veya envanter ekleyin — hunter
            canonical projection üzerinden eşleştirir.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href="/panel/firsatlar?view=browse"
              className="inline-flex h-10 items-center rounded-xl bg-teal-900 px-4 text-xs font-semibold text-white"
            >
              <Bookmark className="mr-1.5 h-3.5 w-3.5" />
              Kategori takip et
            </Link>
            <Link
              href="/panel/uyarilar"
              className="inline-flex h-10 items-center rounded-xl border border-teal-900/12 bg-white px-4 text-xs font-semibold text-teal-900"
            >
              Alarm oluştur
            </Link>
            <Link
              href="/panel/envanter"
              className="inline-flex h-10 items-center rounded-xl border border-teal-900/12 bg-white px-4 text-xs font-semibold text-teal-900"
            >
              Envanter ekle
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
