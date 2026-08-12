"use client";

import { FormEvent, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  formatMemberRole,
  formatMemberStatus,
  formatMoney,
  formatOfferStatus,
} from "@/lib/panel/company-format";

export type TeamMemberDTO = {
  id: string;
  role: string;
  status: string;
  invitedAt: string | Date;
  joinedAt: string | Date | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    membershipNumber?: string | null;
  };
};

export type MemberOfferDTO = {
  id: string;
  title: string | null;
  amount: string;
  currency: string;
  status: string;
  submittedAt: string | Date | null;
  request: { id: string; title: string; city: string | null };
};

export function TeamManager({
  companyName,
  initialMembers,
  canInvite,
  canRemove,
  canViewOffers,
  currentUserId,
  currentUserRole,
  initialOffersByUserId = {},
  seatUsage = null,
}: {
  companyName: string;
  initialMembers: TeamMemberDTO[];
  canInvite: boolean;
  canRemove: boolean;
  canViewOffers: boolean;
  currentUserId: string;
  currentUserRole: string | null;
  initialOffersByUserId?: Record<string, MemberOfferDTO[]>;
  /** Corporate included-seat usage; null when no seat cap. */
  seatUsage?: { activeSeats: number; includedSeats: number } | null;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [offersByUserId, setOffersByUserId] = useState(initialOffersByUserId);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [role, setRole] = useState<"MEMBER" | "MANAGER" | "ADMIN" | "VIEWER">(
    "MEMBER",
  );
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeSeatCount = members.filter((m) => m.status === "ACTIVE").length;
  const includedSeats = seatUsage?.includedSeats ?? null;
  const seatAtLimit =
    includedSeats != null && activeSeatCount >= includedSeats;

  const ownerCount = members.filter(
    (m) => m.role === "OWNER" && m.status === "ACTIVE",
  ).length;

  function canRemoveMember(member: TeamMemberDTO) {
    if (!canRemove) return false;
    if (member.user.id === currentUserId) return false;
    if (member.role === "OWNER" && currentUserRole !== "OWNER") return false;
    if (member.role === "OWNER" && ownerCount <= 1) return false;
    return true;
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    if (!canInvite) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/company/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite: inviteInput, role }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        member?: TeamMemberDTO;
      };

      if (!response.ok || !data.ok || !data.member) {
        setError(data.message ?? "Davet gönderilemedi.");
        return;
      }

      setMembers((current) => {
        const without = current.filter((m) => m.id !== data.member!.id);
        return [data.member!, ...without];
      });
      setInviteInput("");
      setMessage(data.message ?? "Davet gönderildi.");
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(member: TeamMemberDTO) {
    if (!canRemoveMember(member)) return;
    const label = member.user.name ?? member.user.email ?? "bu üyeyi";
    if (!window.confirm(`${label} ekipten çıkarılsın mı?`)) return;

    setRemovingId(member.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/company/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.message ?? "Üye çıkarılamadı.");
        return;
      }

      setMembers((current) => current.filter((m) => m.id !== member.id));
      setOffersByUserId((current) => {
        const next = { ...current };
        delete next[member.user.id];
        return next;
      });
      if (expandedUserId === member.user.id) setExpandedUserId(null);
      setMessage(data.message ?? "Üye çıkarıldı.");
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {includedSeats != null && (
        <div
          className={`rounded-[24px] border px-5 py-4 ${
            seatAtLimit
              ? "border-amber-800/20 bg-[#fff8ef]"
              : "border-black/[0.06] bg-white"
          }`}
        >
          <div className="flex items-center gap-2 text-teal-900">
            <Users className="h-4 w-4" />
            <p className="text-sm font-semibold">
              {activeSeatCount} / {includedSeats} koltuk kullanılıyor
            </p>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-black/45">
            Yalnız aktif üyeler koltuk tüketir (sahip dahil). Bekleyen davet
            koltuk sayılmaz.
            {seatAtLimit
              ? " Limit doldu; yeni üye aktifleştirilemez."
              : ""}
          </p>
        </div>
      )}

      {canInvite && (
        <form
          onSubmit={onInvite}
          className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 text-teal-800">
            <UserPlus className="h-4 w-4" />
            <p className="text-sm font-semibold">Ekibe davet et</p>
          </div>
          <p className="mt-2 text-xs text-black/45">
            Kullanıcı Talepo’da kayıtlı olmalı. E-posta veya üyelik numarası
            (TLP-100001) ile davet gönderin; bildirim otomatik gider.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.8fr_auto]">
            <input
              required
              type="text"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="ornek@firma.com veya TLP-100001"
              className="rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 text-sm outline-none"
              autoComplete="off"
            />
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as typeof role)
              }
              className="rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 text-sm outline-none"
            >
              <option value="MEMBER">Üye</option>
              <option value="MANAGER">Müdür</option>
              <option value="ADMIN">Yönetici</option>
              <option value="VIEWER">İzleyici</option>
            </select>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Davet et
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {message && <p className="mt-3 text-sm text-teal-800">{message}</p>}
        </form>
      )}

      {!canInvite && (error || message) && (
        <div className="rounded-[20px] border border-black/[0.06] bg-white px-4 py-3 text-sm shadow-sm">
          {error && <p className="text-red-600">{error}</p>}
          {message && <p className="text-teal-800">{message}</p>}
        </div>
      )}

      {members.length === 0 ? (
        <div className="rounded-[28px] border border-black/[0.06] bg-white p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-teal-800" />
          <h2 className="mt-4 text-xl font-semibold">Ekip boş</h2>
          <p className="mt-2 text-sm text-black/45">
            {companyName} için üye davet edin.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {members.map((member) => {
            const status = formatMemberStatus(member.status);
            const offers = offersByUserId[member.user.id] ?? [];
            const expanded = expandedUserId === member.user.id;
            const showOffersToggle = canViewOffers;
            const removable = canRemoveMember(member);

            return (
              <article
                key={member.id}
                className="rounded-[22px] border border-black/[0.06] bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-3 p-4">
                  {member.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.user.image}
                      alt={member.user.name ?? "Üye"}
                      className="h-11 w-11 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0f1f1d] text-xs font-semibold text-white">
                      {(member.user.name ?? member.user.email ?? "?")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {member.user.name ?? "Kullanıcı"}
                      {member.user.id === currentUserId ? (
                        <span className="ml-1.5 text-xs font-medium text-black/35">
                          (siz)
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-black/45">
                      {member.user.email} · {formatMemberRole(member.role)}
                      {canViewOffers
                        ? ` · ${offers.length} teklif`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.tone}`}
                  >
                    {status.label}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {showOffersToggle && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedUserId((current) =>
                            current === member.user.id ? null : member.user.id,
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-teal-900"
                      >
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        Teklifler
                      </button>
                    )}
                    {removable && (
                      <button
                        type="button"
                        disabled={removingId === member.id}
                        onClick={() => void onRemove(member)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-[#fff7f5] px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Üyeyi çıkart
                      </button>
                    )}
                  </div>
                </div>

                {showOffersToggle && expanded && (
                  <div className="border-t border-black/[0.05] bg-[#f7f9f7] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-800/55">
                      Verdiği teklifler
                    </p>
                    {offers.length === 0 ? (
                      <p className="mt-2 text-sm text-black/45">
                        Bu üyenin firma adına gönderilmiş teklifi yok.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {offers.map((offer) => {
                          const offerStatus = formatOfferStatus(offer.status);
                          return (
                            <li
                              key={offer.id}
                              className="rounded-xl border border-black/[0.05] bg-white px-3 py-2.5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <Link
                                    href={`/panel/talepler/${offer.request.id}`}
                                    className="font-medium text-teal-900 hover:underline"
                                  >
                                    {offer.request.title}
                                  </Link>
                                  <p className="mt-0.5 text-xs text-black/45">
                                    {[
                                      offer.request.city,
                                      offer.title || "Teklif",
                                      formatMoney(
                                        { toString: () => offer.amount },
                                        offer.currency,
                                      ),
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${offerStatus.tone}`}
                                >
                                  {offerStatus.label}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
