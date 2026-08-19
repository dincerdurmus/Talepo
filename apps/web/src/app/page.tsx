import type { Metadata } from "next";

import { HomePublicPage } from "@/components/home/v1/HomePublicPage";

export const metadata: Metadata = {
  title: "Talepo — İhtiyacınızı yazın, teklifleri karşılaştırın",
  description:
    "Talepo ile ihtiyacınızı günlük dille yazın; uygun satıcılardan teklif alın ve yan yana karşılaştırın. Talep ücretsizdir; kabul edene kadar iletişim bilgileriniz gizli kalır.",
  openGraph: {
    title: "Talepo — İhtiyacınızı yazın, teklifleri karşılaştırın",
    description:
      "Tek talep, birden fazla teklif. Sakin sakin karar verin — Talepo.",
    type: "website",
    locale: "tr_TR",
  },
};

export default function Home() {
  return <HomePublicPage />;
}
