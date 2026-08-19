import { notFound, redirect } from "next/navigation";

import { PublicProfileCard } from "@/components/panel/ParticipantProfileDrawer";
import { requireUser } from "@/server/auth/require-user";
import {
  getPublicUserProfile,
  resolvePublicProfileByUserId,
} from "@/server/profile/public-profile-service";
import { PublicProfileAccessError } from "@/server/profile/public-profile-access";
import { isSelfProfile } from "@/server/profile/public-profile-access";

export default async function PublicUserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ conversation?: string }>;
}) {
  const sessionUser = await requireUser();
  const { userId } = await params;
  const { conversation } = await searchParams;

  if (isSelfProfile(sessionUser.id, userId)) {
    redirect("/panel/profil");
  }

  try {
    const profile = conversation
      ? await resolvePublicProfileByUserId(
          sessionUser.id,
          userId,
          conversation,
        )
      : await getPublicUserProfile(sessionUser.id, userId);

    if (profile.kind === "company") {
      notFound();
    }

    return (
      <section className="py-4 pb-28 sm:py-6 sm:pb-8">
        <PublicProfileCard
          profile={profile}
          conversationBackHref={
            conversation
              ? `/panel/mesajlar/${conversation}`
              : "/panel/mesajlar"
          }
          backLabel={conversation ? "Mesajlaşmaya dön" : "Geri"}
        />
      </section>
    );
  } catch (error) {
    if (error instanceof PublicProfileAccessError) {
      notFound();
    }
    throw error;
  }
}
