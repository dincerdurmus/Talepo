"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  BellOff,
  Bookmark,
  LoaderCircle,
  Lock,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";

import type { FollowTrack } from "@/lib/monetization/follow-tracks";

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
    <section className="rounded-[28px] border border-teal-900/8 bg-white p-6 shadow-[0_16px_55px_rgba(15,60,50,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-900/8 text-teal-800">
            <Bookmark className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-teal-950">Takipleriniz</h2>
            <p className="mt-1 text-sm text-teal-950/50">
              Aynı kriteri yeniden açın veya yeni eşleşmelerde bildirim alın.
            </p>
          </div>
        </div>
        {canCreateTrack ? (
          <Link
            href="/panel/talepler"
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-900 px-3.5 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Yeni takip
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {tracks.length === 0 ? (
        <div className="mt-6 rounded-xl bg-teal-50/60 p-5 text-sm text-teal-950/55">
          <p className="font-semibold text-teal-950">Henüz bir takibiniz yok.</p>
          <p className="mt-1">
            Keşfet’te filtreleyin ve takibe ekleyin. Yeni eşleşmelerde bildirim
            almayı dilediğiniz zaman açabilirsiniz.
          </p>
          <Link
            href="/panel/talepler"
            className="mt-3 inline-flex font-semibold text-teal-800 underline"
          >
            Talepleri keşfet
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {tracks.map((track) => (
            <li
              key={track.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-900/8 px-4 py-3"
            >
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
                      className="h-9 flex-1 rounded-lg border border-teal-900/10 px-3 text-sm"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-teal-900 px-3 text-xs font-semibold text-white"
                    >
                      Kaydet
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="font-semibold text-teal-950">{track.name}</p>
                    <p className="mt-1 text-xs text-teal-950/45">{track.summary}</p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {alertsEnabled ? (
                  <button
                    type="button"
                    onClick={() =>
                      void toggleNotifications(track, !track.notificationsOn)
                    }
                    disabled={togglingId === track.id}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-45 ${
                      track.notificationsOn
                        ? "border border-teal-900/10 bg-teal-50 text-teal-800"
                        : "border border-teal-900/15 text-teal-900/70 hover:bg-teal-50"
                    }`}
                  >
                    {togglingId === track.id ? (
                      <LoaderCircle className="h-3 w-3 animate-spin" />
                    ) : track.notificationsOn ? (
                      <Bell className="h-3 w-3" />
                    ) : (
                      <BellOff className="h-3 w-3" />
                    )}
                    {track.notificationsOn ? "Bildirimler açık" : "Bildirimler kapalı"}
                  </button>
                ) : (
                  <Link
                    href="/panel/plan"
                    className="inline-flex items-center gap-1 rounded-full border border-teal-900/15 px-3 py-1.5 text-xs font-semibold text-teal-900/55"
                  >
                    <Lock className="h-3 w-3" />
                    Bildirimler
                  </Link>
                )}
                <Link
                  href={track.runUrl}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Play className="h-3 w-3" />
                  Aramayı aç
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(track.id);
                    setRenameValue(track.name);
                  }}
                  className="rounded-full p-2 text-teal-800 hover:bg-teal-50"
                  aria-label="Yeniden adlandır"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void deleteTrack(track)}
                  className="rounded-full p-2 text-rose-700 hover:bg-rose-50"
                  aria-label="Sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
