import Link from "next/link";
import { ArrowRight, Bell, Crown, Lock } from "lucide-react";

import type { ProfileEditorValues } from "@/components/panel/ProfileEditor";
import { formatQuotaRemaining } from "@/lib/membership/serialize";

import { ProfilePhoneField } from "./ProfilePhoneField";
import { SignalPrivateLabel, SignalSection, signalSurface } from "./ProfileSignal";

export function ProfileAccountPanel({
  email,
  phone,
  planLabel,
  isExpired,
  quotaLabel,
  profileSnapshot,
}: {
  email: string;
  phone: string | null;
  planLabel: string;
  isExpired: boolean;
  quotaLabel: string;
  profileSnapshot: ProfileEditorValues;
}) {
  return (
    <div className="space-y-5">
      <SignalSection
        title="Hesap merkezi"
        description="Bu alanlar karşı tarafa profil üzerinden gösterilmez."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <PrivateField label="E-posta" value={email} />
          <PrivateField
            label="Üyelik planı"
            value={`${planLabel}${isExpired ? " · süresi dolmuş" : ""}`}
          />
          <PrivateField label="Kalan teklif hakkı" value={quotaLabel} />
        </div>

        <div className="mt-4">
          <ProfilePhoneField
            phone={phone?.trim() ?? ""}
            profileSnapshot={profileSnapshot}
          />
        </div>
      </SignalSection>

      <div className={`${signalSurface} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-teal-950/40">
              Aktif plan
            </p>
            <p className="mt-1 text-xl font-semibold text-[#0f1f1d]">
              {planLabel}
            </p>
            {isExpired ? (
              <p className="mt-1 text-sm text-amber-700">Plan süresi dolmuş</p>
            ) : (
              <p className="mt-1 text-sm text-teal-950/50">
                Kalan hak: {quotaLabel}
              </p>
            )}
          </div>
          <Link
            href="/panel/plan"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-teal-900/12 bg-white/70 px-4 py-2 text-sm font-semibold text-teal-950 transition hover:border-teal-800/25"
          >
            <Crown className="h-4 w-4" />
            Plan yönetimi
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AccountLink href="/panel/plan" icon={Crown} label="Plan ve hesap yönetimi" />
        <AccountLink href="/panel/bildirimler" icon={Bell} label="Bildirimler" />
      </div>
    </div>
  );
}

function PrivateField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-teal-950/[0.06] bg-white/70 px-4 py-3.5">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-950/40">
        <Lock className="h-3 w-3" aria-hidden />
        {label} · Özel
      </p>
      <p className="mt-1.5 text-sm font-semibold text-[#0f1f1d]">{value}</p>
      <div className="mt-1.5">
        <SignalPrivateLabel />
      </div>
    </div>
  );
}

function AccountLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Crown;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center justify-between rounded-xl border border-teal-950/[0.08] bg-white/70 px-4 py-3 text-sm font-semibold transition hover:border-teal-800/20 hover:shadow-[0_0_0_3px_rgba(15,118,110,0.06)]"
    >
      <span className="inline-flex items-center gap-2 text-teal-950">
        <Icon className="h-4 w-4 text-teal-800/50" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-teal-950/25" />
    </Link>
  );
}

export function formatProfileQuotaLabel(
  quota: Parameters<typeof formatQuotaRemaining>[0],
) {
  return formatQuotaRemaining(quota);
}
