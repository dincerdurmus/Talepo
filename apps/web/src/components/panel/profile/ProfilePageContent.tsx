"use client";

import { useRef, useState } from "react";

import type { AccountAuthMethod } from "@/lib/auth/account-auth-method";
import type { ProfileTrustAuthority } from "@/lib/profile/trust-surface";
import type { PublicUserProfileDto } from "@/lib/profile/public-profile";
import type { TrustSummaryWithComments } from "@/server/offer/trust-summary";
import type { RatingDistribution } from "@/server/profile/self-profile-trust";

import { ProfileEditor, type ProfileEditorValues } from "@/components/panel/ProfileEditor";
import { ProfileAccountPanel } from "./ProfileAccountPanel";
import { ProfileIdentityHero } from "./ProfileIdentityHero";
import { ProfileSecurityPanel } from "./ProfileSecurityPanel";
import { ProfileTrustPanel } from "./ProfileTrustPanel";
import {
  SignalTabPanels,
  SignalTabStrip,
  type SignalTabId,
} from "./ProfileSignal";

export function ProfilePageContent({
  trustAuthority,
  hero,
  editorInitial,
  publicPreview,
  personalTrust,
  companyTrust,
  buyerTrust,
  distributions,
  pendingBlindCount,
  authMethod,
  emailVerified,
  hasPhone,
  account,
}: {
  trustAuthority: ProfileTrustAuthority;
  hero: {
    name: string;
    image: string | null;
    initials: string;
    accountTypeLabel: string;
    locationLabel: string | null;
    memberSinceLabel: string;
    completionPercent: number;
    avatarSourceNote: string | null;
  };
  editorInitial: ProfileEditorValues;
  publicPreview: PublicUserProfileDto;
  personalTrust: TrustSummaryWithComments;
  companyTrust: TrustSummaryWithComments | null;
  buyerTrust: TrustSummaryWithComments;
  distributions: {
    providerPersonal: RatingDistribution;
    providerCompany: RatingDistribution;
    buyer: RatingDistribution;
  };
  pendingBlindCount: number;
  authMethod: AccountAuthMethod;
  emailVerified: boolean;
  hasPhone: boolean;
  account: {
    email: string;
    phone: string | null;
    planLabel: string;
    isExpired: boolean;
    quotaLabel: string;
  };
}) {
  const [activeTab, setActiveTab] = useState<SignalTabId>("profil");
  const profileFormRef = useRef<HTMLDivElement>(null);

  function scrollToProfileForm() {
    setActiveTab("profil");
    requestAnimationFrame(() => {
      profileFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <div className="min-w-0">
      <ProfileIdentityHero
        name={hero.name}
        image={hero.image}
        initials={hero.initials}
        accountTypeLabel={hero.accountTypeLabel}
        locationLabel={hero.locationLabel}
        memberSinceLabel={hero.memberSinceLabel}
        completionPercent={hero.completionPercent}
        trustAuthority={trustAuthority}
        avatarSourceNote={hero.avatarSourceNote}
        publicPreview={publicPreview}
        onCompleteProfile={scrollToProfileForm}
      />

      <SignalTabStrip active={activeTab} onChange={setActiveTab} />

      <SignalTabPanels
        active={activeTab}
        sections={{
          profil: (
            <div ref={profileFormRef} className="space-y-5">
              <ProfileEditor initial={editorInitial} />
            </div>
          ),
          guven: (
            <ProfileTrustPanel
              trustAuthority={trustAuthority}
              personalTrust={personalTrust}
              companyTrust={companyTrust}
              buyerTrust={buyerTrust}
              distributions={distributions}
              pendingBlindCount={pendingBlindCount}
            />
          ),
          giris: (
            <ProfileSecurityPanel
              authMethod={authMethod}
              emailVerified={emailVerified}
              hasPhone={hasPhone}
            />
          ),
          hesap: (
            <ProfileAccountPanel
              email={account.email}
              phone={account.phone}
              planLabel={account.planLabel}
              isExpired={account.isExpired}
              quotaLabel={account.quotaLabel}
              profileSnapshot={editorInitial}
            />
          ),
        }}
      />
    </div>
  );
}
