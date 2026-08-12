"use client";

import { useState } from "react";
import { BellPlus, BookmarkPlus, LoaderCircle, Radar } from "lucide-react";

import {
  defaultFollowName,
  discoveryFilterToSavedSearch,
  followCategoryToSavedSearch,
  type CanonicalDiscoveryFilter,
} from "@/lib/discovery";

type DiscoveryWorkspaceActionsProps = {
  filter: CanonicalDiscoveryFilter | null;
  city?: string | null;
  urgent?: boolean;
  canSaveSearch: boolean;
  canCreateAlert: boolean;
  selectedNodeId?: string | null;
};

export function DiscoveryWorkspaceActions({
  filter,
  city,
  urgent,
  canSaveSearch,
  canCreateAlert,
  selectedNodeId,
}: DiscoveryWorkspaceActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nameOpen, setNameOpen] = useState<"save" | "follow" | "alert" | null>(
    null,
  );
  const [name, setName] = useState("");

  const hasFilter = Boolean(
    filter?.primaryLeafId || filter?.taxonomyNodeIds?.length || selectedNodeId,
  );

  async function createSavedSearch(
    filters: ReturnType<typeof discoveryFilterToSavedSearch>,
    searchName: string,
  ) {
    const response = await fetch("/api/monetization/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: searchName,
        filters,
      }),
    });
    const data = (await response.json()) as { ok?: boolean; message?: string };
    if (!response.ok) throw new Error(data.message ?? "Kaydedilemedi.");
  }

  async function createAlert(
    discoveryFilter: CanonicalDiscoveryFilter,
    alertName: string,
  ) {
    const response = await fetch("/api/monetization/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: alertName,
        city: city ?? discoveryFilter.location?.city ?? null,
        discoveryFilter,
      }),
    });
    const data = (await response.json()) as { ok?: boolean; message?: string };
    if (!response.ok) throw new Error(data.message ?? "Alarm oluşturulamadı.");
  }

  async function submit() {
    if (!nameOpen) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(nameOpen);
    setMessage(null);
    try {
      if (nameOpen === "save" && filter) {
        if (!canSaveSearch) throw new Error("Kayıtlı arama bu planda yok.");
        await createSavedSearch(
          discoveryFilterToSavedSearch(filter, {
            city: city ?? undefined,
            urgent,
          }),
          trimmed,
        );
        setMessage("Arama kaydedildi.");
      } else if (nameOpen === "follow" && selectedNodeId) {
        if (!canSaveSearch) throw new Error("Kategori takibi bu planda yok.");
        const leafExact = Boolean(filter?.leafExact && filter.primaryLeafId);
        await createSavedSearch(
          followCategoryToSavedSearch({
            nodeId: selectedNodeId,
            leafExact,
            city: city ?? undefined,
            urgent,
          }),
          trimmed,
        );
        setMessage("Kategori takibe alındı.");
      } else if (nameOpen === "alert" && filter) {
        if (!canCreateAlert) throw new Error("Alarm bu planda yok.");
        await createAlert(filter, trimmed);
        setMessage("Alarm oluşturuldu.");
      }
      setNameOpen(null);
      setName("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "İşlem başarısız.");
    } finally {
      setBusy(null);
    }
  }

  function openForm(kind: "save" | "follow" | "alert") {
    const nodeId = selectedNodeId || filter?.primaryLeafId || filter?.taxonomyNodeIds?.[0];
    setName(
      nodeId
        ? defaultFollowName(nodeId)
        : kind === "alert"
          ? "Yeni talep alarmı"
          : "Kayıtlı arama",
    );
    setNameOpen(kind);
    setMessage(null);
  }

  if (!hasFilter) return null;

  return (
    <div className="rounded-2xl border border-teal-900/8 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-teal-800/55">
        Keşif aksiyonları
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {canSaveSearch ? (
          <>
            <button
              type="button"
              onClick={() => openForm("save")}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-teal-900 px-3 text-xs font-semibold text-white"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Aramayı kaydet
            </button>
            <button
              type="button"
              onClick={() => openForm("follow")}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-teal-900/15 bg-white px-3 text-xs font-semibold text-teal-900"
            >
              <Radar className="h-3.5 w-3.5" />
              Bu kategoriyi takip et
            </button>
          </>
        ) : null}
        {canCreateAlert ? (
          <button
            type="button"
            onClick={() => openForm("alert")}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-teal-900/15 bg-white px-3 text-xs font-semibold text-teal-900"
          >
            <BellPlus className="h-3.5 w-3.5" />
            Yeni talep gelince bildir
          </button>
        ) : null}
      </div>

      {nameOpen ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-teal-900/10 bg-teal-50/30 p-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-xs font-semibold text-teal-950/55">
            {nameOpen === "alert"
              ? "Alarm adı"
              : nameOpen === "follow"
                ? "Takip adı"
                : "Arama adı"}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-teal-900/10 bg-white px-3 text-sm"
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={Boolean(busy) || !name.trim()}
              onClick={() => void submit()}
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-teal-900 px-4 text-xs font-semibold text-white disabled:opacity-45"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Onayla
            </button>
            <button
              type="button"
              onClick={() => setNameOpen(null)}
              className="h-10 rounded-lg border border-teal-900/10 px-3 text-xs font-semibold text-teal-900/60"
            >
              İptal
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-2 text-xs font-medium text-teal-800">{message}</p>
      ) : null}

      <p className="mt-3 text-[11px] leading-5 text-teal-950/45">
        <strong className="font-semibold text-teal-950/60">Takiplerim</strong>
        {" = "}
        kategori / kayıtlı arama / alarm.{" "}
        <strong className="font-semibold text-teal-950/60">Kaydettiklerim</strong>
        {" = "}
        tek tek talepler (watchlist).
      </p>
    </div>
  );
}
