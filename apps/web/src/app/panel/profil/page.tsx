import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Crown,
  FileText,
  Mail,
  MapPin,
  Phone,
  Search,
  UserRound,
} from "lucide-react";

import { ProfileEditor } from "@/components/panel/ProfileEditor";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { formatQuotaRemaining } from "@/lib/membership/serialize";
import { formatAverageRating, formatReviewCount } from "@/lib/offer/deal-review";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import {
  getBuyerTrustSummary,
  getCompanyTrustSummary,
  getUserTrustSummary,
} from "@/server/offer/trust-summary";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const entitlements = await resolveEntitlements(
    sessionUser.id,
    await getCompanyContextOptions(),
  );

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phone: true,
      city: true,
      district: true,
      country: true,
      biography: true,
      createdAt: true,
      _count: {
        select: {
          createdRequests: true,
          submittedOffers: true,
          notifications: { where: { status: "UNREAD" } },
        },
      },
    },
  });

  if (!user) redirect("/giris?callbackUrl=/panel/profil");

  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;
  const [personalTrust, companyTrust, buyerTrust] = await Promise.all([
    getUserTrustSummary(user.id),
    companyId ? getCompanyTrustSummary(companyId) : Promise.resolve(null),
    getBuyerTrustSummary(user.id),
  ]);

  const initials = getInitials(user.name, user.email);

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="text-sm font-semibold text-black/35">Hesap</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Profil
        </h1>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col items-center text-center">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? "Profil"}
                className="h-24 w-24 rounded-full border border-black/10 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#151515] text-2xl font-semibold text-white">
                {initials}
              </div>
            )}

            <h2 className="mt-5 text-2xl font-semibold tracking-tight">
              {user.name ?? "Kullanıcı"}
            </h2>
            <p className="mt-1 text-sm text-black/40">{user.email}</p>
            <p className="mt-4 rounded-full bg-[#f3f3ef] px-3 py-1.5 text-xs font-semibold text-black/45">
              {entitlements.planLabel} plan
              {entitlements.isExpired ? " · süresi dolmuş" : ""}
            </p>
          </div>

          <div className="mt-8 space-y-3 border-t border-black/[0.06] pt-6">
            <StatRow
              label="Taleplerim"
              value={String(user._count.createdRequests)}
            />
            <StatRow
              label="Verdiğim teklifler"
              value={String(user._count.submittedOffers)}
            />
            {personalTrust.completedTransactions > 0 ? (
              <StatRow
                label="Tamamlanan işlem"
                value={String(personalTrust.completedTransactions)}
              />
            ) : null}
            {personalTrust.reviewCount > 0 && personalTrust.averageRating != null ? (
              <StatRow
                label="Değerlendirme"
                value={`${formatAverageRating(personalTrust.averageRating)} · ${formatReviewCount(personalTrust.reviewCount)}`}
              />
            ) : null}
            {companyTrust && companyTrust.completedTransactions > 0 ? (
              <StatRow
                label="Firma tamamlanan işlem"
                value={String(companyTrust.completedTransactions)}
              />
            ) : null}
            {companyTrust &&
            companyTrust.reviewCount > 0 &&
            companyTrust.averageRating != null ? (
              <StatRow
                label="Firma değerlendirme"
                value={`${formatAverageRating(companyTrust.averageRating)} · ${formatReviewCount(companyTrust.reviewCount)}`}
              />
            ) : null}
            {buyerTrust.completedTransactions > 0 ? (
              <StatRow
                label="Tamamlanan alım"
                value={String(buyerTrust.completedTransactions)}
              />
            ) : null}
            {buyerTrust.reviewCount > 0 && buyerTrust.averageRating != null ? (
              <StatRow
                label="Alıcı değerlendirme"
                value={`${formatAverageRating(buyerTrust.averageRating)} · ${formatReviewCount(buyerTrust.reviewCount)}`}
              />
            ) : null}
            <StatRow
              label="Kalan teklif hakkı"
              value={formatQuotaRemaining(entitlements.quota)}
            />
            <StatRow
              label="Okunmamış bildirim"
              value={String(user._count.notifications)}
            />
          </div>

          <div className="mt-6 space-y-3 border-t border-black/[0.06] pt-6">
            <InfoField
              icon={Phone}
              label="Telefon"
              value={user.phone ?? "Henüz eklenmedi"}
            />
            <InfoField
              icon={MapPin}
              label="Konum"
              value={formatLocation(user.city, user.district, user.country)}
            />
            <InfoField
              icon={Mail}
              label="E-posta"
              value={user.email ?? "—"}
            />
          </div>

          <Link
            href="/panel/plan"
            className="mt-6 flex items-center justify-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white"
          >
            <Crown className="h-4 w-4" />
            Planı yönet
          </Link>
        </aside>

        <section className="space-y-5">
          <ProfileEditor
            initial={{
              name: user.name ?? "",
              email: user.email ?? "",
              phone: user.phone ?? "",
              city: user.city ?? "",
              district: user.district ?? "",
              country: user.country ?? "Türkiye",
              biography: user.biography ?? "",
            }}
          />

          {personalTrust.recentComments.length > 0 ||
          (companyTrust && companyTrust.recentComments.length > 0) ? (
            <div className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
              <h3 className="text-xl font-semibold tracking-tight">
                Son değerlendirmeler
              </h3>
              <ul className="mt-5 space-y-3">
                {[
                  ...personalTrust.recentComments.map((row) => ({
                    ...row,
                    scope: "Kişisel",
                  })),
                  ...(companyTrust?.recentComments ?? []).map((row) => ({
                    ...row,
                    scope: "Firma",
                  })),
                ]
                  .slice(0, 5)
                  .map((row, index) => (
                    <li
                      key={`${row.createdAt}-${index}`}
                      className="rounded-2xl bg-[#f6f6f2] px-4 py-3"
                    >
                      <p className="text-xs font-medium text-black/40">
                        {row.scope} ·{" "}
                        {row.reviewerSide === "BUYER" ? "Alıcı" : "Teklif veren"} ·{" "}
                        {row.rating}/5
                      </p>
                      <p className="mt-1 text-sm leading-6 text-black/70">
                        {row.comment}
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
            <h3 className="text-xl font-semibold tracking-tight">
              Hızlı erişim
            </h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <QuickLink
                href="/panel/taleplerim"
                icon={FileText}
                label="Taleplerim"
              />
              <QuickLink
                href="/panel/talepler"
                icon={Search}
                label="Talepleri keşfet"
              />
              <QuickLink
                href="/panel/plan"
                icon={Crown}
                label="Plan ve teklif hakları"
              />
              <QuickLink
                href="/panel/bildirimler"
                icon={Bell}
                label="Bildirimler"
              />
              <QuickLink
                href="/talep"
                icon={ArrowRight}
                label="Yeni talep oluştur"
              />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function getInitials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "K";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatLocation(
  city: string | null,
  district: string | null,
  country: string,
) {
  return [district, city, country].filter(Boolean).join(", ") || "Henüz eklenmedi";
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[#f6f6f2] px-4 py-3">
      <span className="text-sm text-black/45">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] bg-[#f6f6f2] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-black/35">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-[18px] border border-black/[0.06] px-4 py-4 text-sm font-semibold transition hover:bg-[#fafaf8]"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-black/40" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-black/25" />
    </Link>
  );
}
