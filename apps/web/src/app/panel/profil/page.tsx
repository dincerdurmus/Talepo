import { redirect } from "next/navigation";



import { ProfilePageContent } from "@/components/panel/profile/ProfilePageContent";

import { formatProfileQuotaLabel } from "@/components/panel/profile/ProfileAccountPanel";

import { resolveAccountAuthMethod } from "@/lib/auth/account-auth-method";

import { getCompanyContextOptions } from "@/lib/membership/company-context";

import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";

import { calculateProfileCompletion } from "@/lib/profile/profile-completion";
import {
  formatMemberSince,
  formatParticipantLocation,
} from "@/lib/profile/public-profile";
import { buildPersonalProviderTrustAuthority } from "@/lib/profile/trust-surface";

import { prisma } from "@/lib/prisma";

import { requireUser } from "@/server/auth/require-user";

import {

  getBuyerTrustSummary,

  getCompanyTrustSummary,

  getUserTrustSummary,

} from "@/server/offer/trust-summary";

import { getPublicUserProfile } from "@/server/profile/public-profile-service";

import {

  countPendingBlindReviewsForUser,

  getSelfRatingDistributions,

} from "@/server/profile/self-profile-trust";



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

      emailVerified: true,

      passwordHash: true,

      createdAt: true,

      accounts: { select: { provider: true } },

    },

  });



  if (!user) redirect("/giris?callbackUrl=/panel/profil");



  const companyId =

    entitlements.subject.type === "company" ? entitlements.subject.id : null;

  const [

    personalTrust,

    companyTrust,

    buyerTrust,

    distributions,

    pendingBlindCount,

    publicPreview,

  ] = await Promise.all([

    getUserTrustSummary(user.id),

    companyId ? getCompanyTrustSummary(companyId) : Promise.resolve(null),

    getBuyerTrustSummary(user.id),

    getSelfRatingDistributions({ userId: user.id, companyId }),

    countPendingBlindReviewsForUser(user.id),

    getPublicUserProfile(sessionUser.id, user.id),

  ]);



  const authMethod = resolveAccountAuthMethod({

    passwordHash: user.passwordHash,

    accounts: user.accounts,

  });

  const completionPercent = calculateProfileCompletion(user);

  const initials = getInitials(user.name, user.email);

  const accountTypeLabel =

    entitlements.subject.type === "company"

      ? `Firma hesabı · ${entitlements.subject.name ?? "Firma"}`

      : "Kişisel hesap";

  const locationLabel = formatParticipantLocation(user.city, user.country);

  const memberSinceLabel = formatMemberSince(user.createdAt);

  const avatarSourceNote = resolveAvatarSourceNote(user.image, authMethod);
  const trustAuthority = buildPersonalProviderTrustAuthority(personalTrust);

  return (
    <section className="py-4 sm:py-6">
      <ProfilePageContent
        trustAuthority={trustAuthority}
        hero={{
          name: user.name ?? "Kullanıcı",
          image: user.image,
          initials,
          accountTypeLabel,
          locationLabel,
          memberSinceLabel,
          completionPercent,
          avatarSourceNote,
        }}

        editorInitial={{

          name: user.name ?? "",

          city: user.city ?? "",

          district: user.district ?? "",

          country: user.country ?? "Türkiye",

          biography: user.biography ?? "",

        }}

        publicPreview={publicPreview}

        personalTrust={personalTrust}

        companyTrust={companyTrust}

        buyerTrust={buyerTrust}

        distributions={distributions}

        pendingBlindCount={pendingBlindCount}

        authMethod={authMethod}

        emailVerified={Boolean(user.emailVerified)}

        hasPhone={Boolean(user.phone?.trim())}

        account={{

          email: user.email ?? "",

          phone: user.phone,

          planLabel: entitlements.planLabel,

          isExpired: entitlements.isExpired,

          quotaLabel: formatProfileQuotaLabel(entitlements.quota),

        }}

      />

    </section>

  );

}



function getInitials(name: string | null, email: string | null) {

  const source = name?.trim() || email?.trim() || "K";

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();

  return source.slice(0, 2).toUpperCase();

}



function resolveAvatarSourceNote(

  image: string | null | undefined,

  authMethod: ReturnType<typeof resolveAccountAuthMethod>,

) {

  if (!image?.trim()) return null;

  if (authMethod.oauthProviders.includes("google")) {

    return "Fotoğraf Google hesabınızdan gelir";

  }

  return "Profil fotoğrafı hesabınızdan gelir";
}
