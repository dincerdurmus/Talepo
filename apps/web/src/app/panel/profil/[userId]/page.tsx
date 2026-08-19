import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
      <>
        <section className="py-4 sm:py-6">
          <Link
            href={conversation ? `/panel/mesajlar/${conversation}` : "/panel/mesajlar"}
            className="inline-flex items-center gap-2 text-sm font-medium text-black/45 hover:text-black/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Geri
          </Link>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Profil
          </h1>
        </section>
        <PublicProfileCard profile={profile} />
      </>
    );
  } catch (error) {
    if (error instanceof PublicProfileAccessError) {
      notFound();
    }
    throw error;
  }
}
