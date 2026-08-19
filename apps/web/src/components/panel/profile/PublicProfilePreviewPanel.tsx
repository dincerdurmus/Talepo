import type { PublicUserProfileDto } from "@/lib/profile/public-profile";

import { PublicProfileCard } from "@/components/panel/ParticipantProfileDrawer";
import { SignalSection } from "./ProfileSignal";

export function PublicProfilePreviewPanel({
  profile,
  embedded = false,
}: {
  profile: PublicUserProfileDto;
  embedded?: boolean;
}) {
  if (embedded) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-950/40">
          Başkalarının gördüğü görünüm
        </p>
        <PublicProfileCard profile={profile} previewMode />
        <p className="text-[11px] leading-5 text-teal-950/40">
          E-posta, telefon, ilçe ve plan bilgileri bu görünümde yer almaz.
        </p>
      </div>
    );
  }

  return (
    <SignalSection
      title="Public profile preview"
      description="Konuşma katılımcılarının gördüğü güvenli profil görünümü."
    >
      <PublicProfileCard profile={profile} previewMode />
      <p className="mt-4 text-[11px] leading-5 text-teal-950/40">
        E-posta, telefon, ilçe ve plan bilgileri bu görünümde yer almaz.
      </p>
    </SignalSection>
  );
}
