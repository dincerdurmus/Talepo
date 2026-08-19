import { notFound } from "next/navigation";

import { PublicProfileCard } from "@/components/panel/ParticipantProfileDrawer";
import { requireUser } from "@/server/auth/require-user";
import { getPublicCompanyProfile } from "@/server/profile/public-profile-service";
import { PublicProfileAccessError } from "@/server/profile/public-profile-access";

export default async function PublicCompanyProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversation?: string }>;
}) {
  const sessionUser = await requireUser();
  const { id: companyId } = await params;
  const { conversation } = await searchParams;

  if (!conversation) notFound();

  try {
    const profile = await getPublicCompanyProfile(sessionUser.id, companyId, {
      conversationId: conversation,
    });

    return (
      <section className="py-4 pb-28 sm:py-6 sm:pb-8">
        <PublicProfileCard
          profile={profile}
          conversationBackHref={`/panel/mesajlar/${conversation}`}
          backLabel="Mesajlaşmaya dön"
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
