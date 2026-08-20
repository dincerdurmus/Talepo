"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  BellOff,
  LoaderCircle,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { CategoryVisualThumb } from "@/components/visuals/CategoryVisualThumb";
import {
  followCriteriaChips,
  type FollowTrack,
} from "@/lib/monetization/follow-tracks";

export function FollowTracksManager({
  initialTracks,
  alertsEnabled = false,
  canCreateTrack = true,
}: {
  initialTracks: FollowTrack[];
  alertsEnabled?: boolean;
  canCreateTrack?: boolean;
}) {
  const [tracks, setTracks] = useState(initialTracks);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function renameTrack(track: FollowTrack) {
    const name = renameValue.trim();
    if (!name) return;
    setRenamingId(null);
    setError(null);

    try {
      if (track.savedSearchId) {
        const response = await fetch("/api/monetization/saved-searches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            id: track.savedSearchId,
            name,
          }),
        });
        if (!response.ok) {
          const data = (await response.json()) as { message?: string };
          throw new Error(data.message ?? "Yeniden adlandırılamadı.");
        }
      }
      if (track.alertRuleId && alertsEnabled) {
        const response = await fetch("/api/monetization/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            id: track.alertRuleId,
            name,
          }),
        });
        if (!response.ok && !track.savedSearchId) {
          const data = (await response.json()) as { message?: string };
          throw new Error(data.message ?? "Yeniden adlandırılamadı.");
        }
      }
      setTracks((current) =>
        current.map((row) => (row.id === track.id ? { ...row, name } : row)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yeniden adlandırılamadı.");
    }
  }

  async function deleteTrack(track: FollowTrack) {
    setTracks((current) => current.filter((row) => row.id !== track.id));
    setError(null);
    try {
      if (track.savedSearchId) {
        const response = await fetch("/api/monetization/saved-searches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id: track.savedSearchId }),
        });
        if (!response.ok) throw new Error("Silinemedi.");
        return;
      }
      if (track.alertRuleId) {
        const response = await fetch("/api/monetization/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id: track.alertRuleId }),
        });
        if (!response.ok) throw new Error("Silinemedi.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silinemedi.");
    }
  }

  async function toggleNotifications(track: FollowTrack, nextOn: boolean) {
    if (!alertsEnabled) return;
    setTogglingId(track.id);
    setError(null);
    setTracks((current) =>
      current.map((row) =>
        row.id === track.id ? { ...row, notificationsOn: nextOn } : row,
      ),
    );

    try {
      if (track.savedSearchId) {
        const response = await fetch("/api/monetization/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "setFromSavedSearch",
            savedSearchId: track.savedSearchId,
            isActive: nextOn,
          }),
        });
        const data = (await response.json()) as {
          ok?: boolean;
          rule?: { id: string };
          message?: string;
        };
        if (!response.ok) throw new Error(data.message ?? "Bildirim güncellenemedi.");
        setTracks((current) =>
          current.map((row) =>
            row.id === track.id
              ? {
                  ...row,
                  notificationsOn: nextOn,
                  alertRuleId: data.rule?.id ?? row.alertRuleId,
                }
              : row,
          ),
        );
        return;
      }

      if (track.alertRuleId) {
        const response = await fetch("/api/monetization/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            id: track.alertRuleId,
            isActive: nextOn,
          }),
        });
        if (!response.ok) throw new Error("Bildirim güncellenemedi.");
      }
    } catch (e) {
      setTracks((current) =>
        current.map((row) =>
          row.id === track.id ? { ...row, notificationsOn: !nextOn } : row,
        ),
      );
      setError(e instanceof Error ? e.message : "Bildirim güncellenemedi.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[1.05rem] font-semibold tracking-tight text-[#0f1f1d]">
            Kayıtlı kriterler
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-teal-950/50">
            Her takip, Talepler’de kaydettiğiniz filtreleri ve isteğe bağlı
            bildirim durumunu tutar.
          </p>
        </div>
        {canCreateTrack ? (
          <Link
            href="/panel/talepler?from=takiplerim"
            className="talepo-follow-cta"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            Yeni takip
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {tracks.length === 0 ? (
        <div className="talepo-follow-empty mt-5 text-sm text-teal-950/55">
          <p className="font-semibold text-[#0f1f1d]">
            Henüz bir takibiniz yok.
          </p>
          <p className="mt-1.5 leading-6">
            Talepler’de filtreleyin ve takibe ekleyin. Yeni eşleşmelerde bildirim
            almayı dilediğiniz zaman açabilirsiniz.
          </p>
          <Link
            href="/panel/talepler?from=takiplerim"
            className="mt-3 inline-flex font-semibold text-teal-800 underline"
          >
            Talepler
          </Link>
        </div>
      ) : (
        <ul className="talepo-follow-list mt-5">
          {tracks.map((track) => {
            const { chips, overflow } = followCriteriaChips(track.filters, 3);
            return (
              <li key={track.id} className="talepo-follow-card">
                <div className="talepo-follow-card-main">
                  <CategoryVisualThumb
                    categorySlug={track.categorySlug}
                    categoryName={track.categoryLabel}
                    size="badge"
                    className="talepo-follow-category-tile"
                  />
                  <div className="min-w-0 flex-1">
                    {renamingId === track.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void renameTrack(track);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="h-9 flex-1 rounded-lg border border-teal-900/10 bg-white px-3 text-sm"
                          autoFocus
                        />
                        <button type="submit" className="talepo-follow-cta">
                          Kaydet
                        </button>
                      </form>
                    ) : (
                      <>
                        <p className="talepo-follow-card-title">{track.name}</p>
                        {track.categoryLabel ? (
                          <p className="talepo-follow-card-category">
                            {track.categoryLabel}
                          </p>
                        ) : null}
                        {chips.length > 0 ? (
                          <div className="talepo-follow-criteria">
                            {chips.map((chip) => (
                              <span key={chip} className="talepo-follow-criterion">
                                {chip}
                              </span>
                            ))}
                            {overflow > 0 ? (
                              <span className="talepo-follow-criterion talepo-follow-criterion--more">
                                +{overflow} kriter
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <p className="talepo-follow-card-summary">
                            {track.summary}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="talepo-follow-card-actions">
                  {alertsEnabled ? (
                    <button
                      type="button"
                      onClick={() =>
                        void toggleNotifications(track, !track.notificationsOn)
                      }
                      disabled={togglingId === track.id}
                      className={`talepo-follow-notify${
                        track.notificationsOn ? " talepo-follow-notify--on" : ""
                      }`}
                    >
                      {togglingId === track.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : track.notificationsOn ? (
                        <Bell className="h-3.5 w-3.5" />
                      ) : (
                        <BellOff className="h-3.5 w-3.5" />
                      )}
                      {track.notificationsOn
                        ? "Bildirimler açık"
                        : "Bildirimler kapalı"}
                    </button>
                  ) : (
                    <Link href="/panel/plan" className="talepo-follow-notify">
                      <Lock className="h-3.5 w-3.5" />
                      Bildirimler
                    </Link>
                  )}

                  <Link href={track.runUrl} className="talepo-follow-open">
                    Aramayı aç
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>

                  <div className="talepo-follow-tools">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(track.id);
                        setRenameValue(track.name);
                      }}
                      className="talepo-follow-icon-btn"
                      aria-label="Yeniden adlandır"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteTrack(track)}
                      className="talepo-follow-icon-btn talepo-follow-icon-btn--danger"
                      aria-label="Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
