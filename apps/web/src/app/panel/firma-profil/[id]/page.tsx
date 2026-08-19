import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
      <>
        <section className="py-4 sm:py-6">
          <Link
            href={`/panel/mesajlar/${conversation}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-black/45 hover:text-black/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Sohbete dön
          </Link>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Firma profili
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
